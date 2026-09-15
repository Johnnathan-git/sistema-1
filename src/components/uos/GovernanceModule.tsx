import { useMemo, useState } from 'react';
import { usePms } from '@/lib/pms-store';
import { ROOM_STATUS_LABEL, type RoomStatus } from '@/lib/pms-types';
import { cn } from '@/lib/utils';
import { Ban, CheckCircle2, Sparkles, Wrench } from 'lucide-react';
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

const STATUS_COLOR: Record<RoomStatus, string> = {
  livre: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  ocupado: 'bg-blue-50 border-blue-200 text-blue-800',
  sujo: 'bg-rose-50 border-rose-200 text-rose-800',
  limpeza: 'bg-amber-50 border-amber-200 text-amber-900',
  inspecao: 'bg-violet-50 border-violet-200 text-violet-800',
  interditado: 'bg-slate-200 border-slate-300 text-slate-800',
  manutencao: 'bg-orange-50 border-orange-200 text-orange-900',
};

export function GovernanceModule() {
  const { rooms, updateRoomStatus } = usePms();
  const [filter, setFilter] = useState<RoomStatus | 'todos'>('todos');
  const [floor, setFloor] = useState<string>('todos');

  const floors = useMemo(
    () => Array.from(new Set(rooms.map((r) => r.floor))).sort((a, b) => a - b),
    [rooms]
  );

  const list = useMemo(() => {
    let rows = [...rooms].sort((a, b) => a.number.localeCompare(b.number, 'pt-BR', { numeric: true }));
    if (filter !== 'todos') rows = rows.filter((r) => r.status === filter);
    if (floor !== 'todos') rows = rows.filter((r) => String(r.floor) === floor);
    return rows;
  }, [rooms, filter, floor]);

  const counts = useMemo(() => {
    const c: Partial<Record<RoomStatus, number>> = {};
    for (const r of rooms) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [rooms]);

  const setStatus = (roomId: string, status: RoomStatus) => {
    let notes: string | undefined;
    if (status === 'interditado' || status === 'manutencao') {
      const reason = window.prompt('Motivo (opcional):') || undefined;
      notes = reason;
    }
    updateRoomStatus(roomId, status, notes);
    toast.success(`Status atualizado para ${ROOM_STATUS_LABEL[status]}`);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(filter === s ? 'todos' : s)}
            className={cn(
              'rounded-xl border px-3 py-2 text-left transition-all',
              filter === s ? 'ring-2 ring-slate-900' : '',
              STATUS_COLOR[s]
            )}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
              {ROOM_STATUS_LABEL[s]}
            </p>
            <p className="text-xl font-semibold">{counts[s] || 0}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={floor}
          onChange={(e) => setFloor(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="todos">Todos os andares</option>
          {floors.map((f) => (
            <option key={f} value={String(f)}>
              {f === 0 ? 'Térreo / Chalés' : `Andar ${f}`}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setFilter('todos')}
          className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm hover:bg-slate-50"
        >
          Limpar filtros
        </button>
        <p className="text-sm text-slate-500 ml-auto">{list.length} UH(s)</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {list.map((room) => (
          <div
            key={room.id}
            className={cn(
              'rounded-2xl border p-4 shadow-sm bg-white flex flex-col gap-3',
              room.status === 'interditado' && 'opacity-90'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold tracking-tight">{room.number}</p>
                <p className="text-xs text-slate-500">
                  {room.type} · {room.floor === 0 ? 'Térreo' : `Andar ${room.floor}`} ·{' '}
                  {room.capacity} pax
                </p>
              </div>
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                  STATUS_COLOR[room.status]
                )}
              >
                {ROOM_STATUS_LABEL[room.status]}
              </span>
            </div>

            {room.notes && (
              <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-2 py-1.5">{room.notes}</p>
            )}

            <div className="grid grid-cols-2 gap-1.5 mt-auto">
              <QuickBtn
                label="Livre"
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                onClick={() => setStatus(room.id, 'livre')}
              />
              <QuickBtn
                label="Sujo"
                icon={<Sparkles className="w-3.5 h-3.5" />}
                onClick={() => setStatus(room.id, 'sujo')}
              />
              <QuickBtn
                label="Limpeza"
                icon={<Sparkles className="w-3.5 h-3.5" />}
                onClick={() => setStatus(room.id, 'limpeza')}
              />
              <QuickBtn
                label="Inspeção"
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                onClick={() => setStatus(room.id, 'inspecao')}
              />
              <QuickBtn
                label="Interditar"
                icon={<Ban className="w-3.5 h-3.5" />}
                onClick={() => setStatus(room.id, 'interditado')}
              />
              <QuickBtn
                label="Manutenção"
                icon={<Wrench className="w-3.5 h-3.5" />}
                onClick={() => setStatus(room.id, 'manutencao')}
              />
            </div>

            <select
              value={room.status}
              onChange={(e) => setStatus(room.id, e.target.value as RoomStatus)}
              className="h-9 w-full rounded-lg border border-slate-200 text-xs px-2"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {ROOM_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickBtn({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 rounded-lg border border-slate-200 text-[11px] font-medium inline-flex items-center justify-center gap-1 hover:bg-slate-50"
    >
      {icon}
      {label}
    </button>
  );
}
