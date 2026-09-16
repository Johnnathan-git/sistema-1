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
import { ArrowLeftRight, LayoutGrid, List, LogIn, Search, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

type MainTab = 'checkins' | 'hospedados' | 'chart';

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function ReceptionModule() {
  const {
    hotel,
    reservations,
    rooms,
    guests,
    checkIn,
    checkOut,
    cancelCheckIn,
    transferRoom,
  } = usePms();
  const [tab, setTab] = useState<MainTab>('checkins');
  const [q, setQ] = useState('');
  const [selectedResId, setSelectedResId] = useState<string | null>(null);
  const [modalResId, setModalResId] = useState<string | null>(null);
  const [modalAccount, setModalAccount] = useState<{
    accountId?: string;
    reservationId?: string;
  } | null>(null);
  const [chartDays, setChartDays] = useState(14);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferRoomId, setTransferRoomId] = useState('');
  const [onlyPreCI, setOnlyPreCI] = useState(false);
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
  const arrivalAdults = arrivals.reduce((s, r) => s + r.adults, 0);
  const arrivalChildren = arrivals.reduce((s, r) => s + r.children, 0);
  const totalPax = inHouse.reduce((s, r) => s + r.adults + r.children, 0);

  const filteredArrivals = useMemo(() => {
    let list = arrivals;
    if (onlyPreCI) list = list.filter((r) => r.fnrhFilled);
    const query = q.trim().toLowerCase();
    if (!query) return list;
    return list.filter(
      (r) =>
        r.guestName.toLowerCase().includes(query) ||
        r.code.toLowerCase().includes(query) ||
        (r.roomNumber || '').toLowerCase().includes(query)
    );
  }, [arrivals, q, onlyPreCI]);

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
    (tab === 'hospedados'
      ? filteredInHouse[0] ?? null
      : tab === 'checkins'
        ? filteredArrivals[0] ?? null
        : null);

  const availableTransferRooms = useMemo(
    () =>
      rooms.filter(
        (r) =>
          r.occupancy === 'livre' &&
          r.governance !== 'interditado' &&
          r.governance !== 'manutencao' &&
          (!selectedRes || r.id !== selectedRes.roomId)
      ),
    [rooms, selectedRes]
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
  const doCancelCheckIn = (id: string) => {
    if (!window.confirm('Cancelar o check-in deste hóspede? A UH será liberada como suja.'))
      return;
    const res = cancelCheckIn(id);
    if (res.ok) {
      toast.success(res.message);
      setSelectedResId(null);
    } else toast.error(res.message);
  };
  const doTransfer = () => {
    if (!selectedRes || !transferRoomId) {
      toast.error('Selecione a UH de destino');
      return;
    }
    const res = transferRoom(selectedRes.id, transferRoomId);
    if (res.ok) {
      toast.success(res.message);
      setTransferOpen(false);
      setTransferRoomId('');
    } else toast.error(res.message);
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

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              { id: 'checkins' as const, label: 'Check-ins previstos', icon: LogIn },
              { id: 'hospedados' as const, label: 'Hospedados', icon: List },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px inline-flex items-center gap-1.5',
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
        <div className="flex flex-wrap items-center gap-2 pb-1">
          <button
            type="button"
            disabled={!selectedRes || selectedRes.status !== 'checkin'}
            onClick={() => {
              setTransferRoomId('');
              setTransferOpen(true);
              if (tab !== 'hospedados') setTab('hospedados');
            }}
            className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-[12px] font-medium inline-flex items-center gap-1.5 disabled:opacity-40 hover:bg-slate-50"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" /> Transferência
          </button>
          <button
            type="button"
            disabled={!selectedRes || selectedRes.status !== 'checkin'}
            onClick={() => selectedRes && doCancelCheckIn(selectedRes.id)}
            className="h-8 px-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-[12px] font-medium inline-flex items-center gap-1.5 disabled:opacity-40 hover:bg-amber-100"
          >
            <Undo2 className="w-3.5 h-3.5" /> Cancelar check-in
          </button>
          <button
            type="button"
            onClick={() => setTab('chart')}
            className={cn(
              'h-8 px-3 rounded-lg border text-[12px] font-medium inline-flex items-center gap-1.5',
              tab === 'chart'
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Chart de ocupação
          </button>
        </div>
      </div>

      {tab === 'hospedados' && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar hóspede, UH ou reserva…"
            className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      )}

      {tab === 'checkins' && (
        <div className="flex flex-col pb-36 space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-[12px]">
              <label className="space-y-0.5">
                <span className="text-[10px] uppercase text-slate-400 font-semibold">Reserva</span>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Nº / hóspede / UH"
                  className="w-full h-8 rounded-lg border border-slate-200 px-2 outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-[10px] uppercase text-slate-400 font-semibold">Período CI</span>
                <input
                  type="date"
                  value={today}
                  disabled
                  className="w-full h-8 rounded-lg border border-slate-200 px-2 bg-slate-50 text-slate-600"
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-[10px] uppercase text-slate-400 font-semibold">UH</span>
                <select className="w-full h-8 rounded-lg border border-slate-200 px-2 bg-white">
                  <option>Todos</option>
                  {rooms.map((r) => (
                    <option key={r.id}>{r.number}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-0.5">
                <span className="text-[10px] uppercase text-slate-400 font-semibold">Tipo UH</span>
                <select className="w-full h-8 rounded-lg border border-slate-200 px-2 bg-white">
                  <option>Todos</option>
                  <option>Standard</option>
                  <option>Superior</option>
                  <option>Suite</option>
                </select>
              </label>
              <label className="space-y-0.5">
                <span className="text-[10px] uppercase text-slate-400 font-semibold">Canal</span>
                <select className="w-full h-8 rounded-lg border border-slate-200 px-2 bg-white">
                  <option>Todos</option>
                  <option>direto</option>
                  <option>booking</option>
                  <option>expedia</option>
                  <option>telefone</option>
                  <option>walkin</option>
                </select>
              </label>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 h-8 text-[12px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={onlyPreCI}
                    onChange={(e) => setOnlyPreCI(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Somente com Pré-CI
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/80 text-[12px] font-semibold text-slate-600">
              Check-ins previstos e pré-check-ins · {filteredArrivals.length}
            </div>
            <div className="overflow-x-auto max-h-[calc(100vh-420px)]">
              <table className="w-full text-[12px] min-w-max">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b">
                    <th className="px-3 py-2 whitespace-nowrap">Reserva</th>
                    <th className="px-3 py-2 whitespace-nowrap">Nome hóspede</th>
                    <th className="px-3 py-2 whitespace-nowrap">Tipo UH</th>
                    <th className="px-3 py-2 whitespace-nowrap">UH</th>
                    <th className="px-3 py-2 whitespace-nowrap">Pré-CI</th>
                    <th className="px-3 py-2 whitespace-nowrap">AD/CH</th>
                    <th className="px-3 py-2 whitespace-nowrap">Check-in</th>
                    <th className="px-3 py-2 whitespace-nowrap">Check-out</th>
                    <th className="px-3 py-2 whitespace-nowrap">Canal</th>
                    <th className="px-3 py-2 whitespace-nowrap">Governança</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap">Check-in</th>
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
                          onDoubleClick={() => setModalResId(r.id)}
                          className={cn('cursor-pointer', active ? 'bg-indigo-50' : 'hover:bg-slate-50')}
                        >
                          <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap">
                            {r.code.replace('RSV-', '')}
                          </td>
                          <td className="px-3 py-2 font-medium whitespace-nowrap max-w-[200px] truncate">
                            {r.guestName}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-slate-600">{r.roomType}</td>
                          <td className="px-3 py-2 font-semibold whitespace-nowrap">{r.roomNumber || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {r.fnrhFilled ? (
                              <span className="text-emerald-600 font-semibold">SIM</span>
                            ) : (
                              <span className="text-slate-400">NÃO</span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {r.adults}/{r.children}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(r.checkIn)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(r.checkOut)}</td>
                          <td className="px-3 py-2 capitalize whitespace-nowrap text-slate-500">{r.origin}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {room ? (
                              <span className={!ready ? 'text-rose-600 font-semibold' : 'text-emerald-600'}>
                                {GOVERNANCE_LABEL[room.governance]}
                                {!ready ? ` · ${reason}` : ''}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => doCheckIn(r.id)}
                              className="h-7 px-2.5 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold"
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

          <div className="fixed bottom-0 left-[232px] right-0 z-30 border-t border-slate-700 bg-slate-900 text-slate-100 text-[12px] shadow-[0_-8px_30px_rgba(0,0,0,0.25)]">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-700">
              <div className="lg:col-span-3 p-3 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Previsões do dia</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                  <span className="text-slate-400">Check-in · UHs</span>
                  <span className="font-semibold text-right">{arrivals.length}</span>
                  <span className="text-slate-400">Adultos</span>
                  <span className="font-semibold text-right">{arrivalAdults}</span>
                  <span className="text-slate-400">Crianças</span>
                  <span className="font-semibold text-right">{arrivalChildren}</span>
                  <span className="text-slate-400">Check-out · UHs</span>
                  <span className="font-semibold text-right">{departures.length}</span>
                </div>
              </div>
              <div className="lg:col-span-3 p-3 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ocupação</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                  <span className="text-slate-400">Qtd UHs</span>
                  <span className="font-semibold text-right">{sellable}</span>
                  <span className="text-slate-400">Ocupadas</span>
                  <span className="font-semibold text-right">{occupied} · {occPct}%</span>
                  <span className="text-slate-400">In-house</span>
                  <span className="font-semibold text-right">{inHouse.length}</span>
                  <span className="text-slate-400">Total pax</span>
                  <span className="font-semibold text-right">{totalPax}</span>
                </div>
              </div>
              <div className="lg:col-span-6 p-3 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Observação da reserva selecionada
                </p>
                {selectedRes && selectedRes.status !== 'checkin' ? (
                  <div className="space-y-1">
                    <p className="font-semibold">
                      {selectedRes.guestName}{' '}
                      <span className="font-mono font-normal text-slate-400">
                        · {selectedRes.code.replace('RSV-', '')}
                      </span>
                    </p>
                    <p className="text-slate-300">
                      {selectedRes.roomNumber || selectedRes.roomType} · {formatDateBR(selectedRes.checkIn)} →{' '}
                      {formatDateBR(selectedRes.checkOut)} · {selectedRes.adults} AD / {selectedRes.children} CH ·
                      Canal <span className="capitalize">{selectedRes.origin}</span>
                    </p>
                    <p className="text-slate-400 line-clamp-2">
                      {selectedRes.notes || 'Sem observações registradas.'}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setModalResId(selectedRes.id)}
                        className="h-7 px-2.5 rounded-lg bg-white text-slate-900 text-[11px] font-semibold"
                      >
                        Abrir reserva
                      </button>
                      <button
                        type="button"
                        onClick={() => doCheckIn(selectedRes.id)}
                        className="h-7 px-2.5 rounded-lg bg-indigo-500 text-white text-[11px] font-semibold"
                      >
                        Check-in
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500">Selecione uma reserva na lista</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'hospedados' && (
        <div className="flex flex-col pb-44">
          {transferOpen && selectedRes && (
            <div className="mb-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1">
                <p className="text-[11px] font-semibold uppercase text-slate-500 mb-1">
                  Transferir {selectedRes.guestName}
                </p>
                <p className="text-[12px] text-slate-600 mb-2">
                  De {selectedRes.roomNumber} → selecione a UH destino
                </p>
                <select
                  value={transferRoomId}
                  onChange={(e) => setTransferRoomId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-[13px]"
                >
                  <option value="">Selecione a UH…</option>
                  {availableTransferRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.number} · {r.type} · {GOVERNANCE_LABEL[r.governance]}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={doTransfer}
                className="h-10 px-4 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold"
              >
                Confirmar transferência
              </button>
              <button
                type="button"
                onClick={() => setTransferOpen(false)}
                className="h-10 px-3 rounded-lg border text-[13px]"
              >
                Fechar
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b bg-slate-50/80 text-[12px] font-semibold text-slate-600">
              Hospedados · {filteredInHouse.length}
            </div>
            <div className="overflow-x-auto max-h-[calc(100vh-380px)]">
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredInHouse.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="px-4 py-12 text-center text-slate-400">
                        Nenhum hóspede in-house no momento
                      </td>
                    </tr>
                  ) : (
                    filteredInHouse.map((r) => {
                      const room = rooms.find((rm) => rm.id === r.roomId);
                      const active = selectedRes?.id === r.id;
                      const empresa =
                        r.origin === 'direto' ? 'PARTICULAR' : r.origin.toUpperCase();
                      return (
                        <tr
                          key={r.id}
                          onClick={() => setSelectedResId(r.id)}
                          onDoubleClick={() => setModalResId(r.id)}
                          className={cn(
                            'cursor-pointer',
                            active ? 'bg-indigo-50' : 'hover:bg-slate-50'
                          )}
                        >
                          <td className="px-3 py-2 font-semibold whitespace-nowrap">{r.roomNumber || '—'}</td>
                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.roomType}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {room ? (room.floor === 0 ? 'Térreo' : `${room.floor}º`) : '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{room?.block || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-blue-700 font-medium">Ocupada</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {room ? GOVERNANCE_LABEL[room.governance] : '—'}
                          </td>
                          <td className="px-3 py-2 font-medium whitespace-nowrap max-w-[180px] truncate">
                            {r.guestName}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap">
                            {r.code.replace('RSV-', '')}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {r.fnrhFilled ? (
                              <span className="text-emerald-600 font-medium">Sim</span>
                            ) : (
                              <span className="text-slate-400">Não</span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {r.adults}/{r.children}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(r.checkIn)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {formatDateBR(r.checkOut)}
                            {r.checkOut === today && (
                              <span className="ml-1 text-amber-600 font-semibold text-[10px]">HOJE</span>
                            )}
                          </td>
                          <td className="px-3 py-2 capitalize text-slate-500 whitespace-nowrap">{r.origin}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {room?.dnd ? (
                              <span className="text-rose-600 font-semibold">S</span>
                            ) : (
                              <span className="text-slate-300">N</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-500 whitespace-nowrap text-[11px]">{empresa}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selectedRes && selectedRes.status === 'checkin' && (
            <div className="fixed bottom-0 left-[232px] right-0 z-30 border-t border-slate-700 bg-slate-900 text-slate-100 px-6 py-4 text-[12px] shadow-[0_-8px_30px_rgba(0,0,0,0.25)]">
              {(() => {
                const room = rooms.find((rm) => rm.id === selectedRes.roomId);
                const guest = guests.find((g) => g.id === selectedRes.guestId);
                const companions = [
                  selectedRes.guestName,
                  ...(selectedRes.adults > 1
                    ? ['SARA QUEIROZ DA SILVA', 'JULIA QUEIROZ DA SILVA'].slice(
                        0,
                        Math.min(2, selectedRes.adults - 1)
                      )
                    : []),
                  ...(selectedRes.children > 0
                    ? ['ELAINE APARECIDA QUEIROZ'].slice(0, selectedRes.children)
                    : []),
                ];
                return (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 max-w-[1600px]">
                    <div className="md:col-span-3 space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                        UH / Reserva
                      </p>
                      <p>
                        <span className="text-slate-400">Nº reserva:</span>{' '}
                        <span className="font-semibold">{selectedRes.code.replace('RSV-', '')}</span>
                      </p>
                      <p>
                        <span className="text-slate-400">UH:</span>{' '}
                        <span className="font-semibold">
                          {selectedRes.roomNumber} · {selectedRes.roomType}
                        </span>
                      </p>
                      <p>
                        <span className="text-slate-400">Andar / bloco:</span>{' '}
                        {room
                          ? `${room.floor === 0 ? 'Térreo' : room.floor + 'º'} · ${room.block || '—'}`
                          : '—'}
                      </p>
                      <p>
                        <span className="text-slate-400">Governança:</span>{' '}
                        {room ? GOVERNANCE_LABEL[room.governance] : '—'}
                      </p>
                    </div>
                    <div className="md:col-span-3 space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                        Estadia
                      </p>
                      <p>
                        <span className="text-slate-400">Check-in efetuado:</span>{' '}
                        {formatDateBR(selectedRes.checkIn)}
                      </p>
                      <p>
                        <span className="text-slate-400">Checkout previsto:</span>{' '}
                        {formatDateBR(selectedRes.checkOut)}
                      </p>
                      <p>
                        <span className="text-slate-400">Origem:</span>{' '}
                        <span className="capitalize">{selectedRes.origin}</span>
                      </p>
                      <p>
                        <span className="text-slate-400">Pré-check-in / FNRH:</span>{' '}
                        {selectedRes.fnrhFilled ? 'Conferido' : 'Não conferido'}
                      </p>
                      <p>
                        <span className="text-slate-400">Placa veículo:</span> ABC1D23
                      </p>
                    </div>
                    <div className="md:col-span-3 space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                        Hóspedes
                      </p>
                      <ul className="space-y-0.5">
                        {companions.map((name, i) => (
                          <li key={i} className={i === 0 ? 'font-semibold' : 'text-slate-300'}>
                            {name}
                          </li>
                        ))}
                      </ul>
                      {guest && (
                        <p className="text-slate-400 pt-1">
                          Doc: {guest.document} · {guest.phone}
                        </p>
                      )}
                    </div>
                    <div className="md:col-span-3 space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                        Observação
                      </p>
                      <p className="text-slate-300 min-h-[40px]">
                        {selectedRes.notes || 'Sem observações registradas.'}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setModalResId(selectedRes.id)}
                          className="h-8 px-3 rounded-lg bg-white text-slate-900 text-[12px] font-semibold"
                        >
                          Abrir reserva
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setModalAccount({
                              accountId: selectedRes.accountId,
                              reservationId: selectedRes.id,
                            })
                          }
                          className="h-8 px-3 rounded-lg border border-white/30 text-[12px]"
                        >
                          Conta
                        </button>
                        <button
                          type="button"
                          onClick={() => doCheckOut(selectedRes.id)}
                          className="h-8 px-3 rounded-lg bg-indigo-500 text-white text-[12px] font-semibold"
                        >
                          Check-out
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {tab === 'chart' && (
        <div className="space-y-3">
          <select
            value={chartDays}
            onChange={(e) => setChartDays(Number(e.target.value))}
            className="h-9 rounded-lg border px-2 text-[13px]"
          >
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
                    return (
                      <th key={d} className="px-1 py-2 text-center min-w-[34px] border-l border-white/10">
                        {day}/{m}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {[...rooms]
                  .sort((a, b) => a.number.localeCompare(b.number, 'pt-BR', { numeric: true }))
                  .map((room) => (
                    <tr key={room.id} className="border-t border-slate-100">
                      <td className="sticky left-0 bg-white px-3 py-1 font-medium border-r">{room.number}</td>
                      {chartDates.map((d) => {
                        const cell = cellInfo(room, d);
                        return (
                          <td
                            key={d}
                            title={cell.title}
                            className={cn('px-0.5 py-1 text-center font-bold min-w-[34px]', cell.cls)}
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
      )}
    </div>
  );
}
