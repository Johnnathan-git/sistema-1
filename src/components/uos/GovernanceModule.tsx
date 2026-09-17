import { useMemo, useState } from 'react';
import { GOVERNANCE_STATUSES, usePms } from '@/lib/pms-store';
import {
  formatDateBR,
  GOVERNANCE_LABEL,
  OCCUPANCY_LABEL,
  type GovernanceStatus,
  type OccupancyStatus,
} from '@/lib/pms-types';
import { cn } from '@/lib/utils';
import { Ban, CheckSquare, Eraser, Square, X } from 'lucide-react';
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
    updateGovernance,
    setRoomNotes,
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
  /** Só lista após clicar em Iniciar pesquisa */
  const [searched, setSearched] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkGov, setBulkGov] = useState<GovernanceStatus>('limpo');
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockAction, setBlockAction] = useState<'bloquear' | 'desbloquear'>('bloquear');
  const [blockReason, setBlockReason] = useState('');
  const [blockObs, setBlockObs] = useState('');
  const [blockFrom, setBlockFrom] = useState('');
  const [blockTo, setBlockTo] = useState('');

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
    if (!searched) return [] as typeof rooms;
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
  }, [rooms, searched, fNumber, fBlock, fFloor, fType, fGov, fOcc, fBlocked, fDnd]);

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
    setSearched(false);
    clearSelection();
  };

  const runSearch = () => {
    setSearched(true);
    clearSelection();
  };

  const applyBulkGov = () => {
    if (selected.size === 0) {
      toast.error('Selecione pelo menos uma UH na lista');
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

  const clearObs = () => {
    if (selected.size === 0) {
      toast.error('Selecione pelo menos uma UH');
      return;
    }
    for (const id of selected) setRoomNotes(id, '');
    toast.success(`Observação limpa em ${selected.size} UH(s)`);
    clearSelection();
  };

  const openBlockManager = () => {
    if (selected.size === 0) {
      toast.error('Selecione pelo menos uma UH');
      return;
    }
    const first = rooms.find((r) => selected.has(r.id));
    setBlockAction(first?.occupancy === 'bloqueado' ? 'desbloquear' : 'bloquear');
    setBlockReason(first?.blockedReason || '');
    setBlockObs(first?.notes || '');
    setBlockFrom('');
    setBlockTo('');
    setBlockOpen(true);
  };

  const confirmBlockManager = () => {
    if (selected.size === 0) return;
    let ok = 0;
    for (const id of selected) {
      if (blockAction === 'bloquear') {
        const period =
          blockFrom || blockTo
            ? ` · ${blockFrom ? formatDateBR(blockFrom) : '…'} a ${blockTo ? formatDateBR(blockTo) : '…'}`
            : '';
        const reason = (blockReason.trim() || 'Bloqueio operacional') + period;
        const r = blockRoom(id, reason);
        if (r.ok) ok++;
      } else {
        const r = unblockRoom(id);
        if (r.ok) ok++;
      }
      if (blockObs.trim() !== '') setRoomNotes(id, blockObs.trim());
    }
    toast.success(
      blockAction === 'bloquear'
        ? `${ok} UH(s) bloqueada(s)`
        : `${ok} UH(s) desbloqueada(s)`
    );
    setBlockOpen(false);
    clearSelection();
  };

  return (
    <div className="space-y-3">
      {/* Toolbar — só o que foi pedido */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex items-center gap-1.5">
          <select
            value={bulkGov}
            onChange={(e) => setBulkGov(e.target.value as GovernanceStatus)}
            className="h-8 rounded-lg border border-slate-200 text-[12px] px-2 bg-white"
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
            className="h-8 px-3 rounded-lg bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-500"
          >
            Alterar status de UH
          </button>
        </div>
        <button
          type="button"
          onClick={openBlockManager}
          className="h-8 px-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-[12px] font-medium inline-flex items-center gap-1.5 hover:bg-amber-100"
        >
          <Ban className="w-3.5 h-3.5" /> Gerenciar bloqueio
        </button>
        <button
          type="button"
          onClick={clearObs}
          className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-[12px] font-medium inline-flex items-center gap-1.5 hover:bg-slate-50"
        >
          <Eraser className="w-3.5 h-3.5" /> Limpar observação
        </button>
        <span className="ml-auto text-[12px] text-slate-500 tabular-nums">
          {searched ? `${list.length} item(ns) encontrado(s)` : 'Informe os filtros e inicie a pesquisa'}
          {selected.size > 0 ? ` · ${selected.size} selecionada(s)` : ''}
        </span>
      </div>

      {/* Modal Gerenciar bloqueio */}
      {blockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div>
                <p className="text-[15px] font-semibold text-slate-900">Gerenciar bloqueio</p>
                <p className="text-[12px] text-slate-500">{selected.size} UH(s) selecionada(s)</p>
              </div>
              <button
                type="button"
                onClick={() => setBlockOpen(false)}
                className="h-8 w-8 rounded-lg hover:bg-slate-100 inline-flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-[13px]">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setBlockAction('bloquear')}
                  className={cn(
                    'flex-1 h-9 rounded-lg border text-[12px] font-semibold',
                    blockAction === 'bloquear'
                      ? 'border-amber-300 bg-amber-50 text-amber-900'
                      : 'border-slate-200 bg-white text-slate-600'
                  )}
                >
                  Bloquear
                </button>
                <button
                  type="button"
                  onClick={() => setBlockAction('desbloquear')}
                  className={cn(
                    'flex-1 h-9 rounded-lg border text-[12px] font-semibold',
                    blockAction === 'desbloquear'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 bg-white text-slate-600'
                  )}
                >
                  Desbloquear
                </button>
              </div>
              {blockAction === 'bloquear' && (
                <>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-semibold uppercase text-slate-400">
                      Motivo / descrição do bloqueio
                    </span>
                    <input
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      placeholder="Ex.: Pintura das unidades"
                      className="w-full h-9 rounded-lg border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block space-y-1">
                      <span className="text-[11px] font-semibold uppercase text-slate-400">
                        Período de
                      </span>
                      <input
                        type="date"
                        value={blockFrom}
                        onChange={(e) => setBlockFrom(e.target.value)}
                        className="w-full h-9 rounded-lg border border-slate-200 px-2 bg-white"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[11px] font-semibold uppercase text-slate-400">
                        Período até
                      </span>
                      <input
                        type="date"
                        value={blockTo}
                        onChange={(e) => setBlockTo(e.target.value)}
                        className="w-full h-9 rounded-lg border border-slate-200 px-2 bg-white"
                      />
                    </label>
                  </div>
                </>
              )}
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold uppercase text-slate-400">
                  Observação da UH
                </span>
                <textarea
                  value={blockObs}
                  onChange={(e) => setBlockObs(e.target.value)}
                  rows={3}
                  placeholder="Observação (opcional)"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                onClick={() => setBlockOpen(false)}
                className="h-9 px-4 rounded-lg border border-slate-200 text-[13px] font-medium hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmBlockManager}
                className="h-9 px-4 rounded-lg bg-blue-600 text-white text-[13px] font-semibold hover:bg-blue-500"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3 items-start">
        {/* Painel de pesquisa */}
        <aside className="w-[240px] shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Opções de pesquisa
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Preencha e clique em Iniciar pesquisa
            </p>
          </div>
          <div className="p-3 space-y-2.5 text-[12px]">
            <label className="block space-y-0.5">
              <span className="text-[10px] uppercase text-slate-400 font-semibold">UH</span>
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
                <option value="">Qualquer um</option>
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
                <option value="">Qualquer um</option>
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
                <option value="">Qualquer um</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-0.5">
              <span className="text-[10px] uppercase text-slate-400 font-semibold">
                Status da governança
              </span>
              <select
                value={fGov}
                onChange={(e) => setFGov(e.target.value as GovernanceStatus | '')}
                className="w-full h-8 rounded-lg border border-slate-200 px-2 bg-white"
              >
                <option value="">Qualquer um</option>
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
                <option value="">Qualquer um</option>
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
                <option value="">Qualquer um</option>
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
                <option value="">Qualquer um</option>
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
            </div>
          </div>
        </aside>

        {/* Tabela */}
        <div className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-260px)]">
            <table className="w-full text-[12px] min-w-max">
              <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="px-3 py-2.5 w-10">
                    <button type="button" onClick={toggleAll} className="text-slate-500" disabled={!searched}>
                      {allSelectableOn ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : someSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-2 py-2.5 font-semibold">UH</th>
                  <th className="px-2 py-2.5 font-semibold">Tipo de UH</th>
                  <th className="px-2 py-2.5 font-semibold">Status ocupação</th>
                  <th className="px-2 py-2.5 font-semibold">Status governança</th>
                  <th className="px-2 py-2.5 font-semibold">Bloqueio</th>
                  <th className="px-2 py-2.5 font-semibold">Descrição bloqueio</th>
                  <th className="px-2 py-2.5 font-semibold">Observação UH</th>
                  <th className="px-2 py-2.5 font-semibold">Check-in</th>
                  <th className="px-2 py-2.5 font-semibold">Check-out</th>
                  <th className="px-2 py-2.5 font-semibold">Andar</th>
                  <th className="px-2 py-2.5 font-semibold">Bloco</th>
                  <th className="px-2 py-2.5 font-semibold">Hóspede princ.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {!searched ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-20 text-center text-slate-400">
                      Informe os parâmetros de pesquisa e clique em <strong>Iniciar pesquisa</strong>.
                    </td>
                  </tr>
                ) : list.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-16 text-center text-slate-400">
                      0 itens encontrados de acordo com o critério de pesquisa.
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
                        <td className="px-2 py-2">
                          <span
                            className={cn(
                              'inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                              GOV_STYLE[room.governance]
                            )}
                          >
                            {GOVERNANCE_LABEL[room.governance]}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          {room.occupancy === 'bloqueado' ? (
                            <span className="text-amber-700 font-semibold">Sim</span>
                          ) : (
                            <span className="text-slate-400">Não</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-slate-500 max-w-[160px] truncate">
                          {room.occupancy === 'bloqueado'
                            ? room.blockedReason || '—'
                            : '—'}
                        </td>
                        <td className="px-2 py-2 text-slate-500 max-w-[140px] truncate">
                          {room.notes || '—'}
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
  );
}
