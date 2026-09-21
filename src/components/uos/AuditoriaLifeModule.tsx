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
    <div className="max-w-3xl mx-auto space-y-6 pt-4">
      <div className="text-center space-y-1">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white mb-2">
          <ClipboardCheck className="w-6 h-6" />
        </div>
        <h2 className="text-[20px] font-semibold text-slate-900">Auditoria Life</h2>
        <p className="text-[13px] text-slate-500">Selecione o hotel</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {AUDIT_HOTELS.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => onSelect(h.id)}
            className="text-left rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-400 hover:shadow-md transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-slate-900">{h.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{h.city}</p>
                <p className="text-[12px] text-slate-500 mt-2">{h.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
