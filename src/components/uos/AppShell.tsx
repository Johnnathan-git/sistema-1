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
} from 'lucide-react';
import type { ReactNode } from 'react';

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

export function AppShell({ children }: { children: ReactNode }) {
  const { hotel, module, setModule, rooms, reservations } = usePms();

  const occupied = rooms.filter((r) => r.occupancy === 'ocupado').length;
  const sellable = rooms.filter((r) => r.occupancy !== 'bloqueado').length;
  const occPct = sellable > 0 ? Math.round((occupied / sellable) * 100) : 0;
  const arrivalsToday = reservations.filter(
    (r) =>
      r.checkIn === hotel.operationalDate &&
      (r.status === 'confirmada' || r.status === 'pendente')
  ).length;

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
    <div className="flex h-screen overflow-hidden bg-[#f4f5f7] text-slate-900 antialiased">
      <aside className="w-[232px] shrink-0 bg-[#0f172a] text-slate-300 flex flex-col">
        <div className="px-4 py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-500 text-white flex items-center justify-center font-bold text-[13px] tracking-tight shadow-lg shadow-indigo-500/30">
              UOS
            </div>
            <div className="leading-tight min-w-0">
              <p className="font-semibold text-white text-sm tracking-tight">UOS</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-[0.12em]">
                Property Management
              </p>
            </div>
          </div>
        </div>

        <div className="px-3 py-3 border-b border-white/5">
          <div className="rounded-xl bg-white/5 border border-white/5 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-[0.14em] text-slate-500 font-medium">
                  Propriedade
                </p>
                <p className="text-[13px] font-medium text-white truncate">{hotel.name}</p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Ocupação</span>
              <span className="font-semibold text-indigo-300">{occPct}%</span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-400 transition-all"
                style={{ width: `${occPct}%` }}
              />
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-5">
          {NAV.map((group) => (
            <div key={group.section}>
              <p className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
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
                            ? 'bg-indigo-500 text-white font-medium shadow-md shadow-indigo-500/20'
                            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                        )}
                      >
                        <Icon className="w-4 h-4 shrink-0 opacity-90" />
                        <span className="truncate">{item.label}</span>
                        {item.id === 'recepcao' && arrivalsToday > 0 && !active && (
                          <span className="ml-auto text-[10px] font-bold bg-rose-500/90 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
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

        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="h-7 w-7 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-[11px] font-bold">
              JH
            </div>
            <div className="min-w-0">
              <p className="text-[12px] text-white font-medium truncate">Operador</p>
              <p className="text-[10px] text-slate-500">Recepção</p>
            </div>
            <Settings className="w-3.5 h-3.5 text-slate-500 ml-auto" />
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
              className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50/80 pl-9 pr-3 text-[13px] outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 h-9">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Data op.
              </span>
              <span className="text-[13px] font-semibold tabular-nums">
                {hotel.operationalDate.split('-').reverse().join('/')}
              </span>
            </div>
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
    </div>
  );
}
