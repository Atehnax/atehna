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
    informationColumns: 5,
    purchaseColumns: 4
  });
  expect(appearance.gallery.imageRatio).toBe('1:1');
  expect(appearance.gallery.maxWidthPx).toBe(300);
  expect(appearance.gallery.thumbnailSizePx).toBe(60);
  expect(appearance.gallery.thumbnailGapPx).toBe(10);
  expect(appearance.gallery.imageFit).toBe('cover');
  expect(appearance.gallery.showDocumentThumbnails).toBe(false);
  expect(variables['--product-gallery-ratio']).toBe('1 / 1');
  expect(variables['--product-gallery-max-width']).toBe('300px');
  expect(variables['--product-gallery-image-fit']).toBe('cover');
  expect(variables['--product-page-content-max-width']).toBe('1280px');
  expect(appearance.information.showSku).toBe(true);
  expect(appearance.information.showKeyAttributes).toBe(false);
  expect(appearance.variants.showSelectedSummary).toBe(false);
  expect(appearance.schemaVersion).toBe(18);
  expect(appearance.purchaseArea.showAvailability).toBe(false);
  expect(appearance.purchaseArea.showSaleUnit).toBe(false);
  expect(appearance.productPage.layout).toBe('showcase');
  expect(appearance.relatedProducts.desktopColumns).toBe(6);
  expect(variables['--product-related-columns-desktop']).toBe('6');
  expect(normalizeProductAppearanceConfig({ schemaVersion: 13, relatedProducts: { desktopColumns: 2, imageHeightPx: 170 } }).relatedProducts).toMatchObject({ desktopColumns: 6, imageHeightPx: 170 });
  expect(normalizeProductAppearanceConfig({ schemaVersion: 14, relatedProducts: { desktopColumns: 4, maxItems: 4, gapPx: 32 } }).relatedProducts).toMatchObject({ desktopColumns: 6, maxItems: 4, gapPx: 32, tabletColumns: 2, mobileColumns: 1 });
  for (const authored of [
    { schemaVersion: 15, relatedProducts: { desktopColumns: 4 } },
    { schemaVersion: 13, relatedProducts: { desktopColumns: 4 } },
    { schemaVersion: 14, productPage: { layout: 'columns' }, relatedProducts: { desktopColumns: 4 } },
    { schemaVersion: 14, relatedProducts: { desktopColumns: 2 } },
    { schemaVersion: 13, relatedProducts: { desktopColumns: 3 } },
    { schemaVersion: 13, productPage: { layout: 'columns' }, relatedProducts: { desktopColumns: 2 } }
  ]) {
    expect(normalizeProductAppearanceConfig(authored).relatedProducts.desktopColumns).toBe(authored.relatedProducts.desktopColumns);
  }
  expect(appearance.gallery.thumbnailPositionDesktop).toBe('bottom');
  expect(appearance.variants.selectorStyle).toBe('chips');
  expect(appearance.purchaseArea.panelStyle).toBe('flat');
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
