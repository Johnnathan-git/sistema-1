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
import {
  Car,
  ClipboardList,
  Eye,
  FileText,
  History,
  IdCard,
  LogIn,
  LogOut,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Ticket,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

const ROOM_TYPES: RoomType[] = ['Standard', 'Superior', 'Apartamento', 'Chalé Master', 'Bangalô', 'Suite'];
const ORIGINS: Reservation['origin'][] = ['direto', 'booking', 'expedia', 'telefone', 'walkin'];
const inputCls =
  'w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-500';

type ModalTab = 'geral' | 'valores' | 'obs' | 'pensoes' | 'voucher' | 'documentos' | 'logs';
type Companion = { id: string; name: string; ageGroup: 'Adulto' | 'Criança' | 'Bebê'; incognito: boolean };

function mockDocs(res: Reservation) {
  return [
    { id: 'd1', name: `Voucher_${res.code}.pdf`, type: 'Voucher', size: '124 KB', uploadedAt: res.checkIn + ' 09:12', uploadedBy: 'Sistema' },
    { id: 'd2', name: 'Comprovante_PIX_sinal.pdf', type: 'Comprovante', size: '86 KB', uploadedAt: res.checkIn + ' 10:05', uploadedBy: 'Operador JH' },
    { id: 'd3', name: 'FNRH_digital.pdf', type: 'FNRH', size: '210 KB', uploadedAt: res.checkIn + ' 14:22', uploadedBy: 'Operador JH' },
  ];
}

function mockLogs(res: Reservation) {
  const logs = [
    { id: 'l1', at: '2026-09-10 11:34', user: 'Operador JH', action: 'Reserva criada', detail: `Canal ${res.origin} · ${res.roomType}` },
    { id: 'l2', at: '2026-09-10 11:35', user: 'Sistema', action: 'Confirmação automática', detail: 'Status → Confirmada' },
    { id: 'l3', at: '2026-09-12 16:40', user: 'Operador JH', action: 'UH atribuída', detail: res.roomNumber || 'A definir' },
    { id: 'l4', at: res.checkIn + ' 09:12', user: 'Sistema', action: 'Voucher gerado', detail: `Voucher_${res.code}.pdf` },
  ];
  if (res.paidAmount > 0) logs.push({ id: 'l5', at: res.checkIn + ' 10:05', user: 'Operador JH', action: 'Pagamento registrado', detail: formatBRL(res.paidAmount) });
  if (res.fnrhFilled) logs.push({ id: 'l6', at: res.checkIn + ' 14:20', user: 'Operador JH', action: 'FNRH preenchida', detail: 'Pré-check-in concluído' });
  if (res.status === 'checkin') logs.push({ id: 'l7', at: res.checkIn + ' 15:02', user: 'Operador JH', action: 'Check-in realizado', detail: `UH ${res.roomNumber} · Conta aberta` });
  if (res.status === 'checkout') logs.push({ id: 'l8', at: res.checkOut + ' 11:00', user: 'Operador JH', action: 'Check-out realizado', detail: 'UH liberada · status Sujo' });
  return logs;
}

export function ReservationModal({ reservationId, onClose }: { reservationId: string; onClose: () => void }) {
  const { reservations, rooms, accounts, guests, upsertReservation, cancelReservation, markFnrh, checkIn, checkOut, hotel } = usePms();
  const res = reservations.find((r) => r.id === reservationId);
  const [tab, setTab] = useState<ModalTab>('geral');
  const [draft, setDraft] = useState<Reservation | null>(null);
  const [showAccount, setShowAccount] = useState(false);
  const [showFicha, setShowFicha] = useState(false);
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [editingCompId, setEditingCompId] = useState<string | null>(null);

  useEffect(() => {
    if (res) {
      setDraft({ ...res });
      const list: Companion[] = [];
      for (let i = 1; i < res.adults; i++) list.push({ id: `a${i}`, name: `Acompanhante adulto ${i}`, ageGroup: 'Adulto', incognito: false });
      for (let i = 1; i <= res.children; i++) list.push({ id: `c${i}`, name: `Acompanhante criança ${i}`, ageGroup: 'Criança', incognito: false });
      setCompanions(list);
    }
  }, [res]);

  if (!res || !draft) {
    return (
      <Overlay onClose={onClose}>
        <div className="bg-white rounded-2xl p-8 shadow-xl"><p className="text-slate-500">Reserva não encontrada</p></div>
      </Overlay>
    );
  }

  const room = rooms.find((r) => r.id === draft.roomId);
  const guest = guests.find((g) => g.id === draft.guestId);
  const account = draft.accountId ? accounts.find((a) => a.id === draft.accountId) : accounts.find((a) => a.reservationId === draft.id);
  const balance = account ? accountBalance(account) : draft.totalAmount - draft.paidAmount;
  const isInHouse = draft.status === 'checkin';
  const canCheckIn = draft.status === 'confirmada' || draft.status === 'pendente';
  const canCheckOut = draft.status === 'checkin';
  const editable = draft.status !== 'cancelada' && draft.status !== 'checkout';
  const docs = mockDocs(draft);
  const logs = mockLogs(draft);

  const save = () => {
    const adults = 1 + companions.filter((c) => c.ageGroup === 'Adulto').length;
    const children = companions.filter((c) => c.ageGroup === 'Criança' || c.ageGroup === 'Bebê').length;
    const next = { ...draft, adults, children };
    setDraft(next);
    upsertReservation(next);
    toast.success('Alterações salvas');
  };

  const doCheckIn = () => {
    save();
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
      {showAccount && <AccountModal accountId={account?.id} reservationId={draft.id} onClose={() => setShowAccount(false)} />}

      {showFicha && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-900/50" onClick={() => setShowFicha(false)} aria-label="Fechar" />
          <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-3.5 bg-[#0c2340] text-white flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-sky-300 font-semibold">FNRH · Ficha de hospedagem</p>
                <p className="font-semibold">{draft.guestName}</p>
              </div>
              <button type="button" onClick={() => setShowFicha(false)} className="h-8 w-8 rounded-lg border border-white/20 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 text-[13px]">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nome completo"><input className={inputCls} defaultValue={draft.guestName} /></Field>
                <Field label="CPF / Documento"><input className={inputCls} defaultValue={guest?.document || ''} /></Field>
                <Field label="Data nascimento"><input type="date" className={inputCls} /></Field>
                <Field label="Nacionalidade"><input className={inputCls} defaultValue="Brasileira" /></Field>
                <Field label="Profissão"><input className={inputCls} /></Field>
                <Field label="Estado civil"><select className={inputCls}><option>Solteiro(a)</option><option>Casado(a)</option><option>Outro</option></select></Field>
                <Field label="Telefone"><input className={inputCls} defaultValue={guest?.phone || ''} /></Field>
                <Field label="E-mail"><input className={inputCls} defaultValue={guest?.email || ''} /></Field>
                <Field label="Endereço"><input className={inputCls} /></Field>
                <Field label="Cidade / UF"><input className={inputCls} /></Field>
                <Field label="CEP"><input className={inputCls} /></Field>
                <Field label="Placa veículo"><input className={inputCls} value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())} /></Field>
                <Field label="Motivo da viagem"><select className={inputCls}><option>Lazer</option><option>Negócios</option><option>Evento</option><option>Outro</option></select></Field>
                <Field label="Próximo destino"><input className={inputCls} /></Field>
              </div>
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" className="rounded" defaultChecked={draft.fnrhFilled} /> Confirmo o preenchimento da FNRH
              </label>
            </div>
            <div className="px-5 py-3 border-t bg-slate-50 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowFicha(false)} className="h-9 px-3 rounded-lg border text-[13px]">Cancelar</button>
              <button type="button" onClick={() => { markFnrh(draft.id); setDraft({ ...draft, fnrhFilled: true }); setShowFicha(false); toast.success('Ficha de hospedagem salva'); }} className="h-9 px-4 rounded-lg bg-[#1d4ed8] text-white text-[13px] font-semibold">Salvar ficha</button>
            </div>
          </div>
        </div>
      )}

      <Overlay onClose={onClose}>
        <div className="bg-[#f0f2f5] rounded-2xl shadow-2xl w-full max-w-5xl h-[min(860px,90vh)] flex flex-col overflow-hidden border border-slate-300">
          <div className="px-5 py-3.5 border-b border-[#0a1c33] bg-[#0c2340] text-white flex items-start justify-between gap-3 shrink-0">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-300">Reserva · {draft.code}</p>
              <h2 className="text-lg font-semibold text-white leading-tight mt-0.5">{draft.guestName}</h2>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <span className={cn('inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold', isInHouse ? 'bg-emerald-500 text-white' : draft.status === 'confirmada' ? 'bg-white/15 text-white' : 'bg-amber-400 text-amber-950')}>{RES_STATUS_LABEL[draft.status]}</span>
                {draft.roomNumber && <span className="text-[11px] text-sky-200/80 font-medium">{draft.roomNumber} · {draft.roomType}</span>}
              </div>
            </div>
            <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg border border-white/20 flex items-center justify-center text-white/80 hover:bg-white/10"><X className="w-4 h-4" /></button>
          </div>

          <div className="px-3 sm:px-5 border-b border-slate-200 bg-white flex gap-0.5 overflow-x-auto shrink-0">
            {([['geral', 'Geral'], ['valores', 'Tarifa'], ['pensoes', 'Pensões'], ['obs', 'Observação'], ['voucher', 'Voucher'], ['documentos', 'Documentos'], ['logs', 'Logs']] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setTab(id)} className={cn('px-3 py-2.5 text-[13px] border-b-2 -mb-px whitespace-nowrap', tab === id ? 'border-blue-600 text-blue-700 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-800')}>{label}</button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
            {tab === 'geral' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-8 space-y-3">
                  <Section title="Dados gerais">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <Field label="Número"><input disabled value={draft.code} className={inputCls} /></Field>
                      <Field label="Status"><div className="h-9 flex items-center text-[13px] font-medium text-slate-700">{RES_STATUS_LABEL[draft.status]}</div></Field>
                      <Field label="Check-in"><input type="date" disabled={!editable || isInHouse} value={draft.checkIn} onChange={(e) => setDraft({ ...draft, checkIn: e.target.value })} className={inputCls} /></Field>
                      <Field label="Horário CI"><input disabled={!editable || isInHouse} defaultValue="15:00" className={inputCls} /></Field>
                      <Field label="Check-out"><input type="date" disabled={!editable} value={draft.checkOut} onChange={(e) => setDraft({ ...draft, checkOut: e.target.value })} className={inputCls} /></Field>
                      <Field label="Horário CO"><input disabled={!editable} defaultValue="11:00" className={inputCls} /></Field>
                      <Field label="Grupo"><input disabled={!editable} defaultValue="" placeholder="—" className={inputCls} /></Field>
                      <Field label="Evento"><input disabled={!editable} defaultValue="" placeholder="—" className={inputCls} /></Field>
                    </div>
                  </Section>

                  <Section title="Hóspede" action={<button type="button" onClick={() => setShowFicha(true)} className="h-7 px-2 rounded-md bg-[#1d4ed8] text-white text-[11px] font-semibold inline-flex items-center gap-1 hover:bg-blue-700" title="Ficha de hospedagem (FNRH)"><IdCard className="w-3.5 h-3.5" /> Ficha</button>}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <Field label="Nome">
                        <div className="flex gap-1.5">
                          <input disabled={!editable} value={draft.guestName} onChange={(e) => setDraft({ ...draft, guestName: e.target.value })} className={inputCls} />
                          <button type="button" onClick={() => setShowFicha(true)} className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-[#1d4ed8] hover:bg-blue-50" title="Ficha de hospedagem"><ClipboardList className="w-4 h-4" /></button>
                        </div>
                      </Field>
                      <Field label="Documento / CPF"><input disabled value={guest?.document || '—'} className={inputCls} /></Field>
                      <Field label="Cidade"><input disabled={!editable} defaultValue="—" className={inputCls} /></Field>
                      <Field label="CEP"><input disabled={!editable} defaultValue="—" className={inputCls} /></Field>
                      <Field label="Placa veículo">
                        <div className="relative">
                          <Car className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input disabled={!editable} value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())} placeholder="ABC1D23" className={inputCls + ' pl-8'} />
                        </div>
                      </Field>
                    </div>
                  </Section>

                  <Section title="Reservante">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <Field label="Nome"><input disabled={!editable} value={draft.guestName} className={inputCls} /></Field>
                      <Field label="CPF"><input disabled value={guest?.document || '—'} className={inputCls} /></Field>
                      <Field label="Fone 1"><input disabled value={guest?.phone || '—'} className={inputCls} /></Field>
                      <Field label="Fone 2"><input disabled={!editable} defaultValue="" placeholder="—" className={inputCls} /></Field>
                      <Field label="E-mail"><input disabled value={guest?.email || '—'} className={inputCls} /></Field>
                    </div>
                  </Section>

                  <Section title="Acomodações">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <Field label="Tipo UH"><select disabled={!editable || isInHouse} value={draft.roomType} onChange={(e) => setDraft({ ...draft, roomType: e.target.value as RoomType })} className={inputCls}>{ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
                      <Field label="UH">
                        <select disabled={!editable || isInHouse} value={draft.roomId || ''} onChange={(e) => { const rm = rooms.find((r) => r.id === e.target.value); setDraft({ ...draft, roomId: rm?.id, roomNumber: rm?.number, roomType: (rm?.type as RoomType) || draft.roomType }); }} className={inputCls}>
                          <option value="">Sem UH</option>
                          {rooms.map((r) => <option key={r.id} value={r.id}>{r.number} · {r.type} ({OCCUPANCY_LABEL[r.occupancy]})</option>)}
                        </select>
                      </Field>
                      <Field label="Adultos"><input type="number" min={1} disabled value={1 + companions.filter((c) => c.ageGroup === 'Adulto').length} className={inputCls} title="Atualizado pelos acompanhantes" /></Field>
                      <Field label="Crianças"><input type="number" min={0} disabled value={companions.filter((c) => c.ageGroup === 'Criança' || c.ageGroup === 'Bebê').length} className={inputCls} title="Atualizado pelos acompanhantes" /></Field>
                    </div>
                    {room && (
                      <div className="mt-2.5 flex flex-wrap gap-2 text-[12px]">
                        <Info label="Ocupação" value={OCCUPANCY_LABEL[room.occupancy]} />
                        <Info label="Governança" value={GOVERNANCE_LABEL[room.governance]} />
                        <Info label="Andar" value={room.floor === 0 ? 'Térreo' : `${room.floor}º`} />
                        <Info label="Bloco" value={room.block || '—'} />
                      </div>
                    )}
                  </Section>

                  <Section
                    title="Acompanhantes"
                    action={editable ? (
                      <button type="button" onClick={() => { const id = `n${Date.now()}`; setCompanions((c) => [...c, { id, name: '', ageGroup: 'Adulto', incognito: false }]); setEditingCompId(id); }} className="h-7 px-2 rounded-md border border-slate-200 bg-white text-[11px] font-semibold inline-flex items-center gap-1 hover:bg-slate-50">
                        <Plus className="w-3.5 h-3.5" /> Adicionar
                      </button>
                    ) : undefined}
                  >
                    <p className="text-[11px] text-slate-500 mb-2">Titular: <span className="font-medium text-slate-700">{draft.guestName}</span> (dados na ficha FNRH). Abaixo somente acompanhantes.</p>
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                      <table className="w-full text-[12px]">
                        <thead className="bg-slate-100 border-b border-slate-200">
                          <tr className="text-left text-[10px] uppercase text-slate-500">
                            <th className="px-3 py-2 font-semibold">Nome</th>
                            <th className="px-3 py-2 font-semibold">Faixa etária</th>
                            <th className="px-3 py-2 font-semibold">Incógnito</th>
                            {editable && <th className="px-3 py-2 font-semibold text-right">Ações</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {companions.length === 0 ? (
                            <tr><td colSpan={editable ? 4 : 3} className="px-3 py-6 text-center text-slate-400">Nenhum acompanhante · clique em Adicionar</td></tr>
                          ) : companions.map((c) => (
                            <tr key={c.id}>
                              <td className="px-3 py-1.5">
                                {editingCompId === c.id && editable ? (
                                  <input autoFocus value={c.name} onChange={(e) => setCompanions((list) => list.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))} onBlur={() => setEditingCompId(null)} onKeyDown={(e) => e.key === 'Enter' && setEditingCompId(null)} className="w-full h-8 rounded border border-slate-200 px-2 text-[12px]" placeholder="Nome do acompanhante" />
                                ) : (
                                  <span className="font-medium">{c.name || '—'}</span>
                                )}
                              </td>
                              <td className="px-3 py-1.5">
                                {editable ? (
                                  <select value={c.ageGroup} onChange={(e) => setCompanions((list) => list.map((x) => (x.id === c.id ? { ...x, ageGroup: e.target.value as Companion['ageGroup'] } : x)))} className="h-8 rounded border border-slate-200 px-1 text-[12px]">
                                    <option>Adulto</option><option>Criança</option><option>Bebê</option>
                                  </select>
                                ) : c.ageGroup}
                              </td>
                              <td className="px-3 py-1.5">
                                {editable ? (
                                  <input type="checkbox" checked={c.incognito} onChange={(e) => setCompanions((list) => list.map((x) => (x.id === c.id ? { ...x, incognito: e.target.checked } : x)))} />
                                ) : c.incognito ? 'S' : 'N'}
                              </td>
                              {editable && (
                                <td className="px-3 py-1.5 text-right whitespace-nowrap">
                                  <button type="button" onClick={() => setEditingCompId(c.id)} className="h-7 w-7 inline-flex items-center justify-center rounded border border-slate-200 mr-1" title="Alterar"><Pencil className="w-3.5 h-3.5" /></button>
                                  <button type="button" onClick={() => setCompanions((list) => list.filter((x) => x.id !== c.id))} className="h-7 w-7 inline-flex items-center justify-center rounded border border-rose-200 text-rose-600" title="Remover"><Trash2 className="w-3.5 h-3.5" /></button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Section>

                  <Section title="Mais informações">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <Field label="Segmento mercado"><select disabled={!editable} defaultValue="particular" className={inputCls}><option value="particular">Particular</option><option value="corporativo">Corporativo</option><option value="evento">Evento</option></select></Field>
                      <Field label="Origem / canal"><select disabled={!editable} value={draft.origin} onChange={(e) => setDraft({ ...draft, origin: e.target.value as Reservation['origin'] })} className={inputCls}>{ORIGINS.map((o) => <option key={o} value={o}>{o}</option>)}</select></Field>
                      <Field label="Tipo hóspede"><select disabled={!editable} defaultValue="particular" className={inputCls}><option value="particular">Particular</option><option value="vip">VIP</option><option value="staff">Staff</option></select></Field>
                      <Field label="Meio comunicação"><select disabled={!editable} defaultValue="balcao" className={inputCls}><option value="balcao">Balcão do hotel</option><option value="telefone">Telefone</option><option value="email">E-mail</option><option value="site">Site</option><option value="ota">OTA</option></select></Field>
                    </div>
                  </Section>
                </div>

                <div className="lg:col-span-4 space-y-3">
                  <Section title="Tarifário / valor previsto">
                    <div className="space-y-2.5">
                      <Field label="Valor total (R$)"><input type="number" disabled={!editable} value={draft.totalAmount} onChange={(e) => setDraft({ ...draft, totalAmount: Number(e.target.value) })} className={inputCls} /></Field>
                      <Field label="Já pago (R$)"><input type="number" disabled={!editable} value={draft.paidAmount} onChange={(e) => setDraft({ ...draft, paidAmount: Number(e.target.value) })} className={inputCls} /></Field>
                      <Field label="Saldo"><div className={cn('h-9 flex items-center text-[13px] font-semibold', balance > 0.01 ? 'text-rose-600' : 'text-emerald-600')}>{formatBRL(balance)}</div></Field>
                      <Field label="Pensão"><select disabled={!editable} defaultValue="meia_almoco" className={inputCls}><option value="apenas">Apenas hospedagem</option><option value="cafe">Café da manhã</option><option value="meia_almoco">Meia pensão — almoço</option><option value="meia_jantar">Meia pensão — jantar</option><option value="completa">Pensão completa</option><option value="ai">All inclusive</option></select></Field>
                      <label className="flex items-center gap-2 text-[12px] text-slate-700"><input type="checkbox" disabled={!editable} defaultChecked className="rounded border-slate-300" /> Garante no-show</label>
                      <label className="flex items-center gap-2 text-[12px] text-slate-700"><input type="checkbox" disabled={!editable} className="rounded border-slate-300" /> Cobrar taxa de turismo</label>
                    </div>
                  </Section>
                  <Section title="Empresa / agente">
                    <div className="space-y-2.5">
                      <label className="flex items-center gap-2 text-[12px] text-slate-700"><input type="checkbox" disabled={!editable} className="rounded border-slate-300" /> Hospedagem por empresa</label>
                      <Field label="Empresa"><input disabled={!editable} defaultValue="" placeholder="—" className={inputCls} /></Field>
                      <Field label="Agente"><input disabled={!editable} defaultValue="" placeholder="—" className={inputCls} /></Field>
                      <Field label="Voucher empr."><input disabled={!editable} defaultValue="" placeholder="—" className={inputCls} /></Field>
                    </div>
                  </Section>
                </div>
              </div>
            )}

            {tab === 'valores' && (
              <Section title="Tarifário e valores">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Valor total (R$)"><input type="number" disabled={!editable} value={draft.totalAmount} onChange={(e) => setDraft({ ...draft, totalAmount: Number(e.target.value) })} className={inputCls} /></Field>
                  <Field label="Já pago (R$)"><input type="number" disabled={!editable} value={draft.paidAmount} onChange={(e) => setDraft({ ...draft, paidAmount: Number(e.target.value) })} className={inputCls} /></Field>
                  <Field label="Saldo"><div className={cn('h-9 flex items-center text-[13px] font-semibold', balance > 0.01 ? 'text-rose-600' : 'text-emerald-600')}>{formatBRL(balance)}</div></Field>
                </div>
              </Section>
            )}

            {tab === 'pensoes' && <PensionTab checkIn={draft.checkIn} checkOut={draft.checkOut} editable={editable} />}

            {tab === 'obs' && (
              <Section title="Observações da reserva">
                <textarea disabled={!editable} value={draft.notes || ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={8} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 min-h-[200px]" placeholder="Observações internas…" />
              </Section>
            )}

            {tab === 'voucher' && (
              <div className="space-y-4 min-h-[200px]">
                <button type="button" onClick={openVoucherPdf} className="h-9 px-3 rounded-lg bg-[#1d4ed8] text-white text-[13px] font-semibold inline-flex items-center gap-1.5"><Ticket className="w-3.5 h-3.5" /> Abrir voucher (PDF)</button>
              </div>
            )}

            {tab === 'documentos' && (
              <div className="space-y-3 min-h-[200px]">
                <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                  <table className="w-full text-[12px]">
                    <thead className="bg-slate-50 border-b"><tr className="text-left text-[10px] uppercase text-slate-400"><th className="px-3 py-2">Arquivo</th><th className="px-3 py-2">Tipo</th></tr></thead>
                    <tbody className="divide-y">{docs.map((d) => <tr key={d.id}><td className="px-3 py-2 font-medium">{d.name}</td><td className="px-3 py-2">{d.type}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'logs' && (
              <div className="space-y-2 min-h-[200px]">
                {logs.map((l) => (
                  <div key={l.id} className="rounded-xl border bg-white px-3 py-2 text-[12px]">
                    <p className="font-semibold">{l.action} <span className="text-slate-400 font-normal">{l.at}</span></p>
                    <p className="text-slate-600">{l.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-slate-200 bg-white flex flex-wrap gap-2 shrink-0 shadow-[0_-4px_12px_rgba(15,23,42,0.04)]">
            {editable && (
              <button type="button" onClick={save} className="h-9 px-3 rounded-lg bg-[#1d4ed8] text-white text-[13px] font-semibold inline-flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> Salvar
              </button>
            )}
            <button type="button" onClick={() => setShowAccount(true)} className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[13px] font-medium inline-flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Conta</button>
            <button type="button" onClick={openVoucherPdf} className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[13px] font-medium inline-flex items-center gap-1.5"><Ticket className="w-3.5 h-3.5" /> Voucher</button>
            <button type="button" onClick={() => setShowFicha(true)} className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[13px] font-medium inline-flex items-center gap-1.5"><IdCard className="w-3.5 h-3.5" /> Ficha</button>
            {canCheckIn && (
              <button type="button" onClick={doCheckIn} className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-[13px] font-semibold inline-flex items-center gap-1.5"><LogIn className="w-3.5 h-3.5" /> Check-in</button>
            )}
            {canCheckOut && (
              <button type="button" onClick={doCheckOut} className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[13px] font-semibold inline-flex items-center gap-1.5"><LogOut className="w-3.5 h-3.5" /> Check-out</button>
            )}
            {editable && !isInHouse && (
              <button type="button" onClick={() => { if (window.confirm('Cancelar esta reserva?')) { cancelReservation(draft.id); toast.message('Reserva cancelada'); onClose(); } }} className="h-9 px-3 rounded-lg border border-rose-200 text-rose-700 text-[13px] ml-auto">Cancelar</button>
            )}
            <button type="button" onClick={onClose} className="h-9 px-3 rounded-lg text-[13px] text-slate-600">Fechar</button>
          </div>
        </div>
      </Overlay>
    </>
  );
}

function buildVoucherHtml(r: Reservation, hotelName: string, document?: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Voucher ${r.code}</title></head><body style="font-family:system-ui;padding:32px"><p>${hotelName}</p><h1>Voucher</h1><p>${r.guestName} · ${r.code}</p><p>${formatDateBR(r.checkIn)} → ${formatDateBR(r.checkOut)}</p></body></html>`;
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" aria-label="Fechar" onClick={onClose} />
      <div className="relative z-10 w-full flex justify-center">{children}</div>
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-100 bg-[#0c2340]/[0.04] flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#0c2340]/85">{title}</p>
        {action}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1.5">
      <p className="text-[10px] text-slate-400 uppercase">{label}</p>
      <p className="text-[13px] font-medium text-slate-800">{value}</p>
    </div>
  );
}
