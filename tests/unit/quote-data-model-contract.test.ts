import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

const canonicalSchema = source('database/schema.sql');

function TypeScriptFilesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) return TypeScriptFilesUnder(absolutePath);
    return entry.isFile() && /\.tsx?$/u.test(entry.name) ? [absolutePath] : [];
  });
}

function tableDefinition(sql: string, tableName: string): string {
  const match = sql.match(
    new RegExp('create table ' + tableName + '\\s*\\(([\\s\\S]*?)\\n\\);', 'u')
  );
  assert.ok(match, 'missing table ' + tableName);
  return match[1].replaceAll(/\s+/gu, ' ').trim();
}


test('issued offers may omit free-text acceptance terms without weakening other identity evidence', () => {
  const offerVersions = tableDefinition(canonicalSchema, 'quote_offer_versions');

  for (const requiredIdentityRule of [
    /valid_until is not null/u,
    /valid_until > issued_at/u,
    /nullif\(btrim\(delivery_terms\), ''\) is not null/u,
    /nullif\(btrim\(payment_terms\), ''\) is not null/u,
    /nullif\(btrim\(terms_version\), ''\) is not null/u,
    /terms_hash is not null/u,
    /content_hash is not null/u
  ]) {
    assert.match(offerVersions, requiredIdentityRule);
  }
  assert.doesNotMatch(
    offerVersions,
    /nullif\(btrim\(terms_text\), ''\) is not null/u
  );
});

test('canonical outbox permits clarification email events', () => {
  const emailJobs = tableDefinition(canonicalSchema, 'quote_email_jobs');

  assert.match(emailJobs, /quote_clarification_requested/u);
});

test('canonical requests persist manual intake and logical void evidence', () => {

  for (const column of [
    'intake_source',
    'voided_at',
    'voided_by_actor_id',
    'void_reason'
  ]) {
    assert.match(
      tableDefinition(canonicalSchema, 'quote_requests'),
      new RegExp('\\b' + column + '\\b', 'u')
    );
  }
  assert.match(tableDefinition(canonicalSchema, 'quote_events'), /request_voided/u);
});

test('orders persist seller contract evidence and one durable source-offer origin', () => {
  for (const column of [
    'contract_status',
    'contract_accepted_at',
    'contract_accepted_actor_type',
    'contract_accepted_actor_id',
    'contract_acceptance_evidence_json',
    'contract_rejected_at',
    'contract_rejected_actor_type',
    'contract_rejected_actor_id',
    'contract_rejection_evidence_json',
    'contract_state_version',
    'committed_at',
    'source_quote_offer_version_id'
  ]) {
    assert.match(canonicalSchema, new RegExp('\\b' + column + '\\b', 'u'));
  }
  assert.match(
    canonicalSchema,
    /contract_status in \('pending_seller_acceptance', 'accepted', 'rejected'\)/u
  );
  assert.match(
    canonicalSchema,
    /create unique index idx_orders_source_quote_offer_version[\s\S]*?where source_quote_offer_version_id is not null/u
  );
  assert.match(
    canonicalSchema,
    /orders_source_quote_offer_version_id_fkey[\s\S]*?references quote_offer_versions\(id\)[\s\S]*?on delete restrict/u
  );
  // The order definition must permit converted orders; analytics may classify null origins as direct.
  assert.doesNotMatch(tableDefinition(canonicalSchema, 'orders'), /source_quote_offer_version_id is null/u);
  assert.match(canonicalSchema, /'order_accepted'/u);
  assert.match(canonicalSchema, /'order_rejected'/u);
});

