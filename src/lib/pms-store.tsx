import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { HOTEL, INITIAL_ACCOUNTS, INITIAL_GUESTS, INITIAL_RESERVATIONS, INITIAL_ROOMS } from './pms-data';
import type {
  Account,
  Guest,
  Hotel,
  Reservation,
  ReservationStatus,
  Room,
  RoomStatus,
} from './pms-types';

export type ModuleId = 'recepcao' | 'contas' | 'reservas' | 'governanca';

interface PmsState {
  hotel: Hotel;
  rooms: Room[];
  guests: Guest[];
  reservations: Reservation[];
  accounts: Account[];
  module: ModuleId;
  setModule: (m: ModuleId) => void;
  updateRoomStatus: (roomId: string, status: RoomStatus, notes?: string) => void;
  checkIn: (reservationId: string) => { ok: boolean; message: string };
  checkOut: (reservationId: string) => { ok: boolean; message: string };
  upsertReservation: (res: Reservation) => void;
  cancelReservation: (id: string) => void;
  markFnrh: (id: string) => void;
  addPayment: (accountId: string, amount: number, method: string) => void;
  addCharge: (accountId: string, description: string, amount: number, category: Account['charges'][0]['category']) => void;
  createAvulsaAccount: (guestName: string) => void;
}

