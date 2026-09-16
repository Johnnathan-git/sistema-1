import { useEffect, useState } from 'react';
import { usePms } from '@/lib/pms-store';
import { AccountModal } from '@/components/uos/AccountModal';
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
  Download,
  Eye,
  FileText,
  History,
  LogIn,
  LogOut,
  Paperclip,
  Save,
  Ticket,
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

const inputCls =
  'w-full h-10 rounded-xl border border-slate-200 px-3 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50 disabled:text-slate-500';

type ModalTab =
  | 'geral'
  | 'valores'
  | 'obs'
  | 'voucher'
  | 'documentos'
  | 'logs';

/** Dados fictícios de layout */
function mockDocs(res: Reservation) {
  return [
    {
      id: 'd1',
      name: `Voucher_${res.code}.pdf`,
      type: 'Voucher',
      size: '124 KB',
      uploadedAt: res.checkIn + ' 09:12',
      uploadedBy: 'Sistema',
    },
    {
      id: 'd2',
      name: 'Comprovante_PIX_sinal.pdf',
      type: 'Comprovante',
      size: '86 KB',
      uploadedAt: res.checkIn + ' 10:05',
      uploadedBy: 'Operador JH',
    },
    {
      id: 'd3',
      name: 'FNRH_digital.pdf',
      type: 'FNRH',
      size: '210 KB',
      uploadedAt: res.checkIn + ' 14:22',
      uploadedBy: 'Operador JH',
    },
  ];
}

