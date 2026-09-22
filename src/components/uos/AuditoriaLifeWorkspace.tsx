/**
 * Workspace de auditoria por hotel:
 * Checklist → Pendências → Histórico → PMS×Adquirente → Adquirente×Banco → Taxas
 */
import { useEffect, useMemo, useState } from 'react';
import { Building2, Save, Lock, History, ClipboardCheck, AlertTriangle, Percent, ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { HotelId } from '@/lib/auditoria-hotels';
import { defaultFeesForHotel } from '@/lib/auditoria-hotels';
import {
  CHECKLIST,
  formatDateBR,
  formatBRL,
  isFriday,
  todayISO,
  fileToText,
  parseHitsText,
  parseGetnetText,
  parseSantanderText,
  reconcileHitsGetnet,
  reconcileGetnetBank,
  type FeeRule,
  type HitsPayment,
  type GetnetSale,
  type BankLine,
} from '@/lib/auditoria-core';
import {
  appendLog,
  canCloseAudit,
  countOpenPendencies,
  deriveStatus,
  emptyItem,
  historyRecordsForHotel,
  listPendingItems,
  newRecordId,
  recordsForHotel,
  statusLabel,
  upsertRecord,
  getRecord,
  type AuditAnswers,
  type AuditRecord,
  type ItemAnswer,
} from '@/lib/auditoria-workflow';
import { getSession, isAuditPendenciasOnly } from '@/lib/auth-store';
import { ConciliationPanel, PendenciasPanel, AuditDetailModal } from '@/components/uos/AuditoriaLifePanels';
import { TaxasFeeMatrix } from '@/components/uos/TaxasFeeMatrix';

type TabId = 'checklist' | 'pendencias' | 'historico' | 'pms_adq' | 'adq_banco' | 'taxas';

const TABS: { id: TabId; label: string; icon: typeof ClipboardCheck }[] = [
  { id: 'checklist', label: 'Checklist', icon: ClipboardCheck },
  { id: 'pendencias', label: 'Pendências', icon: AlertTriangle },
  { id: 'historico', label: 'Histórico', icon: History },
  { id: 'pms_adq', label: 'PMS × Adquirente', icon: ArrowLeftRight },
  { id: 'adq_banco', label: 'Adquirente × Banco', icon: ArrowLeftRight },
  { id: 'taxas', label: 'Taxas', icon: Percent },
];

function findOpenRecord(hotelId: HotelId, date: string): AuditRecord | undefined {
  return recordsForHotel(hotelId).find((r) => r.header.date === date && r.status !== 'fechada');
}

export function AuditoriaHotelWorkspace({
  hotelId,
  hotelName,
  onChangeHotel,
}: {
  hotelId: HotelId;
  hotelName: string;
  onChangeHotel?: () => void;
}) {
  const session = getSession();
  const userName = session?.displayName || 'Sistema';
  const onlyPendencias = isAuditPendenciasOnly(session);

  const [tab, setTab] = useState<TabId>(onlyPendencias ? 'pendencias' : 'checklist');
  const [date, setDate] = useState(todayISO());
  const [analyst, setAnalyst] = useState(userName);
  const [period, setPeriod] = useState('');
  const [answers, setAnswers] = useState<AuditAnswers>({});
  const [recordId, setRecordId] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const [tick, setTick] = useState(0);
  const [detail, setDetail] = useState<AuditRecord | null>(null);

  // Conciliações
  const [fees, setFees] = useState<FeeRule[]>(() => defaultFeesForHotel(hotelId));
  const [hits, setHits] = useState<HitsPayment[]>([]);
  const [getnet, setGetnet] = useState<GetnetSale[]>([]);
  const [bank, setBank] = useState<BankLine[]>([]);

  // Carrega auditoria do dia
  useEffect(() => {
    const rec = findOpenRecord(hotelId, date);
    if (rec) {
      setRecordId(rec.id);
      setAnswers(rec.answers || {});
      setAnalyst(rec.header.analyst || userName);
      setPeriod(rec.header.period || '');
      setClosed(rec.status === 'fechada');
    } else {
      setRecordId(null);
      setAnswers({});
      setClosed(false);
    }
  }, [hotelId, date, userName, tick]);

  const items = useMemo(
    () => CHECKLIST.filter((c) => !c.fridayOnly || isFriday(date)),
    [date],
  );
  const requiredIds = useMemo(() => items.map((i) => i.id), [items]);

  const answerOf = (id: number): ItemAnswer => answers[id] || emptyItem();

  const setItem = (id: number, patch: Partial<ItemAnswer>) => {
    setAnswers((prev) => {
      const current = prev[id] || emptyItem();
      const next: ItemAnswer = { ...current, ...patch };
      if (next.status === 'conforme') next.pendingState = 'none';
      if (next.status === 'divergencia' && next.pendingState === 'none') {
        next.pendingState = 'open';
        next.pendingAt = new Date().toISOString();
      }
      return { ...prev, [id]: next };
    });
  };

  const persist = (nextAnswers: AuditAnswers, opts?: { close?: boolean; action?: string }) => {
    const now = new Date().toISOString();
    const existing = recordId ? getRecord(recordId) : undefined;
    const id = recordId || newRecordId();
    const status = deriveStatus(nextAnswers, !!opts?.close);
    const rec: AuditRecord = {
      id,
      hotelId,
      hotelName,
      header: { date, analyst, period, sentToGoAt: existing?.header.sentToGoAt || '' },
      answers: nextAnswers,
      status,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      closedAt: opts?.close ? now : existing?.closedAt,
      closedBy: opts?.close ? userName : existing?.closedBy,
      logs: appendLog(existing?.logs, userName, opts?.action || 'Auditoria salva'),
    };
    upsertRecord(rec);
    setRecordId(id);
    setClosed(!!opts?.close);
    setTick((t) => t + 1);
    return rec;
  };

  const onSave = () => {
    persist(answers, { action: 'Auditoria salva' });
    toast.success('Auditoria salva');
  };

  const onClose = () => {
    if (!canCloseAudit(answers, requiredIds)) {
      toast.error('Responda todos os itens e resolva as pendências antes de fechar');
      return;
    }
    persist(answers, { close: true, action: 'Auditoria fechada' });
    toast.success('Auditoria fechada');
  };

  // Pendências
  const pendingItems = useMemo(() => {
    void tick;
    return listPendingItems({ hotelId }).map((p) => ({
      ...p,
      itemTitle: CHECKLIST.find((c) => c.id === p.itemId)?.title || `Item ${p.itemId}`,
    }));
  }, [hotelId, tick]);

  const patchPending = (
    auditId: string,
    itemId: number,
    patch: Partial<ItemAnswer>,
    action: string,
  ) => {
    const rec = getRecord(auditId);
    if (!rec) return;
    const current = rec.answers[itemId] || emptyItem();
    const nextAnswers: AuditAnswers = { ...rec.answers, [itemId]: { ...current, ...patch } };
    upsertRecord({
      ...rec,
      answers: nextAnswers,
      status: deriveStatus(nextAnswers, rec.status === 'fechada'),
      updatedAt: new Date().toISOString(),
      logs: appendLog(rec.logs, userName, action),
    });
    if (auditId === recordId) setAnswers(nextAnswers);
    setTick((t) => t + 1);
  };

  const history = useMemo(() => {
    void tick;
    return historyRecordsForHotel(hotelId);
  }, [hotelId, tick]);

  const hitsGetnetRows = useMemo(
    () =>
      reconcileHitsGetnet(hits, getnet).map((m) => ({
        id: m.id,
        label:
          m.side === 'both'
            ? `${m.hits?.guest || '—'} · ${formatBRL(m.hits?.amount || 0)}`
            : m.side === 'hits_only'
              ? `Só no PMS: ${m.hits?.guest || '—'}`
              : m.side === 'getnet_only'
                ? `Só na adquirente: ${m.getnet?.auth || m.getnet?.cv || '—'}`
                : `Diferença de valor: ${m.hits?.guest || '—'}`,
        detail:
          m.side === 'value_diff'
            ? `PMS ${formatBRL(m.hits?.amount || 0)} × adquirente ${formatBRL(m.getnet?.gross || 0)} (delta ${formatBRL(m.delta || 0)})`
            : m.side === 'both'
              ? 'Conciliado'
              : 'Sem correspondência',
        ok: m.side === 'both',
      })),
    [hits, getnet],
  );

  const bankRows = useMemo(
    () =>
      reconcileGetnetBank(getnet, bank, fees).map((r) => ({
        id: r.id,
        label: `${formatDateBR(r.settleDate)} · esperado ${formatBRL(r.expectedNet)} × banco ${formatBRL(r.bankCredit)}`,
        detail: r.detail || `Diferença ${formatBRL(r.delta)}`,
        ok: r.status === 'ok',
      })),
    [getnet, bank, fees],
  );

  const pasteInto = async (label: string, apply: (text: string) => void) => {
    const text = window.prompt(`Cole o conteúdo de ${label}`);
    if (text) apply(text);
  };

  const visibleTabs = onlyPendencias ? TABS.filter((t) => t.id === 'pendencias') : TABS;
  const openCount = countOpenPendencies(answers);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight">Auditoria Life</h2>
          <p className="text-[12px] text-slate-500 mt-0.5 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> {hotelName}
            {recordId && <> · {statusLabel(deriveStatus(answers, closed))}</>}
          </p>
        </div>
        {onChangeHotel && (
          <button
            type="button"
            onClick={onChangeHotel}
            className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-[12px] font-medium hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            Trocar hotel
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {visibleTabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'h-9 px-3.5 rounded-lg text-[12px] font-medium inline-flex items-center gap-1.5 border transition-all',
                tab === t.id
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300',
              )}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
              {t.id === 'pendencias' && pendingItems.length > 0 && (
                <span className="ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800">
                  {pendingItems.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'checklist' && !onlyPendencias && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <Field label="Data">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[13px]"
              />
            </Field>
            <Field label="Analista">
              <input
                value={analyst}
                onChange={(e) => setAnalyst(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[13px]"
              />
            </Field>
            <Field label="Período">
              <input
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="ex.: 01/09 a 07/09"
                className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[13px]"
              />
            </Field>
          </div>

          <div className="space-y-3">
            {items.map((c) => {
              const a = answerOf(c.id);
              return (
                <div key={c.id} className="rounded-xl border border-slate-200/80 bg-white p-4 space-y-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-slate-900">
                        {c.id}. {c.title}
                      </p>
                      <ul className="mt-1.5 space-y-0.5">
                        {c.bullets.map((b) => (
                          <li key={b} className="text-[12px] text-slate-500 leading-relaxed">
                            · {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={closed}
                        onClick={() => setItem(c.id, { status: 'conforme' })}
                        className={cn(
                          'h-8 px-3 rounded-lg text-[11px] font-semibold border transition-all',
                          a.status === 'conforme'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
                        )}
                      >
                        Conforme
                      </button>
                      <button
                        type="button"
                        disabled={closed}
                        onClick={() => setItem(c.id, { status: 'divergencia' })}
                        className={cn(
                          'h-8 px-3 rounded-lg text-[11px] font-semibold border transition-all',
                          a.status === 'divergencia'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
                        )}
                      >
                        Divergência
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={a.notes}
                    disabled={closed}
                    onChange={(e) => setItem(c.id, { notes: e.target.value })}
                    placeholder="Observações da analista"
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[12px]"
                  />
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={closed}
              className="h-9 px-4 rounded-lg bg-slate-900 text-white text-[12px] font-semibold inline-flex items-center gap-1.5 hover:bg-slate-800 disabled:opacity-50 transition-all"
            >
              <Save className="w-3.5 h-3.5" /> Salvar
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={closed}
              className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50 disabled:opacity-50 transition-all"
            >
              <Lock className="w-3.5 h-3.5" /> Fechar auditoria
            </button>
            {openCount > 0 && (
              <span className="text-[12px] text-amber-700">{openCount} pendência(s) em aberto</span>
            )}
            {closed && <span className="text-[12px] text-emerald-700">Auditoria concluída</span>}
          </div>
        </div>
      )}

      {tab === 'pendencias' && (
        <PendenciasPanel
          items={pendingItems}
          onHotelResolve={(auditId, itemId, resolution, attName, attData) =>
            patchPending(
              auditId,
              itemId,
              {
                pendingState: 'resolved',
                hotelResolution: resolution,
                hotelResolvedAt: new Date().toISOString(),
                hotelAttachmentName: attName,
                hotelAttachmentDataUrl: attData,
              },
              `Pendência ${itemId} respondida pelo hotel`,
            )
          }
          onApprove={(auditId, itemId) =>
            patchPending(auditId, itemId, { pendingState: 'approved' }, `Pendência ${itemId} aprovada`)
          }
          onReject={(auditId, itemId, reason) =>
            patchPending(
              auditId,
              itemId,
              { pendingState: 'open', analystRejectNote: reason },
              `Pendência ${itemId} devolvida ao hotel`,
            )
          }
        />
      )}

      {tab === 'historico' && !onlyPendencias && (
        <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-sm divide-y divide-slate-100">
          {history.length === 0 && (
            <p className="px-4 py-12 text-center text-[13px] text-slate-400">Nenhuma auditoria registrada</p>
          )}
          {history.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setDetail(r)}
              className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
            >
              <div>
                <p className="text-[13px] font-semibold text-slate-900">{formatDateBR(r.header.date)}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {r.hotelName} · analista {r.header.analyst || '—'}
                </p>
              </div>
              <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 tracking-wide">
                {statusLabel(r.status)}
              </span>
            </button>
          ))}
        </div>
      )}

      {tab === 'pms_adq' && !onlyPendencias && (
        <ConciliationPanel
          title="PMS × Adquirente"
          leftLabel="PMS (pagamentos)"
          rightLabel="Adquirente (vendas)"
          leftCount={hits.length}
          rightCount={getnet.length}
          onUploadLeft={async (f) => setHits(parseHitsText(await fileToText(f)))}
          onUploadRight={async (f) => setGetnet(parseGetnetText(await fileToText(f)))}
          onPasteLeft={() => pasteInto('PMS', (t) => setHits(parseHitsText(t)))}
          onPasteRight={() => pasteInto('adquirente', (t) => setGetnet(parseGetnetText(t)))}
          rows={hitsGetnetRows}
        />
      )}

      {tab === 'adq_banco' && !onlyPendencias && (
        <ConciliationPanel
          title="Adquirente × Banco"
          leftLabel="Adquirente (vendas)"
          rightLabel="Extrato bancário"
          leftCount={getnet.length}
          rightCount={bank.length}
          onUploadLeft={async (f) => setGetnet(parseGetnetText(await fileToText(f)))}
          onUploadRight={async (f) => setBank(parseSantanderText(await fileToText(f)))}
          onPasteLeft={() => pasteInto('adquirente', (t) => setGetnet(parseGetnetText(t)))}
          onPasteRight={() => pasteInto('extrato', (t) => setBank(parseSantanderText(t)))}
          rows={bankRows}
        />
      )}

      {tab === 'taxas' && !onlyPendencias && (
        <TaxasFeeMatrix hotelId={hotelId} hotelName={hotelName} onActiveFeesChange={setFees} />
      )}

      {detail && <AuditDetailModal record={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
