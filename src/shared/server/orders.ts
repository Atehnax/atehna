import { getPool } from '@/shared/server/db';
import { instrumentCatalogLoader, profileRoutePhase } from '@/shared/server/diagnostics/instrumentation';
import { normalizeOrderPdfFilenameForPresentation } from '@/shared/domain/order/orderTypes';
import type {
  OrderDocumentRow,
  OrderItemRow,
  OrderItemSkuAllocationRow,
  OrderListDocumentSummaryRow,
  OrderListPageResult,
  OrderNumberAvailabilityResult,
  OrderRow,
  PaymentLogRow
} from '@/shared/domain/order/orderTypes';
import { isAllPageSize, type PageSizeValue } from '@/shared/domain/pagination';
import { ORDER_ATTENTION_STATUSES } from '@/shared/domain/order/orderStatus';
import {
  formatOfferCode,
  formatOrderCode,
  formatQuoteCode,
  parseCommercePublicCode
} from '@/shared/domain/commercePublicCode';

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

function toNullableIsoTimestamp(rawValue: unknown): string | null {
  return rawValue === null || rawValue === undefined ? null : toIsoTimestamp(rawValue);
}

function nullableOrderJson<T>(value: unknown): T | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as T
    : null;
}

function mapOrderRow(rawRow: Record<string, unknown>): OrderRow {
  const sourceQuoteCodeBase = asNullableString(rawRow.source_quote_public_code_base);
  const sourceOfferVersion = parseNullableNumber(rawRow.source_quote_offer_version_number);
  return {
    id: Number(rawRow.id),
    order_number: String(rawRow.order_number),
    order_code: formatOrderCode(String(rawRow.public_code_base)),
    customer_type: String(rawRow.customer_type),
    organization_name: asNullableString(rawRow.organization_name),
    contact_name: String(rawRow.contact_name),
    email: String(rawRow.email),
    address_line1: asNullableString(rawRow.address_line1),
    address_line2: asNullableString(rawRow.address_line2),
    postal_code: asNullableString(rawRow.postal_code),
    city: asNullableString(rawRow.city),
    gurs_house_number_id: asNullableString(rawRow.gurs_house_number_id),
    country_code: asNullableString(rawRow.country_code),
    commitment_status:
      rawRow.commitment_status === 'binding'
      || rawRow.commitment_status === 'pending_confirmation'
      || rawRow.commitment_status === 'rejected'
        ? rawRow.commitment_status
        : null,
    contract_status:
      rawRow.contract_status === 'pending_seller_acceptance'
      || rawRow.contract_status === 'accepted'
      || rawRow.contract_status === 'rejected'
        ? rawRow.contract_status
        : null,
    contract_accepted_at: toNullableIsoTimestamp(rawRow.contract_accepted_at),
    contract_accepted_actor_type: asNullableString(rawRow.contract_accepted_actor_type),
    contract_accepted_actor_id:
      rawRow.contract_accepted_actor_id === null || rawRow.contract_accepted_actor_id === undefined
        ? null
        : String(rawRow.contract_accepted_actor_id),
    contract_accepted_evidence_json: nullableOrderJson(rawRow.contract_accepted_evidence_json),
    contract_rejected_at: toNullableIsoTimestamp(rawRow.contract_rejected_at),
    contract_rejected_actor_type: asNullableString(rawRow.contract_rejected_actor_type),
    contract_rejected_actor_id:
      rawRow.contract_rejected_actor_id === null || rawRow.contract_rejected_actor_id === undefined
        ? null
        : String(rawRow.contract_rejected_actor_id),
    contract_rejected_evidence_json: nullableOrderJson(rawRow.contract_rejected_evidence_json),
    contract_rejected_reason: asNullableString(rawRow.contract_rejected_reason),
    committed_at: toNullableIsoTimestamp(rawRow.committed_at),
    source_quote_offer_version_id: parseNullableNumber(rawRow.source_quote_offer_version_id),
    source_quote_request_id: parseNullableNumber(rawRow.source_quote_request_id),
    source_quote_request_number: asNullableString(rawRow.source_quote_request_number),
    source_quote_offer_number: asNullableString(rawRow.source_quote_offer_number),
    source_quote_code: sourceQuoteCodeBase
      ? formatQuoteCode(sourceQuoteCodeBase)
      : null,
    source_quote_offer_code:
      sourceQuoteCodeBase && sourceOfferVersion !== null
        ? formatOfferCode(sourceQuoteCodeBase, sourceOfferVersion)
        : null,
    reference: asNullableString(rawRow.reference),
    notes: asNullableString(rawRow.notes),
    status: String(rawRow.status),
    payment_status: asNullableString(rawRow.payment_status),
    admin_order_notes: asNullableString(rawRow.admin_order_notes),
    subtotal: parseNullableNumber(rawRow.subtotal),
    tax: parseNullableNumber(rawRow.tax),
    tax_rate: parseNullableNumber(rawRow.tax_rate),
    shipping: parseNullableNumber(rawRow.shipping),
    automatic_shipping: parseNullableNumber(rawRow.automatic_shipping),
    shipping_snapshot_json: nullableOrderJson<OrderRow['shipping_snapshot_json']>(
      rawRow.shipping_snapshot_json
    ),
    shipping_override_json: nullableOrderJson<OrderRow['shipping_override_json']>(
      rawRow.shipping_override_json
    ),
    shipping_override_stale: rawRow.shipping_override_stale === true,
    parcel_count: Math.max(1, Math.trunc(Number(rawRow.parcel_count) || 1)),
    pricing_revision: Math.max(1, Math.trunc(Number(rawRow.pricing_revision) || 1)),
    delivery_plan_revision: Math.max(
      1,
      Math.trunc(Number(rawRow.delivery_plan_revision) || 1)
    ),
    total: parseNullableNumber(rawRow.total),
    created_at: toIsoTimestamp(rawRow.created_at),
    is_draft: Boolean(rawRow.is_draft),
    deleted_at: asNullableString(rawRow.deleted_at)
  };
}

