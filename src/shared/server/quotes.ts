import { getPool } from '@/shared/server/db';
import { getCustomerIdentity } from '@/shared/domain/order/customerIdentity';
import { instrumentCatalogLoader } from '@/shared/server/catalogDiagnostics';
import { buildQuoteAnalyticsComparisonWindows } from '@/shared/domain/quote/quoteAnalytics';
import { fetchQuoteAnalytics } from '@/shared/server/quoteAnalytics';
import {
  normalizeAdminQuoteDateRange,
  normalizeAdminQuoteRequestNumberRange,
  type AdminQuoteAccessState,
  type AdminQuoteDetail,
  type AdminQuoteDocument,
  type AdminQuoteEmailJob,
  type AdminQuoteEvent,
  type AdminQuoteFunnelPreview,
  type AdminQuoteItem,
  type AdminQuoteListPage,
  type AdminQuoteListRow,
  type AdminQuoteOfferVersion,
  type AdminQuoteCustomerTypeFilter,
  type AdminQuoteStatusFilter
} from '@/shared/domain/quote/quoteAdminTypes';
import { normalizeQuoteEmailSettings } from '@/shared/domain/quote/quoteEmailSettings';
import { getQuoteEmailRetryEligibility } from '@/shared/domain/quote/quoteEmailRetryEligibility';
import { getOrderEmailSettings } from '@/shared/server/orderEmailSettings';
import {
  formatOfferCode,
  formatOrderCode,
  formatQuoteCode,
  parseCommercePublicCode
} from '@/shared/domain/commercePublicCode';

type RawRow = Record<string, unknown>;

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toNullableNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toText = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

const toNullableText = (value: unknown) =>
  value === null || value === undefined ? null : String(value);

const toIso = (value: unknown, fallback = '') => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return fallback;
};

const toNullableIso = (value: unknown) =>
  value === null || value === undefined ? null : toIso(value, null as never);

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

function mapQuoteEvent(row: RawRow): AdminQuoteEvent {
  return {
    id: toNumber(row.id),
    offerVersionId: toNullableNumber(row.quote_offer_version_id),
    eventType: toText(row.event_type),
    actorType: toText(row.actor_type, 'system'),
    actorId: toNullableText(row.actor_id),
    occurredAt: toIso(row.occurred_at),
    reason: toNullableText(row.reason),
    metadata: toRecord(row.metadata_json)
  };
}

function mapQuoteItem(row: RawRow): AdminQuoteItem {
  return {
    id: toNumber(row.id),
    catalogItemId: row.catalog_item_id === null ? null : toNumber(row.catalog_item_id),
    catalogVariantId: toNumber(row.catalog_variant_id),
    lineNumber: Math.max(1, Math.trunc(toNumber(row.line_number, 1))),
    productName: toText(row.product_name, 'Artikel'),
    variantName: toNullableText(row.variant_name),
    sku: toText(row.sku),
    unit: toNullableText(row.unit),
    quantity: Math.max(0, toNumber(row.quantity)),
    baseUnitNet: toNumber(row.base_unit_net),
    discountPct: toNumber(row.discount_pct),
    unitNet: toNumber(row.unit_net),
    unitTax: toNumber(row.unit_tax),
    unitGross: toNumber(row.unit_gross),
    lineNet: toNumber(row.line_net),
    lineTax: toNumber(row.line_tax),
    lineGross: toNumber(row.line_gross),
    taxRate: toNumber(row.tax_rate),
    currency: toText(row.currency, 'EUR'),
    selectedAttributes: toRecord(row.selected_attributes),
    snapshot: toRecord(row.snapshot_json)
  };
}

