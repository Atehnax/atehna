import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const projectRoot = process.cwd();
const contractId = '20260907.historical-orders-v6';
const contractSha256 =
  '2f9d3f55493eb28a40d6b16f025e8b40ca482c5d0d87e1023c3ab72d64b074af';

const source = (relativePath: string) =>
  readFileSync(resolve(projectRoot, relativePath), 'utf8');

const stableSerialize = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`;
  }
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`)
    .join(',')}}`;
};

test('schema manifest carries a deterministic requirements checksum', () => {
  const manifest = JSON.parse(source('database/schema-contract.json')) as {
    contractId: string;
    contractSha256: string;
    requirements: {
      tables: string[];
      [key: string]: unknown;
    };
  };
  const calculated = createHash('sha256')
    .update(stableSerialize(manifest.requirements), 'utf8')
    .digest('hex');

  assert.equal(manifest.contractId, contractId);
  assert.equal(manifest.contractSha256, contractSha256);
  assert.match(manifest.contractSha256, /^[a-f0-9]{64}$/u);
  assert.equal(calculated, manifest.contractSha256);

  const schemaTables = [
    ...source('database/schema.sql').matchAll(
      /^create table ([a-z0-9_]+) \(/gmu
    )
  ].map((match) => match[1]).sort();
  assert.equal(manifest.requirements.tables.length, 71);
  assert.deepEqual(
    [...manifest.requirements.tables, 'app_schema_contracts'].sort(),
    schemaTables
  );
});

test('repository bindings pass the schema contract checker', () => {
  const output = execFileSync(
    process.execPath,
    [resolve(projectRoot, 'scripts/check-database-schema.mjs'), '--files-only'],
    {
      cwd: projectRoot,
      encoding: 'utf8'
    }
  );

  assert.match(output, new RegExp(`Verified ${contractId} repository bindings`, 'u'));
});

test('Vercel packages the runtime manifest without database SQL artifacts', () => {
  const ignoredDatabaseFiles = execFileSync(
    'git',
    [
      'ls-files',
      '-ci',
      '--exclude-from=.vercelignore',
      '--',
      'database'
    ],
    {
      cwd: projectRoot,
      encoding: 'utf8'
    }
  );

  assert.doesNotMatch(
    ignoredDatabaseFiles,
    /^database\/schema-contract\.json$/mu
  );
  assert.match(ignoredDatabaseFiles, /^database\/schema\.sql$/mu);

  assert.match(source('.vercelignore'), /^\/database\/\*$/mu);
});

test('every named manifest requirement is bound to the canonical schema', () => {
  const manifest = JSON.parse(source('database/schema-contract.json')) as {
    requirements: {
      extensions: string[];
      tables: string[];
      columns: Array<{
        table: string;
        name: string;
        defaultEquals?: string | null;
        defaultIncludes?: string[];
      }>;
      constraints: Array<{
        table: string;
        name: string;
        type: 'check' | 'foreign_key';
        definitionEquals: string;
        definitionIncludes?: string[];
        definitionExcludes?: string[];
      }>;
      functions: Array<{
        name: string;
        bodySha256: string;
        definitionIncludes: string[];
      }>;
      indexes: Array<{
        table: string;
        name: string;
        definitionEquals: string;
        definitionIncludes: string[];
      }>;
      triggers: Array<{
        table: string;
        name: string;
        function: string;
        definitionEquals: string;
        definitionIncludes: string[];
      }>;
      settings: Array<{
        table: string;
        jsonField: string;
        jsonType: string;
      }>;
    };
  };
  const schema = source('database/schema.sql');
  const requirements = manifest.requirements;
  const requiredNames = new Set([
    ...requirements.extensions,
    ...requirements.tables,
    ...requirements.columns.flatMap((entry) => [entry.table, entry.name]),
    ...requirements.constraints.flatMap((entry) => [entry.table, entry.name]),
    ...requirements.functions.map((entry) => entry.name),
    ...requirements.indexes.flatMap((entry) => [entry.table, entry.name]),
    ...requirements.triggers.flatMap((entry) => [
      entry.table,
      entry.name,
      entry.function
    ]),
    ...requirements.settings.flatMap((entry) => [entry.table, entry.jsonField])
  ]);

  for (const requiredName of requiredNames) {
    assert.ok(schema.includes(requiredName), 'schema is missing ' + requiredName);
  }

  const semanticFragments = new Set([
    ...requirements.columns.flatMap((entry) => entry.defaultIncludes ?? []),
    ...requirements.constraints.flatMap(
      (entry) => entry.definitionIncludes ?? []
    ),
    ...requirements.functions.flatMap((entry) => entry.definitionIncludes),
    ...requirements.indexes.flatMap((entry) => entry.definitionIncludes),
    ...requirements.triggers.flatMap((entry) => entry.definitionIncludes),
    ...requirements.settings.map((entry) => entry.jsonType)
  ]);
  for (const fragment of semanticFragments) {
    // PostgreSQL emits USING btree for primary keys and omitted index methods.
    const implicitBtree = fragment === 'btree'
      && requirements.indexes.filter((entry) => entry.definitionIncludes.includes(fragment))
        .every((entry) => entry.definitionEquals.includes('USING btree'));
    assert.ok(
      implicitBtree || schema.toLowerCase().includes(fragment.toLowerCase()),
      'schema is missing semantic fragment ' + fragment
    );
  }
});

test('contract requires insert defaults while treating inventory policy as mutable', () => {
  const manifest = JSON.parse(source('database/schema-contract.json')) as {
    requirements: {
      columns: Array<{
        table: string;
        name: string;
        defaultEquals?: string | null;
        defaultIncludes?: string[];
      }>;
      settings: Array<Record<string, unknown>>;
    };
  };
  const defaults = Object.fromEntries(
    manifest.requirements.columns
      .filter((column) => column.defaultIncludes !== undefined)
      .map((column) => [
        column.table + '.' + column.name,
        column.defaultIncludes
      ])
  );

  assert.deepEqual(defaults, {
    'diagnostics_events.error': ["false"],
    'diagnostics_events.phases_json': ["'{}'::jsonb"],
    'diagnostics_events.details_json': ["'{}'::jsonb"],
    'retired_configuration_archive.captured_at': ["now()"],
    'analytics_geography_backfill.after_order_id': ["0"],
    'analytics_geography_backfill.processed_count': ["0"],
    'analytics_geography_backfill.updated_at': ["now()"],
    'analytics_geography_references.created_at': ["now()"],
    'order_analytics_change_log.changed_at': ["now()"],
    'order_geography_audit.created_at': ["now()"],
    'order_geography_resolutions.resolved_at': ["now()"],
    'order_geography_resolutions.manual_override': ["false"],
    'orders.analytics_is_test': ["false"],
    'orders.refund_history_complete': ["false"],
    'orders.analytics_measurement_revision': ["0"],
    'order_documents.order_delivery_plan_revision': ['1'],
    'order_items.ship_later': ['false'],
    'orders.contract_status': ['pending_seller_acceptance'],
    'orders.delivery_plan_revision': ['1'],
    'orders.public_code_base': ['generate_public_code_base'],
    'orders.stock_enforcement_applied': ['true'],
    'quote_requests.intake_source': ['customer_web'],
    'quote_requests.public_code_base': ['generate_public_code_base']
  });
  const exactDefaults = Object.fromEntries(
    manifest.requirements.columns
      .filter((column) => column.defaultEquals !== undefined)
      .map((column) => [
        column.table + '.' + column.name,
        column.defaultEquals
      ])
  );
  assert.deepEqual(exactDefaults, {
    "business_analytics_settings.revision": "0",
    "business_analytics_settings.updated_at": "now()",
    "deleted_archive_entries.expires_at": null,
    "order_historical_changes.id": "nextval('order_historical_changes_id_seq'::regclass)",
    "order_historical_changes.changed_at": "clock_timestamp()",
    "orders.is_historical": "false",
    "orders.recorded_at": "clock_timestamp()",
    "orders.historical_revision": "0",
    'catalog_item_variants.stock_revision': '0',
    'catalog_item_variants.pricing_revision': '0',
    'pricing_stock_history.id': "nextval('pricing_stock_history_id_seq'::regclass)",
    'pricing_stock_history.occurred_at': 'clock_timestamp()',
    'pricing_stock_model.revision': '0',
    'pricing_stock_model.updated_at': 'now()',
    'diagnostics_events.error': "false",
    'diagnostics_events.phases_json': "'{}'::jsonb",
    'diagnostics_events.details_json': "'{}'::jsonb",
    'retired_configuration_archive.captured_at': "now()",
    'analytics_geography_backfill.after_order_id': "0",
    'analytics_geography_backfill.processed_count': "0",
    'analytics_geography_backfill.updated_at': "now()",
    'analytics_geography_references.created_at': "now()",
    'order_analytics_change_log.changed_at': "now()",
    'order_geography_audit.created_at': "now()",
    'order_geography_resolutions.resolved_at': "now()",
    'order_geography_resolutions.manual_override': "false",
    'orders.analytics_is_test': "false",
    'orders.refund_history_complete': "false",
    'orders.analytics_measurement_revision': "0",
    'order_documents.order_delivery_plan_revision': '1',
    'order_items.ship_later': 'false',
    'orders.contract_status': "'pending_seller_acceptance'::text",
    'orders.delivery_plan_revision': '1',
    'orders.public_code_base': 'generate_public_code_base()',
    'orders.stock_enforcement_applied': 'true',
    'quote_requests.intake_source': "'customer_web'::text",
    'quote_requests.public_code_base': 'generate_public_code_base()'
  });
  assert.deepEqual(manifest.requirements.settings, [
    {
      table: 'inventory_policy_settings',
      key: 'default',
      jsonField: 'stockEnforcementEnabled',
      jsonType: 'boolean'
    },
    { table: 'pricing_stock_model', key: 'default', jsonField: 'formulaVersion', jsonType: 'number' },
    { table: 'pricing_stock_model', key: 'default', jsonField: 'formula', jsonType: 'string' },
    { table: 'pricing_stock_model', key: 'default', jsonField: 'parameters', jsonType: 'object' }
  ]);
  const checker = source('scripts/check-database-schema.mjs');
  assert.match(checker, /column_default/u);
  assert.match(checker, /matchesRequiredDefault/u);
  assert.match(checker, /normalizedSqlDefinition\(expected\.defaultEquals\)/u);
  assert.match(checker, /result\.rows\[0\]\.value_type !== setting\.jsonType/u);
});

test('contract binds exact constraint semantics, indexes, triggers, and guard bodies', () => {
  const manifest = JSON.parse(source('database/schema-contract.json')) as {
    requirements: {
      constraints: Array<{
        type: 'check' | 'foreign_key';
        definitionEquals: string;
      }>;
      functions: Array<{
        name: string;
        bodySha256: string;
        language: string;
        securityDefiner: boolean;
        leakproof: boolean;
        strict: boolean;
        configuration: null;
        volatility: string;
        parallel: string;
        returns: string;
        definitionIncludes: string[];
      }>;
      indexes: Array<{
        name: string;
        definitionEquals: string;
        definitionIncludes: string[];
      }>;
      triggers: Array<{
        function: string;
        definitionEquals: string;
        definitionIncludes: string[];
      }>;
    };
  };
  const functionNames = new Set(
    manifest.requirements.functions.map((routine) => routine.name)
  );

  for (const constraint of manifest.requirements.constraints) {
    assert.ok(['check', 'foreign_key'].includes(constraint.type));
    assert.match(constraint.definitionEquals, /^(?:CHECK|FOREIGN KEY) /u);
  }
  for (const trigger of manifest.requirements.triggers) {
    assert.ok(functionNames.has(trigger.function));
    assert.match(trigger.definitionEquals, /^CREATE TRIGGER /u);
    assert.ok(trigger.definitionIncludes.includes(trigger.function === 'record_catalog_variant_pricing_stock' ? 'after' : 'before'));
    assert.ok(trigger.definitionIncludes.includes('for each row'));
  }
  for (const index of manifest.requirements.indexes) {
    assert.match(index.definitionEquals, /^CREATE (?:UNIQUE )?INDEX /u);
    assert.ok(index.definitionIncludes.length >= 2);
  }
  for (const routine of manifest.requirements.functions) {
    assert.match(routine.bodySha256, /^[a-f0-9]{64}$/u);
    assert.equal(routine.language, 'plpgsql');
    assert.equal(routine.securityDefiner, false);
    assert.equal(routine.leakproof, false);
    assert.equal(routine.strict, false);
    assert.equal(routine.configuration, null);
    assert.equal(routine.volatility, 'volatile');
    assert.equal(routine.parallel, 'unsafe');
    assert.ok(['text', 'trigger'].includes(routine.returns));
    assert.ok(routine.definitionIncludes.length >= 2);
  }
  const checker = source('scripts/check-database-schema.mjs');
  assert.match(checker, /pg_get_indexdef/u);
  assert.match(checker, /pg_get_triggerdef/u);
  assert.match(checker, /function normalizedFunctionBody/u);
  assert.match(
    checker,
    /update\(normalizedFunctionBody\(actual\.body\), 'utf8'\)/u
  );
  assert.match(checker, /routine\.proconfig as configuration/u);
  assert.match(checker, /constraint_record\.contype as constraint_type/u);
  assert.match(checker, /normalizedSqlDefinition\(expected\.definitionEquals\)/u);
  assert.match(
    checker,
    /function normalizedSqlDefinition\(definition\) \{\s*return definition\.trim\(\)\.replace\(\/\\s\+\/gu, ' '\);\s*\}/u
  );
});

test('fresh schema records its contract after every object in one transaction', () => {
  const schema = source('database/schema.sql');
  const ledgerCreateAt = schema.indexOf('create table app_schema_contracts');
  const terminalObjectAt = schema.lastIndexOf('create trigger catalog_variant_pricing_stock_history');
  const contractInsertAt = schema.lastIndexOf('insert into app_schema_contracts');
  const commitAt = schema.lastIndexOf('commit;');

  assert.ok(ledgerCreateAt > schema.indexOf('create extension if not exists pgcrypto'));
  assert.ok(contractInsertAt > terminalObjectAt);
  assert.ok(commitAt > contractInsertAt);
  assert.equal(schema.match(/^begin;/gmu)?.length, 1);
  assert.equal(schema.match(/^commit;/gmu)?.length, 1);
  assert.match(schema, new RegExp(contractId, 'u'));
  assert.match(schema, new RegExp(contractSha256, 'u'));
  assert.match(schema, /'fresh_schema'/u);
  assert.doesNotMatch(schema, /202608(?:28|29|30|31)_|20260901_/u);
});

test('database checker is read-only and requires the exact contract row', () => {
  const checker = source('scripts/check-database-schema.mjs');

  assert.match(checker, /from '\.\.\/src\/shared\/server\/environmentCore\.mjs'/u);
  assert.match(checker, /resolveDatabaseUrl\(process\.env\)/u);
  assert.match(
    checker,
    /ssl: resolveDatabaseSslConfig\(connectionString, process\.env\)/u
  );
  assert.match(checker, /begin read only/u);
  assert.match(checker, /set local search_path = public, pg_temp/u);
  assert.match(checker, /where contract_id = \$1/u);
  assert.match(checker, /from public\.app_schema_contracts/u);
  assert.match(checker, /from public\.\$\{quotedIdentifier\(setting\.table\)\}/u);
  assert.match(checker, /ledger\.rows\[0\]\?\.contract_sha256/u);
  assert.match(
    checker,
    /pg_get_function_identity_arguments\(routine\.oid\) = ''/u
  );
  assert.match(checker, /requiredLedgerColumns/u);
  assert.match(checker, /app_schema_contracts_pkey/u);
  assert.match(checker, /app_schema_contracts_checksum_check/u);
  assert.match(checker, /app_schema_contracts_installation_check/u);
  assert.doesNotMatch(checker, /max\s*\(\s*contract_id|order by\s+recorded_at/iu);
  assert.doesNotMatch(
    checker,
    /client\.query\(\s*[`'"]\s*(?:create|alter|drop|insert|update|delete)\b/iu
  );
});


