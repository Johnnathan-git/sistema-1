import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  CreditCard,
  Link2,
  Link2Off,
  Ban,
  Plus,
  Search,
  ShoppingBag,
  History,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePms } from '@/lib/pms-store';
import { getSession } from '@/lib/auth-store';
import { formatBRL } from '@/lib/pms-types';
import {
  type NfcCard,
  type NfcCardStatus,
  NFC_STATUS_LABEL,
  listCards,
  registerCard,
  linkCard,
  unlinkCard,
  blockCard,
  deleteCard,
  lookupByUid,
  registerCharge,
  listChargeLogs,
  normalizeUidHex,
  uidHexToDec,
  updateCard,
} from '@/lib/nfc-cards';

type Tab = 'cartoes' | 'vincular' | 'pdv' | 'movimentos';

function statusBadge(status: NfcCardStatus) {
  const map: Record<NfcCardStatus, string> = {
    disponivel: 'bg-slate-100 text-slate-700',
    ativo: 'bg-emerald-100 text-emerald-800',
    bloqueado: 'bg-rose-100 text-rose-800',
    perdido: 'bg-amber-100 text-amber-900',
  };
  return (
    <span className={cn('text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full', map[status])}>
      {NFC_STATUS_LABEL[status]}
    </span>
  );
}

