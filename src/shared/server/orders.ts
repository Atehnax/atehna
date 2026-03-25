import { getPool } from '@/shared/server/db';
import { instrumentCatalogLoader, profileRoutePhase } from '@/shared/server/catalogDiagnostics';

let hasOrdersDraftColumnCache: boolean | null = null;
let hasOrdersDeletedColumnCache: boolean | null = null;
let hasOrdersPaymentStatusColumnCache: boolean | null = null;
let hasOrdersPaymentNotesColumnCache: boolean | null = null;
let hasDocumentsDeletedColumnCache: boolean | null = null;
let ordersSchemaSupportPromise:
  | Promise<{
      supportsDraftColumn: boolean;
      supportsDeletedColumn: boolean;
      supportsPaymentStatusColumn: boolean;
      supportsPaymentNotesColumn: boolean;
    }>
  | null = null;
let documentsSchemaSupportPromise: Promise<{ supportsDeletedColumn: boolean }> | null = null;

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

async function getOrdersSchemaSupport() {
  if (!ordersSchemaSupportPromise) {
    ordersSchemaSupportPromise = Promise.all([
      hasOrdersDraftColumn(),
      hasOrdersDeletedColumn(),
      hasOrdersPaymentStatusColumn(),
      hasOrdersPaymentNotesColumn()
    ]).then(([supportsDraftColumn, supportsDeletedColumn, supportsPaymentStatusColumn, supportsPaymentNotesColumn]) => ({
      supportsDraftColumn,
      supportsDeletedColumn,
      supportsPaymentStatusColumn,
      supportsPaymentNotesColumn
    }));
  }

  return ordersSchemaSupportPromise;
}

