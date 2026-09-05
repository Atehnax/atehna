import { createHash } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import {
  loadManifest,
  verifyDatabaseContract
} from './check-database-schema.mjs';

const { Pool } = pg;
const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(scriptPath), '..');
const schemaPath = resolve(projectRoot, 'database', 'schema.sql');
const terminalSchemaContractPath = resolve(
  projectRoot,
  'database',
  'migrations',
  '20260904_schema_contract_v2.sql'
);
const seedPath = resolve(projectRoot, 'tests', 'fixtures', 'e2e-seed.sql');
const nextRuntimeCacheDirectory = resolve(projectRoot, '.next', 'cache');
const seedVersion = '2026-08-16.1';
const e2eSchemaStateKey = 'canonical-schema';
const requiredE2eSchemaChecks = [
  'has_catalog_items',
  'has_catalog_item_variants',
  'has_catalog_media',
  'has_product_appearance',
  'has_gurs_addresses',
  'has_default_variant',
  'has_variant_content'
];
const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const defaultPostgresPort = 5432;

function fail(message) {
  throw new Error(`[e2e-preflight] ${message}`);
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`${name} is required.`);
  return value;
}

function isolatedDatabaseNameForNamespace(storageNamespace) {
  const suffix = storageNamespace.replaceAll('-', '_');
  return `atehna_e2e_${suffix}`;
}

export function readE2eEnvironment() {
  if (process.env.E2E_MODE !== '1') {
    fail('E2E_MODE must be set to 1. Refusing to prepare or use a non-E2E environment.');
  }

  const storageNamespace = requiredEnvironment('E2E_STORAGE_NAMESPACE');
  if (!/^[a-z0-9][a-z0-9-]{10,50}[a-z0-9]$/u.test(storageNamespace)) {
    fail('E2E_STORAGE_NAMESPACE must be 12-52 lowercase letters, digits, or hyphens and start and end with a letter or digit.');
  }

  const rawDatabaseUrl = requiredEnvironment('E2E_DATABASE_URL');
  let databaseUrl;
  try {
    databaseUrl = new URL(rawDatabaseUrl);
  } catch {
    fail('E2E_DATABASE_URL is not a valid URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
    fail('E2E_DATABASE_URL must use the postgres or postgresql protocol.');
  }
  if (databaseUrl.search || databaseUrl.hash) {
    fail('E2E_DATABASE_URL must not contain query parameters or a fragment.');
  }
  if (!loopbackHosts.has(databaseUrl.hostname.toLowerCase())) {
    fail('E2E_DATABASE_URL must target a loopback PostgreSQL service. Remote and shared databases are refused.');
  }

  const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\/+|\/+$/gu, ''));
  const expectedDatabaseName = isolatedDatabaseNameForNamespace(storageNamespace);
  if (databaseName !== expectedDatabaseName) {
    fail('The disposable database name must exactly match the isolated E2E storage namespace.');
  }

  const effectiveUser = decodeURIComponent(databaseUrl.username);
  if (!effectiveUser) {
    fail('E2E_DATABASE_URL must include an explicit PostgreSQL user so the live database identity can be verified.');
  }
  const serverPort = databaseUrl.port
    ? Number(databaseUrl.port)
    : defaultPostgresPort;
  if (!Number.isInteger(serverPort) || serverPort < 1 || serverPort > 65_535) {
    fail('E2E_DATABASE_URL must use a valid PostgreSQL port.');
  }
  const serverAddress = databaseUrl.hostname.toLowerCase() === '[::1]'
    ? '::1'
    : databaseUrl.hostname.toLowerCase();

  const applicationDatabaseUrl = process.env.DATABASE_URL?.trim();
  if (applicationDatabaseUrl && applicationDatabaseUrl !== rawDatabaseUrl) {
    fail('DATABASE_URL and E2E_DATABASE_URL differ. Refusing to start against ambiguous database targets.');
  }

  requiredEnvironment('ADMIN_USERNAME');
  requiredEnvironment('ADMIN_PASSWORD');
  const adminSessionSecret = requiredEnvironment('ADMIN_SESSION_SECRET');
  if (adminSessionSecret.length < 32) {
    fail('ADMIN_SESSION_SECRET must contain at least 32 characters.');
  }
  const resetOwnershipHash = sha256([
    storageNamespace,
    databaseName,
    effectiveUser,
    adminSessionSecret
  ].join('\0'));
  return {
    databaseUrl: rawDatabaseUrl,
    databaseName,
    storageNamespace,
    resetOwnershipHash,
    databaseIdentity: {
      database: databaseName,
      effectiveUser,
      serverAddress,
      serverPort
    }
  };
}

