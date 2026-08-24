import type { GursAddressSearchResponse } from '@/shared/domain/address/gursAddress';

export const PUBLIC_ADDRESS_SEARCH_CACHE_CONTROL =
  'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

export function getAddressSearchCacheControl(
  response: Pick<GursAddressSearchResponse, 'sourceUpdatedAt'>
): string {
  // Do not let an empty fresh-database response outlive the first successful
  // canonical GURS publication. Once a dataset is active, CDN caching keeps
  // repeated customer searches off the database.
  return response.sourceUpdatedAt
    ? PUBLIC_ADDRESS_SEARCH_CACHE_CONTROL
    : 'no-store';
}
