// see next commit for full - placeholder to reserve path
export const LS_AUDIT = 'pms-auditoria-life-v1';
export const LS_FEES = 'pms-auditoria-fees-v1';
export const CHECKLIST: { id: number; title: string; bullets: string[]; fridayOnly?: boolean }[] = [];
export const DEFAULT_FEES: any[] = [];
export type MatchSide = 'both' | 'hits_only' | 'getnet_only' | 'value_diff';
export interface HitsPayment { id: string; date: string; pgto: string; op: string; due: string; guest: string; method: string; amount: number; fee: number; net: number; }
export interface GetnetSale { id: string; date: string; time?: string; brand: string; modality: string; form: string; status: string; installments: number; settleDate: string; auth: string; cv: string; terminal: string; card: string; gross: number; fee: number; net: number; }
export interface BankLine { id: string; date: string; description: string; amount: number; ref?: string; kind: 'getnet' | 'cielo' | 'pix' | 'other' | 'debit_out'; }
export interface FeeRule { id: string; label: string; brand: string; modality: string; feePercent: number; feeFixed: number; active: boolean; }
export interface HitsGetnetMatch { id: string; side: MatchSide; hits?: HitsPayment; getnet?: GetnetSale; delta?: number; }
export interface BankMatchRow { id: string; settleDate: string; expectedNet: number; bankCredit: number; delta: number; status: 'ok' | 'faltando_banco' | 'sobra_banco' | 'divergencia'; getnetIds: string[]; bankIds: string[]; detail: string; }
export function formatBRL(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
export function formatDateBR(iso: string) { if (!iso) return '—'; const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; }
export function todayISO() { return new Date().toISOString().slice(0,10); }
export function isFriday(iso: string) { return new Date(iso+'T12:00:00').getDay()===5; }
export async function fileToText(file: File) { return file.text(); }
export function parseHitsText(_raw: string): HitsPayment[] { return []; }
export function parseGetnetText(_raw: string): GetnetSale[] { return []; }
export function parseSantanderText(_raw: string): BankLine[] { return []; }
export function reconcileHitsGetnet(hits: HitsPayment[], getnet: GetnetSale[]): HitsGetnetMatch[] { return []; }
export function reconcileGetnetBank(getnet: GetnetSale[], bank: BankLine[], fees: FeeRule[]): BankMatchRow[] { return []; }
