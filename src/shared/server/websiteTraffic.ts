import { getPool } from '@/shared/server/db';
import { completeWebsiteTraffic, websitePeriod, type WebsiteQueryResult } from '@/shared/domain/analytics/websiteTraffic';
import { localDate } from '@/shared/domain/analytics/period';

import { WEBSITE_TRAFFIC_SQL } from './websiteTrafficQuery';
import { profileRoutePhase, profilePayloadEstimate } from '@/shared/server/diagnostics/instrumentation';

export async function fetchWebsiteTraffic(params: URLSearchParams) {
  const { asOf, period } = websitePeriod(params);
  const pool = await getPool();
  const result = await profileRoutePhase('db', 'websiteTraffic:aggregate', () => pool.query<{ result: WebsiteQueryResult }>(WEBSITE_TRAFFIC_SQL, [period.start, period.endExclusive, asOf.toISOString(), localDate(asOf)]));
  if (!result.rows[0]?.result) throw new Error('Website traffic query returned no result.');
  const data = await profileRoutePhase('transform', 'websiteTraffic:complete', async () => completeWebsiteTraffic(result.rows[0].result, period, asOf));
  profilePayloadEstimate('websiteTraffic:response', data);
  return data;
}
