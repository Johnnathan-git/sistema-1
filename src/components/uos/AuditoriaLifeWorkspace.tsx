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

/** Top-level: etapas group vs tools */
type TopTab = 'etapas' | 'hits_getnet' | 'getnet_bank' | 'taxas';
/** Inside Etapas Auditoria */
type EtapaTab = 'abrir' | 'historico' | 'pendencias';

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
    setHits([]);
    setGetnet([]);
    setBank([]);
    setHeader({ date: todayISO(), analyst: '', period: 'Dia completo', sentToGoAt: '' });
    setAnswers(emptyAnswers());
    setModalRecord(null);
    setFormOpen(false);
  }, [hotelId]);

  const history = useMemo(() => {
    void tick;
    return recordsForHotel(hotelId);
  }, [hotelId, tick]);

  const pendingItems = useMemo(() => {
    void tick;
    return listPendingItems({ hotelId }).map((p) => ({
      ...p,
      itemTitle: CHECKLIST.find((c) => c.id === p.itemId)?.title || `Item ${p.itemId}`,
    }));
  }, [tick, hotelId]);

  const hitsGetnetMatches = useMemo(() => reconcileHitsGetnet(hits, getnet), [hits, getnet]);
  const bankMatches = useMemo(() => reconcileGetnetBank(getnet, bank, fees), [getnet, bank, fees]);

  const friday = isFriday(header.date);
  const requiredItems = CHECKLIST.filter((c) => !c.fridayOnly || friday);
  const missingCount = requiredItems.filter((c) => !answers[c.id]?.status).length;
  const canSubmitNew = missingCount === 0 && !!header.analyst.trim();

  function startNewAudit() {
    setHeader({ date: todayISO(), analyst: '', period: 'Dia completo', sentToGoAt: '' });
    setAnswers(emptyAnswers());
    setFormOpen(true);
    setEtapa('abrir');
    setTopTab('etapas');
  }

  const setAnswer = (id: number, patch: Partial<ItemAnswer>) => {
    setAnswers((prev) => {
      const cur = { ...emptyItem(), ...prev[id], ...patch };
      if (patch.status === 'conforme') {
        cur.pendingState = 'none';
        cur.pendingAt = undefined;
        cur.hotelResolution = undefined;
        cur.hotelResolvedAt = undefined;
        cur.analystRejectNote = undefined;
      }
      if (patch.status === 'divergencia') {
        cur.pendingState = 'open';
        cur.pendingAt = cur.pendingAt || new Date().toISOString();
      }
      return { ...prev, [id]: cur };
    });
  };

  const readAttachment = (file: File, cb: (name: string, dataUrl: string) => void) => {
    if (file.size > 2_500_000) {
      toast.error('Arquivo muito grande (máx. ~2,5 MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => cb(file.name, String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const submitNewAudit = () => {
    if (!header.analyst.trim()) {
      toast.error('Informe o nome da analista');
      return;
    }
    if (missingCount > 0) {
      toast.error(`Marque todos os itens obrigatórios (${missingCount} pendente(s))`);
      return;
    }
    const now = new Date().toISOString();
    const id = newRecordId();
    const status = deriveStatus(answers, false);
    const allOk = canCloseAudit(answers, requiredItems.map((c) => c.id));
    const finalStatus: AuditWorkflowStatus = allOk ? 'fechada' : status === 'em_andamento' ? 'pendente' : status;

    upsertRecord({
      id,
      hotelId,
      hotelName,
      header,
      answers,
      status: finalStatus,
      createdAt: now,
      updatedAt: now,
      closedAt: allOk ? now : undefined,
      closedBy: allOk ? header.analyst.trim() : undefined,
    });

    setTick((x) => x + 1);
    setFormOpen(false);
    setAnswers(emptyAnswers());
    setHeader({ date: todayISO(), analyst: '', period: 'Dia completo', sentToGoAt: '' });

    if (allOk) {
      toast.success('Auditoria concluída · disponível no Histórico');
    } else {
      toast.success('Auditoria registrada como Pendente · divergências nas Pendências');
    }
    setEtapa('historico');
  };

  const hotelResolveItem = (
    auditId: string,
    itemId: number,
    resolution: string,
    attName?: string,
    attData?: string,
  ) => {
    const r = getRecord(auditId);
    if (!r || r.status === 'fechada') return;
    if (!resolution.trim()) {
      toast.error('Descreva a resolução');
      return;
    }
    const ans = { ...emptyItem(), ...r.answers[itemId] };
    ans.pendingState = 'resolved';
    ans.hotelResolution = resolution.trim();
    ans.hotelResolvedAt = new Date().toISOString();
    if (attName) {
      ans.hotelAttachmentName = attName;
      ans.hotelAttachmentDataUrl = attData;
    }
    const nextAnswers = { ...r.answers, [itemId]: ans };
    const st = deriveStatus(nextAnswers, false);
    upsertRecord({ ...r, answers: nextAnswers, status: st, updatedAt: new Date().toISOString() });
    setTick((x) => x + 1);
    toast.success('Resolução enviada · analista pode aprovar no Histórico');
  };

  const analystApproveCorrections = (auditId: string) => {
    const r = getRecord(auditId);
    if (!r || r.status === 'fechada') return;
    const nextAnswers = { ...r.answers };
    let changed = false;
    for (const [idStr, ans] of Object.entries(nextAnswers)) {
      if (ans.pendingState === 'resolved') {
        nextAnswers[Number(idStr)] = {
          ...emptyItem(),
          ...ans,
          pendingState: 'approved',
          analystRejectNote: undefined,
        };
        changed = true;
      }
    }
    if (!changed) {
      toast.message('Nenhuma correção aguardando aprovação');
      return;
    }
    const requiredIds = CHECKLIST.filter((c) => !c.fridayOnly || isFriday(r.header.date)).map((c) => c.id);
    const canClose = canCloseAudit(nextAnswers, requiredIds);
    const now = new Date().toISOString();
    if (canClose) {
      upsertRecord({
        ...r,
        answers: nextAnswers,
        status: 'fechada',
        updatedAt: now,
        closedAt: now,
        closedBy: r.header.analyst || 'Analista',
      });
      setTick((x) => x + 1);
      toast.success('Correções aprovadas · auditoria Concluída');
    } else {
      const st = deriveStatus(nextAnswers, false);
      upsertRecord({ ...r, answers: nextAnswers, status: st, updatedAt: now });
      setTick((x) => x + 1);
      toast.success('Correções aprovadas · ainda há pendências abertas');
    }
  };

  const analystRejectItem = (auditId: string, itemId: number, reason: string) => {
    const r = getRecord(auditId);
    if (!r || r.status === 'fechada') return;
    if (!reason.trim()) {
      toast.error('Informe a justificativa da recusa');
      return;
    }
    const ans = { ...emptyItem(), ...r.answers[itemId] };
    ans.pendingState = 'open';
    ans.analystRejectNote = reason.trim();
    ans.hotelResolution = undefined;
    ans.hotelResolvedAt = undefined;
    ans.pendingAt = new Date().toISOString();
    const nextAnswers = { ...r.answers, [itemId]: ans };
    const st = deriveStatus(nextAnswers, false);
    upsertRecord({ ...r, answers: nextAnswers, status: st, updatedAt: new Date().toISOString() });
    setTick((x) => x + 1);
    toast.message('Item devolvido às Pendências');
  };

  const loadFile = useCallback(async (kind: 'hits' | 'getnet' | 'bank', file: File) => {
    setBusy(true);
    try {
      const text = await fileToText(file);
      if (kind === 'hits') {
        setHits(parseHitsText(text));
        toast.success('PMS processado');
      } else if (kind === 'getnet') {
        setGetnet(parseGetnetText(text));
        toast.success('Adquirente processado');
      } else {
        setBank(parseSantanderText(text));
        toast.success('Extrato processado');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao ler arquivo');
    } finally {
      setBusy(false);
    }
  }, []);

  const applyPaste = () => {
    if (!pasteOpen || !pasteText.trim()) return;
    if (pasteOpen === 'hits') setHits(parseHitsText(pasteText));
    else if (pasteOpen === 'getnet') setGetnet(parseGetnetText(pasteText));
    else setBank(parseSantanderText(pasteText));
    toast.success('Texto processado');
    setPasteOpen(null);
    setPasteText('');
  };

  const inputCls =
    'w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400';

  const pendingBadge = pendingItems.length;
  const waitingApproveCount = history.filter((r) => r.status === 'aguardando_analista').length;

  return (
    <div className="space-y-4 pb-10">
      {modalRecord && <AuditDetailModal record={modalRecord} onClose={() => setModalRecord(null)} />}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onChangeHotel} className="text-[11px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Trocar hotel · {hotelName}
        </button>
        {busy && (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-blue-700">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processando…
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200">
        {(
          [
            { id: 'etapas' as const, label: 'Etapas Auditoria', icon: Layers },
            { id: 'hits_getnet' as const, label: 'PMS × Adquirente', icon: Link2 },
            { id: 'getnet_bank' as const, label: 'Adquirente × Banco', icon: Scale },
            { id: 'taxas' as const, label: 'Taxas', icon: Settings2 },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTopTab(id)}
            className={cn(
              'px-3 py-2.5 text-[13px] font-medium border-b-2 -mb-px inline-flex items-center gap-1.5',
              topTab === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {id === 'etapas' && pendingBadge > 0 && (
              <span className="ml-0.5 text-[10px] font-bold bg-rose-600 text-white rounded-full min-w-[16px] h-4 px-1 inline-flex items-center justify-center">
                {pendingBadge}
              </span>
            )}
          </button>
        ))}
      </div>

      {topTab === 'etapas' && (
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'abrir' as const, label: 'Abrir Auditoria', icon: ClipboardCheck },
              { id: 'historico' as const, label: 'Histórico', icon: History },
              { id: 'pendencias' as const, label: 'Pendências', icon: AlertTriangle },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setEtapa(id)}
              className={cn(
                'h-9 px-3.5 rounded-xl text-[12px] font-semibold inline-flex items-center gap-1.5 border transition-colors',
                etapa === id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {id === 'pendencias' && pendingBadge > 0 && (
                <span className="text-[10px] font-bold bg-rose-600 text-white rounded-full min-w-[16px] h-4 px-1 inline-flex items-center justify-center">
                  {pendingBadge}
                </span>
              )}
              {id === 'historico' && waitingApproveCount > 0 && (
                <span className="text-[10px] font-bold bg-amber-500 text-white rounded-full min-w-[16px] h-4 px-1 inline-flex items-center justify-center">
                  {waitingApproveCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {topTab === 'etapas' && etapa === 'abrir' && (
        <div className="space-y-3">
          {!formOpen ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
              <ClipboardCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-[15px] font-semibold text-slate-800">Abrir nova auditoria</p>
              <p className="text-[13px] text-slate-500 mt-1 mb-4 max-w-md mx-auto">
                Preencha o checklist. Divergências vão para Pendências e a auditoria entra no Histórico como Pendente. Tudo conforme → Concluída.
              </p>
              <button type="button" onClick={startNewAudit} className="h-10 px-5 rounded-xl bg-slate-900 text-white text-[13px] font-semibold inline-flex items-center gap-2 hover:bg-slate-800">
                <Plus className="w-4 h-4" /> Nova auditoria
              </button>
            </div>
          ) : (
            <>
              <div className="rounded-xl border bg-white p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase text-slate-400">Data</span>
                  <input type="date" value={header.date} onChange={(e) => setHeader((h) => ({ ...h, date: e.target.value }))} className={inputCls} />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase text-slate-400">Analista</span>
                  <input value={header.analyst} onChange={(e) => setHeader((h) => ({ ...h, analyst: e.target.value }))} placeholder="Nome da analista" className={inputCls} />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase text-slate-400">Período</span>
                  <input value={header.period} onChange={(e) => setHeader((h) => ({ ...h, period: e.target.value }))} className={inputCls} />
                </label>
              </div>
              {requiredItems.map((item) => {
                const a = answers[item.id] || emptyItem();
                return (
                  <div key={item.id} className="rounded-xl border bg-white p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[13px] font-semibold text-slate-900">{item.id}. {item.title}</p>
                        {item.bullets?.[0] && <p className="text-[11px] text-slate-400 mt-0.5">{item.bullets[0]}</p>}
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button type="button" onClick={() => setAnswer(item.id, { status: 'conforme' })} className={cn('h-8 px-2.5 rounded-lg text-[11px] font-bold border', a.status === 'conforme' ? 'bg-emerald-600 text-white border-emerald-600' : 'hover:bg-slate-50')}>Conforme</button>
                        <button type="button" onClick={() => setAnswer(item.id, { status: 'divergencia' })} className={cn('h-8 px-2.5 rounded-lg text-[11px] font-bold border', a.status === 'divergencia' ? 'bg-rose-600 text-white border-rose-600' : 'hover:bg-slate-50')}>Divergência</button>
                      </div>
                    </div>
                    {(a.status === 'divergencia' || a.notes) && (
                      <textarea value={a.notes || ''} onChange={(e) => setAnswer(item.id, { notes: e.target.value })} placeholder="Descreva a divergência…" className="w-full min-h-[64px] rounded-lg border border-slate-200 px-3 py-2 text-[13px]" />
                    )}
                    {a.status === 'divergencia' && (
                      <label className="text-[12px] text-blue-700 font-medium inline-flex items-center gap-1 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" /> Anexar (PDF/imagem)
                        <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) readAttachment(f, (name, dataUrl) => setAnswer(item.id, { attachmentName: name, attachmentDataUrl: dataUrl }));
                        }} />
                      </label>
                    )}
                    {a.attachmentName && <p className="text-[11px] text-slate-500">Anexo: {a.attachmentName}</p>}
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-2 justify-end pt-2">
                <button type="button" onClick={() => { setFormOpen(false); setAnswers(emptyAnswers()); }} className="h-10 px-4 rounded-xl border text-[13px] font-medium hover:bg-slate-50">Cancelar</button>
                <button type="button" disabled={!canSubmitNew} onClick={submitNewAudit} className="h-10 px-5 rounded-xl bg-slate-900 text-white text-[13px] font-semibold disabled:opacity-40 hover:bg-slate-800">Registrar auditoria</button>
              </div>
            </>
          )}
        </div>
      )}

      {topTab === 'etapas' && etapa === 'historico' && (
        <div className="space-y-3">
          {history.length === 0 && (
            <div className="rounded-2xl border border-dashed bg-white px-6 py-14 text-center text-[13px] text-slate-400">Nenhuma auditoria registrada ainda</div>
          )}
          {history.map((r) => {
            const openN = countOpenPendencies(r.answers);
            const resolvedN = Object.values(r.answers).filter((a) => a.pendingState === 'resolved').length;
            const needsApprove = r.status === 'aguardando_analista' || resolvedN > 0;
            return (
              <div key={r.id} className="rounded-xl border bg-white p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[14px] font-semibold text-slate-900">{formatDateBR(r.header.date)} · {r.header.period}</p>
                    <p className="text-[12px] text-slate-500">Analista: {r.header.analyst || '—'} · atualizado {formatDateTimeBR(r.updatedAt)}</p>
                  </div>
                  <span className={cn(
                    'text-[10px] font-bold uppercase px-2 py-0.5 rounded',
                    r.status === 'fechada' && 'bg-emerald-100 text-emerald-800',
                    r.status === 'pendente' && 'bg-rose-100 text-rose-800',
                    r.status === 'aguardando_analista' && 'bg-amber-100 text-amber-900',
                    r.status === 'em_andamento' && 'bg-slate-100 text-slate-700',
                  )}>{statusLabel(r.status)}</span>
                </div>
                {(openN > 0 || resolvedN > 0) && r.status !== 'fechada' && (
                  <p className="text-[12px] text-slate-600">
                    {openN > 0 && <span>{openN} aguardando hotel · </span>}
                    {resolvedN > 0 && <span className="text-amber-800 font-medium">{resolvedN} correção(ões) para aprovar</span>}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setModalRecord(r)} className="h-8 px-3 rounded-lg border text-[12px] font-medium inline-flex items-center gap-1 hover:bg-slate-50">
                    <Eye className="w-3.5 h-3.5" /> Ver detalhes
                  </button>
                  {needsApprove && r.status !== 'fechada' && (
                    <button type="button" onClick={() => analystApproveCorrections(r.id)} className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold hover:bg-emerald-500 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar correções
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {topTab === 'etapas' && etapa === 'pendencias' && (
        <PendenciasPanel
          items={pendingItems}
          onHotelResolve={hotelResolveItem}
          onApprove={(auditId, itemId) => {
            const r = getRecord(auditId);
            if (!r || r.status === 'fechada') return;
            const ans = { ...emptyItem(), ...r.answers[itemId], pendingState: 'approved' as const, analystRejectNote: undefined };
            const nextAnswers = { ...r.answers, [itemId]: ans };
            const requiredIds = CHECKLIST.filter((c) => !c.fridayOnly || isFriday(r.header.date)).map((c) => c.id);
            const now = new Date().toISOString();
            if (canCloseAudit(nextAnswers, requiredIds)) {
              upsertRecord({ ...r, answers: nextAnswers, status: 'fechada', updatedAt: now, closedAt: now, closedBy: r.header.analyst || 'Analista' });
              toast.success('Item aprovado · auditoria Concluída');
            } else {
              upsertRecord({ ...r, answers: nextAnswers, status: deriveStatus(nextAnswers, false), updatedAt: now });
              toast.success('Item aprovado');
            }
            setTick((x) => x + 1);
          }}
          onReject={analystRejectItem}
        />
      )}

      {topTab === 'hits_getnet' && (
        <ConciliationPanel
          title="PMS × Adquirente"
          leftLabel="PMS (HITS)"
          rightLabel="Adquirente (Getnet)"
          leftCount={hits.length}
          rightCount={getnet.length}
          onUploadLeft={(f) => loadFile('hits', f)}
          onUploadRight={(f) => loadFile('getnet', f)}
          onPasteLeft={() => setPasteOpen('hits')}
          onPasteRight={() => setPasteOpen('getnet')}
          rows={hitsGetnetMatches.map((m) => {
            const label = m.side === 'both' ? 'Conciliado' : m.side === 'value_diff' ? 'Diferença de valor' : m.side === 'hits_only' ? 'Só no PMS' : 'Só na adquirente';
            const detail = [m.hits ? `PMS ${formatBRL(m.hits.net)}` : null, m.getnet ? `Getnet ${formatBRL(m.getnet.net)}` : null, m.delta != null && Math.abs(m.delta) > 0.01 ? `Δ ${formatBRL(m.delta)}` : null].filter(Boolean).join(' · ');
            return { id: m.id, label, detail, ok: m.side === 'both' };
          })}
        />
      )}

      {topTab === 'getnet_bank' && (
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
            detail: m.detail || `${formatDateBR(m.settleDate)} · esperado ${formatBRL(m.expectedNet)} · banco ${formatBRL(m.bankCredit)}`,
            ok: m.status === 'ok',
          }))}
        />
      )}

      {topTab === 'taxas' && (
        <TaxasFeeMatrix
          fees={fees}
          onChange={(next) => {
            setFees(next);
            try { localStorage.setItem(feesStorageKey(hotelId), JSON.stringify(next)); } catch {}
          }}
        />
      )}

      {pasteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <p className="font-semibold text-[14px]">Colar texto · {pasteOpen}</p>
              <button type="button" onClick={() => setPasteOpen(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} className="w-full min-h-[200px] rounded-lg border px-3 py-2 text-[12px] font-mono" placeholder="Cole o relatório aqui…" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPasteOpen(null)} className="h-9 px-4 rounded-lg border text-[13px]">Cancelar</button>
                <button type="button" onClick={applyPaste} className="h-9 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-semibold">Processar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
