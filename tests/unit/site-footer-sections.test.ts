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
import {
  cloneDefaultSiteNavigationConfig,
  toStoredSiteNavigationConfig
} from '@/shared/domain/navigation/siteNavigation';
import { normalizeSiteLogoConfig } from '@/shared/domain/logo/siteLogo';

const clone = <T>(value: T): T => structuredClone(value);

const sectionTestLogoConfig = normalizeSiteLogoConfig({
  placements: {
    'footer-desktop': { enabled: false },
    'footer-tablet': { enabled: false },
    'footer-mobile': { enabled: false }
  }
});

function renderFooter(
  patch: Partial<typeof DEFAULT_HOMEPAGE_SETTINGS.footer> = {}
) {
  const settings = normalizeHomepageFooterSettings({
    ...clone(DEFAULT_HOMEPAGE_SETTINGS.footer),
    ...patch
  });

  return renderToStaticMarkup(
    createElement(
      SiteLogoProvider,
      { config: sectionTestLogoConfig } as Parameters<typeof SiteLogoProvider>[0],
      createElement(SiteFooter, { settings })
    )
  );
}

test('legacy footer settings keep both sections and the lower contact fallback available', () => {
  const legacy = clone(DEFAULT_HOMEPAGE_SETTINGS.footer) as unknown as Record<string, unknown>;
  delete legacy.upperSectionVisible;
  delete legacy.lowerSectionVisible;
  delete legacy.lowerContactVisible;

  const normalized = normalizeHomepageFooterSettings(legacy);

  assert.equal(normalized.upperSectionVisible, true);
  assert.equal(normalized.lowerSectionVisible, true);
  assert.equal(normalized.lowerContactVisible, true);
});

test('explicit footer section visibility survives navigation storage normalization', () => {
  const config = cloneDefaultSiteNavigationConfig();
  config.footer = normalizeHomepageFooterSettings({
    ...config.footer,
    upperSectionVisible: false,
    lowerSectionVisible: true,
    lowerContactVisible: false
  });

  const stored = toStoredSiteNavigationConfig(config);

  assert.equal(stored.footer.upperSectionVisible, false);
  assert.equal(stored.footer.lowerSectionVisible, true);
  assert.equal(stored.footer.lowerContactVisible, false);
});

test('the public footer independently renders its upper and lower sections', () => {
  const bothSections = renderFooter({
    upperSectionVisible: true,
    lowerSectionVisible: true,
    lowerContactVisible: true
  });
  assert.match(bothSections, /data-testid="site-footer-upper-section"/u);
  assert.match(bothSections, /data-testid="site-footer-lower-section"/u);
  assert.doesNotMatch(bothSections, /data-testid="site-footer-lower-contact"/u);

  const upperOnly = renderFooter({
    upperSectionVisible: true,
    lowerSectionVisible: false,
    lowerContactVisible: true
  });
  assert.match(upperOnly, /data-testid="site-footer-upper-section"/u);
  assert.doesNotMatch(upperOnly, /data-testid="site-footer-lower-section"/u);
  assert.doesNotMatch(upperOnly, /data-testid="site-footer-lower-contact"/u);

  const lowerOnly = renderFooter({
    upperSectionVisible: false,
    lowerSectionVisible: true,
    lowerContactVisible: false
  });
  assert.doesNotMatch(lowerOnly, /data-testid="site-footer-upper-section"/u);
  assert.match(lowerOnly, /data-testid="site-footer-lower-section"/u);
  assert.doesNotMatch(lowerOnly, /data-testid="site-footer-lower-contact"/u);

  const noSections = renderFooter({
    upperSectionVisible: false,
    lowerSectionVisible: false,
    lowerContactVisible: true
  });
  assert.equal(noSections, '');
});

