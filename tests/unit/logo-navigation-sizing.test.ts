import assert from 'node:assert/strict';
import test from 'node:test';
import { cloneDefaultSiteNavigationConfig, normalizeSiteNavigationConfig } from '@/shared/domain/navigation/siteNavigation';
import { HEADER_LOGO_LINK_PADDING_PX, resizeHeaderLogo, resolveHeaderLogoSize } from '@/shared/domain/logo/logoPlacement';
import { publishedLogoAsset } from './fixtures/published-site-logo';

function normalized(layout: ReturnType<typeof resizeHeaderLogo>, device: 'desktop' | 'tablet' | 'mobile' = 'desktop') {
  const navigation = cloneDefaultSiteNavigationConfig();
  navigation.topBarLayout.responsive[device] = layout;
  return normalizeSiteNavigationConfig(navigation).topBarLayout.responsive[device];
}

test('adopted artwork matches 32 visible pixels across devices and preserves aspect after persistence normalization', () => {
  for (const device of ['desktop', 'tablet', 'mobile'] as const) {
    const before = cloneDefaultSiteNavigationConfig().topBarLayout.responsive[device];
    const asset = publishedLogoAsset('wide', 757, 240);
    const layout = normalized(resizeHeaderLogo(before, asset), device);
    const rendered = resolveHeaderLogoSize(device, layout, asset);
    assert.equal(layout.settings.logoHeightPx, 32);
    assert.equal(layout.settings.logoFit, 'artwork');
    assert.equal(rendered.heightPx, 32);
    assert.ok(Math.abs(rendered.widthPx / rendered.heightPx - asset.width / asset.height) < 1e-12);
    assert.equal(layout.items.find(item => item.id === 'logo')!.widthPx, Math.ceil(32 * asset.width / asset.height + HEADER_LOGO_LINK_PADDING_PX));
    assert.equal(layout.settings.height, before.settings.height);
    assert.deepEqual(layout.items.filter(item => item.id !== 'logo'), normalized(before, device).items.filter(item => item.id !== 'logo'));
  }
});

test('manual height edits shrink and expand the slot without accumulating width or mutating inputs', () => {
  const layout = cloneDefaultSiteNavigationConfig().topBarLayout.responsive.desktop;
  const before = structuredClone(layout);
  const asset = publishedLogoAsset('wide', 800, 100);
  const expanded = resizeHeaderLogo(layout, asset, 40);
  const shrunk = resizeHeaderLogo(expanded, asset, 12);
  assert.equal(expanded.items.find(item => item.id === 'logo')!.widthPx, 328);
  assert.equal(shrunk.items.find(item => item.id === 'logo')!.widthPx, 104);
  assert.equal(resolveHeaderLogoSize('desktop', normalized(shrunk), asset).heightPx, 12);
  assert.deepEqual(layout, before);
  assert.equal(shrunk.items.find(item => item.id === 'cart'), layout.items.find(item => item.id === 'cart'));
  assert.deepEqual({ ...shrunk.settings, logoHeightPx: before.settings.logoHeightPx, logoFit: before.settings.logoFit }, before.settings);
});

test('requested heights follow half-pixel input precision and fit the unchanged header', () => {
  const layout = cloneDefaultSiteNavigationConfig().topBarLayout.responsive.mobile;
  const asset = publishedLogoAsset('square', 200, 200);
  for (const [requested, expected] of [[7, 8], [18.26, 18.5], [64, 34.5], [100, 34.5], [Number.NaN, 32]]) {
    const next = normalized(resizeHeaderLogo(layout, asset, requested), 'mobile');
    assert.equal(next.settings.logoHeightPx, expected);
    assert.equal(resolveHeaderLogoSize('mobile', next, asset).heightPx, expected);
    assert.equal(next.settings.height, layout.settings.height);
  }
});

