import 'server-only';

import { revalidateTag, unstable_cache, unstable_noStore as noStore } from 'next/cache';
import type { PoolClient } from 'pg';
import {
  PRODUCT_APPEARANCE_SETTINGS_KEY,
  cloneDefaultProductAppearanceConfig,
  normalizeProductAppearanceConfig,
  toStoredProductAppearanceConfig,
  type ProductAppearanceConfig
} from '@/shared/domain/style/productAppearance';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { getPool, isDatabaseUnavailableError } from '@/shared/server/db';

const tableSql = `
  create table if not exists product_appearance_settings (
    key text primary key,
    config_json jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
  )
`;

const PRODUCT_APPEARANCE_CACHE_TAG = 'product-appearance-config';
const PRODUCT_APPEARANCE_AUDIT_ENTITY_ID = 'product-appearance';
let productAppearanceTableReadyPromise: Promise<void> | null = null;

export type ProductAppearanceUpdateResult = {
  config: ProductAppearanceConfig;
  changed: boolean;
};

const toIso = (value: unknown) => value instanceof Date
  ? value.toISOString()
  : typeof value === 'string'
    ? new Date(value).toISOString()
    : null;

const serialize = (config: ProductAppearanceConfig) =>
  JSON.stringify(toStoredProductAppearanceConfig(config));

async function ensureProductAppearanceTable() {
  const pool = await getPool();
  productAppearanceTableReadyPromise ??= pool.query(tableSql)
    .then(() => undefined)
    .catch((error) => {
      productAppearanceTableReadyPromise = null;
      throw error;
    });
  await productAppearanceTableReadyPromise;
  return pool;
}

async function readProductAppearanceConfigFromDatabase(): Promise<ProductAppearanceConfig> {
  const pool = await ensureProductAppearanceTable();
  const result = await pool.query(
    'select config_json, updated_at from product_appearance_settings where key = $1 limit 1',
    [PRODUCT_APPEARANCE_SETTINGS_KEY]
  );
  const row = result.rows[0] as { config_json?: unknown; updated_at?: unknown } | undefined;
  if (!row) return cloneDefaultProductAppearanceConfig();
  return { ...normalizeProductAppearanceConfig(row.config_json), updatedAt: toIso(row.updated_at) };
}

const getCachedProductAppearanceConfigFromDatabase = unstable_cache(
  readProductAppearanceConfigFromDatabase,
  ['product-appearance-config-v11'],
  { tags: [PRODUCT_APPEARANCE_CACHE_TAG] }
);

export function revalidateProductAppearanceConfigCache() {
  revalidateTag(PRODUCT_APPEARANCE_CACHE_TAG, { expire: 0 });
}

async function insertProductAppearanceAuditEvent(
  client: PoolClient,
  request: Request | undefined,
  before: ProductAppearanceConfig,
  after: ProductAppearanceConfig
) {
  if (!request) return;
  await insertAuditEventForRequest(
    request,
    {
      entityType: 'system',
      entityId: PRODUCT_APPEARANCE_AUDIT_ENTITY_ID,
      entityLabel: 'Artikli',
      action: 'updated',
      summary: 'Nastavitve prikaza artiklov posodobljene',
      metadata: { area: 'product_appearance', source: 'admin-product-appearance' },
      diff: {
        appearance: {
          label: 'Prikaz artiklov',
          before: serialize(before),
          after: serialize(after),
          changed: serialize(before) !== serialize(after)
        }
      }
    },
    client
  );
}

export async function getProductAppearanceConfig(): Promise<ProductAppearanceConfig> {
  try {
    return await getCachedProductAppearanceConfigFromDatabase();
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      console.error('Failed to load product appearance config', error);
    }
    return cloneDefaultProductAppearanceConfig();
  }
}

export async function updateProductAppearanceConfig(
  input: unknown,
  options: { request?: Request } = {}
): Promise<ProductAppearanceUpdateResult> {
  noStore();
  const config = toStoredProductAppearanceConfig(input);
  const serializedConfig = serialize(config);
  const pool = await ensureProductAppearanceTable();
  const client = await pool.connect();

  try {
    await client.query('begin');
    const previousResult = await client.query(
      'select config_json, updated_at from product_appearance_settings where key = $1 for update',
      [PRODUCT_APPEARANCE_SETTINGS_KEY]
    );
    const previousRow = previousResult.rows[0] as { config_json?: unknown; updated_at?: unknown } | undefined;
    const previousConfig = previousRow
      ? toStoredProductAppearanceConfig(previousRow.config_json)
      : toStoredProductAppearanceConfig(cloneDefaultProductAppearanceConfig());

    if (previousRow && serialize(previousConfig) === serializedConfig) {
      await client.query('commit');
      return {
        config: { ...previousConfig, updatedAt: toIso(previousRow.updated_at) },
        changed: false
      };
    }

    const result = await client.query(
      `insert into product_appearance_settings (key, config_json, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (key)
       do update set config_json = excluded.config_json, updated_at = now()
       returning updated_at`,
      [PRODUCT_APPEARANCE_SETTINGS_KEY, serializedConfig]
    );
    const row = result.rows[0] as { updated_at?: unknown } | undefined;
    await insertProductAppearanceAuditEvent(client, options.request, previousConfig, config);
    await client.query('commit');
    return { config: { ...config, updatedAt: toIso(row?.updated_at) }, changed: true };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
