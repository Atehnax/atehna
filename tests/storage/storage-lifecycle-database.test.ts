import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
import { acknowledgeOutbox, scanDatabases } from '../../scripts/storage/postgres';
import { objectId, type Config, type ObjectInfo, type PreparedObject } from '../../scripts/storage/lifecycle';
test('real PostgreSQL retains historical/schema references and acknowledges only exact recovered queue rows', async () => {
    const raw = process.env.STORAGE_LIFECYCLE_TEST_ADMIN_URL;
    assert.ok(raw, 'Set STORAGE_LIFECYCLE_TEST_ADMIN_URL to an owned loopback PostgreSQL admin connection.');
    const url = new URL(raw);
    assert.equal(url.hostname, '127.0.0.1');
    assert.equal(url.pathname, '/postgres');
    const database = `atehna_e2e_storage_lifecycle_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const marker = `owned-storage-lifecycle-test-${randomUUID()}`;
    const options = { host: '127.0.0.1', port: Number(url.port || 5432), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), ssl: false as const };
    const admin = new pg.Client({ ...options, database: 'postgres' });
    await admin.connect();
    let created = false, oid = '', fixture: pg.Client | undefined;
    try {
        assert.equal((await admin.query('select 1 from pg_database where datname=$1', [database])).rowCount, 0);
        await admin.query(`create database "${database}" template template0`);
        created = true;
        await admin.query(`comment on database "${database}" is '${marker}'`);
        oid = (await admin.query('select oid::text from pg_database where datname=$1', [database])).rows[0].oid;
        fixture = new pg.Client({ ...options, database });
        await fixture.connect();
        await fixture.query(`create table archive_blob_deletion_outbox(id bigint primary key,blob_target text not null,source_item_type text not null,source_order_id bigint,source_document_id bigint,source_product_id bigint,queued_at timestamptz default now(),attempt_count integer default 0,last_attempt_at timestamptz,last_error text);
      create table order_snapshots(deleted_at timestamptz,payload jsonb);
      create table analytics_geography_references(full_geometry_json jsonb,render_geometry_json jsonb)`);
        const config: Config = { version: 1, connectionEnv: 'STORAGE_LIFECYCLE_FIXTURE_URL', expectedHost: '127.0.0.1', expectedPort: options.port, databases: [database], minimumAgeHours: 24, stores: [{ id: 'store_Test001', access: 'public', oidcTokenEnv: 'UNUSED_TEST_AUTH', ownedPrefixes: ['catalog-items/'] }] };
        const fixtureUrl = new URL(raw);
        fixtureUrl.pathname = `/${database}`;
        process.env.STORAGE_LIFECYCLE_FIXTURE_URL = fixtureUrl.toString();
        const object = (file: string): ObjectInfo => { const pathname = `catalog-items/test/${file}`; return { id: objectId('store_Test001', pathname), storeId: 'store_Test001', access: 'public', pathname, url: `https://example.public.blob.vercel-storage.com/${pathname}`, size: 12, uploadedAt: '2025-01-01T00:00:00.000Z' }; };
        const historical = object('historical.png'), queued = object('queued.png'), malformed = object('malformed.png'), defaultOnly = object('default.png'), materialized = object('materialized.png'), orphan = object('orphan.png');
        await fixture.query('insert into order_snapshots values(now(),$1)', [JSON.stringify({ history: [{ image: historical.url }] })]);
        await fixture.query('insert into archive_blob_deletion_outbox(id,blob_target,source_item_type,source_product_id) values($1,$2,$3,$4)', ['9007199254740993', queued.pathname, 'product_media', '9007199254740995']);
        const geometry = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [malformed.url] } }] };
        await fixture.query('insert into analytics_geography_references values($1,$1)', [JSON.stringify(geometry)]);
        // Fixed invented URLs only; no external requests are made by these persisted definitions.
        await fixture.query(`create table default_reference(image text default '${defaultOnly.url}')`);
        await fixture.query(`create materialized view deferred_reference as select '${materialized.url}'::text as image with no data`);
        // Unpopulated materialized views fail rather than silently excluding future definition references.
        let result = await scanDatabases(config, [historical, queued, malformed, defaultOnly, materialized, orphan]);
        assert.equal(result.complete, false);
        await fixture.query('refresh materialized view deferred_reference');
        result = await scanDatabases(config, [historical, queued, malformed, defaultOnly, materialized, orphan]);
        assert.ok(result.references[historical.id].some(reference => reference.table === 'public.order_snapshots'));
        assert.ok(result.references[malformed.id].some(reference => reference.table === 'public.analytics_geography_references'));
        assert.ok(result.references[defaultOnly.id].some(reference => reference.table === 'catalog.persisted_sql_definitions'));
        assert.ok(result.references[materialized.id].some(reference => reference.table === 'catalog.persisted_sql_definitions'));
        assert.equal(result.references[queued.id], undefined);
        assert.equal(result.references[orphan.id], undefined);
        assert.equal(result.intents[queued.id][0].row.id, '9007199254740993');
        assert.equal(result.intents[queued.id][0].row.source_product_id, '9007199254740995');
        assert.ok(result.issues.some(issue => issue.includes('UNDECLARED_SHARED_CLUSTER_DATABASE')), 'Other loopback databases must block complete shared-store coverage; they are not scanned.');
        const approved: PreparedObject = { ...queued, etag: 'test', contentType: 'image/png', cacheControlMaxAge: 3600, sha256: 'a'.repeat(64), recoveryFile: `files/${queued.id}.blob`, intents: result.intents[queued.id] };
        await fixture.query('update archive_blob_deletion_outbox set attempt_count=1');
        await assert.rejects(acknowledgeOutbox(config, approved), /OUTBOX_ROW_CHANGED_PRESERVE_IT/u);
        assert.equal((await fixture.query('select count(*)::int as count from archive_blob_deletion_outbox')).rows[0].count, 1);
        await fixture.query('update archive_blob_deletion_outbox set attempt_count=0');
        await acknowledgeOutbox(config, approved);
        await acknowledgeOutbox(config, approved);
        assert.equal((await fixture.query('select count(*)::int as count from archive_blob_deletion_outbox')).rows[0].count, 0);
        assert.equal((await fixture.query('select count(*)::int as count from order_snapshots')).rows[0].count, 1);
    }
    finally {
        delete process.env.STORAGE_LIFECYCLE_FIXTURE_URL;
        if (fixture)
            await fixture.end();
        if (created) {
            const row = (await admin.query("select oid::text,shobj_description(oid,'pg_database') as marker,pg_get_userbyid(datdba)=current_user as owned from pg_database where datname=$1", [database])).rows[0];
            assert.equal(row.oid, oid);
            assert.equal(row.marker, marker);
            assert.equal(row.owned, true);
            assert.equal((await admin.query('select count(*)::int as count from pg_stat_activity where datname=$1', [database])).rows[0].count, 0);
            await admin.query(`drop database "${database}"`);
        }
        await admin.end();
    }
});