function mapQuoteOfferVersion(
  row: RawRow,
  items: AdminQuoteItem[],
  publicCodeBase: string
): AdminQuoteOfferVersion {
  const versionNumber = Math.max(1, Math.trunc(toNumber(row.version_number, 1)));
  return {
    id: toNumber(row.id),
    versionNumber,
    offerCode: formatOfferCode(publicCodeBase, versionNumber),
    offerNumber: toNullableText(row.offer_number),
    status: toText(row.status, 'draft'),
    isCurrent: row.is_current === true,
    issuedAt: toNullableIso(row.issued_at),
    validUntil: toNullableIso(row.valid_until),
    subtotal: toNumber(row.subtotal),
    tax: toNumber(row.tax),
    shipping: toNumber(row.shipping),
    shippingSnapshot: toRecord(row.shipping_snapshot_json),
    shippingConfirmation: toRecord(row.shipping_confirmation_json),
    total: toNumber(row.total),
    currency: toText(row.currency, 'EUR'),
    taxRate: toNumber(row.tax_rate),
    deliveryTerms: toText(row.delivery_terms),
    paymentTerms: toText(row.payment_terms),
    sellerMessage: toText(row.seller_message),
    customerVisibleNotes: toText(row.customer_visible_notes),
    termsText: toText(row.terms_text),
    termsVersion: toNullableText(row.terms_version),
    termsHash: toNullableText(row.terms_hash),
    contentHash: toNullableText(row.content_hash),
    stateVersion: Math.max(1, Math.trunc(toNumber(row.state_version, 1))),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    items
  };
}

function mapQuoteListDocuments(value: unknown): AdminQuoteListRow['downloadableDocuments'] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((document) => {
    if (!document || typeof document !== 'object') return [];
    const record = document as RawRow;
    const id = Math.trunc(toNumber(record.id));
    const offerVersionId = Math.trunc(toNumber(record.offerVersionId));
    const filename = toText(record.filename).trim();
    if (id <= 0 || offerVersionId <= 0 || !filename) return [];

    return [{
      id,
      offerVersionId,
      documentType: toText(record.documentType),
      filename
    }];
  });
}

function mapQuoteListRow(row: RawRow): AdminQuoteListRow {
  const organizationName = toText(row.organization_name).trim();
  const contactName = toText(row.contact_name).trim();
  const customerType = toText(row.customer_type);
  const publicCodeBase = toText(row.public_code_base);
  const latestOfferVersionNumber = toNullableNumber(row.latest_offer_version_number);
  return {
    id: toNumber(row.id),
    quoteCode: formatQuoteCode(publicCodeBase),
    requestNumber: toText(row.request_number),
    status: toText(row.status, 'received'),
    stateVersion: Math.max(1, Math.trunc(toNumber(row.state_version, 1))),
    customerType,
    organizationName: toNullableText(row.organization_name),
    contactName,
    customerName: getCustomerIdentity({ customerType, organizationName, contactName }).name,
    email: toText(row.email),
    addressLine1: toNullableText(row.address_line1),
    addressLine2: toNullableText(row.address_line2),
    postalCode: toNullableText(row.postal_code),
    city: toNullableText(row.city),
    countryCode: toNullableText(row.country_code),
    reference: toNullableText(row.reference),
    quoteReason: toNullableText(row.quote_reason),
    customerMessage: toNullableText(row.customer_message),
    createdAt: toIso(row.created_at),
    latestOfferVersionId: toNullableNumber(row.latest_offer_version_id),
    latestOfferCode: latestOfferVersionNumber === null
      ? null
      : formatOfferCode(publicCodeBase, Math.max(1, Math.trunc(latestOfferVersionNumber))),
    latestOfferNumber: toNullableText(row.latest_offer_number),
    latestOfferStatus: toNullableText(row.latest_offer_status),
    validUntil: toNullableIso(row.valid_until),
    quotedTotal: toNullableNumber(row.quoted_total),
    currency: toText(row.currency, 'EUR'),
    shippingRequiresManualEntry: row.shipping_requires_manual_entry === true,
    resultingOrderId: toNullableNumber(row.resulting_order_id),
    resultingOrderCode: row.resulting_order_public_code_base
      ? formatOrderCode(toText(row.resulting_order_public_code_base))
      : null,
    resultingOrderNumber: toNullableText(row.resulting_order_number),
    failedEmailCount: Math.max(0, Math.trunc(toNumber(row.failed_email_count))),
    downloadableDocuments: mapQuoteListDocuments(row.downloadable_documents)
  };
}

const quoteStatusCondition = (filter: AdminQuoteStatusFilter) => {
  if (filter === 'preparation') return `qr.status = 'in_preparation'`;
  if (filter === 'received') return `qr.status = 'received'`;
  if (filter === 'issued') {
    return `qr.status in ('offer_issued','awaiting_purchase_order_review')`;
  }
  if (filter === 'ordered') return `qr.status in ('accepted','converted_to_order')`;
  if (filter === 'declined') {
    return `qr.status in ('declined','withdrawn','closed_without_offer')`;
  }
  if (filter === 'expired') return `qr.status = 'expired'`;
  return 'true';
};