test('v4 requires retired analytics to be absent and persistent diagnostics to exist', () => {
  const manifest = JSON.parse(source('database/schema-contract.json'));
  assert.deepEqual(manifest.requirements.absentTables, ['analytics_charts', 'analytics_chart_settings']);
  assert.deepEqual(manifest.requirements.absentFunctions, ['set_analytics_charts_updated_at']);
  assert.ok(manifest.requirements.tables.includes('diagnostics_events'));
  assert.ok(manifest.requirements.tables.includes('retired_configuration_archive'));
  const checker = source('scripts/check-database-schema.mjs');
  assert.ok(checker.includes('requirements.absentTables'));
  assert.ok(checker.includes('requirements.absentFunctions'));
});


test('v6 binds durable history, provenance and the absence of trash expiry defaults', () => {
  const manifest = JSON.parse(source('database/schema-contract.json'));
  assert.deepEqual(
    manifest.requirements.columns.find((column: {table: string; name: string}) =>
      column.table === 'deleted_archive_entries' && column.name === 'expires_at'),
    {table: 'deleted_archive_entries', name: 'expires_at', dataType: 'timestamp with time zone', nullable: true, defaultEquals: null}
  );
  assert.deepEqual(manifest.requirements.requiredRows, [{table: 'business_analytics_settings', key: 'default'}]);
  for (const guard of ['protect_order_entry_evidence', 'reject_historical_order_stock_hold', 'protect_order_audit_history', 'protect_historical_change_log']) {
    assert.ok(manifest.requirements.functions.some((routine: {name: string}) => routine.name === guard));
    assert.ok(manifest.requirements.triggers.some((trigger: {function: string}) => trigger.function === guard));
  }
  const historicalCheck = manifest.requirements.constraints.find((constraint: {name: string}) => constraint.name === 'orders_historical_guard_check');
  assert.match(historicalCheck.definitionEquals, /NOT .*IS DISTINCT FROM.*manual/iu);
  assert.match(source('scripts/check-database-schema.mjs'), /expected.defaultEquals === null.*actual === null/u);
});