const PmsContext = createContext<PmsState | null>(null);

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function PmsProvider({ children }: { children: ReactNode }) {
  const [hotel] = useState(HOTEL);
  const [rooms, setRooms] = useState(INITIAL_ROOMS);
  const [guests] = useState(INITIAL_GUESTS);
  const [reservations, setReservations] = useState(INITIAL_RESERVATIONS);
  const [accounts, setAccounts] = useState(INITIAL_ACCOUNTS);
  const [module, setModule] = useState<ModuleId>('recepcao');

  const updateRoomStatus = useCallback((roomId: string, status: RoomStatus, notes?: string) => {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? { ...r, status, notes: notes !== undefined ? notes : r.notes }
          : r
      )
    );
  }, []);

  const checkIn = useCallback(
    (reservationId: string) => {
      const res = reservations.find((r) => r.id === reservationId);
      if (!res) return { ok: false, message: 'Reserva não encontrada' };
      if (res.status === 'checkin') return { ok: false, message: 'Já está hospedado' };
      if (res.status === 'cancelada' || res.status === 'checkout')
        return { ok: false, message: 'Reserva não permite check-in' };
      if (!res.roomId) return { ok: false, message: 'Atribua uma UH antes do check-in' };

      const room = rooms.find((r) => r.id === res.roomId);
      if (!room) return { ok: false, message: 'UH não encontrada' };
      if (room.status === 'interditado' || room.status === 'manutencao')
        return { ok: false, message: `UH ${room.number} indisponível (${room.status})` };
      if (room.status === 'sujo' || room.status === 'limpeza' || room.status === 'inspecao')
        return { ok: false, message: `UH ${room.number} não está pronta` };

      const accountId = res.accountId || uid('acc');
      if (!res.accountId) {
        const balanceDue = Math.max(0, res.totalAmount - res.paidAmount);
        const newAcc: Account = {
          id: accountId,
          type: 'hospede',
          guestId: res.guestId,
          guestName: res.guestName,
          reservationId: res.id,
          roomId: res.roomId,
          status: balanceDue > 0 ? 'parcial' : 'quitada',
          openedAt: hotel.operationalDate,
          charges: [
            {
              id: uid('c'),
              description: `Hospedagem ${res.roomType}`,
              amount: res.totalAmount,
              date: hotel.operationalDate,
              category: 'hospedagem',
            },
          ],
          payments:
            res.paidAmount > 0
              ? [
                  {
                    id: uid('p'),
                    amount: res.paidAmount,
                    method: 'Pré-pagamento',
                    date: hotel.operationalDate,
                  },
                ]
              : [],
        };
        setAccounts((a) => [newAcc, ...a]);
      }

      setReservations((prev) =>
        prev.map((r) =>
          r.id === reservationId
            ? { ...r, status: 'checkin' as ReservationStatus, accountId, fnrhFilled: r.fnrhFilled }
            : r
        )
      );
      updateRoomStatus(res.roomId, 'ocupado');
      return { ok: true, message: `Check-in realizado — ${res.guestName} em ${res.roomNumber}` };
    },
    [reservations, rooms, hotel.operationalDate, updateRoomStatus]
  );

  const checkOut = useCallback(
    (reservationId: string) => {
      const res = reservations.find((r) => r.id === reservationId);
      if (!res) return { ok: false, message: 'Reserva não encontrada' };
      if (res.status !== 'checkin') return { ok: false, message: 'Hóspede não está em check-in' };

      if (res.accountId) {
        const acc = accounts.find((a) => a.id === res.accountId);
        if (acc) {
          const charges = acc.charges.reduce((s, c) => s + c.amount, 0);
          const payments = acc.payments.reduce((s, p) => s + p.amount, 0);
          if (charges - payments > 0.01)
            return {
              ok: false,
              message: `Conta com saldo pendente de R$ ${(charges - payments).toFixed(2).replace('.', ',')}`,
            };
        }
      }

      setReservations((prev) =>
        prev.map((r) =>
          r.id === reservationId ? { ...r, status: 'checkout' as ReservationStatus } : r
        )
      );
      if (res.roomId) updateRoomStatus(res.roomId, 'sujo');
      if (res.accountId) {
        setAccounts((prev) =>
          prev.map((a) => (a.id === res.accountId ? { ...a, status: 'quitada' } : a))
        );
      }
      return { ok: true, message: `Check-out de ${res.guestName} concluído` };
    },
    [reservations, accounts, updateRoomStatus]
  );

  const upsertReservation = useCallback((res: Reservation) => {
    setReservations((prev) => {
      const exists = prev.some((r) => r.id === res.id);
      if (exists) return prev.map((r) => (r.id === res.id ? res : r));
      return [res, ...prev];
    });
  }, []);

  const cancelReservation = useCallback((id: string) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'cancelada' as ReservationStatus } : r))
    );
  }, []);

  const markFnrh = useCallback((id: string) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, fnrhFilled: true } : r))
    );
  }, []);

  const addPayment = useCallback((accountId: string, amount: number, method: string) => {
    setAccounts((prev) =>
      prev.map((a) => {
        if (a.id !== accountId) return a;
        const payments = [
          ...a.payments,
          { id: uid('p'), amount, method, date: HOTEL.operationalDate },
        ];
        const charges = a.charges.reduce((s, c) => s + c.amount, 0);
        const paid = payments.reduce((s, p) => s + p.amount, 0);
        const status =
          paid >= charges - 0.01 ? 'quitada' : paid > 0 ? 'parcial' : 'aberta';
        return { ...a, payments, status };
      })
    );
  }, []);

  const addCharge = useCallback(
    (
      accountId: string,
      description: string,
      amount: number,
      category: Account['charges'][0]['category']
    ) => {
      setAccounts((prev) =>
        prev.map((a) => {
          if (a.id !== accountId) return a;
          const charges = [
            ...a.charges,
            {
              id: uid('c'),
              description,
              amount,
              date: HOTEL.operationalDate,
              category,
            },
          ];
          const totalC = charges.reduce((s, c) => s + c.amount, 0);
          const paid = a.payments.reduce((s, p) => s + p.amount, 0);
          const status =
            paid >= totalC - 0.01 ? 'quitada' : paid > 0 ? 'parcial' : 'aberta';
          return { ...a, charges, status };
        })
      );
    },
    []
  );

  const createAvulsaAccount = useCallback((guestName: string) => {
    const acc: Account = {
      id: uid('acc'),
      type: 'avulsa',
      guestName,
      status: 'aberta',
      openedAt: HOTEL.operationalDate,
      charges: [],
      payments: [],
    };
    setAccounts((a) => [acc, ...a]);
  }, []);

  const value = useMemo(
    () => ({
      hotel,
      rooms,
      guests,
      reservations,
      accounts,
      module,
      setModule,
      updateRoomStatus,
      checkIn,
      checkOut,
      upsertReservation,
      cancelReservation,
      markFnrh,
      addPayment,
      addCharge,
      createAvulsaAccount,
    }),
    [
      hotel,
      rooms,
      guests,
      reservations,
      accounts,
      module,
      updateRoomStatus,
      checkIn,
      checkOut,
      upsertReservation,
      cancelReservation,
      markFnrh,
      addPayment,
      addCharge,
      createAvulsaAccount,
    ]
  );

  return <PmsContext.Provider value={value}>{children}</PmsContext.Provider>;
}

export function usePms() {
  const ctx = useContext(PmsContext);
  if (!ctx) throw new Error('usePms must be used within PmsProvider');
  return ctx;
}
