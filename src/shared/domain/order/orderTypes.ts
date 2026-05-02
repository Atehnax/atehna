export type OrderItemInput = {
  id: number;
  sku: string;
  name: string;
  unit: string | null;
  quantity: number;
  unit_price: number | null;
  discount_percentage?: number;
};

export type OrderPdfTypeKey =
  | 'order_summary'
  | 'purchase_order'
  | 'dobavnica'
  | 'predracun'
  | 'invoice';

export type GenerateOrderPdfType = OrderPdfTypeKey;

export type OrderPdfDocument = {
  id?: number;
  type: string;
  blob_url: string;
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
  delivery_address: string | null;
  postal_code?: string | null;
  reference: string | null;
  notes: string | null;
  status: string;
  payment_status?: string | null;
  admin_order_notes?: string | null;
  subtotal: number | null;
  tax: number | null;
  shipping: number | null;
  total: number | null;
  created_at: string;
  is_draft?: boolean;
  deleted_at?: string | null;
};

export type OrderItemRow = {
  id: number;
  order_id: number;
  sku: string;
  name: string;
  unit: string | null;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  discount_percentage: number;
};

export type OrderDocumentRow = {
  id: number;
  order_id: number;
  type: string;
  filename: string;
  blob_url: string;
  blob_pathname: string | null;
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
  status: string | null;
  payment_status: string | null;
  customer_type: string | null;
  total: number;
};

export type OrderListDocumentSummaryRow = {
  order_id: number;
  type: string;
  filename: string;
  blob_url: string;
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
  deliveryAddress: string | null,
  reference: string | null,
  notes: string | null,
  status: string,
  paymentStatus: string | null,
  adminOrderNotes: string | null,
  subtotal: number | string | null,
  tax: number | string | null,
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
  blobUrl: string,
  createdAt: string
];
