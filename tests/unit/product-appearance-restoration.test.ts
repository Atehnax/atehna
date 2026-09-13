import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyProductShowcasePreset,
  normalizeProductAppearanceConfig,
  resolveProductCanvasElementDeviceSettings,
  toStoredProductAppearanceConfig,
  toProductAppearanceCssVariables,
  validateProductAppearanceConfigInput
} from '@/shared/domain/style/productAppearance';
import { isProductCanvasElementContentEnabled, restoreProductCanvasElements } from '@/admin/features/podoba/lib/productAppearanceElementVisibility';

test('old preset migrates to showcase without replacing custom appearance values', () => {
  const config = normalizeProductAppearanceConfig({
    schemaVersion: 11,
    productPage: { informationColumns: 4 },
    information: { showSku: false },
    gallery: { thumbnailPositionDesktop: 'left' },
    variants: { selectorStyle: 'select' },
    purchaseArea: { panelStyle: 'card', copy: { paymentMessage: 'Lastno plačilo' } },
    relatedProducts: { imageHeightPx: 170 },
    canvas: { mode: 'free', elements: { 'product-title': { responsive: { mobile: { color: '#123456', widthPx: 280 } } } } }
  });
  assert.equal(config.schemaVersion, 17);
  assert.equal(config.productPage.layout, 'showcase');
  assert.equal(config.productPage.informationColumns, 5);
  assert.equal(config.information.showSku, true);
  assert.equal(config.gallery.thumbnailPositionDesktop, 'bottom');
  assert.equal(config.variants.selectorStyle, 'select');
  assert.equal(config.relatedProducts.imageHeightPx, 170);
  assert.equal(config.purchaseArea.copy.paymentMessage, 'Lastno plačilo');
  assert.deepEqual(normalizeProductAppearanceConfig(toStoredProductAppearanceConfig(config)), config);
  assert.deepEqual(applyProductShowcasePreset(config).canvas, config.canvas);
});

test('explicit layout and modern or unversioned settings remain authored', () => {
  for (const schemaVersion of [undefined, 13]) {
    const config = normalizeProductAppearanceConfig({ schemaVersion, information: { showSku: false }, gallery: { thumbnailPositionDesktop: 'left' } });
    assert.equal(config.information.showSku, false);
    assert.equal(config.gallery.thumbnailPositionDesktop, 'left');
  }
  assert.equal(normalizeProductAppearanceConfig({ productPage: { layout: 'columns' } }).productPage.layout, 'columns');
});

test('restoring a nested hidden element restores its ancestors only for the selected device', () => {
  const config = normalizeProductAppearanceConfig({
    canvas: { mode: 'free', elements: {
      'product-information': { responsive: { desktop: { visible: false }, mobile: { visible: false } } },
      'product-purchase': { responsive: { desktop: { visible: false }, mobile: { visible: false } } },
      'product-price-tax': { responsive: { desktop: { visible: false, widthPx: 220, offsetXPx: 14, color: '#123456' }, mobile: { visible: false, widthPx: 120 } } }
    } }
  });
  const restored = restoreProductCanvasElements(config, ['product-price-tax'], 'desktop', new Map([
    ['product-price-tax', 'product-purchase'], ['product-purchase', 'product-information'], ['product-information', null]
  ]));
  for (const id of ['product-price-tax', 'product-purchase', 'product-information']) {
    assert.equal(resolveProductCanvasElementDeviceSettings(restored, id, 'desktop').visible, true);
    assert.equal(resolveProductCanvasElementDeviceSettings(restored, id, 'mobile').visible, false);
  }
  assert.equal(resolveProductCanvasElementDeviceSettings(restored, 'product-price-tax', 'desktop').widthPx, 220);
  assert.equal(resolveProductCanvasElementDeviceSettings(restored, 'product-price-tax', 'desktop').offsetXPx, 14);
  assert.equal(resolveProductCanvasElementDeviceSettings(restored, 'product-price-tax', 'desktop').color, '#123456');
  assert.deepEqual(normalizeProductAppearanceConfig(toStoredProductAppearanceConfig(restored)).canvas, restored.canvas);
});

test('adding a disabled content block affects only the selected device and survives storage', () => {
  const config = normalizeProductAppearanceConfig({ schemaVersion: 12, information: { showSku: false }, productPage: { informationOrder: ['title'] } });
  const restored = restoreProductCanvasElements(config, ['product-sku'], 'mobile', new Map([['product-sku', 'product-information'], ['product-information', null]]));
  assert.equal(restored.information.showSku, true);
  assert.ok(restored.productPage.informationOrder.includes('sku'));
  assert.equal(resolveProductCanvasElementDeviceSettings(restored, 'product-sku', 'mobile').visible, true);
  assert.equal(resolveProductCanvasElementDeviceSettings(restored, 'product-sku', 'desktop').visible, false);
  assert.equal(resolveProductCanvasElementDeviceSettings(restored, 'product-sku', 'tablet').visible, false);
  assert.deepEqual(normalizeProductAppearanceConfig(toStoredProductAppearanceConfig(restored)).canvas, restored.canvas);
});

