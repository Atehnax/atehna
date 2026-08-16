import { expect, test } from '@playwright/test';
import {
  DEFAULT_PRODUCT_APPEARANCE_CONFIG,
  normalizeProductAppearanceConfig,
  resolveProductAppearanceConfig,
  toProductAppearanceCssVariables,
  toStoredProductAppearanceConfig
} from '@/shared/domain/style/productAppearance';
import {
  selectRelatedProductCandidates,
  type RelatedProductCandidate,
  type RelatedProductSelectionConfig
} from '@/commercial/features/products/relatedProductSelection';

const baseSelectionConfig = (
  overrides: Partial<RelatedProductSelectionConfig> = {}
): RelatedProductSelectionConfig => ({
  enabled: true,
  sourceMode: 'same-category',
  manualProductSlugs: [],
  manualPlacement: 'before-auto',
  maxItems: 4,
  showAccessoriesFirst: true,
  ...overrides
});

type CandidateProduct = { name: string };

const candidate = (
  slug: string,
  categorySlug: string,
  subcategorySlug: string | null,
  overrides: Partial<RelatedProductCandidate<CandidateProduct>> = {}
): RelatedProductCandidate<CandidateProduct> => ({
  product: { name: slug },
  slug,
  categorySlug,
  subcategorySlug,
  ...overrides
});

