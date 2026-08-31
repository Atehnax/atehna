import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(scriptPath), '..');
const schemaPath = resolve(projectRoot, 'database', 'schema.sql');

// This is deliberately a clean replacement, not a migration. Only tables that
// contain catalogue, order, shipping, archive, or statistics data are swapped.
// Site appearance, email configuration, directories, address data, audit
// history, and document-editor revisions remain untouched in public.
const RESET_TABLES = [
  'orders',
  'order_documents',
  'order_status_logs',
  'order_payment_logs',
  'website_events',
  'deleted_archive_entries',
  'analytics_charts',
  'analytics_chart_settings',
  'shipping_settings',
  'catalog_categories',
  'catalog_items',
  'catalog_item_variants',
  'catalog_media',
  'catalog_item_quantity_discounts',
  'catalog_item_editor_details',
  'catalog_item_slug_aliases',
  'catalog_option_axes',
  'catalog_option_values',
  'catalog_variant_option_values',
  'catalog_variant_media',
  'order_items',
  'order_line_snapshots',
  'order_stock_holds',
  'order_idempotency_keys',
  'order_access_tokens',
  'order_document_jobs',
  'order_email_jobs',
  'quote_number_counters',
  'quote_requests',
  'quote_request_items',
  'quote_offer_versions',
  'quote_offer_version_items',
  'quote_offer_acceptances',
  'quote_documents',
  'quote_manual_documents',
  'quote_document_jobs',
  'quote_events',
  'quote_access_tokens',
  'quote_request_idempotency_keys',
  'quote_response_idempotency_keys',
  'quote_email_verifications',
  'quote_rate_limits',
  'quote_email_jobs'
];

const RESET_FUNCTIONS = [
  'set_analytics_charts_updated_at()',
  'guard_order_stock_hold_transition()',
  'guard_quote_append_only()',
  'guard_quote_request_history()',
  'guard_quote_offer_version()',
  'guard_quote_offer_version_item()'
];
const REQUIRED_EXTENSIONS = ['pgcrypto', 'pg_trgm'];

function fail(message) {
  throw new Error(`[commerce-reset] ${message}`);
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function databaseUrlFromEnvironment() {
  for (const key of ['DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'SUPABASE_DB_URL']) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  fail('A PostgreSQL connection URL is required.');
}

function parseTarget(connectionString) {
  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch {
    fail('The database connection URL is invalid.');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    fail('The reset target must be PostgreSQL.');
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+|\/+$/gu, ''));
  const user = decodeURIComponent(parsed.username);
  if (!database || !user) fail('The connection URL must name both a database and a user.');
  return {
    database,
    host: parsed.hostname.toLowerCase(),
    user,
    confirmation: `${parsed.hostname.toLowerCase()}/${database}`
  };
}

function sslConfig(connectionString) {
  const parsed = new URL(connectionString);
  if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname.toLowerCase())) {
    return false;
  }
  return { rejectUnauthorized: false };
}

async function canonicalSchemaBody() {
  const source = (await readFile(schemaPath, 'utf8')).trim();
  const boundaries = Array.from(
    source.matchAll(/^[ \t]*(begin|commit);[ \t]*$/gimu)
  );
  if (
    boundaries.length !== 2
    || boundaries[0]?.[1]?.toLowerCase() !== 'begin'
    || boundaries[1]?.[1]?.toLowerCase() !== 'commit'
    || boundaries[0].index === undefined
    || boundaries[1].index === undefined
  ) {
    fail('The canonical schema must have one outer begin/commit boundary.');
  }
  return source
    .slice(boundaries[0].index + boundaries[0][0].length, boundaries[1].index)
    .trim();
}

