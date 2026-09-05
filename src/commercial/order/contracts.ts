import type { CustomerType } from '@/shared/domain/order/customerType';
import type { OrderContractStatus } from '@/shared/domain/order/contractStatus';
import {
  SHIPPING_CALCULATION_VERSION,
  type ShippingCalculation
} from '@/shared/domain/shipping/shipping';

export type OrderEstimateRequest = {
  customerName?: string;
  customerLabels?: string[];
  items: Array<{
    variantId: number;
    quantity: number;
  }>;
};

export type OrderEstimateItem = {
  variantId: number;
  productId: number;
  productSlug: string;
  productName: string;
  variantName: string;
  sku: string;
  unit: string | null;
  quantity: number;
  minOrder: number;
  availableStock: number | null;
  imageUrl: string | null;
  attributes: Record<string, string | number>;
  baseUnitNet: number;
  discountPct: number;
  unitNet: number;
  lineNet: number;
  lineTax: number;
  lineGross: number;
  taxRate: number;
};

export type OrderEstimateTotals = {
  net: number;
  tax: number;
  shipping: number | null;
  gross: number | null;
  currency: 'EUR';
};

export type OrderEstimate = {
  items: OrderEstimateItem[];
  totals: OrderEstimateTotals;
  shipping: ShippingCalculation;
  shippingConfigurationVersion: number;
  /**
   * Compatibility wire name from the original `/api/orders/quote` endpoint.
   * It fingerprints a short-lived estimate, never an issued seller offer.
   */
  quoteFingerprint: string;
};

/** @deprecated Use OrderEstimateRequest. */
export type OrderQuoteRequest = OrderEstimateRequest;
/** @deprecated Use OrderEstimateItem. */
export type OrderQuoteItem = OrderEstimateItem;
/** @deprecated Use OrderEstimateTotals. */
export type OrderQuoteTotals = OrderEstimateTotals;
/** @deprecated Use OrderEstimate. */
export type OrderQuote = OrderEstimate;

export type OrderConfirmationItem = OrderEstimateItem & {
  lineListNet: number;
  lineDiscountNet: number;
  discountKind: 'quantity' | 'variant' | null;
  quantityDiscountPct: number | null;
};

export type OrderApiIssue = {
  code?: string;
  message: string;
  variantId?: number;
  field?: string;
};

export type OrderApiError = {
  code?: string;
  message: string;
  issues?: OrderApiIssue[];
  estimate?: OrderEstimate;
  /** @deprecated Use estimate. */
  quote?: OrderEstimate;
};

export type SubmitOrderRequest = {
  customerType: CustomerType;
  customerName: string;
  organizationName: string;
  contactName: string;
  email: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postalCode: string;
  gursHouseNumberId?: string;
  countryCode?: 'SI';
  reference?: string;
  notes: string;
  shippingConfigurationVersion: number;
  quoteFingerprint: string;
  items: Array<{
    variantId: number;
    quantity: number;
  }>;
};

export type SubmitOrderResponse = {
  accessId: string;
};

export type OrderConfirmationDocument = {
  type: string;
  url: string;
};

export type OrderConfirmationSnapshot = {
  orderCode: string;
  createdAt?: string;
  status?: string;
  paymentStatus?: string;
  commitmentStatus?: 'binding' | 'pending_confirmation' | 'rejected';
  contractStatus?: OrderContractStatus;
  stockNotCommitted?: boolean;
  parcelCount: number;
  customer?: {
    customerType?: CustomerType;
    customerName?: string;
    organizationName?: string;
    contactName?: string;
    email?: string;
    addressLine1?: string;
    addressLine2?: string | null;
    city?: string;
    postalCode?: string;
    gursHouseNumberId?: string | null;
    countryCode?: string;
    reference?: string;
    notes?: string;
  };
  items: OrderConfirmationItem[];
  totals: OrderEstimateTotals;
  shipping: ShippingCalculation;
  frozenShippingOverride?: { amount: number; reason: string } | null;
  documents: OrderConfirmationDocument[];
};

function isFiniteMoneyOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

const ORDER_QUOTE_FINGERPRINT_PATTERN = /^order-quote-v1:[a-f0-9]{64}$/u;