const latestOfferTotalExpression = `(
  select amount_filter_offer.total
  from quote_offer_versions amount_filter_offer
  where amount_filter_offer.quote_request_id = qr.id
  order by
    amount_filter_offer.is_current desc,
    amount_filter_offer.version_number desc,
    amount_filter_offer.id desc
  limit 1
)`;

const quoteRequestSequenceExpression = 'right(qr.request_number, 6)::integer';

const normalizeQuoteTotalFilter = (value: number | undefined) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;

export async function fetchAdminQuoteRequestsPage(options: {
  query?: string;
  status?: AdminQuoteStatusFilter;
  customerType?: AdminQuoteCustomerTypeFilter;
  fromDate?: string;
  toDate?: string;
  minRequestNumber?: number;
  maxRequestNumber?: number;
  minTotal?: number;
  maxTotal?: number;
  page?: number;
  pageSize?: number;
} = {}): Promise<AdminQuoteListPage> {
  return instrumentCatalogLoader('fetchAdminQuoteRequestsPage', '/admin/orders?view=quotes', async () => {
    const pool = await getPool();
    const queryParams: unknown[] = [];
    const conditions = [
      'qr.voided_at is null',
      quoteStatusCondition(options.status ?? 'all')
    ];
    const normalizedQuery = options.query?.trim();
    if (normalizedQuery) {
      queryParams.push(`%${normalizedQuery}%`);
      const index = queryParams.length;
      const publicCodeConditions: string[] = [];
      const parsedPublicCode = parseCommercePublicCode(normalizedQuery);
      if (parsedPublicCode?.kind === 'quote') {
        queryParams.push(parsedPublicCode.base);
        publicCodeConditions.push(`qr.public_code_base = $${queryParams.length}`);
      }
      if (parsedPublicCode?.kind === 'offer' && parsedPublicCode.version !== null) {
        queryParams.push(parsedPublicCode.base, parsedPublicCode.version);
        const baseIndex = queryParams.length - 1;
        const versionIndex = queryParams.length;
        publicCodeConditions.push(`(
          qr.public_code_base = $${baseIndex}
          and exists (
            select 1
            from quote_offer_versions searchable_public_offer
            where searchable_public_offer.quote_request_id = qr.id
              and searchable_public_offer.version_number = $${versionIndex}
          )
        )`);
      }
      if (parsedPublicCode?.kind === 'order') {
        queryParams.push(parsedPublicCode.base);
        publicCodeConditions.push(`exists (
          select 1
          from orders searchable_public_order
          join quote_offer_versions source_public_offer
            on source_public_offer.id = searchable_public_order.source_quote_offer_version_id
          where source_public_offer.quote_request_id = qr.id
            and searchable_public_order.public_code_base = $${queryParams.length}
        )`);
      }
      conditions.push(`(
        qr.request_number ilike $${index}
        or qr.organization_name ilike $${index}
        or qr.contact_name ilike $${index}
        or qr.email ilike $${index}
        or qr.reference ilike $${index}
        or exists (
          select 1 from quote_offer_versions searchable_offer
          where searchable_offer.quote_request_id = qr.id
            and searchable_offer.offer_number ilike $${index}
        )
        or exists (
          select 1
          from orders searchable_order
          join quote_offer_versions source_offer
            on source_offer.id = searchable_order.source_quote_offer_version_id
          where source_offer.quote_request_id = qr.id
            and searchable_order.order_number::text ilike $${index}
        )
        ${publicCodeConditions.length > 0
          ? `or ${publicCodeConditions.join('\n        or ')}`
          : ''}
      )`);
    }

    const dateRange = normalizeAdminQuoteDateRange(
      options.fromDate ?? '',
      options.toDate ?? ''
    );
    const fromDate = dateRange.from;
    if (fromDate) {
      queryParams.push(fromDate);
      conditions.push(
        `qr.created_at >= ($${queryParams.length}::date::timestamp AT TIME ZONE 'Europe/Ljubljana')`
      );
    }

    const toDate = dateRange.to;
    if (toDate) {
      queryParams.push(toDate);
      conditions.push(
        `qr.created_at < (($${queryParams.length}::date + 1)::timestamp AT TIME ZONE 'Europe/Ljubljana')`
      );
    }

    if (options.customerType && options.customerType !== 'all') {
      queryParams.push(options.customerType);
      conditions.push(`qr.customer_type = $${queryParams.length}`);
    }

    const requestNumberRange = normalizeAdminQuoteRequestNumberRange(
      options.minRequestNumber === undefined
        ? ''
        : String(options.minRequestNumber),
      options.maxRequestNumber === undefined
        ? ''
        : String(options.maxRequestNumber)
    );
    if (requestNumberRange.min) {
      queryParams.push(Number(requestNumberRange.min));
      conditions.push(
        `${quoteRequestSequenceExpression} >= $${queryParams.length}`
      );
    }
    if (requestNumberRange.max) {
      queryParams.push(Number(requestNumberRange.max));
      conditions.push(
        `${quoteRequestSequenceExpression} <= $${queryParams.length}`
      );
    }

    const minTotal = normalizeQuoteTotalFilter(options.minTotal);
    if (minTotal !== null) {
      queryParams.push(minTotal);
      conditions.push(
        `${latestOfferTotalExpression} >= $${queryParams.length}`
      );
    }

    const maxTotal = normalizeQuoteTotalFilter(options.maxTotal);
    if (maxTotal !== null) {
      queryParams.push(maxTotal);
      conditions.push(
        `${latestOfferTotalExpression} <= $${queryParams.length}`
      );
    }

    const pageSize = Math.max(10, Math.min(100, Math.trunc(options.pageSize ?? 25)));
    const page = Math.max(1, Math.trunc(options.page ?? 1));
    queryParams.push(pageSize, (page - 1) * pageSize);
    const limitIndex = queryParams.length - 1;
    const offsetIndex = queryParams.length;
    const whereClause = conditions.join(' and ');

    const [rowsResult, countResult, newCountResult, latestCreatedAtResult] = await Promise.all([
      pool.query(
        `
          select
            qr.id,
            qr.public_code_base,
            qr.request_number,
            qr.status,
            qr.state_version,
            qr.customer_type,
            qr.organization_name,
            qr.contact_name,
            qr.email,
            qr.address_line1,
            qr.address_line2,
            qr.postal_code,
            qr.city,
            qr.country_code,
            qr.reference,
            qr.quote_reason,
            qr.customer_message,
            qr.created_at,
            coalesce((qr.shipping_snapshot_json ->> 'status') = 'manual_quote', false)
              as shipping_requires_manual_entry,
            latest_offer.id as latest_offer_version_id,
            latest_offer.version_number as latest_offer_version_number,
            latest_offer.offer_number as latest_offer_number,
            latest_offer.status as latest_offer_status,
            latest_offer.valid_until,
            latest_offer.total::text as quoted_total,
            latest_offer.currency,
            coalesce(latest_documents.documents, '[]'::json) as downloadable_documents,
            converted_order.id as resulting_order_id,
            converted_order.public_code_base as resulting_order_public_code_base,
            converted_order.order_number as resulting_order_number,
            coalesce(failed_email.failed_count, 0)::int as failed_email_count
          from quote_requests qr
          left join lateral (
            select offer.id, offer.version_number, offer.offer_number, offer.status, offer.valid_until,
                   offer.total, offer.currency
            from quote_offer_versions offer
            where offer.quote_request_id = qr.id
            order by offer.is_current desc, offer.version_number desc, offer.id desc
            limit 1
          ) latest_offer on true
          left join lateral (
            select json_agg(
              json_build_object(
                'id', latest_document.id,
                'offerVersionId', latest_document.quote_offer_version_id,
                'documentType', latest_document.document_type,
                'filename', latest_document.filename
              )
              order by latest_document.document_type
            ) as documents
            from (
              select distinct on (quote_document.document_type)
                quote_document.id,
                quote_document.quote_offer_version_id,
                quote_document.document_type,
                quote_document.filename,
                quote_document.created_at
              from quote_documents quote_document
              join quote_offer_versions document_offer
                on document_offer.id = quote_document.quote_offer_version_id
              where document_offer.quote_request_id = qr.id
                and quote_document.document_type in ('offer', 'purchase_order')
              order by
                quote_document.document_type,
                quote_document.created_at desc,
                quote_document.id desc
            ) latest_document
          ) latest_documents on true
          left join lateral (
            select linked_order.id, linked_order.public_code_base, linked_order.order_number
            from orders linked_order
            join quote_offer_versions source_offer
              on source_offer.id = linked_order.source_quote_offer_version_id
            where source_offer.quote_request_id = qr.id
              and linked_order.deleted_at is null
            order by linked_order.id desc
            limit 1
          ) converted_order on true
          left join lateral (
            select count(*)::int as failed_count
            from quote_email_jobs email_job
            where email_job.quote_request_id = qr.id
              and email_job.status = 'failed'
          ) failed_email on true
          where ${whereClause}
          order by qr.created_at desc, qr.id desc
          limit $${limitIndex}
          offset $${offsetIndex}
        `,
        queryParams
      ),
      pool.query(`select count(*)::int as count from quote_requests qr where ${whereClause}`, queryParams.slice(0, -2)),
      pool.query(`select count(*)::int as count from quote_requests where status = 'received' and voided_at is null`),
      pool.query(`select max(created_at) as latest_created_at from quote_requests where voided_at is null`)
    ]);

    return {
      rows: rowsResult.rows.map((row) => mapQuoteListRow(row as RawRow)),
      totalCount: toNumber(countResult.rows[0]?.count),
      newCount: toNumber(newCountResult.rows[0]?.count),
      latestCreatedAt: toNullableIso(latestCreatedAtResult.rows[0]?.latest_created_at)
    };
  });
}

