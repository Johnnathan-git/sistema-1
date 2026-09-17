import { useEffect, useMemo, useState } from 'react';
import { usePms } from '@/lib/pms-store';
import { AccountModal } from '@/components/uos/AccountModal';
import { PensionTab } from '@/components/uos/PensionTab';
import {
  accountBalance,
  formatBRL,
  GOVERNANCE_LABEL,
  OCCUPANCY_LABEL,
  RES_STATUS_LABEL,
  type Reservation,
  type RoomType,
} from '@/lib/pms-types';
import { cn } from '@/lib/utils';
import { IdCard, LogIn, LogOut, Pencil, Plus, Save, Search, Ticket, Trash2, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';

const ROOM_TYPES: RoomType[] = ['Standard', 'Superior', 'Apartamento', 'Chalé Master', 'Bangalô', 'Suite'];
const inputCls =
  'w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:bg-slate-50';

type ModalTab = 'geral' | 'obs' | 'pensoes' | 'voucher' | 'documentos' | 'logs';
type Companion = { id: string; name: string; cpf: string; birthDate: string; ageGroup: 'Adulto' | 'Criança' | 'Bebê' };

const PENSION_OPTIONS = [
  { id: 'NN', label: 'NN – Nenhuma', value: 0 },
  { id: 'CA', label: 'CA – Café da manhã', value: 45 },
  { id: 'MP', label: 'MP – Meia pensão', value: 95 },
  { id: 'PC', label: 'PC – Pensão completa', value: 145 },
  { id: 'AI', label: 'AI – All inclusive', value: 220 },
];

function nightsBetween(ci: string, co: string) {
  try {
    const a = new Date(ci + 'T12:00:00').getTime();
    const b = new Date(co + 'T12:00:00').getTime();
    return Math.max(1, Math.round((b - a) / 86400000));
  } catch {
    return 1;
  }
}

function eachNight(ci: string, co: string): string[] {
  const out: string[] = [];
  try {
    const start = new Date(ci + 'T12:00:00');
    const end = new Date(co + 'T12:00:00');
    const cur = new Date(start);
    while (cur < end) {
      out.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
  } catch {
    /* ignore */
  }
  if (out.length === 0) out.push(ci);
  return out;
}

function formatDateShort(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}`;
}

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
  const [showGuestSearch, setShowGuestSearch] = useState(false);
  const [guestQuery, setGuestQuery] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [editingCompanionId, setEditingCompanionId] = useState<string | null>(null);
  const [titular, setTitular] = useState({ fullName: '', cpf: '', email: '', birthDate: '', cep: '', phone: '' });
  const [dailyRate, setDailyRate] = useState(0);
  const [discountPct, setDiscountPct] = useState(0);
  const [pensionId, setPensionId] = useState('NN');
  const [packageName, setPackageName] = useState('Fique 3 pague 2');
  const [ratePlan, setRatePlan] = useState('Utilizar valor do tarifário');
  const [garantNoShow, setGarantNoShow] = useState(false);
  const [taxTourism, setTaxTourism] = useState(false);

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
    setCompanions([]);
    setEditingCompanionId(null);
    const n = nightsBetween(res.checkIn, res.checkOut);
    setDailyRate(n > 0 ? Math.round((res.totalAmount / n) * 100) / 100 : res.totalAmount);
    setPackageName('Fique 3 pague 2');
  }, [res, guests]);

  const nights = draft ? nightsBetween(draft.checkIn, draft.checkOut) : 1;
  const nightDates = draft ? eachNight(draft.checkIn, draft.checkOut) : [];
  const pensionOpt = PENSION_OPTIONS.find((p) => p.id === pensionId) || PENSION_OPTIONS[0];
  const pensionPerDay = pensionOpt.value;

  const dayLines = useMemo(() => {
    return nightDates.map((d) => {
      const disc = (dailyRate * discountPct) / 100;
      const diaria = Math.max(0, Math.round((dailyRate - disc) * 100) / 100);
      const pensao = pensionPerDay;
      const total = Math.round((diaria + pensao) * 100) / 100;
      return { date: d, diaria, pensao, total };
    });
  }, [nightDates, dailyRate, discountPct, pensionPerDay]);

  const periodTotal = useMemo(() => dayLines.reduce((s, l) => s + l.total, 0), [dayLines]);

  const filteredGuests = useMemo(() => {
    const q = guestQuery.trim().toLowerCase();
    if (!q) return guests.slice(0, 12);
    return guests
      .filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          (g.document || '').toLowerCase().includes(q) ||
          (g.email || '').toLowerCase().includes(q) ||
          (g.phone || '').toLowerCase().includes(q)
      )
      .slice(0, 15);
  }, [guests, guestQuery]);

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
    const next = {
      ...draft,
      guestName: titular.fullName.trim() || draft.guestName,
      adults: draft.adults,
      children: draft.children,
    };
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

    const expectedAdults = draft.adults;
    const expectedChildren = draft.children;
    const expectedCompanions = Math.max(0, expectedAdults - 1) + expectedChildren;
    const filledAdults = 1 + companions.filter((c) => c.ageGroup === 'Adulto' && c.name.trim()).length;
    const filledChildren = companions.filter((c) => c.ageGroup !== 'Adulto' && c.name.trim()).length;

    if (companions.length !== expectedCompanions) {
      missing.push(
        `Qtd de acompanhantes (${companions.length}) diferente do esperado (${expectedCompanions}) — ajuste AD/CH ou inclua os hóspedes`
      );
    }
    for (const c of companions) {
      if (!c.name.trim()) missing.push('Nome do acompanhante');
      if (!c.cpf.trim()) missing.push(`CPF do acompanhante (${c.name || '—'})`);
      if (!c.birthDate) missing.push(`Nascimento do acompanhante (${c.name || '—'})`);
    }
    if (filledAdults !== expectedAdults || filledChildren !== expectedChildren) {
      missing.push(
        `Informe todos os hóspedes: reserva ${expectedAdults} AD / ${expectedChildren} CH (preenchido ${filledAdults} AD / ${filledChildren} CH)`
      );
    }

    if (missing.length) {
      toast.error(`Preencha antes do check-in: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`);
      return;
    }
    const adults = expectedAdults;
    const children = expectedChildren;
    const next = {
      ...draft,
      guestName: titular.fullName.trim(),
      adults,
      children,
      fnrhFilled: true,
      totalAmount: draft.totalAmount,
    };
    setDraft(next);
    upsertReservation(next);
    const r = checkIn(next.id);
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

  const pickGuest = (g: { id: string; name: string; document?: string; email?: string; phone?: string }) => {
    setTitular({
      fullName: g.name,
      cpf: g.document || '',
      email: g.email || '',
      birthDate: '',
      cep: '',
      phone: g.phone || '',
    });
    setDraft({ ...draft, guestName: g.name, guestId: g.id });
    setShowGuestSearch(false);
    setGuestQuery('');
    toast.success(`Titular: ${g.name}`);
  };

  const tabs: { id: ModalTab; label: string }[] = [
    { id: 'geral', label: 'Geral' },
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

      {showGuestSearch && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-900/50" onClick={() => { setShowGuestSearch(false); setGuestQuery(''); }} aria-label="Fechar" />
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[14px] font-semibold">Buscar hóspede cadastrado</p>
                <button type="button" onClick={() => { setShowGuestSearch(false); setGuestQuery(''); }} className="h-8 w-8 rounded-lg hover:bg-slate-100 inline-flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  autoFocus
                  value={guestQuery}
                  onChange={(e) => setGuestQuery(e.target.value)}
                  placeholder="Digite nome ou CPF…"
                  className="w-full h-10 rounded-lg border border-slate-200 pl-9 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {filteredGuests.length === 0 ? (
                <p className="px-4 py-8 text-center text-slate-400 text-[13px]">Nenhum hóspede encontrado</p>
              ) : (
                filteredGuests.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => pickGuest(g)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-[13px]"
                  >
                    <p className="font-medium text-slate-800">{g.name}</p>
                    <p className="text-[11px] text-slate-500">{g.document || '—'} · {g.email || '—'}</p>
                  </button>
                ))
              )}
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
              <span className={cn('inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold mt-1', isInHouse ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-white border border-white/30')}>
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
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-8 space-y-3">
                  <Section title="Dados gerais">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <Field label="Número"><input disabled value={draft.code} className={inputCls} /></Field>
                      <Field label="Status"><div className="h-9 flex items-center text-[13px] font-medium">{RES_STATUS_LABEL[draft.status]}</div></Field>
                      <Field label="Check-in">
                        <input type="date" disabled={!editable || isInHouse} value={draft.checkIn} onChange={(e) => setDraft({ ...draft, checkIn: e.target.value })} className={inputCls} />
                      </Field>
                      <Field label="Horário CI">
                        <input disabled={!editable || isInHouse} defaultValue="15:00" className={inputCls} />
                      </Field>
                      <Field label="Check-out">
                        <input type="date" disabled={!editable} value={draft.checkOut} onChange={(e) => setDraft({ ...draft, checkOut: e.target.value })} className={inputCls} />
                      </Field>
                      <Field label="Horário CO">
                        <input disabled={!editable} defaultValue="11:00" className={inputCls} />
                      </Field>
                      <Field label="Grupo">
                        <input disabled={!editable} defaultValue="" placeholder="—" className={inputCls} />
                      </Field>
                      <Field label="Evento">
                        <input disabled={!editable} defaultValue="" placeholder="—" className={inputCls} />
                      </Field>
                    </div>
                  </Section>

                  <Section title="Hóspede titular">
                    <div className="flex items-start gap-2 mb-2">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <Field label="Nome">
                          <div className="flex gap-1">
                            <input
                              disabled={!editable}
                              value={titular.fullName}
                              onChange={(e) => {
                                setTitular({ ...titular, fullName: e.target.value });
                                setDraft({ ...draft, guestName: e.target.value });
                              }}
                              className={inputCls}
                            />
                            <button
                              type="button"
                              onClick={() => setShowFicha(true)}
                              className="h-9 w-9 shrink-0 rounded-lg bg-[#1d4ed8] text-white inline-flex items-center justify-center hover:bg-blue-700"
                              title="Ficha de hospedagem (FNRH)"
                            >
                              <IdCard className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={!editable}
                              onClick={() => { setShowGuestSearch(true); setGuestQuery(''); }}
                              className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 bg-white text-slate-700 inline-flex items-center justify-center hover:bg-slate-50 disabled:opacity-40"
                              title="Buscar hóspede cadastrado"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </Field>
                        <Field label="E-mail">
                          <input disabled={!editable} type="email" value={titular.email} onChange={(e) => setTitular({ ...titular, email: e.target.value })} className={inputCls} />
                        </Field>
                        <Field label="Cidade / UF">
                          <input disabled={!editable} defaultValue="" placeholder="—" className={inputCls} />
                        </Field>
                        <Field label="CEP">
                          <input disabled={!editable} value={titular.cep} onChange={(e) => setTitular({ ...titular, cep: e.target.value })} className={inputCls} placeholder="00000-000" />
                        </Field>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 border-t border-slate-100 pt-2.5 mt-1">
                      <Field label="CPF *">
                        <input disabled={!editable} value={titular.cpf} onChange={(e) => setTitular({ ...titular, cpf: e.target.value })} className={inputCls} placeholder="000.000.000-00" />
                      </Field>
                      <Field label="Nascimento *">
                        <input disabled={!editable} type="date" value={titular.birthDate} onChange={(e) => setTitular({ ...titular, birthDate: e.target.value })} className={inputCls} />
                      </Field>
                      <Field label="Celular *">
                        <input disabled={!editable} value={titular.phone} onChange={(e) => setTitular({ ...titular, phone: e.target.value })} className={inputCls} placeholder="(00) 00000-0000" />
                      </Field>
                    </div>
                  </Section>

                  <Section title="Acomodações">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <Field label="Tipo UH">
                        <select disabled={!editable || isInHouse} value={draft.roomType} onChange={(e) => setDraft({ ...draft, roomType: e.target.value as RoomType })} className={inputCls}>
                          {ROOM_TYPES.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
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
                            <option key={r.id} value={r.id}>
                              {r.number} · {r.type} ({OCCUPANCY_LABEL[r.occupancy]})
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Adultos">
                        <input
                          type="number"
                          min={1}
                          disabled={!editable || isInHouse}
                          value={draft.adults}
                          onChange={(e) => {
                            const adults = Math.max(1, Number(e.target.value) || 1);
                            setDraft({ ...draft, adults });
                          }}
                          className={inputCls}
                        />
                      </Field>
                      <Field label="Crianças">
                        <input
                          type="number"
                          min={0}
                          disabled={!editable || isInHouse}
                          value={draft.children}
                          onChange={(e) => {
                            const children = Math.max(0, Number(e.target.value) || 0);
                            setDraft({ ...draft, children });
                          }}
                          className={inputCls}
                        />
                      </Field>
                    </div>
                    {room && (
                      <p className="mt-2 text-[12px] text-slate-500">
                        {OCCUPANCY_LABEL[room.occupancy]} · {GOVERNANCE_LABEL[room.governance]} · {room.block || '—'}
                      </p>
                    )}
                  </Section>

                  <Section
                    title="Acompanhantes"
                    action={
                      editable ? (
                        <button
                          type="button"
                          onClick={() => {
                            const id = `n${Date.now()}`;
                            setCompanions((c) => [...c, { id, name: '', cpf: '', birthDate: '', ageGroup: 'Adulto' }]);
                            setEditingCompanionId(id);
                          }}
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
                            <tr>
                              <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                                Nenhum acompanhante
                              </td>
                            </tr>
                          ) : (
                            companions.map((c) => {
                              const rowEditable = editable && (editingCompanionId === c.id || !c.name.trim());
                              return (
                              <tr key={c.id} className={editingCompanionId === c.id ? 'bg-blue-50/60' : undefined}>
                                <td className="px-2 py-1">
                                  <input disabled={!rowEditable} value={c.name} onChange={(e) => setCompanions((list) => list.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))} className="w-full h-8 rounded border border-slate-200 px-2 text-[12px] disabled:bg-slate-50" placeholder="Nome completo" />
                                </td>
                                <td className="px-2 py-1">
                                  <input disabled={!rowEditable} value={c.cpf} onChange={(e) => setCompanions((list) => list.map((x) => (x.id === c.id ? { ...x, cpf: e.target.value } : x)))} className="w-full h-8 rounded border border-slate-200 px-2 text-[12px] disabled:bg-slate-50" placeholder="CPF" />
                                </td>
                                <td className="px-2 py-1">
                                  <input type="date" disabled={!rowEditable} value={c.birthDate} onChange={(e) => setCompanions((list) => list.map((x) => (x.id === c.id ? { ...x, birthDate: e.target.value } : x)))} className="w-full h-8 rounded border border-slate-200 px-2 text-[12px] disabled:bg-slate-50" />
                                </td>
                                <td className="px-2 py-1">
                                  <select disabled={!rowEditable} value={c.ageGroup} onChange={(e) => setCompanions((list) => list.map((x) => (x.id === c.id ? { ...x, ageGroup: e.target.value as Companion['ageGroup'] } : x)))} className="h-8 rounded border border-slate-200 px-1 text-[12px] disabled:bg-slate-50">
                                    <option>Adulto</option>
                                    <option>Criança</option>
                                    <option>Bebê</option>
                                  </select>
                                </td>
                                {editable && (
                                  <td className="px-2 py-1 text-right">
                                    <div className="inline-flex items-center gap-1">
                                      <button
                                        type="button"
                                        title={rowEditable ? 'Concluir edição' : 'Editar'}
                                        onClick={() => setEditingCompanionId(editingCompanionId === c.id ? null : c.id)}
                                        className="h-7 w-7 inline-flex items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button type="button" title="Excluir" onClick={() => { setCompanions((list) => list.filter((x) => x.id !== c.id)); setEditingCompanionId((id) => (id === c.id ? null : id)); }} className="h-7 w-7 inline-flex items-center justify-center rounded border border-rose-200 text-rose-600">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      Reserva: {draft.adults} adulto(s) · {draft.children} criança(s). Informe todos os acompanhantes (ou ajuste AD/CH) antes do check-in.
                    </p>
                  </Section>
                </div>

                <div className="lg:col-span-4 space-y-3">
                  <Section title="Hospedagem por empresa">
                    <div className="space-y-2">
                      <Field label="Nome">
                        <input disabled={!editable} defaultValue="" placeholder="—" className={inputCls} />
                      </Field>
                      <Field label="Contrato">
                        <input disabled={!editable} defaultValue="" placeholder="—" className={inputCls} />
                      </Field>
                      <Field label="Voucher empr.">
                        <input disabled={!editable} defaultValue="" placeholder="—" className={inputCls} />
                      </Field>
                    </div>
                  </Section>

                  <Section title="Tarifário">
                    <div className="space-y-2.5">
                      <Field label="Pacote">
                        <input disabled value={packageName || '—'} className={inputCls} />
                      </Field>

                      <Field label="Pensão">
                        <input disabled value={pensionOpt.label} className={inputCls} />
                      </Field>

                      <Field label="Diária base (R$)">
                        <input disabled value={formatBRL(dailyRate)} className={inputCls} />
                      </Field>

                      <Field label="Desconto (%)">
                        <input disabled value={String(discountPct)} className={inputCls} />
                      </Field>

                      <div className="flex flex-col gap-1.5 pt-1 text-[12px] text-slate-600">
                        <p>{garantNoShow ? '✓' : '○'} Garante No-Show</p>
                        <p>{taxTourism ? '✓' : '○'} Cobrar taxa de turismo</p>
                        <p className="text-[10px] text-slate-400 pt-1">Tarifário definido pelo comercial — somente leitura</p>
                      </div>

                      <div className="rounded-lg border border-slate-200 overflow-hidden">
                        <div className="px-2 py-1.5 bg-slate-50 border-b text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
                          Diárias do período ({nights})
                        </div>
                        <div className="max-h-44 overflow-y-auto">
                          <table className="w-full text-[11px]">
                            <thead className="bg-white sticky top-0 border-b">
                              <tr className="text-left text-[10px] text-slate-400">
                                <th className="px-2 py-1">Data</th>
                                <th className="px-2 py-1 text-right">Diária</th>
                                <th className="px-2 py-1 text-right">Pensão</th>
                                <th className="px-2 py-1 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {dayLines.map((l) => (
                                <tr key={l.date}>
                                  <td className="px-2 py-1 tabular-nums">{formatDateShort(l.date)}</td>
                                  <td className="px-2 py-1 text-right tabular-nums">{formatBRL(l.diaria)}</td>
                                  <td className="px-2 py-1 text-right tabular-nums">{formatBRL(l.pensao)}</td>
                                  <td className="px-2 py-1 text-right tabular-nums font-medium">{formatBRL(l.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t">
                              <tr className="font-semibold">
                                <td className="px-2 py-1.5" colSpan={3}>Total período</td>
                                <td className="px-2 py-1.5 text-right tabular-nums">{formatBRL(periodTotal)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-2 space-y-1 text-[12px]">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Total reserva</span>
                          <span className="font-semibold tabular-nums">{formatBRL(draft.totalAmount)}</span>
                        </div>
                      </div>
                    </div>
                  </Section>
                </div>
              </div>
            )}

            {tab === 'pensoes' && <PensionTab checkIn={draft.checkIn} checkOut={draft.checkOut} editable={editable} />}
            {tab === 'obs' && (
              <Section title="Observação">
                <textarea disabled={!editable} value={draft.notes || ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={6} className="w-full rounded-lg border border-slate-200 p-3 text-[13px]" />
              </Section>
            )}
            {tab === 'voucher' && (
              <Section title="Voucher">
                <p className="text-[13px] text-slate-600 mb-3">
                  Voucher {draft.code} · {draft.guestName}
                </p>
                <button type="button" onClick={() => toast.message('Voucher: imprimir / salvar PDF')} className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[13px] font-medium inline-flex items-center gap-1.5">
                  <Ticket className="w-4 h-4" /> Gerar voucher
                </button>
              </Section>
            )}
            {tab === 'documentos' && (
              <Section title="Documentos">
                <p className="text-[13px] text-slate-500">Anexos da reserva (voucher, comprovantes, FNRH digital).</p>
              </Section>
            )}
            {tab === 'logs' && (
              <Section title="Logs">
                <p className="text-[13px] text-slate-500">Histórico de alterações desta reserva.</p>
              </Section>
            )}
          </div>

          <div className="px-4 py-3 border-t bg-white flex flex-wrap items-center gap-2 shrink-0">
            {canCheckIn && (
              <button type="button" onClick={doCheckIn} className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-emerald-700">
                <LogIn className="w-3.5 h-3.5" /> Check-in
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowAccount(true)}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[13px] font-medium inline-flex items-center gap-1.5 hover:bg-slate-50"
              title="Consumos, pagamentos e diárias"
            >
              <Wallet className="w-3.5 h-3.5" /> Conta
            </button>
            <button type="button" onClick={save} disabled={!editable} className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[13px] font-medium inline-flex items-center gap-1.5 disabled:opacity-40">
              <Save className="w-3.5 h-3.5" /> Salvar
            </button>
            {canCheckOut && (
              <button type="button" onClick={doCheckOut} className="h-9 px-3 rounded-lg bg-rose-600 text-white text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-rose-700">
                <LogOut className="w-3.5 h-3.5" /> Check-out
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
