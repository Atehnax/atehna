import { getPool } from '@/shared/server/db';
import { instrumentCatalogLoader, profileRoutePhase } from '@/shared/server/catalogDiagnostics';

let hasOrdersDraftColumnCache: boolean | null = null;
let hasOrdersDeletedColumnCache: boolean | null = null;
let hasOrdersPaymentStatusColumnCache: boolean | null = null;
let hasOrdersAdminOrderNotesColumnCache: boolean | null = null;
let hasOrdersPostalCodeColumnCache: boolean | null = null;
let hasDocumentsDeletedColumnCache: boolean | null = null;
let ordersSchemaSupportPromise:
  | Promise<{
      supportsDraftColumn: boolean;
      supportsDeletedColumn: boolean;
      supportsPaymentStatusColumn: boolean;
      supportsAdminOrderNotesColumn: boolean;
      supportsPostalCodeColumn: boolean;
    }>
  | null = null;
let documentsSchemaSupportPromise: Promise<{ supportsDeletedColumn: boolean }> | null = null;
const ORDER_NUMBER_DESC_SQL =
  "nullif(regexp_replace(orders.order_number::text, '\\D', '', 'g'), '')::bigint desc nulls last, orders.id desc";
const PAGED_ORDER_NUMBER_DESC_SQL =
  "nullif(regexp_replace(order_number::text, '\\D', '', 'g'), '')::bigint desc nulls last, id desc";
const PAGED_ORDER_NUMBER_JSON_DESC_SQL =
  "nullif(regexp_replace(po.order_number::text, '\\D', '', 'g'), '')::bigint desc nulls last, po.id desc";
const NEXT_HIGHER_ORDER_NUMBER_SUGGESTION_COUNT = 3;
const SHIPPED_ORDER_STATUSES = ['partially_sent', 'sent', 'finished'] as const;

type Queryable = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
};

type OrderNumberRow = {
  id: number | string;
  order_number: string | null;
};

export type OrderNumberAvailabilityResult = {
  inputDigits: string;
  normalizedOrderNumber: number | null;
  formattedOrderNumber: string | null;
  isAvailable: boolean;
  conflictOrderId: number | null;
  suggestions: string[];
};

export function sanitizeOrderNumberDigits(value: string | number | null | undefined) {
  return String(value ?? '').replace(/[^\d]/g, '');
}

