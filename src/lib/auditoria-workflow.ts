/** Persistência e fluxo: checklist → pendências (hotel) → analista → fechamento */
import type { HotelId } from './auditoria-hotels';
import { AUDIT_HOTELS } from './auditoria-hotels';

export type AuditWorkflowStatus =
  | 'em_andamento'
  | 'pendente'
  | 'aguardando_analista'
  | 'fechada'
  | 'rascunho'
  | 'aguardando'
  | 'contestado'
  | 'aprovado';

export type ItemStatus = 'conforme' | 'divergencia' | '';

/** none = ok/conforme; open = hotel deve resolver; resolved = hotel enviou; approved = analista ok */
export type PendingState = 'none' | 'open' | 'resolved' | 'approved';

export interface ItemAnswer {
  status: ItemStatus;
  notes: string;
  attachmentName?: string;
  attachmentDataUrl?: string;
  pendingState: PendingState;
  pendingAt?: string;
  hotelResolution?: string;
  hotelResolvedAt?: string;
  hotelAttachmentName?: string;
  hotelAttachmentDataUrl?: string;
  analystRejectNote?: string;
  /** Responsável (hotel) atribuído pela analista na divergência */
  assignedTo?: string;
}

export type AuditAnswers = Record<number, ItemAnswer>;

export interface AuditHeader {
  date: string;
  analyst: string;
  period: string;
  sentToGoAt: string;
}

/** Log de alterações da auditoria (histórico) */
export interface AuditLogEntry {
  at: string;
  user: string;
  action: string;
}

export interface AuditRecord {
  id: string;
  hotelId: HotelId;
  hotelName: string;
  header: AuditHeader;
  answers: AuditAnswers;
  status: AuditWorkflowStatus;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  closedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  contestComment?: string;
  logs?: AuditLogEntry[];
}

/** Item solto na fila de pendências */
export interface PendingItemView {
  auditId: string;
  hotelId: HotelId;
  hotelName: string;
  auditDate: string;
  analyst: string;
  itemId: number;
  itemTitle: string;
  answer: ItemAnswer;
}

export const LS_RECORDS = 'pms-auditoria-records-v2';

export function emptyItem(): ItemAnswer {
  return { status: '', notes: '', pendingState: 'none' };
}

export function appendLog(
  logs: AuditLogEntry[] | undefined,
  user: string,
  action: string,
): AuditLogEntry[] {
  const entry: AuditLogEntry = {
    at: new Date().toISOString(),
    user: (user || 'Sistema').trim() || 'Sistema',
    action,
  };
  return [...(logs || []), entry];
}

export function loadAllRecords(): AuditRecord[] {
  try {
    const raw = localStorage.getItem(LS_RECORDS);
    if (raw) {
      const parsed = JSON.parse(raw) as AuditRecord[];
      if (Array.isArray(parsed)) return parsed.map(normalizeRecord);
    }
  } catch {}
  try {
    const raw = localStorage.getItem('pms-auditoria-records-v1');
    if (raw) {
      const parsed = JSON.parse(raw) as any[];
      if (Array.isArray(parsed)) {
        const migrated = parsed.map((r) => normalizeRecord(r));
        saveAllRecords(migrated);
        return migrated;
      }
    }
  } catch {}
  return [];
}

function normalizeItem(a: any): ItemAnswer {
  if (!a || typeof a !== 'object') return emptyItem();
  const status = a.status === 'conforme' || a.status === 'divergencia' ? a.status : '';
  let pendingState: PendingState = a.pendingState || 'none';
  if (status === 'divergencia' && pendingState === 'none') pendingState = 'open';
  if (status === 'conforme') pendingState = 'none';
  return {
    status,
    notes: a.notes || '',
    attachmentName: a.attachmentName,
    attachmentDataUrl: a.attachmentDataUrl,
    pendingState,
    pendingAt: a.pendingAt,
    hotelResolution: a.hotelResolution,
    hotelResolvedAt: a.hotelResolvedAt,
    hotelAttachmentName: a.hotelAttachmentName,
    hotelAttachmentDataUrl: a.hotelAttachmentDataUrl,
    analystRejectNote: a.analystRejectNote,
    assignedTo: a.assignedTo || undefined,
  };
}

