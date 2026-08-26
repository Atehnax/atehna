import assert from 'node:assert/strict';
import test from 'node:test';
import { createOrderDocumentInspectorSnapshot } from '../../src/admin/features/urejevalnik/lib/orderDocumentInspectorSession';
import { cloneDefaultSiteLogoConfig } from '../../src/shared/domain/logo/siteLogo';
import { cloneDefaultOrderDocumentTemplate } from '../../src/shared/domain/order/orderDocumentTemplates';

test('inspector snapshots isolate the template and logo state used for Cancel rollback', () => {
  const template = cloneDefaultOrderDocumentTemplate('invoice');
  const logoConfig = cloneDefaultSiteLogoConfig();
  const snapshot = createOrderDocumentInspectorSnapshot(template, logoConfig);

  assert.notEqual(snapshot.template, template);
  assert.notEqual(snapshot.logoConfig, logoConfig);
  assert.deepEqual(snapshot.template, template);
  assert.deepEqual(snapshot.logoConfig, logoConfig);

  template.style.pageBackground = '#112233';
  logoConfig.updatedAt = '2026-08-26T10:00:00.000Z';
  assert.notEqual(snapshot.template.style.pageBackground, template.style.pageBackground);
  assert.notEqual(snapshot.logoConfig.updatedAt, logoConfig.updatedAt);
});
