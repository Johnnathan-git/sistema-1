import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ClipboardCheck, Eye, FileText,
  History, Link2, Loader2, Plus, Scale, Settings2, Upload, X, Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { TaxasFeeMatrix } from '@/components/uos/TaxasFeeMatrix';
import {
  parseHitsText, parseGetnetText, parseSantanderText, reconcileHitsGetnet, reconcileGetnetBank,
  formatBRL, formatDateBR, todayISO, isFriday, fileToText,
  type HitsPayment, type GetnetSale, type BankLine, type FeeRule, CHECKLIST,
} from '@/lib/auditoria-core';
import {
  auditStorageKey, defaultFeesForHotel, feesStorageKey, type HotelId,
} from '@/lib/auditoria-hotels';
import {
  type AuditWorkflowStatus, type ItemAnswer,
  newRecordId, recordsForHotel, statusLabel, upsertRecord, getRecord, type AuditRecord,
  emptyItem, deriveStatus, listPendingItems, canCloseAudit, countOpenPendencies,
} from '@/lib/auditoria-workflow';
import { ConciliationPanel, PendenciasPanel, AuditDetailModal } from '@/components/uos/AuditoriaLifePanels';

type TopTab = 'etapas' | 'conciliacao' | 'taxas';
type EtapaTab = 'abrir' | 'historico' | 'pendencias';
type ConciliacaoSub = 'hits_getnet' | 'getnet_bank';

