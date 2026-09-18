/* Auditoria Life — core */
export type MatchSide = 'both' | 'hits_only' | 'getnet_only' | 'value_diff';
export interface HitsPayment { id: string; date: string; pgto: string; op: string; due: string; guest: string; method: string; amount: number; fee: number; net: number; }
export interface GetnetSale { id: string; date: string; time?: string; brand: string; modality: string; form: string; status: string; installments: number; settleDate: string; auth: string; cv: string; terminal: string; card: string; gross: number; fee: number; net: number; }
export interface BankLine { id: string; date: string; description: string; amount: number; ref?: string; kind: 'getnet' | 'cielo' | 'pix' | 'other' | 'debit_out'; }
export interface FeeRule { id: string; label: string; brand: string; modality: string; feePercent: number; feeFixed: number; active: boolean; }
export interface HitsGetnetMatch { id: string; side: MatchSide; hits?: HitsPayment; getnet?: GetnetSale; delta?: number; }
export interface BankMatchRow { id: string; settleDate: string; expectedNet: number; bankCredit: number; delta: number; status: 'ok' | 'faltando_banco' | 'sobra_banco' | 'divergencia'; getnetIds: string[]; bankIds: string[]; detail: string; }
export const LS_AUDIT = 'pms-auditoria-life-v1';
export const LS_FEES = 'pms-auditoria-fees-v2';

