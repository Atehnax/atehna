import type { ShippingCalculation, ShippingManualOverride } from '@/shared/domain/shipping/shipping';

export type OrderContractStatus =
  | 'pending_seller_acceptance'
  | 'accepted'
  | 'rejected';

export type OrderContractEvidence = Record<string, unknown>;

export type OrderItemInput = {
  id: number;
  sku: string;
  name: string;
  unit: string | null;
  quantity: number;
  base_unit_net: number;
  discount_percentage?: number;
  catalog_item_id?: number | null;
  catalog_variant_id?: number | null;
  ship_later: boolean;
};

export type OrderPdfTypeKey =
  | 'order_summary'
  | 'purchase_order'
  | 'dobavnica'
  | 'predracun'
  | 'invoice';

export type GenerateOrderPdfType = Exclude<OrderPdfTypeKey, 'purchase_order'>;

export const SHIPPING_BEARING_ORDER_PDF_TYPES: readonly GenerateOrderPdfType[] = [
  'order_summary',
  'dobavnica',
  'predracun',
  'invoice'
] as const;

export function isShippingBearingOrderPdfType(
  value: string
): value is GenerateOrderPdfType {
  return (SHIPPING_BEARING_ORDER_PDF_TYPES as readonly string[]).includes(value);
}

export const ORDER_PDF_TYPE_CONFIGS: ReadonlyArray<{
  key: OrderPdfTypeKey;
  label: string;
  shortLabel: string;
  canGenerate: boolean;
}> = [
  { key: 'order_summary', label: 'Potrditev naročila', shortLabel: 'PN', canGenerate: true },
  { key: 'purchase_order', label: 'Naročilnica', shortLabel: 'N', canGenerate: false },
  { key: 'dobavnica', label: 'Dobavnica', shortLabel: 'D', canGenerate: true },
  { key: 'predracun', label: 'Predračun', shortLabel: 'P', canGenerate: true },
  { key: 'invoice', label: 'Račun', shortLabel: 'R', canGenerate: true }
] as const;

export function normalizeOrderPdfFilenameForPresentation(type: string, filename: string) {
  if (type !== 'order_summary' || !filename.startsWith('POT-')) return filename;
  return `PN-${filename.slice(4)}`;
}

export type OrderPdfDocument = {
  id?: number;
  type: string;
  url: string;
  filename: string;
  created_at: string;
};

export type PersistedOrderPdfDocument = OrderPdfDocument & {
  id: number;
};

export type OrderPdfDocumentSummary = PersistedOrderPdfDocument & {
  order_id: number;
};

export type OrderNumberAvailabilityResult = {
  inputDigits: string;
  normalizedOrderNumber: number | null;
  formattedOrderNumber: string | null;
  isAvailable: boolean;
  conflictOrderId: number | null;
  suggestions: string[];
};

export type OrderRow = {
  id: number;
  order_number: string;
  customer_type: string;
  organization_name: string | null;
  contact_name: string;
  email: string;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  gurs_house_number_id: string | null;
  country_code: string | null;
  commitment_status?: 'binding' | 'pending_confirmation' | 'rejected' | null;
  contract_status?: OrderContractStatus | null;
  contract_accepted_at?: string | null;
  contract_accepted_actor_type?: string | null;
  contract_accepted_actor_id?: string | null;
  contract_accepted_evidence_json?: OrderContractEvidence | null;
  contract_rejected_at?: string | null;
  contract_rejected_actor_type?: string | null;
  contract_rejected_actor_id?: string | null;
  contract_rejected_evidence_json?: OrderContractEvidence | null;
  contract_rejected_reason?: string | null;
  committed_at?: string | null;
  source_quote_offer_version_id?: number | null;
  source_quote_request_id?: number | null;
  source_quote_request_number?: string | null;
  source_quote_offer_number?: string | null;
  reference: string | null;
  notes: string | null;
  status: string;
  payment_status?: string | null;
  admin_order_notes?: string | null;
  subtotal: number | null;
  tax: number | null;
  tax_rate?: number | null;
  shipping: number | null;
  automatic_shipping: number | null;
  shipping_snapshot_json: ShippingCalculation | null;
  shipping_override_json: ShippingManualOverride | null;
  shipping_override_stale: boolean;
  parcel_count: number;
  pricing_revision: number;
  delivery_plan_revision: number;
  total: number | null;
  created_at: string;
  is_draft?: boolean;
  deleted_at?: string | null;
};

export type OrderItemRow = {
  id: number;
  order_id: number;
  catalog_item_id?: number | null;
  catalog_variant_id?: number | null;
  ship_later: boolean;
  sku: string;
  name: string;
  unit: string | null;
  quantity: number;
  base_unit_net: number;
  line_net: number;
  discount_percentage: number;
};

export type OrderDocumentRow = {
  id: number;
  order_id: number;
  type: string;
  filename: string;
  url: string;
  created_at: string;
};

export type PaymentLogRow = {
  id: number;
  order_id: number;
  previous_status: string | null;
  new_status: string;
  note: string | null;
  created_at: string;
};

export type OrderItemSkuAllocationRow = {
  orderId: number;
  orderNumber: string;
  orderStatus: string;
  orderCreatedAt: string;
  orderItemId: number;
  orderItemSku: string;
  orderItemName: string;
  quantity: number;
  shippedAt: string | null;
};

export type OrderAnalyticsRow = {
  id: number;
  created_at: string;
  committed_at: string | null;
  contract_accepted_at: string | null;
  status: string | null;
  payment_status: string | null;
  commitment_status: string | null;
  contract_status: OrderContractStatus | null;
  customer_type: string | null;
  total: number;
};

export type OrderListDocumentSummaryRow = {
  id: number;
  order_id: number;
  type: string;
  filename: string;
  url: string;
  created_at: string;
};

export type OrderListPageResult = {
  orders: OrderRow[];
  documentSummaries: OrderListDocumentSummaryRow[];
  totalCount: number;
};

export type OrderCustomerSuggestionsResponse = {
  customers: string[];
  message?: string;
};

export type AdminOrderRowTuple = readonly [
  id: number,
  orderNumber: string,
  customerType: string,
  organizationName: string | null,
  contactName: string,
  email: string,
  addressLine1: string | null,
  addressLine2: string | null,
  postalCode: string | null,
  city: string | null,
  countryCode: string | null,
  reference: string | null,
  notes: string | null,
  status: string,
  paymentStatus: string | null,
  adminOrderNotes: string | null,
  subtotal: number | string | null,
  tax: number | string | null,
  shipping: number | string | null,
  automaticShipping: number | string | null,
  shippingOverride: ShippingManualOverride | null,
  shippingOverrideStale: boolean,
  total: number | string | null,
  createdAt: string,
  isDraft: boolean,
  deletedAt?: string | null
];

export type AdminOrderPdfDocumentTuple = readonly [
  id: number,
  orderId: number,
  type: string,
  filename: string,
  url: string,
  createdAt: string
];

export type AdminOrderAnalyticsTuple = readonly [
  createdAt: string,
  status: string | null,
  total: number,
  commitmentStatus: string | null,
  contractStatus: OrderContractStatus | null,
  committedAt: string | null,
  contractAcceptedAt: string | null
];
