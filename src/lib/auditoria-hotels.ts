/** Hotéis e taxas padrão por propriedade */
import type { FeeRule } from './auditoria-core';
import { DEFAULT_FEES } from './auditoria-core';

export type HotelId = 'santa-eliza' | 'varshana';

export interface AuditHotel {
  id: HotelId;
  name: string;
  shortName: string;
  city: string;
  description: string;
}

export const AUDIT_HOTELS: AuditHotel[] = [
  {
    id: 'santa-eliza',
    name: 'Hotel Santa Eliza',
    shortName: 'Santa Eliza',
    city: 'Life',
    description: 'Auditoria financeira diária · POP-FIN-001 · Getnet / Santander',
  },
  {
    id: 'varshana',
    name: 'Hotel Varshana',
    shortName: 'Varshana',
    city: 'Life',
    description: 'Auditoria financeira diária · checklist e conciliações próprias',
  },
];

/** Taxas iniciais por hotel (clonadas; cada um edita o seu) */
export function defaultFeesForHotel(hotelId: HotelId): FeeRule[] {
  // Mesma base Santander; usuário ajusta por hotel
  return DEFAULT_FEES.map((f) => ({
    ...f,
    id: `${hotelId}-${f.id}`,
  }));
}

export const LS_HOTEL = 'pms-auditoria-hotel-v1';
export function feesStorageKey(hotelId: HotelId) {
  return `pms-auditoria-fees-${hotelId}-v3`;
}
export function auditStorageKey(hotelId: HotelId) {
  return `pms-auditoria-life-${hotelId}-v1`;
}
