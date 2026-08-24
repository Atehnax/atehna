import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

test('archive retention schema contains no existing-row recovery', () => {
  const schema = source('database/schema.sql');

  assert.match(schema, /create table archive_blob_deletion_outbox/u);
  assert.doesNotMatch(schema, /insert into deleted_archive_entries/u);
  assert.doesNotMatch(schema, /update deleted_archive_entries/u);
  assert.doesNotMatch(schema, /alter table archive_blob_deletion_outbox/u);
});

test('archived order documents are deleted only by their required Blob pathname', () => {
  const archiveSource = source('src/shared/server/deletedArchive.ts');
  const documentDeleteSource = source(
    'src/admin/api/orders/[orderId]/documents/[documentId]/route.ts'
  );
  const deleteHandlerSource = documentDeleteSource.slice(
    documentDeleteSource.indexOf('export async function DELETE')
  );

  assert.doesNotMatch(archiveSource, /fallbackTarget/u);
  assert.doesNotMatch(archiveSource, /entry\.payload\?\.(?:blobPathname|blobUrl)/u);
  assert.match(
    archiveSource,
    /from order_documents\s+where blob_pathname = \$1\s+\)/u,
    'order document references use the required private-store pathname only'
  );
  assert.match(
    archiveSource,
    /source_item_type === 'order'[\s\S]*?deletePrivateOrderDocumentBlob/u
  );
  assert.match(
    archiveSource,
    /from catalog_media[\s\S]{0,180}?blob_pathname = \$1[\s\S]{0,80}?blob_url = \$1/u,
    'catalog media keeps its independent URL fallback'
  );
  assert.doesNotMatch(
    deleteHandlerSource,
    /blob_pathname|blob_url|blobPathname|blobUrl/u
  );
});