export function normalizeOrderNumberValue(value: string | number | null | undefined): number | null {
  const digits = sanitizeOrderNumberDigits(value);
  if (!digits) return null;

  const normalizedDigits = digits.replace(/^0+(?=\d)/, '');
  const parsed = Number(normalizedDigits);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function formatOrderNumberValue(orderNumber: number) {
  return `#${orderNumber}`;
}

const addOrderNumberSuggestion = (
  suggestions: Set<number>,
  occupiedNumbers: Set<number>,
  candidate: number,
  limit: number,
  currentOrderNumber: number | null
) => {
  if (suggestions.size >= limit) return;
  if (!Number.isSafeInteger(candidate) || candidate <= 0) return;
  if (candidate === currentOrderNumber) return;
  if (occupiedNumbers.has(candidate)) return;
  suggestions.add(candidate);
};

const collectLowerOrderNumberGaps = ({
  suggestions,
  occupiedNumbers,
  currentOrderNumber,
  anchor,
  lowestKnownNumber,
  limit
}: {
  suggestions: Set<number>;
  occupiedNumbers: Set<number>;
  currentOrderNumber: number | null;
  anchor: number;
  lowestKnownNumber: number;
  limit: number;
}) => {
  for (let candidate = anchor - 1; candidate >= lowestKnownNumber && suggestions.size < limit; candidate -= 1) {
    addOrderNumberSuggestion(suggestions, occupiedNumbers, candidate, limit, currentOrderNumber);
  }
};

const collectOrderNumberGapsAround = ({
  suggestions,
  occupiedNumbers,
  currentOrderNumber,
  anchor,
  lowestKnownNumber,
  highestKnownNumber,
  limit
}: {
  suggestions: Set<number>;
  occupiedNumbers: Set<number>;
  currentOrderNumber: number | null;
  anchor: number;
  lowestKnownNumber: number;
  highestKnownNumber: number;
  limit: number;
}) => {
  for (
    let offset = 1;
    suggestions.size < limit && (anchor - offset >= lowestKnownNumber || anchor + offset <= highestKnownNumber);
    offset += 1
  ) {
    if (anchor - offset >= lowestKnownNumber) {
      addOrderNumberSuggestion(suggestions, occupiedNumbers, anchor - offset, limit, currentOrderNumber);
    }
    if (anchor + offset <= highestKnownNumber) {
      addOrderNumberSuggestion(suggestions, occupiedNumbers, anchor + offset, limit, currentOrderNumber);
    }
  }
};

const formatOrderNumberSuggestions = (suggestions: Set<number>) => Array.from(suggestions).map(String);

const buildOrderNumberSuggestions = ({
  inputDigits,
  currentOrderNumber,
  occupiedNumbers,
  limit
}: {
  inputDigits: string;
  currentOrderNumber: number | null;
  occupiedNumbers: Set<number>;
  limit: number;
}) => {
  if (limit <= 0) return [];

  const suggestions = new Set<number>();
  const requestedNumber = normalizeOrderNumberValue(inputDigits);
  const knownNumbers = [...occupiedNumbers];
  if (currentOrderNumber !== null) knownNumbers.push(currentOrderNumber);
  const highestKnownNumber = knownNumbers.length > 0 ? Math.max(...knownNumbers) : 0;
  const lowestKnownNumber = 1;
  const highestOtherOrderNumber = Math.max(0, ...occupiedNumbers);
  const anchor = currentOrderNumber ?? requestedNumber ?? highestKnownNumber;
  const isCurrentHighestNumber = currentOrderNumber !== null && currentOrderNumber >= highestOtherOrderNumber;

  if (knownNumbers.length === 0) {
    for (let candidate = 1; suggestions.size < Math.min(limit, NEXT_HIGHER_ORDER_NUMBER_SUGGESTION_COUNT); candidate += 1) {
      addOrderNumberSuggestion(suggestions, occupiedNumbers, candidate, limit, currentOrderNumber);
    }
    return formatOrderNumberSuggestions(suggestions);
  }

  if (isCurrentHighestNumber) {
    const nextHigherLimit = Math.min(limit, NEXT_HIGHER_ORDER_NUMBER_SUGGESTION_COUNT);
    const lowerGapLimit = Math.max(0, limit - nextHigherLimit);

    collectLowerOrderNumberGaps({
      suggestions,
      occupiedNumbers,
      currentOrderNumber,
      anchor,
      lowestKnownNumber,
      limit: lowerGapLimit
    });

    let addedHigherSuggestions = 0;
    for (
      let candidate = highestKnownNumber + 1;
      suggestions.size < limit && addedHigherSuggestions < nextHigherLimit;
      candidate += 1
    ) {
      const previousSize = suggestions.size;
      addOrderNumberSuggestion(suggestions, occupiedNumbers, candidate, limit, currentOrderNumber);
      if (suggestions.size > previousSize) addedHigherSuggestions += 1;
    }

    return formatOrderNumberSuggestions(suggestions);
  }

  collectOrderNumberGapsAround({
    suggestions,
    occupiedNumbers,
    currentOrderNumber,
    anchor,
    lowestKnownNumber,
    highestKnownNumber,
    limit
  });

  return formatOrderNumberSuggestions(suggestions);
};

export async function getOrderNumberAvailability(
  value: string | number | null | undefined,
  currentOrderId: number,
  suggestionLimit = 8
): Promise<OrderNumberAvailabilityResult> {
  const inputDigits = sanitizeOrderNumberDigits(value);
  const requestedNumber = normalizeOrderNumberValue(inputDigits);
  const pool = await getPool();
  const result = await pool.query('select id, order_number from orders');
  const rows = result.rows as OrderNumberRow[];
  const currentOrderNumber = rows.reduce<number | null>((foundOrderNumber, row) => {
    if (foundOrderNumber !== null) return foundOrderNumber;
    return Number(row.id) === currentOrderId ? normalizeOrderNumberValue(row.order_number) : null;
  }, null);
  const occupiedNumbers = new Set<number>();
  let conflictOrderId: number | null = null;

  rows.forEach((row) => {
    const orderId = Number(row.id);
    const orderNumber = normalizeOrderNumberValue(row.order_number);
    if (orderNumber === null || orderId === currentOrderId) return;
    occupiedNumbers.add(orderNumber);
    if (requestedNumber !== null && orderNumber === requestedNumber && conflictOrderId === null) {
      conflictOrderId = orderId;
    }
  });

  const isCurrentOrderNumber = requestedNumber !== null && requestedNumber === currentOrderNumber;
  const isAvailable = requestedNumber !== null && (isCurrentOrderNumber || !occupiedNumbers.has(requestedNumber));
  const suggestions = buildOrderNumberSuggestions({
    inputDigits,
    currentOrderNumber,
    occupiedNumbers,
    limit: suggestionLimit
  });

  return {
    inputDigits,
    normalizedOrderNumber: requestedNumber,
    formattedOrderNumber: requestedNumber === null ? null : formatOrderNumberValue(requestedNumber),
    isAvailable,
    conflictOrderId,
    suggestions
  };
}

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

export async function ensureOrdersDraftColumn() {
  if (hasOrdersDraftColumnCache === true) return;

  if (await hasOrdersColumn('is_draft')) {
    hasOrdersDraftColumnCache = true;
    ordersSchemaSupportPromise = null;
    return;
  }

  const pool = await getPool();
  await pool.query('alter table if exists orders add column if not exists is_draft boolean not null default false');
  await pool.query('create index if not exists idx_orders_is_draft on orders (is_draft)');

  hasOrdersDraftColumnCache = true;
  ordersSchemaSupportPromise = null;
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

async function hasOrdersAdminOrderNotesColumn() {
  if (hasOrdersAdminOrderNotesColumnCache !== null) return hasOrdersAdminOrderNotesColumnCache;

  hasOrdersAdminOrderNotesColumnCache = await hasOrdersColumn('admin_order_notes');
  return hasOrdersAdminOrderNotesColumnCache;
}

async function hasOrdersPostalCodeColumn() {
  if (hasOrdersPostalCodeColumnCache !== null) return hasOrdersPostalCodeColumnCache;

  hasOrdersPostalCodeColumnCache = await hasOrdersColumn('postal_code');
  return hasOrdersPostalCodeColumnCache;
}

export async function ensureOrdersPostalCodeColumn() {
  if (hasOrdersPostalCodeColumnCache === true) return;

  if (await hasOrdersColumn('postal_code')) {
    hasOrdersPostalCodeColumnCache = true;
    ordersSchemaSupportPromise = null;
    return;
  }

  const pool = await getPool();
  await pool.query('alter table if exists orders add column if not exists postal_code text');

  hasOrdersPostalCodeColumnCache = true;
  ordersSchemaSupportPromise = null;
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
      hasOrdersAdminOrderNotesColumn(),
      hasOrdersPostalCodeColumn()
    ]).then(([supportsDraftColumn, supportsDeletedColumn, supportsPaymentStatusColumn, supportsAdminOrderNotesColumn, supportsPostalCodeColumn]) => ({
      supportsDraftColumn,
      supportsDeletedColumn,
      supportsPaymentStatusColumn,
      supportsAdminOrderNotesColumn,
      supportsPostalCodeColumn
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
  delivery_address: string | null;
  postal_code?: string | null;
  reference: string | null;
  notes: string | null;
  status: string;
  payment_status?: string | null;
  admin_order_notes?: string | null;
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
    delivery_address: asNullableString(rawRow.delivery_address),
    postal_code: asNullableString(rawRow.postal_code),
    reference: asNullableString(rawRow.reference),
    notes: asNullableString(rawRow.notes),
    status: String(rawRow.status),
    payment_status: asNullableString(rawRow.payment_status),
    admin_order_notes: asNullableString(rawRow.admin_order_notes),
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

function mapOrderItemSkuAllocationRow(rawRow: Record<string, unknown>): OrderItemSkuAllocationRow {
  const quantity = Math.max(0, Math.floor(Number(rawRow.quantity) || 0));
  const orderId = Number(rawRow.order_id);
  return {
    orderId,
    orderNumber: String(rawRow.order_number ?? `#${orderId}`),
    orderStatus: String(rawRow.order_status ?? ''),
    orderCreatedAt: toIsoTimestamp(rawRow.order_created_at),
    orderItemId: Number(rawRow.order_item_id),
    orderItemSku: String(rawRow.order_item_sku ?? ''),
    orderItemName: String(rawRow.order_item_name ?? ''),
    quantity,
    shippedAt: rawRow.shipped_at === null || rawRow.shipped_at === undefined ? null : toIsoTimestamp(rawRow.shipped_at)
  };
}

export async function ensureOrderStatusLogsTable(db?: Queryable) {
  const target = db ?? await getPool();
  await target.query(`
    create table if not exists order_status_logs (
      id bigserial primary key,
      order_id bigint not null references orders(id) on delete cascade,
      previous_status text,
      new_status text not null,
      created_at timestamptz not null default now()
    )
  `);
  await target.query('create index if not exists idx_order_status_logs_order_id_created_at on order_status_logs(order_id, created_at desc)');
  await target.query('create index if not exists idx_order_status_logs_new_status_created_at on order_status_logs(new_status, created_at desc)');
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
      supportsAdminOrderNotesColumn,
      supportsPostalCodeColumn
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
      orders.delivery_address,
      ${supportsPostalCodeColumn ? 'orders.postal_code' : 'null::text as postal_code'},
      orders.reference,
      orders.notes,
      orders.status,
      ${supportsPaymentStatusColumn ? 'orders.payment_status' : 'null::text as payment_status'},
      ${supportsAdminOrderNotesColumn ? 'orders.admin_order_notes' : 'null::text as admin_order_notes'},
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
    order by ${ORDER_NUMBER_DESC_SQL}
  `;

    const safeFallbackQuery = `
    select
      orders.id,
      orders.order_number,
      orders.customer_type,
      orders.organization_name,
      orders.contact_name,
      orders.email,
      orders.delivery_address,
      ${supportsPostalCodeColumn ? 'orders.postal_code' : 'null::text as postal_code'},
      orders.reference,
      orders.notes,
      orders.status,
      ${supportsPaymentStatusColumn ? 'orders.payment_status' : 'null::text as payment_status'},
      ${supportsAdminOrderNotesColumn ? 'orders.admin_order_notes' : 'null::text as admin_order_notes'},
      coalesce(orders.subtotal::text, '0') as subtotal,
      coalesce(orders.tax::text, '0') as tax,
      coalesce(orders.total::text, '0') as total,
      orders.created_at,
      ${supportsDraftColumn ? 'orders.is_draft' : 'false as is_draft'},
      ${supportsDeletedColumn ? 'orders.deleted_at' : 'null::timestamptz as deleted_at'}
    from orders
    ${whereClause}
    order by ${ORDER_NUMBER_DESC_SQL}
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
      supportsAdminOrderNotesColumn,
      supportsPostalCodeColumn
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
      with filtered_orders as (
        select
          orders.id,
          orders.order_number,
          orders.customer_type,
          orders.organization_name,
          orders.contact_name,
          orders.email,
          orders.delivery_address,
          ${supportsPostalCodeColumn ? 'orders.postal_code' : 'null::text as postal_code'},
          orders.reference,
          orders.notes,
          orders.status,
          ${supportsPaymentStatusColumn ? 'orders.payment_status' : 'null::text as payment_status'},
          ${supportsAdminOrderNotesColumn ? 'orders.admin_order_notes' : 'null::text as admin_order_notes'},
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
      ),
      paged_orders as (
        select * from filtered_orders
        order by ${PAGED_ORDER_NUMBER_DESC_SQL}
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
        ) source_docs
        order by order_id, type, created_at desc
      )
      select
        (select count(*)::int from filtered_orders) as total_count,
        (
          select coalesce(json_agg(po order by ${PAGED_ORDER_NUMBER_JSON_DESC_SQL}), '[]'::json)
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
      supportsAdminOrderNotesColumn,
      supportsPostalCodeColumn
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
      orders.delivery_address,
      ${supportsPostalCodeColumn ? 'orders.postal_code' : 'null::text as postal_code'},
      orders.reference,
      orders.notes,
      orders.status,
      ${supportsPaymentStatusColumn ? 'orders.payment_status' : 'null::text as payment_status'},
      ${supportsAdminOrderNotesColumn ? 'orders.admin_order_notes' : 'null::text as admin_order_notes'},
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

export async function fetchOrderItemAllocationsForSkus(
  skus: string[],
  diagnosticsContext = '/admin/artikli/[itemName]'
): Promise<OrderItemSkuAllocationRow[]> {
  const normalizedSkus = Array.from(new Set(
    skus
      .map((sku) => sku.trim().toLocaleLowerCase('sl-SI'))
      .filter(Boolean)
  ));
  if (normalizedSkus.length === 0) return [];

  return instrumentCatalogLoader('fetchOrderItemAllocationsForSkus', diagnosticsContext, async () => {
    const pool = await getPool();
    await ensureOrderStatusLogsTable(pool);
    const { supportsDraftColumn, supportsDeletedColumn } = await getOrdersSchemaSupport();
    const conditions = [
      'lower(trim(order_items.sku)) = any($1::text[])',
      "coalesce(orders.status, '') <> 'cancelled'"
    ];
    if (supportsDraftColumn) conditions.push('coalesce(orders.is_draft, false) = false');
    if (supportsDeletedColumn) conditions.push('orders.deleted_at is null');

    const result = await profileRoutePhase('db', 'fetchOrderItemAllocationsForSkus:query', () =>
      pool.query(
        `
        select
          orders.id as order_id,
          orders.order_number,
          orders.status as order_status,
          orders.created_at as order_created_at,
          order_items.id as order_item_id,
          order_items.sku as order_item_sku,
          order_items.name as order_item_name,
          order_items.quantity,
          case
            when orders.status = any($2::text[])
              then coalesce(shipped_status_log.created_at, orders.created_at)
            else null
          end as shipped_at
        from order_items
        join orders on orders.id = order_items.order_id
        left join lateral (
          select order_status_logs.created_at
          from order_status_logs
          where order_status_logs.order_id = orders.id
            and order_status_logs.new_status = any($2::text[])
          order by order_status_logs.created_at desc
          limit 1
        ) shipped_status_log on true
        where ${conditions.join(' and ')}
        order by orders.created_at asc, orders.id asc, order_items.id asc
        `,
        [normalizedSkus, [...SHIPPED_ORDER_STATUSES]]
      )
    );

    return profileRoutePhase('transform', 'fetchOrderItemAllocationsForSkus:mapRows', async () =>
      result.rows.map((rawRow) => mapOrderItemSkuAllocationRow(rawRow as Record<string, unknown>))
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
