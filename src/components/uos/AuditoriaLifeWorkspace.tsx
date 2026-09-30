import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ClipboardCheck, Eye, FileText,
  History, Link2, Loader2, Plus, Scale, Settings2, Upload, X, Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { TaxasFeeMatrix } from '@/components/uos/TaxasFeeMatrix';
import {
  parsePmsText, parseGetnetText, parseSantanderText, reconcilePmsGetnet, reconcileGetnetBank,
  formatBRL, formatDateBR, todayISO, isFriday, fileToText, pmsFileToText,
  type PmsPayment, type GetnetSale, type BankLine, type FeeRule, type PmsGetnetMatch, CHECKLIST,
} from '@/lib/auditoria-core';
import {
  auditStorageKey, defaultFeesForHotel, feesStorageKey, type HotelId,
} from '@/lib/auditoria-hotels';
import {
  type AuditWorkflowStatus, type ItemAnswer,
  newRecordId, recordsForHotel, historyRecordsForHotel, statusLabel, upsertRecord, getRecord, type AuditRecord,
  emptyItem, deriveStatus, listPendingItems, canCloseAudit, countOpenPendencies, appendLog,
} from '@/lib/auditoria-workflow';
import { ConciliationPanel, PendenciasPanel, AuditDetailModal } from '@/components/uos/AuditoriaLifePanels';
import { getSession, isAuditPendenciasOnly, listActiveUsers } from '@/lib/auth-store';

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

function openAttachment(dataUrl?: string, fileName?: string) {
  if (!dataUrl) return;
  try {
    const m = dataUrl.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/);
    if (!m) {
      window.open(dataUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    const mime = m[1] || 'application/octet-stream';
    const b64 = m[2];
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'anexo';
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName || 'anexo';
    a.click();
  }
}

function emptyAnswers(): Record<number, ItemAnswer> {
  const init: Record<number, ItemAnswer> = {};
  for (const c of CHECKLIST) init[c.id] = emptyItem();
  return init;
}

function mergeGetnetSales(current: GetnetSale[], incoming: GetnetSale[]): GetnetSale[] {
  const seen = new Set<string>();
  const merged: GetnetSale[] = [];
  const all = [...current, ...incoming];

  for (const sale of all) {
    const key = [
      sale.date || '', sale.time || '', sale.auth || '', sale.cv || '', sale.brand || '',
      sale.form || sale.modality || '', String(sale.installments || 1), sale.gross.toFixed(2), sale.status || '',
    ].join('|').toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ ...sale, id: `g-${merged.length + 1}` });
  }

  return merged;
}

function isPmsGetnetPayment(row: PmsPayment): boolean {
  const group = (row.paymentGroup || '').trim();
  return /^(?:Get(?:net)?\b|PIX\b)/i.test(group);
}

