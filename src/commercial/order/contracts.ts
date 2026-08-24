import type { CustomerType } from '@/shared/domain/order/customerType';

export type OrderQuoteRequest = {
  customerName?: string;
  items: Array<{
    variantId: number;
    quantity: number;
  }>;
};

export type OrderQuoteItem = {
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

export type OrderQuoteTotals = {
  net: number;
  tax: number;
  shipping: number;
  gross: number;
  currency: 'EUR';
};

export type OrderQuote = {
  items: OrderQuoteItem[];
  totals: OrderQuoteTotals;
};

export type OrderConfirmationItem = OrderQuoteItem & {
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
  createdAt?: string;
  status?: string;
  paymentStatus?: string;
  commitmentStatus?: 'binding' | 'pending_confirmation' | 'rejected';
  stockNotCommitted?: boolean;
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
  totals: OrderQuoteTotals;
  documents: OrderConfirmationDocument[];
};

export function isOrderQuote(value: unknown): value is OrderQuote {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.items)) return false;
  if (typeof record.totals !== 'object' || record.totals === null) return false;
  const totals = record.totals as Record<string, unknown>;
  return ['net', 'tax', 'shipping', 'gross'].every(
    (key) => typeof totals[key] === 'number' && Number.isFinite(totals[key])
  );
}

export function parseOrderApiError(
  value: unknown,
  fallback = 'Zahteve ni bilo mogoče obdelati.'
): OrderApiError {
  if (typeof value !== 'object' || value === null) return { message: fallback };
  const record = value as Record<string, unknown>;
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
    issues
  };
}
