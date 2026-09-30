import { onCloudSync } from '@/lib/cloud-sync';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  CreditCard, Ban, Plus, ShoppingBag, History, RefreshCw, Trash2,
  CheckCircle2, Nfc, Loader2, Minus, ArrowRight, Search, X, Link2, Unlink,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePms } from '@/lib/pms-store';
import { getSession } from '@/lib/auth-store';
import { formatBRL } from '@/lib/pms-types';
import {
  type NfcCard, type NfcCardStatus, NFC_STATUS_LABEL,
  listCards, registerCard, unlinkCard, linkCard, blockCard, deleteCard,
  lookupByUid, registerCharge, listChargeLogs, normalizeUidHex, updateCard,
} from '@/lib/nfc-cards';
import { POS_POINTS, type PosPointId, listProducts, getPosName } from '@/lib/pos-catalog';

import { Button } from '@/components/ui/button';

type Tab = 'venda' | 'cartoes' | 'vincular' | 'movimentos';

function webNfcSupported() {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

function usbHidReaderSupported() {
  return typeof window !== 'undefined' && typeof window.addEventListener === 'function';
}

function scanUsbHidOnce(timeoutMs = 25000): Promise<{ uidHex: string }> {
  if (!usbHidReaderSupported()) {
    return Promise.reject(new Error('Leitor USB não disponível neste navegador.'));
  }

  return new Promise((resolve, reject) => {
    let buffer = '';
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      window.removeEventListener('keydown', onKeyDown, true);
      clearTimeout(timeoutTimer);
      if (idleTimer) clearTimeout(idleTimer);
    };

    const finish = () => {
      const uidHex = normalizeUidHex(buffer);
      if (uidHex.length < 4) return;
      cleanup();
      resolve({ uidHex });
    };

    const scheduleFinish = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (buffer.length >= 4) finish();
      }, 140);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      if (event.key === 'Enter' || event.key === 'Tab') {
        if (buffer.length >= 4) {
          event.preventDefault();
          event.stopPropagation();
          finish();
        }
        return;
      }

      if (event.key.length !== 1) return;
      if (!/[0-9a-fA-F]/.test(event.key)) return;

      buffer += event.key;
      scheduleFinish();
    };

    const timeoutTimer = setTimeout(() => {
      cleanup();
      reject(new Error('Tempo esgotado. Aproxime a mídia do leitor USB novamente.'));
    }, timeoutMs);

    window.addEventListener('keydown', onKeyDown, true);
  });
}