function mapOrderItemRow(rawRow: Record<string, unknown>): OrderItemRow {
  const quantity = Number(rawRow.quantity);
  const baseUnitNet = parseNullableNumber(rawRow.base_unit_net) ?? 0;
  const lineNet = parseNullableNumber(rawRow.line_net) ?? 0;
  const lineBase = Math.max(0, quantity) * (baseUnitNet ?? 0);
  const effectiveTotal = lineNet;
  const storedDiscountPercentage = parseNullableNumber(rawRow.discount_pct);
  const discountPercentage = storedDiscountPercentage === null
    ? lineBase > 0
      ? Math.min(100, Math.max(0, Number((((lineBase - effectiveTotal) / lineBase) * 100).toFixed(2))))
      : 0
    : Math.min(100, Math.max(0, storedDiscountPercentage));

  return {
    id: Number(rawRow.id),
    order_id: Number(rawRow.order_id),
    sku: String(rawRow.sku),
    name: String(rawRow.name),
    unit: asNullableString(rawRow.unit),
    quantity,
    base_unit_net: baseUnitNet,
    line_net: lineNet,
    discount_percentage: discountPercentage,
    catalog_item_id: parseNullableNumber(rawRow.catalog_item_id),
    catalog_variant_id: parseNullableNumber(rawRow.catalog_variant_id),
    ship_later: rawRow.ship_later === true
  };
}

function buildAdminOrderDocumentUrl(orderId: number, documentId: number): string {
  return `/api/admin/orders/${orderId}/documents/${documentId}`;
}

