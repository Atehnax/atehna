import assert from 'node:assert/strict';
import test from 'node:test';
import {
  catalogCategoryId,
  indexCatalogCategoryActivity
} from '../../src/shared/domain/catalog/catalogOrderability';

test('catalog category activity preserves distinct text and UUID identifiers', () => {
  const activeId = '4a3ecfd2-5638-45a7-b79c-41020ad44487';
  const inactiveId = '9f38d0a4-7a39-47d7-b148-d7937d5f55ee';
  const activity = indexCatalogCategoryActivity([
    { id: activeId, ancestors_active: true },
    { id: inactiveId, ancestors_active: false }
  ]);

  assert.equal(catalogCategoryId(activeId), activeId);
  assert.equal(catalogCategoryId(inactiveId), inactiveId);
  assert.equal(activity.get(activeId), true);
  assert.equal(activity.get(inactiveId), false);
  assert.equal(activity.size, 2);
});
