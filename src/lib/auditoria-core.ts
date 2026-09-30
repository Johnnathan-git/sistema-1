/* Auditoria Life — core */
export type MatchSide = 'both' | 'hits_only' | 'getnet_only' | 'value_diff';
export interface HitsPayment { id: string; date: string; pgto: string; op: string; due: string; guest: string; method: string; amount: number; fee: number; net: number; }
export interface PmsPayment {
  id: string;
  date: string;
  operation: string;
  operationType: string;
  due: string;
  guest: string;
  amount: number;
  balance: number;
  fee: number;
  net: number;
  paymentGroup: string;
  installments: number;
  installmentAmount: number;
  cashRegister: string;
  pdv: string;
  auth: string;
  user: string;
  reservation: string;
}
export type PmsGetnetMatchSide = 'both' | 'pms_only' | 'getnet_only' | 'divergence';
export interface PmsGetnetMatch {
  id: string;
  side: PmsGetnetMatchSide;
  pms?: PmsPayment;
  getnet?: GetnetSale;
  score: number;
  matchedBy: string;
  differences: string[];
}
export interface GetnetSale { id: string; date: string; time?: string; brand: string; modality: string; form: string; status: string; installments: number; settleDate: string; auth: string; cv: string; terminal: string; card: string; gross: number; fee: number; net: number; name?: string; }
export interface BankLine { id: string; date: string; description: string; amount: number; ref?: string; kind: 'getnet' | 'cielo' | 'pix' | 'other' | 'debit_out'; }
export interface FeeRule { id: string; label: string; brand: string; modality: string; feePercent: number; feeFixed: number; active: boolean; }
export interface HitsGetnetMatch { id: string; side: MatchSide; hits?: HitsPayment; getnet?: GetnetSale; delta?: number; }
export interface BankMatchRow { id: string; settleDate: string; expectedNet: number; bankCredit: number; delta: number; status: 'ok' | 'faltando_banco' | 'sobra_banco' | 'divergencia'; getnetIds: string[]; bankIds: string[]; detail: string; }
export const LS_AUDIT = 'pms-auditoria-life-v1';
export const LS_FEES = 'pms-auditoria-fees-v2';

export const CHECKLIST: { id: number; title: string; bullets: string[]; fridayOnly?: boolean }[] = [
  { id: 1, title: 'Conciliação PMS × Adquirente', bullets: ['Confere se todos os recebimentos registrados no PMS estão conciliados com os recebimentos do portal da adquirente.'] },
  { id: 2, title: 'Conciliação Adquirente × Banco', bullets: ['Confere se o líquido esperado na adquirente (após taxas/antecipação) confere com os créditos no extrato bancário.', 'Registra divergências de valor, data ou ausência de crédito.'] },
  { id: 3, title: 'Contas avulsas', bullets: ['Verifica se há contas avulsas em aberto que deveriam ter sido fechadas no dia.', 'Valida se as contas avulsas fechadas estão corretas (valores, consumos, forma de pagamento).'] },
  { id: 4, title: 'Check-outs', bullets: ['Confere se todos os check-outs do dia foram fechados corretamente no sistema.', 'Valida se os valores de diárias, consumos e extras foram devidamente lançados.', 'Verifica se a forma de pagamento registrada é real.'] },
  { id: 5, title: 'Check-ins', bullets: ['Verifica se todos os check-ins do dia foram realizados corretamente.', 'Confirma se o pagamento das diárias foi efetuado (restante do pagamento das diárias sempre no check-in).', 'Valida se a tarifa aplicada está correta (conforme tarifário vigente).'] },
  { id: 6, title: 'Late checkout / Early check-in', bullets: ['Verifica se houve late checkout ou early check-in no dia.', 'Confere se foram autorizados por quem de direito (Gerente ou Diretoria Life).', 'Valida se a cobrança proporcional foi aplicada corretamente.'] },
  { id: 7, title: 'Upgrades de quartos', bullets: ['Verifica se houve upgrades de quartos.', 'Confere se foram autorizados (Gerente/Diretoria Life) ou vendidos ao hóspede.', 'Valida se a tarifa aplicada está correta.'] },
  { id: 8, title: 'Descontos aplicados', bullets: ['Verifica todos os descontos concedidos no dia.', 'Confere se foram autorizados por quem de direito (Gerente ou Diretoria Life).', 'Valida se estão devidamente justificados no sistema.'] },
  { id: 9, title: 'Reservas cortesia / bloqueio', bullets: ['Verifica as reservas cortesia e as reservas com bloqueio do dia.', 'Confirma se estão devidamente autorizadas e registradas no sistema.'] },
  { id: 10, title: 'Serviços vendidos', bullets: ['Confere os valores dos serviços vendidos (cavalgada, quadriciclo, pacote romântico, etc.).', 'Valida se os valores praticados estão de acordo com a tabela vigente.'] },
  { id: 11, title: 'Estornos', bullets: ['Confere todos os estornos realizados no dia, validando se foram devidamente autorizados e justificados.'] },
  { id: 12, title: 'Outros pontos identificados', bullets: ['Investigar as causas e o motivo de qualquer outro ponto identificado e registrar na auditoria.'] },
  { id: 14, title: 'Comprovante de depósito semanal', fridayOnly: true, bullets: ['Concilia o valor depositado (comprovante bancário enviado direto para a Analista) com o relatório de pagamentos efetuados no PMS do período.'] },
];

