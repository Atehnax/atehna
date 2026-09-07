import type { BusinessFilters, CanonicalOrder, CanonicalQuoteRequest } from './businessAnalytics';

export function parseBusinessOriginFilters(params: URLSearchParams): Pick<BusinessFilters, 'entrySource' | 'history'> {
  const entrySource = params.get('entrySource') ?? 'all';
  const history = params.get('history') ?? 'all';
  if (!['all', 'website', 'manual', 'unknown'].includes(entrySource)) throw new Error('Neveljaven način vnosa naročila.');
  if (!['all', 'historical', 'current'].includes(history)) throw new Error('Neveljaven izbor zgodovine naročil.');
  return { entrySource: entrySource as BusinessFilters['entrySource'], history: history as BusinessFilters['history'] };
}
export function matchesBusinessOrigin(row: Pick<CanonicalOrder, 'entrySource' | 'isHistorical'>, filters: Pick<BusinessFilters, 'entrySource' | 'history'>): boolean {
  return (!filters.entrySource || filters.entrySource === 'all' || (row.entrySource ?? 'unknown') === filters.entrySource)
    && (!filters.history || filters.history === 'all' || (filters.history === 'historical') === (row.isHistorical === true));
}
export function matchesBusinessQuoteFilters(row: CanonicalQuoteRequest, filters: BusinessFilters): boolean {
  return !row.isHistorical && !row.isTest && filters.history !== 'historical' && filters.source !== 'direct' && filters.status === 'all'
    && (filters.customerType === 'all' || row.customerType === filters.customerType)
    && matchesBusinessOrigin(row, filters);
}
