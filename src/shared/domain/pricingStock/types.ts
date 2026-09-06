export type PricingStockDecimal = string;

export type PricingStockParameters = {
  headcount: string;
  employeeCost: string;
  availableHours: string;
  utilizationPercent: string;
  fixedCosts: string;
  targetProfit: string;
  adequacyThresholdPercent: string;
};

export type PricingStockModel = {
  revision: string;
  formulaVersion: 1;
  formula: string;
  parameters: PricingStockParameters;
};

export type PricingStockValues = {
  purchaseNet: string | null;
  saleNet: string | null;
  workMinutes: string | null;
  otherCosts: string | null;
  inventory: number;
};

export const PRICING_STOCK_EDITABLE_FIELDS = [
  'inventory', 'purchaseNet', 'saleNet', 'workMinutes', 'otherCosts'
] as const;
export type PricingStockEditableField = typeof PRICING_STOCK_EDITABLE_FIELDS[number];

export type PricingStockStatus = 'below' | 'borderline' | 'adequate' | 'missing';
export type PricingStockValidationIssue = {
  field: string;
  code: string;
  message: string;
  position?: number;
};

export class PricingStockValidationError extends Error {
  constructor(public readonly issues: PricingStockValidationIssue[]) {
    super(issues[0]?.message ?? 'Podatki za izračun niso veljavni.');
    this.name = 'PricingStockValidationError';
  }
}

export type PricingStockCalculation = {
  rvc: string | null;
  rvcPercent: string | null;
  targetRvc: string | null;
  difference: string | null;
  coveragePercent: string | null;
  recommendedPrice: string | null;
  capacityRate: string | null;
  status: PricingStockStatus;
  statusLabel: string;
  errors: PricingStockValidationIssue[];
};

export const PRICING_STOCK_STATUS_LABELS: Record<PricingStockStatus, string> = {
  below: 'Pod pragom',
  borderline: 'Na meji',
  adequate: 'Ustrezno',
  missing: 'Ni podatkov'
};

export function pricingStockIssue(
  field: string, code: string, message: string, position?: number
): PricingStockValidationError {
  return new PricingStockValidationError([{
    field, code, message, ...(position === undefined ? {} : { position })
  }]);
}
