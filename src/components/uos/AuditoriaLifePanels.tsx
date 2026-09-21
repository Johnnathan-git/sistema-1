import { useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, FileText, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateBR, CHECKLIST } from '@/lib/auditoria-core';
import type { AuditRecord } from '@/lib/auditoria-workflow';
import { statusLabel } from '@/lib/auditoria-workflow';

function formatDateTimeBR(iso?: string) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} às ${hh}:${mi}`;
  } catch { return iso; }
}

export function ConciliationPanel({
  title,
  leftLabel,
  rightLabel,
  leftCount,
  rightCount,
  onUploadLeft,
  onUploadRight,
  onPasteLeft,
  onPasteRight,
  rows,
}: {
  title: string;
  leftLabel: string;
  rightLabel: string;
  leftCount: number;
  rightCount: number;
  onUploadLeft: (f: File) => void;
  onUploadRight: (f: File) => void;
  onPasteLeft: () => void;
  onPasteRight: () => void;
  rows: { id: string; label: string; detail: string; ok: boolean }[];
}) {
  return (
    <div className="space-y-3">
      <p className="text-[14px] font-semibold text-slate-900">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(
          [
            [leftLabel, leftCount, onUploadLeft, onPasteLeft],
            [rightLabel, rightCount, onUploadRight, onPasteRight],
          ] as const
        ).map(([label, count, up, paste]) => (
          <div key={label} className="rounded-xl border bg-white p-4 space-y-2">
            <p className="text-[12px] font-semibold text-slate-700">
              {label} · {count} linha(s)
            </p>
            <div className="flex flex-wrap gap-2">
              <label className="h-8 px-3 rounded-lg border text-[11px] font-medium cursor-pointer inline-flex items-center gap-1 hover:bg-slate-50">
                <Upload className="w-3.5 h-3.5" /> Arquivo
                <input type="file" accept=".txt,.csv,text/plain" className="hidden" onChange={(e) => e.target.files?.[0] && up(e.target.files[0])} />
              </label>
              <button type="button" onClick={paste} className="h-8 px-3 rounded-lg border text-[11px] font-medium hover:bg-slate-50">
                Colar texto
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="max-h-[420px] overflow-y-auto divide-y">
          {rows.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-slate-400">Sem dados ainda</p>}
          {rows.map((r) => (
            <div key={r.id} className="px-4 py-2.5 flex items-start gap-2 text-[12px]">
              {r.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
              <div className="min-w-0">
                <p className="font-medium text-slate-800">{r.label}</p>
                <p className="text-slate-500">{r.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PendenciasPanel({
  items,
  onHotelResolve,
  onApprove,
  onReject,
}: {
  items: {
    auditId: string;
    hotelId: string;
    hotelName: string;
    auditDate: string;
    analyst: string;
    itemId: number;
    itemTitle: string;
    answer: {
      status: string;
      notes: string;
      attachmentName?: string;
      attachmentDataUrl?: string;
      pendingState: string;
      pendingAt?: string;
      hotelResolution?: string;
      hotelResolvedAt?: string;
      hotelAttachmentName?: string;
      hotelAttachmentDataUrl?: string;
      analystRejectNote?: string;
    };
  }[];
  onHotelResolve: (auditId: string, itemId: number, resolution: string, attName?: string, attData?: string) => void;
  onApprove: (auditId: string, itemId: number) => void;
  onReject: (auditId: string, itemId: number, reason: string) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rejectDrafts, setRejectDrafts] = useState<Record<string, string>>({});

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
        <AlertTriangle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-[15px] font-semibold text-slate-800">Nenhuma pendência aberta</p>
        <p className="text-[13px] text-slate-500 mt-1">Divergências do checklist aparecem aqui para o hotel resolver e a analista aprovar</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((p) => {
        const a = p.answer;
        const k = `${p.auditId}-${p.itemId}`;
        return (
          <div key={k} className="rounded-xl border bg-white p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[14px] font-semibold text-slate-900">
                  {p.itemId}. {p.itemTitle}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {p.hotelName} · auditoria {formatDateBR(p.auditDate)} · analista {p.analyst || '—'}
                  {a.pendingAt && <> · enviada {formatDateTimeBR(a.pendingAt)}</>}
                </p>
              </div>
              <span
                className={cn(
                  'text-[10px] font-bold uppercase px-2 py-0.5 rounded',
                  a.pendingState === 'open' && 'bg-rose-100 text-rose-800',
                  a.pendingState === 'resolved' && 'bg-amber-100 text-amber-900',
                )}
              >
                {a.pendingState === 'open' ? 'Aguardando hotel' : 'Aguardando analista'}
              </span>
            </div>
            {a.notes && (
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-[12px] text-slate-700">
                <span className="font-semibold text-slate-500">Divergência: </span>
                {a.notes}
              </div>
            )}
            {a.attachmentDataUrl && (
              <a href={a.attachmentDataUrl} download={a.attachmentName || 'anexo'} className="text-[12px] text-blue-700 font-medium inline-flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" /> {a.attachmentName || 'Anexo da analista'}
              </a>
            )}
            {a.analystRejectNote && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950">
                <strong>Recusa da analista:</strong> {a.analystRejectNote}
              </div>
            )}
            {a.pendingState === 'open' && (
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <p className="text-[11px] font-semibold uppercase text-slate-400">Resolução do hotel</p>
                <textarea
                  className="w-full min-h-[72px] rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                  placeholder="Descreva como a pendência foi resolvida…"
                  value={drafts[k] || ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [k]: e.target.value }))}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="h-8 px-3 rounded-lg border text-[11px] font-medium cursor-pointer inline-flex items-center gap-1 hover:bg-slate-50">
                    <Upload className="w-3.5 h-3.5" /> Anexo (opcional)
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (f.size > 2_500_000) {
                          toast.error('Arquivo muito grande');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => {
                          onHotelResolve(p.auditId, p.itemId, drafts[k] || '', f.name, String(reader.result || ''));
                          setDrafts((d) => ({ ...d, [k]: '' }));
                        };
                        reader.readAsDataURL(f);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      onHotelResolve(p.auditId, p.itemId, drafts[k] || '');
                      setDrafts((d) => ({ ...d, [k]: '' }));
                    }}
                    className="h-8 px-4 rounded-lg bg-slate-900 text-white text-[12px] font-semibold hover:bg-slate-800"
                  >
                    Enviar resolução
                  </button>
                </div>
              </div>
            )}
            {a.pendingState === 'resolved' && (
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-[12px] text-emerald-900">
                  <strong>Resolução hotel:</strong> {a.hotelResolution}
                  {a.hotelResolvedAt && <span className="text-emerald-700"> · {formatDateTimeBR(a.hotelResolvedAt)}</span>}
                </div>
                {a.hotelAttachmentDataUrl && (
                  <a href={a.hotelAttachmentDataUrl} download={a.hotelAttachmentName || 'anexo-hotel'} className="text-[12px] text-blue-700 font-medium inline-flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" /> {a.hotelAttachmentName || 'Anexo do hotel'}
                  </a>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => onApprove(p.auditId, p.itemId)} className="h-8 px-4 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold hover:bg-emerald-500">
                    Aprovar
                  </button>
                  <input
                    value={rejectDrafts[k] || ''}
                    onChange={(e) => setRejectDrafts((d) => ({ ...d, [k]: e.target.value }))}
                    placeholder="Justificativa da recusa"
                    className="h-8 flex-1 min-w-[140px] rounded-lg border px-2 text-[12px]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onReject(p.auditId, p.itemId, rejectDrafts[k] || '');
                      setRejectDrafts((d) => ({ ...d, [k]: '' }));
                    }}
                    className="h-8 px-4 rounded-lg border border-rose-300 text-rose-700 text-[12px] font-semibold hover:bg-rose-50"
                  >
                    Recusar
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AuditDetailModal({ record, onClose }: { record: AuditRecord; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-xl border flex flex-col">
        <div className="px-5 py-3 border-b bg-slate-50 flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-[15px]">{record.hotelName}</p>
            <p className="text-[12px] text-slate-500">
              {formatDateBR(record.header.date)} · {record.header.analyst || 'Analista'} · {statusLabel(record.status)}
            </p>
          </div>
          <button type="button" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {CHECKLIST.map((item) => {
            const a = record.answers[item.id];
            if (!a?.status) return null;
            return (
              <div key={item.id} className="rounded-xl border border-slate-100 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-medium">
                    {item.id}. {item.title}
                  </p>
                  {a.status === 'conforme' && (
                    <span className="text-[10px] font-bold uppercase text-white bg-emerald-600 px-2 py-0.5 rounded">Conforme</span>
                  )}
                  {a.status === 'divergencia' && (
                    <span className="text-[10px] font-bold uppercase text-white bg-rose-600 px-2 py-0.5 rounded">
                      Divergência · {a.pendingState}
                    </span>
                  )}
                </div>
                {a.notes && <p className="text-[12px] text-slate-600 mt-1">{a.notes}</p>}
                {a.hotelResolution && (
                  <p className="text-[12px] text-emerald-800 mt-1">Resolução hotel: {a.hotelResolution}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
