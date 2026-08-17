import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCatalogImageBlobPath,
  buildOrderBlobPath,
  deleteBlob,
  uploadBlob
} from '../../src/shared/server/blob';

const originalE2eMode = process.env.E2E_MODE;
const originalStorageNamespace = process.env.E2E_STORAGE_NAMESPACE;

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
    buildOrderBlobPath(42, 'invoice.pdf'),
    'orders/42/invoice.pdf'
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
    () => buildOrderBlobPath(42, 'invoice.pdf'),
    /E2E_STORAGE_NAMESPACE is missing or invalid/u
  );
});

test('E2E mode refuses external blob uploads and deletions', async () => {
  process.env.E2E_MODE = '1';
  process.env.E2E_STORAGE_NAMESPACE = 'run-123';

  await assert.rejects(
    uploadBlob('orders/42/invoice.pdf', new Uint8Array(), 'application/pdf'),
    /External Blob storage is disabled in E2E mode/u
  );
  await assert.rejects(
    deleteBlob('https://example.invalid/blob.pdf'),
    /External Blob storage is disabled in E2E mode/u
  );
});
