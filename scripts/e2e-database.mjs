import { createHash } from 'node:crypto';
import { readFile, readdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(scriptPath), '..');
const migrationsDirectory = resolve(projectRoot, 'migrations');
const seedPath = resolve(projectRoot, 'tests', 'fixtures', 'e2e-seed.sql');
const nextRuntimeCacheDirectory = resolve(projectRoot, '.next', 'cache');
const seedVersion = '2026-08-16.1';
const migrationPattern = /^(\d{3})_[a-z0-9_]+\.sql$/u;
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

async function loadMigrations() {
  const fileNames = (await readdir(migrationsDirectory))
    .filter((fileName) => migrationPattern.test(fileName))
    .sort((left, right) => left.localeCompare(right, 'en'));

  if (fileNames.length === 0) fail('No numbered SQL migrations were found.');
  fileNames.forEach((fileName, index) => {
    const match = migrationPattern.exec(fileName);
    const expectedNumber = index + 1;
    if (!match || Number(match[1]) !== expectedNumber) {
      fail(`Migration numbering must be contiguous from 001; expected ${String(expectedNumber).padStart(3, '0')}, found ${fileName}.`);
    }
  });

  return Promise.all(fileNames.map(async (fileName) => {
    const sql = await readFile(resolve(migrationsDirectory, fileName), 'utf8');
    return { fileName, sql, checksum: sha256(sql) };
  }));
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

async function createMigrationLedger(pool) {
  await pool.query(`
    create table if not exists e2e_schema_migrations (
      filename text primary key,
      sha256 text not null check (length(sha256) = 64),
      applied_at timestamptz not null default now()
    )
  `);
}

async function applyMigrations(pool, migrations) {
  await createMigrationLedger(pool);
  for (const migration of migrations) {
    const existing = await pool.query(
      'select sha256 from e2e_schema_migrations where filename = $1',
      [migration.fileName]
    );
    if (existing.rows[0]) {
      if (existing.rows[0].sha256 !== migration.checksum) {
        fail(`Migration checksum changed after application: ${migration.fileName}.`);
      }
      continue;
    }

    await pool.query(migration.sql);
    await pool.query(
      'insert into e2e_schema_migrations (filename, sha256) values ($1, $2)',
      [migration.fileName, migration.checksum]
    );
  }
}

async function seedDatabase(pool) {
  const seedSql = await readFile(seedPath, 'utf8');
  const seedChecksum = sha256(seedSql);
  await pool.query(seedSql);
  await pool.query(`
    create table if not exists e2e_seed_metadata (
      key text primary key,
      version text not null,
      sha256 text not null check (length(sha256) = 64),
      seeded_at timestamptz not null default now()
    )
  `);
  await pool.query(
    `insert into e2e_seed_metadata (key, version, sha256, seeded_at)
     values ('deterministic-fixture', $1, $2, now())
     on conflict (key) do update
       set version = excluded.version,
           sha256 = excluded.sha256,
           seeded_at = excluded.seeded_at`,
    [seedVersion, seedChecksum]
  );
  return seedChecksum;
}

async function verifyDatabase(pool, migrations, seedChecksum) {
  await pool.query('select 1');

  const applied = await pool.query(
    'select filename, sha256 from e2e_schema_migrations order by filename'
  );
  if (applied.rows.length !== migrations.length) {
    fail(`Expected ${migrations.length} applied migrations, found ${applied.rows.length}.`);
  }
  for (const [index, migration] of migrations.entries()) {
    const row = applied.rows[index];
    if (row?.filename !== migration.fileName || row.sha256 !== migration.checksum) {
      fail(`Migration ledger mismatch for ${migration.fileName}.`);
    }
  }

  const extensions = await pool.query(
    "select extname from pg_extension where extname = any(array['pgcrypto', 'pg_trgm'])"
  );
  const extensionNames = new Set(extensions.rows.map((row) => row.extname));
  for (const extension of ['pgcrypto', 'pg_trgm']) {
    if (!extensionNames.has(extension)) fail(`Required PostgreSQL extension is missing: ${extension}.`);
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
  const missingSchemaChecks = Object.entries(schema)
    .filter(([, present]) => present !== true)
    .map(([name]) => name);
  if (missingSchemaChecks.length > 0) {
    fail(`Required migrated schema is incomplete: ${missingSchemaChecks.join(', ')}.`);
  }

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
  const migrations = await loadMigrations();
  const seedSql = await readFile(seedPath, 'utf8');
  const pool = createPool(databaseUrl);
  try {
    await verifyDatabase(pool, migrations, sha256(seedSql));
    return { databaseName, migrationCount: migrations.length };
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
  const migrations = await loadMigrations();
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
    await applyMigrations(pool, migrations);
    const seedChecksum = await seedDatabase(pool);
    await recordE2eResetOwnership(
      pool,
      databaseIdentity,
      storageNamespace,
      resetOwnershipHash
    );
    await verifyDatabase(pool, migrations, seedChecksum);
    await rm(nextRuntimeCacheDirectory, { recursive: true, force: true });
    return { databaseName, migrationCount: migrations.length };
  } finally {
    await pool.end();
  }
}

async function main() {
  const command = process.argv[2];
  if (!['prepare', 'check'].includes(command)) {
    fail('Usage: node scripts/e2e-database.mjs <prepare|check>.');
  }
  const result = command === 'prepare'
    ? await prepareE2eDatabase()
    : await checkE2eDatabase();
  console.info(
    `[e2e-preflight] ${command === 'prepare' ? 'Prepared' : 'Verified'} isolated database ${result.databaseName} with ${result.migrationCount} migrations.`
  );
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(scriptPath)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : '[e2e-preflight] Unknown database preflight failure.');
    process.exitCode = 1;
  });
}
