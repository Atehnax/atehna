import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  ORDER_CUSTOMER_TYPE_IMMUTABLE,
  SCHOOL_PURCHASE_ORDER_DELETE_BLOCKED,
  orderCustomerTypeChangeBlock,
  schoolPurchaseOrderDeletionBlock
} from '../../src/shared/domain/order/schoolOrderWorkflow';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

test('school-boundary customer type changes are immutable outside drafts', () => {
  assert.equal(
    orderCustomerTypeChangeBlock('company', 'school', false),
    ORDER_CUSTOMER_TYPE_IMMUTABLE
  );
  assert.equal(
    orderCustomerTypeChangeBlock('school', 'company', false),
    ORDER_CUSTOMER_TYPE_IMMUTABLE
  );
  assert.equal(orderCustomerTypeChangeBlock('company', 'company', false), null);
  assert.equal(orderCustomerTypeChangeBlock('individual', 'company', false), null);
  assert.equal(orderCustomerTypeChangeBlock('company', 'individual', false), null);
  for (const currentCustomerType of ['individual', 'company', 'school']) {
    for (const nextCustomerType of ['individual', 'company', 'school']) {
      assert.equal(
        orderCustomerTypeChangeBlock(currentCustomerType, nextCustomerType, true),
        null
      );
    }
  }
  assert.equal(
    ORDER_CUSTOMER_TYPE_IMMUTABLE.code,
    'ORDER_CUSTOMER_TYPE_IMMUTABLE'
  );
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

test('admin detail save locks the order and gates draft school finalization', () => {
  const details = source('src/admin/api/orders/[orderId]/details/route.ts');
  const orderLock = details.indexOf('const beforeResult = await client.query');
  const immutableGate = details.indexOf('orderCustomerTypeChangeBlock(');
  const purchaseOrderGate = details.indexOf(
    "if (isDraft && normalizedCustomerType === 'school')"
  );
  const orderUpdate = details.indexOf('UPDATE orders');

  assert.ok(
    orderLock < immutableGate &&
      immutableGate < purchaseOrderGate &&
      purchaseOrderGate < orderUpdate
  );
  assert.match(details, /from orders[\s\S]*?where id = \$1[\s\S]*?for update/u);
  assert.match(
    details,
    /type = 'purchase_order'[\s\S]*?deleted_at is null[\s\S]*?format_marker = any\(\$2::text\[\]\)[\s\S]*?for share/u
  );
  assert.match(
    details,
    /\[orderId, \[\.\.\.SCHOOL_PURCHASE_ORDER_PROOF_FORMAT_MARKERS\]\]/u
  );
  assert.match(details, /schoolBindingBlock\([\s\S]*?'binding'/u);
  assert.match(
    details,
    /insertAuditEventForRequest\([\s\S]*?\}, client\);[\s\S]*?client\.query\('commit'\)/u
  );
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
  assert.match(
    detailClient,
    /availableCustomerTypeOptions = CUSTOMER_TYPE_FORM_OPTIONS\.map\([\s\S]*?const changeBlock = orderCustomerTypeFinalContractBlock\([\s\S]*?order\.contract_status[\s\S]*?disabled: true, description: changeBlock\.message/u
  );
  assert.doesNotMatch(
    detailClient,
    /availableCustomerTypeOptions = CUSTOMER_TYPE_FORM_OPTIONS\.filter/u
  );
  assert.doesNotMatch(detailClient, /customerTypeIsLocked/u);
  assert.match(
    detailClient,
    /<OrderDataRow\s+label="Tip naročnika"\s+value=\{activeCustomerTypeLabel\}\s+icon="type"\s+isEditing=\{isOrderDataEditing\}\s+reserveTrailingControl\s*>/u
  );
  assert.match(
    detailClient,
    /options=\{availableCustomerTypeOptions\}[\s\S]*?disabled=\{pageIsBusy\}[\s\S]*?showArrow/u
  );
  const ordersTable = source(
    'src/admin/features/orders/components/AdminOrdersTable.tsx'
  );
  assert.match(
    ordersTable,
    /getOrderCustomerTypeRowOptions[\s\S]*?ORDER_CUSTOMER_TYPE_ROW_OPTIONS\.map\([\s\S]*?orderCustomerTypeFinalContractBlock\([\s\S]*?contractStatus[\s\S]*?disabled: true, description: changeBlock\.message/u
  );
  assert.doesNotMatch(
    ordersTable,
    /getOrderCustomerTypeRowOptions[\s\S]*?ORDER_CUSTOMER_TYPE_ROW_OPTIONS\.filter/u
  );
  assert.match(
    ordersTable,
    /options=\{getOrderCustomerTypeRowOptions\([\s\S]*?activeQuickEdit\.contractStatus[\s\S]*?disabled=\{activeQuickEdit\.isSaving\}/u
  );
});
