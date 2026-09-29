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
