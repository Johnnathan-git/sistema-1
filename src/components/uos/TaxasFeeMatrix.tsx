/**
 * Matriz de taxas: linhas = modalidade, colunas = bandeira.
 * Perfis por hotel (ex.: Santander Life, outro hotel com taxa de link).
 */
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Copy, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DEFAULT_FEES, type FeeRule } from '@/lib/auditoria-core';

export interface FeeProfile {
  id: string;
  name: string;
  hotelLabel: string;
  channel: 'maquina' | 'link' | 'misto';
  fees: FeeRule[];
}

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

const LS_PROFILES = 'pms-auditoria-fee-profiles-v1';
const LS_ACTIVE = 'pms-auditoria-fee-active-v1';

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

function matrixToFees(matrix: Record<string, Record<string, number>>): FeeRule[] {
  const out: FeeRule[] = [];
  for (const mod of MODS) {
    for (const brand of BRANDS) {
      const pct = matrix[mod.key]?.[brand.key];
      if (pct === undefined || pct === null) continue;
      out.push({
        id: `${brand.key}-${mod.key}`,
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

function defaultProfile(): FeeProfile {
  return {
    id: 'santander-life',
    name: 'Santander · Final ao Cliente %',
    hotelLabel: 'Life / Santa Eliza',
    channel: 'maquina',
    fees: DEFAULT_FEES,
  };
}

function emptyMatrix(): Record<string, Record<string, number>> {
  const m: Record<string, Record<string, number>> = {};
  for (const mod of MODS) {
    m[mod.key] = {};
    for (const b of BRANDS) m[mod.key][b.key] = 0;
  }
  return m;
}

interface Props {
  /** Notifica o módulo pai com as taxas ativas (para conciliação) */
  onActiveFeesChange: (fees: FeeRule[]) => void;
}

export function TaxasFeeMatrix({ onActiveFeesChange }: Props) {
  const [profiles, setProfiles] = useState<FeeProfile[]>(() => {
    try {
      const raw = localStorage.getItem(LS_PROFILES);
      if (raw) {
        const parsed = JSON.parse(raw) as FeeProfile[];
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch {}
    return [defaultProfile()];
  });

  const [activeId, setActiveId] = useState(() => {
    try {
      return localStorage.getItem(LS_ACTIVE) || 'santander-life';
    } catch {
      return 'santander-life';
    }
  });

  const active = profiles.find((p) => p.id === activeId) || profiles[0];

  const matrix = useMemo(() => feesToMatrix(active?.fees || DEFAULT_FEES), [active]);

  useEffect(() => {
    localStorage.setItem(LS_PROFILES, JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    localStorage.setItem(LS_ACTIVE, activeId);
  }, [activeId]);

  useEffect(() => {
    if (active?.fees) onActiveFeesChange(active.fees);
  }, [active, onActiveFeesChange]);

  const setCell = (mod: string, brand: string, value: number) => {
    setProfiles((prev) =>
      prev.map((p) => {
        if (p.id !== activeId) return p;
        const m = feesToMatrix(p.fees);
        if (!m[mod]) m[mod] = {};
        m[mod][brand] = value;
        return { ...p, fees: matrixToFees(m) };
      })
    );
  };

  const addProfile = () => {
    const id = `perfil-${Date.now()}`;
    const neu: FeeProfile = {
      id,
      name: 'Novo perfil',
      hotelLabel: 'Hotel',
      channel: 'link',
      fees: matrixToFees(emptyMatrix()),
    };
    setProfiles((p) => [...p, neu]);
    setActiveId(id);
    toast.success('Perfil criado — preencha a matriz');
  };

  const cloneProfile = () => {
    if (!active) return;
    const id = `perfil-${Date.now()}`;
    setProfiles((p) => [
      ...p,
      {
        ...active,
        id,
        name: `${active.name} (cópia)`,
        fees: active.fees.map((f) => ({ ...f, id: `${f.id}-c` })),
      },
    ]);
    setActiveId(id);
    toast.success('Perfil duplicado');
  };

  const removeProfile = () => {
    if (profiles.length <= 1) {
      toast.error('Mantenha ao menos um perfil');
      return;
    }
    setProfiles((p) => p.filter((x) => x.id !== activeId));
    setActiveId(profiles.find((x) => x.id !== activeId)!.id);
  };

  const resetSantander = () => {
    setProfiles((p) =>
      p.map((x) => (x.id === activeId ? { ...x, fees: DEFAULT_FEES } : x))
    );
    toast.success('Tabela Santander restaurada neste perfil');
  };

  const updateMeta = (patch: Partial<FeeProfile>) => {
    setProfiles((p) => p.map((x) => (x.id === activeId ? { ...x, ...patch } : x)));
  };

  const inputCls =
    'w-full h-8 rounded-md border border-slate-200 bg-white px-2 text-[12px] outline-none focus:ring-2 focus:ring-blue-500/20';

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-0.5 text-[12px] min-w-[200px] flex-1">
            <span className="text-[10px] uppercase text-slate-400 font-semibold">Perfil ativo (hotel / canal)</span>
            <select
              className={inputCls + ' h-9'}
              value={activeId}
              onChange={(e) => setActiveId(e.target.value)}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.hotelLabel}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={addProfile} className="h-9 px-2.5 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Novo perfil
            </button>
            <button type="button" onClick={cloneProfile} className="h-9 px-2.5 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1">
              <Copy className="w-3.5 h-3.5" /> Duplicar
            </button>
            <button type="button" onClick={resetSantander} className="h-9 px-2.5 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1">
              <RotateCcw className="w-3.5 h-3.5" /> Restaurar Santander
            </button>
            <button type="button" onClick={removeProfile} className="h-9 px-2.5 rounded-lg border text-[11px] font-medium text-rose-600 inline-flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5" /> Excluir
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className="space-y-0.5 text-[12px]">
            <span className="text-[10px] uppercase text-slate-400 font-semibold">Nome do perfil</span>
            <input className={inputCls} value={active?.name || ''} onChange={(e) => updateMeta({ name: e.target.value })} />
          </label>
          <label className="space-y-0.5 text-[12px]">
            <span className="text-[10px] uppercase text-slate-400 font-semibold">Hotel</span>
            <input className={inputCls} value={active?.hotelLabel || ''} onChange={(e) => updateMeta({ hotelLabel: e.target.value })} />
          </label>
          <label className="space-y-0.5 text-[12px]">
            <span className="text-[10px] uppercase text-slate-400 font-semibold">Canal</span>
            <select
              className={inputCls}
              value={active?.channel || 'maquina'}
              onChange={(e) => updateMeta({ channel: e.target.value as FeeProfile['channel'] })}
            >
              <option value="maquina">Máquina / POS</option>
              <option value="link">Link de pagamento</option>
              <option value="misto">Misto</option>
            </select>
          </label>
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          Valores = <strong>Final ao Cliente %</strong> (MDR + antecipação). A conciliação Getnet × Santander
          usa o <strong>perfil ativo</strong>. Crie um perfil por hotel ou por canal (ex.: taxa de link diferente).
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-2 border-b bg-slate-50/80 text-[12px] font-semibold">
          Matriz · % Final ao Cliente
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] min-w-[520px]">
            <thead>
              <tr className="border-b text-left text-[10px] uppercase text-slate-400">
                <th className="px-3 py-2 sticky left-0 bg-white">Transação</th>
                {BRANDS.map((b) => (
                  <th key={b.key} className="px-2 py-2 text-center font-semibold text-slate-600 normal-case tracking-normal text-[11px]">
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
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            className={cn(
                              inputCls,
                              'text-right tabular-nums pr-5 h-8',
                              v === 0 && mod.key === 'debito' && b.key === 'amex' ? 'text-slate-400' : ''
                            )}
                            value={v}
                            onChange={(e) => setCell(mod.key, b.key, parseFloat(e.target.value) || 0)}
                          />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">
                            %
                          </span>
                        </div>
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
