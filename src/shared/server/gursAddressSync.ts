import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import {
  normalizeGursAddressRow,
  type GursAddress
} from '@/shared/domain/address/gursAddress';
import { getPool } from '@/shared/server/db';

const GURS_WFS_URL = 'https://ipi.eprostor.gov.si/wfs-si-gurs-rn/wfs';
const GURS_COLLECTION = 'SI.GURS.RN:REGISTER_NASLOVOV';
const GURS_PROPERTIES = [
  'EID_HISNA_STEVILKA',
  'ULICA_NAZIV',
  'NASELJE_NAZIV',
  'HS_STEVILKA',
  'HS_DODATEK',
  'POSTNI_OKOLIS_SIFRA',
  'POSTNI_OKOLIS_NAZIV',
  'OBCINA_NAZIV',
  'DATUM_SYS'
] as const;

const DEFAULT_PAGE_SIZE = 20_000;
const DEFAULT_INSERT_BATCH_SIZE = 2_000;
const DEFAULT_MIN_RECORD_COUNT = 400_000;
const DEFAULT_MAX_RECORD_COUNT = 800_000;
const DEFAULT_LEASE_DURATION_MS = 20 * 60 * 1_000;
const FETCH_TIMEOUT_MS = 45_000;
const MAX_FETCH_ATTEMPTS = 3;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

class PermanentDownloadError extends Error {}

export type GursAddressStageStats = {
  recordCount: number;
  uniqueIdCount: number;
  missingRequiredCount: number;
  sourceUpdatedAt: string | null;
};

export type GursAddressSyncSummary = {
  status: 'succeeded' | 'skipped';
  recordCount: number;
  sourceUpdatedAt: string | null;
  importedAt: string | null;
  expectedRecordCount: number | null;
};

export type GursAddressSyncLease =
  | { acquired: false }
  | { acquired: true; runId: string };

export interface GursAddressSyncStore {
  acquireLease(args: {
    token: string;
    now: Date;
    expiresAt: Date;
  }): Promise<GursAddressSyncLease>;
  prepareStage(args: { stageName: string; token: string }): Promise<void>;
  insertBatch(args: {
    stageName: string;
    addresses: GursAddress[];
    importedAt: string;
  }): Promise<void>;
  refreshLease(args: { token: string; expiresAt: Date }): Promise<void>;
  inspectStage(stageName: string): Promise<GursAddressStageStats>;
  indexStage(stageName: string): Promise<void>;
  publishStage(args: {
    stageName: string;
    token: string;
    runId: string;
    stats: GursAddressStageStats;
    importedAt: string;
  }): Promise<void>;
  discardStage(stageName: string): Promise<void>;
  failSync(args: {
    token: string;
    runId: string;
    message: string;
  }): Promise<void>;
}

type SyncLogger = Pick<Console, 'info' | 'warn' | 'error'>;

export type SyncGursAddressesOptions = {
  store?: GursAddressSyncStore;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  logger?: SyncLogger;
  pageSize?: number;
  insertBatchSize?: number;
  minRecordCount?: number;
  maxRecordCount?: number;
  leaseDurationMs?: number;
};

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function identifier(value: string): string {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) {
    throw new Error(`Unsafe generated PostgreSQL identifier: ${value}`);
  }
  return `"${value}"`;
}

function generatedTableName(kind: 'stage' | 'retired', token: string) {
  const suffix = token.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 20);
  return `gurs_addresses_${kind}_${suffix}`;
}

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, ' ').trim().slice(0, 2_000) || 'Unknown error';
}