async function tableCounts(client, schemaName) {
  const rows = [];
  for (const table of RESET_TABLES) {
    const relationResult = await client.query(
      'select to_regclass($1) is not null as exists',
      [`${schemaName}.${table}`]
    );
    if (relationResult.rows[0]?.exists !== true) {
      rows.push({ table, rows: null });
      continue;
    }
    const countResult = await client.query(
      `select count(*)::bigint as count from ${quoteIdentifier(schemaName)}.${quoteIdentifier(table)}`
    );
    rows.push({ table, rows: countResult.rows[0]?.count ?? '0' });
  }
  return rows;
}

async function sequenceHighWaterMarks(client) {
  const result = await client.query(`
    select
      table_relation.relname as table_name,
      attribute.attname as column_name,
      sequence_record.last_value::text as last_value
    from pg_class sequence_relation
    join pg_namespace sequence_namespace
      on sequence_namespace.oid = sequence_relation.relnamespace
    join pg_depend dependency
      on dependency.objid = sequence_relation.oid
     and dependency.classid = 'pg_class'::regclass
     and dependency.refclassid = 'pg_class'::regclass
     and dependency.deptype in ('a', 'i')
    join pg_class table_relation
      on table_relation.oid = dependency.refobjid
    join pg_namespace table_namespace
      on table_namespace.oid = table_relation.relnamespace
    join pg_attribute attribute
      on attribute.attrelid = table_relation.oid
     and attribute.attnum = dependency.refobjsubid
    join pg_sequences sequence_record
      on sequence_record.schemaname = sequence_namespace.nspname
     and sequence_record.sequencename = sequence_relation.relname
    where sequence_relation.relkind = 'S'
      and table_namespace.nspname = 'public'
      and table_relation.relname = any($1::text[])
    order by table_relation.relname, attribute.attname
  `, [RESET_TABLES]);
  const marks = [];
  for (const row of result.rows) {
    const tableName = String(row.table_name);
    const columnName = String(row.column_name);
    const maximumResult = await client.query(
      `select max(${quoteIdentifier(columnName)})::text as maximum from public.${quoteIdentifier(tableName)}`
    );
    const candidates = [row.last_value, maximumResult.rows[0]?.maximum]
      .map((value) => typeof value === 'string' && /^\d+$/u.test(value) ? BigInt(value) : 0n);
    const highWater = candidates.reduce(
      (maximum, candidate) => candidate > maximum ? candidate : maximum,
      0n
    );
    marks.push({
      tableName,
      columnName,
      lastValue: highWater.toString()
    });
  }
  return marks;
}

async function restoreSequenceHighWaterMarks(client, marks) {
  for (const mark of marks) {
    if (!/^\d+$/u.test(mark.lastValue) || BigInt(mark.lastValue) < 1n) continue;
    const result = await client.query(
      'select pg_get_serial_sequence($1, $2) as sequence_name',
      [`public.${mark.tableName}`, mark.columnName]
    );
    const sequenceName = result.rows[0]?.sequence_name;
    if (typeof sequenceName !== 'string' || !sequenceName) {
      fail(`The rebuilt sequence for ${mark.tableName}.${mark.columnName} is missing.`);
    }
    await client.query(
      'select setval($1::regclass, $2::bigint, true)',
      [sequenceName, mark.lastValue]
    );
  }
}

async function currentShippingSettingsVersion(client) {
  const relationResult = await client.query(
    "select to_regclass('public.shipping_settings') is not null as exists"
  );
  if (relationResult.rows[0]?.exists !== true) return null;
  const result = await client.query(`
    select version, revision
    from public.shipping_settings
    where key = 'default'
  `);
  if (result.rowCount !== 1) return null;
  const version = Number(result.rows[0]?.version);
  const revision = Number(result.rows[0]?.revision);
  if (!Number.isSafeInteger(version) || version < 1 || !Number.isSafeInteger(revision) || revision < 1) {
    fail('Existing shipping settings have invalid version metadata.');
  }
  return { version, revision };
}