async function getDocumentsSchemaSupport() {
  if (!documentsSchemaSupportPromise) {
    documentsSchemaSupportPromise = hasDocumentsDeletedColumn().then((supportsDeletedColumn) => ({
      supportsDeletedColumn
    }));
  }

  return documentsSchemaSupportPromise;
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

function mapOrderAnalyticsRow(rawRow: Record<string, unknown>): OrderAnalyticsRow {
  return {
    id: Number(rawRow.id),
    created_at: toIsoTimestamp(rawRow.created_at),
    status: asNullableString(rawRow.status),
    payment_status: asNullableString(rawRow.payment_status),
    customer_type: asNullableString(rawRow.customer_type),
    total: Number(rawRow.total ?? 0)
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

export async function fetchOrders(
  options?: {
    fromDate?: string | null;
    toDate?: string | null;
    query?: string | null;
    includeDrafts?: boolean;
  },
  diagnosticsContext = '/admin/orders'
): Promise<OrderRow[]> {
  return instrumentCatalogLoader('fetchOrders', diagnosticsContext, async () => {
    const pool = await getPool();
    const {
      supportsDraftColumn,
      supportsDeletedColumn,
      supportsPaymentStatusColumn,
      supportsPaymentNotesColumn
    } = await getOrdersSchemaSupport();
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

    const primaryQuery = `
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
      coalesce(orders.subtotal::text, computed_totals.subtotal::text, '0') as subtotal,
      coalesce(orders.tax::text, computed_totals.tax::text, '0') as tax,
      coalesce(orders.total::text, computed_totals.total::text, '0') as total,
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
    order by orders.created_at desc, orders.id desc
  `;

    const safeFallbackQuery = `
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
      coalesce(orders.subtotal::text, '0') as subtotal,
      coalesce(orders.tax::text, '0') as tax,
      coalesce(orders.total::text, '0') as total,
      orders.created_at,
      ${supportsDraftColumn ? 'orders.is_draft' : 'false as is_draft'},
      ${supportsDeletedColumn ? 'orders.deleted_at' : 'null::timestamptz as deleted_at'}
    from orders
    ${whereClause}
    order by orders.created_at desc, orders.id desc
  `;

    try {
      const result = await profileRoutePhase('db', 'fetchOrders:primaryQuery', () => pool.query(primaryQuery, queryParams));
      return profileRoutePhase('transform', 'fetchOrders:mapRows', async () =>
        result.rows.map((rawRow) => mapOrderRow(rawRow as Record<string, unknown>))
      );
    } catch (error) {
      console.error('fetchOrders primary query failed, retrying with safe fallback', error);
      const fallbackResult = await profileRoutePhase('db', 'fetchOrders:fallbackQuery', () => pool.query(safeFallbackQuery, queryParams));
      return profileRoutePhase('transform', 'fetchOrders:mapFallbackRows', async () =>
        fallbackResult.rows.map((rawRow) => mapOrderRow(rawRow as Record<string, unknown>))
      );
    }
  });
}

export async function fetchOrdersListPage(
  options?: {
    fromDate?: string | null;
    toDate?: string | null;
    query?: string | null;
    includeDrafts?: boolean;
    status?: string | null;
    documentType?: string | null;
    page?: number;
    pageSize?: number;
  },
  diagnosticsContext = '/admin/orders'
): Promise<OrderListPageResult> {
  return instrumentCatalogLoader('fetchOrdersListPage', diagnosticsContext, async () => {
    const pool = await getPool();
    const {
      supportsDraftColumn,
      supportsDeletedColumn,
      supportsPaymentStatusColumn,
      supportsPaymentNotesColumn
    } = await getOrdersSchemaSupport();
    const { supportsDeletedColumn: supportsDocumentsDeletedColumn } = await getDocumentsSchemaSupport();

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
    if (options?.status && options.status !== 'all') {
      queryParams.push(options.status);
      conditions.push(`orders.status = $${queryParams.length}`);
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

    if (options?.documentType && options.documentType !== 'all') {
      queryParams.push(options.documentType);
      const documentTypeIndex = queryParams.length;
      conditions.push(`(
        exists (
          select 1
          from order_documents od
          where od.order_id = orders.id
            ${supportsDocumentsDeletedColumn ? 'and od.deleted_at is null' : ''}
            and od.type = $${documentTypeIndex}
        )
        or (
          $${documentTypeIndex} = 'purchase_order'
          and exists (
            select 1
            from order_attachments oa
            where oa.order_id = orders.id
              and oa.type = 'purchase_order'
          )
        )
      )`);
    }

    const pageSize = Math.min(100, Math.max(10, options?.pageSize ?? 50));
    const page = Math.max(1, options?.page ?? 1);
    const offset = (page - 1) * pageSize;
    queryParams.push(pageSize, offset);
    const limitParam = `$${queryParams.length - 1}`;
    const offsetParam = `$${queryParams.length}`;
    const whereClause = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';

    const query = `
      with base_filtered_orders as (
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
          orders.subtotal,
          orders.tax,
          orders.total,
          orders.created_at,
          ${supportsDraftColumn ? 'orders.is_draft' : 'false as is_draft'},
          ${supportsDeletedColumn ? 'orders.deleted_at' : 'null::timestamptz as deleted_at'}
        from orders
        ${whereClause}
      ),
      computed_totals as (
        select
          order_items.order_id,
          round(sum(coalesce(order_items.total_price, order_items.quantity * coalesce(order_items.unit_price, 0))), 2) as subtotal,
          round(sum(coalesce(order_items.total_price, order_items.quantity * coalesce(order_items.unit_price, 0))) * 0.22, 2) as tax,
          round(sum(coalesce(order_items.total_price, order_items.quantity * coalesce(order_items.unit_price, 0))) * 1.22, 2) as total
        from order_items
        where order_items.order_id in (select id from base_filtered_orders)
        group by order_items.order_id
      ),
      filtered_orders as (
        select
          base_filtered_orders.id,
          base_filtered_orders.order_number,
          base_filtered_orders.customer_type,
          base_filtered_orders.organization_name,
          base_filtered_orders.contact_name,
          base_filtered_orders.email,
          base_filtered_orders.phone,
          base_filtered_orders.delivery_address,
          base_filtered_orders.reference,
          base_filtered_orders.notes,
          base_filtered_orders.status,
          base_filtered_orders.payment_status,
          base_filtered_orders.payment_notes,
          coalesce(base_filtered_orders.subtotal::text, computed_totals.subtotal::text, '0') as subtotal,
          coalesce(base_filtered_orders.tax::text, computed_totals.tax::text, '0') as tax,
          coalesce(base_filtered_orders.total::text, computed_totals.total::text, '0') as total,
          base_filtered_orders.created_at,
          base_filtered_orders.is_draft,
          base_filtered_orders.deleted_at
        from base_filtered_orders
        left join computed_totals
          on computed_totals.order_id = base_filtered_orders.id
      ),
      paged_orders as (
        select * from filtered_orders
        order by created_at desc, id desc
        limit ${limitParam}
        offset ${offsetParam}
      ),
      latest_documents as (
        select distinct on (order_id, type)
          order_id,
          type,
          filename,
          blob_url,
          created_at
        from (
          select
            od.order_id,
            od.type,
            od.filename,
            od.blob_url,
            od.created_at
          from order_documents od
          where od.order_id in (select id from paged_orders)
            ${supportsDocumentsDeletedColumn ? 'and od.deleted_at is null' : ''}
          union all
          select
            oa.order_id,
            'purchase_order'::text as type,
            oa.filename,
            oa.blob_url,
            oa.created_at
          from order_attachments oa
          where oa.order_id in (select id from paged_orders)
            and oa.type = 'purchase_order'
        ) source_docs
        order by order_id, type, created_at desc
      )
      select
        (select count(*)::int from filtered_orders) as total_count,
        (
          select coalesce(json_agg(po order by po.created_at desc, po.id desc), '[]'::json)
          from paged_orders po
        ) as orders_json,
        (
          select coalesce(json_agg(ld order by ld.order_id, ld.type), '[]'::json)
          from latest_documents ld
        ) as documents_json
    `;

    const result = await profileRoutePhase('db', 'fetchOrdersListPage:query', () => pool.query(query, queryParams));
    const firstRow = (result.rows[0] ?? {}) as { total_count?: number; orders_json?: unknown[]; documents_json?: unknown[] };
    const ordersJson = Array.isArray(firstRow.orders_json) ? firstRow.orders_json : [];
    const docsJson = Array.isArray(firstRow.documents_json) ? firstRow.documents_json : [];

    const dedupedDocs = new Map<string, OrderListDocumentSummaryRow>();
    docsJson.forEach((rawDoc) => {
      const row = rawDoc as Record<string, unknown>;
      const mapped: OrderListDocumentSummaryRow = {
        order_id: Number(row.order_id),
        type: String(row.type),
        filename: String(row.filename),
        blob_url: String(row.blob_url),
        created_at: toIsoTimestamp(row.created_at)
      };
      const key = `${mapped.order_id}:${mapped.type}`;
      if (!dedupedDocs.has(key)) {
        dedupedDocs.set(key, mapped);
      }
    });

    return {
      totalCount: Number(firstRow.total_count ?? 0),
      orders: ordersJson.map((rawRow) => mapOrderRow(rawRow as Record<string, unknown>)),
      documentSummaries: Array.from(dedupedDocs.values())
    };
  });
}

export async function fetchOrdersAnalyticsRows(
  options?: {
    fromDate?: string | null;
    toDate?: string | null;
    includeDrafts?: boolean;
  },
  diagnosticsContext = '/admin/analitika'
): Promise<OrderAnalyticsRow[]> {
  return instrumentCatalogLoader('fetchOrdersAnalyticsRows', diagnosticsContext, async () => {
    const pool = await getPool();
    const { supportsDraftColumn, supportsDeletedColumn, supportsPaymentStatusColumn } = await getOrdersSchemaSupport();
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

    const whereClause = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
    const query = `
      select
        orders.id,
        orders.created_at,
        orders.status,
        ${supportsPaymentStatusColumn ? 'orders.payment_status' : 'null::text as payment_status'},
        orders.customer_type,
        coalesce(orders.total::numeric, orders.subtotal::numeric + orders.tax::numeric, 0::numeric)::text as total
      from orders
      ${whereClause}
      order by orders.created_at desc, orders.id desc
    `;

    const result = await profileRoutePhase('db', 'fetchOrdersAnalyticsRows:query', () => pool.query(query, queryParams));
    return profileRoutePhase('transform', 'fetchOrdersAnalyticsRows:mapRows', async () =>
      result.rows.map((rawRow) => mapOrderAnalyticsRow(rawRow as Record<string, unknown>))
    );
  });
}

export async function fetchOrderById(orderId: number, diagnosticsContext = '/admin/orders/[orderId]'): Promise<OrderRow | null> {
  return instrumentCatalogLoader('fetchOrderById', diagnosticsContext, async () => {
    const pool = await getPool();
    const {
      supportsDraftColumn,
      supportsDeletedColumn,
      supportsPaymentStatusColumn,
      supportsPaymentNotesColumn
    } = await getOrdersSchemaSupport();

    const result = await profileRoutePhase('db', 'fetchOrderById:query', () => pool.query(
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
      coalesce(orders.subtotal::text, computed_totals.subtotal::text, '0') as subtotal,
      coalesce(orders.tax::text, computed_totals.tax::text, '0') as tax,
      coalesce(orders.total::text, computed_totals.total::text, '0') as total,
      orders.created_at,
      ${supportsDraftColumn ? 'orders.is_draft' : 'false as is_draft'},
      ${supportsDeletedColumn ? 'orders.deleted_at' : 'null::timestamptz as deleted_at'}
    from orders
    left join lateral (
      select
        round(sum(coalesce(order_items.total_price, order_items.quantity * coalesce(order_items.unit_price, 0))), 2) as subtotal,
        round(sum(coalesce(order_items.total_price, order_items.quantity * coalesce(order_items.unit_price, 0))) * 0.22, 2) as tax,
        round(sum(coalesce(order_items.total_price, order_items.quantity * coalesce(order_items.unit_price, 0))) * 1.22, 2) as total
      from order_items
      where order_items.order_id = orders.id
    ) as computed_totals
      on true
    where orders.id = $1
    `,
      [orderId]
    ));

    if (result.rows.length === 0) return null;
    return profileRoutePhase('transform', 'fetchOrderById:mapRow', async () => mapOrderRow(result.rows[0] as Record<string, unknown>));
  });
}

export async function fetchOrderItems(orderId: number, diagnosticsContext = '/admin/orders/[orderId]'): Promise<OrderItemRow[]> {
  return instrumentCatalogLoader('fetchOrderItems', diagnosticsContext, async () => {
    const pool = await getPool();
    const result = await profileRoutePhase('db', 'fetchOrderItems:query', () =>
      pool.query('select * from order_items where order_id = $1 order by id', [orderId])
    );
    return profileRoutePhase('transform', 'fetchOrderItems:mapRows', async () =>
      result.rows.map((rawRow) => mapOrderItemRow(rawRow as Record<string, unknown>))
    );
  });
}

export async function fetchOrderDocuments(orderId: number, diagnosticsContext = '/admin/orders/[orderId]'): Promise<OrderDocumentRow[]> {
  return instrumentCatalogLoader('fetchOrderDocuments', diagnosticsContext, async () => {
    const pool = await getPool();
    const { supportsDeletedColumn } = await getDocumentsSchemaSupport();
    const result = await profileRoutePhase('db', 'fetchOrderDocuments:query', () => pool.query(
      `select * from order_documents where order_id = $1 ${supportsDeletedColumn ? 'and deleted_at is null' : ''} order by created_at desc`,
      [orderId]
    ));
    return profileRoutePhase('transform', 'fetchOrderDocuments:mapRows', async () =>
      result.rows.map((rawRow) => mapOrderDocumentRow(rawRow as Record<string, unknown>))
    );
  });
}

export async function fetchOrderDocumentsForOrders(
  orderIds: number[],
  diagnosticsContext = '/admin/orders'
): Promise<OrderDocumentRow[]> {
  return instrumentCatalogLoader('fetchOrderDocumentsForOrders', diagnosticsContext, async () => {
    if (orderIds.length === 0) return [];
    const pool = await getPool();
    const { supportsDeletedColumn } = await getDocumentsSchemaSupport();
    const result = await profileRoutePhase('db', 'fetchOrderDocumentsForOrders:query', () => pool.query(
      `select * from order_documents where order_id = any($1::bigint[]) ${supportsDeletedColumn ? 'and deleted_at is null' : ''} order by created_at desc`,
      [orderIds]
    ));
    return profileRoutePhase('transform', 'fetchOrderDocumentsForOrders:mapRows', async () =>
      result.rows.map((rawRow) => mapOrderDocumentRow(rawRow as Record<string, unknown>))
    );
  });
}

export async function fetchOrderAttachments(orderId: number, diagnosticsContext = '/admin/orders/[orderId]'): Promise<OrderAttachmentRow[]> {
  return instrumentCatalogLoader('fetchOrderAttachments', diagnosticsContext, async () => {
    const pool = await getPool();
    try {
      const result = await profileRoutePhase('db', 'fetchOrderAttachments:query', () =>
        pool.query('select * from order_attachments where order_id = $1 order by created_at desc', [orderId])
      );
      return profileRoutePhase('transform', 'fetchOrderAttachments:mapRows', async () =>
        result.rows.map((rawRow) => mapOrderAttachmentRow(rawRow as Record<string, unknown>))
      );
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
  });
}

export async function fetchOrderAttachmentsForOrders(
  orderIds: number[],
  diagnosticsContext = '/admin/orders'
): Promise<OrderAttachmentRow[]> {
  return instrumentCatalogLoader('fetchOrderAttachmentsForOrders', diagnosticsContext, async () => {
    if (orderIds.length === 0) return [];
    const pool = await getPool();
    try {
      const result = await profileRoutePhase('db', 'fetchOrderAttachmentsForOrders:query', () => pool.query(
        'select * from order_attachments where order_id = any($1::bigint[]) order by created_at desc',
        [orderIds]
      ));
      return profileRoutePhase('transform', 'fetchOrderAttachmentsForOrders:mapRows', async () =>
        result.rows.map((rawRow) => mapOrderAttachmentRow(rawRow as Record<string, unknown>))
      );
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
  });
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
