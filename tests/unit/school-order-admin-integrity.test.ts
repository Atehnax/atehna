import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  SCHOOL_PURCHASE_ORDER_DELETE_BLOCKED,
  schoolPurchaseOrderDeletionBlock
} from '../../src/shared/domain/order/schoolOrderWorkflow';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

test('customer-type immutability policy is removed from the order workflow', () => {
  const workflow = source('src/shared/domain/order/schoolOrderWorkflow.ts');
  const details = source('src/admin/api/orders/[orderId]/details/route.ts');
  for (const obsoletePolicy of [
    'ORDER_CUSTOMER_TYPE_IMMUTABLE',
    'ORDER_CUSTOMER_TYPE_CONTRACT_FINAL',
    'orderCustomerTypeChangeBlock',
    'orderCustomerTypeFinalContractBlock',
    'draftCommitmentStatusAfterCustomerTypeChange'
  ]) {
    assert.equal(workflow.includes(obsoletePolicy), false, obsoletePolicy);
    assert.equal(details.includes(obsoletePolicy), false, obsoletePolicy);
  }
});
test('only the last active purchase order is protected for school workflows', () => {
  assert.equal(
    schoolPurchaseOrderDeletionBlock(
      'school',
      'binding',
      'received',
      'purchase_order',
      'customer-upload-pdf-v1',
      false
    ),
    SCHOOL_PURCHASE_ORDER_DELETE_BLOCKED
  );
  for (const status of ['in_progress', 'partially_sent', 'sent', 'finished']) {
    assert.equal(
      schoolPurchaseOrderDeletionBlock(
        'school',
        'pending_confirmation',
        status,
        'purchase_order',
        'customer-upload-pdf-v1',
        false
      ),
      SCHOOL_PURCHASE_ORDER_DELETE_BLOCKED
    );
  }

  assert.equal(
    schoolPurchaseOrderDeletionBlock(
      'school',
      'binding',
      'received',
      'purchase_order',
      'admin-upload-pdf-v1',
      true
    ),
    null
  );
  assert.equal(
    schoolPurchaseOrderDeletionBlock(
      'school',
      'pending_confirmation',
      'received',
      'purchase_order',
      'customer-upload-jpeg-v1',
      false
    ),
    null
  );
  assert.equal(
    schoolPurchaseOrderDeletionBlock(
      'company',
      'binding',
      'sent',
      'purchase_order',
      'customer-upload-pdf-v1',
      false
    ),
    null
  );
  assert.equal(
    schoolPurchaseOrderDeletionBlock(
      'school',
      'binding',
      'sent',
      'invoice',
      'customer-upload-pdf-v1',
      false
    ),
    null
  );
  assert.equal(
    schoolPurchaseOrderDeletionBlock(
      'school',
      'binding',
      'sent',
      'purchase_order',
      'atehna-generated-pdf-v2',
      false
    ),
    null
  );

  assert.equal(
    SCHOOL_PURCHASE_ORDER_DELETE_BLOCKED.code,
    'SCHOOL_PURCHASE_ORDER_DELETE_BLOCKED'
  );
});

test('admin detail save audits type corrections without mutating workflow state', () => {
  const details = source('src/admin/api/orders/[orderId]/details/route.ts');
  const orderLock = details.indexOf('const beforeResult = await client.query');
  const orderUpdate = details.indexOf('UPDATE orders');
  const auditWrite = details.indexOf('insertAuditEventForRequest', orderUpdate);
  const transactionCommit = details.indexOf("client.query('commit')", auditWrite);
  const updateSql = details.slice(
    orderUpdate,
    details.indexOf('WHERE id = $16', orderUpdate)
  );

  assert.ok(orderLock >= 0 && orderUpdate > orderLock);
  assert.ok(auditWrite > orderUpdate && transactionCommit > auditWrite);
  assert.match(details, /from orders[\s\S]*?where id = \$1[\s\S]*?for update/u);
  assert.match(updateSql, /SET customer_type = \$1/u);
  assert.doesNotMatch(
    updateSql,
    /commitment_status|contract_status|contract_accepted|committed_at|status\s*=/u
  );
  assert.doesNotMatch(
    details,
    /orderCustomerTypeChangeBlock|orderCustomerTypeFinalContractBlock|draftSchoolBlock/u
  );
  assert.doesNotMatch(details, /from order_documents/u);
  for (const auditKey of [
    'customer_type_corrected',
    'customer_type_before',
    'customer_type_after'
  ]) {
    assert.ok(details.includes(auditKey), auditKey);
  }
});
test('document deletion protects only the last active accepted purchase-order proof', () => {
  const deletion = source(
    'src/admin/api/orders/[orderId]/documents/[documentId]/route.ts'
  );
  const orderLock = deletion.indexOf('const orderResult = await client.query');
  const documentLock = deletion.indexOf(
    'const documentResult = await client.query'
  );
  const deletionGate = deletion.indexOf(
    'schoolPurchaseOrderDeletionBlock('
  );
  const softDelete = deletion.indexOf('update order_documents');

  assert.ok(
    orderLock < documentLock &&
      documentLock < deletionGate &&
      deletionGate < softDelete
  );
  assert.match(
    deletion,
    /from orders[\s\S]*?where id = \$1[\s\S]*?for update/u
  );
  assert.match(
    deletion,
    /select id, type, filename, deleted_at, format_marker/u
  );
  assert.match(
    deletion,
    /id <> \$2[\s\S]*?type = 'purchase_order'[\s\S]*?deleted_at is null[\s\S]*?format_marker = any\(\$3::text\[\]\)[\s\S]*?for share/u
  );
  assert.match(
    deletion,
    /\[\.\.\.SCHOOL_PURCHASE_ORDER_PROOF_FORMAT_MARKERS\]/u
  );
  assert.match(
    deletion,
    /return NextResponse\.json\(deletionBlock, \{ status: 409 \}\)/u
  );
  const detailClient = source(
    'src/admin/features/orders/components/AdminOrderDetailClient.tsx'
  );
  assert.doesNotMatch(detailClient, /orderCustomerTypeFinalContractBlock/u);
  assert.doesNotMatch(detailClient, /availableCustomerTypeOptions/u);
  assert.doesNotMatch(detailClient, /customerTypeIsLocked/u);
  assert.match(
    detailClient,
    /<OrderDataRow\s+label="Tip naročnika"\s+value=\{activeCustomerTypeLabel\}\s+icon="type"\s+isEditing=\{isOrderDataEditing\}\s+reserveTrailingControl\s*>/u
  );
  assert.match(
    detailClient,
    /options=\{CUSTOMER_TYPE_FORM_OPTIONS\}[\s\S]*?disabled=\{pageIsBusy\}[\s\S]*?showArrow/u
  );
  const ordersTable = source(
    'src/admin/features/orders/components/AdminOrdersTable.tsx'
  );
  assert.doesNotMatch(ordersTable, /orderCustomerTypeFinalContractBlock/u);
  assert.doesNotMatch(ordersTable, /getOrderCustomerTypeRowOptions/u);
  assert.match(
    ordersTable,
    /options=\{ORDER_CUSTOMER_TYPE_ROW_OPTIONS\}[\s\S]*?disabled=\{activeQuickEdit\.isSaving\}/u
  );
});
