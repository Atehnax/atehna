import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import {
  resolveDatabaseSslConfig,
  resolveDatabaseUrl
} from '../src/shared/server/environmentCore.mjs';

const { Pool } = pg;
const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(scriptPath), '..');
const manifestPath = resolve(projectRoot, 'database', 'schema-contract.json');
const schemaPath = resolve(projectRoot, 'database', 'schema.sql');
const migrationPath = resolve(
  projectRoot,
  'database',
  'migrations',
  '20260903_schema_contract_v1.sql'
);
const identifierPattern = /^[a-z][a-z0-9_]*$/u;
const contractIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,127}$/u;
const checksumPattern = /^[a-f0-9]{64}$/u;
const constraintTypeCodes = Object.freeze({
  check: 'c',
  foreign_key: 'f'
});
const functionVolatilityCodes = Object.freeze({
  immutable: 'i',
  stable: 's',
  volatile: 'v'
});
const functionParallelCodes = Object.freeze({
  restricted: 'r',
  safe: 's',
  unsafe: 'u'
});

function fail(message) {
  throw new Error(`[schema-contract] ${message}`);
}

export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry)).join(',')}]`;
  }
  const entries = Object.entries(value).sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0
  );
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`)
    .join(',')}}`;
}

export function requirementsSha256(requirements) {
  return createHash('sha256')
    .update(canonicalize(requirements), 'utf8')
    .digest('hex');
}

function requireIdentifier(value, description) {
  if (typeof value !== 'string' || !identifierPattern.test(value)) {
    fail(`Invalid PostgreSQL identifier for ${description}.`);
  }
}

function requireUniqueStrings(values, description) {
  if (!Array.isArray(values) || values.length === 0) {
    fail(`${description} must be a non-empty array.`);
  }
  for (const value of values) requireIdentifier(value, description);
  if (new Set(values).size !== values.length) {
    fail(`${description} contains a duplicate value.`);
  }
}

function requireFragments(values, description) {
  if (values === undefined) return;
  if (
    !Array.isArray(values)
    || values.length === 0
    || values.some((value) => typeof value !== 'string' || value.length === 0)
  ) {
    fail(`${description} must contain non-empty strings.`);
  }
}

export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    fail('Manifest must be a JSON object.');
  }
  if (
    typeof manifest.contractId !== 'string'
    || !contractIdPattern.test(manifest.contractId)
  ) {
    fail('Manifest contractId is invalid.');
  }
  if (
    typeof manifest.contractSha256 !== 'string'
    || !checksumPattern.test(manifest.contractSha256)
  ) {
    fail('Manifest contractSha256 is invalid.');
  }

  const requirements = manifest.requirements;
  if (!requirements || typeof requirements !== 'object' || Array.isArray(requirements)) {
    fail('Manifest requirements must be a JSON object.');
  }
  requireUniqueStrings(requirements.extensions, 'extensions');
  requireUniqueStrings(requirements.tables, 'tables');

  for (const [description, entries] of [
    ['columns', requirements.columns],
    ['constraints', requirements.constraints],
    ['functions', requirements.functions],
    ['indexes', requirements.indexes],
    ['triggers', requirements.triggers],
    ['settings', requirements.settings]
  ]) {
    if (!Array.isArray(entries) || entries.length === 0) {
      fail(`${description} must be a non-empty array.`);
    }
  }

  for (const column of requirements.columns) {
    requireIdentifier(column.table, 'column table');
    requireIdentifier(column.name, 'column name');
    if (typeof column.dataType !== 'string' || column.dataType.length === 0) {
      fail('Column dataType must be a non-empty string.');
    }
    if (typeof column.nullable !== 'boolean') {
      fail('Column nullable must be boolean.');
    }
    requireFragments(
      column.defaultIncludes,
      `column ${column.table}.${column.name} defaultIncludes`
    );
    if (
      column.defaultIncludes !== undefined
      && (
        typeof column.defaultEquals !== 'string'
        || column.defaultEquals.trim() === ''
      )
    ) {
      fail(`Column ${column.table}.${column.name} requires exact defaultEquals.`);
    }
  }
  for (const constraint of requirements.constraints) {
    requireIdentifier(constraint.table, 'constraint table');
    requireIdentifier(constraint.name, 'constraint name');
    if (!Object.hasOwn(constraintTypeCodes, constraint.type)) {
      fail(`Constraint ${constraint.name} has an invalid type.`);
    }
    if (
      typeof constraint.definitionEquals !== 'string'
      || constraint.definitionEquals.trim() === ''
    ) {
      fail(`Constraint ${constraint.name} definitionEquals must be non-empty.`);
    }
    requireFragments(
      constraint.definitionIncludes,
      `constraint ${constraint.name} definitionIncludes`
    );
    requireFragments(
      constraint.definitionExcludes,
      `constraint ${constraint.name} definitionExcludes`
    );
  }
  for (const routine of requirements.functions) {
    requireIdentifier(routine.name, 'function name');
    if (!checksumPattern.test(routine.bodySha256)) {
      fail(`Function ${routine.name} bodySha256 is invalid.`);
    }
    requireIdentifier(routine.language, `function ${routine.name} language`);
    if (typeof routine.securityDefiner !== 'boolean') {
      fail(`Function ${routine.name} securityDefiner must be boolean.`);
    }
    if (typeof routine.leakproof !== 'boolean') {
      fail(`Function ${routine.name} leakproof must be boolean.`);
    }
    if (typeof routine.strict !== 'boolean') {
      fail(`Function ${routine.name} strict must be boolean.`);
    }
    if (routine.configuration !== null) {
      fail(`Function ${routine.name} configuration must be null.`);
    }
    if (!Object.hasOwn(functionVolatilityCodes, routine.volatility)) {
      fail(`Function ${routine.name} volatility is invalid.`);
    }
    if (!Object.hasOwn(functionParallelCodes, routine.parallel)) {
      fail(`Function ${routine.name} parallel is invalid.`);
    }
    if (routine.returns !== 'trigger') {
      fail(`Function ${routine.name} must return trigger.`);
    }
    requireFragments(
      routine.definitionIncludes,
      `function ${routine.name} definitionIncludes`
    );
  }
  for (const index of requirements.indexes) {
    requireIdentifier(index.table, 'index table');
    requireIdentifier(index.name, 'index name');
    if (
      typeof index.definitionEquals !== 'string'
      || index.definitionEquals.trim() === ''
    ) {
      fail(`Index ${index.name} definitionEquals must be non-empty.`);
    }
    requireFragments(
      index.definitionIncludes,
      `index ${index.name} definitionIncludes`
    );
  }
  for (const trigger of requirements.triggers) {
    requireIdentifier(trigger.table, 'trigger table');
    requireIdentifier(trigger.name, 'trigger name');
    requireIdentifier(trigger.function, 'trigger function');
    if (
      typeof trigger.definitionEquals !== 'string'
      || trigger.definitionEquals.trim() === ''
    ) {
      fail(`Trigger ${trigger.name} definitionEquals must be non-empty.`);
    }
    requireFragments(
      trigger.definitionIncludes,
      `trigger ${trigger.name} definitionIncludes`
    );
  }
  for (const setting of requirements.settings) {
    requireIdentifier(setting.table, 'setting table');
    if (typeof setting.key !== 'string' || setting.key.length === 0) {
      fail('Setting key must be a non-empty string.');
    }
    if (typeof setting.jsonField !== 'string' || setting.jsonField.length === 0) {
      fail('Setting jsonField must be a non-empty string.');
    }
    if (
      !['array', 'boolean', 'null', 'number', 'object', 'string'].includes(
        setting.jsonType
      )
    ) {
      fail('Setting jsonType must be a valid JSON type.');
    }
  }

  for (const [description, entries, key] of [
    ['columns', requirements.columns, (entry) => `${entry.table}.${entry.name}`],
    [
      'constraints',
      requirements.constraints,
      (entry) => `${entry.table}.${entry.name}`
    ],
    ['functions', requirements.functions, (entry) => entry.name],
    ['indexes', requirements.indexes, (entry) => `${entry.table}.${entry.name}`],
    [
      'triggers',
      requirements.triggers,
      (entry) => `${entry.table}.${entry.name}`
    ],
    [
      'settings',
      requirements.settings,
      (entry) => `${entry.table}.${entry.key}.${entry.jsonField}`
    ]
  ]) {
    const keys = entries.map(key);
    if (new Set(keys).size !== keys.length) {
      fail(`${description} contains a duplicate value.`);
    }
  }

  const computedChecksum = requirementsSha256(requirements);
  if (computedChecksum !== manifest.contractSha256) {
    fail(
      `Manifest checksum mismatch: expected ${manifest.contractSha256}, computed ${computedChecksum}.`
    );
  }
  return manifest;
}

export async function loadManifest() {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    fail(
      `Could not read schema contract manifest: ${
        error instanceof Error ? error.message : 'unknown error'
      }.`
    );
  }
  return validateManifest(parsed);
}

function requireContractLiteral(source, value, description) {
  if (!source.includes(value)) {
    fail(`${description} does not embed the current contract ${value}.`);
  }
}

export async function verifyRepositoryContract(manifest) {
  const [schema, migration] = await Promise.all([
    readFile(schemaPath, 'utf8'),
    readFile(migrationPath, 'utf8')
  ]);
  for (const [source, description, installationPath] of [
    [schema, 'Canonical schema', 'fresh_schema'],
    [migration, 'Terminal compatibility migration', 'existing_database']
  ]) {
    requireContractLiteral(source, manifest.contractId, description);
    requireContractLiteral(source, manifest.contractSha256, description);
    requireContractLiteral(source, installationPath, description);
  }
  if (!/\bbegin;[\s\S]*\bcommit;\s*$/iu.test(migration)) {
    fail('Terminal compatibility migration must be one explicit transaction.');
  }
}

function mapBy(rows, key) {
  return new Map(rows.map((row) => [key(row), row]));
}

function includesAll(definition, fragments) {
  const normalized = definition.toLowerCase();
  return (fragments ?? []).every((fragment) =>
    normalized.includes(fragment.toLowerCase())
  );
}

function excludesAll(definition, fragments) {
  const normalized = definition.toLowerCase();
  return (fragments ?? []).every((fragment) =>
    !normalized.includes(fragment.toLowerCase())
  );
}

function normalizedSqlDefinition(definition) {
  return definition.trim().replace(/\s+/gu, ' ');
}

function matchesRequiredDefault(actual, expected) {
  if (expected.defaultEquals === undefined) return true;
  if (typeof actual !== 'string') return false;
  return normalizedSqlDefinition(actual)
    === normalizedSqlDefinition(expected.defaultEquals);
}

function quotedIdentifier(identifier) {
  requireIdentifier(identifier, 'dynamic query');
  return `"${identifier}"`;
}

export async function verifyDatabaseContract(client, manifest) {
  const requirements = manifest.requirements;
  const ledgerReady = await client.query(
    `select to_regclass('public.app_schema_contracts') is not null as ready`
  );
  if (ledgerReady.rows[0]?.ready !== true) {
    fail('app_schema_contracts is missing.');
  }

  const requiredLedgerColumns = [
    {
      name: 'contract_id',
      dataType: 'text',
      nullable: false
    },
    {
      name: 'contract_sha256',
      dataType: 'text',
      nullable: false
    },
    {
      name: 'installed_via',
      dataType: 'text',
      nullable: false
    },
    {
      name: 'recorded_at',
      dataType: 'timestamp with time zone',
      nullable: false
    }
  ];
  const ledgerColumns = await client.query(
    `select column_name, data_type, is_nullable
       from information_schema.columns
      where table_schema = 'public'
        and table_name = 'app_schema_contracts'
        and column_name = any($1::text[])`,
    [requiredLedgerColumns.map((column) => column.name)]
  );
  const installedLedgerColumns = mapBy(
    ledgerColumns.rows,
    (row) => row.column_name
  );
  const invalidLedgerColumns = requiredLedgerColumns.filter((expected) => {
    const actual = installedLedgerColumns.get(expected.name);
    return (
      !actual
      || actual.data_type !== expected.dataType
      || (actual.is_nullable === 'YES') !== expected.nullable
    );
  });
  if (invalidLedgerColumns.length > 0) {
    fail(
      `app_schema_contracts has incompatible columns: ${invalidLedgerColumns
        .map((column) => column.name)
        .join(', ')}.`
    );
  }

  const requiredLedgerConstraints = [
    {
      name: 'app_schema_contracts_pkey',
      type: 'p',
      definitionIncludes: ['primary key', 'contract_id'],
      definitionEquals: 'PRIMARY KEY (contract_id)'
    },
    {
      name: 'app_schema_contracts_checksum_check',
      type: 'c',
      definitionIncludes: ['contract_sha256', 'a-f0-9', '64'],
      definitionEquals:
        "CHECK (contract_sha256 ~ '^[a-f0-9]{64}$'::text)"
    },
    {
      name: 'app_schema_contracts_installation_check',
      type: 'c',
      definitionIncludes: ['installed_via', 'fresh_schema', 'existing_database'],
      definitionEquals:
        "CHECK (installed_via = ANY (ARRAY['fresh_schema'::text, 'existing_database'::text]))"
    }
  ];
  const ledgerConstraints = await client.query(
    `select constraint_record.conname as constraint_name,
            constraint_record.contype as constraint_type,
            constraint_record.convalidated as validated,
            pg_get_constraintdef(constraint_record.oid, true) as definition
       from pg_constraint constraint_record
       join pg_class relation on relation.oid = constraint_record.conrelid
       join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = 'app_schema_contracts'
        and constraint_record.conname = any($1::text[])`,
    [requiredLedgerConstraints.map((constraint) => constraint.name)]
  );
  const installedLedgerConstraints = mapBy(
    ledgerConstraints.rows,
    (row) => row.constraint_name
  );
  const invalidLedgerConstraints = requiredLedgerConstraints.filter((expected) => {
    const actual = installedLedgerConstraints.get(expected.name);
    return (
      !actual
      || actual.constraint_type !== expected.type
      || actual.validated !== true
      || !includesAll(actual.definition, expected.definitionIncludes)
      || (
        expected.definitionEquals
        && normalizedSqlDefinition(actual.definition)
          !== normalizedSqlDefinition(expected.definitionEquals)
      )
    );
  });
  if (invalidLedgerConstraints.length > 0) {
    fail(
      `app_schema_contracts has incompatible constraints: ${invalidLedgerConstraints
        .map((constraint) => constraint.name)
        .join(', ')}.`
    );
  }

  const ledger = await client.query(
    `select contract_sha256
       from public.app_schema_contracts
      where contract_id = $1`,
    [manifest.contractId]
  );
  if (ledger.rows[0]?.contract_sha256 !== manifest.contractSha256) {
    fail(`Required database contract ${manifest.contractId} is missing or stale.`);
  }

  const extensions = await client.query(
    'select extname from pg_extension where extname = any($1::text[])',
    [requirements.extensions]
  );
  const installedExtensions = new Set(extensions.rows.map((row) => row.extname));
  const missingExtensions = requirements.extensions.filter(
    (extension) => !installedExtensions.has(extension)
  );
  if (missingExtensions.length > 0) {
    fail(`Missing extensions: ${missingExtensions.join(', ')}.`);
  }

  const tables = await client.query(
    `select table_name
       from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
        and table_name = any($1::text[])`,
    [requirements.tables]
  );
  const installedTables = new Set(tables.rows.map((row) => row.table_name));
  const missingTables = requirements.tables.filter(
    (table) => !installedTables.has(table)
  );
  if (missingTables.length > 0) {
    fail(`Missing tables: ${missingTables.join(', ')}.`);
  }

  const columnTables = [...new Set(requirements.columns.map((column) => column.table))];
  const columnNames = [...new Set(requirements.columns.map((column) => column.name))];
  const columns = await client.query(
    `select table_name, column_name, data_type, is_nullable, column_default
       from information_schema.columns
      where table_schema = 'public'
        and table_name = any($1::text[])
        and column_name = any($2::text[])`,
    [columnTables, columnNames]
  );
  const installedColumns = mapBy(
    columns.rows,
    (row) => `${row.table_name}.${row.column_name}`
  );
  const invalidColumns = requirements.columns.filter((expected) => {
    const actual = installedColumns.get(`${expected.table}.${expected.name}`);
    return (
      !actual
      || actual.data_type !== expected.dataType
      || (actual.is_nullable === 'YES') !== expected.nullable
      || !matchesRequiredDefault(actual.column_default, expected)
    );
  });
  if (invalidColumns.length > 0) {
    fail(
      `Missing or incompatible columns: ${invalidColumns
        .map((column) => `${column.table}.${column.name}`)
        .join(', ')}.`
    );
  }

  const constraintNames = requirements.constraints.map(
    (constraint) => constraint.name
  );
  const constraints = await client.query(
    `select relation.relname as table_name,
            constraint_record.conname as constraint_name,
            constraint_record.contype as constraint_type,
            constraint_record.convalidated as validated,
            pg_get_constraintdef(constraint_record.oid, true) as definition
       from pg_constraint constraint_record
       join pg_class relation on relation.oid = constraint_record.conrelid
       join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and constraint_record.conname = any($1::text[])`,
    [constraintNames]
  );
  const installedConstraints = mapBy(
    constraints.rows,
    (row) => `${row.table_name}.${row.constraint_name}`
  );
  const invalidConstraints = requirements.constraints.filter((expected) => {
    const actual = installedConstraints.get(`${expected.table}.${expected.name}`);
    return (
      !actual
      || actual.constraint_type !== constraintTypeCodes[expected.type]
      || actual.validated !== true
      || normalizedSqlDefinition(actual.definition)
        !== normalizedSqlDefinition(expected.definitionEquals)
      || !includesAll(actual.definition, expected.definitionIncludes)
      || !excludesAll(actual.definition, expected.definitionExcludes)
    );
  });
  if (invalidConstraints.length > 0) {
    fail(
      `Missing or incompatible constraints: ${invalidConstraints
        .map((constraint) => `${constraint.table}.${constraint.name}`)
        .join(', ')}.`
    );
  }

  const functions = await client.query(
    `select routine.proname as function_name,
            routine.prosrc as body,
            language.lanname as language,
            routine.prosecdef as security_definer,
            routine.proleakproof as leakproof,
            routine.proisstrict as strict,
            routine.proconfig as configuration,
            routine.provolatile as volatility,
            routine.proparallel as parallel,
            routine.prokind as kind,
            pg_get_function_result(routine.oid) as result,
            pg_get_functiondef(routine.oid) as definition
       from pg_proc routine
       join pg_namespace namespace on namespace.oid = routine.pronamespace
       join pg_language language on language.oid = routine.prolang
      where namespace.nspname = 'public'
        and routine.proname = any($1::text[])
        and pg_get_function_identity_arguments(routine.oid) = ''`,
    [requirements.functions.map((routine) => routine.name)]
  );
  const installedFunctions = mapBy(functions.rows, (row) => row.function_name);
  const invalidFunctions = requirements.functions.filter((expected) => {
    const actual = installedFunctions.get(expected.name);
    const bodySha256 = actual
      ? createHash('sha256').update(actual.body, 'utf8').digest('hex')
      : null;
    return (
      !actual
      || bodySha256 !== expected.bodySha256
      || actual.language !== expected.language
      || actual.security_definer !== expected.securityDefiner
      || actual.leakproof !== expected.leakproof
      || actual.strict !== expected.strict
      || actual.configuration !== expected.configuration
      || actual.volatility !== functionVolatilityCodes[expected.volatility]
      || actual.parallel !== functionParallelCodes[expected.parallel]
      || actual.kind !== 'f'
      || actual.result !== expected.returns
      || !includesAll(actual.definition, expected.definitionIncludes)
    );
  });
  if (invalidFunctions.length > 0) {
    fail(
      `Missing or incompatible functions: ${invalidFunctions
        .map((routine) => routine.name)
        .join(', ')}.`
    );
  }

  const indexes = await client.query(
    `select table_relation.relname as table_name,
            index_relation.relname as index_name,
            index_record.indisvalid as valid,
            index_record.indisready as ready,
            pg_get_indexdef(index_record.indexrelid) as definition
       from pg_index index_record
       join pg_class index_relation on index_relation.oid = index_record.indexrelid
       join pg_class table_relation on table_relation.oid = index_record.indrelid
       join pg_namespace namespace on namespace.oid = index_relation.relnamespace
      where namespace.nspname = 'public'
        and index_relation.relname = any($1::text[])`,
    [requirements.indexes.map((index) => index.name)]
  );
  const installedIndexes = mapBy(
    indexes.rows,
    (row) => `${row.table_name}.${row.index_name}`
  );
  const invalidIndexes = requirements.indexes.filter((expected) => {
    const actual = installedIndexes.get(`${expected.table}.${expected.name}`);
    return (
      !actual
      || actual.valid !== true
      || actual.ready !== true
      || normalizedSqlDefinition(actual.definition)
        !== normalizedSqlDefinition(expected.definitionEquals)
      || !includesAll(actual.definition, expected.definitionIncludes)
    );
  });
  if (invalidIndexes.length > 0) {
    fail(
      `Missing or invalid indexes: ${invalidIndexes
        .map((index) => `${index.table}.${index.name}`)
        .join(', ')}.`
    );
  }

  const triggers = await client.query(
    `select relation.relname as table_name,
            trigger_record.tgname as trigger_name,
            trigger_record.tgenabled as enabled,
            routine.proname as function_name,
            pg_get_triggerdef(trigger_record.oid, true) as definition
       from pg_trigger trigger_record
       join pg_class relation on relation.oid = trigger_record.tgrelid
       join pg_namespace namespace on namespace.oid = relation.relnamespace
       join pg_proc routine on routine.oid = trigger_record.tgfoid
       join pg_namespace routine_namespace
         on routine_namespace.oid = routine.pronamespace
      where namespace.nspname = 'public'
        and routine_namespace.nspname = 'public'
        and not trigger_record.tgisinternal
        and trigger_record.tgname = any($1::text[])`,
    [requirements.triggers.map((trigger) => trigger.name)]
  );
  const installedTriggers = mapBy(
    triggers.rows,
    (row) => `${row.table_name}.${row.trigger_name}`
  );
  const invalidTriggers = requirements.triggers.filter((expected) => {
    const actual = installedTriggers.get(`${expected.table}.${expected.name}`);
    return (
      !actual
      || actual.enabled !== 'O'
      || actual.function_name !== expected.function
      || normalizedSqlDefinition(actual.definition)
        !== normalizedSqlDefinition(expected.definitionEquals)
      || !includesAll(actual.definition, expected.definitionIncludes)
    );
  });
  if (invalidTriggers.length > 0) {
    fail(
      `Missing or disabled triggers: ${invalidTriggers
        .map((trigger) => `${trigger.table}.${trigger.name}`)
        .join(', ')}.`
    );
  }

  for (const setting of requirements.settings) {
    const result = await client.query(
      `select jsonb_typeof(config_json -> $2) as value_type
         from public.${quotedIdentifier(setting.table)}
        where key = $1`,
      [setting.key, setting.jsonField]
    );
    if (
      result.rows.length !== 1
      || result.rows[0].value_type !== setting.jsonType
    ) {
      fail(
        `Required setting ${setting.table}.${setting.key}.${setting.jsonField} is missing or invalid.`
      );
    }
  }
}

async function verifyConfiguredDatabase(manifest) {
  const connectionString = resolveDatabaseUrl(process.env);
  if (!connectionString) {
    fail('A database connection string is required.');
  }

  const pool = new Pool({
    connectionString,
    ssl: resolveDatabaseSslConfig(connectionString, process.env),
    max: 1,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000
  });
  let client;
  let transactionStarted = false;
  try {
    client = await pool.connect();
    await client.query('begin read only');
    transactionStarted = true;
    await client.query('set local search_path = public, pg_temp');
    await client.query(`set local statement_timeout = '15s'`);
    await client.query(`set local lock_timeout = '5s'`);
    await verifyDatabaseContract(client, manifest);
    await client.query('rollback');
    transactionStarted = false;
  } finally {
    if (client) {
      if (transactionStarted) {
        await client.query('rollback').catch(() => undefined);
      }
      client.release();
    }
    await pool.end();
  }
}

async function main() {
  const command = process.argv[2];
  if (!['--files-only', '--require-database'].includes(command)) {
    fail(
      'Usage: node scripts/check-database-schema.mjs <--files-only|--require-database>.'
    );
  }

  const manifest = await loadManifest();
  await verifyRepositoryContract(manifest);
  if (command === '--require-database') {
    await verifyConfiguredDatabase(manifest);
  }
  console.info(
    `[schema-contract] Verified ${manifest.contractId}${
      command === '--files-only' ? ' repository bindings' : ' against the configured database'
    }.`
  );
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(scriptPath)) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : '[schema-contract] Unknown failure.'
    );
    process.exitCode = 1;
  });
}
