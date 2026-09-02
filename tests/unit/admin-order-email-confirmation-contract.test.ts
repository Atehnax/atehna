import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

test('order status challenges for customer email confirmation before mutation', () => {
  const route = source('src/admin/api/orders/[orderId]/status/route.ts');
  const challengeIndex = route.indexOf(
    'await requireOrderCustomerEmailConfirmation({'
  );
  const firstMutationIndex = route.indexOf('await commitOrderStockHolds(');

  assert.ok(challengeIndex > 0);
  assert.ok(firstMutationIndex > challengeIndex);
  assert.match(route, /eventType: status/u);
  assert.match(
    route,
    /customerEmailConfirmationToken:\s*bodyResult\.body\.customerEmailConfirmationToken/u
  );
  assert.match(route, /confirmationOnly = bodyResult\.body\.confirmationOnly === true/u);
  assert.match(
    route,
    /recipientEmail: confirmationOnly[\s\S]*?\? prospectiveCustomerEmail[\s\S]*?: undefined/u
  );
  assert.match(
    route,
    /NextResponse\.json\(confirmationChallenge, \{ status: 428 \}\)/u
  );
});

test('order rejection challenges before stock or contract mutation', () => {
  const route = source(
    'src/admin/api/orders/[orderId]/contract-status/route.ts'
  );
  const challengeIndex = route.indexOf(
    'await requireOrderCustomerEmailConfirmation({'
  );
  const firstMutationIndex = route.indexOf('await releaseOrderStockHolds(');

  assert.ok(challengeIndex > 0);
  assert.ok(firstMutationIndex > challengeIndex);
  assert.match(route, /eventType: 'order_rejected'/u);
  assert.match(
    route,
    /customerEmailConfirmationToken:\s*parsed\.body\.customerEmailConfirmationToken/u
  );
  assert.match(
    route,
    /NextResponse\.json\(confirmationChallenge, \{ status: 428 \}\)/u
  );
});

