import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDimensionVariantHeaderLabel, buildPersistedVariantName, createVariant, getDescriptiveVariantLabel } from '../../src/admin/features/artikli/lib/familyModel';
const nameOptions = { baseName: 'Pleksi steklo', variantCount: 3, index: 0 };

test('same-size colour options keep distinct names in editor headers and saved payloads', () => {
  const colours = ['belo', 'barvno', 'prozorno'];
  const variants = colours.map((colour, index) => createVariant({
    label: `150 x 200 x 3 mm, ${colour}`, length: 200, width: 150, thickness: 3,
    optionSelections: { izvedba: String(index) }
  }));
  assert.equal(new Set(variants.map((variant,index) => buildDimensionVariantHeaderLabel(variant,index))).size, 3);
  for (const [index,variant] of variants.entries()) {
    assert.equal(buildDimensionVariantHeaderLabel(variant,index,true), variant.label);
    assert.equal(buildPersistedVariantName(variant,nameOptions), variant.label);
  }
});

test('material names, paper colours and formats survive dimension-based editor saves', () => {
  for (const label of ['Bukev / 4 x 250 x 250', 'Topol / 4 x 250 x 250', 'A4', 'strukturno bela']) {
    const variant = createVariant({label,length:250,width:250,thickness:4,optionSelections:{izvedba:'value'}});
    assert.equal(buildPersistedVariantName(variant,nameOptions),label);
    assert.equal(buildDimensionVariantHeaderLabel(variant,0),label);
  }
});

test('measurement-only metal labels regenerate after a dimension edit even with option selections', () => {
  for (const label of ['300 × 200 × 0,5 mm', '300x200x0,5mm', '0,5 mm × 300 mm × 200 mm', 'Nova različica', 'Različica 2']) {
    const variant = createVariant({label,length:400,width:200,thickness:0.5,optionSelections:{velikost:'old-size'}});
    assert.equal(getDescriptiveVariantLabel(variant),null);
    assert.equal(buildPersistedVariantName(variant,nameOptions),'0,5 × 400 × 200 mm');
    assert.equal(buildDimensionVariantHeaderLabel(variant,0),'0,5 × 400 × 200');
  }
});

test('measurement products without named options retain established automatic naming', () => {
  const variant = createVariant({label:'Poljubna stara oznaka',length:200,width:100,thickness:0.5});
  assert.equal(buildPersistedVariantName(variant,nameOptions),'0,5 × 200 × 100 mm');
  assert.equal(buildPersistedVariantName(variant,{...nameOptions,variantCount:1}),'Pleksi steklo');
});