async function assertLiveIdentity(client, expected) {
  const result = await client.query(`
    select current_database() as database, current_user as database_user
  `);
  const live = result.rows[0] ?? {};
  if (live.database !== expected.database || live.database_user !== expected.user) {
    fail('The live database/user identity differs from the connection URL.');
  }
}

async function assertExtensions(client) {
  const result = await client.query(`
    select extname
    from pg_extension
    where extname = any($1::text[])
  `, [REQUIRED_EXTENSIONS]);
  const installed = new Set(result.rows.map((row) => row.extname));
  const missing = REQUIRED_EXTENSIONS.filter((extension) => !installed.has(extension));
  if (missing.length > 0) {
    fail(`Required extensions are missing: ${missing.join(', ')}.`);
  }
}

async function assertNoExternalForeignKeys(client) {
  const result = await client.query(`
    select
      source_namespace.nspname || '.' || source.relname as source_table,
      constraint_record.conname as constraint_name,
      target.relname as reset_target
    from pg_constraint constraint_record
    join pg_class source on source.oid = constraint_record.conrelid
    join pg_namespace source_namespace on source_namespace.oid = source.relnamespace
    join pg_class target on target.oid = constraint_record.confrelid
    join pg_namespace target_namespace on target_namespace.oid = target.relnamespace
    where constraint_record.contype = 'f'
      and target_namespace.nspname = 'public'
      and target.relname = any($1::text[])
      and not (
        source_namespace.nspname = 'public'
        and source.relname = any($1::text[])
      )
    order by source_table, constraint_name
  `, [RESET_TABLES]);
  if (result.rowCount > 0) {
    const dependencies = result.rows
      .map((row) => `${row.source_table}.${row.constraint_name} -> ${row.reset_target}`)
      .join(', ');
    fail(`Unexpected foreign keys cross the reset boundary: ${dependencies}.`);
  }
}

