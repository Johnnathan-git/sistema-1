import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  CreditCard, Link2, Ban, Plus, ShoppingBag, History, RefreshCw, Trash2,
  CheckCircle2, AlertTriangle, Nfc, Loader2, Minus,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePms } from '@/lib/pms-store';
import { getSession } from '@/lib/auth-store';
import { formatBRL } from '@/lib/pms-types';
import {
  type NfcCard, type NfcCardStatus, NFC_STATUS_LABEL,
  listCards, registerCard, linkCard, unlinkCard, blockCard, deleteCard,
  lookupByUid, registerCharge, listChargeLogs, normalizeUidHex, updateCard,
} from '@/lib/nfc-cards';
import { POS_POINTS, type PosPointId, listProducts, getPosName } from '@/lib/pos-catalog';

type Tab = 'venda' | 'cartoes' | 'vincular' | 'movimentos';

function webNfcSupported() {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

async function scanNfcOnce(timeoutMs = 25000): Promise<{ uidHex: string }> {
  if (!webNfcSupported()) throw new Error('NFC do navegador não disponível. Use Chrome no Android (HTTPS).');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const NDEFReaderCtor = (window as any).NDEFReader;
  const reader = new NDEFReaderCtor();
  await reader.scan();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try { reader.onreading = null; reader.onreadingerror = null; } catch { /* */ }
      reject(new Error('Tempo esgotado. Aproxime a pulseira novamente.'));
    }, timeoutMs);
    reader.onreadingerror = () => {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reader.onreading = (event: any) => {
      clearTimeout(timer);
      const serial: string = event?.serialNumber || '';
      const uidHex = normalizeUidHex(String(serial).replace(/-/g, ''));
      if (!uidHex || uidHex.length < 4) {
        reject(new Error('Tag lida, mas UID não veio. Tente de novo.'));
        return;
      }
      try { reader.onreading = null; reader.onreadingerror = null; } catch { /* */ }
      resolve({ uidHex });
    };
  });
}

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
  const [tab, setTab] = useState<Tab>('venda');
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const cards = useMemo(() => listCards(hotel.id), [hotel.id, tick]);
  const logs = useMemo(() => listChargeLogs(80), [tick]);
  const inHouse = useMemo(() => reservations.filter((r) => r.status === 'checkin'), [reservations]);

  const [nfcOk, setNfcOk] = useState(false);
  useEffect(() => { setNfcOk(webNfcSupported()); }, []);

  const [uidInput, setUidInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [scanningReg, setScanningReg] = useState(false);

  const doRegister = (hex?: string) => {
    const res = registerCard({ uidHex: hex || uidInput, label: labelInput, hotelId: hotel.id });
    if (!res.ok) { toast.error(res.message); return; }
    toast.success(`Cartão ${res.card.uidHex} cadastrado`);
    setUidInput(''); setLabelInput(''); setFormOpen(false); refresh();
  };

  const scanToRegister = async () => {
    setScanningReg(true);
    try {
      const { uidHex } = await scanNfcOnce();
      setUidInput(uidHex);
      toast.success(`UID lido: ${uidHex}`);
      doRegister(uidHex);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha NFC');
    } finally {
      setScanningReg(false);
    }
  };

  const [linkCardId, setLinkCardId] = useState('');
  const [linkResId, setLinkResId] = useState('');
  const [scanningLink, setScanningLink] = useState(false);
  const [linkScanUid, setLinkScanUid] = useState('');

  const resolveAccountForReservation = (resvId: string): string | undefined => {
    const resv = reservations.find((r) => r.id === resvId);
    if (resv?.accountId) {
      const byId = accounts.find((a) => a.id === resv.accountId && a.status !== 'quitada');
      if (byId) return byId.id;
    }
    const byRes = accounts.find((a) => a.reservationId === resvId && a.status !== 'quitada');
    return byRes?.id || resv?.accountId;
  };

  const doLink = () => {
    const resv = inHouse.find((r) => r.id === linkResId);
    if (!resv) { toast.error('Selecione um hóspede in-house'); return; }
    if (!linkCardId) { toast.error('Selecione ou aproxime a pulseira'); return; }
    const accountId = resolveAccountForReservation(resv.id);
    if (!accountId) {
      toast.error('Hóspede sem conta aberta — faça o check-in primeiro');
      return;
    }
    const res = linkCard({
      cardId: linkCardId,
      reservationId: resv.id,
      guestId: resv.guestId,
      guestName: resv.guestName,
      roomNumber: resv.roomNumber,
      accountId,
    });
    if (!res.ok) { toast.error(res.message); return; }
    toast.success(`Vinculado a ${resv.guestName} · UH ${resv.roomNumber || '—'} · conta ${accountId}`);
    setLinkCardId(''); setLinkResId(''); setLinkScanUid(''); refresh();
  };

  const scanToLink = async () => {
    setScanningLink(true); setLinkScanUid('');
    try {
      const { uidHex } = await scanNfcOnce();
      setLinkScanUid(uidHex);
      const found = cards.find((c) => c.uidHex === uidHex);
      if (!found) { toast.error(`Pulseira ${uidHex} não cadastrada. Cadastre primeiro.`); return; }
      if (found.status === 'bloqueado' || found.status === 'perdido') { toast.error('Pulseira bloqueada'); return; }
      setLinkCardId(found.id);
      toast.success(`Pulseira ${uidHex} selecionada`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha NFC');
    } finally {
      setScanningLink(false);
    }
  };

  const [posId, setPosId] = useState<PosPointId>('bar-central');
  const [pdvUid, setPdvUid] = useState('');
  const [pdvLookup, setPdvLookup] = useState<ReturnType<typeof lookupByUid> | null>(null);
  const [scanningPdv, setScanningPdv] = useState(false);
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [launching, setLaunching] = useState<string | null>(null);

  const products = useMemo(() => listProducts({ posId, onlyActive: true }), [posId, tick]);

  const getQty = (productId: string) => Math.max(1, qtyMap[productId] || 1);
  const setQty = (productId: string, q: number) => {
    setQtyMap((prev) => ({ ...prev, [productId]: Math.max(1, q) }));
  };

  const resolveAccountId = (card: NonNullable<ReturnType<typeof lookupByUid>['card']>): string | null => {
    if (card.accountId) {
      const byId = accounts.find((a) => a.id === card.accountId && a.status !== 'quitada');
      if (byId) return byId.id;
    }
    if (card.reservationId) {
      const id = resolveAccountForReservation(card.reservationId);
      if (id) return id;
    }
    if (card.guestName) {
      const byGuest = accounts.find(
        (a) => a.status !== 'quitada' && a.guestName === card.guestName,
      );
      if (byGuest) return byGuest.id;
    }
    if (card.roomNumber) {
      const byRoom = accounts.find((a) => {
        if (a.status === 'quitada') return false;
        const resv = reservations.find((r) => r.id === a.reservationId);
        return resv?.roomNumber === card.roomNumber || a.roomId === card.roomNumber;
      });
      if (byRoom) return byRoom.id;
    }
    return null;
  };

  const applyUid = (raw: string) => {
    const hex = normalizeUidHex(raw);
    setPdvUid(hex);
    const r = lookupByUid(hex);
    setPdvLookup(r);
    if (!r.card) toast.error(r.message);
    else if (!r.canCharge) toast.message(r.message);
    else {
      const accId = resolveAccountId(r.card);
      if (!accId) {
        toast.error('Pulseira vinculada, mas conta do hóspede não encontrada. Re-vincule em Vincular.');
      } else {
        toast.success(`${r.card.guestName} · UH ${r.card.roomNumber || '—'} · pronto para lançar`);
      }
    }
  };

  const scanPdv = async () => {
    setScanningPdv(true); setPdvLookup(null);
    try {
      const { uidHex } = await scanNfcOnce();
      applyUid(uidHex);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha NFC');
    } finally {
      setScanningPdv(false);
    }
  };

  const launchProduct = (productId: string, name: string, unitPrice: number) => {
    if (!pdvLookup?.canCharge || !pdvLookup.card) {
      toast.error('Aproxime a pulseira do hóspede primeiro');
      return;
    }
    const card = pdvLookup.card;
    const accountId = resolveAccountId(card);
    if (!accountId) {
      toast.error('Conta do hóspede não encontrada — vá em Vincular e associe a pulseira de novo');
      return;
    }

    const q = getQty(productId);
    const amount = unitPrice * q;
    const desc = q > 1 ? `${name} x${q}` : name;
    const posLabel = getPosName(posId);

    setLaunching(productId);

    const nfcRes = registerCharge({
      uidHex: pdvUid || card.uidHex,
      description: `${desc} · ${posLabel}`,
      amount,
      operator: session?.displayName || 'Operador',
      source: 'pdv_rapido',
    });
    if (!nfcRes.ok) {
      toast.error(nfcRes.message);
      setLaunching(null);
      return;
    }

    const chargeRes = addCharge(accountId, `${desc} (${posLabel})`, amount, 'consumo');
    if (!chargeRes?.ok) {
      toast.error(chargeRes?.message || 'Falha ao lançar na conta do hóspede');
      setLaunching(null);
      return;
    }

    if (card.accountId !== accountId && card.id) {
      try {
        linkCard({
          cardId: card.id,
          reservationId: card.reservationId,
          guestId: card.guestId,
          guestName: card.guestName || '',
          roomNumber: card.roomNumber,
          accountId,
        });
      } catch { /* ignore */ }
    }

    toast.success(`${formatBRL(amount)} lançado · ${card.guestName} · UH ${card.roomNumber || '—'}`);
    setQty(productId, 1);
    setLaunching(null);
    refresh();
  };

  const tabs: { id: Tab; label: string; icon: typeof CreditCard }[] = [
    { id: 'venda', label: 'Venda', icon: ShoppingBag },
    { id: 'cartoes', label: 'Cartões', icon: CreditCard },
    { id: 'vincular', label: 'Vincular', icon: Link2 },
    { id: 'movimentos', label: 'Movimentos', icon: History },
  ];

  const canSell = Boolean(pdvLookup?.canCharge && pdvLookup.card);

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 flex-wrap gap-0.5 w-full sm:w-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={cn('h-9 flex-1 sm:flex-none px-3 rounded-md text-[12px] font-semibold transition-colors inline-flex items-center justify-center gap-1.5',
                tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              <Icon className="w-3.5 h-3.5" />{t.label}
            </button>
          );
        })}
      </div>

      {tab === 'venda' && (
        <div className="space-y-3 max-w-2xl">
          <div className="flex flex-wrap gap-2">
            {POS_POINTS.map((p) => (
              <button key={p.id} type="button" onClick={() => setPosId(p.id)}
                className={cn('h-10 px-4 rounded-full border text-[13px] font-semibold transition-all',
                  posId === p.id
                    ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300')}>
                {p.name}
              </button>
            ))}
          </div>

          {!canSell ? (
            <button type="button" onClick={scanPdv} disabled={scanningPdv || !nfcOk}
              className={cn(
                'w-full min-h-[120px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all',
                scanningPdv
                  ? 'border-blue-400 bg-blue-50 text-blue-800'
                  : nfcOk
                    ? 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/40 text-slate-800'
                    : 'border-slate-200 bg-slate-50 text-slate-400',
              )}>
              {scanningPdv ? (
                <>
                  <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                  <span className="text-[15px] font-semibold">Aproxime a pulseira…</span>
                </>
              ) : (
                <>
                  <Nfc className="w-10 h-10 text-slate-500" />
                  <span className="text-[15px] font-semibold">
                    {nfcOk ? 'Aproxime a pulseira do hóspede' : 'NFC indisponível neste aparelho'}
                  </span>
                  <span className="text-[12px] text-slate-400">Abre a comanda e libera o cardápio</span>
                </>
              )}
            </button>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-emerald-950 truncate">
                  {pdvLookup?.card?.guestName}
                </p>
                <p className="text-[12px] text-emerald-800/80">
                  UH {pdvLookup?.card?.roomNumber || '—'}
                  {pdvLookup?.card?.accountId ? ` · conta ${pdvLookup.card.accountId}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setPdvLookup(null); setPdvUid(''); }}
                className="h-9 px-3 rounded-lg border border-emerald-300 bg-white text-[12px] font-semibold text-emerald-900"
              >
                Trocar
              </button>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                Cardápio · {getPosName(posId)}
              </p>
              {canSell && (
                <p className="text-[11px] text-slate-400">Ajuste a qtd e toque em Lançar</p>
              )}
            </div>

            {!canSell ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center text-[13px] text-slate-400">
                Aproxime a pulseira para liberar os produtos
              </div>
            ) : products.length === 0 ? (
              <p className="text-[13px] text-slate-400 py-8 text-center">
                Nenhum produto neste PDV. Cadastre em Operações → Produtos.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {products.map((p) => {
                  const q = getQty(p.id);
                  const busy = launching === p.id;
                  return (
                    <div
                      key={p.id}
                      className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm flex flex-col gap-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-slate-900 leading-snug">{p.name}</p>
                          <p className="text-[15px] font-bold tabular-nums text-blue-700 mt-0.5">
                            {formatBRL(p.price)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50">
                          <button
                            type="button"
                            onClick={() => setQty(p.id, q - 1)}
                            className="h-9 w-9 inline-flex items-center justify-center text-slate-600"
                            aria-label="Diminuir"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center text-[14px] font-semibold tabular-nums">{q}</span>
                          <button
                            type="button"
                            onClick={() => setQty(p.id, q + 1)}
                            className="h-9 w-9 inline-flex items-center justify-center text-slate-600"
                            aria-label="Aumentar"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => launchProduct(p.id, p.name, p.price)}
                          className={cn(
                            'flex-1 h-10 rounded-lg text-[13px] font-semibold text-white inline-flex items-center justify-center gap-1.5 transition-all',
                            busy ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-500 active:scale-[0.98]',
                          )}
                        >
                          {busy ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              Lançar
                              {q > 1 && (
                                <span className="opacity-90 tabular-nums">· {formatBRL(p.price * q)}</span>
                              )}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'cartoes' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setFormOpen(true)} className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[12px] font-semibold inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Novo cartão</button>
            <button type="button" onClick={scanToRegister} disabled={scanningReg || !nfcOk} className="h-9 px-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 text-[12px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-40">
              {scanningReg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Nfc className="w-3.5 h-3.5" />} Cadastrar por aproximação
            </button>
            <button type="button" onClick={refresh} className="h-9 px-3 rounded-lg border border-slate-200 text-[12px] font-medium inline-flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Atualizar</button>
          </div>
          {formOpen && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
              <p className="text-[13px] font-semibold">Cadastrar cartão</p>
              <input value={uidInput} onChange={(e) => setUidInput(e.target.value)} placeholder="UID (ou use aproximação)" className="w-full h-10 rounded-lg border border-slate-200 px-3 text-[14px]" />
              <input value={labelInput} onChange={(e) => setLabelInput(e.target.value)} placeholder="Etiqueta (opcional)" className="w-full h-10 rounded-lg border border-slate-200 px-3 text-[14px]" />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setFormOpen(false)} className="h-9 px-3 rounded-lg border text-[12px]">Cancelar</button>
                <button type="button" onClick={() => doRegister()} className="h-9 px-4 rounded-lg bg-blue-600 text-white text-[12px] font-semibold">Salvar</button>
              </div>
            </div>
          )}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            {cards.length === 0 ? (
              <p className="px-4 py-12 text-center text-[13px] text-slate-400">Nenhum cartão cadastrado</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {cards.map((card) => (
                  <CardRow key={card.id} card={card} onChange={refresh} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === 'vincular' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4 shadow-sm max-w-lg">
          <p className="text-[15px] font-semibold">Vincular pulseira ao hóspede</p>
          <p className="text-[12px] text-slate-500 -mt-2">
            A pulseira precisa de um hóspede com check-in e conta aberta para lançar consumos.
          </p>
          <button type="button" onClick={scanToLink} disabled={scanningLink || !nfcOk}
            className={cn('w-full min-h-[72px] rounded-xl border-2 border-dashed flex items-center justify-center gap-2',
              scanningLink ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-slate-50')}>
            {scanningLink ? <Loader2 className="w-6 h-6 animate-spin text-blue-600" /> : <Nfc className="w-6 h-6" />}
            <span className="text-[13px] font-semibold">{scanningLink ? 'Aproxime…' : 'Aproxime a pulseira'}</span>
          </button>
          {linkScanUid && <p className="text-[12px] text-slate-600">UID: <span className="font-mono font-semibold">{linkScanUid}</span></p>}
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase text-slate-400">Ou escolha cartão</span>
            <select value={linkCardId} onChange={(e) => setLinkCardId(e.target.value)} className="w-full h-10 rounded-lg border border-slate-200 px-2 bg-white text-[14px]">
              <option value="">—</option>
              {cards.filter((c) => c.status === 'disponivel' || c.status === 'ativo').map((c) => (
                <option key={c.id} value={c.id}>{c.uidHex}{c.label ? ` · ${c.label}` : ''}{c.guestName ? ` · ${c.guestName}` : ''}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase text-slate-400">Hóspede in-house</span>
            <select value={linkResId} onChange={(e) => setLinkResId(e.target.value)} className="w-full h-10 rounded-lg border border-slate-200 px-2 bg-white text-[14px]">
              <option value="">—</option>
              {inHouse.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.guestName} · UH {r.roomNumber || '—'}
                  {r.accountId ? ` · ${r.accountId}` : ''}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={doLink} className="w-full h-11 rounded-lg bg-blue-600 text-white text-[13px] font-semibold">
            Vincular à conta do hóspede
          </button>
        </div>
      )}

      {tab === 'movimentos' && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="px-4 py-2 border-b bg-slate-50/80 text-[12px] font-semibold flex justify-between">
            <span>Últimos lançamentos NFC</span>
            <button type="button" onClick={refresh} className="text-blue-600 text-[11px]">Atualizar</button>
          </div>
          {logs.length === 0 ? (
            <p className="px-4 py-12 text-center text-[13px] text-slate-400">Nenhum lançamento ainda</p>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {logs.map((log) => (
                <li key={log.id} className="px-4 py-2.5 text-[12px] flex gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{log.description}</p>
                    <p className="text-[11px] text-slate-500">
                      {log.guestName || '—'} · UH {log.roomNumber || '—'}
                      {log.accountId ? ` · ${log.accountId}` : ''} · {formatWhen(log.at)}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums text-slate-800 shrink-0">{formatBRL(log.amount)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function CardRow({ card, onChange }: { card: NfcCard; onChange: () => void }) {
  return (
    <li className="px-4 py-3 flex items-center gap-3 text-[13px]">
      <CreditCard className="w-4 h-4 text-slate-400 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-900 font-mono">{card.uidHex} {card.label ? `· ${card.label}` : ''}</p>
        <p className="text-[11px] text-slate-500">
          {statusBadge(card.status)}{' '}
          {card.guestName
            ? `${card.guestName} · UH ${card.roomNumber}${card.accountId ? ` · ${card.accountId}` : ''}`
            : 'sem vínculo'}
        </p>
      </div>
      <div className="flex gap-1">
        {card.status === 'ativo' && (
          <button type="button" onClick={() => { unlinkCard(card.id); onChange(); }} className="h-7 px-2 border rounded-md text-[11px]">Desvincular</button>
        )}
        {(card.status === 'disponivel' || card.status === 'ativo') && (
          <button type="button" onClick={() => { blockCard(card.id, 'Bloqueio'); onChange(); }} className="h-7 px-2 border border-rose-200 text-rose-700 rounded-md text-[11px]"><Ban className="w-3 h-3" /></button>
        )}
        {(card.status === 'bloqueado' || card.status === 'perdido') && (
          <button type="button" onClick={() => { updateCard(card.id, { status: 'disponivel' }); onChange(); }} className="h-7 px-2 border rounded-md text-[11px]">Desbloquear</button>
        )}
        {card.status !== 'ativo' && (
          <button type="button" onClick={() => { deleteCard(card.id); onChange(); }} className="h-7 w-7 text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
        )}
      </div>
    </li>
  );
}
