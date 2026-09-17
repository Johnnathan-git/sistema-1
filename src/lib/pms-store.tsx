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
  GovernanceStatus,
  Guest,
  Hotel,
  OccupancyStatus,
  Reservation,
  ReservationStatus,
  Room,
  RoomStatusLog,
} from './pms-types';
import { isRoomReadyForCheckIn, roomNotReadyReason } from './pms-types';

export type ModuleId = 'recepcao' | 'contas' | 'reservas' | 'governanca';

export const GOVERNANCE_STATUSES: GovernanceStatus[] = [
  'limpo',
  'sujo',
  'limpeza',
  'inspecao',
  'interditado',
];

interface PmsState {
  hotel: Hotel;
  rooms: Room[];
  guests: Guest[];
  reservations: Reservation[];
  accounts: Account[];
  roomLogs: RoomStatusLog[];
  module: ModuleId;
  setModule: (m: ModuleId) => void;
  updateGovernance: (
    roomIds: string[],
    governance: GovernanceStatus,
    notes?: string
  ) => { ok: number; fail: number; message: string };
  assignHousekeeper: (roomIds: string[], housekeeper: string | undefined) => void;
  setRoomNotes: (roomId: string, notes: string) => void;
  setDnd: (roomId: string, dnd: boolean) => void;
  blockRoom: (roomId: string, reason: string) => { ok: boolean; message: string };
  unblockRoom: (roomId: string) => { ok: boolean; message: string };
  checkIn: (reservationId: string) => { ok: boolean; message: string };
  checkOut: (reservationId: string) => { ok: boolean; message: string };
  cancelCheckIn: (reservationId: string) => { ok: boolean; message: string };
  transferRoom: (
    reservationId: string,
    newRoomId: string
  ) => { ok: boolean; message: string };
  upsertReservation: (res: Reservation) => void;
  cancelReservation: (id: string) => void;
  markFnrh: (id: string) => void;
  addPayment: (accountId: string, amount: number, method: string) => void;
  addCharge: (
    accountId: string,
    description: string,
    amount: number,
    category: Account['charges'][0]['category']
  ) => void;
  createAvulsaAccount: (guestName: string) => void;
  cashOpen: boolean;
  cashFundo: number;
  cashOpenedAt: string | null;
  openCashRegister: (fundo: number) => { ok: boolean; message: string };
  closeCashRegister: () => { ok: boolean; message: string };
}

const PmsContext = createContext<PmsState | null>(null);

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function nowStamp(opDate: string) {
  const t = new Date();
  const hh = String(t.getHours()).padStart(2, '0');
  const mm = String(t.getMinutes()).padStart(2, '0');
  return `${opDate} ${hh}:${mm}`;
}