test('the editable contact data moves to a horizontal lower fallback only when requested', () => {
  const lowerContact = renderFooter({
    upperSectionVisible: false,
    lowerSectionVisible: true,
    lowerContactVisible: true,
    contact: {
      email: 'footer-regression@example.test',
      phone: '+386 1 555 01 02',
      address: 'Testna ulica 3',
      workingHours: 'Pon–Pet 9.00–17.00',
      textAlign: 'left'
    }
  });

  assert.match(lowerContact, /data-testid="site-footer-lower-contact"/u);
  assert.match(lowerContact, /data-footer-contact-layout="horizontal"/u);
  for (const value of [
    'footer-regression@example.test',
    '+386 1 555 01 02',
    'Testna ulica 3',
    'Pon–Pet 9.00–17.00'
  ]) {
    assert.match(lowerContact, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }

  const noLowerSection = renderFooter({
    upperSectionVisible: false,
    lowerSectionVisible: false,
    lowerContactVisible: true
  });
  assert.doesNotMatch(noLowerSection, /data-testid="site-footer-lower-contact"/u);

  const contactAlreadyAbove = renderFooter({
    upperSectionVisible: true,
    lowerSectionVisible: true,
    lowerContactVisible: true
  });
  assert.doesNotMatch(contactAlreadyAbove, /data-testid="site-footer-lower-contact"/u);
});

test('the public lower footer keeps contact and legal content left while copyright owns the responsive right slot', () => {
  const legalLinks = clone(DEFAULT_HOMEPAGE_SETTINGS.footer.legalLinks).map((link, index) => ({
    ...link,
    textAlign: index === 0 ? 'right' as const : link.textAlign
  }));
  const markup = renderFooter({
    upperSectionVisible: false,
    lowerSectionVisible: true,
    lowerContactVisible: true,
    copyrightTextAlign: 'center',
    legalLinks
  });

  assert.match(markup, /data-footer-lower-layout="responsive-split"/u);
  assert.match(
    markup,
    /class="flex min-w-0 basis-full flex-wrap items-center gap-x-5 gap-y-3 lg:basis-0 lg:flex-1" data-footer-lower-leading="true"/u
  );
  assert.match(
    markup,
    /class="min-w-0 basis-full lg:ml-auto lg:basis-auto lg:shrink-0 lg:whitespace-nowrap" data-footer-lower-copyright="right"/u
  );

  const leadingIndex = markup.indexOf('data-footer-lower-leading="true"');
  const contactIndex = markup.indexOf('data-testid="site-footer-lower-contact"');
  const legalIndex = markup.indexOf('aria-label="Pravne povezave"');
  const copyrightSlotIndex = markup.indexOf('data-footer-lower-copyright="right"');
  const centeredCopyrightIndex = markup.indexOf('data-footer-text-align="center"', copyrightSlotIndex);

  assert.ok(leadingIndex >= 0);
  assert.ok(contactIndex > leadingIndex);
  assert.ok(legalIndex > contactIndex);
  assert.ok(copyrightSlotIndex > legalIndex);
  assert.ok(centeredCopyrightIndex > copyrightSlotIndex);
});

test('the footer uses the shared responsive logo placement instead of the legacy logo renderer', () => {
  const logoConfig = normalizeSiteLogoConfig({
    masters: [
      {
        id: 'footer-regression-logo',
        label: 'Footer regression logo',
        kind: 'lockup',
        tone: 'default',
        url: '/footer-regression-logo.svg',
        pathname: 'footer-regression-logo.svg',
        filename: 'footer-regression-logo.svg',
        mimeType: 'image/svg+xml',
        size: 128,
        intrinsicWidth: 320,
        intrinsicHeight: 96,
        opticalBounds: { x: 0, y: 0, width: 1, height: 1 }
      }
    ],
    placements: {
      'footer-desktop': {
        enabled: true,
        masterId: 'footer-regression-logo'
      }
    }
  });
  const settings = normalizeHomepageFooterSettings({
    ...DEFAULT_HOMEPAGE_SETTINGS.footer,
    logoMode: 'hidden'
  });
  const markup = renderToStaticMarkup(
    createElement(
      SiteLogoProvider,
      { config: logoConfig } as Parameters<typeof SiteLogoProvider>[0],
      createElement(SiteFooter, { settings })
    )
  );

  assert.match(markup, /data-site-logo-purpose="footer-desktop"/u);
  assert.match(markup, /data-site-logo-master="footer-regression-logo"/u);

  const source = readFileSync(
    resolve(process.cwd(), 'src/commercial/components/SiteFooter.tsx'),
    'utf8'
  );
  assert.match(source, /<ResponsiveSiteLogo\b/u);
  assert.doesNotMatch(source, /import AtehnaLogo from/u);
  assert.doesNotMatch(source, /logoMode\s*===\s*['"]hidden['"]/u);
});
