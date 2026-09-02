import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  isSchoolOrderSellerAcceptanceTransition,
  type SchoolOrderSellerAcceptanceTransition
} from '../../src/shared/domain/order/contractStatus';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

const eligibleTransition: SchoolOrderSellerAcceptanceTransition = {
  previousStatus: 'received',
  nextStatus: 'in_progress',
  customerType: 'school',
  commitmentStatus: 'pending_confirmation',
  contractStatus: 'pending_seller_acceptance',
  sourceQuoteOfferVersionId: null,
  hasPurchaseOrderEvidence: true
};

test('a current Naročilnica makes direct and quote-derived pending school orders eligible for seller acceptance', () => {
  assert.equal(isSchoolOrderSellerAcceptanceTransition(eligibleTransition), true);
  assert.equal(
    isSchoolOrderSellerAcceptanceTransition({
      ...eligibleTransition,
      commitmentStatus: 'binding'
    }),
    true
  );
  assert.equal(
    isSchoolOrderSellerAcceptanceTransition({
      ...eligibleTransition,
      sourceQuoteOfferVersionId: 44
    }),
    true
  );

  const ineligible: SchoolOrderSellerAcceptanceTransition[] = [
    { ...eligibleTransition, previousStatus: 'cancelled' },
    { ...eligibleTransition, nextStatus: 'partially_sent' },
    { ...eligibleTransition, customerType: 'company' },
    { ...eligibleTransition, commitmentStatus: 'rejected' },
    { ...eligibleTransition, contractStatus: 'accepted' },
    { ...eligibleTransition, contractStatus: 'rejected' },
    { ...eligibleTransition, hasPurchaseOrderEvidence: false }
  ];
  for (const transition of ineligible) {
    assert.equal(isSchoolOrderSellerAcceptanceTransition(transition), false);
  }
});

