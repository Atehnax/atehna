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

test('orders and their deleted documents remain recoverable without a permanent deletion path', () => {
  const archiveSource = source('src/shared/server/deletedArchive.ts');
  const deleteHandlerSource = source('src/admin/api/orders/[orderId]/documents/[documentId]/route.ts').split('export async function DELETE')[1]!;
  assert.doesNotMatch(archiveSource, /delete from orders|delete from order_documents|deletePrivateOrderDocumentBlob|permanentlyDeleteArchiveEntries|cleanupExpiredArchiveEntries/u);
  assert.doesNotMatch(deleteHandlerSource, /blob_pathname|blob_url|blobPathname|blobUrl|interval '90 days'/u);
  assert.match(deleteHandlerSource, /values \(\$1, \$2, \$3, \$4, \$5, null, \$6::jsonb\)/u);
  assert.match(archiveSource, /update orders set deleted_at = null/u);
  assert.match(archiveSource, /update order_documents set deleted_at = null/u);
  assert.match(archiveSource, /enforceCurrentPricingRevisionForRestoredDocuments/u);
  assert.match(archiveSource, /enforceImmutableQuotePurchaseOrderEvidence/u);
});
