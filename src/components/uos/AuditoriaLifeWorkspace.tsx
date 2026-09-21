import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ClipboardCheck, Eye, FileText,
  History, Link2, Loader2, Plus, Scale, Settings2, Upload, X,
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

type TabId = 'checklist' | 'historico' | 'pendencias' | 'hits_getnet' | 'getnet_bank' | 'taxas';

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
  } catch { return iso; }
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
  const [tab, setTab] = useState<TabId>('checklist');
  const storageKey = auditStorageKey(hotelId);
  const [header, setHeader] = useState({ date: todayISO(), analyst: '', period: 'Dia completo', sentToGoAt: '' });
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
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);
  const [recordStatus, setRecordStatus] = useState<AuditWorkflowStatus>('em_andamento');
  const [tick, setTick] = useState(0);
  const [modalRecord, setModalRecord] = useState<AuditRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const isLocked = recordStatus === 'fechada';

  useEffect(() => {
    setTab('checklist');
    setHits([]); setGetnet([]); setBank([]);
    setHeader({ date: todayISO(), analyst: '', period: 'Dia completo', sentToGoAt: '' });
    setAnswers(emptyAnswers());
    setCurrentRecordId(null);
    setRecordStatus('em_andamento');
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
  const canClose =
    !isLocked &&
    missingCount === 0 &&
    !!header.analyst.trim() &&
    canCloseAudit(answers, requiredItems.map((c) => c.id));

  function startNewAudit() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const data = JSON.parse(raw);
        if (data?.header && data?.answers) {
          setHeader({
            date: data.header.date || todayISO(),
            analyst: data.header.analyst || '',
            period: data.header.period || 'Dia completo',
            sentToGoAt: '',
          });
          const merged = emptyAnswers();
          for (const [k, v] of Object.entries(data.answers as Record<string, ItemAnswer>)) {
            merged[Number(k)] = { ...emptyItem(), ...v };
          }
          setAnswers(merged);
          setCurrentRecordId(data.recordId || null);
          setRecordStatus((data.status as AuditWorkflowStatus) || 'em_andamento');
          setFormOpen(true);
          setTab('checklist');
          return;
        }
      }
    } catch {}
    setHeader({ date: todayISO(), analyst: '', period: 'Dia completo', sentToGoAt: '' });
    setAnswers(emptyAnswers());
    setCurrentRecordId(null);
    setRecordStatus('em_andamento');
    setFormOpen(true);
    setTab('checklist');
  }

  const persistMemory = useCallback(() => {
    if (isLocked || !formOpen) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          header,
          answers,
          recordId: currentRecordId,
          status: recordStatus,
          updatedAt: new Date().toISOString(),
        }),
      );
    } catch {}
  }, [isLocked, formOpen, header, answers, currentRecordId, recordStatus, storageKey]);

  useEffect(() => {
    if (!formOpen || isLocked) return;
    const t = window.setTimeout(() => persistMemory(), 400);
    return () => window.clearTimeout(t);
  }, [header, answers, formOpen, isLocked, persistMemory]);

  const setAnswer = (id: number, patch: Partial<ItemAnswer>) => {
    if (isLocked) return;
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
      const next = { ...prev, [id]: cur };
      if (patch.status === 'divergencia' || patch.status === 'conforme') {
        const now = new Date().toISOString();
        const rid = currentRecordId || newRecordId();
        const prevRec = getRecord(rid);
        const status = deriveStatus(next, false);
        upsertRecord({
          id: rid,
          hotelId,
          hotelName,
          header,
          answers: next,
          status,
          createdAt: prevRec?.createdAt || now,
          updatedAt: now,
        });
        setCurrentRecordId(rid);
        setRecordStatus(status);
        setTick((x) => x + 1);
      }
      return next;
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

  const closeAudit = () => {
    if (isLocked) return;
    if (!header.analyst.trim()) {
      toast.error('Informe o nome da analista');
      return;
    }
    if (missingCount > 0) {
      toast.error(`Marque todos os itens obrigatórios (${missingCount} pendente(s))`);
      return;
    }
    if (!canCloseAudit(answers, requiredItems.map((c) => c.id))) {
      toast.error('Ainda há pendências abertas ou aguardando aprovação');
      return;
    }
    const now = new Date().toISOString();
    const id = currentRecordId || newRecordId();
    const prev = getRecord(id);
    upsertRecord({
      id,
      hotelId,
      hotelName,
      header,
      answers,
      status: 'fechada',
      createdAt: prev?.createdAt || now,
      updatedAt: now,
      closedAt: now,
      closedBy: header.analyst.trim(),
    });
    setCurrentRecordId(id);
    setRecordStatus('fechada');
    setTick((x) => x + 1);
    try { localStorage.removeItem(storageKey); } catch {}
    setFormOpen(false);
    toast.success('Auditoria fechada · disponível no Histórico');
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
    const status = deriveStatus(nextAnswers, false);
    upsertRecord({ ...r, answers: nextAnswers, status, updatedAt: new Date().toISOString() });
    if (currentRecordId === auditId) {
      setAnswers(nextAnswers);
      setRecordStatus(status);
    }
    setTick((x) => x + 1);
    toast.success('Resolução enviada à analista');
  };

  const analystApproveItem = (auditId: string, itemId: number) => {
    const r = getRecord(auditId);
    if (!r || r.status === 'fechada') return;
    const ans = { ...emptyItem(), ...r.answers[itemId] };
    ans.pendingState = 'approved';
    ans.analystRejectNote = undefined;
    const nextAnswers = { ...r.answers, [itemId]: ans };
    const status = deriveStatus(nextAnswers, false);
    upsertRecord({ ...r, answers: nextAnswers, status, updatedAt: new Date().toISOString() });
    if (currentRecordId === auditId) {
      setAnswers(nextAnswers);
      setRecordStatus(status);
    }
    setTick((x) => x + 1);
    toast.success('Item aprovado');
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
    const status = deriveStatus(nextAnswers, false);
    upsertRecord({ ...r, answers: nextAnswers, status, updatedAt: new Date().toISOString() });
    if (currentRecordId === auditId) {
      setAnswers(nextAnswers);
      setRecordStatus(status);
    }
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
  const inputLocked =
    'w-full h-9 rounded-lg border border-slate-100 bg-slate-50 px-2.5 text-[13px] text-slate-600 cursor-not-allowed';
  const pendingBadge = pendingItems.length;

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
            { id: 'checklist' as const, label: 'Checklist', icon: ClipboardCheck },
            { id: 'historico' as const, label: 'Histórico', icon: History },
            { id: 'pendencias' as const, label: 'Pendências', icon: AlertTriangle },
            { id: 'hits_getnet' as const, label: 'PMS × Adquirente', icon: Link2 },
            { id: 'getnet_bank' as const, label: 'Adquirente × Banco', icon: Scale },
            { id: 'taxas' as const, label: 'Taxas', icon: Settings2 },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'px-3 py-2.5 text-[13px] font-medium border-b-2 -mb-px inline-flex items-center gap-1.5',
              tab === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {id === 'pendencias' && pendingBadge > 0 && (
              <span className="ml-0.5 text-[10px] font-bold bg-rose-600 text-white rounded-full min-w-[16px] h-4 px-1 inline-flex items-center justify-center">
                {pendingBadge}
              </span>
            )}
          </button>
        ))}
      </div>
      {tab === 'checklist' && (
        <div className="space-y-3">
          {!formOpen ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
              <ClipboardCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-[15px] font-semibold text-slate-800">Checklist de auditoria</p>
              <p className="text-[13px] text-slate-500 mt-1 mb-4">Inicie uma nova auditoria ou continue a em andamento</p>
              <button type="button" onClick={startNewAudit} className="h-10 px-5 rounded-xl bg-slate-900 text-white text-[13px] font-semibold inline-flex items-center gap-2 hover:bg-slate-800">
                <Plus className="w-4 h-4" /> Iniciar / continuar auditoria
              </button>
            </div>
          ) : (
            <>
              <div className="rounded-xl border bg-white p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase text-slate-400">Data</span>
                  <input type="date" value={header.date} disabled={isLocked} onChange={(e) => setHeader((h) => ({ ...h, date: e.target.value }))} className={isLocked ? inputLocked : inputCls} />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase text-slate-400">Analista</span>
                  <input value={header.analyst} disabled={isLocked} onChange={(e) => setHeader((h) => ({ ...h, analyst: e.target.value }))} placeholder="Nome da analista" className={isLocked ? inputLocked : inputCls} />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase text-slate-400">Período</span>
                  <input value={header.period} disabled={isLocked} onChange={(e) => setHeader((h) => ({ ...h, period: e.target.value }))} className={isLocked ? inputLocked : inputCls} />
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
                        <button type="button" disabled={isLocked} onClick={() => setAnswer(item.id, { status: 'conforme' })} className={cn('h-8 px-2.5 rounded-lg text-[11px] font-bold border', a.status === 'conforme' ? 'bg-emerald-600 text-white border-emerald-600' : 'hover:bg-slate-50')}>Conforme</button>
                        <button type="button" disabled={isLocked} onClick={() => setAnswer(item.id, { status: 'divergencia' })} className={cn('h-8 px-2.5 rounded-lg text-[11px] font-bold border', a.status === 'divergencia' ? 'bg-rose-600 text-white border-rose-600' : 'hover:bg-slate-50')}>Divergência</button>
                      </div>
                    </div>
                    {(a.status === 'divergencia' || a.notes) && (
                      <textarea disabled={isLocked} value={a.notes || ''} onChange={(e) => setAnswer(item.id, { notes: e.target.value })} placeholder="Descreva a divergência…" className="w-full min-h-[64px] rounded-lg border border-slate-200 px-3 py-2 text-[13px]" />
                    )}
                    {a.status === 'divergencia' && !isLocked && (
                      <label className="text-[12px] text-blue-700 font-medium inline-flex items-center gap-1 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" /> Anexar PDF/imagem
                        <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) readAttachment(f, (name, dataUrl) => setAnswer(item.id, { attachmentName: name, attachmentDataUrl: dataUrl }));
                        }} />
                      </label>
                    )}
                    {a.attachmentName && (
                      <a href={a.attachmentDataUrl} download={a.attachmentName} className="text-[12px] text-blue-700 inline-flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" /> {a.attachmentName}
                      </a>
                    )}
                    {a.pendingState && a.pendingState !== 'none' && (
                      <p className="text-[11px] text-slate-500">Pendência: {a.pendingState}{a.pendingAt ? ` · ${formatDateTimeBR(a.pendingAt)}` : ''}</p>
                    )}
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-2 pt-2">
                <button type="button" disabled={!canClose} onClick={closeAudit} className="h-10 px-5 rounded-xl bg-emerald-600 text-white text-[13px] font-semibold disabled:opacity-40 hover:bg-emerald-500">
                  Fechar auditoria
                </button>
                <button type="button" onClick={() => setFormOpen(false)} className="h-10 px-4 rounded-xl border text-[13px] font-medium hover:bg-slate-50">
                  Minimizar
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {tab === 'historico' && (
        <div className="space-y-2">
          {history.length === 0 && <p className="text-[13px] text-slate-400 text-center py-12">Nenhuma auditoria ainda</p>}
          {history.map((r) => (
            <button key={r.id} type="button" onClick={() => setModalRecord(r)} className="w-full text-left rounded-xl border bg-white px-4 py-3 hover:border-slate-300 flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold">{formatDateBR(r.header.date)} · {r.header.analyst || '—'}</p>
                <p className="text-[11px] text-slate-500">{statusLabel(r.status)} · atualizado {formatDateTimeBR(r.updatedAt)}</p>
              </div>
              <Eye className="w-4 h-4 text-slate-400" />
            </button>
          ))}
        </div>
      )}
      {tab === 'pendencias' && (
        <PendenciasPanel
          items={pendingItems}
          onHotelResolve={hotelResolveItem}
          onApprove={analystApproveItem}
          onReject={analystRejectItem}
        />
      )}
      {tab === 'hits_getnet' && (
        <ConciliationPanel
          title="PMS × Adquirente"
          leftLabel="PMS (Hits)"
          rightLabel="Adquirente (Getnet)"
          leftCount={hits.length}
          rightCount={getnet.length}
          onUploadLeft={(f) => loadFile('hits', f)}
          onUploadRight={(f) => loadFile('getnet', f)}
          onPasteLeft={() => setPasteOpen('hits')}
          onPasteRight={() => setPasteOpen('getnet')}
          rows={hitsGetnetMatches.map((m) => ({
            id: m.id,
            label: m.hits ? `${m.hits.guest || m.hits.pgto} · ${formatBRL(m.hits.net)}` : m.getnet ? `${m.getnet.brand} · ${formatBRL(m.getnet.net)}` : m.id,
            detail: m.side === 'both' ? 'Conciliado' : m.side === 'value_diff' ? `Diferença ${formatBRL(m.delta || 0)}` : m.side === 'hits_only' ? 'Só no PMS' : 'Só na adquirente',
            ok: m.side === 'both',
          }))}
        />
      )}
      {tab === 'getnet_bank' && (
        <ConciliationPanel
          title="Adquirente × Banco"
          leftLabel="Adquirente"
          rightLabel="Extrato banco"
          leftCount={getnet.length}
          rightCount={bank.length}
          onUploadLeft={(f) => loadFile('getnet', f)}
          onUploadRight={(f) => loadFile('bank', f)}
          onPasteLeft={() => setPasteOpen('getnet')}
          onPasteRight={() => setPasteOpen('bank')}
          rows={bankMatches.map((m) => ({
            id: m.id,
            label: `${formatDateBR(m.settleDate)} · esperado ${formatBRL(m.expectedNet)}`,
            detail: m.detail || m.status,
            ok: m.status === 'ok',
          }))}
        />
      )}
      {tab === 'taxas' && (
        <TaxasFeeMatrix hotelId={hotelId} fees={fees} onChange={(f) => {
          setFees(f);
          try { localStorage.setItem(feesStorageKey(hotelId), JSON.stringify(f)); } catch {}
        }} />
      )}
      {pasteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border shadow-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-[15px]">Colar texto · {pasteOpen}</p>
              <button type="button" onClick={() => setPasteOpen(null)}><X className="w-4 h-4" /></button>
            </div>
            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} className="w-full min-h-[200px] rounded-lg border px-3 py-2 text-[12px] font-mono" placeholder="Cole aqui o conteúdo…" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPasteOpen(null)} className="h-9 px-4 rounded-lg border text-[13px]">Cancelar</button>
              <button type="button" onClick={applyPaste} className="h-9 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-semibold">Processar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