async function scanWebNfcOnce(timeoutMs = 25000): Promise<{ uidHex: string }> {
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

export async function scanNfcOnce(timeoutMs = 25000): Promise<{ uidHex: string }> {
  if (webNfcSupported()) {
    try {
      return await scanWebNfcOnce(timeoutMs);
    } catch (error) {
      if (!usbHidReaderSupported()) throw error;
    }
  }
  return scanUsbHidOnce(timeoutMs);
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

export function MediaCenterModule({ mode = 'center' }: { mode?: 'center' | 'venda' }) {
  const { hotel, accounts, reservations, addCharges } = usePms();
  const session = getSession();
  const [tab, setTab] = useState<Tab>(mode === 'venda' ? 'venda' : 'cartoes');
  // Force tab when mode changes
  useEffect(() => {
    setTab(mode === 'venda' ? 'venda' : 'cartoes');
  }, [mode]);
  const [tick, setTick] = useState(0);
  useEffect(() => onCloudSync(() => setTick((t) => t + 1)), []);
  const refresh = () => setTick((t) => t + 1);

  const cards = useMemo(() => listCards(hotel.id), [hotel.id, tick]);
  const logs = useMemo(() => listChargeLogs(80), [tick]);
  const [nfcOk, setNfcOk] = useState(false);
  useEffect(() => { setNfcOk(webNfcSupported() || usbHidReaderSupported()); }, []);

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

  const [linkAccountId, setLinkAccountId] = useState('');
  const [scanningLink, setScanningLink] = useState(false);

  const openAccounts = useMemo(
    () => accounts
      .filter((a) => {
        if (a.type !== 'hospede' || !a.reservationId) return false;
        const reservation = reservations.find((r) => r.id === a.reservationId);
        return reservation?.status === 'checkin';
      })
      .sort((a, b) => {
        const ra = reservations.find((r) => r.id === a.reservationId);
        const rb = reservations.find((r) => r.id === b.reservationId);
        return `${ra?.roomNumber || ''}-${a.guestName}`.localeCompare(
          `${rb?.roomNumber || ''}-${b.guestName}`,
          'pt-BR',
        );
      }),
    [accounts, reservations, tick],
  );
  const linkAccount = openAccounts.find((a) => a.id === linkAccountId) || null;
  const linkReservation = linkAccount?.reservationId
    ? reservations.find((r) => r.id === linkAccount.reservationId)
    : undefined;
  const linkRoomNumber = linkReservation?.roomNumber || '';
  const linkedCardsForAccount = useMemo(
    () => (linkAccount ? cards.filter((c) => c.accountId === linkAccount.id && c.status === 'ativo') : []),
    [cards, linkAccount],
  );

  const scanToLink = async () => {
    if (!linkAccount) {
      toast.error('Selecione a conta do hóspede primeiro');
      return;
    }
    setScanningLink(true);
    try {
      const { uidHex } = await scanNfcOnce();
      const existing = lookupByUid(uidHex);
      let cardId = existing.card?.id;
      if (existing.card && existing.card.accountId && existing.card.accountId !== linkAccount.id) {
        toast.error(`Esta mídia já está vinculada a ${existing.card.guestName || 'outra conta'}. Desvincule primeiro.`);
        return;
      }
      if (existing.card && existing.card.accountId === linkAccount.id) {
        toast('Esta mídia já está vinculada a esta conta');
        return;
      }
      if (!cardId) {
        const reg = registerCard({ uidHex, hotelId: hotel.id });
        if (!reg.ok) { toast.error(reg.message); return; }
        cardId = reg.card.id;
        toast.success(`Mídia ${uidHex} cadastrada automaticamente`);
      }
      const res = linkCard({
        cardId,
        reservationId: linkAccount.reservationId,
        guestId: linkAccount.guestId,
        guestName: linkAccount.guestName,
        roomNumber: linkReservation?.roomNumber,
        accountId: linkAccount.id,
      });
      if (!res.ok) { toast.error(res.message); return; }
      toast.success(`Mídia vinculada a ${linkAccount.guestName}`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha NFC');
    } finally {
      setScanningLink(false);
    }
  };

  const [posId, setPosId] = useState<PosPointId>('bar-central');
  const [pdvUid, setPdvUid] = useState('');
  const [pdvLookup, setPdvLookup] = useState<ReturnType<typeof lookupByUid> | null>(null);
  const [mediaReadLookup, setMediaReadLookup] = useState<ReturnType<typeof lookupByUid> | null>(null);
  const [mediaReaderOpen, setMediaReaderOpen] = useState(false);
  const [scanningPdv, setScanningPdv] = useState(false);
  const [scanningMedia, setScanningMedia] = useState(false);
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [launching, setLaunching] = useState(false);
  const [productQuery, setProductQuery] = useState('');

  const products = useMemo(() => {
    const query = productQuery.trim().toLocaleLowerCase('pt-BR');
    return listProducts({ posId, onlyActive: true }).filter((product) =>
      !query || product.name.toLocaleLowerCase('pt-BR').includes(query),
    );
  }, [posId, productQuery, tick]);

  const getQty = (productId: string) => Math.max(0, qtyMap[productId] || 0);
  const setQty = (productId: string, q: number) => {
    setQtyMap((prev) => ({ ...prev, [productId]: Math.max(0, q) }));
  };

  const cartItems = useMemo(
    () => products
      .map((product) => ({ product, quantity: getQty(product.id) }))
      .filter((item) => item.quantity > 0),
    [products, qtyMap],
  );
  const cartQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const resolveAccountId = (card: NonNullable<ReturnType<typeof lookupByUid>['card']>): string | null => {
    // A conta canônica vem da reserva/hóspede. A mídia nunca deve escolher
    // uma conta arbitrária da lista.
    const reservation = card.reservationId
      ? reservations.find((r) => r.id === card.reservationId)
      : undefined;

    let canonicalAccountId = reservation?.accountId;

    // Mídias de acompanhantes usam a conta individual do acompanhante.
    if (reservation && card.guestId && card.guestId !== reservation.guestId) {
      canonicalAccountId = reservation.companions?.find((c) => c.id === card.guestId)?.accountId;
    }

    const canonical = canonicalAccountId
      ? accounts.find((a) => a.id === canonicalAccountId && a.status !== 'quitada')
      : undefined;

    const direct = card.accountId
      ? accounts.find((a) =>
          a.id === card.accountId &&
          a.status !== 'quitada' &&
          (!card.reservationId || a.reservationId === card.reservationId) &&
          (!card.guestId || !a.guestId || a.guestId === card.guestId)
        )
      : undefined;

    const account = canonical || direct;
    if (!account) return null;

    if (card.accountId !== account.id) {
      const linked = linkCard({
        cardId: card.id,
        reservationId: reservation?.id || card.reservationId,
        guestId: card.guestId || reservation?.guestId,
        guestName: card.guestName || account.guestName,
        roomNumber: card.roomNumber || reservation?.roomNumber,
        accountId: account.id,
      });
      if (!linked.ok) return null;
    }

    return account.id;
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
        toast.error('Mídia vinculada sem conta válida. Vincule a mídia diretamente à conta do hóspede antes de vender.');
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

  const scanMedia = async () => {
    setScanningMedia(true);
    setMediaReadLookup(null);
    try {
      const { uidHex } = await scanNfcOnce();
      const result = lookupByUid(uidHex);
      setMediaReadLookup(result);
      if (!result.card) toast.error(result.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha NFC');
    } finally {
      setScanningMedia(false);
    }
  };

  const launchOrder = () => {
    if (!pdvLookup?.canCharge || !pdvLookup.card) {
      toast.error('Aproxime a pulseira do hóspede primeiro');
      return;
    }
    const card = pdvLookup.card;
    const accountId = resolveAccountId(card);
    if (!accountId) {
      toast.error('Conta não encontrada na mídia — vincule a mídia diretamente à conta do hóspede antes de vender');
      return;
    }
    if (cartItems.length === 0) {
      toast.error('Selecione ao menos um produto');
      return;
    }
    const posLabel = getPosName(posId);
    setLaunching(true);

    // Primeiro confirma o lançamento na conta. O histórico da mídia só é criado
    // depois que a conta aceita todos os itens, evitando venda "solta" na mídia.
    const batch = cartItems.map(({ product, quantity }) => {
      const description = quantity > 1 ? `${product.name} x${quantity}` : product.name;
      return {
        description: `${description} (${posLabel})`,
        amount: product.price * quantity,
        category: 'consumo' as const,
      };
    });
    const accountResult = addCharges(accountId, batch);
    if (!accountResult?.ok) {
      toast.error(accountResult?.message || 'Falha ao lançar na conta do hóspede');
      setLaunching(false);
      return;
    }

    // Só registra os movimentos depois da confirmação da conta.
    for (const { product, quantity } of cartItems) {
      const amount = product.price * quantity;
      const description = quantity > 1 ? `${product.name} x${quantity}` : product.name;
      const nfcResult = registerCharge({
        uidHex: pdvUid || card.uidHex,
        description: `${description} · ${posLabel}`,
        amount,
        operator: session?.displayName || 'Operador',
        source: 'pdv_rapido',
      });
      if (!nfcResult.ok) {
        toast.error(`Conta atualizada, mas o histórico da mídia não pôde ser registrado: ${nfcResult.message}`);
        setLaunching(false);
        refresh();
        return;
      }
    }

    toast.success(`${cartQuantity} ${cartQuantity === 1 ? 'item lançado' : 'itens lançados'} · ${formatBRL(cartTotal)} · ${card.guestName}`);
    setQtyMap({});
    setLaunching(false);
    refresh();
  };

  const tabs: { id: Tab; label: string; icon: typeof CreditCard }[] =
    mode === 'venda'
      ? [{ id: 'venda', label: 'Venda', icon: ShoppingBag }]
      : [
          { id: 'cartoes', label: 'Mídias', icon: CreditCard },
          { id: 'vincular', label: 'Vincular', icon: Link2 },
          { id: 'movimentos', label: 'Movimentos', icon: History },
        ];

  const canSell = Boolean(pdvLookup?.canCharge && pdvLookup.card);

  return (
    <div className="media-center space-y-4">
      {mode !== 'venda' && (
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
      )}

      {tab === 'venda' && (
        <div className="relative max-w-4xl space-y-4 pb-44 sm:pb-36">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => { setMediaReaderOpen((v) => !v); setMediaReadLookup(null); }}
              className={cn(
                'h-10 px-4 rounded-lg border text-[12px] font-semibold inline-flex items-center gap-2',
                mediaReaderOpen ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              )}
            >
              <Nfc className="w-4 h-4" /> Ler mídia
            </button>
          </div>

          {mediaReaderOpen && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-slate-800">Conferência da mídia</p>
                  <p className="text-[11px] text-slate-500">Apenas consulta. A leitura não inicia nem altera uma venda.</p>
                </div>
                <button
                  type="button"
                  onClick={scanMedia}
                  disabled={scanningMedia || !nfcOk}
                  className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[12px] font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {scanningMedia ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Nfc className="w-3.5 h-3.5" />}
                  {scanningMedia ? 'Lendo…' : 'Aproximar mídia'}
                </button>
              </div>
              {mediaReadLookup?.card && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Resultado da leitura</p>
                  <p className="mt-1 text-[14px] font-semibold text-slate-900">{mediaReadLookup.card.guestName || 'Sem hóspede vinculado'}</p>
                  <p className="text-[11px] text-slate-500">
                    UH {mediaReadLookup.card.roomNumber || '—'} · {mediaReadLookup.card.accountId ? `Conta ${mediaReadLookup.card.accountId}` : 'Sem conta vinculada'} · UID {mediaReadLookup.card.uidHex}
                  </p>
                  <p className="text-[11px] mt-1 font-medium">{mediaReadLookup.message}</p>
                </div>
              )}
              {!mediaReadLookup?.card && mediaReadLookup && (
                <p className="mt-3 text-[11px] text-rose-600">{mediaReadLookup.message}</p>
              )}
            </div>
          )}

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
            <div className="space-y-2">
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
                    <span className="text-[12px] text-slate-400">Identifica o hóspede e abre uma nova comanda</span>
                  </>
                )}
              </button>

            </div>
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setPdvLookup(null); setPdvUid(''); }}
                  className="h-9 px-3 rounded-lg border border-emerald-300 bg-white text-[12px] font-semibold text-emerald-900"
                >
                  Trocar
                </button>
              </div>
            </div>
          )}

          <div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cardápio</p>
                <p className="truncate text-base font-bold text-foreground">{getPosName(posId)}</p>
              </div>
              <div className="relative w-40 sm:w-56">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Buscar produto" className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/30" />
              </div>
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
               <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {products.map((p) => {
                  const q = getQty(p.id);
                  return (
                     <div
                      key={p.id}
                       className={cn('relative min-h-32 rounded-xl border bg-card p-3 shadow-sm transition-all', q > 0 ? 'border-primary ring-2 ring-primary/10' : 'border-border')}
                    >
                       <button type="button" className="w-full min-w-0 pb-12 text-left" onClick={() => setQty(p.id, q + 1)} aria-label={`Adicionar ${p.name}`}>
                           <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-card-foreground">{p.name}</p>
                           <p className="mt-1 text-[15px] font-bold tabular-nums text-primary">
                            {formatBRL(p.price)}
                          </p>
                       </button>
                       <div className="absolute inset-x-3 bottom-3 flex h-9 items-center justify-between rounded-lg border border-border bg-muted p-0.5">
                         <Button type="button" variant="ghost" size="icon" disabled={q === 0} onClick={() => setQty(p.id, q - 1)} aria-label={`Remover ${p.name}`} className="h-8 w-8"><Minus /></Button>
                         <span className={cn('w-7 text-center text-sm font-bold tabular-nums', q > 0 ? 'text-foreground' : 'text-muted-foreground')}>{q}</span>
                         <Button type="button" variant="outline" size="icon" onClick={() => setQty(p.id, q + 1)} aria-label={`Adicionar ${p.name}`} className="h-8 w-8 bg-card text-primary"><Plus /></Button>
                       </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {canSell && (
            <div className="fixed inset-x-3 bottom-3 z-40 md:absolute md:inset-x-0 md:bottom-0">
              <div className="mx-auto max-w-4xl rounded-2xl bg-foreground p-4 text-background shadow-2xl">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-background/55">Total da comanda</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-bold tabular-nums">{formatBRL(cartTotal)}</p>
                      <p className="text-xs text-background/60">{cartQuantity} {cartQuantity === 1 ? 'item' : 'itens'}</p>
                    </div>
                  </div>
                  {cartQuantity > 0 && <Button type="button" variant="ghost" size="icon" onClick={() => setQtyMap({})} className="text-background hover:bg-background/10 hover:text-background" aria-label="Limpar comanda"><X /></Button>}
                </div>
                <Button type="button" onClick={launchOrder} disabled={launching || cartQuantity === 0} className="mt-3 h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  {launching ? <Loader2 className="animate-spin" /> : <>Lançar comanda <ArrowRight /></>}
                </Button>
              </div>
            </div>
          )}
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
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 max-w-md">
              <p className="text-[13px] font-semibold text-slate-800">Cadastrar mídia</p>
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold uppercase text-slate-400">UID (hex)</span>
                <input value={uidInput} onChange={(e) => setUidInput(e.target.value)} placeholder="Ex: 04A1B2C3" className="w-full h-10 rounded-lg border border-slate-200 px-3 text-[13px] font-mono outline-none focus:ring-2 focus:ring-blue-500/20" />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold uppercase text-slate-400">Rótulo (opcional)</span>
                <input value={labelInput} onChange={(e) => setLabelInput(e.target.value)} placeholder="Pulseira bar 12" className="w-full h-10 rounded-lg border border-slate-200 px-3 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/20" />
              </label>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setFormOpen(false)} className="h-9 px-3 rounded-lg border border-slate-200 text-[12px]">Cancelar</button>
                <button type="button" onClick={() => doRegister()} className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[12px] font-semibold">Salvar</button>
              </div>
            </div>
          )}

          <ul className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
            {cards.length === 0 ? (
              <li className="px-4 py-10 text-center text-[13px] text-slate-400">Nenhuma mídia cadastrada</li>
            ) : (
              cards.map((c) => <CardRow key={c.id} card={c} onChange={refresh} />)
            )}
          </ul>
        </div>
      )}

      {tab === 'vincular' && (
        <div className="space-y-3 max-w-2xl">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <p className="text-[13px] font-semibold text-slate-800">Vincular mídia à conta do hóspede</p>
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase text-slate-400">Conta do hóspede</span>
              <select
                value={linkAccountId}
                onChange={(e) => setLinkAccountId(e.target.value)}
                className="w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Selecione a conta</option>
                {openAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.guestName}
                    {(() => {
                      const reservation = reservations.find((r) => r.id === a.reservationId);
                      return reservation
                        ? ` · UH ${reservation.roomNumber || '—'} · ${reservation.code}`
                        : '';
                    })()}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={scanToLink}
              disabled={scanningLink || !nfcOk || !linkAccount}
              className={cn(
                'w-full min-h-[96px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-all disabled:opacity-50',
                scanningLink
                  ? 'border-blue-400 bg-blue-50 text-blue-800'
                  : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/40 text-slate-800',
              )}
            >
              {scanningLink ? (
                <>
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <span className="text-[14px] font-semibold">Aproxime a mídia…</span>
                </>
              ) : (
                <>
                  <Nfc className="w-8 h-8 text-slate-500" />
                  <span className="text-[14px] font-semibold">
                    {nfcOk ? 'Aproximar mídia para vincular' : 'NFC indisponível neste aparelho'}
                  </span>
                  <span className="text-[11px] text-slate-400">Se a mídia for nova, ela é cadastrada automaticamente</span>
                </>
              )}
            </button>
          </div>

          {linkAccount && (
            <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
              <p className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Mídias vinculadas a {linkAccount.guestName}
              </p>
              {linkedCardsForAccount.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-slate-400">Nenhuma mídia vinculada</p>
              ) : (
                linkedCardsForAccount.map((c) => (
                  <div key={c.id} className="px-4 py-3 flex items-center gap-3 text-[13px]">
                    <CreditCard className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 font-mono">{c.uidHex}{c.label ? ` · ${c.label}` : ''}</p>
                      <p className="text-[11px] text-slate-500">{statusBadge(c.status)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { unlinkCard(c.id); refresh(); toast.success('Mídia desvinculada'); }}
                      className="h-8 px-3 rounded-lg border border-slate-200 text-[12px] font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50"
                    >
                      <Unlink className="w-3.5 h-3.5" /> Desvincular
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'movimentos' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button type="button" onClick={refresh} className="h-9 px-3 rounded-lg border border-slate-200 text-[12px] font-medium inline-flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Atualizar</button>
          </div>
          {logs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-[13px] text-slate-400">
              Nenhum movimento registrado
            </div>
          ) : (
            <ul className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
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
