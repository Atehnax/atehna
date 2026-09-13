import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hydrateCatalogOptionAxes, hydrateVariantOptionSelections } from '@/admin/features/artikli/lib/optionHydration';
import type { CatalogItemOptionAxisPayload } from '@/shared/domain/catalog/catalogAdminTypes';

const savedAxes: CatalogItemOptionAxisPayload[] = [{
  id: 12, name: 'Dimenzije', slug: 'dimenzije', position: 4,
  values: [
    { id: 101, value: '0,5 × 200 × 200 mm', slug: '0-5-200-200', position: 2 },
    { id: 102, value: '0,3 × 200 × 200 mm', slug: '0-3-200-200', position: 1 }
  ]
}, {
  id: 13, name: 'Barva', slug: 'barva',
  values: [{ id: 103, value: 'Modra', slug: 'modra', swatch: '#123456' }]
}];

test('option hydration retains persisted IDs, order and optional metadata without mutating the response', () => {
  const original = structuredClone(savedAxes);
  const hydrated = hydrateCatalogOptionAxes(savedAxes);
  assert.deepEqual(hydrated, [{
    id: '12', name: 'Dimenzije', slug: 'dimenzije', position: 4,
    values: [
      { id: '101', value: '0,5 × 200 × 200 mm', slug: '0-5-200-200', position: 2, swatch: null },
      { id: '102', value: '0,3 × 200 × 200 mm', slug: '0-3-200-200', position: 1, swatch: null }
    ]
  }, {
    id: '13', name: 'Barva', slug: 'barva', position: 1,
    values: [{ id: '103', value: 'Modra', slug: 'modra', position: 0, swatch: '#123456' }]
  }]);
  assert.deepEqual(savedAxes, original);
  assert.notEqual(hydrated[0].values, savedAxes[0].values);
});

test('initial axes and values without persisted IDs retain distinct fallback IDs', () => {
  const hydrated = hydrateCatalogOptionAxes([
    { name: 'Barva', slug: 'barva', values: [{ value: 'Modra', slug: 'modra' }, { value: 'Rdeča', slug: 'rdeca' }] },
    { name: 'Izvedba', slug: 'izvedba', values: [{ value: 'A', slug: 'a' }] }
  ]);
  assert.deepEqual(hydrated.map(axis => [axis.id, axis.values.map(value => value.id)]), [
    ['axis-0', ['value-0-0', 'value-0-1']], ['axis-1', ['value-1-0']]
  ]);
  assert.deepEqual(hydrateVariantOptionSelections(hydrated, [0, 1]), {});
});

test('variant hydration selects saved values and ignores removed or foreign values', () => {
  const axes = hydrateCatalogOptionAxes(savedAxes);
  assert.deepEqual(hydrateVariantOptionSelections(axes, [102, 103, 999]), { '12': '102', '13': '103' });
  assert.deepEqual(hydrateVariantOptionSelections(axes.slice(1), [102, 103]), { '13': '103' });
  assert.deepEqual(hydrateVariantOptionSelections(axes, []), {});
});

test('a newly persisted value becomes a numeric editor selection for the second save', () => {
  const initial = hydrateCatalogOptionAxes([{ name: 'Izvedba', slug: 'izvedba', values: [{ value: 'Nova', slug: 'nova' }] }]);
  assert.equal(initial[0].values[0].id, 'value-0-0');
  const responseAxes = [{ id: 20, name: 'Izvedba', slug: 'izvedba', values: [{ id: 201, value: 'Nova', slug: 'nova' }] }];
  const saved = hydrateCatalogOptionAxes(responseAxes);
  const selections = hydrateVariantOptionSelections(saved, [201]);
  const secondSaveAxes = saved.map(axis => ({
    id: Number(axis.id), slug: axis.slug,
    selectedValueId: Number(selections[axis.id])
  }));
  assert.deepEqual(selections, { '20': '201' });
  assert.deepEqual(secondSaveAxes, [{ id: 20, slug: 'izvedba', selectedValueId: 201 }]);
  assert.deepEqual(hydrateVariantOptionSelections(hydrateCatalogOptionAxes(responseAxes), [201]), selections);
});
