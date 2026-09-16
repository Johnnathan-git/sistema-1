import { useMemo, useState } from 'react';
import { GOVERNANCE_STATUSES, usePms } from '@/lib/pms-store';
import {
  GOVERNANCE_LABEL,
  HOUSEKEEPERS,
  OCCUPANCY_LABEL,
  type GovernanceStatus,
  type OccupancyStatus,
} from '@/lib/pms-types';
import { cn } from '@/lib/utils';
import { CheckSquare, History, Square, X } from 'lucide-react';
import { toast } from 'sonner';

const OCC_STYLE: Record<OccupancyStatus, string> = {
  livre: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  ocupado: 'bg-blue-50 text-blue-800 ring-blue-200',
  bloqueado: 'bg-slate-200 text-slate-800 ring-slate-300',
};

const GOV_STYLE: Record<GovernanceStatus, string> = {
  limpo: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  sujo: 'bg-rose-50 text-rose-800 ring-rose-200',
  limpeza: 'bg-amber-50 text-amber-900 ring-amber-200',
  inspecao: 'bg-violet-50 text-violet-800 ring-violet-200',
  manutencao: 'bg-orange-50 text-orange-900 ring-orange-200',
  interditado: 'bg-slate-200 text-slate-800 ring-slate-300',
};

const GOV_DOT: Record<GovernanceStatus, string> = {
  limpo: 'bg-emerald-500',
  sujo: 'bg-rose-500',
  limpeza: 'bg-amber-400',
  inspecao: 'bg-violet-500',
  manutencao: 'bg-orange-500',
  interditado: 'bg-slate-500',
};

