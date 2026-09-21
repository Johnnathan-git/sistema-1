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

    if (allOk) toast.success('Auditoria concluída · disponível no Histórico');
    else toast.success('Auditoria registrada como Pendente · divergências nas Pendências');
    setEtapa('historico');
  };

  // PLACEHOLDER_REST - will continue
  return null;
}
