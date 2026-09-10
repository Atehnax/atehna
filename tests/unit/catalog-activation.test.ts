import assert from 'node:assert/strict';
import test from 'node:test';
import { CatalogActivationValidationError, getCatalogActivationVariantIds, parseCatalogBulkActivationRequest } from '@/shared/domain/catalog/catalogActivation';

test('bulk activation validates the explicit mode and target ownership shape before persistence', () => {
  assert.deepEqual(parseCatalogBulkActivationRequest({ mode: 'first', itemIdentifiers: [' plošča ', 'plošča'], variants: [{ itemIdentifier: 'plošča', variantId: 4 }, { itemIdentifier: 'plošča', variantId: 4 }] }), {
    mode: 'first', itemIdentifiers: ['plošča'], variants: [{ itemIdentifier: 'plošča', variantId: 4 }]
  });
  for (const invalid of [null, {}, { mode: 'all', itemIdentifiers: [] }, { mode: 'other', itemIdentifiers: ['one'] }, { mode: 'all', itemIdentifiers: [' '] }, { mode: 'all', itemIdentifiers: [], variants: [{ itemIdentifier: 'one', variantId: -1 }] }, { mode: 'all', itemIdentifiers: [], variants: [{ itemIdentifier: 'one', variantId: '4' }] }]) {
    assert.throws(() => parseCatalogBulkActivationRequest(invalid), CatalogActivationValidationError);
  }
});

test('first activation follows persisted row order and does not mutate or filter the source variants', () => {
  const variants = [{ id: 90, position: 4, status: 'active' }, { id: 8, position: 1, status: 'inactive' }, { id: 2, position: 1, status: 'inactive' }];
  const snapshot = structuredClone(variants);
  assert.deepEqual(getCatalogActivationVariantIds('first', variants), [2]);
  assert.deepEqual(getCatalogActivationVariantIds('all', variants), [2, 8, 90]);
  assert.deepEqual(variants, snapshot);
});
