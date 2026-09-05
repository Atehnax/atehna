import 'server-only';

import { revalidateTag } from '@/shared/server/diagnostics/cache';
import { unstable_cache, unstable_noStore as noStore } from 'next/cache';
import type { PoolClient } from 'pg';
import {
  GLOBAL_STYLE_SETTINGS_KEY,
  cloneDefaultGlobalStyleConfig,
  normalizeGlobalStyleConfig,
  toStoredGlobalStyleConfig,
  type GlobalStyleConfig
} from '@/shared/domain/style/globalStyle';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { getPool, isDatabaseUnavailableError } from '@/shared/server/db';

const GLOBAL_STYLE_CACHE_TAG = 'global-style-config';
const GLOBAL_STYLE_AUDIT_ENTITY_ID = 'global-style';
export type GlobalStyleUpdateResult = {
  config: GlobalStyleConfig;
  changed: boolean;
};

const toIso = (value: unknown) => value instanceof Date
  ? value.toISOString()
  : typeof value === 'string'
    ? new Date(value).toISOString()
    : null;

const serialize = (config: GlobalStyleConfig) => JSON.stringify(toStoredGlobalStyleConfig(config));

async function readGlobalStyleConfigFromDatabase(): Promise<GlobalStyleConfig> {
  const pool = await getPool();
  const result = await pool.query(
    'select config_json, updated_at from global_style_settings where key = $1 limit 1',
    [GLOBAL_STYLE_SETTINGS_KEY]
  );
  const row = result.rows[0] as { config_json?: unknown; updated_at?: unknown } | undefined;
  if (!row) return cloneDefaultGlobalStyleConfig();
  return { ...normalizeGlobalStyleConfig(row.config_json), updatedAt: toIso(row.updated_at) };
}

const getCachedGlobalStyleConfigFromDatabase = unstable_cache(
  readGlobalStyleConfigFromDatabase,
  ['global-style-config'],
  { tags: [GLOBAL_STYLE_CACHE_TAG] }
);

export function revalidateGlobalStyleConfigCache() {
  revalidateTag(GLOBAL_STYLE_CACHE_TAG, { expire: 0 });
}

async function insertGlobalStyleAuditEvent(
  client: PoolClient,
  request: Request | undefined,
  before: GlobalStyleConfig,
  after: GlobalStyleConfig
) {
  if (!request) return;
  await insertAuditEventForRequest(
    request,
    {
      entityType: 'system',
      entityId: GLOBAL_STYLE_AUDIT_ENTITY_ID,
      entityLabel: 'Globalni parametri',
      action: 'updated',
      summary: 'Globalni parametri spletne strani posodobljeni',
      metadata: { area: 'global_style', source: 'admin-global-style' },
      diff: {
        style: {
          label: 'Globalni parametri',
          before: serialize(before),
          after: serialize(after),
          changed: serialize(before) !== serialize(after)
        }
      }
    },
    client
  );
}

export async function getGlobalStyleConfig(): Promise<GlobalStyleConfig> {
  try {
    return await getCachedGlobalStyleConfigFromDatabase();
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) console.error('Failed to load global style config', error);
    return cloneDefaultGlobalStyleConfig();
  }
}

export async function updateGlobalStyleConfig(
  input: unknown,
  options: { request?: Request } = {}
): Promise<GlobalStyleUpdateResult> {
  noStore();
  const config = toStoredGlobalStyleConfig(input);
  const serializedConfig = serialize(config);
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query('begin');
    const previousResult = await client.query(
      'select config_json, updated_at from global_style_settings where key = $1 for update',
      [GLOBAL_STYLE_SETTINGS_KEY]
    );
    const previousRow = previousResult.rows[0] as { config_json?: unknown; updated_at?: unknown } | undefined;
    const previousConfig = previousRow
      ? toStoredGlobalStyleConfig(previousRow.config_json)
      : toStoredGlobalStyleConfig(cloneDefaultGlobalStyleConfig());

    if (previousRow && serialize(previousConfig) === serializedConfig) {
      await client.query('commit');
      return {
        config: { ...previousConfig, updatedAt: toIso(previousRow.updated_at) },
        changed: false
      };
    }

    const result = await client.query(
      `insert into global_style_settings (key, config_json, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (key)
       do update set config_json = excluded.config_json, updated_at = now()
       returning updated_at`,
      [GLOBAL_STYLE_SETTINGS_KEY, serializedConfig]
    );
    const row = result.rows[0] as { updated_at?: unknown } | undefined;
    await insertGlobalStyleAuditEvent(client, options.request, previousConfig, config);
    await client.query('commit');
    return { config: { ...config, updatedAt: toIso(row?.updated_at) }, changed: true };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
