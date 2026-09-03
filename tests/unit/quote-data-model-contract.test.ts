import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

const canonicalSchema = source('database/schema.sql');
const deployment = source(
  'database/migrations/20260828_quote_workflow_and_order_contract.sql'
);
const requestManagementDeployment = source(
  'database/migrations/20260829_quote_request_management.sql'
);
const clarificationEmailDeployment = source(
  'database/migrations/20260830_quote_clarification_email.sql'
);
const optionalAcceptanceTermsDeployment = source(
  'database/migrations/20260901_quote_optional_acceptance_terms.sql'
);

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

function constantSqlTextArray(sql: string, variableName: string): string[] {
  const match = sql.match(
    new RegExp(
      variableName + '\\s+constant\\s+text\\[\\]\\s*:=\\s*array\\[([\\s\\S]*?)\\];',
      'u'
    )
  );
  assert.ok(match, 'missing ' + variableName);
  return Array.from(match[1].matchAll(/'([^']+)'/gu), (entry) => entry[1]);
}

test('canonical and original additive quote table definitions stay aligned before later evolutions', () => {
  for (const tableName of [
    'order_stock_holds',
    'quote_number_counters',
    'quote_request_items',
    'quote_offer_version_items',
    'quote_offer_acceptances',
    'quote_documents',
    'quote_document_jobs',
    'quote_access_tokens',
    'quote_request_idempotency_keys',
    'quote_response_idempotency_keys',
    'quote_email_verifications',
    'quote_rate_limits',
    'quote_email_settings'
  ]) {
    assert.equal(
      tableDefinition(deployment, tableName),
      tableDefinition(canonicalSchema, tableName),
      tableName + ' differs between the clean schema and additive deployment'
    );
  }

  const originalOfferVersions = tableDefinition(
    deployment,
    'quote_offer_versions'
  );
  const expectedEvolvedOfferVersions = originalOfferVersions.replace(
    " and nullif(btrim(terms_text), '') is not null",
    ''
  );
  assert.equal(
    tableDefinition(canonicalSchema, 'quote_offer_versions'),
    expectedEvolvedOfferVersions,
    'quote_offer_versions differs beyond the reviewed optional acceptance-terms evolution'
  );
});

test('issued offers may omit free-text acceptance terms without weakening other identity evidence', () => {
  const offerVersions = tableDefinition(canonicalSchema, 'quote_offer_versions');
  const replacementStart = optionalAcceptanceTermsDeployment.indexOf(
    'alter table quote_offer_versions'
  );
  const postflightStart = optionalAcceptanceTermsDeployment.indexOf(
    '\ndo $$',
    replacementStart
  );
  assert.ok(replacementStart >= 0, 'missing quote-offer constraint replacement');
  assert.ok(postflightStart > replacementStart, 'missing quote-offer migration postflight');
  const replacement = optionalAcceptanceTermsDeployment.slice(
    replacementStart,
    postflightStart
  );

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
    assert.match(replacement, requiredIdentityRule);
  }
  assert.doesNotMatch(
    offerVersions,
    /nullif\(btrim\(terms_text\), ''\) is not null/u
  );
  assert.doesNotMatch(replacement, /\bterms_text\b/u);
  assert.match(optionalAcceptanceTermsDeployment, /^begin;/mu);
  assert.match(optionalAcceptanceTermsDeployment, /pg_advisory_xact_lock/u);
  assert.match(
    optionalAcceptanceTermsDeployment,
    /installed_constraint_oid[\s\S]*?installed_constraint_definition/u
  );
  assert.match(
    optionalAcceptanceTermsDeployment,
    /drop constraint quote_offer_versions_issue_identity_check[\s\S]*?add constraint quote_offer_versions_issue_identity_check/u
  );
  assert.match(optionalAcceptanceTermsDeployment, /commit;\s*$/u);
});

