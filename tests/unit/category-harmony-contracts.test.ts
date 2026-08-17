import { expect } from '@playwright/test';
import { describe, test } from 'node:test';
import {
  DEFAULT_HOMEPAGE_SETTINGS,
  orderHomepageCategories,
  resolveHomepageCategoryCardHeight
} from '@/shared/domain/landing/landingPage';
import { DEFAULT_CATEGORY_SHOWCASE_MEDIA_SETTINGS } from '@/shared/features/category-showcase/categoryShowcaseSchema';
import {
  mergeCategoryDataChangeMessages,
  type CategoryDataChangeMessage
} from '@/shared/features/category-showcase/categoryShowcaseSync';

describe('category data harmony', () => {
  test('queued category updates union showcase slugs while catalog refreshes dominate', () => {
    const message = (
      scope: CategoryDataChangeMessage['scope'],
      changedSlugs: string[],
      sentAt: number
    ): CategoryDataChangeMessage => ({
      type: 'category-data-saved',
      scope,
      changedSlugs,
      revision: `revision-${sentAt}`,
      sourceId: `source-${sentAt}`,
      sentAt
    });

    const firstShowcase = message('showcase', ['first'], 1);
    const secondShowcase = message('showcase', ['second', 'first'], 2);
    const mergedShowcase = mergeCategoryDataChangeMessages(
      firstShowcase,
      secondShowcase
    );
    expect(mergedShowcase.scope).toBe('showcase');
    expect(mergedShowcase.changedSlugs).toEqual(['first', 'second']);

    const catalogRefresh = message('catalog', [], 3);
    expect(
      mergeCategoryDataChangeMessages(mergedShowcase, catalogRefresh)
    ).toMatchObject({ scope: 'catalog', changedSlugs: [] });
    expect(
      mergeCategoryDataChangeMessages(catalogRefresh, secondShowcase)
    ).toMatchObject({ scope: 'catalog', changedSlugs: [] });

    expect(resolveHomepageCategoryCardHeight(
      { cardSize: 'medium', cardStyle: 'compact' },
      [{
        presentation: {
          ...DEFAULT_CATEGORY_SHOWCASE_MEDIA_SETTINGS,
          ordinalFontSizePx: 32
        }
      }]
    )).toBe(136);
    expect(resolveHomepageCategoryCardHeight(
      { cardSize: 'medium', cardStyle: 'image-title' },
      [{
        presentation: {
          ...DEFAULT_CATEGORY_SHOWCASE_MEDIA_SETTINGS,
          ordinalFontSizePx: 32
        }
      }]
    )).toBe(168);
  });

  test('homepage category order inherits catalog order until custom ordering is explicit', () => {
    const catalogOrder = [
      { slug: 'first' },
      { slug: 'second' },
      { slug: 'third' }
    ];
    const requestedOrder = ['third', 'first'];

    expect(DEFAULT_HOMEPAGE_SETTINGS.categories.categoryOrderMode).toBe('catalog');
    expect(
      orderHomepageCategories(catalogOrder, {
        categoryOrderMode: 'catalog',
        categoryOrder: requestedOrder
      }).map((category) => category.slug)
    ).toEqual(['first', 'second', 'third']);
    expect(
      orderHomepageCategories(catalogOrder, {
        categoryOrderMode: 'custom',
        categoryOrder: requestedOrder
      }).map((category) => category.slug)
    ).toEqual(['third', 'first', 'second']);
  });
});
