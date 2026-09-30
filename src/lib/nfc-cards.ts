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

function reverseHexBytes(hex: string): string {
  const clean = normalizeUidHex(hex);
  if (!clean || clean.length % 2 !== 0) return '';
  return clean.match(/.{2}/g)?.reverse().join('') || '';
}

/**
 * Alguns leitores USB 125 kHz enviam o mesmo UID como decimal e com a ordem
 * dos bytes invertida. Ex.: 2664975069 = 0x9ED84ADD => DD4AD89E invertido.
 * Esta função gera as representações equivalentes para impedir que a mesma
 * mídia física seja cadastrada/vinculada duas vezes.
 */
function uidIdentityCandidates(raw: string): Set<string> {
  const out = new Set<string>();
  const value = String(raw || '').trim();
  const hex = normalizeUidHex(value);

  if (hex) {
    out.add(hex);
    const reversed = reverseHexBytes(hex);
    if (reversed) out.add(reversed);
  }

  const digits = value.replace(/\D/g, '');
  if (/^\d{8,12}$/.test(digits)) {
    try {
      let decimalHex = BigInt(digits).toString(16).toUpperCase();
      if (decimalHex.length % 2 !== 0) decimalHex = `0${decimalHex}`;
      if (decimalHex.length <= 8) decimalHex = decimalHex.padStart(8, '0');
      out.add(decimalHex);
      const reversedDecimal = reverseHexBytes(decimalHex);
      if (reversedDecimal) out.add(reversedDecimal);
    } catch {
      // Mantém apenas as representações já obtidas acima.
    }
  }

  return out;
}

function samePhysicalMedia(a: string, b: string): boolean {
  const aa = uidIdentityCandidates(a);
  const bb = uidIdentityCandidates(b);
  for (const candidate of aa) {
    if (bb.has(candidate)) return true;
  }
  return false;
}

function loadCards(): NfcCard[] {
  if (typeof localStorage === 'undefined') return [];
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
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LS_CARDS, JSON.stringify(cards));
}

function loadLogs(): NfcChargeLog[] {
  if (typeof localStorage === 'undefined') return [];
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
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LS_LOGS, JSON.stringify(logs.slice(0, 500)));
}

export function listCards(hotelId?: string): NfcCard[] {
  const all = loadCards();
  const filtered = hotelId ? all.filter((c) => c.hotelId === hotelId || c.hotelId === 'all') : all;
  return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function getEquivalentCards(rawUid: string): NfcCard[] {
  if (!rawUid) return [];
  return loadCards().filter((card) =>
    samePhysicalMedia(rawUid, card.uidHex) ||
    (!!card.uidDec && samePhysicalMedia(rawUid, card.uidDec)),
  );
}

export function getCardByUid(uidHex: string): NfcCard | null {
  const matches = getEquivalentCards(uidHex);
  if (!matches.length) return null;
  return matches.sort((a, b) => {
    if (a.status === 'ativo' && b.status !== 'ativo') return -1;
    if (b.status === 'ativo' && a.status !== 'ativo') return 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  })[0] || null;
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

  const existing = getEquivalentCards(input.uidHex);
  if (existing.length) {
    const linked = existing.find((card) => card.status === 'ativo' && card.accountId);
    return {
      ok: false,
      message: linked
        ? `Esta mídia já está cadastrada e vinculada a ${linked.guestName || 'outra conta'}`
        : 'Esta mídia já está cadastrada',
    };
  }

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

  const equivalentActive = cards.find((other) => {
    if (other.id === c.id || other.status !== 'ativo') return false;
    const sameMedia =
      samePhysicalMedia(c.uidHex, other.uidHex) ||
      (!!c.uidDec && samePhysicalMedia(c.uidDec, other.uidHex)) ||
      (!!other.uidDec && samePhysicalMedia(c.uidHex, other.uidDec));
    if (!sameMedia) return false;
    return other.accountId !== input.accountId ||
      other.reservationId !== input.reservationId ||
      other.guestId !== input.guestId;
  });

  if (equivalentActive) {
    return {
      ok: false,
      message: `Esta mídia física já está vinculada a ${equivalentActive.guestName || 'outra conta'}. Desvincule-a antes de vincular novamente.`,
    };
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
  const equivalent = getEquivalentCards(uidHex);
  if (!equivalent.length) return { card: null, canCharge: false, message: 'Pulseira não cadastrada' };

  const active = equivalent.filter((card) => card.status === 'ativo' && card.accountId);
  const activeOwners = new Set(active.map((card) => `${card.accountId}|${card.reservationId || ''}|${card.guestId || ''}`));
  if (activeOwners.size > 1) {
    return {
      card: active[0] || equivalent[0],
      canCharge: false,
      message: 'Conflito: esta mesma mídia está vinculada a mais de uma conta. Desvincule a duplicidade antes de usar.',
    };
  }

  const card = active[0] || getCardByUid(uidHex);
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
