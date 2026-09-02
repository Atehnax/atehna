import 'server-only';

import type { Pool } from 'pg';
import {
  cloneDefaultInventoryPolicySettings,
  INVENTORY_POLICY_SETTINGS_KEY,
  normalizeInventoryPolicySettings,
  toStoredInventoryPolicySettings,
  validateInventoryPolicySettingsInput,
  type InventoryPolicySettings
} from '@/shared/domain/inventory/inventoryPolicy';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { getPool } from '@/shared/server/db';

export type InventoryPolicyQueryable = Pick<Pool, 'query'>;

export type InventoryPolicyUpdateResult = {
  config: InventoryPolicySettings;
  changed: boolean;
};

export class InventoryPolicySchemaNotReadyError extends Error {}

export class InventoryPolicyValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors[0] ?? 'Nastavitev zaloge ni veljavna.');
  }
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'string' || value.length === 0) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

async function hasInventoryPolicySchema(
  queryable: InventoryPolicyQueryable
): Promise<boolean> {
  const result = await queryable.query(
    `select to_regclass('public.inventory_policy_settings') is not null as ready`
  );
  return result.rows[0]?.ready === true;
}

/**
 * Reads the authoritative global stock policy. The optional queryable lets
 * order/quote transactions read the setting through their already-open client.
 * Before the additive schema is installed, current stock enforcement remains on.
 */
export async function getInventoryPolicySettings(
  queryable?: InventoryPolicyQueryable
): Promise<InventoryPolicySettings> {
  const target = queryable ?? await getPool();
  if (!await hasInventoryPolicySchema(target)) {
    return cloneDefaultInventoryPolicySettings();
  }

  const result = await target.query(
    `select config_json, updated_at
       from inventory_policy_settings
      where key = $1
      limit 1`,
    [INVENTORY_POLICY_SETTINGS_KEY]
  );
  const row = result.rows[0] as
    | { config_json?: unknown; updated_at?: unknown }
    | undefined;
  if (!row) return cloneDefaultInventoryPolicySettings();
  return {
    ...normalizeInventoryPolicySettings(row.config_json),
    updatedAt: toIso(row.updated_at)
  };
}

export async function isStockEnforcementEnabled(
  queryable?: InventoryPolicyQueryable
): Promise<boolean> {
  return (await getInventoryPolicySettings(queryable)).stockEnforcementEnabled;
}

export async function updateInventoryPolicySettings(
  value: unknown,
  options: { request?: Request } = {}
): Promise<InventoryPolicyUpdateResult> {
  const errors = validateInventoryPolicySettingsInput(value);
  if (errors.length > 0) throw new InventoryPolicyValidationError(errors);

  const config = toStoredInventoryPolicySettings(value);
  const serialized = JSON.stringify(config);
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query('begin');
    if (!await hasInventoryPolicySchema(client)) {
      throw new InventoryPolicySchemaNotReadyError(
        'Podatkovna shema nastavitev zaloge ni nameščena.'
      );
    }

    const previousResult = await client.query(
      `select config_json, updated_at
         from inventory_policy_settings
        where key = $1
        for update`,
      [INVENTORY_POLICY_SETTINGS_KEY]
    );
    const previousRow = previousResult.rows[0] as
      | { config_json?: unknown; updated_at?: unknown }
      | undefined;
    const previous = previousRow
      ? toStoredInventoryPolicySettings(previousRow.config_json)
      : toStoredInventoryPolicySettings(cloneDefaultInventoryPolicySettings());

    if (previousRow && JSON.stringify(previous) === serialized) {
      await client.query('commit');
      return {
        config: {
          ...previous,
          updatedAt: toIso(previousRow.updated_at)
        },
        changed: false
      };
    }

    const result = await client.query(
      `insert into inventory_policy_settings (key, config_json, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (key)
       do update set config_json = excluded.config_json, updated_at = now()
       returning updated_at`,
      [INVENTORY_POLICY_SETTINGS_KEY, serialized]
    );

    if (options.request) {
      await insertAuditEventForRequest(
        options.request,
        {
          entityType: 'system',
          entityId: 'inventory-policy',
          entityLabel: 'Zaloga',
          action: 'updated',
          summary: config.stockEnforcementEnabled
            ? 'Omejevanje naročanja glede na zalogo je omogočeno'
            : 'Omejevanje naročanja glede na zalogo je onemogočeno',
          diff: {
            stock_enforcement_enabled: {
              label: 'Omejevanje glede na zalogo',
              before: previous.stockEnforcementEnabled
                ? 'Omogočeno'
                : 'Onemogočeno',
              after: config.stockEnforcementEnabled
                ? 'Omogočeno'
                : 'Onemogočeno',
              changed:
                previous.stockEnforcementEnabled !==
                config.stockEnforcementEnabled
            }
          },
          metadata: {
            area: 'inventory_policy',
            stock_enforcement_enabled: config.stockEnforcementEnabled
          }
        },
        client
      );
    }

    await client.query('commit');
    return {
      config: {
        ...config,
        updatedAt: toIso(result.rows[0]?.updated_at)
      },
      changed: true
    };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
