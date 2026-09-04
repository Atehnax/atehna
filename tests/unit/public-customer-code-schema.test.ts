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

test('public-code migration backfills safely without rewriting commercial history', () => {
  const migration = source(
    'database/migrations/20260904_public_customer_codes.sql'
  );

  assert.match(migration, /begin;[\s\S]*commit;\s*$/u);
  assert.match(migration, /lock table public\.quote_requests,[\s\S]*share row exclusive mode/u);
  assert.match(
    migration,
    /disable trigger quote_requests_guard_history[\s\S]*enable trigger quote_requests_guard_history/u
  );
  assert.match(migration, /having count\(\*\) > 1/u);
  assert.match(
    migration,
    /set public_code_base = request\.public_code_base[\s\S]*source_quote_offer_version_id = offer\.id/u
  );
  assert.match(migration, /attempts > 100/u);
  assert.match(migration, /guard_order_public_code_lineage/u);
  assert.match(migration, /new\.public_code_base := quote_public_code_base/u);
  assert.match(migration, /guard_quote_public_code_namespace/u);
  assert.match(migration, /pg_advisory_xact_lock/u);
  assert.doesNotMatch(
    migration,
    /(?:order|quote)_email_(?:settings|jobs)|migrate_(?:order|quote)_customer_templates/iu
  );
});

test('post-deploy template migration is explicitly gated and leaves queued envelopes untouched', () => {
  const migration = source(
    'database/migrations/20260905_public_code_email_templates_postdeploy.sql'
  );
  const orderStart = migration.indexOf('do $migrate_order_customer_templates$');
  const orderEnd = migration.indexOf(
    '$migrate_order_customer_templates$;',
    orderStart
  );
  const quoteStart = migration.indexOf('do $migrate_quote_customer_templates$');
  const quoteEnd = migration.indexOf(
    '$migrate_quote_customer_templates$;',
    quoteStart
  );
  const orderMigration = migration.slice(orderStart, orderEnd);
  const quoteMigration = migration.slice(quoteStart, quoteEnd);

  assert.match(migration, /begin;[\s\S]*commit;\s*$/u);
  assert.match(
    migration,
    /atehna\.public_code_email_templates_app_ready[\s\S]*is distinct from 'v1'/u
  );
  assert.match(migration, /20260904\.prelaunch-v2/u);
  assert.equal(
    migration.split("status in ('pending', 'processing', 'failed')").length - 1,
    2
  );
  assert.doesNotMatch(
    migration,
    /(?:update|delete\s+from)\s+public\.(?:order_email_jobs|quote_email_jobs)/iu
  );
  assert.match(orderMigration, /where key = 'order-email-notifications'/u);
  assert.match(quoteMigration, /where key = 'default'/u);

  for (const block of [orderMigration, quoteMigration]) {
    assert.match(
      block,
      /foreach audience_name in array array\[\s*'customer',\s*'companyCustomer',\s*'schoolCustomer'\s*\]/u
    );
    for (const field of ['subject', 'contentHtml', 'greeting', 'heading', 'body']) {
      assert.match(block, new RegExp(`'${field}'`, 'u'));
    }
    assert.match(block, /admin_templates_before/u);
    assert.match(
      block,
      /admin_templates_after is distinct from admin_templates_before/u
    );
  }

  assert.match(orderMigration, /stored_version > 8/u);
  assert.match(orderMigration, /stored_version is distinct from 8/u);
  assert.ok(
    orderMigration.includes(
      String.raw`\{\{[[:space:]]*order_number[[:space:]]*\}\}`
    )
  );
  assert.match(orderMigration, /\{\{order_code\}\}/u);
  assert.match(orderMigration, /'\{version\}', '8'::jsonb/u);

  assert.match(quoteMigration, /stored_version > 2/u);
  assert.match(quoteMigration, /stored_version is distinct from 2/u);
  assert.match(quoteMigration, /quote_request_submitted/u);
  assert.match(quoteMigration, /quote_delivery_failed/u);
  assert.match(quoteMigration, /request_replacement := case/u);
  assert.match(quoteMigration, /offer_replacement := case/u);
  assert.match(quoteMigration, /'\{version\}', '2'::jsonb/u);
  assert.match(
    migration,
    /Legacy sequential customer-template variables remain\./u
  );

  for (const automaticDatabasePath of [
    'scripts/check-database-schema.mjs',
    'scripts/e2e-database.mjs'
  ]) {
    assert.doesNotMatch(
      source(automaticDatabasePath),
      /20260905_public_code_email_templates_postdeploy/u,
      `${automaticDatabasePath} must not execute the operator-controlled data step`
    );
  }
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
