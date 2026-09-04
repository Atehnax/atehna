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
    contentHtml:
      '<p>Pozdravljeni,</p><h1>Internal offer {{offer_number}}</h1><p>Administrator body for {{request_number}}.</p>'
  });
  assert.deepEqual(normalized.templates.quote_issued.customer, {
    subject: 'Customer offer {{offer_number}}',
    contentHtml:
      '<p>Pozdravljeni, {{recipient_name}},</p><h1>Customer offer {{offer_number}}</h1><p>Customer body.</p>'
  });
  assert.deepEqual(
    normalized.templates.quote_issued.companyCustomer,
    normalized.templates.quote_issued.customer
  );
  assert.deepEqual(
    normalized.templates.quote_issued.schoolCustomer,
    normalized.templates.quote_issued.customer
  );
  assert.deepEqual(validateQuoteEmailSettings(normalized), []);

  normalized.templates.quote_issued.admin.subject = 'Changed internal subject';
  normalized.templates.quote_issued.companyCustomer.subject =
    'Changed company subject';
  assert.equal(
    normalized.templates.quote_issued.customer.subject,
    'Customer offer {{offer_number}}'
  );
  assert.notEqual(
    cloneDefaultQuoteEmailSettings().templates.quote_issued.admin.subject,
    'Changed internal subject'
  );
  assert.notEqual(
    cloneDefaultQuoteEmailSettings().templates.quote_issued.companyCustomer.subject,
    'Changed company subject'
  );
});

test('quote template headers reject CRLF injection and malformed raw values', () => {
  const unsafe = cloneDefaultQuoteEmailSettings();
  unsafe.templates.quote_issued.customer.subject =
    'Ponudba\r\nBcc: victim@example.com';
  const errors = validateQuoteEmailSettings({
    ...unsafe,
    templates: {
      ...unsafe.templates,
      quote_issued: {
        ...unsafe.templates.quote_issued,
        customer: {
          ...unsafe.templates.quote_issued.customer,
          subject: unsafe.templates.quote_issued.customer.subject,
          greeting: 42
        }
      }
    }
  });

  assert.ok(errors.some((error) => /zadeva.*kontrolnih znakov/u.test(error)));
  assert.ok(errors.some((error) => /pozdrav ni veljaven/u.test(error)));
  assert.equal(
    normalizeQuoteEmailSettings(unsafe).templates.quote_issued.customer.subject,
    'Ponudba Bcc: victim@example.com'
  );
});

test('quote settings persistence stores every template variant in the normalized config', () => {
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
    /audience: recipient\.audience[\s\S]*?customerType: isCustomerType\(identity\.customer_type\)[\s\S]*?recipientEmail: recipient\.email[\s\S]*?recipientName: recipient\.name[\s\S]*?sharedSettings: shared[\s\S]*?quoteSettings: settings/u
  );
  assert.match(templates, /const templateAudience =/u);
  assert.match(templates, /input\.customerType === 'school'/u);
  assert.match(templates, /input\.customerType === 'company'/u);
  assert.match(templates, /configuredTemplates\[templateAudience\]/u);
  assert.match(
    templates,
    /const templateSubject =[\s\S]*?audienceTemplate\.subject[\s\S]*?defaults\.subject/u
  );
  assert.match(
    templates,
    /const subject =[\s\S]*?safeHeaderText\(render\(templateSubject, variables\)\)[\s\S]*?safeHeaderText\(render\(defaults\.subject, variables\)\)/u
  );
  assert.match(
    templates,
    /const defaultGreeting =[\s\S]*?input\.audience === 'admin'[\s\S]*?QUOTE_EMAIL_DEFAULT_ADMIN_GREETING[\s\S]*?QUOTE_EMAIL_DEFAULT_GREETING/u
  );
  assert.match(
    templates,
    /const configuredContent =[\s\S]*?audienceTemplate\.contentHtml[\s\S]*?sanitizeEmailTemplateRichText\(audienceTemplate\.contentHtml\)/u
  );
  assert.match(
    templates,
    /const legacyContent = legacyEmailTemplateContentHtml\(\{[\s\S]*?audienceTemplate\.greeting[\s\S]*?audienceTemplate\.heading[\s\S]*?audienceTemplate\.body/u
  );
  assert.match(
    templates,
    /const content = renderEmailTemplateRichText\([\s\S]*?configuredContent \|\| legacyContent,[\s\S]*?variables/u
  );
  assert.match(
    templates,
    /const eventContentHtml = `\$\{templateContentHtml\}\$\{detailContentHtml\}`/u
  );
  assert.match(
    jobs,
    /audience: recipient\.audience[\s\S]*?message[\s\S]*?encryptQuoteEmailEnvelope\(JSON\.stringify\(envelope\)/u
  );
});
