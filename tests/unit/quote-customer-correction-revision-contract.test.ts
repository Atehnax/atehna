import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

test('issued customer corrections clone commercial data without touching the issued snapshot, PDF, price, or stock', () => {
  const details = source(
    'src/admin/api/quote-requests/[quoteRequestId]/details/route.ts'
  );
  const revision = source('src/shared/server/quoteOfferRevision.ts');
  const reviseRoute = source(
    'src/admin/api/quote-requests/[quoteRequestId]/revise/route.ts'
  );

  assert.match(details, /createQuoteOfferDraftRevision\(client/u);
  assert.match(reviseRoute, /createQuoteOfferDraftRevision\(client/u);
  assert.doesNotMatch(reviseRoute, /insert into quote_offer_versions/u);
  assert.doesNotMatch(reviseRoute, /insert into quote_offer_version_items/u);
  assert.match(details, /sourceRemainsImmutable: true/u);
  assert.match(details, /sourceRemainsCurrentUntilIssue: true/u);
  assert.match(details, /issuedSnapshotPreserved: Boolean\(currentIssuedOffer\)/u);
  assert.match(details, /correctionScope: currentIssuedOffer \? 'draft_revision' : 'request'/u);
  assert.match(details, /expectedDraftStateVersion/u);
  assert.match(details, /code: 'QUOTE_DRAFT_STALE'/u);
  assert.match(
    details,
    /set customer_snapshot_json = \$2::jsonb,[\s\S]*?billing_snapshot_json = \$2::jsonb,[\s\S]*?acceptance_method = \$3/u
  );
  assert.match(details, /quoteReason,[\s\S]*?customerMessage/u);
  assert.match(details, /eventType: 'quote_request_details_changed'/u);
  assert.match(details, /previous_customer_type/u);
  assert.match(details, /next_customer_type/u);

  assert.match(revision, /insert into quote_offer_versions/u);
  assert.match(revision, /insert into quote_offer_version_items/u);
  assert.match(revision, /select[\s\S]*?base_unit_net[\s\S]*?line_gross[\s\S]*?from quote_offer_version_items/u);
  for (const forbidden of [
    /update\s+quote_offer_versions/iu,
    /quote_documents/iu,
    /catalog_item_variants/iu,
    /order_stock_holds/iu,
    /stock_movements/iu,
    /loadAuthoritative/iu
  ]) {
    assert.doesNotMatch(revision, forbidden);
  }
});

test('admin detail and draft saves use the corrected draft snapshot while the issued offer remains current', () => {
  const loader = source('src/shared/server/quotes.ts');
  const draft = source(
    'src/admin/api/quote-requests/[quoteRequestId]/draft/route.ts'
  );

  assert.match(
    loader,
    /draftSnapshotRow && currentIssuedRow[\s\S]*?draftCustomerOverlay[\s\S]*?requestDetail\('customerType', 'customer_type'\)/u
  );
  assert.match(loader, /requestDetail\('quoteReason', 'quote_reason'\)/u);
  assert.match(loader, /requestDetail\('customerMessage', 'customer_message'\)/u);

  assert.match(
    draft,
    /savedDraftCustomer[\s\S]*?effectiveCustomer[\s\S]*?const customer = effectiveCustomer/u
  );
  assert.match(
    draft,
    /effectiveCustomerType === 'school' \? 'purchase_order' : 'online'/u
  );
  assert.match(
    draft,
    /update quote_requests[\s\S]*?state_version = state_version \+ 1/u
  );
});

test('issuing a corrected revision promotes request data only after preserving the old issued offer', () => {
  const issue = source(
    'src/admin/api/quote-requests/[quoteRequestId]/issue/route.ts'
  );
  const schema = source('database/schema.sql');

  const supersede = issue.indexOf("set status = 'superseded'");
  const promote = issue.indexOf('set customer_type = $2');
  const issueDraft = issue.indexOf('set offer_number = $2');
  assert.ok(supersede >= 0);
  assert.ok(promote > supersede);
  assert.ok(issueDraft > promote);

  assert.match(
    issue,
    /const draftCustomer = jsonRecord\(draft\.customer_snapshot_json\)[\s\S]*?const customerType = text\(snapshotValue\('customerType', 'customer_type'\), 32\)/u
  );
  assert.match(
    issue,
    /set customer_type = \$2,[\s\S]*?quote_reason = \$13,[\s\S]*?customer_message = \$14,[\s\S]*?billing_snapshot_json = \$15::jsonb/u
  );
  assert.match(
    issue,
    /const acceptanceMethod =[\s\S]*?customerType === 'school' \? 'purchase_order' : 'online'/u
  );
  assert.doesNotMatch(
    issue.slice(supersede, promote),
    /customer_snapshot_json|billing_snapshot_json|document_sha256|quote_documents/u
  );

  assert.match(
    schema,
    /Customer details on a current issued offer are immutable\./u
  );
});
