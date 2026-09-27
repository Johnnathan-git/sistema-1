import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { HOTEL, INITIAL_ACCOUNTS, INITIAL_GUESTS, INITIAL_RESERVATIONS, INITIAL_ROOMS } from './pms-data';
import type {
  Account,
  Charge,
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
import { onCloudSync, startCloudSync } from './cloud-sync';

const K_ROOMS = 'uos-pms-rooms-v1';
const K_RES = 'uos-pms-reservations-v1';
const K_LOGS = 'uos-pms-roomlogs-v1';
const K_CASH = 'uos-pms-cash-v1';

function loadKey<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function saveKey(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

export type ModuleId =
  | 'recepcao'
  | 'contas'
  | 'reservas'
  | 'governanca'
  | 'fiscal'
  | 'auditoria'
  | 'aprovacao'
  | 'cartoes'
  | 'produtos'
  | 'acessos';

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
    category: Charge['category']
  ) => { ok: boolean; message: string };
  createAvulsaAccount: (guestName: string) => void;
  cashOpen: boolean;
  cashFundo: number;
  cashOpenedAt: string | null;
  openCashRegister: (fundo: number) => { ok: boolean; message: string };
  closeCashRegister: () => { ok: boolean; message: string };
}

const PmsContext = createContext<PmsState | null>(null);

const ACCOUNTS_STORAGE_KEY = 'uos-pms-accounts-v1';

function loadAccounts(): Account[] {
  try {
    if (typeof localStorage === 'undefined') return INITIAL_ACCOUNTS;
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (!raw) return INITIAL_ACCOUNTS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_ACCOUNTS;
    const valid = parsed.every(
      (a) =>
        a &&
        typeof a === 'object' &&
        typeof (a as Account).id === 'string' &&
        Array.isArray((a as Account).charges) &&
        Array.isArray((a as Account).payments)
    );
    if (!valid) return INITIAL_ACCOUNTS;
    return parsed as Account[];
  } catch {
    return INITIAL_ACCOUNTS;
  }
}

