/**
 * Matriz de taxas por hotel + adicionar / excluir.
 * Valores gravados em localStorage e usados na conciliação Adquirente × Banco.
 */
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { FeeRule } from '@/lib/auditoria-core';
import {
  type HotelId,
  defaultFeesForHotel,
  feesStorageKey,
} from '@/lib/auditoria-hotels';

const BRANDS = [
  { key: 'visa', label: 'Visa' },
  { key: 'mastercard', label: 'Master' },
  { key: 'elo', label: 'Elo' },
  { key: 'amex', label: 'Amex' },
] as const;

const MODS = [
  { key: 'debito', label: 'Débito' },
  { key: 'credito_vista', label: 'Crédito à vista' },
  { key: 'parcelado_2', label: 'Parcelado 2x' },
  { key: 'parcelado_3', label: 'Parcelado 3x' },
  { key: 'parcelado_4', label: 'Parcelado 4x' },
  { key: 'parcelado_5', label: 'Parcelado 5x' },
  { key: 'parcelado_6', label: 'Parcelado 6x' },
] as const;

function buildLabel(brand: string, mod: string) {
  const b =
    brand === 'visa'
      ? 'Visa'
      : brand === 'mastercard'
        ? 'Master'
        : brand === 'elo'
          ? 'Elo'
          : brand === 'amex'
            ? 'Amex'
            : brand;
  const m = MODS.find((x) => x.key === mod)?.label || mod;
  return `${b} ${m}`;
}

function feesToMatrix(fees: FeeRule[]): Record<string, Record<string, number | null>> {
  const m: Record<string, Record<string, number | null>> = {};
  for (const mod of MODS) m[mod.key] = {};
  for (const f of fees) {
    if (!f.active) continue;
    if (!m[f.modality]) m[f.modality] = {};
    if (BRANDS.some((b) => b.key === f.brand) && MODS.some((x) => x.key === f.modality)) {
      m[f.modality][f.brand] = f.feePercent;
    }
  }
  return m;
}

function isStandard(f: FeeRule) {
  return BRANDS.some((b) => b.key === f.brand) && MODS.some((x) => x.key === f.modality);
}

