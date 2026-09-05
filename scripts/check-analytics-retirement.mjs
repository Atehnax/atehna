import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { readE2eEnvironment } from './e2e-database.mjs';
import { loadManifest, verifyDatabaseContract } from './check-database-schema.mjs';

const { databaseUrl, databaseName } = readE2eEnvironment();
const pool = new Pool({ connectionString: databaseUrl, ssl: false });
const client = await pool.connect();
const migration = await readFile('database/migrations/20260905_analytics_retirement.sql', 'utf8');
// Run the exact migration statements within a fixture transaction that is rolled back.
const statements = migration.replace(/^begin;\s*$/m, '').replace(/^commit;\s*$/m, '');
const manifest = await loadManifest();
try {
  assert.equal((await client.query('select current_database() as name')).rows[0].name, databaseName);
  await verifyDatabaseContract(client, manifest);
  await client.query('begin');
  await client.query(`create table analytics_charts (id bigserial primary key, dashboard_key text, title text, config_json jsonb);
    create table analytics_chart_settings (dashboard_key text primary key, settings_json jsonb);
    create function set_analytics_charts_updated_at() returns trigger language plpgsql as $function$ begin return new; end; $function$;`);
  const originalChart = (await client.query(`insert into analytics_charts (dashboard_key, title, config_json)
    values ('fixture', 'Lastna nastavitev ČŠŽ', '{"series":[{"color":"#123456","field":"original"}],"showLegend":false}'::jsonb)
    returning id::text, to_jsonb(analytics_charts) as payload`)).rows[0];
  const originalSettings = (await client.query(`insert into analytics_chart_settings (dashboard_key, settings_json)
    values ('fixture', '{"gridOpacity":0.35,"palette":["#123456"]}'::jsonb) returning to_jsonb(analytics_chart_settings) as payload`)).rows[0].payload;
  await client.query('savepoint conflicting_archive');
  await client.query(`insert into retired_configuration_archive (source_table, source_key, payload) values ('analytics_charts', $1, '{"wrong":true}'::jsonb)`, [originalChart.id]);
  await assert.rejects(client.query(statements), /does not exactly preserve/);
  await client.query('rollback to savepoint conflicting_archive');
  assert.equal((await client.query('select count(*)::int as count from analytics_charts')).rows[0].count, 1, 'Archive mismatch must leave the source intact.');
  await client.query(statements);
  for (const [sourceTable, sourceKey, payload] of [['analytics_charts', originalChart.id, originalChart.payload], ['analytics_chart_settings', 'fixture', originalSettings]]) {
    const archived = (await client.query('select payload from retired_configuration_archive where source_table=$1 and source_key=$2', [sourceTable, sourceKey])).rows[0];
    assert.deepEqual(archived.payload, payload);
  }
  assert.equal((await client.query("select to_regclass('analytics_charts') as chart, to_regclass('analytics_chart_settings') as settings, to_regprocedure('set_analytics_charts_updated_at()') as routine")).rows[0].chart, null);
  await verifyDatabaseContract(client, manifest);
  const countBefore = (await client.query('select count(*)::int as count from retired_configuration_archive')).rows[0].count;
  await client.query(statements);
  assert.equal((await client.query('select count(*)::int as count from retired_configuration_archive')).rows[0].count, countBefore, 'Repeating retirement must not duplicate archives.');
  await client.query('savepoint retired_object');
  await client.query('create table analytics_charts (id integer)');
  await assert.rejects(verifyDatabaseContract(client, manifest), /Retired analytics relations remain/);
  await client.query('rollback to savepoint retired_object');
  await client.query('savepoint invalid_diagnostic');
  await assert.rejects(client.query(`insert into diagnostics_events (id, recorded_at, trace_id, context, operation, kind, duration_ms)
    values ($1, now(), $2, '/fixture', 'fixture', 'loader', -1)`, [randomUUID(), randomUUID()]), /diagnostics_events_duration_check/);
  await client.query('rollback to savepoint invalid_diagnostic');
  await client.query('rollback');
  console.info('Verified isolated analytics retirement: exact archive preservation, conflict rollback, removal, idempotence, v4 absence enforcement and diagnostics constraint. All fixture changes rolled back.');
} finally {
  await client.query('rollback').catch(() => undefined);
  client.release(); await pool.end();
}
