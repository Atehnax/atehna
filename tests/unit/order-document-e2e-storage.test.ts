import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
  buildOrderDocumentBlobPath,
  deletePrivateOrderDocumentBlob,
  readPrivateOrderDocumentBlob,
  uploadPrivateOrderDocumentBlob
} from '../../src/shared/server/blob';

const originalE2eMode = process.env.E2E_MODE;
const originalStorageNamespace = process.env.E2E_STORAGE_NAMESPACE;
const originalLocalPrivateBlobFlag = process.env.E2E_LOCAL_PRIVATE_BLOB;
const originalOrderDocumentStoreId = process.env.ORDER_DOCUMENT_BLOB_STORE_ID;
const PDF_BYTES = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n',
  'ascii'
);

function configureIsolatedE2eStorage() {
  const namespace = `unit-private-${process.pid}-${randomUUID().slice(0, 8)}`;
  process.env.E2E_MODE = '1';
  process.env.E2E_STORAGE_NAMESPACE = namespace;
  process.env.E2E_LOCAL_PRIVATE_BLOB = '1';
  delete process.env.ORDER_DOCUMENT_BLOB_STORE_ID;
  return namespace;
}

function restoreEnvironment() {
  if (originalE2eMode === undefined) delete process.env.E2E_MODE;
  else process.env.E2E_MODE = originalE2eMode;

  if (originalStorageNamespace === undefined) {
    delete process.env.E2E_STORAGE_NAMESPACE;
  } else {
    process.env.E2E_STORAGE_NAMESPACE = originalStorageNamespace;
  }

  if (originalLocalPrivateBlobFlag === undefined) {
    delete process.env.E2E_LOCAL_PRIVATE_BLOB;
  } else {
    process.env.E2E_LOCAL_PRIVATE_BLOB = originalLocalPrivateBlobFlag;
  }

  if (originalOrderDocumentStoreId === undefined) {
    delete process.env.ORDER_DOCUMENT_BLOB_STORE_ID;
  } else {
    process.env.ORDER_DOCUMENT_BLOB_STORE_ID = originalOrderDocumentStoreId;
  }
}

test.afterEach(restoreEnvironment);

test('E2E mode alone refuses private document persistence', async () => {
  const namespace = configureIsolatedE2eStorage();
  delete process.env.E2E_LOCAL_PRIVATE_BLOB;
  const pathname = `${namespace}/order-documents/${randomUUID()}.pdf`;

  await assert.rejects(
    uploadPrivateOrderDocumentBlob(pathname, PDF_BYTES, 'application/pdf'),
    /E2E_LOCAL_PRIVATE_BLOB=1 is required/u
  );
  await assert.rejects(
    readPrivateOrderDocumentBlob(pathname),
    /E2E_LOCAL_PRIVATE_BLOB=1 is required/u
  );
  await assert.rejects(
    deletePrivateOrderDocumentBlob(pathname),
    /E2E_LOCAL_PRIVATE_BLOB=1 is required/u
  );
});

test('private order documents round-trip locally in an isolated E2E namespace', async () => {
  const namespace = configureIsolatedE2eStorage();
  const pathname = buildOrderDocumentBlobPath(randomUUID(), 'pdf');

  try {
    const uploaded = await uploadPrivateOrderDocumentBlob(
      pathname,
      PDF_BYTES,
      'application/pdf'
    );
    assert.equal(uploaded.pathname, pathname);
    assert.equal(
      uploaded.url,
      `https://e2e-private-order-document.invalid/${pathname}`
    );
    assert.ok(uploaded.pathname.startsWith(`${namespace}/order-documents/`));

    const stored = await readPrivateOrderDocumentBlob(pathname);
    assert.ok(stored);
    assert.equal(stored.contentType, 'application/pdf');
    assert.equal(stored.size, PDF_BYTES.length);
    assert.deepEqual(
      Buffer.from(await new Response(stored.stream).arrayBuffer()),
      PDF_BYTES
    );

    await deletePrivateOrderDocumentBlob(pathname);
    assert.equal(await readPrivateOrderDocumentBlob(pathname), null);
  } finally {
    await deletePrivateOrderDocumentBlob(pathname).catch(() => undefined);
  }
});

test('private E2E storage rejects cross-namespace and traversal paths', async () => {
  const namespace = configureIsolatedE2eStorage();
  const forbiddenPaths = [
    `other-${namespace}/order-documents/${randomUUID()}.pdf`,
    `${namespace}/order-documents/../outside.pdf`,
    `${namespace}\\order-documents\\${randomUUID()}.pdf`,
    `${namespace}/order-documents/%2e%2e/outside.pdf`
  ];

  for (const pathname of forbiddenPaths) {
    await assert.rejects(
      uploadPrivateOrderDocumentBlob(pathname, PDF_BYTES, 'application/pdf'),
      /must stay inside its E2E namespace/u
    );
    await assert.rejects(
      readPrivateOrderDocumentBlob(pathname),
      /must stay inside its E2E namespace/u
    );
    await assert.rejects(
      deletePrivateOrderDocumentBlob(pathname),
      /must stay inside its E2E namespace/u
    );
  }
});

test('private E2E storage preserves payload and content-type validation', async () => {
  configureIsolatedE2eStorage();
  const pdfPathname = buildOrderDocumentBlobPath(randomUUID(), 'pdf');
  const jpgPathname = buildOrderDocumentBlobPath(randomUUID(), 'jpg');

  await assert.rejects(
    uploadPrivateOrderDocumentBlob(
      pdfPathname,
      Buffer.from('not-a-pdf'),
      'application/pdf'
    ),
    /Invalid PDF payload/u
  );
  await assert.rejects(
    uploadPrivateOrderDocumentBlob(jpgPathname, PDF_BYTES, 'application/pdf'),
    /extension does not match its content type/u
  );
});
