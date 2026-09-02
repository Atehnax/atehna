import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  ORDER_STATUS_ACTION_OPTIONS,
  ORDER_STATUS_OPTIONS
} from '../../src/shared/domain/order/orderStatus';

const readSource = (path: string) =>
  readFile(resolve(process.cwd(), path), 'utf8');

test('V obdelavi explains that it accepts and binds the order', () => {
  const action = ORDER_STATUS_ACTION_OPTIONS.find(
    (option) => option.value === 'in_progress'
  );
  const filter = ORDER_STATUS_OPTIONS.find(
    (option) => option.value === 'in_progress'
  );

  assert.equal(action?.label, 'V obdelavi');
  assert.equal(
    action?.description,
    'Sprejme naročilo in ga potrdi kot zavezujoče.'
  );
  assert.equal('description' in (filter ?? {}), false);
});

test('order status action help is wired to detail, row, and bulk selectors', async () => {
  const detail = await readSource(
    'src/admin/features/orders/components/AdminOrderDetailClient.tsx'
  );
  const table = await readSource(
    'src/admin/features/orders/components/AdminOrdersTable.tsx'
  );

  assert.match(detail, /ORDER_STATUS_ACTION_OPTIONS\.map/u);
  assert.match(
    detail,
    /order\.commitment_status === 'binding' && order\.contract_status === 'accepted'/u
  );
  assert.match(
    detail,
    /nextCommitmentStatus === 'binding' && nextContractStatus === 'accepted'/u
  );
  assert.match(table, /ORDER_STATUS_ACTION_OPTIONS\.map/u);
  assert.equal(
    table.match(/options=\{ORDER_STATUS_ACTION_OPTIONS\}/gu)?.length,
    2
  );
  assert.match(table, /option\.description/u);
  assert.match(table, /successfulOrderIds/u);
  assert.match(table, /const firstMessage = failures\.find/u);
  assert.match(
    table,
    /const payload = await response\.json\(\)\.catch/u
  );
});

test('customer access reflects binding and no longer offers a second acceptance action', async () => {
  const access = await readSource(
    'src/admin/features/orders/components/AdminOrderCustomerAccess.tsx'
  );
  const detail = await readSource(
    'src/admin/features/orders/components/AdminOrderDetailClient.tsx'
  );

  assert.match(access, /Potrjeno kot zavezujoče/u);
  assert.match(access, /Čaka na status »V obdelavi«/u);
  assert.match(
    access,
    /pendingCommitmentHelp =[\s\S]*?V obdelavi[\s\S]*?zavezujoče/u
  );
  assert.match(detail, /customerType=\{persistedDetails\.customerType\}/u);
  assert.match(
    detail,
    /hasActivePurchaseOrderEvidence=\{hasActivePurchaseOrderEvidence\}/u
  );
  assert.match(
    detail,
    /customer-upload-pdf-v1[\s\S]*?customer-upload-jpeg-v1[\s\S]*?admin-upload-pdf-v1/u
  );
  assert.match(access, /hasActivePurchaseOrderEvidence: boolean/u);
  assert.match(
    access,
    /missingSchoolPurchaseOrderEvidence =[\s\S]*?customerType === 'school' && !hasActivePurchaseOrderEvidence/u
  );
  assert.match(access, /ločen pogoj za prehod v status »V obdelavi«/u);
  assert.match(access, /obdelava in zavezujočnost ostanejo nespremenjeni/u);
  assert.match(access, /missing-school-purchase-order-evidence-compact/u);
  assert.match(access, /missing-school-purchase-order-evidence-full/u);
  assert.doesNotMatch(access, /\/commitment-status/u);
  assert.doesNotMatch(access, />\s*Potrdi kot zavezujoče\s*</u);
});
test('an informational draft finalization block cannot skip status acceptance', async () => {
  const detail = await readSource(
    'src/admin/features/orders/components/AdminOrderDetailClient.tsx'
  );
  const saveDetailsStart = detail.indexOf('const saveDetails = async');
  const finalizationAssignment = detail.indexOf(
    'finalizationMessage = rawFinalizationMessage.trim()',
    saveDetailsStart
  );
  const statusRequest = detail.indexOf('if (statusDirty)', finalizationAssignment);
  const finalizationReturn = detail.indexOf(
    'return { finalizationMessage, confirmationRequired: false };',
    statusRequest
  );

  assert.ok(saveDetailsStart >= 0);
  assert.ok(finalizationAssignment > saveDetailsStart);
  assert.ok(statusRequest > finalizationAssignment);
  assert.ok(finalizationReturn > statusRequest);
  assert.doesNotMatch(
    detail.slice(finalizationAssignment, statusRequest),
    /return finalizationMessage/u
  );
});
