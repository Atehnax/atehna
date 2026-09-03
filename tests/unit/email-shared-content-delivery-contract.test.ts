import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

test('order and quote provider payloads combine the persisted image with only the validated transient PDF', () => {
  const orderWorker = source('src/shared/server/orderEmailJobs.ts');
  const quoteWorker = source('src/shared/server/quoteEmailJobs.ts');

  assert.match(
    orderWorker,
    /const attachments:[\s\S]*?message\.attachments[\s\S]*?pdfAttachment[\s\S]*?attachments: providerMessage\.attachments/u
  );
  assert.match(
    quoteWorker,
    /const attachments:[\s\S]*?envelope\.message\.attachments[\s\S]*?pdfAttachment[\s\S]*?\{ attachments \}/u
  );
  assert.match(orderWorker, /hydrateEmailPdfDocument\(client, envelope\.pdfDocument\)/u);
  assert.match(quoteWorker, /hydrateEmailPdfDocument\(client, envelope\.pdfDocument\)/u);
  assert.doesNotMatch(orderWorker, /content_id|contentId/u);
  assert.doesNotMatch(quoteWorker, /content_id|contentId/u);
});

test('quote outbox snapshots shared header, footer, and image before encryption', () => {
  const quoteWorker = source('src/shared/server/quoteEmailJobs.ts');
  const quoteTemplates = source(
    'src/shared/domain/quote/quoteEmailTemplates.ts'
  );

  assert.match(
    quoteTemplates,
    /const headerText = shared\.headerText\.trim\(\);[\s\S]*?const footerText = shared\.footerText\.trim\(\);/u
  );
  assert.match(
    quoteTemplates,
    /normalizeEmailMessageAttachment\(shared\.imageAttachment\)/u
  );
  assert.match(
    quoteTemplates,
    /\[headerText, greeting, heading, eventBody, action, footerText\][\s\S]*?\.join\('\\n\\n'\)/u
  );
  assert.match(
    quoteTemplates,
    /headerText \? `<p[\s\S]*?<h1 style=[\s\S]*?footerText \? `<p/u
  );
  assert.match(
    quoteTemplates,
    /attachments: \[attachment\]/u
  );
  assert.match(
    quoteWorker,
    /buildQuoteEmailMessage\([\s\S]*?const envelope: QuoteEmailEnvelope[\s\S]*?encryptQuoteEmailEnvelope\(JSON\.stringify\(envelope\)/u
  );
});

test('quote provider delivery retries only transient responses and honors Retry-After', () => {
  const quoteWorker = source('src/shared/server/quoteEmailJobs.ts');

  assert.match(quoteWorker, /class QuoteEmailDeliveryError extends Error/u);
  assert.match(
    quoteWorker,
    /retryAfter: response\.headers\.get\('retry-after'\)/u
  );
  assert.match(
    quoteWorker,
    /classifyResendFailure\(error\.resendFailure, Date\.now\(\)\)/u
  );
  assert.match(
    quoteWorker,
    /providerFailure\?\.disposition === 'terminal'/u
  );
  assert.match(
    quoteWorker,
    /providerFailure\?\.retryAfterMs \?\?/u
  );
});
