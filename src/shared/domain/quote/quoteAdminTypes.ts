import { isCustomerType, type CustomerType } from '@/shared/domain/order/customerType';

export const QUOTE_REQUEST_STATUSES = [
  'received',
  'in_preparation',
  'offer_issued',
  'awaiting_purchase_order_review',
  'accepted',
  'declined',
  'expired',
  'withdrawn',
  'converted_to_order',
  'closed_without_offer'
] as const;

export type QuoteRequestStatus = (typeof QUOTE_REQUEST_STATUSES)[number];

export const QUOTE_OFFER_VERSION_STATUSES = [
  'draft',
  'issued',
  'accepted',
  'declined',
  'withdrawn',
  'expired',
  'superseded'
] as const;

export type QuoteOfferVersionStatus = (typeof QUOTE_OFFER_VERSION_STATUSES)[number];

export type AdminQuoteStatusFilter =
  | 'all'
  | 'preparation'
  | 'received'
  | 'issued'
  | 'ordered'
  | 'declined'
  | 'expired';

export type AdminQuoteCustomerTypeFilter = 'all' | CustomerType;

export const normalizeAdminQuoteCustomerTypeFilter = (
  value: string
): AdminQuoteCustomerTypeFilter => (isCustomerType(value) ? value : 'all');

export const normalizeAdminQuoteAmountBound = (value: string): string => {
  const trimmedValue = value.trim();
  if (!trimmedValue) return '';

  const numericValue = Number(trimmedValue);
  return Number.isFinite(numericValue) && numericValue >= 0
    ? String(numericValue)
    : '';
};

const ADMIN_QUOTE_REQUEST_NUMBER_BOUND_PATTERN = /^\d{1,6}$/;

export const normalizeAdminQuoteRequestNumberBound = (value: string): string => {
  const trimmedValue = value.trim();
  if (!ADMIN_QUOTE_REQUEST_NUMBER_BOUND_PATTERN.test(trimmedValue)) return '';

  const numericValue = Number(trimmedValue);
  return Number.isSafeInteger(numericValue) &&
    numericValue >= 0 &&
    numericValue <= 999_999
    ? String(numericValue)
    : '';
};

export const normalizeAdminQuoteRequestNumberRange = (
  minValue: string,
  maxValue: string
): { min: string; max: string } => {
  const min = normalizeAdminQuoteRequestNumberBound(minValue);
  const max = normalizeAdminQuoteRequestNumberBound(maxValue);
  return { min, max };
};

const ADMIN_QUOTE_DATE_BOUND_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const normalizeAdminQuoteDateBound = (value: string): string => {
  const trimmedValue = value.trim();
  const match = ADMIN_QUOTE_DATE_BOUND_PATTERN.exec(trimmedValue);
  if (!match) return '';

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  return parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() + 1 === month &&
    parsedDate.getUTCDate() === day
    ? trimmedValue
    : '';
};

export const normalizeAdminQuoteDateRange = (
  fromValue: string,
  toValue: string
): { from: string; to: string } => {
  const from = normalizeAdminQuoteDateBound(fromValue);
  const to = normalizeAdminQuoteDateBound(toValue);
  return from && to && from > to
    ? { from: to, to: from }
    : { from, to };
};

export type AdminQuoteQuickDateRange =
  | '7d'
  | '30d'
  | '90d'
  | '180d'
  | '365d'
  | 'ytd';

const formatAdminQuoteDateBound = (dateValue: Date) =>
  `${dateValue.getUTCFullYear()}-${String(dateValue.getUTCMonth() + 1).padStart(2, '0')}-${String(
    dateValue.getUTCDate()
  ).padStart(2, '0')}`;

export const getAdminQuoteQuickDateRange = (
  anchorDateValue: string,
  range: AdminQuoteQuickDateRange
): { from: string; to: string } => {
  const anchorDate = normalizeAdminQuoteDateBound(anchorDateValue);
  if (!anchorDate) return { from: '', to: '' };

  const [year, month, day] = anchorDate.split('-').map(Number);
  if (range === 'ytd') {
    return { from: `${year}-01-01`, to: anchorDate };
  }

  const dayCountByRange: Record<
    Exclude<AdminQuoteQuickDateRange, 'ytd'>,
    number
  > = {
    '7d': 6,
    '30d': 29,
    '90d': 89,
    '180d': 179,
    '365d': 364
  };
  const fromDate = new Date(Date.UTC(year, month - 1, day));
  fromDate.setUTCDate(fromDate.getUTCDate() - dayCountByRange[range]);
  return { from: formatAdminQuoteDateBound(fromDate), to: anchorDate };
};

