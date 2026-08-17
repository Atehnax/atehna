import { expect } from '@playwright/test';
import { test } from 'node:test';
import {
  DEFAULT_PRODUCT_APPEARANCE_CONFIG,
  toProductAppearanceCssVariables
} from '@/shared/domain/style/productAppearance';

test('keeps the compact defaults separate from the approved image and content geometry', () => {
  expect(DEFAULT_PRODUCT_APPEARANCE_CONFIG.variants).toMatchObject({
    selectHeightPx: 44,
    chipHeightPx: 40,
    chipFontSizePx: 14,
    labelFontSizePx: 14
  });

  const variables = toProductAppearanceCssVariables(
    DEFAULT_PRODUCT_APPEARANCE_CONFIG
  );
  expect(variables['--product-variant-select-height']).toBe('44px');
  expect(variables['--product-variant-chip-height']).toBe('40px');
  expect(variables['--product-variant-chip-font-size']).toBe('14px');
  expect(variables['--product-variant-label-font-size']).toBe('14px');

  // These are the accepted reference dimensions. Compacting the information
  // and purchase controls must not silently scale the gallery, description,
  // or related-product cards.
  expect(DEFAULT_PRODUCT_APPEARANCE_CONFIG.gallery).toMatchObject({
    sizePercent: 100,
    imageRatio: '4:3',
    thumbnailSizePx: 70,
    thumbnailGapPx: 16
  });
  expect(
    DEFAULT_PRODUCT_APPEARANCE_CONFIG.information.longDescriptionMaxWidthPx
  ).toBe(880);
  expect(DEFAULT_PRODUCT_APPEARANCE_CONFIG.relatedProducts).toMatchObject({
    cardWidthPx: 360,
    imageHeightPx: 144,
    textScalePercent: 100
  });
  expect(variables['--product-description-max-width']).toBe('880px');
  expect(variables['--product-related-card-width']).toBe('360px');
  expect(variables['--product-related-image-height']).toBe('144px');
});
