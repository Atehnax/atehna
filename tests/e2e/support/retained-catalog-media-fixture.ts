import assert from 'node:assert/strict';
import pg from 'pg';
import { readE2eEnvironment, verifyE2eResetTarget } from '../../../scripts/e2e-database.mjs';

type RetainedMediaSource = {
  expectedBlobUrl: string;
  externalUrl: string;
  mimeType: string;
};

/** Seed legacy supplier media only on newly created items in the owned E2E database. */
export async function seedRetainedCatalogMediaFixture(
  item: { id: number | string; slug: string },
  sources: RetainedMediaSource[]
) {
  assert.match(String(item.id), /^[1-9]\d*$/u);
  if (typeof item.id === 'number') assert.ok(Number.isSafeInteger(item.id));
  assert.match(item.slug, /^e2e-/u);
  assert.ok(sources.length > 0);
  const environment = readE2eEnvironment();
  const client = new pg.Client({ connectionString: environment.databaseUrl, ssl: false });
  await client.connect();
  try {
    await verifyE2eResetTarget(client, environment.databaseIdentity, environment.storageNamespace, environment.resetOwnershipHash);
    await client.query('begin');
    try {
      for (const source of sources) {
        assert.ok(source.expectedBlobUrl.startsWith('/images/'));
        const retained = await client.query(`
          update catalog_media
          set blob_url = null, external_url = $3, mime_type = $5
          where item_id = (select id from catalog_items where id = $1 and slug = $2)
            and blob_url = $4 and blob_pathname is null and external_url is null
            and media_kind = 'image' and role = 'gallery' and source_kind = 'upload'
          returning id
        `, [item.id, item.slug, source.externalUrl, source.expectedBlobUrl, source.mimeType]);
        assert.equal(retained.rowCount, 1, 'The exact newly created media fixture must exist once.');
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  } finally {
    await client.end();
  }
}