function isPmsCashPayment(row: PmsPayment): boolean {
  return /\bdinheiro\b/i.test((row.paymentGroup || '').trim());
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
  const onlyPendencias = isAuditPendenciasOnly(session);
  const [topTab, setTopTab] = useState<TopTab>('etapas');
  const [etapa, setEtapa] = useState<EtapaTab>(onlyPendencias ? 'pendencias' : 'abrir');

  useEffect(() => {
    if (onlyPendencias) {
      setTopTab('etapas');
      setEtapa('pendencias');
    }
  }, [onlyPendencias]);
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
  const [pms, setPms] = useState<PmsPayment[]>([]);
  const [getnet, setGetnet] = useState<GetnetSale[]>([]);
  const [bank, setBank] = useState<BankLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [pasteOpen, setPasteOpen] = useState<'pms' | 'getnet' | 'bank' | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [tick, setTick] = useState(0);
  const [modalRecord, setModalRecord] = useState<AuditRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    setTopTab('etapas');
    setEtapa(onlyPendencias ? 'pendencias' : 'abrir');
    setConciliacaoSub('hits_getnet');
    setPms([]);
    setGetnet([]);
    setBank([]);
    setHeader({ date: todayISO(), analyst: '', period: 'Dia completo', sentToGoAt: '' });
    setAnswers(emptyAnswers());
    setModalRecord(null);
    setFormOpen(false);
  }, [hotelId, onlyPendencias]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(feesStorageKey(hotelId));
      if (raw) setFees(JSON.parse(raw));
      else setFees(defaultFeesForHotel(hotelId));
    } catch {
      setFees(defaultFeesForHotel(hotelId));
    }
  }, [hotelId]);

  const history = useMemo(() => historyRecordsForHotel(hotelId), [hotelId, tick]);
  const pendingItems = useMemo(() => {
    const items = listPendingItems({ hotelId });
    return items.map((p) => ({
      ...p,
      itemTitle: CHECKLIST.find((c) => c.id === p.itemId)?.title || `Item ${p.itemId}`,
    }));
  }, [hotelId, tick]);

  const pmsForGetnet = useMemo(() => pms.filter(isPmsGetnetPayment), [pms]);
  const pmsOtherAcquirers = useMemo(
    () => pms.filter((row) => !isPmsCashPayment(row) && !isPmsGetnetPayment(row)),
    [pms],
  );
  const pmsVisible = useMemo(() => pms.filter((row) => !isPmsCashPayment(row)), [pms]);
  const pmsMatches = useMemo(() => {
    const matched = reconcilePmsGetnet(pmsForGetnet, getnet);
    const otherRows: PmsGetnetMatch[] = pmsOtherAcquirers.map((row, index) => ({
      id: `pm-other-${index + 1}-${row.id}`,
      side: 'divergence',
      pms: row,
      score: 0,
      matchedBy: 'adquirente diferente da Getnet',
      differences: [`Adquirente no PMS: ${row.paymentGroup || 'não identificada'} — recebimento não pertence à Getnet`],
    }));
    return [...otherRows, ...matched];
  }, [pmsForGetnet, pmsOtherAcquirers, getnet]);
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
    setHeader((h) => ({
      ...h,
      date: todayISO(),
      analyst: (session?.displayName || '').trim(),
      period: 'Dia completo',
      sentToGoAt: '',
    }));
    setFormOpen(true);
    setEtapa('abrir');
  };

  const saveAudit = () => {
    try {
      const analystName = (header.analyst || session?.displayName || '').trim();
      if (!analystName) {
        toast.error('Informe o nome da analista');
        return;
      }
      const answered = Object.values(answers).filter((a) => a?.status);
      if (answered.length === 0) {
        toast.error('Marque ao menos um item do checklist');
        return;
      }
      for (const [idStr, a] of Object.entries(answers)) {
        if (a?.status === 'divergencia' && !(a.notes || '').trim()) {
          toast.error(`Item ${idStr}: descreva a divergência`);
          return;
        }
      }
      const id = newRecordId();
      const now = new Date().toISOString();
      const requiredIds = CHECKLIST.map((c) => c.id);
      const allAnswered = requiredIds.every((rid) => answers[rid]?.status);
      const canClose = allAnswered && canCloseAudit(answers, requiredIds);
      const status = canClose ? 'fechada' : deriveStatus(answers, false);
      const analyst = analystName;
      const divCount = Object.values(answers).filter((a) => a?.status === 'divergencia').length;
      const confCount = Object.values(answers).filter((a) => a?.status === 'conforme').length;
      let logs = appendLog(undefined, analyst, `Auditoria registrada (${confCount} conforme, ${divCount} divergência)`);
      if (canClose) {
        logs = appendLog(logs, analyst, 'Auditoria concluída — sem pendências');
      }
      const rec: AuditRecord = {
        id,
        hotelId,
        hotelName,
        header: { ...header, analyst },
        answers: { ...answers },
        status,
        createdAt: now,
        updatedAt: now,
        closedAt: canClose ? now : undefined,
        closedBy: canClose ? analyst : undefined,
        logs,
      };
      upsertRecord(rec);
      setTick((t) => t + 1);
      if (canClose) {
        toast.success('Auditoria registrada e concluída — disponível no Histórico');
        resetForm();
        setEtapa('historico');
      } else {
        toast.success(
          status === 'pendente' || status === 'aguardando_analista'
            ? 'Auditoria registrada no Histórico (Pendente) — divergências em Pendências'
            : 'Auditoria registrada',
        );
        resetForm();
      }
    } catch (e: any) {
      console.error('saveAudit', e);
      toast.error(e?.message || 'Erro ao registrar auditoria. Tente novamente.');
    }
  };

  const hotelResolve = (auditId: string, itemId: number, resolution: string, attName?: string, attData?: string) => {
    const rec = getRecord(auditId);
    if (!rec) return;
    if (!resolution.trim()) {
      toast.error('Descreva a resolução da pendência (obrigatório)');
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
    const itemTitle = CHECKLIST.find((c) => c.id === itemId)?.title || `Item ${itemId}`;
    const logs = appendLog(rec.logs, 'Hotel', `Resolução enviada no item ${itemId} (${itemTitle})`);
    upsertRecord({ ...rec, answers, status, updatedAt: new Date().toISOString(), logs });
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
    const analyst = rec.header.analyst || 'Analista';
    const itemTitle = CHECKLIST.find((c) => c.id === itemId)?.title || `Item ${itemId}`;
    let logs = appendLog(rec.logs, analyst, `Aprovou item ${itemId} (${itemTitle})`);
    if (canClose) {
      logs = appendLog(logs, analyst, 'Auditoria 100% concluída — enviada ao Histórico');
    }
    upsertRecord({
      ...rec,
      answers,
      status,
      updatedAt: now,
      closedAt: canClose ? now : rec.closedAt,
      closedBy: canClose ? analyst : rec.closedBy,
      logs,
    });
    setTick((t) => t + 1);
    toast.success(canClose ? 'Item aprovado — auditoria concluída no Histórico' : 'Item aprovado');
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
    const analyst = rec.header.analyst || 'Analista';
    const itemTitle = CHECKLIST.find((c) => c.id === itemId)?.title || `Item ${itemId}`;
    const logs = appendLog(rec.logs, analyst, `Recusou item ${itemId} (${itemTitle}): ${reason.trim()}`);
    upsertRecord({ ...rec, answers, status, updatedAt: new Date().toISOString(), logs });
    setTick((t) => t + 1);
    toast.message('Pendência devolvida ao hotel');
  };

  const loadFile = async (kind: 'pms' | 'getnet' | 'bank', file: File | File[]) => {
    setBusy(true);
    try {
      if (kind === 'getnet') {
        const files = Array.isArray(file) ? file : [file];
        const incoming: GetnetSale[] = [];
        for (const f of files) {
          const rows = parseGetnetText(await fileToText(f));
          rows.forEach((r) => incoming.push(r));
        }
        setGetnet((current) => mergeGetnetSales(current, incoming));
        toast.success(`${incoming.length} venda(s) Getnet adicionada(s) de ${files.length} arquivo(s)`);
        return;
      }
      const selectedFile = Array.isArray(file) ? file[0] : file;
      const text = kind === 'pms' ? await pmsFileToText(selectedFile) : await fileToText(selectedFile);
      if (kind === 'pms') {
        const rows = parsePmsText(text);
        const getnetRows = rows.filter(isPmsGetnetPayment);
        const otherAcquirers = rows.filter((row) => !isPmsCashPayment(row) && !isPmsGetnetPayment(row));
        const cashRows = rows.filter(isPmsCashPayment);
        setPms(rows);
        toast.success(`${getnetRows.length} Getnet/PIX · ${otherAcquirers.length} outra(s) adquirente(s) com divergência${cashRows.length ? ` · ${cashRows.length} dinheiro ignorado(s)` : ''}`);
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
      if (pasteOpen === 'pms') {
        const rows = parsePmsText(pasteText);
        const getnetRows = rows.filter(isPmsGetnetPayment);
        const otherAcquirers = rows.filter((row) => !isPmsCashPayment(row) && !isPmsGetnetPayment(row));
        const cashRows = rows.filter(isPmsCashPayment);
        setPms(rows);
        toast.success(`${getnetRows.length} Getnet/PIX · ${otherAcquirers.length} outra(s) adquirente(s) com divergência${cashRows.length ? ` · ${cashRows.length} dinheiro ignorado(s)` : ''}`);
      } else if (pasteOpen === 'getnet') {
        const rows = parseGetnetText(pasteText);
        setGetnet((current) => mergeGetnetSales(current, rows));
        toast.success(`${rows.length} venda(s) Getnet adicionada(s)`);
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {onChangeHotel && (
          <button
            type="button"
            onClick={onChangeHotel}
            className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-[12px] font-medium text-slate-600 inline-flex items-center gap-1.5 hover:bg-slate-50 shadow-sm transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Trocar hotel · {hotelName}
          </button>
        )}
        {busy && (
          <span className="text-[12px] text-slate-500 inline-flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processando…
          </span>
        )}
      </div>

      {!onlyPendencias && (
      <div className="flex flex-wrap gap-1 border-b border-slate-200/80 bg-white rounded-t-xl px-1 pt-1 shadow-sm">
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
              'h-10 px-4 text-[13px] font-semibold inline-flex items-center gap-2 border-b-2 -mb-px transition-all rounded-t-lg',
              topTab === id
                ? 'border-sky-500 text-slate-900 bg-sky-50/60'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/80',
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>
      )}

      {topTab === 'etapas' && (
        <div className="space-y-4">
          {!onlyPendencias && (
          <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100/90 p-1 w-fit border border-slate-200/60">
            {(
              [
                ['abrir', 'Abrir Auditoria'],
                ['pendencias', `Pendências${openCount + resolvedCount ? ` (${openCount + resolvedCount})` : ''}`],
                ['historico', 'Histórico'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setEtapa(id)}
                className={cn(
                  'h-8 px-3.5 rounded-lg text-[12px] font-semibold transition-all',
                  etapa === id ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          )}
          {onlyPendencias && (
            <div className="rounded-xl bg-sky-50 border border-sky-100 px-3 py-2 text-[12px] text-sky-900 font-medium">
              Pendências — resolução de divergências
            </div>
          )}

          {etapa === 'abrir' && !onlyPendencias && (
            <div className="space-y-4">
              {!formOpen ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-gradient-to-b from-white to-slate-50/80 px-6 py-16 text-center shadow-sm">
                  <ClipboardCheck className="w-11 h-11 text-sky-300 mx-auto mb-3" />
                  <p className="text-[15px] font-semibold text-slate-800">Nova auditoria</p>
                  <p className="text-[13px] text-slate-500 mt-1 max-w-md mx-auto">
                    Abra uma auditoria do dia. Divergências vão para Pendências e a auditoria aparece no Histórico com status Pendente até ser 100% concluída.
                  </p>
                  <button
                    type="button"
                    onClick={startNewAudit}
                    className="mt-5 h-10 px-5 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white text-[13px] font-semibold inline-flex items-center gap-2 hover:from-slate-800 hover:to-slate-700 shadow-lg shadow-slate-900/15 transition-all"
                  >
                    <Plus className="w-4 h-4" /> Abrir auditoria
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                    <label className="space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Data da auditoria</span>
                      <input type="date" value={header.date} onChange={(e) => setHeader((h) => ({ ...h, date: e.target.value }))} className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px] outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all bg-white" />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Analista</span>
                      <input value={header.analyst} onChange={(e) => setHeader((h) => ({ ...h, analyst: e.target.value }))} placeholder="Nome" className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px] outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all bg-white" />
                    </label>
                  </div>

                  <div className="space-y-2">
                    {CHECKLIST.map((item) => {
                      const a = answers[item.id] || emptyItem();
                      return (
                        <div key={item.id} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm space-y-3 hover:border-slate-300/80 transition-colors">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-slate-900">{item.id}. {item.title}</p>
                              {item.bullets && item.bullets.length > 0 && (
                                <ul className="mt-1.5 space-y-0.5 list-disc list-inside">
                                  {item.bullets.map((b, bi) => (
                                    <li key={bi} className="text-[11px] text-slate-500 leading-snug">{b}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div className="flex gap-1.5">
                              <button type="button" onClick={() => setAnswer(item.id, { status: 'conforme' })} className={cn('h-8 px-3.5 rounded-lg text-[11px] font-semibold border transition-all', a.status === 'conforme' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/20' : 'border-slate-200 text-slate-600 hover:bg-emerald-50')}>Conforme</button>
                              <button type="button" onClick={() => setAnswer(item.id, { status: 'divergencia' })} className={cn('h-8 px-3.5 rounded-lg text-[11px] font-semibold border transition-all', a.status === 'divergencia' ? 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-600/20' : 'border-slate-200 text-slate-600 hover:bg-rose-50')}>Divergência</button>
                            </div>
                          </div>
                          {(a.status === 'conforme' || a.status === 'divergencia') && (
                            <div className="space-y-2 border-t border-slate-100 pt-3">
                              <textarea
                                value={a.notes}
                                onChange={(e) => setAnswer(item.id, { notes: e.target.value })}
                                placeholder={a.status === 'divergencia' ? 'Descreva a divergência…' : 'Observação (opcional)…'}
                                className="w-full min-h-[64px] rounded-xl border border-slate-200 px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all"
                              />
                              {a.status === 'divergencia' && (
                                <div className="flex flex-wrap items-center gap-2">
                                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                    Responsável
                                  </label>
                                  <select
                                    value={(a as any).assignedTo || ''}
                                    onChange={(e) =>
                                      setAnswer(item.id, { assignedTo: e.target.value || undefined } as any)
                                    }
                                    className="h-8 min-w-[200px] rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                                  >
                                    <option value="">Selecione o responsável…</option>
                                    {listActiveUsers().map((u) => (
                                      <option key={u.id} value={u.displayName || u.email}>
                                        {u.displayName || u.email}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-[11px] font-medium cursor-pointer inline-flex items-center gap-1.5 hover:bg-slate-50 hover:border-slate-300 transition-all">
                                  <Upload className="w-3.5 h-3.5 text-slate-500" /> {a.attachmentName ? 'Trocar anexo' : 'Anexar arquivo'}
                                  <input type="file" accept=".pdf,image/*,.txt,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && readAttachment(item.id, e.target.files[0])} />
                                </label>
                                {a.attachmentName && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => openAttachment(a.attachmentDataUrl, a.attachmentName)}
                                      className="text-[11px] text-sky-700 font-medium truncate max-w-[180px] hover:underline text-left"
                                      title="Abrir anexo"
                                    >
                                      {a.attachmentName}
                                    </button>
                                    <button type="button" onClick={() => clearAttachment(item.id)} className="h-7 w-7 rounded-md text-rose-600 hover:bg-rose-50 inline-flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap justify-end gap-2 pt-2">
                    <button type="button" onClick={resetForm} className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-[13px] font-medium hover:bg-slate-50 transition-all">Cancelar</button>
                    <button type="button" onClick={saveAudit} className="h-10 px-5 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white text-[13px] font-semibold hover:from-slate-800 hover:to-slate-700 shadow-md shadow-slate-900/15 transition-all">Registrar auditoria</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {etapa === 'historico' && !onlyPendencias && (
            <div className="space-y-3">
              {history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-gradient-to-b from-white to-slate-50/80 px-6 py-16 text-center shadow-sm">
                  <History className="w-11 h-11 text-sky-300 mx-auto mb-3" />
                  <p className="text-[15px] font-semibold text-slate-800">Nenhuma auditoria ainda</p>
                  <p className="text-[13px] text-slate-500 mt-1">Auditorias 100% concluídas aparecem aqui após aprovação de todas as pendências</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="border-b bg-slate-50/80 text-[10px] uppercase text-slate-400">
                          <th className="px-4 py-2.5 text-left font-semibold">Data</th>
                          <th className="px-4 py-2.5 text-left font-semibold">Analista</th>
                          <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                          <th className="px-4 py-2.5 text-left font-semibold">Atualizado</th>
                          <th className="px-4 py-2.5 text-right font-semibold">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {history.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50/60">
                            <td className="px-4 py-2.5 font-medium text-slate-800">{formatDateBR(r.header.date)}</td>
                            <td className="px-4 py-2.5 text-slate-600">{r.header.analyst || '—'}</td>
                            <td className="px-4 py-2.5">
                              <span className={cn(
                                'text-[10px] font-bold uppercase px-2.5 py-1 rounded-full tracking-wide',
                                r.status === 'fechada' && 'bg-emerald-100 text-emerald-800',
                                r.status === 'pendente' && 'bg-amber-100 text-amber-900',
                                r.status === 'em_andamento' && 'bg-slate-100 text-slate-700',
                                r.status === 'aguardando_analista' && 'bg-sky-100 text-sky-900',
                              )}>{statusLabel(r.status)}</span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-500">{formatDateTimeBR(r.updatedAt)}</td>
                            <td className="px-4 py-2.5 text-right">
                              <button type="button" onClick={() => setModalRecord(r)} className="h-7 px-2.5 rounded-lg border border-slate-200 text-[11px] font-medium hover:bg-slate-50 inline-flex items-center gap-1">
                                <Eye className="w-3.5 h-3.5" /> Ver
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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

      {topTab === 'conciliacao' && !onlyPendencias && (
        <ConciliationPanel
          sub={conciliacaoSub}
          setSub={setConciliacaoSub}
          pms={pmsVisible}
          getnet={getnet}
          bank={bank}
          pmsMatches={pmsMatches}
          bankMatches={bankMatches}
          busy={busy}
          onLoadFile={loadFile}
          pasteOpen={pasteOpen}
          setPasteOpen={setPasteOpen}
          pasteText={pasteText}
          setPasteText={setPasteText}
          onApplyPaste={applyPaste}
        />
      )}

      {topTab === 'taxas' && !onlyPendencias && (
        <TaxasFeeMatrix
          hotelId={hotelId}
          hotelName={hotelName}
          onActiveFeesChange={setFees}
        />
      )}

      {modalRecord && (
        <AuditDetailModal record={modalRecord} onClose={() => setModalRecord(null)} />
      )}
    </div>
  );
}
