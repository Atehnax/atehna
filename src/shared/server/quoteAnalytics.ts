import {
  aggregateQuoteAnalyticsRows,
  type QuoteAnalyticsRange,
  type QuoteAnalyticsResponse,
  type QuoteAnalyticsSourceRow
} from '@/shared/domain/quote/quoteAnalytics';
import { instrumentCatalogLoader, profilePayloadEstimate, profileRoutePhase } from '@/shared/server/catalogDiagnostics';
import { getPool } from '@/shared/server/db';

const DAY_MS = 24 * 60 * 60 * 1000;

type RawQuoteAnalyticsRow = Record<string, unknown> & {
  id: string | number;
  created_at: string | Date;
  status: string;
  first_issued_at: string | Date | null;
  accepted_at: string | Date | null;
  quoted_value: string | number | null;
  converted_order_value: string | number | null;
};

type QuoteAnalyticsWindow = {
  range: QuoteAnalyticsRange;
  fromIso: string | null;
  toExclusiveIso: string;
  fromYmd: string | null;
  toYmd: string;
};

const parseYmd = (value?: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const normalized = value.trim();
  const date = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized
    ? null
    : date;
};

export const normalizeQuoteAnalyticsRange = (value?: string | null): QuoteAnalyticsRange => {
  if (
    value === '7d'
    || value === '30d'
    || value === '90d'
    || value === '180d'
    || value === '365d'
    || value === 'ytd'
    || value === 'max'
  ) return value;
  return '90d';
};

const rangeToDays = (range: QuoteAnalyticsRange) => {
  if (range === '7d') return 7;
  if (range === '30d') return 30;
  if (range === '180d') return 180;
  if (range === '365d') return 365;
  return 90;
};

const resolveWindow = (input?: {
  range?: string | null;
  from?: string | null;
  to?: string | null;
}): QuoteAnalyticsWindow => {
  const range = normalizeQuoteAnalyticsRange(input?.range);
  const parsedFrom = parseYmd(input?.from);
  const parsedTo = parseYmd(input?.to);
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const requestedTo = parsedTo ?? today;
  const requestedFrom = parsedFrom ?? (
    range === 'max'
      ? null
      : range === 'ytd'
        ? new Date(Date.UTC(requestedTo.getUTCFullYear(), 0, 1))
        : new Date(requestedTo.getTime() - (rangeToDays(range) - 1) * DAY_MS)
  );
  const fromDate = requestedFrom && requestedFrom.getTime() > requestedTo.getTime()
    ? requestedTo
    : requestedFrom;
  const toDate = requestedFrom && requestedFrom.getTime() > requestedTo.getTime()
    ? requestedFrom
    : requestedTo;

  return {
    range,
    fromIso: fromDate?.toISOString() ?? null,
    toExclusiveIso: new Date(toDate.getTime() + DAY_MS).toISOString(),
    fromYmd: fromDate?.toISOString().slice(0, 10) ?? null,
    toYmd: toDate.toISOString().slice(0, 10)
  };
};

const toIsoOrNull = (value: string | Date | null) => {
  if (value === null) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const toNumber = (value: string | number | null) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const mapSourceRow = (row: RawQuoteAnalyticsRow): QuoteAnalyticsSourceRow => ({
  id: Number(row.id),
  createdAt: toIsoOrNull(row.created_at) ?? '',
  status: String(row.status ?? ''),
  firstIssuedAt: toIsoOrNull(row.first_issued_at),
  acceptedAt: toIsoOrNull(row.accepted_at),
  quotedValue: toNumber(row.quoted_value),
  convertedOrderValue: toNumber(row.converted_order_value)
});

export async function fetchQuoteAnalytics(
  params?: {
    range?: string | null;
    from?: string | null;
    to?: string | null;
  },
  diagnosticsContext = '/admin/analitika/ponudbe'
): Promise<QuoteAnalyticsResponse> {
  return instrumentCatalogLoader('fetchQuoteAnalytics', diagnosticsContext, async () => {
    const window = resolveWindow(params);
    const pool = await getPool();
    const result = await profileRoutePhase('db', 'fetchQuoteAnalytics:cohortRows', () => pool.query<RawQuoteAnalyticsRow>(
      `
      with first_issue as (
        select quote_request_id, min(issued_at) as issued_at
        from quote_offer_versions
        where issued_at is not null
          and issued_at < $2::timestamptz
        group by quote_request_id
      ),
      latest_issued as (
        select distinct on (quote_request_id)
          quote_request_id,
          issued_at,
          total
        from quote_offer_versions
        where issued_at is not null
          and issued_at < $2::timestamptz
        order by quote_request_id, issued_at desc, version_number desc, id desc
      ),
      acceptance_facts as (
        select offer.quote_request_id, acceptance.accepted_at
        from quote_offer_acceptances acceptance
        join quote_offer_versions offer
          on offer.id = acceptance.quote_offer_version_id
        where acceptance.accepted_at < $2::timestamptz
        union all
        select quote_request_id, accepted_at
        from quote_offer_versions
        where accepted_at is not null
          and accepted_at < $2::timestamptz
      ),
      first_acceptance as (
        select quote_request_id, min(accepted_at) as accepted_at
        from acceptance_facts
        group by quote_request_id
      ),
      eligible_connected_orders as (
        select
          source_offer.quote_request_id,
          coalesce(sum(order_record.total), 0)::text as total
        from orders order_record
        join quote_offer_versions source_offer
          on source_offer.id = order_record.source_quote_offer_version_id
        where order_record.deleted_at is null
          and coalesce(order_record.is_draft, false) = false
          and order_record.contract_status = 'accepted'
          and order_record.commitment_status = 'binding'
          and order_record.status <> 'cancelled'
          and coalesce(
            order_record.committed_at,
            order_record.contract_accepted_at,
            order_record.created_at
          ) < $2::timestamptz
        group by source_offer.quote_request_id
      )
      select
        request.id,
        request.created_at,
        request.status,
        first_issue.issued_at as first_issued_at,
        first_acceptance.accepted_at,
        coalesce(latest_issued.total, 0)::text as quoted_value,
        coalesce(eligible_connected_orders.total, '0') as converted_order_value
      from quote_requests request
      left join first_issue on first_issue.quote_request_id = request.id
      left join latest_issued on latest_issued.quote_request_id = request.id
      left join first_acceptance on first_acceptance.quote_request_id = request.id
      left join eligible_connected_orders on eligible_connected_orders.quote_request_id = request.id
      where ($1::timestamptz is null or request.created_at >= $1::timestamptz)
        and request.created_at < $2::timestamptz
        and request.voided_at is null
      order by request.created_at asc, request.id asc
      `,
      [window.fromIso, window.toExclusiveIso]
    ));
    const rows = result.rows.map(mapSourceRow);
    const validCreatedDays = rows
      .map((row) => row.createdAt.slice(0, 10))
      .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));
    const from = window.fromYmd
      ?? validCreatedDays[0]
      ?? window.toYmd;
    const to = window.range === 'max'
      ? validCreatedDays[validCreatedDays.length - 1] ?? window.toYmd
      : window.toYmd;
    const analytics = await profileRoutePhase('transform', 'fetchQuoteAnalytics:aggregate', async () =>
      aggregateQuoteAnalyticsRows({ rows, range: window.range, from, to })
    );
    profilePayloadEstimate('fetchQuoteAnalytics:response', analytics);
    return analytics;
  });
}