function parseCsvRows(csv: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"') {
        if (csv[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  const header = rows.shift()?.map((value, index) =>
    index === 0 ? value.replace(/^\uFEFF/, '').trim() : value.trim()
  );
  if (!header || !header.includes('EID_HISNA_STEVILKA')) {
    throw new Error('GURS WFS did not return the expected CSV schema.');
  }

  return rows.flatMap((values) => {
    if (values.every((value) => value === '')) return [];
    const record: Record<string, string> = {};
    header.forEach((key, index) => {
      if (key && key !== 'FID') record[key] = values[index] ?? '';
    });
    return [record];
  });
}

function buildWfsUrl(args: {
  pageSize?: number;
  afterId?: string | null;
  hits?: boolean;
}) {
  const url = new URL(GURS_WFS_URL);
  url.searchParams.set('service', 'WFS');
  url.searchParams.set('version', '2.0.0');
  url.searchParams.set('request', 'GetFeature');
  url.searchParams.set('typeNames', GURS_COLLECTION);
  const escapedAfterId = args.afterId?.replaceAll("'", "''");
  url.searchParams.set(
    'cql_filter',
    `ST_STANOVANJA IS NULL${
      escapedAfterId
        ? ` AND EID_HISNA_STEVILKA > '${escapedAfterId}'`
        : ''
    }`
  );

  if (args.hits) {
    url.searchParams.set('resultType', 'hits');
  } else {
    url.searchParams.set('count', String(args.pageSize ?? DEFAULT_PAGE_SIZE));
    url.searchParams.set('sortBy', 'EID_HISNA_STEVILKA');
    url.searchParams.set('propertyName', GURS_PROPERTIES.join(','));
    url.searchParams.set('outputFormat', 'csv');
  }
  return url;
}

async function fetchTextWithRetry(args: {
  url: URL;
  fetchImpl: typeof fetch;
  sleepImpl: (milliseconds: number) => Promise<void>;
}) {
  let latestError: unknown;
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await args.fetchImpl(args.url, {
        headers: {
          Accept: 'text/csv, application/xml;q=0.8, text/xml;q=0.8',
          'User-Agent': 'Atehna-GURS-address-sync/1.0'
        },
        signal: controller.signal
      });
      const body = await response.text();
      if (!response.ok) {
        const error = new Error(
          `GURS WFS returned HTTP ${response.status}: ${body.slice(0, 300)}`
        );
        if (!RETRYABLE_STATUS_CODES.has(response.status)) {
          throw new PermanentDownloadError(error.message);
        }
        latestError = error;
      } else {
        return body;
      }
    } catch (error) {
      if (error instanceof PermanentDownloadError) throw error;
      latestError = error;
      if (attempt === MAX_FETCH_ATTEMPTS) throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < MAX_FETCH_ATTEMPTS) {
      await args.sleepImpl(500 * 2 ** (attempt - 1));
    }
  }
  throw latestError instanceof Error
    ? latestError
    : new Error('GURS WFS download failed.');
}

