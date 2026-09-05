import { aggregateBusinessAnalytics } from './metrics';
import { resolveBusinessPeriod, type BusinessPeriod } from './period';
import type { BusinessAnalyticsResponse, CanonicalOrder } from './businessAnalytics';
export type BusinessOrderPreviewSummary = Pick<BusinessAnalyticsResponse['summary'], 'orderCount' | 'activityValue' | 'realisedValue' | 'realisedCount' | 'meanOrderValue' | 'medianOrderValue'>;
export type BusinessOrderPreview = { asOf: string; current: BusinessOrderPreviewSummary; last30Days: BusinessOrderPreviewSummary; previous30Days: BusinessOrderPreviewSummary | null; href: string };
export function projectBusinessOrderSummary(summary: BusinessAnalyticsResponse['summary']): BusinessOrderPreviewSummary {
  return { orderCount: summary.orderCount, activityValue: summary.activityValue, realisedValue: summary.realisedValue, realisedCount: summary.realisedCount, meanOrderValue: summary.meanOrderValue, medianOrderValue: summary.medianOrderValue };
}
/** All amounts and populations come from the same canonical aggregator used by Poslovanje. */
export function buildBusinessOrderPreview(allOrders: CanonicalOrder[], asOf = new Date()): BusinessOrderPreview {
  const recentPeriod = resolveBusinessPeriod({ range: '30D' }, asOf);
  const previousPeriod: BusinessPeriod = { ...recentPeriod, ...recentPeriod.comparison, range: 'custom', partialToday: true };
  const summary = (period: BusinessPeriod) => projectBusinessOrderSummary(aggregateBusinessAnalytics({ allOrders, quotes: [], filters: { range: period.range, customerType: 'all', status: 'all', source: 'all' }, period, asOf: asOf.toISOString() }).summary);
  const firstObserved = allOrders.map(order => order.submittedAt).sort()[0];
  const query = new URLSearchParams({ view: 'narocila', range: '90D', asOf: asOf.toISOString() });
  return { asOf: asOf.toISOString(), current: summary(resolveBusinessPeriod({ range: '90D' }, asOf)), last30Days: summary(recentPeriod), previous30Days: firstObserved && firstObserved <= previousPeriod.start ? summary(previousPeriod) : null, href: '/admin/analitika?' + query.toString() };
}
