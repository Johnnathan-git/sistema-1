import { useMemo, useState } from 'react';
import { usePms } from '@/lib/pms-store';
import { ROOM_STATUS_LABEL, type RoomStatus } from '@/lib/pms-types';
import { cn } from '@/lib/utils';
import { CheckSquare, Square, X } from 'lucide-react';
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

const STATUS_STYLE: Record<RoomStatus, { bar: string; chip: string }> = {
  livre: { bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  ocupado: { bar: 'bg-blue-500', chip: 'bg-blue-50 text-blue-800 ring-blue-200' },
  sujo: { bar: 'bg-rose-500', chip: 'bg-rose-50 text-rose-800 ring-rose-200' },
  limpeza: { bar: 'bg-amber-400', chip: 'bg-amber-50 text-amber-900 ring-amber-200' },
  inspecao: { bar: 'bg-violet-500', chip: 'bg-violet-50 text-violet-800 ring-violet-200' },
  interditado: { bar: 'bg-slate-500', chip: 'bg-slate-200 text-slate-800 ring-slate-300' },
  manutencao: { bar: 'bg-orange-500', chip: 'bg-orange-50 text-orange-900 ring-orange-200' },
};

export function GovernanceModule() {
  const { rooms, updateRoomStatus, reservations } = usePms();
  const [filter, setFilter] = useState<RoomStatus | 'todos'>('todos');
  const [floor, setFloor] = useState<string>('todos');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<RoomStatus>('livre');

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

  const allVisibleSelected =
    list.length > 0 && list.every((r) => selected.has(r.id));
  const someVisibleSelected = list.some((r) => selected.has(r.id));

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const r of list) next.delete(r.id);
      } else {
        for (const r of list) next.add(r.id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const applyBulk = () => {
    if (selected.size === 0) {
      toast.error('Selecione pelo menos uma UH');
      return;
    }
    let notes: string | undefined;
    if (bulkStatus === 'interditado' || bulkStatus === 'manutencao') {
      notes = window.prompt('Motivo (opcional, aplica a todas):') || undefined;
    }
    for (const id of selected) {
      updateRoomStatus(id, bulkStatus, notes);
    }
    toast.success(
      `${selected.size} UH(s) → ${ROOM_STATUS_LABEL[bulkStatus]}`
    );
    clearSelection();
  };

  const setStatusOne = (roomId: string, status: RoomStatus) => {
    let notes: string | undefined;
    if (status === 'interditado' || status === 'manutencao') {
      notes = window.prompt('Motivo (opcional):') || undefined;
    }
    updateRoomStatus(roomId, status, notes);
    toast.success(ROOM_STATUS_LABEL[status]);
  };

  return (
    <div className="space-y-5">
      {/* Resumo por status */}
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
                active && 'ring-2 ring-indigo-500 border-indigo-200'
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

      {/* Filtros */}
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
            Limpar filtro de status
          </button>
        )}
        <p className="text-[12px] text-slate-500 ml-auto">{list.length} UH(s) na lista</p>
      </div>

      {/* Barra de ação em lote */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 shadow-sm">
          <p className="text-[13px] font-semibold text-indigo-900">
            {selected.size} UH(s) selecionada(s)
          </p>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as RoomStatus)}
            className="h-9 rounded-lg border border-indigo-200 bg-white px-3 text-[13px] font-medium"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {ROOM_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={applyBulk}
            className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-500 shadow-sm"
          >
            Aplicar status
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="h-9 px-3 rounded-lg border border-indigo-200 bg-white text-[13px] text-indigo-800 hover:bg-indigo-50 inline-flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" /> Limpar seleção
          </button>
        </div>
      )}

      {/* Lista */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-slate-400 border-b border-slate-100 bg-slate-50/80">
                <th className="px-4 py-2.5 w-10">
                  <button
                    type="button"
                    onClick={toggleAllVisible}
                    className="text-slate-500 hover:text-slate-800"
                    aria-label={allVisibleSelected ? 'Desmarcar todas' : 'Selecionar todas'}
                    title={allVisibleSelected ? 'Desmarcar todas' : 'Selecionar todas visíveis'}
                  >
                    {allVisibleSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : someVisibleSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="px-3 py-2.5 font-semibold">UH</th>
                <th className="px-3 py-2.5 font-semibold">Tipo</th>
                <th className="px-3 py-2.5 font-semibold">Andar</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold">Hóspede / Obs.</th>
                <th className="px-4 py-2.5 font-semibold text-right">Alterar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {list.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    Nenhuma UH neste filtro
                  </td>
                </tr>
              ) : (
                list.map((room) => {
                  const guest = guestInRoom(room.id);
                  const isOn = selected.has(room.id);
                  const st = STATUS_STYLE[room.status];
                  return (
                    <tr
                      key={room.id}
                      className={cn(
                        'transition-colors',
                        isOn ? 'bg-indigo-50/70' : 'hover:bg-slate-50/80'
                      )}
                    >
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => toggleOne(room.id)}
                          className="text-slate-500 hover:text-indigo-600"
                          aria-label={isOn ? 'Desmarcar' : 'Selecionar'}
                        >
                          {isOn ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={cn('h-2.5 w-2.5 rounded-sm shrink-0', st.bar)} />
                          <span className="font-semibold tabular-nums">{room.number}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{room.type}</td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {room.floor === 0 ? 'Térreo' : `${room.floor}º`}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            'inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                            st.chip
                          )}
                        >
                          {ROOM_STATUS_LABEL[room.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 max-w-[220px] truncate">
                        {guest
                          ? guest.guestName
                          : room.notes || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <select
                          value={room.status}
                          onChange={(e) =>
                            setStatusOne(room.id, e.target.value as RoomStatus)
                          }
                          className="h-8 rounded-lg border border-slate-200 bg-white text-[12px] px-2 font-medium max-w-[140px]"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {ROOM_STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[12px] text-slate-500">
        Dica: use o checkbox do cabeçalho para selecionar todas as UHs visíveis no filtro atual, escolha o
        novo status e clique em <strong>Aplicar status</strong>.
      </p>
    </div>
  );
}
