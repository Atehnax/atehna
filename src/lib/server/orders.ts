import { getPool } from '@/lib/server/db';

let hasOrdersDraftColumnCache: boolean | null = null;
let hasOrdersDeletedColumnCache: boolean | null = null;
let hasOrdersPaymentStatusColumnCache: boolean | null = null;
let hasOrdersPaymentNotesColumnCache: boolean | null = null;
let hasDocumentsDeletedColumnCache: boolean | null = null;

async function hasOrdersColumn(columnName: string) {
  const pool = await getPool();
  const result = await pool.query(
    `
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = $1
    limit 1
    `,
    [columnName]
  );

  return Number(result.rowCount ?? 0) > 0;
}

async function hasOrdersDraftColumn() {
  if (hasOrdersDraftColumnCache !== null) return hasOrdersDraftColumnCache;

  hasOrdersDraftColumnCache = await hasOrdersColumn('is_draft');
  return hasOrdersDraftColumnCache;
}

async function hasOrdersDeletedColumn() {
  if (hasOrdersDeletedColumnCache !== null) return hasOrdersDeletedColumnCache;

  hasOrdersDeletedColumnCache = await hasOrdersColumn('deleted_at');
  return hasOrdersDeletedColumnCache;
}

async function hasOrdersPaymentStatusColumn() {
  if (hasOrdersPaymentStatusColumnCache !== null) return hasOrdersPaymentStatusColumnCache;

  hasOrdersPaymentStatusColumnCache = await hasOrdersColumn('payment_status');
  return hasOrdersPaymentStatusColumnCache;
}

async function hasOrdersPaymentNotesColumn() {
  if (hasOrdersPaymentNotesColumnCache !== null) return hasOrdersPaymentNotesColumnCache;

  hasOrdersPaymentNotesColumnCache = await hasOrdersColumn('payment_notes');
  return hasOrdersPaymentNotesColumnCache;
}

async function hasDocumentsDeletedColumn() {
  if (hasDocumentsDeletedColumnCache !== null) return hasDocumentsDeletedColumnCache;

  const pool = await getPool();
  const result = await pool.query(
    `
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'order_documents'
      and column_name = 'deleted_at'
    limit 1
    `
  );

  hasDocumentsDeletedColumnCache = Number(result.rowCount ?? 0) > 0;
  return hasDocumentsDeletedColumnCache;
}

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
    created_at: toIsoTimestamp(rawRow.created_at),
    is_draft: Boolean(rawRow.is_draft),
    deleted_at: asNullableString(rawRow.deleted_at)
  };
}

