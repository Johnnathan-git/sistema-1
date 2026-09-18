/** Taxas Santander — coluna Final ao Cliente % (MDR bruta + TX D+1 antecipação) */
import type { FeeRule } from '@/lib/auditoria-core';

export const SANTANDER_FINAL_CLIENTE_FEES: FeeRule[] = [
  // Visa
  { id: 'visa-deb', label: 'Visa Débito', brand: 'visa', modality: 'debito', feePercent: 0.79, feeFixed: 0, active: true },
  { id: 'visa-av', label: 'Visa Crédito à vista', brand: 'visa', modality: 'credito_vista', feePercent: 2.97, feeFixed: 0, active: true },
  { id: 'visa-p2', label: 'Visa Parcelado 2x', brand: 'visa', modality: 'parcelado_2', feePercent: 4.01, feeFixed: 0, active: true },
  { id: 'visa-p3', label: 'Visa Parcelado 3x', brand: 'visa', modality: 'parcelado_3', feePercent: 4.77, feeFixed: 0, active: true },
  { id: 'visa-p4', label: 'Visa Parcelado 4x', brand: 'visa', modality: 'parcelado_4', feePercent: 5.53, feeFixed: 0, active: true },
  { id: 'visa-p5', label: 'Visa Parcelado 5x', brand: 'visa', modality: 'parcelado_5', feePercent: 6.3, feeFixed: 0, active: true },
  { id: 'visa-p6', label: 'Visa Parcelado 6x', brand: 'visa', modality: 'parcelado_6', feePercent: 7.08, feeFixed: 0, active: true },
  // Mastercard (mesma tabela)
  { id: 'master-deb', label: 'Master Débito', brand: 'mastercard', modality: 'debito', feePercent: 0.79, feeFixed: 0, active: true },
  { id: 'master-av', label: 'Master Crédito à vista', brand: 'mastercard', modality: 'credito_vista', feePercent: 2.97, feeFixed: 0, active: true },
  { id: 'master-p2', label: 'Master Parcelado 2x', brand: 'mastercard', modality: 'parcelado_2', feePercent: 4.01, feeFixed: 0, active: true },
  { id: 'master-p3', label: 'Master Parcelado 3x', brand: 'mastercard', modality: 'parcelado_3', feePercent: 4.77, feeFixed: 0, active: true },
  { id: 'master-p4', label: 'Master Parcelado 4x', brand: 'mastercard', modality: 'parcelado_4', feePercent: 5.53, feeFixed: 0, active: true },
  { id: 'master-p5', label: 'Master Parcelado 5x', brand: 'mastercard', modality: 'parcelado_5', feePercent: 6.3, feeFixed: 0, active: true },
  { id: 'master-p6', label: 'Master Parcelado 6x', brand: 'mastercard', modality: 'parcelado_6', feePercent: 7.08, feeFixed: 0, active: true },
  // Elo
  { id: 'elo-deb', label: 'Elo Débito', brand: 'elo', modality: 'debito', feePercent: 1.29, feeFixed: 0, active: true },
  { id: 'elo-av', label: 'Elo Crédito à vista', brand: 'elo', modality: 'credito_vista', feePercent: 3.46, feeFixed: 0, active: true },
  { id: 'elo-p2', label: 'Elo Parcelado 2x', brand: 'elo', modality: 'parcelado_2', feePercent: 4.5, feeFixed: 0, active: true },
  { id: 'elo-p3', label: 'Elo Parcelado 3x', brand: 'elo', modality: 'parcelado_3', feePercent: 5.25, feeFixed: 0, active: true },
  { id: 'elo-p4', label: 'Elo Parcelado 4x', brand: 'elo', modality: 'parcelado_4', feePercent: 6.01, feeFixed: 0, active: true },
  { id: 'elo-p5', label: 'Elo Parcelado 5x', brand: 'elo', modality: 'parcelado_5', feePercent: 6.78, feeFixed: 0, active: true },
  { id: 'elo-p6', label: 'Elo Parcelado 6x', brand: 'elo', modality: 'parcelado_6', feePercent: 7.55, feeFixed: 0, active: true },
  // Amex
  { id: 'amex-deb', label: 'Amex Débito', brand: 'amex', modality: 'debito', feePercent: 0, feeFixed: 0, active: true },
  { id: 'amex-av', label: 'Amex Crédito à vista', brand: 'amex', modality: 'credito_vista', feePercent: 3.95, feeFixed: 0, active: true },
  { id: 'amex-p2', label: 'Amex Parcelado 2x', brand: 'amex', modality: 'parcelado_2', feePercent: 4.99, feeFixed: 0, active: true },
  { id: 'amex-p3', label: 'Amex Parcelado 3x', brand: 'amex', modality: 'parcelado_3', feePercent: 5.74, feeFixed: 0, active: true },
  { id: 'amex-p4', label: 'Amex Parcelado 4x', brand: 'amex', modality: 'parcelado_4', feePercent: 6.49, feeFixed: 0, active: true },
  { id: 'amex-p5', label: 'Amex Parcelado 5x', brand: 'amex', modality: 'parcelado_5', feePercent: 7.25, feeFixed: 0, active: true },
  { id: 'amex-p6', label: 'Amex Parcelado 6x', brand: 'amex', modality: 'parcelado_6', feePercent: 8.02, feeFixed: 0, active: true },
];
