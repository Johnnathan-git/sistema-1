/**
 * Auditoria Life — hotel → checklist + conciliações + taxas + aprovação
 * Fluxo: rascunho → enviar → aguardando → aprovado/contestado
 * Aprovado/aguardando = somente leitura para a analista
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileText,
  Link2,
  Loader2,
  Plus,
  Scale,
  Settings2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { TaxasFeeMatrix } from '@/components/uos/TaxasFeeMatrix';
import {
  parseHitsText,
  parseGetnetText,
  parseSantanderText,
  reconcileHitsGetnet,
  reconcileGetnetBank,
  formatBRL,
  formatDateBR,
  todayISO,
  isFriday,
  fileToText,
  type HitsPayment,
  type GetnetSale,
  type BankLine,
  type FeeRule,
  type MatchSide,
  type BankMatchRow,
  CHECKLIST,
} from '@/lib/auditoria-core';
import {
  AUDIT_HOTELS,
  LS_HOTEL,
  auditStorageKey,
  defaultFeesForHotel,
  feesStorageKey,
  type HotelId,
} from '@/lib/auditoria-hotels';
import {
  type AuditWorkflowStatus,
  type ItemStatus,
  newRecordId,
  recordsForHotel,
  recordsPendingApproval,
  statusLabel,
  upsertRecord,
  getRecord,
  type AuditRecord,
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
  } catch {
    return iso;
  }
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
          <button key={h.id} type="button" onClick={() => onSelect(h.id)} className="text-left rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-400 hover:shadow-md transition-all group">
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
  const [recordStatus, setRecordStatus] = useState<AuditWorkflowStatus>('rascunho');
  const [submittedAt, setSubmittedAt] = useState<string | undefined>();
  const [approvedAt, setApprovedAt] = useState<string | undefined>();
  const [approvedBy, setApprovedBy] = useState<string | undefined>();
  const [tick, setTick] = useState(0);

  const isLocked = recordStatus === 'aprovado' || recordStatus === 'aguardando';
  const isViewingHistory = isLocked && currentRecordId != null;

  useEffect(() => {
    setTab('checklist');
    setHits([]);
    setGetnet([]);
    setBank([]);
    startNewAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const requiredItems = CHECKLIST.filter((c) => !c.fridayOnly || friday);
  const missingCount = requiredItems.filter((c) => !answers[c.id]?.status).length;
  const canSubmit = !isLocked && missingCount === 0 && !!header.analyst.trim();

  function startNewAudit() {
    setHeader({ date: todayISO(), analyst: '', period: 'Dia completo', sentToGoAt: '' });
    setAnswers(emptyAnswers());
    setCurrentRecordId(null);
    setRecordStatus('rascunho');
    setSubmittedAt(undefined);
    setApprovedAt(undefined);
    setApprovedBy(undefined);
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
  }

  const loadFile = useCallback(async (kind: 'hits' | 'getnet' | 'bank', file: File) => {
    setBusy(true);
    try {
      const text = await fileToText(file);
      if (kind === 'hits') { const rows = parseHitsText(text); setHits(rows); toast.success(`PMS: ${rows.length} pagamento(s)`); }
      else if (kind === 'getnet') { const rows = parseGetnetText(text); setGetnet(rows); toast.success(`Adquirente: ${rows.length} venda(s)`); }
      else { const rows = parseSantanderText(text); setBank(rows); toast.success(`Extrato: ${rows.length} linha(s)`); }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao ler arquivo');
    } finally { setBusy(false); }
  }, []);

  const applyPaste = () => {
    if (!pasteOpen || !pasteText.trim()) return;
    if (pasteOpen === 'hits') { setHits(parseHitsText(pasteText)); toast.success('PMS processado'); }
    else if (pasteOpen === 'getnet') { setGetnet(parseGetnetText(pasteText)); toast.success('Adquirente processado'); }
    else { setBank(parseSantanderText(pasteText)); toast.success('Extrato processado'); }
    setPasteOpen(null);
    setPasteText('');
  };

  const setAnswer = (id: number, patch: Partial<{ status: ItemStatus; notes: string }>) => {
    if (isLocked) return;
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const saveDraft = () => {
    if (isLocked) { toast.error('Esta auditoria está bloqueada (já enviada ou aprovada)'); return; }
    const now = new Date().toISOString();
    const id = currentRecordId || newRecordId();
    const prev = getRecord(id);
    upsertRecord({
      id, hotelId, hotelName,
      header: { ...header, sentToGoAt: '' },
      answers,
      status: recordStatus === 'contestado' ? 'contestado' : 'rascunho',
      createdAt: prev?.createdAt || now,
      updatedAt: now,
      contestComment: prev?.contestComment,
    });
    setCurrentRecordId(id);
    setRecordStatus(recordStatus === 'contestado' ? 'contestado' : 'rascunho');
    setTick((t) => t + 1);
    toast.success('Rascunho salvo');
  };

  const submitForApproval = () => {
    if (isLocked) return;
    if (!header.analyst.trim()) { toast.error('Informe o nome da analista'); return; }
    if (missingCount > 0) { toast.error(`Marque todos os itens do checklist (${missingCount} sem status)`); return; }
    const now = new Date().toISOString();
    const sentDate = todayISO();
    const id = currentRecordId || newRecordId();
    const prev = getRecord(id);
    const nextHeader = { ...header, sentToGoAt: sentDate };
    upsertRecord({
      id, hotelId, hotelName,
      header: nextHeader,
      answers,
      status: 'aguardando',
      createdAt: prev?.createdAt || now,
      updatedAt: now,
      submittedAt: now,
      contestComment: undefined,
    });
    setHeader(nextHeader);
    setCurrentRecordId(id);
    setRecordStatus('aguardando');
    setSubmittedAt(now);
    setApprovedAt(undefined);
    setApprovedBy(undefined);
    setTick((t) => t + 1);
    toast.success('Enviada para aprovação — abra a aba Aprovação');
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
        <div className="space-y-3">
          {isViewingHistory && recordStatus === 'aprovado' && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-start gap-2 text-[13px] text-emerald-950">
                <Eye className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Visualizando auditoria aprovada (somente leitura)</p>
                  <p className="text-[12px] text-emerald-800 mt-0.5">
                    {formatDateBR(header.date)} · {header.analyst || '—'}
                    {submittedAt ? ` · enviada ${formatDateTimeBR(submittedAt)}` : ''}
                    {approvedAt ? ` · aprovada ${formatDateTimeBR(approvedAt)}` : ''}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => { startNewAudit(); toast.message('Nova auditoria em branco'); }} className="h-8 px-3 rounded-lg bg-slate-900 text-white text-[11px] font-semibold inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Nova auditoria
              </button>
            </div>
          )}

          {recordStatus === 'aguardando' && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[13px] text-blue-950">
                <p className="font-semibold">Aguardando aprovação — bloqueada para edição</p>
                <p className="text-[12px] mt-0.5">Enviada {submittedAt ? formatDateTimeBR(submittedAt) : '—'} · confira a aba Aprovação</p>
              </div>
              <button type="button" onClick={startNewAudit} className="h-8 px-3 rounded-lg border border-blue-300 text-blue-900 text-[11px] font-semibold inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Nova auditoria
              </button>
            </div>
          )}

          {recordStatus === 'contestado' && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
              <p className="font-semibold">Contestada — corrija e envie novamente</p>
              {currentRecordId && getRecord(currentRecordId)?.contestComment && (
                <p className="text-[12px] mt-1">Motivo: {getRecord(currentRecordId)?.contestComment}</p>
              )}
            </div>
          )}

          {!isLocked && !currentRecordId && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[12px] text-slate-600">
              <strong className="text-slate-900">Nova auditoria</strong> — preencha o checklist, salve o rascunho e envie para aprovação.
            </div>
          )}

          {!isLocked && currentRecordId && recordStatus === 'rascunho' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[12px] text-slate-600 flex flex-wrap items-center justify-between gap-2">
              <span>Editando <strong>rascunho</strong> de {formatDateBR(header.date)}</span>
              <button type="button" onClick={startNewAudit} className="text-[11px] font-medium text-slate-700 underline">Descartar e criar nova</button>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-2 border-b bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Registro de tramitação</div>
              <div className="px-4 py-3">
                <ol className="relative border-l border-slate-200 ml-2 space-y-3">
                  <li className="ml-4">
                    <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-slate-400" />
                    <p className="text-[11px] font-semibold text-slate-500 uppercase">Abertura</p>
                    <p className="text-[13px] text-slate-800">Auditoria do dia {formatDateBR(header.date)}{header.analyst ? ` · ${header.analyst}` : ''}</p>
                  </li>
                  {submittedAt && (
                    <li className="ml-4">
                      <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-blue-600" />
                      <p className="text-[11px] font-semibold text-blue-700 uppercase">Envio para aprovação</p>
                      <p className="text-[13px] text-slate-800">{formatDateTimeBR(submittedAt)}</p>
                      <p className="text-[11px] text-slate-500">Analista: {header.analyst || '—'}</p>
                    </li>
                  )}
                  {recordStatus === 'aguardando' && !approvedAt && (
                    <li className="ml-4">
                      <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-amber-400 animate-pulse" />
                      <p className="text-[11px] font-semibold text-amber-700 uppercase">Em análise</p>
                      <p className="text-[13px] text-slate-600">Aguardando decisão do aprovador</p>
                    </li>
                  )}
                  {approvedAt && (
                    <li className="ml-4">
                      <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-600" />
                      <p className="text-[11px] font-semibold text-emerald-700 uppercase">Aprovação</p>
                      <p className="text-[13px] text-slate-800">{formatDateTimeBR(approvedAt)}</p>
                      <p className="text-[11px] text-slate-500">Por: {approvedBy || 'GO'}</p>
                    </li>
                  )}
                  {recordStatus === 'contestado' && (
                    <li className="ml-4">
                      <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-amber-500" />
                      <p className="text-[11px] font-semibold text-amber-800 uppercase">Contestação</p>
                      <p className="text-[13px] text-slate-800">{currentRecordId && getRecord(currentRecordId)?.contestComment ? getRecord(currentRecordId)?.contestComment : 'Retornada para correção'}</p>
                    </li>
                  )}
                </ol>
              </div>
            </div>
          )}

          {requiredItems.map((item) => {
            const a = answers[item.id] || { status: '' as ItemStatus, notes: '' };
            return (
              <div key={item.id} className={cn('rounded-2xl border bg-white shadow-sm overflow-hidden', isLocked && 'opacity-95')}>
                <div className="px-4 py-2.5 border-b bg-slate-50/80 flex flex-wrap items-center gap-2 justify-between">
                  <p className="text-[13px] font-semibold">
                    {item.id}. {item.title}
                    {item.fridayOnly && <span className="ml-2 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">Só sexta</span>}
                  </p>
                  <div className="flex gap-1.5">
                    <button type="button" disabled={isLocked} onClick={() => setAnswer(item.id, { status: 'conforme' })} className={cn('h-8 px-3 rounded-md text-[11px] font-bold uppercase tracking-wide border disabled:cursor-not-allowed', a.status === 'conforme' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-500')}>Conforme</button>
                    <button type="button" disabled={isLocked} onClick={() => setAnswer(item.id, { status: 'divergencia' })} className={cn('h-8 px-3 rounded-md text-[11px] font-bold uppercase tracking-wide border disabled:cursor-not-allowed', a.status === 'divergencia' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-500 border-slate-200 hover:border-rose-500')}>Divergência</button>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-2">
                  <ul className="text-[12px] text-slate-600 list-disc pl-4 space-y-0.5">{item.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
                  <textarea className={cn('w-full min-h-[64px] rounded-lg border px-2.5 py-2 text-[13px]', isLocked ? 'border-slate-100 bg-slate-50 text-slate-600 cursor-not-allowed' : 'border-slate-200')} value={a.notes} disabled={isLocked} onChange={(e) => setAnswer(item.id, { notes: e.target.value })} placeholder={isLocked ? '' : 'Resolutiva…'} />
                </div>
              </div>
            );
          })}

          {!isLocked && missingCount > 0 && (
            <p className="text-[12px] text-amber-800">Faltam <strong>{missingCount}</strong> item(ns) sem status para liberar o envio.</p>
          )}

          {!isLocked && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={saveDraft} className="h-9 px-4 rounded-lg bg-slate-900 text-white text-[12px] font-semibold">Salvar rascunho</button>
              <button type="button" onClick={submitForApproval} disabled={!canSubmit} className="h-9 px-4 rounded-lg bg-blue-600 text-white text-[12px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed">Enviar para aprovação</button>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b bg-slate-50/80 flex items-center justify-between">
              <span className="text-[12px] font-semibold">Histórico deste hotel</span>
              <button type="button" onClick={startNewAudit} className="text-[11px] font-medium text-blue-700 hover:underline inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Nova</button>
            </div>
            <div className="divide-y max-h-[280px] overflow-y-auto">
              {history.length === 0 ? (
                <p className="px-4 py-6 text-center text-[12px] text-slate-400">Nenhuma auditoria salva</p>
              ) : history.map((r) => {
                const active = r.id === currentRecordId;
                return (
                  <button key={r.id} type="button" onClick={() => openRecord(r)} className={cn('w-full text-left px-4 py-2.5 flex items-center justify-between gap-2', active ? 'bg-slate-100' : 'hover:bg-slate-50')}>
                    <span className="text-[12px] min-w-0">
                      <span className="font-medium">{formatDateBR(r.header.date)}</span>
                      <span className="text-slate-400"> · {r.header.analyst || '—'}</span>
                      {active && <span className="ml-2 text-[10px] font-semibold text-slate-600">{r.status === 'aprovado' || r.status === 'aguardando' ? '(visualizando)' : '(editando)'}</span>}
                    </span>
                    <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded text-white shrink-0', r.status === 'aprovado' && 'bg-emerald-600', r.status === 'aguardando' && 'bg-blue-600', r.status === 'contestado' && 'bg-amber-500', r.status === 'rascunho' && 'bg-slate-400')}>{statusLabel(r.status)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'hits_getnet' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <UploadCard title="PMS — Pagamentos Efetuados" count={hits.length} onFile={(f) => loadFile('hits', f)} onPaste={() => setPasteOpen('hits')} />
            <UploadCard title="Adquirente — Vendas Detalhado" count={getnet.length} onFile={(f) => loadFile('getnet', f)} onPaste={() => setPasteOpen('getnet')} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[{ label: 'Conciliados', value: hgStats.both, tone: 'text-emerald-700' }, { label: 'Dif. valor', value: hgStats.diff, tone: 'text-amber-700' }, { label: 'Só PMS', value: hgStats.ho, tone: 'text-rose-700' }, { label: 'Só Adquirente', value: hgStats.go, tone: 'text-rose-700' }].map((k) => (
              <div key={k.label} className="rounded-xl border bg-white px-3 py-2.5 shadow-sm">
                <p className="text-[10px] uppercase text-slate-400 font-semibold">{k.label}</p>
                <p className={cn('text-[18px] font-semibold tabular-nums', k.tone)}>{k.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b bg-slate-50/80 text-[12px] font-semibold">Resultado · tol. R$ 0,05</div>
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-[12px]">
                <thead className="border-b sticky top-0 bg-white"><tr className="text-left text-[10px] uppercase text-slate-400"><th className="px-3 py-2">Status</th><th className="px-3 py-2">PMS</th><th className="px-3 py-2">Adquirente</th><th className="px-3 py-2 text-right">PMS líq.</th><th className="px-3 py-2 text-right">Adquirente líq.</th><th className="px-3 py-2 text-right">Δ</th></tr></thead>
                <tbody className="divide-y">
                  {hitsGetnetMatches.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Envie os dois relatórios</td></tr> : hitsGetnetMatches.map((m) => (
                    <tr key={m.id}>
                      <td className="px-3 py-2"><StatusPill side={m.side} /></td>
                      <td className="px-3 py-2">{m.hits ? `${formatDateBR(m.hits.date)} · ${m.hits.guest}` : '—'}</td>
                      <td className="px-3 py-2">{m.getnet ? `${formatDateBR(m.getnet.date)} · ${m.getnet.brand}` : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m.hits ? formatBRL(m.hits.net) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m.getnet ? formatBRL(m.getnet.net) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m.delta != null ? formatBRL(m.delta) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'getnet_bank' && (
        <div className="space-y-3">
          <p className="text-[12px] text-slate-500">Líquido esperado usa as taxas deste hotel. Antecipação D+1.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <UploadCard title="Adquirente — Vendas Detalhado" count={getnet.length} onFile={(f) => loadFile('getnet', f)} onPaste={() => setPasteOpen('getnet')} />
            <UploadCard title="Extrato bancário" count={bank.length} onFile={(f) => loadFile('bank', f)} onPaste={() => setPasteOpen('bank')} />
          </div>
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="border-b"><tr className="text-left text-[10px] uppercase text-slate-400"><th className="px-3 py-2">Liquidação</th><th className="px-3 py-2 text-right">Esperado</th><th className="px-3 py-2 text-right">Banco</th><th className="px-3 py-2 text-right">Δ</th><th className="px-3 py-2">Status</th></tr></thead>
              <tbody className="divide-y">
                {bankMatches.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Envie adquirente + extrato</td></tr> : bankMatches.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">{formatDateBR(r.settleDate)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBRL(r.expectedNet)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBRL(r.bankCredit)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBRL(r.delta)}</td>
                    <td className="px-3 py-2"><BankStatus status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'taxas' && <TaxasFeeMatrix hotelId={hotelId} hotelName={hotelName} onActiveFeesChange={setFees} />}

      {tab === 'aprovacao' && (
        <div className="space-y-3">
          <p className="text-[12px] text-slate-500">Fila enviada pela analista · aprovar ou contestar</p>
          {pendingApproval.length === 0 ? (
            <div className="rounded-2xl border border-dashed px-4 py-10 text-center text-[13px] text-slate-400">Nenhuma auditoria aguardando aprovação</div>
          ) : pendingApproval.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
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
                    toast.message('Contestada — analista pode editar de novo');
                  }} className="h-8 px-3 rounded-lg border border-amber-400 text-amber-900 text-[11px] font-semibold">Contestar</button>
                  <button type="button" onClick={() => {
                    const now = new Date().toISOString();
                    upsertRecord({ ...r, status: 'aprovado', approvedAt: now, approvedBy: 'GO', updatedAt: now, contestComment: undefined });
                    setTick((t) => t + 1);
                    if (currentRecordId === r.id) { setRecordStatus('aprovado'); setApprovedAt(now); setApprovedBy('GO'); }
                    toast.success('Aprovada — bloqueada para a analista');
                  }} className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold">Aprovar</button>
                </div>
              </div>
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {CHECKLIST.map((item) => {
                  const a = r.answers[item.id];
                  if (!a?.status) return null;
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-[12px] border-b border-slate-50 py-1">
                      <span>{item.id}. {item.title}</span>
                      <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded text-white', a.status === 'conforme' ? 'bg-emerald-600' : 'bg-rose-600')}>{a.status === 'conforme' ? 'Conforme' : 'Divergência'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {pasteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl border overflow-hidden">
            <div className="px-5 py-3 border-b bg-slate-50 flex justify-between items-center">
              <p className="font-semibold text-[14px]">Colar texto — {pasteOpen}</p>
              <button type="button" onClick={() => setPasteOpen(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4"><textarea className="w-full min-h-[200px] rounded-lg border p-3 text-[12px] font-mono" value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Cole o texto…" /></div>
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
      <div className="flex items-start gap-2">
        <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
        <div>
          <p className="text-[13px] font-semibold">{title}</p>
          <p className="text-[11px] text-slate-400">{count} registro(s)</p>
        </div>
      </div>
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