function mockLogs(res: Reservation) {
  const logs = [
    {
      id: 'l1',
      at: '2026-09-10 11:34',
      user: 'Operador JH',
      action: 'Reserva criada',
      detail: `Canal ${res.origin} · ${res.roomType}`,
    },
    {
      id: 'l2',
      at: '2026-09-10 11:35',
      user: 'Sistema',
      action: 'Confirmação automática',
      detail: 'Status → Confirmada',
    },
    {
      id: 'l3',
      at: '2026-09-12 16:40',
      user: 'Operador JH',
      action: 'UH atribuída',
      detail: res.roomNumber || 'A definir',
    },
    {
      id: 'l4',
      at: res.checkIn + ' 09:12',
      user: 'Sistema',
      action: 'Voucher gerado',
      detail: `Voucher_${res.code}.pdf`,
    },
  ];
  if (res.paidAmount > 0) {
    logs.push({
      id: 'l5',
      at: res.checkIn + ' 10:05',
      user: 'Operador JH',
      action: 'Pagamento registrado',
      detail: formatBRL(res.paidAmount),
    });
  }
  if (res.fnrhFilled) {
    logs.push({
      id: 'l6',
      at: res.checkIn + ' 14:20',
      user: 'Operador JH',
      action: 'FNRH preenchida',
      detail: 'Pré-check-in concluído',
    });
  }
  if (res.status === 'checkin') {
    logs.push({
      id: 'l7',
      at: res.checkIn + ' 15:02',
      user: 'Operador JH',
      action: 'Check-in realizado',
      detail: `UH ${res.roomNumber} · Conta aberta`,
    });
  }
  if (res.status === 'checkout') {
    logs.push({
      id: 'l8',
      at: res.checkOut + ' 11:00',
      user: 'Operador JH',
      action: 'Check-out realizado',
      detail: 'UH liberada · status Sujo',
    });
  }
  return logs;
}

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
    hotel,
  } = usePms();

  const res = reservations.find((r) => r.id === reservationId);
  const [tab, setTab] = useState<ModalTab>('geral');
  const [draft, setDraft] = useState<Reservation | null>(null);
  const [showAccount, setShowAccount] = useState(false);

  useEffect(() => {
    if (res) setDraft({ ...res });
  }, [res]);

  if (!res || !draft) {
    return (
      <Overlay onClose={onClose}>
        <div className="bg-white rounded-2xl p-8 shadow-xl">
          <p className="text-slate-500">Reserva não encontrada</p>
        </div>
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
  const canCheckIn = draft.status === 'confirmada' || draft.status === 'pendente';
  const canCheckOut = draft.status === 'checkin';
  const editable = draft.status !== 'cancelada' && draft.status !== 'checkout';

  const docs = mockDocs(draft);
  const logs = mockLogs(draft);

  const save = () => {
    upsertReservation(draft);
    toast.success('Alterações salvas');
  };

  const doCheckIn = () => {
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

  const openVoucherPdf = () => {
    const html = buildVoucherHtml(draft, hotel.name, guest?.document);
    const w = window.open('', '_blank', 'noopener,noreferrer,width=800,height=900');
    if (!w) {
      toast.error('Permita pop-ups para abrir o voucher');
      return;
    }
    w.document.write(html);
    w.document.close();
    setTimeout(() => {
      try {
        w.print();
      } catch {
        /* ignore */
      }
    }, 400);
    toast.message('Voucher aberto — use imprimir / salvar como PDF');
  };

  return (
    <>
      {showAccount && (
        <AccountModal
          accountId={account?.id}
          reservationId={draft.id}
          onClose={() => setShowAccount(false)}
        />
      )}

      <Overlay onClose={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
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

          <div className="px-3 sm:px-5 border-b border-slate-100 flex gap-0.5 overflow-x-auto shrink-0">
            {(
              [
                ['geral', 'Geral'],
                ['valores', 'Tarifa'],
                ['obs', 'Observação'],
                ['voucher', 'Voucher'],
                ['documentos', 'Documentos'],
                ['logs', 'Logs'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  'px-3 py-2.5 text-[13px] border-b-2 -mb-px whitespace-nowrap',
                  tab === id
                    ? 'border-indigo-600 text-indigo-700 font-semibold'
                    : 'border-transparent text-slate-500'
                )}
              >
                {label}
              </button>
            ))}
          </div>

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
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Check-out">
                      <input
                        type="date"
                        disabled={!editable}
                        value={draft.checkOut}
                        onChange={(e) => setDraft({ ...draft, checkOut: e.target.value })}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Adultos">
                      <input
                        type="number"
                        min={1}
                        disabled={!editable}
                        value={draft.adults}
                        onChange={(e) => setDraft({ ...draft, adults: Number(e.target.value) })}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Crianças">
                      <input
                        type="number"
                        min={0}
                        disabled={!editable}
                        value={draft.children}
                        onChange={(e) => setDraft({ ...draft, children: Number(e.target.value) })}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Tipo de UH">
                      <select
                        disabled={!editable || isInHouse}
                        value={draft.roomType}
                        onChange={(e) =>
                          setDraft({ ...draft, roomType: e.target.value as RoomType })
                        }
                        className={inputCls}
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
                        className={inputCls}
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
                        className={inputCls}
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
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Documento">
                      <input disabled value={guest?.document || '—'} className={inputCls} />
                    </Field>
                    <Field label="Telefone">
                      <input disabled value={guest?.phone || '—'} className={inputCls} />
                    </Field>
                    <Field label="E-mail">
                      <input disabled value={guest?.email || '—'} className={inputCls} />
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
                      className={inputCls}
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
                      className={inputCls}
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
                    <button
                      type="button"
                      onClick={() => setShowAccount(true)}
                      className="mt-1 text-indigo-600 font-medium hover:underline"
                    >
                      Abrir extrato da conta →
                    </button>
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
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
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

            {tab === 'voucher' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800">Voucher do hóspede</p>
                    <p className="text-[12px] text-slate-500">
                      Documento oficial da reserva — abrir ou salvar como PDF
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openVoucherPdf}
                    className="h-9 px-3 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold inline-flex items-center gap-1.5"
                  >
                    <Ticket className="w-3.5 h-3.5" /> Abrir voucher (PDF)
                  </button>
                </div>

                {/* Preview visual */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-[13px]">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                        {hotel.name}
                      </p>
                      <p className="text-lg font-semibold text-slate-900">VOUCHER DE HOSPEDAGEM</p>
                    </div>
                    <p className="font-mono text-[12px] text-slate-500">{draft.code}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] uppercase text-slate-400">Hóspede</p>
                      <p className="font-medium">{draft.guestName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-400">Documento</p>
                      <p className="font-medium">{guest?.document || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-400">Check-in</p>
                      <p className="font-medium">{formatDateBR(draft.checkIn)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-400">Check-out</p>
                      <p className="font-medium">{formatDateBR(draft.checkOut)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-400">UH / Tipo</p>
                      <p className="font-medium">
                        {draft.roomNumber || '—'} · {draft.roomType}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-400">Hóspedes</p>
                      <p className="font-medium">
                        {draft.adults} adulto(s) · {draft.children} criança(s)
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-400">Valor</p>
                      <p className="font-medium">{formatBRL(draft.totalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-400">Status</p>
                      <p className="font-medium">{RES_STATUS_LABEL[draft.status]}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'documentos' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-slate-800">
                    Documentos da reserva
                  </p>
                  <button
                    type="button"
                    onClick={() => toast.message('Upload de documento (em breve)')}
                    className="h-8 px-3 rounded-lg border border-slate-200 text-[12px] font-medium inline-flex items-center gap-1.5 hover:bg-slate-50"
                  >
                    <Paperclip className="w-3.5 h-3.5" /> Anexar
                  </button>
                </div>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-[12px]">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
                        <th className="px-3 py-2 font-semibold">Arquivo</th>
                        <th className="px-3 py-2 font-semibold">Tipo</th>
                        <th className="px-3 py-2 font-semibold">Enviado</th>
                        <th className="px-3 py-2 font-semibold text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {docs.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50/80">
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                              <div>
                                <p className="font-medium text-slate-800">{d.name}</p>
                                <p className="text-[10px] text-slate-400">{d.size}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">{d.type}</td>
                          <td className="px-3 py-2.5 text-slate-500">
                            <p>{d.uploadedAt}</p>
                            <p className="text-[10px]">{d.uploadedBy}</p>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="inline-flex gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  d.type === 'Voucher'
                                    ? openVoucherPdf()
                                    : toast.message(`Visualizar ${d.name} (mock)`)
                                }
                                className="h-7 w-7 rounded-lg border border-slate-200 inline-flex items-center justify-center hover:bg-white"
                                title="Visualizar"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => toast.message(`Download ${d.name} (mock)`)}
                                className="h-7 w-7 rounded-lg border border-slate-200 inline-flex items-center justify-center hover:bg-white"
                                title="Download"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'logs' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-400" />
                  <p className="text-[13px] font-semibold text-slate-800">Histórico da reserva</p>
                </div>
                <div className="relative pl-4 space-y-0">
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />
                  {logs.map((l) => (
                    <div key={l.id} className="relative pb-4 last:pb-0">
                      <div className="absolute left-[-13px] top-1.5 h-2.5 w-2.5 rounded-full bg-indigo-500 ring-2 ring-white" />
                      <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-1">
                          <p className="text-[13px] font-semibold text-slate-800">{l.action}</p>
                          <p className="text-[11px] text-slate-400 tabular-nums">{l.at}</p>
                        </div>
                        <p className="text-[12px] text-slate-600 mt-0.5">{l.detail}</p>
                        <p className="text-[11px] text-slate-400 mt-1">por {l.user}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

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
              onClick={() => setShowAccount(true)}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[13px] font-medium inline-flex items-center gap-1.5 hover:bg-slate-50"
            >
              <Wallet className="w-3.5 h-3.5" /> Conta
            </button>

            <button
              type="button"
              onClick={openVoucherPdf}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[13px] font-medium inline-flex items-center gap-1.5 hover:bg-slate-50"
            >
              <Ticket className="w-3.5 h-3.5" /> Voucher
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
              {draft.fnrhFilled ? 'FNRH OK' : 'FNRH'}
            </button>

            {canCheckIn && (
              <button
                type="button"
                onClick={doCheckIn}
                className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-[13px] font-semibold inline-flex items-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" /> Check-in
              </button>
            )}

            {canCheckOut && (
              <button
                type="button"
                onClick={doCheckOut}
                className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[13px] font-semibold inline-flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" /> Check-out
              </button>
            )}

            {editable && !isInHouse && (
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
                Cancelar
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
    </>
  );
}

function buildVoucherHtml(
  r: Reservation,
  hotelName: string,
  document?: string
): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Voucher ${r.code}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:32px;color:#0f172a;max-width:640px;margin:0 auto}
  h1{font-size:20px;margin:0 0 4px} .muted{color:#64748b;font-size:12px}
  .box{border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-top:16px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
  .lbl{font-size:10px;text-transform:uppercase;color:#94a3b8;letter-spacing:.06em}
  .val{font-size:14px;font-weight:600;margin-top:2px}
  @media print{body{padding:12px}}
</style></head><body>
<p class="muted">${hotelName}</p>
<h1>Voucher de hospedagem</h1>
<p class="muted">Reserva ${r.code}</p>
<div class="box">
  <div class="grid">
    <div><div class="lbl">Hóspede</div><div class="val">${r.guestName}</div></div>
    <div><div class="lbl">Documento</div><div class="val">${document || '—'}</div></div>
    <div><div class="lbl">Check-in</div><div class="val">${formatDateBR(r.checkIn)}</div></div>
    <div><div class="lbl">Check-out</div><div class="val">${formatDateBR(r.checkOut)}</div></div>
    <div><div class="lbl">UH / Tipo</div><div class="val">${r.roomNumber || '—'} · ${r.roomType}</div></div>
    <div><div class="lbl">Hóspedes</div><div class="val">${r.adults} ad. · ${r.children} ch.</div></div>
    <div><div class="lbl">Valor</div><div class="val">${formatBRL(r.totalAmount)}</div></div>
    <div><div class="lbl">Status</div><div class="val">${RES_STATUS_LABEL[r.status]}</div></div>
  </div>
</div>
<p class="muted" style="margin-top:24px">Documento gerado pelo UOS PMS · ${new Date().toLocaleString('pt-BR')}</p>
</body></html>`;
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
