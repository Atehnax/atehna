import type { OrderEstimateTotals } from '@/commercial/order/contracts';
import type { CustomerType } from '@/shared/domain/order/customerType';
import {
  QUOTE_REASON_OPTIONS as SHARED_QUOTE_REASON_OPTIONS,
  type QuoteOfferStatus,
  type QuoteCustomerSnapshot as DomainQuoteCustomerSnapshot,
  type QuoteReason,
  type QuoteRequestStatus
} from '@/shared/domain/quote/quoteTypes';
import type { ShippingCalculation } from '@/shared/domain/shipping/shipping';

export {
  getQuoteReasonLabel,
  QUOTE_REASON_OPTIONS
} from '@/shared/domain/quote/quoteTypes';

export type QuoteRequestReason = QuoteReason;

export const QUOTE_REQUEST_REASON_OPTIONS = SHARED_QUOTE_REASON_OPTIONS;

export type SubmitQuoteRequestRequest = {
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
  countryCode: 'SI';
  reference?: string;
  notes?: string;
  quoteReason: QuoteRequestReason;
  quoteMessage?: string;
  shippingConfigurationVersion: number;
  quoteFingerprint: string;
  items: Array<{ variantId: number; quantity: number }>;
};

export type SubmitQuoteRequestResponse = {
  accessId: string;
  csrfToken?: string;
};

export type QuoteRequestState = QuoteRequestStatus;

export type QuoteCustomerSnapshot = DomainQuoteCustomerSnapshot & {
  customerName?: string;
};

export type QuoteRequestConfirmationSnapshot = {
  status: QuoteRequestState;
  quoteReason?: QuoteRequestReason;
  customerMessage?: string | null;
  requestedAt: string;
  customer: Pick<
    QuoteCustomerSnapshot,
    'customerType' | 'organizationName' | 'contactName' | 'email'
  > & {
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    postalCode: string | null;
  };
  items: Array<{
    lineNumber: number;
    sku: string;
    productName: string;
    variantName: string;
    quantity: number;
    unit: string | null;
    imageUrl: string | null;
  }>;
  estimate: {
    totals: OrderEstimateTotals;
    shipping: ShippingCalculation;
    isBinding: false;
  };
};

export type QuoteOfferState = QuoteOfferStatus;
export type QuoteAcceptanceMethod =
  | 'online'
  | 'purchase_order'
  | 'online_or_purchase_order';

export type QuoteOfferReviewSnapshot = {
  requestNumber: string;
  offerNumber: string;
  versionNumber: number;
  state: QuoteOfferState;
  issuedAt: string;
  validUntil: string;
  customer: QuoteCustomerSnapshot;
  items: QuoteOfferReviewWireSnapshot['items'];
  totals: OrderEstimateTotals;
  deliveryTerms: string;
  paymentTerms: string;
  acceptanceMethod: QuoteAcceptanceMethod;
  sellerMessage?: string | null;
  customerVisibleNotes?: string | null;
  termsText?: string;
  termsVersion?: string;
  customerReference?: string | null;
  documentUrl?: string | null;
  emailVerificationRequired: boolean;
  emailVerified: boolean;
  canAccept: boolean;
  canDecline: boolean;
  canUploadPurchaseOrder: boolean;
  resultingOrderAccessId?: string | null;
};

export type QuoteOfferReviewWireSnapshot = {
  requestNumber: string;
  offerNumber: string;
  versionNumber: number;
  status: QuoteOfferState;
  isCurrent: boolean;
  customer: QuoteCustomerSnapshot;
  deliveryTerms: string;
  paymentTerms: string;
  acceptanceMethod: QuoteAcceptanceMethod;
  sellerMessage?: string | null;
  customerVisibleNotes?: string | null;
  items: Array<{
    lineNumber: number;
    sku: string;
    productName: string;
    variantName: string;
    unit: string | null;
    quantity: number;
    unitNet: number;
    unitTax: number;
    unitGross: number;
    lineNet: number;
    lineTax: number;
    lineGross: number;
    taxRate: number;
    imageUrl?: string | null;
  }>;
  totals: OrderEstimateTotals;
  termsText?: string;
  termsVersion?: string;
  issuedAt: string;
  validUntil: string;
  documents: Array<{
    accessId: string;
    filename: string;
    contentSha256: string;
  }>;
  responseEnabled: boolean;
  canAccept?: boolean;
  canDecline?: boolean;
  canUploadPurchaseOrder?: boolean;
  emailVerificationRequired?: boolean;
  emailVerified?: boolean;
  resultingOrderAccessId?: string | null;
};

export type QuoteOtpRequestResponse = {
  verificationId: string;
  expiresAt: string;
};

export type QuoteOtpVerifyResponse = {
  verified: true;
  verifiedAt: string;
};

export type QuoteAcceptResponse = {
  status: 'accepted';
  orderAccessId: string;
};

export type QuoteDeclineResponse = {
  status: 'declined';
};

export type QuotePurchaseOrderResponse = {
  status: 'awaiting_purchase_order_review';
  orderAccessId: string;
};

export type QuotePublicApiError = {
  code?: string;
  message: string;
  issues?: string[];
};

export function parseQuotePublicApiError(
  value: unknown,
  fallback: string
): QuotePublicApiError {
  if (!value || typeof value !== 'object') return { message: fallback };
  const record = value as Record<string, unknown>;
  return {
    code: typeof record.code === 'string' ? record.code : undefined,
    message:
      typeof record.message === 'string' && record.message.trim()
        ? record.message.trim()
        : fallback,
    issues: Array.isArray(record.issues)
      ? record.issues.flatMap((issue) => {
          if (typeof issue === 'string' && issue.trim()) return [issue.trim()];
          if (issue && typeof issue === 'object') {
            const message = (issue as Record<string, unknown>).message;
            return typeof message === 'string' && message.trim()
              ? [message.trim()]
              : [];
          }
          return [];
        })
      : undefined
  };
}
