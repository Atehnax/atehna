import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  cloneDefaultQuoteEmailSettings,
  normalizeQuoteEmailSettings,
  validateQuoteEmailSettings
} from '../../src/shared/domain/quote/quoteEmailSettings';

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

test('quote administrator templates normalize and validate independently from customer templates', () => {
  const normalized = normalizeQuoteEmailSettings({
    templates: {
      quote_issued: {
        customer: {
          subject: 'Customer offer {{offer_number}}',
          body: 'Customer body.'
        },
        admin: {
          subject: 'Internal offer {{offer_number}}',
          body: 'Administrator body for {{request_number}}.'
        }
      }
    }
  });

  assert.deepEqual(normalized.templates.quote_issued.admin, {
    subject: 'Internal offer {{offer_number}}',
    body: 'Administrator body for {{request_number}}.'
  });
  assert.deepEqual(normalized.templates.quote_issued.customer, {
    subject: 'Customer offer {{offer_number}}',
    body: 'Customer body.'
  });
  assert.deepEqual(validateQuoteEmailSettings(normalized), []);

  normalized.templates.quote_issued.admin.subject = 'Changed internal subject';
  assert.equal(
    normalized.templates.quote_issued.customer.subject,
    'Customer offer {{offer_number}}'
  );
  assert.notEqual(
    cloneDefaultQuoteEmailSettings().templates.quote_issued.admin.subject,
    'Changed internal subject'
  );
});

test('quote settings persistence stores both audience templates in the normalized config', () => {
  const settings = source('src/shared/server/quoteEmailSettings.ts');

  assert.match(settings, /const normalized = normalizeQuoteEmailSettings\(value\)/u);
  assert.match(settings, /const \{ updatedAt: _updatedAt, \.\.\.stored \} = normalized/u);
  assert.match(settings, /JSON\.stringify\(stored\)/u);
  assert.match(
    settings,
    /insert into quote_email_settings \(key, config_json, updated_at\)[\s\S]*?on conflict \(key\)[\s\S]*?config_json = excluded\.config_json/u
  );
});

test('quote enqueue resolves and snapshots the configured template for each recipient audience', () => {
  const jobs = source('src/shared/server/quoteEmailJobs.ts');
  const templates = source(
    'src/shared/domain/quote/quoteEmailTemplates.ts'
  );

  assert.match(jobs, /buildQuoteEmailMessage\(\{/u);
  assert.match(
    jobs,
    /audience: recipient\.audience[\s\S]*?recipientEmail: recipient\.email[\s\S]*?sharedSettings: shared[\s\S]*?quoteSettings: settings/u
  );
  assert.match(templates, /const configuredTemplate = input\.quoteSettings\.templates\[/u);
  assert.match(templates, /configuredTemplate\[input\.audience\]/u);
  assert.match(
    templates,
    /const subject = render\([\s\S]*?audienceTemplate\.subject[\s\S]*?defaults\.subject[\s\S]*?variables/u
  );
  assert.match(
    templates,
    /const baseBody = render\([\s\S]*?audienceTemplate\.body[\s\S]*?defaults\.body[\s\S]*?variables/u
  );
  assert.match(
    jobs,
    /audience: recipient\.audience[\s\S]*?message[\s\S]*?encryptQuoteEmailEnvelope\(JSON\.stringify\(envelope\)/u
  );
});
