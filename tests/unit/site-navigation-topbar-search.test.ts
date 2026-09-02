import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_SITE_NAVIGATION_TOP_BAR_LAYOUT,
  SITE_NAVIGATION_TOP_BAR_SEARCH_COLLAPSED_WIDTH_PX,
  getSiteNavigationTopBarReservedFixedWidth,
  normalizeSiteNavigationTopBarResponsiveLayouts,
  type SiteNavigationTopBarDevice
} from '../../src/shared/domain/navigation/siteNavigation';

const legacySearchCases: Array<{
  device: Exclude<SiteNavigationTopBarDevice, 'mobile'>;
  boundsWidth: number;
  expandedWidth: number;
  cartLeft: number;
}> = [
  {
    device: 'desktop',
    boundsWidth: 1216,
    expandedWidth: 320,
    cartLeft: 1184
  },
  {
    device: 'tablet',
    boundsWidth: 720,
    expandedWidth: 240,
    cartLeft: 688
  }
];

test('legacy Search fields migrate to movable 32px icons without moving their right edge', () => {
  const legacyLayouts = structuredClone(
    DEFAULT_SITE_NAVIGATION_TOP_BAR_LAYOUT.responsive
  );

  legacySearchCases.forEach(({ device, boundsWidth, expandedWidth, cartLeft }) => {
    const layout = legacyLayouts[device];
    const search = layout.items.find((item) => item.id === 'search');
    assert.ok(search);

    layout.settings.searchMode = 'field';
    search.widthMode = 'fixed';
    search.fixedWidthPx = expandedWidth;
    search.widthPx = expandedWidth;
    search.widthEditable = true;
    search.xPx = 17;
    search.xRatio = (cartLeft - expandedWidth) / boundsWidth;
  });

  const normalized = normalizeSiteNavigationTopBarResponsiveLayouts(legacyLayouts);

  legacySearchCases.forEach(({ device, boundsWidth, cartLeft }) => {
    const layout = normalized[device];
    const search = layout.items.find((item) => item.id === 'search');
    const cart = layout.items.find((item) => item.id === 'cart');
    assert.ok(search);
    assert.ok(cart);

    const expectedSearchLeft = cartLeft - SITE_NAVIGATION_TOP_BAR_SEARCH_COLLAPSED_WIDTH_PX;
    assert.equal(layout.settings.searchMode, 'icon');
    assert.equal(search.widthMode, 'fixed');
    assert.equal(search.fixedWidthPx, SITE_NAVIGATION_TOP_BAR_SEARCH_COLLAPSED_WIDTH_PX);
    assert.equal(search.widthPx, SITE_NAVIGATION_TOP_BAR_SEARCH_COLLAPSED_WIDTH_PX);
    assert.equal(search.widthEditable, false);
    assert.equal(search.xPx, expectedSearchLeft);
    assert.ok(Math.abs(search.xRatio - expectedSearchLeft / boundsWidth) <= 0.0001);
    assert.equal(search.xPx + search.widthPx, cart.xPx);
    assert.equal(getSiteNavigationTopBarReservedFixedWidth(search), 32);
  });

  assert.deepEqual(
    normalizeSiteNavigationTopBarResponsiveLayouts(normalized),
    normalized
  );
  assert.equal(normalized.mobile.settings.searchMode, 'menu');
});
