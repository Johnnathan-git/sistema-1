import { useMemo, useState } from 'react';
import { GOVERNANCE_STATUSES, usePms } from '@/lib/pms-store';
import {
  formatDateBR,
  GOVERNANCE_LABEL,
  HOUSEKEEPERS,
  OCCUPANCY_LABEL,
  type GovernanceStatus,
  type OccupancyStatus,
} from '@/lib/pms-types';
import { cn } from '@/lib/utils';
import {
  Ban,
  CheckSquare,
  History,
  LayoutGrid,
  Printer,
  RefreshCw,
  Search,
  Square,
  UserMinus,
  UserPlus,
} from 'lucide-react';
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

  const [fNumber, setFNumber] = useState('');
  const [fBlock, setFBlock] = useState('');
  const [fFloor, setFFloor] = useState('');
  const [fType, setFType] = useState('');
  const [fGov, setFGov] = useState<GovernanceStatus | ''>('');
  const [fOcc, setFOcc] = useState<OccupancyStatus | ''>('');
  const [fBlocked, setFBlocked] = useState('');
  const [fDnd, setFDnd] = useState('');
  const [applied, setApplied] = useState(true);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkGov, setBulkGov] = useState<GovernanceStatus>('limpo');
  const [bulkHk, setBulkHk] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [historyRoom, setHistoryRoom] = useState<string | 'all'>('all');
  const [showChart, setShowChart] = useState(false);

  const floors = useMemo(
    () => Array.from(new Set(rooms.map((r) => r.floor))).sort((a, b) => a - b),
    [rooms]
  );
  const blocks = useMemo(
    () =>
      Array.from(new Set(rooms.map((r) => r.block || '').filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
      ),
    [rooms]
  );
  const types = useMemo(
    () => Array.from(new Set(rooms.map((r) => r.type))).sort(),
    [rooms]
  );

  const guestInRoom = (roomId: string) =>
    reservations.find((r) => r.roomId === roomId && r.status === 'checkin');

  const list = useMemo(() => {
    if (!applied) return [] as typeof rooms;
    let rows = [...rooms].sort((a, b) =>
      a.number.localeCompare(b.number, 'pt-BR', { numeric: true })
    );
    if (fNumber.trim()) {
      const q = fNumber.trim().toLowerCase();
      rows = rows.filter((r) => r.number.toLowerCase().includes(q));
    }
    if (fBlock) rows = rows.filter((r) => r.block === fBlock);
    if (fFloor !== '') rows = rows.filter((r) => String(r.floor) === fFloor);
    if (fType) rows = rows.filter((r) => r.type === fType);
    if (fGov) rows = rows.filter((r) => r.governance === fGov);
    if (fOcc) rows = rows.filter((r) => r.occupancy === fOcc);
    if (fBlocked === 'sim') rows = rows.filter((r) => r.occupancy === 'bloqueado');
    if (fBlocked === 'nao') rows = rows.filter((r) => r.occupancy !== 'bloqueado');
    if (fDnd === 'sim') rows = rows.filter((r) => !!r.dnd);
    if (fDnd === 'nao') rows = rows.filter((r) => !r.dnd);
    return rows;
  }, [rooms, applied, fNumber, fBlock, fFloor, fType, fGov, fOcc, fBlocked, fDnd]);

  const selectable = list.filter((r) => r.occupancy !== 'ocupado');
  const allSelectableOn =
    selectable.length > 0 && selectable.every((r) => selected.has(r.id));
  const someSelected = list.some((r) => selected.has(r.id));

  const toggleOne = (id: string) => {
    const room = rooms.find((r) => r.id === id);
    if (room?.occupancy === 'ocupado') {
      toast.message('UH ocupada: status de governança só muda no check-out');
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

  const clearSearch = () => {
    setFNumber('');
    setFBlock('');
    setFFloor('');
    setFType('');
    setFGov('');
    setFOcc('');
    setFBlocked('');
    setFDnd('');
    setApplied(true);
    clearSelection();
    toast.message('Pesquisa limpa');
  };

  const runSearch = () => {
    setApplied(true);
    clearSelection();
    toast.success('Pesquisa aplicada');
  };

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

  const applyBlock = () => {
    if (selected.size === 0) {
      toast.error('Selecione pelo menos uma UH');
      return;
    }
    const reason = window.prompt('Motivo do bloqueio:') || 'Bloqueio operacional';
    let ok = 0;
    for (const id of selected) {
      const r = blockRoom(id, reason);
      if (r.ok) ok++;
    }
    toast.success(`${ok} UH(s) bloqueada(s)`);
    clearSelection();
  };

  const applyUnblock = () => {
    if (selected.size === 0) {
      toast.error('Selecione pelo menos uma UH');
      return;
    }
    let ok = 0;
    for (const id of selected) {
      const r = unblockRoom(id);
      if (r.ok) ok++;
    }
    toast.success(`${ok} UH(s) desbloqueada(s)`);
    clearSelection();
  };

  const toggleDndSelected = () => {
    if (selected.size === 0) {
      toast.error('Selecione pelo menos uma UH');
      return;
    }
    for (const id of selected) {
      const room = rooms.find((r) => r.id === id);
      if (room) setDnd(id, !room.dnd);
    }
    toast.success('Não perturbe atualizado');
    clearSelection();
  };

  const logsFiltered = useMemo(() => {
    if (historyRoom === 'all') return roomLogs;
    return roomLogs.filter((l) => l.roomId === historyRoom);
  }, [roomLogs, historyRoom]);

  return (
    <div className="space-y-3">
      {/* Toolbar de ações — padrão eSolution */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <button
          type="button"
          onClick={runSearch}
          className="h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-[12px] font-medium inline-flex items-center gap-1.5 hover:bg-slate-100"
        >
          <Search className="w-3.5 h-3.5" /> Localizar
        </button>
        <button
          type="button"
          onClick={() => {
            window.print();
            toast.message('Enviando para impressão…');
          }}
          className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] font-medium inline-flex items-center gap-1.5 hover:bg-slate-50"
        >
          <Printer className="w-3.5 h-3.5" /> Imprimir
        </button>
        <span className="w-px h-5 bg-slate-200 mx-1" />
        <div className="flex items-center gap-1.5">
          <select
            value={bulkGov}
            onChange={(e) => setBulkGov(e.target.value as GovernanceStatus)}
            className="h-8 rounded-lg border border-slate-200 text-[12px] px-2 bg-white"
            title="Status de governança"
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
            className="h-8 px-2.5 rounded-lg bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-500"
          >
            Alterar status
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={bulkHk}
            onChange={(e) => setBulkHk(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 text-[12px] px-2 bg-white"
          >
            <option value="">Camareira</option>
            {HOUSEKEEPERS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={applyBulkHk}
            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] font-medium inline-flex items-center gap-1 hover:bg-slate-50"
          >
            <UserPlus className="w-3.5 h-3.5" /> Atribuir
          </button>
          <button
            type="button"
            onClick={() => {
              setBulkHk('');
              applyBulkHk();
            }}
            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] font-medium inline-flex items-center gap-1 hover:bg-slate-50"
          >
            <UserMinus className="w-3.5 h-3.5" /> Desvincular
          </button>
        </div>
        <span className="w-px h-5 bg-slate-200 mx-1" />
        <button
          type="button"
          onClick={applyBlock}
          className="h-8 px-2.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-[12px] font-medium inline-flex items-center gap-1 hover:bg-amber-100"
        >
          <Ban className="w-3.5 h-3.5" /> Bloquear
        </button>
        <button
          type="button"
          onClick={applyUnblock}
          className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] font-medium hover:bg-slate-50"
        >
          Desbloquear
        </button>
        <button
          type="button"
          onClick={toggleDndSelected}
          className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] font-medium hover:bg-slate-50"
        >
          Não perturbe
        </button>
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className={cn(
            'h-8 px-2.5 rounded-lg border text-[12px] font-medium inline-flex items-center gap-1',
            showHistory
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          )}
        >
          <History className="w-3.5 h-3.5" /> Histórico
        </button>
        <button
          type="button"
          onClick={() => setShowChart((v) => !v)}
          className={cn(
            'h-8 px-2.5 rounded-lg border text-[12px] font-medium inline-flex items-center gap-1',
            showChart
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          )}
        >
          <LayoutGrid className="w-3.5 h-3.5" /> Chart
        </button>
        <span className="ml-auto text-[12px] text-slate-500 tabular-nums">
          {list.length} UH(s) · {selected.size} selecionada(s)
        </span>
      </div>

      <div className="flex gap-3 items-start">
        {/* Painel de pesquisa — esquerda */}
        <aside className="w-[240px] shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Opções de pesquisa
            </p>
          </div>
          <div className="p-3 space-y-2.5 text-[12px]">
            <label className="block space-y-0.5">
              <span className="text-[10px] uppercase text-slate-400 font-semibold">Número</span>
              <input
                value={fNumber}
                onChange={(e) => setFNumber(e.target.value)}
                placeholder="Contém…"
                className="w-full h-8 rounded-lg border border-slate-200 px-2 outline-none focus:ring-1 focus:ring-blue-400"
              />
            </label>
            <label className="block space-y-0.5">
              <span className="text-[10px] uppercase text-slate-400 font-semibold">Bloco</span>
              <select
                value={fBlock}
                onChange={(e) => setFBlock(e.target.value)}
                className="w-full h-8 rounded-lg border border-slate-200 px-2 bg-white"
              >
                <option value="">Todos</option>
                {blocks.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-0.5">
              <span className="text-[10px] uppercase text-slate-400 font-semibold">Andar</span>
              <select
                value={fFloor}
                onChange={(e) => setFFloor(e.target.value)}
                className="w-full h-8 rounded-lg border border-slate-200 px-2 bg-white"
              >
                <option value="">Todos</option>
                {floors.map((f) => (
                  <option key={f} value={String(f)}>
                    {f === 0 ? 'Térreo' : `${f}º`}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-0.5">
              <span className="text-[10px] uppercase text-slate-400 font-semibold">Tipo de UH</span>
              <select
                value={fType}
                onChange={(e) => setFType(e.target.value)}
                className="w-full h-8 rounded-lg border border-slate-200 px-2 bg-white"
              >
                <option value="">Todos</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-0.5">
              <span className="text-[10px] uppercase text-slate-400 font-semibold">
                Status governança
              </span>
              <select
                value={fGov}
                onChange={(e) => setFGov(e.target.value as GovernanceStatus | '')}
                className="w-full h-8 rounded-lg border border-slate-200 px-2 bg-white"
              >
                <option value="">Todos</option>
                {GOVERNANCE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {GOVERNANCE_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-0.5">
              <span className="text-[10px] uppercase text-slate-400 font-semibold">Status da UH</span>
              <select
                value={fOcc}
                onChange={(e) => setFOcc(e.target.value as OccupancyStatus | '')}
                className="w-full h-8 rounded-lg border border-slate-200 px-2 bg-white"
              >
                <option value="">Todos</option>
                <option value="livre">Livre / Vago</option>
                <option value="ocupado">Ocupado</option>
                <option value="bloqueado">Bloqueado</option>
              </select>
            </label>
            <label className="block space-y-0.5">
              <span className="text-[10px] uppercase text-slate-400 font-semibold">Bloqueado</span>
              <select
                value={fBlocked}
                onChange={(e) => setFBlocked(e.target.value)}
                className="w-full h-8 rounded-lg border border-slate-200 px-2 bg-white"
              >
                <option value="">Todos</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </label>
            <label className="block space-y-0.5">
              <span className="text-[10px] uppercase text-slate-400 font-semibold">Não perturbe</span>
              <select
                value={fDnd}
                onChange={(e) => setFDnd(e.target.value)}
                className="w-full h-8 rounded-lg border border-slate-200 px-2 bg-white"
              >
                <option value="">Todos</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </label>
            <div className="pt-1 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={runSearch}
                className="h-9 rounded-lg bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-500"
              >
                Iniciar pesquisa
              </button>
              <button
                type="button"
                onClick={clearSearch}
                className="h-8 rounded-lg border border-slate-200 text-[12px] font-medium hover:bg-slate-50"
              >
                Limpar pesquisa
              </button>
              <button
                type="button"
                onClick={() => {
                  setApplied(true);
                  toast.success('Lista atualizada');
                }}
                className="h-8 rounded-lg border border-slate-200 text-[12px] font-medium inline-flex items-center justify-center gap-1.5 hover:bg-slate-50"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Atualizar
              </button>
            </div>
          </div>
        </aside>

        {/* Área principal */}
        <div className="flex-1 min-w-0 space-y-3">
          {showHistory && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 flex flex-wrap items-center gap-2">
                <p className="text-[13px] font-semibold">Histórico de alterações de status</p>
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
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-50">
                {logsFiltered.length === 0 ? (
                  <p className="px-4 py-8 text-center text-[13px] text-slate-400">
                    Nenhuma alteração registrada nesta sessão
                  </p>
                ) : (
                  logsFiltered.slice(0, 50).map((l) => (
                    <div
                      key={l.id}
                      className="px-4 py-2 text-[12px] flex flex-wrap gap-x-3 gap-y-0.5"
                    >
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

          {showChart && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[13px] font-semibold mb-3">Resumo por status de governança</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {GOVERNANCE_STATUSES.map((s) => {
                  const n = rooms.filter((r) => r.governance === s).length;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setFGov(s);
                        setApplied(true);
                      }}
                      className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-left hover:bg-slate-100"
                    >
                      <p className="text-[10px] uppercase text-slate-400 font-semibold">
                        {GOVERNANCE_LABEL[s]}
                      </p>
                      <p className="text-lg font-semibold tabular-nums">{n}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tabela de UHs */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
              <table className="w-full text-[12px] min-w-max">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="px-3 py-2.5 w-10">
                      <button type="button" onClick={toggleAll} className="text-slate-500">
                        {allSelectableOn ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : someSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-2 py-2.5 font-semibold">Número</th>
                    <th className="px-2 py-2.5 font-semibold">Tipo de UH</th>
                    <th className="px-2 py-2.5 font-semibold">Status ocupação</th>
                    <th className="px-2 py-2.5 font-semibold">Status governança</th>
                    <th className="px-2 py-2.5 font-semibold">Bloqueio</th>
                    <th className="px-2 py-2.5 font-semibold">Observação UH</th>
                    <th className="px-2 py-2.5 font-semibold">Check-in</th>
                    <th className="px-2 py-2.5 font-semibold">Check-out</th>
                    <th className="px-2 py-2.5 font-semibold">Andar</th>
                    <th className="px-2 py-2.5 font-semibold">Bloco</th>
                    <th className="px-2 py-2.5 font-semibold">Hóspede princ.</th>
                    <th className="px-2 py-2.5 font-semibold">Camareira</th>
                    <th className="px-2 py-2.5 font-semibold">NDP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {list.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="px-4 py-16 text-center text-slate-400">
                        Nenhum registro encontrado. Ajuste os filtros e clique em Iniciar pesquisa.
                      </td>
                    </tr>
                  ) : (
                    list.map((room) => {
                      const guest = guestInRoom(room.id);
                      const isOn = selected.has(room.id);
                      const locked = room.occupancy === 'ocupado';
                      return (
                        <tr
                          key={room.id}
                          onClick={() => !locked && toggleOne(room.id)}
                          className={cn(
                            'cursor-pointer',
                            isOn ? 'bg-blue-50' : 'hover:bg-slate-50',
                            locked && 'cursor-default'
                          )}
                        >
                          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              disabled={locked}
                              onClick={() => toggleOne(room.id)}
                              className={cn(locked && 'opacity-30 cursor-not-allowed')}
                            >
                              {isOn ? (
                                <CheckSquare className="w-4 h-4 text-blue-600" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400" />
                              )}
                            </button>
                          </td>
                          <td className="px-2 py-2 font-semibold tabular-nums">{room.number}</td>
                          <td className="px-2 py-2 text-slate-600">{room.type}</td>
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
                          <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
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
                                className="h-7 rounded-md border border-slate-200 text-[11px] px-1 max-w-[120px]"
                              >
                                {GOVERNANCE_STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {GOVERNANCE_LABEL[s]}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-2 py-2 text-slate-500 max-w-[120px] truncate">
                            {room.occupancy === 'bloqueado'
                              ? room.blockedReason || 'Bloqueado'
                              : '—'}
                          </td>
                          <td
                            className="px-2 py-2 text-slate-500 max-w-[140px] truncate"
                            onClick={(e) => e.stopPropagation()}
                            title={room.notes}
                          >
                            <button
                              type="button"
                              className="text-left hover:text-blue-600 truncate max-w-[140px]"
                              onClick={() => {
                                const n = window.prompt('Observação da UH:', room.notes || '');
                                if (n !== null) {
                                  setRoomNotes(room.id, n);
                                  toast.success('Observação salva');
                                }
                              }}
                            >
                              {room.notes || '—'}
                            </button>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-slate-600">
                            {guest ? formatDateBR(guest.checkIn) : '—'}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-slate-600">
                            {guest ? formatDateBR(guest.checkOut) : '—'}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            {room.floor === 0 ? 'Térreo' : `${room.floor}º`}
                          </td>
                          <td className="px-2 py-2 text-slate-600">{room.block || '—'}</td>
                          <td className="px-2 py-2 font-medium max-w-[160px] truncate">
                            {guest?.guestName || '—'}
                          </td>
                          <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={room.housekeeper || ''}
                              disabled={locked}
                              onChange={(e) =>
                                assignHousekeeper([room.id], e.target.value || undefined)
                              }
                              className="h-7 rounded-md border border-slate-200 text-[11px] px-1 max-w-[110px] disabled:opacity-50"
                            >
                              <option value="">—</option>
                              {HOUSEKEEPERS.map((h) => (
                                <option key={h} value={h}>
                                  {h.split(' ')[0]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            {room.dnd ? (
                              <span className="text-rose-600 font-semibold">S</span>
                            ) : (
                              <span className="text-slate-300">N</span>
                            )}
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
      </div>
    </div>
  );
}
