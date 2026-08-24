import 'server-only';

import { revalidateTag, unstable_cache, unstable_noStore as noStore } from 'next/cache';
import type { PoolClient } from 'pg';
import {
  SITE_LOGO_SETTINGS_KEY,
  cloneDefaultSiteLogoConfig,
  normalizeSiteLogoConfig,
  toStoredSiteLogoConfig,
  type SiteLogoConfig
} from '@/shared/domain/logo/siteLogo';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { getPool, isDatabaseUnavailableError } from '@/shared/server/db';

const SITE_LOGO_CACHE_TAG = 'site-logo-config';
const SITE_LOGO_AUDIT_ENTITY_ID = 'site-logo';
export type SiteLogoUpdateResult = {
  config: SiteLogoConfig;
  changed: boolean;
};

const toIso = (value: unknown) => value instanceof Date
  ? value.toISOString()
  : typeof value === 'string'
    ? new Date(value).toISOString()
    : null;

const serialize = (config: SiteLogoConfig) => JSON.stringify(toStoredSiteLogoConfig(config));

async function readSiteLogoConfigFromDatabase(): Promise<SiteLogoConfig> {
  const pool = await getPool();
  const result = await pool.query(
    'select config_json, updated_at from site_logo_settings where key = $1 limit 1',
    [SITE_LOGO_SETTINGS_KEY]
  );
  const row = result.rows[0] as { config_json?: unknown; updated_at?: unknown } | undefined;
  if (!row) return cloneDefaultSiteLogoConfig();
  return { ...normalizeSiteLogoConfig(row.config_json), updatedAt: toIso(row.updated_at) };
}

const getCachedSiteLogoConfigFromDatabase = unstable_cache(
  readSiteLogoConfigFromDatabase,
  ['site-logo-config'],
  { tags: [SITE_LOGO_CACHE_TAG] }
);

export function revalidateSiteLogoConfigCache() {
  revalidateTag(SITE_LOGO_CACHE_TAG, { expire: 0 });
}

async function insertSiteLogoAuditEvent(
  client: PoolClient,
  request: Request | undefined,
  before: SiteLogoConfig,
  after: SiteLogoConfig
) {
  if (!request) return;
  const beforeSerialized = serialize(before);
  const afterSerialized = serialize(after);
  await insertAuditEventForRequest(
    request,
    {
      entityType: 'system',
      entityId: SITE_LOGO_AUDIT_ENTITY_ID,
      entityLabel: 'Logotip',
      action: 'updated',
      summary: 'Nastavitve logotipa posodobljene',
      metadata: {
        area: 'site_logo',
        source: 'admin-site-logo',
        masterCount: after.masters.length
      },
      diff: {
        logo: {
          label: 'Logotip',
          before: beforeSerialized,
          after: afterSerialized,
          changed: beforeSerialized !== afterSerialized
        }
      }
    },
    client
  );
}

export async function getSiteLogoConfig(): Promise<SiteLogoConfig> {
  try {
    return await getCachedSiteLogoConfigFromDatabase();
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) console.error('Failed to load site logo config', error);
    return cloneDefaultSiteLogoConfig();
  }
}

export async function updateSiteLogoConfig(
  input: unknown,
  options: { request?: Request } = {}
): Promise<SiteLogoUpdateResult> {
  noStore();
  const config = toStoredSiteLogoConfig(input);
  const serializedConfig = serialize(config);
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query('begin');
    const previousResult = await client.query(
      'select config_json, updated_at from site_logo_settings where key = $1 for update',
      [SITE_LOGO_SETTINGS_KEY]
    );
    const previousRow = previousResult.rows[0] as { config_json?: unknown; updated_at?: unknown } | undefined;
    const previousConfig = previousRow
      ? toStoredSiteLogoConfig(previousRow.config_json)
      : toStoredSiteLogoConfig(cloneDefaultSiteLogoConfig());

    if (previousRow && serialize(previousConfig) === serializedConfig) {
      await client.query('commit');
      return {
        config: { ...previousConfig, updatedAt: toIso(previousRow.updated_at) },
        changed: false
      };
    }

    const result = await client.query(
      `insert into site_logo_settings (key, config_json, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (key)
       do update set config_json = excluded.config_json, updated_at = now()
       returning updated_at`,
      [SITE_LOGO_SETTINGS_KEY, serializedConfig]
    );
    const row = result.rows[0] as { updated_at?: unknown } | undefined;
    await insertSiteLogoAuditEvent(client, options.request, previousConfig, config);
    await client.query('commit');
    return { config: { ...config, updatedAt: toIso(row?.updated_at) }, changed: true };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