function sha256(source) {
  return createHash('sha256').update(source, 'utf8').digest('hex');
}

async function loadCanonicalSchema() {
  const sql = await readFile(schemaPath, 'utf8');
  if (!sql.trim()) fail('Canonical SQL schema is empty.');
  return sql;
}

async function loadTerminalSchemaContract() {
  const sql = await readFile(terminalSchemaContractPath, 'utf8');
  if (!sql.trim()) fail('The terminal schema contract SQL is empty.');
  return sql;
}

function createPool(databaseUrl) {
  return new Pool({
    connectionString: databaseUrl,
    ssl: false,
    max: 1,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000,
    options: '--statement_timeout=15000 --lock_timeout=5000'
  });
}

export async function verifyE2eResetTarget(
  pool,
  expectedIdentity,
  storageNamespace,
  resetOwnershipHash
) {
  const identityResult = await pool.query(`
    select
      current_database() as database,
      current_user as effective_user
  `);
  const identity = identityResult.rows[0] ?? {};
  if (
    identity.database !== expectedIdentity.database
    || identity.effective_user !== expectedIdentity.effectiveUser
  ) {
    fail('The live PostgreSQL database/user identity does not match the validated E2E target. Refusing to reset it.');
  }

  const objectResult = await pool.query(`
    select count(*)::integer as object_count
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
  `);
  if (Number(objectResult.rows[0]?.object_count ?? 0) === 0) return;

  const markerTableResult = await pool.query(`
    select to_regclass('public.e2e_reset_ownership') is not null as has_ownership_table
  `);
  if (markerTableResult.rows[0]?.has_ownership_table !== true) {
    fail('The target database is not empty and has no E2E reset-ownership marker. Refusing to drop its schema.');
  }

  const markerResult = await pool.query(`
    select exists (
      select 1
      from public.e2e_reset_ownership
      where storage_namespace = $1
        and database_name = $2
        and database_user = $3
        and ownership_sha256 = $4
    ) as owned
  `, [
    storageNamespace,
    expectedIdentity.database,
    expectedIdentity.effectiveUser,
    resetOwnershipHash
  ]);
  if (markerResult.rows[0]?.owned !== true) {
    fail('The target database reset-ownership marker does not match this E2E run. Refusing to drop its schema.');
  }
}

async function recordE2eResetOwnership(
  pool,
  expectedIdentity,
  storageNamespace,
  resetOwnershipHash
) {
  await pool.query(`
    create table e2e_reset_ownership (
      storage_namespace text primary key,
      database_name text not null,
      database_user text not null,
      ownership_sha256 text not null check (length(ownership_sha256) = 64),
      created_at timestamptz not null default now()
    )
  `);
  await pool.query(`
    insert into e2e_reset_ownership (
      storage_namespace,
      database_name,
      database_user,
      ownership_sha256
    ) values ($1, $2, $3, $4)
  `, [
    storageNamespace,
    expectedIdentity.database,
    expectedIdentity.effectiveUser,
    resetOwnershipHash
  ]);
}

async function recordE2eSchemaState(pool, schemaSha256) {
  await pool.query(`
    create table e2e_schema_state (
      key text primary key,
      sha256 text not null check (length(sha256) = 64),
      recorded_at timestamptz not null default now()
    )
  `);
  await pool.query(
    'insert into e2e_schema_state (key, sha256) values ($1, $2)',
    [e2eSchemaStateKey, schemaSha256]
  );
}

