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
  payment_status?: string | null;
  payment_notes?: string | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
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

export type PaymentLogRow = {
  id: number;
  order_id: number;
  previous_status: string | null;
  new_status: string;
  note: string | null;
  created_at: string;
};

function parseNullableNumber(rawValue: unknown): number | null {
  if (rawValue === null || rawValue === undefined) return null;
  if (typeof rawValue === 'number') return Number.isFinite(rawValue) ? rawValue : null;
  if (typeof rawValue === 'string') {
    const normalizedValue = rawValue.replace(',', '.').trim();
    const parsedValue = Number(normalizedValue);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }
  return null;
}

function toIsoTimestamp(rawValue: unknown): string {
  if (rawValue instanceof Date) return rawValue.toISOString();
  return String(rawValue);
}

function asNullableString(rawValue: unknown): string | null {
  return typeof rawValue === 'string' ? rawValue : null;
}

function mapOrderRow(rawRow: Record<string, unknown>): OrderRow {
  return {
    id: Number(rawRow.id),
    order_number: String(rawRow.order_number),
    customer_type: String(rawRow.customer_type),
    organization_name: asNullableString(rawRow.organization_name),
    contact_name: String(rawRow.contact_name),
    email: String(rawRow.email),
    phone: asNullableString(rawRow.phone),
    delivery_address: asNullableString(rawRow.delivery_address),
    reference: asNullableString(rawRow.reference),
    notes: asNullableString(rawRow.notes),
    status: String(rawRow.status),
    payment_status: asNullableString(rawRow.payment_status),
    payment_notes: asNullableString(rawRow.payment_notes),
    subtotal: parseNullableNumber(rawRow.subtotal),
    tax: parseNullableNumber(rawRow.tax),
    total: parseNullableNumber(rawRow.total),
    created_at: toIsoTimestamp(rawRow.created_at)
  };
}

function mapOrderItemRow(rawRow: Record<string, unknown>): OrderItemRow {
  return {
    id: Number(rawRow.id),
    order_id: Number(rawRow.order_id),
    sku: String(rawRow.sku),
    name: String(rawRow.name),
    unit: asNullableString(rawRow.unit),
    quantity: Number(rawRow.quantity),
    unit_price: parseNullableNumber(rawRow.unit_price),
    total_price: parseNullableNumber(rawRow.total_price)
  };
}

function mapOrderDocumentRow(rawRow: Record<string, unknown>): OrderDocumentRow {
  return {
    id: Number(rawRow.id),
    order_id: Number(rawRow.order_id),
    type: String(rawRow.type),
    filename: String(rawRow.filename),
    blob_url: String(rawRow.blob_url),
    blob_pathname: asNullableString(rawRow.blob_pathname),
    created_at: toIsoTimestamp(rawRow.created_at)
  };
}

function mapOrderAttachmentRow(rawRow: Record<string, unknown>): OrderAttachmentRow {
  return {
    id: Number(rawRow.id),
    order_id: Number(rawRow.order_id),
    type: String(rawRow.type),
    filename: String(rawRow.filename),
    blob_url: String(rawRow.blob_url),
    created_at: toIsoTimestamp(rawRow.created_at)
  };
}

function mapPaymentLogRow(rawRow: Record<string, unknown>): PaymentLogRow {
  return {
    id: Number(rawRow.id),
    order_id: Number(rawRow.order_id),
    previous_status: asNullableString(rawRow.previous_status),
    new_status: String(rawRow.new_status),
    note: asNullableString(rawRow.note),
    created_at: toIsoTimestamp(rawRow.created_at)
  };
}

export async function fetchOrders(options?: {
  fromDate?: string | null;
  toDate?: string | null;
  query?: string | null;
}): Promise<OrderRow[]> {
  const pool = await getPool();
  const conditions: string[] = [];
  const queryParams: unknown[] = [];

  if (options?.fromDate) {
    queryParams.push(options.fromDate);
    conditions.push(`orders.created_at >= $${queryParams.length}`);
  }

  if (options?.toDate) {
    queryParams.push(options.toDate);
    conditions.push(`orders.created_at <= $${queryParams.length}`);
  }

  if (options?.query) {
    queryParams.push(`%${options.query}%`);
    const queryIndex = queryParams.length;
    conditions.push(
      `(orders.organization_name ilike $${queryIndex} or orders.contact_name ilike $${queryIndex} or orders.delivery_address ilike $${queryIndex})`
    );
  }

  const whereClause = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';

  const result = await pool.query(
    `
    select
      orders.id,
      orders.order_number,
      orders.customer_type,
      orders.organization_name,
      orders.contact_name,
      orders.email,
      orders.phone,
      orders.delivery_address,
      orders.reference,
      orders.notes,
      orders.status,
      orders.payment_status,
      orders.payment_notes,
      coalesce(orders.subtotal, computed_totals.subtotal, 0)::numeric as subtotal,
      coalesce(orders.tax, computed_totals.tax, 0)::numeric as tax,
      coalesce(orders.total, computed_totals.total, 0)::numeric as total,
      orders.created_at
    from orders
    left join (
      select
        order_items.order_id,
        round(sum(order_items.quantity * coalesce(order_items.unit_price, 0)), 2) as subtotal,
        round(sum(order_items.quantity * coalesce(order_items.unit_price, 0)) * 0.22, 2) as tax,
        round(sum(order_items.quantity * coalesce(order_items.unit_price, 0)) * 1.22, 2) as total
      from order_items
      group by order_items.order_id
    ) as computed_totals
      on computed_totals.order_id = orders.id
    ${whereClause}
    order by orders.created_at desc
    `,
    queryParams
  );

  return result.rows.map((rawRow) => mapOrderRow(rawRow as Record<string, unknown>));
}