test('compact gallery migrates only earlier showcase defaults and preserves custom presentation', () => {
  const compact = normalizeProductAppearanceConfig({ schemaVersion: 12, productPage: { layout: 'showcase' }, gallery: { imageRatio: '3:2', thumbnailSizePx: 88, thumbnailGapPx: 16, sizePercent: 85 } });
  assert.equal(compact.gallery.maxWidthPx, 300);
  assert.equal(compact.gallery.imageRatio, '1:1');
  assert.equal(compact.gallery.thumbnailSizePx, 60);
  assert.equal(compact.gallery.thumbnailGapPx, 10);
  assert.equal(compact.gallery.sizePercent, 85);
  for (const config of [
    { schemaVersion: 12, gallery: { imageRatio: '16:9', thumbnailSizePx: 74, thumbnailGapPx: 7, maxWidthPx: 460 } },
    { schemaVersion: 11, gallery: { imageRatio: '3:2', thumbnailSizePx: 88 } },
    { schemaVersion: 12, productPage: { layout: 'columns' }, gallery: { imageRatio: '3:2', thumbnailSizePx: 88 } },
    { schemaVersion: 13, gallery: { imageRatio: '3:2', thumbnailSizePx: 88 } }
  ]) {
    const normalized = normalizeProductAppearanceConfig(config);
    for (const [key, value] of Object.entries(config.gallery)) assert.equal(normalized.gallery[key as keyof typeof normalized.gallery], value);
  }
  assert.equal(normalizeProductAppearanceConfig({ gallery: { maxWidthPx: 10 } }).gallery.maxWidthPx, 160);
  assert.equal(normalizeProductAppearanceConfig({ gallery: { maxWidthPx: 2000 } }).gallery.maxWidthPx, 1000);
  assert.equal(toProductAppearanceCssVariables(compact, 1.25)['--product-gallery-max-width'], '375px');
  assert.deepEqual(normalizeProductAppearanceConfig(toStoredProductAppearanceConfig(compact)).gallery, compact.gallery);
});

test('showcase does not validate hidden legacy column weights', () => {
  const productPage = { galleryColumns: 7, informationColumns: 6, purchaseColumns: 5 };
  assert.deepEqual(validateProductAppearanceConfigInput({ productPage: { ...productPage, layout: 'showcase' } }), []);
  assert.ok(validateProductAppearanceConfigInput({ productPage: { ...productPage, layout: 'columns' } }).some((error) => error.includes('Vsota stolpcev')));
});


test('legacy purchase rows become opt-in while new explicit choices survive storage', () => {
  for (const schemaVersion of [12, 14, 15]) {
    const migrated = normalizeProductAppearanceConfig({
      schemaVersion,
      purchaseArea: { showAvailability: true, showMinimumOrder: false }
    });
    assert.equal(migrated.purchaseArea.showAvailability, false);
    assert.equal(migrated.purchaseArea.showSaleUnit, false);
    assert.equal(migrated.purchaseArea.showMinimumOrder, false);
  }
  for (const schemaVersion of [undefined, 16]) {
    const authored = normalizeProductAppearanceConfig({
      schemaVersion,
      purchaseArea: { showAvailability: true, showSaleUnit: true }
    });
    const stored = normalizeProductAppearanceConfig(toStoredProductAppearanceConfig(authored));
    assert.equal(stored.purchaseArea.showAvailability, true);
    assert.equal(stored.purchaseArea.showSaleUnit, true);
  }
});

test('hidden sale unit can be restored on one device without enabling stock information', () => {
  const config = normalizeProductAppearanceConfig({});
  const restored = restoreProductCanvasElements(config, ['product-gallery-sale-unit'], 'mobile', new Map([
    ['product-gallery-sale-unit', 'product-price'],
    ['product-price', 'product-purchase'],
    ['product-purchase', null]
  ]));
  const stored = normalizeProductAppearanceConfig(toStoredProductAppearanceConfig(restored));
  assert.equal(isProductCanvasElementContentEnabled(config, 'product-gallery-sale-unit', 'mobile'), false);
  assert.equal(stored.purchaseArea.showSaleUnit, true);
  assert.equal(stored.purchaseArea.showAvailability, false);
  assert.equal(resolveProductCanvasElementDeviceSettings(stored, 'product-gallery-sale-unit', 'mobile').visible, true);
  assert.equal(resolveProductCanvasElementDeviceSettings(stored, 'product-gallery-sale-unit', 'desktop').visible, false);
  assert.equal(resolveProductCanvasElementDeviceSettings(stored, 'product-gallery-sale-unit', 'tablet').visible, false);
});
