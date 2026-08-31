import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

test('manual quote PDFs use an additive request-scoped table and shared opaque IDs', () => {
  const schema = source('database/schema.sql');
  const table = schema.match(
    /create table quote_manual_documents\s*\(([\s\S]*?)\n\);/u
  );

  assert.ok(table, 'the canonical schema must own manual quote attachments');
  assert.match(table[1], /id bigint primary key[\s\S]*?quote_documents_id_seq/u);
  assert.match(table[1], /quote_request_id bigint not null/u);
  assert.match(table[1], /quote_offer_version_id bigint not null/u);
  assert.match(
    table[1],
    /document_type text not null[\s\S]*?'offer'[\s\S]*?'purchase_order'/u
  );
  assert.match(table[1], /storage_id uuid not null/u);
  assert.match(table[1], /blob_pathname text not null/u);
  assert.match(table[1], /content_sha256 text not null/u);
  assert.match(table[1], /created_by_actor_type text not null/u);
  assert.match(schema, /create trigger quote_manual_documents_append_only/u);

  const migration = source(
    'database/migrations/20260830_quote_manual_documents.sql'
  );
  assert.match(migration, /create table if not exists quote_manual_documents/u);
  assert.match(migration, /must share quote_documents_id_seq/u);
});

test('manual quote upload is feature-gated, authenticated, and same-origin protected', () => {
  const route = source(
    'src/admin/api/quote-requests/[quoteRequestId]/documents/route.ts'
  );
  const wrapper = source(
    'src/app/api/admin/quote-requests/[quoteRequestId]/documents/route.ts'
  );

  assert.match(route, /isQuoteAdminEnabled\(\)/u);
  assert.match(route, /hasValidQuoteAdminSession\(request\)/u);
  assert.match(route, /requestOriginMatchesHost\(request\)/u);
  assert.match(route, /status:\s*401/u);
  assert.match(route, /status:\s*403/u);
  assert.match(wrapper, /quote-requests\/\[quoteRequestId\]\/documents\/route/u);
});

test('manual quote upload accepts both document types and validates real PDFs up to 10 MB', () => {
  const route = source(
    'src/admin/api/quote-requests/[quoteRequestId]/documents/route.ts'
  );
  const upload = source(
    'src/admin/api/quote-requests/[quoteRequestId]/documents/manualQuoteDocumentUpload.ts'
  );

  assert.match(upload, /multipart\/form-data/u);
  assert.match(route, /uploadManualQuoteDocument\(request, quoteRequestId/u);
  assert.match(upload, /request\.formData\(\)/u);
  assert.match(upload, /formData\.get\('file'\)/u);
  assert.match(upload, /formData\.get\('type'\)/u);
  assert.match(upload, /formData\.get\('offerVersionId'\)/u);
  assert.match(upload, /new Set\(\['offer', 'purchase_order'\]\)/u);
  assert.match(upload, /10 \* 1024 \* 1024/u);
  assert.match(upload, /application\/pdf/u);
  assert.match(upload, /\.endsWith\('\.pdf'\)/u);
  assert.match(upload, /%PDF-/u);
  assert.match(upload, /file\.size\s*(?:<=|<)\s*(?:0|1)/u);
  assert.match(upload, /file\.size\s*>\s*MAX_[A-Z_]+/u);
});

test('manual attachments are private and append-only without becoming lifecycle evidence', () => {
  const route = source(
    'src/admin/api/quote-requests/[quoteRequestId]/documents/route.ts'
  );
  const upload = source(
    'src/admin/api/quote-requests/[quoteRequestId]/documents/manualQuoteDocumentUpload.ts'
  );
  const detailReader = source('src/shared/server/quotes.ts');
  const download = source(
    'src/admin/api/quote-requests/[quoteRequestId]/documents/[documentId]/route.ts'
  );

  assert.match(route, /offer\.quote_request_id = \$2/u);
  assert.match(upload, /offer\.quote_request_id = request_record\.id/u);
  assert.match(upload, /buildQuoteDocumentBlobPath/u);
  assert.match(upload, /uploadPrivateOrderDocumentBlob/u);
  assert.match(upload, /deletePrivateOrderDocumentBlob/u);
  assert.match(upload, /insert into quote_manual_documents/u);
  assert.match(upload, /'admin'/u);
  assert.match(upload, /created:\s*true/u);
  assert.match(upload, /status:\s*201/u);
  assert.doesNotMatch(
    upload,
    /update\s+(?:quote_requests|quote_offer_versions)|document_sha256/iu
  );

  assert.match(detailReader, /quote_manual_documents/u);
  assert.match(detailReader, /manual_upload/u);
  assert.match(detailReader, /generated/u);
  assert.match(download, /quote_manual_documents/u);
  assert.match(download, /hasValidQuoteAdminSession\(request\)/u);
  assert.match(download, /readPrivateOrderDocumentBlob/u);
  assert.match(download, /no-store, private/u);
});

test('generated offer creation remains the canonical JSON branch after a manual attachment', () => {
  const route = source(
    'src/admin/api/quote-requests/[quoteRequestId]/documents/route.ts'
  );
  const worker = source('src/shared/server/quoteDocumentJobs.ts');

  assert.match(route, /readRequiredJsonRecord\(request\)/u);
  assert.match(route, /processQuoteDocumentJobs\(pool, \{[\s\S]*?offerVersionId/u);
  assert.match(route, /findOfferDocument/u);
  assert.match(route, /ISSUED_LIFECYCLE_STATUSES/u);
  assert.match(worker, /insert into quote_documents/u);
  assert.doesNotMatch(worker, /insert into quote_manual_documents/u);
});

test('quote detail offers compact manual upload controls for offer and purchase-order rows', () => {
  const documents = source(
    'src/admin/features/quotes/components/AdminQuoteDocumentsManager.tsx'
  );

  assert.match(documents, /useRef/u);
  assert.match(documents, /UploadIcon/u);
  assert.match(
    documents,
    /data-testid=\{`quote-document-upload-input-\$\{documentType\.key\}`\}/u
  );
  assert.match(documents, /type="file"/u);
  assert.match(documents, /accept="application\/pdf,\.pdf"/u);
  assert.match(documents, /formData\.append\('file', file\)/u);
  assert.match(documents, /formData\.append\('type', documentType\)/u);
  assert.match(
    documents,
    /formData\.append\('offerVersionId', String\([^)]+\)\)/u
  );
  assert.match(
    documents,
    /label:\s*displayedDocument\s*\?\s*'Naloži novo različico'\s*:\s*'Naloži PDF'/u
  );
  assert.match(
    documents,
    /uploadLabel:\s*'Naloži ponudbo'/u
  );
  assert.match(
    documents,
    /uploadLabel:\s*'Naloži naročilnico'/u
  );
  assert.match(
    documents,
    /aria-label=\{documentType\.uploadLabel\}/u
  );
  assert.match(documents, /document\.source === 'generated'/u);
  assert.match(
    documents,
    /JSON\.stringify\(\{ offerVersionId: issuedOfferVersion\.id \}\)/u
  );
  assert.match(documents, /data-testid="quote-document-generate-offer"/u);
});
