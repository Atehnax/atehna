import 'server-only';

import { revalidateTag, unstable_cache, unstable_noStore as noStore } from 'next/cache';
import type { PoolClient } from 'pg';
import {
  LANDING_PAGE_SETTINGS_KEY,
  cloneDefaultLandingPageConfig,
  normalizeLandingPageConfig,
  toStoredLandingPageConfig,
  type LandingPageConfig
} from '@/shared/domain/landing/landingPage';
import { getPool, isDatabaseUnavailableError } from '@/shared/server/db';
import { insertAuditEventForRequest } from '@/shared/server/audit';

const tableSql = `
  create table if not exists landing_page_settings (
    key text primary key,
    config_json jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
  )
`;

const LANDING_PAGE_CACHE_TAG = 'landing-page-config';
const LANDING_PAGE_AUDIT_ENTITY_ID = 'landing-page';
const LANDING_PAGE_AUDIT_SOURCE = 'admin-landing-page';

let landingPageTableReadyPromise: Promise<void> | null = null;

export type LandingPageUpdateResult = {
  config: LandingPageConfig;
  changed: boolean;
};

function toIso(value: unknown) {
  return value instanceof Date ? value.toISOString() : typeof value === 'string' ? new Date(value).toISOString() : null;
}

function serializeStoredLandingPageConfig(config: LandingPageConfig) {
  return JSON.stringify({
    sectionOrder: config.sectionOrder,
    sectionTitles: config.sectionTitles,
    hero: config.hero,
    categories: config.categories,
    infoBlocks: config.infoBlocks,
    footer: config.footer,
    page: config.page,
    canvas: config.canvas
  });
}

async function ensureLandingPageTable() {
  const pool = await getPool();

  landingPageTableReadyPromise ??= pool.query(tableSql)
    .then(() => undefined)
    .catch((error) => {
      landingPageTableReadyPromise = null;
      throw error;
    });

  await landingPageTableReadyPromise;
  return pool;
}

async function readLandingPageConfigFromDatabase(): Promise<LandingPageConfig> {
  const pool = await ensureLandingPageTable();
  const result = await pool.query(
    'select config_json, updated_at from landing_page_settings where key = $1 limit 1',
    [LANDING_PAGE_SETTINGS_KEY]
  );
  const row = result.rows[0] as { config_json?: unknown; updated_at?: unknown } | undefined;

  if (!row) return cloneDefaultLandingPageConfig();

  return {
    ...normalizeLandingPageConfig(row.config_json),
    updatedAt: toIso(row.updated_at)
  };
}

const getCachedLandingPageConfigFromDatabase = unstable_cache(
  readLandingPageConfigFromDatabase,
  ['landing-page-config'],
  { tags: [LANDING_PAGE_CACHE_TAG] }
);

export function revalidateLandingPageConfigCache() {
  revalidateTag(LANDING_PAGE_CACHE_TAG, { expire: 0 });
}

async function insertLandingPageAuditEvent(
  client: PoolClient,
  request: Request | undefined,
  before: LandingPageConfig,
  after: LandingPageConfig
) {
  if (!request) return;

  const beforeLabels = before.sectionOrder.join(', ');
  const afterLabels = after.sectionOrder.join(', ');

  await insertAuditEventForRequest(
    request,
    {
      entityType: 'system',
      entityId: LANDING_PAGE_AUDIT_ENTITY_ID,
      entityLabel: 'Glavna stran',
      action: 'updated',
      summary: 'Glavna stran posodobljena',
      metadata: {
        area: 'landing_page',
        source: LANDING_PAGE_AUDIT_SOURCE,
        sectionCount: after.sectionOrder.length
      },
      diff: {
        sections: {
          label: 'Sekcije',
          before: beforeLabels,
          after: afterLabels,
          changed: serializeStoredLandingPageConfig(before) !== serializeStoredLandingPageConfig(after)
        }
      }
    },
    client
  );
}

export async function getLandingPageConfig(): Promise<LandingPageConfig> {
  try {
    return await getCachedLandingPageConfigFromDatabase();
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      console.error('Failed to load landing page config', error);
    }
    return cloneDefaultLandingPageConfig();
  }
}

export async function updateLandingPageConfig(input: unknown, options: { request?: Request } = {}): Promise<LandingPageUpdateResult> {
  noStore();

  const config = toStoredLandingPageConfig(input);
  const serializedConfig = serializeStoredLandingPageConfig(config);
  const pool = await ensureLandingPageTable();
  const client = await pool.connect();

  try {
    await client.query('begin');
    const previousResult = await client.query(
      'select config_json, updated_at from landing_page_settings where key = $1 for update',
      [LANDING_PAGE_SETTINGS_KEY]
    );
    const previousRow = previousResult.rows[0] as { config_json?: unknown; updated_at?: unknown } | undefined;
    const previousConfig = previousRow
      ? toStoredLandingPageConfig(previousRow.config_json)
      : toStoredLandingPageConfig(cloneDefaultLandingPageConfig());

    if (previousRow && serializeStoredLandingPageConfig(previousConfig) === serializedConfig) {
      await client.query('commit');

      return {
        config: {
          ...previousConfig,
          updatedAt: toIso(previousRow.updated_at)
        },
        changed: false
      };
    }

    const result = await client.query(
      `insert into landing_page_settings (key, config_json, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (key)
       do update set config_json = excluded.config_json, updated_at = now()
       returning updated_at`,
      [LANDING_PAGE_SETTINGS_KEY, serializedConfig]
    );
    const row = result.rows[0] as { updated_at?: unknown } | undefined;

    await insertLandingPageAuditEvent(client, options.request, previousConfig, config);
    await client.query('commit');

    return {
      config: {
        ...config,
        updatedAt: toIso(row?.updated_at)
      },
      changed: true
    };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
