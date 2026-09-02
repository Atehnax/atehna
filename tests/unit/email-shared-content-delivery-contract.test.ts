import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

test('order and quote provider payloads send only the persisted attachment snapshot', () => {
  const orderWorker = source('src/shared/server/orderEmailJobs.ts');
  const quoteWorker = source('src/shared/server/quoteEmailJobs.ts');

  assert.match(
    orderWorker,
    /message\.attachments\?\.length[\s\S]*?attachments: message\.attachments/u
  );
  assert.match(
    quoteWorker,
    /envelope\.message\.attachments\?\.length[\s\S]*?attachments: envelope\.message\.attachments/u
  );
  assert.doesNotMatch(orderWorker, /content_id|contentId/u);
  assert.doesNotMatch(quoteWorker, /content_id|contentId/u);
});

test('quote outbox snapshots shared header, footer, and image before encryption', () => {
  const quoteWorker = source('src/shared/server/quoteEmailJobs.ts');

  assert.match(
    quoteWorker,
    /const headerText = shared\.headerText\.trim\(\);[\s\S]*?const footerText = shared\.footerText\.trim\(\);/u
  );
  assert.match(
    quoteWorker,
    /normalizeEmailMessageAttachment\(shared\.imageAttachment\)/u
  );
  assert.match(
    quoteWorker,
    /\[headerText, eventBody, action, footerText\][\s\S]*?\.join\('\\n\\n'\)/u
  );
  assert.match(
    quoteWorker,
    /headerText \? `<p[\s\S]*?<h1>[\s\S]*?footerText \? `<p/u
  );
  assert.match(
    quoteWorker,
    /attachments: \[attachment\][\s\S]*?const envelope: QuoteEmailEnvelope[\s\S]*?encryptQuoteEmailEnvelope\(JSON\.stringify\(envelope\)/u
  );
});
