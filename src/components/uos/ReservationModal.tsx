import { useEffect, useState } from 'react';
import { usePms } from '@/lib/pms-store';
import { AccountModal } from '@/components/uos/AccountModal';
import { PensionTab } from '@/components/uos/PensionTab';
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
import { Car, IdCard, LogIn, LogOut, Plus, Save, Ticket, Trash2, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';

const ROOM_TYPES: RoomType[] = ['Standard', 'Superior', 'Apartamento', 'Chalé Master', 'Bangalô', 'Suite'];
const inputCls =
  'w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:bg-slate-50';

type ModalTab = 'geral' | 'valores' | 'obs' | 'pensoes' | 'voucher' | 'documentos' | 'logs';
type Companion = { id: string; name: string; cpf: string; birthDate: string; ageGroup: 'Adulto' | 'Criança' | 'Bebê' };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[12px] font-semibold text-slate-800">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/50" onClick={onClose} aria-label="Fechar" />
      <div className="relative z-10 w-full max-w-5xl">{children}</div>
    </div>
  );
}

export function ReservationModal({ reservationId, onClose }: { reservationId: string; onClose: () => void }) {
  const { reservations, rooms, accounts, guests, upsertReservation, checkIn, checkOut, markFnrh } = usePms();
  const res = reservations.find((r) => r.id === reservationId);
  const [tab, setTab] = useState<ModalTab>('geral');
  const [draft, setDraft] = useState<Reservation | null>(null);
  const [showAccount, setShowAccount] = useState(false);
  const [showFicha, setShowFicha] = useState(false);
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [titular, setTitular] = useState({ fullName: '', cpf: '', email: '', birthDate: '', cep: '', phone: '' });

  useEffect(() => {
    if (!res) return;
    setDraft({ ...res });
    const g = guests.find((x) => x.id === res.guestId);
    setTitular({
      fullName: res.guestName || g?.name || '',
      cpf: g?.document || '',
      email: g?.email || '',
      birthDate: '',
      cep: '',
      phone: g?.phone || '',
    });
    const list: Companion[] = [];
    for (let i = 1; i < res.adults; i++) list.push({ id: `a${i}`, name: '', cpf: '', birthDate: '', ageGroup: 'Adulto' });
    for (let i = 1; i <= res.children; i++) list.push({ id: `c${i}`, name: '', cpf: '', birthDate: '', ageGroup: 'Criança' });
    setCompanions(list);
  }, [res, guests]);

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
  const account = draft.accountId
    ? accounts.find((a) => a.id === draft.accountId)
    : accounts.find((a) => a.reservationId === draft.id);
  const balance = account ? accountBalance(account) : draft.totalAmount - draft.paidAmount;
  const isInHouse = draft.status === 'checkin';
  const canCheckIn = draft.status === 'confirmada' || draft.status === 'pendente';
  const canCheckOut = draft.status === 'checkin';
  const editable = draft.status !== 'cancelada' && draft.status !== 'checkout';

  const save = () => {
    const adults = 1 + companions.filter((c) => c.ageGroup === 'Adulto').length;
    const children = companions.filter((c) => c.ageGroup !== 'Adulto').length;
    const next = { ...draft, guestName: titular.fullName.trim() || draft.guestName, adults, children };
    setDraft(next);
    upsertReservation(next);
    toast.success('Alterações salvas');
  };

  const doCheckIn = () => {
    const missing: string[] = [];
    if (!titular.fullName.trim()) missing.push('Nome completo do titular');
    if (!titular.cpf.trim()) missing.push('CPF do titular');
    if (!titular.email.trim()) missing.push('E-mail do titular');
    if (!titular.birthDate) missing.push('Nascimento do titular');
    if (!titular.cep.trim()) missing.push('CEP do titular');
    if (!titular.phone.trim()) missing.push('Celular do titular');
    if (!draft.roomId) missing.push('UH selecionada');
    if (!draft.fnrhFilled) missing.push('Ficha de hospedagem (FNRH)');
    for (const c of companions) {
      if (!c.name.trim()) missing.push('Nome do acompanhante');
      if (!c.cpf.trim()) missing.push(`CPF do acompanhante (${c.name || '—'})`);
      if (!c.birthDate) missing.push(`Nascimento do acompanhante (${c.name || '—'})`);
    }
    if (missing.length) {
      toast.error(`Preencha antes do check-in: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`);
      return;
    }
    const adults = 1 + companions.filter((c) => c.ageGroup === 'Adulto').length;
    const children = companions.filter((c) => c.ageGroup !== 'Adulto').length;
    const next = { ...draft, guestName: titular.fullName.trim(), adults, children, fnrhFilled: true };
    setDraft(next);
    upsertReservation(next);
    const r = checkIn(next.id);
    if (r.ok) { toast.success(r.message); onClose(); }
    else toast.error(r.message);
  };

  const doCheckOut = () => {
    const r = checkOut(draft.id);
    if (r.ok) { toast.success(r.message); onClose(); }
    else toast.error(r.message);
  };

  const tabs: { id: ModalTab; label: string }[] = [
    { id: 'geral', label: 'Geral' },
    { id: 'valores', label: 'Tarifa' },
    { id: 'pensoes', label: 'Pensões' },
    { id: 'obs', label: 'Observação' },
    { id: 'voucher', label: 'Voucher' },
    { id: 'documentos', label: 'Documentos' },
    { id: 'logs', label: 'Logs' },
  ];

  return (
    <>
      {showAccount && (
        <AccountModal accountId={account?.id} reservationId={draft.id} onClose={() => setShowAccount(false)} />
      )}

      {showFicha && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-900/50" onClick={() => setShowFicha(false)} aria-label="Fechar" />
          <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-3.5 bg-[#0c2340] text-white flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-sky-300 font-semibold">FNRH · Ficha de hospedagem</p>
                <p className="text-[15px] font-semibold mt-0.5">{titular.fullName || draft.guestName}</p>
              </div>
              <button type="button" onClick={() => setShowFicha(false)} className="h-8 w-8 rounded-lg border border-white/20 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Nome completo">
                  <input className={inputCls} value={titular.fullName} onChange={(e) => setTitular({ ...titular, fullName: e.target.value })} />
                </Field>
                <Field label="CPF">
                  <input className={inputCls} value={titular.cpf} onChange={(e) => setTitular({ ...titular, cpf: e.target.value })} placeholder="000.000.000-00" />
                </Field>
                <Field label="Data nascimento">
                  <input type="date" className={inputCls} value={titular.birthDate} onChange={(e) => setTitular({ ...titular, birthDate: e.target.value })} />
                </Field>
                <Field label="E-mail">
                  <input className={inputCls} type="email" value={titular.email} onChange={(e) => setTitular({ ...titular, email: e.target.value })} />
                </Field>
                <Field label="CEP">
                  <input className={inputCls} value={titular.cep} onChange={(e) => setTitular({ ...titular, cep: e.target.value })} placeholder="00000-000" />
                </Field>
                <Field label="Celular">
                  <input className={inputCls} value={titular.phone} onChange={(e) => setTitular({ ...titular, phone: e.target.value })} placeholder="(00) 00000-0000" />
                </Field>
                <Field label="Profissão"><input className={inputCls} /></Field>
                <Field label="Estado civil">
                  <select className={inputCls}><option>Solteiro(a)</option><option>Casado(a)</option><option>Outro</option></select>
                </Field>
                <Field label="Endereço"><input className={inputCls} /></Field>
                <Field label="Cidade / UF"><input className={inputCls} /></Field>
                <Field label="Placa veículo">
                  <input className={inputCls} value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())} />
                </Field>
                <Field label="Motivo da viagem">
                  <select className={inputCls}><option>Lazer</option><option>Negócios</option><option>Evento</option><option>Outro</option></select>
                </Field>
                <Field label="Próximo destino"><input className={inputCls} /></Field>
              </div>
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" className="rounded" defaultChecked={draft.fnrhFilled} />
                Confirmo o preenchimento da FNRH
              </label>
            </div>
            <div className="px-5 py-3 border-t bg-slate-50 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowFicha(false)} className="h-9 px-3 rounded-lg border text-[13px]">Cancelar</button>
              <button
                type="button"
                onClick={() => {
                  markFnrh(draft.id);
                  setDraft({ ...draft, fnrhFilled: true, guestName: titular.fullName.trim() || draft.guestName });
                  setShowFicha(false);
                  toast.success('Ficha de hospedagem salva');
                }}
                className="h-9 px-4 rounded-lg bg-[#1d4ed8] text-white text-[13px] font-semibold"
              >
                Salvar ficha
              </button>
            </div>
          </div>
        </div>
      )}

      <Overlay onClose={onClose}>
        <div className="bg-[#f0f2f5] rounded-2xl shadow-2xl w-full max-w-5xl h-[min(860px,90vh)] flex flex-col overflow-hidden border border-slate-300">
          <div className="px-5 py-3.5 border-b bg-[#0c2340] text-white flex items-start justify-between gap-3 shrink-0">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-300">Reserva · {draft.code}</p>
              <h2 className="text-lg font-semibold mt-0.5">{draft.guestName}</h2>
              <span className={cn('inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold mt-1', isInHouse ? 'bg-emerald-500' : 'bg-white/15')}>
                {RES_STATUS_LABEL[draft.status]}
              </span>
            </div>
            <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg border border-white/20 flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-3 border-b bg-white flex gap-0.5 overflow-x-auto shrink-0">
            {tabs.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  'px-3 py-2.5 text-[13px] border-b-2 -mb-px whitespace-nowrap',
                  tab === id ? 'border-blue-600 text-blue-700 font-semibold' : 'border-transparent text-slate-500'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
            {tab === 'geral' && (
              <div className="space-y-3">
                <Section title="Dados gerais">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <Field label="Número"><input disabled value={draft.code} className={inputCls} /></Field>
                    <Field label="Status"><div className="h-9 flex items-center text-[13px] font-medium">{RES_STATUS_LABEL[draft.status]}</div></Field>
                    <Field label="Check-in">
                      <input type="date" disabled={!editable || isInHouse} value={draft.checkIn} onChange={(e) => setDraft({ ...draft, checkIn: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Check-out">
                      <input type="date" disabled={!editable} value={draft.checkOut} onChange={(e) => setDraft({ ...draft, checkOut: e.target.value })} className={inputCls} />
                    </Field>
                  </div>
                </Section>

                <Section
                  title="Hóspede titular (obrigatório para check-in)"
                  action={
                    <button
                      type="button"
                      onClick={() => setShowFicha(true)}
                      className="h-7 px-2 rounded-md bg-[#1d4ed8] text-white text-[11px] font-semibold inline-flex items-center gap-1 hover:bg-blue-700"
                      title="Abrir ficha de hospedagem (FNRH)"
                    >
                      <IdCard className="w-3.5 h-3.5" /> Ficha
                    </button>
                  }
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <Field label="Nome completo *">
                      <input disabled={!editable} value={titular.fullName} onChange={(e) => { setTitular({ ...titular, fullName: e.target.value }); setDraft({ ...draft, guestName: e.target.value }); }} className={inputCls} />
                    </Field>
                    <Field label="CPF *">
                      <input disabled={!editable} value={titular.cpf} onChange={(e) => setTitular({ ...titular, cpf: e.target.value })} className={inputCls} placeholder="000.000.000-00" />
                    </Field>
                    <Field label="E-mail *">
                      <input disabled={!editable} type="email" value={titular.email} onChange={(e) => setTitular({ ...titular, email: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Nascimento *">
                      <input disabled={!editable} type="date" value={titular.birthDate} onChange={(e) => setTitular({ ...titular, birthDate: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="CEP *">
                      <input disabled={!editable} value={titular.cep} onChange={(e) => setTitular({ ...titular, cep: e.target.value })} className={inputCls} placeholder="00000-000" />
                    </Field>
                    <Field label="Celular *">
                      <input disabled={!editable} value={titular.phone} onChange={(e) => setTitular({ ...titular, phone: e.target.value })} className={inputCls} placeholder="(00) 00000-0000" />
                    </Field>
                    <Field label="Placa veículo">
                      <div className="relative">
                        <Car className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input disabled={!editable} value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())} placeholder="ABC1D23" className={inputCls + ' pl-8'} />
                      </div>
                    </Field>
                  </div>
                </Section>

                <Section title="Acomodações">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <Field label="Tipo UH">
                      <select disabled={!editable || isInHouse} value={draft.roomType} onChange={(e) => setDraft({ ...draft, roomType: e.target.value as RoomType })} className={inputCls}>
                        {ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </Field>
                    <Field label="UH *">
                      <select
                        disabled={!editable || isInHouse}
                        value={draft.roomId || ''}
                        onChange={(e) => {
                          const rm = rooms.find((r) => r.id === e.target.value);
                          setDraft({ ...draft, roomId: rm?.id, roomNumber: rm?.number, roomType: (rm?.type as RoomType) || draft.roomType });
                        }}
                        className={inputCls}
                      >
                        <option value="">Selecione a UH…</option>
                        {rooms.map((r) => (
                          <option key={r.id} value={r.id}>{r.number} · {r.type} ({OCCUPANCY_LABEL[r.occupancy]})</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Adultos">
                      <input type="number" disabled value={1 + companions.filter((c) => c.ageGroup === 'Adulto').length} className={inputCls} />
                    </Field>
                    <Field label="Crianças">
                      <input type="number" disabled value={companions.filter((c) => c.ageGroup !== 'Adulto').length} className={inputCls} />
                    </Field>
                  </div>
                  {room && (
                    <p className="mt-2 text-[12px] text-slate-500">
                      {OCCUPANCY_LABEL[room.occupancy]} · {GOVERNANCE_LABEL[room.governance]} · {room.block || '—'}
                    </p>
                  )}
                </Section>

                <Section
                  title="Acompanhantes (nome, CPF e nascimento obrigatórios)"
                  action={
                    editable ? (
                      <button
                        type="button"
                        onClick={() => setCompanions((c) => [...c, { id: `n${Date.now()}`, name: '', cpf: '', birthDate: '', ageGroup: 'Adulto' }])}
                        className="h-7 px-2 rounded-md border border-slate-200 bg-white text-[11px] font-semibold inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Adicionar
                      </button>
                    ) : undefined
                  }
                >
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <table className="w-full text-[12px]">
                      <thead className="bg-slate-100 border-b">
                        <tr className="text-left text-[10px] uppercase text-slate-500">
                          <th className="px-2 py-2">Nome *</th>
                          <th className="px-2 py-2">CPF *</th>
                          <th className="px-2 py-2">Nascimento *</th>
                          <th className="px-2 py-2">Faixa</th>
                          {editable && <th className="px-2 py-2 text-right">Ações</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {companions.length === 0 ? (
                          <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Nenhum acompanhante</td></tr>
                        ) : companions.map((c) => (
                          <tr key={c.id}>
                            <td className="px-2 py-1">
                              <input disabled={!editable} value={c.name} onChange={(e) => setCompanions((list) => list.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))} className="w-full h-8 rounded border border-slate-200 px-2 text-[12px]" />
                            </td>
                            <td className="px-2 py-1">
                              <input disabled={!editable} value={c.cpf} onChange={(e) => setCompanions((list) => list.map((x) => (x.id === c.id ? { ...x, cpf: e.target.value } : x)))} className="w-full h-8 rounded border border-slate-200 px-2 text-[12px]" placeholder="CPF" />
                            </td>
                            <td className="px-2 py-1">
                              <input type="date" disabled={!editable} value={c.birthDate} onChange={(e) => setCompanions((list) => list.map((x) => (x.id === c.id ? { ...x, birthDate: e.target.value } : x)))} className="w-full h-8 rounded border border-slate-200 px-2 text-[12px]" />
                            </td>
                            <td className="px-2 py-1">
                              <select disabled={!editable} value={c.ageGroup} onChange={(e) => setCompanions((list) => list.map((x) => (x.id === c.id ? { ...x, ageGroup: e.target.value as Companion['ageGroup'] } : x)))} className="h-8 rounded border border-slate-200 px-1 text-[12px]">
                                <option>Adulto</option><option>Criança</option><option>Bebê</option>
                              </select>
                            </td>
                            {editable && (
                              <td className="px-2 py-1 text-right">
                                <button type="button" onClick={() => setCompanions((list) => list.filter((x) => x.id !== c.id))} className="h-7 w-7 inline-flex items-center justify-center rounded border border-rose-200 text-rose-600">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              </div>
            )}

            {tab === 'valores' && (
              <Section title="Tarifário e valores">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Valor total (R$)">
                    <input type="number" disabled={!editable} value={draft.totalAmount} onChange={(e) => setDraft({ ...draft, totalAmount: Number(e.target.value) })} className={inputCls} />
                  </Field>
                  <Field label="Já pago (R$)">
                    <input type="number" disabled={!editable} value={draft.paidAmount} onChange={(e) => setDraft({ ...draft, paidAmount: Number(e.target.value) })} className={inputCls} />
                  </Field>
                  <Field label="Saldo">
                    <div className={cn('h-9 flex items-center text-[13px] font-semibold', balance > 0.01 ? 'text-rose-600' : 'text-emerald-600')}>
                      {formatBRL(balance)}
                    </div>
                  </Field>
                </div>
                {account && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[12px] space-y-1">
                    <p className="font-semibold text-slate-700">Conta vinculada</p>
                    <p className="text-slate-500">Status: {account.status} · Aberta em {formatDateBR(account.openedAt)}</p>
                    <button type="button" onClick={() => setShowAccount(true)} className="mt-1 text-blue-600 font-medium hover:underline">
                      Abrir extrato da conta →
                    </button>
                  </div>
                )}
              </Section>
            )}

            {tab === 'pensoes' && <PensionTab checkIn={draft.checkIn} checkOut={draft.checkOut} editable={editable} />}

            {tab === 'obs' && (
              <Section title="Observação">
                <textarea disabled={!editable} value={draft.notes || ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={6} className="w-full rounded-lg border border-slate-200 p-3 text-[13px]" />
              </Section>
            )}

            {tab === 'voucher' && (
              <Section title="Voucher">
                <p className="text-[13px] text-slate-600 mb-3">Voucher {draft.code} · {draft.guestName}</p>
                <button type="button" onClick={() => toast.message('Voucher: imprimir / salvar PDF')} className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[13px] font-medium inline-flex items-center gap-1.5">
                  <Ticket className="w-4 h-4" /> Gerar voucher
                </button>
              </Section>
            )}

            {tab === 'documentos' && (
              <Section title="Documentos">
                <p className="text-[13px] text-slate-500">Anexos da reserva (voucher, FNRH, comprovantes).</p>
              </Section>
            )}

            {tab === 'logs' && (
              <Section title="Logs da reserva">
                <p className="text-[13px] text-slate-500">Histórico de alterações e eventos desta reserva.</p>
              </Section>
            )}
          </div>

          <div className="px-4 py-3 border-t bg-white flex flex-wrap items-center gap-2 shrink-0">
            <button type="button" onClick={save} disabled={!editable} className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[13px] font-medium inline-flex items-center gap-1.5 disabled:opacity-40">
              <Save className="w-3.5 h-3.5" /> Salvar
            </button>
            {canCheckIn && (
              <button type="button" onClick={doCheckIn} className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-emerald-700">
                <LogIn className="w-3.5 h-3.5" /> Check-in
              </button>
            )}
            {canCheckOut && (
              <button type="button" onClick={doCheckOut} className="h-9 px-3 rounded-lg bg-rose-600 text-white text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-rose-700">
                <LogOut className="w-3.5 h-3.5" /> Check-out
              </button>
            )}
            {isInHouse && account && (
              <button type="button" onClick={() => setShowAccount(true)} className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[13px] font-medium inline-flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" /> Conta
              </button>
            )}
            <div className="ml-auto">
              <button type="button" onClick={onClose} className="h-9 px-3 rounded-lg border border-slate-200 text-[13px] font-medium">
                Fechar
              </button>
            </div>
          </div>
        </div>
      </Overlay>
    </>
  );
}
