import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  SCHOOL_ORDER_NOT_BINDING,
  SCHOOL_PURCHASE_ORDER_PROOF_FORMAT_MARKERS,
  SCHOOL_PURCHASE_ORDER_REQUIRED,
  SCHOOL_PURCHASE_ORDER_UPLOAD_CLOSED,
  isSchoolPurchaseOrderProofFormatMarker,
  schoolBindingBlock,
  schoolExecutionBlock,
  schoolPurchaseOrderUploadBlock
} from '../../src/shared/domain/order/schoolOrderWorkflow';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

test('school purchase-order proof accepts only customer or admin upload provenance', () => {
  assert.deepEqual(
    [...SCHOOL_PURCHASE_ORDER_PROOF_FORMAT_MARKERS],
    [
      'customer-upload-pdf-v1',
      'customer-upload-jpeg-v1',
      'admin-upload-pdf-v1'
    ]
  );
  for (const formatMarker of SCHOOL_PURCHASE_ORDER_PROOF_FORMAT_MARKERS) {
    assert.equal(isSchoolPurchaseOrderProofFormatMarker(formatMarker), true);
  }
  assert.equal(isSchoolPurchaseOrderProofFormatMarker('atehna-generated-pdf-v2'), false);
  assert.equal(isSchoolPurchaseOrderProofFormatMarker(null), false);
  assert.equal(isSchoolPurchaseOrderProofFormatMarker(undefined), false);
});

test('purchase-order upload stays open for any active received school order awaiting seller acceptance', () => {
  assert.equal(
    schoolPurchaseOrderUploadBlock(
      'school',
      'received',
      'pending_seller_acceptance',
      false
    ),
    null
  );
  for (const args of [
    ['company', 'received', 'pending_seller_acceptance', false],
    ['school', 'in_progress', 'pending_seller_acceptance', false],
    ['school', 'received', 'accepted', false],
    ['school', 'received', 'rejected', false],
    ['school', 'received', 'pending_seller_acceptance', true]
  ] as const) {
    const [customerType, orderStatus, contractStatus, isDeleted] = args;
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
test('school and public-institution orders require an active purchase order before becoming binding', () => {
  assert.equal(
    schoolBindingBlock('school', 'binding', false),
    SCHOOL_PURCHASE_ORDER_REQUIRED
  );
  assert.equal(schoolBindingBlock('school', 'binding', true), null);
  assert.equal(
    schoolBindingBlock('school', 'pending_confirmation', false),
    null
  );
  assert.equal(schoolBindingBlock('individual', 'binding', false), null);
  assert.match(
    SCHOOL_PURCHASE_ORDER_REQUIRED.message,
    /šole ali javnega zavoda/u
  );
});

test('pending school acceptance requires purchase-order evidence while accepted corrections can progress', () => {
  for (const status of ['in_progress', 'partially_sent', 'sent', 'finished']) {
    assert.equal(
      schoolExecutionBlock(
        'school',
        'binding',
        status,
        false,
        'pending_seller_acceptance'
      ),
      SCHOOL_PURCHASE_ORDER_REQUIRED
    );
    assert.equal(
      schoolExecutionBlock(
        'school',
        'pending_confirmation',
        status,
        true,
        'pending_seller_acceptance'
      ),
      SCHOOL_ORDER_NOT_BINDING
    );
    assert.equal(
      schoolExecutionBlock(
        'school',
        'binding',
        status,
        true,
        'pending_seller_acceptance'
      ),
      null
    );
    assert.equal(
      schoolExecutionBlock('school', 'binding', status, false, 'accepted'),
      null
    );
  }
  assert.equal(
    schoolExecutionBlock(
      'school',
      'pending_confirmation',
      'received',
      false,
      'pending_seller_acceptance'
    ),
    null
  );
  assert.equal(
    schoolExecutionBlock(
      'school',
      'pending_confirmation',
      'cancelled',
      false,
      'pending_seller_acceptance'
    ),
    null
  );
  assert.equal(
    schoolExecutionBlock(
      'individual',
      'pending_confirmation',
      'sent',
      false,
      'pending_seller_acceptance'
    ),
    null
  );
  assert.match(SCHOOL_ORDER_NOT_BINDING.message, /šole ali javnega zavoda/u);
});
test('admin routes gate stock and execution mutations on active purchase-order evidence', () => {
  const acceptance = source(
    'src/shared/server/schoolOrderSellerAcceptance.ts'
  );
  const statusRoute = source('src/admin/api/orders/[orderId]/status/route.ts');
  const evidenceRead = statusRoute.indexOf('from order_documents');
  const executionGate = statusRoute.indexOf(
    'const executionBlock = schoolExecutionBlock'
  );
  const acceptanceCall = statusRoute.indexOf(
    'await acceptSchoolOrderForProcessing'
  );
  const statusMutation = statusRoute.indexOf('update orders set status = $1');
  const stockRead = acceptance.indexOf('from order_items');
  const stockCommit = acceptance.indexOf('await commitOrderStockHolds');

  assert.ok(evidenceRead >= 0);
  assert.ok(executionGate > evidenceRead);
  assert.ok(acceptanceCall > executionGate);
  assert.ok(statusMutation > acceptanceCall);
  assert.ok(stockRead >= 0);
  assert.ok(stockCommit > stockRead);
  assert.match(
    statusRoute,
    /type = 'purchase_order'[\s\S]*?deleted_at is null[\s\S]*?format_marker = any\(\$2::text\[\]\)[\s\S]*?order by id desc[\s\S]*?limit 1[\s\S]*?for share/u
  );
  assert.match(
    statusRoute,
    /\[orderId, \[\.\.\.SCHOOL_PURCHASE_ORDER_PROOF_FORMAT_MARKERS\]\]/u
  );
  assert.match(statusRoute, /purchaseOrderDocument !== undefined/u);
  assert.match(
    statusRoute,
    /schoolExecutionBlock\([\s\S]*?purchaseOrderDocument !== undefined/u
  );
  assert.match(
    acceptance,
    /customer_type = 'school'[\s\S]*?commitment_status in \('pending_confirmation', 'binding'\)[\s\S]*?contract_status = 'pending_seller_acceptance'/u
  );
});
test('upload guidance is explicit and requests no internal order number', () => {
  const page = source('src/commercial/pages/order/narocilnica/page.tsx');
  const form = source(
    'src/commercial/order/components/PurchaseOrderUploadForm.tsx'
  );

  for (const step of [
    'Pripravite dokument',
    'Preverite datoteko',
    'Varno naložite'
  ]) {
    assert.ok(page.includes(step));
  }
  assert.match(page, /podpisano oziroma odobreno naročilnico/iu);
  assert.match(page, /PDF ali JPG do velikosti 10 MB/u);
  assert.match(page, /interne številke naročila ni treba vpisovati/u);
  assert.match(page, /Naročilo šole \/ javnega zavoda/u);
  assert.match(form, /consumeOrderAccessTokenFromLocation/u);
  assert.match(form, /exchangeOrderAccessToken/u);
  assert.match(form, /readStoredOrderAccessId/u);
  assert.match(form, /accept="application\/pdf,image\/jpeg"/u);
  assert.match(form, /const MAX_UPLOAD_SIZE = 10 \* 1024 \* 1024/u);
  assert.doesNotMatch(form, /name="order(?:Id|Number)"/u);
});
