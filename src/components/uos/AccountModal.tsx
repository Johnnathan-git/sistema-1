import { useMemo, useState } from 'react';
import { usePms } from '@/lib/pms-store';
import {
  accountBalance,
  formatBRL,
  formatDateBR,
  type Account,
} from '@/lib/pms-types';
import { cn } from '@/lib/utils';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';

const CAT_LABEL: Record<Account['charges'][0]['category'], string> = {
  hospedagem: 'Diária / hospedagem',
  consumo: 'Consumo',
  servico: 'Serviço',
  taxa: 'Taxa',
  outro: 'Outro',
};

export function AccountModal({
  accountId,
  reservationId,
  onClose,
}: {
  accountId?: string;
  reservationId?: string;
  onClose: () => void;
}) {
  const { accounts, reservations, addPayment, addCharge } = usePms();

  const account = useMemo(() => {
    if (accountId) return accounts.find((a) => a.id === accountId);
    if (reservationId)
      return accounts.find((a) => a.reservationId === reservationId);
    return undefined;
  }, [accounts, accountId, reservationId]);

  const res = account?.reservationId
    ? reservations.find((r) => r.id === account.reservationId)
    : reservationId
      ? reservations.find((r) => r.id === reservationId)
      : undefined;

  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('PIX');
  const [chargeDesc, setChargeDesc] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeCat, setChargeCat] =
    useState<Account['charges'][0]['category']>('consumo');

  if (!account) {
    return (
      <Overlay onClose={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div className="flex justify-between items-start mb-3">
            <h2 className="font-semibold text-lg">Conta do hóspede</h2>
            <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[13px] text-slate-500">
            Esta reserva ainda não possui conta aberta. A conta é criada automaticamente no
            check-in.
          </p>
          {res && (
            <p className="mt-2 text-[12px] text-slate-400">
              Reserva {res.code} · {res.guestName} · status {res.status}
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="mt-4 h-9 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-semibold"
          >
            Fechar
          </button>
        </div>
      </Overlay>
    );
  }

  const balance = accountBalance(account);
  const totalCharges = account.charges.reduce((s, c) => s + c.amount, 0);
  const totalPayments = account.payments.reduce((s, p) => s + p.amount, 0);

  const lines = useMemo(() => {
    const items: {
      id: string;
      date: string;
      label: string;
      type: 'charge' | 'payment';
      amount: number;
      extra?: string;
    }[] = [];
    for (const c of account.charges) {
      items.push({
        id: c.id,
        date: c.date,
        label: c.description,
        type: 'charge',
        amount: c.amount,
        extra: CAT_LABEL[c.category],
      });
    }
    for (const p of account.payments) {
      items.push({
        id: p.id,
        date: p.date,
        label: `Pagamento · ${p.method}`,
        type: 'payment',
        amount: p.amount,
      });
    }
    return items.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  }, [account]);

  const submitPay = () => {
    const n = Number(payAmount.replace(',', '.'));
    if (!n || n <= 0) {
      toast.error('Informe o valor do pagamento');
      return;
    }
    addPayment(account.id, n, payMethod);
    setPayAmount('');
    toast.success('Pagamento lançado');
  };

  const submitCharge = () => {
    const n = Number(chargeAmount.replace(',', '.'));
    if (!chargeDesc.trim() || !n || n <= 0) {
      toast.error('Descrição e valor obrigatórios');
      return;
    }
    addCharge(account.id, chargeDesc.trim(), n, chargeCat);
    setChargeDesc('');
    setChargeAmount('');
    toast.success('Lançamento adicionado');
  };

  return (
    <Overlay onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-500">
              Conta do hóspede
            </p>
            <h2 className="text-lg font-semibold text-slate-900">{account.guestName}</h2>
            <p className="text-[12px] text-slate-500 mt-0.5">
              {res ? `${res.code} · ${res.roomNumber || res.roomType}` : account.type} ·{' '}
              aberta em {formatDateBR(account.openedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Resumo */}
        <div className="px-5 py-3 border-b border-slate-100 grid grid-cols-3 gap-3 shrink-0 bg-slate-50/80">
          <div>
            <p className="text-[10px] uppercase text-slate-400 font-semibold">Lançamentos</p>
            <p className="text-[15px] font-semibold tabular-nums">{formatBRL(totalCharges)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-400 font-semibold">Pagamentos</p>
            <p className="text-[15px] font-semibold tabular-nums text-emerald-700">
              {formatBRL(totalPayments)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-400 font-semibold">Saldo</p>
            <p
              className={cn(
                'text-[15px] font-semibold tabular-nums',
                balance > 0.01 ? 'text-rose-600' : 'text-emerald-600'
              )}
            >
              {formatBRL(balance)}
            </p>
          </div>
        </div>

        {/* Extrato */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-white border-b border-slate-100">
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
                <th className="px-5 py-2 font-semibold">Data</th>
                <th className="px-3 py-2 font-semibold">Descrição</th>
                <th className="px-3 py-2 font-semibold">Tipo</th>
                <th className="px-5 py-2 font-semibold text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-400">
                    Nenhum lançamento
                  </td>
                </tr>
              ) : (
                lines.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-2.5 whitespace-nowrap text-slate-500">
                      {formatDateBR(l.date)}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-slate-800">{l.label}</p>
                      {l.extra && (
                        <p className="text-[10px] text-slate-400">{l.extra}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {l.type === 'charge' ? (
                        <span className="text-slate-500">Débito</span>
                      ) : (
                        <span className="text-emerald-600 font-medium">Crédito</span>
                      )}
                    </td>
                    <td
                      className={cn(
                        'px-5 py-2.5 text-right tabular-nums font-semibold',
                        l.type === 'payment' ? 'text-emerald-600' : 'text-slate-800'
                      )}
                    >
                      {l.type === 'payment' ? '−' : '+'} {formatBRL(l.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Lançar */}
        <div className="border-t border-slate-200 px-5 py-3 space-y-3 shrink-0 bg-slate-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase text-slate-400">Novo consumo / serviço</p>
              <input
                value={chargeDesc}
                onChange={(e) => setChargeDesc(e.target.value)}
                placeholder="Descrição"
                className="w-full h-9 rounded-lg border border-slate-200 px-2 text-[13px]"
              />
              <div className="flex gap-2">
                <select
                  value={chargeCat}
                  onChange={(e) =>
                    setChargeCat(e.target.value as Account['charges'][0]['category'])
                  }
                  className="h-9 rounded-lg border border-slate-200 px-2 text-[12px] flex-1"
                >
                  <option value="consumo">Consumo</option>
                  <option value="servico">Serviço</option>
                  <option value="hospedagem">Hospedagem</option>
                  <option value="taxa">Taxa</option>
                  <option value="outro">Outro</option>
                </select>
                <input
                  value={chargeAmount}
                  onChange={(e) => setChargeAmount(e.target.value)}
                  placeholder="Valor"
                  className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-[13px]"
                />
                <button
                  type="button"
                  onClick={submitCharge}
                  className="h-9 px-2.5 rounded-lg bg-slate-900 text-white"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase text-slate-400">Registrar pagamento</p>
              <div className="flex gap-2">
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 px-2 text-[12px] flex-1"
                >
                  <option>PIX</option>
                  <option>Cartão</option>
                  <option>Dinheiro</option>
                  <option>Transferência</option>
                </select>
                <input
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Valor"
                  className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-[13px]"
                />
                <button
                  type="button"
                  onClick={submitPay}
                  className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold"
                >
                  Pagar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
