import { test } from 'node:test';
import { expect } from '@playwright/test';

import {
  DEFAULT_PRODUCT_APPEARANCE_CONFIG,
  DEFAULT_PRODUCT_CANVAS_ELEMENT_DEVICE_SETTINGS,
  normalizeProductAppearanceConfig,
  toProductAppearanceCssVariables
} from '@/shared/domain/style/productAppearance';

test('reference product appearance defaults stay compact and inherit global width', () => {
  const appearance = DEFAULT_PRODUCT_APPEARANCE_CONFIG;
  const variables = toProductAppearanceCssVariables(appearance);

  expect(appearance.productPage.widthMode).toBe('global');
  expect(appearance.productPage.columnGapPx).toBe(44);
  expect(appearance.productPage).toMatchObject({
    galleryColumns: 6,
    informationColumns: 4,
    purchaseColumns: 4
  });
  expect(appearance.gallery.imageRatio).toBe('4:3');
  expect(appearance.gallery.imageFit).toBe('cover');
  expect(appearance.gallery.showDocumentThumbnails).toBe(false);
  expect(variables['--product-gallery-ratio']).toBe('4 / 3');
  expect(variables['--product-gallery-image-fit']).toBe('cover');
  expect(variables['--product-page-content-max-width']).toBe('1500px');
  expect(appearance.information.showSku).toBe(false);
  expect(appearance.information.showKeyAttributes).toBe(false);
  expect(appearance.variants.showSelectedSummary).toBe(false);
  expect(appearance.schemaVersion).toBe(10);
  expect(DEFAULT_PRODUCT_CANVAS_ELEMENT_DEVICE_SETTINGS.contentScale).toBe(1);
  expect(appearance.listings).toMatchObject({
    tabletColumns: 3,
    cardDensity: 'compact',
    imageRatio: '1:1',
    showShortDescription: true
  });
  expect(variables['--product-listing-columns-tablet']).toBe('3');
  expect(variables['--product-card-image-ratio']).toBe('1 / 1');
  expect(appearance.variants).toMatchObject({
    selectWidthPx: 260,
    selectHeightPx: 44,
    chipWidthPx: 88,
    chipHeightPx: 40,
    chipFontSizePx: 14,
    labelFontSizePx: 14,
    labelControlGapPx: 6,
    compactSelectors: true
  });
  expect(variables['--product-variant-select-width']).toBe('260px');
  expect(variables['--product-variant-select-height']).toBe('44px');
  expect(variables['--product-variant-chip-width']).toBe('88px');
  expect(variables['--product-variant-chip-height']).toBe('40px');
  expect(variables['--product-variant-chip-font-size']).toBe('14px');
  expect(variables['--product-variant-label-font-size']).toBe('14px');
  expect(variables['--product-variant-label-control-gap']).toBe('6px');

  const authored = normalizeProductAppearanceConfig({
    variants: {
      selectWidthPx: 300,
      selectHeightPx: 58,
      chipWidthPx: 106,
      chipHeightPx: 52,
      chipFontSizePx: 16,
      labelFontSizePx: 16,
      compactSelectors: false
    },
    listings: {
      tabletColumns: 2,
      cardDensity: 'comfortable',
      imageRatio: '16:9',
      showShortDescription: false
    }
  });
  expect(authored.variants).toMatchObject({
    selectWidthPx: 300,
    selectHeightPx: 58,
    chipWidthPx: 106,
    chipHeightPx: 52,
    chipFontSizePx: 16,
    labelFontSizePx: 16,
    compactSelectors: false
  });
  expect(authored.listings).toMatchObject({
    tabletColumns: 2,
    cardDensity: 'comfortable',
    imageRatio: '16:9',
    showShortDescription: false
  });
  const resized = normalizeProductAppearanceConfig({
    variants: {
      selectWidthPx: 640,
      selectHeightPx: 32,
      chipWidthPx: 40,
      chipHeightPx: 120,
      chipFontSizePx: 8,
      labelFontSizePx: 40,
      labelControlGapPx: 64
    }
  });
  expect(resized.variants.selectWidthPx).toBe(500);
  expect(resized.variants.selectHeightPx).toBe(40);
  expect(resized.variants.chipWidthPx).toBe(72);
  expect(resized.variants.chipHeightPx).toBe(80);
  expect(resized.variants.chipFontSizePx).toBe(11);
  expect(resized.variants.labelFontSizePx).toBe(28);
  expect(resized.variants.labelControlGapPx).toBe(32);
});
