/**
 * Auditoria Life — checklist → Pendências (hotel) → analista → fechamento
 * + Histórico · PMS×Adquirente · Adquirente×Banco · Taxas
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, ArrowLeft, Building2, CheckCircle2, ClipboardCheck, Eye, FileText,
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
  AUDIT_HOTELS, LS_HOTEL, auditStorageKey, defaultFeesForHotel, feesStorageKey, type HotelId,
} from '@/lib/auditoria-hotels';
import {
  type AuditWorkflowStatus, type ItemAnswer,
  newRecordId, recordsForHotel, statusLabel, upsertRecord, getRecord, type AuditRecord,
  emptyItem, deriveStatus, listPendingItems, canCloseAudit, countOpenPendencies,
} from '@/lib/auditoria-workflow';

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

function loadHotel(): HotelId | null {
  try {
    const v = localStorage.getItem(LS_HOTEL);
    if (v === 'santa-eliza' || v === 'varshana') return v;
  } catch {}
  return null;
}

export function AuditoriaLifeModule() {
  const [hotelId, setHotelId] = useState<HotelId | null>(() => loadHotel());
  if (!hotelId) {
    return (
      <HotelPicker
        onSelect={(id) => {
          localStorage.setItem(LS_HOTEL, id);
          setHotelId(id);
        }}
      />
    );
  }
  const hotel = AUDIT_HOTELS.find((h) => h.id === hotelId)!;
  return (
    <AuditoriaHotelWorkspace
      hotelId={hotelId}
      hotelName={hotel.name}
      onChangeHotel={() => {
        localStorage.removeItem(LS_HOTEL);
        setHotelId(null);
      }}
    />
  );
}

function HotelPicker({ onSelect }: { onSelect: (id: HotelId) => void }) {
  return (
    <div className="max-w-3xl mx-auto space-y-6 pt-4">
      <div className="text-center space-y-1">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white mb-2">
          <ClipboardCheck className="w-6 h-6" />
        </div>
        <h2 className="text-[20px] font-semibold text-slate-900">Auditoria Life</h2>
        <p className="text-[13px] text-slate-500">Selecione o hotel</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {AUDIT_HOTELS.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => onSelect(h.id)}
            className="text-left rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-400 hover:shadow-md transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-slate-900">{h.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{h.city}</p>
                <p className="text-[12px] text-slate-500 mt-2">{h.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function AuditoriaHotelWorkspace({
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
  const openPendCount = countOpenPendencies(answers);
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
    try {
      localStorage.removeItem(storageKey);
    } catch {}
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
        const rows = parseHitsText(text);
        setHits(rows);
        toast.success(`PMS: ${rows.length} pagamento(s)`);
      } else if (kind === 'getnet') {
        const rows = parseGetnetText(text);
        setGetnet(rows);
        toast.success(`Adquirente: ${rows.length} venda(s)`);
      } else {
        const rows = parseSantanderText(text);
        setBank(rows);
        toast.success(`Extrato: ${rows.length} linha(s)`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao ler arquivo');
    } finally {
      setBusy(false);
    }
  }, []);

  const applyPaste = () => {
    if (!pasteOpen || !pasteText.trim()) return;
    if (pasteOpen === 'hits') {
      setHits(parseHitsText(pasteText));
      toast.success('PMS processado');
    } else if (pasteOpen === 'getnet') {
      setGetnet(parseGetnetText(pasteText));
      toast.success('Adquirente processado');
    } else {
      setBank(parseSantanderText(pasteText));
      toast.success('Extrato processado');
    }
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
      {modalRecord && (
        <AuditDetailModal record={modalRecord} onClose={() => setModalRecord(null)} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onChangeHotel}
          className="text-[11px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
        >
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
              tab === id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800',
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
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 mb-3">
                <ClipboardCheck className="w-6 h-6" />
              </div>
              <p className="text-[15px] font-semibold text-slate-900">Checklist do dia</p>
              <p className="text-[13px] text-slate-500 mt-1 max-w-sm mx-auto">
                Inicie uma nova auditoria. Itens em <strong>Divergência</strong> vão para Pendências
                (hotel resolve → analista aprova).
              </p>
              <button
                type="button"
                onClick={startNewAudit}
                className="mt-5 h-10 px-5 rounded-lg bg-slate-900 text-white text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-slate-800"
              >
                <Plus className="w-4 h-4" /> Nova auditoria
              </button>
            </div>
          ) : (
            <>
              {recordStatus === 'fechada' && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] text-emerald-950">
                  Fechada · somente leitura
                </div>
              )}
              {recordStatus === 'pendente' && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[13px] text-rose-950">
                  Pendente · {openPendCount} item(ns) com o hotel · aba Pendências
                </div>
              )}
              {recordStatus === 'aguardando_analista' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-950">
                  Hotel resolveu · aprove ou recuse na aba Pendências
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
                  <label className="space-y-0.5">
                    <span className="text-[10px] uppercase text-slate-400 font-semibold">
                      Data da auditoria
                    </span>
                    <input
                      type="date"
                      className={isLocked ? inputLocked : inputCls}
                      value={header.date}
                      disabled={isLocked}
                      onChange={(e) => setHeader({ ...header, date: e.target.value })}
                    />
                  </label>
                  <label className="space-y-0.5">
                    <span className="text-[10px] uppercase text-slate-400 font-semibold">
                      Analista financeira
                    </span>
                    <input
                      className={isLocked ? inputLocked : inputCls}
                      value={header.analyst}
                      disabled={isLocked}
                      onChange={(e) => setHeader({ ...header, analyst: e.target.value })}
                      placeholder="Nome"
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                {CHECKLIST.filter((c) => !c.fridayOnly || friday).map((item) => {
                  const a = answers[item.id] || emptyItem();
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-slate-900">
                            {item.id}. {item.title}
                          </p>
                          <ul className="mt-1 text-[12px] text-slate-500 list-disc pl-4 space-y-0.5">
                            {item.bullets.map((b) => (
                              <li key={b}>{b}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => setAnswer(item.id, { status: 'conforme' })}
                            className={cn(
                              'h-8 px-3 rounded-md text-[11px] font-bold uppercase border disabled:cursor-not-allowed',
                              a.status === 'conforme'
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-500',
                            )}
                          >
                            Conforme
                          </button>
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => setAnswer(item.id, { status: 'divergencia' })}
                            className={cn(
                              'h-8 px-3 rounded-md text-[11px] font-bold uppercase border disabled:cursor-not-allowed',
                              a.status === 'divergencia'
                                ? 'bg-rose-600 text-white border-rose-600'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-rose-500',
                            )}
                          >
                            Divergência
                          </button>
                        </div>
                      </div>
                      <textarea
                        className={cn(
                          'w-full min-h-[56px] rounded-lg border px-2.5 py-2 text-[13px]',
                          isLocked
                            ? 'bg-slate-50 border-slate-100 cursor-not-allowed'
                            : 'border-slate-200',
                        )}
                        value={a.notes}
                        disabled={isLocked}
                        onChange={(e) => setAnswer(item.id, { notes: e.target.value })}
                        placeholder={isLocked ? '' : 'Observações / resolutiva…'}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        {!isLocked && (
                          <label className="h-8 px-2.5 rounded-lg border border-slate-200 text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer hover:bg-slate-50">
                            <Upload className="w-3.5 h-3.5" /> Anexar PDF/print
                            <input
                              type="file"
                              accept="application/pdf,image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                readAttachment(f, (name, dataUrl) =>
                                  setAnswer(item.id, {
                                    attachmentName: name,
                                    attachmentDataUrl: dataUrl,
                                  }),
                                );
                              }}
                            />
                          </label>
                        )}
                        {a.attachmentName && (
                          <a
                            href={a.attachmentDataUrl}
                            download={a.attachmentName}
                            className="text-[11px] text-blue-700 font-medium truncate max-w-[220px]"
                          >
                            {a.attachmentName}
                          </a>
                        )}
                        {a.status === 'divergencia' && (
                          <span className="text-[10px] font-semibold uppercase text-rose-700">
                            Pendência: {a.pendingState}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    persistMemory();
                    toast.success('Progresso guardado');
                  }}
                  disabled={isLocked}
                  className="h-10 px-4 rounded-lg border border-slate-200 text-[13px] font-medium disabled:opacity-50"
                >
                  Salvar progresso
                </button>
                <button
                  type="button"
                  onClick={closeAudit}
                  disabled={!canClose}
                  className="h-10 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-semibold disabled:opacity-40"
                >
                  Fechar auditoria
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'historico' && (
        <div className="space-y-2">
          {history.length === 0 ? (
            <div className="rounded-2xl border border-dashed px-4 py-12 text-center text-[13px] text-slate-400">
              Nenhuma auditoria neste hotel
            </div>
          ) : (
            history.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-2 shadow-sm"
              >
                <div>
                  <p className="text-[13px] font-semibold text-slate-900">
                    {formatDateBR(r.header.date)} · {r.header.analyst || '—'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {statusLabel(r.status)}
                    {r.closedAt && ` · fechada ${formatDateTimeBR(r.closedAt)}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalRecord(r)}
                  className="h-8 px-2.5 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" /> Abrir
                </button>
              </div>
            ))
          )}
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
          rightLabel="Adquirente"
          leftCount={hits.length}
          rightCount={getnet.length}
          onUploadLeft={(f) => loadFile('hits', f)}
          onUploadRight={(f) => loadFile('getnet', f)}
          onPasteLeft={() => setPasteOpen('hits')}
          onPasteRight={() => setPasteOpen('getnet')}
          rows={hitsGetnetMatches.map((m) => ({
            id: m.id,
            label:
              m.side === 'both'
                ? 'OK'
                : m.side === 'value_diff'
                  ? 'Diferença'
                  : m.side === 'hits_only'
                    ? 'Só PMS'
                    : 'Só adquirente',
            detail: m.hits
              ? `${m.hits.guest} · ${formatBRL(m.hits.net)}`
              : m.getnet
                ? `${m.getnet.brand} · ${formatBRL(m.getnet.net)}`
                : '—',
            ok: m.side === 'both',
          }))}
        />
      )}

      {tab === 'getnet_bank' && (
        <ConciliationPanel
          title="Adquirente × Banco"
          leftLabel="Adquirente"
          rightLabel="Extrato"
          leftCount={getnet.length}
          rightCount={bank.length}
          onUploadLeft={(f) => loadFile('getnet', f)}
          onUploadRight={(f) => loadFile('bank', f)}
          onPasteLeft={() => setPasteOpen('getnet')}
          onPasteRight={() => setPasteOpen('bank')}
          rows={bankMatches.map((m) => ({
            id: m.id,
            label: m.status,
            detail: `${formatDateBR(m.settleDate)} · esperado ${formatBRL(m.expectedNet)} · banco ${formatBRL(m.bankCredit)}`,
            ok: m.status === 'ok',
          }))}
        />
      )}

      {tab === 'taxas' && (
        <TaxasFeeMatrix hotelId={hotelId} hotelName={hotelName} onActiveFeesChange={setFees} />
      )}

      {pasteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl border overflow-hidden">
            <div className="px-5 py-3 border-b bg-slate-50 flex justify-between">
              <p className="font-semibold text-[14px]">Colar texto — {pasteOpen}</p>
              <button type="button" onClick={() => setPasteOpen(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <textarea
                className="w-full min-h-[200px] rounded-lg border p-3 text-[12px] font-mono"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
            </div>
            <div className="px-5 py-3 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPasteOpen(null)}
                className="h-9 px-4 rounded-lg border text-[12px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={applyPaste}
                className="h-9 px-4 rounded-lg bg-slate-900 text-white text-[12px] font-semibold"
              >
                Processar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConciliationPanel({
  title,
  leftLabel,
  rightLabel,
  leftCount,
  rightCount,
  onUploadLeft,
  onUploadRight,
  onPasteLeft,
  onPasteRight,
  rows,
}: {
  title: string;
  leftLabel: string;
  rightLabel: string;
  leftCount: number;
  rightCount: number;
  onUploadLeft: (f: File) => void;
  onUploadRight: (f: File) => void;
  onPasteLeft: () => void;
  onPasteRight: () => void;
  rows: { id: string; label: string; detail: string; ok: boolean }[];
}) {
  return (
    <div className="space-y-3">
      <p className="text-[14px] font-semibold text-slate-900">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(
          [
            [leftLabel, leftCount, onUploadLeft, onPasteLeft],
            [rightLabel, rightCount, onUploadRight, onPasteRight],
          ] as const
        ).map(([label, count, up, paste]) => (
          <div key={label} className="rounded-xl border bg-white p-4 space-y-2">
            <p className="text-[12px] font-semibold text-slate-700">
              {label} · {count} linha(s)
            </p>
            <div className="flex flex-wrap gap-2">
              <label className="h-8 px-3 rounded-lg border text-[11px] font-medium cursor-pointer inline-flex items-center gap-1 hover:bg-slate-50">
                <Upload className="w-3.5 h-3.5" /> Arquivo
                <input
                  type="file"
                  accept=".txt,.csv,text/plain"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && up(e.target.files[0])}
                />
              </label>
              <button
                type="button"
                onClick={paste}
                className="h-8 px-3 rounded-lg border text-[11px] font-medium hover:bg-slate-50"
              >
                Colar texto
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-white divide-y max-h-[420px] overflow-y-auto">
        {rows.length === 0 ? (
          <p className="p-6 text-center text-[13px] text-slate-400">Sem conciliação ainda</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="px-4 py-2.5 flex justify-between gap-2 text-[12px]">
              <span className="text-slate-700 truncate">{r.detail}</span>
              <span
                className={cn(
                  'shrink-0 font-semibold uppercase text-[10px]',
                  r.ok ? 'text-emerald-700' : 'text-rose-700',
                )}
              >
                {r.label}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PendenciasPanel({
  items,
  onHotelResolve,
  onApprove,
  onReject,
}: {
  items: {
    auditId: string;
    hotelName: string;
    auditDate: string;
    analyst: string;
    itemId: number;
    itemTitle: string;
    answer: ItemAnswer;
  }[];
  onHotelResolve: (
    auditId: string,
    itemId: number,
    resolution: string,
    attName?: string,
    attData?: string,
  ) => void;
  onApprove: (auditId: string, itemId: number) => void;
  onReject: (auditId: string, itemId: number, reason: string) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rejectDrafts, setRejectDrafts] = useState<Record<string, string>>({});
  const key = (a: string, i: number) => `${a}-${i}`;

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-14 text-center text-[13px] text-slate-400">
        Nenhuma pendência no momento
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-slate-500">
        Itens em divergência · hotel resolve · analista aprova ou devolve
      </p>
      {items.map((p) => {
        const k = key(p.auditId, p.itemId);
        const a = p.answer;
        return (
          <div
            key={k}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-slate-900">
                  {p.itemId}. {p.itemTitle}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {p.hotelName} · auditoria {formatDateBR(p.auditDate)} · analista{' '}
                  {p.analyst || '—'}
                  {a.pendingAt && <> · enviada {formatDateTimeBR(a.pendingAt)}</>}
                </p>
              </div>
              <span
                className={cn(
                  'text-[10px] font-bold uppercase px-2 py-0.5 rounded',
                  a.pendingState === 'open' && 'bg-rose-100 text-rose-800',
                  a.pendingState === 'resolved' && 'bg-amber-100 text-amber-900',
                )}
              >
                {a.pendingState === 'open' ? 'Aguardando hotel' : 'Aguardando analista'}
              </span>
            </div>
            {a.notes && (
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-[12px] text-slate-700">
                <span className="font-semibold text-slate-500">Divergência: </span>
                {a.notes}
              </div>
            )}
            {a.attachmentDataUrl && (
              <a
                href={a.attachmentDataUrl}
                download={a.attachmentName || 'anexo'}
                className="text-[12px] text-blue-700 font-medium inline-flex items-center gap-1"
              >
                <FileText className="w-3.5 h-3.5" /> {a.attachmentName || 'Anexo da analista'}
              </a>
            )}
            {a.analystRejectNote && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950">
                <strong>Recusa da analista:</strong> {a.analystRejectNote}
              </div>
            )}
            {a.pendingState === 'open' && (
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <p className="text-[11px] font-semibold uppercase text-slate-400">
                  Resolução do hotel
                </p>
                <textarea
                  className="w-full min-h-[72px] rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                  placeholder="Descreva como a pendência foi resolvida…"
                  value={drafts[k] || ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [k]: e.target.value }))}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="h-8 px-3 rounded-lg border border-slate-200 text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer hover:bg-slate-50">
                    <Upload className="w-3.5 h-3.5" /> Anexo (opcional)
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (f.size > 2_500_000) {
                          toast.error('Arquivo muito grande');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => {
                          onHotelResolve(
                            p.auditId,
                            p.itemId,
                            drafts[k] || '',
                            f.name,
                            String(reader.result || ''),
                          );
                          setDrafts((d) => ({ ...d, [k]: '' }));
                        };
                        reader.readAsDataURL(f);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      onHotelResolve(p.auditId, p.itemId, drafts[k] || '');
                      setDrafts((d) => ({ ...d, [k]: '' }));
                    }}
                    className="h-8 px-3 rounded-lg bg-slate-900 text-white text-[11px] font-semibold"
                  >
                    Enviar resolução
                  </button>
                </div>
              </div>
            )}
            {a.pendingState === 'resolved' && (
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-[12px] text-emerald-950">
                  <strong>Resolução hotel</strong>
                  {a.hotelResolvedAt && (
                    <span className="text-emerald-700"> · {formatDateTimeBR(a.hotelResolvedAt)}</span>
                  )}
                  <p className="mt-1">{a.hotelResolution}</p>
                  {a.hotelAttachmentDataUrl && (
                    <a
                      href={a.hotelAttachmentDataUrl}
                      download={a.hotelAttachmentName || 'anexo'}
                      className="text-blue-700 font-medium inline-flex items-center gap-1 mt-1"
                    >
                      <FileText className="w-3.5 h-3.5" /> {a.hotelAttachmentName || 'Anexo'}
                    </a>
                  )}
                </div>
                <textarea
                  className="w-full min-h-[56px] rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                  placeholder="Justificativa se for recusar…"
                  value={rejectDrafts[k] || ''}
                  onChange={(e) => setRejectDrafts((d) => ({ ...d, [k]: e.target.value }))}
                />
                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => onReject(p.auditId, p.itemId, rejectDrafts[k] || '')}
                    className="h-8 px-3 rounded-lg border border-amber-400 text-amber-900 text-[11px] font-semibold"
                  >
                    Recusar e devolver
                  </button>
                  <button
                    type="button"
                    onClick={() => onApprove(p.auditId, p.itemId)}
                    className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold"
                  >
                    Aprovar resolução
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AuditDetailModal({ record, onClose }: { record: AuditRecord; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-xl border flex flex-col">
        <div className="px-5 py-3 border-b bg-slate-50 flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-[15px]">{record.hotelName}</p>
            <p className="text-[12px] text-slate-500">
              {formatDateBR(record.header.date)} · {record.header.analyst || 'Analista'} ·{' '}
              {statusLabel(record.status)}
            </p>
          </div>
          <button type="button" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {CHECKLIST.map((item) => {
            const a = record.answers[item.id];
            if (!a?.status) return null;
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
                      Divergência · {a.pendingState}
                    </span>
                  )}
                </div>
                {a.notes && <p className="text-[12px] text-slate-600 mt-1">{a.notes}</p>}
                {a.hotelResolution && (
                  <p className="text-[12px] text-emerald-800 mt-1">
                    Resolução hotel: {a.hotelResolution}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
