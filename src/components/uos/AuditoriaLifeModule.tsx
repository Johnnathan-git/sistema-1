/**
 * Auditoria Life — hotel → checklist + conciliações + taxas + aprovação
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Link2,
  Loader2,
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
} from '@/lib/auditoria-workflow';

type TabId = 'checklist' | 'hits_getnet' | 'getnet_bank' | 'taxas' | 'aprovacao';

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
            className="text-left rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-400 hover:shadow-md transition-all group"
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

  const [header, setHeader] = useState({
    date: todayISO(),
    analyst: '',
    period: 'Dia completo',
    sentToGoAt: '',
  });
  const [answers, setAnswers] = useState<Record<number, { status: ItemStatus; notes: string }>>(() => {
    const init: Record<number, { status: ItemStatus; notes: string }> = {};
    for (const c of CHECKLIST) init[c.id] = { status: '', notes: '' };
    return init;
  });
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
  const [tick, setTick] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.header) setHeader(data.header);
        if (data.answers) setAnswers(data.answers);
      }
    } catch {}
    setTab('checklist');
    setHits([]);
    setGetnet([]);
    setBank([]);
    setCurrentRecordId(null);
    setRecordStatus('rascunho');
  }, [hotelId, storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ header, answers }));
  }, [header, answers, storageKey]);

  const history = useMemo(() => {
    void tick;
    return recordsForHotel(hotelId);
  }, [hotelId, tick]);

  const pendingApproval = useMemo(() => {
    void tick;
    return recordsPendingApproval();
  }, [tick]);

  const hitsGetnetMatches = useMemo(() => reconcileHitsGetnet(hits, getnet), [hits, getnet]);
  const bankMatches = useMemo(() => reconcileGetnetBank(getnet, bank, fees), [getnet, bank, fees]);
  const hgStats = useMemo(
    () => ({
      both: hitsGetnetMatches.filter((m) => m.side === 'both').length,
      diff: hitsGetnetMatches.filter((m) => m.side === 'value_diff').length,
      ho: hitsGetnetMatches.filter((m) => m.side === 'hits_only').length,
      go: hitsGetnetMatches.filter((m) => m.side === 'getnet_only').length,
    }),
    [hitsGetnetMatches]
  );

  const friday = isFriday(header.date);
  const requiredItems = CHECKLIST.filter((c) => !c.fridayOnly || friday);
  const missingCount = requiredItems.filter((c) => !answers[c.id]?.status).length;
  const canSubmit = missingCount === 0 && !!header.analyst.trim();

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

  const setAnswer = (id: number, patch: Partial<{ status: ItemStatus; notes: string }>) => {
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const saveDraft = () => {
    const now = new Date().toISOString();
    const id = currentRecordId || newRecordId();
    const prev = getRecord(id);
    const status: AuditWorkflowStatus =
      recordStatus === 'aguardando' || recordStatus === 'contestado' ? recordStatus : 'rascunho';
    upsertRecord({
      id,
      hotelId,
      hotelName,
      header: { ...header },
      answers,
      status,
      createdAt: prev?.createdAt || now,
      updatedAt: now,
      contestComment: prev?.contestComment,
    });
    setCurrentRecordId(id);
    setRecordStatus(status);
    setTick((t) => t + 1);
    toast.success('Auditoria salva');
  };

  const submitForApproval = () => {
    if (!header.analyst.trim()) {
      toast.error('Informe o nome da analista');
      return;
    }
    if (missingCount > 0) {
      toast.error(`Marque todos os itens do checklist (${missingCount} sem status)`);
      return;
    }
    const now = new Date().toISOString();
    const id = currentRecordId || newRecordId();
    const prev = getRecord(id);
    upsertRecord({
      id,
      hotelId,
      hotelName,
      header: { ...header, sentToGoAt: header.sentToGoAt || header.date },
      answers,
      status: 'aguardando',
      createdAt: prev?.createdAt || now,
      updatedAt: now,
      submittedAt: now,
      contestComment: undefined,
    });
    setCurrentRecordId(id);
    setRecordStatus('aguardando');
    setTick((t) => t + 1);
    toast.success('Enviada para aprovação — veja a aba Aprovação');
  };

  const inputCls =
    'w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400';

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" onClick={onChangeHotel} className="text-[11px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3 h-3" /> Trocar hotel
          </button>
          <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-slate-500" />
            Auditoria · {hotelName}
          </h2>
          <p className="text-[12px] text-slate-500 mt-0.5">Checklist · conciliações · taxas · aprovação</p>
        </div>
        {busy && (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-blue-700">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processando…
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50/80 p-1 w-fit">
        {(
          [
            { id: 'checklist' as const, label: 'Checklist', icon: ClipboardCheck },
            { id: 'hits_getnet' as const, label: 'PMS × Adquirente', icon: Link2 },
            { id: 'getnet_bank' as const, label: 'Adquirente × Banco', icon: Scale },
            { id: 'taxas' as const, label: 'Taxas', icon: Settings2 },
            { id: 'aprovacao' as const, label: 'Aprovação', icon: CheckCircle2 },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'h-8 px-2.5 rounded-lg text-[12px] font-medium inline-flex items-center gap-1.5',
              tab === id ? 'bg-white border border-slate-200 shadow-sm' : 'text-slate-600'
            )}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
            {id === 'aprovacao' && pendingApproval.length > 0 && (
              <span className="ml-0.5 text-[10px] font-bold bg-blue-600 text-white rounded-full min-w-[16px] h-4 px-1 inline-flex items-center justify-center">
                {pendingApproval.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'checklist' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="space-y-0.5 text-[12px]">
              <span className="text-[10px] uppercase text-slate-400 font-semibold">Data</span>
              <input type="date" className={inputCls} value={header.date} onChange={(e) => setHeader({ ...header, date: e.target.value })} />
            </label>
            <label className="space-y-0.5 text-[12px]">
              <span className="text-[10px] uppercase text-slate-400 font-semibold">Analista</span>
              <input className={inputCls} value={header.analyst} onChange={(e) => setHeader({ ...header, analyst: e.target.value })} placeholder="Nome da analista" />
            </label>
            <label className="space-y-0.5 text-[12px]">
              <span className="text-[10px] uppercase text-slate-400 font-semibold">Período</span>
              <input className={inputCls} value={header.period} onChange={(e) => setHeader({ ...header, period: e.target.value })} />
            </label>
            <label className="space-y-0.5 text-[12px]">
              <span className="text-[10px] uppercase text-slate-400 font-semibold">Envio GO</span>
              <input type="date" className={inputCls} value={header.sentToGoAt} onChange={(e) => setHeader({ ...header, sentToGoAt: e.target.value })} />
            </label>
          </div>

          {requiredItems.map((item) => {
            const a = answers[item.id] || { status: '' as ItemStatus, notes: '' };
            return (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b bg-slate-50/80 flex flex-wrap items-center gap-2 justify-between">
                  <p className="text-[13px] font-semibold">
                    {item.id}. {item.title}
                    {item.fridayOnly && (
                      <span className="ml-2 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">Só sexta</span>
                    )}
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAnswer(item.id, { status: 'conforme' })}
                      className={cn(
                        'h-8 px-3 rounded-md text-[11px] font-bold uppercase tracking-wide border',
                        a.status === 'conforme'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-500'
                      )}
                    >
                      Conforme
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnswer(item.id, { status: 'divergencia' })}
                      className={cn(
                        'h-8 px-3 rounded-md text-[11px] font-bold uppercase tracking-wide border',
                        a.status === 'divergencia'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-rose-500'
                      )}
                    >
                      Divergência
                    </button>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-2">
                  <ul className="text-[12px] text-slate-600 list-disc pl-4 space-y-0.5">
                    {item.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                  <textarea
                    className="w-full min-h-[64px] rounded-lg border border-slate-200 px-2.5 py-2 text-[13px]"
                    value={a.notes}
                    onChange={(e) => setAnswer(item.id, { notes: e.target.value })}
                    placeholder="Resolutiva…"
                  />
                </div>
              </div>
            );
          })}

          {recordStatus === 'contestado' && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-950">
              <strong>Contestada.</strong> Ajuste e envie de novo.
              {currentRecordId && getRecord(currentRecordId)?.contestComment && (
                <span className="block mt-1">Motivo: {getRecord(currentRecordId)?.contestComment}</span>
              )}
            </div>
          )}
          {recordStatus === 'aguardando' && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] text-blue-900">
              Enviada — aguardando na aba <strong>Aprovação</strong>.
            </div>
          )}
          {recordStatus === 'aprovado' && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
              Auditoria aprovada.
            </div>
          )}

          {missingCount > 0 && (
            <p className="text-[12px] text-amber-800">
              Faltam <strong>{missingCount}</strong> item(ns) sem status para liberar o envio.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={saveDraft} className="h-9 px-4 rounded-lg bg-slate-900 text-white text-[12px] font-semibold">
              Salvar
            </button>
            <button
              type="button"
              onClick={submitForApproval}
              disabled={!canSubmit || recordStatus === 'aguardando' || recordStatus === 'aprovado'}
              className="h-9 px-4 rounded-lg bg-blue-600 text-white text-[12px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Enviar para aprovação
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b bg-slate-50/80 text-[12px] font-semibold">Histórico deste hotel</div>
            <div className="divide-y max-h-[240px] overflow-y-auto">
              {history.length === 0 ? (
                <p className="px-4 py-6 text-center text-[12px] text-slate-400">Nenhuma auditoria salva</p>
              ) : (
                history.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setHeader({ ...r.header });
                      setAnswers(r.answers as any);
                      setCurrentRecordId(r.id);
                      setRecordStatus(r.status);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center justify-between gap-2"
                  >
                    <span className="text-[12px]">
                      <span className="font-medium">{formatDateBR(r.header.date)}</span>
                      <span className="text-slate-400"> · {r.header.analyst || '—'}</span>
                    </span>
                    <span
                      className={cn(
                        'text-[10px] font-bold uppercase px-2 py-0.5 rounded text-white',
                        r.status === 'aprovado' && 'bg-emerald-600',
                        r.status === 'aguardando' && 'bg-blue-600',
                        r.status === 'contestado' && 'bg-amber-500',
                        r.status === 'rascunho' && 'bg-slate-400'
                      )}
                    >
                      {statusLabel(r.status)}
                    </span>
                  </button>
                ))
              )}
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
            {[
              { label: 'Conciliados', value: hgStats.both, tone: 'text-emerald-700' },
              { label: 'Dif. valor', value: hgStats.diff, tone: 'text-amber-700' },
              { label: 'Só PMS', value: hgStats.ho, tone: 'text-rose-700' },
              { label: 'Só Adquirente', value: hgStats.go, tone: 'text-rose-700' },
            ].map((k) => (
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
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">PMS</th>
                    <th className="px-3 py-2">Adquirente</th>
                    <th className="px-3 py-2 text-right">PMS líq.</th>
                    <th className="px-3 py-2 text-right">Adquirente líq.</th>
                    <th className="px-3 py-2 text-right">Δ</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {hitsGetnetMatches.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400">Envie os dois relatórios</td>
                    </tr>
                  ) : (
                    hitsGetnetMatches.map((m) => (
                      <tr key={m.id}>
                        <td className="px-3 py-2"><StatusPill side={m.side} /></td>
                        <td className="px-3 py-2">{m.hits ? `${formatDateBR(m.hits.date)} · ${m.hits.guest}` : '—'}</td>
                        <td className="px-3 py-2">{m.getnet ? `${formatDateBR(m.getnet.date)} · ${m.getnet.brand}` : '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{m.hits ? formatBRL(m.hits.net) : '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{m.getnet ? formatBRL(m.getnet.net) : '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{m.delta != null ? formatBRL(m.delta) : '—'}</td>
                      </tr>
                    ))
                  )}
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
              <thead className="border-b">
                <tr className="text-left text-[10px] uppercase text-slate-400">
                  <th className="px-3 py-2">Liquidação</th>
                  <th className="px-3 py-2 text-right">Esperado</th>
                  <th className="px-3 py-2 text-right">Banco</th>
                  <th className="px-3 py-2 text-right">Δ</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {bankMatches.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400">Envie adquirente + extrato</td>
                  </tr>
                ) : (
                  bankMatches.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2">{formatDateBR(r.settleDate)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatBRL(r.expectedNet)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatBRL(r.bankCredit)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatBRL(r.delta)}</td>
                      <td className="px-3 py-2"><BankStatus status={r.status} /></td>
                    </tr>
                  ))
                )}
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
            <div className="rounded-2xl border border-dashed px-4 py-10 text-center text-[13px] text-slate-400">
              Nenhuma auditoria aguardando aprovação
            </div>
          ) : (
            pendingApproval.map((r) => (
              <div key={r.id} className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[14px] font-semibold">{r.hotelName}</p>
                    <p className="text-[12px] text-slate-500">
                      {formatDateBR(r.header.date)} · {r.header.analyst || '—'} · {r.header.period}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const comment = window.prompt('Motivo da contestação (obrigatório):');
                        if (comment === null) return;
                        if (!comment.trim()) {
                          toast.error('Informe o motivo');
                          return;
                        }
                        upsertRecord({
                          ...r,
                          status: 'contestado',
                          contestComment: comment.trim(),
                          updatedAt: new Date().toISOString(),
                        });
                        setTick((t) => t + 1);
                        toast.message('Contestada — voltou para a analista');
                      }}
                      className="h-8 px-3 rounded-lg border border-amber-400 text-amber-900 text-[11px] font-semibold"
                    >
                      Contestar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        upsertRecord({
                          ...r,
                          status: 'aprovado',
                          approvedAt: new Date().toISOString(),
                          approvedBy: 'GO',
                          updatedAt: new Date().toISOString(),
                          contestComment: undefined,
                        });
                        setTick((t) => t + 1);
                        toast.success('Aprovada');
                      }}
                      className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold"
                    >
                      Aprovar
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  {CHECKLIST.map((item) => {
                    const a = r.answers[item.id];
                    if (!a?.status) return null;
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-2 text-[12px] border-b border-slate-50 py-1">
                        <span>{item.id}. {item.title}</span>
                        <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded text-white', a.status === 'conforme' ? 'bg-emerald-600' : 'bg-rose-600')}>
                          {a.status === 'conforme' ? 'Conforme' : 'Divergência'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {pasteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl border overflow-hidden">
            <div className="px-5 py-3 border-b bg-slate-50 flex justify-between items-center">
              <p className="font-semibold text-[14px]">Colar texto — {pasteOpen}</p>
              <button type="button" onClick={() => setPasteOpen(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4">
              <textarea className="w-full min-h-[200px] rounded-lg border p-3 text-[12px] font-mono" value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Cole o texto…" />
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