async function seedDatabase(pool) {
  const seedSql = await readFile(seedPath, 'utf8');
  const seedChecksum = sha256(seedSql);
  await pool.query(seedSql);
  await pool.query(`
    create table e2e_seed_metadata (
      key text primary key,
      version text not null,
      sha256 text not null check (length(sha256) = 64),
      seeded_at timestamptz not null default now()
    )
  `);
  await pool.query(
    `insert into e2e_seed_metadata (key, version, sha256, seeded_at)
     values ('deterministic-fixture', $1, $2, now())`,
    [seedVersion, seedChecksum]
  );
  return seedChecksum;
}

export async function verifyCanonicalE2eSchemaState(
  pool,
  expectedSchemaSha256,
  verifyContract = verifyDatabaseContract
) {
  const stateResult = await pool.query(
    'select sha256 from e2e_schema_state where key = $1',
    [e2eSchemaStateKey]
  );
  if (stateResult.rows[0]?.sha256 !== expectedSchemaSha256) {
    fail('The isolated database canonical-schema fingerprint is missing or stale.');
  }

  const schemaProbe = await pool.query(`
    select
      to_regclass('public.catalog_items') is not null as has_catalog_items,
      to_regclass('public.catalog_item_variants') is not null as has_catalog_item_variants,
      to_regclass('public.catalog_media') is not null as has_catalog_media,
      to_regclass('public.product_appearance_settings') is not null as has_product_appearance,
      to_regclass('public.gurs_addresses') is not null as has_gurs_addresses,
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'catalog_items'
          and column_name = 'default_variant_id'
      ) as has_default_variant,
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'catalog_item_variants'
          and column_name = 'content_override_json'
      ) as has_variant_content
  `);
  const schema = schemaProbe.rows[0] ?? {};
  const missingSchemaChecks = requiredE2eSchemaChecks
    .filter((name) => schema[name] !== true);
  if (missingSchemaChecks.length > 0) {
    fail(`Required E2E core schema is incomplete: ${missingSchemaChecks.join(', ')}.`);
  }

  const manifest = await loadManifest();
  await verifyContract(pool, manifest);
}

async function verifyDatabase(pool, schemaSha256, seedChecksum) {
  await pool.query('select 1');
  await verifyCanonicalE2eSchemaState(pool, schemaSha256);

  const seedProbe = await pool.query(`
    select
      exists (
        select 1 from e2e_seed_metadata
        where key = 'deterministic-fixture'
          and version = $1
          and sha256 = $2
      ) as has_seed_sentinel,
      exists (
        select 1 from catalog_items
        where slug = 'aluminijasta-plosca' and status = 'active'
      ) as has_reference_product,
      (
        select count(*)::integer
        from catalog_item_variants variant
        join catalog_items item on item.id = variant.item_id
        where item.slug = 'aluminijasta-plosca'
          and variant.status = 'active'
          and variant.length is not null
          and variant.width is not null
          and variant.thickness is not null
      ) as dimensional_variant_count,
      (
        select count(*)::integer
        from catalog_media media
        join catalog_items item on item.id = media.item_id
        where item.slug = 'aluminijasta-plosca'
          and media.media_kind = 'image'
          and media.role = 'gallery'
          and media.hidden = false
      ) as gallery_image_count,
      exists (
        select 1
        from catalog_items reference
        join catalog_items related on related.category_id = reference.category_id
        where reference.slug = 'aluminijasta-plosca'
          and related.slug <> reference.slug
          and related.status = 'active'
      ) as has_related_product
  `, [seedVersion, seedChecksum]);
  const seed = seedProbe.rows[0] ?? {};
  if (seed.has_seed_sentinel !== true) fail('Deterministic seed sentinel is missing or stale.');
  if (seed.has_reference_product !== true) fail('Reference product fixture is missing.');
  if (Number(seed.dimensional_variant_count) < 2) fail('Reference dimensional variants are incomplete.');
  if (Number(seed.gallery_image_count) < 2) fail('Reference gallery media is incomplete.');
  if (seed.has_related_product !== true) fail('Related-product fixture is missing.');
}

export async function checkE2eDatabase() {
  const { databaseUrl, databaseName } = readE2eEnvironment();
  const schemaSql = await loadCanonicalSchema();
  const schemaSha256 = sha256(schemaSql);
  const seedSql = await readFile(seedPath, 'utf8');
  const pool = createPool(databaseUrl);
  try {
    await verifyDatabase(pool, schemaSha256, sha256(seedSql));
    return { databaseName, schemaSha256 };
  } finally {
    await pool.end();
  }
}

