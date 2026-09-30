import { useMemo, useState } from 'react';
import { usePms } from '@/lib/pms-store';
import { accountBalance, formatBRL, formatDateBR, formatDateTimeBR, type Account } from '@/lib/pms-types';
import { cn } from '@/lib/utils';
import { Plus, Receipt, Search, Wallet } from 'lucide-react';
import { toast } from 'sonner';

type Filter = 'todas' | 'hospede' | 'avulsa';

export function AccountsModule() {
  const { accounts, reservations, rooms, addPayment, addCharge, createAvulsaAccount } = usePms();
  const [filter, setFilter] = useState<Filter>('todas');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('PIX');
  const [chargeDesc, setChargeDesc] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [newAvulsa, setNewAvulsa] = useState('');

  const accessibleAccounts = useMemo(
    () =>
      accounts.filter((account) => {
        if (account.type === 'avulsa') return true;
        if (!account.reservationId) return false;
        return reservations.some(
          (reservation) => reservation.id === account.reservationId && reservation.status === 'checkin',
        );
      }),
    [accounts, reservations],
  );

  const list = useMemo(() => {
    let rows = accessibleAccounts;
    if (filter !== 'todas') rows = rows.filter((a) => a.type === filter);
    const query = q.trim().toLowerCase();
    if (query) rows = rows.filter((a) => a.guestName.toLowerCase().includes(query));
    return rows;
  }, [accessibleAccounts, filter, q]);

  const selected = list.find((a) => a.id === selectedId) || list[0] || null;

  const registerPayment = () => {
    if (!selected) return;
    const amount = parseFloat(payAmount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    const result = addPayment(selected.id, amount, payMethod);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setPayAmount('');
    toast.success(result.message);
  };

  const registerCharge = () => {
    if (!selected) return;
    const amount = parseFloat(chargeAmount.replace(',', '.'));
    if (!chargeDesc.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast.error('Descrição e valor obrigatórios');
      return;
    }
    const result = addCharge(selected.id, chargeDesc.trim(), amount, 'consumo');
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setChargeDesc('');
    setChargeAmount('');
    toast.success(result.message);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {(
            [
              ['todas', 'Todas'],
              ['hospede', 'Contas hóspede'],
              ['avulsa', 'Contas avulsas'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setFilter(id);
                setSelectedId(null);
              }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm transition-colors',
                filter === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar conta…"
            className="h-10 w-56 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Nova conta avulsa</label>
          <input
            value={newAvulsa}
            onChange={(e) => setNewAvulsa(e.target.value)}
            placeholder="Nome do cliente / evento"
            className="mt-1 w-full h-10 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            if (!newAvulsa.trim()) {
              toast.error('Informe o nome');
              return;
            }
            createAvulsaAccount(newAvulsa.trim());
            setNewAvulsa('');
            toast.success('Conta avulsa criada');
          }}
          className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Abrir conta
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-slate-400" />
            <p className="text-sm font-semibold">{list.length} contas acessíveis</p>
          </div>
          <ul className="divide-y divide-slate-50 max-h-[560px] overflow-y-auto">
            {list.map((a) => {
              const bal = accountBalance(a);
              const active = selected?.id === a.id;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(a.id)}
                    className={cn(
                      'w-full text-left px-4 py-3 transition-colors',
                      active ? 'bg-slate-50' : 'hover:bg-slate-50/70',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{a.guestName}</p>
                        <p className="text-xs text-slate-400">
                          {a.type === 'hospede' ? 'Hóspede in-house' : 'Avulsa'} · aberta {formatDateBR(a.openedAt)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn('text-sm font-semibold', bal > 0.01 ? 'text-rose-600' : 'text-emerald-600')}>
                          {formatBRL(bal)}
                        </p>
                        <StatusPill status={a.status} />
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
            {list.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-slate-400">
                Nenhuma conta disponível. Contas de hóspedes são liberadas somente após o check-in.
              </li>
            )}
          </ul>
        </div>

        <div className="lg:col-span-3 space-y-4">
          {!selected ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-400">
              Selecione uma conta
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {selected.type === 'hospede' ? 'Conta do hóspede' : 'Conta avulsa'}
                    </p>
                    <h2 className="text-xl font-semibold mt-0.5">{selected.guestName}</h2>
                    {selected.roomId && (
                      <p className="text-sm text-slate-500 mt-1">
                        UH {rooms.find((r) => r.id === selected.roomId)?.number || selected.roomId}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Saldo</p>
                    <p className={cn('text-2xl font-semibold', accountBalance(selected) > 0.01 ? 'text-rose-600' : 'text-emerald-600')}>
                      {formatBRL(accountBalance(selected))}
                    </p>
                    <StatusPill status={selected.status} />
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    <Receipt className="w-4 h-4" /> Lançar consumo
                  </p>
                  <input value={chargeDesc} onChange={(e) => setChargeDesc(e.target.value)} placeholder="Descrição" className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm" />
                  <input value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} placeholder="Valor" inputMode="decimal" className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm" />
                  <button type="button" onClick={registerCharge} className="w-full h-10 rounded-xl border border-slate-200 text-sm font-medium hover:bg-slate-50">
                    Adicionar lançamento
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                  <p className="text-sm font-semibold">Registrar pagamento</p>
                  <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Valor" inputMode="decimal" className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm" />
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm">
                    <option>PIX</option>
                    <option>Cartão</option>
                    <option>Dinheiro</option>
                    <option>Transferência</option>
                  </select>
                  <button type="button" onClick={registerPayment} className="w-full h-10 rounded-xl bg-slate-900 text-white text-sm font-semibold">
                    Confirmar pagamento
                  </button>
                </div>
              </div>

              <Ledger account={selected} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Account['status'] }) {
  const map = {
    aberta: 'bg-slate-100 text-slate-700',
    parcial: 'bg-amber-50 text-amber-800',
    pendente: 'bg-rose-50 text-rose-700',
    quitada: 'bg-emerald-50 text-emerald-700',
  };
  const label = { aberta: 'Aberta', parcial: 'Parcial', pendente: 'Pendente', quitada: 'Quitada' };
  return <span className={cn('inline-flex mt-1 rounded-full px-2 py-0.5 text-[11px] font-medium', map[status])}>{label[status]}</span>;
}

function Ledger({ account }: { account: Account }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100"><p className="text-sm font-semibold">Extrato da conta</p></div>
      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
        <div className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Débitos</p>
          <ul className="space-y-2">
            {account.charges.map((c) => (
              <li key={c.id} className="flex justify-between text-sm gap-2">
                <span className="text-slate-600">{c.description}<span className="block text-[11px] text-slate-400">{formatDateTimeBR(c.date)}</span></span>
                <span className="font-medium tabular-nums">{formatBRL(c.amount)}</span>
              </li>
            ))}
            {account.charges.length === 0 && <li className="text-sm text-slate-400">Sem lançamentos</li>}
          </ul>
        </div>
        <div className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Pagamentos</p>
          <ul className="space-y-2">
            {account.payments.map((p) => (
              <li key={p.id} className="flex justify-between text-sm gap-2">
                <span className="text-slate-600">{p.method}<span className="block text-[11px] text-slate-400">{formatDateTimeBR(p.date)}</span></span>
                <span className="font-medium text-emerald-600 tabular-nums">{formatBRL(p.amount)}</span>
              </li>
            ))}
            {account.payments.length === 0 && <li className="text-sm text-slate-400">Sem pagamentos</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
