import { expect, test } from '@playwright/test';
import {
  buildCatalogRelatedPresentationContext,
  selectCatalogRelatedItems
} from '@/commercial/catalog/catalogRelatedProducts';
import { DEFAULT_PRODUCT_APPEARANCE_CONFIG } from '@/shared/domain/style/productAppearance';
import type { CatalogItem } from '@/shared/domain/catalog/catalogTypes';

const item = (
  slug: string,
  overrides: Partial<CatalogItem> = {}
): CatalogItem => ({
  slug,
  name: slug,
  description: `${slug} description`,
  ...overrides
});

test.describe('catalog related-product plumbing', () => {
  test('resolves manual products globally and ranks automatic siblings leaf-first', () => {
    const current = item('current-product', {
      appearanceOverride: {
        relatedProducts: {
          sourceMode: 'same-category',
          manualProductSlugs: ['manual-machine'],
          manualPlacement: 'before-auto',
          maxItems: 4
        }
      }
    });
    const categories = [
      {
        id: 'materials',
        slug: 'materials',
        title: 'Materials',
        items: [item('direct-material')],
        subcategories: [
          {
            id: 'metals',
            slug: 'metals',
            title: 'Metals',
            items: [current, item('same-metal')]
          },
          {
            id: 'plastics',
            slug: 'plastics',
            title: 'Plastics',
            items: [item('same-category-plastic')]
          }
        ]
      },
      {
        id: 'machines',
        slug: 'machines',
        title: 'Machines',
        items: [],
        subcategories: [
          {
            id: 'cutters',
            slug: 'cutters',
            title: 'Cutters',
            items: [item('manual-machine')]
          }
        ]
      }
    ];

    const selected = selectCatalogRelatedItems(
      categories,
      {
        item: current,
        category: {
          id: 'materials',
          slug: 'materials',
          title: 'Materials'
        },
        subcategory: {
          id: 'metals',
          slug: 'metals',
          title: 'Metals'
        }
      },
      DEFAULT_PRODUCT_APPEARANCE_CONFIG
    );

    expect(selected.map((entry) => entry.item.slug)).toEqual([
      'manual-machine',
      'same-metal',
      'direct-material',
      'same-category-plastic'
    ]);
    expect(selected[0]).toMatchObject({
      category: { slug: 'machines' },
      subcategory: { slug: 'cutters' }
    });
  });

  test('builds href, SKU and price fallbacks from the target context', () => {
    const context = buildCatalogRelatedPresentationContext({
      item: item('laser-cutter'),
      category: {
        id: 'machines',
        slug: 'machines',
        title: 'Machines'
      },
      subcategory: {
        id: 'cutters',
        slug: 'cutters',
        title: 'Cutters'
      }
    });

    expect(context).toMatchObject({
      href: '/products/machines/items/laser-cutter',
      fallbackSku: 'machines-cutters-laser-cutter',
      category: {
        slug: 'machines',
        href: '/products/machines'
      },
      subcategory: {
        slug: 'cutters',
        href: '/products/machines/cutters'
      }
    });
    expect(context.fallbackPrice).toBeGreaterThanOrEqual(0);
  });
});
