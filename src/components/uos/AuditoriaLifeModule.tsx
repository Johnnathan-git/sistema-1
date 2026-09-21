/**
 * Auditoria Life — checklist diário por hotel + matriz de taxas
 */
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, ClipboardList, Lock, Percent, Save } from 'lucide-react';
import {
  CHECKLIST,
  formatDateBR,
  isFriday,
  todayISO,
  type FeeRule,
} from '@/lib/auditoria-core';
import { AUDIT_HOTELS, LS_HOTEL, type HotelId } from '@/lib/auditoria-hotels';
import {
  canCloseAudit,
  countOpenPendencies,
  deriveStatus,
  emptyItem,
  hotelName as hotelNameOf,
  newRecordId,
  recordsForHotel,
  statusLabel,
  upsertRecord,
  type AuditAnswers,
  type AuditRecord,
  type ItemStatus,
} from '@/lib/auditoria-workflow';
import { TaxasFeeMatrix } from './TaxasFeeMatrix';

type Tab = 'checklist' | 'taxas';

function emptyAnswers(): AuditAnswers {
  const a: AuditAnswers = {};
  for (const item of CHECKLIST) a[item.id] = emptyItem();
  return a;
}

function newRecord(hotelId: HotelId): AuditRecord {
  const now = new Date().toISOString();
  return {
    id: newRecordId(),
    hotelId,
    hotelName: hotelNameOf(hotelId),
    header: { date: todayISO(), analyst: '', period: '', sentToGoAt: '' },
    answers: emptyAnswers(),
    status: 'em_andamento',
    createdAt: now,
    updatedAt: now,
  };
}

export function AuditoriaLifeModule() {
  const [hotelId, setHotelId] = useState<HotelId>(() => {
    if (typeof window === 'undefined') return AUDIT_HOTELS[0].id;
    return (localStorage.getItem(LS_HOTEL) as HotelId) || AUDIT_HOTELS[0].id;
  });
  const [tab, setTab] = useState<Tab>('checklist');
  const [record, setRecord] = useState<AuditRecord | null>(null);
  const [fees, setFees] = useState<FeeRule[]>([]);

  useEffect(() => {
    localStorage.setItem(LS_HOTEL, hotelId);
    const existing = recordsForHotel(hotelId).find(
      (r) => r.status !== 'fechada' && r.header.date === todayISO(),
    );
    setRecord(existing ?? newRecord(hotelId));
  }, [hotelId]);

  const requiredIds = useMemo(
    () =>
      CHECKLIST.filter(
        (i) => !i.fridayOnly || (record ? isFriday(record.header.date) : false),
      ).map((i) => i.id),
    [record],
  );

  const items = useMemo(
    () => CHECKLIST.filter((i) => requiredIds.includes(i.id)),
    [requiredIds],
  );

  if (!record) return null;
  const rec: AuditRecord = record;

  const closed = rec.status === 'fechada';

  function patch(next: Partial<AuditRecord>) {
    setRecord((prev) => (prev ? { ...prev, ...next, updatedAt: new Date().toISOString() } : prev));
  }

  function setItem(id: number, patchItem: Partial<AuditAnswers[number]>) {
    setRecord((prev) => {
      if (!prev) return prev;
      const answers: AuditAnswers = {
        ...prev.answers,
        [id]: { ...(prev.answers[id] ?? emptyItem()), ...patchItem },
      };
      return {
        ...prev,
        answers,
        status: deriveStatus(answers, prev.status === 'fechada'),
        updatedAt: new Date().toISOString(),
      };
    });
  }

  function setStatus(id: number, status: ItemStatus) {
    setItem(id, {
      status,
      pendingState: status === 'divergencia' ? 'open' : 'none',
      pendingAt: status === 'divergencia' ? new Date().toISOString() : undefined,
    });
  }

  function save() {
    const saved: AuditRecord = { ...rec, status: deriveStatus(rec.answers, closed) };
    upsertRecord(saved);
    setRecord(saved);
    toast.success('Auditoria salva');
  }

  function close() {
    if (!canCloseAudit(rec.answers, requiredIds)) {
      toast.error('Existem itens sem resposta ou pendências abertas');
      return;
    }
    const saved: AuditRecord = {
      ...rec,
      status: 'fechada',
      closedAt: new Date().toISOString(),
      closedBy: rec.header.analyst || 'Analista',
      updatedAt: new Date().toISOString(),
    };
    upsertRecord(saved);
    setRecord(saved);
    toast.success('Auditoria fechada');
  }

  const answered = items.filter((i) => record.answers[i.id]?.status).length;
  const openPend = countOpenPendencies(record.answers);

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Auditoria Life</h1>
          <p className="text-sm text-muted-foreground">
            {formatDateBR(record.header.date)} · {statusLabel(record.status)} · {answered}/
            {items.length} itens · {openPend} pendência(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={hotelId}
            onChange={(e) => setHotelId(e.target.value as HotelId)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {AUDIT_HOTELS.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <button
            onClick={save}
            disabled={closed}
            className="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground disabled:opacity-50"
          >
            <Save className="size-4" /> Salvar
          </button>
          <button
            onClick={close}
            disabled={closed}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Lock className="size-4" /> Fechar
          </button>
        </div>
      </header>

      <nav className="flex gap-2 border-b border-border">
        {([
          ['checklist', 'Checklist', ClipboardList],
          ['taxas', 'Taxas', Percent],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm',
              tab === id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </nav>

      {tab === 'taxas' ? (
        <TaxasFeeMatrix
          hotelId={hotelId}
          hotelName={hotelNameOf(hotelId)}
          onActiveFeesChange={setFees}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Data</span>
              <input
                type="date"
                value={record.header.date}
                disabled={closed}
                onChange={(e) => patch({ header: { ...record.header, date: e.target.value } })}
                className="rounded-md border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Analista</span>
              <input
                value={record.header.analyst}
                disabled={closed}
                onChange={(e) => patch({ header: { ...record.header, analyst: e.target.value } })}
                className="rounded-md border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Período auditado</span>
              <input
                value={record.header.period}
                disabled={closed}
                onChange={(e) => patch({ header: { ...record.header, period: e.target.value } })}
                className="rounded-md border border-border bg-background px-3 py-2"
              />
            </label>
          </div>

          <ul className="flex flex-col gap-3">
            {items.map((item) => {
              const ans = record.answers[item.id] ?? emptyItem();
              return (
                <li key={item.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="max-w-2xl">
                      <h3 className="font-medium">
                        {item.id}. {item.title}
                        {item.fridayOnly && (
                          <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            semanal
                          </span>
                        )}
                      </h3>
                      <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                        {item.bullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={closed}
                        onClick={() => setStatus(item.id, 'conforme')}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50',
                          ans.status === 'conforme' && 'border-primary bg-primary/10 text-primary',
                        )}
                      >
                        <CheckCircle2 className="size-4" /> Conforme
                      </button>
                      <button
                        disabled={closed}
                        onClick={() => setStatus(item.id, 'divergencia')}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50',
                          ans.status === 'divergencia' &&
                            'border-destructive bg-destructive/10 text-destructive',
                        )}
                      >
                        <AlertTriangle className="size-4" /> Divergência
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={ans.notes}
                    disabled={closed}
                    placeholder="Observações / evidências"
                    onChange={(e) => setItem(item.id, { notes: e.target.value })}
                    className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    rows={2}
                  />
                  {ans.status === 'divergencia' && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Pendência: {ans.pendingState === 'approved' ? 'aprovada' : ans.pendingState}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          {fees.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {fees.filter((f) => f.active).length} taxas ativas para {hotelNameOf(hotelId)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
