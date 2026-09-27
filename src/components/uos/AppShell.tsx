import { useEffect, useMemo, useState } from 'react';
import { usePms, type ModuleId } from '@/lib/pms-store';
import { cn } from '@/lib/utils';
import {
  Building2,
  CalendarRange,
  ClipboardCheck,
  CreditCard,
  DoorOpen,
  LogOut,
  Search,
  Sparkles,
  Wallet,
  Bell,
  X,
  Menu,
  Package,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { CashReportModal } from '@/components/uos/CashReportModal';
import {
  canAccessModule,
  firstAllowedModule,
  getSession,
  logout,
  type AuthModuleKey,
} from '@/lib/auth-store';

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
    items: [
      { id: 'governanca', label: 'Governança', icon: Sparkles },
      { id: 'cartoes', label: 'Cartões NFC', icon: CreditCard },
      { id: 'produtos', label: 'Produtos', icon: Package },
    ],
  },
  {
    section: 'Backoffice',
    items: [{ id: 'auditoria', label: 'Auditoria Life', icon: ClipboardCheck }],
  },
];

export function AppShell({ children, onLogout }: { children: ReactNode; onLogout?: () => void }) {
  const {
    hotel,
    module,
    setModule,
    rooms,
    reservations,
    cashOpen,
    openCashRegister,
  } = usePms();

  const session = getSession();
  const [navOpen, setNavOpen] = useState(false);

  const visibleNav = useMemo(() => {
    return NAV.map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        canAccessModule(session, item.id as AuthModuleKey),
      ),
    })).filter((g) => g.items.length > 0);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    if (!canAccessModule(session, module as AuthModuleKey)) {
      const first = firstAllowedModule(session) as ModuleId;
      setModule(first);
    }
  }, [session, module, setModule]);

  useEffect(() => {
    setNavOpen(false);
  }, [module]);

  useEffect(() => {
    if (navOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [navOpen]);

  const [closeModal, setCloseModal] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [fundoInput, setFundoInput] = useState('200,00');

  const occupied = rooms.filter((r) => r.occupancy === 'ocupado').length;
  const sellable = rooms.filter((r) => r.occupancy !== 'bloqueado').length;
  const occPct = sellable > 0 ? Math.round((occupied / sellable) * 100) : 0;
  const arrivalsToday = reservations.filter(
    (r) =>
      r.checkIn === hotel.operationalDate &&
      (r.status === 'confirmada' || r.status === 'pendente'),
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
    cartoes: {
      title: 'Cartões NFC',
      subtitle: 'Pulseiras · vínculo · venda por aproximação',
    },
    produtos: {
      title: 'Produtos',
      subtitle: 'Catálogo para Bar, Restaurante e Recepção · preços e PDVs',
    },
  };

  const title = titles[module] || titles.recepcao;

  const selectModule = (id: ModuleId) => {
    setModule(id);
    setNavOpen(false);
  };

  const sidebar = (
    <div className="h-full w-[min(280px,85vw)] md:w-[232px] bg-[#0b1220] text-slate-300 flex flex-col">
      <div className="px-4 py-4 md:py-5 border-b border-white/5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-[13px] tracking-tight shadow-lg shadow-blue-600/30 shrink-0">
            UOS
          </div>
          <div className="leading-tight min-w-0">
            <p className="font-semibold text-white text-sm tracking-tight">UOS</p>
            <p className="text-[9px] text-slate-500 uppercase tracking-[0.12em]">Property Management</p>
          </div>
        </div>
        <button
          type="button"
          className="md:hidden h-9 w-9 rounded-lg hover:bg-white/10 text-slate-400 inline-flex items-center justify-center shrink-0"
          onClick={() => setNavOpen(false)}
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-3 py-3 border-b border-white/5">
        <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-[0.14em] text-slate-500 font-medium">Propriedade</p>
              <p className="text-[13px] font-medium text-white truncate">{hotel.name}</p>
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Ocupação</span>
            <span className="font-semibold text-slate-200">{occPct}%</span>
          </div>
          <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${occPct}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Caixa</span>
            <span
              className={cn(
                'font-semibold inline-flex items-center gap-1.5',
                cashOpen ? 'text-emerald-400' : 'text-rose-400',
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', cashOpen ? 'bg-emerald-400' : 'bg-rose-400')} />
              {cashOpen ? 'Aberto' : 'Fechado'}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-5 overscroll-contain">
        {visibleNav.map((group) => (
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
                      onClick={() => selectModule(item.id as ModuleId)}
                      className={cn(
                        'w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[14px] md:text-[13px] transition-all text-left min-h-[44px] md:min-h-0',
                        active
                          ? 'bg-white/10 text-white font-medium'
                          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 active:bg-white/10',
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

      <div className="p-3 border-t border-white/5 safe-area-pb">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="h-8 w-8 rounded-full bg-blue-600/80 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
            {(session?.displayName || 'U')[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-white font-medium truncate">{session?.displayName || 'Operador'}</p>
            <p className="text-[10px] text-slate-500 truncate">
              {session?.isAdmin ? 'Administrador' : session?.email || ''}
            </p>
          </div>
          {session && (
          <button
            type="button"
            title="Sair"
            onClick={() => {
              logout();
              onLogout?.();
              toast.message('Sessão encerrada');
            }}
            className="h-10 w-10 rounded-lg hover:bg-white/10 text-slate-400 inline-flex items-center justify-center"
          >
            <LogOut className="w-4 h-4" />
          </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#eef1f6] text-slate-900 antialiased">
      <aside className="hidden md:flex shrink-0">{sidebar}</aside>

      {navOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Fechar menu"
            onClick={() => setNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="h-14 md:h-[56px] shrink-0 bg-white border-b border-slate-200/80 px-3 md:px-5 flex items-center gap-2 md:gap-4">
          <button
            type="button"
            className="md:hidden h-10 w-10 rounded-lg border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 shrink-0"
            onClick={() => setNavOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1 max-w-lg relative min-w-0 hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              placeholder="Buscar hóspede, reserva, UH…"
              className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50/80 pl-9 pr-3 text-[13px] outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all"
            />
          </div>

          <div className="ml-auto flex items-center gap-1.5 md:gap-2 shrink-0">
            {cashOpen ? (
              <button
                type="button"
                onClick={() => setCloseModal(true)}
                className="h-9 px-2.5 md:px-3 rounded-lg border border-slate-800 bg-slate-900 text-white text-[11px] md:text-[12px] font-medium inline-flex items-center gap-1.5 hover:bg-slate-800"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Fechar</span>
                <span className="text-slate-300 font-normal tabular-nums hidden md:inline">{opDateBR}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setFundoInput('200,00');
                  setOpenModal(true);
                }}
                className="h-9 px-2.5 md:px-3 rounded-lg border border-emerald-700 bg-emerald-600 text-white text-[11px] md:text-[12px] font-medium inline-flex items-center gap-1.5 hover:bg-emerald-500"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Abrir caixa</span>
              </button>
            )}
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

        {!cashOpen && (
          <div className="mx-3 md:mx-6 mt-2 md:mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 md:px-4 py-2 text-[11px] md:text-[12px] text-amber-900">
            Caixa fechado — abra o caixa para lançar pagamentos e consumos.
          </div>
        )}

        <div className="px-3 md:px-6 pt-3 md:pt-5 pb-1">
          <h1 className="text-[18px] md:text-[22px] font-semibold tracking-tight text-slate-900">{title.title}</h1>
          <p className="text-[12px] md:text-[13px] text-slate-500 mt-0.5 line-clamp-2">{title.subtitle}</p>
        </div>

        <main className="flex-1 overflow-y-auto overscroll-contain px-3 md:px-6 pb-6 md:pb-8 pt-3 md:pt-4">
          {children}
        </main>
      </div>

      {closeModal && <CashReportModal onClose={() => setCloseModal(false)} />}

      {openModal && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div>
                <p className="text-[15px] font-semibold text-slate-900">Abrir caixa</p>
                <p className="text-[12px] text-slate-500">Informe o fundo de caixa em dinheiro</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                className="h-10 w-10 rounded-lg hover:bg-slate-100 inline-flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-[13px]">
              <div className="text-[12px] text-slate-500">
                Caixa: <span className="font-semibold text-slate-800">RECEPCAO01</span>
                <br />
                Data: <span className="font-semibold text-slate-800 tabular-nums">{opDateBR}</span>
              </div>
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold uppercase text-slate-400">Fundo de caixa (R$)</span>
                <input
                  value={fundoInput}
                  onChange={(e) => setFundoInput(e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                  className="w-full h-11 rounded-lg border border-slate-200 px-3 text-right tabular-nums text-[16px] outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                className="h-11 px-4 rounded-lg border border-slate-200 text-[13px] font-medium hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={doOpenCash}
                className="h-11 px-4 rounded-lg bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-500"
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
