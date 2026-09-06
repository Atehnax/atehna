import assert from 'node:assert/strict';
import test from 'node:test';
import { createOrderDocumentInspectorSnapshot } from '../../src/admin/features/urejevalnik/lib/orderDocumentInspectorSession';
import { cloneDefaultOrderDocumentTemplate } from '../../src/shared/domain/order/orderDocumentTemplates';

test('inspector snapshots isolate the template state used for Cancel rollback', () => {
  const template = cloneDefaultOrderDocumentTemplate('invoice');
  const snapshot = createOrderDocumentInspectorSnapshot(template);

  assert.notEqual(snapshot.template, template);
  assert.deepEqual(snapshot.template, template);

  template.style.pageBackground = '#112233';
  assert.notEqual(snapshot.template.style.pageBackground, template.style.pageBackground);
});
