import { useMemo, useState } from 'react';
import { usePms } from '@/lib/pms-store';
import { accountBalance, formatBRL, formatDateBR } from '@/lib/pms-types';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  Clock,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

type Tab = 'geral' | 'chegadas' | 'hospedados' | 'saidas' | 'pendencias';

export function ReceptionModule() {
  const { hotel, reservations, rooms, accounts, checkIn, checkOut } = usePms();
  const [tab, setTab] = useState<Tab>('geral');
  const [q, setQ] = useState('');
  const today = hotel.operationalDate;

  const arrivals = reservations.filter(
    (r) => r.checkIn === today && (r.status === 'confirmada' || r.status === 'pendente')
  );
  const inHouse = reservations.filter((r) => r.status === 'checkin');
  const departures = reservations.filter(
    (r) => r.checkOut === today && r.status === 'checkin'
  );
  const notReady = rooms.filter((r) =>
    ['sujo', 'limpeza', 'inspecao', 'interditado', 'manutencao'].includes(r.status)
  );
  const pendingBalance = accounts.filter((a) => accountBalance(a) > 0.01);
  const occupied = rooms.filter((r) => r.status === 'ocupado').length;
  const sellable = rooms.filter((r) => !['interditado', 'manutencao'].includes(r.status)).length;
  const free = rooms.filter((r) => r.status === 'livre').length;
  const occPct = sellable > 0 ? Math.round((occupied / sellable) * 100) : 0;

  const actionList = useMemo(() => {
    let list = [...reservations];
    if (tab === 'chegadas') list = arrivals;
    else if (tab === 'hospedados') list = inHouse;
    else if (tab === 'saidas') list = departures;
    else if (tab === 'pendencias')
      list = reservations.filter((r) => {
        if (r.status === 'cancelada' || r.status === 'checkout') return false;
        const acc = accounts.find((a) => a.id === r.accountId);
        const balance = acc ? accountBalance(acc) : r.totalAmount - r.paidAmount;
        const room = rooms.find((rm) => rm.id === r.roomId);
        const uhNotReady =
          room && ['sujo', 'limpeza', 'inspecao', 'interditado', 'manutencao'].includes(room.status);
        return balance > 0.01 || !!uhNotReady || !r.fnrhFilled;
      });
    else
      list = [...arrivals, ...departures, ...inHouse].filter(
        (r, i, arr) => arr.findIndex((x) => x.id === r.id) === i
      );

    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (r) =>
          r.guestName.toLowerCase().includes(query) ||
          r.code.toLowerCase().includes(query) ||
          (r.roomNumber || '').toLowerCase().includes(query)
      );
    }
    return list;
  }, [tab, q, arrivals, inHouse, departures, reservations, accounts, rooms]);

  const doCheckIn = (id: string) => {
    const res = checkIn(id);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
  };
  const doCheckOut = (id: string) => {
    const res = checkOut(id);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
  };

  const kpis: {
    id: Tab | 'occ';
    label: string;
    value: string | number;
    hint: string;
    accent: string;
    icon: typeof LogIn;
  }[] = [
    {
      id: 'occ',
      label: 'Ocupação',
      value: `${occPct}%`,
      hint: `${occupied}/${sellable} UHs · ${free} livres`,
      accent: 'from-indigo-500 to-indigo-600',
      icon: BedDouble,
    },
    {
      id: 'chegadas',
      label: 'Chegadas',
      value: arrivals.length,
      hint: 'Check-in previsto hoje',
      accent: 'from-rose-500 to-rose-600',
      icon: LogIn,
    },
    {
      id: 'hospedados',
      label: 'In-house',
      value: inHouse.length,
      hint: 'Hóspedes no hotel',
      accent: 'from-emerald-500 to-emerald-600',
      icon: CheckCircle2,
    },
    {
      id: 'saidas',
      label: 'Saídas',
      value: departures.length,
      hint: 'Check-out previsto',
      accent: 'from-amber-500 to-amber-600',
      icon: LogOut,
    },
    {
      id: 'pendencias',
      label: 'Pendências',
      value: pendingBalance.length + notReady.filter((r) => r.status === 'sujo').length,
      hint: 'Saldo + UH suja',
      accent: 'from-slate-600 to-slate-700',
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          const clickable = k.id !== 'occ';
          const active = clickable && tab === k.id;
          return (
            <button
              key={k.id}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && setTab(k.id as Tab)}
              className={cn(
                'relative overflow-hidden rounded-2xl border bg-white text-left p-4 shadow-sm transition-all',
                clickable && 'hover:shadow-md hover:border-slate-300 cursor-pointer',
                active && 'ring-2 ring-indigo-500 border-indigo-200',
                !clickable && 'cursor-default'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    {k.label}
                  </p>
                  <p className="mt-1 text-[28px] font-semibold tracking-tight tabular-nums leading-none">
                    {k.value}
                  </p>
                  <p className="mt-1.5 text-[11px] text-slate-500">{k.hint}</p>
                </div>
                <div
                  className={cn(
                    'h-9 w-9 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shadow-sm',
                    k.accent
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Main list */}
        <div className="xl:col-span-9 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filtrar lista…"
                className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
              />
            </div>
            <button
              type="button"
              onClick={() => toast.message('Lista atualizada')}
              className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13px] inline-flex items-center gap-1.5 text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Atualizar
            </button>
          </div>

          <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
            {(
              [
                ['geral', 'Visão geral'],
                ['chegadas', `Chegadas (${arrivals.length})`],
                ['hospedados', `In-house (${inHouse.length})`],
                ['saidas', `Saídas (${departures.length})`],
                ['pendencias', 'Pendências'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  'px-3.5 py-2.5 text-[13px] whitespace-nowrap border-b-2 -mb-px transition-colors',
                  tab === id
                    ? 'border-indigo-600 text-indigo-700 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <p className="text-[12px] font-semibold text-slate-600">
                Fila operacional · {actionList.length} registro{actionList.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-slate-400 border-b border-slate-100">
                    <th className="px-4 py-2.5 font-semibold">Hóspede</th>
                    <th className="px-3 py-2.5 font-semibold">UH</th>
                    <th className="px-3 py-2.5 font-semibold">Estadia</th>
                    <th className="px-3 py-2.5 font-semibold">Canal</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold">Conta</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {actionList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-14 text-center text-slate-400">
                        Nenhuma operação nesta visão
                      </td>
                    </tr>
                  ) : (
                    actionList.map((r) => {
                      const room = rooms.find((rm) => rm.id === r.roomId);
                      const acc = accounts.find((a) => a.id === r.accountId);
                      const balance = acc
                        ? accountBalance(acc)
                        : r.totalAmount - r.paidAmount;
                      const uhNotReady =
                        room &&
                        ['sujo', 'limpeza', 'inspecao', 'interditado', 'manutencao'].includes(
                          room.status
                        );

                      return (
                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900 leading-snug">{r.guestName}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {r.code} · {r.roomType}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <span className="font-semibold tabular-nums">{r.roomNumber || '—'}</span>
                          </td>
                          <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                            {formatDateBR(r.checkIn).slice(0, 5)} →{' '}
                            {formatDateBR(r.checkOut).slice(0, 5)}
                          </td>
                          <td className="px-3 py-3 capitalize text-slate-500">{r.origin}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-1">
                              {r.status === 'confirmada' && (
                                <Pill tone="slate">Aguardando</Pill>
                              )}
                              {r.status === 'checkin' && <Pill tone="green">In-house</Pill>}
                              {r.status === 'pendente' && <Pill tone="amber">Pendente</Pill>}
                              {uhNotReady && <Pill tone="rose">UH não pronta</Pill>}
                              {!r.fnrhFilled && <Pill tone="amber">FNRH</Pill>}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            {balance > 0.01 ? (
                              <span className="text-rose-600 font-semibold tabular-nums text-[12px]">
                                {formatBRL(balance)}
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-medium text-[12px]">Quitado</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex gap-1.5">
                              {(r.status === 'confirmada' || r.status === 'pendente') && (
                                <button
                                  type="button"
                                  onClick={() => doCheckIn(r.id)}
                                  className="h-8 px-3 rounded-lg bg-indigo-600 text-white text-[12px] font-semibold hover:bg-indigo-500 shadow-sm shadow-indigo-600/20"
                                >
                                  Check-in
                                </button>
                              )}
                              {r.status === 'checkin' && (
                                <button
                                  type="button"
                                  onClick={() => doCheckOut(r.id)}
                                  className={cn(
                                    'h-8 px-3 rounded-lg text-[12px] font-semibold',
                                    r.checkOut === today
                                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                                      : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                                  )}
                                >
                                  Check-out
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Side panel — padrão Cloudbeds */}
        <div className="xl:col-span-3 space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-indigo-500" />
              <p className="text-[13px] font-semibold">Resumo do dia</p>
            </div>
            <dl className="space-y-2.5 text-[13px]">
              <Row label="Chegadas" value={arrivals.length} />
              <Row label="Saídas" value={departures.length} />
              <Row label="In-house" value={inHouse.length} />
              <Row label="UHs livres" value={free} />
              <Row label="UHs não prontas" value={notReady.length} warn={notReady.length > 0} />
              <Row
                label="Saldos em aberto"
                value={pendingBalance.length}
                warn={pendingBalance.length > 0}
              />
            </dl>
          </div>

          <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-b from-amber-50 to-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <p className="text-[13px] font-semibold text-amber-950">Atenção operacional</p>
            </div>
            <ul className="space-y-2 text-[12px] text-amber-900/80">
              {notReady.filter((r) => r.status === 'sujo').length > 0 && (
                <li>
                  · {notReady.filter((r) => r.status === 'sujo').length} UH(s) suja(s) aguardando
                  governança
                </li>
              )}
              {arrivals.some((r) => {
                const room = rooms.find((rm) => rm.id === r.roomId);
                return (
                  room &&
                  ['sujo', 'limpeza', 'inspecao', 'interditado', 'manutencao'].includes(room.status)
                );
              }) && <li>· Há chegadas com UH ainda não pronta</li>}
              {pendingBalance.length > 0 && (
                <li>· {pendingBalance.length} conta(s) com saldo pendente</li>
              )}
              {arrivals.filter((r) => !r.fnrhFilled).length > 0 && (
                <li>· {arrivals.filter((r) => !r.fnrhFilled).length} FNRH(s) pendente(s) nas chegadas</li>
              )}
              {notReady.length === 0 && pendingBalance.length === 0 && (
                <li className="text-emerald-700">· Nenhuma pendência crítica no momento</li>
              )}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 mb-2">
              Legenda UH
            </p>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <Legend color="bg-emerald-400" label="Livre" />
              <Legend color="bg-blue-500" label="Ocupado" />
              <Legend color="bg-rose-400" label="Sujo" />
              <Legend color="bg-amber-400" label="Limpeza" />
              <Legend color="bg-violet-400" label="Inspeção" />
              <Legend color="bg-slate-400" label="OOO / Manut." />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: 'green' | 'rose' | 'amber' | 'slate' }) {
  const map = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    rose: 'bg-rose-50 text-rose-700 ring-rose-100',
    amber: 'bg-amber-50 text-amber-800 ring-amber-100',
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  };
  return (
    <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset', map[tone])}>
      {children}
    </span>
  );
}

function Row({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={cn('font-semibold tabular-nums', warn ? 'text-amber-700' : 'text-slate-900')}>
        {value}
      </dd>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('h-2.5 w-2.5 rounded-sm', color)} />
      <span className="text-slate-600">{label}</span>
    </div>
  );
}
