import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  CreditCard, Link2, Ban, Plus, ShoppingBag, History, RefreshCw, Trash2,
  CheckCircle2, AlertTriangle, Nfc, Loader2,
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

  const doLink = () => {
    const resv = inHouse.find((r) => r.id === linkResId);
    if (!resv) { toast.error('Selecione um hóspede in-house'); return; }
    const acc =
      accounts.find((a) => a.reservationId === resv.id && a.status !== 'quitada') ||
      (resv.accountId ? accounts.find((a) => a.id === resv.accountId && a.status !== 'quitada') : undefined);
    if (!acc && !resv.accountId) {
      toast.error('Hóspede sem conta aberta — faça o check-in primeiro');
      return;
    }
    const res = linkCard({
      cardId: linkCardId,
      reservationId: resv.id,
      guestId: resv.guestId,
      guestName: resv.guestName,
      roomNumber: resv.roomNumber,
      accountId: acc?.id || resv.accountId,
    });
    if (!res.ok) { toast.error(res.message); return; }
    toast.success(`Vinculado a ${resv.guestName} · UH ${resv.roomNumber || '—'}`);
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
  const [qty, setQty] = useState(1);
  const [cart, setCart] = useState<{ productId: string; name: string; unitPrice: number; qty: number }[]>([]);

  const cartTotal = cart.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const products = useMemo(() => listProducts({ posId, onlyActive: true }), [posId, tick]);

  const applyUid = (raw: string) => {
    const hex = normalizeUidHex(raw);
    setPdvUid(hex);
    const r = lookupByUid(hex);
    setPdvLookup(r);
    if (!r.card) toast.error(r.message);
    else if (!r.canCharge) toast.message(r.message);
    else toast.success(`${r.card.guestName} · UH ${r.card.roomNumber || '—'}`);
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

  const addToCart = (productId: string, name: string, unitPrice: number) => {
    const q = Math.max(1, qty);
    setCart((prev) => {
      const i = prev.findIndex((x) => x.productId === productId);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + q };
        return next;
      }
      return [...prev, { productId, name, unitPrice, qty: q }];
    });
    setQty(1);
    toast.message(`${name} ×${q} adicionado`);
  };

  const setCartQty = (productId: string, q: number) => {
    setCart((prev) => {
      if (q <= 0) return prev.filter((x) => x.productId !== productId);
      return prev.map((x) => (x.productId === productId ? { ...x, qty: q } : x));
    });
  };

  const sellProduct = (productId: string, name: string, unitPrice: number, qOverride?: number) => {
    if (!pdvLookup?.canCharge || !pdvLookup.card) {
      toast.error('Aproxime a pulseira do hóspede primeiro');
      return false;
    }
    const q = Math.max(1, qOverride ?? qty);
    const amount = unitPrice * q;
    const desc = q > 1 ? `${name} x${q}` : name;
    const posLabel = getPosName(posId);

    const nfcRes = registerCharge({
      uidHex: pdvUid,
      description: `${desc} · ${posLabel}`,
      amount,
      operator: session?.displayName || 'Operador',
      source: 'pdv_rapido',
    });
    if (!nfcRes.ok) { toast.error(nfcRes.message); return false; }

    const card = pdvLookup.card;
    let accountId: string | undefined = card.accountId;
    if (accountId) {
      const ok = accounts.find((a) => a.id === accountId && a.status !== 'quitada');
      if (!ok) accountId = undefined;
    }
    if (!accountId && card.reservationId) {
      const acc = accounts.find((a) => a.reservationId === card.reservationId && a.status !== 'quitada');
      accountId = acc?.id;
      if (!accountId) {
        const resv = reservations.find((r) => r.id === card.reservationId);
        if (resv?.accountId) {
          const a2 = accounts.find((a) => a.id === resv.accountId && a.status !== 'quitada');
          accountId = a2?.id;
        }
      }
    }
    if (!accountId && card.guestName) {
      const byGuest = accounts.find((a) => a.status !== 'quitada' && a.guestName === card.guestName);
      accountId = byGuest?.id;
    }
    if (!accountId) {
      toast.error('Conta do hóspede não encontrada — vincule a pulseira a um hóspede in-house');
      return false;
    }

    const chargeRes = addCharge(accountId, `${desc} (${posLabel})`, amount, 'consumo');
    if (chargeRes && typeof chargeRes === 'object' && 'ok' in chargeRes && !chargeRes.ok) {
      toast.error(chargeRes.message || 'Falha ao lançar na conta');
      return false;
    }
    return true;
  };

  const launchCart = () => {
    if (!pdvLookup?.canCharge || !pdvLookup.card) {
      toast.error('Aproxime a pulseira do hóspede primeiro');
      return;
    }
    if (cart.length === 0) {
      toast.error('Adicione ao menos um produto');
      return;
    }
    let ok = 0;
    for (const item of cart) {
      if (sellProduct(item.productId, item.name, item.unitPrice, item.qty)) ok += 1;
      else break;
    }
    if (ok === cart.length) {
      const card = pdvLookup.card;
      toast.success(`${formatBRL(cartTotal)} · ${ok} item(ns) · ${card.guestName} · UH ${card.roomNumber || '—'}`);
      setCart([]);
      setQty(1);
      refresh();
    } else if (ok > 0) {
      toast.message(`${ok} lançado(s) — verifique o restante`);
      refresh();
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof CreditCard }[] = [
    { id: 'venda', label: 'Venda', icon: ShoppingBag },
    { id: 'cartoes', label: 'Cartões', icon: CreditCard },
    { id: 'vincular', label: 'Vincular', icon: Link2 },
    { id: 'movimentos', label: 'Movimentos', icon: History },
  ];

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
        <div className="space-y-4 max-w-xl">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4 shadow-sm">
            <div>
              <p className="text-[15px] font-semibold text-slate-900">Venda</p>
              <p className="text-[12px] text-slate-500 mt-0.5">1) PDV · 2) Pulseira · 3) Adicione produtos · 4) Lançar na conta</p>
            </div>

            <div>
              <span className="text-[11px] font-semibold uppercase text-slate-400">Ponto de venda</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {POS_POINTS.map((p) => (
                  <button key={p.id} type="button" onClick={() => setPosId(p.id)}
                    className={cn('h-10 px-3 rounded-lg border text-[13px] font-semibold',
                      posId === p.id ? 'border-blue-400 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-600')}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <button type="button" onClick={scanPdv} disabled={scanningPdv || !nfcOk}
              className={cn('w-full min-h-[100px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all',
                scanningPdv ? 'border-blue-400 bg-blue-50 text-blue-800' : nfcOk ? 'border-slate-300 bg-slate-50 hover:border-blue-400 text-slate-800' : 'border-slate-200 bg-slate-50 text-slate-400')}>
              {scanningPdv ? (
                <><Loader2 className="w-9 h-9 animate-spin text-blue-600" /><span className="text-[14px] font-semibold">Aproxime a pulseira…</span></>
              ) : (
                <><Nfc className="w-9 h-9 text-slate-600" /><span className="text-[14px] font-semibold">{nfcOk ? 'Aproxime a pulseira do hóspede' : 'NFC indisponível'}</span></>
              )}
            </button>

            {pdvLookup && (
              <div className={cn('rounded-lg border px-3 py-2.5 text-[13px]',
                pdvLookup.canCharge ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-950')}>
                {pdvLookup.canCharge ? (
                  <p className="inline-flex items-center gap-1.5 font-medium"><CheckCircle2 className="w-4 h-4 shrink-0" />{pdvLookup.card?.guestName} · UH {pdvLookup.card?.roomNumber || '—'}</p>
                ) : (
                  <p className="inline-flex items-center gap-1.5 font-medium"><AlertTriangle className="w-4 h-4 shrink-0" />{pdvLookup.message}</p>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-[12px] text-slate-500">Qtd ao adicionar</span>
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-9 w-9 rounded-lg border border-slate-200 font-bold">−</button>
              <span className="tabular-nums font-semibold w-8 text-center">{qty}</span>
              <button type="button" onClick={() => setQty((q) => q + 1)} className="h-9 w-9 rounded-lg border border-slate-200 font-bold">+</button>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase text-slate-400 mb-2">Produtos · {getPosName(posId)}</p>
              {products.length === 0 ? (
                <p className="text-[13px] text-slate-400 py-6 text-center">Nenhum produto neste PDV. Cadastre em Produtos.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {products.map((p) => (
                    <button key={p.id} type="button"
                      onClick={() => addToCart(p.id, p.name, p.price)}
                      className="text-left rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 hover:border-blue-300 hover:bg-blue-50/50 active:scale-[0.98] transition-all">
                      <p className="text-[13px] font-semibold text-slate-900">{p.name}</p>
                      <p className="text-[14px] font-bold tabular-nums text-blue-700 mt-0.5">{formatBRL(p.price)}</p>
                      <p className="text-[11px] text-slate-500 mt-1">Toque para adicionar</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-slate-700">Carrinho · {cartCount} item(ns)</p>
                  <button type="button" onClick={() => setCart([])} className="text-[11px] text-slate-500 hover:text-rose-600">Limpar</button>
                </div>
                <ul className="space-y-1.5">
                  {cart.map((item) => (
                    <li key={item.productId} className="flex items-center gap-2 text-[13px] bg-white rounded-lg border border-slate-100 px-2.5 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900 truncate">{item.name}</p>
                        <p className="text-[11px] text-slate-500 tabular-nums">{formatBRL(item.unitPrice)} un.</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => setCartQty(item.productId, item.qty - 1)} className="h-8 w-8 rounded-md border border-slate-200 font-bold">−</button>
                        <span className="w-7 text-center font-semibold tabular-nums">{item.qty}</span>
                        <button type="button" onClick={() => setCartQty(item.productId, item.qty + 1)} className="h-8 w-8 rounded-md border border-slate-200 font-bold">+</button>
                      </div>
                      <p className="w-16 text-right font-semibold tabular-nums">{formatBRL(item.unitPrice * item.qty)}</p>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                  <span className="text-[13px] font-semibold text-slate-700">Total</span>
                  <span className="text-[16px] font-bold tabular-nums text-blue-700">{formatBRL(cartTotal)}</span>
                </div>
                <button
                  type="button"
                  onClick={launchCart}
                  disabled={!pdvLookup?.canCharge || cart.length === 0}
                  className="w-full h-12 rounded-xl bg-blue-600 text-white text-[14px] font-semibold hover:bg-blue-500 disabled:opacity-40 disabled:pointer-events-none inline-flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Lançar na conta · {formatBRL(cartTotal)}
                </button>
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
                <option key={r.id} value={r.id}>{r.guestName} · UH {r.roomNumber || '—'}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={doLink} className="w-full h-11 rounded-lg bg-blue-600 text-white text-[13px] font-semibold">Vincular</button>
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
                    <p className="text-[11px] text-slate-500">{log.guestName || '—'} · UH {log.roomNumber || '—'} · {formatWhen(log.at)}</p>
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
          {card.guestName ? `${card.guestName} · UH ${card.roomNumber}` : 'sem vínculo'}
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