export type AdminQuoteListRow = {
  id: number;
  requestNumber: string;
  status: QuoteRequestStatus | string;
  stateVersion: number;
  customerType: string;
  organizationName: string | null;
  contactName: string;
  customerName: string;
  email: string;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string | null;
  reference: string | null;
  quoteReason: string | null;
  customerMessage: string | null;
  createdAt: string;
  latestOfferVersionId: number | null;
  latestOfferNumber: string | null;
  latestOfferStatus: QuoteOfferVersionStatus | string | null;
  validUntil: string | null;
  quotedTotal: number | null;
  currency: string;
  shippingRequiresManualEntry: boolean;
  resultingOrderId: number | null;
  resultingOrderNumber: string | null;
  failedEmailCount: number;
  downloadableDocuments: Array<{
    id: number;
    offerVersionId: number;
    documentType: string;
    filename: string;
  }>;
};

export type AdminQuoteListPage = {
  rows: AdminQuoteListRow[];
  totalCount: number;
  newCount: number;
  latestCreatedAt: string | null;
};

export type AdminQuoteItem = {
  id: number;
  catalogItemId: number | null;
  catalogVariantId: number;
  lineNumber: number;
  productName: string;
  variantName: string | null;
  sku: string;
  unit: string | null;
  quantity: number;
  baseUnitNet: number;
  discountPct: number;
  unitNet: number;
  unitTax: number;
  unitGross: number;
  lineNet: number;
  lineTax: number;
  lineGross: number;
  taxRate: number;
  currency: string;
  selectedAttributes: Record<string, unknown> | null;
  snapshot: Record<string, unknown> | null;
};

export type AdminQuoteOfferVersion = {
  id: number;
  versionNumber: number;
  offerNumber: string | null;
  status: QuoteOfferVersionStatus | string;
  isCurrent: boolean;
  issuedAt: string | null;
  validUntil: string | null;
  subtotal: number;
  tax: number;
  shipping: number;
  shippingSnapshot: Record<string, unknown> | null;
  shippingConfirmation: Record<string, unknown> | null;
  total: number;
  currency: string;
  taxRate: number;
  deliveryTerms: string;
  paymentTerms: string;
  sellerMessage: string;
  customerVisibleNotes: string;
  termsText: string;
  termsVersion: string | null;
  termsHash: string | null;
  contentHash: string | null;
  stateVersion: number;
  createdAt: string;
  updatedAt: string;
  items: AdminQuoteItem[];
};

export type AdminQuoteDocument = {
  id: number;
  offerVersionId: number;
  documentType: string;
  filename: string;
  documentNumber: string | null;
  issuedAt: string | null;
  contentSha256: string | null;
  offerContentHash: string | null;
  createdAt: string;
  source: 'generated' | 'manual_upload';
  byteSize: number | null;
  mimeType: string | null;
};

export type AdminQuoteEmailJob = {
  id: string;
  offerVersionId: number | null;
  eventType: string;
  audience: string;
  recipientEmail: string;
  status: string;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type AdminQuoteEvent = {
  id: number;
  offerVersionId: number | null;
  eventType: string;
  actorType: string;
  actorId: string | null;
  occurredAt: string;
  reason: string | null;
  metadata: Record<string, unknown> | null;
};

export type AdminQuoteAccessState = {
  activeCount: number;
  latestExpiresAt: string | null;
  latestUsedAt: string | null;
};

export type AdminQuoteDetail = {
  id: number;
  requestNumber: string;
  status: QuoteRequestStatus | string;
  stateVersion: number;
  customerType: string;
  organizationName: string | null;
  contactName: string;
  email: string;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string | null;
  reference: string | null;
  quoteReason: string | null;
  customerMessage: string | null;
  adminNotes: string;
  adminTitle: string | null;
  createdAt: string;
  updatedAt: string;
  requestedItems: AdminQuoteItem[];
  offerVersions: AdminQuoteOfferVersion[];
  documents: AdminQuoteDocument[];
  emailJobs: AdminQuoteEmailJob[];
  events: AdminQuoteEvent[];
  access: AdminQuoteAccessState;
  resultingOrderId: number | null;
  resultingOrderNumber: string | null;
};

export type AdminQuoteFunnel = {
  requests: number;
  offersIssued: number;
  acceptedOrConverted: number;
  declined: number;
  withdrawn: number;
  expired: number;
  conversionRate: number;
  averageRequestToIssueHours: number | null;
  averageIssueToAcceptHours: number | null;
  quotedValue: number;
  convertedOrderValue: number;
};

export type AdminQuoteFunnelPreview = {
  overall: AdminQuoteFunnel;
  last30Days: AdminQuoteFunnel;
  previous30Days: AdminQuoteFunnel;
};
