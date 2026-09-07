import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

const alphabet = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const basePattern = `^[${alphabet}]{16}$`;

test('canonical schema owns public-code allocation and immutable quote lineage', () => {
  const schema = source('database/schema.sql');

  assert.equal(alphabet.length, 30);
  for (const ambiguous of ['0', '1', 'I', 'L', 'O', 'U']) {
    assert.equal(alphabet.includes(ambiguous), false);
  }
  assert.match(schema, /create function generate_public_code_base\(\)/u);
  assert.match(schema, /random_chunk := public\.gen_random_bytes\(16\)/u);
  assert.match(schema, /if byte_value < 240 then/u);
  assert.match(
    schema,
    new RegExp(`public_code_base text not null default generate_public_code_base\\(\\)`, 'u')
  );
  assert.equal(schema.split(basePattern).length - 1, 2);
  assert.match(schema, /create unique index idx_orders_public_code_base/u);
  assert.match(schema, /create unique index idx_quote_requests_public_code_base/u);
  assert.match(schema, /Public customer-code bases are immutable\./u);
  assert.match(
    schema,
    /A converted order must retain its quote public-code base\./u
  );
  assert.match(schema, /new\.public_code_base := quote_public_code_base/u);
  assert.match(schema, /create function guard_quote_public_code_namespace\(\)/u);
  assert.match(
    schema,
    /create trigger quote_requests_guard_public_code_namespace[\s\S]*before insert on quote_requests/u
  );
  assert.equal(
    schema.split("hashtextextended('atehna:public-customer-code:'").length - 1,
    2
  );
  assert.equal(schema.split('return null;').length - 1, 2);
  assert.doesNotMatch(schema, /errcode = '23505'/u);
});

test('confirmation PDFs use public codes without replacing formal document numbers', () => {
  const orderSummaryJobs = source('src/shared/server/orderSummaryJobs.ts');
  const quoteConfirmation = source(
    'src/shared/server/quoteRequestConfirmationPdf.ts'
  );
  const offerDocuments = source('src/shared/server/quoteDocumentJobs.ts');
  const documentNumbers = source('src/shared/server/pdfGeneration.ts');
  const adminDocumentRoute = source(
    'src/admin/api/orders/generateOrderDocumentRoute.ts'
  );

  assert.match(
    orderSummaryJobs,
    /const documentNumber = context\.orderForPdf\.publicCode/u
  );
  assert.doesNotMatch(orderSummaryJobs, /allocateOrderDocumentNumber/u);
  assert.match(
    adminDocumentRoute,
    /type === 'order_summary'[\s\S]*?documentNumber = context\.orderForPdf\.publicCode\?\.trim\(\)/u
  );
  assert.match(quoteConfirmation, /documentNumber: quoteCode/u);
  assert.match(
    offerDocuments,
    /const documentNumber = offer\.offer_number/u
  );
  assert.match(offerDocuments, /publicCode: formatOfferCode/u);
  assert.match(
    documentNumbers,
    /type === 'invoice' \? String\(next\)\.padStart\(3, '0'\)/u
  );
});
