import assert from 'node:assert/strict';
import test from 'node:test';
import pg, { type PoolClient } from 'pg';
import { queueRemovedCatalogMediaFiles } from '../../src/shared/server/catalogMediaDeletion';
import { objectId, reviewObjects, selectCandidates, type Config, type ObjectInfo, type Scan } from '../../scripts/storage/lifecycle';
import { patterns, referenceSql } from '../../scripts/storage/postgres';

// SELECT-only fixtures: no tables, rows, outbox entries, or blob objects are mutated.
const pathname = 'catalog-items/reference-test/native-a.png';
const url = 'https://referencefixture.public.blob.vercel-storage.com/' + pathname;
const crop = {
  id: 2, blob_pathname: 'catalog-items/reference-test/crop-b.png',
  blob_url: 'https://referencefixture.public.blob.vercel-storage.com/catalog-items/reference-test/crop-b.png',
  external_url: null, image_dimensions: { width: 1800, height: 500, originalUrl: url, originalWidth: 2400, originalHeight: 1600 }
};
const fixtureColumns = 'id bigint, blob_pathname text, blob_url text, external_url text, image_dimensions jsonb';

async function readOnlyFixture(run: (client: pg.Client) => Promise<void>) {
  const raw = process.env.STORAGE_REFERENCE_READONLY_URL;
  assert.ok(raw, 'Set STORAGE_REFERENCE_READONLY_URL to the owned local catalog database.');
  const endpoint = new URL(raw);
  assert.equal(endpoint.hostname, '127.0.0.1');
  assert.equal(endpoint.port, '55434');
  assert.equal(endpoint.pathname, '/atehna_e2e_localhost_quote');
  const client = new pg.Client({ connectionString: raw, ssl: false,
    options: '-c default_transaction_read_only=on -c statement_timeout=10000' });
  await client.connect();
  try {
    await client.query('begin read only');
    await client.query('set local search_path=pg_catalog');
    const identity = (await client.query("select current_database() as name,current_setting('transaction_read_only') as read_only")).rows[0];
    assert.equal(identity.name, 'atehna_e2e_localhost_quote');
    assert.equal(identity.read_only, 'on');
    await run(client);
  } finally {
    await client.query('rollback');
    await client.end();
  }
}

test('deleting A cannot queue its bytes while B retains A only as its original zoom source', async () => {
  let captured: { sql: string; values: unknown[] } | undefined;
  const captureClient = { query: async (sql: string, values: unknown[]) => {
    captured = { sql, values };
    return { rows: [], rowCount: 0 };
  } } as unknown as PoolClient;
  await queueRemovedCatalogMediaFiles(captureClient, 1, [{
    source_kind: 'upload', blob_pathname: pathname, blob_url: url
  }]);
  assert.ok(captured);
  // Execute the real queue SELECT predicate, with its INSERT removed and catalog_media shadowed by fixture values.
  const select = captured.sql.slice(captured.sql.indexOf('select distinct'), captured.sql.lastIndexOf('on conflict'));
  assert.match(select, /^select distinct/u);
  assert.doesNotMatch(select, /\b(?:insert|update|delete)\b/iu);
  const query = 'with catalog_media as (select * from jsonb_to_recordset($3::jsonb) as fixture(' + fixtureColumns + ')) ' + select;
  const values = captured.values;
  await readOnlyFixture(async (client) => {
    assert.equal((await client.query(query, [...values, JSON.stringify([crop])])).rowCount, 0);
    const unrelated = { ...crop, image_dimensions: { ...crop.image_dimensions, originalUrl: crop.blob_url } };
    const released = await client.query(query, [...values, JSON.stringify([unrelated])]);
    assert.equal(released.rowCount, 1);
    assert.equal(released.rows[0].target, pathname);
    assert.equal((await client.query(query, [...values, '[]'])).rowCount, 1);
  });
});

test('the lifecycle recursive JSON scan finds crop originals and blocks selection of a stale queued object', async () => {
  const config: Config = { version: 1, connectionEnv: 'STORAGE_REFERENCE_READONLY_URL', expectedHost: '127.0.0.1', expectedPort: 55434,
    databases: ['atehna_e2e_localhost_quote'], minimumAgeHours: 24,
    stores: [{ id: 'store_referencefixture', access: 'public', oidcTokenEnv: 'UNUSED_TEST_AUTH', ownedPrefixes: ['catalog-items/'] }] };
  const object: ObjectInfo = { id: objectId(config.stores[0].id, pathname), storeId: config.stores[0].id,
    access: 'public', pathname, url, size: 12, uploadedAt: '2025-01-01T00:00:00Z' };
  await readOnlyFixture(async (client) => {
    const source = 'select row_number() over () as ordinal,to_jsonb(fixture) as payload from jsonb_to_recordset($2::jsonb) as fixture(' + fixtureColumns + ')';
    const found = (await client.query(referenceSql(source), [JSON.stringify(patterns([object])), JSON.stringify([crop])])).rows;
    assert.deepEqual(found, [{ id: object.id, rows: 1, possible: false }]);
    const scan: Scan = { complete: true, issues: [], databases: [{ database: config.databases[0], tables: 1, readOnly: true, tlsVerified: false }],
      references: { [object.id]: [{ database: config.databases[0], table: 'public.catalog_media', rows: found[0].rows, possible: found[0].possible }] },
      intents: { [object.id]: [{ database: config.databases[0], row: { id: '1', blob_target: pathname, source_item_type: 'product_media' } }] } };
    const review = reviewObjects(config, [object], scan);
    assert.equal(review.objects[0].candidate, false);
    assert.ok(review.objects[0].blockers.includes('retained-database-reference'));
    assert.throws(() => selectCandidates(review, [object.id]), /SELECTED_OBJECT_IS_NOT_A_CANDIDATE/u);
  });
});
