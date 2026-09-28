/** Status comercial/ocupação da UH (só muda com check-in/out ou bloqueio). */
export type OccupancyStatus = 'livre' | 'ocupado' | 'bloqueado';

/** Status operacional de arrumação (governança). */
export type GovernanceStatus =
  | 'limpo'
  | 'sujo'
  | 'limpeza'
  | 'inspecao'
  | 'manutencao'
  | 'interditado';

/** @deprecated use OccupancyStatus + GovernanceStatus */
export type RoomStatus =
  | 'livre'
  | 'ocupado'
  | 'sujo'
  | 'limpeza'
  | 'inspecao'
  | 'interditado'
  | 'manutencao';

export type ReservationStatus =
  | 'confirmada'
  | 'pendente'
  | 'checkin'
  | 'checkout'
  | 'no_show'
  | 'cancelada';

export type AccountStatus = 'aberta' | 'quitada' | 'parcial' | 'pendente';

export type AccountType = 'hospede' | 'avulsa';

export interface ReservationCompanion {
  id: string;
  name: string;
  cpf: string;
  birthDate: string;
  ageGroup: 'Adulto' | 'Criança' | 'Bebê';
  accountId?: string;
}

export type RoomType =
  | 'Standard'
  | 'Superior'
  | 'Apartamento'
  | 'Chalé Master'
  | 'Bangalô'
  | 'Suite';

export interface Room {
  id: string;
  number: string;
  type: RoomType;
  floor: number;
  /** Bloco físico (ex.: Torre A) */
  block?: string;
  capacity: number;
  occupancy: OccupancyStatus;
  governance: GovernanceStatus;
  /** Camareira responsável */
  housekeeper?: string;
  notes?: string;
  /** Não perturbe */
  dnd?: boolean;
  blockedReason?: string;
}

export interface RoomStatusLog {
  id: string;
  roomId: string;
  roomNumber: string;
  at: string;
  user: string;
  occupancy?: OccupancyStatus;
  governance?: GovernanceStatus;
  housekeeper?: string;
  note?: string;
  source: 'governanca' | 'checkin' | 'checkout' | 'sistema';
}

export interface Guest {
  id: string;
  name: string;
  document: string;
  phone: string;
  email?: string;
  nationality?: string;
}

export interface Charge {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: 'hospedagem' | 'consumo' | 'servico' | 'taxa' | 'outro';
}

export interface Account {
  id: string;
  type: AccountType;
  guestId?: string;
  guestName: string;
  reservationId?: string;
  roomId?: string;
  status: AccountStatus;
  charges: Charge[];
  payments: { id: string; amount: number; method: string; date: string }[];
  openedAt: string;
}

export interface Reservation {
  id: string;
  code: string;
  guestId: string;
  guestName: string;
  roomId?: string;
  roomNumber?: string;
  roomType: RoomType;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  status: ReservationStatus;
  origin: 'direto' | 'booking' | 'expedia' | 'telefone' | 'walkin';
  totalAmount: number;
  paidAmount: number;
  notes?: string;
  fnrhFilled: boolean;
  accountId?: string;
  companions?: ReservationCompanion[];
}

export interface Hotel {
  id: string;
  name: string;
  operationalDate: string;
}

export function accountBalance(acc: Account): number {
  const charges = acc.charges.reduce((s, c) => s + c.amount, 0);
  const payments = acc.payments.reduce((s, p) => s + p.amount, 0);
  return charges - payments;
}

