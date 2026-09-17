import { useMemo } from 'react';
import { usePms } from '@/lib/pms-store';
import { formatBRL, formatDateBR } from '@/lib/pms-types';
import { Printer, X } from 'lucide-react';
import { toast } from 'sonner';

type Line = {
  id: string;
  hora: string;
  method: string;
  amount: number;
  parcelas: string;
  autorizacao: string;
  documento: string;
  reserva: string;
  conta: string;
  hospede: string;
};

export function CashReportModal({ onClose }: { onClose: () => void }) {
  const { hotel, accounts, reservations, cashOpen, cashFundo, cashOpenedAt } = usePms();
  const opDateBR = hotel.operationalDate.split('-').reverse().join('/');

  const lines = useMemo(() => {
    const out: Line[] = [];
    let seq = 1;
    for (const acc of accounts) {
      for (const p of acc.payments) {
        if (p.date !== hotel.operationalDate) continue;
        const res = acc.reservationId
          ? reservations.find((r) => r.id === acc.reservationId)
          : undefined;
        const method = (p.method || 'OUTROS').toUpperCase();
        const isParcelado = method.includes('PARCEL');
        out.push({
          id: p.id,
          hora: `${String(8 + (seq % 10)).padStart(2, '0')}:${String((seq * 7) % 60).padStart(2, '0')}`,
          method,
          amount: p.amount,
          parcelas: isParcelado ? '3x' : '1x',
          autorizacao: `AUT${String(100000 + seq * 137).slice(-6)}`,
          documento: `DOC${String(200000 + seq * 91).slice(-6)}`,
          reserva: res?.code || '—',
          conta: acc.id.slice(0, 10).toUpperCase(),
          hospede: acc.guestName,
        });
        seq += 1;
      }
    }
    return out.sort((a, b) => a.hora.localeCompare(b.hora));
  }, [accounts, reservations, hotel.operationalDate]);

  const total = lines.reduce((s, l) => s + l.amount, 0);

  const byMethod = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of lines) map.set(l.method, (map.get(l.method) || 0) + l.amount);
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [lines]);

  const printReport = () => {
    const rows = lines
      .map(
        (l) =>
          `<tr>
            <td>${l.hora}</td><td>${l.method}</td><td style="text-align:right">${formatBRL(l.amount)}</td>
            <td>${l.parcelas}</td><td>${l.autorizacao}</td><td>${l.documento}</td>
            <td>${l.reserva}</td><td>${l.conta}</td><td>${l.hospede}</td>
          </tr>`
      )
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Caixa ${opDateBR}</title>
      <style>
        body{font-family:system-ui,sans-serif;font-size:12px;color:#111;padding:24px}
        h1{font-size:16px;margin:0 0 4px} h2{font-size:13px;margin:16px 0 8px;color:#333}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}
        th{background:#f1f5f9;font-size:10px;text-transform:uppercase}
        .meta{color:#555;margin-bottom:12px}
      </style></head><body>
      <h1>Relatório de caixa — Hotel Teste</h1>
      <div class="meta">Caixa RECEPCAO01 · Operador · ${opDateBR}<br/>
      Abertura: ${cashOpenedAt || '—'} · Fundo: ${formatBRL(cashFundo)} · Status: ${cashOpen ? 'Aberto' : 'Fechado'}</div>
      <h2>Lançamentos detalhados</h2>
      <table><thead><tr>
        <th>Hora</th><th>Forma</th><th>Valor</th><th>Parcelas</th><th>Autorização</th>
        <th>Documento</th><th>Reserva</th><th>Conta</th><th>Hóspede</th>
      </tr></thead><tbody>${rows || '<tr><td colspan="9">Sem lançamentos</td></tr>'}</tbody></table>
      <h2>Totalizador</h2>
      <table><thead><tr><th>Forma</th><th>Valor</th></tr></thead><tbody>
      ${byMethod.map(([m, v]) => `<tr><td>${m}</td><td style="text-align:right">${formatBRL(v)}</td></tr>`).join('')}
      <tr><td><strong>Total</strong></td><td style="text-align:right"><strong>${formatBRL(total)}</strong></td></tr>
      </tbody></table>
      <script>window.onload=()=>window.print()</script></body></html>`;
    const w = window.open('', '_blank', 'noopener,noreferrer,width=960,height=720');
    if (!w) {
      toast.error('Permita pop-ups para imprimir');
      return;
    }
    w.document.write(html);
    w.document.close();
    toast.success('Relatório enviado para impressão');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl border border-slate-200 bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 shrink-0">
          <div>
            <p className="text-[15px] font-semibold text-slate-900">Caixa do operador</p>
            <p className="text-[12px] text-slate-500">
              Lançamentos detalhados · {opDateBR} · {cashOpen ? 'Aberto' : 'Fechado'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg hover:bg-slate-100 inline-flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-2 border-b border-slate-50 text-[12px] grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
          <div>
            <span className="text-slate-400">Caixa:</span>{' '}
            <span className="font-semibold">RECEPCAO01</span>
          </div>
          <div>
            <span className="text-slate-400">Operador:</span>{' '}
            <span className="font-semibold">Operador</span>
          </div>
          <div>
            <span className="text-slate-400">Abertura:</span>{' '}
            <span className="font-semibold tabular-nums">{cashOpenedAt || '—'}</span>
          </div>
          <div>
            <span className="text-slate-400">Fundo:</span>{' '}
            <span className="font-semibold tabular-nums">R$ {formatBRL(cashFundo)}</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Lançamentos do dia ({lines.length})
          </p>
          <div className="rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-[11px] min-w-max">
              <thead className="bg-slate-50 border-b">
                <tr className="text-left text-[10px] uppercase text-slate-400">
                  <th className="px-2 py-2">Hora</th>
                  <th className="px-2 py-2">Forma</th>
                  <th className="px-2 py-2 text-right">Valor</th>
                  <th className="px-2 py-2">Parcelas</th>
                  <th className="px-2 py-2">Autorização</th>
                  <th className="px-2 py-2">Documento</th>
                  <th className="px-2 py-2">Reserva</th>
                  <th className="px-2 py-2">Conta</th>
                  <th className="px-2 py-2">Hóspede</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                      Nenhum lançamento neste caixa
                    </td>
                  </tr>
                ) : (
                  lines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-2 py-1.5 tabular-nums">{l.hora}</td>
                      <td className="px-2 py-1.5 font-medium">{l.method}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatBRL(l.amount)}</td>
                      <td className="px-2 py-1.5">{l.parcelas}</td>
                      <td className="px-2 py-1.5 font-mono text-[10px]">{l.autorizacao}</td>
                      <td className="px-2 py-1.5 font-mono text-[10px]">{l.documento}</td>
                      <td className="px-2 py-1.5">{l.reserva}</td>
                      <td className="px-2 py-1.5 font-mono text-[10px]">{l.conta}</td>
                      <td className="px-2 py-1.5">{l.hospede}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-50 border-t">
                <tr className="font-semibold">
                  <td className="px-2 py-2" colSpan={2}>
                    Total
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatBRL(total)}</td>
                  <td colSpan={6} />
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mt-4 mb-2">
            Totalizador por forma
          </p>
          <div className="rounded-xl border border-slate-200 overflow-hidden max-w-sm">
            <table className="w-full text-[12px]">
              <tbody className="divide-y divide-slate-50">
                {byMethod.map(([m, v]) => (
                  <tr key={m}>
                    <td className="px-3 py-1.5">{m}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatBRL(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-slate-200 text-[13px] font-medium hover:bg-slate-50"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={printReport}
            className="h-9 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-slate-800"
          >
            <Printer className="w-3.5 h-3.5" /> Imprimir relatório
          </button>
        </div>
      </div>
    </div>
  );
}
