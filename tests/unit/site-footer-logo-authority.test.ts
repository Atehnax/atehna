import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SiteFooter from '@/commercial/components/SiteFooter';
import { SiteLogoProvider } from '@/commercial/components/SiteLogo';
import { DEFAULT_HOMEPAGE_SETTINGS, normalizeHomepageFooterSettings } from '@/shared/domain/landing/landingPage';
import { publishedLogoAsset, publishedLogoFixture } from './fixtures/published-site-logo';

function renderWithLogoConfig(enabled: boolean) {
  const settings = normalizeHomepageFooterSettings({ ...structuredClone(DEFAULT_HOMEPAGE_SETTINGS.footer), logoMode: 'hidden' });
  const config = publishedLogoFixture({ 'footer-desktop': enabled ? publishedLogoAsset('authoritative-footer-logo') : null });
  return renderToStaticMarkup(createElement(SiteLogoProvider, { config } as Parameters<typeof SiteLogoProvider>[0], createElement(SiteFooter, { settings })));
}
test('the published footer assignment is the only logo visibility authority', () => {
  assert.match(renderWithLogoConfig(true), /data-site-logo-variant="authoritative-footer-logo"/);
  assert.doesNotMatch(renderWithLogoConfig(false), /data-site-logo-purpose="footer-desktop"/);
});
