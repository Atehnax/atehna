import 'server-only';
import type { PoolClient } from 'pg';
import { getPool } from '@/shared/server/db';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { parseQuoteGoLiveDate, BusinessSettingsInputError, type BusinessAnalyticsSettings } from '@/shared/domain/analytics/businessSettings';

export class BusinessSettingsConflictError extends Error {
  constructor(public readonly current: BusinessAnalyticsSettings) { super('Nastavitev je medtem spremenil drug uporabnik. Preverite trenutni datum in poskusite znova.'); }
}
export async function readBusinessAnalyticsSettings(client: Pick<PoolClient, 'query'>): Promise<BusinessAnalyticsSettings> {
  const result = await client.query(`select quote_go_live_date::text, revision::text, updated_at from business_analytics_settings where key = 'default'`);
  const row = result.rows[0];
  if (!row) throw new Error('Business analytics settings are not initialized');
  return { quoteGoLiveDate: row.quote_go_live_date ?? null, revision: row.revision, updatedAt: new Date(row.updated_at).toISOString() };
}
export async function fetchBusinessAnalyticsSettings() { return readBusinessAnalyticsSettings(await getPool()); }

export async function saveBusinessAnalyticsSettings(input: Record<string, unknown>, request: Request): Promise<BusinessAnalyticsSettings> {
  const quoteGoLiveDate = parseQuoteGoLiveDate(input.quoteGoLiveDate);
  if (typeof input.expectedRevision !== 'string' || !/^\d{1,19}$/.test(input.expectedRevision) || BigInt(input.expectedRevision) > 9223372036854775806n) {
    throw new BusinessSettingsInputError('Različica nastavitve manjka ali ni veljavna. Osvežite podatke.');
  }
  const client = await (await getPool()).connect();
  try {
    await client.query('begin');
    await client.query(`select key from business_analytics_settings where key = 'default' for update`);
    const before = await readBusinessAnalyticsSettings(client);
    if (before.revision !== input.expectedRevision) throw new BusinessSettingsConflictError(before);
    if (before.quoteGoLiveDate === quoteGoLiveDate) { await client.query('commit'); return before; }
    await client.query(`update business_analytics_settings set quote_go_live_date = $1::date, revision = revision + 1, updated_at = now() where key = 'default'`, [quoteGoLiveDate]);
    const after = await readBusinessAnalyticsSettings(client);
    await insertAuditEventForRequest(request, {
      entityType: 'system', entityId: 'business-analytics-settings', entityLabel: 'Poslovna analitika', action: 'updated',
      summary: 'Spremenjen začetek analitike povpraševanj in ponudb',
      diff: { quoteGoLiveDate: { label: 'Začetek analitike povpraševanj in ponudb', before: before.quoteGoLiveDate, after: after.quoteGoLiveDate } },
      metadata: { revision: after.revision }
    }, client);
    await client.query('commit');
    return after;
  } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
}