export function PmsProvider({ children }: { children: ReactNode }) {
  const [hotel] = useState(HOTEL);
  const [rooms, setRooms] = useState(INITIAL_ROOMS);
  const [guests] = useState(INITIAL_GUESTS);
  const [reservations, setReservations] = useState(INITIAL_RESERVATIONS);
  const [accounts, setAccounts] = useState(INITIAL_ACCOUNTS);
  const [roomLogs, setRoomLogs] = useState<RoomStatusLog[]>([]);
  const [module, setModule] = useState<ModuleId>('recepcao');
  const [cashOpen, setCashOpen] = useState(true);
  const [cashFundo, setCashFundo] = useState(200);
  const [cashOpenedAt, setCashOpenedAt] = useState<string | null>(() =>
    nowStamp(HOTEL.operationalDate)
  );

  const pushLog = useCallback(
    (entry: Omit<RoomStatusLog, 'id' | 'at' | 'user'> & { at?: string; user?: string }) => {
      setRoomLogs((prev) =>
        [
          {
            id: uid('log'),
            at: entry.at || nowStamp(hotel.operationalDate),
            user: entry.user || 'Operador',
            ...entry,
          },
          ...prev,
        ].slice(0, 200)
      );
    },
    [hotel.operationalDate]
  );

  const openCashRegister = useCallback(
    (fundo: number) => {
      if (cashOpen) return { ok: false, message: 'Caixa já está aberto' };
      if (Number.isNaN(fundo) || fundo < 0)
        return { ok: false, message: 'Informe o fundo de caixa em dinheiro' };
      setCashOpen(true);
      setCashFundo(fundo);
      setCashOpenedAt(nowStamp(hotel.operationalDate));
      return {
        ok: true,
        message: `Caixa aberto · fundo R$ ${fundo.toFixed(2).replace('.', ',')}`,
      };
    },
    [cashOpen, hotel.operationalDate]
  );

  const closeCashRegister = useCallback(() => {
    if (!cashOpen) return { ok: false, message: 'Caixa já está fechado' };
    setCashOpen(false);
    setCashOpenedAt(null);
    return { ok: true, message: 'Caixa fechado com sucesso' };
  }, [cashOpen]);

  const updateGovernance = useCallback(
    (roomIds: string[], governance: GovernanceStatus, notes?: string) => {
      let fail = 0;
      setRooms((prev) =>
        prev.map((r) => {
          if (!roomIds.includes(r.id)) return r;
          if (r.occupancy === 'ocupado') {
            fail += 1;
            return r;
          }
          let occupancy: OccupancyStatus = r.occupancy;
          let blockedReason = r.blockedReason;
          if (governance === 'interditado' || governance === 'manutencao') {
            occupancy = 'bloqueado';
            blockedReason = notes || r.notes || governance;
          } else if (
            r.occupancy === 'bloqueado' &&
            (r.governance === 'interditado' || r.governance === 'manutencao')
          ) {
            occupancy = 'livre';
            blockedReason = undefined;
          }
          pushLog({
            roomId: r.id,
            roomNumber: r.number,
            governance,
            occupancy,
            note: notes,
            source: 'governanca',
          });
          return {
            ...r,
            governance,
            occupancy,
            notes: notes !== undefined ? notes : r.notes,
            blockedReason,
          };
        })
      );
      const ocupados = rooms.filter(
        (r) => roomIds.includes(r.id) && r.occupancy === 'ocupado'
      ).length;
      fail = ocupados;
      const ok = roomIds.length - fail;
      return {
        ok,
        fail,
        message:
          fail > 0
            ? `${ok} alterada(s), ${fail} bloqueada(s) (hóspede in-house)`
            : `${ok} UH(s) atualizada(s)`,
      };
    },
    [pushLog, rooms]
  );

  const assignHousekeeper = useCallback(
    (roomIds: string[], housekeeper: string | undefined) => {
      setRooms((prev) =>
        prev.map((r) => (roomIds.includes(r.id) ? { ...r, housekeeper } : r))
      );
      for (const id of roomIds) {
        const room = rooms.find((r) => r.id === id);
        if (room)
          pushLog({
            roomId: id,
            roomNumber: room.number,
            housekeeper: housekeeper || '(sem camareira)',
            source: 'governanca',
            note: housekeeper ? `Camareira: ${housekeeper}` : 'Camareira removida',
          });
      }
    },
    [pushLog, rooms]
  );

  const setRoomNotes = useCallback(
    (roomId: string, notes: string) => {
      setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, notes } : r)));
      const room = rooms.find((r) => r.id === roomId);
      if (room)
        pushLog({
          roomId,
          roomNumber: room.number,
          note: notes || '(obs. limpa)',
          source: 'governanca',
        });
    },
    [pushLog, rooms]
  );

  const setDnd = useCallback(
    (roomId: string, dnd: boolean) => {
      setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, dnd } : r)));
      const room = rooms.find((r) => r.id === roomId);
      if (room)
        pushLog({
          roomId,
          roomNumber: room.number,
          note: dnd ? 'Não perturbe ATIVO' : 'Não perturbe desativado',
          source: 'governanca',
        });
    },
    [pushLog, rooms]
  );

  const blockRoom = useCallback(
    (roomId: string, reason: string) => {
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return { ok: false, message: 'UH não encontrada' };
      if (room.occupancy === 'ocupado')
        return { ok: false, message: 'Não bloqueia UH com hóspede — faça check-out antes' };
      setRooms((prev) =>
        prev.map((r) =>
          r.id === roomId
            ? {
                ...r,
                occupancy: 'bloqueado' as OccupancyStatus,
                blockedReason: reason,
                notes: reason || r.notes,
              }
            : r
        )
      );
      pushLog({
        roomId,
        roomNumber: room.number,
        occupancy: 'bloqueado',
        note: reason,
        source: 'governanca',
      });
      return { ok: true, message: `${room.number} bloqueada` };
    },
    [rooms, pushLog]
  );

  const unblockRoom = useCallback(
    (roomId: string) => {
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return { ok: false, message: 'UH não encontrada' };
      if (room.occupancy !== 'bloqueado')
        return { ok: false, message: 'UH não está bloqueada' };
      setRooms((prev) =>
        prev.map((r) =>
          r.id === roomId
            ? {
                ...r,
                occupancy: 'livre' as OccupancyStatus,
                blockedReason: undefined,
                governance:
                  r.governance === 'interditado' || r.governance === 'manutencao'
                    ? ('sujo' as GovernanceStatus)
                    : r.governance,
              }
            : r
        )
      );
      pushLog({
        roomId,
        roomNumber: room.number,
        occupancy: 'livre',
        note: 'Desbloqueio',
        source: 'governanca',
      });
      return { ok: true, message: `${room.number} desbloqueada` };
    },
    [rooms, pushLog]
  );

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
      if (!isRoomReadyForCheckIn(room)) {
        return {
          ok: false,
          message: `UH ${room.number}: ${roomNotReadyReason(room) || 'não pronta'}`,
        };
      }

      const otherInHouse = reservations.find(
        (r) => r.roomId === res.roomId && r.status === 'checkin' && r.id !== res.id
      );
      if (otherInHouse)
        return { ok: false, message: `UH já vinculada a ${otherInHouse.guestName}` };

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
      setRooms((prev) =>
        prev.map((r) =>
          r.id === res.roomId
            ? {
                ...r,
                occupancy: 'ocupado' as OccupancyStatus,
                governance: 'sujo' as GovernanceStatus,
                dnd: false,
              }
            : r
        )
      );
      pushLog({
        roomId: res.roomId!,
        roomNumber: res.roomNumber || room.number,
        occupancy: 'ocupado',
        governance: 'sujo',
        source: 'checkin',
        note: `Check-in ${res.guestName} · UH Suja`,
      });

      return {
        ok: true,
        message: `Check-in realizado — ${res.guestName} em ${res.roomNumber}`,
      };
    },
    [reservations, rooms, hotel.operationalDate, pushLog]
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
              message: `Conta com saldo pendente de R$ ${(charges - payments)
                .toFixed(2)
                .replace('.', ',')}`,
            };
        }
      }

      setReservations((prev) =>
        prev.map((r) =>
          r.id === reservationId ? { ...r, status: 'checkout' as ReservationStatus } : r
        )
      );
      if (res.roomId) {
        setRooms((prev) =>
          prev.map((r) =>
            r.id === res.roomId
              ? {
                  ...r,
                  occupancy: 'livre' as OccupancyStatus,
                  governance: 'sujo' as GovernanceStatus,
                  dnd: false,
                }
              : r
          )
        );
        pushLog({
          roomId: res.roomId,
          roomNumber: res.roomNumber || '',
          occupancy: 'livre',
          governance: 'sujo',
          source: 'checkout',
          note: `Check-out ${res.guestName}`,
        });
      }
      if (res.accountId) {
        setAccounts((prev) =>
          prev.map((a) => (a.id === res.accountId ? { ...a, status: 'quitada' } : a))
        );
      }
      return {
        ok: true,
        message: `Check-out de ${res.guestName} concluído · UH marcada como Suja`,
      };
    },
    [reservations, accounts, pushLog]
  );

  const cancelCheckIn = useCallback(
    (reservationId: string) => {
      const res = reservations.find((r) => r.id === reservationId);
      if (!res) return { ok: false, message: 'Reserva não encontrada' };
      if (res.status !== 'checkin')
        return { ok: false, message: 'Só é possível cancelar check-in de hóspede in-house' };

      setReservations((prev) =>
        prev.map((r) =>
          r.id === reservationId ? { ...r, status: 'confirmada' as ReservationStatus } : r
        )
      );
      if (res.roomId) {
        setRooms((prev) =>
          prev.map((r) =>
            r.id === res.roomId
              ? {
                  ...r,
                  occupancy: 'livre' as OccupancyStatus,
                  governance: 'sujo' as GovernanceStatus,
                  dnd: false,
                }
              : r
          )
        );
        pushLog({
          roomId: res.roomId,
          roomNumber: res.roomNumber || '',
          occupancy: 'livre',
          governance: 'sujo',
          source: 'sistema',
          note: `Check-in cancelado · ${res.guestName}`,
        });
      }
      return {
        ok: true,
        message: `Check-in de ${res.guestName} cancelado · UH ${res.roomNumber} liberada (suja)`,
      };
    },
    [reservations, pushLog]
  );

  const transferRoom = useCallback(
    (reservationId: string, newRoomId: string) => {
      const res = reservations.find((r) => r.id === reservationId);
      if (!res) return { ok: false, message: 'Reserva não encontrada' };
      if (res.status !== 'checkin')
        return { ok: false, message: 'Só transfere hóspede em check-in' };
      if (!res.roomId) return { ok: false, message: 'Reserva sem UH atual' };
      if (res.roomId === newRoomId) return { ok: false, message: 'Selecione uma UH diferente' };

      const oldRoom = rooms.find((r) => r.id === res.roomId);
      const newRoom = rooms.find((r) => r.id === newRoomId);
      if (!newRoom) return { ok: false, message: 'UH destino não encontrada' };

      if (newRoom.occupancy === 'ocupado')
        return { ok: false, message: `UH ${newRoom.number} já está ocupada` };
      if (newRoom.occupancy === 'bloqueado')
        return { ok: false, message: `UH ${newRoom.number} está bloqueada` };
      if (newRoom.governance === 'interditado' || newRoom.governance === 'manutencao')
        return { ok: false, message: `UH ${newRoom.number} não disponível` };

      const other = reservations.find(
        (r) => r.roomId === newRoomId && r.status === 'checkin' && r.id !== res.id
      );
      if (other) return { ok: false, message: `UH já com ${other.guestName}` };

      setReservations((prev) =>
        prev.map((r) =>
          r.id === reservationId
            ? {
                ...r,
                roomId: newRoom.id,
                roomNumber: newRoom.number,
                roomType: newRoom.type,
              }
            : r
        )
      );

      setRooms((prev) =>
        prev.map((r) => {
          if (r.id === res.roomId) {
            return {
              ...r,
              occupancy: 'livre' as OccupancyStatus,
              governance: 'sujo' as GovernanceStatus,
              dnd: false,
            };
          }
          if (r.id === newRoomId) {
            return {
              ...r,
              occupancy: 'ocupado' as OccupancyStatus,
              governance: 'sujo' as GovernanceStatus,
              dnd: false,
            };
          }
          return r;
        })
      );

      if (res.accountId) {
        setAccounts((prev) =>
          prev.map((a) => (a.id === res.accountId ? { ...a, roomId: newRoomId } : a))
        );
      }

      pushLog({
        roomId: res.roomId,
        roomNumber: oldRoom?.number || res.roomNumber || '',
        occupancy: 'livre',
        governance: 'sujo',
        source: 'sistema',
        note: `Transferência saída · ${res.guestName} → ${newRoom.number}`,
      });
      pushLog({
        roomId: newRoomId,
        roomNumber: newRoom.number,
        occupancy: 'ocupado',
        governance: 'sujo',
        source: 'sistema',
        note: `Transferência entrada · ${res.guestName} de ${res.roomNumber}`,
      });

      return {
        ok: true,
        message: `${res.guestName}: ${res.roomNumber} → ${newRoom.number}`,
      };
    },
    [reservations, rooms, pushLog]
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

  const addPayment = useCallback(
    (accountId: string, amount: number, method: string) => {
      if (!cashOpen) return;
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
            paid >= charges - 0.01 ? 'quitada' : paid > 0 ? 'parcial' : a.status;
          return { ...a, payments, status };
        })
      );
    },
    [cashOpen]
  );

  const addCharge = useCallback(
    (
      accountId: string,
      description: string,
      amount: number,
      category: Account['charges'][0]['category']
    ) => {
      if (!cashOpen) return;
      setAccounts((prev) =>
        prev.map((a) => {
          if (a.id !== accountId) return a;
          const charges = [
            ...a.charges,
            { id: uid('c'), description, amount, date: HOTEL.operationalDate, category },
          ];
          return { ...a, charges, status: a.status === 'quitada' ? 'parcial' : a.status };
        })
      );
    },
    [cashOpen]
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
      roomLogs,
      module,
      setModule,
      cashOpen,
      cashFundo,
      cashOpenedAt,
      openCashRegister,
      closeCashRegister,
      updateGovernance,
      assignHousekeeper,
      setRoomNotes,
      setDnd,
      blockRoom,
      unblockRoom,
      checkIn,
      checkOut,
      cancelCheckIn,
      transferRoom,
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
      roomLogs,
      module,
      cashOpen,
      cashFundo,
      cashOpenedAt,
      openCashRegister,
      closeCashRegister,
      updateGovernance,
      assignHousekeeper,
      setRoomNotes,
      setDnd,
      blockRoom,
      unblockRoom,
      checkIn,
      checkOut,
      cancelCheckIn,
      transferRoom,
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
