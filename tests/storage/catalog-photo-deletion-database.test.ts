import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
import { applyRejectedPhotoDeletion, planRejectedProductImageDeletion, verifyRejectedPhotoDeletion } from '../../scripts/delete-rejected-product-images';
import { readState } from '../../scripts/replace-atehna-generated-images';
import type { ImageRemediationManifest } from '../../scripts/remediate-catalog-product-images';

test('real PostgreSQL replaces and deletes hidden photos, preserves link order, rolls back atomically and retains shared blobs', async () => {
  const raw = process.env.STORAGE_LIFECYCLE_TEST_ADMIN_URL;
  assert.ok(raw, 'Set STORAGE_LIFECYCLE_TEST_ADMIN_URL to an owned loopback PostgreSQL admin connection.');
  const connection = new URL(raw);
  assert.equal(connection.hostname, '127.0.0.1'); assert.equal(connection.pathname, '/postgres');
  const database = `atehna_e2e_photo_deletion_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const marker = `owned-photo-deletion-test-${randomUUID()}`;
  const options = { host: '127.0.0.1', port: Number(connection.port || 5432), user: decodeURIComponent(connection.username), password: decodeURIComponent(connection.password), ssl: false as const };
  const admin = new pg.Client({ ...options, database: 'postgres' }); await admin.connect();
  let created = false; let oid = ''; let fixture: pg.PoolClient | undefined; let pool: pg.Pool | undefined;
  try {
    assert.equal((await admin.query('select 1 from pg_database where datname=$1', [database])).rowCount, 0);
    await admin.query(`create database "${database}" template template0`); created = true;
    await admin.query(`comment on database "${database}" is '${marker}'`);
    oid = (await admin.query('select oid::text from pg_database where datname=$1', [database])).rows[0].oid;
    pool = new pg.Pool({ ...options, database, max: 2 }); fixture = await pool.connect();
    await fixture.query(`
      create table catalog_items(id bigint primary key,slug text,status text,item_name text,updated_at timestamptz default now());
      create table catalog_item_variants(id bigint primary key,item_id bigint references catalog_items(id),variant_name text,inventory integer,price numeric);
      create table catalog_media(id bigserial primary key,item_id bigint references catalog_items(id),media_kind text,role text,source_kind text,blob_url text,blob_pathname text,external_url text,position integer,hidden boolean,image_type text,alt_text text,image_dimensions jsonb,filename text,mime_type text,video_type text,created_at timestamptz default now(),updated_at timestamptz default now());
      create table catalog_variant_media(variant_id bigint references catalog_item_variants(id),item_id bigint references catalog_items(id),media_id bigint references catalog_media(id) on delete cascade,position integer,created_at timestamptz default now(),primary key(variant_id,media_id));
      create table archive_blob_deletion_outbox(id bigserial primary key,blob_target text unique not null,source_item_type text not null,source_product_id bigint,queued_at timestamptz default now());
      insert into catalog_items(id,slug,status,item_name) values(1,'tool','active','Exact tool'),(2,'other','active','Other');
      insert into catalog_item_variants values(11,1,'Variant',7,25),(22,2,'Other',4,55);
      insert into catalog_media(id,item_id,media_kind,role,source_kind,blob_url,blob_pathname,position,hidden,image_type,alt_text,image_dimensions) values
        (101,1,'image','gallery','upload','https://fixture.public.blob.vercel-storage.com/catalog-items/tool/images/owned.jpg','catalog-items/tool/images/owned.jpg',-8,true,'product','Rejected owned photo','{"width":500,"height":500}'),
        (102,1,'image','gallery','upload','https://fixture.public.blob.vercel-storage.com/catalog-items/tool/images/shared.jpg','catalog-items/tool/images/shared.jpg',3,true,'product','Rejected shared photo','{"width":500,"height":500}'),
        (103,1,'image','gallery','upload','/images/diagram.svg',null,20,true,'dimension-diagram','Diagram','{"width":500,"height":200}'),
        (104,1,'image','gallery','upload','/images/public-photo.jpg',null,30,true,'product','Public rejected photo','{"width":500,"height":500}'),
        (201,2,'image','gallery','upload','https://fixture.public.blob.vercel-storage.com/catalog-items/tool/images/shared.jpg',null,8,false,'product','Shared alias','{"width":500,"height":500}');
      insert into catalog_variant_media(variant_id,item_id,media_id,position,created_at) values(11,1,101,2,'2001-01-01'),(11,1,102,5,'2001-01-01'),(11,1,103,12,'2001-01-01'),(11,1,104,15,'2001-01-01'),(22,2,201,8,'2001-01-01');
    `);
    const manifest: ImageRemediationManifest = { removals: [
      { slug: 'tool', blobUrl: 'https://fixture.public.blob.vercel-storage.com/catalog-items/tool/images/owned.jpg' },
      { slug: 'tool', blobUrl: 'https://fixture.public.blob.vercel-storage.com/catalog-items/tool/images/shared.jpg' },
      { slug: 'tool', blobUrl: '/images/public-photo.jpg' }
    ], replacements: [{ slug: 'tool', fromBlobUrl: 'https://fixture.public.blob.vercel-storage.com/catalog-items/tool/images/owned.jpg', fromSha256: 'a'.repeat(64), blobUrl: '/images/catalog/2026-09/native-replacement.png', sha256: 'b'.repeat(64), dimensions: { width: 1600, height: 1200 }, sourcePage: 'https://maker.example/product', sourceUrl: 'https://maker.example/original.png', visuallyReviewed: true, humanFree: true, originalBytes: true, imageType: 'product', altText: 'Native replacement' }], restores: [], captions: [], partialUnassignments: [] };
    const before = await readState(fixture);
    const plan = planRejectedProductImageDeletion(before, manifest, 'local');
    await fixture.query('begin');
    await applyRejectedPhotoDeletion(fixture, plan);
    assert.equal((await fixture.query('select count(*)::int count from catalog_media')).rows[0].count, 3);
    assert.equal((await fixture.query('select count(*)::int count from archive_blob_deletion_outbox')).rows[0].count, 1);
    // An error after deleting and enqueueing must roll back both; simulate the same failed transaction boundary.
    await assert.rejects(fixture.query('insert into catalog_variant_media(variant_id,item_id,media_id,position) values(11,1,999999,0)'), /foreign key/u);
    await fixture.query('rollback');
    assert.deepEqual(await readState(fixture), before);
    assert.equal((await fixture.query('select count(*)::int count from archive_blob_deletion_outbox')).rows[0].count, 0);
    await fixture.query('begin');
    const insertedIds = await applyRejectedPhotoDeletion(fixture, plan);
    const transactionalAfter = await readState(fixture);
    const insertedLink = transactionalAfter.assignments.find(row => String(row.media_id) === insertedIds.get(String(plan.inserts[0].id)))!;
    assert.equal(insertedLink.position, 2);
    assert.notEqual(String(insertedLink.created_at), String(before.assignments.find(row => String(row.media_id) === '101')!.created_at));
    verifyRejectedPhotoDeletion(before, transactionalAfter, plan, insertedIds);
    await fixture.query('commit');
    fixture.release(); fixture = undefined;
    const reload = await pool.connect();
    try {
      const after = await readState(reload);
      verifyRejectedPhotoDeletion(before, after, plan, insertedIds);
      assert.deepEqual(after.media.map(row => String(row.id)), [...insertedIds.values(), '103', '201']);
      assert.deepEqual(after.assignments.map(row => [String(row.media_id), row.position]), [[[...insertedIds.values()][0], 2], ['103', 12], ['201', 8]]);
      assert.deepEqual((await reload.query('select blob_target from archive_blob_deletion_outbox')).rows, [{ blob_target: 'catalog-items/tool/images/owned.jpg' }]);
      assert.equal(planRejectedProductImageDeletion(after, manifest, 'local').mutationCount, 0);
    } finally { reload.release(); }
  } finally {
    fixture?.release(); await pool?.end();
    if (created) {
      const row = (await admin.query("select oid::text,shobj_description(oid,'pg_database') marker,pg_get_userbyid(datdba)=current_user owned from pg_database where datname=$1", [database])).rows[0];
      assert.equal(row.oid, oid); assert.equal(row.marker, marker); assert.equal(row.owned, true);
      assert.equal((await admin.query('select count(*)::int count from pg_stat_activity where datname=$1', [database])).rows[0].count, 0);
      await admin.query(`drop database "${database}"`);
    }
    await admin.end();
  }
});
