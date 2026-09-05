import { aggregateBusinessAnalytics } from './metrics';
import { resolveBusinessPeriod, type BusinessPeriod } from './period';
import type { BusinessAnalyticsResponse, CanonicalQuote } from './businessAnalytics';

export type BusinessQuotePreviewSummary = { issued: number; mature: number; accepted: number; acceptanceRate: number | null; medianResponseHours: number | null; medianDecisionHours: number | null };
export type BusinessQuotePreview = { asOf: string; period: BusinessPeriod; current: BusinessQuotePreviewSummary; last30Days: BusinessQuotePreviewSummary; previous30Days: BusinessQuotePreviewSummary | null; href: string };

/** These cards project the canonical quote result, without defining a second cohort. */
export function projectBusinessQuoteSummary(quotes: BusinessAnalyticsResponse['quotes']): BusinessQuotePreviewSummary {
  return {
    issued: quotes.mature.total + quotes.immature,
    mature: quotes.mature.total,
    accepted: quotes.mature.accepted,
    acceptanceRate: quotes.mature.rate,
    medianResponseHours: quotes.responseStatistics.median,
    medianDecisionHours: quotes.decisionStatistics.median
  };
}

export function buildBusinessQuotePreview(quotes: CanonicalQuote[], asOf = new Date()): BusinessQuotePreview {
  const period = resolveBusinessPeriod({ range: '90D' }, asOf);
  const recentPeriod = resolveBusinessPeriod({ range: '30D' }, asOf);
  const previousPeriod: BusinessPeriod = { ...recentPeriod, ...recentPeriod.comparison, range: 'custom', partialToday: true };
  const summary = (window: BusinessPeriod) => projectBusinessQuoteSummary(aggregateBusinessAnalytics({
    allOrders: [], quotes, filters: { range: window.range, customerType: 'all', status: 'all', source: 'all' },
    period: window, asOf: asOf.toISOString()
  }).quotes);
  const firstObserved = quotes.map(quote => quote.firstIssuedAt).sort()[0];
  const query = new URLSearchParams({ view: 'ponudbe', range: '90D', asOf: asOf.toISOString() });
  return { asOf: asOf.toISOString(), period, current: summary(period), last30Days: summary(recentPeriod), previous30Days: firstObserved && firstObserved <= previousPeriod.start ? summary(previousPeriod) : null, href: '/admin/analitika?' + query.toString() };
}
