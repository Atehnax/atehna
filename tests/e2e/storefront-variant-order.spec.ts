import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CatalogItem } from '@/shared/domain/catalog/catalogTypes';
import { buildStorefrontProductFromCatalogItem } from '@/commercial/features/products/storefrontProduct';
import { buildDimensionalVariantSelectorModel } from '@/commercial/features/products/dimensionalVariants';
import {
  DEFAULT_PRODUCT_APPEARANCE_CONFIG,
  normalizeProductAppearanceConfig,
  toProductAppearanceCssVariables
} from '@/shared/domain/style/productAppearance';

const productContext = {
  href: '/products/materiali/items/aluminijasta-plosca',
  fallbackSku: 'MAT-KOV-ALU',
  fallbackPrice: 0,
  category: {
    slug: 'materiali',
    title: 'Materiali',
    href: '/products/materiali'
  },
  subcategory: {
    slug: 'kovine',
    title: 'Kovine',
    href: '/products/materiali/kovine'
  }
};

test('storefront variants and the legacy selector follow the persisted variant position', () => {
  const catalogItem = {
    slug: 'testni-artikel',
    name: 'Testni artikel',
    description: '',
    status: 'active',
    defaultVariantId: 22,
    variants: [
      {
        id: 33,
        variantName: 'Tretja',
        variantSku: 'T-3',
        position: 3,
        price: 3,
        inventory: 1,
        status: 'active'
      },
      {
        id: 11,
        variantName: 'Prva',
        variantSku: 'T-1',
        position: 1,
        price: 1,
        inventory: 1,
        status: 'active'
      },
      {
        id: 22,
        variantName: 'Druga',
        variantSku: 'T-2',
        position: 2,
        price: 2,
        inventory: 1,
        status: 'active'
      }
    ]
  } as unknown as CatalogItem;

  const product = buildStorefrontProductFromCatalogItem(catalogItem, {
    href: '/products/testni-artikel',
    fallbackSku: 'TEST',
    fallbackPrice: 0,
    category: {
      slug: 'test',
      title: 'Test',
      href: '/products/test'
    }
  });

  expect(product.variants.map((variant) => variant.name)).toEqual([
    'Prva',
    'Druga',
    'Tretja'
  ]);
  expect(product.variants.map((variant) => variant.position)).toEqual([1, 2, 3]);
  expect(product.optionAxes[0]?.values.map((value) => value.label)).toEqual([
    'Prva',
    'Druga',
    'Tretja'
  ]);
  expect(product.defaultVariantId).toBe('22');
});

test('product detail keeps the parent heading, cleans rich text, and labels dimensional variants', () => {
  const catalogItem = {
    id: 91,
    slug: 'aluminijasta-plosca',
    name: 'Aluminijasta plošča',
    description:
      '<p style="font-size: 18px" onclick="alert(1)">Aluminijasta plošča &amp; komplet za modelarstvo.</p><script>alert(2)</script><ul><li>Primerna za tehnični pouk</li></ul>',
    productType: 'dimensions',
    status: 'active',
    defaultVariantId: 911,
    variants: [
      {
        id: 911,
        variantName: '0,3 × 100 × 100 mm',
        variantSku: 'MAT-KOV-ALU-03-100',
        position: 1,
        thickness: 0.3,
        length: 100,
        width: 100,
        price: 12,
        inventory: 4,
        minOrder: 1,
        status: 'active'
      },
      {
        id: 912,
        variantName: '0,5 × 200 × 200 mm',
        variantSku: 'MAT-KOV-ALU-05-200',
        position: 2,
        thickness: 0.5,
        length: 200,
        width: 200,
        price: 24,
        inventory: 2,
        minOrder: 1,
        status: 'active'
      }
    ]
  } as unknown as CatalogItem;

  const product = buildStorefrontProductFromCatalogItem(
    catalogItem,
    productContext
  );
  const detailSource = readFileSync(
    resolve(
      process.cwd(),
      'src/commercial/components/storefront/ProductDetailView.tsx'
    ),
    'utf8'
  );

  expect(detailSource).toMatch(/const displayTitle\s*=\s*product\.name;/);
  expect(detailSource).toMatch(
    /<h1[^>]*>\s*\{displayTitle\}\s*<\/h1>/
  );
  expect(product.name).toBe('Aluminijasta plošča');
  expect(product.shortDescription).toContain(
    'Aluminijasta plošča & komplet za modelarstvo.'
  );
  expect(product.shortDescription).toContain('Primerna za tehnični pouk');
  expect(product.description).not.toContain('<p>');
  expect(product.description).not.toContain('<li>');
  expect(product.descriptionHtml).toContain('<p style="font-size:18px">');
  expect(product.descriptionHtml).toContain('<ul><li>');
  expect(product.descriptionHtml).not.toContain('onclick');
  expect(product.descriptionHtml).not.toContain('<script');
  expect(detailSource).toContain('dangerouslySetInnerHTML');
  expect(product.optionAxes[0]?.name).toBe('Dimenzije');
  expect(product.variants[0]?.dimensions).toEqual({
    length: 100,
    width: 100,
    thickness: 0.3
  });
  expect(
    buildDimensionalVariantSelectorModel(
      product.optionAxes,
      product.variants
    )?.groups.map((group) => ({
      thickness: group.thicknessLabel,
      sizes: group.choices.map((choice) => choice.sizeLabel)
    }))
  ).toEqual([
    { thickness: '0,3 mm', sizes: ['100 × 100 mm'] },
    { thickness: '0,5 mm', sizes: ['200 × 200 mm'] }
  ]);
});

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

  const serverAppearanceSource = readFileSync(
    resolve(process.cwd(), 'src/shared/server/productAppearance.ts'),
    'utf8'
  );
  expect(serverAppearanceSource).toContain("['product-appearance-config-v10']");

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

