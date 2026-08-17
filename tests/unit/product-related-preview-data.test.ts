import { expect } from '@playwright/test';
import { describe, test } from 'node:test';
import { buildProductAppearancePreviewProduct } from '@/admin/features/podoba/lib/productAppearancePreviewProduct';
import type {
  AdminCatalogListItem,
  CatalogItemEditorHydration
} from '@/shared/domain/catalog/catalogAdminTypes';
import { DEFAULT_PRODUCT_APPEARANCE_CONFIG } from '@/shared/domain/style/productAppearance';

const variant = (id: number) => ({
  id,
  variantName: 'Osnovna',
  variantSku: `SKU-${id}`,
  length: null,
  width: null,
  thickness: null,
  weight: null,
  price: 10,
  costNet: 5,
  discountPct: 0,
  inventory: 5,
  minOrder: 1,
  status: 'active' as const,
  badge: null,
  position: 1
});

const listItem = (
  id: number,
  slug: string,
  categoryLabel: string,
  status: 'active' | 'inactive' = 'active'
): AdminCatalogListItem => ({
  id,
  slug,
  itemName: slug,
  productType: 'simple',
  typeSpecificData: {},
  description: `${slug} description`,
  brand: 'Atehna',
  material: null,
  unit: 'kos',
  imageUrl: `https://example.test/${slug}.jpg`,
  taxRate: 0.22,
  baseSku: `BASE-${id}`,
  categoryLabel,
  status,
  badge: null,
  variantCount: 1,
  minPrice: 10,
  maxPrice: 10,
  defaultDiscountPct: 0,
  adminNotes: null,
  defaultVariantId: id * 10,
  variants: [variant(id * 10)]
});

const selectedItem = (
  manualProductSlugs: string[]
): CatalogItemEditorHydration => ({
  id: 1,
  updatedAt: '2026-07-28T00:00:00.000Z',
  itemName: 'Izbrani artikel',
  itemType: 'unit',
  productType: 'simple',
  typeSpecificData: {},
  badge: null,
  status: 'active',
  statusBeforeDelete: null,
  deletedAt: null,
  purgeAfter: null,
  categoryPath: ['Materiali', 'Kovine'],
  sku: 'SELECTED',
  slug: 'selected',
  unit: 'kos',
  brand: 'Atehna',
  material: null,
  colour: null,
  shape: null,
  description: 'Selected description',
  adminNotes: null,
  taxRate: 0.22,
  appearanceOverride: {
    relatedProducts: { manualProductSlugs }
  },
  position: 1,
  defaultVariantId: 10,
  optionAxes: [],
  variants: [{
    id: 10,
    variantName: 'Osnovna',
    variantSku: 'SELECTED',
    price: 10,
    inventory: 5,
    minOrder: 1,
    status: 'active',
    position: 1
  }],
  quantityDiscounts: [],
  media: [],
  machineSerialOrderMatches: []
});

describe('product appearance related-product preview data', () => {
  test('combines manual and automatic products in configured order and removes duplicates', () => {
    const options = [
      listItem(1, 'selected', 'Materiali / Kovine'),
      listItem(2, 'same-subcategory', 'Materiali / Kovine'),
      listItem(3, 'same-category', 'Materiali / Les'),
      listItem(4, 'manual', 'Stroji'),
      listItem(5, 'inactive', 'Materiali / Kovine', 'inactive')
    ];
    const product = buildProductAppearancePreviewProduct(
      selectedItem(['manual', 'same-subcategory', 'missing']),
      null,
      {
        productOptions: options,
        relatedProducts: {
          ...DEFAULT_PRODUCT_APPEARANCE_CONFIG.relatedProducts,
          sourceMode: 'same-category',
          manualPlacement: 'before-auto'
        }
      }
    );

    expect(product.relatedProducts.map((related) => related.slug)).toEqual([
      'manual',
      'same-subcategory',
      'same-category'
    ]);
    expect(product.relatedProducts[0]?.image?.url).toBe(
      'https://example.test/manual.jpg'
    );
  });

  test('supports exact-subcategory and manual-only preview sources', () => {
    const options = [
      listItem(2, 'same-subcategory', 'Materiali / Kovine'),
      listItem(3, 'same-category', 'Materiali / Les'),
      listItem(4, 'manual', 'Stroji')
    ];
    const base = DEFAULT_PRODUCT_APPEARANCE_CONFIG.relatedProducts;

    const subcategory = buildProductAppearancePreviewProduct(
      selectedItem(['manual']),
      null,
      {
        productOptions: options,
        relatedProducts: {
          ...base,
          sourceMode: 'same-subcategory',
          manualPlacement: 'after-auto'
        }
      }
    );
    expect(subcategory.relatedProducts.map((related) => related.slug)).toEqual([
      'same-subcategory',
      'manual'
    ]);

    const manualOnly = buildProductAppearancePreviewProduct(
      selectedItem(['manual']),
      null,
      {
        productOptions: options,
        relatedProducts: {
          ...base,
          sourceMode: 'manual-only'
        }
      }
    );
    expect(manualOnly.relatedProducts.map((related) => related.slug)).toEqual([
      'manual'
    ]);
  });

  test('ranks the current leaf before root-category products like the storefront', () => {
    const product = buildProductAppearancePreviewProduct(
      selectedItem([]),
      null,
      {
        productOptions: [
          listItem(2, 'root-category', 'Materiali'),
          listItem(3, 'same-subcategory', 'Materiali / Kovine'),
          listItem(4, 'sibling-subcategory', 'Materiali / Les')
        ],
        relatedProducts: {
          ...DEFAULT_PRODUCT_APPEARANCE_CONFIG.relatedProducts,
          sourceMode: 'same-category'
        }
      }
    );

    expect(product.relatedProducts.map((related) => related.slug)).toEqual([
      'same-subcategory',
      'root-category',
      'sibling-subcategory'
    ]);
  });
});