export const DEFAULT_FEES: FeeRule[] = [
  { id: 'visa-deb', label: 'Visa Débito', brand: 'visa', modality: 'debito', feePercent: 0.79, feeFixed: 0, active: true },
  { id: 'visa-av', label: 'Visa Crédito à vista', brand: 'visa', modality: 'credito_vista', feePercent: 2.97, feeFixed: 0, active: true },
  { id: 'visa-p2', label: 'Visa Parcelado 2x', brand: 'visa', modality: 'parcelado_2', feePercent: 4.01, feeFixed: 0, active: true },
  { id: 'visa-p3', label: 'Visa Parcelado 3x', brand: 'visa', modality: 'parcelado_3', feePercent: 4.77, feeFixed: 0, active: true },
  { id: 'visa-p4', label: 'Visa Parcelado 4x', brand: 'visa', modality: 'parcelado_4', feePercent: 5.53, feeFixed: 0, active: true },
  { id: 'visa-p5', label: 'Visa Parcelado 5x', brand: 'visa', modality: 'parcelado_5', feePercent: 6.3, feeFixed: 0, active: true },
  { id: 'visa-p6', label: 'Visa Parcelado 6x', brand: 'visa', modality: 'parcelado_6', feePercent: 7.08, feeFixed: 0, active: true },
  { id: 'master-deb', label: 'Master Débito', brand: 'mastercard', modality: 'debito', feePercent: 0.79, feeFixed: 0, active: true },
  { id: 'master-av', label: 'Master Crédito à vista', brand: 'mastercard', modality: 'credito_vista', feePercent: 2.97, feeFixed: 0, active: true },
  { id: 'master-p2', label: 'Master Parcelado 2x', brand: 'mastercard', modality: 'parcelado_2', feePercent: 4.01, feeFixed: 0, active: true },
  { id: 'master-p3', label: 'Master Parcelado 3x', brand: 'mastercard', modality: 'parcelado_3', feePercent: 4.77, feeFixed: 0, active: true },
  { id: 'master-p4', label: 'Master Parcelado 4x', brand: 'mastercard', modality: 'parcelado_4', feePercent: 5.53, feeFixed: 0, active: true },
  { id: 'master-p5', label: 'Master Parcelado 5x', brand: 'mastercard', modality: 'parcelado_5', feePercent: 6.3, feeFixed: 0, active: true },
  { id: 'master-p6', label: 'Master Parcelado 6x', brand: 'mastercard', modality: 'parcelado_6', feePercent: 7.08, feeFixed: 0, active: true },
  { id: 'elo-deb', label: 'Elo Débito', brand: 'elo', modality: 'debito', feePercent: 1.29, feeFixed: 0, active: true },
  { id: 'elo-av', label: 'Elo Crédito à vista', brand: 'elo', modality: 'credito_vista', feePercent: 3.46, feeFixed: 0, active: true },
  { id: 'elo-p2', label: 'Elo Parcelado 2x', brand: 'elo', modality: 'parcelado_2', feePercent: 4.5, feeFixed: 0, active: true },
  { id: 'elo-p3', label: 'Elo Parcelado 3x', brand: 'elo', modality: 'parcelado_3', feePercent: 5.25, feeFixed: 0, active: true },
  { id: 'elo-p4', label: 'Elo Parcelado 4x', brand: 'elo', modality: 'parcelado_4', feePercent: 6.01, feeFixed: 0, active: true },
  { id: 'elo-p5', label: 'Elo Parcelado 5x', brand: 'elo', modality: 'parcelado_5', feePercent: 6.78, feeFixed: 0, active: true },
  { id: 'elo-p6', label: 'Elo Parcelado 6x', brand: 'elo', modality: 'parcelado_6', feePercent: 7.55, feeFixed: 0, active: true },
  { id: 'amex-deb', label: 'Amex Débito', brand: 'amex', modality: 'debito', feePercent: 0, feeFixed: 0, active: true },
  { id: 'amex-av', label: 'Amex Crédito à vista', brand: 'amex', modality: 'credito_vista', feePercent: 3.95, feeFixed: 0, active: true },
  { id: 'amex-p2', label: 'Amex Parcelado 2x', brand: 'amex', modality: 'parcelado_2', feePercent: 4.99, feeFixed: 0, active: true },
  { id: 'amex-p3', label: 'Amex Parcelado 3x', brand: 'amex', modality: 'parcelado_3', feePercent: 5.74, feeFixed: 0, active: true },
  { id: 'amex-p4', label: 'Amex Parcelado 4x', brand: 'amex', modality: 'parcelado_4', feePercent: 6.49, feeFixed: 0, active: true },
  { id: 'amex-p5', label: 'Amex Parcelado 5x', brand: 'amex', modality: 'parcelado_5', feePercent: 7.25, feeFixed: 0, active: true },
  { id: 'amex-p6', label: 'Amex Parcelado 6x', brand: 'amex', modality: 'parcelado_6', feePercent: 8.02, feeFixed: 0, active: true },
];

