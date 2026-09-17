import { toast } from 'sonner';
import { formatDateBR, type Reservation } from '@/lib/pms-types';

export type DayStats = {
  sellable: number;
  occupied: number;
  pct: string;
  arrUhs: number;
  arrAdults: number;
  arrChildren: number;
  depUhs: number;
  depAdults: number;
  depChildren: number;
  inAdults: number;
  inChildren: number;
  totalPax: number;
  groups: number;
  individuais: number;
  totalRes: number;
  pessoas: number;
};

export function ReceptionDayFooter({
  dayStats,
  selectedRes,
}: {
  dayStats: DayStats;
  selectedRes: Reservation | null;
}) {
  return (
    <div className="fixed bottom-0 left-[232px] right-0 z-40 border-t border-slate-700 bg-slate-900 text-white shadow-2xl">
      <div className="px-4 py-2.5 grid grid-cols-1 xl:grid-cols-12 gap-3 text-[11px]">
        <div className="xl:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-sky-300 font-semibold mb-1">Check-in</p>
            <p>
              <span className="text-slate-400">Total de UHs:</span>{' '}
              <span className="font-semibold tabular-nums">{dayStats.arrUhs}</span>
            </p>
            <p>
              <span className="text-slate-400">Total de adultos:</span>{' '}
              <span className="font-semibold tabular-nums">{dayStats.arrAdults}</span>
            </p>
            <p>
              <span className="text-slate-400">Total de crianças:</span>{' '}
              <span className="font-semibold tabular-nums">{dayStats.arrChildren}</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-sky-300 font-semibold mb-1">Check-out</p>
            <p>
              <span className="text-slate-400">Total de UHs:</span>{' '}
              <span className="font-semibold tabular-nums">{dayStats.depUhs}</span>
            </p>
            <p>
              <span className="text-slate-400">Total de adultos:</span>{' '}
              <span className="font-semibold tabular-nums">{dayStats.depAdults}</span>
            </p>
            <p>
              <span className="text-slate-400">Total de crianças:</span>{' '}
              <span className="font-semibold tabular-nums">{dayStats.depChildren}</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-sky-300 font-semibold mb-1">Ocupação</p>
            <p>
              <span className="text-slate-400">Qtd UHs:</span>{' '}
              <span className="font-semibold tabular-nums">{dayStats.sellable}</span>
            </p>
            <p>
              <span className="text-slate-400">Total ocupadas:</span>{' '}
              <span className="font-semibold tabular-nums">{dayStats.occupied}</span>
            </p>
            <p>
              <span className="text-slate-400">%:</span>{' '}
              <span className="font-semibold tabular-nums">{dayStats.pct}</span>
            </p>
            <p>
              <span className="text-slate-400">Total pax:</span>{' '}
              <span className="font-semibold tabular-nums">
                {dayStats.inAdults} / {dayStats.inChildren}
              </span>
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-sky-300 font-semibold mb-1">Totalizador</p>
            <p>
              <span className="text-slate-400">Reservas:</span>{' '}
              <span className="font-semibold tabular-nums">{dayStats.totalRes}</span>
            </p>
            <p>
              <span className="text-slate-400">Grupos / Individuais:</span>{' '}
              <span className="font-semibold tabular-nums">
                {dayStats.groups} / {dayStats.individuais}
              </span>
            </p>
            <p>
              <span className="text-slate-400">Pessoas (AD/CH):</span>{' '}
              <span className="font-semibold tabular-nums">{dayStats.pessoas}</span>
            </p>
            <button
              type="button"
              onClick={() => toast.success('Previsão atualizada')}
              className="mt-1 h-6 px-2 rounded bg-white/10 hover:bg-white/20 text-[10px] font-medium"
            >
              Atualizar previsão
            </button>
          </div>
        </div>
        <div className="xl:col-span-5 border-t xl:border-t-0 xl:border-l border-slate-700 pt-2 xl:pt-0 xl:pl-4 min-h-[72px]">
          <p className="text-[10px] uppercase tracking-wider text-sky-300 font-semibold mb-1">
            Observação da reserva selecionada
          </p>
          {selectedRes ? (
            <div className="space-y-0.5">
              <p>
                <span className="text-slate-400">Reserva:</span>{' '}
                <span className="font-semibold">{selectedRes.code}</span>
                <span className="text-slate-500"> · </span>
                <span className="font-semibold">{selectedRes.guestName}</span>
              </p>
              <p>
                <span className="text-slate-400">UH:</span>{' '}
                <span className="font-semibold">{selectedRes.roomNumber || '—'}</span>
                <span className="text-slate-500"> · </span>
                <span className="text-slate-400">AD/CH:</span>{' '}
                <span className="font-semibold">
                  {selectedRes.adults}/{selectedRes.children}
                </span>
                <span className="text-slate-500"> · </span>
                <span className="text-slate-400">CI/CO:</span>{' '}
                <span className="font-semibold">
                  {formatDateBR(selectedRes.checkIn)} → {formatDateBR(selectedRes.checkOut)}
                </span>
              </p>
              <p className="text-slate-300 line-clamp-2">
                {selectedRes.notes || 'Sem observação cadastrada.'}
              </p>
              <p className="text-[10px] text-slate-500 pt-1">
                Clique duas vezes na linha para abrir a reserva / conta e realizar o check-out.
              </p>
            </div>
          ) : (
            <p className="text-slate-500">
              Selecione uma reserva na lista para ver observação, integrantes e valores.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
