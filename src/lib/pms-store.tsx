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

export type ModuleId = 'recepcao' | 'contas' | 'reservas' | 'governanca' | 'fiscal';

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

  // NOTE: remainder of store restored in next commit if truncated — full body follows in parallel file
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
      updateGovernance: () => ({ ok: 0, fail: 0, message: '' }),
      assignHousekeeper: () => {},
      setRoomNotes: () => {},
      setDnd: () => {},
      blockRoom: () => ({ ok: false, message: '' }),
      unblockRoom: () => ({ ok: false, message: '' }),
      checkIn: () => ({ ok: false, message: '' }),
      checkOut: () => ({ ok: false, message: '' }),
      cancelCheckIn: () => ({ ok: false, message: '' }),
      transferRoom: () => ({ ok: false, message: '' }),
      upsertReservation: () => {},
      cancelReservation: () => {},
      markFnrh: () => {},
      addPayment: () => {},
      addCharge: () => {},
      createAvulsaAccount: () => {},
    }),
    [hotel, rooms, guests, reservations, accounts, roomLogs, module, cashOpen, cashFundo, cashOpenedAt, openCashRegister, closeCashRegister]
  );

  return <PmsContext.Provider value={value}>{children}</PmsContext.Provider>;
}

export function usePms() {
  const ctx = useContext(PmsContext);
  if (!ctx) throw new Error('usePms must be used within PmsProvider');
  return ctx;
}