export async function prepareE2eDatabase() {
  const {
    databaseUrl,
    databaseName,
    databaseIdentity,
    storageNamespace,
    resetOwnershipHash
  } = readE2eEnvironment();
  const schemaSql = await loadCanonicalSchema();
  const schemaSha256 = sha256(schemaSql);
  const pool = createPool(databaseUrl);
  try {
    await verifyE2eResetTarget(
      pool,
      databaseIdentity,
      storageNamespace,
      resetOwnershipHash
    );
    await pool.query('drop schema if exists public cascade');
    await pool.query('create schema public');
    await pool.query(schemaSql);
    await recordE2eSchemaState(pool, schemaSha256);
    const seedChecksum = await seedDatabase(pool);
    await recordE2eResetOwnership(
      pool,
      databaseIdentity,
      storageNamespace,
      resetOwnershipHash
    );
    await verifyDatabase(pool, schemaSha256, seedChecksum);
    await rm(nextRuntimeCacheDirectory, { recursive: true, force: true });
    return { databaseName, schemaSha256 };
  } finally {
    await pool.end();
  }
}

export async function rehearseE2eSchemaContract() {
  const {
    databaseUrl,
    databaseName,
    databaseIdentity,
    storageNamespace,
    resetOwnershipHash
  } = readE2eEnvironment();
  const [schemaSql, seedSql, terminalContractSql] = await Promise.all([
    loadCanonicalSchema(),
    readFile(seedPath, 'utf8'),
    loadTerminalSchemaContract()
  ]);
  const schemaSha256 = sha256(schemaSql);
  const seedChecksum = sha256(seedSql);
  const pool = createPool(databaseUrl);
  try {
    await verifyE2eResetTarget(
      pool,
      databaseIdentity,
      storageNamespace,
      resetOwnershipHash
    );
    await verifyDatabase(pool, schemaSha256, seedChecksum);

    const mutablePolicyResult = await pool.query(`
      update public.inventory_policy_settings
         set config_json = jsonb_set(
           config_json,
           '{stockEnforcementEnabled}',
           'false'::jsonb
         )
       where key = 'default'
       returning key
    `);
    if (mutablePolicyResult.rows.length !== 1) {
      fail('The mutable inventory-policy fixture is missing.');
    }

    await pool.query('drop table public.app_schema_contracts');
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await pool.query(terminalContractSql);
    }

    await verifyDatabase(pool, schemaSha256, seedChecksum);
    const { contractId, contractSha256 } = await loadManifest();
    const contractResult = await pool.query(
      `select installed_via
         from public.app_schema_contracts
        where contract_id = $1
          and contract_sha256 = $2`,
      [contractId, contractSha256]
    );
    if (
      contractResult.rows.length !== 1
      || contractResult.rows[0]?.installed_via !== 'existing_database'
    ) {
      fail('The terminal schema contract rehearsal did not record one exact existing-database contract.');
    }
    await pool.query(`
      update public.inventory_policy_settings
         set config_json = jsonb_set(
           config_json,
           '{stockEnforcementEnabled}',
           'true'::jsonb
         )
       where key = 'default'
    `);
    return { databaseName, schemaSha256 };
  } finally {
    await pool.end();
  }
}

async function main() {
  const command = process.argv[2];
  if (!['prepare', 'check', 'rehearse-contract'].includes(command)) {
    fail('Usage: node scripts/e2e-database.mjs <prepare|check|rehearse-contract>.');
  }
  const result = command === 'prepare'
    ? await prepareE2eDatabase()
    : command === 'rehearse-contract'
      ? await rehearseE2eSchemaContract()
      : await checkE2eDatabase();
  const action = command === 'prepare'
    ? 'Prepared'
    : command === 'rehearse-contract'
      ? 'Rehearsed the terminal contract on'
      : 'Verified';
  console.info(
    `[e2e-preflight] ${action} isolated database ${result.databaseName} with the canonical schema.`
  );
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(scriptPath)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : '[e2e-preflight] Unknown database preflight failure.');
    process.exitCode = 1;
  });
}
