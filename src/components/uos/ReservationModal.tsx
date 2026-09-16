import { useEffect, useState } from 'react';
import { usePms } from '@/lib/pms-store';
import {
  accountBalance,
  formatBRL,
  formatDateBR,
  GOVERNANCE_LABEL,
  OCCUPANCY_LABEL,
  RES_STATUS_LABEL,
  type Reservation,
  type RoomType,
} from '@/lib/pms-types';
import { cn } from '@/lib/utils';
import {
  FileText,
  LogIn,
  LogOut,
  Save,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

const ROOM_TYPES: RoomType[] = [
  'Standard',
  'Superior',
  'Apartamento',
  'Chalé Master',
  'Bangalô',
  'Suite',
];

const ORIGINS: Reservation['origin'][] = [
  'direto',
  'booking',
  'expedia',
  'telefone',
  'walkin',
];

type ModalTab = 'geral' | 'valores' | 'obs';

export function ReservationModal({
  reservationId,
  onClose,
}: {
  reservationId: string;
  onClose: () => void;
}) {
  const {
    reservations,
    rooms,
    accounts,
    guests,
    upsertReservation,
    cancelReservation,
    markFnrh,
    checkIn,
    checkOut,
    setModule,
  } = usePms();

  const res = reservations.find((r) => r.id === reservationId);
  const [tab, setTab] = useState<ModalTab>('geral');
  const [draft, setDraft] = useState<Reservation | null>(null);

  useEffect(() => {
    if (res) setDraft({ ...res });
  }, [res]);

  if (!res || !draft) {
    return (
      <Overlay onClose={onClose}>
        <p className="p-8 text-slate-500">Reserva não encontrada</p>
      </Overlay>
    );
  }

  const room = rooms.find((r) => r.id === draft.roomId);
  const guest = guests.find((g) => g.id === draft.guestId);
  const account = draft.accountId
    ? accounts.find((a) => a.id === draft.accountId)
    : accounts.find((a) => a.reservationId === draft.id);
  const balance = account ? accountBalance(account) : draft.totalAmount - draft.paidAmount;

  const isInHouse = draft.status === 'checkin';
  const canCheckIn =
    draft.status === 'confirmada' || draft.status === 'pendente';
  const canCheckOut = draft.status === 'checkin';
  const editable =
    draft.status !== 'cancelada' && draft.status !== 'checkout';

  const save = () => {
    upsertReservation(draft);
    toast.success('Alterações salvas');
  };

  const doCheckIn = () => {
    // salva draft de UH antes se mudou
    upsertReservation(draft);
    const r = checkIn(draft.id);
    if (r.ok) {
      toast.success(r.message);
      onClose();
    } else toast.error(r.message);
  };

  const doCheckOut = () => {
    const r = checkOut(draft.id);
    if (r.ok) {
      toast.success(r.message);
      onClose();
    } else toast.error(r.message);
  };

  const openAccount = () => {
    setModule('contas');
    onClose();
    toast.message(
      account
        ? `Conta de ${draft.guestName}`
        : 'Abra a conta após o check-in ou pelo módulo Contas'
    );
  };

  return (
    <Overlay onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-500">
              Reserva · {draft.code}
            </p>
            <h2 className="text-lg font-semibold text-slate-900 leading-tight mt-0.5">
              {draft.guestName}
            </h2>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span
                className={cn(
                  'inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
                  isInHouse
                    ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                    : draft.status === 'confirmada'
                      ? 'bg-slate-100 text-slate-700 ring-slate-200'
                      : 'bg-amber-50 text-amber-800 ring-amber-200'
                )}
              >
                {RES_STATUS_LABEL[draft.status]}
              </span>
              {draft.roomNumber && (
                <span className="text-[11px] text-slate-500 font-medium">
                  {draft.roomNumber} · {draft.roomType}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 border-b border-slate-100 flex gap-1 shrink-0">
          {(
            [
              ['geral', 'Geral'],
              ['valores', 'Tarifa / valores'],
              ['obs', 'Observação'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'px-3 py-2.5 text-[13px] border-b-2 -mb-px',
                tab === id
                  ? 'border-indigo-600 text-indigo-700 font-semibold'
                  : 'border-transparent text-slate-500'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {tab === 'geral' && (
            <>
              <Section title="Período e acomodação">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Field label="Check-in">
                    <input
                      type="date"
                      disabled={!editable || isInHouse}
                      value={draft.checkIn}
                      onChange={(e) => setDraft({ ...draft, checkIn: e.target.value })}
                      className="input"
                    />
                  </Field>
                  <Field label="Check-out">
                    <input
                      type="date"lanco                      disabled={!editable}
                      value={draft.checkOut}
                      onChange={(e) => setDraft({ ...draft, checkOut: e.target.value })}
                      className="input"
                    />
                  </Field>
                  <Field label="Adultos">
                    <input
                      type="number"
                      min={1}
                      disabled={!editable}
                      value={draft.adults}
                      onChange={(e) =>
                        setDraft({ ...draft, adults: Number(e.target.value) })
                      }
                      className="input"
                    />
                  </Field>
                  <Field label="Crianças">
                    <input
                      type="number"
                      min={0}
                      disabled={!editable}
                      value={draft.children}
                      onChange={(e) =>
                        setDraft({ ...draft, children: Number(e.target.value) })
                      }
                      className="input"
                    />
                  </Field>
                  <Field label="Tipo de UH">
                    <select
                      disabled={!editable || isInHouse}
                      value={draft.roomType}
                      onChange={(e) =>
                        setDraft({ ...draft, roomType: e.target.value as RoomType })
                      }
                      className="input"
                    >
                      {ROOM_TYPES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="UH">
                    <select
                      disabled={!editable || isInHouse}
                      value={draft.roomId || ''}
                      onChange={(e) => {
                        const rm = rooms.find((r) => r.id === e.target.value);
                        setDraft({
                          ...draft,
                          roomId: rm?.id,
                          roomNumber: rm?.number,
                          roomType: (rm?.type as RoomType) || draft.roomType,
                        });
                      }}
                      className="input"
                    >
                      <option value="">Sem UH</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.number} · {r.type} ({OCCUPANCY_LABEL[r.occupancy]})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Canal / origem">
                    <select
                      disabled={!editable}
                      value={draft.origin}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          origin: e.target.value as Reservation['origin'],
                        })
                      }
                      className="input"
                    >
                      {ORIGINS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Status">
                    <div className="h-10 flex items-center text-[13px] font-medium text-slate-700">
                      {RES_STATUS_LABEL[draft.status]}
                    </div>
                  </Field>
                </div>
              </Section>

              <Section title="Hóspede">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Nome">
                    <input
                      disabled={!editable}
                      value={draft.guestName}
                      onChange={(e) => setDraft({ ...draft, guestName: e.target.value })}
                      className="input"
                    />
                  </Field>
                  <Field label="Documento">
                    <input
                      disabled
                      value={guest?.document || '—'}
                      className="input bg-slate-50"
                    />
                  </Field>
                  <Field label="Telefone">
                    <input
                      disabled
                      value={guest?.phone || '—'}
                      className="input bg-slate-50"
                    />
                  </Field>
                  <Field label="E-mail">
                    <input
                      disabled
                      value={guest?.email || '—'}
                      className="input bg-slate-50"
                    />
                  </Field>
                </div>
              </Section>

              {room && (
                <Section title="Status da UH">
                  <div className="flex flex-wrap gap-3 text-[13px]">
                    <Info label="Ocupação" value={OCCUPANCY_LABEL[room.occupancy]} />
                    <Info label="Governança" value={GOVERNANCE_LABEL[room.governance]} />
                    <Info label="Camareira" value={room.housekeeper || '—'} />
                    <Info label="NDP" value={room.dnd ? 'Ativo' : 'Não'} />
                  </div>
                </Section>
              )}
            </>
          )}

          {tab === 'valores' && (
            <Section title="Tarifário e valores">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Valor total (R$)">
                  <input
                    type="number"
                    disabled={!editable}
                    value={draft.totalAmount}
                    onChange={(e) =>
                      setDraft({ ...draft, totalAmount: Number(e.target.value) })
                    }
                    className="input"
                  />
                </Field>
                <Field label="Já pago (R$)">
                  <input
                    type="number"
                    disabled={!editable}
                    value={draft.paidAmount}
                    onChange={(e) =>
                      setDraft({ ...draft, paidAmount: Number(e.target.value) })
                    }
                    className="input"
                  />
                </Field>
                <Field label="Saldo">
                  <div
                    className={cn(
                      'h-10 flex items-center text-[13px] font-semibold',
                      balance > 0.01 ? 'text-rose-600' : 'text-emerald-600'
                    )}
                  >
                    {formatBRL(balance)}
                  </div>
                </Field>
              </div>
              {account && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[12px] space-y-1">
                  <p className="font-semibold text-slate-700">Conta vinculada</p>
                  <p className="text-slate-500">
                    Status: {account.status} · Aberta em {formatDateBR(account.openedAt)}
                  </p>
                  <p className="text-slate-500">
                    Lançamentos: {account.charges.length} · Pagamentos:{' '}
                    {account.payments.length}
                  </p>
                </div>
              )}
            </Section>
          )}

          {tab === 'obs' && (
            <Section title="Observações da reserva">
              <textarea
                disabled={!editable}
                value={draft.notes || ''}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                rows={5}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="Observações internas, pedidos do hóspede…"
              />
              <div className="mt-3 flex items-center gap-2 text-[13px]">
                <span className="text-slate-500">FNRH / pré-check-in:</span>
                <span
                  className={
                    draft.fnrhFilled
                      ? 'text-emerald-600 font-semibold'
                      : 'text-amber-700 font-semibold'
                  }
                >
                  {draft.fnrhFilled ? 'Preenchida' : 'Pendente'}
                </span>
              </div>
            </Section>
          )}
        </div>

        {/* Footer ações */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap gap-2 shrink-0">
          {editable && (
            <button
              type="button"
              onClick={save}
              className="h-9 px-3 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-indigo-500"
            >
              <Save className="w-3.5 h-3.5" /> Salvar
            </button>
          )}

          <button
            type="button"
            onClick={openAccount}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[13px] font-medium inline-flex items-center gap-1.5 hover:bg-slate-50"
          >
            <Wallet className="w-3.5 h-3.5" /> Conta do hóspede
          </button>

          <button
            type="button"
            onClick={() => {
              markFnrh(draft.id);
              setDraft({ ...draft, fnrhFilled: true });
              toast.success('FNRH marcada');
            }}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[13px] font-medium inline-flex items-center gap-1.5 hover:bg-slate-50"
          >
            <FileText className="w-3.5 h-3.5" />
            {draft.fnrhFilled ? 'FNRH OK' : 'Marcar FNRH'}
          </button>

          {canCheckIn && (
            <button
              type="button"
              onClick={doCheckIn}
              className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-emerald-500"
            >
              <LogIn className="w-3.5 h-3.5" /> Check-in
            </button>
          )}

          {canCheckOut && (
            <button
              type="button"
              onClick={doCheckOut}
              className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-slate-800"
            >
              <LogOut className="w-3.5 h-3.5" /> Check-out
            </button>
          )}

          {editable && !isInHouse && draft.status !== 'cancelada' && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Cancelar esta reserva?')) {
                  cancelReservation(draft.id);
                  toast.message('Reserva cancelada');
                  onClose();
                }
              }}
              className="h-9 px-3 rounded-lg border border-rose-200 text-rose-700 text-[13px] hover:bg-rose-50 ml-auto"
            >
              Cancelar reserva
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 rounded-lg text-[13px] text-slate-600 hover:bg-slate-100"
          >
            Fechar
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div className="relative z-10 w-full flex justify-center">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-2">
        {title}
      </p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5">
      <p className="text-[10px] text-slate-400 uppercase">{label}</p>
      <p className="text-[13px] font-medium text-slate-800">{value}</p>
    </div>
  );
}

/** util classes via global-ish tailwind in className */
declare module 'react' {
  // ensure input class used above works with tailwind
}