test('clarification email evolves the outbox event constraint through a reviewed migration', () => {
  const emailJobs = tableDefinition(canonicalSchema, 'quote_email_jobs');
  const predecessorEventTypes = constantSqlTextArray(
    clarificationEmailDeployment,
    'predecessor_event_types'
  );
  const targetEventTypes = constantSqlTextArray(
    clarificationEmailDeployment,
    'target_event_types'
  );
  const expectedPredecessorEventTypes = [
    'quote_acceptance_blocked_stock',
    'quote_accepted',
    'quote_access_otp',
    'quote_declined',
    'quote_delivery_failed',
    'quote_expired',
    'quote_issued',
    'quote_request_closed',
    'quote_request_submitted',
    'quote_withdrawn'
  ];

  assert.match(emailJobs, /quote_clarification_requested/u);
  assert.match(clarificationEmailDeployment, /^begin;/mu);
  assert.match(clarificationEmailDeployment, /pg_advisory_xact_lock/u);
  assert.match(
    clarificationEmailDeployment,
    /alter table quote_email_jobs[\s\S]*?drop constraint[\s\S]*?quote_email_jobs_event_type_check/u
  );
  assert.match(
    clarificationEmailDeployment,
    /add constraint quote_email_jobs_event_type_check[\s\S]*?quote_clarification_requested/u
  );
  assert.deepEqual(predecessorEventTypes, expectedPredecessorEventTypes);
  assert.deepEqual(
    targetEventTypes,
    [...expectedPredecessorEventTypes, 'quote_clarification_requested'].sort()
  );
  assert.match(clarificationEmailDeployment, /installed_constraint_oid oid/u);
  assert.match(clarificationEmailDeployment, /installed_event_types text\[\]/u);
  assert.match(
    clarificationEmailDeployment,
    /array_agg\(distinct \(captured\.matches\)\[1\] order by \(captured\.matches\)\[1\]\)/u
  );
  assert.match(
    clarificationEmailDeployment,
    /regexp_matches\([\s\S]*?pg_get_constraintdef\(installed_constraint_oid, true\)[\s\S]*?captured\(matches\)/u
  );
  assert.match(
    clarificationEmailDeployment,
    /installed_event_types is distinct from predecessor_event_types[\s\S]*?installed_event_types is distinct from target_event_types/u
  );
  const postflight = clarificationEmailDeployment.slice(
    clarificationEmailDeployment.indexOf('alter table quote_email_jobs')
  );
  assert.match(
    postflight,
    /installed_event_types is distinct from target_event_types/u
  );
  assert.doesNotMatch(clarificationEmailDeployment, /position\(/u);
  assert.match(clarificationEmailDeployment, /commit;\s*$/u);
});test('manual intake and logical void evolve requests and events through a transactional additive migration', () => {
  assert.match(requestManagementDeployment, /^begin;/mu);
  assert.match(requestManagementDeployment, /pg_advisory_xact_lock/u);
  assert.match(
    requestManagementDeployment,
    /alter table quote_requests[\s\S]*?add column if not exists intake_source/u
  );
  assert.match(
    requestManagementDeployment,
    /add column if not exists voided_at[\s\S]*?add column if not exists voided_by_actor_id[\s\S]*?add column if not exists void_reason/u
  );
  assert.match(requestManagementDeployment, /admin_email/u);
  assert.match(requestManagementDeployment, /admin_testing/u);
  assert.match(requestManagementDeployment, /request_voided/u);
  assert.match(
    requestManagementDeployment,
    /Quote requests are durable records and cannot be deleted/u
  );
  assert.match(
    requestManagementDeployment,
    /explicitly tagged test request can be voided/u
  );
  assert.match(
    requestManagementDeployment,
    /Non-test quote requests with commercial history cannot be voided/u
  );
  assert.match(
    requestManagementDeployment,
    /customer acceptance, purchase-order evidence, or linked orders cannot be voided/u
  );
  assert.match(requestManagementDeployment, /commit;\s*$/u);

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
  assert.doesNotMatch(canonicalSchema, /source_quote_offer_version_id is null/u);
  assert.doesNotMatch(deployment, /source_quote_offer_version_id is null/u);
  assert.match(canonicalSchema, /'order_accepted'/u);
  assert.match(canonicalSchema, /'order_rejected'/u);
  assert.match(
    deployment,
    /alter table order_email_jobs[\s\S]*?order_email_jobs_event_type_check/u
  );
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

test('deployment is transactional, conservative, and never mutates inventory', () => {
  assert.match(deployment, /^begin;/mu);
  assert.match(deployment, /pg_advisory_xact_lock/u);
  assert.match(deployment, /classification', 'conservative_operational_evidence'/u);
  assert.match(deployment, /inventoryChangedByMigration', false/u);
  assert.match(deployment, /raise notice 'Legacy stock rows require reconciliation/u);
  assert.doesNotMatch(deployment, /update\s+catalog_item_variants/iu);
  assert.match(deployment, /commit;\s*$/u);
});

test('quote feature flags are independent and default closed', () => {
  const flags = source('src/shared/server/environmentCore.mjs');
  for (const environmentName of [
    'QUOTE_ADMIN_ENABLED',
    'QUOTE_PUBLIC_REQUESTS_ENABLED',
    'QUOTE_ONLINE_ACCEPTANCE_ENABLED',
    'QUOTE_EMAIL_DELIVERY_ENABLED'
  ]) {
    assert.match(flags, new RegExp('environment\\.' + environmentName, 'u'));
  }
  assert.match(flags, /value\?\.trim\(\)\.toLowerCase\(\) === 'true'/u);
  assert.match(flags, /value\?\.trim\(\) === '1'/u);
});