async function main() {
  const connectionString = databaseUrlFromEnvironment();
  const target = parseTarget(connectionString);
  const execute = process.argv.includes('--execute');
  const verifyBuild = process.argv.includes('--verify-build');
  const suppliedConfirmation = process.env.ATEHNA_COMMERCE_RESET_TARGET?.trim();

  if (execute && verifyBuild) {
    fail('Choose either --execute or --verify-build, not both.');
  }

  if (execute && process.env.ATEHNA_ALLOW_COMMERCE_RESET !== '1') {
    fail('Set ATEHNA_ALLOW_COMMERCE_RESET=1 to execute the destructive reset.');
  }
  if (execute && suppliedConfirmation !== target.confirmation) {
    fail(`ATEHNA_COMMERCE_RESET_TARGET must exactly equal ${target.confirmation}.`);
  }
  if (execute && (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production')) {
    fail('Production-marked environments are refused.');
  }

  const client = new Client({
    connectionString,
    ssl: sslConfig(connectionString),
    connectionTimeoutMillis: 10_000
  });
  await client.connect();
  try {
    await assertLiveIdentity(client, target);
    await assertExtensions(client);
    await assertNoExternalForeignKeys(client);
    const before = await tableCounts(client, 'public');
    const sequenceMarks = await sequenceHighWaterMarks(client);
    const previousShippingVersion = await currentShippingSettingsVersion(client);

    if (verifyBuild) {
      const schemaBody = await canonicalSchemaBody();
      const buildSchema = `atehna_commerce_verify_${randomBytes(6).toString('hex')}`;
      const quotedBuildSchema = quoteIdentifier(buildSchema);
      await client.query('begin');
      try {
        await client.query("set local lock_timeout = '10s'");
        await client.query("set local statement_timeout = '120s'");
        await client.query(`create schema ${quotedBuildSchema}`);
        await client.query(`set local search_path = ${quotedBuildSchema}, public`);
        await client.query(schemaBody);
        const built = await tableCounts(client, buildSchema);
        const missingBuiltTables = built.filter((entry) => entry.rows === null);
        if (missingBuiltTables.length > 0) {
          fail(`Canonical verification build is missing: ${missingBuiltTables.map((entry) => entry.table).join(', ')}.`);
        }
        await client.query('rollback');
        console.log(JSON.stringify({
          mode: 'verified-build-rolled-back',
          target: target.confirmation,
          builtTables: built
        }, null, 2));
        return;
      } catch (error) {
        await client.query('rollback').catch(() => {});
        throw error;
      }
    }

    if (!execute) {
      console.log(JSON.stringify({
        mode: 'dry-run',
        target: target.confirmation,
        resetTables: before,
        preservedScopes: [
          'site and appearance settings',
          'order email settings',
          'quote email settings',
          'audit history and settings',
          'school and customer directories',
          'GURS address data',
          'document scene revisions',
          'archive blob cleanup outbox'
        ]
      }, null, 2));
      return;
    }

    const schemaBody = await canonicalSchemaBody();
    const buildSchema = `atehna_commerce_rebuild_${randomBytes(6).toString('hex')}`;
    const quotedBuildSchema = quoteIdentifier(buildSchema);
    const quotedResetTables = RESET_TABLES.map((table) => `public.${quoteIdentifier(table)}`);

    await client.query('begin');
    try {
      await client.query("select pg_advisory_xact_lock(hashtext('atehna-commerce-clean-reset-v1'))");
      await client.query("set local lock_timeout = '10s'");
      await client.query("set local statement_timeout = '120s'");
      await client.query(`create schema ${quotedBuildSchema}`);
      await client.query(`set local search_path = ${quotedBuildSchema}, public`);
      await client.query(schemaBody);

      const built = await tableCounts(client, buildSchema);
      const missingBuiltTables = built.filter((entry) => entry.rows === null).map((entry) => entry.table);
      if (missingBuiltTables.length > 0) {
        fail(`Canonical build is missing reset tables: ${missingBuiltTables.join(', ')}.`);
      }

      if (previousShippingVersion) {
        const nextVersion = previousShippingVersion.version + 1;
        const nextRevision = Math.max(previousShippingVersion.revision + 1, nextVersion);
        await client.query(`
          update ${quotedBuildSchema}.shipping_settings
          set
            version = $1,
            revision = $2,
            config_json = jsonb_set(config_json, '{version}', to_jsonb($1::integer), true),
            updated_at = now()
          where key = 'default'
        `, [nextVersion, nextRevision]);
      }

      await client.query('set local search_path = public');
      await client.query(`drop table if exists ${quotedResetTables.join(', ')}`);
      for (const signature of RESET_FUNCTIONS) {
        await client.query(`drop function if exists public.${signature}`);
      }
      for (const table of RESET_TABLES) {
        await client.query(
          `alter table ${quotedBuildSchema}.${quoteIdentifier(table)} set schema public`
        );
      }
      for (const signature of RESET_FUNCTIONS) {
        await client.query(
          `alter function ${quotedBuildSchema}.${signature} set schema public`
        );
      }
      await restoreSequenceHighWaterMarks(client, sequenceMarks);
      await client.query(`drop schema ${quotedBuildSchema} cascade`);

      const after = await tableCounts(client, 'public');
      const unexpectedRows = after.filter((entry) => {
        if (entry.table === 'catalog_categories' || entry.table === 'shipping_settings') return false;
        return entry.rows !== '0';
      });
      const categoryCount = after.find((entry) => entry.table === 'catalog_categories')?.rows;
      const shippingSettingsCount = after.find((entry) => entry.table === 'shipping_settings')?.rows;
      if (unexpectedRows.length > 0 || categoryCount === '0' || shippingSettingsCount !== '1') {
        fail('The rebuilt commerce schema failed its post-swap row-count checks.');
      }

      await client.query('commit');
      console.log(JSON.stringify({
        mode: 'executed',
        target: target.confirmation,
        resetTablesBefore: before,
        resetTablesAfter: after
      }, null, 2));
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