test('generic variant options honor the same compact height and type settings', () => {
  const selectorSource = readFileSync(
    resolve(
      process.cwd(),
      'src/commercial/components/storefront/VariantSelector.tsx'
    ),
    'utf8'
  );
  const stylesSource = readFileSync(
    resolve(process.cwd(), 'src/shared/styles/globals.css'),
    'utf8'
  );

  expect(selectorSource).toContain('storefront-variant-option');
  expect(stylesSource).toMatch(
    /\.storefront-variant-option\s*\{[\s\S]*--product-variant-chip-height[\s\S]*--product-variant-chip-font-size/
  );
});

test('technical documents only exist in storefront data after a valid upload is present', () => {
  const baseItem = {
    id: 91,
    slug: 'aluminijasta-plosca',
    name: 'Aluminijasta plošča',
    description: 'Opis',
    status: 'active',
    variants: [
      {
        id: 911,
        variantName: '0,3 × 100 × 100 mm',
        variantSku: 'MAT-KOV-ALU-03-100',
        position: 1,
        price: 12,
        inventory: 4,
        minOrder: 1,
        status: 'active'
      }
    ]
  };

  const withoutDocuments = buildStorefrontProductFromCatalogItem(
    baseItem as unknown as CatalogItem,
    productContext
  );
  const withDocument = buildStorefrontProductFromCatalogItem(
    {
      ...baseItem,
      media: [
        {
          id: 70,
          mediaKind: 'document',
          role: 'technical_sheet',
          blobUrl: '/documents/aluminijasta-plosca.pdf',
          filename: 'Tehnični list',
          mimeType: 'application/pdf',
          hidden: false
        }
      ]
    } as unknown as CatalogItem,
    productContext
  );

  expect(withoutDocuments.documents).toEqual([]);
  expect(withoutDocuments.variants[0]?.documents).toEqual([]);
  expect(withDocument.documents).toEqual([
    expect.objectContaining({
      name: 'Tehnični list',
      url: '/documents/aluminijasta-plosca.pdf'
    })
  ]);
});

test('product details use the shared storefront tab treatment and conditional document section', () => {
  const detailSource = readFileSync(
    resolve(
      process.cwd(),
      'src/commercial/components/storefront/ProductDetailView.tsx'
    ),
    'utf8'
  );
  const gallerySource = readFileSync(
    resolve(
      process.cwd(),
      'src/commercial/components/storefront/ProductGallery.tsx'
    ),
    'utf8'
  );

  expect(detailSource).toMatch(/className="storefront-detail-tabs"/);
  expect(detailSource).toMatch(/className="storefront-detail-tab"/);
  expect(detailSource).toMatch(
    /block === 'documents' && documents\.length > 0/
  );
  expect(gallerySource).toContain("'storefront-product-gallery-image'");
  expect(gallerySource).not.toContain(
    "'storefront-product-gallery-image p-3'"
  );
});