function mapOrderItemRow(rawRow: Record<string, unknown>): OrderItemRow {
  const quantity = Number(rawRow.quantity);
  const unitPrice = parseNullableNumber(rawRow.unit_price);
  const totalPrice = parseNullableNumber(rawRow.total_price);
  const lineBase = Math.max(0, quantity) * (unitPrice ?? 0);
  const effectiveTotal = totalPrice ?? lineBase;
  const discountPercentage =
    lineBase > 0 ? Math.min(100, Math.max(0, Number((((lineBase - effectiveTotal) / lineBase) * 100).toFixed(2)))) : 0;

  return {
    id: Number(rawRow.id),
    order_id: Number(rawRow.order_id),
    sku: String(rawRow.sku),
    name: String(rawRow.name),
    unit: asNullableString(rawRow.unit),
    quantity,
    unit_price: unitPrice,
    total_price: totalPrice,
    discount_percentage: discountPercentage
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
  includeDrafts?: boolean;
}): Promise<OrderRow[]> {
  const pool = await getPool();
  const supportsDraftColumn = await hasOrdersDraftColumn();
  const supportsDeletedColumn = await hasOrdersDeletedColumn();
  const supportsPaymentStatusColumn = await hasOrdersPaymentStatusColumn();
  const supportsPaymentNotesColumn = await hasOrdersPaymentNotesColumn();
  const conditions: string[] = [];
  const queryParams: unknown[] = [];

  if (!options?.includeDrafts && supportsDraftColumn) {
    conditions.push(`not (
      coalesce(orders.is_draft, false) = true
      and coalesce(orders.email, '') = 'draft@atehna.si'
      and coalesce(orders.contact_name, '') = 'Osnutek'
    )`);
  }
  if (supportsDeletedColumn) {
    conditions.push('orders.deleted_at is null');
  }

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
      `(
        orders.order_number::text ilike $${queryIndex}
        or orders.organization_name ilike $${queryIndex}
        or orders.contact_name ilike $${queryIndex}
        or orders.delivery_address ilike $${queryIndex}
        or orders.customer_type ilike $${queryIndex}
        or orders.status ilike $${queryIndex}
        ${supportsPaymentStatusColumn ? `or orders.payment_status ilike $${queryIndex}` : ''}
      )`
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
      ${supportsPaymentStatusColumn ? 'orders.payment_status' : 'null::text as payment_status'},
      ${supportsPaymentNotesColumn ? 'orders.payment_notes' : 'null::text as payment_notes'},
      coalesce(orders.subtotal, computed_totals.subtotal, 0)::numeric as subtotal,
      coalesce(orders.tax, computed_totals.tax, 0)::numeric as tax,
      coalesce(orders.total, computed_totals.total, 0)::numeric as total,
      orders.created_at,
      ${supportsDraftColumn ? 'orders.is_draft' : 'false as is_draft'},
      ${supportsDeletedColumn ? 'orders.deleted_at' : 'null::timestamptz as deleted_at'}
    from orders
    left join (
      select
        order_items.order_id,
        round(sum(coalesce(order_items.total_price, order_items.quantity * coalesce(order_items.unit_price, 0))), 2) as subtotal,
        round(sum(coalesce(order_items.total_price, order_items.quantity * coalesce(order_items.unit_price, 0))) * 0.22, 2) as tax,
        round(sum(coalesce(order_items.total_price, order_items.quantity * coalesce(order_items.unit_price, 0))) * 1.22, 2) as total
      from order_items
      group by order_items.order_id
    ) as computed_totals
      on computed_totals.order_id = orders.id
    ${whereClause}
    order by orders.created_at desc, coalesce(nullif(regexp_replace(orders.order_number::text, '[^0-9]', '', 'g'), ''), '0')::numeric desc
    `,
    queryParams
  );

  return result.rows.map((rawRow) => mapOrderRow(rawRow as Record<string, unknown>));
}

export async function fetchOrderById(orderId: number): Promise<OrderRow | null> {
  const pool = await getPool();
  const supportsDraftColumn = await hasOrdersDraftColumn();
  const supportsDeletedColumn = await hasOrdersDeletedColumn();
  const supportsPaymentStatusColumn = await hasOrdersPaymentStatusColumn();
  const supportsPaymentNotesColumn = await hasOrdersPaymentNotesColumn();

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
      ${supportsPaymentStatusColumn ? 'orders.payment_status' : 'null::text as payment_status'},
      ${supportsPaymentNotesColumn ? 'orders.payment_notes' : 'null::text as payment_notes'},
      coalesce(orders.subtotal, computed_totals.subtotal, 0)::numeric as subtotal,
      coalesce(orders.tax, computed_totals.tax, 0)::numeric as tax,
      coalesce(orders.total, computed_totals.total, 0)::numeric as total,
      orders.created_at,
      ${supportsDraftColumn ? 'orders.is_draft' : 'false as is_draft'},
      ${supportsDeletedColumn ? 'orders.deleted_at' : 'null::timestamptz as deleted_at'}
    from orders
    left join (
      select
        order_items.order_id,
        round(sum(coalesce(order_items.total_price, order_items.quantity * coalesce(order_items.unit_price, 0))), 2) as subtotal,
        round(sum(coalesce(order_items.total_price, order_items.quantity * coalesce(order_items.unit_price, 0))) * 0.22, 2) as tax,
        round(sum(coalesce(order_items.total_price, order_items.quantity * coalesce(order_items.unit_price, 0))) * 1.22, 2) as total
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
  const supportsDeletedColumn = await hasDocumentsDeletedColumn();
  const result = await pool.query(
    `select * from order_documents where order_id = $1 ${supportsDeletedColumn ? 'and deleted_at is null' : ''} order by created_at desc`,
    [orderId]
  );
  return result.rows.map((rawRow) => mapOrderDocumentRow(rawRow as Record<string, unknown>));
}

export async function fetchOrderDocumentsForOrders(
  orderIds: number[]
): Promise<OrderDocumentRow[]> {
  if (orderIds.length === 0) return [];
  const pool = await getPool();
  const supportsDeletedColumn = await hasDocumentsDeletedColumn();
  const result = await pool.query(
    `select * from order_documents where order_id = any($1::bigint[]) ${supportsDeletedColumn ? 'and deleted_at is null' : ''} order by created_at desc`,
    [orderIds]
  );
  return result.rows.map((rawRow) => mapOrderDocumentRow(rawRow as Record<string, unknown>));
}

export async function fetchOrderAttachments(orderId: number): Promise<OrderAttachmentRow[]> {
  const pool = await getPool();
  try {
    const result = await pool.query(
      'select * from order_attachments where order_id = $1 order by created_at desc',
      [orderId]
    );
    return result.rows.map((rawRow) => mapOrderAttachmentRow(rawRow as Record<string, unknown>));
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      ['42P01', '42501'].includes((error as { code?: string }).code ?? '')
    ) {
      return [];
    }
    throw error;
  }
}

export async function fetchOrderAttachmentsForOrders(
  orderIds: number[]
): Promise<OrderAttachmentRow[]> {
  if (orderIds.length === 0) return [];
  const pool = await getPool();
  try {
    const result = await pool.query(
      'select * from order_attachments where order_id = any($1::bigint[]) order by created_at desc',
      [orderIds]
    );
    return result.rows.map((rawRow) => mapOrderAttachmentRow(rawRow as Record<string, unknown>));
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      ['42P01', '42501'].includes((error as { code?: string }).code ?? '')
    ) {
      return [];
    }
    throw error;
  }
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
      ['42P01', '42501'].includes((error as { code?: string }).code ?? '')
    ) {
      return [];
    }
    throw error;
  }
}
