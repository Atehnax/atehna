import { test } from 'node:test';
import { expect } from '@playwright/test';

import {
  DEFAULT_PRODUCT_APPEARANCE_CONFIG,
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
  expect(appearance.schemaVersion).toBe(8);
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

  const upgradedLegacyDefaults = normalizeProductAppearanceConfig({
    variants: {
      selectWidthPx: 300,
      selectHeightPx: 58,
      chipWidthPx: 106,
      chipHeightPx: 52,
      chipFontSizePx: 16,
      labelFontSizePx: 16,
      compactSelectors: false
    }
  });
  expect(upgradedLegacyDefaults.variants).toMatchObject({
    selectWidthPx: 260,
    selectHeightPx: 44,
    chipWidthPx: 88,
    chipHeightPx: 40,
    chipFontSizePx: 14,
    labelFontSizePx: 14,
    compactSelectors: true
  });

  const upgradedPartiallyCustomizedLegacyConfig = normalizeProductAppearanceConfig({
    variants: {
      selectWidthPx: 300,
      selectHeightPx: 44,
      chipWidthPx: 106,
      chipHeightPx: 43,
      chipFontSizePx: 16,
      labelFontSizePx: 16,
      compactSelectors: false
    }
  });
  expect(upgradedPartiallyCustomizedLegacyConfig.variants).toMatchObject({
    selectWidthPx: 260,
    selectHeightPx: 44,
    chipWidthPx: 88,
    chipHeightPx: 43,
    chipFontSizePx: 14,
    labelFontSizePx: 14,
    compactSelectors: true
  });

  const authoredLegacyNumbers = normalizeProductAppearanceConfig({
    schemaVersion: 2,
    variants: {
      selectWidthPx: 300,
      selectHeightPx: 58,
      chipWidthPx: 106,
      chipHeightPx: 52,
      chipFontSizePx: 16,
      labelFontSizePx: 16,
      compactSelectors: false
    }
  });
  expect(authoredLegacyNumbers.variants).toMatchObject({
    selectWidthPx: 300,
    selectHeightPx: 58,
    chipWidthPx: 106,
    chipHeightPx: 52,
    chipFontSizePx: 16,
    labelFontSizePx: 16,
    compactSelectors: false
  });

  const upgradedLegacyListing = normalizeProductAppearanceConfig({
    listings: {
      tabletColumns: 2,
      cardDensity: 'comfortable',
      imageRatio: '1:1'
    }
  });
  expect(upgradedLegacyListing.listings).toMatchObject({
    tabletColumns: 3,
    cardDensity: 'compact',
    imageRatio: '1:1'
  });

  const upgradedPersistedV2Reference = normalizeProductAppearanceConfig({
    schemaVersion: 2,
    listings: {
      availableModes: 'grid',
      defaultMode: 'grid',
      desktopColumns: 4,
      tabletColumns: 2,
      mobileColumns: 1,
      gapPx: 20,
      cardDensity: 'comfortable',
      imageRatio: '1:1',
      imageFit: 'contain',
      titleLines: 2,
      showBrand: true,
      showSku: false,
      showShortDescription: false,
      showStock: true,
      showDiscount: true,
      showPurchaseAction: true,
      allowSimpleQuickAdd: true,
      showUnavailableVariants: true,
      filterPlacement: 'sidebar',
      paginationStyle: 'pages',
      subcategoryTilesVisible: true
    }
  });
  expect(upgradedPersistedV2Reference.listings).toMatchObject({
    tabletColumns: 3,
    cardDensity: 'compact',
    imageRatio: '1:1',
    showShortDescription: true
  });

  const compactV3ListingReference = {
    availableModes: 'grid',
    defaultMode: 'grid',
    desktopColumns: 4,
    tabletColumns: 3,
    mobileColumns: 1,
    gapPx: 20,
    cardDensity: 'compact',
    imageRatio: '16:9',
    imageFit: 'contain',
    titleLines: 2,
    showBrand: true,
    showSku: false,
    showShortDescription: false,
    showStock: true,
    showDiscount: true,
    showPurchaseAction: true,
    allowSimpleQuickAdd: true,
    showUnavailableVariants: true,
    filterPlacement: 'sidebar',
    paginationStyle: 'pages',
    subcategoryTilesVisible: true
  };
  const upgradedPersistedV3Reference = normalizeProductAppearanceConfig({
    schemaVersion: 3,
    listings: compactV3ListingReference
  });
  expect(upgradedPersistedV3Reference).toMatchObject({
    schemaVersion: 8,
    listings: {
      imageRatio: '1:1',
      showShortDescription: true
    }
  });

  const imageLedV4ListingReference = {
    ...compactV3ListingReference,
    imageRatio: '4:3'
  };
  const upgradedPersistedV4Reference = normalizeProductAppearanceConfig({
    schemaVersion: 4,
    listings: imageLedV4ListingReference
  });
  expect(upgradedPersistedV4Reference).toMatchObject({
    schemaVersion: 8,
    listings: {
      imageRatio: '1:1',
      showShortDescription: true
    }
  });

  const squareV5ListingReference = {
    ...compactV3ListingReference,
    imageRatio: '1:1'
  };
  const upgradedPersistedV5Reference = normalizeProductAppearanceConfig({
    schemaVersion: 5,
    listings: squareV5ListingReference
  });
  expect(upgradedPersistedV5Reference).toMatchObject({
    schemaVersion: 8,
    listings: {
      imageRatio: '1:1',
      showShortDescription: true
    }
  });

  const authoredPartialV5HiddenDescription = normalizeProductAppearanceConfig({
    schemaVersion: 5,
    listings: {
      showShortDescription: false
    }
  });
  expect(authoredPartialV5HiddenDescription.listings.showShortDescription)
    .toBe(false);

  const authoredV6HiddenDescription = normalizeProductAppearanceConfig({
    schemaVersion: 6,
    listings: {
      showShortDescription: false
    }
  });
  expect(authoredV6HiddenDescription.listings.showShortDescription).toBe(false);

  for (const schemaVersion of [3, 4, 5, 6, 7, 8]) {
    const authoredWideListing = normalizeProductAppearanceConfig({
      schemaVersion,
      listings: {
        imageRatio: '16:9'
      }
    });
    expect(authoredWideListing.listings.imageRatio).toBe('16:9');
  }

  const authoredV4ImageRatio = normalizeProductAppearanceConfig({
    schemaVersion: 4,
    listings: {
      imageRatio: '4:3'
    }
  });
  expect(authoredV4ImageRatio.listings.imageRatio).toBe('4:3');

  for (const schemaVersion of [2, 3, 4, 5, 6, 7, 8]) {
    const authoredListing = normalizeProductAppearanceConfig({
      schemaVersion,
      listings: {
        tabletColumns: 2,
        cardDensity: 'comfortable',
        imageRatio: '1:1'
      }
    });
    expect(authoredListing.listings).toMatchObject({
      tabletColumns: 2,
      cardDensity: 'comfortable',
      imageRatio: '1:1'
    });
  }

  const v2WithNewListingDefaults = normalizeProductAppearanceConfig({
    schemaVersion: 2,
    listings: {}
  });
  expect(v2WithNewListingDefaults.listings).toMatchObject({
    tabletColumns: 3,
    cardDensity: 'compact',
    imageRatio: '1:1'
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