function isShippingCalculation(value: unknown): value is ShippingCalculation {
  if (typeof value !== 'object' || value === null) return false;
  const shipping = value as Record<string, unknown>;
  if (
    shipping.calculationVersion !== SHIPPING_CALCULATION_VERSION ||
    typeof shipping.configurationVersion !== 'number' ||
    !Number.isInteger(shipping.configurationVersion) ||
    shipping.configurationVersion < 1 ||
    !(
      shipping.combinedWeightGrams === null ||
      (typeof shipping.combinedWeightGrams === 'number' &&
        Number.isSafeInteger(shipping.combinedWeightGrams) &&
        shipping.combinedWeightGrams >= 0)
    )
  ) {
    return false;
  }

  if (shipping.status === 'manual_quote') {
    return (
      typeof shipping.reason === 'string' &&
      Array.isArray(shipping.issues) &&
      shipping.issues.every(
        (issue) =>
          typeof issue === 'object' &&
          issue !== null &&
          typeof (issue as Record<string, unknown>).code === 'string' &&
          typeof (issue as Record<string, unknown>).message === 'string'
      )
    );
  }
  if (shipping.status !== 'calculated') return false;

  return [
    'basePriceCents',
    'surchargeAmountCents',
    'automaticAmountCents',
    'finalAmountCents'
  ].every(
    (key) =>
      typeof shipping[key] === 'number' &&
      Number.isSafeInteger(shipping[key]) &&
      (shipping[key] as number) >= 0
  );
}

export function isOrderEstimate(value: unknown): value is OrderEstimate {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.items)) return false;
  if (typeof record.totals !== 'object' || record.totals === null) return false;
  const totals = record.totals as Record<string, unknown>;
  if (
    !['net', 'tax'].every(
      (key) => typeof totals[key] === 'number' && Number.isFinite(totals[key])
    ) ||
    !isFiniteMoneyOrNull(totals.shipping) ||
    !isFiniteMoneyOrNull(totals.gross) ||
    totals.currency !== 'EUR' ||
    !isShippingCalculation(record.shipping) ||
    typeof record.shippingConfigurationVersion !== 'number' ||
    !Number.isSafeInteger(record.shippingConfigurationVersion) ||
    record.shippingConfigurationVersion < 1 ||
    record.shippingConfigurationVersion !== record.shipping.configurationVersion ||
    typeof record.quoteFingerprint !== 'string' ||
    !ORDER_QUOTE_FINGERPRINT_PATTERN.test(record.quoteFingerprint)
  ) {
    return false;
  }
  if (record.shipping.status === 'manual_quote') {
    return totals.shipping === null && totals.gross === null;
  }
  return (
    typeof totals.shipping === 'number' &&
    typeof totals.gross === 'number' &&
    Math.round(totals.shipping * 100) === record.shipping.finalAmountCents
  );
}

/** @deprecated Use isOrderEstimate. */
export const isOrderQuote = isOrderEstimate;

export function parseOrderApiError(
  value: unknown,
  fallback = 'Zahteve ni bilo mogoče obdelati.'
): OrderApiError {
  if (typeof value !== 'object' || value === null) return { message: fallback };
  const record = value as Record<string, unknown>;
  const estimateCandidate =
    record.estimate ??
    record.currentEstimate ??
    record.quote ??
    record.currentQuote;
  const issues = Array.isArray(record.issues)
    ? record.issues.reduce<OrderApiIssue[]>((result, entry) => {
        if (typeof entry !== 'object' || entry === null) return result;
        const issue = entry as Record<string, unknown>;
        const message =
          typeof issue.message === 'string' && issue.message.trim()
            ? issue.message.trim()
            : '';
        if (!message) return result;
        result.push({
          ...(typeof issue.code === 'string' ? { code: issue.code } : {}),
          message,
          ...(typeof issue.variantId === 'number'
            ? { variantId: issue.variantId }
            : {}),
          ...(typeof issue.field === 'string' ? { field: issue.field } : {})
        });
        return result;
      }, [])
    : undefined;

  return {
    code: typeof record.code === 'string' ? record.code : undefined,
    message:
      typeof record.message === 'string' && record.message.trim()
        ? record.message.trim()
        : fallback,
    issues,
    estimate: isOrderEstimate(estimateCandidate)
      ? estimateCandidate
      : undefined,
    quote: isOrderEstimate(estimateCandidate) ? estimateCandidate : undefined
  };
}
