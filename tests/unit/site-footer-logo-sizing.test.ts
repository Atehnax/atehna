import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SiteFooter, { renderSiteFooterLogo } from '@/commercial/components/SiteFooter';
import { SiteLogoProvider } from '@/commercial/components/SiteLogo';
import { DEFAULT_HOMEPAGE_SETTINGS, normalizeHomepageFooterSettings, type HomepageFooterSettings } from '@/shared/domain/landing/landingPage';
import { type PublishedSiteLogoConfig } from '@/shared/domain/logo/logoLibrary';
import { publishedLogoAsset, publishedLogoFixture } from './fixtures/published-site-logo';

const devices = ['desktop', 'tablet', 'mobile'] as const;
type Device = typeof devices[number];
function render(settings: HomepageFooterSettings, config: PublishedSiteLogoConfig, device?: Device) {
  return renderToStaticMarkup(createElement(SiteLogoProvider, { config, previewDevice: device } as Parameters<typeof SiteLogoProvider>[0], createElement(SiteFooter, { settings, previewDevice: device })));
}
function logoTag(html: string, device: Device) {
  const tag = html.match(new RegExp('<span[^>]*data-site-logo-purpose="footer-' + device + '"[^>]*>'))?.[0];
  assert.ok(tag, `Missing ${device} published logo`);
  return tag;
}
function style(tag: string) {
  return Object.fromEntries((tag.match(/style="([^"]*)"/u)?.[1] ?? '').split(';').filter(Boolean).map(value => {
    const separator = value.indexOf(':');
    return [value.slice(0, separator), value.slice(separator + 1)];
  }));
}
const assets = publishedLogoFixture({
  'footer-desktop': publishedLogoAsset('wide', 600, 150),
  'footer-tablet': publishedLogoAsset('tall', 100, 200),
  'footer-mobile': publishedLogoAsset('original', 1873, 840)
});

test('footer profiles without a saved height retain all three original fixed logo boxes', () => {
  const settings = structuredClone(DEFAULT_HOMEPAGE_SETTINGS.footer);
  for (const [device, width] of [['desktop', 126], ['tablet', 123], ['mobile', 120]] as const) {
    const html = render(settings, assets, device);
    const tag = logoTag(html, device);
    assert.ok(tag.includes(`h-10 w-[${width}px]`));
    assert.doesNotMatch(tag, /data-logo-max-height|style=/u);
  }
});

test('saved heights resolve each selected published aspect ratio and leave untouched device defaults intact', () => {
  const settings = structuredClone(DEFAULT_HOMEPAGE_SETTINGS.footer);
  settings.responsive.desktop.logoHeightPx = 12.5;
  settings.responsive.tablet.logoHeightPx = 64;
  const saved = normalizeHomepageFooterSettings(settings);
  const before = structuredClone(saved);
  for (const [device, height, width, ratio] of [['desktop', 12.5, 50, '600 / 150'], ['tablet', 64, 32, '100 / 200']] as const) {
    const html = render(saved, assets, device);
    const tag = logoTag(html, device);
    assert.ok(tag.includes(`data-logo-max-height="${height}"`));
    assert.deepEqual(style(tag), { width: `${width}px`, height: 'auto', 'max-width': '100%', 'aspect-ratio': ratio });
    assert.match(html, /<img[^>]*style="height:auto"[^>]*data-site-logo-published-image/u);
  }
  assert.doesNotMatch(logoTag(render(saved, assets, 'mobile'), 'mobile'), /data-logo-max-height|style=/u);
  assert.deepEqual(saved, before);
  assert.equal(logoTag(render(saved, assets), 'desktop'), logoTag(render(saved, assets, 'desktop'), 'desktop'));
});

test('large logos use a capped proportional window rather than a fixed height that would squeeze narrow columns', () => {
  const settings = structuredClone(DEFAULT_HOMEPAGE_SETTINGS.footer);
  settings.responsive.desktop.logoHeightPx = 160;
  const config = publishedLogoFixture({ 'footer-desktop': publishedLogoAsset('panorama', 1200, 100) });
  const html = render(settings, config, 'desktop');
  assert.deepEqual(style(logoTag(html, 'desktop')), { width: '1920px', height: 'auto', 'max-width': '100%', 'aspect-ratio': '1200 / 100' });
  assert.match(html, /aria-label="Atehna domov" class="inline-flex max-w-full"/u);
  assert.match(html, /<img[^>]*width="1200" height="100"[^>]*style="height:auto"/u);
});

test('explicit brand height scales the original brand while missing logo assignments stay invisible', () => {
  const settings = structuredClone(DEFAULT_HOMEPAGE_SETTINGS.footer);
  const brand = { ...publishedLogoAsset('brand', 130, 30), variantId: null, fallback: 'brand' as const, pngUrl: '', svgUrl: null };
  const config = publishedLogoFixture({ 'footer-desktop': brand });
  const originalBrand = render(settings, config, 'desktop');
  assert.doesNotMatch(originalBrand, /data-logo-max-height|transform:scale/u);
  settings.responsive.desktop.logoHeightPx = 60;
  const sizedBrand = render(settings, config, 'desktop');
  assert.deepEqual(style(logoTag(sizedBrand, 'desktop')), { width: '260px', height: 'auto', 'max-width': '100%', 'aspect-ratio': '130 / 30' });
  assert.match(sizedBrand, /width:130px;height:30px;transform:scale\(2\);transform-origin:top left/u);
  assert.match(sizedBrand, /Atehna/u);
  assert.doesNotMatch(render(settings, publishedLogoFixture(), 'desktop'), /data-site-logo-purpose|data-logo-max-height/u);
  assert.equal(render({ ...settings, visible: false }, config, 'desktop'), '');
});

test('fluid homepage footer rendering keeps its canvas frame even when a footer height is configured', () => {
  const settings = structuredClone(DEFAULT_HOMEPAGE_SETTINGS.footer);
  for (const device of devices) settings.responsive[device].logoHeightPx = 96;
  const html = renderToStaticMarkup(createElement(SiteLogoProvider, { config: assets } as Parameters<typeof SiteLogoProvider>[0], renderSiteFooterLogo(settings, settings.logoMode, true)));
  const tag = logoTag(html, 'desktop');
  assert.match(tag, /h-full w-full/u);
  assert.doesNotMatch(tag, /data-logo-max-height|style=|h-10/u);
});