export const CHECKLIST: { id: number; title: string; bullets: string[]; fridayOnly?: boolean }[] = [
  { id: 1, title: 'Conciliação PMS × Adquirente', bullets: ['Confere se todos os recebimentos registrados no PMS estão conciliados com os recebimentos do portal da adquirente (ex.: Getnet).'] },
  { id: 2, title: 'Conciliação Adquirente × Banco', bullets: ['Confere se o líquido esperado na adquirente (após taxas/antecipação) confere com os créditos no extrato bancário (D+1 / lotes).', 'Registra divergências de valor, data ou ausência de crédito.'] },
  { id: 3, title: 'Contas avulsas', bullets: ['Verifica se há contas avulsas em aberto que deveriam ter sido fechadas no dia.', 'Valida se as contas avulsas fechadas estão corretas (valores, consumos, forma de pagamento).'] },
  { id: 4, title: 'Check-outs do dia anterior e do dia', bullets: ['Confere se todos os check-outs do dia foram fechados corretamente no sistema.', 'Valida se os valores de diárias, consumos e extras foram devidamente lançados.', 'Verifica se a forma de pagamento registrada condiz com o que foi recebido.'] },
  { id: 5, title: 'Check-ins do dia anterior e do dia', bullets: ['Verifica se todos os check-ins do dia foram realizados corretamente.', 'Confirma se o pagamento da reserva foi efetuado (restante do pagamento das diárias sempre no check-in).', 'Valida se a tarifa aplicada está correta (conforme tarifário vigente).'] },
  { id: 6, title: 'Late checkout / Early check-in do dia anterior e do dia', bullets: ['Verifica se houve late checkout ou early check-in no dia.', 'Confere se foram autorizados por quem de direito (Gerente ou Diretoria Life).', 'Valida se a cobrança proporcional foi aplicada corretamente.'] },
  { id: 7, title: 'Upgrades de quartos do dia anterior e do dia', bullets: ['Verifica se houve upgrades de quartos no dia.', 'Confere se foram autorizados (Gerente/Diretoria Life) ou vendidos ao hóspede.', 'Valida se a tarifa aplicada está correta.'] },
  { id: 8, title: 'Descontos aplicados', bullets: ['Verifica todos os descontos concedidos no dia.', 'Confere se foram autorizados por quem de direito (Gerente ou Diretoria Life).', 'Valida se estão devidamente justificados no sistema.'] },
  { id: 9, title: 'Reservas cortesia / bloqueio', bullets: ['Verifica as reservas cortesia e as reservas com bloqueio do dia.', 'Confirma se estão devidamente autorizadas e registradas no sistema.'] },
  { id: 10, title: 'Serviços vendidos', bullets: ['Confere os valores dos serviços vendidos (cavalgada, quadriciclo, pacote romântico, etc.).', 'Valida se os valores praticados estão de acordo com a tabela vigente.', 'Verifica se todos os serviços foram devidamente lançados nas respectivas contas.'] },
  { id: 11, title: 'Estornos do dia anterior', bullets: ['Confere todos os estornos realizados no dia, validando se foram devidamente autorizados e justificados.'] },
  { id: 12, title: 'Divergências de cartão (correções)', bullets: ['Caso haja divergências como correção de cartão: bandeira, número de autorização, documento, valor, parcelamento.', 'Contatar de imediato a Líder de Recepção/substituto do dia para que seja feita a correção.'] },
  { id: 13, title: 'Outros pontos identificados', bullets: ['Investigar as causas e o motivo de qualquer outro ponto identificado e registrar na auditoria.'] },
  { id: 14, title: 'Conciliação do depósito semanal', fridayOnly: true, bullets: ['Concilia o valor depositado (comprovante) com o relatório de pagamentos efetuados no PMS do período.', 'Caso haja divergência: contata o responsável para resolver.', 'Caso não haja divergência: segue o fluxo normal da auditoria.'] },
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
export function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
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
export function formatDateBR(iso: string) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
export function isFriday(iso: string) {
  return new Date(iso + 'T12:00:00').getDay() === 5;
}
function moneyEq(a: number, b: number, tol = 0.05) {
  return Math.abs(a - b) <= tol;
}
export async function fileToText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    throw new Error('PDF não é lido automaticamente. Exporte como TXT/CSV ou use Colar texto.');
  }
  return file.text();
}
export function parseHitsText(raw: string): HitsPayment[] {
  const lines = raw.split(/\r?\n/);
  const out: HitsPayment[] = [];
  let method = 'Geral';
  let idx = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^(Cielo|PIX|Dinheiro|Getnet|Stone|Rede|Elo|Visa|Master)/i.test(trimmed) && !/^\d{2}\/\d{2}/.test(trimmed) && !/\$/.test(trimmed)) {
      method = trimmed.replace(/\s+/g, ' ').trim();
      continue;
    }
    if (/^Sub Total/i.test(trimmed)) continue;
    const m = trimmed.match(/^(\d{2}\/\d{2}\/\d{2,4})\s+(#?\d+)\s+([A-Z]{1,3})\s+(\d{2}\/\d{2}\/\d{2,4})\s+(.+?)\s+(\$?[\d.]+,\d{2})\s+(\$?[\d.]+,\d{2})\s+(\$?[\d.]+,\d{2})\s+(\$?[\d.]+,\d{2})\s*$/);
    if (m) {
      out.push({ id: `h-${++idx}`, date: toISODate(m[1]), pgto: m[2], op: m[3], due: toISODate(m[4]), guest: m[5].trim(), method, amount: parseBRNumber(m[6]), fee: parseBRNumber(m[8]), net: parseBRNumber(m[9]) });
      continue;
    }
    const loose = trimmed.match(/^(\d{2}\/\d{2}\/\d{2,4})\s+(#\d+)\s+([A-Z])\s+(\d{2}\/\d{2}\/\d{2,4})\s+(.+)$/);
    if (loose) {
      const money = [...loose[5].matchAll(/\$?\s*([\d.]+,\d{2})/g)].map((x) => parseBRNumber(x[1]));
      if (money.length >= 3) {
        const guest = loose[5].replace(/\$?\s*[\d.]+,\d{2}/g, '').replace(/\s+/g, ' ').trim();
        out.push({ id: `h-${++idx}`, date: toISODate(loose[1]), pgto: loose[2], op: loose[3], due: toISODate(loose[4]), guest, method, amount: money[0], fee: money.length >= 4 ? money[2] : 0, net: money[money.length - 1] });
      }
    }
  }
  return out;
}
export function parseGetnetText(raw: string): GetnetSale[] {
  const out: GetnetSale[] = [];
  const blocks = raw.split(/(?=Estabelecimento\s+CPF\/CNPJ)/i);
  let idx = 0;
  const pushFromChunk = (chunk: string) => {
    const statusM = chunk.match(/\b(Negada|Aprovada|Autorizada|Cancelada)\b/i);
    const brandM = chunk.match(/\b(Mastercard|Visa|Elo|Amex|Hipercard|Cabal)\b/i);
    const modM = chunk.match(/\b(Crédito|Credito|Débito|Debito)\b/i);
    const formM = chunk.match(/\b(Crédito À Vista|Credito A Vista|Débito|Debito|Parcelado[^\n]*)/i);
    const dates = [...chunk.matchAll(/(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}:\d{2}))?/g)];
    const amounts = [...chunk.matchAll(/-?R\$\s*([\d.]*\d,\d{2})/g)].map((x) => parseBRNumber(x[0]));
    const authM = chunk.match(/Autoriza[cç][aã]o[^0-9A-Z]*([0-9A-Z]{4,})/i);
    const parcM = chunk.match(/\b0?(\d{1,2})\s*(?:\n|$)/);
    if (!brandM && amounts.length < 2) return;
    if (!statusM && amounts.length < 2) return;
    const saleDate = dates[0] ? toISODate(dates[0][1]) : '';
    const settleDate = dates.length > 1 ? toISODate(dates[dates.length - 1][1]) : saleDate ? addDaysISO(saleDate, 1) : '';
    let gross = 0, fee = 0, net = 0;
    if (amounts.length >= 3) { gross = Math.abs(amounts[0]); fee = Math.abs(amounts[1]); net = Math.abs(amounts[2]); }
    else if (amounts.length === 2) { gross = Math.abs(amounts[0]); net = Math.abs(amounts[1]); fee = Math.max(0, gross - net); }
    else if (amounts.length === 1) { gross = net = Math.abs(amounts[0]); }
    if (!gross && !net) return;
    out.push({ id: `g-${++idx}`, date: saleDate, time: dates[0]?.[2], brand: brandM?.[1] || '', modality: modM?.[1] || '', form: formM?.[1] || '', status: statusM?.[1] || '', installments: parcM ? Number(parcM[1]) : 1, settleDate, auth: authM?.[1] || '', cv: '', terminal: '', card: '', gross, fee, net });
  };
  if (blocks.length > 1) for (const b of blocks) pushFromChunk(b);
  else for (const p of raw.split(/(?=\b(?:Negada|Aprovada|Autorizada)\b)/i)) pushFromChunk(p);
  const seen = new Set<string>();
  return out.filter((s) => { const k = `${s.date}|${s.auth}|${s.net}|${s.gross}|${s.status}`; if (seen.has(k)) return false; seen.add(k); return true; });
}
export function parseSantanderText(raw: string): BankLine[] {
  const lines = raw.split(/\r?\n/);
  const out: BankLine[] = [];
  let idx = 0;
  let pendingDate = '';
  let pendingAmount = 0;
  let pendingRef = '';
  const flush = (desc: string) => {
    if (!pendingDate || !pendingAmount) return;
    const d = desc.toLowerCase();
    let kind: BankLine['kind'] = 'other';
    if (d.includes('getnet') || d.includes('antecipacao getnet') || d.includes('antecipação getnet')) kind = 'getnet';
    else if (d.includes('cielo')) kind = 'cielo';
    else if (d.includes('pix')) kind = 'pix';
    else if (pendingAmount < 0) kind = 'debit_out';
    out.push({ id: `b-${++idx}`, date: pendingDate, description: desc.trim() || 'Crédito', amount: pendingAmount, ref: pendingRef, kind });
    pendingDate = ''; pendingAmount = 0; pendingRef = '';
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^\s*(\d{2}\/\d{2}\/\d{4})(?:\s+(.+?))?\s{2,}(-?[\d.]+,\d{2})\s+([\d.]+,\d{2})\s*$/);
    if (m) {
      if (pendingDate) flush(pendingRef || 'Movimento');
      pendingDate = toISODate(m[1]);
      const mid = (m[2] || '').trim();
      pendingRef = '';
      if (/^\d+$/.test(mid.replace(/\s/g, ''))) pendingRef = mid;
      else if (mid) { pendingAmount = parseBRNumber(m[3]); flush(mid); continue; }
      pendingAmount = parseBRNumber(m[3]);
      continue;
    }
    const descOnly = line.trim();
    if (pendingDate && descOnly && !/^\d{2}\/\d{2}/.test(descOnly) && !/Saldo|Página|Santander/i.test(descOnly)) flush(descOnly);
  }
  if (pendingDate) flush(pendingRef || 'Movimento');
  return out;
}
export function reconcileHitsGetnet(hits: HitsPayment[], getnet: GetnetSale[]): HitsGetnetMatch[] {
  const gPool = getnet.filter((g) => /aprovada|autorizada/i.test(g.status) || !g.status).filter((g) => g.net > 0 || g.gross > 0).map((g) => ({ g, used: false }));
  const matches: HitsGetnetMatch[] = [];
  let i = 0;
  for (const h of hits) {
    if (/dinheiro|pix/i.test(h.method)) { matches.push({ id: `m-${++i}`, side: 'hits_only', hits: h }); continue; }
    let best = -1, bestScore = Infinity;
    for (let j = 0; j < gPool.length; j++) {
      if (gPool[j].used) continue;
      const g = gPool[j].g;
      const dayDiff = Math.abs((new Date(h.date + 'T12:00:00').getTime() - new Date(g.date + 'T12:00:00').getTime()) / 86400000);
      if (dayDiff > 1) continue;
      const score = Math.min(Math.abs(h.net - g.net), Math.abs(h.amount - g.gross)) + dayDiff * 0.01;
      if (score < bestScore) { bestScore = score; best = j; }
    }
    if (best >= 0 && bestScore <= 1.0) {
      const g = gPool[best].g;
      gPool[best].used = true;
      matches.push({ id: `m-${++i}`, side: moneyEq(h.net, g.net) ? 'both' : 'value_diff', hits: h, getnet: g, delta: h.net - g.net });
    } else matches.push({ id: `m-${++i}`, side: 'hits_only', hits: h });
  }
  for (const { g, used } of gPool) {
    if (!used && (g.net > 0 || g.gross > 0) && /aprovada|autorizada/i.test(g.status || 'x')) matches.push({ id: `m-${++i}`, side: 'getnet_only', getnet: g });
  }
  return matches;
}
function applyFeeRules(sale: GetnetSale, rules: FeeRule[]) {
  if (sale.fee > 0 && sale.net > 0) return { fee: sale.fee, net: sale.net };
  const b = sale.brand.toLowerCase();
  const brand = b.includes('master') ? 'mastercard' : b.includes('visa') ? 'visa' : b.includes('elo') ? 'elo' : b.includes('amex') || b.includes('american') ? 'amex' : '*';
  const form = `${sale.modality} ${sale.form}`.toLowerCase();
  let modality = 'credito_vista';
  if (/débito|debito/.test(form)) modality = 'debito';
  else if (sale.installments >= 2 && sale.installments <= 6) modality = `parcelado_${sale.installments}`;
  else if (/parcel/.test(form)) modality = `parcelado_${Math.min(6, Math.max(2, sale.installments || 2))}`;
  const rule = rules.find((r) => r.active && r.brand === brand && r.modality === modality) || rules.find((r) => r.active && r.brand === brand && r.modality === 'credito_vista') || rules.find((r) => r.active && r.brand === '*');
  if (!rule) return { fee: sale.fee, net: sale.net || sale.gross };
  const fee = (sale.gross * rule.feePercent) / 100 + rule.feeFixed;
  return { fee, net: sale.gross - fee };
}
export function reconcileGetnetBank(getnet: GetnetSale[], bank: BankLine[], fees: FeeRule[]): BankMatchRow[] {
  const sales = getnet.filter((g) => /aprovada|autorizada/i.test(g.status) || (!g.status && g.gross > 0)).map((g) => {
    const { net } = applyFeeRules(g, fees);
    return { ...g, effectiveNet: net, settle: g.settleDate || addDaysISO(g.date, 1) };
  });
  const bySettle = new Map<string, { net: number; ids: string[] }>();
  for (const s of sales) {
    const prev = bySettle.get(s.settle) || { net: 0, ids: [] };
    prev.net += s.effectiveNet;
    prev.ids.push(s.id);
    bySettle.set(s.settle, prev);
  }
  const byBankDay = new Map<string, { amount: number; ids: string[] }>();
  for (const b of bank.filter((x) => x.amount > 0)) {
    const prev = byBankDay.get(b.date) || { amount: 0, ids: [] };
    if (b.kind === 'getnet' || /getnet/i.test(b.description)) {
      prev.amount += b.amount;
      prev.ids.push(b.id);
    }
    byBankDay.set(b.date, prev);
  }
  const dates = new Set([...bySettle.keys(), ...byBankDay.keys()]);
  const rows: BankMatchRow[] = [];
  let i = 0;
  for (const day of [...dates].sort()) {
    const exp = bySettle.get(day) || { net: 0, ids: [] };
    const bankCredit = byBankDay.get(day)?.amount || 0;
    const delta = exp.net - bankCredit;
    let status: BankMatchRow['status'] = 'ok';
    if (exp.net === 0 && bankCredit > 0) status = 'sobra_banco';
    else if (exp.net > 0 && bankCredit === 0) status = 'faltando_banco';
    else if (!moneyEq(exp.net, bankCredit, 1.0)) status = 'divergencia';
    if (exp.net === 0 && bankCredit === 0) continue;
    rows.push({ id: `bm-${++i}`, settleDate: day, expectedNet: exp.net, bankCredit, delta, status, getnetIds: exp.ids, bankIds: byBankDay.get(day)?.ids || [], detail: status === 'ok' ? 'OK' : status });
  }
  return rows;
}
