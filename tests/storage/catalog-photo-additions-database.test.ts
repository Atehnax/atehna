import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
import { planReviewedImageAdditions, type ReviewedImageAdditionManifest } from '../../scripts/add-reviewed-product-images';
import { applyRejectedPhotoDeletion, verifyRejectedPhotoDeletion, technicalImageSnapshot } from '../../scripts/delete-rejected-product-images';
import { readState } from '../../scripts/replace-atehna-generated-images';

test('real PostgreSQL adds exact SKU photos ahead of diagrams, preserves all prior data and links, and rolls back or repeats safely', async () => {
  const raw = process.env.STORAGE_LIFECYCLE_TEST_ADMIN_URL;
  assert.ok(raw, 'Set STORAGE_LIFECYCLE_TEST_ADMIN_URL to an owned loopback PostgreSQL admin connection.');
  const connection = new URL(raw);
  assert.equal(connection.hostname, '127.0.0.1'); assert.equal(connection.pathname, '/postgres');
  const database = `atehna_e2e_photo_additions_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const marker = `owned-photo-additions-test-${randomUUID()}`;
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
      create table catalog_item_variants(id bigint primary key,item_id bigint references catalog_items(id),variant_sku text,variant_name text,inventory integer,price numeric);
      create table catalog_media(id bigserial primary key,item_id bigint references catalog_items(id),media_kind text,role text,source_kind text,blob_url text,blob_pathname text,external_url text,position integer,hidden boolean,image_type text,alt_text text,image_dimensions jsonb,filename text,mime_type text,video_type text,created_at timestamptz default now(),updated_at timestamptz default now());
      create table catalog_variant_media(variant_id bigint references catalog_item_variants(id),item_id bigint references catalog_items(id),media_id bigint references catalog_media(id) on delete cascade,position integer,created_at timestamptz default now(),primary key(variant_id,media_id));
      create table archive_blob_deletion_outbox(id bigserial primary key,blob_target text unique not null,source_item_type text not null,source_product_id bigint,queued_at timestamptz default now());
      insert into catalog_items(id,slug,status,item_name) values(1,'tool','active','Exact tool'),(2,'other','active','Other');
      insert into catalog_item_variants values(11,1,'TOOL-A','Variant A',7,25),(12,1,'TOOL-B','Variant B',9,45),(13,1,'TOOL-C','Variant C',3,15),(22,2,'OTHER','Other',4,55);
      insert into catalog_media(id,item_id,media_kind,role,source_kind,blob_url,position,hidden,image_type,alt_text,image_dimensions) values
        (101,1,'image','gallery','upload','/existing-native.jpg',-5,false,'product','Exact variant A','{"width":2000,"height":1500}'),
        (102,1,'image','gallery','upload','/images/technical.svg',0,false,'dimension-diagram','Diagram','{"width":500,"height":200}'),
        (103,1,'image','gallery','upload','/images/hidden-drawing.png',2,true,'dimension-diagram','Hidden technical drawing','{"width":500,"height":200}'),
        (201,2,'image','gallery','upload','/images/other-native.jpg',8,false,'product','Other product','{"width":1500,"height":1500}');
      select setval('catalog_media_id_seq',1000);
      insert into catalog_variant_media(variant_id,item_id,media_id,position,created_at) values(11,1,101,-3,'2001-01-01'),(11,1,102,4,'2001-01-01'),(12,1,102,1,'2001-01-01'),(12,1,103,-4,'2001-01-01'),(22,2,201,8,'2001-01-01');
      insert into archive_blob_deletion_outbox(blob_target,source_item_type,source_product_id) values('catalog-items/other/images/previously-removed.jpg','unit',2);
    `);
    const common = { slug: 'tool', variantSkus: ['TOOL-B'], dimensions: { width: 1600, height: 1200 }, sourcePage: 'https://maker.example/tool-b', sourceUrl: 'https://maker.example/tool-b-original.png', sourceIdentityEvidence: 'Verified exact TOOL-B markings and manufacturer listing.', originalBytes: true as const, humanFree: true as const, visuallyReviewed: true as const, exactVariantMatch: true as const, imageType: 'product' as const };
    const manifest: ReviewedImageAdditionManifest = { version: 4, reviewedAt: '2026-09-14T10:00:00Z', additions: [
      { ...common, id: 'new-front', blobUrl: '/images/catalog/2026-09/new-front.png', sha256: 'b'.repeat(64), role: 'main', view: 'front', altText: 'Exact TOOL-B front view' },
      { ...common, id: 'new-side', blobUrl: '/images/catalog/2026-09/new-side.png', sha256: 'c'.repeat(64), role: 'detail', view: 'side', altText: 'Exact TOOL-B side view' }
    ] };
    const before = await readState(fixture); const queueBefore = (await fixture.query('select * from archive_blob_deletion_outbox order by id')).rows;
    const plan = planReviewedImageAdditions(before, manifest, 'local');
    assert.equal(plan.inserts.length, 2); assert.equal(plan.assignmentInserts.length, 2);
    await fixture.query('begin');
    const rolledBackIds = await applyRejectedPhotoDeletion(fixture, plan);
    verifyRejectedPhotoDeletion(before, await readState(fixture), plan, rolledBackIds);
    await assert.rejects(fixture.query('insert into catalog_variant_media(variant_id,item_id,media_id,position) values(12,1,999999,0)'), /foreign key/u);
    await fixture.query('rollback');
    assert.deepEqual(await readState(fixture), before);
    assert.deepEqual((await fixture.query('select * from archive_blob_deletion_outbox order by id')).rows, queueBefore);
    await fixture.query('begin isolation level serializable');
    const ids = await applyRejectedPhotoDeletion(fixture, plan);
    verifyRejectedPhotoDeletion(before, await readState(fixture), plan, ids);
    await fixture.query('commit'); fixture.release(); fixture = undefined;
    const reload = await pool.connect();
    try {
      const after = await readState(reload);
      verifyRejectedPhotoDeletion(before, after, plan, ids);
      assert.deepEqual(after.media.filter(row => before.media.some(old => old.id === row.id)), before.media);
      assert.deepEqual(after.assignments.filter(row => before.assignments.some(old => old.media_id === row.media_id && old.variant_id === row.variant_id)), before.assignments);
      assert.deepEqual(technicalImageSnapshot(after), technicalImageSnapshot(before));
      assert.deepEqual((await reload.query('select * from archive_blob_deletion_outbox order by id')).rows, queueBefore);
      const galleryB = (await reload.query("select m.blob_url from catalog_media m join catalog_variant_media a on a.media_id=m.id where a.variant_id=12 and not m.hidden order by m.position,m.id")).rows;
      assert.deepEqual(galleryB.map(row => row.blob_url), [manifest.additions[0].blobUrl, manifest.additions[1].blobUrl, '/images/technical.svg']);
      const insertedLinks = after.assignments.filter(row => [...ids.values()].includes(String(row.media_id)));
      assert.deepEqual(insertedLinks.map(row => [String(row.variant_id), row.position]), [['12', -5], ['12', -5]]);
      assert.equal(after.assignments.some(row => String(row.variant_id) === '13'), false);
      assert.equal(planReviewedImageAdditions(after, manifest, 'local').mutationCount, 0);
      const unexpected = structuredClone(after); unexpected.media.find(row => String(row.id) === '101')!.position = -7;
      assert.throws(() => verifyRejectedPhotoDeletion(before, unexpected, plan, ids), /retained image data\/order/u);
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
