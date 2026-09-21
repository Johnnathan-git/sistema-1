/**
 * Auditoria Life — checklist → Pendências (hotel) → analista → fechamento
 * + Histórico · PMS×Adquirente · Adquirente×Banco · Taxas
 */
import { useState } from 'react';
import { Building2, ClipboardCheck } from 'lucide-react';
import { AUDIT_HOTELS, LS_HOTEL, type HotelId } from '@/lib/auditoria-hotels';
import { AuditoriaHotelWorkspace } from '@/components/uos/AuditoriaLifeWorkspace';

function loadHotel(): HotelId | null {
  try {
    const v = localStorage.getItem(LS_HOTEL);
    if (v === 'santa-eliza' || v === 'varshana') return v;
  } catch {}
  return null;
}

export function AuditoriaLifeModule() {
  const [hotelId, setHotelId] = useState<HotelId | null>(() => loadHotel());
  if (!hotelId) {
    return (
      <HotelPicker
        onSelect={(id) => {
          localStorage.setItem(LS_HOTEL, id);
          setHotelId(id);
        }}
      />
    );
  }
  const hotel = AUDIT_HOTELS.find((h) => h.id === hotelId)!;
  return (
    <AuditoriaHotelWorkspace
      hotelId={hotelId}
      hotelName={hotel.name}
      onChangeHotel={() => {
        localStorage.removeItem(LS_HOTEL);
        setHotelId(null);
      }}
    />
  );
}

function HotelPicker({ onSelect }: { onSelect: (id: HotelId) => void }) {
  return (
    <div className="max-w-3xl mx-auto space-y-7 pt-6">
      <div className="text-center space-y-2">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600 text-white mb-1 shadow-lg shadow-indigo-900/20">
          <ClipboardCheck className="w-7 h-7" />
        </div>
        <h2 className="text-[22px] font-semibold text-slate-900 tracking-tight">Auditoria Life</h2>
        <p className="text-[13px] text-slate-500">Selecione o hotel para iniciar</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {AUDIT_HOTELS.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => onSelect(h.id)}
            className="text-left rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:border-sky-300 hover:shadow-md hover:shadow-sky-500/10 transition-all group"
          >
            <div className="flex items-start gap-3.5">
              <div className="h-11 w-11 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center group-hover:bg-gradient-to-br group-hover:from-sky-400 group-hover:to-indigo-600 group-hover:text-white transition-all shadow-sm">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-slate-900">{h.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{h.city}</p>
                <p className="text-[12px] text-slate-500 mt-2 leading-relaxed">{h.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
