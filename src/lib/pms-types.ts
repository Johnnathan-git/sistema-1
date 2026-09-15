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
  status: RoomStatus;
  capacity: number;
  notes?: string;
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

export const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
  livre: 'Livre',
  ocupado: 'Ocupado',
  sujo: 'Sujo',
  limpeza: 'Em limpeza',
  inspecao: 'Inspeção',
  interditado: 'Interditado',
  manutencao: 'Manutenção',
};

export const RES_STATUS_LABEL: Record<ReservationStatus, string> = {
  confirmada: 'Confirmada',
  pendente: 'Pendente',
  checkin: 'Hospedado',
  checkout: 'Check-out',
  no_show: 'No-show',
  cancelada: 'Cancelada',
};
