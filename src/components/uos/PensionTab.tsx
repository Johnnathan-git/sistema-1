import { useEffect, useState } from 'react';
import { formatDateBR } from '@/lib/pms-types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export type PensionPlan =
  | 'apenas_hospedagem'
  | 'cafe'
  | 'meia_almoco'
  | 'meia_jantar'
  | 'pensao_completa'
  | 'all_inclusive';

export type DayMeals = {
  date: string;
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
  label?: 'checkin' | 'checkout' | 'intern';
};

const PENSION_OPTIONS: { id: PensionPlan; label: string; hint: string }[] = [
  {
    id: 'apenas_hospedagem',
    label: 'Apenas hospedagem',
    hint: 'Sem refeições inclusas',
  },
  {
    id: 'cafe',
    label: 'Café da manhã',
    hint: 'Café em todos os dias da estadia (exceto checkout)',
  },
  {
    id: 'meia_almoco',
    label: 'Meia pensão — almoço',
    hint: 'Café + almoço (padrão: almoço no checkout, não no check-in)',
  },
  {
    id: 'meia_jantar',
    label: 'Meia pensão — jantar',
    hint: 'Café + jantar (padrão: jantar no check-in, não no checkout)',
  },
  {
    id: 'pensao_completa',
    label: 'Pensão completa',
    hint: 'Café, almoço e jantar conforme regra do hotel',
  },
  {
    id: 'all_inclusive',
    label: 'All inclusive',
    hint: 'Todas as refeições em todos os dias',
  },
];

function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn + 'T12:00:00').getTime();
  const b = new Date(checkOut + 'T12:00:00').getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}

/** Grade padrão conforme tipo de pensão */
export function buildDefaultMeals(
  checkIn: string,
  checkOut: string,
  plan: PensionPlan
): DayMeals[] {
  const nights = nightsBetween(checkIn, checkOut);
  const days: DayMeals[] = [];
  for (let i = 0; i <= nights; i++) {
    const date = addDaysIso(checkIn, i);
    const isCheckIn = i === 0;
    const isCheckOut = i === nights;
    const label: DayMeals['label'] = isCheckIn
      ? 'checkin'
      : isCheckOut
        ? 'checkout'
        : 'intern';

    let breakfast = false;
    let lunch = false;
    let dinner = false;

    if (plan === 'cafe') {
      breakfast = !isCheckOut;
    } else if (plan === 'meia_almoco') {
      // Padrão: café nos pernoites; almoço do 2º dia até o checkout (não no check-in)
      breakfast = !isCheckOut;
      lunch = !isCheckIn;
    } else if (plan === 'meia_jantar') {
      breakfast = !isCheckOut;
      dinner = !isCheckOut;
    } else if (plan === 'pensao_completa') {
      breakfast = !isCheckOut;
      lunch = !isCheckIn;
      dinner = !isCheckOut;
    } else if (plan === 'all_inclusive') {
      breakfast = true;
      lunch = true;
      dinner = true;
    }

    days.push({ date, breakfast, lunch, dinner, label });
  }
  return days;
}

export function PensionTab({
  checkIn,
  checkOut,
  editable,
}: {
  checkIn: string;
  checkOut: string;
  editable: boolean;
}) {
  const [plan, setPlan] = useState<PensionPlan>('meia_almoco');
  const [mealDays, setMealDays] = useState<DayMeals[]>(() =>
    buildDefaultMeals(checkIn, checkOut, 'meia_almoco')
  );

  useEffect(() => {
    setMealDays((prev) => {
      const built = buildDefaultMeals(checkIn, checkOut, plan);
      return built.map((d) => {
        const old = prev.find((p) => p.date === d.date);
        return old
          ? { ...d, breakfast: old.breakfast, lunch: old.lunch, dinner: old.dinner }
          : d;
      });
    });
  }, [checkIn, checkOut, plan]);

  const applyPlan = (p: PensionPlan) => {
    setPlan(p);
    setMealDays(buildDefaultMeals(checkIn, checkOut, p));
  };

  const toggle = (idx: number, field: 'breakfast' | 'lunch' | 'dinner') => {
    if (!editable) return;
    setMealDays((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: !row[field] } : row))
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13px] font-semibold text-slate-800">Plano de pensão</p>
        <p className="text-[12px] text-slate-500 mt-0.5">
          Escolha o padrão e ajuste manualmente as refeições de cada dia (ex.: incluir almoço no
          check-in e retirar no checkout).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PENSION_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={!editable}
            onClick={() => applyPlan(opt.id)}
            className={cn(
              'text-left rounded-xl border px-3 py-2.5 transition-colors',
              plan === opt.id
                ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200'
                : 'border-slate-200 hover:bg-slate-50'
            )}
          >
            <p className="text-[13px] font-semibold text-slate-800">{opt.label}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{opt.hint}</p>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <p className="text-[12px] font-semibold text-slate-600">
            Grade de refeições · {mealDays.length} dia(s)
          </p>
          <button
            type="button"
            disabled={!editable}
            onClick={() => {
              setMealDays(buildDefaultMeals(checkIn, checkOut, plan));
              toast.message('Grade resetada para o padrão do plano');
            }}
            className="text-[11px] text-indigo-600 font-medium hover:underline"
          >
            Restaurar padrão
          </button>
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
              <th className="px-3 py-2 font-semibold">Dia</th>
              <th className="px-3 py-2 font-semibold text-center">Café</th>
              <th className="px-3 py-2 font-semibold text-center">Almoço</th>
              <th className="px-3 py-2 font-semibold text-center">Jantar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {mealDays.map((d, idx) => {
              const tag =
                d.label === 'checkin'
                  ? 'Check-in'
                  : d.label === 'checkout'
                    ? 'Check-out'
                    : 'Estadia';
              const tagCls =
                d.label === 'checkin'
                  ? 'bg-emerald-50 text-emerald-700'
                  : d.label === 'checkout'
                    ? 'bg-amber-50 text-amber-800'
                    : 'bg-slate-100 text-slate-600';
              return (
                <tr key={d.date} className="hover:bg-slate-50/80">
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-slate-800">{formatDateBR(d.date)}</p>
                    <span
                      className={cn(
                        'inline-flex mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold',
                        tagCls
                      )}
                    >
                      {tag}
                    </span>
                  </td>
                  {(['breakfast', 'lunch', 'dinner'] as const).map((field) => (
                    <td key={field} className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        disabled={!editable}
                        onClick={() => toggle(idx, field)}
                        className={cn(
                          'h-8 w-8 rounded-lg border text-[14px] font-bold transition-colors',
                          d[field]
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-slate-200 text-slate-300 hover:border-slate-300'
                        )}
                        title={
                          d[field]
                            ? 'Incluído — clique para remover'
                            : 'Não incluso — clique para incluir'
                        }
                      >
                        {d[field] ? '✓' : '·'}
                      </button>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-400">
        Exemplo: na meia pensão almoço o padrão marca almoço no checkout e não no check-in. Se o
        cliente negociou o contrário, marque o almoço no dia de check-in e desmarque no checkout.
      </p>
    </div>
  );
}
