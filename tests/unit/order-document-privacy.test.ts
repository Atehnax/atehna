import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

test('the base schema owns opaque document access IDs without a retrofit fallback', () => {
  const schema = source('database/schema.sql');
  const orderDocumentsTable = schema.match(
    /create table order_documents\s*\(([\s\S]*?)\n\);/u
  );

  assert.ok(orderDocumentsTable, 'the base schema must create order_documents');
  assert.match(
    orderDocumentsTable[1],
    /\bcustomer_access_id uuid not null default gen_random_uuid\(\)/u,
    'every order document must receive a non-null opaque customer ID at creation'
  );
  assert.match(orderDocumentsTable[1], /\bblob_pathname text not null\b/u);
  assert.doesNotMatch(
    orderDocumentsTable[1],
    /\bblob_url\b/u,
    'private order documents persist only the required private-store pathname'
  );
  assert.match(
    schema,
    /create unique index idx_order_documents_customer_access_id\s+on order_documents\(customer_access_id\);/u,
    'the base schema must enforce globally unique customer document IDs'
  );

  assert.doesNotMatch(
    schema,
    /alter\s+table\s+order_documents[\s\S]*?\bcustomer_access_id\b|update\s+order_documents[\s\S]*?\bcustomer_access_id\b/iu,
    'the canonical schema must create this invariant directly without retrofit SQL'
  );
});

