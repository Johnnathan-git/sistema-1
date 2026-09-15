import { useMemo, useState } from 'react';
import { usePms } from '@/lib/pms-store';
import {
  formatBRL,
  formatDateBR,
  RES_STATUS_LABEL,
  type Reservation,
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

export function ReservationsModule() {
  const {
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
          (r.roomNumber || '').toLowerCase().includes(query)
      );
    }
    return rows;
  }, [reservations, q, statusFilter]);

  const selected = reservations.find((r) => r.id === selectedId) || null;

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
              <option key={k} value={k}>
                {v}
              </option>
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
                      selectedId === r.id && 'bg-slate-50'
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                    <td className="px-4 py-3 font-medium">{r.guestName}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDateBR(r.checkIn)} → {formatDateBR(r.checkOut)}
                    </td>
                    <td className="px-4 py-3">{r.roomNumber || r.roomType}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatBRL(r.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-2">
          {creating ? (
            <ReservationForm
              rooms={rooms}
              onCancel={() => setCreating(false)}
              onSave={(res) => {
                upsertReservation(res);
                setCreating(false);
                setSelectedId(res.id);
                toast.success('Reserva criada');
              }}
            />
          ) : selected ? (
            <ReservationDetail
              res={selected}
              rooms={rooms}
              onSave={(res) => {
                upsertReservation(res);
                toast.success('Reserva atualizada');
              }}
              onCancelRes={() => {
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
  onSave,
  onCancelRes,
  onFnrh,
  onOpenAccount,
}: {
  res: Reservation;
  rooms: { id: string; number: string; type: string; status: string }[];
  onSave: (r: Reservation) => void;
  onCancelRes: () => void;
  onFnrh: () => void;
  onOpenAccount: () => void;
}) {
  const [draft, setDraft] = useState(res);
  // sync when selection changes
  if (draft.id !== res.id) setDraft(res);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {draft.code}
          </p>
          <h3 className="text-lg font-semibold">{draft.guestName}</h3>
          <StatusBadge status={draft.status} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Check-in">
          <input
            type="date"
            value={draft.checkIn}
            onChange={(e) => setDraft({ ...draft, checkIn: e.target.value })}
            className="field"
          />
        </Field>
        <Field label="Check-out">
          <input
            type="date"
            value={draft.checkOut}
            onChange={(e) => setDraft({ ...draft, checkOut: e.target.value })}
            className="field"
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
            onChange={(e) => setDraft({ ...draft, roomType: e.target.value as RoomType })}
            className="field"
          >
            {ROOM_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="UH atribuída">
          <select
            value={draft.roomId || ''}
            onChange={(e) => {
              const room = rooms.find((r) => r.id === e.target.value);
              setDraft({
                ...draft,
                roomId: room?.id,
                roomNumber: room?.number,
              });
            }}
            className="field"
          >
            <option value="">Sem UH</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.number} · {r.type} ({r.status})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Valor total">
          <input
            type="number"
            value={draft.totalAmount}
            onChange={(e) => setDraft({ ...draft, totalAmount: Number(e.target.value) })}
            className="field"
          />
        </Field>
        <Field label="Pago">
          <input
            type="number"
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

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => onSave(draft)}
          className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold"
        >
          Salvar alterações
        </button>
        <button
          type="button"
          onClick={onFnrh}
          className="h-9 px-3 rounded-lg border border-slate-200 text-sm inline-flex items-center gap-1.5 hover:bg-slate-50"
        >
          <FileText className="w-3.5 h-3.5" />
          {draft.fnrhFilled ? 'FNRH OK' : 'Marcar FNRH'}
        </button>
        <button
          type="button"
          onClick={onOpenAccount}
          className="h-9 px-3 rounded-lg border border-slate-200 text-sm inline-flex items-center gap-1.5 hover:bg-slate-50"
        >
          <UserRound className="w-3.5 h-3.5" /> Conta do hóspede
        </button>
        {draft.status !== 'cancelada' && draft.status !== 'checkout' && (
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
  onCancel,
  onSave,
}: {
  rooms: { id: string; number: string; type: string; status: string }[];
  onCancel: () => void;
  onSave: (r: Reservation) => void;
}) {
  const [guestName, setGuestName] = useState('');
  const [checkIn, setCheckIn] = useState('2026-09-16');
  const [checkOut, setCheckOut] = useState('2026-09-17');
  const [roomType, setRoomType] = useState<RoomType>('Standard');
  const [roomId, setRoomId] = useState('');
  const [total, setTotal] = useState(450);
  const [adults, setAdults] = useState(2);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Nova reserva</h3>
        <button type="button" onClick={onCancel} className="p-1 rounded hover:bg-slate-100">
          <X className="w-4 h-4" />
        </button>
      </div>
      <Field label="Hóspede">
        <input
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          className="field"
          placeholder="Nome completo"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Check-in">
          <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="field" />
        </Field>
        <Field label="Check-out">
          <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="field" />
        </Field>
        <Field label="Tipo">
          <select value={roomType} onChange={(e) => setRoomType(e.target.value as RoomType)} className="field">
            {ROOM_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="UH">
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="field">
            <option value="">A definir</option>
            {rooms
              .filter((r) => r.status === 'livre')
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Adultos">
          <input type="number" min={1} value={adults} onChange={(e) => setAdults(Number(e.target.value))} className="field" />
        </Field>
        <Field label="Valor">
          <input type="number" value={total} onChange={(e) => setTotal(Number(e.target.value))} className="field" />
        </Field>
      </div>
      <button
        type="button"
        onClick={() => {
          if (!guestName.trim()) {
            toast.error('Informe o hóspede');
            return;
          }
          const room = rooms.find((r) => r.id === roomId);
          onSave({
            id: `res-${Math.random().toString(36).slice(2, 8)}`,
            code: `RSV-${Math.floor(1000 + Math.random() * 9000)}`,
            guestId: 'new',
            guestName: guestName.trim(),
            roomId: room?.id,
            roomNumber: room?.number,
            roomType,
            checkIn,
            checkOut,
            adults,
            children: 0,
            status: 'confirmada',
            origin: 'direto',
            totalAmount: total,
            paidAmount: 0,
            fnrhFilled: false,
          });
        }}
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
