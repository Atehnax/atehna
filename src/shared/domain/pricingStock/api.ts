import type { PricingStockValues, PricingStockModel, PricingStockCalculation } from './types';

export type PricingStockSizing = {
  productType: 'simple' | 'dimensions' | 'weight' | 'unique_machine' | null;
  lengthMm: string | null;
  widthMm: string | null;
  thicknessMm: string | null;
  weightKg: string | null;
  shape: string | null;
  material: string | null;
};

export type PricingStockRow = PricingStockValues & {
  variantId: number;
  sizing?: PricingStockSizing;
  itemId: number;
  itemName: string;
  variantName: string;
  sku: string | null;
  unit: string;
  categoryId: string | null;
  categoryLabel: string;
  itemSlug: string;
  status: 'active' | 'inactive';
  stockRevision: string;
  pricingRevision: string;
  purchaseUpdatedAt: string | null;
  updatedAt: string;
  reserved: number | null;
  available: number;
  reservationNote: string | null;
  calculation: PricingStockCalculation;
};
export type PricingStockState = {
  rows: PricingStockRow[];
  model: PricingStockModel;
  stockEnforcementEnabled: boolean;
  capabilities: { viewCosts: boolean; editCosts: boolean; editPrices: boolean; editStock: boolean; editModel: boolean };
};
export type PricingStockRowChange = {
  variantId: number;
  expectedStockRevision?: string;
  expectedPricingRevision?: string;
  patch: Partial<PricingStockValues>;
};
export type PricingStockBatchRequest = {
  expectedModelRevision: string;
  model?: PricingStockModel;
  rows: PricingStockRowChange[];
};
export type PricingStockModelRequest = { expectedRevision: string; model: PricingStockModel };
export type PricingStockConflict = {
  code: 'PRICING_STOCK_CONFLICT';
  message: string;
  currentRows: PricingStockRow[];
  model: PricingStockModel;
  conflicts: Array<{ variantId: number; fields: string[] }>;
};