export function GovernanceModule() {
  const {
    rooms,
    reservations,
    roomLogs,
    updateGovernance,
    assignHousekeeper,
    setRoomNotes,
    setDnd,
    blockRoom,
    unblockRoom,
  } = usePms();

  const [filterGov, setFilterGov] = useState<GovernanceStatus | 'todos'>('todos');
  const [filterOcc, setFilterOcc] = useState<OccupancyStatus | 'todos'>('todos');
  const [floor, setFloor] = useState<string>('todos');
  const [block, setBlock] = useState<string>('todos');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkGov, setBulkGov] = useState<GovernanceStatus>('limpo');
  const [bulkHk, setBulkHk] = useState<string>('');
  const [showHistory, setShowHistory] = useState(false);
  const [historyRoom, setHistoryRoom] = useState<string | 'all'>('all');

  const floors = useMemo(
    () => Array.from(new Set(rooms.map((r) => r.floor))).sort((a, b) => a - b),
    [rooms]
  );
  const blocks = useMemo(
    () =>
      Array.from(new Set(rooms.map((r) => r.block || '—'))).sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
      ),
    [rooms]
  );

  const list = useMemo(() => {
    let rows = [...rooms].sort((a, b) =>
      a.number.localeCompare(b.number, 'pt-BR', { numeric: true })
    );
    if (filterGov !== 'todos') rows = rows.filter((r) => r.governance === filterGov);
    if (filterOcc !== 'todos') rows = rows.filter((r) => r.occupancy === filterOcc);
    if (floor !== 'todos') rows = rows.filter((r) => String(r.floor) === floor);
    if (block !== 'todos') rows = rows.filter((r) => (r.block || '—') === block);
    return rows;
  }, [rooms, filterGov, filterOcc, floor, block]);

  const govCounts = useMemo(() => {
    const c: Partial<Record<GovernanceStatus, number>> = {};
    for (const r of rooms) c[r.governance] = (c[r.governance] || 0) + 1;
    return c;
  }, [rooms]);

  const occCounts = useMemo(() => {
    const c: Partial<Record<OccupancyStatus, number>> = {};
    for (const r of rooms) c[r.occupancy] = (c[r.occupancy] || 0) + 1;
    return c;
  }, [rooms]);

  const guestInRoom = (roomId: string) =>
    reservations.find((r) => r.roomId === roomId && r.status === 'checkin');

  const selectable = list.filter((r) => r.occupancy !== 'ocupado');
  const allSelectableOn =
    selectable.length > 0 && selectable.every((r) => selected.has(r.id));
  const someSelected = list.some((r) => selected.has(r.id));

  const toggleOne = (id: string) => {
    const room = rooms.find((r) => r.id === id);
    if (room?.occupancy === 'ocupado') {
      toast.message('UH ocupada: só muda no check-out');
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelectableOn) for (const r of selectable) next.delete(r.id);
      else for (const r of selectable) next.add(r.id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const applyBulkGov = () => {
    if (selected.size === 0) {
      toast.error('Selecione pelo menos uma UH');
      return;
    }
    let notes: string | undefined;
    if (bulkGov === 'interditado' || bulkGov === 'manutencao') {
      notes = window.prompt('Motivo (opcional):') || undefined;
    }
    const res = updateGovernance([...selected], bulkGov, notes);
    if (res.ok > 0) toast.success(res.message);
    else toast.error(res.message);
    clearSelection();
  };

  const applyBulkHk = () => {
    if (selected.size === 0) {
      toast.error('Selecione pelo menos uma UH');
      return;
    }
    assignHousekeeper([...selected], bulkHk || undefined);
    toast.success(
      bulkHk
        ? `Camareira ${bulkHk} em ${selected.size} UH(s)`
        : `Camareira removida de ${selected.size} UH(s)`
    );
    clearSelection();
  };

  const logsFiltered = useMemo(() => {
    if (historyRoom === 'all') return roomLogs;
    return roomLogs.filter((l) => l.roomId === historyRoom);
  }, [roomLogs, historyRoom]);

  return (
    <div className="space-y-5">
      {/* Contadores ocupação */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-2">
          Status de ocupação
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(['livre', 'ocupado', 'bloqueado'] as OccupancyStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterOcc(filterOcc === s ? 'todos' : s)}
              className={cn(
                'rounded-xl border bg-white px-3 py-2.5 text-left shadow-sm',
                filterOcc === s && 'ring-2 ring-indigo-500'
              )}
            >
              <p className="text-[10px] font-semibold uppercase text-slate-400">
                {OCCUPANCY_LABEL[s]}
              </p>
              <p className="text-xl font-semibold tabular-nums">{occCounts[s] || 0}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Contadores governança */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-2">
          Status de governança
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {GOVERNANCE_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterGov(filterGov === s ? 'todos' : s)}
              className={cn(
                'rounded-xl border bg-white px-3 py-2.5 text-left shadow-sm',
                filterGov === s && 'ring-2 ring-indigo-500'
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', GOV_DOT[s])} />
                <p className="text-[10px] font-semibold uppercase text-slate-400">
                  {GOVERNANCE_LABEL[s]}
                </p>
              </div>
              <p className="mt-1 text-xl font-semibold tabular-nums">{govCounts[s] || 0}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={block}
          onChange={(e) => setBlock(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px]"
        >
          <option value="todos">Todos os blocos</option>
          {blocks.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
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
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[13px] inline-flex items-center gap-1.5 hover:bg-slate-50"
        >
          <History className="w-3.5 h-3.5" />
          {showHistory ? 'Ocultar histórico' : 'Histórico de status'}
        </button>
        <p className="text-[12px] text-slate-500 ml-auto">{list.length} UH(s)</p>
      </div>

      {/* Barra lote */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 shadow-sm">
          <p className="text-[13px] font-semibold text-indigo-900 mr-1">
            {selected.size} selecionada(s)
          </p>
          <select
            value={bulkGov}
            onChange={(e) => setBulkGov(e.target.value as GovernanceStatus)}
            className="h-9 rounded-lg border border-indigo-200 bg-white px-2 text-[13px]"
          >
            {GOVERNANCE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {GOVERNANCE_LABEL[s]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={applyBulkGov}
            className="h-9 px-3 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-500"
          >
            Aplicar governança
          </button>
          <select
            value={bulkHk}
            onChange={(e) => setBulkHk(e.target.value)}
            className="h-9 rounded-lg border border-indigo-200 bg-white px-2 text-[13px]"
          >
            <option value="">— Camareira —</option>
            {HOUSEKEEPERS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={applyBulkHk}
            className="h-9 px-3 rounded-lg border border-indigo-200 bg-white text-[13px] font-medium text-indigo-900 hover:bg-indigo-100"
          >
            Atribuir camareira
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="h-9 px-3 rounded-lg text-[13px] text-indigo-800 inline-flex items-center gap-1 ml-auto"
          >
            <X className="w-3.5 h-3.5" /> Limpar
          </button>
        </div>
      )}

      {/* Histórico */}
      {showHistory && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold">Histórico de alterações</p>
            <select
              value={historyRoom}
              onChange={(e) => setHistoryRoom(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 text-[12px] px-2 ml-auto"
            >
              <option value="all">Todas as UHs</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number}
                </option>
              ))}
            </select>
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
            {logsFiltered.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-slate-400">
                Nenhuma alteração registrada nesta sessão
              </p>
            ) : (
              logsFiltered.slice(0, 40).map((l) => (
                <div key={l.id} className="px-4 py-2 text-[12px] flex flex-wrap gap-x-3 gap-y-0.5">
                  <span className="tabular-nums text-slate-400 w-[110px] shrink-0">{l.at}</span>
                  <span className="font-semibold w-14">{l.roomNumber}</span>
                  <span className="text-slate-500">{l.user}</span>
                  {l.occupancy && (
                    <span className="text-blue-700">Ocup: {OCCUPANCY_LABEL[l.occupancy]}</span>
                  )}
                  {l.governance && (
                    <span className="text-violet-700">Gov: {GOVERNANCE_LABEL[l.governance]}</span>
                  )}
                  {l.note && <span className="text-slate-600 truncate">{l.note}</span>}
                  <span className="text-[10px] uppercase text-slate-400 ml-auto">{l.source}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-slate-400 border-b border-slate-100 bg-slate-50/80">
                <th className="px-3 py-2.5 w-10">
                  <button type="button" onClick={toggleAll} className="text-slate-500">
                    {allSelectableOn ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : someSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="px-2 py-2.5 font-semibold">UH</th>
                <th className="px-2 py-2.5 font-semibold">Tipo</th>
                <th className="px-2 py-2.5 font-semibold">Bloco</th>
                <th className="px-2 py-2.5 font-semibold">Ocupação</th>
                <th className="px-2 py-2.5 font-semibold">Governança</th>
                <th className="px-2 py-2.5 font-semibold">Camareira</th>
                <th className="px-2 py-2.5 font-semibold">Hóspede / Obs.</th>
                <th className="px-2 py-2.5 font-semibold">NDP</th>
                <th className="px-3 py-2.5 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {list.map((room) => {
                const guest = guestInRoom(room.id);
                const isOn = selected.has(room.id);
                const locked = room.occupancy === 'ocupado';
                return (
                  <tr
                    key={room.id}
                    className={cn(isOn ? 'bg-indigo-50/70' : 'hover:bg-slate-50/80')}
                  >
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => toggleOne(room.id)}
                        className={cn(locked && 'opacity-30 cursor-not-allowed')}
                      >
                        {isOn ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-2 py-2 font-semibold tabular-nums">{room.number}</td>
                    <td className="px-2 py-2 text-slate-600">{room.type}</td>
                    <td className="px-2 py-2 text-slate-500 text-[12px]">
                      {room.block || '—'} · {room.floor === 0 ? 'Térreo' : `${room.floor}º`}
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={cn(
                          'inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                          OCC_STYLE[room.occupancy]
                        )}
                      >
                        {OCCUPANCY_LABEL[room.occupancy]}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      {locked ? (
                        <span
                          className={cn(
                            'inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                            GOV_STYLE[room.governance]
                          )}
                        >
                          {GOVERNANCE_LABEL[room.governance]}
                        </span>
                      ) : (
                        <select
                          value={room.governance}
                          onChange={(e) => {
                            const g = e.target.value as GovernanceStatus;
                            let notes: string | undefined;
                            if (g === 'interditado' || g === 'manutencao') {
                              notes = window.prompt('Motivo (opcional):') || undefined;
                            }
                            const res = updateGovernance([room.id], g, notes);
                            if (res.ok) toast.success(GOVERNANCE_LABEL[g]);
                            else toast.error(res.message);
                          }}
                          className="h-8 rounded-lg border border-slate-200 text-[12px] px-1.5 max-w-[120px]"
                        >
                          {GOVERNANCE_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {GOVERNANCE_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={room.housekeeper || ''}
                        disabled={locked}
                        onChange={(e) =>
                          assignHousekeeper([room.id], e.target.value || undefined)
                        }
                        className="h-8 rounded-lg border border-slate-200 text-[12px] px-1.5 max-w-[130px] disabled:opacity-50"
                      >
                        <option value="">—</option>
                        {HOUSEKEEPERS.map((h) => (
                          <option key={h} value={h}>
                            {h.split(' ')[0]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2 text-slate-500 max-w-[160px] truncate text-[12px]">
                      {guest ? guest.guestName : room.notes || '—'}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!guest && !locked) {
                            toast.message('NDP costuma aplicar em UH ocupada');
                          }
                          setDnd(room.id, !room.dnd);
                          toast.success(room.dnd ? 'NDP desativado' : 'Não perturbe ativo');
                        }}
                        className={cn(
                          'h-7 px-2 rounded-md text-[11px] font-semibold',
                          room.dnd
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-500'
                        )}
                      >
                        {room.dnd ? 'NDP' : '—'}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const n = window.prompt('Observação da UH:', room.notes || '');
                            if (n !== null) {
                              setRoomNotes(room.id, n);
                              toast.success('Observação salva');
                            }
                          }}
                          className="h-7 px-2 rounded-md border border-slate-200 text-[11px] hover:bg-slate-50"
                        >
                          Obs.
                        </button>
                        {room.occupancy === 'bloqueado' ? (
                          <button
                            type="button"
                            onClick={() => {
                              const res = unblockRoom(room.id);
                              if (res.ok) toast.success(res.message);
                              else toast.error(res.message);
                            }}
                            className="h-7 px-2 rounded-md border border-slate-200 text-[11px] hover:bg-slate-50"
                          >
                            Desbloq.
                          </button>
                        ) : (
                          !locked && (
                            <button
                              type="button"
                              onClick={() => {
                                const reason =
                                  window.prompt('Motivo do bloqueio:') || 'Bloqueio manual';
                                const res = blockRoom(room.id, reason);
                                if (res.ok) toast.success(res.message);
                                else toast.error(res.message);
                              }}
                              className="h-7 px-2 rounded-md border border-slate-200 text-[11px] hover:bg-slate-50"
                            >
                              Bloquear
                            </button>
                          )
                        )}
                        {locked && (
                          <span className="text-[11px] text-slate-400 italic self-center">
                            check-out
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[12px] text-slate-500">
        <strong>Ocupação</strong> (Livre / Ocupado / Bloqueado) é independente da{' '}
        <strong>Governança</strong> (Limpo, Sujo, Limpeza…). Ocupado só no check-in; no check-out a UH
        fica Livre + Suja. Interdição/manutenção também bloqueia a UH comercialmente.
      </p>
    </div>
  );
}