export async function fetchNewQuoteRequestCount(): Promise<number> {
  const pool = await getPool();
  const result = await pool.query(
    `select count(*)::int as count from quote_requests where status = 'received' and voided_at is null`
  );
  return toNumber(result.rows[0]?.count);
}

export async function fetchAdminQuoteEvents(
  quoteRequestId: number
): Promise<AdminQuoteEvent[] | null> {
  const pool = await getPool();
  const requestResult = await pool.query(
    `select 1 from quote_requests where id = $1 and voided_at is null`,
    [quoteRequestId]
  );
  if (requestResult.rowCount === 0) return null;

  const eventsResult = await pool.query(
    `select *
     from quote_events
     where quote_request_id = $1
     order by occurred_at desc, id desc`,
    [quoteRequestId]
  );
  return (eventsResult.rows as RawRow[]).map(mapQuoteEvent);
}

export async function fetchAdminQuoteDetail(quoteRequestId: number): Promise<AdminQuoteDetail | null> {
  return instrumentCatalogLoader('fetchAdminQuoteDetail', '/admin/orders/quotes/[quoteRequestId]', async () => {
    const pool = await getPool();
    const client = await pool.connect();
    try {
      await client.query('begin isolation level repeatable read read only');
      const requestResult = await client.query(
        `
          select qr.*,
                 linked_order.id as resulting_order_id,
                 linked_order.public_code_base as resulting_order_public_code_base,
                 linked_order.order_number as resulting_order_number
          from quote_requests qr
          left join lateral (
            select orders.id, orders.public_code_base, orders.order_number
            from orders
            join quote_offer_versions source_offer
              on source_offer.id = orders.source_quote_offer_version_id
            where source_offer.quote_request_id = qr.id
              and orders.deleted_at is null
            order by orders.id desc
            limit 1
          ) linked_order on true
          where qr.id = $1
            and qr.voided_at is null
        `,
        [quoteRequestId]
      );
      const request = requestResult.rows[0] as RawRow | undefined;
      if (!request) {
        await client.query('commit');
        return null;
      }

      const [requestItemsResult, versionsResult, versionItemsResult, documentsResult, emailJobsResult, eventsResult, accessResult, emailSettingsResult, orderEmailSettings] = await Promise.all([
        client.query('select * from quote_request_items where quote_request_id = $1 order by line_number, id', [quoteRequestId]),
        client.query('select * from quote_offer_versions where quote_request_id = $1 order by version_number desc, id desc', [quoteRequestId]),
        client.query(
          `select item.*
           from quote_offer_version_items item
           join quote_offer_versions offer on offer.id = item.quote_offer_version_id
           where offer.quote_request_id = $1
           order by offer.version_number desc, item.line_number, item.id`,
          [quoteRequestId]
        ),
        client.query(
          `select
             document.id, document.quote_offer_version_id,
             document.document_type, document.filename,
             document.document_number, document.issued_at,
             document.content_sha256, document.offer_content_hash,
             document.created_at, 'generated'::text as source,
             null::bigint as byte_size, null::text as mime_type
           from quote_documents document
           join quote_offer_versions offer
             on offer.id = document.quote_offer_version_id
           where offer.quote_request_id = $1
           union all
           select
             manual.id, manual.quote_offer_version_id,
             manual.document_type, manual.filename,
             manual.document_number, null::timestamptz as issued_at,
             manual.content_sha256, null::text as offer_content_hash,
             manual.created_at, 'manual_upload'::text as source,
             manual.byte_size, manual.mime_type
           from quote_manual_documents manual
           where manual.quote_request_id = $1
           order by created_at desc, id desc`,
          [quoteRequestId]
        ),
        client.query('select * from quote_email_jobs where quote_request_id = $1 order by created_at desc, id desc', [quoteRequestId]),
        client.query('select * from quote_events where quote_request_id = $1 order by occurred_at desc, id desc', [quoteRequestId]),
        client.query(
          `select
             count(*) filter (where revoked_at is null and expires_at > now())::int as active_count,
             max(expires_at) filter (where revoked_at is null) as latest_expires_at,
             max(last_used_at) as latest_used_at
           from quote_access_tokens
           where quote_request_id = $1`,
          [quoteRequestId]
        ),
        client.query(
          `select config_json from quote_email_settings where key = 'default'`
        ),
        getOrderEmailSettings(client)
      ]);
      await client.query('commit');

      const versionItems = new Map<number, AdminQuoteItem[]>();
      for (const rawItem of versionItemsResult.rows as RawRow[]) {
        const versionId = toNumber(rawItem.quote_offer_version_id);
        const items = versionItems.get(versionId) ?? [];
        items.push(mapQuoteItem(rawItem));
        versionItems.set(versionId, items);
      }

      const rawVersions = versionsResult.rows as RawRow[];
      const publicCodeBase = toText(request.public_code_base);
      const versions = rawVersions.map((row) =>
        mapQuoteOfferVersion(
          row,
          versionItems.get(toNumber(row.id)) ?? [],
          publicCodeBase
        )
      );
      const draftSnapshotRow = rawVersions.find(
        (row) => row.status === 'draft'
      );
      const currentIssuedRow = rawVersions.find(
        (row) => row.status === 'issued' && row.is_current === true
      );
      const draftCustomerOverlay =
        draftSnapshotRow && currentIssuedRow
          ? toRecord(draftSnapshotRow.customer_snapshot_json) ?? {}
          : {};
      const requestDetail = (snapshotKey: string, requestKey: string) =>
        Object.prototype.hasOwnProperty.call(draftCustomerOverlay, snapshotKey)
          ? draftCustomerOverlay[snapshotKey]
          : request[requestKey];
      const accessRow = (accessResult.rows[0] ?? {}) as RawRow;
      const access: AdminQuoteAccessState = {
        activeCount: Math.max(0, Math.trunc(toNumber(accessRow.active_count))),
        latestExpiresAt: toNullableIso(accessRow.latest_expires_at),
        latestUsedAt: toNullableIso(accessRow.latest_used_at)
      };
      const documents: AdminQuoteDocument[] = (documentsResult.rows as RawRow[]).map((row) => ({
        id: toNumber(row.id),
        offerVersionId: toNumber(row.quote_offer_version_id),
        documentType: toText(row.document_type),
        filename: toText(row.filename),
        documentNumber: toNullableText(row.document_number),
        issuedAt: toNullableIso(row.issued_at),
        contentSha256: toNullableText(row.content_sha256),
        offerContentHash: toNullableText(row.offer_content_hash),
        createdAt: toIso(row.created_at),
        source: row.source === 'manual_upload' ? 'manual_upload' : 'generated',
        byteSize: toNullableNumber(row.byte_size),
        mimeType: toNullableText(row.mime_type)
      }));
      const emailSettings = normalizeQuoteEmailSettings(
        emailSettingsResult.rows[0]?.config_json
      );
      const rawVersionById = new Map(
        rawVersions.map((row) => [toNumber(row.id), row])
      );
      const emailJobs: AdminQuoteEmailJob[] = (emailJobsResult.rows as RawRow[]).map((row) => {
        const offerVersionId = toNullableNumber(row.quote_offer_version_id);
        const offer = offerVersionId === null
          ? undefined
          : rawVersionById.get(offerVersionId);
        const retry = getQuoteEmailRetryEligibility({
          settings: emailSettings,
          job: {
            eventType: toText(row.event_type),
            audience: toText(row.audience),
            recipientEmail: toText(row.recipient_email),
            requestStatus: toText(request.status),
            requestVoided: Boolean(request.voided_at),
            offerVersionId,
            offerStatus: offer ? toNullableText(offer.status) : null,
            offerIsCurrent: offer?.is_current === true,
            hasNewerNonDraftOfferVersion: offer
              ? rawVersions.some((candidate) =>
                  toNumber(candidate.version_number) > toNumber(offer.version_number) &&
                  candidate.status !== 'draft'
                )
              : false,
            validUntil: offer ? toNullableIso(offer.valid_until) : null,
            currentCustomerEmail: toText(request.email),
            currentAdminRecipients: orderEmailSettings.adminRecipients
          }
        });
        return {
          id: String(row.id),
          offerVersionId,
          eventType: toText(row.event_type),
          audience: toText(row.audience),
          recipientEmail: toText(row.recipient_email),
          status: toText(row.status),
          attempts: Math.max(0, Math.trunc(toNumber(row.attempts))),
          lastError: toNullableText(row.last_error),
          sentAt: toNullableIso(row.sent_at),
          createdAt: toIso(row.created_at),
          ...retry
        };
      });
      const events = (eventsResult.rows as RawRow[]).map(mapQuoteEvent);

      return {
        id: toNumber(request.id),
        quoteCode: formatQuoteCode(publicCodeBase),
        requestNumber: toText(request.request_number),
        status: toText(request.status, 'received'),
        stateVersion: Math.max(1, Math.trunc(toNumber(request.state_version, 1))),
        customerType: toText(requestDetail('customerType', 'customer_type')),
        organizationName: toNullableText(
          requestDetail('organizationName', 'organization_name')
        ),
        contactName: toText(requestDetail('contactName', 'contact_name')),
        email: toText(requestDetail('email', 'email')),
        addressLine1: toNullableText(
          requestDetail('addressLine1', 'address_line1')
        ),
        addressLine2: toNullableText(
          requestDetail('addressLine2', 'address_line2')
        ),
        postalCode: toNullableText(requestDetail('postalCode', 'postal_code')),
        city: toNullableText(requestDetail('city', 'city')),
        countryCode: toNullableText(
          requestDetail('countryCode', 'country_code')
        ),
        gursHouseNumberId: toNullableText(
          requestDetail('gursHouseNumberId', 'gurs_house_number_id')
        ),
        reference: toNullableText(requestDetail('reference', 'reference')),
        quoteReason: toNullableText(
          requestDetail('quoteReason', 'quote_reason')
        ),
        customerMessage: toNullableText(
          requestDetail('customerMessage', 'customer_message')
        ),
        adminNotes: toText(request.admin_notes),
        adminTitle: toNullableText(request.admin_title),
        createdAt: toIso(request.created_at),
        updatedAt: toIso(request.updated_at),
        requestedItems: (requestItemsResult.rows as RawRow[]).map(mapQuoteItem),
        offerVersions: versions,
        documents,
        emailJobs,
        events,
        access,
        resultingOrderId: toNullableNumber(request.resulting_order_id),
        resultingOrderCode: request.resulting_order_public_code_base
          ? formatOrderCode(toText(request.resulting_order_public_code_base))
          : null,
        resultingOrderNumber: toNullableText(request.resulting_order_number)
      };
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  });
}

export async function fetchAdminQuoteFunnel(): Promise<AdminQuoteFunnelPreview> {
  const today = new Date().toISOString().slice(0, 10);
  const windows = buildQuoteAnalyticsComparisonWindows(today);
  const [overall, last30Days, previous30Days] = await Promise.all([
    fetchQuoteAnalytics(
      { range: 'max', to: windows.anchorTo },
      '/admin/orders:quotes-preview:overall'
    ),
    fetchQuoteAnalytics(
      { range: '30d', from: windows.currentFrom, to: windows.currentTo },
      '/admin/orders:quotes-preview:last-30-days'
    ),
    fetchQuoteAnalytics(
      {
        range: '30d',
        from: windows.previousFrom,
        to: windows.previousTo
      },
      '/admin/orders:quotes-preview:previous-30-days'
    )
  ]);

  return {
    overall: overall.summary,
    last30Days: last30Days.summary,
    previous30Days: previous30Days.summary
  };
}
