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
  normalizeHomepageFooterSettings,
  resolveHomepageFooterTextAlignment,
  validateLandingPageConfigInput
} from '@/shared/domain/landing/landingPage';
import {
  cloneDefaultSiteNavigationConfig,
  toStoredSiteNavigationConfig
} from '@/shared/domain/navigation/siteNavigation';
import { normalizeSiteLogoConfig } from '@/shared/domain/logo/siteLogo';

const clone = <T>(value: T): T => structuredClone(value);

const hiddenFooterLogoConfig = normalizeSiteLogoConfig({
  placements: {
    'footer-desktop': { enabled: false },
    'footer-tablet': { enabled: false },
    'footer-mobile': { enabled: false }
  }
});

function renderFooter(value: unknown) {
  const settings = normalizeHomepageFooterSettings(value);
  return renderToStaticMarkup(
    createElement(
      SiteLogoProvider,
      { config: hiddenFooterLogoConfig } as Parameters<typeof SiteLogoProvider>[0],
      createElement(SiteFooter, { settings })
    )
  );
}

test('footer alignment normalization is strict, persisted, and legacy-safe', () => {
  const legacy = clone(DEFAULT_HOMEPAGE_SETTINGS.footer) as unknown as Record<string, unknown>;
  delete legacy.descriptionTextAlign;
  delete legacy.copyrightTextAlign;
  const legacyColumns = legacy.columns as Array<Record<string, unknown>>;
  legacyColumns.forEach((column) => {
    delete column.titleTextAlign;
    (column.links as Array<Record<string, unknown>>).forEach((link) => delete link.textAlign);
  });
  delete (legacy.contact as Record<string, unknown>).textAlign;
  (legacy.legalLinks as Array<Record<string, unknown>>).forEach((link) => delete link.textAlign);

  const normalizedLegacy = normalizeHomepageFooterSettings(legacy);
  assert.equal(normalizedLegacy.descriptionTextAlign, 'left');
  assert.equal(normalizedLegacy.copyrightTextAlign, 'left');
  assert.equal(normalizedLegacy.contact.textAlign, 'left');
  assert.ok(normalizedLegacy.columns.every((column) => column.titleTextAlign === 'left'));
  assert.ok(normalizedLegacy.columns.flatMap((column) => column.links).every((link) => link.textAlign === 'left'));
  assert.ok(normalizedLegacy.legalLinks.every((link) => link.textAlign === 'left'));

  assert.equal(resolveHomepageFooterTextAlignment('justify'), 'justify');
  assert.equal(resolveHomepageFooterTextAlignment('justify', 'left', false), 'left');
  assert.equal(resolveHomepageFooterTextAlignment('diagonal', 'right', false), 'right');

  const config = cloneDefaultSiteNavigationConfig();
  config.footer.descriptionTextAlign = 'justify';
  config.footer.copyrightTextAlign = 'center';
  config.footer.contact.textAlign = 'right';
  config.footer.columns[0]!.titleTextAlign = 'center';
  config.footer.columns[0]!.links[0]!.textAlign = 'right';
  config.footer.legalLinks[0]!.textAlign = 'center';
  const stored = toStoredSiteNavigationConfig(config);

  assert.equal(stored.footer.descriptionTextAlign, 'justify');
  assert.equal(stored.footer.copyrightTextAlign, 'center');
  assert.equal(stored.footer.contact.textAlign, 'right');
  assert.equal(stored.footer.columns[0]!.titleTextAlign, 'center');
  assert.equal(stored.footer.columns[0]!.links[0]!.textAlign, 'right');
  assert.equal(stored.footer.legalLinks[0]!.textAlign, 'center');

  const invalid = clone(DEFAULT_HOMEPAGE_SETTINGS) as unknown as Record<string, unknown>;
  const invalidFooter = invalid.footer as Record<string, unknown>;
  invalidFooter.descriptionTextAlign = 'diagonal';
  invalidFooter.copyrightTextAlign = 'diagonal';
  (invalidFooter.contact as Record<string, unknown>).textAlign = 'justify';
  const invalidColumn = (invalidFooter.columns as Array<Record<string, unknown>>)[0]!;
  invalidColumn.titleTextAlign = 'justify';
  ((invalidColumn.links as Array<Record<string, unknown>>)[0]!).textAlign = 'justify';
  ((invalidFooter.legalLinks as Array<Record<string, unknown>>)[0]!).textAlign = 'justify';

  const errors = validateLandingPageConfigInput(invalid);
  assert.ok(errors.some((error) => error.includes('Opis noge - poravnava besedila')));
  assert.ok(errors.some((error) => error.includes('Avtorske pravice - poravnava besedila')));
  assert.ok(errors.some((error) => error.includes('Kontakt v nogi - poravnava besedila')));
  assert.ok(errors.some((error) => error.includes('Stolpec 1 - poravnava naslova')));
  assert.ok(errors.some((error) => error.includes('Stolpec 1, povezava 1 - poravnava besedila')));
  assert.ok(errors.some((error) => error.includes('Pravna povezava 1 - poravnava besedila')));
});

