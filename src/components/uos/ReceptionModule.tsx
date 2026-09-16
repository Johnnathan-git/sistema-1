import { useMemo, useState } from 'react';
import { usePms } from '@/lib/pms-store';
import {
  accountBalance,
  formatBRL,
  formatDateBR,
  GOVERNANCE_LABEL,
  isRoomReadyForCheckIn,
  OCCUPANCY_LABEL,
  roomNotReadyReason,
  type Reservation,
  type Room,
} from '@/lib/pms-types';
import { cn } from '@/lib/utils';
import { LayoutGrid, List, LogIn, Search } from 'lucide-react';
import { toast } from 'sonner';

type MainTab = 'checkins' | 'relacao' | 'chart';

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T12:00:00').getTime();
  const db = new Date(b + 'T12:00:00').getTime();
  return Math.round((db - da) / 86400000);
}

export function ReceptionModule() {
  const { hotel, reservations, rooms, accounts, checkIn, checkOut, markFnrh } = usePms();
  const [tab, setTab] = useState<MainTab>('checkins');
  const [q, setQ] = useState('');
  const [selectedResId, setSelectedResId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [chartDays, setChartDays] = useState(14);
  const today = hotel.operationalDate;

  const arrivals = useMemo(
    () =>
      reservations.filter(
        (r) =>
          r.checkIn === today &&
          (r.status === 'confirmada' || r.status === 'pendente')
      ),
    [reservations, today]
  );

  const inHouse = useMemo(
    () => reservations.filter((r) => r.status === 'checkin'),
    [reservations]
  );

  const departures = useMemo(
    () => reservations.filter((r) => r.checkOut === today && r.status === 'checkin'),
    [reservations, today]
  );

  const adultsIn = arrivals.reduce((s, r) => s + r.adults, 0);
  const childrenIn = arrivals.reduce((s, r) => s + r.children, 0);
  const adultsOut = departures.reduce((s, r) => s + r.adults, 0);
  const childrenOut = departures.reduce((s, r) => s + r.children, 0);
  const occupied = rooms.filter((r) => r.occupancy === 'ocupado').length;
  const totalUhs = rooms.length;
  const sellable = rooms.filter((r) => r.occupancy !== 'bloqueado').length;
  const occPct = sellable > 0 ? ((occupied / sellable) * 100).toFixed(2) : '0.00';

  const filteredArrivals = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return arrivals;
    return arrivals.filter(
      (r) =>
        r.guestName.toLowerCase().includes(query) ||
        r.code.toLowerCase().includes(query) ||
        (r.roomNumber || '').toLowerCase().includes(query)
    );
  }, [arrivals, q]);

  const filteredRooms = useMemo(() => {
    let list = [...rooms].sort((a, b) =>
      a.number.localeCompare(b.number, 'pt-BR', { numeric: true })
    );
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (r) =>
          r.number.toLowerCase().includes(query) ||
          r.type.toLowerCase().includes(query) ||
          (r.block || '').toLowerCase().includes(query)
      );
    }
    return list;
  }, [rooms, q]);

  const selectedRes =
    reservations.find((r) => r.id === selectedResId) ||
    (tab === 'checkins' ? filteredArrivals[0] : null);

  const selectedRoom =
    rooms.find((r) => r.id === selectedRoomId) ||
    (tab === 'relacao' ? filteredRooms[0] : null);

  const guestInRoom = (roomId: string) =>
    reservations.find((r) => r.roomId === roomId && r.status === 'checkin');

  const resOnRoom = (roomId: string) =>
    reservations.find(
      (r) =>
        r.roomId === roomId &&
        (r.status === 'checkin' || r.status === 'confirmada' || r.status === 'pendente')
    );

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

  const chartDates = useMemo(() => {
    return Array.from({ length: chartDays }, (_, i) => addDays(today, i));
  }, [today, chartDays]);

  /** Cor da célula do chart para UH + data */
  const cellInfo = (room: Room, date: string) => {
    // bloqueado / interdição permanente no chart
    if (room.occupancy === 'bloqueado' || room.governance === 'interditado') {
      return { cls: 'bg-orange-400 text-white', label: 'I', title: 'Interditado/Bloqueado' };
    }
    if (room.governance === 'manutencao' && room.occupancy === 'bloqueado') {
      return { cls: 'bg-orange-400 text-white', label: 'I', title: 'Manutenção' };
    }

    const res = reservations.find(
      (r) =>
        r.roomId === room.id &&
        r.status !== 'cancelada' &&
        r.status !== 'no_show' &&
        r.checkIn <= date &&
        r.checkOut > date
    );

    if (res) {
      if (res.status === 'checkin') {
        if (res.checkOut === date)
          return { cls: 'bg-pink-500 text-white', label: 'CO', title: `Checkout ${res.guestName}` };
        return { cls: 'bg-blue-600 text-white', label: 'CI', title: `Check-in ${res.guestName}` };
      }
      if (res.status === 'confirmada')
        return { cls: 'bg-emerald-500 text-white', label: 'C', title: `Confirmada ${res.guestName}` };
      if (res.status === 'pendente')
        return { cls: 'bg-sky-300 text-slate-800', label: 'P', title: `Pendente ${res.guestName}` };
      if (res.status === 'checkout' && res.checkOut === date)
        return { cls: 'bg-pink-400 text-white', label: 'CO', title: 'Checkout' };
    }

    // vago: mostra governança no dia de hoje; outros dias livre
    if (date === today) {
      if (room.governance === 'sujo')
        return { cls: 'bg-rose-200 text-rose-900', label: 'S', title: 'Sujo' };
      if (room.governance === 'limpeza')
        return { cls: 'bg-amber-200 text-amber-900', label: 'A', title: 'Arrumação' };
      if (room.governance === 'inspecao')
        return { cls: 'bg-violet-200 text-violet-900', label: 'Isp', title: 'Inspeção' };
      if (room.governance === 'limpo')
        return { cls: 'bg-lime-200 text-lime-900', label: 'L', title: 'Limpo' };
    }

    return { cls: 'bg-slate-50 text-slate-300', label: '·', title: 'Livre' };
  };

  return (
    <div className="space-y-4">
      {/* Abas principais — modelo eSolution */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200">
        {(
          [
            { id: 'checkins' as const, label: 'Check-ins previstos', icon: LogIn },
            { id: 'relacao' as const, label: 'Relação de UHs', icon: List },
            { id: 'chart' as const, label: 'Chart de ocupação', icon: LayoutGrid },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px inline-flex items-center gap-1.5 transition-colors',
              tab === id
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Toolbar busca */}
      {tab !== 'chart' && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              tab === 'checkins'
                ? 'Buscar reserva, hóspede ou UH…'
                : 'Buscar UH, tipo ou bloco…'
            }
            className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      )}

      {/* ========== CHECK-INS PREVISTOS ========== */}
      {tab === 'checkins' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <p className="text-[12px] font-semibold text-slate-600">
                Check-ins previstos e pré-check-ins · {filteredArrivals.length}
              </p>
            </div>
            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <th className="px-3 py-2 font-semibold">Reserva</th>
                    <th className="px-3 py-2 font-semibold">Hóspede</th>
                    <th className="px-3 py-2 font-semibold">Tipo UH</th>
                    <th className="px-3 py-2 font-semibold">UH</th>
                    <th className="px-3 py-2 font-semibold">Pré-CI</th>
                    <th className="px-3 py-2 font-semibold">AD/CH</th>
                    <th className="px-3 py-2 font-semibold">Check-in</th>
                    <th className="px-3 py-2 font-semibold">Check-out</th>
                    <th className="px-3 py-2 font-semibold">Canal</th>
                    <th className="px-3 py-2 font-semibold">Governança</th>
                    <th className="px-3 py-2 font-semibold text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredArrivals.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                        Nenhum check-in previsto para hoje
                      </td>
                    </tr>
                  ) : (
                    filteredArrivals.map((r) => {
                      const room = rooms.find((rm) => rm.id === r.roomId);
                      const ready = room ? isRoomReadyForCheckIn(room) : false;
                      const reason = room ? roomNotReadyReason(room) : 'Sem UH';
                      const active = selectedRes?.id === r.id;
                      return (
                        <tr
                          key={r.id}
                          onClick={() => setSelectedResId(r.id)}
                          className={cn(
                            'cursor-pointer transition-colors',
                            active ? 'bg-indigo-50' : 'hover:bg-slate-50'
                          )}
                        >
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-600">
                            {r.code.replace('RSV-', '')}
                          </td>
                          <td className="px-3 py-2 font-medium max-w-[180px] truncate">
                            {r.guestName}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{r.roomType}</td>
                          <td className="px-3 py-2 font-semibold tabular-nums">
                            {r.roomNumber || '—'}
                          </td>
                          <td className="px-3 py-2">
                            {r.fnrhFilled ? (
                              <span className="text-emerald-600 font-medium">SIM</span>
                            ) : (
                              <span className="text-slate-400">NÃO</span>
                            )}
                          </td>
                          <td className="px-3 py-2 tabular-nums text-slate-600">
                            {r.adults}/{r.children}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {formatDateBR(r.checkIn)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {formatDateBR(r.checkOut)}
                          </td>
                          <td className="px-3 py-2 capitalize text-slate-500">{r.origin}</td>
                          <td className="px-3 py-2">
                            {room ? (
                              <span
                                className={cn(
                                  'text-[11px] font-semibold',
                                  !ready ? 'text-rose-600' : 'text-emerald-600'
                                )}
                              >
                                {GOVERNANCE_LABEL[room.governance]}
                                {!ready && reason ? ` · ${reason}` : ''}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => doCheckIn(r.id)}
                              className="h-7 px-2.5 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-500"
                            >
                              Check-in
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Painel inferior — previsão do dia + detalhe reserva */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Previsões do dia · {formatDateBR(today)}
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Check-in</span>
                  <span className="font-semibold tabular-nums">{arrivals.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Ocupação total</span>
                  <span className="font-semibold tabular-nums">
                    {occupied}/{sellable}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total UHs</span>
                  <span className="font-semibold tabular-nums">{totalUhs}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Ocupadas %</span>
                  <span className="font-semibold tabular-nums text-indigo-300">{occPct}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Adultos (in)</span>
                  <span className="font-semibold tabular-nums">{adultsIn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Crianças (in)</span>
                  <span className="font-semibold tabular-nums">{childrenIn}</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-2 mt-1">
                  <span className="text-slate-400">Check-out</span>
                  <span className="font-semibold tabular-nums">{departures.length}</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-2 mt-1">
                  <span className="text-slate-400">In-house</span>
                  <span className="font-semibold tabular-nums">{inHouse.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Adultos (out)</span>
                  <span className="font-semibold tabular-nums">{adultsOut}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Crianças (out)</span>
                  <span className="font-semibold tabular-nums">{childrenOut}</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Observação / detalhe da reserva selecionada
              </p>
              {selectedRes ? (
                <ResDetail
                  res={selectedRes}
                  room={rooms.find((r) => r.id === selectedRes.roomId)}
                  onFnrh={() => {
                    markFnrh(selectedRes.id);
                    toast.success('Pré-check-in / FNRH marcado');
                  }}
                  onCheckIn={() => doCheckIn(selectedRes.id)}
                />
              ) : (
                <p className="text-[13px] text-slate-400">Selecione uma reserva na lista</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== RELAÇÃO DE UHs ========== */}
      {tab === 'relacao' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/80">
              <p className="text-[12px] font-semibold text-slate-600">
                Relação de UHs · {filteredRooms.length} registro(s)
              </p>
            </div>
            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <th className="px-3 py-2 font-semibold">UH</th>
                    <th className="px-3 py-2 font-semibold">Tipo</th>
                    <th className="px-3 py-2 font-semibold">Bloco / Andar</th>
                    <th className="px-3 py-2 font-semibold">Ocupação</th>
                    <th className="px-3 py-2 font-semibold">Governança</th>
                    <th className="px-3 py-2 font-semibold">Hóspede</th>
                    <th className="px-3 py-2 font-semibold">Pré-CI</th>
                    <th className="px-3 py-2 font-semibold">NDP</th>
                    <th className="px-3 py-2 font-semibold text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredRooms.map((room) => {
                    const guest = guestInRoom(room.id);
                    const res = resOnRoom(room.id);
                    const active = selectedRoom?.id === room.id;
                    return (
                      <tr
                        key={room.id}
                        onClick={() => setSelectedRoomId(room.id)}
                        className={cn(
                          'cursor-pointer',
                          active ? 'bg-indigo-50' : 'hover:bg-slate-50'
                        )}
                      >
                        <td className="px-3 py-2 font-semibold tabular-nums">{room.number}</td>
                        <td className="px-3 py-2 text-slate-600">{room.type}</td>
                        <td className="px-3 py-2 text-slate-500">
                          {room.block || '—'} · {room.floor === 0 ? 'Térreo' : `${room.floor}º`}
                        </td>
                        <td className="px-3 py-2">
                          <OccBadge status={room.occupancy} />
                        </td>
                        <td className="px-3 py-2">
                          <GovBadge status={room.governance} />
                        </td>
                        <td className="px-3 py-2 max-w-[160px] truncate text-slate-700">
                          {guest?.guestName || '—'}
                        </td>
                        <td className="px-3 py-2">
                          {res?.fnrhFilled ? (
                            <span className="text-emerald-600 font-medium">SIM</span>
                          ) : res ? (
                            <span className="text-slate-400">NÃO</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {room.dnd ? (
                            <span className="text-rose-600 font-semibold text-[11px]">NDP</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td
                          className="px-3 py-2 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {guest && (
                            <button
                              type="button"
                              onClick={() => doCheckOut(guest.id)}
                              className="h-7 px-2.5 rounded-lg bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-800"
                            >
                              Check-out
                            </button>
                          )}
                          {res &&
                            (res.status === 'confirmada' || res.status === 'pendente') && (
                              <button
                                type="button"
                                onClick={() => doCheckIn(res.id)}
                                className="h-7 px-2.5 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-500"
                              >
                                Check-in
                              </button>
                            )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detalhe UH / reserva */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 p-4 shadow-sm">
            {selectedRoom ? (
              <RoomDetail
                room={selectedRoom}
                res={resOnRoom(selectedRoom.id)}
                guest={guestInRoom(selectedRoom.id)}
                account={
                  guestInRoom(selectedRoom.id)?.accountId
                    ? accounts.find(
                        (a) => a.id === guestInRoom(selectedRoom.id)?.accountId
                      )
                    : undefined
                }
              />
            ) : (
              <p className="text-[13px] text-slate-400">Selecione uma UH na lista</p>
            )}
          </div>
        </div>
      )}

      {/* ========== CHART DE OCUPAÇÃO ========== */}
      {tab === 'chart' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-[13px] text-slate-600 flex items-center gap-2">
              Horizonte
              <select
                value={chartDays}
                onChange={(e) => setChartDays(Number(e.target.value))}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[13px]"
              >
                <option value={7}>7 dias</option>
                <option value={14}>14 dias</option>
                <option value={21}>21 dias</option>
                <option value={30}>30 dias</option>
              </select>
            </label>
            <p className="text-[12px] text-slate-500">
              {rooms.length} UHs · a partir de {formatDateBR(today)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-auto max-h-[560px]">
              <table className="border-collapse text-[10px] min-w-max">
                <thead className="sticky top-0 z-20 bg-slate-900 text-slate-200">
                  <tr>
                    <th className="sticky left-0 z-30 bg-slate-900 px-3 py-2 text-left font-semibold min-w-[140px]">
                      UH · Tipo
                    </th>
                    {chartDates.map((d) => {
                      const [, m, day] = d.split('-');
                      const wd = new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', {
                        weekday: 'short',
                      });
                      return (
                        <th
                          key={d}
                          className="px-1 py-2 font-medium text-center min-w-[36px] border-l border-white/10"
                        >
                          <div className="leading-tight">
                            <div className="text-[9px] text-slate-400 uppercase">{wd}</div>
                            <div>
                              {day}/{m}
                            </div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {[...rooms]
                    .sort((a, b) =>
                      a.number.localeCompare(b.number, 'pt-BR', { numeric: true })
                    )
                    .map((room) => (
                      <tr key={room.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                        <td className="sticky left-0 z-10 bg-white px-3 py-1 font-medium text-[11px] text-slate-800 border-r border-slate-100 whitespace-nowrap">
                          <span className="font-semibold">{room.number}</span>
                          <span className="text-slate-400"> · {room.type}</span>
                        </td>
                        {chartDates.map((d) => {
                          const cell = cellInfo(room, d);
                          return (
                            <td
                              key={d}
                              title={cell.title}
                              className={cn(
                                'px-0.5 py-1 text-center font-bold border-l border-slate-50 min-w-[36px]',
                                cell.cls
                              )}
                            >
                              {cell.label}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legenda chart */}
          <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
            <Leg c="bg-lime-200" t="L Limpo" />
            <Leg c="bg-rose-200" t="S Sujo" />
            <Leg c="bg-amber-200" t="A Arrumação" />
            <Leg c="bg-violet-200" t="Isp Inspeção" />
            <Leg c="bg-orange-400" t="I Interditado" />
            <Leg c="bg-sky-300" t="P Pendente" />
            <Leg c="bg-emerald-500" t="C Confirmada" />
            <Leg c="bg-blue-600" t="CI Check-in" />
            <Leg c="bg-pink-500" t="CO Check-out" />
          </div>
        </div>
      )}
    </div>
  );
}

function ResDetail({
  res,
  room,
  onFnrh,
  onCheckIn,
}: {
  res: Reservation;
  room?: Room;
  onFnrh: () => void;
  onCheckIn: () => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
      <Field label="Nº reserva" value={res.code} />
      <Field label="Hóspede" value={res.guestName} />
      <Field label="UH" value={res.roomNumber || '—'} />
      <Field label="Tipo" value={res.roomType} />
      <Field label="Check-in" value={formatDateBR(res.checkIn)} />
      <Field label="Check-out" value={formatDateBR(res.checkOut)} />
      <Field label="AD / CH" value={`${res.adults} / ${res.children}`} />
      <Field label="Canal" value={res.origin} />
      <Field
        label="Pré-check-in / FNRH"
        value={res.fnrhFilled ? 'Preenchido' : 'Pendente'}
      />
      <Field
        label="Governança UH"
        value={room ? GOVERNANCE_LABEL[room.governance] : '—'}
      />
      <Field label="Total" value={formatBRL(res.totalAmount)} />
      <Field label="Pago" value={formatBRL(res.paidAmount)} />
      {res.notes && (
        <div className="sm:col-span-2">
          <Field label="Observação" value={res.notes} />
        </div>
      )}
      <div className="sm:col-span-2 flex flex-wrap gap-2 pt-2">
        {!res.fnrhFilled && (
          <button
            type="button"
            onClick={onFnrh}
            className="h-8 px-3 rounded-lg border border-slate-200 text-[12px] font-medium hover:bg-slate-50"
          >
            Marcar FNRH / pré-CI
          </button>
        )}
        <button
          type="button"
          onClick={onCheckIn}
          className="h-8 px-3 rounded-lg bg-indigo-600 text-white text-[12px] font-semibold hover:bg-indigo-500"
        >
          Realizar check-in
        </button>
      </div>
    </div>
  );
}

function RoomDetail({
  room,
  res,
  guest,
  account,
}: {
  room: Room;
  res?: Reservation;
  guest?: Reservation;
  account?: { charges: { amount: number }[]; payments: { amount: number }[] };
}) {
  const balance = account ? accountBalance(account as never) : null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[13px]">
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">UH</p>
        <Field label="Número" value={room.number} dark />
        <Field label="Tipo" value={room.type} dark />
        <Field
          label="Local"
          value={`${room.block || '—'} · ${room.floor === 0 ? 'Térreo' : room.floor + 'º'}`}
          dark
        />
        <Field label="Ocupação" value={OCCUPANCY_LABEL[room.occupancy]} dark />
        <Field label="Governança" value={GOVERNANCE_LABEL[room.governance]} dark />
        <Field label="Camareira" value={room.housekeeper || '—'} dark />
        <Field label="NDP" value={room.dnd ? 'Ativo' : 'Não'} dark />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
          Reserva / hóspede
        </p>
        {res || guest ? (
          <>
            <Field label="Reserva" value={(guest || res)!.code} dark />
            <Field label="Hóspede" value={(guest || res)!.guestName} dark />
            <Field
              label="Estadia"
              value={`${formatDateBR((guest || res)!.checkIn)} → ${formatDateBR((guest || res)!.checkOut)}`}
              dark
            />
            <Field label="Canal" value={(guest || res)!.origin} dark />
            {balance !== null && (
              <Field
                label="Saldo conta"
                value={balance > 0.01 ? formatBRL(balance) : 'Quitado'}
                dark
              />
            )}
            {(guest || res)!.notes && (
              <Field label="Obs. reserva" value={(guest || res)!.notes!} dark />
            )}
          </>
        ) : (
          <p className="text-slate-500">UH sem reserva vinculada</p>
        )}
        {room.notes && <Field label="Obs. UH" value={room.notes} dark />}
        {room.blockedReason && (
          <Field label="Motivo bloqueio" value={room.blockedReason} dark />
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  dark,
}: {
  label: string;
  value: string;
  dark?: boolean;
}) {
  return (
    <div className="flex gap-2 text-[12px]">
      <span className={cn('shrink-0', dark ? 'text-slate-400' : 'text-slate-500')}>
        {label}:
      </span>
      <span className={cn('font-medium', dark ? 'text-slate-100' : 'text-slate-900')}>
        {value}
      </span>
    </div>
  );
}

function OccBadge({ status }: { status: Room['occupancy'] }) {
  const map = {
    livre: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    ocupado: 'bg-blue-50 text-blue-800 ring-blue-200',
    bloqueado: 'bg-slate-200 text-slate-800 ring-slate-300',
  };
  return (
    <span
      className={cn(
        'inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
        map[status]
      )}
    >
      {OCCUPANCY_LABEL[status]}
    </span>
  );
}

function GovBadge({ status }: { status: Room['governance'] }) {
  const map = {
    limpo: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    sujo: 'bg-rose-50 text-rose-800 ring-rose-200',
    limpeza: 'bg-amber-50 text-amber-900 ring-amber-200',
    inspecao: 'bg-violet-50 text-violet-800 ring-violet-200',
    manutencao: 'bg-orange-50 text-orange-900 ring-orange-200',
    interditado: 'bg-slate-200 text-slate-800 ring-slate-300',
  };
  return (
    <span
      className={cn(
        'inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
        map[status]
      )}
    >
      {GOVERNANCE_LABEL[status]}
    </span>
  );
}

function Leg({ c, t }: { c: string; t: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-3 w-3 rounded-sm', c)} />
      {t}
    </span>
  );
}

// silence unused helper if tree-shaken
void daysBetween;
