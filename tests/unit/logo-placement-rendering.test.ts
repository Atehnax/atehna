import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SiteLogo, SiteLogoProvider } from '@/commercial/components/SiteLogo';
import SiteFooter from '@/commercial/components/SiteFooter';
import { DEFAULT_HOMEPAGE_SETTINGS } from '@/shared/domain/landing/landingPage';
import { cloneDefaultSiteNavigationConfig, normalizeSiteNavigationConfig } from '@/shared/domain/navigation/siteNavigation';
import { HEADER_LOGO_DEFAULT_HEIGHTS, migrateLogoNavigationConstraints, resolveHeaderLogoSize } from '@/shared/domain/logo/logoPlacement';
import { publishedLogoAsset, publishedLogoFixture } from './fixtures/published-site-logo';

test('every header profile contains very wide and tall artwork without changing its navigation geometry', () => {
  const navigation = cloneDefaultSiteNavigationConfig();
  const before = structuredClone(navigation);
  for (const device of ['desktop', 'tablet', 'mobile'] as const) {
    const layout = navigation.topBarLayout.responsive[device];
    for (const [width, height] of [[2000, 80], [80, 2000], [600, 240]]) {
      const asset = publishedLogoAsset('shape', width, height);
      const fitted = resolveHeaderLogoSize(device, layout, asset);
      assert.ok(fitted.widthPx <= fitted.areaWidthPx);
      assert.ok(fitted.heightPx <= fitted.areaHeightPx);
      assert.ok(fitted.heightPx <= HEADER_LOGO_DEFAULT_HEIGHTS[device]);
      assert.equal(fitted.areaHeightPx, HEADER_LOGO_DEFAULT_HEIGHTS[device], 'Fit-to-placement area must honor the navigation maximum logo height');
      assert.ok(Math.abs(fitted.widthPx / fitted.heightPx - width / height) < 1e-9);
    }
  }
  assert.deepEqual(navigation, before);
});

test('transparent margins remain part of the artwork and do not get trimmed by placement fitting', () => {
  const layout = cloneDefaultSiteNavigationConfig().topBarLayout.responsive.desktop;
  const asset = { ...publishedLogoAsset('with-margin', 600, 240), bounds: { x: 60, y: 24, width: 480, height: 192 } };
  const fitted = resolveHeaderLogoSize('desktop', layout, asset);
  assert.ok(Math.abs(fitted.artworkBounds.x / fitted.widthPx - .1) < 1e-9);
  assert.ok(Math.abs(fitted.artworkBounds.y / fitted.heightPx - .1) < 1e-9);
  assert.ok(Math.abs(fitted.artworkBounds.width / fitted.widthPx - .8) < 1e-9);
});

test('explicit navigation height is capped by the existing header and raster upscaling is identified', () => {
  const layout = cloneDefaultSiteNavigationConfig().topBarLayout.responsive.mobile;
  layout.settings.logoHeightPx = 64;
  const raster = { ...publishedLogoAsset('tiny', 8, 8), svgUrl: null };
  const fitted = resolveHeaderLogoSize('mobile', layout, raster);
  assert.equal(fitted.heightPx, layout.settings.height * .75 - 7.5);
  assert.equal(fitted.rasterUpscaled, true);
  assert.equal(resolveHeaderLogoSize('mobile', layout, { ...raster, svgUrl: '/tiny.svg' }).rasterUpscaled, false);
});

test('migration moves previous logo sizes into navigation and preserves centered expansion anchors', () => {
  const original = normalizeSiteNavigationConfig(cloneDefaultSiteNavigationConfig());
  const mobileBefore = original.topBarLayout.responsive.mobile.items.find(item => item.id === 'logo')!;
  const oldLogo = { placements: { 'header-desktop': { displayHeightPx: 30 }, 'header-mobile': { displayHeightPx: 60 }, standalone: { displayHeightPx: 64 } } };
  const migrated = migrateLogoNavigationConstraints(original, oldLogo);
  assert.equal(migrated.topBarLayout.responsive.desktop.settings.logoHeightPx, 30);
  assert.equal(migrated.topBarLayout.responsive.tablet.settings.logoHeightPx, 16.5);
  assert.equal(migrated.topBarLayout.responsive.mobile.settings.logoHeightPx, 60);
  assert.equal(migrated.topBarInitialLayout.responsive.mobile.settings.logoHeightPx, 60);
  for (const device of ['desktop', 'tablet', 'mobile'] as const) {
    assert.equal(migrated.topBarLayout.responsive[device].settings.height, original.topBarLayout.responsive[device].settings.height);
    assert.deepEqual(migrated.topBarLayout.responsive[device].items.filter(item => item.id !== 'logo'), original.topBarLayout.responsive[device].items.filter(item => item.id !== 'logo'));
  }
  const mobile = migrated.topBarLayout.responsive.mobile.items.find(item => item.id === 'logo')!;
  assert.equal(mobile.widthPx, 175.5);
  assert.equal(mobile.anchorWidthPx, 88);
  assert.equal(mobile.xRatio, mobileBefore.xRatio);
  assert.equal(mobile.xPx, mobileBefore.xPx);
  assert.equal(normalizeSiteNavigationConfig(migrated).topBarLayout.responsive.mobile.items.find(item => item.id === 'logo')!.anchorWidthPx, 88);
  assert.equal(original.topBarLayout.responsive.mobile.settings.logoHeightPx, 15);
});

test('one published variant can serve several placements while null and brand fallbacks remain explicit', () => {
  const asset = publishedLogoAsset('shared');
  const config = publishedLogoFixture({ 'header-desktop': asset, 'footer-desktop': asset, 'header-mobile': { ...asset, variantId: null, fallback: 'brand' } });
  const html = renderToStaticMarkup(createElement(SiteLogoProvider, { config } as Parameters<typeof SiteLogoProvider>[0],
    createElement('div', null,
      createElement(SiteLogo, { purposeId: 'header-desktop', alt: 'Atehna' }),
      createElement(SiteLogo, { purposeId: 'footer-desktop', alt: 'Atehna' }),
      createElement(SiteLogo, { purposeId: 'header-tablet', alt: 'Atehna' }),
      createElement(SiteLogo, { purposeId: 'header-mobile', fallback: createElement('span', null, 'Existing brand') })
    )));
  assert.equal((html.match(/data-site-logo-variant="shared"/g) ?? []).length, 2);
  assert.match(html, /src="\/shared.svg"/);
  assert.match(html, /object-contain/);
  assert.doesNotMatch(html, /data-site-logo-purpose="header-tablet"/);
  assert.match(html, /Existing brand/);
  assert.doesNotMatch(html, /draftRevision|layers|assetId/);
});

test('the actual footer renderer honors distinct published desktop, tablet and mobile assignments', () => {
  const config = publishedLogoFixture({
    'footer-desktop': publishedLogoAsset('wide'), 'footer-tablet': publishedLogoAsset('medium'), 'footer-mobile': publishedLogoAsset('symbol')
  });
  for (const [device, id] of [['desktop', 'wide'], ['tablet', 'medium'], ['mobile', 'symbol']] as const) {
    const html = renderToStaticMarkup(createElement(SiteLogoProvider, { config, previewDevice: device } as Parameters<typeof SiteLogoProvider>[0],
      createElement(SiteFooter, { settings: DEFAULT_HOMEPAGE_SETTINGS.footer })));
    assert.match(html, new RegExp('data-site-logo-purpose="footer-' + device + '"'));
    assert.match(html, new RegExp('data-site-logo-variant="' + id + '"'));
  }
});
