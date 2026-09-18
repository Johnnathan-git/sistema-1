/**
 * Auditoria Life — PMS Hotel
 * Checklist diário POP-FIN-001 + uploads Hits/Getnet/Santander
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Link2,
  Loader2,
  Plus,
  Scale,
  Settings2,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
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
  DEFAULT_FEES,
  CHECKLIST,
  LS_AUDIT,
  LS_FEES,
} from '@/lib/auditoria-core';

type TabId = 'checklist' | 'hits_getnet' | 'getnet_bank' | 'taxas';
type AuditStatus = 'conforme' | 'divergencia' | 'na' | '';

export function AuditoriaLifeModule() {
  const [tab, setTab] = useState<TabId>('checklist');
  const [header, setHeader] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_AUDIT);
      if (raw) return JSON.parse(raw).header;
    } catch {}
    return {
      date: todayISO(),
      analyst: '',
      period: 'Dia completo',
      sentToGoAt: '',
      analystSign: '',
      goSign: '',
      goReceivedAt: '',
    };
  });
  const [answers, setAnswers] = useState<Record<number, { status: AuditStatus; notes: string }>>(() => {
    try {
      const raw = localStorage.getItem(LS_AUDIT);
      if (raw) return JSON.parse(raw).answers || {};
    } catch {}
    const init: Record<number, { status: AuditStatus; notes: string }> = {};
    for (const c of CHECKLIST) init[c.id] = { status: '', notes: '' };
    return init;
  });
  const [fees, setFees] = useState<FeeRule[]>(() => {
    try {
      const raw = localStorage.getItem(LS_FEES);
      if (raw) return JSON.parse(raw);
    } catch {}
    return DEFAULT_FEES;
  });
  const [hits, setHits] = useState<HitsPayment[]>([]);
  const [getnet, setGetnet] = useState<GetnetSale[]>([]);
  const [bank, setBank] = useState<BankLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [pasteOpen, setPasteOpen] = useState<'hits' | 'getnet' | 'bank' | null>(null);
  const [pasteText, setPasteText] = useState('');

  useEffect(() => {
    localStorage.setItem(LS_AUDIT, JSON.stringify({ header, answers }));
  }, [header, answers]);
  useEffect(() => {
    localStorage.setItem(LS_FEES, JSON.stringify(fees));
  }, [fees]);

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

  const loadFile = useCallback(async (kind: 'hits' | 'getnet' | 'bank', file: File) => {
    setBusy(true);
    try {
      const text = await fileToText(file);
      if (kind === 'hits') {
        const rows = parseHitsText(text);
        setHits(rows);
        toast.success(`Hits: ${rows.length} pagamento(s)`);
      } else if (kind === 'getnet') {
        const rows = parseGetnetText(text);
        setGetnet(rows);
        toast.success(`Getnet: ${rows.length} venda(s)`);
      } else {
        const rows = parseSantanderText(text);
        setBank(rows);
        toast.success(`Santander: ${rows.length} linha(s)`);
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
      toast.success('Hits processado');
    } else if (pasteOpen === 'getnet') {
      setGetnet(parseGetnetText(pasteText));
      toast.success('Getnet processado');
    } else {
      setBank(parseSantanderText(pasteText));
      toast.success('Santander processado');
    }
    setPasteOpen(null);
    setPasteText('');
  };

  const setAnswer = (id: number, patch: Partial<{ status: AuditStatus; notes: string }>) => {
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const inputCls =
    'w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400';
  const friday = isFriday(header.date);

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-slate-500" /> Auditoria Life
          </h2>
          <p className="text-[12px] text-slate-500 mt-0.5">
            POP-FIN-001 · Checklist · Hits × Getnet · Getnet × Santander
          </p>
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
            { id: 'hits_getnet' as const, label: 'Hits × Getnet', icon: Link2 },
            { id: 'getnet_bank' as const, label: 'Getnet × Santander', icon: Scale },
            { id: 'taxas' as const, label: 'Taxas', icon: Settings2 },
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
              <input className={inputCls} value={header.analyst} onChange={(e) => setHeader({ ...header, analyst: e.target.value })} />
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

          {CHECKLIST.filter((c) => !c.fridayOnly || friday).map((item) => {
            const a = answers[item.id] || { status: '' as AuditStatus, notes: '' };
            return (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b bg-slate-50/80 flex flex-wrap items-center gap-2 justify-between">
                  <p className="text-[13px] font-semibold">
                    {item.id}. {item.title}
                    {item.fridayOnly && (
                      <span className="ml-2 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">
                        Só sexta
                      </span>
                    )}
                  </p>
                  <div className="flex gap-1">
                    {(
                      [
                        { v: 'conforme' as const, label: 'Conforme', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
                        { v: 'divergencia' as const, label: 'Divergência', cls: 'bg-rose-50 text-rose-800 border-rose-200' },
                        { v: 'na' as const, label: 'N/A', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setAnswer(item.id, { status: opt.v })}
                        className={cn(
                          'h-7 px-2.5 rounded-md border text-[11px] font-semibold',
                          a.status === opt.v ? opt.cls : 'border-slate-200 text-slate-500'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
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

          <button
            type="button"
            onClick={() => toast.success('Auditoria salva (localStorage)')}
            className="h-9 px-4 rounded-lg bg-slate-900 text-white text-[12px] font-semibold"
          >
            Salvar auditoria do dia
          </button>
        </div>
      )}

      {tab === 'hits_getnet' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <UploadCard title="Hits — Pagamentos Efetuados" count={hits.length} onFile={(f) => loadFile('hits', f)} onPaste={() => setPasteOpen('hits')} />
            <UploadCard title="Getnet — Vendas Detalhado" count={getnet.length} onFile={(f) => loadFile('getnet', f)} onPaste={() => setPasteOpen('getnet')} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Conciliados', value: hgStats.both, tone: 'text-emerald-700' },
              { label: 'Dif. valor', value: hgStats.diff, tone: 'text-amber-700' },
              { label: 'Só Hits', value: hgStats.ho, tone: 'text-rose-700' },
              { label: 'Só Getnet', value: hgStats.go, tone: 'text-rose-700' },
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
                    <th className="px-3 py-2">Hits</th>
                    <th className="px-3 py-2">Getnet</th>
                    <th className="px-3 py-2 text-right">Hits líq.</th>
                    <th className="px-3 py-2 text-right">Getnet líq.</th>
                    <th className="px-3 py-2 text-right">Δ</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {hitsGetnetMatches.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                        Envie os dois relatórios (upload ou colar texto)
                      </td>
                    </tr>
                  ) : (
                    hitsGetnetMatches.map((m) => (
                      <tr key={m.id}>
                        <td className="px-3 py-2">
                          <StatusPill side={m.side} />
                        </td>
                        <td className="px-3 py-2">
                          {m.hits ? `${formatDateBR(m.hits.date)} · ${m.hits.guest}` : '—'}
                        </td>
                        <td className="px-3 py-2">
                          {m.getnet ? `${formatDateBR(m.getnet.date)} · ${m.getnet.brand}` : '—'}
                        </td>
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
          <p className="text-[12px] text-slate-500 max-w-3xl">
            Antecipação automática: líquido Getnet por data prevista (ou D+1) × créditos Antecipação Getnet no Santander.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <UploadCard title="Getnet — Vendas Detalhado" count={getnet.length} onFile={(f) => loadFile('getnet', f)} onPaste={() => setPasteOpen('getnet')} />
            <UploadCard title="Extrato Santander" count={bank.length} onFile={(f) => loadFile('bank', f)} onPaste={() => setPasteOpen('bank')} />
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
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                      Envie Getnet + Santander
                    </td>
                  </tr>
                ) : (
                  bankMatches.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2">{formatDateBR(r.settleDate)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatBRL(r.expectedNet)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatBRL(r.bankCredit)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatBRL(r.delta)}</td>
                      <td className="px-3 py-2">
                        <BankStatus status={r.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'taxas' && (
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-2 border-b bg-slate-50/80 text-[12px] font-semibold flex justify-between">
            <span>Tabela de taxas</span>
            <button
              type="button"
              onClick={() =>
                setFees((p) => [
                  ...p,
                  { id: `f-${Date.now()}`, label: 'Nova', brand: '*', modality: '*', feePercent: 0, feeFixed: 0, active: true },
                ])
              }
              className="h-7 px-2 rounded-md border text-[11px] inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Incluir
            </button>
          </div>
          <table className="w-full text-[12px]">
            <thead className="border-b">
              <tr className="text-left text-[10px] uppercase text-slate-400">
                <th className="px-3 py-2">Rótulo</th>
                <th className="px-3 py-2">Bandeira</th>
                <th className="px-3 py-2">Modalidade</th>
                <th className="px-3 py-2 text-right">%</th>
                <th className="px-3 py-2">Ativo</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {fees.map((f) => (
                <tr key={f.id}>
                  <td className="px-3 py-1.5">
                    <input
                      className={inputCls}
                      value={f.label}
                      onChange={(e) => setFees((p) => p.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)))}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      className={inputCls}
                      value={f.brand}
                      onChange={(e) => setFees((p) => p.map((x) => (x.id === f.id ? { ...x, brand: e.target.value } : x)))}
                    >
                      <option value="*">*</option>
                      <option value="mastercard">Master</option>
                      <option value="visa">Visa</option>
                      <option value="elo">Elo</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      className={inputCls}
                      value={f.modality}
                      onChange={(e) => setFees((p) => p.map((x) => (x.id === f.id ? { ...x, modality: e.target.value } : x)))}
                    >
                      <option value="*">*</option>
                      <option value="debito">Débito</option>
                      <option value="credito_vista">Crédito vista</option>
                      <option value="credito_parcelado">Parcelado</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      step="0.01"
                      className={inputCls + ' text-right'}
                      value={f.feePercent}
                      onChange={(e) =>
                        setFees((p) =>
                          p.map((x) => (x.id === f.id ? { ...x, feePercent: parseFloat(e.target.value) || 0 } : x))
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={f.active}
                      onChange={(e) => setFees((p) => p.map((x) => (x.id === f.id ? { ...x, active: e.target.checked } : x)))}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <button type="button" onClick={() => setFees((p) => p.filter((x) => x.id !== f.id))} className="text-rose-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pasteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl border overflow-hidden">
            <div className="px-5 py-3 border-b bg-slate-50 flex justify-between items-center">
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
                placeholder="Cole o texto extraído do PDF (pdftotext) ou CSV…"
              />
            </div>
            <div className="px-5 py-3 border-t flex justify-end gap-2">
              <button type="button" onClick={() => setPasteOpen(null)} className="h-9 px-4 rounded-lg border text-[12px]">
                Cancelar
              </button>
              <button type="button" onClick={applyPaste} className="h-9 px-4 rounded-lg bg-blue-600 text-white text-[12px] font-semibold">
                Processar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UploadCard({
  title,
  count,
  onFile,
  onPaste,
}: {
  title: string;
  count: number;
  onFile: (f: File) => void;
  onPaste: () => void;
}) {
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
          <input
            type="file"
            accept=".pdf,.csv,.txt,application/pdf,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
        </label>
        <button type="button" onClick={onPaste} className="h-9 px-3 rounded-lg border text-[12px]">
          Colar texto
        </button>
      </div>
    </div>
  );
}

function StatusPill({ side }: { side: MatchSide }) {
  if (side === 'both')
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-md px-1.5 py-0.5">
        <CheckCircle2 className="w-3 h-3" /> OK
      </span>
    );
  if (side === 'value_diff')
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-1.5 py-0.5">
        <AlertTriangle className="w-3 h-3" /> Valor
      </span>
    );
  if (side === 'hits_only')
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-800 bg-rose-50 border border-rose-100 rounded-md px-1.5 py-0.5">
        <XCircle className="w-3 h-3" /> Só Hits
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-800 bg-rose-50 border border-rose-100 rounded-md px-1.5 py-0.5">
      <XCircle className="w-3 h-3" /> Só Getnet
    </span>
  );
}

function BankStatus({ status }: { status: BankMatchRow['status'] }) {
  const map = {
    ok: 'bg-emerald-50 text-emerald-800',
    faltando_banco: 'bg-rose-50 text-rose-800',
    sobra_banco: 'bg-amber-50 text-amber-800',
    divergencia: 'bg-amber-50 text-amber-900',
  };
  const label = {
    ok: 'OK',
    faltando_banco: 'Falta no banco',
    sobra_banco: 'Sobra no banco',
    divergencia: 'Divergência',
  };
  return (
    <span className={cn('inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold', map[status])}>
      {label[status]}
    </span>
  );
}