function normalizeRecord(r: any): AuditRecord {
  const answers: AuditAnswers = {};
  const src = r.answers || {};
  for (const k of Object.keys(src)) {
    answers[Number(k)] = normalizeItem(src[k]);
  }
  let status = r.status as string;
  if (status === 'rascunho' || status === 'contestado') status = 'em_andamento';
  if (status === 'aguardando') status = 'pendente';
  if (status === 'aprovado') status = 'fechada';
  if (!['em_andamento', 'pendente', 'aguardando_analista', 'fechada'].includes(status)) {
    status = deriveStatus(answers, false);
  }
  const logs: AuditLogEntry[] = Array.isArray(r.logs)
    ? r.logs
        .filter((l: any) => l && typeof l === 'object')
        .map((l: any) => ({
          at: String(l.at || ''),
          user: String(l.user || 'Sistema'),
          action: String(l.action || ''),
        }))
    : [];
  return {
    id: r.id,
    hotelId: r.hotelId,
    hotelName: r.hotelName,
    header: r.header || { date: '', analyst: '', period: '', sentToGoAt: '' },
    answers,
    status: status as AuditWorkflowStatus,
    createdAt: r.createdAt || new Date().toISOString(),
    updatedAt: r.updatedAt || new Date().toISOString(),
    closedAt: r.closedAt || r.approvedAt,
    closedBy: r.closedBy || r.approvedBy,
    logs,
  };
}

export function deriveStatus(answers: AuditAnswers, closed: boolean): AuditWorkflowStatus {
  if (closed) return 'fechada';
  const items = Object.values(answers);
  if (items.some((a) => a.pendingState === 'open')) return 'pendente';
  if (items.some((a) => a.pendingState === 'resolved')) return 'aguardando_analista';
  return 'em_andamento';
}

export function saveAllRecords(records: AuditRecord[]) {
  localStorage.setItem(LS_RECORDS, JSON.stringify(records));
}

/** Todos os registros do hotel (uso interno) */
export function recordsForHotel(hotelId: HotelId): AuditRecord[] {
  return loadAllRecords()
    .filter((r) => r.hotelId === hotelId)
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

/**
 * Histórico: todas as auditorias registradas do hotel.
 * - Com divergência aberta → status Pendente
 * - Hotel enviou resolução → Aguardando analista
 * - 100% aprovada → Concluída
 */
export function historyRecordsForHotel(hotelId: HotelId): AuditRecord[] {
  return recordsForHotel(hotelId).filter((r) =>
    r.status === 'fechada' ||
    r.status === 'pendente' ||
    r.status === 'aguardando_analista' ||
    r.status === 'em_andamento',
  );
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
    case 'em_andamento':
      return 'Em andamento';
    case 'pendente':
      return 'Pendente';
    case 'aguardando_analista':
      return 'Aguardando analista';
    case 'fechada':
      return 'Concluída';
    case 'rascunho':
      return 'Rascunho';
    case 'aguardando':
      return 'Aguardando aprovação';
    case 'contestado':
      return 'Contestada';
    case 'aprovado':
      return 'Aprovada';
  }
}

export function recordsPendingApproval(): AuditRecord[] {
  return loadAllRecords()
    .filter((r) => r.status === 'aguardando')
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export function hotelName(id: HotelId) {
  return AUDIT_HOTELS.find((h) => h.id === id)?.name || id;
}

export function listPendingItems(opts?: {
  hotelId?: HotelId;
  states?: PendingState[];
}): PendingItemView[] {
  const states = opts?.states || ['open', 'resolved'];
  const out: PendingItemView[] = [];
  for (const r of loadAllRecords()) {
    if (r.status === 'fechada') continue;
    if (opts?.hotelId && r.hotelId !== opts.hotelId) continue;
    for (const [idStr, ans] of Object.entries(r.answers)) {
      if (!states.includes(ans.pendingState)) continue;
      if (ans.status !== 'divergencia' && ans.pendingState === 'none') continue;
      out.push({
        auditId: r.id,
        hotelId: r.hotelId,
        hotelName: r.hotelName,
        auditDate: r.header.date,
        analyst: r.header.analyst,
        itemId: Number(idStr),
        itemTitle: '',
        answer: ans,
      });
    }
  }
  out.sort((a, b) => (b.answer.pendingAt || '').localeCompare(a.answer.pendingAt || ''));
  return out;
}

export function canCloseAudit(answers: AuditAnswers, requiredIds: number[]): boolean {
  for (const id of requiredIds) {
    const a = answers[id];
    if (!a?.status) return false;
    if (a.status === 'divergencia' && a.pendingState !== 'approved') return false;
    if (a.pendingState === 'open' || a.pendingState === 'resolved') return false;
  }
  return true;
}

export function countOpenPendencies(answers: AuditAnswers): number {
  return Object.values(answers).filter((a) => a.pendingState === 'open' || a.pendingState === 'resolved').length;
}
