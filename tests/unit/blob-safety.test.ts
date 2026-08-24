import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCatalogImageBlobPath,
  buildOrderDocumentBlobPath,
  deleteBlob
} from '../../src/shared/server/blob';

const originalE2eMode = process.env.E2E_MODE;
const originalStorageNamespace = process.env.E2E_STORAGE_NAMESPACE;
const DOCUMENT_ACCESS_ID = '123e4567-e89b-42d3-a456-426614174000';

test.afterEach(() => {
  if (originalE2eMode === undefined) delete process.env.E2E_MODE;
  else process.env.E2E_MODE = originalE2eMode;

  if (originalStorageNamespace === undefined) {
    delete process.env.E2E_STORAGE_NAMESPACE;
  } else {
    process.env.E2E_STORAGE_NAMESPACE = originalStorageNamespace;
  }
});

test('production blob paths ignore an accidental E2E namespace', () => {
  delete process.env.E2E_MODE;
  process.env.E2E_STORAGE_NAMESPACE = 'stale-e2e-namespace';

  assert.equal(
    buildOrderDocumentBlobPath(DOCUMENT_ACCESS_ID, 'pdf'),
    `order-documents/${DOCUMENT_ACCESS_ID}.pdf`
  );
});

test('E2E blob paths require and apply a strict namespace', () => {
  process.env.E2E_MODE = '1';
  process.env.E2E_STORAGE_NAMESPACE = 'run-123.shard-2';

  assert.equal(
    buildCatalogImageBlobPath('materiali', 'aluminij.png', ['kovine']),
    'run-123.shard-2/catalog-categories/materiali/kovine/aluminij.png'
  );
});

test('E2E blob paths reject an invalid namespace before constructing a key', () => {
  process.env.E2E_MODE = '1';
  process.env.E2E_STORAGE_NAMESPACE = '###';

  assert.throws(
    () => buildOrderDocumentBlobPath(DOCUMENT_ACCESS_ID, 'pdf'),
    /E2E_STORAGE_NAMESPACE is missing or invalid/u
  );
});

test('order document blob paths reject identifiers that are not opaque UUIDs', () => {
  assert.throws(
    () => buildOrderDocumentBlobPath('42', 'pdf'),
    /Invalid order document customer access id/u
  );
});

test('E2E mode refuses external blob deletions', async () => {
  process.env.E2E_MODE = '1';
  process.env.E2E_STORAGE_NAMESPACE = 'run-123';

  await assert.rejects(
    deleteBlob('https://example.invalid/blob.pdf'),
    /External Blob storage is disabled in E2E mode/u
  );
});
