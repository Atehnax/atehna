import assert from 'node:assert/strict';
import test from 'node:test';
import { applyVariantOptionValue } from '../../src/admin/features/artikli/components/ProductVariantOptionsCard';
import { createVariant, type ProductOptionAxisDraft } from '../../src/admin/features/artikli/lib/familyModel';

const axes: ProductOptionAxisDraft[] = [{ id: 'colour', name: 'Barva', slug: 'barva', position: 0, values: [{ id: 'blue', value: 'Modra', slug: 'modra', swatch: '#0000FF', position: 0 }] }];
const variants = [
  createVariant({ id: '101', label: 'Prva', sku: 'PRVA', price: 10, stock: 3, pricingRevision: 'p1', stockRevision: 's1', optionSelections: { colour: 'blue' }, imageAssignments: [0], contentOverride: { description: 'Opis' } }),
  createVariant({ id: '102', label: 'Druga', sku: 'DRUGA', price: 20, stock: 8, optionSelections: { colour: 'blue' } })
];

test('inline attributes reuse existing values and retain commercial identity', () => {
  const next = applyVariantOptionValue(axes, variants, 'colour', '101', ' MODRA ');
  assert.equal(next.axes, axes);
  assert.deepEqual(next.variants, variants);
  assert.equal(next.variants[1], variants[1]);
});

test('new free-entry value affects only its row and preserves all previous values', () => {
  const next = applyVariantOptionValue(axes, variants, 'colour', '101', 'Rdeča');
  assert.equal(next.axes[0].values.length, 2);
  const red = next.axes[0].values[1];
  assert.equal(red.slug, 'rdeca');
  assert.equal(next.variants[0].optionSelections?.colour, red.id);
  assert.deepEqual({ ...next.variants[0], optionSelections: variants[0].optionSelections }, variants[0]);
  assert.equal(next.variants[1], variants[1]);
  assert.equal(axes[0].values.length, 1);
  assert.equal(variants[0].optionSelections?.colour, 'blue');
});

test('clearing one value does not remove the shared value or other assignments', () => {
  const next = applyVariantOptionValue(axes, variants, 'colour', '101', ' ');
  assert.equal(next.axes, axes);
  assert.deepEqual(next.variants[0].optionSelections, {});
  assert.equal(next.variants[1].optionSelections?.colour, 'blue');
});

test('Slovenian labels that normalize to the same slug stay separately selectable', () => {
  const first = applyVariantOptionValue(axes, variants, 'colour', '101', 'Šiva');
  const second = applyVariantOptionValue(first.axes, first.variants, 'colour', '102', 'Siva');
  assert.deepEqual(second.axes[0].values.slice(1).map((value) => value.slug), ['siva', 'siva-2']);
  assert.notEqual(second.variants[0].optionSelections?.colour, second.variants[1].optionSelections?.colour);
});

test('unknown rows and attributes cannot create orphan option data', () => {
  assert.deepEqual(applyVariantOptionValue(axes, variants, 'missing', '101', 'Test'), { axes, variants });
  assert.deepEqual(applyVariantOptionValue(axes, variants, 'colour', 'missing', 'Test'), { axes, variants });
});
