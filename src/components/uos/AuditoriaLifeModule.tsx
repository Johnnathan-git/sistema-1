/**
 * Auditoria Life — abas estilo Recepção + modal Histórico + checklist sob demanda
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

type TabId = 'checklist' | 'historico' | 'hits_getnet' | 'getnet_bank' | 'taxas' | 'aprovacao';

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
    return <HotelPicker onSelect={(id) => { localStorage.setItem(LS_HOTEL, id); setHotelId(id); }} />;
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
  const [modalRecord, setModalRecord] = useState<AuditRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const isLocked = recordStatus === 'aprovado' || recordStatus === 'aguardando';

  useEffect(() => {
    setTab('checklist');
    setHits([]); setGetnet([]); setBank([]);
    setHeader({ date: todayISO(), analyst: '', period: 'Dia completo', sentToGoAt: '' });
    setAnswers(emptyAnswers());
    setCurrentRecordId(null);
    setRecordStatus('rascunho');
    setSubmittedAt(undefined); setApprovedAt(undefined); setApprovedBy(undefined);
    setModalRecord(null);
    setFormOpen(false);
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
  const canSubmit = !isLocked && missingCount === 0 && !!header.analyst.trim();

  function startNewAudit() {
    let restored = false;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.header && data.answers) {
          setHeader({
            date: data.header.date || todayISO(),
            analyst: data.header.analyst || '',
            period: data.header.period || 'Dia completo',
            sentToGoAt: '',
          });
          setAnswers({ ...emptyAnswers(), ...data.answers });
          setCurrentRecordId(data.recordId || null);
          setRecordStatus(data.status === 'contestado' ? 'contestado' : 'rascunho');
          setSubmittedAt(undefined);
          setApprovedAt(undefined);
          setApprovedBy(undefined);
          restored = true;
        }
      }
    } catch {}
    if (!restored) {
      setHeader({ date: todayISO(), analyst: '', period: 'Dia completo', sentToGoAt: '' });
      setAnswers(emptyAnswers());
      setCurrentRecordId(null);
      setRecordStatus('rascunho');
      setSubmittedAt(undefined); setApprovedAt(undefined); setApprovedBy(undefined);
    }
    setModalRecord(null);
    setFormOpen(true);
    setTab('checklist');
  }

  function openRecord(r: AuditRecord) {
    setModalRecord(r);
  }

  function closeModal() {
    setModalRecord(null);
  }

  function loadIntoChecklist(r: AuditRecord) {
    setHeader({ ...r.header });
    setAnswers({ ...emptyAnswers(), ...r.answers });
    setCurrentRecordId(r.id);
    setRecordStatus(r.status);
    setSubmittedAt(r.submittedAt);
    setApprovedAt(r.approvedAt);
    setApprovedBy(r.approvedBy);
    setModalRecord(null);
    setFormOpen(true);
    setTab('checklist');
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

  const persistMemory = useCallback(() => {
    if (isLocked || !formOpen) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        header: { ...header, sentToGoAt: '' },
        answers,
        recordId: currentRecordId,
        status: recordStatus === 'contestado' ? 'contestado' : 'rascunho',
        updatedAt: new Date().toISOString(),
      }));
    } catch {}
  }, [isLocked, formOpen, header, answers, currentRecordId, recordStatus, storageKey]);

  useEffect(() => {
    if (!formOpen || isLocked) return;
    const t = window.setTimeout(() => persistMemory(), 400);
    return () => window.clearTimeout(t);
  }, [header, answers, formOpen, isLocked, persistMemory]);

  useEffect(() => {
    if (tab !== 'checklist' && formOpen && !isLocked) {
      persistMemory();
    }
  }, [tab, formOpen, isLocked, persistMemory]);

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
    try { localStorage.removeItem(storageKey); } catch {}
    toast.success('Enviada para aprovação');
  };

  const inputCls = 'w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400';
  const inputLocked = 'w-full h-9 rounded-lg border border-slate-100 bg-slate-50 px-2.5 text-[13px] text-slate-600 cursor-not-allowed';

  return (
    <div className="space-y-4 pb-10">
      {modalRecord && (
        <AuditDetailModal
          record={modalRecord}
          onClose={closeModal}
          onEdit={() => loadIntoChecklist(modalRecord)}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onChangeHotel} className="text-[11px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Trocar hotel · {hotelName}
        </button>
        {busy && <span className="inline-flex items-center gap-1.5 text-[12px] text-blue-700"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processando…</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-0">
        <div className="flex flex-wrap items-center gap-1">
          {([
            { id: 'checklist' as const, label: 'Checklist', icon: ClipboardCheck },
            { id: 'historico' as const, label: 'Histórico', icon: History },
            { id: 'hits_getnet' as const, label: 'PMS × Adquirente', icon: Link2 },
            { id: 'getnet_bank' as const, label: 'Adquirente × Banco', icon: Scale },
            { id: 'taxas' as const, label: 'Taxas', icon: Settings2 },
            { id: 'aprovacao' as const, label: 'Aprovação', icon: CheckCircle2 },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'px-3 py-2.5 text-[13px] font-medium border-b-2 -mb-px inline-flex items-center gap-1.5',
                tab === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {id === 'aprovacao' && pendingApproval.length > 0 && (
                <span className="ml-0.5 text-[10px] font-bold bg-blue-600 text-white rounded-full min-w-[16px] h-4 px-1 inline-flex items-center justify-center">
                  {pendingApproval.length}
                </span>
              )}
              {id === 'historico' && history.length > 0 && tab !== 'historico' && (
                <span className="ml-0.5 text-[10px] font-semibold text-slate-400">{history.length}</span>
              )}
            </button>
          ))}
        </div>
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
                Clique em <strong>Nova auditoria</strong> para iniciar o preenchimento. O progresso fica guardado se você mudar de aba.
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
              {recordStatus === 'aprovado' && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] text-emerald-950 flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5"><Eye className="w-4 h-4" /> Aprovada · somente leitura · {approvedAt ? formatDateTimeBR(approvedAt) : ''}</span>
                  <button type="button" onClick={startNewAudit} className="text-[12px] font-semibold text-emerald-900 underline">Nova auditoria</button>
                </div>
              )}
              {recordStatus === 'aguardando' && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-[13px] text-blue-950">
                  Aguardando aprovação · enviada {submittedAt ? formatDateTimeBR(submittedAt) : '—'} · veja a aba Aprovação
                </div>
              )}
              {recordStatus === 'contestado' && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-950">
                  Contestada — corrija e envie novamente
                  {currentRecordId && getRecord(currentRecordId)?.contestComment && (
                    <span className="block text-[12px] mt-1">Motivo: {getRecord(currentRecordId)?.contestComment}</span>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
                  <label className="space-y-0.5">
                    <span className="text-[10px] uppercase text-slate-400 font-semibold">Data da auditoria</span>
                    <input type="date" className={isLocked ? inputLocked : inputCls} value={header.date} disabled={isLocked} onChange={(e) => setHeader({ ...header, date: e.target.value })} />
                  </label>
                  <label className="space-y-0.5">
                    <span className="text-[10px] uppercase text-slate-400 font-semibold">Analista financeira</span>
                    <input className={isLocked ? inputLocked : inputCls} value={header.analyst} disabled={isLocked} onChange={(e) => setHeader({ ...header, analyst: e.target.value })} placeholder="Nome" />
                  </label>
                </div>
                {(submittedAt || approvedAt) && (
                  <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-600">
                    {submittedAt && <span>Envio: <strong className="text-slate-900">{formatDateTimeBR(submittedAt)}</strong></span>}
                    {approvedAt && <span>Aprovação: <strong className="text-slate-900">{formatDateTimeBR(approvedAt)}</strong> ({approvedBy || 'GO'})</span>}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {visibleItems.map((item) => {
                  const a = answers[item.id] || { status: '' as ItemStatus, notes: '' };
                  return (
                    <div key={item.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                      <div className="px-4 py-2.5 border-b bg-slate-50/80 flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-slate-900">
                            <span className="text-slate-400 font-medium mr-1">{String(item.id).padStart(2, '0')}.</span>
                            {item.title}
                          </p>
                          {item.fridayOnly && (
                            <span className="inline-block mt-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">
                              Obrigatório às sextas · comprovante de depósito
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button type="button" disabled={isLocked} onClick={() => setAnswer(item.id, { status: 'conforme' })} className={cn('h-8 px-3 rounded-md text-[11px] font-bold uppercase border disabled:cursor-not-allowed', a.status === 'conforme' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-500')}>Conforme</button>
                          <button type="button" disabled={isLocked} onClick={() => setAnswer(item.id, { status: 'divergencia' })} className={cn('h-8 px-3 rounded-md text-[11px] font-bold uppercase border disabled:cursor-not-allowed', a.status === 'divergencia' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-500 border-slate-200 hover:border-rose-500')}>Divergência</button>
                        </div>
                      </div>
                      <div className="px-4 py-3 space-y-2">
                        <ul className="text-[12px] text-slate-600 list-disc pl-4 space-y-0.5">{item.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
                        <textarea
                          className={cn('w-full min-h-[56px] rounded-lg border px-2.5 py-2 text-[13px]', isLocked ? 'bg-slate-50 border-slate-100 cursor-not-allowed' : 'border-slate-200')}
                          value={a.notes}
                          disabled={isLocked}
                          onChange={(e) => setAnswer(item.id, { notes: e.target.value })}
                          placeholder={isLocked ? '' : (item.fridayOnly ? 'Referência do comprovante / resolutiva…' : 'Resolutiva…')}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {!isLocked && (
                <div className="sticky bottom-0 z-10 -mx-1 px-1 pt-2 pb-1 bg-gradient-to-t from-[#eef1f6] via-[#eef1f6] to-transparent">
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={submitForApproval}
                      disabled={!canSubmit}
                      className="h-10 px-5 rounded-lg bg-blue-600 text-white text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-500"
                    >
                      Salvar e enviar para aprovação
                    </button>
                    {missingCount > 0 ? (
                      <span className="text-[12px] text-amber-800">Faltam {missingCount} item(ns) obrigatório(s)</span>
                    ) : !header.analyst.trim() ? (
                      <span className="text-[12px] text-amber-800">Informe o nome da analista</span>
                    ) : (
                      <span className="text-[12px] text-emerald-700">Pronto para enviar</span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'historico' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b bg-slate-50/80 text-[12px] font-semibold">Histórico · {history.length}</div>
            <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 bg-white z-10 border-b">
                  <tr className="text-left text-[10px] uppercase text-slate-400">
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Analista</th>
                    <th className="px-3 py-2">Envio</th>
                    <th className="px-3 py-2">Aprovação</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {history.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">Nenhuma auditoria neste hotel</td></tr>
                  ) : history.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => openRecord(r)}
                      onDoubleClick={() => openRecord(r)}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="px-3 py-2 font-semibold">{formatDateBR(r.header.date)}</td>
                      <td className="px-3 py-2">{r.header.analyst || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{r.submittedAt ? formatDateTimeBR(r.submittedAt) : '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{r.approvedAt ? formatDateTimeBR(r.approvedAt) : '—'}</td>
                      <td className="px-3 py-2">
                        <span className={cn(
                          'text-[10px] font-bold uppercase px-2 py-0.5 rounded text-white',
                          r.status === 'aprovado' && 'bg-emerald-600',
                          r.status === 'aguardando' && 'bg-blue-600',
                          r.status === 'contestado' && 'bg-amber-500',
                          r.status === 'rascunho' && 'bg-slate-400'
                        )}>{statusLabel(r.status)}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openRecord(r); }}
                          className="h-7 px-2 rounded-lg bg-blue-600 text-white text-[11px] font-semibold"
                        >
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
                <thead className="border-b sticky top-0 bg-white">
                  <tr className="text-left text-[10px] uppercase text-slate-400">
                    <th className="px-3 py-2">Status</th><th className="px-3 py-2">PMS</th><th className="px-3 py-2">Adquirente</th>
                    <th className="px-3 py-2 text-right">PMS líq.</th><th className="px-3 py-2 text-right">Adq. líq.</th><th className="px-3 py-2 text-right">Δ</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {hitsGetnetMatches.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Envie os dois relatórios</td></tr>
                  ) : hitsGetnetMatches.map((m) => (
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
          <p className="text-[12px] text-slate-500">Líquido esperado usa taxas do hotel · antecipação D+1</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <UploadCard title="Adquirente — Vendas" count={getnet.length} onFile={(f) => loadFile('getnet', f)} onPaste={() => setPasteOpen('getnet')} />
            <UploadCard title="Extrato bancário" count={bank.length} onFile={(f) => loadFile('bank', f)} onPaste={() => setPasteOpen('bank')} />
          </div>
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="border-b">
                <tr className="text-left text-[10px] uppercase text-slate-400">
                  <th className="px-3 py-2">Liquidação</th><th className="px-3 py-2 text-right">Esperado</th>
                  <th className="px-3 py-2 text-right">Banco</th><th className="px-3 py-2 text-right">Δ</th><th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {bankMatches.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Envie adquirente + extrato</td></tr>
                ) : bankMatches.map((r) => (
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
          {pendingApproval.length === 0 ? (
            <div className="rounded-2xl border border-dashed px-4 py-12 text-center text-[13px] text-slate-400">Nenhuma auditoria aguardando</div>
          ) : pendingApproval.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="text-[14px] font-semibold">{r.hotelName}</p>
                  <p className="text-[12px] text-slate-500">
                    {formatDateBR(r.header.date)} · {r.header.analyst || '—'} · enviada {r.submittedAt ? formatDateTimeBR(r.submittedAt) : '—'}
                  </p>
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
            <div className="px-5 py-3 border-b bg-slate-50 flex justify-between">
              <p className="font-semibold text-[14px]">Colar texto — {pasteOpen}</p>
              <button type="button" onClick={() => setPasteOpen(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4">
              <textarea className="w-full min-h-[200px] rounded-lg border p-3 text-[12px] font-mono" value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
            </div>
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

function AuditDetailModal({
  record,
  onClose,
  onEdit,
}: {
  record: AuditRecord;
  onClose: () => void;
  onEdit: () => void;
}) {
  const locked = record.status === 'aprovado' || record.status === 'aguardando';
  const canEdit = record.status === 'rascunho' || record.status === 'contestado';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/50" onClick={onClose} aria-label="Fechar" />
      <div className="relative z-10 w-full max-w-3xl bg-[#f0f2f5] rounded-2xl shadow-2xl border border-slate-300 max-h-[min(860px,90vh)] flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b bg-[#0c2340] text-white flex items-start justify-between gap-3 shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-300">Auditoria · {record.hotelName}</p>
            <h2 className="text-lg font-semibold mt-0.5">
              {formatDateBR(record.header.date)} · {record.header.analyst || 'Sem analista'}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className={cn(
                'inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white',
                record.status === 'aprovado' && 'bg-emerald-500',
                record.status === 'aguardando' && 'bg-blue-500',
                record.status === 'contestado' && 'bg-amber-500',
                record.status === 'rascunho' && 'bg-slate-400'
              )}>
                {statusLabel(record.status)}
              </span>
              {record.submittedAt && (
                <span className="text-[11px] text-sky-200">Envio {formatDateTimeBR(record.submittedAt)}</span>
              )}
              {record.approvedAt && (
                <span className="text-[11px] text-sky-200">Aprovação {formatDateTimeBR(record.approvedAt)}</span>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg border border-white/20 flex items-center justify-center hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {record.status === 'contestado' && record.contestComment && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-950">
              <strong>Contestação:</strong> {record.contestComment}
            </div>
          )}

          {CHECKLIST.map((item) => {
            const a = record.answers[item.id];
            return (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-3 py-2 border-b bg-slate-50/80 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold text-slate-900">
                    <span className="text-slate-400 font-medium mr-1">{String(item.id).padStart(2, '0')}.</span>
                    {item.title}
                  </p>
                  {a?.status ? (
                    <span className={cn(
                      'text-[10px] font-bold uppercase px-2 py-0.5 rounded text-white',
                      a.status === 'conforme' ? 'bg-emerald-600' : 'bg-rose-600'
                    )}>
                      {a.status === 'conforme' ? 'Conforme' : 'Divergência'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-slate-400">Sem status</span>
                  )}
                </div>
                {a?.notes ? (
                  <div className="px-3 py-2">
                    <p className="text-[12px] text-slate-700 whitespace-pre-wrap">{a.notes}</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t bg-white flex flex-wrap gap-2 justify-end shrink-0">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-slate-200 text-[13px] font-medium hover:bg-slate-50">
            Fechar
          </button>
          {canEdit && (
            <button type="button" onClick={onEdit} className="h-9 px-4 rounded-lg bg-blue-600 text-white text-[13px] font-semibold hover:bg-blue-500">
              Editar no checklist
            </button>
          )}
          {locked && (
            <span className="self-center text-[11px] text-slate-500">Somente leitura</span>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadCard({ title, count, onFile, onPaste }: { title: string; count: number; onFile: (f: File) => void; onPaste: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 shadow-sm space-y-3">
      <div className="flex gap-2">
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