test.describe('related product recommendation contracts', () => {
  test('normalizes, stores and exposes the recommendation appearance settings', () => {
    const normalized = normalizeProductAppearanceConfig({
      relatedProducts: {
        enabled: false,
        sourceMode: 'same-subcategory',
        manualProductSlugs: ['  manual-a  ', 'manual-a', '', 42, 'manual-b'],
        manualPlacement: 'after-auto',
        maxItems: 0,
        desktopColumns: 99,
        tabletColumns: 0,
        mobileColumns: 9,
        gapPx: 500,
        cardWidthPx: 999,
        imageHeightPx: 0,
        textScalePercent: 200,
        sectionPlacement: 'before-content',
        sectionWidthPercent: 5,
        sectionAlignment: 'right',
        showAccessoriesFirst: false
      }
    });

    expect(normalized.relatedProducts).toEqual({
      enabled: false,
      sourceMode: 'same-subcategory',
      manualProductSlugs: ['manual-a', 'manual-b'],
      manualPlacement: 'after-auto',
      maxItems: 1,
      desktopColumns: 6,
      tabletColumns: 1,
      mobileColumns: 2,
      gapPx: 64,
      cardWidthPx: 520,
      imageHeightPx: 96,
      textScalePercent: 140,
      sectionPlacement: 'before-content',
      sectionWidthPercent: 25,
      sectionAlignment: 'right',
      showAccessoriesFirst: false
    });
    expect(
      toStoredProductAppearanceConfig(normalized).relatedProducts
    ).toEqual(normalized.relatedProducts);

    const variables = toProductAppearanceCssVariables(normalized);
    expect(variables['--product-related-gap']).toBe('64px');
    expect(variables['--product-related-card-width']).toBe('520px');
    expect(variables['--product-related-image-height']).toBe('96px');
    expect(variables['--product-related-text-scale']).toBe('1.4');
    expect(variables['--product-related-section-width']).toBe('25%');
    expect(
      variables['--product-related-section-margin-inline-start']
    ).toBe('auto');
    expect(
      variables['--product-related-section-margin-inline-end']
    ).toBe('0');
  });

  test('allows a product override only when block overrides are enabled', () => {
    const override = {
      relatedProducts: {
        sourceMode: 'manual-only',
        manualProductSlugs: ['manual-product'],
        maxItems: 1,
        sectionPlacement: 'before-content',
        cardWidthPx: 320,
        imageHeightPx: 210,
        textScalePercent: 90
      }
    };
    const enabled = resolveProductAppearanceConfig(
      DEFAULT_PRODUCT_APPEARANCE_CONFIG,
      override
    );
    expect(enabled.relatedProducts).toMatchObject(override.relatedProducts);

    const disabled = resolveProductAppearanceConfig(
      {
        ...DEFAULT_PRODUCT_APPEARANCE_CONFIG,
        overrides: {
          ...DEFAULT_PRODUCT_APPEARANCE_CONFIG.overrides,
          allowProductBlockVisibilityOverride: false
        }
      },
      override
    );
    expect(disabled.relatedProducts).toEqual(
      DEFAULT_PRODUCT_APPEARANCE_CONFIG.relatedProducts
    );
  });

  test('uses the reference related-card sizing without altering ordinary listing cards', () => {
    expect(DEFAULT_PRODUCT_APPEARANCE_CONFIG.relatedProducts).toMatchObject({
      cardWidthPx: 360,
      imageHeightPx: 144,
      textScalePercent: 100
    });

    const schema6Reference = {
      ...DEFAULT_PRODUCT_APPEARANCE_CONFIG.relatedProducts,
      imageHeightPx: 188
    };
    const upgradedSchema6Reference = normalizeProductAppearanceConfig({
      schemaVersion: 6,
      relatedProducts: schema6Reference
    });
    expect(upgradedSchema6Reference.relatedProducts.imageHeightPx).toBe(144);
    expect(normalizeProductAppearanceConfig(upgradedSchema6Reference))
      .toEqual(upgradedSchema6Reference);
    expect(normalizeProductAppearanceConfig({
      schemaVersion: 6,
      relatedProducts: { imageHeightPx: 188 }
    }).relatedProducts.imageHeightPx).toBe(188);

    const schema7PresentationReference = {
      ...DEFAULT_PRODUCT_APPEARANCE_CONFIG.relatedProducts,
      imageHeightPx: 160
    };
    expect(normalizeProductAppearanceConfig({
      schemaVersion: 7,
      relatedProducts: schema7PresentationReference
    }).relatedProducts.imageHeightPx).toBe(144);
    expect(normalizeProductAppearanceConfig({
      schemaVersion: 7,
      relatedProducts: {
        ...schema7PresentationReference,
        sourceMode: 'manual',
        manualProductSlugs: ['manually-selected-product'],
        maxItems: 1
      }
    }).relatedProducts.imageHeightPx).toBe(144);
    expect(normalizeProductAppearanceConfig({
      schemaVersion: 7,
      relatedProducts: {
        ...schema7PresentationReference,
        cardWidthPx: 380
      }
    }).relatedProducts.imageHeightPx).toBe(160);
    expect(normalizeProductAppearanceConfig({
      schemaVersion: 7,
      relatedProducts: { imageHeightPx: 160 }
    }).relatedProducts.imageHeightPx).toBe(160);
    expect(normalizeProductAppearanceConfig({
      schemaVersion: 8,
      relatedProducts: schema7PresentationReference
    }).relatedProducts.imageHeightPx).toBe(160);
    expect(normalizeProductAppearanceConfig({
      relatedProducts: { imageHeightPx: 192 }
    }).relatedProducts.imageHeightPx).toBe(144);
  });

  test('merges manual and same-subcategory candidates deterministically', () => {
    const candidates = [
      candidate('auto-a', 'materials', 'metals'),
      candidate('manual-other-category', 'machines', null),
      candidate('auto-accessory', 'materials', 'metals', {
        relationKind: 'accessory'
      }),
      candidate('other-subcategory', 'materials', 'plastics'),
      candidate('AUTO-A', 'materials', 'metals'),
      candidate('current-product', 'materials', 'metals'),
      candidate('inactive', 'materials', 'metals', { eligible: false })
    ];

    const selected = selectRelatedProductCandidates({
      currentSlug: 'current-product',
      currentCategorySlug: 'materials',
      currentSubcategorySlug: 'metals',
      candidates,
      config: baseSelectionConfig({
        sourceMode: 'same-subcategory',
        manualProductSlugs: [
          'manual-other-category',
          'missing-product',
          'MANUAL-OTHER-CATEGORY'
        ]
      })
    });

    expect(selected.map((entry) => entry.slug)).toEqual([
      'manual-other-category',
      'auto-accessory',
      'auto-a'
    ]);
  });

  test('supports category-wide, manual-only, ordering and one-card caps', () => {
    const candidates = [
      candidate('same-subcategory', 'materials', 'metals'),
      candidate('other-subcategory', 'materials', 'plastics'),
      candidate('manual-same-category', 'materials', null),
      candidate('manual-other-category', 'machines', null)
    ];

    const categorySelection = selectRelatedProductCandidates({
      currentSlug: 'current-product',
      currentCategorySlug: 'materials',
      currentSubcategorySlug: 'metals',
      candidates,
      config: baseSelectionConfig({
        sourceMode: 'same-category',
        manualProductSlugs: ['manual-same-category'],
        manualPlacement: 'after-auto',
        maxItems: 3,
        showAccessoriesFirst: false
      })
    });
    expect(categorySelection.map((entry) => entry.slug)).toEqual([
      'same-subcategory',
      'other-subcategory',
      'manual-same-category'
    ]);

    const manualOnly = selectRelatedProductCandidates({
      currentSlug: 'current-product',
      currentCategorySlug: 'materials',
      currentSubcategorySlug: 'metals',
      candidates,
      config: baseSelectionConfig({
        sourceMode: 'manual-only',
        manualProductSlugs: [
          'manual-other-category',
          'manual-same-category'
        ],
        maxItems: 1
      })
    });
    expect(manualOnly.map((entry) => entry.slug)).toEqual([
      'manual-other-category'
    ]);
  });
});
