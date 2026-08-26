import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SiteFooter from '@/commercial/components/SiteFooter';
import { SiteLogoProvider } from '@/commercial/components/SiteLogo';
import {
  DEFAULT_HOMEPAGE_SETTINGS,
  normalizeHomepageFooterSettings
} from '@/shared/domain/landing/landingPage';
import { normalizeSiteLogoConfig } from '@/shared/domain/logo/siteLogo';

const customMaster = {
  id: 'authoritative-footer-logo',
  label: 'Authoritative footer logo',
  kind: 'lockup',
  tone: 'default',
  url: '/authoritative-footer-logo.svg',
  pathname: 'authoritative-footer-logo.svg',
  filename: 'authoritative-footer-logo.svg',
  mimeType: 'image/svg+xml',
  size: 128,
  intrinsicWidth: 320,
  intrinsicHeight: 96,
  opticalBounds: { x: 0, y: 0, width: 1, height: 1 }
};

function renderWithLogoConfig(enabled: boolean) {
  const settings = normalizeHomepageFooterSettings({
    ...structuredClone(DEFAULT_HOMEPAGE_SETTINGS.footer),
    logoMode: 'hidden'
  });
  const config = normalizeSiteLogoConfig({
    masters: [customMaster],
    placements: {
      'footer-desktop': {
        enabled,
        masterId: customMaster.id
      }
    }
  });

  return renderToStaticMarkup(
    createElement(
      SiteLogoProvider,
      { config } as Parameters<typeof SiteLogoProvider>[0],
      createElement(SiteFooter, { settings })
    )
  );
}

test('the shared footer placement overrides a legacy hidden logoMode value', () => {
  const markup = renderWithLogoConfig(true);

  assert.match(markup, /data-site-logo-purpose="footer-desktop"/u);
  assert.match(markup, /data-site-logo-master="authoritative-footer-logo"/u);
});

test('the shared footer placement enabled flag remains authoritative', () => {
  const markup = renderWithLogoConfig(false);

  assert.doesNotMatch(markup, /data-site-logo-purpose="footer-desktop"/u);
  assert.doesNotMatch(markup, /data-site-logo-master="authoritative-footer-logo"/u);
});

test('the footer renderer no longer gates shared output on legacy logoMode', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/commercial/components/SiteFooter.tsx'),
    'utf8'
  );

  assert.doesNotMatch(source, /logoMode === 'hidden'/u);
});