export async function fetchOrderById(orderId: number): Promise<OrderRow | null> {
  const pool = await getPool();

  const result = await pool.query(
    `
    select
      orders.id,
      orders.order_number,
      orders.customer_type,
      orders.organization_name,
      orders.contact_name,
      orders.email,
      orders.phone,
      orders.delivery_address,
      orders.reference,
      orders.notes,
      orders.status,
      orders.payment_status,
      orders.payment_notes,
      coalesce(orders.subtotal, computed_totals.subtotal, 0)::numeric as subtotal,
      coalesce(orders.tax, computed_totals.tax, 0)::numeric as tax,
      coalesce(orders.total, computed_totals.total, 0)::numeric as total,
      orders.created_at
    from orders
    left join (
      select
        order_items.order_id,
        round(sum(order_items.quantity * coalesce(order_items.unit_price, 0)), 2) as subtotal,
        round(sum(order_items.quantity * coalesce(order_items.unit_price, 0)) * 0.22, 2) as tax,
        round(sum(order_items.quantity * coalesce(order_items.unit_price, 0)) * 1.22, 2) as total
      from order_items
      group by order_items.order_id
    ) as computed_totals
      on computed_totals.order_id = orders.id
    where orders.id = $1
    `,
    [orderId]
  );

  if (result.rows.length === 0) return null;
  return mapOrderRow(result.rows[0] as Record<string, unknown>);
}

export async function fetchOrderItems(orderId: number): Promise<OrderItemRow[]> {
  const pool = await getPool();
  const result = await pool.query(
    'select * from order_items where order_id = $1 order by id',
    [orderId]
  );
  return result.rows.map((rawRow) => mapOrderItemRow(rawRow as Record<string, unknown>));
}

export async function fetchOrderDocuments(orderId: number): Promise<OrderDocumentRow[]> {
  const pool = await getPool();
  const result = await pool.query(
    'select * from order_documents where order_id = $1 order by created_at desc',
    [orderId]
  );
  return result.rows.map((rawRow) => mapOrderDocumentRow(rawRow as Record<string, unknown>));
}

export async function fetchOrderDocumentsForOrders(
  orderIds: number[]
): Promise<OrderDocumentRow[]> {
  if (orderIds.length === 0) return [];
  const pool = await getPool();
  const result = await pool.query(
    'select * from order_documents where order_id = any($1::bigint[]) order by created_at desc',
    [orderIds]
  );
  return result.rows.map((rawRow) => mapOrderDocumentRow(rawRow as Record<string, unknown>));
}

export async function fetchOrderAttachments(orderId: number): Promise<OrderAttachmentRow[]> {
  const pool = await getPool();
  const result = await pool.query(
    'select * from order_attachments where order_id = $1 order by created_at desc',
    [orderId]
  );
  return result.rows.map((rawRow) => mapOrderAttachmentRow(rawRow as Record<string, unknown>));
}

export async function fetchOrderAttachmentsForOrders(
  orderIds: number[]
): Promise<OrderAttachmentRow[]> {
  if (orderIds.length === 0) return [];
  const pool = await getPool();
  const result = await pool.query(
    'select * from order_attachments where order_id = any($1::bigint[]) order by created_at desc',
    [orderIds]
  );
  return result.rows.map((rawRow) => mapOrderAttachmentRow(rawRow as Record<string, unknown>));
}

export async function fetchPaymentLogs(orderId: number): Promise<PaymentLogRow[]> {
  const pool = await getPool();
  try {
    const result = await pool.query(
      'select * from order_payment_logs where order_id = $1 order by created_at desc',
      [orderId]
    );
    return result.rows.map((rawRow) => mapPaymentLogRow(rawRow as Record<string, unknown>));
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '42P01'
    ) {
      return [];
    }
    throw error;
  }
}