test('quote snapshots and issued offer history are immutable', () => {
  const requestItems = tableDefinition(canonicalSchema, 'quote_request_items');
  const offerItems = tableDefinition(canonicalSchema, 'quote_offer_version_items');
  for (const definition of [requestItems, offerItems]) {
    for (const snapshotColumn of [
      'line_number',
      'catalog_variant_id',
      'quantity',
      'min_order',
      'available_stock_at_request',
      'base_unit_net',
      'discount_pct',
      'unit_net',
      'unit_tax',
      'unit_gross',
      'line_net',
      'line_tax',
      'line_gross',
      'snapshot_json'
    ]) {
      assert.match(definition, new RegExp('\\b' + snapshotColumn + '\\b', 'u'));
    }
  }

  assert.match(canonicalSchema, /quote_request_items_append_only/u);
  assert.match(canonicalSchema, /quote_offer_version_items_guard/u);
  assert.match(
    canonicalSchema,
    /Issued offer identity, items, pricing, terms, and content are immutable/u
  );
  assert.match(
    canonicalSchema,
    /Offer number must match its POV request serial and version/u
  );
  assert.match(
    canonicalSchema,
    /quote_offer_versions_one_current[\s\S]*?where is_current/u
  );
  assert.match(
    canonicalSchema,
    /quote_offer_versions_one_draft[\s\S]*?where status = 'draft'/u
  );
  assert.match(
    canonicalSchema,
    /shipping_confirmation_json is not null[\s\S]*?free_shipping/u
  );
});

test('acceptance, events, and stock release evidence are durable', () => {
  assert.match(
    canonicalSchema,
    /quote_offer_version_id bigint not null unique references quote_offer_versions/u
  );
  assert.match(canonicalSchema, /quote_offer_acceptances_append_only/u);
  assert.match(canonicalSchema, /quote_events_append_only/u);
  assert.match(canonicalSchema, /guard_order_stock_hold_transition/u);
  assert.match(
    canonicalSchema,
    /state in \('held', 'released', 'legacy_unknown'\)/u
  );
  assert.match(
    canonicalSchema,
    /A released order stock hold is immutable/u
  );
});

test('quote event idempotency targets the matching partial unique index', () => {
  assert.match(
    canonicalSchema,
    /create unique index idx_quote_events_event_key[\s\S]*?where event_key is not null;/u
  );
  const conflictPredicates = TypeScriptFilesUnder(
    resolve(process.cwd(), 'src')
  ).flatMap((filePath) =>
    [...readFileSync(filePath, 'utf8').matchAll(
      /on conflict \(event_key\)([^\n]*)/gu
    )].map((match) => match[1].trim().replace(/['"`;,]+$/u, ''))
  );
  assert.ok(conflictPredicates.length > 0, 'missing quote event conflict targets');
  for (const predicate of conflictPredicates) {
    assert.equal(predicate, 'where event_key is not null do nothing');
  }
});

test('quote credentials, OTP, CSRF, throttling, and replay storage are isolated', () => {
  const access = tableDefinition(canonicalSchema, 'quote_access_tokens');
  assert.match(access, /token_hash text not null unique/u);
  assert.match(access, /token_prefix text not null/u);
  assert.match(access, /csrf_token_hash text/u);
  assert.match(access, /'offer_review'/u);
  assert.match(access, /'offer_response'/u);

  assert.match(canonicalSchema, /create table quote_request_idempotency_keys/u);
  assert.match(canonicalSchema, /create table quote_response_idempotency_keys/u);
  assert.match(canonicalSchema, /bootstrap_token_ciphertext/u);
  assert.match(canonicalSchema, /bootstrap_token_iv/u);
  assert.match(canonicalSchema, /bootstrap_token_tag/u);
  assert.match(canonicalSchema, /create table quote_email_verifications/u);
  assert.match(
    canonicalSchema,
    /scope in \([\s\S]*?'quote_request'[\s\S]*?'otp_issue'[\s\S]*?'offer_response'/u
  );
});

test('quote feature flags are independent and default closed', () => {
  const flags = source('src/shared/server/environmentCore.mjs');
  for (const environmentName of [
    'QUOTE_ADMIN_ENABLED',
    'QUOTE_PUBLIC_REQUESTS_ENABLED',
    'QUOTE_ONLINE_ACCEPTANCE_ENABLED'
  ]) {
    assert.match(flags, new RegExp('environment\\.' + environmentName, 'u'));
  }
  assert.doesNotMatch(flags, /QUOTE_EMAIL_DELIVERY_ENABLED/u);
  assert.match(flags, /value\?\.trim\(\)\.toLowerCase\(\) === 'true'/u);
  assert.match(flags, /value\?\.trim\(\) === '1'/u);
});
