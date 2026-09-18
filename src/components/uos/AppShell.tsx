import { useMemo, useState } from 'react';
import { usePms, type ModuleId } from '@/lib/pms-store';
import { cn } from '@/lib/utils';
import {
  Building2,
  CalendarRange,
  ClipboardCheck,
  BadgeCheck,
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
import { CashReportModal } from '@/components/uos/CashReportModal';

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
  {
    section: 'Backoffice',
    items: [
      { id: 'auditoria', label: 'Auditoria Life', icon: ClipboardCheck },
      { id: 'aprovacao', label: 'Aprovação', icon: BadgeCheck },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
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
      subtitle: 'Checklist diário · PMS × Adquirente · Adquirente × Banco · taxas',
    },
    aprovacao: {
      title: 'Aprovação',
      subtitle: 'Fila de auditorias enviadas · aprovar ou contestar',
    },
  };

  const title = titles[module] || titles.recepcao;

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
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Caixa</span>
              <span
                className={cn(
                  'font-semibold',
                  cashOpen ? 'text-emerald-700' : 'text-rose-700'
                )}
              >
                {cashOpen ? 'Aberto' : 'Fechado'}
              </span>
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

          <div className="ml-auto flex items-center gap-2">
            {cashOpen ? (
              <button
                type="button"
                onClick={() => {
                  setConfirmClose(false);
                  setCloseModal(true);
                }}
                className="h-9 px-3 rounded-lg border border-slate-800 bg-slate-900 text-white text-[12px] font-medium inline-flex items-center gap-1.5 hover:bg-slate-800"
              >
                <Wallet className="w-3.5 h-3.5" />
                Fechar caixa
                <span className="text-slate-300 font-normal tabular-nums">{opDateBR}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setFundoInput('200,00');
                  setOpenModal(true);
                }}
                className="h-9 px-3 rounded-lg border border-emerald-700 bg-emerald-600 text-white text-[12px] font-medium inline-flex items-center gap-1.5 hover:bg-emerald-500"
              >
                <Wallet className="w-3.5 h-3.5" />
                Abrir caixa
                <span className="text-emerald-100 font-normal tabular-nums">{opDateBR}</span>
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
          <div className="mx-6 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-[12px] text-amber-900">
            Caixa fechado — nenhum lançamento de pagamento ou consumo é permitido até abrir o caixa.
          </div>
        )}

        <div className="px-6 pt-5 pb-1">
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">{title.title}</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">{title.subtitle}</p>
        </div>

        <main className="flex-1 overflow-y-auto px-6 pb-8 pt-4">{children}</main>
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div>
                <p className="text-[15px] font-semibold text-slate-900">Abrir caixa</p>
                <p className="text-[12px] text-slate-500">Informe o fundo de caixa em dinheiro</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                className="h-8 w-8 rounded-lg hover:bg-slate-100 inline-flex items-center justify-center"
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
                <span className="text-[11px] font-semibold uppercase text-slate-400">
                  Fundo de caixa (R$)
                </span>
                <input
                  value={fundoInput}
                  onChange={(e) => setFundoInput(e.target.value)}
                  placeholder="0,00"
                  className="w-full h-10 rounded-lg border border-slate-200 px-3 text-right tabular-nums outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                className="h-9 px-4 rounded-lg border border-slate-200 text-[13px] font-medium hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={doOpenCash}
                className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-500"
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
