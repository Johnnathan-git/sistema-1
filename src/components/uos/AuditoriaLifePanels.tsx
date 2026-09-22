import { useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, FileText, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateBR, CHECKLIST } from '@/lib/auditoria-core';
import type { AuditRecord } from '@/lib/auditoria-workflow';
import { statusLabel } from '@/lib/auditoria-workflow';
import { getSession, isAuditPendenciasOnly } from '@/lib/auth-store';

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

function openAttachment(dataUrl?: string, fileName?: string) {
  if (!dataUrl) return;
  try {
    const m = dataUrl.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/);
    if (!m) {
      window.open(dataUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    const mime = m[1] || 'application/octet-stream';
    const b64 = m[2];
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'anexo';
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName || 'anexo';
    a.click();
  }
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
    <div className="space-y-4">
      <p className="text-[15px] font-semibold text-slate-900 tracking-tight">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(
          [
            [leftLabel, leftCount, onUploadLeft, onPasteLeft],
            [rightLabel, rightCount, onUploadRight, onPasteRight],
          ] as const
        ).map(([label, count, up, paste]) => (
          <div key={label} className="rounded-xl border border-slate-200/80 bg-white p-4 space-y-3 shadow-sm hover:border-slate-300/80 transition-colors">
            <p className="text-[12px] font-semibold text-slate-700">
              {label} · <span className="tabular-nums text-slate-500">{count}</span> linha(s)
            </p>
            <div className="flex flex-wrap gap-2">
              <label className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-[11px] font-medium cursor-pointer inline-flex items-center gap-1.5 hover:bg-slate-50 hover:border-slate-300 transition-all">
                <Upload className="w-3.5 h-3.5 text-slate-500" /> Arquivo
                <input type="file" accept=".txt,.csv,text/plain" className="hidden" onChange={(e) => e.target.files?.[0] && up(e.target.files[0])} />
              </label>
              <button type="button" onClick={paste} className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-[11px] font-medium hover:bg-slate-50 hover:border-slate-300 transition-all">
                Colar texto
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-sm">
        <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
          {rows.length === 0 && (
            <p className="px-4 py-12 text-center text-[13px] text-slate-400">Sem dados ainda</p>
          )}
          {rows.map((r) => (
            <div key={r.id} className="px-4 py-3 flex items-start gap-2.5 text-[12px] hover:bg-slate-50/60 transition-colors">
              {r.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <p className="font-medium text-slate-800">{r.label}</p>
                <p className="text-slate-500 mt-0.5">{r.detail}</p>
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
  const [pendingAtt, setPendingAtt] = useState<Record<string, { name: string; dataUrl: string }>>({});

  const onlyPendencias = isAuditPendenciasOnly(getSession());

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-gradient-to-b from-white to-slate-50/80 px-6 py-16 text-center shadow-sm">
        <AlertTriangle className="w-11 h-11 text-slate-300 mx-auto mb-3" />
        <p className="text-[15px] font-semibold text-slate-800">Nenhuma pendência aberta</p>
        <p className="text-[13px] text-slate-500 mt-1 max-w-md mx-auto">
          Divergências do checklist aparecem aqui para o hotel resolver e a analista aprovar
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((p) => {
        const a = p.answer;
        const k = `${p.auditId}-${p.itemId}`;
        const att = pendingAtt[k];
        return (
          <div key={k} className="rounded-xl border border-slate-200/80 bg-white p-4 space-y-3 shadow-sm hover:border-slate-300/80 transition-colors">
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
                  'text-[10px] font-bold uppercase px-2.5 py-1 rounded-full tracking-wide',
                  a.pendingState === 'open' && 'bg-rose-100 text-rose-800',
                  a.pendingState === 'resolved' && 'bg-amber-100 text-amber-900',
                )}
              >
                {a.pendingState === 'open' ? 'Aguardando resolução' : 'Aguardando analista'}
              </span>
            </div>
            {a.notes && (
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 text-[12px] text-slate-700">
                <span className="font-semibold text-slate-500">Divergência: </span>
                {a.notes}
              </div>
            )}
            {a.attachmentDataUrl && (
              <button
                type="button"
                onClick={() => openAttachment(a.attachmentDataUrl, a.attachmentName)}
                className="text-[12px] text-sky-700 font-medium inline-flex items-center gap-1.5 hover:underline"
              >
                <FileText className="w-3.5 h-3.5" /> {a.attachmentName || 'Anexo da analista'}
              </button>
            )}
            {a.analystRejectNote && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-950">
                <strong>Recusa da analista:</strong> {a.analystRejectNote}
              </div>
            )}
            {a.pendingState === 'open' && (
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Resolução do hotel</p>
                <textarea
                  className="w-full min-h-[72px] rounded-xl border border-slate-200 px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all"
                  placeholder="Descreva como a pendência foi resolvida (obrigatório)…"
                  value={drafts[k] || ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [k]: e.target.value }))}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-[11px] font-medium cursor-pointer inline-flex items-center gap-1.5 hover:bg-slate-50 hover:border-slate-300 transition-all">
                    <Upload className="w-3.5 h-3.5 text-slate-500" /> {att ? 'Trocar anexo' : 'Anexo (opcional)'}
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (!f) return;
                        if (f.size > 2_500_000) {
                          toast.error('Arquivo muito grande');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => {
                          setPendingAtt((prev) => ({
                            ...prev,
                            [k]: { name: f.name, dataUrl: String(reader.result || '') },
                          }));
                          toast.message('Anexo pronto — preencha a resolução e clique em Enviar');
                        };
                        reader.readAsDataURL(f);
                      }}
                    />
                  </label>
                  {att && (
                    <>
                      <button
                        type="button"
                        onClick={() => openAttachment(att.dataUrl, att.name)}
                        className="text-[11px] text-sky-700 font-medium truncate max-w-[160px] hover:underline text-left"
                      >
                        {att.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingAtt((prev) => {
                          const next = { ...prev };
                          delete next[k];
                          return next;
                        })}
                        className="h-7 w-7 rounded-md text-rose-600 hover:bg-rose-50 inline-flex items-center justify-center"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const text = (drafts[k] || '').trim();
                      if (!text) {
                        toast.error('Descreva a resolução (obrigatório)');
                        return;
                      }
                      onHotelResolve(p.auditId, p.itemId, text, att?.name, att?.dataUrl);
                      setDrafts((d) => ({ ...d, [k]: '' }));
                      setPendingAtt((prev) => {
                        const next = { ...prev };
                        delete next[k];
                        return next;
                      });
                    }}
                    className="h-8 px-4 rounded-lg bg-gradient-to-r from-slate-900 to-slate-800 text-white text-[12px] font-semibold hover:from-slate-800 hover:to-slate-700 shadow-sm transition-all"
                  >
                    Enviar resolução
                  </button>
                </div>
              </div>
            )}
            {a.pendingState === 'resolved' && (
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5 text-[12px] text-emerald-900">
                  <strong>Resolução hotel:</strong> {a.hotelResolution}
                  {a.hotelResolvedAt && <span className="text-emerald-700"> · {formatDateTimeBR(a.hotelResolvedAt)}</span>}
                </div>
                {a.hotelAttachmentDataUrl && (
                  <button
                    type="button"
                    onClick={() => openAttachment(a.hotelAttachmentDataUrl, a.hotelAttachmentName)}
                    className="text-[12px] text-sky-700 font-medium inline-flex items-center gap-1.5 hover:underline"
                  >
                    <FileText className="w-3.5 h-3.5" /> {a.hotelAttachmentName || 'Anexo do hotel'}
                  </button>
                )}
                {!onlyPendencias && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => onApprove(p.auditId, p.itemId)} className="h-8 px-4 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold hover:bg-emerald-500 shadow-sm shadow-emerald-600/20 transition-all">
                    Aprovar
                  </button>
                  <input
                    value={rejectDrafts[k] || ''}
                    onChange={(e) => setRejectDrafts((d) => ({ ...d, [k]: e.target.value }))}
                    placeholder="Justificativa da recusa"
                    className="h-8 flex-1 min-w-[140px] rounded-lg border border-slate-200 px-2.5 text-[12px] outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onReject(p.auditId, p.itemId, rejectDrafts[k] || '');
                      setRejectDrafts((d) => ({ ...d, [k]: '' }));
                    }}
                    className="h-8 px-4 rounded-lg border border-rose-300 text-rose-700 text-[12px] font-semibold hover:bg-rose-50 transition-all"
                  >
                    Recusar
                  </button>
                </div>
                )}
                {onlyPendencias && a.pendingState === 'resolved' && (
                  <p className="text-[12px] text-amber-800 font-medium">Aguardando aprovação da analista</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AuditDetailModal({ record, onClose }: { record: AuditRecord; onClose: () => void }) {
  const logs = [...(record.logs || [])].reverse();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-900/20 border border-slate-200/80 flex flex-col">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-[15px] text-slate-900">{record.hotelName}</p>
            <p className="text-[12px] text-slate-500 mt-0.5">
              {formatDateBR(record.header.date)} · {record.header.analyst || 'Analista'} · {statusLabel(record.status)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-slate-200/60 inline-flex items-center justify-center text-slate-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {logs.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Log de alterações</p>
              <ul className="space-y-1.5 max-h-[160px] overflow-y-auto">
                {logs.map((l, i) => (
                  <li key={`${l.at}-${i}`} className="text-[12px] text-slate-700 flex flex-wrap gap-x-2 gap-y-0.5">
                    <span className="tabular-nums text-slate-500 shrink-0">{formatDateTimeBR(l.at)}</span>
                    <span className="font-medium text-slate-800">{l.user}</span>
                    <span className="text-slate-600">{l.action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-2.5">
            {CHECKLIST.map((item) => {
              const a = record.answers[item.id];
              if (!a?.status) return null;
              return (
                <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/40 px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-slate-800">
                      {item.id}. {item.title}
                    </p>
                    {a.status === 'conforme' && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-white bg-emerald-600 px-2.5 py-1 rounded-full">Conforme</span>
                    )}
                    {a.status === 'divergencia' && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-white bg-rose-600 px-2.5 py-1 rounded-full">
                        Divergência
                        {a.pendingState === 'approved' && ' · Aprovada'}
                        {a.pendingState === 'resolved' && ' · Aguardando analista'}
                        {a.pendingState === 'open' && ' · Aguardando resolução'}
                      </span>
                    )}
                  </div>
                  {a.notes && <p className="text-[12px] text-slate-600 mt-1.5">{a.notes}</p>}
                  {a.attachmentDataUrl && (
                    <button type="button" onClick={() => openAttachment(a.attachmentDataUrl, a.attachmentName)} className="text-[12px] text-sky-700 font-medium inline-flex items-center gap-1.5 mt-1 hover:underline">
                      <FileText className="w-3.5 h-3.5" /> {a.attachmentName || 'Anexo'}
                    </button>
                  )}
                  {a.hotelResolution && (
                    <p className="text-[12px] text-emerald-800 mt-1.5">Resolução hotel: {a.hotelResolution}</p>
                  )}
                  {a.hotelAttachmentDataUrl && (
                    <button type="button" onClick={() => openAttachment(a.hotelAttachmentDataUrl, a.hotelAttachmentName)} className="text-[12px] text-sky-700 font-medium inline-flex items-center gap-1.5 mt-1 hover:underline">
                      <FileText className="w-3.5 h-3.5" /> {a.hotelAttachmentName || 'Anexo hotel'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