export function parseBRNumber(s: string): number {
  if (!s) return 0;
  let t = s.replace(/R\$\s*/gi, '').trim().replace(/[^\d,.\-]/g, '');
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.');
  else if (t.includes(',')) t = t.replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}
export function formatBRL(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
export function toISODate(br: string): string {
  const m = br.trim().match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
  if (!m) return '';
  let y = m[3];
  if (y.length === 2) y = Number(y) > 50 ? `19${y}` : `20${y}`;
  return `${y}-${m[2]}-${m[1]}`;
}
export function addDaysISO(iso: string, days: number): string {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
export function formatDateBR(iso: string) { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
export function todayISO() { return new Date().toISOString().slice(0, 10); }
export function isFriday(iso: string) { return new Date(iso + 'T12:00:00').getDay() === 5; }
function moneyEq(a: number, b: number, tol = 0.05) { return Math.abs(a - b) <= tol; }

async function pdfToText(file: File): Promise<string> {
  try {
    const pdfjs = await import('pdfjs-dist');
    const data = new Uint8Array(await file.arrayBuffer());
    if (pdfjs.GlobalWorkerOptions) {
      try { pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString(); } catch {}
    }
    const doc = await pdfjs.getDocument({ data }).promise;
    const parts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const vt = page.getViewport({ scale: 1 }).transform;
      const items = content.items.map((it: any) => {
        const t = Array.isArray(it?.transform) ? pdfjs.Util.transform(vt, it.transform) : [0, 0, 0, 0, 0, 0];
        return { str: typeof it === 'object' && it && 'str' in it ? String(it.str || '') : '', x: Number(t[4]) || 0, y: -(Number(t[5]) || 0), hasEOL: Boolean(it?.hasEOL) };
      }).filter((it: any) => it.str.trim());
      items.sort((a: any, b: any) => { if (Math.abs(a.y - b.y) > 2.5) return b.y - a.y; return a.x - b.x; });
      const lines: Array<{ y: number; parts: string[] }> = [];
      for (const item of items) {
        let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 2.5);
        if (!line) { line = { y: item.y, parts: [] }; lines.push(line); }
        line.parts.push(item.str);
        if (item.hasEOL) line.parts.push('\n');
      }
      lines.sort((a, b) => b.y - a.y);
      parts.push(lines.map((line) => line.parts.join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n'));
    }
    const text = parts.join('\n');
    if (!text.trim()) throw new Error('PDF sem texto legível (pode ser imagem). Use «Colar texto».');
    return text;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('Colar texto') || msg.includes('sem texto')) throw e;
    throw new Error('Não foi possível ler o PDF. Tente «Colar texto» ou exporte como TXT.');
  }
}

async function pdfToPmsText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const data = new Uint8Array(await file.arrayBuffer());
  if (pdfjs.GlobalWorkerOptions) {
    try { pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString(); } catch {}
  }
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();
    const items = content.items.map((item: any) => ({ str: typeof item?.str === 'string' ? item.str : '', hasEOL: Boolean(item?.hasEOL) })).filter((item: any) => item.str.trim());
    let pageText = '';
    for (const item of items) { pageText += item.str; pageText += item.hasEOL ? '\n' : ' '; }
    pages.push(pageText);
  }
  const text = pages.join('\n');
  if (!text.trim()) throw new Error('PDF PMS sem texto legível. Use «Colar texto».');
  return text;
}

export async function pmsFileToText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return pdfToPmsText(file);
  return file.text();
}
export async function fileToText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return pdfToText(file);
  return file.text();
}

