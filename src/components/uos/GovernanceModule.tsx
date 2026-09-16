import { useMemo, useState } from 'react';
import { usePms } from '@/lib/pms-store';
import { ROOM_STATUS_LABEL, type RoomStatus } from '@/lib/pms-types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_OPTIONS: RoomStatus[] = [
  'livre',
  'ocupado',
  'sujo',
  'limpeza',
  'inspecao',
  'interditado',
  'manutencao',
];

/** Cores padrão de board de governança (indústria) */
const STATUS_STYLE: Record<
  RoomStatus,
  { bar: string; chip: string; soft: string }
> = {
  livre: {
    bar: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    soft: 'border-emerald-200 hover:border-emerald-300',
  },
  ocupado: {
    bar: 'bg-blue-500',
    chip: 'bg-blue-50 text-blue-800 ring-blue-200',
    soft: 'border-blue-200 hover:border-blue-300',
  },
  sujo: {
    bar: 'bg-rose-500',
    chip: 'bg-rose-50 text-rose-800 ring-rose-200',
    soft: 'border-rose-200 hover:border-rose-300',
  },
  limpeza: {
    bar: 'bg-amber-400',
    chip: 'bg-amber-50 text-amber-900 ring-amber-200',
    soft: 'border-amber-200 hover:border-amber-300',
  },
  inspecao: {
    bar: 'bg-violet-500',
    chip: 'bg-violet-50 text-violet-800 ring-violet-200',
    soft: 'border-violet-200 hover:border-violet-300',
  },
  interditado: {
    bar: 'bg-slate-500',
    chip: 'bg-slate-200 text-slate-800 ring-slate-300',
    soft: 'border-slate-300 opacity-90',
  },
  manutencao: {
    bar: 'bg-orange-500',
    chip: 'bg-orange-50 text-orange-900 ring-orange-200',
    soft: 'border-orange-200 hover:border-orange-300',
  },
};

export function GovernanceModule() {
  const { rooms, updateRoomStatus, reservations } = usePms();
  const [filter, setFilter] = useState<RoomStatus | 'todos'>('todos');
  const [floor, setFloor] = useState<string>('todos');

  const floors = useMemo(
    () => Array.from(new Set(rooms.map((r) => r.floor))).sort((a, b) => a - b),
    [rooms]
  );

  const list = useMemo(() => {
    let rows = [...rooms].sort((a, b) =>
      a.number.localeCompare(b.number, 'pt-BR', { numeric: true })
    );
    if (filter !== 'todos') rows = rows.filter((r) => r.status === filter);
    if (floor !== 'todos') rows = rows.filter((r) => String(r.floor) === floor);
    return rows;
  }, [rooms, filter, floor]);

  const counts = useMemo(() => {
    const c: Partial<Record<RoomStatus, number>> = {};
    for (const r of rooms) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [rooms]);

  const guestInRoom = (roomId: string) =>
    reservations.find((r) => r.roomId === roomId && r.status === 'checkin');

  const setStatus = (roomId: string, status: RoomStatus) => {
    let notes: string | undefined;
    if (status === 'interditado' || status === 'manutencao') {
      const reason = window.prompt('Motivo (opcional):') || undefined;
      notes = reason;
    }
    updateRoomStatus(roomId, status, notes);
    toast.success(`${ROOM_STATUS_LABEL[status]}`);
  };

  return (
    <div className="space-y-5">
      {/* Status summary — clickable filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {STATUS_OPTIONS.map((s) => {
          const active = filter === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(active ? 'todos' : s)}
              className={cn(
                'rounded-xl border bg-white px-3 py-2.5 text-left transition-all shadow-sm',
                active && 'ring-2 ring-indigo-500',
                STATUS_STYLE[s].soft
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', STATUS_STYLE[s].bar)} />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {ROOM_STATUS_LABEL[s]}
                </p>
              </div>
              <p className="mt-1 text-xl font-semibold tabular-nums">{counts[s] || 0}</p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={floor}
          onChange={(e) => setFloor(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px]"
        >
          <option value="todos">Todos os andares</option>
          {floors.map((f) => (
            <option key={f} value={String(f)}>
              {f === 0 ? 'Térreo / Chalés' : `Andar ${f}`}
            </option>
          ))}
        </select>
        {filter !== 'todos' && (
          <button
            type="button"
            onClick={() => setFilter('todos')}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[13px] hover:bg-slate-50"
          >
            Limpar filtro
          </button>
        )}
        <p className="text-[12px] text-slate-500 ml-auto">{list.length} UH(s) exibidas</p>
      </div>

      {/* Room board */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
        {list.map((room) => {
          const guest = guestInRoom(room.id);
          const st = STATUS_STYLE[room.status];
          return (
            <div
              key={room.id}
              className={cn(
                'rounded-2xl border bg-white shadow-sm overflow-hidden flex flex-col transition-shadow hover:shadow-md',
                st.soft
              )}
            >
              <div className={cn('h-1.5 w-full', st.bar)} />
              <div className="p-3.5 flex flex-col gap-2.5 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[15px] font-semibold tracking-tight">{room.number}</p>
                    <p className="text-[11px] text-slate-500">
                      {room.type} · {room.floor === 0 ? 'Térreo' : `${room.floor}º`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
                      st.chip
                    )}
                  >
                    {ROOM_STATUS_LABEL[room.status]}
                  </span>
                </div>

                {guest && (
                  <p className="text-[11px] text-slate-600 bg-slate-50 rounded-lg px-2 py-1.5 truncate">
                    {guest.guestName.split(' ').slice(0, 2).join(' ')}
                  </p>
                )}
                {room.notes && !guest && (
                  <p className="text-[11px] text-slate-500 line-clamp-2">{room.notes}</p>
                )}

                <div className="mt-auto pt-1">
                  <select
                    value={room.status}
                    onChange={(e) => setStatus(room.id, e.target.value as RoomStatus)}
                    className="w-full h-8 rounded-lg border border-slate-200 bg-slate-50 text-[11px] px-2 font-medium"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {ROOM_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
