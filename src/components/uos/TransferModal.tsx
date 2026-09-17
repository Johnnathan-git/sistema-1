import { useMemo, useState } from 'react';
import { usePms } from '@/lib/pms-store';
import {
  formatDateBR,
  GOVERNANCE_LABEL,
  type Reservation,
} from '@/lib/pms-types';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { toast } from 'sonner';

type Mode = 'uh' | 'hospede';

export function TransferModal({
  reservation,
  onClose,
}: {
  reservation: Reservation;
  onClose: () => void;
}) {
  const { rooms, transferRoom } = usePms();
  const [mode, setMode] = useState<Mode>('uh');
  const [roomId, setRoomId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [guestIds, setGuestIds] = useState<Set<string>>(() => new Set(['principal']));
  const [newPrincipal, setNewPrincipal] = useState('principal');

  /** Dados obrigatórios quando o novo titular era só acompanhante */
  const [npName, setNpName] = useState('');
  const [npDoc, setNpDoc] = useState('');
  const [npPhone, setNpPhone] = useState('');
  const [npEmail, setNpEmail] = useState('');
  const [npNationality, setNpNationality] = useState('Brasileira');

  const available = useMemo(
    () =>
      rooms.filter(
        (r) =>
          r.occupancy === 'livre' &&
          r.governance !== 'interditado' &&
          r.governance !== 'manutencao' &&
          r.id !== reservation.roomId
      ),
    [rooms, reservation.roomId]
  );

  const guests = useMemo(() => {
    const list = [{ id: 'principal', name: reservation.guestName, principal: true }];
    for (let i = 1; i < reservation.adults; i++) {
      list.push({ id: `ad-${i}`, name: `Acompanhante AD ${i}`, principal: false });
    }
    for (let i = 1; i <= reservation.children; i++) {
      list.push({ id: `ch-${i}`, name: `Acompanhante CH ${i}`, principal: false });
    }
    return list;
  }, [reservation]);

  const needsPrincipalData = mode === 'hospede' && newPrincipal !== 'principal';

  const confirm = () => {
    if (!roomId) {
      toast.error('Selecione a UH de destino');
      return;
    }
    if (mode === 'hospede' && guestIds.size === 0) {
      toast.error('Selecione ao menos um hóspede');
      return;
    }
    if (needsPrincipalData) {
      if (!npName.trim() || !npDoc.trim() || !npPhone.trim()) {
        toast.error('Preencha nome, documento e telefone do novo titular');
        return;
      }
    }
    const res = transferRoom(reservation.id, roomId);
    if (res.ok) {
      let extra =
        mode === 'hospede'
          ? ` · ${guestIds.size} hóspede(s)`
          : motivo
            ? ` · ${motivo}`
            : '';
      if (needsPrincipalData) {
        extra += ` · novo titular: ${npName.trim()}`;
      }
      toast.success(res.message + extra);
      onClose();
    } else toast.error(res.message);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 shrink-0">
          <div>
            <p className="text-[15px] font-semibold text-slate-900">
              {mode === 'uh' ? 'Transferência de UH' : 'Transferência de Hóspede para UH'}
            </p>
            <p className="text-[12px] text-slate-500">
              Reserva {reservation.code} · {reservation.guestName}
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

        <div className="px-5 pt-3 flex gap-2 border-b border-slate-100 pb-3">
          <button
            type="button"
            onClick={() => setMode('uh')}
            className={cn(
              'h-8 px-3 rounded-lg text-[12px] font-semibold border',
              mode === 'uh'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white border-slate-200 text-slate-600'
            )}
          >
            Transferir UH (reserva inteira)
          </button>
          <button
            type="button"
            onClick={() => setMode('hospede')}
            className={cn(
              'h-8 px-3 rounded-lg text-[12px] font-semibold border',
              mode === 'hospede'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white border-slate-200 text-slate-600'
            )}
          >
            Transferir hóspede
          </button>
        </div>

        <div className="p-5 space-y-3 text-[13px] overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-2 text-[12px] rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
            <div>
              <span className="text-slate-400">UH atual:</span>{' '}
              <span className="font-semibold">
                {reservation.roomNumber} / {reservation.roomType}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Check-in:</span>{' '}
              <span className="font-semibold">{formatDateBR(reservation.checkIn)}</span>
            </div>
            <div>
              <span className="text-slate-400">Check-out:</span>{' '}
              <span className="font-semibold">{formatDateBR(reservation.checkOut)}</span>
            </div>
            <div>
              <span className="text-slate-400">AD/CH:</span>{' '}
              <span className="font-semibold">
                {reservation.adults}/{reservation.children}
              </span>
            </div>
          </div>

          {mode === 'hospede' && (
            <>
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-400 mb-1.5">
                  Hóspedes da reserva
                </p>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-[12px]">
                    <thead className="bg-slate-50 border-b">
                      <tr className="text-left text-[10px] uppercase text-slate-400">
                        <th className="px-3 py-2 w-8" />
                        <th className="px-3 py-2">Nome</th>
                        <th className="px-3 py-2">Principal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {guests.map((g) => (
                        <tr key={g.id}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={guestIds.has(g.id)}
                              onChange={(e) => {
                                setGuestIds((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(g.id);
                                  else next.delete(g.id);
                                  return next;
                                });
                              }}
                            />
                          </td>
                          <td className="px-3 py-2 font-medium">{g.name}</td>
                          <td className="px-3 py-2">{g.principal ? 'S' : 'N'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold uppercase text-slate-400">
                  Novo hóspede principal (na UH origem, se restar alguém)
                </span>
                <select
                  value={newPrincipal}
                  onChange={(e) => {
                    const id = e.target.value;
                    setNewPrincipal(id);
                    const g = guests.find((x) => x.id === id);
                    if (id !== 'principal' && g) {
                      setNpName(g.name.startsWith('Acompanhante') ? '' : g.name);
                      setNpDoc('');
                      setNpPhone('');
                      setNpEmail('');
                      setNpNationality('Brasileira');
                    }
                  }}
                  className="w-full h-9 rounded-lg border border-slate-200 px-2 bg-white"
                >
                  {guests.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>

              {needsPrincipalData && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-amber-900 uppercase tracking-wide">
                    Dados do novo titular (obrigatório)
                  </p>
                  <p className="text-[11px] text-amber-800/80">
                    Acompanhantes não têm ficha completa no check-in. Preencha os dados de quem
                    ficará como titular na UH de origem.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block space-y-0.5 col-span-2">
                      <span className="text-[10px] uppercase text-slate-400 font-semibold">Nome completo</span>
                      <input
                        value={npName}
                        onChange={(e) => setNpName(e.target.value)}
                        className="w-full h-8 rounded-lg border border-slate-200 px-2 bg-white outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </label>
                    <label className="block space-y-0.5">
                      <span className="text-[10px] uppercase text-slate-400 font-semibold">Documento</span>
                      <input
                        value={npDoc}
                        onChange={(e) => setNpDoc(e.target.value)}
                        placeholder="CPF / Passaporte"
                        className="w-full h-8 rounded-lg border border-slate-200 px-2 bg-white outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </label>
                    <label className="block space-y-0.5">
                      <span className="text-[10px] uppercase text-slate-400 font-semibold">Telefone</span>
                      <input
                        value={npPhone}
                        onChange={(e) => setNpPhone(e.target.value)}
                        className="w-full h-8 rounded-lg border border-slate-200 px-2 bg-white outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </label>
                    <label className="block space-y-0.5">
                      <span className="text-[10px] uppercase text-slate-400 font-semibold">E-mail</span>
                      <input
                        value={npEmail}
                        onChange={(e) => setNpEmail(e.target.value)}
                        className="w-full h-8 rounded-lg border border-slate-200 px-2 bg-white outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </label>
                    <label className="block space-y-0.5">
                      <span className="text-[10px] uppercase text-slate-400 font-semibold">Nacionalidade</span>
                      <input
                        value={npNationality}
                        onChange={(e) => setNpNationality(e.target.value)}
                        className="w-full h-8 rounded-lg border border-slate-200 px-2 bg-white outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </label>
                  </div>
                </div>
              )}
            </>
          )}

          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase text-slate-400">
              Transferir para UH
            </span>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-2 bg-white"
            >
              <option value="">Selecione a UH…</option>
              {available.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number} · {r.type} · {GOVERNANCE_LABEL[r.governance]}
                  {r.block ? ` · ${r.block}` : ''}
                </option>
              ))}
            </select>
            {roomId && (
              <p className="text-[11px] text-slate-500 mt-0.5">
                Tipo: {rooms.find((r) => r.id === roomId)?.type}
              </p>
            )}
          </label>

          {mode === 'uh' && (
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase text-slate-400">Motivo</span>
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: vazamento na UH"
                className="w-full h-9 rounded-lg border border-slate-200 px-3 outline-none focus:ring-1 focus:ring-blue-400"
              />
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-slate-200 text-[13px] font-medium hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirm}
            className="h-9 px-4 rounded-lg bg-blue-600 text-white text-[13px] font-semibold hover:bg-blue-500"
          >
            {mode === 'uh' ? 'Inserir' : 'Transferir'}
          </button>
        </div>
      </div>
    </div>
  );
}
