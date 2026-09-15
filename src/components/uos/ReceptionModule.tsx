import { useMemo, useState } from 'react';
import { usePms } from '@/lib/pms-store';
import { accountBalance, formatBRL, formatDateBR } from '@/lib/pms-types';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  BedDouble,
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
  const delayedCheckIns = arrivals; // demo: todas as chegadas do dia contam como ação
  const notReady = rooms.filter((r) =>
    ['sujo', 'limpeza', 'inspecao', 'interditado', 'manutencao'].includes(r.status)
  );
  const pendingBalance = accounts.filter((a) => accountBalance(a) > 0.01);

  const kpis = [
    { label: 'Chegadas', value: arrivals.length, color: 'text-rose-600', icon: LogIn },
    {
      label: 'Check-ins atrasados',
      value: delayedCheckIns.length,
      color: 'text-rose-600',
      icon: Clock,
    },
    { label: 'Hospedados', value: inHouse.length, color: 'text-slate-900', icon: BedDouble },
    { label: 'Saídas', value: departures.length, color: 'text-amber-600', icon: LogOut },
    {
      label: 'Pendências',
      value: pendingBalance.length + notReady.length,
      color: 'text-amber-600',
      icon: AlertTriangle,
    },
    {
      label: 'UHs não prontas',
      value: notReady.length,
      color: 'text-amber-600',
      icon: BedDouble,
    },
  ];

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
    else list = [...arrivals, ...departures, ...inHouse].filter(
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar hóspede, reserva, documento, telefone ou UH"
            className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm hover:bg-slate-50"
          onClick={() => toast.message('Dados atualizados')}
        >
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Data operacional
        </span>
        <span className="font-semibold">{formatDateBR(today)}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {k.label}
                </p>
                <Icon className="w-4 h-4 text-slate-300" />
              </div>
              <p className={cn('mt-2 text-3xl font-semibold tracking-tight', k.color)}>
                {k.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {(
          [
            ['geral', 'Visão geral'],
            ['chegadas', `Chegadas (${arrivals.length})`],
            ['hospedados', `Hospedados (${inHouse.length})`],
            ['saidas', `Saídas (${departures.length})`],
            ['pendencias', 'Pendências'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors',
              tab === id
                ? 'border-slate-900 font-semibold text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-semibold">Ação imediata ({actionList.length})</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <th className="px-4 py-2.5 font-semibold">Hóspede</th>
                <th className="px-4 py-2.5 font-semibold">UH</th>
                <th className="px-4 py-2.5 font-semibold">Período</th>
                <th className="px-4 py-2.5 font-semibold">Origem</th>
                <th className="px-4 py-2.5 font-semibold">Operação</th>
                <th className="px-4 py-2.5 font-semibold">Financeiro</th>
                <th className="px-4 py-2.5 font-semibold text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {actionList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
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
                    <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <p className="font-medium">{r.guestName}</p>
                        <p className="text-xs text-slate-400">
                          {r.roomType} · {r.code}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-medium">{r.roomNumber || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDateBR(r.checkIn)} → {formatDateBR(r.checkOut)}
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-600">{r.origin}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {r.status === 'confirmada' && (
                            <Badge tone="slate">Aguardando check-in</Badge>
                          )}
                          {r.status === 'checkin' && <Badge tone="green">Hospedado</Badge>}
                          {r.status === 'pendente' && <Badge tone="amber">Pendente</Badge>}
                          {uhNotReady && <Badge tone="rose">UH não pronta</Badge>}
                          {!r.fnrhFilled && <Badge tone="amber">FNRH pendente</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {balance > 0.01 ? (
                          <Badge tone="rose">Saldo {formatBRL(balance)}</Badge>
                        ) : (
                          <Badge tone="green">Quitado</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1.5">
                          {(r.status === 'confirmada' || r.status === 'pendente') && (
                            <button
                              type="button"
                              onClick={() => doCheckIn(r.id)}
                              className="h-8 px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                            >
                              Realizar check-in
                            </button>
                          )}
                          {r.status === 'checkin' && r.checkOut === today && (
                            <button
                              type="button"
                              onClick={() => doCheckOut(r.id)}
                              className="h-8 px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                            >
                              Check-out
                            </button>
                          )}
                          {r.status === 'checkin' && r.checkOut !== today && (
                            <button
                              type="button"
                              onClick={() => doCheckOut(r.id)}
                              className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-medium hover:bg-slate-50"
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

      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <p className="text-sm font-semibold text-amber-900">Pendências operacionais</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label="Check-ins do dia" value={arrivals.length} />
          <Stat label="Check-outs do dia" value={departures.length} />
          <Stat label="UHs não prontas" value={notReady.length} />
          <Stat label="Saldos pendentes" value={pendingBalance.length} />
        </div>
      </div>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'green' | 'rose' | 'amber' | 'slate';
}) {
  const map = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    amber: 'bg-amber-50 text-amber-800 border-amber-100',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        map[tone]
      )}
    >
      {children}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/80 border border-amber-100 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-amber-700/70 font-bold">{label}</p>
      <p className="text-xl font-semibold text-amber-950">{value}</p>
    </div>
  );
}
