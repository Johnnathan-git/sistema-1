import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { accountBalance, isRoomReadyForCheckIn, roomNotReadyReason } from './pms-types';
import { listCards } from './nfc-cards';
import { onCloudSync, startCloudSync } from './cloud-sync';

const K_ROOMS = 'uos-pms-rooms-v1';
const K_RES = 'uos-pms-reservations-v1';
const K_LOGS = 'uos-pms-roomlogs-v1';
const K_CASH = 'uos-pms-cash-v1';
const ACCOUNTS_STORAGE_KEY = 'uos-pms-accounts-v1';

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
        Array.isArray((a as Account).payments),
    );
    return valid ? (parsed as Account[]) : INITIAL_ACCOUNTS;
  } catch {
    return INITIAL_ACCOUNTS;
  }
}

function saveAccounts(accounts: Account[]) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch {}
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

function chargeTimestamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mon = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${yyyy}-${mon}-${dd}T${hh}:${mm}:${ss}.${ms}`;
}

function overlaps(aIn: string, aOut: string, bIn: string, bOut: string) {
  return aIn < bOut && aOut > bIn;
}

function isActiveReservation(r: Reservation) {
  return r.status !== 'cancelada' && r.status !== 'no_show' && r.status !== 'checkout';
}

function initialReservationMovements(res: Reservation) {
  const stamp = chargeTimestamp();
  const charges: Charge[] =
    res.totalAmount > 0
      ? [
          {
            id: uid('chg'),
            description: `Hospedagem · ${res.code}`,
            amount: res.totalAmount,
            date: stamp,
            category: 'hospedagem',
          },
        ]
      : [];
  const payments =
    res.paidAmount > 0
      ? [
          {
            id: uid('pay'),
            amount: res.paidAmount,
            method: 'Adiantamento da reserva',
            date: stamp,
          },
        ]
      : [];
  return { charges, payments };
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
  | 'venda'
  | 'produtos'
  | 'acessos';

export const GOVERNANCE_STATUSES: GovernanceStatus[] = [
  'limpo',
  'sujo',
  'limpeza',
  'inspecao',
  'interditado',
];

type ActionResult = { ok: boolean; message: string };

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
    notes?: string,
  ) => { ok: number; fail: number; message: string };
  assignHousekeeper: (roomIds: string[], housekeeper: string | undefined) => void;
  setRoomNotes: (roomId: string, notes: string) => void;
  setDnd: (roomId: string, dnd: boolean) => void;
  blockRoom: (roomId: string, reason: string) => ActionResult;
  unblockRoom: (roomId: string) => ActionResult;
  checkIn: (reservationId: string, reservationSnapshot?: Reservation) => ActionResult;
  checkOut: (reservationId: string) => ActionResult;
  cancelCheckIn: (reservationId: string) => ActionResult;
  transferRoom: (reservationId: string, newRoomId: string) => ActionResult;
  upsertReservation: (res: Reservation) => ActionResult;
  cancelReservation: (id: string) => void;
  markFnrh: (id: string) => void;
  addPayment: (accountId: string, amount: number, method: string) => ActionResult;
  addCharge: (
    accountId: string,
    description: string,
    amount: number,
    category: Charge['category'],
  ) => ActionResult;
  addCharges: (
    accountId: string,
    charges: { description: string; amount: number; category: Charge['category'] }[],
  ) => ActionResult;
  createAvulsaAccount: (guestName: string) => void;
  createCompanionAccount: (
    reservationId: string,
    companionId: string,
  ) => { ok: boolean; message: string; accountId?: string };
  cashOpen: boolean;
  cashFundo: number;
  cashOpenedAt: string | null;
  openCashRegister: (fundo: number) => ActionResult;
  closeCashRegister: () => ActionResult;
}

const PmsContext = createContext<PmsState | null>(null);

export function PmsProvider({ children }: { children: ReactNode }) {
  const [hotel] = useState(HOTEL);
  const [rooms, setRooms] = useState(INITIAL_ROOMS);
  const [guests] = useState(INITIAL_GUESTS);
  const [reservations, setReservations] = useState(INITIAL_RESERVATIONS);
  const initialAccounts = useMemo(() => loadAccounts(), []);
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const accountsRef = useRef<Account[]>(initialAccounts);
  const [roomLogs, setRoomLogs] = useState<RoomStatusLog[]>([]);
  const [module, setModule] = useState<ModuleId>('recepcao');
  const [cashOpen, setCashOpen] = useState(true);
  const [cashFundo, setCashFundo] = useState(200);
  const [cashOpenedAt, setCashOpenedAt] = useState<string | null>(() => nowStamp(HOTEL.operationalDate));
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

  useEffect(() => {
    accountsRef.current = accounts;
  }, [accounts]);
  useEffect(() => {
    if (ready) saveAccounts(accounts);
  }, [accounts, ready]);
  useEffect(() => {
    if (ready) saveKey(K_ROOMS, rooms);
  }, [rooms, ready]);
  useEffect(() => {
    if (ready) saveKey(K_RES, reservations);
  }, [reservations, ready]);
  useEffect(() => {
    if (ready) saveKey(K_LOGS, roomLogs);
  }, [roomLogs, ready]);
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
        ].slice(0, 200),
      );
    },
    [hotel.operationalDate],
  );

  const reservationForAccount = useCallback(
    (account: Account) =>
      account.reservationId ? reservations.find((r) => r.id === account.reservationId) : undefined,
    [reservations],
  );

  const ensureGuestAccountOpen = useCallback(
    (account: Account): ActionResult => {
      if (account.type !== 'hospede') return { ok: true, message: 'OK' };
      const res = reservationForAccount(account);
      if (!res || res.status !== 'checkin') {
        return {
          ok: false,
          message: 'A conta do hóspede só pode ser movimentada depois do check-in.',
        };
      }
      return { ok: true, message: 'OK' };
    },
    [reservationForAccount],
  );

  const openCashRegister = useCallback(
    (fundo: number) => {
      if (cashOpen) return { ok: false, message: 'Caixa já está aberto' };
      if (Number.isNaN(fundo) || fundo < 0)
        return { ok: false, message: 'Informe o fundo de caixa em dinheiro' };
      setCashOpen(true);
      setCashFundo(fundo);
      setCashOpenedAt(nowStamp(hotel.operationalDate));
      return { ok: true, message: `Caixa aberto · fundo R$ ${fundo.toFixed(2).replace('.', ',')}` };
    },
    [cashOpen, hotel.operationalDate],
  );

  const closeCashRegister = useCallback(() => {
    if (!cashOpen) return { ok: false, message: 'Caixa já está fechado' };
    setCashOpen(false);
    setCashOpenedAt(null);
    return { ok: true, message: 'Caixa fechado com sucesso' };
  }, [cashOpen]);

  const addCharge = useCallback(
    (accountId: string, description: string, amount: number, category: Charge['category']): ActionResult => {
      if (!accountId) return { ok: false, message: 'Conta não informada' };
      if (!description.trim()) return { ok: false, message: 'Informe a descrição' };
      if (!(amount > 0)) return { ok: false, message: 'Valor inválido' };
      const persisted = loadAccounts();
      const prev = persisted.length ? persisted : accountsRef.current;
      const exists = prev.find((a) => a.id === accountId);
      if (!exists) return { ok: false, message: 'Conta não encontrada' };
      const access = ensureGuestAccountOpen(exists);
      if (!access.ok) return access;
      if (exists.status === 'quitada') return { ok: false, message: 'Conta já quitada' };

      const charge: Charge = {
        id: uid('chg'),
        description: description.trim(),
        amount,
        date: chargeTimestamp(),
        category: category || 'consumo',
      };
      const next = prev.map((a) =>
        a.id === accountId
          ? { ...a, status: 'aberta' as const, charges: [...a.charges, charge] }
          : a,
      );
      accountsRef.current = next;
      setAccounts(next);
      saveAccounts(next);
      return { ok: true, message: 'Lançamento adicionado à conta' };
    },
    [ensureGuestAccountOpen],
  );

  const addCharges = useCallback(
    (
      accountId: string,
      items: { description: string; amount: number; category: Charge['category'] }[],
    ): ActionResult => {
      if (!accountId) return { ok: false, message: 'Conta não informada' };
      if (!items.length) return { ok: false, message: 'Nenhum item para lançar' };
      for (const item of items) {
        if (!item.description.trim()) return { ok: false, message: 'Informe a descrição' };
        if (!(item.amount > 0)) return { ok: false, message: 'Valor inválido' };
      }
      const persisted = loadAccounts();
      const prev = persisted.length ? persisted : accountsRef.current;
      const exists = prev.find((a) => a.id === accountId);
      if (!exists) return { ok: false, message: 'Conta não encontrada' };
      const access = ensureGuestAccountOpen(exists);
      if (!access.ok) return access;
      if (exists.status === 'quitada') return { ok: false, message: 'Conta já quitada' };

      const stamp = chargeTimestamp();
      const newCharges: Charge[] = items.map((item, index) => ({
        id: uid('chg'),
        description: item.description.trim(),
        amount: item.amount,
        date: index === 0 ? stamp : `${stamp}-${index}`,
        category: item.category || 'consumo',
      }));
      const next = prev.map((a) =>
        a.id === accountId
          ? { ...a, status: 'aberta' as const, charges: [...a.charges, ...newCharges] }
          : a,
      );
      accountsRef.current = next;
      setAccounts(next);
      saveAccounts(next);
      return {
        ok: true,
        message:
          newCharges.length === 1
            ? 'Lançamento adicionado à conta'
            : `${newCharges.length} lançamentos adicionados à conta`,
      };
    },
    [ensureGuestAccountOpen],
  );

  const addPayment = useCallback(
    (accountId: string, amount: number, method: string): ActionResult => {
      if (!accountId) return { ok: false, message: 'Conta não informada' };
      if (!(amount > 0)) return { ok: false, message: 'Valor inválido' };
      const prev = accountsRef.current;
      const exists = prev.find((a) => a.id === accountId);
      if (!exists) return { ok: false, message: 'Conta não encontrada' };
      const access = ensureGuestAccountOpen(exists);
      if (!access.ok) return access;
      const payment = { id: uid('pay'), amount, method, date: chargeTimestamp() };
      const next = prev.map((a) => {
        if (a.id !== accountId) return a;
        const updated = { ...a, payments: [...a.payments, payment] };
        const balance = accountBalance(updated);
        return {
          ...updated,
          status: Math.abs(balance) <= 0.01 ? ('aberta' as const) : ('parcial' as const),
        };
      });
      accountsRef.current = next;
      setAccounts(next);
      saveAccounts(next);
      return { ok: true, message: 'Pagamento registrado' };
    },
    [ensureGuestAccountOpen],
  );

  const updateGovernance = useCallback(
    (roomIds: string[], governance: GovernanceStatus, notes?: string) => {
      const occupiedCount = rooms.filter(
        (r) => roomIds.includes(r.id) && r.occupancy === 'ocupado',
      ).length;
      setRooms((prev) =>
        prev.map((r) => {
          if (!roomIds.includes(r.id) || r.occupancy === 'ocupado') return r;
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
        }),
      );
      const ok = roomIds.length - occupiedCount;
      return {
        ok,
        fail: occupiedCount,
        message:
          occupiedCount > 0
            ? `${ok} alterada(s), ${occupiedCount} bloqueada(s) (hóspede in-house)`
            : `${ok} UH(s) atualizada(s)`,
      };
    },
    [pushLog, rooms],
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
    (roomId: string, reason: string): ActionResult => {
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return { ok: false, message: 'UH não encontrada' };
      if (room.occupancy === 'ocupado') return { ok: false, message: 'Não bloqueia UH com hóspede' };
      setRooms((prev) =>
        prev.map((r) =>
          r.id === roomId
            ? {
                ...r,
                occupancy: 'bloqueado' as OccupancyStatus,
                blockedReason: reason,
                notes: reason || r.notes,
              }
            : r,
        ),
      );
      pushLog({ roomId, roomNumber: room.number, occupancy: 'bloqueado', note: reason, source: 'governanca' });
      return { ok: true, message: `${room.number} bloqueada` };
    },
    [rooms, pushLog],
  );

  const unblockRoom = useCallback(
    (roomId: string): ActionResult => {
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
            : r,
        ),
      );
      pushLog({ roomId, roomNumber: room.number, occupancy: 'livre', note: 'Desbloqueio', source: 'governanca' });
      return { ok: true, message: `${room.number} desbloqueada` };
    },
    [rooms, pushLog],
  );

  const upsertReservation = useCallback(
    (res: Reservation): ActionResult => {
      if (!res.guestName.trim()) return { ok: false, message: 'Informe o nome do hóspede.' };
      if (!res.checkIn || !res.checkOut || res.checkOut <= res.checkIn) {
        return { ok: false, message: 'O check-out deve ser posterior ao check-in.' };
      }
      if (res.adults < 1) return { ok: false, message: 'A reserva precisa de pelo menos 1 adulto.' };
      if (res.children < 0) return { ok: false, message: 'Quantidade de crianças inválida.' };
      if (res.totalAmount < 0) return { ok: false, message: 'Valor total inválido.' };

      if (res.roomId && isActiveReservation(res)) {
        const room = rooms.find((r) => r.id === res.roomId);
        if (!room) return { ok: false, message: 'UH selecionada não encontrada.' };
        if (room.occupancy === 'bloqueado' || room.governance === 'interditado' || room.governance === 'manutencao') {
          return { ok: false, message: `A UH ${room.number} está indisponível para reserva.` };
        }
        const conflict = reservations.find(
          (other) =>
            other.id !== res.id &&
            other.roomId === res.roomId &&
            isActiveReservation(other) &&
            overlaps(res.checkIn, res.checkOut, other.checkIn, other.checkOut),
        );
        if (conflict) {
          return {
            ok: false,
            message: `A UH ${room.number} já está reservada para ${conflict.guestName} (${conflict.code}) nesse período.`,
          };
        }
      }

      setReservations((prev) => {
        const index = prev.findIndex((r) => r.id === res.id);
        if (index >= 0) {
          const next = [...prev];
          next[index] = res;
          return next;
        }
        return [...prev, res];
      });
      return { ok: true, message: 'Reserva salva' };
    },
    [reservations, rooms],
  );

  const checkIn = useCallback(
    (reservationId: string, reservationSnapshot?: Reservation): ActionResult => {
      const res = reservationSnapshot || reservations.find((r) => r.id === reservationId);
      if (!res) return { ok: false, message: 'Reserva não encontrada' };
      if (res.status === 'checkin') return { ok: false, message: 'Já está em check-in' };
      if (res.status !== 'confirmada' && res.status !== 'pendente') {
        return { ok: false, message: 'Reserva não está apta para check-in' };
      }
      if (!res.roomId) return { ok: false, message: 'Selecione uma UH antes do check-in.' };
      if (hotel.operationalDate < res.checkIn) {
        return { ok: false, message: `Check-in previsto para ${res.checkIn.split('-').reverse().join('/')}.` };
      }
      if (hotel.operationalDate >= res.checkOut) {
        return { ok: false, message: 'A data prevista de check-out já foi alcançada. Ajuste a reserva antes do check-in.' };
      }

      const room = rooms.find((r) => r.id === res.roomId);
      if (!room) return { ok: false, message: 'UH não encontrada' };
      const conflictingReservation = reservations.find(
        (other) =>
          other.id !== res.id &&
          other.roomId === res.roomId &&
          isActiveReservation(other) &&
          overlaps(res.checkIn, res.checkOut, other.checkIn, other.checkOut),
      );
      if (conflictingReservation) {
        return {
          ok: false,
          message: `A UH ${room.number} possui conflito com ${conflictingReservation.code}.`,
        };
      }
      if (!isRoomReadyForCheckIn(room)) {
        return { ok: false, message: roomNotReadyReason(room) || 'UH não pronta' };
      }

      const accId = res.accountId || uid('acc');
      const existingAccount = accountsRef.current.find((a) => a.id === accId);
      const automatic = initialReservationMovements(res);
      const shouldSeedFinancials = !existingAccount || (existingAccount.charges.length === 0 && existingAccount.payments.length === 0);
      const account: Account = existingAccount || {
        id: accId,
        type: 'hospede',
        guestId: res.guestId,
        guestName: res.guestName,
        reservationId: res.id,
        roomId: res.roomId,
        status: res.paidAmount > 0 && Math.abs(res.totalAmount - res.paidAmount) > 0.01 ? 'parcial' : 'aberta',
        charges: automatic.charges,
        payments: automatic.payments,
        openedAt: hotel.operationalDate,
      };
      const nextAccounts = existingAccount
        ? accountsRef.current.map((a) =>
            a.id === accId
              ? {
                  ...a,
                  guestName: res.guestName,
                  guestId: res.guestId,
                  reservationId: res.id,
                  roomId: res.roomId,
                  status: 'aberta' as const,
                  charges: shouldSeedFinancials ? automatic.charges : a.charges,
                  payments: shouldSeedFinancials ? automatic.payments : a.payments,
                }
              : a,
          )
        : [...accountsRef.current, account];
      accountsRef.current = nextAccounts;
      setAccounts(nextAccounts);
      saveAccounts(nextAccounts);

      setReservations((prev) => {
        const exists = prev.some((r) => r.id === reservationId);
        if (!exists) return [...prev, { ...res, status: 'checkin' as ReservationStatus, accountId: accId }];
        return prev.map((r) =>
          r.id === reservationId
            ? { ...res, status: 'checkin' as ReservationStatus, accountId: accId }
            : r,
        );
      });
      setRooms((prev) =>
        prev.map((r) => (r.id === res.roomId ? { ...r, occupancy: 'ocupado' as OccupancyStatus } : r)),
      );
      pushLog({
        roomId: room.id,
        roomNumber: room.number,
        occupancy: 'ocupado',
        governance: room.governance,
        note: `Check-in ${res.code} · ${res.guestName}`,
        source: 'checkin',
      });
      return { ok: true, message: `Check-in ${res.guestName}` };
    },
    [reservations, rooms, hotel.operationalDate, pushLog],
  );

  const checkOut = useCallback(
    (reservationId: string): ActionResult => {
      const res = reservations.find((r) => r.id === reservationId);
      if (!res) return { ok: false, message: 'Reserva não encontrada' };
      if (res.status !== 'checkin') return { ok: false, message: 'Hóspede não está in-house' };

      const reservationAccounts = accounts.filter(
        (a) => a.reservationId === reservationId && a.type === 'hospede',
      );
      const openAccounts = reservationAccounts.filter((a) => Math.abs(accountBalance(a)) > 0.01);
      if (openAccounts.length) {
        const total = openAccounts.reduce((sum, a) => sum + accountBalance(a), 0);
        return {
          ok: false,
          message: `Não é possível fazer check-out. Existem contas com saldo pendente (${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).`,
        };
      }

      const linkedCards = listCards().filter(
        (card) => card.reservationId === reservationId && card.status === 'ativo',
      );
      if (linkedCards.length) {
        return {
          ok: false,
          message: `Não é possível fazer check-out. Desvincule ${linkedCards.length === 1 ? 'a mídia de consumo' : 'as mídias de consumo'} antes de finalizar.`,
        };
      }

      setReservations((prev) =>
        prev.map((r) =>
          r.id === reservationId ? { ...r, status: 'checkout' as ReservationStatus } : r,
        ),
      );
      const nextAccounts = accountsRef.current.map((a) =>
        a.reservationId === reservationId ? { ...a, status: 'quitada' as const } : a,
      );
      accountsRef.current = nextAccounts;
      setAccounts(nextAccounts);
      saveAccounts(nextAccounts);
      if (res.roomId) {
        const room = rooms.find((r) => r.id === res.roomId);
        setRooms((prev) =>
          prev.map((r) =>
            r.id === res.roomId
              ? { ...r, occupancy: 'livre' as OccupancyStatus, governance: 'sujo' as GovernanceStatus }
              : r,
          ),
        );
        if (room) {
          pushLog({
            roomId: room.id,
            roomNumber: room.number,
            occupancy: 'livre',
            governance: 'sujo',
            note: `Check-out ${res.code} · ${res.guestName}`,
            source: 'checkout',
          });
        }
      }
      return { ok: true, message: `Check-out ${res.guestName}` };
    },
    [reservations, accounts, rooms, pushLog],
  );

  const cancelCheckIn = useCallback(
    (reservationId: string): ActionResult => {
      const res = reservations.find((r) => r.id === reservationId);
      if (!res) return { ok: false, message: 'Reserva não encontrada' };
      if (res.status !== 'checkin') return { ok: false, message: 'Não está em check-in' };
      const reservationAccounts = accounts.filter((a) => a.reservationId === reservationId);
      const hasOperationalMovements = reservationAccounts.some(
        (a) =>
          a.charges.some(
            (charge) => !(charge.category === 'hospedagem' && charge.description.startsWith('Hospedagem ·')),
          ) || a.payments.some((payment) => payment.method !== 'Adiantamento da reserva'),
      );
      if (hasOperationalMovements) {
        return { ok: false, message: 'Não é possível cancelar o check-in com consumos, serviços ou pagamentos operacionais na conta.' };
      }
      if (listCards().some((card) => card.reservationId === reservationId && card.status === 'ativo')) {
        return { ok: false, message: 'Desvincule as mídias de consumo antes de cancelar o check-in.' };
      }
      setReservations((prev) =>
        prev.map((r) =>
          r.id === reservationId
            ? { ...r, status: 'confirmada' as ReservationStatus, accountId: undefined }
            : r,
        ),
      );
      const nextAccounts = accountsRef.current.filter((a) => a.reservationId !== reservationId);
      accountsRef.current = nextAccounts;
      setAccounts(nextAccounts);
      saveAccounts(nextAccounts);
      if (res.roomId) {
        setRooms((prev) =>
          prev.map((r) =>
            r.id === res.roomId
              ? { ...r, occupancy: 'livre' as OccupancyStatus, governance: 'sujo' as GovernanceStatus }
              : r,
          ),
        );
      }
      return { ok: true, message: 'Check-in cancelado' };
    },
    [reservations, accounts],
  );

  const transferRoom = useCallback(
    (reservationId: string, newRoomId: string): ActionResult => {
      const res = reservations.find((r) => r.id === reservationId);
      const newRoom = rooms.find((r) => r.id === newRoomId);
      if (!res || !newRoom) return { ok: false, message: 'Dados inválidos' };
      if (res.status !== 'checkin') return { ok: false, message: 'Só transferir hóspede in-house' };
      if (!isRoomReadyForCheckIn(newRoom)) {
        return { ok: false, message: roomNotReadyReason(newRoom) || 'UH destino não pronta' };
      }
      const conflict = reservations.find(
        (other) =>
          other.id !== res.id &&
          other.roomId === newRoomId &&
          isActiveReservation(other) &&
          overlaps(hotel.operationalDate, res.checkOut, other.checkIn, other.checkOut),
      );
      if (conflict) return { ok: false, message: `UH destino reservada para ${conflict.code}.` };

      const oldId = res.roomId;
      setReservations((prev) =>
        prev.map((r) =>
          r.id === reservationId ? { ...r, roomId: newRoomId, roomNumber: newRoom.number } : r,
        ),
      );
      setRooms((prev) =>
        prev.map((r) => {
          if (r.id === oldId)
            return { ...r, occupancy: 'livre' as OccupancyStatus, governance: 'sujo' as GovernanceStatus };
          if (r.id === newRoomId) return { ...r, occupancy: 'ocupado' as OccupancyStatus };
          return r;
        }),
      );
      setAccounts((prev) =>
        prev.map((a) =>
          a.reservationId === reservationId ? { ...a, roomId: newRoomId } : a,
        ),
      );
      return { ok: true, message: `Transferido para UH ${newRoom.number}` };
    },
    [reservations, rooms, hotel.operationalDate],
  );

  const cancelReservation = useCallback((id: string) => {
    setReservations((prev) =>
      prev.map((r) =>
        r.id === id && r.status !== 'checkin' && r.status !== 'checkout'
          ? { ...r, status: 'cancelada' as ReservationStatus }
          : r,
      ),
    );
  }, []);

  const markFnrh = useCallback((id: string) => {
    setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, fnrhFilled: true } : r)));
  }, []);

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
    [hotel.operationalDate],
  );

  const createCompanionAccount = useCallback(
    (reservationId: string, companionId: string) => {
      const res = reservations.find((r) => r.id === reservationId);
      const companion = res?.companions?.find((c) => c.id === companionId);
      if (!res || !companion) return { ok: false, message: 'Acompanhante não encontrado' };
      if (res.status !== 'checkin') {
        return { ok: false, message: 'A conta do acompanhante só pode ser criada após o check-in' };
      }
      if (companion.accountId) {
        return { ok: true, message: 'Conta do acompanhante já existe', accountId: companion.accountId };
      }
      const existing = accounts.find(
        (a) => a.reservationId === reservationId && a.guestId === companion.id,
      );
      const accountId = existing?.id || uid('acc');
      if (!existing) {
        const nextAccounts = [
          ...accountsRef.current,
          {
            id: accountId,
            type: 'hospede' as const,
            guestId: companion.id,
            guestName: companion.name,
            reservationId,
            roomId: res.roomId,
            status: 'aberta' as const,
            charges: [],
            payments: [],
            openedAt: hotel.operationalDate,
          },
        ];
        accountsRef.current = nextAccounts;
        setAccounts(nextAccounts);
        saveAccounts(nextAccounts);
      }
      setReservations((prev) =>
        prev.map((r) =>
          r.id === reservationId
            ? {
                ...r,
                companions: (r.companions || []).map((c) =>
                  c.id === companionId ? { ...c, accountId } : c,
                ),
              }
            : r,
        ),
      );
      return { ok: true, message: 'Conta do acompanhante criada', accountId };
    },
    [reservations, accounts, hotel.operationalDate],
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
      addCharges,
      createAvulsaAccount,
      createCompanionAccount,
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
      addCharges,
      createAvulsaAccount,
      createCompanionAccount,
    ],
  );

  if (!ready) {
    return (
      <PmsContext.Provider value={value}>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-7 w-7 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            <p className="mt-3 text-sm text-muted-foreground">Sincronizando dados…</p>
          </div>
        </div>
      </PmsContext.Provider>
    );
  }

  return <PmsContext.Provider value={value}>{children}</PmsContext.Provider>;
}

export function usePms() {
  const ctx = useContext(PmsContext);
  if (!ctx) throw new Error('usePms must be used within PmsProvider');
  return ctx;
}