async function fetchExpectedRecordCount(
  fetchImpl: typeof fetch,
  sleepImpl: (milliseconds: number) => Promise<void>
): Promise<number | null> {
  try {
    const xml = await fetchTextWithRetry({
      url: buildWfsUrl({ hits: true }),
      fetchImpl,
      sleepImpl
    });
    const matched = xml.match(/\bnumberMatched=["'](\d+)["']/i)?.[1];
    return matched ? Number.parseInt(matched, 10) : null;
  } catch {
    return null;
  }
}

class PostgresGursAddressSyncStore implements GursAddressSyncStore {
  constructor(
    private readonly pool: Pool,
    private readonly leaseDurationMs: number
  ) {}

  async acquireLease(args: {
    token: string;
    now: Date;
    expiresAt: Date;
  }): Promise<GursAddressSyncLease> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `insert into gurs_address_sync_state (key)
         values ('active')
         on conflict (key) do nothing`
      );
      const acquired = await client.query(
        `update gurs_address_sync_state
         set lock_token = $1,
             lock_expires_at = $2,
             last_attempt_at = $3,
             last_error = null
         where key = 'active'
           and (lock_token is null or lock_expires_at is null or lock_expires_at <= $3)
         returning key`,
        [args.token, args.expiresAt.toISOString(), args.now.toISOString()]
      );
      if (acquired.rowCount !== 1) {
        await client.query('rollback');
        return { acquired: false };
      }
      const run = await client.query<{ id: string }>(
        `insert into gurs_address_sync_runs (status, started_at)
         values ('running', $1)
         returning id::text as id`,
        [args.now.toISOString()]
      );
      await client.query('commit');
      return { acquired: true, runId: run.rows[0].id };
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async prepareStage(args: { stageName: string; token: string }) {
    const staleTables = await this.pool.query<{ tablename: string }>(
      `select tablename
       from pg_tables
       where schemaname = current_schema()
         and (tablename like 'gurs_addresses_stage_%'
              or tablename like 'gurs_addresses_retired_%')`
    );
    for (const { tablename } of staleTables.rows) {
      await this.pool.query(`drop table if exists ${identifier(tablename)}`);
    }
    await this.pool.query(
      `create table ${identifier(args.stageName)}
       (like gurs_addresses including defaults including constraints)`
    );
    await this.refreshLease({
      token: args.token,
      expiresAt: new Date(Date.now() + this.leaseDurationMs)
    });
  }

  async insertBatch(args: {
    stageName: string;
    addresses: GursAddress[];
    importedAt: string;
  }) {
    if (args.addresses.length === 0) return;
    const rows = args.addresses.map((address) => ({
      gurs_house_number_id: address.gursHouseNumberId,
      street_name: address.streetName,
      settlement_name: address.settlementName,
      house_number: address.houseNumber,
      house_suffix: address.houseSuffix,
      postal_code: address.postalCode,
      postal_name: address.postalName,
      municipality_name: address.municipalityName,
      address_line_1: address.addressLine1,
      search_text: address.searchText,
      source_updated_at: address.sourceUpdatedAt,
      imported_at: args.importedAt
    }));
    await this.pool.query(
      `insert into ${identifier(args.stageName)} (
         gurs_house_number_id, street_name, settlement_name, house_number,
         house_suffix, postal_code, postal_name, municipality_name,
         address_line_1, search_text, source_updated_at, imported_at
       )
       select *
       from jsonb_to_recordset($1::jsonb) as row_data(
         gurs_house_number_id text,
         street_name text,
         settlement_name text,
         house_number text,
         house_suffix text,
         postal_code text,
         postal_name text,
         municipality_name text,
         address_line_1 text,
         search_text text,
         source_updated_at timestamptz,
         imported_at timestamptz
       )`,
      [JSON.stringify(rows)]
    );
  }

  async refreshLease(args: { token: string; expiresAt: Date }) {
    const result = await this.pool.query(
      `update gurs_address_sync_state
       set lock_expires_at = $2
       where key = 'active' and lock_token = $1`,
      [args.token, args.expiresAt.toISOString()]
    );
    if (result.rowCount !== 1) {
      throw new Error('The GURS address synchronisation lease was lost.');
    }
  }

  async inspectStage(stageName: string): Promise<GursAddressStageStats> {
    const result = await this.pool.query<{
      record_count: string;
      unique_id_count: string;
      missing_required_count: string;
      source_updated_at: Date | string | null;
    }>(
      `select
         count(*)::text as record_count,
         count(distinct gurs_house_number_id)::text as unique_id_count,
         count(*) filter (where
           nullif(btrim(gurs_house_number_id), '') is null or
           nullif(btrim(settlement_name), '') is null or
           nullif(btrim(house_number), '') is null or
           nullif(btrim(postal_code), '') is null or
           nullif(btrim(postal_name), '') is null or
           nullif(btrim(address_line_1), '') is null or
           nullif(btrim(search_text), '') is null
         )::text as missing_required_count,
         max(source_updated_at) as source_updated_at
       from ${identifier(stageName)}`
    );
    const row = result.rows[0];
    const sourceDate =
      row.source_updated_at instanceof Date
        ? row.source_updated_at
        : row.source_updated_at
          ? new Date(row.source_updated_at)
          : null;
    return {
      recordCount: Number.parseInt(row.record_count, 10),
      uniqueIdCount: Number.parseInt(row.unique_id_count, 10),
      missingRequiredCount: Number.parseInt(row.missing_required_count, 10),
      sourceUpdatedAt:
        sourceDate && !Number.isNaN(sourceDate.getTime())
          ? sourceDate.toISOString()
          : null
    };
  }

  async indexStage(stageName: string) {
    const idIndex = `${stageName}_id_uidx`;
    const searchIndex = `${stageName}_search_trgm_idx`;
    await this.pool.query(
      `create unique index ${identifier(idIndex)}
       on ${identifier(stageName)} (gurs_house_number_id)`
    );
    await this.pool.query(
      `create index ${identifier(searchIndex)}
       on ${identifier(stageName)} using gin (search_text gin_trgm_ops)`
    );
    await this.pool.query(`analyze ${identifier(stageName)}`);
  }

  async publishStage(args: {
    stageName: string;
    token: string;
    runId: string;
    stats: GursAddressStageStats;
    importedAt: string;
  }) {
    const retiredName = generatedTableName('retired', args.token);
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `select pg_advisory_xact_lock(hashtext('gurs-address-sync-publish'))`
      );
      const lease = await client.query(
        `select lock_token
         from gurs_address_sync_state
         where key = 'active'
         for update`
      );
      if (lease.rows[0]?.lock_token !== args.token) {
        throw new Error('The GURS address synchronisation lease was lost before publish.');
      }
      await client.query(
        `alter table gurs_addresses rename to ${identifier(retiredName)}`
      );
      await client.query(
        `alter table ${identifier(args.stageName)} rename to gurs_addresses`
      );
      await client.query(
        `update gurs_address_sync_state
         set active_source_updated_at = $1,
             active_imported_at = $2,
             active_record_count = $3,
             last_success_at = now(),
             last_failure_at = null,
             last_error = null,
             lock_token = null,
             lock_expires_at = null
         where key = 'active' and lock_token = $4`,
        [
          args.stats.sourceUpdatedAt,
          args.importedAt,
          args.stats.recordCount,
          args.token
        ]
      );
      await client.query(
        `update gurs_address_sync_runs
         set status = 'succeeded',
             record_count = $2,
             source_updated_at = $3,
             finished_at = now(),
             error_message = null
         where id = $1`,
        [args.runId, args.stats.recordCount, args.stats.sourceUpdatedAt]
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    await this.pool
      .query(`drop table if exists ${identifier(retiredName)}`)
      .catch((error) => {
        console.warn('Could not drop the retired GURS address table.', error);
      });
  }

  async discardStage(stageName: string) {
    await this.pool.query(`drop table if exists ${identifier(stageName)}`);
  }

  async failSync(args: {
    token: string;
    runId: string;
    message: string;
  }) {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `update gurs_address_sync_state
         set last_failure_at = now(),
             last_error = $2,
             lock_token = null,
             lock_expires_at = null
         where key = 'active' and lock_token = $1`,
        [args.token, args.message]
      );
      await client.query(
        `update gurs_address_sync_runs
         set status = 'failed', finished_at = now(), error_message = $2
         where id = $1 and status = 'running'`,
        [args.runId, args.message]
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

export async function syncGursAddresses(
  options: SyncGursAddressesOptions = {}
): Promise<GursAddressSyncSummary> {
  const now = options.now ?? (() => new Date());
  const sleepImpl = options.sleep ?? sleep;
  const logger = options.logger ?? console;
  const fetchImpl = options.fetchImpl ?? fetch;
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const insertBatchSize = options.insertBatchSize ?? DEFAULT_INSERT_BATCH_SIZE;
  const minRecordCount = options.minRecordCount ?? DEFAULT_MIN_RECORD_COUNT;
  const maxRecordCount = options.maxRecordCount ?? DEFAULT_MAX_RECORD_COUNT;
  const leaseDurationMs =
    options.leaseDurationMs ?? DEFAULT_LEASE_DURATION_MS;
  const importedAt = now().toISOString();
  const token = randomUUID().replaceAll('-', '');
  const stageName = generatedTableName('stage', token);
  const store =
    options.store ??
    new PostgresGursAddressSyncStore(await getPool(), leaseDurationMs);
  const lease = await store.acquireLease({
    token,
    now: new Date(importedAt),
    expiresAt: new Date(new Date(importedAt).getTime() + leaseDurationMs)
  });
  if (!lease.acquired) {
    logger.info('GURS address sync skipped because another import holds the lease.');
    return {
      status: 'skipped',
      recordCount: 0,
      sourceUpdatedAt: null,
      importedAt: null,
      expectedRecordCount: null
    };
  }

  try {
    await store.prepareStage({ stageName, token });
    const expectedRecordCount = await fetchExpectedRecordCount(
      fetchImpl,
      sleepImpl
    );
    let afterId: string | null = null;
    let importedRecordCount = 0;

    for (;;) {
      const csv = await fetchTextWithRetry({
        url: buildWfsUrl({ pageSize, afterId }),
        fetchImpl,
        sleepImpl
      });
      const sourceRows = parseCsvRows(csv);
      if (sourceRows.length === 0) break;

      const addresses = sourceRows.map((row) => normalizeGursAddressRow(row));
      for (let index = 0; index < addresses.length; index += insertBatchSize) {
        await store.insertBatch({
          stageName,
          addresses: addresses.slice(index, index + insertBatchSize),
          importedAt
        });
      }
      importedRecordCount += addresses.length;
      const nextAfterId = addresses.at(-1)?.gursHouseNumberId ?? null;
      if (!nextAfterId || nextAfterId === afterId) {
        throw new Error('GURS WFS keyset cursor did not advance.');
      }
      afterId = nextAfterId;
      await store.refreshLease({
        token,
        expiresAt: new Date(now().getTime() + leaseDurationMs)
      });
      logger.info(
        `Imported ${importedRecordCount} GURS building addresses into staging.`
      );
    }

    const stats = await store.inspectStage(stageName);
    if (
      stats.recordCount < minRecordCount ||
      stats.recordCount > maxRecordCount
    ) {
      throw new Error(
        `GURS staging row count ${stats.recordCount} is outside the plausible range ${minRecordCount}-${maxRecordCount}.`
      );
    }
    if (stats.recordCount !== importedRecordCount) {
      throw new Error(
        `GURS staging count ${stats.recordCount} does not match imported count ${importedRecordCount}.`
      );
    }
    if (
      expectedRecordCount !== null &&
      stats.recordCount !== expectedRecordCount
    ) {
      throw new Error(
        `GURS staging count ${stats.recordCount} does not match the source count ${expectedRecordCount}.`
      );
    }
    if (stats.uniqueIdCount !== stats.recordCount) {
      throw new Error('GURS staging contains missing or duplicate house-number IDs.');
    }
    if (stats.missingRequiredCount !== 0) {
      throw new Error(
        `GURS staging contains ${stats.missingRequiredCount} rows with missing required fields.`
      );
    }

    await store.indexStage(stageName);
    await store.refreshLease({
      token,
      expiresAt: new Date(now().getTime() + leaseDurationMs)
    });
    await store.publishStage({
      stageName,
      token,
      runId: lease.runId,
      stats,
      importedAt
    });
    const summary: GursAddressSyncSummary = {
      status: 'succeeded',
      recordCount: stats.recordCount,
      sourceUpdatedAt: stats.sourceUpdatedAt,
      importedAt,
      expectedRecordCount
    };
    logger.info(`GURS address sync succeeded: ${JSON.stringify(summary)}`);
    return summary;
  } catch (error) {
    const message = sanitizeError(error);
    logger.error(`GURS address sync failed: ${message}`);
    await store.discardStage(stageName).catch((discardError) => {
      logger.warn(
        `Could not discard failed GURS staging table: ${sanitizeError(discardError)}`
      );
    });
    await store
      .failSync({ token, runId: lease.runId, message })
      .catch((recordError) => {
        logger.warn(
          `Could not record failed GURS sync: ${sanitizeError(recordError)}`
        );
      });
    throw error;
  }
}
