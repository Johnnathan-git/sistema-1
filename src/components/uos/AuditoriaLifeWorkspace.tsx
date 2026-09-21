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

  // NOTE: FULL FILE CONTINUES - this push is incomplete intentionally to be fixed
  return <div>INCOMPLETE</div>;
}