export function parsePmsText(raw: string): PmsPayment[] {
  const out: PmsPayment[] = [];
  let paymentGroup = 'Geral';
  const text = raw
    .replace(/\r/g, ' ')
    .replace(/#\s*(?=\d)/g, '#')
    .replace(/(\d)\s*\/\s*(?=\d)/g, '$1/')
    .replace(/(\d)\s*\.\s*(?=\d)/g, '$1.')
    .replace(/(\d)\s*,\s*(?=\d)/g, '$1,')
    .replace(/\$\s*/g, '$')
    .replace(/\s+/g, ' ')
    .trim();

  const paymentRe = /(\d{2}\/\d{2}\/\d{2,4})\s+#?(\d+)\s+([A-Z]{1,3})\s+(\d{2}\/\d{2}\/\d{2,4})\s+(.+?)\s+\$?\s*([\d.]+,\d{2})\s+\$?\s*([\d.]+,\d{2})\s+\$?\s*([\d.]+,\d{2})\s+\$?\s*([\d.]+,\d{2})/gi;
  const matches = [...text.matchAll(paymentRe)];
  let previousEnd = 0;

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const guest = m[5].trim().replace(/\s+/g, ' ');
    if (!guest || /^(Data|Resumo|Resultado|Sub Total|Tipo|Pagamento)/i.test(guest)) continue;

    const pos = m.index ?? 0;
    const between = text.slice(previousEnd, pos);
    const groupCandidates = [...between.matchAll(/(?:Cielo\s+(?:Master|Visa|Elo|Amex|Hipercard)[^$#]{0,90}|PIX\s+Bradesco(?:\s*\([^)]*\))?|PIX|Getnet[^$#]{0,70}|Stone[^$#]{0,70}|Rede[^$#]{0,70})/gi)];
    if (groupCandidates.length) {
      paymentGroup = groupCandidates[groupCandidates.length - 1][0]
        .replace(/^Sub\s+Total\s+/i, '')
        .replace(/Data\s+Pgto\..*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    const nextPos = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    const detail = text.slice(pos + m[0].length, Math.min(nextPos, pos + m[0].length + 700));
    const parcel = detail.match(/Parcelas\s*:\s*(\d+)\s*x\s*\$?\s*([\d.]+,\d{2})/i);
    const caixa = detail.match(/Caixa\s*:\s*([^\s|]+)/i);
    const pdv = detail.match(/PDV\s*:\s*([^\s|]+)/i);
    const auth = detail.match(/AUT\.?\s*:\s*([^\s|]+)/i);
    const user = detail.match(/Usu[aá]rio\s*:\s*(.+?)(?=\s+\|?\s*Reservas?\s*:|\s+Sub\s+Total|$)/i);
    const reservation = detail.match(/Reservas?\s*:\s*#?([^\s|]+)/i);

    out.push({
      id: `pms-${out.length + 1}`,
      date: toISODate(m[1]),
      operation: m[2],
      operationType: m[3],
      due: toISODate(m[4]),
      guest,
      amount: parseBRNumber(m[6]),
      balance: parseBRNumber(m[7]),
      fee: parseBRNumber(m[8]),
      net: parseBRNumber(m[9]),
      paymentGroup,
      installments: parcel ? Number(parcel[1]) || 1 : 1,
      installmentAmount: parcel ? parseBRNumber(parcel[2]) : parseBRNumber(m[6]),
      cashRegister: caixa?.[1] || '',
      pdv: pdv?.[1] || '',
      auth: auth?.[1] || '',
      user: user?.[1]?.trim() || '',
      reservation: reservation?.[1] || '',
    });
    previousEnd = pos + m[0].length;
  }

  return out;
}

export function parseHitsText(raw: string): HitsPayment[] {
  const lines = raw.split(/\r?\n/); const out: HitsPayment[] = []; let method = 'Geral'; let idx = 0;
  for (const line of lines) {
    const trimmed = line.trim(); if (!trimmed) continue;
    if (/^(Cielo|PIX|Dinheiro|Getnet|Stone|Rede|Elo|Visa|Master)/i.test(trimmed) && !/^\d{2}\/\d{2}/.test(trimmed) && !/\$/.test(trimmed)) { method = trimmed.replace(/\s+/g, ' ').trim(); continue; }
    if (/^Sub Total/i.test(trimmed)) continue;
    const m = trimmed.match(/^(\d{2}\/\d{2}\/\d{2,4})\s+(#?\d+)\s+([A-Z]{1,3})\s+(\d{2}\/\d{2}\/\d{2,4})\s+(.+?)\s+(\$?[\d.]+,\d{2})\s+(\$?[\d.]+,\d{2})\s+(\$?[\d.]+,\d{2})\s+(\$?[\d.]+,\d{2})\s*$/);
    if (m) { out.push({ id: `h-${++idx}`, date: toISODate(m[1]), pgto: m[2], op: m[3], due: toISODate(m[4]), guest: m[5].trim(), method, amount: parseBRNumber(m[6]), fee: parseBRNumber(m[8]), net: parseBRNumber(m[9]) }); continue; }
    const loose = trimmed.match(/^(\d{2}\/\d{2}\/\d{2,4})\s+(#\d+)\s+([A-Z])\s+(\d{2}\/\d{2}\/\d{2,4})\s+(.+)$/);
    if (loose) {
      const money = [...loose[5].matchAll(/\$?\s*([\d.]+,\d{2})/g)].map((x) => parseBRNumber(x[1]));
      if (money.length >= 3) { const guest = loose[5].replace(/\$?\s*[\d.]+,\d{2}/g, '').replace(/\s+/g, ' ').trim(); out.push({ id: `h-${++idx}`, date: toISODate(loose[1]), pgto: loose[2], op: loose[3], due: toISODate(loose[4]), guest, method, amount: money[0], fee: money.length >= 4 ? money[2] : 0, net: money[money.length - 1] }); }
    }
  }
  return out;
}

export function parseGetnetText(raw: string): GetnetSale[] {
  const out: GetnetSale[] = []; let idx = 0; const flat = raw.replace(/\s+/g, ' ').trim();
  const headerRe = /(?:Comercial\s+)?\d+\s+\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\s+.*?\s+(Mastercard|Visa|Elo|Amex|Hipercard|Cabal)\s+(Crédito|Credito|Débito|Debito)\s+(.+?)\s+(Aprovada|Negada|Autorizada|Cancelada)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})\s+(\d{2})(?:\s+(\d{2}\/\d{2}\/\d{4}))?/gi;
  const detailRe = /(\d{6,}\*+\d{4})\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(R\$\s*[\d.]+,\d{2})\s+(-?R\$\s*[\d.]+,\d{2})\s+(R\$\s*[\d.]+,\d{2})\s+(\S+)/gi;
  const headers: Array<{ index: number; match: RegExpExecArray }> = []; const details: Array<{ index: number; match: RegExpExecArray }> = []; let m: RegExpExecArray | null;
  while ((m = headerRe.exec(flat))) headers.push({ index: m.index, match: m });
  while ((m = detailRe.exec(flat))) details.push({ index: m.index, match: m });
  for (const h of headers) {
    const d = details.find((candidate) => candidate.index > h.index && candidate.match.length > 0); if (!d) continue;
    const nextHeader = headers.find((candidate) => candidate.index > h.index); if (nextHeader && d.index > nextHeader.index) continue;
    const hm = h.match, dm = d.match;
    out.push({ id: `g-${++idx}`, date: toISODate(hm[5]), time: hm[6], brand: hm[1], modality: hm[2], form: hm[3].trim(), status: hm[4], installments: Number(hm[7]) || 1, settleDate: hm[8] ? toISODate(hm[8]) : toISODate(hm[5]), auth: dm[2] === 'N/A' ? '' : dm[2], cv: dm[3], terminal: dm[5], card: dm[1], gross: Math.abs(parseBRNumber(dm[6])), fee: Math.abs(parseBRNumber(dm[7])), net: Math.abs(parseBRNumber(dm[8])), name: (flat.slice(h.index, nextHeader ? nextHeader.index : h.index + 1500).match(/(?:Nome(?: do (?:Pagador|Portador|Cliente))?|Pagador)\s*:?\s+([A-ZÀ-Ú][A-Za-zÀ-ú' ]{3,60}?)(?=\s+(?:CPF|CNPJ|R\$|\d)|$)/)?.[1] || '').trim() || undefined });
    d.match = [] as unknown as RegExpExecArray;
  }
  const seen = new Set<string>();
  return out.filter((s) => { const k = `${s.date}|${s.time || ''}|${s.auth}|${s.cv}|${s.gross.toFixed(2)}|${s.status}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

export function parseSantanderText(raw: string): BankLine[] {
  const out: BankLine[] = []; let idx = 0;
  const classify = (desc: string, amount: number): BankLine['kind'] => { const d = desc.toLowerCase(); if (d.includes('getnet') || d.includes('antecipacao') || d.includes('antecipação')) return 'getnet'; if (d.includes('cielo')) return 'cielo'; if (d.includes('pix')) return 'pix'; if (amount < 0) return 'debit_out'; return 'other'; };
  const push = (dateBr: string, desc: string, amount: number, ref?: string) => { const date = toISODate(dateBr); if (!date || !Number.isFinite(amount) || amount === 0) return; const description = (desc || 'Crédito').replace(/\s+/g, ' ').trim(); out.push({ id: `b-${++idx}`, date, description, amount, ref, kind: classify(description, amount) }); };
  const lines = raw.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const skip = (l: string) => /^(Saldo|Posição|Entenda|Central|Página|Santander Empresas|Períodos|Data Histórico|SANTA ELIZA|Agência|A –|B –|C –|D -|E –|F –|G –|H –|I –|J -|Desbloqueio|Juros|IOF|Ouvidoria|SAC)/i.test(l);
  const fullLine = /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d.]+,\d{2})\s+([\d.]+,\d{2})$/; const noSaldo = /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d.]+,\d{2})$/; const onlyDate = /^(\d{2}\/\d{2}\/\d{4})$/; const docVals = /^(?:(\d{6,})\s+)?(-?[\d.]+,\d{2})\s+([\d.]+,\d{2})$/; const onlyVal = /^(-?[\d.]+,\d{2})$/; const used = new Set<number>();
  for (let i = 0; i < lines.length; i++) { const line = lines[i]; if (skip(line)) continue; let m = line.match(fullLine); if (m) { let mid = m[2].trim(), ref = ''; const parts = mid.split(' '); if (parts.length >= 2 && /^\d{6,}$/.test(parts[parts.length - 1])) { ref = parts[parts.length - 1]; mid = parts.slice(0, -1).join(' '); } push(m[1], mid, parseBRNumber(m[3]), ref); used.add(i); continue; } m = line.match(noSaldo); if (m && !/saldo disponível/i.test(m[2])) { push(m[1], m[2], parseBRNumber(m[3])); used.add(i); } }
  let pendingDate = '', pendingDesc: string[] = [];
  for (let i = 0; i < lines.length; i++) { if (used.has(i)) { pendingDate = ''; pendingDesc = []; continue; } const line = lines[i]; if (skip(line)) { pendingDate = ''; pendingDesc = []; continue; } const od = line.match(onlyDate); if (od) { pendingDate = od[1]; pendingDesc = []; continue; } const ds = line.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.*)$/); if (ds && !used.has(i)) { if (line.match(fullLine) || line.match(noSaldo)) continue; pendingDate = ds[1]; pendingDesc = ds[2] ? [ds[2]] : []; continue; } const dv = line.match(docVals); if (dv && pendingDate) { const ref = dv[1] || ''; const amount = parseBRNumber(dv[2]); const desc = pendingDesc.join(' ') || (ref ? `Doc ${ref}` : 'Movimento'); push(pendingDate, desc, amount, ref); pendingDate = ''; pendingDesc = []; continue; } const ov = line.match(onlyVal); if (ov && pendingDate && pendingDesc.length) { push(pendingDate, pendingDesc.join(' '), parseBRNumber(ov[1])); pendingDate = ''; pendingDesc = []; continue; } if (pendingDate && line && !/^\d{2}\/\d{2}/.test(line) && !onlyVal.test(line)) pendingDesc.push(line); }
  if (out.length === 0) { const flat = raw.replace(/\s+/g, ' '); const re = /(\d{2}\/\d{2}\/\d{4})\s+((?:(?!\d{2}\/\d{2}\/\d{4}).)+?)\s+(-?[\d.]+,\d{2})\s+([\d.]+,\d{2})/g; let mm: RegExpExecArray | null; while ((mm = re.exec(flat))) { let mid = mm[2].trim(); if (/Histórico|Documento|Valor/i.test(mid) && mid.length < 40) continue; let ref = ''; const parts = mid.split(/\s+/); if (parts.length >= 2 && /^\d{6,}$/.test(parts[parts.length - 1])) { ref = parts[parts.length - 1]; mid = parts.slice(0, -1).join(' '); } push(mm[1], mid, parseBRNumber(mm[3]), ref); } }
  const seen = new Set<string>(); return out.filter((b) => { const k = `${b.date}|${b.amount.toFixed(2)}|${b.description}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

export function reconcilePmsGetnet(pms: PmsPayment[], getnet: GetnetSale[]): PmsGetnetMatch[] {
  const eligible = getnet.filter((g) => {
    const st = (g.status || '').toLowerCase();
    return !/negada|cancelada|expirado/.test(st) && (g.gross > 0 || g.net > 0);
  });
  const pool = eligible.map((g) => ({ g, used: false }));
  const rows: PmsGetnetMatch[] = [];
  let idx = 0;

  const normAuth = (v: string) => (v || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const brandOf = (v: string) => {
    const t = (v || '').toLowerCase();
    if (/master/.test(t)) return 'Mastercard';
    if (/visa/.test(t)) return 'Visa';
    if (/\belo\b/.test(t)) return 'Elo';
    if (/amex|american/.test(t)) return 'Amex';
    if (/hiper/.test(t)) return 'Hipercard';
    if (/cabal/.test(t)) return 'Cabal';
    return '';
  };

  for (const p of pms) {
    const pAuth = normAuth(p.auth);
    const pBrand = brandOf(p.paymentGroup);
    let best = -1;
    let bestScore = -1;

    for (let j = 0; j < pool.length; j++) {
      if (pool[j].used) continue;
      const g = pool[j].g;
      const gAuth = normAuth(g.auth);
      const gBrand = brandOf(`${g.brand} ${g.form}`);

      const grossMatch = moneyEq(p.amount, g.gross);
      const authMatch = !!pAuth && !!gAuth && pAuth === gAuth;
      const brandMatch = !!pBrand && !!gBrand && pBrand === gBrand;
      const installmentsMatch = p.installments === g.installments;

      const score = Number(grossMatch) + Number(authMatch) + Number(brandMatch) + Number(installmentsMatch);
      if (score > bestScore) {
        bestScore = score;
        best = j;
      }
    }

    // Só pareia quando há evidência forte: pelo menos 3 dos 4 critérios.
    // Taxa e líquido não participam da conciliação.
    if (best >= 0 && bestScore >= 3) {
      const g = pool[best].g;
      pool[best].used = true;
      const differences: string[] = [];
      const gAuth = normAuth(g.auth);
      const gBrand = brandOf(`${g.brand} ${g.form}`);

      if (!moneyEq(p.amount, g.gross)) differences.push(`Valor bruto: PMS ${formatBRL(p.amount)} × Getnet ${formatBRL(g.gross)}`);
      if (pAuth !== gAuth) differences.push(`AUT: PMS ${p.auth || '—'} × Getnet ${g.auth || '—'}`);
      if (pBrand !== gBrand) differences.push(`Bandeira: PMS ${pBrand || '—'} × Getnet ${gBrand || '—'}`);
      if (p.installments !== g.installments) differences.push(`Parcelas: PMS ${p.installments} × Getnet ${g.installments}`);

      const exact = differences.length === 0;
      rows.push({
        id: `pm-${++idx}`,
        side: exact ? 'both' : 'divergence',
        pms: p,
        getnet: g,
        score: bestScore,
        matchedBy: exact ? 'valor bruto + AUT + bandeira + parcelas' : '3 de 4 critérios',
        differences,
      });
    } else {
      rows.push({ id: `pm-${++idx}`, side: 'pms_only', pms: p, score: 0, matchedBy: 'não encontrado', differences: [] });
    }
  }

  for (const item of pool) {
    if (!item.used) rows.push({ id: `pm-${++idx}`, side: 'getnet_only', getnet: item.g, score: 0, matchedBy: 'não encontrado no PMS', differences: [] });
  }
  return rows;
}

export function reconcileHitsGetnet(hits: HitsPayment[], getnet: GetnetSale[]): HitsGetnetMatch[] {
  const gPool = getnet.filter((g) => /aprovada|autorizada/i.test(g.status) || !g.status).filter((g) => g.net > 0 || g.gross > 0).map((g) => ({ g, used: false })); const matches: HitsGetnetMatch[] = []; let i = 0;
  for (const h of hits) { if (/dinheiro|pix/i.test(h.method)) { matches.push({ id: `m-${++i}`, side: 'hits_only', hits: h }); continue; } let best = -1, bestScore = Infinity; for (let j = 0; j < gPool.length; j++) { if (gPool[j].used) continue; const g = gPool[j].g; const dayDiff = Math.abs((new Date(h.date + 'T12:00:00').getTime() - new Date(g.date + 'T12:00:00').getTime()) / 86400000); if (dayDiff > 1) continue; const score = Math.min(Math.abs(h.net - g.net), Math.abs(h.amount - g.gross)) + dayDiff * 0.01; if (score < bestScore) { bestScore = score; best = j; } } if (best >= 0 && bestScore <= 1.0) { const g = gPool[best].g; gPool[best].used = true; matches.push({ id: `m-${++i}`, side: moneyEq(h.net, g.net) ? 'both' : 'value_diff', hits: h, getnet: g, delta: h.net - g.net }); } else matches.push({ id: `m-${++i}`, side: 'hits_only', hits: h }); }
  for (const { g, used } of gPool) if (!used && (g.net > 0 || g.gross > 0) && /aprovada|autorizada/i.test(g.status || 'x')) matches.push({ id: `m-${++i}`, side: 'getnet_only', getnet: g }); return matches;
}

function applyFeeRules(sale: GetnetSale, rules: FeeRule[]) {
  if (sale.fee > 0 && sale.net > 0) return { fee: sale.fee, net: sale.net };
  const b = sale.brand.toLowerCase(); const brand = b.includes('master') ? 'mastercard' : b.includes('visa') ? 'visa' : b.includes('elo') ? 'elo' : b.includes('amex') || b.includes('american') ? 'amex' : '*'; const form = `${sale.modality} ${sale.form}`.toLowerCase(); let modality = 'credito_vista'; if (/débito|debito/.test(form)) modality = 'debito'; else if (sale.installments >= 2 && sale.installments <= 6) modality = `parcelado_${sale.installments}`; else if (/parcel/.test(form)) modality = `parcelado_${Math.min(6, Math.max(2, sale.installments || 2))}`; const rule = rules.find((r) => r.active && r.brand === brand && r.modality === modality) || rules.find((r) => r.active && r.brand === brand && r.modality === 'credito_vista') || rules.find((r) => r.active && r.brand === '*'); if (!rule) return { fee: sale.fee, net: sale.net || sale.gross }; const fee = (sale.gross * rule.feePercent) / 100 + rule.feeFixed; return { fee, net: sale.gross - fee };
}

export function reconcileGetnetBank(getnet: GetnetSale[], bank: BankLine[], fees: FeeRule[]): BankMatchRow[] {
  type Grupo = 'pix' | 'debito' | 'credito_antec';
  const classifySale = (g: GetnetSale): Grupo => { const blob = `${g.brand} ${g.modality} ${g.form}`.toLowerCase(); if (/pix/.test(blob) || g.brand.toUpperCase() === 'PIX') return 'pix'; if (/d[eé]bito/.test(blob)) return 'debito'; return 'credito_antec'; };
  const settleFor = (g: GetnetSale, grupo: Grupo): string => { if (grupo === 'pix') return g.date || g.settleDate || ''; if (grupo === 'credito_antec') return g.date ? addDaysISO(g.date, 1) : (g.settleDate || ''); if (g.settleDate && g.date && g.settleDate > g.date) return g.settleDate; if (g.date) return addDaysISO(g.date, 1); return g.settleDate || ''; };
  const valid = getnet.filter((g) => { const st = (g.status || '').toLowerCase(); if (/negada|cancelada|expirado/.test(st)) return false; if (/aprovada|autorizada|paga/.test(st)) return true; return !st && (g.gross > 0 || g.net > 0); });
  type Lot = { net: number; ids: string[]; labels: string[] }; const expected = new Map<string, Lot>();
  for (const g of valid) { const grupo = classifySale(g); const settle = settleFor(g, grupo); if (!settle) continue; const { net } = applyFeeRules(g, fees); const key = `${settle}|${grupo}`; const prev = expected.get(key) || { net: 0, ids: [], labels: [] }; prev.net += net; prev.ids.push(g.id); prev.labels.push(`${g.brand} ${g.modality || g.form} ${formatBRL(net)}`.trim()); expected.set(key, prev); }
  const classifyBank = (b: BankLine): Grupo | null => { const d = (b.description || '').toLowerCase(); if (b.kind === 'cielo') return null; if (b.kind === 'pix' || d.includes('pix')) return 'pix'; if (b.kind !== 'getnet' && !d.includes('getnet')) return null; if (d.includes('antecipacao') || d.includes('antecipação')) return 'credito_antec'; if (d.includes('debito') || d.includes('débito') || d.includes('maestro') || d.includes('electron')) return 'debito'; return 'credito_antec'; };
  const received = new Map<string, Lot>();
  for (const b of bank) { if (b.amount <= 0) continue; const grupo = classifyBank(b); if (!grupo) continue; if (grupo === 'pix') { const hasPixExp = [...expected.keys()].some((k) => k.startsWith(`${b.date}|pix`)); if (!hasPixExp) continue; } const key = `${b.date}|${grupo}`; const prev = received.get(key) || { net: 0, ids: [], labels: [] }; prev.net += b.amount; prev.ids.push(b.id); prev.labels.push(b.description); received.set(key, prev); }
  const keys = new Set([...expected.keys(), ...received.keys()]); const rows: BankMatchRow[] = []; let i = 0; const grupoLabel = (g: string) => (g === 'pix' ? 'PIX' : g === 'debito' ? 'Débito' : 'Crédito (antecipado)');
  for (const key of [...keys].sort()) { const [date, grupo] = key.split('|'); const exp = expected.get(key), rec = received.get(key); const expectedNet = exp?.net || 0, bankCredit = rec?.net || 0, delta = bankCredit - expectedNet; let status: BankMatchRow['status'] = 'ok', detail = ''; if (expectedNet > 0 && bankCredit === 0) { status = 'faltando_banco'; detail = `${grupoLabel(grupo)}: esperado ${formatBRL(expectedNet)} — sem crédito no banco`; } else if (expectedNet === 0 && bankCredit > 0) { status = 'sobra_banco'; detail = `${grupoLabel(grupo)}: crédito ${formatBRL(bankCredit)} sem vendas Getnet`; } else if (Math.abs(delta) <= 0.05) { status = 'ok'; detail = `${grupoLabel(grupo)}: conciliado ${formatBRL(bankCredit)}`; } else if (grupo === 'credito_antec' && bankCredit > 0 && expectedNet > bankCredit) { const antec = expectedNet - bankCredit; status = 'ok'; detail = `${grupoLabel(grupo)}: ${formatBRL(bankCredit)} (MDR ok; taxa antecipação ~ ${formatBRL(antec)})`; } else { status = 'divergencia'; detail = `${grupoLabel(grupo)}: esperado ${formatBRL(expectedNet)} × banco ${formatBRL(bankCredit)} (Δ ${formatBRL(delta)})`; } rows.push({ id: `bm-${++i}`, settleDate: date, expectedNet, bankCredit, delta, status, getnetIds: exp?.ids || [], bankIds: rec?.ids || [], detail }); }
  return rows;
}
