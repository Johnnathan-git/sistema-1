import { usePms, type ModuleId } from '@/lib/pms-store';
import { cn } from '@/lib/utils';
import {
  Building2,
  CalendarDays,
  ClipboardList,
  DoorOpen,
  LayoutDashboard,
  Search,
  Sparkles,
  Wallet,
} from 'lucide-react';
import type { ReactNode } from 'react';

const NAV: {
  section: string;
  items: { id: ModuleId; label: string; icon: typeof DoorOpen }[];
}[] = [
  {
    section: 'Recepção / Front Desk',
    items: [
      { id: 'recepcao', label: 'Check-in / Check-out', icon: DoorOpen },
      { id: 'contas', label: 'Gerenciamento de Contas', icon: Wallet },
    ],
  },
  {
    section: 'Central de Reservas',
    items: [{ id: 'reservas', label: 'Reservas', icon: CalendarDays }],
  },
  {
    section: 'Governança',
    items: [{ id: 'governanca', label: 'Status de UH', icon: Sparkles }],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { hotel, module, setModule } = usePms();

  const title: Record<ModuleId, string> = {
    recepcao: 'Recepção',
    contas: 'Gerenciamento de Contas',
    reservas: 'Central de Reservas',
    governanca: 'Governança',
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f7f5] text-slate-900">
      {/* Sidebar */}
      <aside className="w-[240px] shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
              UOS
            </div>
            <div className="leading-tight">
              <p className="font-bold text-sm tracking-tight">UOS</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                Gestão completa
              </p>
            </div>
          </div>
        </div>

        <div className="px-3 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <Building2 className="w-4 h-4 text-slate-500" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Hotel ativo
              </p>
              <p className="text-sm font-semibold truncate">{hotel.name}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
          {NAV.map((group) => (
            <div key={group.section}>
              <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
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
                          'w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors text-left',
                          active
                            ? 'bg-slate-900 text-white font-medium'
                            : 'text-slate-600 hover:bg-slate-100'
                        )}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-100 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <LayoutDashboard className="w-3.5 h-3.5" />
            UOS PMS · v1.0
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 border-b border-slate-200 bg-white px-5 flex items-center gap-4">
          <div className="flex-1 max-w-xl relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              placeholder="Buscar reservas, hóspedes, lançamentos…"
              className="w-full h-9 rounded-full border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
          <div className="ml-auto flex items-center gap-2 text-sm text-slate-500">
            <ClipboardList className="w-4 h-4" />
            <span className="hidden md:inline">Operacional</span>
            <div className="h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
              JH
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="px-6 pt-5 pb-2">
            <h1 className="text-2xl font-semibold tracking-tight">{title[module]}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {hotel.name} · Data operacional{' '}
              {hotel.operationalDate.split('-').reverse().join('/')} · Atualizado agora
            </p>
          </div>
          <div className="px-6 pb-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
