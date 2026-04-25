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
