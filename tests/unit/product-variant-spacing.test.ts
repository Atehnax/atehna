import { expect } from '@playwright/test';
import { test } from 'node:test';
import {
  DEFAULT_PRODUCT_APPEARANCE_CONFIG,
  normalizeProductAppearanceConfig,
  toProductAppearanceCssVariables,
  toStoredProductAppearanceConfig
} from '@/shared/domain/style/productAppearance';

test('normalizes, clamps, stores, and exports the shared appearance setting', () => {
  expect(DEFAULT_PRODUCT_APPEARANCE_CONFIG.variants.labelControlGapPx).toBe(6);

  const normalized = normalizeProductAppearanceConfig({
    variants: { labelControlGapPx: 17 }
  });
  expect(normalized.variants.labelControlGapPx).toBe(17);
  expect(
    toStoredProductAppearanceConfig(normalized).variants.labelControlGapPx
  ).toBe(17);
  expect(
    normalizeProductAppearanceConfig({
      variants: { labelControlGapPx: -10 }
    }).variants.labelControlGapPx
  ).toBe(0);
  expect(
    normalizeProductAppearanceConfig({
      variants: { labelControlGapPx: 100 }
    }).variants.labelControlGapPx
  ).toBe(32);

  expect(
    toProductAppearanceCssVariables(normalized)[
      '--product-variant-label-control-gap'
    ]
  ).toBe('17px');
  expect(
    toProductAppearanceCssVariables(normalized, 0.5)[
      '--product-variant-label-control-gap'
    ]
  ).toBe('8.5px');
});