test('the public footer renders each persisted alignment in a meaningful text frame', () => {
  const settings = clone(DEFAULT_HOMEPAGE_SETTINGS.footer);
  settings.descriptionTextAlign = 'justify';
  settings.columns[0]!.titleTextAlign = 'right';
  settings.columns[0]!.links[0]!.textAlign = 'center';
  settings.contact.textAlign = 'right';
  settings.copyrightTextAlign = 'justify';
  settings.legalLinks[0]!.textAlign = 'center';
  settings.legalLinks[1]!.textAlign = 'right';

  const markup = renderFooter(settings);

  assert.match(markup, /site-paragraph[^>]*text-justify[^>]*data-footer-text-align="justify"/u);
  assert.match(markup, /w-full text-\[13px\][^>]*text-right[^>]*data-footer-text-align="right"[^>]*>Izdelki/u);
  assert.match(markup, /site-link block w-full[^>]*text-center[^>]*data-footer-text-align="center"[^>]*>Katalog/u);
  assert.match(markup, /grid min-w-0 grid-cols-\[auto_minmax\(0,1fr\)\][^>]*>[^<]*<svg[^>]*>[\s\S]*?data-footer-text-align="right"/u);
  assert.match(markup, /text-justify min-w-\[16rem\] flex-1[^>]*data-footer-text-align="justify"/u);
  assert.match(markup, /data-footer-alignment-frame="distributed"/u);
  assert.match(markup, /w-full sm:w-auto sm:min-w-\[24rem\]/u);
  assert.match(markup, /site-link transition text-center block w-full[^>]*data-footer-text-align="center"[^>]*>Pogoji uporabe/u);
  assert.match(markup, /site-link transition text-right block w-full[^>]*data-footer-text-align="right"[^>]*>Zasebnost/u);
});

test('all-left legacy rendering keeps the lower-row layout intrinsic and justified between groups', () => {
  const markup = renderFooter(DEFAULT_HOMEPAGE_SETTINGS.footer);

  assert.match(markup, /site-divider flex flex-wrap items-center justify-between/u);
  assert.match(markup, /data-footer-alignment-frame="intrinsic"/u);
  assert.doesNotMatch(markup, /sm:min-w-\[24rem\]/u);
});

test('navigation audit flattening has localized labels for every footer alignment scope', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/shared/server/siteNavigation.ts'),
    'utf8'
  );

  assert.match(source, /descriptionTextAlign: 'Poravnava opisa'/u);
  assert.match(source, /titleTextAlign: 'Poravnava naslova'/u);
  assert.match(source, /textAlign: 'Poravnava besedila'/u);
  assert.match(source, /copyrightTextAlign: 'Poravnava avtorskih pravic'/u);
  assert.match(source, /left: 'Levo'[\s\S]*center: 'Sredinsko'[\s\S]*right: 'Desno'[\s\S]*justify: 'Obojestransko'/u);
  assert.match(source, /titleTextAlign: column\.titleTextAlign/u);
  assert.match(source, /textAlign: footer\.contact\.textAlign/u);
  assert.match(source, /descriptionTextAlign: footer\.descriptionTextAlign/u);
  assert.match(source, /copyrightTextAlign: footer\.copyrightTextAlign/u);
});
