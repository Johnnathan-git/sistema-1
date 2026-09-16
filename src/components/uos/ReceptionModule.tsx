import { useMemo, useState } from 'react';
import { usePms } from '@/lib/pms-store';
import { ReservationModal } from '@/components/uos/ReservationModal';
import { AccountModal } from '@/components/uos/AccountModal';
import {
  formatDateBR,
  GOVERNANCE_LABEL,
  isRoomReadyForCheckIn,
  OCCUPANCY_LABEL,
  roomNotReadyReason,
  type Room,
} from '@/lib/pms-types';
import { cn } from '@/lib/utils';
import { LayoutGrid, List, LogIn, Search } from 'lucide-react';
import { toast } from 'sonner';

type MainTab = 'checkins' | 'hospedados' | 'chart';

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function ReceptionModule() {
  const { hotel, reservations, rooms, guests, checkIn, checkOut, markFnrh } = usePms();
  const [tab, setTab] = useState<MainTab>('checkins');
  const [q, setQ] = useState('');
  const [selectedResId, setSelectedResId] = useState<string | null>(null);
  const [modalResId, setModalResId] = useState<string | null>(null);
  const [modalAccount, setModalAccount] = useState<{
    accountId?: string;
    reservationId?: string;
  } | null>(null);
  const [chartDays, setChartDays] = useState(14);
  const today = hotel.operationalDate;

  const arrivals = useMemo(
    () =>
      reservations.filter(
        (r) => r.checkIn === today && (r.status === 'confirmada' || r.status === 'pendente')
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

  const occupied = rooms.filter((r) => r.occupancy === 'ocupado').length;
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

  const filteredInHouse = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return inHouse;
    return inHouse.filter(
      (r) =>
        r.guestName.toLowerCase().includes(query) ||
        r.code.toLowerCase().includes(query) ||
        (r.roomNumber || '').toLowerCase().includes(query)
    );
  }, [inHouse, q]);

  const selectedRes =
    reservations.find((r) => r.id === selectedResId) ||
    (tab === 'checkins'
      ? filteredArrivals[0] ?? null
      : tab === 'hospedados'
        ? filteredInHouse[0] ?? null
        : null);

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

  const chartDates = useMemo(
    () => Array.from({ length: chartDays }, (_, i) => addDays(today, i)),
    [today, chartDays]
  );

  const cellInfo = (room: Room, date: string) => {
    if (room.occupancy === 'bloqueado' || room.governance === 'interditado') {
      return { cls: 'bg-orange-400 text-white', label: 'I', title: 'Interditado' };
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
          return { cls: 'bg-pink-500 text-white', label: 'CO', title: res.guestName };
        return { cls: 'bg-blue-600 text-white', label: 'CI', title: res.guestName };
      }
      if (res.status === 'confirmada')
        return { cls: 'bg-emerald-500 text-white', label: 'C', title: res.guestName };
      if (res.status === 'pendente')
        return { cls: 'bg-sky-300 text-slate-800', label: 'P', title: res.guestName };
    }
    if (date === today) {
      if (room.governance === 'sujo') return { cls: 'bg-rose-200 text-rose-900', label: 'S', title: 'Sujo' };
      if (room.governance === 'limpeza') return { cls: 'bg-amber-200 text-amber-900', label: 'A', title: 'Arrumação' };
      if (room.governance === 'inspecao') return { cls: 'bg-violet-200 text-violet-900', label: 'Isp', title: 'Inspeção' };
      if (room.governance === 'limpo') return { cls: 'bg-lime-200 text-lime-900', label: 'L', title: 'Limpo' };
    }
    return { cls: 'bg-slate-50 text-slate-300', label: '·', title: 'Livre' };
  };

  return (
    <div className="space-y-4">
      {modalResId && <ReservationModal reservationId={modalResId} onClose={() => setModalResId(null)} />}
      {modalAccount && (
        <AccountModal
          accountId={modalAccount.accountId}
          reservationId={modalAccount.reservationId}
          onClose={() => setModalAccount(null)}
        />
      )}

      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200">
        {(
          [
            { id: 'checkins' as const, label: 'Check-ins previstos', icon: LogIn },
            { id: 'hospedados' as const, label: 'Hospedados', icon: List },
            { id: 'chart' as const, label: 'Chart de ocupação', icon: LayoutGrid },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px inline-flex items-center gap-1.5',
              tab === id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab !== 'chart' && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === 'checkins' ? 'Buscar reserva…' : 'Buscar hóspede, UH ou reserva…'}
            className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      )}

      {tab === 'checkins' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/80 text-[12px] font-semibold text-slate-600">
              Check-ins previstos · {filteredArrivals.length}
              <span className="ml-2 font-normal text-slate-400">(1 clique = detalhe · 2 cliques = abrir reserva)</span>
            </div>
            <div className="overflow-x-auto max-h-[380px]">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b">
                    <th className="px-3 py-2">Reserva</th>
                    <th className="px-3 py-2">Hóspede</th>
                    <th className="px-3 py-2">UH</th>
                    <th className="px-3 py-2">Pré-CI</th>
                    <th className="px-3 py-2">AD/CH</th>
                    <th className="px-3 py-2">Período</th>
                    <th className="px-3 py-2">Gov.</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredArrivals.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">Nenhum check-in previsto para hoje</td></tr>
                  ) : (
                    filteredArrivals.map((r) => {
                      const room = rooms.find((rm) => rm.id === r.roomId);
                      const ready = room ? isRoomReadyForCheckIn(room) : false;
                      const reason = room ? roomNotReadyReason(room) : 'Sem UH';
                      const active = selectedRes?.id === r.id;
                      return (
                        <tr key={r.id} onClick={() => setSelectedResId(r.id)} onDoubleClick={() => setModalResId(r.id)} className={cn('cursor-pointer', active ? 'bg-indigo-50' : 'hover:bg-slate-50')}>
                          <td className="px-3 py-2 font-mono text-[11px]">{r.code.replace('RSV-', '')}</td>
                          <td className="px-3 py-2 font-medium max-w-[160px] truncate">{r.guestName}</td>
                          <td className="px-3 py-2 font-semibold">{r.roomNumber || '—'}</td>
                          <td className="px-3 py-2">{r.fnrhFilled ? 'SIM' : 'NÃO'}</td>
                          <td className="px-3 py-2">{r.adults}/{r.children}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(r.checkIn)} → {formatDateBR(r.checkOut)}</td>
                          <td className="px-3 py-2">{room ? <span className={!ready ? 'text-rose-600 font-semibold' : 'text-emerald-600'}>{GOVERNANCE_LABEL[room.governance]}{!ready ? ` · ${reason}` : ''}</span> : '—'}</td>
                          <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                            <button type="button" onClick={() => doCheckIn(r.id)} className="h-7 px-2.5 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold">Check-in</button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 p-4 text-[13px] space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Previsões do dia · {formatDateBR(today)}</p>
              <div className="grid grid-cols-2 gap-2">
                <span className="text-slate-400">Check-in</span><span className="font-semibold text-right">{arrivals.length}</span>
                <span className="text-slate-400">Check-out</span><span className="font-semibold text-right">{departures.length}</span>
                <span className="text-slate-400">In-house</span><span className="font-semibold text-right">{inHouse.length}</span>
                <span className="text-slate-400">Ocupação</span><span className="font-semibold text-right text-indigo-300">{occupied}/{sellable} · {occPct}%</span>
              </div>
            </div>
            <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Reserva selecionada</p>
              {selectedRes && selectedRes.status !== 'checkin' ? (
                <div className="text-[13px] space-y-2">
                  <p className="font-semibold">{selectedRes.guestName}</p>
                  <p className="text-slate-500">{selectedRes.code} · {selectedRes.roomNumber || selectedRes.roomType} · {formatDateBR(selectedRes.checkIn)} → {formatDateBR(selectedRes.checkOut)}</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setModalResId(selectedRes.id)} className="h-8 px-3 rounded-lg border border-slate-200 text-[12px] font-medium">Abrir reserva</button>
                    <button type="button" onClick={() => doCheckIn(selectedRes.id)} className="h-8 px-3 rounded-lg bg-indigo-600 text-white text-[12px] font-semibold">Check-in</button>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 text-[13px]">Clique em uma linha da lista</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'hospedados' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b bg-slate-50/80 text-[12px] font-semibold text-slate-600">
              Hospedados · {filteredInHouse.length}
              <span className="ml-2 font-normal text-slate-400">(1 clique = rodapé · 2 cliques = reserva · arraste a barra para mais colunas)</span>
            </div>
            <div className="overflow-x-auto max-h-[400px]">
              <table className="text-[12px] min-w-max w-full">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="text-left text-[10px] uppercase text-slate-400 border-b">
                    <th className="px-3 py-2 whitespace-nowrap">UH</th>
                    <th className="px-3 py-2 whitespace-nowrap">Tipo UH</th>
                    <th className="px-3 py-2 whitespace-nowrap">Andar</th>
                    <th className="px-3 py-2 whitespace-nowrap">Localização</th>
                    <th className="px-3 py-2 whitespace-nowrap">Status</th>
                    <th className="px-3 py-2 whitespace-nowrap">Governança</th>
                    <th className="px-3 py-2 whitespace-nowrap">Hóspede</th>
                    <th className="px-3 py-2 whitespace-nowrap">Reserva</th>
                    <th className="px-3 py-2 whitespace-nowrap">Pré-CI</th>
                    <th className="px-3 py-2 whitespace-nowrap">AD/CH</th>
                    <th className="px-3 py-2 whitespace-nowrap">Check-in</th>
                    <th className="px-3 py-2 whitespace-nowrap">Check-out</th>
                    <th className="px-3 py-2 whitespace-nowrap">Canal</th>
                    <th className="px-3 py-2 whitespace-nowrap">NDP</th>
                    <th className="px-3 py-2 whitespace-nowrap">Empresa</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap sticky right-0 bg-white shadow-[-4px_0_8px_rgba(0,0,0,0.04)]">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredInHouse.length === 0 ? (
                    <tr><td colSpan={16} className="px-4 py-12 text-center text-slate-400">Nenhum hóspede in-house no momento</td></tr>
                  ) : (
                    filteredInHouse.map((r) => {
                      const room = rooms.find((rm) => rm.id === r.roomId);
                      const active = selectedRes?.id === r.id;
                      const empresa = r.origin === 'direto' ? 'PARTICULAR' : r.origin.toUpperCase();
                      return (
                        <tr key={r.id} onClick={() => setSelectedResId(r.id)} onDoubleClick={() => setModalResId(r.id)} className={cn('cursor-pointer', active ? 'bg-indigo-50' : 'hover:bg-slate-50')}>
                          <td className="px-3 py-2 font-semibold whitespace-nowrap">{r.roomNumber || '—'}</td>
                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.roomType}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{room ? (room.floor === 0 ? 'Térreo' : `${room.floor}º`) : '—'}</td>
                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{room?.block || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-blue-700 font-medium">Ocupada</td>
                          <td className="px-3 py-2 whitespace-nowrap">{room ? GOVERNANCE_LABEL[room.governance] : '—'}</td>
                          <td className="px-3 py-2 font-medium whitespace-nowrap max-w-[180px] truncate">{r.guestName}</td>
                          <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap">{r.code.replace('RSV-', '')}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{r.fnrhFilled ? <span className="text-emerald-600 font-medium">Sim</span> : <span className="text-slate-400">Não</span>}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{r.adults}/{r.children}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(r.checkIn)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(r.checkOut)}{r.checkOut === today && <span className="ml-1 text-amber-600 font-semibold text-[10px]">HOJE</span>}</td>
                          <td className="px-3 py-2 capitalize text-slate-500 whitespace-nowrap">{r.origin}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{room?.dnd ? <span className="text-rose-600 font-semibold">S</span> : <span className="text-slate-300">N</span>}</td>
                          <td className="px-3 py-2 text-slate-500 whitespace-nowrap text-[11px]">{empresa}</td>
                          <td className={cn('px-3 py-2 text-right whitespace-nowrap sticky right-0 shadow-[-4px_0_8px_rgba(0,0,0,0.04)]', active ? 'bg-indigo-50' : 'bg-white')} onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex gap-1">
                              <button type="button" onClick={() => setModalResId(r.id)} className="h-7 px-2 rounded-lg border text-[11px]">Reserva</button>
                              <button type="button" onClick={() => setModalAccount({ accountId: r.accountId, reservationId: r.id })} className="h-7 px-2 rounded-lg border text-[11px]">Conta</button>
                              <button type="button" onClick={() => doCheckOut(r.id)} className="h-7 px-2 rounded-lg bg-slate-900 text-white text-[11px] font-semibold">Check-out</button>
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

          <div className="rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 p-4 text-[12px]">
            {selectedRes && selectedRes.status === 'checkin' ? (() => {
              const room = rooms.find((rm) => rm.id === selectedRes.roomId);
              const guest = guests.find((g) => g.id === selectedRes.guestId);
              const companions = [
                selectedRes.guestName,
                ...(selectedRes.adults > 1 ? ['SARA QUEIROZ DA SILVA', 'JULIA QUEIROZ DA SILVA'].slice(0, Math.min(2, selectedRes.adults - 1)) : []),
                ...(selectedRes.children > 0 ? ['ELAINE APARECIDA QUEIROZ'].slice(0, selectedRes.children) : []),
              ];
              return (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-3 space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">UH / Reserva</p>
                    <p><span className="text-slate-400">Nº reserva:</span> <span className="font-semibold">{selectedRes.code.replace('RSV-', '')}</span></p>
                    <p><span className="text-slate-400">UH:</span> <span className="font-semibold">{selectedRes.roomNumber} · {selectedRes.roomType}</span></p>
                    <p><span className="text-slate-400">Andar / bloco:</span> {room ? `${room.floor === 0 ? 'Térreo' : room.floor + 'º'} · ${room.block || '—'}` : '—'}</p>
                    <p><span className="text-slate-400">Governança:</span> {room ? GOVERNANCE_LABEL[room.governance] : '—'}</p>
                  </div>
                  <div className="md:col-span-3 space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Estadia</p>
                    <p><span className="text-slate-400">Check-in efetuado:</span> {formatDateBR(selectedRes.checkIn)}</p>
                    <p><span className="text-slate-400">Checkout previsto:</span> {formatDateBR(selectedRes.checkOut)}</p>
                    <p><span className="text-slate-400">Origem:</span> <span className="capitalize">{selectedRes.origin}</span></p>
                    <p><span className="text-slate-400">Pré-check-in / FNRH:</span> {selectedRes.fnrhFilled ? 'Conferido' : 'Não conferido'}</p>
                    <p><span className="text-slate-400">Placa veículo:</span> ABC1D23</p>
                  </div>
                  <div className="md:col-span-3 space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Hóspedes</p>
                    <ul className="space-y-0.5">
                      {companions.map((name, i) => (
                        <li key={i} className={i === 0 ? 'font-semibold' : 'text-slate-300'}>{name}</li>
                      ))}
                    </ul>
                    {guest && <p className="text-slate-400 pt-1">Doc: {guest.document} · {guest.phone}</p>}
                  </div>
                  <div className="md:col-span-3 space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Observação</p>
                    <p className="text-slate-300 min-h-[48px]">{selectedRes.notes || 'Sem observações registradas.'}</p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button type="button" onClick={() => setModalResId(selectedRes.id)} className="h-8 px-3 rounded-lg bg-white text-slate-900 text-[12px] font-semibold">Abrir reserva</button>
                      <button type="button" onClick={() => setModalAccount({ accountId: selectedRes.accountId, reservationId: selectedRes.id })} className="h-8 px-3 rounded-lg border border-white/30 text-[12px]">Conta</button>
                      <button type="button" onClick={() => doCheckOut(selectedRes.id)} className="h-8 px-3 rounded-lg bg-indigo-500 text-white text-[12px] font-semibold">Check-out</button>
                    </div>
                  </div>
                </div>
              );
            })() : (
              <p className="text-slate-400">Clique em um hóspede da lista para ver os detalhes</p>
            )}
          </div>
        </div>
      )}

      {tab === 'chart' && (
        <div className="space-y-3">
          <select value={chartDays} onChange={(e) => setChartDays(Number(e.target.value))} className="h-9 rounded-lg border px-2 text-[13px]">
            <option value={7}>7 dias</option>
            <option value={14}>14 dias</option>
            <option value={21}>21 dias</option>
            <option value={30}>30 dias</option>
          </select>
          <div className="rounded-2xl border bg-white overflow-auto max-h-[520px]">
            <table className="border-collapse text-[10px] min-w-max">
              <thead className="sticky top-0 z-20 bg-slate-900 text-slate-200">
                <tr>
                  <th className="sticky left-0 z-30 bg-slate-900 px-3 py-2 text-left min-w-[120px]">UH</th>
                  {chartDates.map((d) => {
                    const [, m, day] = d.split('-');
                    return <th key={d} className="px-1 py-2 text-center min-w-[34px] border-l border-white/10">{day}/{m}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {[...rooms].sort((a, b) => a.number.localeCompare(b.number, 'pt-BR', { numeric: true })).map((room) => (
                  <tr key={room.id} className="border-t border-slate-100">
                    <td className="sticky left-0 bg-white px-3 py-1 font-medium border-r">{room.number}</td>
                    {chartDates.map((d) => {
                      const cell = cellInfo(room, d);
                      return <td key={d} title={cell.title} className={cn('px-0.5 py-1 text-center font-bold min-w-[34px]', cell.cls)}>{cell.label}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