function saveAccounts(accounts: Account[]) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // quota / private mode — ignore
  }
}

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
  const [accounts, setAccounts] = useState<Account[]>(INITIAL_ACCOUNTS);
  const [roomLogs, setRoomLogs] = useState<RoomStatusLog[]>([]);
  const [module, setModule] = useState<ModuleId>('recepcao');
  const [cashOpen, setCashOpen] = useState(true);
  const [cashFundo, setCashFundo] = useState(200);
  const [cashOpenedAt, setCashOpenedAt] = useState<string | null>(() =>
    nowStamp(HOTEL.operationalDate)
  );

  const [ready, setReady] = useState(false);

  const reloadFromStorage = useCallback((key?: string) => {
    if (!key || key === ACCOUNTS_STORAGE_KEY) setAccounts(loadAccounts());
    if (!key || key === K_ROOMS) setRooms(loadKey(K_ROOMS, INITIAL_ROOMS));
    if (!key || key === K_RES) setReservations(loadKey(K_RES, INITIAL_RESERVATIONS));
    if (!key || key === K_LOGS) setRoomLogs(loadKey<RoomStatusLog[]>(K_LOGS, []));
    if (!key || key === K_CASH) {
      const c = loadKey<{ open: boolean; fundo: number; openedAt: string | null } | null>(K_CASH, null);
      if (c) {
        setCashOpen(c.open);
        setCashFundo(c.fundo);
        setCashOpenedAt(c.openedAt);
      }
    }
  }, []);

  // Sincroniza com o Lovable Cloud (todos os aparelhos)
  useEffect(() => {
    let off: (() => void) | undefined;
    startCloudSync()
      .catch(() => {})
      .finally(() => {
        reloadFromStorage();
        setReady(true);
        off = onCloudSync((k) => reloadFromStorage(k));
      });
    return () => off?.();
  }, [reloadFromStorage]);

  useEffect(() => { if (ready) saveAccounts(accounts); }, [accounts, ready]);
  useEffect(() => { if (ready) saveKey(K_ROOMS, rooms); }, [rooms, ready]);
  useEffect(() => { if (ready) saveKey(K_RES, reservations); }, [reservations, ready]);
  useEffect(() => { if (ready) saveKey(K_LOGS, roomLogs); }, [roomLogs, ready]);
  useEffect(() => {
    if (ready) saveKey(K_CASH, { open: cashOpen, fundo: cashFundo, openedAt: cashOpenedAt });
  }, [cashOpen, cashFundo, cashOpenedAt, ready]);

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

  const addCharge = useCallback(
    (
      accountId: string,
      description: string,
      amount: number,
      category: Charge['category']
    ): { ok: boolean; message: string } => {
      if (!accountId) return { ok: false, message: 'Conta não informada' };
      if (!description.trim()) return { ok: false, message: 'Informe a descrição' };
      if (!(amount > 0)) return { ok: false, message: 'Valor inválido' };

      let result: { ok: boolean; message: string } = { ok: false, message: 'Conta não encontrada' };
      setAccounts((prev) => {
        const exists = prev.find((a) => a.id === accountId);
        if (!exists) {
          result = { ok: false, message: 'Conta não encontrada' };
          return prev;
        }
        if (exists.status === 'quitada') {
          result = { ok: false, message: 'Conta já quitada' };
          return prev;
        }
        const charge: Charge = {
          id: uid('chg'),
          description: description.trim(),
          amount,
          date: hotel.operationalDate,
          category: category || 'consumo',
        };
        result = { ok: true, message: 'Lançamento adicionado à conta' };
        return prev.map((a) =>
          a.id === accountId
            ? {
                ...a,
                status: a.status === 'quitada' ? a.status : ('aberta' as const),
                charges: [...a.charges, charge],
              }
            : a
        );
      });
      return result;
    },
    [hotel.operationalDate]
  );

  const updateGovernance = useCallback(
    (roomIds: string[], governance: GovernanceStatus, notes?: string) => {
      const ocupados = rooms.filter(
        (r) => roomIds.includes(r.id) && r.occupancy === 'ocupado'
      ).length;
      setRooms((prev) =>
        prev.map((r) => {
          if (!roomIds.includes(r.id)) return r;
          if (r.occupancy === 'ocupado') return r;
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
      const ok = roomIds.length - ocupados;
      return {
        ok,
        fail: ocupados,
        message:
          ocupados > 0
            ? `${ok} alterada(s), ${ocupados} bloqueada(s) (hóspede in-house)`
            : `${ok} UH(s) atualizada(s)`,
      };
    },
    [pushLog, rooms]
  );

  const assignHousekeeper = useCallback((roomIds: string[], housekeeper: string | undefined) => {
    setRooms((prev) => prev.map((r) => (roomIds.includes(r.id) ? { ...r, housekeeper } : r)));
  }, []);

  const setRoomNotes = useCallback((roomId: string, notes: string) => {
    setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, notes } : r)));
  }, []);

  const setDnd = useCallback((roomId: string, dnd: boolean) => {
    setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, dnd } : r)));
  }, []);

  const blockRoom = useCallback(
    (roomId: string, reason: string) => {
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return { ok: false, message: 'UH não encontrada' };
      if (room.occupancy === 'ocupado')
        return { ok: false, message: 'Não bloqueia UH com hóspede' };
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
      if (room.occupancy !== 'bloqueado') return { ok: false, message: 'UH não está bloqueada' };
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
      if (res.status === 'checkin') return { ok: false, message: 'Já está em check-in' };
      if (res.status === 'checkout' || res.status === 'cancelada')
        return { ok: false, message: 'Reserva não pode fazer check-in' };
      const room = res.roomId ? rooms.find((r) => r.id === res.roomId) : undefined;
      if (room && !isRoomReadyForCheckIn(room)) {
        return { ok: false, message: roomNotReadyReason(room) || 'UH não pronta' };
      }
      const accId = res.accountId || uid('acc');
      setReservations((prev) =>
        prev.map((r) =>
          r.id === reservationId
            ? { ...r, status: 'checkin' as ReservationStatus, accountId: accId }
            : r
        )
      );
      if (res.roomId) {
        setRooms((prev) =>
          prev.map((r) =>
            r.id === res.roomId ? { ...r, occupancy: 'ocupado' as OccupancyStatus } : r
          )
        );
      }
      setAccounts((prev) => {
        if (prev.some((a) => a.id === accId)) return prev;
        return [
          ...prev,
          {
            id: accId,
            type: 'hospede' as const,
            guestId: res.guestId,
            guestName: res.guestName,
            reservationId: res.id,
            roomId: res.roomId,
            status: 'aberta' as const,
            charges: [],
            payments: [],
            openedAt: hotel.operationalDate,
          },
        ];
      });
      return { ok: true, message: `Check-in ${res.guestName}` };
    },
    [reservations, rooms, hotel.operationalDate]
  );

  const checkOut = useCallback(
    (reservationId: string) => {
      const res = reservations.find((r) => r.id === reservationId);
      if (!res) return { ok: false, message: 'Reserva não encontrada' };
      if (res.status !== 'checkin') return { ok: false, message: 'Hóspede não está in-house' };
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
                }
              : r
          )
        );
      }
      return { ok: true, message: `Check-out ${res.guestName}` };
    },
    [reservations]
  );

  const cancelCheckIn = useCallback(
    (reservationId: string) => {
      const res = reservations.find((r) => r.id === reservationId);
      if (!res) return { ok: false, message: 'Reserva não encontrada' };
      if (res.status !== 'checkin') return { ok: false, message: 'Não está em check-in' };
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
                }
              : r
          )
        );
      }
      return { ok: true, message: 'Check-in cancelado' };
    },
    [reservations]
  );

  const transferRoom = useCallback(
    (reservationId: string, newRoomId: string) => {
      const res = reservations.find((r) => r.id === reservationId);
      const newRoom = rooms.find((r) => r.id === newRoomId);
      if (!res || !newRoom) return { ok: false, message: 'Dados inválidos' };
      if (res.status !== 'checkin') return { ok: false, message: 'Só transferir hóspede in-house' };
      if (!isRoomReadyForCheckIn(newRoom))
        return { ok: false, message: roomNotReadyReason(newRoom) || 'UH destino não pronta' };
      const oldId = res.roomId;
      setReservations((prev) =>
        prev.map((r) =>
          r.id === reservationId
            ? { ...r, roomId: newRoomId, roomNumber: newRoom.number }
            : r
        )
      );
      setRooms((prev) =>
        prev.map((r) => {
          if (r.id === oldId)
            return {
              ...r,
              occupancy: 'livre' as OccupancyStatus,
              governance: 'sujo' as GovernanceStatus,
            };
          if (r.id === newRoomId) return { ...r, occupancy: 'ocupado' as OccupancyStatus };
          return r;
        })
      );
      if (res.accountId) {
        setAccounts((prev) =>
          prev.map((a) => (a.id === res.accountId ? { ...a, roomId: newRoomId } : a))
        );
      }
      return { ok: true, message: `Transferido para UH ${newRoom.number}` };
    },
    [reservations, rooms]
  );

  const upsertReservation = useCallback((res: Reservation) => {
    setReservations((prev) => {
      const i = prev.findIndex((r) => r.id === res.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = res;
        return next;
      }
      return [...prev, res];
    });
  }, []);

  const cancelReservation = useCallback((id: string) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'cancelada' as ReservationStatus } : r))
    );
  }, []);

  const markFnrh = useCallback((id: string) => {
    setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, fnrhFilled: true } : r)));
  }, []);

  const addPayment = useCallback(
    (accountId: string, amount: number, method: string) => {
      if (!(amount > 0)) return;
      setAccounts((prev) =>
        prev.map((a) => {
          if (a.id !== accountId) return a;
          return {
            ...a,
            payments: [
              ...a.payments,
              { id: uid('pay'), amount, method, date: hotel.operationalDate },
            ],
          };
        })
      );
    },
    [hotel.operationalDate]
  );

  const createAvulsaAccount = useCallback(
    (guestName: string) => {
      const name = guestName.trim() || 'Avulso';
      setAccounts((prev) => [
        ...prev,
        {
          id: uid('acc'),
          type: 'avulsa',
          guestName: name,
          status: 'aberta',
          charges: [],
          payments: [],
          openedAt: hotel.operationalDate,
        },
      ]);
    },
    [hotel.operationalDate]
  );

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

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando dados…
      </div>
    );
  }
  return <PmsContext.Provider value={value}>{children}</PmsContext.Provider>;
}

export function usePms() {
  const ctx = useContext(PmsContext);
  if (!ctx) throw new Error('usePms must be used within PmsProvider');
  return ctx;
}