test('V obdelavi is the atomic seller-acceptance workflow for a pending school order', () => {
  const route = source('src/admin/api/orders/[orderId]/status/route.ts');
  const acceptance = source(
    'src/shared/server/schoolOrderSellerAcceptance.ts'
  );

  const quoteWorkflowLock = route.indexOf('await lockQuoteWorkflow');
  const orderLock = route.indexOf('const current = await client.query');
  const purchaseOrderQuery = route.indexOf("and type = 'purchase_order'");
  const activeEvidence = route.indexOf(
    'and deleted_at is null',
    purchaseOrderQuery
  );
  const recognizedMarker = route.indexOf(
    'and format_marker = any($2::text[])',
    activeEvidence
  );
  const currentPricingRevision = route.indexOf(
    'select pricing_revision from orders where id = $1',
    recognizedMarker
  );
  const sellerAcceptance = route.indexOf(
    'isSchoolOrderSellerAcceptanceTransition'
  );
  const effectiveCommitment = route.indexOf(
    'const effectiveCommitmentStatus = automaticallyAcceptsPendingOrder'
  );
  const schoolExecutionGate = route.indexOf(
    'const executionBlock = schoolExecutionBlock'
  );
  const readinessCheck = route.indexOf(
    'const readiness = await validateLockedOrderShippingReadiness'
  );
  const ordinaryReadinessBypass = route.indexOf(
    'else if (automaticallyAcceptsDirectOrder)',
    readinessCheck
  );
  const readinessError = route.indexOf(
    "code: 'ORDER_STATUS_SHIPPING_NOT_READY'",
    ordinaryReadinessBypass
  );
  const schoolAcceptanceCall = route.indexOf(
    'await acceptSchoolOrderForProcessing'
  );
  const deliveryPlanMutation = route.indexOf(
    'await applyCompleteOrderDeliveryPlan',
    schoolAcceptanceCall
  );

  assert.ok(quoteWorkflowLock >= 0);
  assert.ok(orderLock > quoteWorkflowLock);
  assert.ok(purchaseOrderQuery > orderLock);
  assert.ok(activeEvidence > purchaseOrderQuery);
  assert.ok(recognizedMarker > activeEvidence);
  assert.ok(currentPricingRevision > recognizedMarker);
  assert.ok(sellerAcceptance >= 0);
  assert.ok(
    route.indexOf(
      'hasPurchaseOrderEvidence: purchaseOrderDocument !== undefined',
      sellerAcceptance
    ) > sellerAcceptance
  );
  assert.ok(effectiveCommitment > sellerAcceptance);
  assert.ok(schoolExecutionGate > effectiveCommitment);
  assert.ok(readinessCheck > schoolExecutionGate);
  assert.ok(ordinaryReadinessBypass > readinessCheck);
  assert.ok(readinessError > ordinaryReadinessBypass);
  assert.ok(schoolAcceptanceCall > readinessError);
  assert.ok(deliveryPlanMutation > schoolAcceptanceCall);
  assert.doesNotMatch(
    route.slice(readinessCheck, readinessError),
    /automaticallyAcceptsSchoolOrder/u
  );

  for (const expected of [
    "if (order.is_draft)",
    "stockFinalizationOutcome = 'deferred_until_draft_finalization'",
    'await lockCatalogOrderability(',
    'await commitOrderStockHolds(',
    "set commitment_status = 'binding',",
    "contract_status = 'accepted',",
    "contract_accepted_actor_type = 'school_purchase_order',",
    'contract_accepted_actor_id = $3,',
    "status = 'received'",
    "customer_type = 'school'",
    "commitment_status in ('pending_confirmation', 'binding')",
    "contract_status = 'pending_seller_acceptance'"
  ]) {
    assert.ok(
      acceptance.includes(expected),
      'Expected school acceptance workflow to contain: ' + expected
    );
  }

  for (const expected of [
    'commitment_status:',
    "before: 'pending_confirmation'",
    "after: 'binding'",
    'purchase_order_document_id:',
    'school_stock_finalization_outcome:',
    'commitmentStatus: resultingCommitmentStatus'
  ]) {
    assert.ok(
      route.includes(expected),
      'Expected status workflow to contain: ' + expected
    );
  }

  assert.doesNotMatch(
    route + acceptance,
    /contact_name|organization_name|address_line1|postal_code|country_code/u
  );
});

test('legacy binding school drafts are accepted only by the V obdelavi status transition', () => {
  const details = source('src/admin/api/orders/[orderId]/details/route.ts');
  const route = source('src/admin/api/orders/[orderId]/status/route.ts');
  const acceptance = source(
    'src/shared/server/schoolOrderSellerAcceptance.ts'
  );

  assert.match(
    acceptance,
    /commitment_status in \('pending_confirmation', 'binding'\)/u
  );
  assert.match(
    route,
    /order_record\.commitment_status in \('pending_confirmation', 'binding'\)/u
  );
  assert.match(route, /const automaticallyBindsPendingOrder =/u);
  assert.match(
    route,
    /changed_field_count: automaticallyBindsPendingOrder[\s\S]*?\? 3[\s\S]*?: automaticallyAcceptsPendingOrder[\s\S]*?\? 2/u
  );
  assert.doesNotMatch(details, /admin_draft_purchase_order/u);
  assert.doesNotMatch(details, /set contract_status = 'accepted'/u);
});

