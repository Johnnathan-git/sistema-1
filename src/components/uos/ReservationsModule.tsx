import { useMemo, useState } from 'react';
import { usePms } from '@/lib/pms-store';
import {
  formatBRL,
  formatDateBR,
  RES_STATUS_LABEL,
  type Reservation,
  type Room,
  type RoomType,
} from '@/lib/pms-types';
import { cn } from '@/lib/utils';
import { FileText, Plus, Search, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';

const ROOM_TYPES: RoomType[] = [
  'Standard',
  'Superior',
  'Apartamento',
  'Chalé Master',
  'Bangalô',
  'Suite',
];

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function overlaps(aIn: string, aOut: string, bIn: string, bOut: string) {
  return aIn < bOut && aOut > bIn;
}

function activeReservation(r: Reservation) {
  return r.status !== 'cancelada' && r.status !== 'no_show' && r.status !== 'checkout';
}

function roomAvailable(
  room: Room,
  reservations: Reservation[],
  checkIn: string,
  checkOut: string,
  ignoreReservationId?: string,
) {
  if (room.occupancy === 'bloqueado') return false;
  if (room.governance === 'interditado' || room.governance === 'manutencao') return false;
  return !reservations.some(
    (r) =>
      r.id !== ignoreReservationId &&
      r.roomId === room.id &&
      activeReservation(r) &&
      overlaps(checkIn, checkOut, r.checkIn, r.checkOut),
  );
}

export function ReservationsModule() {
  const {
    hotel,
    reservations,
    rooms,
    upsertReservation,
    cancelReservation,
    markFnrh,
    setModule,
  } = usePms();
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const list = useMemo(() => {
    let rows = [...reservations].sort((a, b) => b.checkIn.localeCompare(a.checkIn));
    if (statusFilter !== 'todos') rows = rows.filter((r) => r.status === statusFilter);
    const query = q.trim().toLowerCase();
    if (query) {
      rows = rows.filter(
        (r) =>
          r.guestName.toLowerCase().includes(query) ||
          r.code.toLowerCase().includes(query) ||
          (r.roomNumber || '').toLowerCase().includes(query),
      );
    }
    return rows;
  }, [reservations, q, statusFilter]);

  const selected = reservations.find((r) => r.id === selectedId) || null;

  const saveReservation = (res: Reservation, created = false) => {
    const result = upsertReservation(res);
    if (!result.ok) {
      toast.error(result.message);
      return false;
    }
    if (created) {
      setCreating(false);
      setSelectedId(res.id);
      toast.success('Reserva criada e enviada para a operação');
    } else {
      toast.success('Reserva atualizada');
    }
    return true;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por hóspede, código ou UH"
            className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="todos">Todos os status</option>
            {Object.entries(RES_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setSelectedId(null);
            }}
            className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Nova reserva
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="px-4 py-2.5 font-semibold">Código</th>
                  <th className="px-4 py-2.5 font-semibold">Hóspede</th>
                  <th className="px-4 py-2.5 font-semibold">Período</th>
                  <th className="px-4 py-2.5 font-semibold">UH</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => {
                      setSelectedId(r.id);
                      setCreating(false);
                    }}
                    className={cn(
                      'border-b border-slate-50 cursor-pointer hover:bg-slate-50/80',
                      selectedId === r.id && 'bg-slate-50',
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                    <td className="px-4 py-3 font-medium">{r.guestName}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDateBR(r.checkIn)} → {formatDateBR(r.checkOut)}
                    </td>
                    <td className="px-4 py-3">{r.roomNumber || r.roomType}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 tabular-nums">{formatBRL(r.totalAmount)}</td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      Nenhuma reserva encontrada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-2">
          {creating ? (
            <ReservationForm
              rooms={rooms}
              reservations={reservations}
              operationalDate={hotel.operationalDate}
              onCancel={() => setCreating(false)}
              onSave={(res) => saveReservation(res, true)}
            />
          ) : selected ? (
            <ReservationDetail
              key={selected.id}
              res={selected}
              rooms={rooms}
              reservations={reservations}
              onSave={(res) => saveReservation(res)}
              onCancelRes={() => {
                if (selected.status === 'checkin') {
                  toast.error('Faça o check-out ou cancele o check-in pela Recepção antes de cancelar a reserva.');
                  return;
                }
                cancelReservation(selected.id);
                toast.message('Reserva cancelada');
              }}
              onFnrh={() => {
                markFnrh(selected.id);
                toast.success('FNRH marcada como preenchida');
              }}
              onOpenAccount={() => setModule('contas')}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400 text-sm">
              Selecione uma reserva ou crie uma nova
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Reservation['status'] }) {
  const tone: Record<string, string> = {
    confirmada: 'bg-slate-100 text-slate-700',
    pendente: 'bg-amber-50 text-amber-800',
    checkin: 'bg-emerald-50 text-emerald-700',
    checkout: 'bg-slate-100 text-slate-500',
    no_show: 'bg-rose-50 text-rose-700',
    cancelada: 'bg-rose-50 text-rose-600 line-through',
  };
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium', tone[status])}>
      {RES_STATUS_LABEL[status]}
    </span>
  );
}

function ReservationDetail({
  res,
  rooms,
  reservations,
  onSave,
  onCancelRes,
  onFnrh,
  onOpenAccount,
}: {
  res: Reservation;
  rooms: Room[];
  reservations: Reservation[];
  onSave: (r: Reservation) => boolean;
  onCancelRes: () => void;
  onFnrh: () => void;
  onOpenAccount: () => void;
}) {
  const [draft, setDraft] = useState(res);
  const canEditDates = draft.status !== 'checkin' && draft.status !== 'checkout' && draft.status !== 'cancelada';

  const availableRooms = useMemo(
    () =>
      rooms.filter(
        (room) =>
          room.type === draft.roomType &&
          roomAvailable(room, reservations, draft.checkIn, draft.checkOut, draft.id),
      ),
    [rooms, reservations, draft.roomType, draft.checkIn, draft.checkOut, draft.id],
  );

  const currentRoom = rooms.find((room) => room.id === draft.roomId);
  const roomOptions = currentRoom && !availableRooms.some((room) => room.id === currentRoom.id)
    ? [currentRoom, ...availableRooms]
    : availableRooms;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{draft.code}</p>
        <h3 className="text-lg font-semibold">{draft.guestName}</h3>
        <StatusBadge status={draft.status} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Check-in">
          <input
            type="date"
            value={draft.checkIn}
            disabled={!canEditDates}
            onChange={(e) => setDraft({ ...draft, checkIn: e.target.value })}
            className="field disabled:bg-slate-50"
          />
        </Field>
        <Field label="Check-out">
          <input
            type="date"
            value={draft.checkOut}
            disabled={!canEditDates}
            onChange={(e) => setDraft({ ...draft, checkOut: e.target.value })}
            className="field disabled:bg-slate-50"
          />
        </Field>
        <Field label="Adultos">
          <input
            type="number"
            min={1}
            value={draft.adults}
            onChange={(e) => setDraft({ ...draft, adults: Number(e.target.value) })}
            className="field"
          />
        </Field>
        <Field label="Crianças">
          <input
            type="number"
            min={0}
            value={draft.children}
            onChange={(e) => setDraft({ ...draft, children: Number(e.target.value) })}
            className="field"
          />
        </Field>
        <Field label="Tipo de UH">
          <select
            value={draft.roomType}
            disabled={!canEditDates}
            onChange={(e) => setDraft({ ...draft, roomType: e.target.value as RoomType, roomId: undefined, roomNumber: undefined })}
            className="field disabled:bg-slate-50"
          >
            {ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="UH atribuída">
          <select
            value={draft.roomId || ''}
            disabled={!canEditDates}
            onChange={(e) => {
              const room = rooms.find((r) => r.id === e.target.value);
              setDraft({ ...draft, roomId: room?.id, roomNumber: room?.number });
            }}
            className="field disabled:bg-slate-50"
          >
            <option value="">Sem UH</option>
            {roomOptions.map((r) => (
              <option key={r.id} value={r.id}>{r.number} · {r.type}</option>
            ))}
          </select>
        </Field>
        <Field label="Valor total">
          <input
            type="number"
            min={0}
            value={draft.totalAmount}
            onChange={(e) => setDraft({ ...draft, totalAmount: Number(e.target.value) })}
            className="field"
          />
        </Field>
        <Field label="Pago na reserva">
          <input
            type="number"
            min={0}
            value={draft.paidAmount}
            onChange={(e) => setDraft({ ...draft, paidAmount: Number(e.target.value) })}
            className="field"
          />
        </Field>
      </div>

      <Field label="Observações">
        <textarea
          value={draft.notes || ''}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          rows={2}
          className="field"
        />
      </Field>

      {canEditDates && availableRooms.length === 0 && !draft.roomId && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Não há UH disponível dessa categoria no período selecionado. A reserva pode ser salva sem UH e atribuída depois.
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => onSave(draft)}
          disabled={draft.status === 'cancelada' || draft.status === 'checkout'}
          className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-40"
        >
          Salvar alterações
        </button>
        <button
          type="button"
          onClick={onFnrh}
          disabled={draft.status === 'cancelada' || draft.status === 'checkout'}
          className="h-9 px-3 rounded-lg border border-slate-200 text-sm inline-flex items-center gap-1.5 hover:bg-slate-50 disabled:opacity-40"
        >
          <FileText className="w-3.5 h-3.5" />
          {draft.fnrhFilled ? 'FNRH OK' : 'Marcar FNRH'}
        </button>
        {draft.status === 'checkin' ? (
          <button
            type="button"
            onClick={onOpenAccount}
            className="h-9 px-3 rounded-lg border border-slate-200 text-sm inline-flex items-center gap-1.5 hover:bg-slate-50"
          >
            <UserRound className="w-3.5 h-3.5" /> Conta do hóspede
          </button>
        ) : (
          <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-500">
            Conta disponível após o check-in
          </span>
        )}
        {draft.status !== 'cancelada' && draft.status !== 'checkout' && draft.status !== 'checkin' && (
          <button
            type="button"
            onClick={onCancelRes}
            className="h-9 px-3 rounded-lg border border-rose-200 text-rose-700 text-sm hover:bg-rose-50"
          >
            Cancelar reserva
          </button>
        )}
      </div>
    </div>
  );
}

function ReservationForm({
  rooms,
  reservations,
  operationalDate,
  onCancel,
  onSave,
}: {
  rooms: Room[];
  reservations: Reservation[];
  operationalDate: string;
  onCancel: () => void;
  onSave: (r: Reservation) => boolean;
}) {
  const [guestName, setGuestName] = useState('');
  const [checkIn, setCheckIn] = useState(operationalDate);
  const [checkOut, setCheckOut] = useState(addDays(operationalDate, 1));
  const [roomType, setRoomType] = useState<RoomType>('Standard');
  const [roomId, setRoomId] = useState('');
  const [total, setTotal] = useState(450);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [origin, setOrigin] = useState<Reservation['origin']>('direto');

  const availableRooms = useMemo(
    () =>
      rooms.filter(
        (room) =>
          room.type === roomType && roomAvailable(room, reservations, checkIn, checkOut),
      ),
    [rooms, reservations, roomType, checkIn, checkOut],
  );

  const submit = () => {
    if (!guestName.trim()) {
      toast.error('Informe o hóspede');
      return;
    }
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      toast.error('O check-out deve ser posterior ao check-in');
      return;
    }
    if (adults < 1 || children < 0) {
      toast.error('Quantidade de hóspedes inválida');
      return;
    }
    const room = rooms.find((r) => r.id === roomId);
    if (room && !roomAvailable(room, reservations, checkIn, checkOut)) {
      toast.error('Essa UH deixou de estar disponível para o período. Selecione outra.');
      return;
    }
    const stamp = Date.now().toString(36).toUpperCase();
    onSave({
      id: `res-${stamp}-${Math.random().toString(36).slice(2, 6)}`,
      code: `RSV-${String(Date.now()).slice(-6)}`,
      guestId: `guest-${stamp}`,
      guestName: guestName.trim(),
      roomId: room?.id,
      roomNumber: room?.number,
      roomType,
      checkIn,
      checkOut,
      adults,
      children,
      status: 'confirmada',
      origin,
      totalAmount: Math.max(0, total),
      paidAmount: 0,
      fnrhFilled: false,
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Nova reserva</h3>
        <button type="button" onClick={onCancel} className="p-1 rounded hover:bg-slate-100">
          <X className="w-4 h-4" />
        </button>
      </div>
      <Field label="Hóspede">
        <input value={guestName} onChange={(e) => setGuestName(e.target.value)} className="field" placeholder="Nome completo" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Check-in">
          <input type="date" value={checkIn} onChange={(e) => { setCheckIn(e.target.value); setRoomId(''); }} className="field" />
        </Field>
        <Field label="Check-out">
          <input type="date" value={checkOut} onChange={(e) => { setCheckOut(e.target.value); setRoomId(''); }} className="field" />
        </Field>
        <Field label="Tipo">
          <select value={roomType} onChange={(e) => { setRoomType(e.target.value as RoomType); setRoomId(''); }} className="field">
            {ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="UH">
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="field">
            <option value="">A definir</option>
            {availableRooms.map((r) => <option key={r.id} value={r.id}>{r.number}</option>)}
          </select>
        </Field>
        <Field label="Adultos">
          <input type="number" min={1} value={adults} onChange={(e) => setAdults(Number(e.target.value))} className="field" />
        </Field>
        <Field label="Crianças">
          <input type="number" min={0} value={children} onChange={(e) => setChildren(Number(e.target.value))} className="field" />
        </Field>
        <Field label="Origem">
          <select value={origin} onChange={(e) => setOrigin(e.target.value as Reservation['origin'])} className="field">
            <option value="direto">Direto</option>
            <option value="telefone">Telefone</option>
            <option value="booking">Booking</option>
            <option value="expedia">Expedia</option>
            <option value="walkin">Walk-in</option>
          </select>
        </Field>
        <Field label="Valor">
          <input type="number" min={0} value={total} onChange={(e) => setTotal(Number(e.target.value))} className="field" />
        </Field>
      </div>
      <p className="text-[11px] text-slate-500">
        {availableRooms.length} UH(s) disponível(is) em {roomType} para o período selecionado.
      </p>
      <button
        type="button"
        onClick={submit}
        className="w-full h-10 rounded-xl bg-slate-900 text-white text-sm font-semibold"
      >
        Criar reserva
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <div className="[&_.field]:w-full [&_.field]:h-10 [&_.field]:rounded-xl [&_.field]:border [&_.field]:border-slate-200 [&_.field]:px-3 [&_.field]:text-sm [&_textarea.field]:h-auto [&_textarea.field]:py-2">
        {children}
      </div>
    </label>
  );
}