test('customer and idempotency responses never carry raw document locations', () => {
  const orderRouteSource = source('src/commercial/api/orders/route.ts');
  const contractsSource = source('src/commercial/order/contracts.ts');
  const storedResponseType = orderRouteSource.match(
    /type StoredOrderResponse = \{([\s\S]*?)\n\};/u
  );
  const customerMapperIndex = orderRouteSource.indexOf(
    'function toCustomerOrderResponse('
  );
  const reservationIndex = orderRouteSource.indexOf(
    'async function reserveIdempotencyKey',
    customerMapperIndex
  );
  const customerResponseMapper = orderRouteSource.slice(
    customerMapperIndex,
    reservationIndex
  );
  const submitResponseType = contractsSource.match(
    /export type SubmitOrderResponse = \{([\s\S]*?)\n\};/u
  );

  assert.ok(storedResponseType, 'the idempotency response contract must exist');
  assert.ok(
    customerMapperIndex >= 0 && reservationIndex > customerMapperIndex,
    'the customer response allowlist must exist'
  );
  assert.ok(submitResponseType, 'the public submission response contract must exist');
  assert.doesNotMatch(
    storedResponseType[1],
    /document\w*|blob(?:_url|Url|\.url|\w*)/iu,
    'the internal idempotency response may retain order work data, but never document locations'
  );
  for (const [label, publicResponseSource] of [
    ['customer mapper', customerResponseMapper],
    ['public contract', submitResponseType[1]]
  ] as const) {
    assert.doesNotMatch(
      publicResponseSource,
      /\borderId\b|\borderNumber\b|\bcustomer\b|\bitems\b|\btotals\b|\bpricingVersion\b|document\w*|blob(?:_url|Url|\.url|\w*)/iu,
      `${label} must expose only the minimal submission receipt fields`
    );
  }
  assert.equal(
    orderRouteSource.match(/return createCustomerOrderResponse\(/gu)
      ?.length,
    2,
    'new and idempotent submissions must use the same customer-safe allowlist'
  );
  assert.equal(
    orderRouteSource.match(/NextResponse\.json\(\s*toCustomerOrderResponse\(/gu)
      ?.length,
    1,
    'the shared response helper must own the only public JSON serialization'
  );
  assert.match(customerResponseMapper, /setOrderAccessSessionCookie\(nextResponse, session\)/u);
  assert.match(submitResponseType[1], /\baccessId: string\b/u);
  assert.doesNotMatch(submitResponseType[1], /confirmationToken|confirmationUrl/u);
  assert.doesNotMatch(
    submitResponseType[1],
    /status|commitmentStatus|tokenExpiresAt/u,
    'the submission response exposes only the non-secret session selector'
  );
  assert.match(
    orderRouteSource,
    /response_json = \$2::jsonb[\s\S]*?JSON\.stringify\(storedResponse\)/u
  );
  const summaryWorkerSource = orderRouteSource.slice(
    orderRouteSource.indexOf('async function createInitialOrderSummary'),
    orderRouteSource.indexOf('function safelyRevalidateAdminOrderPaths')
  );
  assert.doesNotMatch(
    summaryWorkerSource,
    /response_json/u,
    'persisting a document must not add its location to an idempotency response'
  );
});

test('generated order PDFs omit the internal order number', () => {
  const pdfSource = source('src/shared/server/pdf.ts');
  const presentationSource = source(
    'src/shared/domain/order/orderDocumentPreview.ts'
  );
  const generationSource = source('src/shared/server/pdfGeneration.ts');
  const numberBuilder = generationSource.slice(
    generationSource.indexOf('export function buildOrderDocumentNumber'),
    generationSource.indexOf('export async function buildPdfContext')
  );

  assert.doesNotMatch(pdfSource, /\borderNumber\b|order\.orderNumber/u);
  assert.doesNotMatch(presentationSource, /\borderNumber\b|order\.orderNumber/u);
  assert.match(pdfSource, /documentNumber: string/u);
  assert.match(
    presentationSource,
    /label: labels\.orderDate,\s+value: formatOrderDocumentDate\(order\.createdAt\)/u
  );
  assert.match(numberBuilder, /opaqueSeed/u);
  assert.doesNotMatch(
    numberBuilder,
    /orderId/u,
    'the printable number must be independent of the internal order id'
  );
});

test('the customer confirmation DTO exposes only opaque same-origin document links', () => {
  const confirmationSource = source(
    'src/commercial/api/orders/confirmation/route.ts'
  );
  const documentResilienceSource = source(
    'src/commercial/api/orders/confirmation/documentResilience.ts'
  );
  const dtoStart = confirmationSource.indexOf('const customerName =');
  const dtoEnd = confirmationSource.indexOf('} catch (error)', dtoStart);
  assert.ok(dtoStart >= 0 && dtoEnd > dtoStart, 'customer DTO must be identifiable');
  const dtoSource = confirmationSource.slice(dtoStart, dtoEnd);

  assert.match(confirmationSource, /readConfirmationDocumentsSafely/u);
  assert.match(documentResilienceSource, /customer_access_id/u);
  assert.match(
    documentResilienceSource,
    /url: `\/api\/orders\/documents\/\$\{encodeURIComponent\(customerAccessId\)\}`/u
  );
  for (const forbiddenField of [
    'blob_url',
    'blob_pathname',
    'filename',
    'document_number',
    'content_sha256',
    'orderNumber:',
    'orderId:'
  ]) {
    assert.ok(
      !dtoSource.includes(forbiddenField),
      `customer confirmation source must not expose ${forbiddenField}`
    );
  }
});

test('document downloads require an order-bound session and never redirect to Blob', () => {
  const downloadSource = source(
    'src/commercial/api/orders/documents/[documentAccessId]/route.ts'
  );
  const orderAccessSource = source('src/shared/server/orderAccess.ts');

  assert.match(downloadSource, /verifyOrderAccessSessionForOrder/u);
  assert.match(downloadSource, /'confirmation',\s*orderId/u);
  assert.match(orderAccessSource, /expectedOrderId/u);
  assert.match(downloadSource, /readPrivateOrderDocumentBlob\(document\.blob_pathname\)/u);
  assert.match(downloadSource, /new NextResponse\(blob\.stream/u);
  assert.doesNotMatch(downloadSource, /fetch\(document\.|\bblob_url\b/u);
  assert.doesNotMatch(downloadSource, /NextResponse\.redirect/u);
  assert.match(downloadSource, /Content-Disposition/u);
});

test('order documents use a dedicated private Blob store and admin proxy', () => {
  const blobSource = source('src/shared/server/blob.ts');
  const adminDownloadSource = source(
    'src/admin/api/orders/[orderId]/documents/[documentId]/route.ts'
  );
  const adminUploadSource = source(
    'src/admin/api/orders/[orderId]/documents/route.ts'
  );

  assert.match(blobSource, /ORDER_DOCUMENT_BLOB_STORE_ID/u);
  assert.doesNotMatch(blobSource, /ORDER_DOCUMENT_BLOB_READ_WRITE_TOKEN/u);
  assert.match(blobSource, /uploadPrivateOrderDocumentBlob[\s\S]*?storeId/u);
  assert.match(
    blobSource,
    /uploadPrivateOrderDocumentBlob[\s\S]*?access: 'private'[\s\S]*?addRandomSuffix: true/u
  );
  assert.match(
    blobSource,
    /readPrivateOrderDocumentBlob[\s\S]*?get\(normalizedPathname[\s\S]*?access: 'private'/u
  );
  assert.match(adminDownloadSource, /readPrivateOrderDocumentBlob/u);
  assert.match(adminDownloadSource, /new NextResponse\(blob\.stream/u);
  assert.match(
    adminUploadSource,
    /url: `\/api\/admin\/orders\/\$\{orderId\}\/documents\/\$\{Number\(insertRow\.id\)\}`/u
  );
  assert.doesNotMatch(adminUploadSource, /url: blob\.url|\bblob_url\b/u);
});

test('purchase-order upload derives its order exclusively from the verified session', () => {
  const uploadRouteSource = source(
    'src/commercial/api/orders/purchase-order/route.ts'
  );
  const uploadFormSource = source(
    'src/commercial/order/components/PurchaseOrderUploadForm.tsx'
  );

  assert.match(uploadRouteSource, /where id = \$1[\s\S]*?\[access\.orderId\]/u);
  assert.doesNotMatch(uploadRouteSource, /params\.orderId/u);
  assert.match(uploadFormSource, /fetch\('\/api\/orders\/purchase-order'/u);
  assert.doesNotMatch(uploadFormSource, /Številka naročila/u);
});
