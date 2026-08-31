import 'server-only';

import { unstable_noStore as noStore } from 'next/cache';
import type { PoolClient, QueryResult } from 'pg';
import {
  normalizeShippingConfiguration,
  parseShippingConfiguration,
  validateShippingConfiguration,
  type ShippingConfiguration
} from '@/shared/domain/shipping/shipping';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { getPool } from '@/shared/server/db';

const SHIPPING_SETTINGS_KEY = 'default';

type Queryable = {
  query: (
    sql: string,
    params?: unknown[]
  ) => Promise<QueryResult<Record<string, unknown>>>;
};

export type ShippingAdminState = {
  configuration: ShippingConfiguration;
  revision: number;
  updatedAt: string | null;
};

export type ShippingConfigurationUpdateResult = ShippingAdminState & {
  changed: boolean;
};

export class ShippingConfigurationValidationError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(errors[0] ?? 'Nastavitve poštnine niso veljavne.');
    this.name = 'ShippingConfigurationValidationError';
    this.errors = errors;
  }
}

export class ShippingConfigurationConflictError extends Error {
  readonly currentConfiguration: ShippingConfiguration;

  constructor(currentConfiguration: ShippingConfiguration) {
    super('Nastavitve poštnine so bile med urejanjem spremenjene.');
    this.name = 'ShippingConfigurationConflictError';
    this.currentConfiguration = currentConfiguration;
  }
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function serialize(configuration: ShippingConfiguration): string {
  return JSON.stringify(normalizeShippingConfiguration(configuration));
}

function serializeCalculationConfiguration(configuration: ShippingConfiguration): string {
  const { draftRules: _draftRules, ...calculationConfiguration } =
    normalizeShippingConfiguration(configuration);
  return JSON.stringify(calculationConfiguration);
}

function revisionFromRow(row: Record<string, unknown> | undefined): number {
  const revision = Number(row?.revision);
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new ShippingConfigurationValidationError([
      'Administrativna revizija cenika poštnine ni veljavna.'
    ]);
  }
  return revision;
}

function configurationFromRow(row: Record<string, unknown> | undefined): ShippingConfiguration {
  if (!row) {
    throw new ShippingConfigurationValidationError([
      'Cenik poštnine ni shranjen. Naročila ni varno izračunati.'
    ]);
  }
  const parsed = parseShippingConfiguration(row.config_json);
  const rowVersion = Number(row.version);
  if (!Number.isSafeInteger(rowVersion) || rowVersion < 1 || parsed.version !== rowVersion) {
    throw new ShippingConfigurationValidationError([
      'Različica shranjenega cenika poštnine ni veljavna.'
    ]);
  }
  return parsed;
}

export async function getShippingAdminState(
  database?: Queryable,
  options: { lockForTransaction?: boolean } = {}
): Promise<ShippingAdminState> {
  noStore();
  const target = database ?? (await getPool());
  const result = await target.query(
    `select version, revision, config_json, updated_at
     from shipping_settings
     where key = $1
     limit 1
     ${options.lockForTransaction ? 'for share' : ''}`,
    [SHIPPING_SETTINGS_KEY]
  );
  const row = result.rows[0];
  return {
    configuration: configurationFromRow(row),
    revision: revisionFromRow(row),
    updatedAt: toIso(row?.updated_at)
  };
}

export async function getShippingConfiguration(
  database?: Queryable,
  options: { lockForTransaction?: boolean } = {}
): Promise<ShippingConfiguration> {
  return (await getShippingAdminState(database, options)).configuration;
}

async function insertShippingConfigurationAudit(
  client: PoolClient,
  request: Request | undefined,
  before: ShippingConfiguration,
  after: ShippingConfiguration,
  revision: number,
  calculationChanged: boolean
) {
  if (!request) return;
  await insertAuditEventForRequest(
    request,
    {
      entityType: 'system',
      entityId: 'shipping-configuration',
      entityLabel: 'Poštnina',
      action: 'updated',
      summary: calculationChanged
        ? `Cenik poštnine posodobljen na izračunsko različico ${after.version}`
        : `Osnutki poštnine posodobljeni v administrativni reviziji ${revision}`,
      metadata: {
        area: 'shipping',
        configurationVersion: after.version,
        adminRevision: revision,
        calculationChanged
      },
      diff: {
        configuration: {
          label: 'Pravila poštnine',
          before: serialize(before),
          after: serialize(after),
          changed: serialize(before) !== serialize(after)
        }
      }
    },
    client
  );
}

