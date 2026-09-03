import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  EMAIL_PDF_ATTACHMENT_MAX_BYTES,
  createPendingOrderEmailPdfDocumentReference,
  createPendingQuoteEmailPdfDocumentReference,
  isPinnedEmailPdfDocumentReference,
  normalizeOrderEmailPdfDocumentReference,
  normalizeQuoteEmailPdfDocumentReference,
  orderEmailPdfDocumentTypeForEvent,
  orderEmailPdfReferenceMatchesEvent,
  pinEmailPdfDocumentReference,
  quoteEmailPdfReferenceMatchesEvent
} from '../../src/shared/domain/emailPdfAttachment';

const SHA256 = 'a'.repeat(64);
const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

test('email PDF references are strict, scoped, and become immutable pins', () => {
  const pending = createPendingOrderEmailPdfDocumentReference(
    42,
    'order_summary',
    1
  );
  assert.equal(isPinnedEmailPdfDocumentReference(pending), false);
  assert.equal(orderEmailPdfReferenceMatchesEvent('order_submitted', pending), true);
  assert.equal(orderEmailPdfReferenceMatchesEvent('order_accepted', pending), true);
  assert.equal(orderEmailPdfReferenceMatchesEvent('invoice_issued', pending), false);
  assert.equal(orderEmailPdfDocumentTypeForEvent('predracun_issued'), 'predracun');
  assert.equal(orderEmailPdfDocumentTypeForEvent('invoice_issued'), 'invoice');
  assert.equal(orderEmailPdfDocumentTypeForEvent('partially_sent'), null);

  const forbiddenDeliveryNote = createPendingOrderEmailPdfDocumentReference(
    42,
    'dobavnica',
    1
  );
  for (const eventType of [
    'order_submitted',
    'order_accepted',
    'predracun_issued',
    'invoice_issued'
  ]) {
    assert.equal(
      orderEmailPdfReferenceMatchesEvent(eventType, forbiddenDeliveryNote),
      false
    );
  }

  const pinned = pinEmailPdfDocumentReference(pending, {
    documentId: 17,
    contentSha256: SHA256,
    filename: 'PN-2026-001.pdf'
  });
  assert.equal(isPinnedEmailPdfDocumentReference(pinned), true);
  assert.equal(pinned.documentId, 17);
  assert.equal(pinned.contentSha256, SHA256);

  assert.equal(
    normalizeOrderEmailPdfDocumentReference({ ...pinned, extra: true }),
    null
  );
  assert.equal(
    normalizeOrderEmailPdfDocumentReference({
      ...pinned,
      filename: '../racun.pdf'
    }),
    null
  );
  assert.equal(
    normalizeOrderEmailPdfDocumentReference({
      ...pinned,
      contentSha256: 'not-a-hash'
    }),
    null
  );
});

test('quote offer references cannot be reused for another event or request', () => {
  const pending = createPendingQuoteEmailPdfDocumentReference({
    quoteRequestId: 7,
    quoteOfferVersionId: 11,
    contentSha256: SHA256,
    filename: 'PON-2026-001.pdf'
  });
  assert.equal(quoteEmailPdfReferenceMatchesEvent('quote_issued', pending), true);
  assert.equal(
    quoteEmailPdfReferenceMatchesEvent('quote_request_submitted', pending),
    false
  );
  assert.equal(
    normalizeQuoteEmailPdfDocumentReference({
      ...pending,
      quoteRequestId: 0
    }),
    null
  );
});

test('email PDF cap remains comfortably below the provider request limit', () => {
  assert.equal(EMAIL_PDF_ATTACHMENT_MAX_BYTES, 10 * 1024 * 1024);
});

