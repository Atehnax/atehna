import 'server-only';

import { revalidateTag, unstable_cache, unstable_noStore as noStore } from 'next/cache';
import type { PoolClient } from 'pg';
import {
  LANDING_PAGE_DEFAULTS_KEY,
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
const LANDING_PAGE_DEFAULTS_CACHE_TAG = 'landing-page-defaults';
const LANDING_PAGE_AUDIT_ENTITY_ID = 'landing-page';
const LANDING_PAGE_AUDIT_SOURCE = 'admin-landing-page';
const LANDING_PAGE_DEFAULTS_AUDIT_SOURCE = 'admin-landing-page-defaults';

let landingPageTableReadyPromise: Promise<void> | null = null;

export type LandingPageUpdateResult = {
  config: LandingPageConfig;
  changed: boolean;
};

export type LandingPageDefaultsUpdateResult = {
  config: LandingPageConfig;
  defaults: LandingPageConfig;
  changed: boolean;
  configChanged: boolean;
  defaultsChanged: boolean;
};

export class LandingPageDefaultsConflictError extends Error {
  constructor() {
    super('Glavna stran je bila med urejanjem spremenjena. Osvežite stran in poskusite znova.');
    this.name = 'LandingPageDefaultsConflictError';
  }
}

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

async function readLandingPageConfigByKey(key: string): Promise<LandingPageConfig> {
  const pool = await ensureLandingPageTable();
  const result = await pool.query(
    'select config_json, updated_at from landing_page_settings where key = $1 limit 1',
    [key]
  );
  const row = result.rows[0] as { config_json?: unknown; updated_at?: unknown } | undefined;

  if (!row) return cloneDefaultLandingPageConfig();

  return {
    ...normalizeLandingPageConfig(row.config_json),
    updatedAt: toIso(row.updated_at)
  };
}

async function readLandingPageConfigFromDatabase(): Promise<LandingPageConfig> {
  return readLandingPageConfigByKey(LANDING_PAGE_SETTINGS_KEY);
}

async function readLandingPageDefaultsFromDatabase(): Promise<LandingPageConfig> {
  return readLandingPageConfigByKey(LANDING_PAGE_DEFAULTS_KEY);
}

const getCachedLandingPageConfigFromDatabase = unstable_cache(
  readLandingPageConfigFromDatabase,
  ['landing-page-config'],
  { tags: [LANDING_PAGE_CACHE_TAG] }
);

const getCachedLandingPageDefaultsFromDatabase = unstable_cache(
  readLandingPageDefaultsFromDatabase,
  ['landing-page-defaults'],
  { tags: [LANDING_PAGE_DEFAULTS_CACHE_TAG] }
);

export function revalidateLandingPageConfigCache() {
  revalidateTag(LANDING_PAGE_CACHE_TAG, { expire: 0 });
}

export function revalidateLandingPageDefaultsCache() {
  revalidateTag(LANDING_PAGE_DEFAULTS_CACHE_TAG, { expire: 0 });
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

async function insertLandingPageDefaultsAuditEvent(
  client: PoolClient,
  request: Request | undefined,
  beforeConfig: LandingPageConfig,
  beforeDefaults: LandingPageConfig,
  after: LandingPageConfig
) {
  if (!request) return;

  const afterLabels = after.sectionOrder.join(', ');
  await insertAuditEventForRequest(
    request,
    {
      entityType: 'system',
      entityId: LANDING_PAGE_AUDIT_ENTITY_ID,
      entityLabel: 'Glavna stran',
      action: 'updated',
      summary: 'Privzete nastavitve glavne strani posodobljene',
      metadata: {
        area: 'landing_page',
        source: LANDING_PAGE_DEFAULTS_AUDIT_SOURCE,
        sectionCount: after.sectionOrder.length
      },
      diff: {
        page: {
          label: 'Glavna stran',
          before: beforeConfig.sectionOrder.join(', '),
          after: afterLabels,
          changed: serializeStoredLandingPageConfig(beforeConfig) !== serializeStoredLandingPageConfig(after)
        },
        defaults: {
          label: 'Privzete nastavitve',
          before: beforeDefaults.sectionOrder.join(', '),
          after: afterLabels,
          changed: serializeStoredLandingPageConfig(beforeDefaults) !== serializeStoredLandingPageConfig(after)
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

export async function getLandingPageDefaults(): Promise<LandingPageConfig> {
  try {
    return await getCachedLandingPageDefaultsFromDatabase();
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      console.error('Failed to load landing page defaults', error);
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

export async function updateLandingPageConfigAndDefaults(
  input: unknown,
  options: { request?: Request; expectedUpdatedAt?: string | null } = {}
): Promise<LandingPageDefaultsUpdateResult> {
  noStore();

  const config = toStoredLandingPageConfig(input);
  const serializedConfig = serializeStoredLandingPageConfig(config);
  const pool = await ensureLandingPageTable();
  const client = await pool.connect();

  try {
    await client.query('begin');
    const previousResult = await client.query(
      `select key, config_json, updated_at
       from landing_page_settings
       where key = any($1::text[])
       order by key
       for update`,
      [[LANDING_PAGE_SETTINGS_KEY, LANDING_PAGE_DEFAULTS_KEY]]
    );
    const previousRows = new Map((previousResult.rows as Array<{
      key: string;
      config_json?: unknown;
      updated_at?: unknown;
    }>).map((row) => [row.key, row]));
    const previousConfigRow = previousRows.get(LANDING_PAGE_SETTINGS_KEY);
    const previousDefaultsRow = previousRows.get(LANDING_PAGE_DEFAULTS_KEY);
    const previousConfig = previousConfigRow
      ? toStoredLandingPageConfig(previousConfigRow.config_json)
      : toStoredLandingPageConfig(cloneDefaultLandingPageConfig());
    const previousDefaults = previousDefaultsRow
      ? toStoredLandingPageConfig(previousDefaultsRow.config_json)
      : toStoredLandingPageConfig(cloneDefaultLandingPageConfig());
    const currentUpdatedAt = toIso(previousConfigRow?.updated_at);

    if (
      Object.prototype.hasOwnProperty.call(options, 'expectedUpdatedAt')
      && currentUpdatedAt !== (options.expectedUpdatedAt ?? null)
    ) {
      throw new LandingPageDefaultsConflictError();
    }

    const currentChanged = !previousConfigRow
      || serializeStoredLandingPageConfig(previousConfig) !== serializedConfig;
    const defaultsChanged = !previousDefaultsRow
      || serializeStoredLandingPageConfig(previousDefaults) !== serializedConfig;

    if (!currentChanged && !defaultsChanged) {
      await client.query('commit');
      return {
        config: { ...previousConfig, updatedAt: currentUpdatedAt },
        defaults: { ...previousDefaults, updatedAt: toIso(previousDefaultsRow?.updated_at) },
        changed: false,
        configChanged: false,
        defaultsChanged: false
      };
    }

    const result = await client.query(
      `insert into landing_page_settings (key, config_json, updated_at)
       values ($1, $3::jsonb, now()), ($2, $3::jsonb, now())
       on conflict (key)
       do update set config_json = excluded.config_json, updated_at = now()
       where landing_page_settings.config_json is distinct from excluded.config_json
       returning key, updated_at`,
      [LANDING_PAGE_SETTINGS_KEY, LANDING_PAGE_DEFAULTS_KEY, serializedConfig]
    );
    const updatedAtByKey = new Map((result.rows as Array<{ key: string; updated_at?: unknown }>).map((row) => [
      row.key,
      toIso(row.updated_at)
    ]));

    await insertLandingPageDefaultsAuditEvent(client, options.request, previousConfig, previousDefaults, config);
    await client.query('commit');

    return {
      config: {
        ...config,
        updatedAt: updatedAtByKey.get(LANDING_PAGE_SETTINGS_KEY) ?? currentUpdatedAt
      },
      defaults: {
        ...config,
        updatedAt: updatedAtByKey.get(LANDING_PAGE_DEFAULTS_KEY) ?? toIso(previousDefaultsRow?.updated_at)
      },
      changed: true,
      configChanged: currentChanged,
      defaultsChanged
    };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
