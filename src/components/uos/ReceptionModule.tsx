import { useMemo, useState } from 'react';
import { usePms } from '@/lib/pms-store';
import { ReservationModal } from '@/components/uos/ReservationModal';
import { AccountModal } from '@/components/uos/AccountModal';
import { TransferModal } from '@/components/uos/TransferModal';
import {
  formatDateBR,
  GOVERNANCE_LABEL,
  isRoomReadyForCheckIn,
  roomNotReadyReason,
  type Room,
} from '@/lib/pms-types';
import { cn } from '@/lib/utils';
import { ArrowLeftRight, DoorOpen, LayoutGrid, List, LogIn, Printer, RefreshCw, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

type MainTab = 'checkins' | 'hospedados' | 'chart';

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function ReceptionModule() {
  const { hotel, reservations, rooms, guests, checkOut, cancelCheckIn, transferRoom } = usePms();
  const [tab, setTab] = useState<MainTab>('checkins');
  const [q, setQ] = useState('');
  const [selectedResId, setSelectedResId] = useState<string | null>(null);
  const [modalResId, setModalResId] = useState<string | null>(null);
  const [modalAccount, setModalAccount] = useState<{ accountId?: string; reservationId?: string } | null>(null);
  const [chartDays, setChartDays] = useState(14);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferRoomId, setTransferRoomId] = useState('');
  const [onlyPreCI, setOnlyPreCI] = useState(false);
  const [filterRoom, setFilterRoom] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCanal, setFilterCanal] = useState('');
  const [filterGuest, setFilterGuest] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [hRoom, setHRoom] = useState('');
  const [hCategory, setHCategory] = useState('');
  const [hBlock, setHBlock] = useState('');
  const [hGroupFlag, setHGroupFlag] = useState('');
  const [hGroupName, setHGroupName] = useState('');
  const [hReserva, setHReserva] = useState('');
  const [hVehicle, setHVehicle] = useState('');
  const [hGuest, setHGuest] = useState('');
  const today = hotel.operationalDate;
  const [filterPeriod, setFilterPeriod] = useState(hotel.operationalDate);

  const arrivals = useMemo(
    () => reservations.filter((r) => r.checkIn === today && (r.status === 'confirmada' || r.status === 'pendente')),
    [reservations, today]
  );
  const inHouse = useMemo(() => reservations.filter((r) => r.status === 'checkin'), [reservations]);
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

  const clearFilters = () => {
    setQ('');
    setFilterGuest('');
    setFilterPeriod(today);
    setFilterRoom('');
    setFilterType('');
    setFilterCanal('');
    setFilterGroup('');
    setFilterCategory('');
    setOnlyPreCI(false);
  };

  const filteredArrivals = useMemo(() => {
    let list = arrivals;
    if (onlyPreCI) list = list.filter((r) => r.fnrhFilled);
    if (filterPeriod) list = list.filter((r) => r.checkIn === filterPeriod);
    if (filterRoom) list = list.filter((r) => r.roomId === filterRoom || r.roomNumber === filterRoom);
    if (filterType) list = list.filter((r) => r.roomType === filterType);
    if (filterCanal) list = list.filter((r) => r.origin === filterCanal);
    if (filterCategory) list = list.filter((r) => r.roomType === filterCategory);
    const query = (q || filterGuest).trim().toLowerCase();
    if (query) {
      list = list.filter(
        (r) =>
          r.guestName.toLowerCase().includes(query) ||
          r.code.toLowerCase().includes(query) ||
          (r.roomNumber || '').toLowerCase().includes(query)
      );
    }
    if (filterGroup) {
      const g = filterGroup.trim().toLowerCase();
      list = list.filter((r) => (r.notes || '').toLowerCase().includes(g) || r.guestName.toLowerCase().includes(g));
    }
    return list;
  }, [arrivals, q, onlyPreCI, filterPeriod, filterRoom, filterType, filterCanal, filterGuest, filterGroup, filterCategory]);

  const blocks = useMemo(
    () => Array.from(new Set(rooms.map((r) => r.block).filter(Boolean) as string[])).sort(),
    [rooms]
  );

  const filteredInHouse = useMemo(() => {
    let list = inHouse;
    if (hRoom) list = list.filter((r) => r.roomId === hRoom || r.roomNumber === hRoom);
    if (hCategory) list = list.filter((r) => r.roomType === hCategory);
    if (hBlock) {
      list = list.filter((r) => rooms.find((rm) => rm.id === r.roomId)?.block === hBlock);
    }
    if (hReserva.trim()) {
      const qq = hReserva.trim().toLowerCase();
      list = list.filter((r) => r.code.toLowerCase().includes(qq) || r.code.replace('RSV-', '').includes(qq));
    }
    if (hGuest.trim()) {
      const qq = hGuest.trim().toLowerCase();
      list = list.filter((r) => r.guestName.toLowerCase().includes(qq));
    }
    if (hGroupName.trim()) {
      const qq = hGroupName.trim().toLowerCase();
      list = list.filter((r) => (r.notes || '').toLowerCase().includes(qq) || r.guestName.toLowerCase().includes(qq));
    }
    if (hGroupFlag === 'sim') {
      list = list.filter((r) => (r.notes || '').toLowerCase().includes('grupo') || r.adults + r.children > 2);
    } else if (hGroupFlag === 'nao') {
      list = list.filter((r) => !(r.notes || '').toLowerCase().includes('grupo') && r.adults + r.children <= 2);
    }
    if (hVehicle.trim()) {
      const qq = hVehicle.trim().toLowerCase();
      list = list.filter((r) => (r.notes || '').toLowerCase().includes(qq));
    }
    return list;
  }, [inHouse, hRoom, hCategory, hBlock, hReserva, hGuest, hGroupName, hGroupFlag, hVehicle, rooms]);

  const selectedRes =
    reservations.find((r) => r.id === selectedResId) ||
    (tab === 'hospedados' ? filteredInHouse[0] ?? null : tab === 'checkins' ? filteredArrivals[0] ?? null : null);

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

  const doCheckOut = (id: string) => {
    const res = checkOut(id);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
  };
  const doCancelCheckIn = (id: string) => {
    if (!window.confirm('Cancelar o check-in deste hóspede? A UH será liberada como suja.')) return;
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

  const chartDates = useMemo(() => Array.from({ length: chartDays }, (_, i) => addDays(today, i)), [today, chartDays]);

  const cellInfo = (room: Room, date: string) => {
    if (room.occupancy === 'bloqueado' || room.governance === 'interditado') {
      return { cls: 'bg-orange-400 text-white', label: 'I', title: 'Interditado' };
    }
    const res = reservations.find(
      (r) => r.roomId === room.id && r.status !== 'cancelada' && r.status !== 'no_show' && r.checkIn <= date && r.checkOut > date
    );
    if (res) {
      if (res.status === 'checkin') {
        if (res.checkOut === date) return { cls: 'bg-pink-500 text-white', label: 'CO', title: res.guestName };
        return { cls: 'bg-blue-600 text-white', label: 'CI', title: res.guestName };
      }
      if (res.status === 'confirmada') return { cls: 'bg-emerald-500 text-white', label: 'C', title: res.guestName };
      if (res.status === 'pendente') return { cls: 'bg-sky-300 text-slate-800', label: 'P', title: res.guestName };
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
        <AccountModal accountId={modalAccount.accountId} reservationId={modalAccount.reservationId} onClose={() => setModalAccount(null)} />
      )}
      {transferOpen && selectedRes && selectedRes.status === 'checkin' && (
        <TransferModal reservation={selectedRes} onClose={() => setTransferOpen(false)} />
      )}

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-0">
        <div className="flex flex-wrap items-center gap-1">
          {([{ id: 'checkins' as const, label: 'Check-ins previstos', icon: LogIn }, { id: 'hospedados' as const, label: 'Hospedados', icon: List }] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={cn('px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px inline-flex items-center gap-1.5', tab === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800')}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 pb-1">
          <button type="button" onClick={() => toast.message('Walk-in: use a Central de Reservas com origem Walk-in ou cadastre na hora')} className="h-8 px-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 text-[12px] font-medium inline-flex items-center gap-1.5 hover:bg-emerald-100">
            <DoorOpen className="w-3.5 h-3.5" /> Walk-in
          </button>
          <button type="button" disabled={!selectedRes || selectedRes.status !== 'checkin'} onClick={() => { setTransferOpen(true); if (tab !== 'hospedados') setTab('hospedados'); }} className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-[12px] font-medium inline-flex items-center gap-1.5 disabled:opacity-40 hover:bg-slate-50">
            <ArrowLeftRight className="w-3.5 h-3.5" /> Transferência
          </button>
          <button type="button" disabled={!selectedRes || selectedRes.status !== 'checkin'} onClick={() => selectedRes && doCancelCheckIn(selectedRes.id)} className="h-8 px-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-[12px] font-medium inline-flex items-center gap-1.5 disabled:opacity-40 hover:bg-amber-100">
            <Undo2 className="w-3.5 h-3.5" /> Cancelar check-in
          </button>
          <button type="button" onClick={() => setTab('chart')} className={cn('h-8 px-3 rounded-lg border text-[12px] font-medium inline-flex items-center gap-1.5', tab === 'chart' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
            <LayoutGrid className="w-3.5 h-3.5" /> Chart de ocupação
          </button>
        </div>
      </div>

      {tab === 'checkins' && (
        <div className="flex flex-col pb-36 space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-[12px] text-slate-500">Use os filtros e a lista de check-ins previstos abaixo.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/80 text-[12px] font-semibold text-slate-600">Check-ins previstos · {filteredArrivals.length}</div>
            <div className="overflow-x-auto max-h-[calc(100vh-420px)]">
              <table className="w-full text-[12px] min-w-max">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b">
                    <th className="px-3 py-2">Reserva</th>
                    <th className="px-3 py-2">Hóspede</th>
                    <th className="px-3 py-2">UH</th>
                    <th className="px-3 py-2">Check-in</th>
                    <th className="px-3 py-2">Check-out</th>
                    <th className="px-3 py-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredArrivals.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">Nenhum check-in previsto</td></tr>
                  ) : (
                    filteredArrivals.map((r) => (
                      <tr key={r.id} onClick={() => setSelectedResId(r.id)} onDoubleClick={() => setModalResId(r.id)} className={cn('cursor-pointer', selectedResId === r.id ? 'bg-blue-50' : 'hover:bg-slate-50')}>
                        <td className="px-3 py-2 font-semibold">{r.code}</td>
                        <td className="px-3 py-2">{r.guestName}</td>
                        <td className="px-3 py-2">{r.roomNumber || '—'}</td>
                        <td className="px-3 py-2">{formatDateBR(r.checkIn)}</td>
                        <td className="px-3 py-2">{formatDateBR(r.checkOut)}</td>
                        <td className="px-3 py-2 text-right">
                          <button type="button" onClick={(e) => { e.stopPropagation(); setModalResId(r.id); }} className="h-7 px-2 rounded-lg bg-blue-600 text-white text-[11px] font-semibold">Check-in</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'hospedados' && (
        <div className="flex flex-col pb-36 space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b bg-slate-50/80 text-[12px] font-semibold text-slate-600">Hospedados · {filteredInHouse.length}</div>
            <div className="overflow-x-auto max-h-[calc(100vh-380px)]">
              <table className="text-[12px] min-w-max w-full">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="text-left text-[10px] uppercase text-slate-400 border-b">
                    <th className="px-3 py-2">UH</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Hóspede</th>
                    <th className="px-3 py-2">Reserva</th>
                    <th className="px-3 py-2">Check-in</th>
                    <th className="px-3 py-2">Check-out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredInHouse.map((r) => (
                    <tr key={r.id} onClick={() => setSelectedResId(r.id)} onDoubleClick={() => setModalResId(r.id)} className={cn('cursor-pointer', selectedResId === r.id ? 'bg-blue-50' : 'hover:bg-slate-50')}>
                      <td className="px-3 py-2 font-semibold">{r.roomNumber}</td>
                      <td className="px-3 py-2">{r.roomType}</td>
                      <td className="px-3 py-2">{r.guestName}</td>
                      <td className="px-3 py-2">{r.code}</td>
                      <td className="px-3 py-2">{formatDateBR(r.checkIn)}</td>
                      <td className="px-3 py-2">{formatDateBR(r.checkOut)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'chart' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[13px] font-semibold mb-2">Chart de ocupação · {chartDays} dias</p>
          <div className="overflow-x-auto">
            <table className="text-[10px] min-w-max">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left">UH</th>
                  {chartDates.map((d) => (
                    <th key={d} className="px-1 py-1 text-center">{d.slice(8)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id}>
                    <td className="px-2 py-1 font-semibold">{room.number}</td>
                    {chartDates.map((d) => {
                      const info = cellInfo(room, d);
                      return (
                        <td key={d} title={info.title} className={cn('px-1 py-1 text-center rounded', info.cls)}>
                          {info.label}
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