test('very wide images lower height within both persisted width bounds without hidden fit shrinkage', () => {
  const layout = cloneDefaultSiteNavigationConfig().topBarLayout.responsive.desktop;
  const asset = publishedLogoAsset('wide', 5000, 100);
  const next = normalized(resizeHeaderLogo(layout, asset, 64));
  const item = next.items.find(candidate => candidate.id === 'logo')!;
  assert.equal(next.settings.logoHeightPx, 31.5);
  assert.equal(item.widthPx, 1583);
  assert.equal(item.fixedWidthPx, 1200);
  assert.equal(resolveHeaderLogoSize('desktop', next, asset).heightPx, 31.5);
});

test('centered logos retain the saved anchor and position through repeated growth and shrinkage', () => {
  const layout = cloneDefaultSiteNavigationConfig().topBarLayout.responsive.mobile;
  const logo = layout.items.find(item => item.id === 'logo')!;
  logo.widthPx = 200;
  logo.fixedWidthPx = 200;
  const asset = publishedLogoAsset('wide', 800, 100);
  const small = resizeHeaderLogo(layout, asset, 8);
  const large = resizeHeaderLogo(small, asset, 32);
  for (const next of [small, large]) {
    const item = next.items.find(candidate => candidate.id === 'logo')!;
    assert.equal(item.anchorWidthPx, 200);
    assert.equal(item.xPx, logo.xPx);
    assert.equal(item.xRatio, logo.xRatio);
    assert.equal(item.region, logo.region);
  }
});

test('tall artwork retains the minimum slot while actual image width stays proportional', () => {
  const layout = cloneDefaultSiteNavigationConfig().topBarLayout.responsive.desktop;
  const asset = publishedLogoAsset('tall', 100, 1000);
  const next = resizeHeaderLogo(layout, asset);
  assert.equal(next.items.find(item => item.id === 'logo')!.widthPx, 88);
  const rendered = resolveHeaderLogoSize('desktop', next, asset);
  assert.equal(rendered.heightPx, 32);
  assert.equal(rendered.widthPx, 3.2);
});

test('absent and text-only logos do not alter navigation geometry', () => {
  const layout = cloneDefaultSiteNavigationConfig().topBarLayout.responsive.desktop;
  assert.equal(resizeHeaderLogo(layout, null), layout);
  assert.equal(resizeHeaderLogo(layout, { ...publishedLogoAsset('brand'), fallback: 'brand' }), layout);
  const absent = { ...layout, items: layout.items.filter(item => item.id !== 'logo') };
  assert.equal(resizeHeaderLogo(absent, publishedLogoAsset('logo')), absent);
});

test('extreme aspect ratios keep bounded fitting and invalid asset dimensions leave geometry unchanged', () => {
  const layout = cloneDefaultSiteNavigationConfig().topBarLayout.responsive.desktop;
  const before = structuredClone(layout);
  const asset = publishedLogoAsset('extreme', 8192, 1);
  const next = normalized(resizeHeaderLogo(layout, asset));
  assert.equal(next.settings.logoHeightPx, 8);
  assert.equal(next.items.find(item => item.id === 'logo')!.widthPx, 1600);
  const rendered = resolveHeaderLogoSize('desktop', next, asset);
  assert.ok(rendered.heightPx < 8);
  assert.equal(rendered.widthPx, 1600 - HEADER_LOGO_LINK_PADDING_PX);
  assert.equal(resizeHeaderLogo(layout, publishedLogoAsset('invalid', Number.NaN, 100)), layout);
  assert.deepEqual(layout, before);
});


