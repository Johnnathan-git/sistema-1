/**
 * Aprovação de auditorias — fila do GO / diretoria
 */
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  ClipboardCheck,
  Eye,
  MessageSquareWarning,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { CHECKLIST } from '@/lib/auditoria-core';
import { formatDateBR } from '@/lib/auditoria-core';
import {
  getRecord,
  loadAllRecords,
  recordsPendingApproval,
  statusLabel,
  upsertRecord,
  type AuditRecord,
  type AuditWorkflowStatus,
} from '@/lib/auditoria-workflow';

export function AprovacaoModule() {
  const [tick, setTick] = useState(0);
  const pending = useMemo(() => {
    void tick;
    return recordsPendingApproval();
  }, [tick]);
  const history = useMemo(() => {
    void tick;
    return loadAllRecords()
      .filter((r) => r.status === 'aprovado' || r.status === 'contestado')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 40);
  }, [tick]);

  const [viewId, setViewId] = useState<string | null>(null);
  const [contestOpen, setContestOpen] = useState(false);
  const [contestText, setContestText] = useState('');

  const viewing = viewId ? getRecord(viewId) : null;

  const refresh = () => setTick((t) => t + 1);

  const approve = (r: AuditRecord) => {
    upsertRecord({
      ...r,
      status: 'aprovado',
      approvedAt: new Date().toISOString(),
      approvedBy: 'GO',
      updatedAt: new Date().toISOString(),
      contestComment: undefined,
    });
    toast.success('Auditoria aprovada');
    setViewId(null);
    refresh();
  };

  const contest = (r: AuditRecord) => {
    if (!contestText.trim()) {
      toast.error('Informe o motivo da contestação');
      return;
    }
    upsertRecord({
      ...r,
      status: 'contestado',
      contestComment: contestText.trim(),
      updatedAt: new Date().toISOString(),
    });
    toast.message('Auditoria contestada — retornou à analista');
    setContestOpen(false);
    setContestText('');
    setViewId(null);
    refresh();
  };

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-slate-500" /> Aprovação de auditorias
        </h2>
        <p className="text-[12px] text-slate-500 mt-0.5">
          Filas enviadas pela analista financeira · aprovar ou contestar com comentário
        </p>
      </div>

      <section className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Aguardando aprovação ({pending.length})
        </p>
        {pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-[13px] text-slate-400">
            Nenhuma auditoria na fila
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((r) => (
              <AuditRow key={r.id} r={r} onView={() => setViewId(r.id)} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Recentes (aprovadas / contestadas)
        </p>
        {history.length === 0 ? (
          <div className="rounded-xl border bg-white px-4 py-6 text-center text-[12px] text-slate-400">
            Sem histórico ainda
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((r) => (
              <AuditRow key={r.id} r={r} onView={() => setViewId(r.id)} />
            ))}
          </div>
        )}
      </section>

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-xl border flex flex-col">
            <div className="px-5 py-3 border-b bg-slate-50 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[15px]">{viewing.hotelName}</p>
                <p className="text-[12px] text-slate-500">
                  {formatDateBR(viewing.header.date)} · {viewing.header.analyst || 'Analista'} ·{' '}
                  <StatusBadge status={viewing.status} />
                </p>
              </div>
              <button type="button" onClick={() => { setViewId(null); setContestOpen(false); }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {viewing.contestComment && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                  <strong>Contestação:</strong> {viewing.contestComment}
                </div>
              )}
              {CHECKLIST.map((item) => {
                const a = viewing.answers[item.id];
                if (!a) return null;
                return (
                  <div key={item.id} className="rounded-xl border border-slate-100 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-medium">
                        {item.id}. {item.title}
                      </p>
                      {a.status === 'conforme' && (
                        <span className="text-[10px] font-bold uppercase text-white bg-emerald-600 px-2 py-0.5 rounded">
                          Conforme
                        </span>
                      )}
                      {a.status === 'divergencia' && (
                        <span className="text-[10px] font-bold uppercase text-white bg-rose-600 px-2 py-0.5 rounded">
                          Divergência
                        </span>
                      )}
                    </div>
                    {a.notes && <p className="text-[12px] text-slate-600 mt-1">{a.notes}</p>}
                  </div>
                );
              })}
            </div>
            {viewing.status === 'aguardando' && (
              <div className="px-5 py-3 border-t bg-slate-50 space-y-2">
                {contestOpen ? (
                  <>
                    <textarea
                      className="w-full min-h-[80px] rounded-lg border px-3 py-2 text-[13px]"
                      placeholder="Motivo da contestação (obrigatório)…"
                      value={contestText}
                      onChange={(e) => setContestText(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setContestOpen(false)}
                        className="h-9 px-3 rounded-lg border text-[12px]"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => contest(viewing)}
                        className="h-9 px-3 rounded-lg bg-amber-600 text-white text-[12px] font-semibold"
                      >
                        Confirmar contestação
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setContestOpen(true)}
                      className="h-9 px-3 rounded-lg border border-amber-300 text-amber-900 text-[12px] font-semibold inline-flex items-center gap-1.5"
                    >
                      <MessageSquareWarning className="w-3.5 h-3.5" /> Contestar
                    </button>
                    <button
                      type="button"
                      onClick={() => approve(viewing)}
                      className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold inline-flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AuditRow({ r, onView }: { r: AuditRecord; onView: () => void }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center gap-3 justify-between shadow-sm">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-slate-900">{r.hotelName}</p>
        <p className="text-[11px] text-slate-500">
          {formatDateBR(r.header.date)} · {r.header.analyst || '—'} · {statusLabel(r.status)}
        </p>
      </div>
      <button
        type="button"
        onClick={onView}
        className="h-8 px-2.5 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1"
      >
        <Eye className="w-3.5 h-3.5" /> Ver
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: AuditWorkflowStatus }) {
  const map: Record<AuditWorkflowStatus, string> = {
    rascunho: 'bg-slate-100 text-slate-700',
    aguardando: 'bg-blue-100 text-blue-800',
    contestado: 'bg-amber-100 text-amber-900',
    aprovado: 'bg-emerald-100 text-emerald-800',
  };
  return (
    <span className={cn('inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold', map[status])}>
      {statusLabel(status)}
    </span>
  );
}
