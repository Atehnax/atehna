import 'server-only';

import { revalidateTag } from '@/shared/server/diagnostics/cache';
import { unstable_cache, unstable_noStore as noStore } from 'next/cache';
import type { PoolClient } from 'pg';
import {
  ORDER_DOCUMENT_TEMPLATE_SETTINGS_KEY,
  cloneDefaultOrderDocumentTemplatesConfig,
  normalizeOrderDocumentTemplatesConfig,
  toStoredOrderDocumentTemplatesConfig,
  type OrderDocumentTemplate,
  type OrderDocumentTemplatesConfig,
  type OrderDocumentTemplateType
} from '@/shared/domain/order/orderDocumentTemplates';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { getPool, isDatabaseUnavailableError } from '@/shared/server/db';

const ORDER_DOCUMENT_TEMPLATES_CACHE_TAG = 'order-document-templates-config';
const ORDER_DOCUMENT_TEMPLATES_AUDIT_ENTITY_ID = 'order-document-templates';
const ORDER_DOCUMENT_TEMPLATES_CACHE_VERSION = 'v2-raw-settings-row';

export type OrderDocumentTemplatesUpdateResult = {
  config: OrderDocumentTemplatesConfig;
  changed: boolean;
};

export type OrderDocumentTemplatesConfigWithoutOffer = Omit<
  OrderDocumentTemplatesConfig,
  'templates'
> & {
  templates: Omit<OrderDocumentTemplatesConfig['templates'], 'offer'>;
};

const toIso = (value: unknown) =>
  value instanceof Date
    ? value.toISOString()
    : typeof value === 'string'
      ? new Date(value).toISOString()
      : null;

const serialize = (config: OrderDocumentTemplatesConfig) =>
  JSON.stringify(toStoredOrderDocumentTemplatesConfig(config));

type OrderDocumentTemplatesSettingsRow = {
  config_json?: unknown;
  updated_at?: unknown;
};

async function readOrderDocumentTemplatesRow(): Promise<OrderDocumentTemplatesSettingsRow | null> {
  const pool = await getPool();
  const result = await pool.query(
    'select config_json, updated_at from global_style_settings where key = $1 limit 1',
    [ORDER_DOCUMENT_TEMPLATE_SETTINGS_KEY]
  );
  return (result.rows[0] as OrderDocumentTemplatesSettingsRow | undefined) ?? null;
}

const getCachedOrderDocumentTemplates = unstable_cache(
  readOrderDocumentTemplatesRow,
  ['order-document-templates-config', ORDER_DOCUMENT_TEMPLATES_CACHE_VERSION],
  { tags: [ORDER_DOCUMENT_TEMPLATES_CACHE_TAG] }
);

export function revalidateOrderDocumentTemplatesCache() {
  revalidateTag(ORDER_DOCUMENT_TEMPLATES_CACHE_TAG, { expire: 0 });
}

export function withoutQuoteOfferTemplate(
  config: OrderDocumentTemplatesConfig
): OrderDocumentTemplatesConfigWithoutOffer {
  const { offer: _offer, ...templates } = config.templates;
  return { ...config, templates };
}

export async function getOrderDocumentTemplatesConfig(): Promise<OrderDocumentTemplatesConfig> {
  try {
    const row = await getCachedOrderDocumentTemplates();
    if (!row) return cloneDefaultOrderDocumentTemplatesConfig();
    return {
      ...normalizeOrderDocumentTemplatesConfig(row.config_json),
      updatedAt: toIso(row.updated_at)
    };
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      console.error('Failed to load order document templates', error);
    }
    return cloneDefaultOrderDocumentTemplatesConfig();
  }
}

export async function getOrderDocumentTemplate(
  type: OrderDocumentTemplateType
): Promise<OrderDocumentTemplate> {
  const config = await getOrderDocumentTemplatesConfig();
  return config.templates[type];
}

async function insertOrderDocumentTemplatesAuditEvent(
  client: PoolClient,
  request: Request | undefined,
  before: OrderDocumentTemplatesConfig,
  after: OrderDocumentTemplatesConfig
) {
  if (!request) return;
  await insertAuditEventForRequest(
    request,
    {
      entityType: 'system',
      entityId: ORDER_DOCUMENT_TEMPLATES_AUDIT_ENTITY_ID,
      entityLabel: 'Predloge PDF',
      action: 'updated',
      summary: 'Predloge PDF dokumentov posodobljene',
      metadata: {
        area: 'document_templates',
        source: 'admin-document-templates'
      },
      diff: {
        templates: {
          label: 'Predloge PDF',
          before: serialize(before),
          after: serialize(after),
          changed: serialize(before) !== serialize(after)
        }
      }
    },
    client
  );
}

export async function updateOrderDocumentTemplatesConfig(
  input: unknown,
  options: { request?: Request; preserveQuoteOfferTemplate?: boolean } = {}
): Promise<OrderDocumentTemplatesUpdateResult> {
  noStore();
  const requestedConfig = toStoredOrderDocumentTemplatesConfig(input);
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query('begin');
    const previousResult = await client.query(
      'select config_json, updated_at from global_style_settings where key = $1 for update',
      [ORDER_DOCUMENT_TEMPLATE_SETTINGS_KEY]
    );
    const previousRow = previousResult.rows[0] as
      | { config_json?: unknown; updated_at?: unknown }
      | undefined;
    const previousConfig = previousRow
      ? toStoredOrderDocumentTemplatesConfig(previousRow.config_json)
      : toStoredOrderDocumentTemplatesConfig(cloneDefaultOrderDocumentTemplatesConfig());
    const config = options.preserveQuoteOfferTemplate
      ? {
          ...requestedConfig,
          templates: {
            ...requestedConfig.templates,
            offer: previousConfig.templates.offer
          }
        }
      : requestedConfig;
    const serializedConfig = serialize(config);

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
      [ORDER_DOCUMENT_TEMPLATE_SETTINGS_KEY, serializedConfig]
    );
    const row = result.rows[0] as { updated_at?: unknown } | undefined;
    await insertOrderDocumentTemplatesAuditEvent(client, options.request, previousConfig, config);
    await client.query('commit');
    return {
      config: { ...config, updatedAt: toIso(row?.updated_at) },
      changed: true
    };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