function formatDateTimeBR(iso?: string) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} às ${hh}:${mi}`;
  } catch {
    return iso;
  }
}

function emptyAnswers(): Record<number, ItemAnswer> {
  const init: Record<number, ItemAnswer> = {};
  for (const c of CHECKLIST) init[c.id] = emptyItem();
  return init;
}

export function AuditoriaHotelWorkspace({
  hotelId,
  hotelName,
  onChangeHotel,
}: {
  hotelId: HotelId;
  hotelName: string;
  onChangeHotel: () => void;
}) {
  const [topTab, setTopTab] = useState<TopTab>('etapas');
  const [etapa, setEtapa] = useState<EtapaTab>('abrir');
  const [conciliacaoSub, setConciliacaoSub] = useState<ConciliacaoSub>('hits_getnet');
  const storageKey = auditStorageKey(hotelId);

  const [header, setHeader] = useState({
    date: todayISO(),
    analyst: '',
    period: 'Dia completo',
    sentToGoAt: '',
  });
  const [answers, setAnswers] = useState(emptyAnswers);
  const [fees, setFees] = useState<FeeRule[]>(() => {
    try {
      const raw = localStorage.getItem(feesStorageKey(hotelId));
      if (raw) return JSON.parse(raw);
    } catch {}
    return defaultFeesForHotel(hotelId);
  });
  const [hits, setHits] = useState<HitsPayment[]>([]);
  const [getnet, setGetnet] = useState<GetnetSale[]>([]);
  const [bank, setBank] = useState<BankLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [pasteOpen, setPasteOpen] = useState<'hits' | 'getnet' | 'bank' | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [tick, setTick] = useState(0);
  const [modalRecord, setModalRecord] = useState<AuditRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    setTopTab('etapas');
    setEtapa('abrir');
    setConciliacaoSub('hits_getnet');
    setHits([]);
    setGetnet([]);
    setBank([]);
    setHeader({ date: todayISO(), analyst: '', period: 'Dia completo', sentToGoAt: '' });
    setAnswers(emptyAnswers());
    setModalRecord(null);
    setFormOpen(false);
  }, [hotelId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(feesStorageKey(hotelId));
      if (raw) setFees(JSON.parse(raw));
      else setFees(defaultFeesForHotel(hotelId));
    } catch {
      setFees(defaultFeesForHotel(hotelId));
    }
  }, [hotelId]);

  const history = useMemo(() => recordsForHotel(hotelId), [hotelId, tick]);
  const pendingItems = useMemo(() => {
    const items = listPendingItems({ hotelId });
    return items.map((p) => ({
      ...p,
      itemTitle: CHECKLIST.find((c) => c.id === p.itemId)?.title || `Item ${p.itemId}`,
    }));
  }, [hotelId, tick]);

  const hitsMatches = useMemo(() => reconcileHitsGetnet(hits, getnet), [hits, getnet]);
  const bankMatches = useMemo(() => reconcileGetnetBank(getnet, bank, fees), [getnet, bank, fees]);

  const setAnswer = useCallback((id: number, patch: Partial<ItemAnswer>) => {
    setAnswers((prev) => {
      const cur = prev[id] || emptyItem();
      let next: ItemAnswer = { ...cur, ...patch };
      if (patch.status === 'conforme') {
        next = { ...next, pendingState: 'none', notes: next.notes || '' };
      }
      if (patch.status === 'divergencia') {
        next = {
          ...next,
          pendingState: next.pendingState === 'none' || !next.pendingState ? 'open' : next.pendingState,
          pendingAt: next.pendingAt || new Date().toISOString(),
        };
      }
      return { ...prev, [id]: next };
    });
  }, []);

  const readAttachment = (id: number, file: File) => {
    if (file.size > 2_500_000) {
      toast.error('Arquivo muito grande (máx. ~2,5 MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAnswer(id, {
        attachmentName: file.name,
        attachmentDataUrl: String(reader.result || ''),
      });
    };
    reader.readAsDataURL(file);
  };

  const clearAttachment = (id: number) => {
    setAnswer(id, { attachmentName: undefined, attachmentDataUrl: undefined });
  };

  const resetForm = () => {
    setHeader({ date: todayISO(), analyst: '', period: 'Dia completo', sentToGoAt: '' });
    setAnswers(emptyAnswers());
    setFormOpen(false);
  };

  const startNewAudit = () => {
    resetForm();
    setFormOpen(true);
    setEtapa('abrir');
  };

  const saveAudit = () => {
    if (!header.analyst.trim()) {
      toast.error('Informe o nome da analista');
      return;
    }
    const answered = Object.values(answers).filter((a) => a.status);
    if (answered.length === 0) {
      toast.error('Marque ao menos um item do checklist');
      return;
    }
    for (const [idStr, a] of Object.entries(answers)) {
      if (a.status === 'divergencia' && !a.notes.trim()) {
        toast.error(`Item ${idStr}: descreva a divergência`);
        return;
      }
    }
    const id = newRecordId();
    const now = new Date().toISOString();
    const status = deriveStatus(answers, false);
    const rec: AuditRecord = {
      id,
      hotelId,
      hotelName,
      header: { ...header },
      answers: { ...answers },
      status,
      createdAt: now,
      updatedAt: now,
    };
    upsertRecord(rec);
    setTick((t) => t + 1);
    toast.success(
      status === 'pendente'
        ? 'Auditoria salva — divergências foram para Pendências'
        : 'Auditoria salva no Histórico',
    );
    resetForm();
    setEtapa('historico');
  };

  const hotelResolve = (auditId: string, itemId: number, resolution: string, attName?: string, attData?: string) => {
    const rec = getRecord(auditId);
    if (!rec) return;
    if (!resolution.trim() && !attData) {
      toast.error('Descreva a resolução ou anexe um arquivo');
      return;
    }
    const ans = { ...(rec.answers[itemId] || emptyItem()) };
    ans.pendingState = 'resolved';
    ans.hotelResolution = resolution.trim();
    ans.hotelResolvedAt = new Date().toISOString();
    if (attName) ans.hotelAttachmentName = attName;
    if (attData) ans.hotelAttachmentDataUrl = attData;
    const answers = { ...rec.answers, [itemId]: ans };
    const status = deriveStatus(answers, false);
    upsertRecord({ ...rec, answers, status, updatedAt: new Date().toISOString() });
    setTick((t) => t + 1);
    toast.success('Resolução enviada — aguardando analista');
  };

  const approveItem = (auditId: string, itemId: number) => {
    const rec = getRecord(auditId);
    if (!rec) return;
    const ans = { ...(rec.answers[itemId] || emptyItem()) };
    ans.pendingState = 'approved';
    const answers = { ...rec.answers, [itemId]: ans };
    const requiredIds = CHECKLIST.map((c) => c.id);
    const canClose = canCloseAudit(answers, requiredIds);
    const status = canClose ? 'fechada' : deriveStatus(answers, false);
    const now = new Date().toISOString();
    upsertRecord({
      ...rec,
      answers,
      status,
      updatedAt: now,
      closedAt: canClose ? now : rec.closedAt,
      closedBy: canClose ? rec.header.analyst : rec.closedBy,
    });
    setTick((t) => t + 1);
    toast.success(canClose ? 'Item aprovado — auditoria concluída' : 'Item aprovado');
  };

  const rejectItem = (auditId: string, itemId: number, reason: string) => {
    const rec = getRecord(auditId);
    if (!rec) return;
    if (!reason.trim()) {
      toast.error('Informe a justificativa da recusa');
      return;
    }
    const ans = { ...(rec.answers[itemId] || emptyItem()) };
    ans.pendingState = 'open';
    ans.analystRejectNote = reason.trim();
    ans.hotelResolution = undefined;
    ans.hotelResolvedAt = undefined;
    const answers = { ...rec.answers, [itemId]: ans };
    const status = deriveStatus(answers, false);
    upsertRecord({ ...rec, answers, status, updatedAt: new Date().toISOString() });
    setTick((t) => t + 1);
    toast.message('Pendência devolvida ao hotel');
  };

  const loadFile = async (kind: 'hits' | 'getnet' | 'bank', file: File) => {
    setBusy(true);
    try {
      const text = await fileToText(file);
      if (kind === 'hits') {
        const rows = parseHitsText(text);
        setHits(rows);
        toast.success(`${rows.length} pagamento(s) HITS`);
      } else if (kind === 'getnet') {
        const rows = parseGetnetText(text);
        setGetnet(rows);
        toast.success(`${rows.length} venda(s) Getnet`);
      } else {
        const rows = parseSantanderText(text);
        setBank(rows);
        toast.success(`${rows.length} linha(s) de extrato`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao ler arquivo');
    } finally {
      setBusy(false);
    }
  };

  const applyPaste = () => {
    if (!pasteOpen) return;
    try {
      if (pasteOpen === 'hits') {
        const rows = parseHitsText(pasteText);
        setHits(rows);
        toast.success(`${rows.length} pagamento(s) HITS`);
      } else if (pasteOpen === 'getnet') {
        const rows = parseGetnetText(pasteText);
        setGetnet(rows);
        toast.success(`${rows.length} venda(s) Getnet`);
      } else {
        const rows = parseSantanderText(pasteText);
        setBank(rows);
        toast.success(`${rows.length} linha(s) de extrato`);
      }
      setPasteOpen(null);
      setPasteText('');
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível processar o texto');
    }
  };

  const openCount = pendingItems.filter((p) => p.answer.pendingState === 'open').length;
  const resolvedCount = pendingItems.filter((p) => p.answer.pendingState === 'resolved').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onChangeHotel}
          className="h-8 px-2.5 rounded-lg border text-[12px] font-medium text-slate-600 inline-flex items-center gap-1.5 hover:bg-slate-50"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Trocar hotel · {hotelName}
        </button>
        {busy && (
          <span className="text-[12px] text-slate-500 inline-flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processando…
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {(
          [
            ['etapas', 'Etapas Auditoria', ClipboardCheck],
            ['conciliacao', 'Conciliação', Link2],
            ['taxas', 'Taxas', Scale],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTopTab(id)}
            className={cn(
              'h-10 px-3 text-[13px] font-medium inline-flex items-center gap-1.5 border-b-2 -mb-px transition-colors',
              topTab === id
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {topTab === 'etapas' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 w-fit">
            {(
              [
                ['abrir', 'Abrir Auditoria'],
                ['historico', 'Histórico'],
                ['pendencias', `Pendências${openCount + resolvedCount ? ` (${openCount + resolvedCount})` : ''}`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setEtapa(id)}
                className={cn(
                  'h-8 px-3 rounded-lg text-[12px] font-semibold transition-colors',
                  etapa === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {etapa === 'abrir' && (
            <div className="space-y-4">
              {!formOpen ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
                  <ClipboardCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-[15px] font-semibold text-slate-800">Nova auditoria</p>
                  <p className="text-[13px] text-slate-500 mt-1 max-w-md mx-auto">
                    Abra uma auditoria do dia. Divergências vão para Pendências; o registro entra no Histórico como pendente até a aprovação.
                  </p>
                  <button
                    type="button"
                    onClick={startNewAudit}
                    className="mt-5 h-10 px-5 rounded-xl bg-slate-900 text-white text-[13px] font-semibold inline-flex items-center gap-2 hover:bg-slate-800"
                  >
                    <Plus className="w-4 h-4" /> Abrir auditoria
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <label className="space-y-1">
                      <span className="text-[10px] font-semibold uppercase text-slate-400">Data</span>
                      <input
                        type="date"
                        value={header.date}
                        onChange={(e) => setHeader((h) => ({ ...h, date: e.target.value }))}
                        className="h-9 w-full rounded-lg border border-slate-200 px-3 text-[13px]"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] font-semibold uppercase text-slate-400">Analista</span>
                      <input
                        value={header.analyst}
                        onChange={(e) => setHeader((h) => ({ ...h, analyst: e.target.value }))}
                        placeholder="Nome"
                        className="h-9 w-full rounded-lg border border-slate-200 px-3 text-[13px]"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] font-semibold uppercase text-slate-400">Período</span>
                      <select
                        value={header.period}
                        onChange={(e) => setHeader((h) => ({ ...h, period: e.target.value }))}
                        className="h-9 w-full rounded-lg border border-slate-200 px-3 text-[13px]"
                      >
                        <option>Dia completo</option>
                        <option>Manhã</option>
                        <option>Tarde</option>
                        <option>Noite</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] font-semibold uppercase text-slate-400">Enviado ao GO</span>
                      <input
                        type="datetime-local"
                        value={header.sentToGoAt}
                        onChange={(e) => setHeader((h) => ({ ...h, sentToGoAt: e.target.value }))}
                        className="h-9 w-full rounded-lg border border-slate-200 px-3 text-[13px]"
                      />
                    </label>
                  </div>

                  <div className="space-y-2">
                    {CHECKLIST.map((item) => {
                      const a = answers[item.id] || emptyItem();
                      return (
                        <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-slate-900">
                                {item.id}. {item.title}
                              </p>
                              {item.hint && <p className="text-[11px] text-slate-500 mt-0.5">{item.hint}</p>}
                            </div>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => setAnswer(item.id, { status: 'conforme' })}
                                className={cn(
                                  'h-8 px-3 rounded-lg text-[11px] font-semibold border',
                                  a.status === 'conforme'
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'border-slate-200 text-slate-600 hover:bg-emerald-50',
                                )}
                              >
                                Conforme
                              </button>
                              <button
                                type="button"
                                onClick={() => setAnswer(item.id, { status: 'divergencia' })}
                                className={cn(
                                  'h-8 px-3 rounded-lg text-[11px] font-semibold border',
                                  a.status === 'divergencia'
                                    ? 'bg-rose-600 text-white border-rose-600'
                                    : 'border-slate-200 text-slate-600 hover:bg-rose-50',
                                )}
                              >
                                Divergência
                              </button>
                            </div>
                          </div>

                          {(a.status === 'conforme' || a.status === 'divergencia') && (
                            <div className="space-y-2 border-t border-slate-100 pt-3">
                              {a.status === 'divergencia' && (
                                <textarea
                                  value={a.notes}
                                  onChange={(e) => setAnswer(item.id, { notes: e.target.value })}
                                  placeholder="Descreva a divergência…"
                                  className="w-full min-h-[72px] rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                                />
                              )}
                              {a.status === 'conforme' && (
                                <textarea
                                  value={a.notes}
                                  onChange={(e) => setAnswer(item.id, { notes: e.target.value })}
                                  placeholder="Observação (opcional)…"
                                  className="w-full min-h-[56px] rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                                />
                              )}
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="h-8 px-3 rounded-lg border text-[11px] font-medium cursor-pointer inline-flex items-center gap-1 hover:bg-slate-50">
                                  <Upload className="w-3.5 h-3.5" /> Anexar
                                  <input
                                    type="file"
                                    accept=".pdf,image/*,.txt,.csv"
                                    className="hidden"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) readAttachment(item.id, f);
                                    }}
                                  />
                                </label>
                                {a.attachmentName && (
                                  <span className="text-[12px] text-slate-600 inline-flex items-center gap-1">
                                    <FileText className="w-3.5 h-3.5" />
                                    {a.attachmentName}
                                    <button
                                      type="button"
                                      onClick={() => clearAttachment(item.id)}
                                      className="ml-1 text-rose-600 hover:underline text-[11px]"
                                    >
                                      Remover
                                    </button>
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="h-10 px-4 rounded-xl border text-[13px] font-medium"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={saveAudit}
                      className="h-10 px-5 rounded-xl bg-slate-900 text-white text-[13px] font-semibold hover:bg-slate-800"
                    >
                      Salvar auditoria
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {etapa === 'historico' && (
            <div className="space-y-2">
              {history.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
                  <History className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-[15px] font-semibold text-slate-800">Nenhuma auditoria ainda</p>
                  <p className="text-[13px] text-slate-500 mt-1">As auditorias abertas aparecem aqui, inclusive as pendentes</p>
                </div>
              )}
              {history.map((r) => {
                const openPend = countOpenPendencies(r.answers);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setModalRecord(r)}
                    className="w-full text-left rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 transition-colors"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-[14px] font-semibold text-slate-900">
                          {formatDateBR(r.header.date)} · {r.header.analyst || 'Sem analista'}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {r.header.period} · atualizado {formatDateTimeBR(r.updatedAt)}
                          {openPend > 0 && <> · {openPend} pendência(s)</>}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'text-[10px] font-bold uppercase px-2 py-0.5 rounded',
                          r.status === 'fechada' && 'bg-emerald-100 text-emerald-800',
                          r.status === 'pendente' && 'bg-rose-100 text-rose-800',
                          r.status === 'aguardando_analista' && 'bg-amber-100 text-amber-900',
                          r.status === 'em_andamento' && 'bg-slate-100 text-slate-700',
                        )}
                      >
                        {statusLabel(r.status)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {etapa === 'pendencias' && (
            <PendenciasPanel
              items={pendingItems}
              onHotelResolve={hotelResolve}
              onApprove={approveItem}
              onReject={rejectItem}
            />
          )}
        </div>
      )}

      {topTab === 'conciliacao' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 w-fit">
            {(
              [
                ['hits_getnet', 'PMS × Adquirente'],
                ['getnet_bank', 'Adquirente × Banco'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setConciliacaoSub(id)}
                className={cn(
                  'h-8 px-3 rounded-lg text-[12px] font-semibold transition-colors',
                  conciliacaoSub === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {conciliacaoSub === 'hits_getnet' && (
            <ConciliationPanel
              title="PMS × Adquirente"
              leftLabel="HITS (PMS)"
              rightLabel="Getnet"
              leftCount={hits.length}
              rightCount={getnet.length}
              onUploadLeft={(f) => loadFile('hits', f)}
              onUploadRight={(f) => loadFile('getnet', f)}
              onPasteLeft={() => setPasteOpen('hits')}
              onPasteRight={() => setPasteOpen('getnet')}
              rows={hitsMatches.map((m) => ({
                id: m.id,
                label: m.status === 'ok' ? 'Conciliado' : m.status.replace(/_/g, ' '),
                detail: m.detail || `${formatDateBR(m.date)} · ${formatBRL(m.amount)}`,
                ok: m.status === 'ok',
              }))}
            />
          )}

          {conciliacaoSub === 'getnet_bank' && (
            <ConciliationPanel
              title="Adquirente × Banco"
              leftLabel="Adquirente"
              rightLabel="Extrato bancário"
              leftCount={getnet.length}
              rightCount={bank.length}
              onUploadLeft={(f) => loadFile('getnet', f)}
              onUploadRight={(f) => loadFile('bank', f)}
              onPasteLeft={() => setPasteOpen('getnet')}
              onPasteRight={() => setPasteOpen('bank')}
              rows={bankMatches.map((m) => ({
                id: m.id,
                label: m.status === 'ok' ? 'Conciliado' : m.status.replace(/_/g, ' '),
                detail:
                  m.detail ||
                  `${formatDateBR(m.settleDate)} · esperado ${formatBRL(m.expectedNet)} · banco ${formatBRL(m.bankCredit)}`,
                ok: m.status === 'ok',
              }))}
            />
          )}
        </div>
      )}

      {topTab === 'taxas' && (
        <TaxasFeeMatrix
          hotelId={hotelId}
          hotelName={hotelName}
          onActiveFeesChange={(next) => {
            setFees(next);
          }}
        />
      )}

      {pasteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <p className="font-semibold text-[14px]">Colar texto · {pasteOpen}</p>
              <button type="button" onClick={() => setPasteOpen(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className="w-full min-h-[200px] rounded-lg border px-3 py-2 text-[12px] font-mono"
                placeholder="Cole o relatório aqui…"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPasteOpen(null)} className="h-9 px-4 rounded-lg border text-[13px]">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={applyPaste}
                  className="h-9 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-semibold"
                >
                  Processar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalRecord && <AuditDetailModal record={modalRecord} onClose={() => setModalRecord(null)} />}
    </div>
  );
}
