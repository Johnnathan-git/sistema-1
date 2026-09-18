/**
 * Matriz de taxas por hotel.
 * Visualização bloqueada por padrão → Editar → Salvar / Cancelar.
 */
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, Pencil, RotateCcw, X } from 'lucide-react';
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

function feesToMatrix(fees: FeeRule[]): Record<string, Record<string, number>> {
  const m: Record<string, Record<string, number>> = {};
  for (const mod of MODS) m[mod.key] = {};
  for (const f of fees) {
    if (!m[f.modality]) m[f.modality] = {};
    m[f.modality][f.brand] = f.feePercent;
  }
  return m;
}

function matrixToFees(matrix: Record<string, Record<string, number>>, hotelId: HotelId): FeeRule[] {
  const out: FeeRule[] = [];
  for (const mod of MODS) {
    for (const brand of BRANDS) {
      const pct = matrix[mod.key]?.[brand.key];
      if (pct === undefined || pct === null) continue;
      out.push({
        id: `${hotelId}-${brand.key}-${mod.key}`,
        label: buildLabel(brand.key, mod.key),
        brand: brand.key,
        modality: mod.key,
        feePercent: pct,
        feeFixed: 0,
        active: true,
      });
    }
  }
  return out;
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
  onActiveFeesChange: (fees: FeeRule[]) => void;
}

export function TaxasFeeMatrix({ hotelId, hotelName, onActiveFeesChange }: Props) {
  const [fees, setFees] = useState<FeeRule[]>(() => loadFees(hotelId));
  const [draft, setDraft] = useState<FeeRule[] | null>(null);
  const editing = draft !== null;

  // Troca de hotel: recarrega taxas daquele hotel
  useEffect(() => {
    const loaded = loadFees(hotelId);
    setFees(loaded);
    setDraft(null);
    onActiveFeesChange(loaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  useEffect(() => {
    if (!editing) onActiveFeesChange(fees);
  }, [fees, editing, onActiveFeesChange]);

  const display = editing ? draft! : fees;
  const matrix = useMemo(() => feesToMatrix(display), [display]);

  const startEdit = () => {
    setDraft(fees.map((f) => ({ ...f })));
  };

  const cancelEdit = () => {
    setDraft(null);
    toast.message('Edição cancelada');
  };

  const saveEdit = () => {
    if (!draft) return;
    setFees(draft);
    localStorage.setItem(feesStorageKey(hotelId), JSON.stringify(draft));
    setDraft(null);
    onActiveFeesChange(draft);
    toast.success(`Taxas de ${hotelName} salvas`);
  };

  const setCell = (mod: string, brand: string, value: number) => {
    if (!draft) return;
    const m = feesToMatrix(draft);
    if (!m[mod]) m[mod] = {};
    m[mod][brand] = value;
    setDraft(matrixToFees(m, hotelId));
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
    'w-full h-8 rounded-md border border-slate-200 bg-white px-2 text-[12px] outline-none focus:ring-2 focus:ring-blue-500/20';

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-slate-900">Taxas · {hotelName}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Final ao Cliente % (MDR + antecipação). Usadas na conciliação Getnet × banco deste hotel.
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
                <Check className="w-3.5 h-3.5" /> Salvar edição
              </button>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          Modo edição ativo — altere os % e clique em <strong>Salvar edição</strong>.
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
          <table className="w-full text-[12px] min-w-[520px]">
            <thead>
              <tr className="border-b text-left text-[10px] uppercase text-slate-400">
                <th className="px-3 py-2 sticky left-0 bg-white">Transação</th>
                {BRANDS.map((b) => (
                  <th
                    key={b.key}
                    className="px-2 py-2 text-center font-semibold text-slate-600 normal-case tracking-normal text-[11px]"
                  >
                    {b.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {MODS.map((mod) => (
                <tr key={mod.key} className="hover:bg-slate-50/50">
                  <td className="px-3 py-1.5 font-medium text-slate-700 sticky left-0 bg-white whitespace-nowrap">
                    {mod.label}
                  </td>
                  {BRANDS.map((b) => {
                    const v = matrix[mod.key]?.[b.key] ?? 0;
                    return (
                      <td key={b.key} className="px-1.5 py-1">
                        {editing ? (
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              className={cn(inputCls, 'text-right tabular-nums pr-5 h-8')}
                              value={v}
                              onChange={(e) => setCell(mod.key, b.key, parseFloat(e.target.value) || 0)}
                            />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">
                              %
                            </span>
                          </div>
                        ) : (
                          <div className="h-8 flex items-center justify-end px-2 tabular-nums text-slate-800">
                            {v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                          </div>
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
    </div>
  );
}
