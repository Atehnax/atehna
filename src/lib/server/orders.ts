import { getPool } from '@/lib/server/db';

export type OrderRow = {
  id: number;
  order_number: string;
  customer_type: string;
  organization_name: string | null;
  contact_name: string;
  email: string;
  phone: string | null;
  delivery_address: string | null;
  reference: string | null;
  notes: string | null;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  created_at: string;
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

export type OrderAttachmentRow = {
  id: number;
  order_id: number;
  type: string;
  filename: string;
  blob_url: string;
  created_at: string;
};

export async function fetchOrders(): Promise<OrderRow[]> {
  const pool = await getPool();
  const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
  return result.rows as OrderRow[];
}

export async function fetchOrderById(orderId: number): Promise<OrderRow | null> {
  const pool = await getPool();
  const result = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  return (result.rows[0] as OrderRow) ?? null;
}

export async function fetchOrderItems(orderId: number): Promise<OrderItemRow[]> {
  const pool = await getPool();
  const result = await pool.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [
    orderId
  ]);
  return result.rows as OrderItemRow[];
}

export async function fetchOrderDocuments(orderId: number): Promise<OrderDocumentRow[]> {
  const pool = await getPool();
  const result = await pool.query(
    'SELECT * FROM order_documents WHERE order_id = $1 ORDER BY created_at DESC',
    [orderId]
  );
  return result.rows as OrderDocumentRow[];
}

export async function fetchOrderDocumentsForOrders(
  orderIds: number[]
): Promise<OrderDocumentRow[]> {
  if (orderIds.length === 0) return [];
  const pool = await getPool();
  const result = await pool.query(
    'SELECT * FROM order_documents WHERE order_id = ANY($1::bigint[]) ORDER BY created_at DESC',
    [orderIds]
  );
  return result.rows as OrderDocumentRow[];
}

export async function fetchOrderAttachments(orderId: number): Promise<OrderAttachmentRow[]> {
  const pool = await getPool();
  const result = await pool.query(
    'SELECT * FROM order_attachments WHERE order_id = $1 ORDER BY created_at DESC',
    [orderId]
  );
  return result.rows as OrderAttachmentRow[];
}