test('order outbox E2E covers the confirmation challenge and explicit retry', () => {
  const spec = source('tests/e2e/order-email-outbox.spec.ts');
  const challengeRequestIndex = spec.indexOf(
    'const statusConfirmationResponse = await request.post('
  );
  const confirmedRetryIndex = spec.indexOf('customerEmailConfirmationToken');

  assert.ok(challengeRequestIndex > 0);
  assert.ok(confirmedRetryIndex > challengeRequestIndex);
  assert.match(spec, /expect\(statusConfirmationResponse\.status\(\)\)\.toBe\(428\)/u);
  assert.match(spec, /code: 'CUSTOMER_EMAIL_CONFIRMATION_REQUIRED'/u);
  assert.match(spec, /deliveries: \[\{/u);
  assert.match(spec, /typeof statusConfirmationPayload\.confirmationToken/u);
  assert.match(spec, /expect\(await readOutbox\(orderId\)\)\.toHaveLength\(3\)/u);
});

test('order detail preflights before grouped mutations and commits with the signed token', () => {
  const detail = source('src/admin/features/orders/components/AdminOrderDetailClient.tsx');
  const saveAllStart = detail.indexOf('const saveAll = async');
  const preflightIndex = detail.indexOf('confirmationOnly: true', saveAllStart);
  const itemsMutationIndex = detail.indexOf('itemsSaveHandlerRef.current({', saveAllStart);
  const shippingMutationIndex = detail.indexOf('shippingSaveHandlerRef.current(', saveAllStart);
  const detailMutationIndex = detail.indexOf('await saveDetails(', saveAllStart);

  assert.match(detail, /useCustomerEmailConfirmation\(\)/u);
  assert.ok(preflightIndex > saveAllStart);
  assert.ok(itemsMutationIndex > preflightIndex);
  assert.ok(shippingMutationIndex > preflightIndex);
  assert.ok(detailMutationIndex > preflightIndex);
  const groupedPreflight = detail.slice(saveAllStart, itemsMutationIndex);
  assert.match(groupedPreflight, /if \(statusDirty\) \{/u);
  assert.doesNotMatch(
    groupedPreflight,
    /statusDirty\s*&&\s*!customerEmailConfirmationToken/u
  );
  assert.match(
    groupedPreflight,
    /coreDetailsDirty[\s\S]*?prospectiveCustomerEmail: draftDetails\.email/u
  );
  assert.match(
    groupedPreflight,
    /customerEmailConfirmationToken[\s\S]*?\{ customerEmailConfirmationToken \}/u
  );
  assert.match(detail, /saveAll\(afterSave, confirmation\.confirmationToken\)/u);
  assert.match(detail, /customerEmailConfirmationToken/u);
  assert.doesNotMatch(detail, /customerEmailConfirmed:\s*true/u);
  assert.match(detail, /<CustomerEmailConfirmationDialog/u);
});

test('quick edit preflights before details or payment and preserves signed retry', () => {
  const table = source('src/admin/features/orders/components/AdminOrdersTable.tsx');
  const quickEditStart = table.indexOf('const saveQuickEdit:');
  const quickEditEnd = table.indexOf('\n  useEffect(() => {', quickEditStart);
  const quickEdit = table.slice(quickEditStart, quickEditEnd);
  const preflightIndex = quickEdit.indexOf('confirmationOnly: true');
  const detailsMutationIndex = quickEdit.indexOf('/details`');
  const paymentMutationIndex = quickEdit.indexOf('/payment-status`');

  assert.ok(preflightIndex > 0);
  assert.ok(detailsMutationIndex > preflightIndex);
  assert.ok(paymentMutationIndex > preflightIndex);
  assert.match(quickEdit, /prospectiveCustomerEmail: quickEdit\.email/u);
  assert.match(quickEdit, /saveQuickEdit\(confirmation\.confirmationToken\)/u);
  assert.doesNotMatch(quickEdit, /customerEmailConfirmed/u);
});

test('bulk status preflights every target before one aggregate confirmation and any commit', () => {
  const table = source('src/admin/features/orders/components/AdminOrdersTable.tsx');
  const bulkStart = table.indexOf('const handleBulkStatusUpdate:');
  const bulkEnd = table.indexOf('const handleBulkPaymentUpdate', bulkStart);
  const bulk = table.slice(bulkStart, bulkEnd);
  const preflightIndex = bulk.indexOf('confirmationOnly: true');
  const commitIndex = bulk.indexOf('customerEmailConfirmationToken:');

  assert.ok(preflightIndex > 0);
  assert.ok(commitIndex > preflightIndex);
  assert.match(bulk, /targetOrderIds\.map\(async \(orderId\)/u);
  assert.match(bulk, /confirmation\.deliveries/u);
  assert.match(bulk, /scope: deliveries\.length > 1 \? 'multiple'/u);
  assert.match(bulk, /handleBulkStatusUpdate\([\s\S]*?nextTokens,[\s\S]*?targetOrderIds/u);
  assert.doesNotMatch(bulk, /customerEmailConfirmed/u);

  assert.match(table, /handleSingleRowStatusUpdate\([\s\S]*?confirmation\.confirmationToken/u);
  assert.match(table, /<CustomerEmailConfirmationDialog/u);
});

test('order rejection keeps business confirmation but cannot bypass email confirmation', () => {
  const detail = source('src/admin/features/orders/components/AdminOrderDetailClient.tsx');
  const rejectStart = detail.indexOf('const confirmRejectOrder = async');
  const rejectEnd = detail.indexOf('const resetDraft', rejectStart);
  const reject = detail.slice(rejectStart, rejectEnd);

  assert.match(reject, /customerEmailConfirmationToken/u);
  assert.match(reject, /confirmRejectOrder\(confirmation\.confirmationToken\)/u);
  assert.doesNotMatch(reject, /customerEmailConfirmed:\s*true/u);
});
