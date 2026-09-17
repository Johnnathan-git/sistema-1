import { useMemo, useState } from 'react';
import { usePms, type ModuleId } from '@/lib/pms-store';
import { cn } from '@/lib/utils';
import {
  Building2,
  CalendarRange,
  DoorOpen,
  Search,
  Sparkles,
  Wallet,
  Bell,
  Settings,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

const NAV: {
  section: string;
  items: { id: ModuleId; label: string; icon: typeof DoorOpen }[];
}[] = [
  {
    section: 'Recepção',
    items: [
      { id: 'recepcao', label: 'Recepção', icon: DoorOpen },
      { id: 'contas', label: 'Contas', icon: Wallet },
    ],
  },
  {
    section: 'Comercial',
    items: [{ id: 'reservas', label: 'Reservas', icon: CalendarRange }],
  },
  {
    section: 'Operações',
    items: [{ id: 'governanca', label: 'Governança', icon: Sparkles }],
  },
];

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function AppShell({ children }: { children: ReactNode }) {
  const { hotel, module, setModule, rooms, reservations, accounts } = usePms();

  const [cashOpen, setCashOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [effective, setEffective] = useState<Record<string, string>>({});

  const occupied = rooms.filter((r) => r.occupancy === 'ocupado').length;
  const sellable = rooms.filter((r) => r.occupancy !== 'bloqueado').length;
  const occPct = sellable > 0 ? Math.round((occupied / sellable) * 100) : 0;
  const arrivalsToday = reservations.filter(
    (r) =>
      r.checkIn === hotel.operationalDate &&
      (r.status === 'confirmada' || r.status === 'pendente')
  ).length;

  const opDateBR = hotel.operationalDate.split('-').reverse().join('/');

  /** Totaliza pagamentos do dia por método/bandeira */
  const totalsByMethod = useMemo(() => {
    const map = new Map<string, number>();
    for (const acc of accounts) {
      for (const p of acc.payments) {
        if (p.date !== hotel.operationalDate) continue;
        const key = (p.method || 'OUTROS').toUpperCase();
        map.set(key, (map.get(key) || 0) + p.amount);
      }
    }
    // Garante linhas padrão mesmo sem movimento
    const defaults = ['DINHEIRO', 'PIX', 'DÉBITO', 'CRÉDITO À VISTA', 'CRÉDITO PARCELADO'];
    for (const d of defaults) {
      if (!map.has(d)) map.set(d, 0);
    }
    return Array.from(map.entries())
      .map(([tipo, valor]) => ({ tipo, valor }))
      .sort((a, b) => a.tipo.localeCompare(b.tipo, 'pt-BR'));
  }, [accounts, hotel.operationalDate]);

  const openCash = () => {
    const init: Record<string, string> = {};
    for (const row of totalsByMethod) {
      init[row.tipo] = row.valor.toFixed(2);
    }
    setEffective(init);
    setConfirmClose(false);
    setCashOpen(true);
  };

  const doCloseCash = () => {
    setCashOpen(false);
    setConfirmClose(false);
    toast.success(`Caixa fechado · dia ${opDateBR}`);
  };

  const titles: Record<ModuleId, { title: string; subtitle: string }> = {
    recepcao: {
      title: 'Recepção',
      subtitle: 'Operação do dia · chegadas, hospedados e saídas',
    },
    contas: {
      title: 'Contas',
      subtitle: 'Contas de hóspede e avulsas · lançamentos e pagamentos',
    },
    reservas: {
      title: 'Central de Reservas',
      subtitle: 'Buscar, criar e gerenciar reservas · FNRH e conta',
    },
    governanca: {
      title: 'Governança',
      subtitle: 'Ocupação · arrumação · camareira · bloqueio e histórico',
    },
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#eef1f6] text-slate-900 antialiased">
      <aside className="w-[232px] shrink-0 bg-white text-slate-700 flex flex-col border-r border-slate-200">
        <div className="px-4 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-[13px] tracking-tight">
              UOS
            </div>
            <div className="leading-tight min-w-0">
              <p className="font-semibold text-slate-900 text-sm tracking-tight">UOS</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-[0.12em]">
                Property Management
              </p>
            </div>
          </div>
        </div>

        <div className="px-3 py-3 border-b border-slate-100">
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-[0.14em] text-slate-400 font-medium">
                  Propriedade
                </p>
                <p className="text-[13px] font-medium text-slate-900 truncate">{hotel.name}</p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Ocupação</span>
              <span className="font-semibold text-slate-800">{occPct}%</span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-slate-600 transition-all"
                style={{ width: `${occPct}%` }}
              />
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-5">
          {NAV.map((group) => (
            <div key={group.section}>
              <p className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {group.section}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = module === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setModule(item.id)}
                        className={cn(
                          'w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-all text-left',
                          active
                            ? 'bg-slate-100 text-slate-900 font-medium'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        )}
                      >
                        <Icon className="w-4 h-4 shrink-0 opacity-90" />
                        <span className="truncate">{item.label}</span>
                        {item.id === 'recepcao' && arrivalsToday > 0 && !active && (
                          <span className="ml-auto text-[10px] font-bold bg-rose-500 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                            {arrivalsToday}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="h-7 w-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[11px] font-bold">
              JH
            </div>
            <div className="min-w-0">
              <p className="text-[12px] text-slate-900 font-medium truncate">Operador</p>
              <p className="text-[10px] text-slate-400">Recepção</p>
            </div>
            <Settings className="w-3.5 h-3.5 text-slate-400 ml-auto" />
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[56px] shrink-0 bg-white border-b border-slate-200/80 px-5 flex items-center gap-4">
          <div className="flex-1 max-w-lg relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              placeholder="Buscar hóspede, reserva, UH ou documento…"
              className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50/80 pl-9 pr-3 text-[13px] outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all"
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={openCash}
              className="h-9 px-3 rounded-lg border border-slate-800 bg-slate-900 text-white text-[12px] font-medium inline-flex items-center gap-1.5 hover:bg-slate-800"
              title="Fechar caixa do dia operacional"
            >
              <Wallet className="w-3.5 h-3.5" />
              Fechar caixa
              <span className="text-slate-300 font-normal tabular-nums">{opDateBR}</span>
            </button>
            <button
              type="button"
              className="relative h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"
              aria-label="Notificações"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
            </button>
          </div>
        </header>

        <div className="px-6 pt-5 pb-1">
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">
            {titles[module].title}
          </h1>
          <p className="text-[13px] text-slate-500 mt-0.5">{titles[module].subtitle}</p>
        </div>

        <main className="flex-1 overflow-y-auto px-6 pb-8 pt-4">{children}</main>
      </div>

      {/* Fechamento de caixa */}
      {cashOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div>
                <p className="text-[15px] font-semibold text-slate-900">Fechamento de caixa</p>
                <p className="text-[12px] text-slate-500">
                  Informe o valor efetivo de cada tipo de recebimento
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCashOpen(false)}
                className="h-8 w-8 rounded-lg hover:bg-slate-100 inline-flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-slate-50 text-[12px] grid grid-cols-2 gap-x-4 gap-y-1">
              <div>
                <span className="text-slate-400">Caixa:</span>{' '}
                <span className="font-semibold text-slate-800">RECEPCAO01</span>
              </div>
              <div>
                <span className="text-slate-400">Usuário:</span>{' '}
                <span className="font-semibold text-slate-800">Operador</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400">Abertura:</span>{' '}
                <span className="font-semibold text-slate-800 tabular-nums">
                  {opDateBR} 08:00:00
                </span>
              </div>
            </div>

            <div className="px-5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Totalizador por tipo de recebimento
              </p>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
                      <th className="px-3 py-2 font-semibold">Tipo de recebimento</th>
                      <th className="px-3 py-2 font-semibold text-right">Valor sistema</th>
                      <th className="px-3 py-2 font-semibold text-right">Valor efetivo</th>
                      <th className="px-3 py-2 font-semibold text-right">Diferença</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {totalsByMethod.map((row) => {
                      const eff = parseFloat((effective[row.tipo] || '0').replace(',', '.')) || 0;
                      const diff = eff - row.valor;
                      return (
                        <tr key={row.tipo}>
                          <td className="px-3 py-2 font-medium text-slate-800">{row.tipo}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                            {formatBRL(row.valor)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              value={effective[row.tipo] ?? ''}
                              onChange={(e) =>
                                setEffective((prev) => ({
                                  ...prev,
                                  [row.tipo]: e.target.value,
                                }))
                              }
                              className="w-24 h-8 rounded-lg border border-slate-200 px-2 text-right tabular-nums outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2 text-right tabular-nums font-medium',
                              Math.abs(diff) < 0.01
                                ? 'text-slate-500'
                                : diff > 0
                                  ? 'text-emerald-700'
                                  : 'text-rose-700'
                            )}
                          >
                            {formatBRL(diff)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200">
                    <tr className="font-semibold text-[12px]">
                      <td className="px-3 py-2">Total</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatBRL(totalsByMethod.reduce((s, r) => s + r.valor, 0))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatBRL(
                          totalsByMethod.reduce(
                            (s, r) =>
                              s +
                              (parseFloat((effective[r.tipo] || '0').replace(',', '.')) || 0),
                            0
                          )
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatBRL(
                          totalsByMethod.reduce((s, r) => {
                            const eff =
                              parseFloat((effective[r.tipo] || '0').replace(',', '.')) || 0;
                            return s + (eff - r.valor);
                          }, 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                onClick={() => setCashOpen(false)}
                className="h-9 px-4 rounded-lg border border-slate-200 text-[13px] font-medium hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setConfirmClose(true)}
                className="h-9 px-4 rounded-lg bg-blue-600 text-white text-[13px] font-semibold hover:bg-blue-500"
              >
                Fechar
              </button>
            </div>
          </div>

          {confirmClose && (
            <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/30">
              <div className="w-full max-w-xs rounded-xl border border-slate-200 bg-white shadow-xl p-5">
                <p className="text-[14px] font-semibold text-slate-900 mb-1">Atenção</p>
                <p className="text-[13px] text-slate-600 mb-4">Deseja realmente fechar o caixa?</p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmClose(false)}
                    className="h-9 px-4 rounded-lg border border-slate-200 text-[13px] font-medium hover:bg-slate-50"
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    onClick={doCloseCash}
                    className="h-9 px-4 rounded-lg bg-blue-600 text-white text-[13px] font-semibold hover:bg-blue-500"
                  >
                    Sim
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