test('quote-derived school acceptance preserves offer evidence, stock-conflict history, and notification semantics', () => {
  const route = source('src/admin/api/orders/[orderId]/status/route.ts');
  const acceptance = source(
    'src/shared/server/schoolOrderSellerAcceptance.ts'
  );

  for (const expected of [
    "sourceQuote.status !== 'issued'",
    '!sourceQuote.isCurrent',
    "sourceQuote.requestStatus !== 'awaiting_purchase_order_review'",
    "code: 'QUOTE_PURCHASE_ORDER_REVIEW_STALE'",
    "code: 'QUOTE_DOCUMENT_EVIDENCE_MISSING'",
    "code: 'QUOTE_PURCHASE_ORDER_OUTSIDE_VALIDITY'",
    "event_type = 'acceptance_blocked_stock'",
    "eventType: 'quote_acceptance_blocked_stock'",
    'insert into quote_offer_acceptances',
    "set status = 'accepted',",
    "set status = 'converted_to_order',",
    'update quote_access_tokens',
    'where quote_request_id = $1',
    'and revoked_at is null',
    'returning id',
    'quoteAccessTokensRevoked: revokedQuoteAccessTokenCount',
    "'admin_purchase_order_validated'",
    "'customer_accepted'",
    "'order_created'",
    "eventType: 'quote_accepted'"
  ]) {
    assert.ok(
      acceptance.includes(expected),
      'Expected quote acceptance workflow to contain: ' + expected
    );
  }

  const requestConversion = acceptance.indexOf(
    "set status = 'converted_to_order'"
  );
  const accessRevocation = acceptance.indexOf(
    'update quote_access_tokens',
    requestConversion
  );
  const acceptanceEvents = acceptance.indexOf(
    'insert into quote_events',
    accessRevocation
  );
  assert.ok(requestConversion >= 0);
  assert.ok(accessRevocation > requestConversion);
  assert.ok(acceptanceEvents > accessRevocation);

  assert.ok(route.includes("await client.query('begin isolation level serializable')"));
  assert.ok(route.includes('scheduleQuoteEmailJobs(pool)'));
  assert.ok(route.includes('source_quote_offer_version_id: schoolQuoteOfferVersionId'));
  assert.ok(route.includes('source_quote_request_id: schoolQuoteRequestId'));
  assert.ok(route.includes('quote_access_tokens_revoked:'));
});

test('legacy contract and commitment endpoints cannot create a second acceptance decision', () => {
  const commitmentRoute = source(
    'src/admin/api/orders/[orderId]/commitment-status/route.ts'
  );
  const contractRoute = source(
    'src/admin/api/orders/[orderId]/contract-status/route.ts'
  );

  assert.match(
    commitmentRoute,
    /if \(nextStatus === 'binding'\)[\s\S]*?ORDER_STATUS_SELLER_ACCEPTANCE_REQUIRED[\s\S]*?status: 409/u
  );
  assert.match(
    contractRoute,
    /if \(contractStatus === 'accepted'\)[\s\S]*?ORDER_STATUS_SELLER_ACCEPTANCE_REQUIRED[\s\S]*?status: 409/u
  );
});

test('manual upload persists the same current evidence consumed by status acceptance', () => {
  const upload = source('src/admin/api/orders/[orderId]/documents/route.ts');
  const status = source('src/admin/api/orders/[orderId]/status/route.ts');

  assert.ok(
    upload.includes("const ALLOWED_DOCUMENT_TYPES = new Set(['purchase_order'])")
  );
  const uploadRevision = upload.indexOf(
    '(select pricing_revision from orders where id = $1)'
  );
  const uploadMarker = upload.indexOf(
    "'operational', 'admin-upload-pdf-v1'",
    uploadRevision
  );
  assert.ok(uploadRevision >= 0);
  assert.ok(uploadMarker > uploadRevision);
  assert.ok(upload.includes('QUOTE_PURCHASE_ORDER_EVIDENCE_IMMUTABLE'));
  assert.match(
    upload,
    /select id, order_number, source_quote_offer_version_id, contract_status/u
  );
  assert.match(
    upload,
    /source_quote_offer_version_id !== null &&[\s\S]*?contract_status !== 'accepted'/u
  );
  assert.equal(
    upload.match(/contract_status !== 'accepted'/gu)?.length,
    2
  );
  assert.doesNotMatch(
    upload,
    /update orders|commitOrderStockHolds|set commitment_status|set contract_status/u
  );

  assert.ok(status.includes('SCHOOL_PURCHASE_ORDER_PROOF_FORMAT_MARKERS'));
  assert.ok(
    status.includes('select pricing_revision from orders where id = $1')
  );
});
