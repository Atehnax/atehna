import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_PRODUCT_APPEARANCE_CONFIG, normalizeProductAppearanceConfig } from '@/shared/domain/style/productAppearance';
import { selectRelatedProductCandidates } from '@/commercial/features/products/relatedProductSelection';

const oldAutomatic = {
  schemaVersion: 17,
  relatedProducts: {
    maxItems: 4, desktopColumns: 3, cardWidthPx: 640, imageHeightPx: 112,
    gapPx: 24, sourceMode: 'same-category', manualProductSlugs: []
  }
};

test('the inherited four-card preset upgrades to six without changing its recommendation source', () => {
  const config = normalizeProductAppearanceConfig(oldAutomatic);
  assert.equal(config.relatedProducts.maxItems, 6);
  assert.equal(config.relatedProducts.desktopColumns, 6);
  assert.equal(config.relatedProducts.sourceMode, 'same-category');
  assert.deepEqual(config.relatedProducts.manualProductSlugs, []);
  assert.deepEqual(normalizeProductAppearanceConfig(config), config);
});

test('authored limits, manual order and customized recommendation presets survive migration', () => {
  for (const changes of [
    { maxItems: 2 }, { maxItems: 4, gapPx: 32 },
    { sourceMode: 'manual-only', manualProductSlugs: ['second', 'first'] },
    { manualProductSlugs: ['second', 'first'] }
  ]) {
    const authored = { ...oldAutomatic, relatedProducts: { ...oldAutomatic.relatedProducts, ...changes } };
    const config = normalizeProductAppearanceConfig(authored);
    assert.equal(config.relatedProducts.maxItems, authored.relatedProducts.maxItems);
    assert.equal(config.relatedProducts.sourceMode, authored.relatedProducts.sourceMode);
    assert.deepEqual(config.relatedProducts.manualProductSlugs, authored.relatedProducts.manualProductSlugs);
  }
  const current = normalizeProductAppearanceConfig({ schemaVersion: 18, relatedProducts: oldAutomatic.relatedProducts });
  assert.equal(current.relatedProducts.maxItems, 4);
});

test('six default recommendations retain manual order and exclude the current or ineligible products', () => {
  const config = { ...DEFAULT_PRODUCT_APPEARANCE_CONFIG.relatedProducts, manualProductSlugs: ['manual-second', 'manual-first'] };
  const candidates = ['current', 'manual-first', 'manual-second', 'excluded', 'auto-1', 'auto-2', 'auto-3', 'auto-4', 'auto-5'].map(slug => ({
    slug, categorySlug: 'materials', subcategorySlug: null, product: { slug }, eligible: slug !== 'excluded'
  }));
  const selected = selectRelatedProductCandidates({ currentSlug: 'current', currentCategorySlug: 'materials', currentSubcategorySlug: null, candidates, config });
  assert.deepEqual(selected.map(product => product.slug), ['manual-second', 'manual-first', 'auto-1', 'auto-2', 'auto-3', 'auto-4']);
});
