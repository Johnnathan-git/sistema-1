/**
 * Gerenciamento de Cartões / Pulseiras NFC (Mifare Classic)
 * Persistência local — preparado para API/PDV no futuro.
 */
export type NfcCardStatus = 'disponivel' | 'ativo' | 'bloqueado' | 'perdido';

export interface NfcCard {
  id: string;
  /** UID hex sem separadores, uppercase — ex: DD4AD89E */
  uidHex: string;
  /** Decimal opcional (compat PDV Legal / HITS) */
  uidDec?: string;
  label?: string;
  status: NfcCardStatus;
  hotelId: string;
  reservationId?: string;
  guestId?: string;
  guestName?: string;
  roomNumber?: string;
  accountId?: string;
  canCharge: boolean;
  dailyLimit?: number;
  linkedAt?: string;
  blockedAt?: string;
  blockedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NfcChargeLog {
  id: string;
  cardId: string;
  uidHex: string;
  accountId?: string;
  reservationId?: string;
  guestName?: string;
  roomNumber?: string;
  description: string;
  amount: number;
  category: 'consumo' | 'servico' | 'outro';
  operator: string;
  at: string;
  source: 'pdv_rapido' | 'manual' | 'api';
}

const LS_CARDS = 'uos-nfc-cards-v1';
const LS_LOGS = 'uos-nfc-charge-logs-v1';

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeUidHex(raw: string): string {
  return raw.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
}

export function uidHexToDec(hex: string): string {
  const h = normalizeUidHex(hex);
  if (!h) return '';
  try {
    return BigInt(`0x${h}`).toString(10);
  } catch {
    return '';
  }
}

function loadCards(): NfcCard[] {
  try {
    const raw = localStorage.getItem(LS_CARDS);
    if (!raw) return [];
    const p = JSON.parse(raw) as NfcCard[];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function saveCards(cards: NfcCard[]) {
  localStorage.setItem(LS_CARDS, JSON.stringify(cards));
}

function loadLogs(): NfcChargeLog[] {
  try {
    const raw = localStorage.getItem(LS_LOGS);
    if (!raw) return [];
    const p = JSON.parse(raw) as NfcChargeLog[];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function saveLogs(logs: NfcChargeLog[]) {
  localStorage.setItem(LS_LOGS, JSON.stringify(logs.slice(0, 500)));
}

export function listCards(hotelId?: string): NfcCard[] {
  const all = loadCards();
  const filtered = hotelId ? all.filter((c) => c.hotelId === hotelId || c.hotelId === 'all') : all;
  return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getCardByUid(uidHex: string): NfcCard | null {
  const hex = normalizeUidHex(uidHex);
  if (!hex) return null;
  return loadCards().find((c) => c.uidHex === hex) || null;
}

export function getCardById(id: string): NfcCard | null {
  return loadCards().find((c) => c.id === id) || null;
}

export function registerCard(input: {
  uidHex: string;
  uidDec?: string;
  label?: string;
  hotelId: string;
}): { ok: true; card: NfcCard } | { ok: false; message: string } {
  const hex = normalizeUidHex(input.uidHex);
  if (hex.length < 4) return { ok: false, message: 'UID inválido (mín. 4 caracteres hex)' };
  if (getCardByUid(hex)) return { ok: false, message: 'Este UID já está cadastrado' };
  const now = new Date().toISOString();
  const card: NfcCard = {
    id: uid('nfc'),
    uidHex: hex,
    uidDec: input.uidDec || uidHexToDec(hex),
    label: (input.label || '').trim() || undefined,
    status: 'disponivel',
    hotelId: input.hotelId,
    canCharge: true,
    createdAt: now,
    updatedAt: now,
  };
  const cards = loadCards();
  cards.push(card);
  saveCards(cards);
  return { ok: true, card };
}

export function updateCard(
  id: string,
  patch: Partial<Pick<NfcCard, 'label' | 'canCharge' | 'dailyLimit' | 'status' | 'blockedReason'>>,
): { ok: true; card: NfcCard } | { ok: false; message: string } {
  const cards = loadCards();
  const i = cards.findIndex((c) => c.id === id);
  if (i < 0) return { ok: false, message: 'Cartão não encontrado' };
  const c = { ...cards[i], ...patch, updatedAt: new Date().toISOString() };
  if (patch.status === 'bloqueado' || patch.status === 'perdido') {
    c.blockedAt = new Date().toISOString();
  }
  if (patch.status === 'disponivel') {
    c.blockedAt = undefined;
    c.blockedReason = undefined;
  }
  cards[i] = c;
  saveCards(cards);
  return { ok: true, card: c };
}

export function linkCard(input: {
  cardId: string;
  reservationId?: string;
  guestId?: string;
  guestName: string;
  roomNumber?: string;
  accountId?: string;
}): { ok: true; card: NfcCard } | { ok: false; message: string } {
  const cards = loadCards();
  const i = cards.findIndex((c) => c.id === input.cardId);
  if (i < 0) return { ok: false, message: 'Cartão não encontrado' };
  const c = cards[i];
  if (c.status === 'bloqueado' || c.status === 'perdido') {
    return { ok: false, message: 'Cartão bloqueado — desbloqueie antes de vincular' };
  }
  if (c.status === 'ativo') {
    const sameOwner =
      c.accountId === input.accountId &&
      c.reservationId === input.reservationId &&
      c.guestId === input.guestId;
    if (!sameOwner) {
      return {
        ok: false,
        message: 'Esta mídia já está vinculada a outro hóspede. Desvincule-a antes de vincular novamente.',
      };
    }
  }
  cards[i] = {
    ...c,
    status: 'ativo',
    reservationId: input.reservationId,
    guestId: input.guestId,
    guestName: input.guestName,
    roomNumber: input.roomNumber,
    accountId: input.accountId,
    linkedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveCards(cards);
  return { ok: true, card: cards[i] };
}

export function unlinkCard(cardId: string): { ok: true; card: NfcCard } | { ok: false; message: string } {
  const cards = loadCards();
  const i = cards.findIndex((c) => c.id === cardId);
  if (i < 0) return { ok: false, message: 'Cartão não encontrado' };
  cards[i] = {
    ...cards[i],
    status: cards[i].status === 'bloqueado' || cards[i].status === 'perdido' ? cards[i].status : 'disponivel',
    reservationId: undefined,
    guestId: undefined,
    guestName: undefined,
    roomNumber: undefined,
    accountId: undefined,
    linkedAt: undefined,
    updatedAt: new Date().toISOString(),
  };
  saveCards(cards);
  return { ok: true, card: cards[i] };
}

export function blockCard(
  cardId: string,
  reason: string,
  as: 'bloqueado' | 'perdido' = 'bloqueado',
): { ok: true; card: NfcCard } | { ok: false; message: string } {
  return updateCard(cardId, { status: as, blockedReason: reason || (as === 'perdido' ? 'Perda' : 'Bloqueio') });
}

export function lookupByUid(uidHex: string): {
  card: NfcCard | null;
  canCharge: boolean;
  message: string;
} {
  const card = getCardByUid(uidHex);
  if (!card) return { card: null, canCharge: false, message: 'Pulseira não cadastrada' };
  if (card.status === 'bloqueado') return { card, canCharge: false, message: 'Pulseira bloqueada' };
  if (card.status === 'perdido') return { card, canCharge: false, message: 'Pulseira marcada como perdida' };
  if (card.status !== 'ativo' || !card.guestName) {
    return { card, canCharge: false, message: 'Pulseira sem vínculo com hóspede' };
  }
  if (!card.canCharge) return { card, canCharge: false, message: 'Consumo não permitido nesta pulseira' };
  return { card, canCharge: true, message: 'OK' };
}

export function registerCharge(input: {
  uidHex: string;
  description: string;
  amount: number;
  category?: NfcChargeLog['category'];
  operator: string;
  source?: NfcChargeLog['source'];
}): { ok: true; log: NfcChargeLog } | { ok: false; message: string } {
  const look = lookupByUid(input.uidHex);
  if (!look.canCharge || !look.card) return { ok: false, message: look.message };
  if (!input.description.trim()) return { ok: false, message: 'Informe a descrição' };
  if (!(input.amount > 0)) return { ok: false, message: 'Valor inválido' };
  const log: NfcChargeLog = {
    id: uid('nch'),
    cardId: look.card.id,
    uidHex: look.card.uidHex,
    accountId: look.card.accountId,
    reservationId: look.card.reservationId,
    guestName: look.card.guestName,
    roomNumber: look.card.roomNumber,
    description: input.description.trim(),
    amount: input.amount,
    category: input.category || 'consumo',
    operator: input.operator || 'Operador',
    at: new Date().toISOString(),
    source: input.source || 'pdv_rapido',
  };
  const logs = loadLogs();
  logs.unshift(log);
  saveLogs(logs);
  return { ok: true, log };
}

export function listChargeLogs(limit = 100): NfcChargeLog[] {
  return loadLogs().slice(0, limit);
}

export function deleteCard(id: string): { ok: true } | { ok: false; message: string } {
  const cards = loadCards();
  const c = cards.find((x) => x.id === id);
  if (!c) return { ok: false, message: 'Cartão não encontrado' };
  if (c.status === 'ativo') return { ok: false, message: 'Desvincule o cartão antes de excluir' };
  saveCards(cards.filter((x) => x.id !== id));
  return { ok: true };
}

export const NFC_STATUS_LABEL: Record<NfcCardStatus, string> = {
  disponivel: 'Disponível',
  ativo: 'Ativo (vinculado)',
  bloqueado: 'Bloqueado',
  perdido: 'Perdido',
};
