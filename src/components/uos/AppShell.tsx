import { useMemo, useState } from 'react';
import { usePms, type ModuleId } from '@/lib/pms-store';
import { cn } from '@/lib/utils';
import {
  Building2,
  CalendarRange,
  ClipboardCheck,
  DoorOpen,
  LogOut,
  Search,
  Shield,
  Sparkles,
  Wallet,
  Bell,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { CashReportModal } from '@/components/uos/CashReportModal';
import { canAccessModule, getSession, logout, type AuthModuleKey } from '@/lib/auth-store';

const NAV: {
  section: string;
  items: { id: ModuleId | 'acessos'; label: string; icon: typeof DoorOpen }[];
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
  {
    section: 'Backoffice',
    items: [{ id: 'auditoria', label: 'Auditoria Life', icon: ClipboardCheck }],
  },
  {
    section: 'Administração',
    items: [{ id: 'acessos', label: 'Acessos', icon: Shield }],
  },
];

export function AppShell({ children, onLogout }: { children: ReactNode; onLogout?: () => void }) {
  const {
    hotel,
    module,
    setModule,
    rooms,
    reservations,
    accounts,
    cashOpen,
    openCashRegister,
    closeCashRegister,
  } = usePms();

  const session = getSession();
  const visibleNav = useMemo(() => {
    return NAV.map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        canAccessModule(session, item.id as AuthModuleKey),
      ),
    })).filter((g) => g.items.length > 0);
  }, [session]);

  const [closeModal, setCloseModal] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [fundoInput, setFundoInput] = useState('200,00');

  const occupied = rooms.filter((r) => r.occupancy === 'ocupado').length;
  const sellable = rooms.filter((r) => r.occupancy !== 'bloqueado').length;
  const occPct = sellable > 0 ? Math.round((occupied / sellable) * 100) : 0;
  const arrivalsToday = reservations.filter(
    (r) =>
      r.checkIn === hotel.operationalDate &&
      (r.status === 'confirmada' || r.status === 'pendente')
  ).length;

  const opDateBR = hotel.operationalDate.split('-').reverse().join('/');

  const doOpenCash = () => {
    const n = parseFloat(fundoInput.replace(/\./g, '').replace(',', '.')) || 0;
    const res = openCashRegister(n);
    if (res.ok) {
      toast.success(res.message);
      setOpenModal(false);
    } else toast.error(res.message);
  };

  const titles: Record<string, { title: string; subtitle: string }> = {
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
    fiscal: {
      title: 'Fiscal e Contábil',
      subtitle: 'Naturezas fiscais · livro · apuração (legado)',
    },
    auditoria: {
      title: 'Auditoria Life',
      subtitle: 'Etapas · Abrir Auditoria · Histórico · Pendências · Conciliação · taxas',
    },
    acessos: {
      title: 'Acessos',
      subtitle: 'Usuários · e-mail · senha · permissões de módulo e hotel',
    },
  };

  const title = titles[module] || titles.recepcao;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f0f2f7] text-slate-900 antialiased">
      <aside className="w-[248px] shrink-0 bg-[#0f172a] text-slate-300 flex flex-col shadow-[4px_0_24px_rgba(15,23,42,0.12)]">
        <div className="px-4 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 text-white flex items-center justify-center font-bold text-[13px] tracking-tight shadow-lg shadow-indigo-900/40">
              UOS
            </div>
            <div className="leading-tight min-w-0">
              <p className="font-semibold text-white text-[14px] tracking-tight">UOS</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.14em] font-medium">
                Property Management
              </p>
            </div>
          </div>
        </div>

        <div className="px-3 pb-3">
          <div className="rounded-xl bg-white/[0.06] border border-white/[0.08] px-3 py-3 backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-sky-500/15 text-sky-300 flex items-center justify-center shrink-0">
                <Building2 className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
                  Propriedade
                </p>
                <p className="text-[13px] font-semibold text-white truncate">{hotel.name}</p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Ocupação</span>
                <span className="font-semibold text-slate-200 tabular-nums">{occPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-400 transition-all duration-500"
                  style={{ width: `${occPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] pt-0.5">
                <span className="text-slate-500">Caixa</span>
                <span
                  className={cn(
                    'font-semibold inline-flex items-center gap-1.5',
                    cashOpen ? 'text-emerald-400' : 'text-rose-400'
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      cashOpen ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-rose-400'
                    )}
                  />
                  {cashOpen ? 'Aberto' : 'Fechado'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-2 space-y-5">
          {visibleNav.map((group) => (
            <div key={group.section}>
              <p className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
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
                        onClick={() => setModule(item.id as ModuleId)}
                        className={cn(
                          'w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-all text-left relative group',
                          active
                            ? 'bg-white/10 text-white font-medium shadow-sm'
                            : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-sky-400" />
                        )}
                        <Icon
                          className={cn(
                            'w-4 h-4 shrink-0 transition-colors',
                            active ? 'text-sky-300' : 'opacity-80 group-hover:opacity-100'
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                        {item.id === 'recepcao' && arrivalsToday > 0 && !active && (
                          <span className="ml-auto text-[10px] font-bold bg-rose-500 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-sm">
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

        <div className="p-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/[0.04] transition-colors">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-white flex items-center justify-center text-[11px] font-bold ring-2 ring-white/10">
              {(session?.displayName || 'U')[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-white font-medium truncate">
                {session?.displayName || 'Operador'}
              </p>
              <p className="text-[10px] text-slate-500 truncate">
                {session?.isAdmin ? 'Administrador' : session?.email || ''}
              </p>
            </div>
            <button
              type="button"
              title="Sair"
              onClick={() => {
                logout();
                onLogout?.();
                toast.message('Sessão encerrada');
              }}
              className="h-8 w-8 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white inline-flex items-center justify-center transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[60px] shrink-0 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-6 flex items-center gap-4 sticky top-0 z-20">
          <div className="flex-1 max-w-xl relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              placeholder="Buscar hóspede, reserva, UH ou documento…"
              className="w-full h-10 rounded-xl border border-slate-200/80 bg-slate-50/90 pl-10 pr-3 text-[13px] outline-none focus:bg-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-300 transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            {cashOpen ? (
              <button
                type="button"
                onClick={() => {
                  setConfirmClose(false);
                  setCloseModal(true);
                }}
                className="h-10 px-3.5 rounded-xl border border-slate-800 bg-slate-900 text-white text-[12px] font-semibold inline-flex items-center gap-2 hover:bg-slate-800 shadow-sm transition-colors"
              >
                <Wallet className="w-3.5 h-3.5" />
                Fechar caixa
                <span className="text-slate-400 font-normal tabular-nums text-[11px]">{opDateBR}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setFundoInput('200,00');
                  setOpenModal(true);
                }}
                className="h-10 px-3.5 rounded-xl border border-emerald-600/30 bg-emerald-600 text-white text-[12px] font-semibold inline-flex items-center gap-2 hover:bg-emerald-500 shadow-sm shadow-emerald-600/20 transition-colors"
              >
                <Wallet className="w-3.5 h-3.5" />
                Abrir caixa
                <span className="text-emerald-100 font-normal tabular-nums text-[11px]">{opDateBR}</span>
              </button>
            )}
            <button
              type="button"
              className="relative h-10 w-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors shadow-sm"
              aria-label="Notificações"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
            </button>
          </div>
        </header>

        {!cashOpen && (
          <div className="mx-6 mt-4 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-2.5 text-[12px] text-amber-900 flex items-center gap-2 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
            Caixa fechado — nenhum lançamento de pagamento ou consumo é permitido até abrir o caixa.
          </div>
        )}

        <div className="px-6 pt-6 pb-1">
          <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">{title.title}</h1>
          <p className="text-[13px] text-slate-500 mt-1">{title.subtitle}</p>
        </div>

        <main className="flex-1 overflow-y-auto px-6 pb-10 pt-4">{children}</main>
      </div>

      {closeModal && (
        <CashReportModal
          onClose={() => {
            setCloseModal(false);
            setConfirmClose(false);
          }}
        />
      )}

      {openModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/20">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <div>
                <p className="text-[15px] font-semibold text-slate-900">Abrir caixa</p>
                <p className="text-[12px] text-slate-500 mt-0.5">Informe o fundo de caixa em dinheiro</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                className="h-8 w-8 rounded-lg hover:bg-slate-100 inline-flex items-center justify-center text-slate-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-[13px]">
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 text-[12px] text-slate-600">
                Caixa: <span className="font-semibold text-slate-800">RECEPCAO01</span>
                <br />
                Data: <span className="font-semibold text-slate-800 tabular-nums">{opDateBR}</span>
              </div>
              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Fundo de caixa (R$)
                </span>
                <input
                  value={fundoInput}
                  onChange={(e) => setFundoInput(e.target.value)}
                  placeholder="0,00"
                  className="w-full h-11 rounded-xl border border-slate-200 px-3 text-right tabular-nums outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3.5">
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                className="h-10 px-4 rounded-xl border border-slate-200 text-[13px] font-medium hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={doOpenCash}
                className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-500 shadow-sm shadow-emerald-600/25 transition-colors"
              >
                Abrir caixa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
