import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  ORDER_CUSTOMER_TYPE_IMMUTABLE,
  SCHOOL_PURCHASE_ORDER_UPLOAD_CLOSED,
  orderCustomerTypeChangeBlock,
  schoolPurchaseOrderUploadBlock
} from '../../src/shared/domain/order/schoolOrderWorkflow';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

test('purchase-order uploads are open only for undeleted pending school orders in received state', () => {
  assert.equal(
    schoolPurchaseOrderUploadBlock(
      'school',
      'pending_confirmation',
      'received',
      false
    ),
    null
  );

  for (const [customerType, commitmentStatus, orderStatus, isDeleted] of [
    ['company', 'pending_confirmation', 'received', false],
    ['school', 'binding', 'received', false],
    ['school', 'pending_confirmation', 'in_progress', false],
    ['school', 'pending_confirmation', 'received', true]
  ] as const) {
    assert.equal(
      schoolPurchaseOrderUploadBlock(
        customerType,
        commitmentStatus,
        orderStatus,
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

test('non-draft customer-type policy blocks only transitions to or from school', () => {
  assert.equal(
    orderCustomerTypeChangeBlock('company', 'school', false),
    ORDER_CUSTOMER_TYPE_IMMUTABLE
  );
  assert.equal(
    orderCustomerTypeChangeBlock('school', 'company', false),
    ORDER_CUSTOMER_TYPE_IMMUTABLE
  );
  assert.equal(
    orderCustomerTypeChangeBlock('company', 'individual', false),
    null
  );
  assert.equal(
    orderCustomerTypeChangeBlock('individual', 'company', false),
    null
  );
  assert.equal(orderCustomerTypeChangeBlock('school', 'school', false), null);
  assert.equal(orderCustomerTypeChangeBlock('company', 'school', true), null);
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
    /select id, customer_type, status, commitment_status, deleted_at[\s\S]*?from orders[\s\S]*?where id = \$1[\s\S]*?for update/u
  );

  const lockedRejection = route.slice(lockedGate, versionRead);
  assert.match(
    lockedRejection,
    /schoolPurchaseOrderUploadBlock\([\s\S]*?throw new PurchaseOrderWorkflowConflict\(lockedUploadBlock\)/u
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
