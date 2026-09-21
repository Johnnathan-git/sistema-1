import { useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, FileText, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatBRL, formatDateBR, CHECKLIST, type HitsPayment, type GetnetSale, type BankLine, type FeeRule } from '@/lib/auditoria-core';
import type { AuditRecord, PendingItemView } from '@/lib/auditoria-workflow';
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
                <input
                  type="file"
                  accept=".txt,.csv,text/plain"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && up(e.target.files[0])}
                />
              </label>
              <button
                type="button"
                onClick={paste}
                className="h-8 px-3 rounded-lg border text-[11px] font-medium hover:bg-slate-50"
              >
                Colar texto
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="max-h-[420px] overflow-y-auto divide-y">
          {rows.length === 0 && (
            <p className="px-4 py-8 text-center text-[13px] text-slate-400">Sem dados ainda</p>
          )}
          {rows.map((r) => (
            <div key={r.id} className="px-4 py-2.5 flex items-start gap-2 text-[12px]">
              {r.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              )}
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