function loadFees(hotelId: HotelId): FeeRule[] {
  try {
    const raw = localStorage.getItem(feesStorageKey(hotelId));
    if (raw) {
      const parsed = JSON.parse(raw) as FeeRule[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {}
  return defaultFeesForHotel(hotelId);
}

interface Props {
  hotelId: HotelId;
  hotelName: string;
  /** Notifica o workspace para usar as taxas na conciliação Adquirente × Banco */
  onActiveFeesChange?: (fees: FeeRule[]) => void;
}

const noop = () => {};

export function TaxasFeeMatrix({ hotelId, hotelName, onActiveFeesChange = noop }: Props) {
  const [fees, setFees] = useState<FeeRule[]>(() => loadFees(hotelId));
  const [draft, setDraft] = useState<FeeRule[] | null>(null);
  const editing = draft !== null;

  const [addOpen, setAddOpen] = useState(false);
  const [newBrand, setNewBrand] = useState('visa');
  const [newMod, setNewMod] = useState('credito_vista');
  const [newPct, setNewPct] = useState('2.97');
  const [newFixed, setNewFixed] = useState('0');
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => {
    const loaded = loadFees(hotelId);
    setFees(loaded);
    setDraft(null);
    setAddOpen(false);
    onActiveFeesChange(loaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  useEffect(() => {
    if (!editing) onActiveFeesChange(fees);
  }, [fees, editing, onActiveFeesChange]);

  const display = editing && draft ? draft : fees;
  const matrix = useMemo(() => feesToMatrix(display), [display]);
  const extras = useMemo(() => display.filter((f) => !isStandard(f)), [display]);

  const startEdit = () => {
    setDraft(fees.map((f) => ({ ...f })));
    setAddOpen(false);
  };

  const cancelEdit = () => {
    setDraft(null);
    setAddOpen(false);
    toast.message('Edição cancelada');
  };

  const saveEdit = () => {
    if (!draft) return;
    setFees(draft);
    localStorage.setItem(feesStorageKey(hotelId), JSON.stringify(draft));
    setDraft(null);
    setAddOpen(false);
    onActiveFeesChange(draft);
    toast.success(`Taxas de ${hotelName} salvas`);
  };

  const setCell = (mod: string, brand: string, value: number | null) => {
    if (!draft) return;
    let next = draft.filter((f) => !(f.brand === brand && f.modality === mod && isStandard(f)));
    if (value !== null && !Number.isNaN(value)) {
      next = [
        ...next,
        {
          id: `${hotelId}-${brand}-${mod}`,
          label: buildLabel(brand, mod),
          brand,
          modality: mod,
          feePercent: value,
          feeFixed: 0,
          active: true,
        },
      ];
    }
    setDraft(next);
  };

  const removeFee = (id: string) => {
    if (!draft) return;
    setDraft(draft.filter((f) => f.id !== id));
  };

  const addFee = () => {
    if (!draft) return;
    const brand = newBrand.trim().toLowerCase() || 'visa';
    const modality = newMod.trim() || 'credito_vista';
    const feePercent = parseFloat(newPct.replace(',', '.')) || 0;
    const feeFixed = parseFloat(newFixed.replace(',', '.')) || 0;
    const label = newLabel.trim() || buildLabel(brand, modality);
    const id = `${hotelId}-${brand}-${modality}-${Date.now().toString(36)}`;
    let next = draft.filter((f) => !(isStandard(f) && f.brand === brand && f.modality === modality));
    next = [
      ...next,
      { id, label, brand, modality, feePercent, feeFixed, active: true },
    ];
    setDraft(next);
    setAddOpen(false);
    setNewLabel('');
    toast.message('Taxa adicionada — clique em Salvar para gravar');
  };

  const resetDefaults = () => {
    if (!editing) {
      toast.message('Clique em Editar para restaurar o padrão');
      return;
    }
    setDraft(defaultFeesForHotel(hotelId));
    toast.message('Valores padrão carregados — clique em Salvar para gravar');
  };

  const inputCls =
    'h-8 rounded-md border border-slate-200 bg-white px-2 text-[12px] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400';

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-slate-900">Taxas · {hotelName}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            % Final ao Cliente (MDR + antecipação). Usadas na conciliação Adquirente × Banco deste hotel.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {!editing ? (
            <button
              type="button"
              onClick={startEdit}
              className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[12px] font-semibold inline-flex items-center gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5" /> Editar taxas
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setAddOpen((v) => !v)}
                className="h-9 px-2.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 text-[11px] font-semibold inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </button>
              <button
                type="button"
                onClick={resetDefaults}
                className="h-9 px-2.5 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Padrão
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="h-9 px-2.5 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Cancelar
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold inline-flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" /> Salvar
              </button>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          Modo edição — altere %, use <strong>Adicionar</strong> ou exclua uma linha. Clique em <strong>Salvar</strong> para gravar.
        </div>
      )}

      {editing && addOpen && (
        <div className="rounded-xl border border-blue-200 bg-white p-4 space-y-3 shadow-sm">
          <p className="text-[13px] font-semibold text-slate-900">Nova taxa</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase text-slate-400">Bandeira</span>
              <select value={newBrand} onChange={(e) => setNewBrand(e.target.value)} className={cn(inputCls, 'w-full')}>
                {BRANDS.map((b) => (
                  <option key={b.key} value={b.key}>{b.label}</option>
                ))}
                <option value="hipercard">Hipercard</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase text-slate-400">Modalidade</span>
              <select value={newMod} onChange={(e) => setNewMod(e.target.value)} className={cn(inputCls, 'w-full')}>
                {MODS.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
                <option value="parcelado_7">Parcelado 7x+</option>
                <option value="pix">PIX</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase text-slate-400">% taxa</span>
              <input value={newPct} onChange={(e) => setNewPct(e.target.value)} className={cn(inputCls, 'w-full text-right tabular-nums')} />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase text-slate-400">Fixo R$</span>
              <input value={newFixed} onChange={(e) => setNewFixed(e.target.value)} className={cn(inputCls, 'w-full text-right tabular-nums')} />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase text-slate-400">Rótulo (opcional)</span>
              <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Ex.: Visa 7x" className={cn(inputCls, 'w-full')} />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAddOpen(false)} className="h-8 px-3 rounded-lg border text-[12px]">Cancelar</button>
            <button type="button" onClick={addFee} className="h-8 px-3 rounded-lg bg-blue-600 text-white text-[12px] font-semibold">Incluir na lista</button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-2 border-b bg-slate-50/80 text-[12px] font-semibold flex items-center justify-between">
          <span>Matriz · % Final ao Cliente</span>
          {!editing && (
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Somente leitura</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] table-fixed min-w-[560px]">
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '19.5%' }} />
              <col style={{ width: '19.5%' }} />
              <col style={{ width: '19.5%' }} />
              <col style={{ width: '19.5%' }} />
            </colgroup>
            <thead>
              <tr className="border-b text-[10px] uppercase text-slate-400">
                <th className="px-3 py-2.5 text-left font-semibold sticky left-0 bg-white">Transação</th>
                {BRANDS.map((b) => (
                  <th key={b.key} className="px-2 py-2.5 text-center font-semibold text-slate-600 normal-case tracking-normal text-[12px]">
                    {b.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MODS.map((mod) => (
                <tr key={mod.key} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2 font-medium text-slate-700 sticky left-0 bg-white whitespace-nowrap">
                    {mod.label}
                  </td>
                  {BRANDS.map((b) => {
                    const raw = matrix[mod.key]?.[b.key];
                    const has = raw !== undefined && raw !== null;
                    const v = has ? (raw as number) : 0;
                    return (
                      <td key={b.key} className="px-2 py-1.5 text-center align-middle">
                        {editing ? (
                          <div className="inline-flex items-center justify-center gap-0.5 max-w-[110px] mx-auto">
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              className="w-[64px] h-8 rounded-md border border-slate-200 bg-white px-1.5 text-center text-[12px] tabular-nums outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                              value={has ? v : ''}
                              placeholder="—"
                              onChange={(e) => {
                                const t = e.target.value;
                                if (t === '') setCell(mod.key, b.key, null);
                                else setCell(mod.key, b.key, parseFloat(t) || 0);
                              }}
                            />
                            <span className="text-[10px] text-slate-400">%</span>
                            {has && (
                              <button
                                type="button"
                                title="Excluir esta taxa"
                                onClick={() => setCell(mod.key, b.key, null)}
                                className="h-7 w-7 rounded-md text-rose-600 hover:bg-rose-50 inline-flex items-center justify-center"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : has ? (
                          <span className="inline-block min-w-[4.5rem] text-center tabular-nums text-[13px] text-slate-800">
                            {v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {extras.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-2 border-b bg-slate-50/80 text-[12px] font-semibold">Taxas adicionais</div>
          <ul className="divide-y">
            {extras.map((f) => (
              <li key={f.id} className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[13px]">
                <div>
                  <p className="font-medium text-slate-900">{f.label}</p>
                  <p className="text-[11px] text-slate-500">
                    {f.brand} · {f.modality} · {f.feePercent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}%
                    {f.feeFixed > 0 ? ` + R$ ${f.feeFixed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
                  </p>
                </div>
                {editing && (
                  <button
                    type="button"
                    onClick={() => removeFee(f.id)}
                    className="h-8 px-2.5 rounded-lg border border-rose-200 text-rose-700 text-[11px] font-semibold inline-flex items-center gap-1 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