export function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDateBR(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** UH pronta para receber check-in */
export function isRoomReadyForCheckIn(room: Room): boolean {
  if (room.occupancy === 'ocupado') return false;
  if (room.occupancy === 'bloqueado') return false;
  if (room.governance === 'interditado' || room.governance === 'manutencao') return false;
  if (room.governance === 'sujo' || room.governance === 'limpeza' || room.governance === 'inspecao')
    return false;
  return room.occupancy === 'livre' && room.governance === 'limpo';
}

export function roomNotReadyReason(room: Room): string | null {
  if (room.occupancy === 'ocupado') return 'UH já ocupada';
  if (room.occupancy === 'bloqueado')
    return `UH bloqueada${room.blockedReason ? ` (${room.blockedReason})` : ''}`;
  if (room.governance === 'interditado') return 'UH interditada';
  if (room.governance === 'manutencao') return 'UH em manutenção';
  if (room.governance === 'sujo') return 'UH suja';
  if (room.governance === 'limpeza') return 'UH em arrumação';
  if (room.governance === 'inspecao') return 'UH em inspeção';
  if (room.governance !== 'limpo') return 'UH não está limpa';
  return null;
}

export const OCCUPANCY_LABEL: Record<OccupancyStatus, string> = {
  livre: 'Vago',
  ocupado: 'Ocupado',
  bloqueado: 'Bloqueado',
};

export const GOVERNANCE_LABEL: Record<GovernanceStatus, string> = {
  limpo: 'Limpo',
  sujo: 'Sujo',
  limpeza: 'Arrumação',
  inspecao: 'Inspeção',
  manutencao: 'Manutenção',
  interditado: 'Interditado',
};

/** Labels legados para compatibilidade visual */
export const ROOM_STATUS_LABEL: Record<string, string> = {
  ...OCCUPANCY_LABEL,
  ...GOVERNANCE_LABEL,
  livre: 'Vago',
  ocupado: 'Ocupado',
};

export const RES_STATUS_LABEL: Record<ReservationStatus, string> = {
  confirmada: 'Confirmada',
  pendente: 'Pendente',
  checkin: 'Hospedado',
  checkout: 'Check-out',
  no_show: 'No-show',
  cancelada: 'Cancelada',
};

export const HOUSEKEEPERS = [
  'Maria Silva',
  'Ana Costa',
  'Joana Pereira',
  'Fernanda Lima',
  'Patrícia Souza',
] as const;

/* ─── Fiscal e Contábil (Fase 1) ─────────────────────────────────────────── */

export type TaxRegime = 'simples' | 'presumido' | 'real';

export type FiscalDocKind = 'nfs_e' | 'nfc_e' | 'nf_e' | 'nenhum';

export type PisCofinsRegime = 'cumulativo' | 'nao_cumulativo' | 'simples' | 'nao_aplica';

/** Natureza fiscal parametrizada por tipo de lançamento */
export interface FiscalNature {
  id: string;
  code: string;
  label: string;
  /** Liga à category da conta quando aplicável */
  chargeCategory?: Charge['category'];
  docKind: FiscalDocKind;
  /** Código serviço municipal (ISS) — ex. 9.01 / código local */
  serviceCode?: string;
  issRate: number;
  pisCofins: PisCofinsRegime;
  pisRate: number;
  cofinsRate: number;
  /** Mercadoria: ICMS estimado (quando doc NF-e/NFC-e) */
  icmsRate: number;
  active: boolean;
  notes?: string;
}

export interface FiscalCompanySettings {
  cnpj: string;
  ie: string;
  im: string;
  uf: string;
  city: string;
  cityIbge: string;
  regime: TaxRegime;
  issDefaultRate: number;
  /** Preparação reforma */
  cbsIbsReady: boolean;
}

export interface FiscalBookEntry {
  id: string;
  competence: string;
  originDate: string;
  description: string;
  natureId: string;
  natureCode: string;
  natureLabel: string;
  amount: number;
  issAmount: number;
  pisAmount: number;
  cofinsAmount: number;
  icmsAmount: number;
  docKind: FiscalDocKind;
  accountId: string;
  guestName: string;
  reservationId?: string;
  chargeId: string;
  status: 'pendente' | 'faturado' | 'cancelado';
}

export interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  type: 'ativo' | 'passivo' | 'receita' | 'despesa' | 'custo';
  natureId?: string;
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
}

export interface SuggestedJournalLine {
  id: string;
  date: string;
  history: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  costCenter?: string;
  originEntryId: string;
}
