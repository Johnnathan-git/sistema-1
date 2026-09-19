/**
 * Auditoria Life
 * checklistMode: hub | form | history
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, ArrowLeft, Building2, CheckCircle2, ClipboardCheck, Eye, FileText,
  History, Link2, Loader2, Plus, Scale, Settings2, Upload, X, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { TaxasFeeMatrix } from '@/components/uos/TaxasFeeMatrix';
import {
  parseHitsText, parseGetnetText, parseSantanderText, reconcileHitsGetnet, reconcileGetnetBank,
  formatBRL, formatDateBR, todayISO, isFriday, fileToText,
  type HitsPayment, type GetnetSale, type BankLine, type FeeRule, type MatchSide, type BankMatchRow, CHECKLIST,
} from '@/lib/auditoria-core';
import {
  AUDIT_HOTELS, LS_HOTEL, auditStorageKey, defaultFeesForHotel, feesStorageKey, type HotelId,
} from '@/lib/auditoria-hotels';
import {
  type AuditWorkflowStatus, type ItemStatus, newRecordId, recordsForHotel, recordsPendingApproval,
  statusLabel, upsertRecord, getRecord, type AuditRecord,
} from '@/lib/auditoria-workflow';

type TabId = 'checklist' | 'hits_getnet' | 'getnet_bank' | 'taxas' | 'aprovacao';

function formatDateTimeBR(iso?: string) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return formatDateBR(iso);
      return iso;
    }
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} às ${hh}:${mi}`;
  } catch { return iso; }
}

function emptyAnswers(): Record<number, { status: ItemStatus; notes: string }> {
  const init: Record<number, { status: ItemStatus; notes: string }> = {};
  for (const c of CHECKLIST) init[c.id] = { status: '', notes: '' };
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
      <HotelPicker onSelect={(id) => { localStorage.setItem(LS_HOTEL, id); setHotelId(id); }} />
    );
  }
  const hotel = AUDIT_HOTELS.find((h) => h.id === hotelId)!;
  return (
    <AuditoriaHotelWorkspace
      hotelId={hotelId}
      hotelName={hotel.name}
      onChangeHotel={() => { localStorage.removeItem(LS_HOTEL); setHotelId(null); }}
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
          <button key={h.id} type="button" onClick={() => onSelect(h.id)} className="text-left rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-400 hover:shadow-md transition-all group">
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

function AuditoriaHotelWorkspace({ hotelId, hotelName, onChangeHotel }: { hotelId: HotelId; hotelName: string; onChangeHotel: () => void }) {
  const [tab, setTab] = useState<TabId>('checklist');
  const storageKey = auditStorageKey(hotelId);
  const [header, setHeader] = useState({ date: todayISO(), analyst: '', period: 'Dia completo', sentToGoAt: '' });
  const [answers, setAnswers] = useState(emptyAnswers);
  const [fees, setFees] = useState<FeeRule[]>(() => {
    try { const raw = localStorage.getItem(feesStorageKey(hotelId)); if (raw) return JSON.parse(raw); } catch {}
    return defaultFeesForHotel(hotelId);
  });
  const [hits, setHits] = useState<HitsPayment[]>([]);
  const [getnet, setGetnet] = useState<GetnetSale[]>([]);
  const [bank, setBank] = useState<BankLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [pasteOpen, setPasteOpen] = useState<'hits' | 'getnet' | 'bank' | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);
  const [recordStatus, setRecordStatus] = useState<AuditWorkflowStatus>('rascunho');
  const [submittedAt, setSubmittedAt] = useState<string | undefined>();
  const [approvedAt, setApprovedAt] = useState<string | undefined>();
  const [approvedBy, setApprovedBy] = useState<string | undefined>();
  const [tick, setTick] = useState(0);
  const [checklistMode, setChecklistMode] = useState<'hub' | 'form' | 'history'>('hub');

  const isLocked = recordStatus === 'aprovado' || recordStatus === 'aguardando';
  const isViewingHistory = isLocked && currentRecordId != null;

  useEffect(() => {
    setTab('checklist');
    setChecklistMode('hub');
    setHits([]); setGetnet([]); setBank([]);
    setHeader({ date: todayISO(), analyst: '', period: 'Dia completo', sentToGoAt: '' });
    setAnswers(emptyAnswers());
    setCurrentRecordId(null);
    setRecordStatus('rascunho');
    setSubmittedAt(undefined); setApprovedAt(undefined); setApprovedBy(undefined);
  }, [hotelId]);

  const history = useMemo(() => { void tick; return recordsForHotel(hotelId); }, [hotelId, tick]);
  const pendingApproval = useMemo(() => { void tick; return recordsPendingApproval(); }, [tick]);
  const hitsGetnetMatches = useMemo(() => reconcileHitsGetnet(hits, getnet), [hits, getnet]);
  const bankMatches = useMemo(() => reconcileGetnetBank(getnet, bank, fees), [getnet, bank, fees]);
  const hgStats = useMemo(() => ({
    both: hitsGetnetMatches.filter((m) => m.side === 'both').length,
    diff: hitsGetnetMatches.filter((m) => m.side === 'value_diff').length,
    ho: hitsGetnetMatches.filter((m) => m.side === 'hits_only').length,
    go: hitsGetnetMatches.filter((m) => m.side === 'getnet_only').length,
  }), [hitsGetnetMatches]);

  const friday = isFriday(header.date);
  const visibleItems = CHECKLIST;
  const requiredItems = CHECKLIST.filter((c) => !c.fridayOnly || friday);
  const missingCount = requiredItems.filter((c) => !answers[c.id]?.status).length;
  const filledCount = visibleItems.filter((c) => answers[c.id]?.status).length;
  const canSubmit = !isLocked && missingCount === 0 && !!header.analyst.trim();

  function startNewAudit() {
    setHeader({ date: todayISO(), analyst: '', period: 'Dia completo', sentToGoAt: '' });
    setAnswers(emptyAnswers());
    setCurrentRecordId(null);
    setRecordStatus('rascunho');
    setSubmittedAt(undefined); setApprovedAt(undefined); setApprovedBy(undefined);
    setChecklistMode('form');
    try { localStorage.removeItem(storageKey); } catch {}
  }

  function openRecord(r: AuditRecord) {
    setHeader({ ...r.header });
    setAnswers({ ...emptyAnswers(), ...r.answers });
    setCurrentRecordId(r.id);
    setRecordStatus(r.status);
    setSubmittedAt(r.submittedAt);
    setApprovedAt(r.approvedAt);
    setApprovedBy(r.approvedBy);
    setTab('checklist');
    setChecklistMode('form');
  }

  const loadFile = useCallback(async (kind: 'hits' | 'getnet' | 'bank', file: File) => {
    setBusy(true);
    try {
      const text = await fileToText(file);
      if (kind === 'hits') { const rows = parseHitsText(text); setHits(rows); toast.success(`PMS: ${rows.length} pagamento(s)`); }
      else if (kind === 'getnet') { const rows = parseGetnetText(text); setGetnet(rows); toast.success(`Adquirente: ${rows.length} venda(s)`); }
      else { const rows = parseSantanderText(text); setBank(rows); toast.success(`Extrato: ${rows.length} linha(s)`); }
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Falha ao ler arquivo'); }
    finally { setBusy(false); }
  }, []);

  const applyPaste = () => {
    if (!pasteOpen || !pasteText.trim()) return;
    if (pasteOpen === 'hits') { setHits(parseHitsText(pasteText)); toast.success('PMS processado'); }
    else if (pasteOpen === 'getnet') { setGetnet(parseGetnetText(pasteText)); toast.success('Adquirente processado'); }
    else { setBank(parseSantanderText(pasteText)); toast.success('Extrato processado'); }
    setPasteOpen(null); setPasteText('');
  };

  const setAnswer = (id: number, patch: Partial<{ status: ItemStatus; notes: string }>) => {
    if (isLocked) return;
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const saveDraft = () => {
    if (isLocked) { toast.error('Auditoria bloqueada'); return; }
    const now = new Date().toISOString();
    const id = currentRecordId || newRecordId();
    const prev = getRecord(id);
    upsertRecord({
      id, hotelId, hotelName,
      header: { ...header, sentToGoAt: '' }, answers,
      status: recordStatus === 'contestado' ? 'contestado' : 'rascunho',
      createdAt: prev?.createdAt || now, updatedAt: now, contestComment: prev?.contestComment,
    });
    setCurrentRecordId(id);
    setRecordStatus(recordStatus === 'contestado' ? 'contestado' : 'rascunho');
    setTick((t) => t + 1);
    toast.success('Rascunho salvo');
  };

  const submitForApproval = () => {
    if (isLocked) return;
    if (!header.analyst.trim()) { toast.error('Informe o nome da analista'); return; }
    if (missingCount > 0) { toast.error(`Marque todos os itens obrigatórios (${missingCount} pendente(s))`); return; }
    const now = new Date().toISOString();
    const id = currentRecordId || newRecordId();
    const prev = getRecord(id);
    const nextHeader = { ...header, sentToGoAt: todayISO() };
    upsertRecord({
      id, hotelId, hotelName, header: nextHeader, answers, status: 'aguardando',
      createdAt: prev?.createdAt || now, updatedAt: now, submittedAt: now, contestComment: undefined,
    });
    setHeader(nextHeader); setCurrentRecordId(id); setRecordStatus('aguardando');
    setSubmittedAt(now); setApprovedAt(undefined); setApprovedBy(undefined);
    setTick((t) => t + 1);
    toast.success('Enviada para aprovação');
  };

  const inputCls = 'w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400';
  const inputLocked = 'w-full h-9 rounded-lg border border-slate-100 bg-slate-50 px-2.5 text-[13px] text-slate-600 cursor-not-allowed';

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" onClick={onChangeHotel} className="text-[11px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3 h-3" /> Trocar hotel
          </button>
          <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-slate-500" /> Auditoria · {hotelName}
          </h2>
        </div>
        {busy && <span className="inline-flex items-center gap-1.5 text-[12px] text-blue-700"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processando…</span>}
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50/80 p-1 w-fit">
        {([
          { id: 'checklist' as const, label: 'Checklist', icon: ClipboardCheck },
          { id: 'hits_getnet' as const, label: 'PMS × Adquirente', icon: Link2 },
          { id: 'getnet_bank' as const, label: 'Adquirente × Banco', icon: Scale },
          { id: 'taxas' as const, label: 'Taxas', icon: Settings2 },
          { id: 'aprovacao' as const, label: 'Aprovação', icon: CheckCircle2 },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={cn('h-8 px-2.5 rounded-lg text-[12px] font-medium inline-flex items-center gap-1.5', tab === id ? 'bg-white border border-slate-200 shadow-sm' : 'text-slate-600')}>
            <Icon className="w-3.5 h-3.5" /> {label}
            {id === 'aprovacao' && pendingApproval.length > 0 && (
              <span className="ml-0.5 text-[10px] font-bold bg-blue-600 text-white rounded-full min-w-[16px] h-4 px-1 inline-flex items-center justify-center">{pendingApproval.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'checklist' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
              {([
                { id: 'hub' as const, label: 'Início', icon: ClipboardCheck },
                { id: 'form' as const, label: 'Auditoria', icon: FileText },
                { id: 'history' as const, label: 'Histórico', icon: History },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => setChecklistMode(id)} className={cn('h-8 px-3 rounded-md text-[12px] font-medium inline-flex items-center gap-1.5', checklistMode === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50')}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>

          {checklistMode === 'hub' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button type="button" onClick={startNewAudit} className="group text-left rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-400 hover:shadow-md transition-all">
                  <div className="h-11 w-11 rounded-xl bg-slate-900 text-white flex items-center justify-center mb-4"><Plus className="w-5 h-5" /></div>
                  <p className="text-[15px] font-semibold text-slate-900">Nova auditoria</p>
                  <p className="text-[13px] text-slate-500 mt-1">Checklist do dia (POP-FIN-001), incl. comprovante de depósito.</p>
                </button>
                <button type="button" onClick={() => setChecklistMode('history')} className="group text-left rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-400 hover:shadow-md transition-all">
                  <div className="h-11 w-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-4 group-hover:bg-slate-900 group-hover:text-white transition-colors"><History className="w-5 h-5" /></div>
                  <p className="text-[15px] font-semibold text-slate-900">Histórico</p>
                  <p className="text-[13px] text-slate-500 mt-1">Auditorias salvas, enviadas e aprovadas deste hotel.</p>
                  {history.length > 0 && <p className="text-[12px] font-medium text-slate-700 mt-3">{history.length} registro(s)</p>}
                </button>
              </div>
              {history.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b bg-slate-50/80 flex justify-between">
                    <span className="text-[12px] font-semibold">Últimas auditorias</span>
                    <button type="button" onClick={() => setChecklistMode('history')} className="text-[11px] font-medium text-blue-700 hover:underline">Ver todas</button>
                  </div>
                  <div className="divide-y">
                    {history.slice(0, 5).map((r) => (
                      <button key={r.id} type="button" onClick={() => openRecord(r)} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex justify-between gap-3">
                        <div>
                          <p className="text-[13px] font-medium">{formatDateBR(r.header.date)}</p>
                          <p className="text-[11px] text-slate-500">{r.header.analyst || '—'}</p>
                        </div>
                        <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded text-white', r.status === 'aprovado' && 'bg-emerald-600', r.status === 'aguardando' && 'bg-blue-600', r.status === 'contestado' && 'bg-amber-500', r.status === 'rascunho' && 'bg-slate-400')}>{statusLabel(r.status)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {checklistMode === 'history' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center gap-2">
                <div>
                  <h3 className="text-[14px] font-semibold">Histórico de auditorias</h3>
                  <p className="text-[12px] text-slate-500">Clique para abrir · aprovadas são somente leitura</p>
                </div>
                <button type="button" onClick={startNewAudit} className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[12px] font-semibold inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Nova</button>
              </div>
              <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                <div className="divide-y max-h-[520px] overflow-y-auto">
                  {history.length === 0 ? (
                    <div className="px-4 py-16 text-center text-[13px] text-slate-500">Nenhuma auditoria neste hotel</div>
                  ) : history.map((r) => (
                    <button key={r.id} type="button" onClick={() => openRecord(r)} className="w-full text-left px-4 py-3.5 hover:bg-slate-50 flex justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-semibold">{formatDateBR(r.header.date)}</span>
                          <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded text-white', r.status === 'aprovado' && 'bg-emerald-600', r.status === 'aguardando' && 'bg-blue-600', r.status === 'contestado' && 'bg-amber-500', r.status === 'rascunho' && 'bg-slate-400')}>{statusLabel(r.status)}</span>
                        </div>
                        <p className="text-[12px] text-slate-500 mt-0.5">{r.header.analyst || '—'}{r.submittedAt ? ` · enviada ${formatDateTimeBR(r.submittedAt)}` : ''}{r.approvedAt ? ` · aprovada ${formatDateTimeBR(r.approvedAt)}` : ''}</p>
                      </div>
                      <span className="text-[11px] text-slate-400">Abrir →</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {checklistMode === 'form' && (
            <div className="space-y-4">
              {isViewingHistory && recordStatus === 'aprovado' && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex flex-wrap justify-between gap-2">
                  <div className="flex gap-2 text-[13px] text-emerald-950">
                    <Eye className="w-4 h-4 mt-0.5" />
                    <div>
                      <p className="font-semibold">Auditoria aprovada · somente leitura</p>
                      <p className="text-[12px]">{formatDateBR(header.date)} · {header.analyst || '—'}{submittedAt ? ` · ${formatDateTimeBR(submittedAt)}` : ''}{approvedAt ? ` · aprovada ${formatDateTimeBR(approvedAt)}` : ''}</p>
                    </div>
                  </div>
                  <button type="button" onClick={startNewAudit} className="h-8 px-3 rounded-lg bg-slate-900 text-white text-[11px] font-semibold inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Nova</button>
                </div>
              )}
              {recordStatus === 'aguardando' && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex flex-wrap justify-between gap-2 text-[13px] text-blue-950">
                  <div>
                    <p className="font-semibold">Aguardando aprovação · bloqueada</p>
                    <p className="text-[12px]">Enviada {submittedAt ? formatDateTimeBR(submittedAt) : '—'}</p>
                  </div>
                  <button type="button" onClick={startNewAudit} className="h-8 px-3 rounded-lg border border-blue-300 text-[11px] font-semibold">Nova</button>
                </div>
              )}
              {recordStatus === 'contestado' && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
                  <p className="font-semibold">Contestada — corrija e envie novamente</p>
                  {currentRecordId && getRecord(currentRecordId)?.contestComment && <p className="text-[12px] mt-1">Motivo: {getRecord(currentRecordId)?.contestComment}</p>}
                </div>
              )}

              {!isLocked && (
                <div className="rounded-xl border bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
                  <div>
                    <p className="text-[13px] font-semibold">{currentRecordId ? 'Editando auditoria' : 'Nova auditoria'}</p>
                    <p className="text-[12px] text-slate-500">Progresso: {filledCount}/{visibleItems.length} · {missingCount > 0 ? `${missingCount} obrigatório(s) pendente(s)` : 'pronto para envio'}</p>
                  </div>
                  <div className="h-2 w-32 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-slate-900 transition-all" style={{ width: `${visibleItems.length ? (filledCount / visibleItems.length) * 100 : 0}%` }} />
                  </div>
                </div>
              )}

              <div className="rounded-2xl border bg-white p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-0.5 text-[12px]">
                  <span className="text-[10px] uppercase text-slate-400 font-semibold">Data da auditoria</span>
                  <input type="date" className={isLocked ? inputLocked : inputCls} value={header.date} disabled={isLocked} onChange={(e) => setHeader({ ...header, date: e.target.value })} />
                </label>
                <label className="space-y-0.5 text-[12px]">
                  <span className="text-[10px] uppercase text-slate-400 font-semibold">Analista financeira</span>
                  <input className={isLocked ? inputLocked : inputCls} value={header.analyst} disabled={isLocked} onChange={(e) => setHeader({ ...header, analyst: e.target.value })} placeholder="Nome da analista" />
                </label>
              </div>

              {(submittedAt || approvedAt || recordStatus === 'aguardando' || recordStatus === 'aprovado') && (
                <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                  <div className="px-4 py-2 border-b bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Registro de tramitação</div>
                  <div className="px-4 py-3">
                    <ol className="relative border-l border-slate-200 ml-2 space-y-3">
                      <li className="ml-4"><span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-slate-400" /><p className="text-[11px] font-semibold text-slate-500 uppercase">Abertura</p><p className="text-[13px]">Auditoria do dia {formatDateBR(header.date)}{header.analyst ? ` · ${header.analyst}` : ''}</p></li>
                      {submittedAt && <li className="ml-4"><span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-blue-600" /><p className="text-[11px] font-semibold text-blue-700 uppercase">Envio</p><p className="text-[13px]">{formatDateTimeBR(submittedAt)}</p></li>}
                      {recordStatus === 'aguardando' && !approvedAt && <li className="ml-4"><span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-amber-400 animate-pulse" /><p className="text-[11px] font-semibold text-amber-700 uppercase">Em análise</p></li>}
                      {approvedAt && <li className="ml-4"><span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-600" /><p className="text-[11px] font-semibold text-emerald-700 uppercase">Aprovação</p><p className="text-[13px]">{formatDateTimeBR(approvedAt)}</p><p className="text-[11px] text-slate-500">Por: {approvedBy || 'GO'}</p></li>}
                    </ol>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {visibleItems.map((item) => {
                  const a = answers[item.id] || { status: '' as ItemStatus, notes: '' };
                  return (
                    <div key={item.id} className={cn('rounded-2xl border bg-white shadow-sm overflow-hidden', isLocked && 'opacity-95')}>
                      <div className="px-4 py-3 border-b bg-slate-50/80 flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold"><span className="text-slate-400 mr-1">{String(item.id).padStart(2, '0')}.</span>{item.title}</p>
                          {item.fridayOnly && <span className="inline-block mt-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">Obrigatório às sextas · comprovante de depósito</span>}
                        </div>
                        <div className="flex gap-1.5">
                          <button type="button" disabled={isLocked} onClick={() => setAnswer(item.id, { status: 'conforme' })} className={cn('h-8 px-3 rounded-md text-[11px] font-bold uppercase border disabled:cursor-not-allowed', a.status === 'conforme' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200')}>Conforme</button>
                          <button type="button" disabled={isLocked} onClick={() => setAnswer(item.id, { status: 'divergencia' })} className={cn('h-8 px-3 rounded-md text-[11px] font-bold uppercase border disabled:cursor-not-allowed', a.status === 'divergencia' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-500 border-slate-200')}>Divergência</button>
                        </div>
                      </div>
                      <div className="px-4 py-3 space-y-2">
                        <ul className="text-[12px] text-slate-600 list-disc pl-4 space-y-0.5">{item.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
                        <textarea className={cn('w-full min-h-[64px] rounded-lg border px-2.5 py-2 text-[13px]', isLocked ? 'bg-slate-50 border-slate-100 cursor-not-allowed' : 'border-slate-200')} value={a.notes} disabled={isLocked} onChange={(e) => setAnswer(item.id, { notes: e.target.value })} placeholder={isLocked ? '' : (item.fridayOnly ? 'Referência do comprovante / resolutiva…' : 'Resolutiva…')} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {!isLocked && missingCount > 0 && <p className="text-[12px] text-amber-800">Faltam <strong>{missingCount}</strong> item(ns) obrigatório(s).</p>}
              {!isLocked && (
                <div className="sticky bottom-0 z-10 py-3">
                  <div className="flex flex-wrap gap-2 rounded-xl border bg-white p-3 shadow-md">
                    <button type="button" onClick={saveDraft} className="h-10 px-4 rounded-lg bg-slate-900 text-white text-[12px] font-semibold">Salvar rascunho</button>
                    <button type="button" onClick={submitForApproval} disabled={!canSubmit} className="h-10 px-4 rounded-lg bg-blue-600 text-white text-[12px] font-semibold disabled:opacity-40">Enviar para aprovação</button>
                    <button type="button" onClick={() => setChecklistMode('hub')} className="h-10 px-3 rounded-lg border text-[12px] text-slate-600 ml-auto">Fechar</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'hits_getnet' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <UploadCard title="PMS — Pagamentos" count={hits.length} onFile={(f) => loadFile('hits', f)} onPaste={() => setPasteOpen('hits')} />
            <UploadCard title="Adquirente — Vendas" count={getnet.length} onFile={(f) => loadFile('getnet', f)} onPaste={() => setPasteOpen('getnet')} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[{ label: 'Conciliados', value: hgStats.both, tone: 'text-emerald-700' }, { label: 'Dif. valor', value: hgStats.diff, tone: 'text-amber-700' }, { label: 'Só PMS', value: hgStats.ho, tone: 'text-rose-700' }, { label: 'Só Adquirente', value: hgStats.go, tone: 'text-rose-700' }].map((k) => (
              <div key={k.label} className="rounded-xl border bg-white px-3 py-2.5 shadow-sm"><p className="text-[10px] uppercase text-slate-400 font-semibold">{k.label}</p><p className={cn('text-[18px] font-semibold tabular-nums', k.tone)}>{k.value}</p></div>
            ))}
          </div>
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b bg-slate-50/80 text-[12px] font-semibold">Resultado · tol. R$ 0,05</div>
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-[12px]">
                <thead className="border-b sticky top-0 bg-white"><tr className="text-left text-[10px] uppercase text-slate-400"><th className="px-3 py-2">Status</th><th className="px-3 py-2">PMS</th><th className="px-3 py-2">Adquirente</th><th className="px-3 py-2 text-right">PMS líq.</th><th className="px-3 py-2 text-right">Adq. líq.</th><th className="px-3 py-2 text-right">Δ</th></tr></thead>
                <tbody className="divide-y">
                  {hitsGetnetMatches.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Envie os dois relatórios</td></tr> : hitsGetnetMatches.map((m) => (
                    <tr key={m.id}><td className="px-3 py-2"><StatusPill side={m.side} /></td><td className="px-3 py-2">{m.hits ? `${formatDateBR(m.hits.date)} · ${m.hits.guest}` : '—'}</td><td className="px-3 py-2">{m.getnet ? `${formatDateBR(m.getnet.date)} · ${m.getnet.brand}` : '—'}</td><td className="px-3 py-2 text-right tabular-nums">{m.hits ? formatBRL(m.hits.net) : '—'}</td><td className="px-3 py-2 text-right tabular-nums">{m.getnet ? formatBRL(m.getnet.net) : '—'}</td><td className="px-3 py-2 text-right tabular-nums">{m.delta != null ? formatBRL(m.delta) : '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'getnet_bank' && (
        <div className="space-y-3">
          <p className="text-[12px] text-slate-500">Líquido esperado usa taxas do hotel · antecipação D+1</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <UploadCard title="Adquirente — Vendas" count={getnet.length} onFile={(f) => loadFile('getnet', f)} onPaste={() => setPasteOpen('getnet')} />
            <UploadCard title="Extrato bancário" count={bank.length} onFile={(f) => loadFile('bank', f)} onPaste={() => setPasteOpen('bank')} />
          </div>
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="border-b"><tr className="text-left text-[10px] uppercase text-slate-400"><th className="px-3 py-2">Liquidação</th><th className="px-3 py-2 text-right">Esperado</th><th className="px-3 py-2 text-right">Banco</th><th className="px-3 py-2 text-right">Δ</th><th className="px-3 py-2">Status</th></tr></thead>
              <tbody className="divide-y">
                {bankMatches.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Envie adquirente + extrato</td></tr> : bankMatches.map((r) => (
                  <tr key={r.id}><td className="px-3 py-2">{formatDateBR(r.settleDate)}</td><td className="px-3 py-2 text-right tabular-nums">{formatBRL(r.expectedNet)}</td><td className="px-3 py-2 text-right tabular-nums">{formatBRL(r.bankCredit)}</td><td className="px-3 py-2 text-right tabular-nums">{formatBRL(r.delta)}</td><td className="px-3 py-2"><BankStatus status={r.status} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'taxas' && <TaxasFeeMatrix hotelId={hotelId} hotelName={hotelName} onActiveFeesChange={setFees} />}

      {tab === 'aprovacao' && (
        <div className="space-y-3">
          <p className="text-[12px] text-slate-500">Fila da analista · aprovar ou contestar</p>
          {pendingApproval.length === 0 ? (
            <div className="rounded-2xl border border-dashed px-4 py-10 text-center text-[13px] text-slate-400">Nenhuma auditoria aguardando</div>
          ) : pendingApproval.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="text-[14px] font-semibold">{r.hotelName}</p>
                  <p className="text-[12px] text-slate-500">{formatDateBR(r.header.date)} · {r.header.analyst || '—'} · enviada {r.submittedAt ? formatDateTimeBR(r.submittedAt) : '—'}</p>
                </div>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => {
                    const comment = window.prompt('Motivo da contestação (obrigatório):');
                    if (comment === null) return;
                    if (!comment.trim()) { toast.error('Informe o motivo'); return; }
                    upsertRecord({ ...r, status: 'contestado', contestComment: comment.trim(), updatedAt: new Date().toISOString() });
                    setTick((t) => t + 1);
                    if (currentRecordId === r.id) setRecordStatus('contestado');
                    toast.message('Contestada');
                  }} className="h-8 px-3 rounded-lg border border-amber-400 text-amber-900 text-[11px] font-semibold">Contestar</button>
                  <button type="button" onClick={() => {
                    const now = new Date().toISOString();
                    upsertRecord({ ...r, status: 'aprovado', approvedAt: now, approvedBy: 'GO', updatedAt: now, contestComment: undefined });
                    setTick((t) => t + 1);
                    if (currentRecordId === r.id) { setRecordStatus('aprovado'); setApprovedAt(now); setApprovedBy('GO'); }
                    toast.success('Aprovada');
                  }} className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold">Aprovar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pasteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl border overflow-hidden">
            <div className="px-5 py-3 border-b bg-slate-50 flex justify-between"><p className="font-semibold text-[14px]">Colar texto — {pasteOpen}</p><button type="button" onClick={() => setPasteOpen(null)}><X className="w-4 h-4" /></button></div>
            <div className="p-4"><textarea className="w-full min-h-[200px] rounded-lg border p-3 text-[12px] font-mono" value={pasteText} onChange={(e) => setPasteText(e.target.value)} /></div>
            <div className="px-5 py-3 border-t flex justify-end gap-2">
              <button type="button" onClick={() => setPasteOpen(null)} className="h-9 px-4 rounded-lg border text-[12px]">Cancelar</button>
              <button type="button" onClick={applyPaste} className="h-9 px-4 rounded-lg bg-blue-600 text-white text-[12px] font-semibold">Processar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UploadCard({ title, count, onFile, onPaste }: { title: string; count: number; onFile: (f: File) => void; onPaste: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 shadow-sm space-y-3">
      <div className="flex gap-2"><FileText className="w-4 h-4 text-slate-400 mt-0.5" /><div><p className="text-[13px] font-semibold">{title}</p><p className="text-[11px] text-slate-400">{count} registro(s)</p></div></div>
      <div className="flex gap-2">
        <label className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer">
          <Upload className="w-3.5 h-3.5" /> Upload
          <input type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
        </label>
        <button type="button" onClick={onPaste} className="h-9 px-3 rounded-lg border text-[12px]">Colar texto</button>
      </div>
    </div>
  );
}

function StatusPill({ side }: { side: MatchSide }) {
  if (side === 'both') return <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-md px-1.5 py-0.5"><CheckCircle2 className="w-3 h-3" /> OK</span>;
  if (side === 'value_diff') return <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-1.5 py-0.5"><AlertTriangle className="w-3 h-3" /> Valor</span>;
  if (side === 'hits_only') return <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-800 bg-rose-50 border border-rose-100 rounded-md px-1.5 py-0.5"><XCircle className="w-3 h-3" /> Só PMS</span>;
  return <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-800 bg-rose-50 border border-rose-100 rounded-md px-1.5 py-0.5"><XCircle className="w-3 h-3" /> Só Adquirente</span>;
}

function BankStatus({ status }: { status: BankMatchRow['status'] }) {
  const map = { ok: 'bg-emerald-600 text-white', faltando_banco: 'bg-rose-600 text-white', sobra_banco: 'bg-amber-500 text-white', divergencia: 'bg-amber-600 text-white' };
  const label = { ok: 'OK', faltando_banco: 'Falta no banco', sobra_banco: 'Sobra no banco', divergencia: 'Divergência' };
  return <span className={cn('inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold', map[status])}>{label[status]}</span>;
}
