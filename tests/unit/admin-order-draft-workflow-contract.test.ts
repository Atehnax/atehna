import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';


const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

const detailsRoute = source(
  'src/admin/api/orders/[orderId]/details/route.ts'
);
const deliveryPlanRoute = source(
  'src/admin/api/orders/[orderId]/delivery-plan/route.ts'
);
const statusRoute = source(
  'src/admin/api/orders/[orderId]/status/route.ts'
);

test('manual draft details persist independently and finalize only when ready', () => {
  assert.equal(
    detailsRoute.includes(
      'if (!contactName || !email || !CUSTOMER_TYPES'
    ),
    false
  );
  assert.equal(
    detailsRoute.includes('ORDER_DRAFT_CUSTOMER_INCOMPLETE'),
    true
  );
  assert.match(
    detailsRoute,
    /draftFinalizationBlock \?\?= \{\s+code: 'ORDER_DRAFT_SHIPPING_INCOMPLETE'/u
  );
  assert.doesNotMatch(detailsRoute, /draftSchoolBlock|order_documents/u);
  assert.equal(
    detailsRoute.includes('savepoint order_draft_stock_finalization'),
    true
  );
  assert.equal(
    detailsRoute.includes('rollback to savepoint order_draft_stock_finalization'),
    true
  );
  assert.equal(
    detailsRoute.includes(
      'const finalizesDraft = isDraft && draftFinalizationBlock === null'
    ),
    true
  );
  assert.equal(detailsRoute.includes('when $21::boolean then false'), true);
  assert.equal(
    detailsRoute.includes('isDraft: isDraft && !finalizesDraft'),
    true
  );
  assert.equal(
    detailsRoute.includes('finalizationBlock: draftFinalizationBlock'),
    true
  );
  assert.doesNotMatch(detailsRoute, /admin_draft_purchase_order/u);
  assert.doesNotMatch(detailsRoute, /set contract_status = 'accepted'/u);

  const readinessStart = detailsRoute.indexOf(
    'const shippingReadiness = validatePersistedOrderShippingReadiness'
  );
  const updateStart = detailsRoute.indexOf('UPDATE orders');
  assert.ok(readinessStart >= 0 && updateStart > readinessStart);
  assert.equal(
    detailsRoute
      .slice(readinessStart, updateStart)
      .includes('return NextResponse.json'),
    false
  );
});

test('draft delivery plans retain only lifecycle, revision, and membership safeguards', () => {
  assert.equal(
    deliveryPlanRoute.includes('ORDER_DELIVERY_PLAN_CONTRACT_NOT_ACCEPTED'),
    false
  );
  assert.equal(deliveryPlanRoute.includes('order.is_draft === true'), false);
  for (const guard of [
    'ORDER_DELIVERY_PLAN_DELETED',
    'ORDER_DELIVERY_PLAN_STATUS_LOCKED',
    'ORDER_DELIVERY_PLAN_STALE',
    'ORDER_DELIVERY_PLAN_ITEM_MISMATCH'
  ]) {
    assert.equal(deliveryPlanRoute.includes(guard), true);
  }
});

test('draft status changes stay local and school prerequisites remain actionable', () => {
  assert.equal(
    statusRoute.includes(
      'const isAdministrativeDraft = workflow?.is_draft === true'
    ),
    true
  );
  assert.equal(
    statusRoute.includes(
      'let shouldEnqueueStatusEmail = changed && !isAdministrativeDraft'
    ),
    true
  );
  assert.equal(
    statusRoute.includes('if (changed && !isAdministrativeDraft)'),
    true
  );

  const schoolGateIndex = statusRoute.indexOf(
    'const executionBlock = schoolExecutionBlock'
  );
  const contractGateIndex = statusRoute.indexOf(
    "code: 'ORDER_CONTRACT_NOT_ACCEPTED'"
  );
  assert.ok(schoolGateIndex >= 0 && contractGateIndex > schoolGateIndex);
  assert.equal(
    statusRoute.split('const purchaseOrderResult = await client.query').length -
      1,
    1
  );
});

test('customer-type corrections have no legal-state coupling', () => {
  const workflow = source('src/shared/domain/order/schoolOrderWorkflow.ts');
  assert.doesNotMatch(
    workflow,
    /orderCustomerTypeChangeBlock|orderCustomerTypeFinalContractBlock|draftCommitmentStatusAfterCustomerTypeChange/u
  );
  assert.doesNotMatch(
    detailsRoute,
    /ORDER_CUSTOMER_TYPE_IMMUTABLE|ORDER_CUSTOMER_TYPE_CONTRACT_FINAL/u
  );
});
test('draft finalization requires a usable recipient address and audits every outcome', () => {
  assert.match(
    detailsRoute,
    /!nextAddressLine1[\s\S]*?!\/\^\\d\{4\}\$\/\.test\(nextPostalCode\)[\s\S]*?!nextCity[\s\S]*?nextCountryCode !== 'SI'/u
  );
  assert.doesNotMatch(
    detailsRoute,
    /!isDraft &&[\s\S]*?Manjkajo obvezni podatki/u
  );
  const detailsUpdate = detailsRoute.slice(
    detailsRoute.indexOf('UPDATE orders'),
    detailsRoute.indexOf('WHERE id = $16')
  );
  assert.doesNotMatch(detailsUpdate, /commitment_status|contract_status|status\s*=/u);
  assert.doesNotMatch(
    detailsRoute,
    /orderCustomerTypeChangeBlock|orderCustomerTypeFinalContractBlock/u
  );
  for (const auditedStateField of [
    "'is_draft'",
    "'commitment_status'",
    "'contract_status'"
  ]) {
    assert.equal(detailsRoute.includes(auditedStateField), true, auditedStateField);
  }
  assert.match(detailsRoute, /fields: detailFields,[\s\S]*?labels:/u);
  for (const metadataKey of [
    'customer_type_corrected',
    'customer_type_before',
    'customer_type_after',
    'draft_finalization_attempted',
    'draft_finalized',
    'draft_finalization_block_code',
    'stock_finalization_outcome',
    'commitment_status_before',
    'commitment_status_after',
    'contract_status_before',
    'contract_status_after'
  ]) {
    assert.equal(detailsRoute.includes(metadataKey), true, metadataKey);
  }
  assert.match(detailsRoute, /diffHasEntries\(diff\) \|\| isDraft/u);
});

test('stock hold mismatches become typed reconciliation blocks for partial draft saves', () => {
  const stockHolds = source('src/shared/server/orderStockHolds.ts');
  assert.doesNotMatch(
    stockHolds,
    /Order stock has already been recorded in a different state/u
  );
  assert.match(
    stockHolds,
    /if \(isExactReplay\) return;[\s\S]*?throw new OrderStockReconciliationRequiredError\(\)/u
  );
  assert.match(
    detailsRoute,
    /error instanceof OrderStockReconciliationRequiredError[\s\S]*?'blocked_reconciliation_required'[\s\S]*?draftFinalizationBlock/u
  );
});