export async function updateShippingConfiguration(
  input: ShippingConfiguration,
  expectedVersion: number,
  options: { request?: Request; expectedRevision?: number } = {}
): Promise<ShippingConfigurationUpdateResult> {
  noStore();
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
    throw new ShippingConfigurationValidationError([
      'Pričakovana različica cenika ni veljavna.'
    ]);
  }
  if (!Number.isSafeInteger(options.expectedRevision) || (options.expectedRevision ?? 0) < 1) {
    throw new ShippingConfigurationValidationError([
      'Pričakovana administrativna revizija cenika ni veljavna.'
    ]);
  }

  let normalizedInput: ShippingConfiguration;
  try {
    if (
      !input ||
      typeof input !== 'object' ||
      !Array.isArray(input.weightBands) ||
      !Array.isArray(input.dimensionalRules) ||
      !Array.isArray(input.draftRules) ||
      (
        input.orderValueDiscountRules !== undefined
        && !Array.isArray(input.orderValueDiscountRules)
      ) ||
      (
        input.multiPieceDiscountRules !== undefined
        && !Array.isArray(input.multiPieceDiscountRules)
      )
    ) {
      throw new Error('invalid shape');
    }
    normalizedInput = normalizeShippingConfiguration({
      ...input,
      version: expectedVersion
    });
  } catch {
    throw new ShippingConfigurationValidationError([
      'Konfiguracija poštnine nima veljavne strukture.'
    ]);
  }
  const inputIssues = validateShippingConfiguration(normalizedInput);
  if (inputIssues.length > 0) {
    throw new ShippingConfigurationValidationError(
      inputIssues.map((issue) => issue.message)
    );
  }

  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    const currentResult = await client.query(
      `select version, revision, config_json, updated_at
       from shipping_settings
       where key = $1
       for update`,
      [SHIPPING_SETTINGS_KEY]
    );
    const currentRow = currentResult.rows[0] as Record<string, unknown> | undefined;
    const currentConfiguration = configurationFromRow(currentRow);
    const currentRevision = revisionFromRow(currentRow);
    if (
      currentConfiguration.version !== expectedVersion
      || currentRevision !== options.expectedRevision
    ) {
      throw new ShippingConfigurationConflictError(currentConfiguration);
    }

    const comparableInput = { ...normalizedInput, version: currentConfiguration.version };
    if (serialize(comparableInput) === serialize(currentConfiguration)) {
      await client.query('commit');
      return {
        configuration: currentConfiguration,
        revision: currentRevision,
        updatedAt: toIso(currentRow?.updated_at),
        changed: false
      };
    }

    const calculationChanged =
      serializeCalculationConfiguration(comparableInput)
      !== serializeCalculationConfiguration(currentConfiguration);
    const nextConfiguration = normalizeShippingConfiguration({
      ...normalizedInput,
      version: currentConfiguration.version + (calculationChanged ? 1 : 0)
    });
    const nextRevision = currentRevision + 1;
    const result = await client.query(
      `insert into shipping_settings (key, version, revision, config_json, updated_at)
       values ($1, $2, $3, $4::jsonb, now())
       on conflict (key)
       do update set
         version = excluded.version,
         revision = excluded.revision,
         config_json = excluded.config_json,
         updated_at = now()
       returning updated_at`,
      [
        SHIPPING_SETTINGS_KEY,
        nextConfiguration.version,
        nextRevision,
        serialize(nextConfiguration)
      ]
    );
    await insertShippingConfigurationAudit(
      client,
      options.request,
      currentConfiguration,
      nextConfiguration,
      nextRevision,
      calculationChanged
    );
    await client.query('commit');
    return {
      configuration: nextConfiguration,
      revision: nextRevision,
      updatedAt: toIso(result.rows[0]?.updated_at),
      changed: true
    };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