test('private PDF hydration enforces current snapshots, type, size, signature, and hash', () => {
  const hydration = source('src/shared/server/emailPdfAttachment.ts');

  assert.match(hydration, /readPrivateOrderDocumentBlob\(resolved\.blobPathname\)/u);
  assert.match(hydration, /contentType !== 'application\/pdf'/u);
  assert.match(hydration, /input\.declaredSize > EMAIL_PDF_ATTACHMENT_MAX_BYTES/u);
  assert.match(hydration, /bytes\.subarray\(0, 5\)[\s\S]*?'%PDF-'/u);
  assert.match(hydration, /createHash\('sha256'\)[\s\S]*?actualSha256 !== input\.expectedSha256/u);
  assert.match(
    hydration,
    /document\.order_pricing_revision = order_record\.pricing_revision/u
  );
  assert.match(
    hydration,
    /document\.order_delivery_plan_revision = order_record\.delivery_plan_revision/u
  );
  assert.match(hydration, /document\.offer_content_hash = offer\.content_hash/u);
  assert.match(hydration, /document\.terms_hash = offer\.terms_hash/u);
  assert.match(hydration, /document\.content_sha256 = offer\.document_sha256/u);
});

test('automatic PDF attachments are customer-only, legacy-compatible, encrypted pins with bounded waits', () => {
  const orderWorker = source('src/shared/server/orderEmailJobs.ts');
  const quoteWorker = source('src/shared/server/quoteEmailJobs.ts');
  const issueRoute = source(
    'src/admin/api/quote-requests/[quoteRequestId]/issue/route.ts'
  );

  assert.match(
    orderWorker,
    /recipient\.audience === 'customer'[\s\S]*?automaticDocumentType === 'order_summary'/u
  );
  assert.match(
    orderWorker,
    /envelope\.pdfDocument \?\?[\s\S]*?job\.audience === 'customer'[\s\S]*?job\.eventType === 'order_submitted'[\s\S]*?job\.eventType === 'order_accepted'/u
  );
  assert.match(
    orderWorker,
    /normalizeOrderEmailPdfDocumentReference\(input\.pdfDocument\)[\s\S]*?orderEmailPdfReferenceMatchesEvent/u
  );
  assert.match(orderWorker, /persistEncryptedClaimedEnvelope\(pool, job, envelope\)/u);
  assert.match(orderWorker, /job\.attempts >= MAX_ATTEMPTS/u);
  assert.doesNotMatch(orderWorker, /attempts = greatest\(attempts - 1/u);

  assert.match(
    quoteWorker,
    /recipient\.audience === 'customer'[\s\S]*?input\.eventType === 'quote_issued'/u
  );
  assert.match(
    quoteWorker,
    /envelope\.pdfDocument \?\?[\s\S]*?job\.audience === 'customer'[\s\S]*?job\.eventType === 'quote_issued'/u
  );
  assert.match(
    quoteWorker,
    /parseClaimedQuoteEmailEnvelope\(job\)[\s\S]*?pinClaimedQuoteEmailPdfDocument[\s\S]*?persistPinnedQuoteEmailEnvelope[\s\S]*?deliverQuoteEmailWhileActive/u
  );
  assert.match(quoteWorker, /job\.attempts >= MAX_ATTEMPTS/u);
  assert.doesNotMatch(quoteWorker, /attempts = greatest\(attempts - 1/u);

  assert.match(
    issueRoute,
    /pdfDocument: createPendingQuoteEmailPdfDocumentReference\([\s\S]*?contentSha256: renderedDocumentSha256[\s\S]*?filename: `\$\{offerNumber\}\.pdf`/u
  );
});

test('successful document persistence wakes only the related automatic customer email events', () => {
  const orderDocuments = source('src/shared/server/orderSummaryJobs.ts');
  const quoteDocuments = source('src/shared/server/quoteDocumentJobs.ts');

  assert.match(
    orderDocuments,
    /result === 'completed'[\s\S]*?wakeInitialOrderEmailAfterSummary/u
  );
  assert.match(
    orderDocuments,
    /audience = 'customer'[\s\S]*?event_type in \('order_submitted', 'order_accepted'\)[\s\S]*?last_error like '\[document_pending\]%'/u
  );
  assert.match(orderDocuments, /processDueOrderEmailJobs\(pool,[\s\S]*?orderId/u);

  assert.match(
    quoteDocuments,
    /result\.completed === 0[\s\S]*?email_job\.audience = 'customer'[\s\S]*?email_job\.event_type = 'quote_issued'/u
  );
  assert.match(
    quoteDocuments,
    /email_job\.last_error like '\[document_pending\]%'[\s\S]*?document\.document_type = 'offer'/u
  );
  assert.match(quoteDocuments, /processQuoteEmailJobs\(pool, \{ limit: 10 \}\)/u);
});