function formatWhen(iso?: string) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function CardsModule() {
  const { hotel, reservations, accounts, addCharge } = usePms();
  const session = getSession();
  const [tab, setTab] = useState<Tab>('cartoes');
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const cards = useMemo(() => listCards(hotel.id), [hotel.id, tick]);
  const logs = useMemo(() => listChargeLogs(80), [tick]);

  const inHouse = useMemo(
    () => reservations.filter((r) => r.status === 'checkin'),
    [reservations],
  );

  const [uidInput, setUidInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const doRegister = () => {
    const res = registerCard({
      uidHex: uidInput,
      label: labelInput,
      hotelId: hotel.id,
    });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(`Cartão ${res.card.uidHex} cadastrado`);
    setUidInput('');
    setLabelInput('');
    setFormOpen(false);
    refresh();
  };

  const [linkCardId, setLinkCardId] = useState('');
  const [linkResId, setLinkResId] = useState('');

  const availableCards = cards.filter((c) => c.status === 'disponivel' || c.status === 'ativo');

  const doLink = () => {
    const resv = inHouse.find((r) => r.id === linkResId);
    if (!resv) {
      toast.error('Selecione um hóspede in-house');
      return;
    }
    const acc = accounts.find((a) => a.reservationId === resv.id && a.status !== 'quitada');
    const res = linkCard({
      cardId: linkCardId,
      reservationId: resv.id,
      guestId: resv.guestId,
      guestName: resv.guestName,
      roomNumber: resv.roomNumber,
      accountId: acc?.id || resv.accountId,
    });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(`Vinculado a ${resv.guestName} · UH ${resv.roomNumber || '—'}`);
    setLinkCardId('');
    setLinkResId('');
    refresh();
  };

  const [pdvUid, setPdvUid] = useState('');
  const [pdvDesc, setPdvDesc] = useState('');
  const [pdvAmount, setPdvAmount] = useState('');
  const [pdvLookup, setPdvLookup] = useState<ReturnType<typeof lookupByUid> | null>(null);

  const doLookup = () => {
    const r = lookupByUid(pdvUid);
    setPdvLookup(r);
    if (!r.card) toast.error(r.message);
    else if (!r.canCharge) toast.message(r.message);
    else toast.success(`${r.card.guestName} · UH ${r.card.roomNumber || '—'}`);
  };

  const doCharge = () => {
    const amount = parseFloat(pdvAmount.replace(/\./g, '').replace(',', '.')) || 0;
    const res = registerCharge({
      uidHex: pdvUid,
      description: pdvDesc,
      amount,
      operator: session?.displayName || 'Operador',
      source: 'pdv_rapido',
    });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    const card = lookupByUid(pdvUid).card;
    if (card?.accountId && typeof addCharge === 'function') {
      try {
        addCharge(card.accountId, pdvDesc.trim() || 'Consumo NFC', amount, 'consumo');
      } catch {
        /* stub */
      }
    }
    toast.success(`Lançado ${formatBRL(amount)} · ${res.log.guestName}`);
    setPdvDesc('');
    setPdvAmount('');
    refresh();
  };

  const tabs: { id: Tab; label: string; icon: typeof CreditCard }[] = [
    { id: 'cartoes', label: 'Cartões', icon: CreditCard },
    { id: 'vincular', label: 'Vincular', icon: Link2 },
    { id: 'pdv', label: 'PDV rápido', icon: ShoppingBag },
    { id: 'movimentos', label: 'Movimentos', icon: History },
  ];

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 flex-wrap gap-0.5">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'h-8 px-3 rounded-md text-[12px] font-semibold transition-colors inline-flex items-center gap-1.5',
                tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'cartoes' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold text-slate-900">Pulseiras e cartões NFC</p>
              <p className="text-[12px] text-slate-500">
                Mifare Classic 1K · UID hex · {cards.length} cadastrado(s)
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={refresh} className="h-9 px-3 rounded-lg border border-slate-200 text-[12px] font-medium inline-flex items-center gap-1.5 hover:bg-slate-50">
                <RefreshCw className="w-3.5 h-3.5" /> Atualizar
              </button>
              <button type="button" onClick={() => setFormOpen((v) => !v)} className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[12px] font-semibold inline-flex items-center gap-1.5 hover:bg-slate-800">
                <Plus className="w-3.5 h-3.5" /> Novo cartão
              </button>
            </div>
          </div>

          {formOpen && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
              <p className="text-[12px] font-semibold text-slate-700">Cadastrar UID da pulseira</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold uppercase text-slate-400">UID (hex)</span>
                  <input value={uidInput} onChange={(e) => setUidInput(e.target.value)} placeholder="DD:4A:D8:9E ou DD4AD89E" className="w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] font-mono outline-none focus:ring-2 focus:ring-blue-500/20" />
                  {uidInput && (
                    <p className="text-[11px] text-slate-500">
                      Normalizado: {normalizeUidHex(uidInput) || '—'} · dec {uidHexToDec(uidInput) || '—'}
                    </p>
                  )}
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold uppercase text-slate-400">Apelido (opcional)</span>
                  <input value={labelInput} onChange={(e) => setLabelInput(e.target.value)} placeholder="Ex.: Pulseira bar 01" className="w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/20" />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setFormOpen(false)} className="h-8 px-3 rounded-lg border border-slate-200 text-[12px] font-medium hover:bg-slate-50">Cancelar</button>
                <button type="button" onClick={doRegister} className="h-8 px-3 rounded-lg bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-500">Cadastrar</button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-sm">
            {cards.length === 0 ? (
              <p className="px-4 py-12 text-center text-[13px] text-slate-400">Nenhum cartão cadastrado</p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
                {cards.map((c) => (
                  <CardRow key={c.id} card={c} onChange={refresh} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'vincular' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
            <p className="text-[13px] font-semibold text-slate-800">Vincular pulseira a hóspede in-house</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold uppercase text-slate-400">Cartão</span>
                <select value={linkCardId} onChange={(e) => setLinkCardId(e.target.value)} className="w-full h-9 rounded-lg border border-slate-200 px-2 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="">Selecione…</option>
                  {availableCards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.uidHex} {c.label ? `· ${c.label}` : ''} {c.status === 'ativo' ? `(ativo: ${c.guestName})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold uppercase text-slate-400">Hóspede (in-house)</span>
                <select value={linkResId} onChange={(e) => setLinkResId(e.target.value)} className="w-full h-9 rounded-lg border border-slate-200 px-2 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="">Selecione…</option>
                  {inHouse.map((r) => (
                    <option key={r.id} value={r.id}>
                      UH {r.roomNumber || '—'} · {r.guestName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {inHouse.length === 0 && (
              <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Nenhum hóspede com check-in no momento. Faça check-in na Recepção para vincular.
              </p>
            )}
            <div className="flex justify-end">
              <button type="button" onClick={doLink} disabled={!linkCardId || !linkResId} className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold hover:bg-emerald-500 disabled:opacity-50 inline-flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" /> Vincular
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <p className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-100">Vínculos ativos</p>
            {cards.filter((c) => c.status === 'ativo').length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-slate-400">Nenhum vínculo ativo</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {cards.filter((c) => c.status === 'ativo').map((c) => (
                  <div key={c.id} className="px-4 py-3 flex items-center gap-3 text-[12px]">
                    <CreditCard className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800 font-mono">{c.uidHex}</p>
                      <p className="text-slate-500">{c.guestName} · UH {c.roomNumber || '—'} · desde {formatWhen(c.linkedAt)}</p>
                    </div>
                    <button type="button" onClick={() => { const r = unlinkCard(c.id); if (r.ok) { toast.message('Pulseira desvinculada'); refresh(); } else toast.error(r.message); }} className="h-8 px-2.5 rounded-lg border border-slate-200 text-[11px] font-medium hover:bg-slate-50 inline-flex items-center gap-1">
                      <Link2Off className="w-3.5 h-3.5" /> Desvincular
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'pdv' && (
        <div className="space-y-4 max-w-lg">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
            <p className="text-[13px] font-semibold text-slate-800">PDV rápido (opção C)</p>
            <p className="text-[12px] text-slate-500">Informe o UID lido no celular/Gertec. Sem TEF e sem NFC-e — só lançamento na conta.</p>
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase text-slate-400">UID da pulseira</span>
              <div className="flex gap-2">
                <input value={pdvUid} onChange={(e) => { setPdvUid(e.target.value); setPdvLookup(null); }} placeholder="DD4AD89E" className="flex-1 h-10 rounded-lg border border-slate-200 px-3 text-[14px] font-mono outline-none focus:ring-2 focus:ring-blue-500/20" />
                <button type="button" onClick={doLookup} className="h-10 px-3 rounded-lg border border-slate-200 text-[12px] font-medium hover:bg-slate-50 inline-flex items-center gap-1">
                  <Search className="w-3.5 h-3.5" /> Buscar
                </button>
              </div>
            </label>
            {pdvLookup && (
              <div className={cn('rounded-lg border px-3 py-2.5 text-[12px]', pdvLookup.canCharge ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-950')}>
                {pdvLookup.canCharge ? (
                  <p className="inline-flex items-center gap-1.5 font-medium"><CheckCircle2 className="w-4 h-4" />{pdvLookup.card?.guestName} · UH {pdvLookup.card?.roomNumber || '—'}</p>
                ) : (
                  <p className="inline-flex items-center gap-1.5 font-medium"><AlertTriangle className="w-4 h-4" />{pdvLookup.message}</p>
                )}
              </div>
            )}
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase text-slate-400">Item / descrição</span>
              <input value={pdvDesc} onChange={(e) => setPdvDesc(e.target.value)} placeholder="Ex.: Água sem gás" className="w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/20" />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase text-slate-400">Valor (R$)</span>
              <input value={pdvAmount} onChange={(e) => setPdvAmount(e.target.value)} placeholder="0,00" className="w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-right tabular-nums outline-none focus:ring-2 focus:ring-blue-500/20" />
            </label>
            <button type="button" onClick={doCharge} disabled={!pdvLookup?.canCharge} className="w-full h-10 rounded-lg bg-slate-900 text-white text-[13px] font-semibold hover:bg-slate-800 disabled:opacity-50">
              Lançar na conta
            </button>
          </div>
        </div>
      )}

      {tab === 'movimentos' && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          {logs.length === 0 ? (
            <p className="px-4 py-12 text-center text-[13px] text-slate-400">Nenhum lançamento via NFC ainda</p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
              {logs.map((l) => (
                <div key={l.id} className="px-4 py-3 flex items-start gap-3 text-[12px]">
                  <ShoppingBag className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800">{l.description}</p>
                    <p className="text-slate-500 mt-0.5">{l.guestName || '—'} · UH {l.roomNumber || '—'} · {l.uidHex} · {l.operator}</p>
                    <p className="text-slate-400 text-[11px]">{formatWhen(l.at)}</p>
                  </div>
                  <span className="font-semibold tabular-nums text-slate-800">{formatBRL(l.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CardRow({ card, onChange }: { card: NfcCard; onChange: () => void }) {
  return (
    <div className="px-4 py-3 flex flex-wrap items-center gap-3 text-[12px] hover:bg-slate-50/60">
      <CreditCard className="w-4 h-4 text-slate-400 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono font-semibold text-slate-900">{card.uidHex}</p>
          {statusBadge(card.status)}
          {card.label && <span className="text-slate-500">{card.label}</span>}
        </div>
        <p className="text-slate-500 mt-0.5">
          dec {card.uidDec || '—'}
          {card.guestName && <> · {card.guestName} · UH {card.roomNumber || '—'}</>}
          {!card.canCharge && <span className="text-amber-700"> · sem permissão de consumo</span>}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {card.status === 'ativo' && (
          <button type="button" onClick={() => { const r = unlinkCard(card.id); if (r.ok) { toast.message('Desvinculado'); onChange(); } else toast.error(r.message); }} className="h-7 px-2 rounded-md border border-slate-200 text-[11px] font-medium hover:bg-white">Desvincular</button>
        )}
        {(card.status === 'disponivel' || card.status === 'ativo') && (
          <button type="button" onClick={() => { const r = blockCard(card.id, 'Bloqueio manual'); if (r.ok) { toast.message('Bloqueado'); onChange(); } else toast.error(r.message); }} className="h-7 px-2 rounded-md border border-rose-200 text-rose-700 text-[11px] font-medium hover:bg-rose-50 inline-flex items-center gap-1"><Ban className="w-3 h-3" /> Bloquear</button>
        )}
        {(card.status === 'bloqueado' || card.status === 'perdido') && (
          <button type="button" onClick={() => { const r = updateCard(card.id, { status: 'disponivel', blockedReason: undefined }); if (r.ok) { toast.success('Desbloqueado'); onChange(); } else toast.error(r.message); }} className="h-7 px-2 rounded-md border border-emerald-200 text-emerald-800 text-[11px] font-medium hover:bg-emerald-50">Desbloquear</button>
        )}
        {card.status !== 'ativo' && (
          <button type="button" onClick={() => { const r = deleteCard(card.id); if (r.ok) { toast.message('Excluído'); onChange(); } else toast.error(r.message); }} className="h-7 w-7 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 inline-flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
        )}
      </div>
    </div>
  );
}
