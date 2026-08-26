import { expect } from '@playwright/test';
import { describe, test } from 'node:test';

import { sortTopBarTableItemsByResolvedX } from '../../src/admin/features/podoba/lib/topBarTableOrder';
import { DEFAULT_SITE_NAVIGATION_TOP_BAR_LAYOUT } from '../../src/shared/domain/navigation/siteNavigation';

describe('navigation top-bar element table order', () => {
  test('uses resolved storefront X coordinates without mutating persisted items or IDs', () => {
    const desktopItems = DEFAULT_SITE_NAVIGATION_TOP_BAR_LAYOUT.responsive.desktop.items;
    const search = desktopItems.find((item) => item.id === 'search');
    const cart = desktopItems.find((item) => item.id === 'cart');
    if (!search || !cart) throw new Error('Expected Search and Cart default placements.');

    // Reproduce the legacy raw order: Cart has the smaller stored X, while edgeRight
    // resolution places it to the right of Search in the rendered header.
    const persistedItems = [cart, search];
    const sortedItems = sortTopBarTableItemsByResolvedX(persistedItems, {
      search: 1407,
      cart: 1452
    });

    expect(sortedItems.map((item) => item.id)).toEqual(['search', 'cart']);
    expect(persistedItems.map((item) => item.id)).toEqual(['cart', 'search']);
    expect(sortedItems[0]).toBe(search);
    expect(sortedItems[1]).toBe(cart);
  });

  test('uses z-index and original order as stable tie-breakers', () => {
    const items = DEFAULT_SITE_NAVIGATION_TOP_BAR_LAYOUT.responsive.desktop.items;
    const search = items.find((item) => item.id === 'search');
    const ai = items.find((item) => item.id === 'ai');
    const cart = items.find((item) => item.id === 'cart');
    if (!search || !ai || !cart) throw new Error('Expected desktop action placements.');

    const tiedItems = [cart, ai, search].map((item) => ({ ...item, zIndex: 3 }));
    const sortedItems = sortTopBarTableItemsByResolvedX(tiedItems, {
      cart: 1400,
      ai: 1400,
      search: 1400
    });

    expect(sortedItems.map((item) => item.id)).toEqual(['cart', 'ai', 'search']);
  });
});