test('artwork fitting uses visible ink instead of transparent canvas margins on every header profile', () => {
  const asset = { ...publishedLogoAsset('padded-header', 640, 240), bounds: { x: 203, y: 81, width: 217, height: 47 } };
  const beforeAsset = structuredClone(asset);
  for (const device of ['desktop', 'tablet', 'mobile'] as const) {
    const original = cloneDefaultSiteNavigationConfig().topBarLayout.responsive[device];
    const before = structuredClone(original);
    const next = normalized(resizeHeaderLogo(original, asset), device);
    const rendered = resolveHeaderLogoSize(device, next, asset);
    assert.equal(next.settings.logoFit, 'artwork');
    assert.equal(next.settings.logoHeightPx, 32);
    assert.deepEqual(rendered.sourceBounds, asset.bounds);
    assert.equal(rendered.heightPx, 32);
    assert.equal(rendered.artworkBounds.height, 32);
    assert.equal(rendered.artworkBounds.x, 0);
    assert.equal(rendered.artworkBounds.y, 0);
    assert.ok(Math.abs(rendered.widthPx - 32 * 217 / 47) < 1e-10);
    assert.equal(next.items.find(item => item.id === 'logo')!.widthPx, Math.ceil(32 * 217 / 47 + HEADER_LOGO_LINK_PADDING_PX));
    assert.equal(next.settings.height, original.settings.height);
    assert.deepEqual(original, before);
  }
  assert.deepEqual(asset, beforeAsset);
});

test('saved layouts without an artwork fit retain their full canvas and proportional transparent margins', () => {
  const asset = { ...publishedLogoAsset('padded-header', 640, 240), bounds: { x: 203, y: 81, width: 217, height: 47 } };
  const layout = cloneDefaultSiteNavigationConfig().topBarLayout.responsive.desktop;
  layout.settings.logoHeightPx = 32;
  const logo = layout.items.find(item => item.id === 'logo')!;
  logo.widthPx = 200; logo.fixedWidthPx = 200;
  delete layout.settings.logoFit;
  const legacy = normalized(layout);
  const rendered = resolveHeaderLogoSize('desktop', legacy, asset);
  assert.equal(legacy.settings.logoFit, 'canvas');
  assert.deepEqual(rendered.sourceBounds, { x: 0, y: 0, width: 640, height: 240 });
  assert.equal(rendered.heightPx, 32);
  assert.ok(Math.abs(rendered.artworkBounds.height - 47 * 32 / 240) < 1e-10);
  assert.ok(Math.abs(rendered.artworkBounds.x - 203 * 32 / 240) < 1e-10);
  assert.ok(Math.abs(rendered.artworkBounds.y - 81 * 32 / 240) < 1e-10);
  const invalid = { ...layout, settings: { ...layout.settings, logoFit: 'cover' } };
  const navigation = cloneDefaultSiteNavigationConfig();
  assert.equal(normalizeSiteNavigationConfig({ ...navigation, topBarLayout: { ...navigation.topBarLayout, responsive: { ...navigation.topBarLayout.responsive, desktop: invalid } } }).topBarLayout.responsive.desktop.settings.logoFit, 'canvas');
});

test('empty, non-finite or out-of-canvas ink bounds safely fall back to the complete image', () => {
  const layout = cloneDefaultSiteNavigationConfig().topBarLayout.responsive.desktop;
  const invalidBounds = [
    { x: 0, y: 0, width: 0, height: 0 },
    { x: Number.NaN, y: 0, width: 100, height: 40 },
    { x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 40 },
    { x: -1, y: 0, width: 100, height: 40 },
    { x: 0, y: -1, width: 100, height: 40 },
    { x: 200, y: 0, width: 441, height: 40 },
    { x: 0, y: 200, width: 100, height: 41 },
    { x: 0, y: 0, width: 100, height: -1 }
  ];
  for (const bounds of invalidBounds) {
    const asset = { ...publishedLogoAsset('invalid-ink', 640, 240), bounds };
    const next = normalized(resizeHeaderLogo(layout, asset));
    const rendered = resolveHeaderLogoSize('desktop', next, asset);
    assert.deepEqual(rendered.sourceBounds, { x: 0, y: 0, width: 640, height: 240 });
    assert.equal(rendered.heightPx, 32);
    assert.deepEqual(rendered.artworkBounds, { x: 0, y: 0, width: rendered.widthPx, height: rendered.heightPx });
  }
});