function mapOrderDocumentRow(rawRow: Record<string, unknown>): OrderDocumentRow {
  const id = Number(rawRow.id);
  const orderId = Number(rawRow.order_id);
  const type = String(rawRow.type);
  return {
    id,
    order_id: orderId,
    type,
    filename: normalizeOrderPdfFilenameForPresentation(type, String(rawRow.filename)),
    url: buildAdminOrderDocumentUrl(orderId, id),
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

export async function fetchOrdersListPage(
  options?: {
    fromDate?: string | null;
    toDate?: string | null;
    query?: string | null;
    includeDrafts?: boolean;
    status?: string | null;
    documentType?: string | null;
    page?: number;
    pageSize?: PageSizeValue;
  },
  diagnosticsContext = '/admin/orders'
): Promise<OrderListPageResult> {
  return instrumentCatalogLoader('fetchOrdersListPage', diagnosticsContext, async () => {
    const pool = await getPool();
    const conditions: string[] = [];
    const queryParams: unknown[] = [];

    if (!options?.includeDrafts) {
      conditions.push(`not (
        coalesce(orders.is_draft, false) = true
        and coalesce(orders.email, '') = 'draft@atehna.si'
        and coalesce(orders.contact_name, '') = 'Osnutek'
      )`);
    }
    conditions.push('orders.deleted_at is null');

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
      const parsedPublicCode = parseCommercePublicCode(options.query);
      const publicCodeConditions: string[] = [];
      if (parsedPublicCode?.kind === 'order') {
        queryParams.push(parsedPublicCode.base);
        publicCodeConditions.push(`orders.public_code_base = $${queryParams.length}`);
      }
      if (parsedPublicCode?.kind === 'quote') {
        queryParams.push(parsedPublicCode.base);
        publicCodeConditions.push(`exists (
          select 1
          from quote_offer_versions public_code_offer
          join quote_requests public_code_request
            on public_code_request.id = public_code_offer.quote_request_id
          where public_code_offer.id = orders.source_quote_offer_version_id
            and public_code_request.public_code_base = $${queryParams.length}
        )`);
      }
      if (parsedPublicCode?.kind === 'offer' && parsedPublicCode.version !== null) {
        queryParams.push(parsedPublicCode.base, parsedPublicCode.version);
        const baseIndex = queryParams.length - 1;
        const versionIndex = queryParams.length;
        publicCodeConditions.push(`exists (
          select 1
          from quote_offer_versions public_code_offer
          join quote_requests public_code_request
            on public_code_request.id = public_code_offer.quote_request_id
          where public_code_offer.id = orders.source_quote_offer_version_id
            and public_code_request.public_code_base = $${baseIndex}
            and public_code_offer.version_number = $${versionIndex}
        )`);
      }
      conditions.push(
        `(
          orders.order_number::text ilike $${queryIndex}
          ${publicCodeConditions.length > 0 ? `or ${publicCodeConditions.join('\n          or ')}` : ''}
          or orders.organization_name ilike $${queryIndex}
          or orders.contact_name ilike $${queryIndex}
          or orders.address_line1 ilike $${queryIndex}
          or orders.address_line2 ilike $${queryIndex}
          or orders.postal_code ilike $${queryIndex}
          or orders.city ilike $${queryIndex}
          or orders.country_code ilike $${queryIndex}
          or orders.customer_type ilike $${queryIndex}
          or orders.status ilike $${queryIndex}
          or orders.payment_status ilike $${queryIndex}
          or exists (
            select 1
            from quote_offer_versions related_offer
            join quote_requests related_request
              on related_request.id = related_offer.quote_request_id
            where related_offer.id = orders.source_quote_offer_version_id
              and (
                related_offer.offer_number ilike $${queryIndex}
                or related_request.request_number ilike $${queryIndex}
              )
          )
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
            and od.deleted_at is null
            and od.type = $${documentTypeIndex}
            and od.order_pricing_revision = orders.pricing_revision
            and (
              od.type <> 'dobavnica'
              or od.order_delivery_plan_revision = orders.delivery_plan_revision
            )
        )
      )`);
    }

    const requestedPageSize = options?.pageSize ?? 50;
    const showAllRows = isAllPageSize(requestedPageSize);
    const numericPageSize = showAllRows
      ? null
      : Math.min(
          100,
          Math.max(10, Number.isFinite(requestedPageSize) ? Math.floor(requestedPageSize) : 50)
        );
    const page = showAllRows ? 1 : Math.max(1, options?.page ?? 1);
    let paginationClause = '';
    if (numericPageSize !== null) {
      const offset = (page - 1) * numericPageSize;
      queryParams.push(numericPageSize, offset);
      const limitParam = `$${queryParams.length - 1}`;
      const offsetParam = `$${queryParams.length}`;
      paginationClause = `limit ${limitParam}\n        offset ${offsetParam}`;
    }
    const whereClause = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';

    const query = `
      with filtered_orders as (
        select
          orders.id,
          orders.order_number,
          orders.public_code_base,
          orders.customer_type,
          orders.organization_name,
          orders.contact_name,
          orders.email,
          orders.address_line1,
          orders.address_line2,
          orders.postal_code,
          orders.city,
          orders.gurs_house_number_id,
          orders.country_code,
          orders.reference,
          orders.notes,
          orders.status,
          orders.payment_status,
          orders.admin_order_notes,
          orders.subtotal::text as subtotal,
          orders.tax::text as tax,
          orders.shipping::text as shipping,
          orders.automatic_shipping::text as automatic_shipping,
          orders.shipping_override_json,
          orders.shipping_override_stale,
          orders.parcel_count,
          orders.total::text as total,
          orders.pricing_revision,
          orders.delivery_plan_revision,
          orders.created_at,
          orders.is_draft,
          orders.deleted_at,
          related_request.public_code_base as source_quote_public_code_base,
          related_offer.version_number as source_quote_offer_version_number
        from orders
        left join quote_offer_versions related_offer
          on related_offer.id = orders.source_quote_offer_version_id
        left join quote_requests related_request
          on related_request.id = related_offer.quote_request_id
        ${whereClause}
      ),
      paged_orders as (
        select * from filtered_orders
        order by ${PAGED_ORDER_NUMBER_DESC_SQL}
        ${paginationClause}
      ),
      latest_documents as (
        select distinct on (order_id, type)
          id,
          order_id,
          type,
          filename,
          created_at
        from (
          select
            od.id,
            od.order_id,
            od.type,
            od.filename,
            od.created_at
          from order_documents od
          join paged_orders po
            on po.id = od.order_id
           and po.pricing_revision = od.order_pricing_revision
           and (
             od.type <> 'dobavnica'
             or po.delivery_plan_revision = od.order_delivery_plan_revision
           )
          where od.order_id in (select id from paged_orders)
            and od.deleted_at is null
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
      const id = Number(row.id);
      const orderId = Number(row.order_id);
      const type = String(row.type);
      const mapped: OrderListDocumentSummaryRow = {
        id,
        order_id: orderId,
        type,
        filename: normalizeOrderPdfFilenameForPresentation(type, String(row.filename)),
        url: buildAdminOrderDocumentUrl(orderId, id),
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

export async function fetchOrderAttentionCount(): Promise<number> {
  const pool = await getPool();
  const result = await profileRoutePhase(
    'db',
    'fetchOrderAttentionCount:query',
    () => pool.query(
      `
        select count(*)::int as count
        from orders
        where orders.status = any($1::text[])
          and orders.deleted_at is null
      `,
      [[...ORDER_ATTENTION_STATUSES]]
    )
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function fetchOrderById(orderId: number, diagnosticsContext = '/admin/orders/[orderId]'): Promise<OrderRow | null> {
  return instrumentCatalogLoader('fetchOrderById', diagnosticsContext, async () => {
    const pool = await getPool();
    const result = await profileRoutePhase('db', 'fetchOrderById:query', () => pool.query(
      `
    select
      orders.id,
      orders.order_number,
      orders.public_code_base,
      orders.customer_type,
      orders.organization_name,
      orders.contact_name,
      orders.email,
      orders.address_line1,
      orders.address_line2,
      orders.postal_code,
      orders.city,
      orders.gurs_house_number_id,
      orders.country_code,
      orders.commitment_status,
      orders.contract_status,
      orders.contract_accepted_at,
      orders.contract_accepted_actor_type,
      orders.contract_accepted_actor_id,
      orders.contract_acceptance_evidence_json as contract_accepted_evidence_json,
      orders.contract_rejected_at,
      orders.contract_rejected_actor_type,
      orders.contract_rejected_actor_id,
      orders.contract_rejection_evidence_json as contract_rejected_evidence_json,
      orders.contract_rejection_reason as contract_rejected_reason,
      orders.committed_at,
      orders.source_quote_offer_version_id,
      related_request.id as source_quote_request_id,
      related_request.request_number as source_quote_request_number,
      related_offer.offer_number as source_quote_offer_number,
      related_request.public_code_base as source_quote_public_code_base,
      related_offer.version_number as source_quote_offer_version_number,
      orders.reference,
      orders.notes,
      orders.status,
      orders.payment_status,
      orders.admin_order_notes,
      orders.subtotal::text as subtotal,
      orders.tax::text as tax,
      orders.tax_rate,
      orders.shipping::text as shipping,
      orders.automatic_shipping::text as automatic_shipping,
      orders.shipping_snapshot_json,
      orders.shipping_override_json,
      orders.shipping_override_stale,
      orders.parcel_count,
      orders.pricing_revision,
      orders.delivery_plan_revision,
      orders.total::text as total,
      orders.created_at,
      orders.is_draft,
      orders.deleted_at
    from orders
    left join quote_offer_versions related_offer
      on related_offer.id = orders.source_quote_offer_version_id
    left join quote_requests related_request
      on related_request.id = related_offer.quote_request_id
    where orders.id = $1
    `,
      [orderId]
    ));

    if (result.rows.length === 0) return null;
    return profileRoutePhase('transform', 'fetchOrderById:mapRow', async () => mapOrderRow(result.rows[0] as Record<string, unknown>));
  });
}

export async function fetchOrderDetailSnapshot(
  orderId: number,
  diagnosticsContext = '/admin/orders/[orderId]'
): Promise<{
  order: OrderRow | null;
  items: OrderItemRow[];
  documents: OrderDocumentRow[];
}> {
  return instrumentCatalogLoader('fetchOrderDetailSnapshot', diagnosticsContext, async () => {
    const pool = await getPool();
    const client = await pool.connect();
    let rawOrder: Record<string, unknown> | null = null;
    let rawItems: Record<string, unknown>[] = [];
    let rawDocuments: Record<string, unknown>[] = [];

    try {
      await client.query('begin isolation level repeatable read read only');
      const orderResult = await client.query(
        `
          select
            orders.id,
            orders.order_number,
            orders.public_code_base,
            orders.customer_type,
            orders.organization_name,
            orders.contact_name,
            orders.email,
            orders.address_line1,
            orders.address_line2,
            orders.postal_code,
            orders.city,
            orders.gurs_house_number_id,
            orders.country_code,
            orders.commitment_status,
            orders.contract_status,
            orders.contract_accepted_at,
            orders.contract_accepted_actor_type,
            orders.contract_accepted_actor_id,
            orders.contract_acceptance_evidence_json as contract_accepted_evidence_json,
            orders.contract_rejected_at,
            orders.contract_rejected_actor_type,
            orders.contract_rejected_actor_id,
            orders.contract_rejection_evidence_json as contract_rejected_evidence_json,
            orders.contract_rejection_reason as contract_rejected_reason,
            orders.committed_at,
            orders.source_quote_offer_version_id,
            related_request.id as source_quote_request_id,
            related_request.request_number as source_quote_request_number,
            related_offer.offer_number as source_quote_offer_number,
            related_request.public_code_base as source_quote_public_code_base,
            related_offer.version_number as source_quote_offer_version_number,
            orders.reference,
            orders.notes,
            orders.status,
            orders.payment_status,
            orders.admin_order_notes,
            orders.subtotal::text as subtotal,
            orders.tax::text as tax,
            orders.tax_rate,
            orders.shipping::text as shipping,
            orders.automatic_shipping::text as automatic_shipping,
            orders.shipping_snapshot_json,
            orders.shipping_override_json,
            orders.shipping_override_stale,
            orders.parcel_count,
            orders.total::text as total,
            orders.created_at,
            orders.is_draft,
            orders.deleted_at,
            orders.pricing_revision,
            orders.delivery_plan_revision
          from orders
          left join quote_offer_versions related_offer
            on related_offer.id = orders.source_quote_offer_version_id
          left join quote_requests related_request
            on related_request.id = related_offer.quote_request_id
          where orders.id = $1
        `,
        [orderId]
      );
      rawOrder = (orderResult.rows[0] as Record<string, unknown> | undefined) ?? null;

      if (rawOrder) {
        const itemsResult = await client.query(
          'select * from order_items where order_id = $1 order by id',
          [orderId]
        );
        rawItems = itemsResult.rows as Record<string, unknown>[];

        const documentsResult = await client.query(
          `
            select d.id, d.order_id, d.type, d.filename, d.created_at
            from order_documents d
            where d.order_id = $1
              and d.deleted_at is null
              and d.order_pricing_revision = $2
              and (
                d.type <> 'dobavnica'
                or d.order_delivery_plan_revision = $3
              )
            order by d.created_at desc
          `,
          [
            orderId,
            rawOrder.pricing_revision,
            rawOrder.delivery_plan_revision
          ]
        );
        rawDocuments = documentsResult.rows as Record<string, unknown>[];
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    return {
      order: rawOrder ? mapOrderRow(rawOrder) : null,
      items: rawItems.map(mapOrderItemRow),
      documents: rawDocuments.map(mapOrderDocumentRow)
    };
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
    const conditions = [
      'lower(trim(order_items.sku)) = any($1::text[])',
      "coalesce(orders.status, '') <> 'cancelled'",
      'coalesce(orders.is_draft, false) = false',
      'orders.deleted_at is null',
      "orders.commitment_status = 'binding'",
      "orders.contract_status <> 'rejected'"
    ];

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
    const result = await profileRoutePhase('db', 'fetchOrderDocuments:query', () => pool.query(
      `
        select d.id, d.order_id, d.type, d.filename, d.created_at
        from order_documents d
        join orders o on o.id = d.order_id
        where d.order_id = $1
          and d.deleted_at is null
          and d.order_pricing_revision = o.pricing_revision
          and (
            d.type <> 'dobavnica'
            or d.order_delivery_plan_revision = o.delivery_plan_revision
          )
        order by d.created_at desc
      `,
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
    const result = await profileRoutePhase('db', 'fetchOrderDocumentsForOrders:query', () => pool.query(
      `
        select d.id, d.order_id, d.type, d.filename, d.created_at
        from order_documents d
        join orders o on o.id = d.order_id
        where d.order_id = any($1::bigint[])
          and d.deleted_at is null
          and d.order_pricing_revision = o.pricing_revision
          and (
            d.type <> 'dobavnica'
            or d.order_delivery_plan_revision = o.delivery_plan_revision
          )
        order by d.created_at desc
      `,
      [orderIds]
    ));
    return profileRoutePhase('transform', 'fetchOrderDocumentsForOrders:mapRows', async () =>
      result.rows.map((rawRow) => mapOrderDocumentRow(rawRow as Record<string, unknown>))
    );
  });
}

export async function fetchPaymentLogs(orderId: number): Promise<PaymentLogRow[]> {
  const pool = await getPool();
  const result = await pool.query(
    'select * from order_payment_logs where order_id = $1 order by created_at desc',
    [orderId]
  );
  return result.rows.map((rawRow) => mapPaymentLogRow(rawRow as Record<string, unknown>));
}
