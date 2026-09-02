import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  SCHOOL_PURCHASE_ORDER_UPLOAD_CLOSED,
  schoolPurchaseOrderUploadBlock
} from '../../src/shared/domain/order/schoolOrderWorkflow';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

test('purchase-order uploads are open only for undeleted received school orders awaiting seller acceptance', () => {
  assert.equal(
    schoolPurchaseOrderUploadBlock(
      'school',
      'received',
      'pending_seller_acceptance',
      false
    ),
    null
  );

  for (const [customerType, orderStatus, contractStatus, isDeleted] of [
    ['company', 'received', 'pending_seller_acceptance', false],
    ['school', 'in_progress', 'pending_seller_acceptance', false],
    ['school', 'received', 'accepted', false],
    ['school', 'received', 'rejected', false],
    ['school', 'received', 'pending_seller_acceptance', true]
  ] as const) {
    assert.equal(
      schoolPurchaseOrderUploadBlock(
        customerType,
        orderStatus,
        contractStatus,
        isDeleted
      ),
      SCHOOL_PURCHASE_ORDER_UPLOAD_CLOSED
    );
  }

  assert.equal(
    SCHOOL_PURCHASE_ORDER_UPLOAD_CLOSED.code,
    'SCHOOL_PURCHASE_ORDER_UPLOAD_CLOSED'
  );
});
test('purchase-order evidence policy is independent from customer-type editing', () => {
  const workflow = source('src/shared/domain/order/schoolOrderWorkflow.ts');
  assert.doesNotMatch(
    workflow,
    /ORDER_CUSTOMER_TYPE_IMMUTABLE|orderCustomerTypeChangeBlock/u
  );
});
test('upload route rechecks locked state and cleans the blob before returning a workflow 409', () => {
  const route = source('src/commercial/api/orders/purchase-order/route.ts');
  const preflightGate = route.indexOf('const initialUploadBlock = schoolPurchaseOrderUploadBlock(');
  const blobUpload = route.indexOf('const blob = await uploadPrivateOrderDocumentBlob(');
  const lockedRead = route.indexOf('const lockedOrderResult = await client.query(');
  const lockedGate = route.indexOf('const lockedUploadBlock = lockedOrder');
  const versionRead = route.indexOf('const versionResult = await client.query(');
  const insert = route.indexOf('insert into order_documents');
  const cleanup = route.indexOf('if (uploadedPath && !documentPersisted)');
  const conflictResponse = route.indexOf('if (error instanceof PurchaseOrderWorkflowConflict)');

  assert.ok(preflightGate >= 0 && preflightGate < blobUpload);
  assert.ok(blobUpload < lockedRead && lockedRead < lockedGate);
  assert.ok(lockedGate < versionRead && versionRead < insert);
  assert.match(
    route.slice(lockedRead, lockedGate),
    /select[\s\S]*?id,[\s\S]*?customer_type,[\s\S]*?status,[\s\S]*?commitment_status,[\s\S]*?contract_status,[\s\S]*?deleted_at,[\s\S]*?shipping_override_stale,[\s\S]*?from orders[\s\S]*?where id = \$1[\s\S]*?for update/u
  );

  const lockedRejection = route.slice(lockedGate, versionRead);
  assert.match(
    lockedRejection,
    /schoolPurchaseOrderUploadBlock\([\s\S]*?throw new PurchaseOrderWorkflowConflict\(lockedUploadBlock\)[\s\S]*?validateLockedOrderShippingReadiness/u
  );
  assert.doesNotMatch(lockedRejection, /return NextResponse/u);

  assert.ok(insert < cleanup && cleanup < conflictResponse);
  assert.match(
    route.slice(cleanup, conflictResponse),
    /deletePrivateOrderDocumentBlob\(uploadedPath\)/u
  );
  assert.match(
    route.slice(conflictResponse),
    /NextResponse\.json\(error\.block, \{ status: 409 \}\)/u
  );
});
