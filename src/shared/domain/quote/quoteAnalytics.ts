import type { AdminQuoteFunnel } from '@/shared/domain/quote/quoteAdminTypes';

export type QuoteAnalyticsRange =
  | '7d'
  | '30d'
  | '90d'
  | '180d'
  | '365d'
  | 'ytd'
  | 'max';

export type QuoteAnalyticsDay = {
  date: string;
  requests: number;
  offersIssued: number;
  acceptedOrConverted: number;
  declined: number;
  withdrawn: number;
  expired: number;
  quotedValue: number;
  convertedOrderValue: number;
};

export type QuoteAnalyticsResponse = {
  timezone: 'UTC';
  range: QuoteAnalyticsRange;
  from: string;
  to: string;
  days: QuoteAnalyticsDay[];
  summary: AdminQuoteFunnel;
};

export type QuoteAnalyticsSourceRow = {
  id: number;
  createdAt: string;
  status: string;
  firstIssuedAt: string | null;
  acceptedAt: string | null;
  quotedValue: number;
  convertedOrderValue: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const emptyQuoteFunnel = (): AdminQuoteFunnel => ({
  requests: 0,
  offersIssued: 0,
  acceptedOrConverted: 0,
  declined: 0,
  withdrawn: 0,
  expired: 0,
  conversionRate: 0,
  averageRequestToIssueHours: null,
  averageIssueToAcceptHours: null,
  quotedValue: 0,
  convertedOrderValue: 0
});

const parseYmdUtc = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? null
    : parsed;
};

export type QuoteAnalyticsComparisonWindows = {
  anchorTo: string;
  currentFrom: string;
  currentTo: string;
  previousFrom: string;
  previousTo: string;
};

export const buildQuoteAnalyticsComparisonWindows = (
  anchorYmd: string
): QuoteAnalyticsComparisonWindows => {
  const anchor = parseYmdUtc(anchorYmd);
  if (!anchor) throw new Error('Invalid quote analytics comparison anchor.');
  const shift = (days: number) =>
    new Date(anchor.getTime() + days * DAY_MS).toISOString().slice(0, 10);

  return {
    anchorTo: anchorYmd,
    currentFrom: shift(-29),
    currentTo: anchorYmd,
    previousFrom: shift(-59),
    previousTo: shift(-30)
  };
};

const toFiniteValue = (value: number) => Number.isFinite(value) ? value : 0;
const round = (value: number, digits = 2) => Number(value.toFixed(digits));

const durationHours = (from: string | null, to: string | null) => {
  if (!from || !to) return null;
  const fromTimestamp = new Date(from).getTime();
  const toTimestamp = new Date(to).getTime();
  if (!Number.isFinite(fromTimestamp) || !Number.isFinite(toTimestamp)) return null;
  const hours = (toTimestamp - fromTimestamp) / (60 * 60 * 1000);
  return Number.isFinite(hours) && hours >= 0 ? hours : null;
};

export function aggregateQuoteAnalyticsRows(input: {
  rows: QuoteAnalyticsSourceRow[];
  range: QuoteAnalyticsRange;
  from: string;
  to: string;
}): QuoteAnalyticsResponse {
  const parsedFrom = parseYmdUtc(input.from);
  const parsedTo = parseYmdUtc(input.to);
  const safeFrom = parsedFrom && parsedTo && parsedFrom.getTime() > parsedTo.getTime()
    ? parsedTo
    : parsedFrom;
  const safeTo = parsedFrom && parsedTo && parsedFrom.getTime() > parsedTo.getTime()
    ? parsedFrom
    : parsedTo;
  const fallback = new Date(new Date().toISOString().slice(0, 10));
  const fromDate = safeFrom ?? safeTo ?? fallback;
  const toDate = safeTo ?? safeFrom ?? fallback;
  const from = fromDate.toISOString().slice(0, 10);
  const to = toDate.toISOString().slice(0, 10);
  const bucketByDay = new Map<string, QuoteAnalyticsDay>();

  for (let cursor = fromDate.getTime(); cursor <= toDate.getTime(); cursor += DAY_MS) {
    const date = new Date(cursor).toISOString().slice(0, 10);
    bucketByDay.set(date, {
      date,
      requests: 0,
      offersIssued: 0,
      acceptedOrConverted: 0,
      declined: 0,
      withdrawn: 0,
      expired: 0,
      quotedValue: 0,
      convertedOrderValue: 0
    });
  }

  let requestToIssueHoursTotal = 0;
  let requestToIssueHoursCount = 0;
  let issueToAcceptHoursTotal = 0;
  let issueToAcceptHoursCount = 0;

  input.rows.forEach((row) => {
    const createdAt = new Date(row.createdAt);
    if (Number.isNaN(createdAt.getTime())) return;
    const bucket = bucketByDay.get(createdAt.toISOString().slice(0, 10));
    if (!bucket) return;

    bucket.requests += 1;
    if (row.firstIssuedAt) bucket.offersIssued += 1;
    if (row.acceptedAt) bucket.acceptedOrConverted += 1;
    if (row.status === 'declined') bucket.declined += 1;
    if (row.status === 'withdrawn') bucket.withdrawn += 1;
    if (row.status === 'expired') bucket.expired += 1;
    bucket.quotedValue += toFiniteValue(row.quotedValue);
    bucket.convertedOrderValue += toFiniteValue(row.convertedOrderValue);

    const requestToIssue = durationHours(row.createdAt, row.firstIssuedAt);
    if (requestToIssue !== null) {
      requestToIssueHoursTotal += requestToIssue;
      requestToIssueHoursCount += 1;
    }

    const issueToAccept = durationHours(row.firstIssuedAt, row.acceptedAt);
    if (issueToAccept !== null) {
      issueToAcceptHoursTotal += issueToAccept;
      issueToAcceptHoursCount += 1;
    }
  });

  const days = Array.from(bucketByDay.values()).map((day) => ({
    ...day,
    quotedValue: round(day.quotedValue),
    convertedOrderValue: round(day.convertedOrderValue)
  }));
  const requests = days.reduce((sum, day) => sum + day.requests, 0);
  const offersIssued = days.reduce((sum, day) => sum + day.offersIssued, 0);
  const acceptedOrConverted = days.reduce((sum, day) => sum + day.acceptedOrConverted, 0);

  return {
    timezone: 'UTC',
    range: input.range,
    from,
    to,
    days,
    summary: {
      requests,
      offersIssued,
      acceptedOrConverted,
      declined: days.reduce((sum, day) => sum + day.declined, 0),
      withdrawn: days.reduce((sum, day) => sum + day.withdrawn, 0),
      expired: days.reduce((sum, day) => sum + day.expired, 0),
      conversionRate: requests > 0 ? round((acceptedOrConverted / requests) * 100) : 0,
      averageRequestToIssueHours: requestToIssueHoursCount > 0
        ? round(requestToIssueHoursTotal / requestToIssueHoursCount)
        : null,
      averageIssueToAcceptHours: issueToAcceptHoursCount > 0
        ? round(issueToAcceptHoursTotal / issueToAcceptHoursCount)
        : null,
      quotedValue: round(days.reduce((sum, day) => sum + day.quotedValue, 0)),
      convertedOrderValue: round(days.reduce((sum, day) => sum + day.convertedOrderValue, 0))
    }
  };
}

export function emptyQuoteAnalyticsResponse(
  range: QuoteAnalyticsRange = '90d'
): QuoteAnalyticsResponse {
  const today = new Date().toISOString().slice(0, 10);
  return aggregateQuoteAnalyticsRows({ rows: [], range, from: today, to: today });
}
