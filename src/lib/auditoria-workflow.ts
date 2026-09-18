/** Persistência e fluxo de aprovação das auditorias */
import type { HotelId } from './auditoria-hotels';
import { AUDIT_HOTELS } from './auditoria-hotels';

export type AuditWorkflowStatus = 'rascunho' | 'aguardando' | 'contestado' | 'aprovado';

export type ItemStatus = 'conforme' | 'divergencia' | '';

export interface AuditAnswers {
  [itemId: number]: { status: ItemStatus; notes: string };
}

export interface AuditHeader {
  date: string;
  analyst: string;
  period: string;
  sentToGoAt: string;
}

export interface AuditRecord {
  id: string;
  hotelId: HotelId;
  hotelName: string;
  header: AuditHeader;
  answers: AuditAnswers;
  status: AuditWorkflowStatus;
  contestComment?: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
}

export const LS_RECORDS = 'pms-auditoria-records-v1';

export function loadAllRecords(): AuditRecord[] {
  try {
    const raw = localStorage.getItem(LS_RECORDS);
    if (raw) {
      const parsed = JSON.parse(raw) as AuditRecord[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveAllRecords(records: AuditRecord[]) {
  localStorage.setItem(LS_RECORDS, JSON.stringify(records));
}

export function recordsForHotel(hotelId: HotelId): AuditRecord[] {
  return loadAllRecords()
    .filter((r) => r.hotelId === hotelId)
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export function recordsPendingApproval(): AuditRecord[] {
  return loadAllRecords()
    .filter((r) => r.status === 'aguardando')
    .sort((a, b) => (b.submittedAt || b.updatedAt).localeCompare(a.submittedAt || a.updatedAt));
}

export function upsertRecord(record: AuditRecord) {
  const all = loadAllRecords();
  const i = all.findIndex((r) => r.id === record.id);
  if (i >= 0) all[i] = record;
  else all.unshift(record);
  saveAllRecords(all);
  return record;
}

export function getRecord(id: string): AuditRecord | undefined {
  return loadAllRecords().find((r) => r.id === id);
}

export function newRecordId() {
  return `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function statusLabel(s: AuditWorkflowStatus): string {
  switch (s) {
    case 'rascunho':
      return 'Rascunho';
    case 'aguardando':
      return 'Aguardando aprovação';
    case 'contestado':
      return 'Contestado';
    case 'aprovado':
      return 'Aprovado';
  }
}

export function hotelName(id: HotelId) {
  return AUDIT_HOTELS.find((h) => h.id === id)?.name || id;
}
