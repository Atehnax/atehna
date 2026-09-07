import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SiteFooter, { type SiteFooterProps } from '@/commercial/components/SiteFooter';
import { SiteLogoProvider } from '@/commercial/components/SiteLogo';
import { DEFAULT_HOMEPAGE_SETTINGS, normalizeHomepageFooterSettings, type HomepageFooterSettings } from '@/shared/domain/landing/landingPage';
import { publishedLogoFixture } from './fixtures/published-site-logo';

function settings(): HomepageFooterSettings {
  const value = structuredClone(DEFAULT_HOMEPAGE_SETTINGS.footer);
  value.responsive = {
    desktop: { layoutColumns: 5, spacing: 'large', topBorder: false },
    tablet: { layoutColumns: 3, spacing: 'medium', topBorder: true },
    mobile: { layoutColumns: 1, spacing: 'compact', topBorder: false }
  };
  value.legalLinks[0].textAlign = 'right';
  return normalizeHomepageFooterSettings(value);
}
function render(value: HomepageFooterSettings, props: Omit<SiteFooterProps, 'settings'> = {}) {
  return renderToStaticMarkup(createElement(SiteLogoProvider, { config: publishedLogoFixture() } as Parameters<typeof SiteLogoProvider>[0], createElement(SiteFooter, { settings: value, ...props })));
}
function classes(html: string, marker: string) {
  const tag = html.match(new RegExp('<[a-z][^>]*' + marker + '[^>]*>'))?.[0];
  assert.ok(tag, `Missing rendered node: ${marker}`);
  const value = tag.match(/class="([^"]*)"/u)?.[1];
  assert.ok(value, `Missing classes on ${marker}`);
  return value.split(' ');
}

for (const device of ['desktop', 'tablet', 'mobile'] as const) {
  test(`forced ${device} footer uses only its saved responsive profile independently of host breakpoints`, () => {
    const value = settings(), before = structuredClone(value);
    const html = render(value, { previewDevice: device });
    const profile = value.responsive[device];
    const footer = classes(html, `data-footer-preview-device="${device}"`);
    assert.ok(footer.includes(profile.topBorder ? 'border-t' : 'border-t-0'));
    assert.ok(classes(html, 'class="site-container ').includes({ compact: 'py-6', medium: 'py-8', large: 'py-12' }[profile.spacing]));
    assert.ok(classes(html, 'aria-label="Povezave v nogi"').includes(`grid-cols-${profile.layoutColumns}`));
    assert.doesNotMatch(html, /\b(?:sm|md|lg|xl):/u);
    const upper = html.match(/data-testid="site-footer-upper-section"><div class="([^"]*)"/u)?.[1];
    assert.ok(upper);
    assert.ok(upper.includes(device === 'desktop' ? 'grid-cols-[minmax(180px,1fr)' : 'grid-cols-1'));
    const leading = classes(html, 'data-footer-lower-leading="true"');
    const copyright = classes(html, 'data-footer-lower-copyright="right"');
    assert.ok(leading.includes(device === 'desktop' ? 'basis-0' : 'basis-full'));
    assert.ok(copyright.includes(device === 'desktop' ? 'basis-auto' : 'basis-full'));
    assert.equal(copyright.includes('ml-auto'), device === 'desktop');
    const legal = classes(html, 'aria-label="Pravne povezave"');
    assert.ok(legal.includes(device === 'mobile' ? 'w-full' : 'w-auto'));
    assert.equal(legal.includes('min-w-[24rem]'), device !== 'mobile');
    assert.deepEqual(value, before);
  });
}

test('omitted footer preview device retains the established public responsive classes', () => {
  const value = settings();
  const html = render(value);
  assert.equal(render(value, { previewDevice: undefined }), html);
  assert.doesNotMatch(html, /data-footer-preview-device/u);
  assert.deepEqual(classes(html, 'aria-label="Povezave v nogi"'), ['grid', 'gap-6', 'grid-cols-1', 'sm:grid-cols-3', 'lg:grid-cols-5']);
  assert.deepEqual(classes(html, 'class="site-container '), ['site-container', 'py-6', 'sm:py-8', 'lg:py-12']);
  assert.deepEqual(classes(html, 'data-footer-lower-leading="true"'), ['flex', 'min-w-0', 'basis-full', 'flex-wrap', 'items-center', 'gap-x-5', 'gap-y-3', 'lg:basis-0', 'lg:flex-1']);
  assert.deepEqual(classes(html, 'data-footer-lower-copyright="right"'), ['min-w-0', 'basis-full', 'lg:ml-auto', 'lg:basis-auto', 'lg:shrink-0', 'lg:whitespace-nowrap']);
  assert.match(html, /grid gap-8 lg:grid-cols-/u);
  assert.match(html, /border-t-0 sm:border-t lg:border-t-0/u);
  assert.match(html, /w-full sm:w-auto sm:min-w-\[24rem\]/u);
});

test('forced profiles preserve footer visibility and the shared lower contact fallback', () => {
  const value = settings();
  for (const device of ['desktop', 'tablet', 'mobile'] as const) {
    assert.equal(render({ ...value, visible: false }, { previewDevice: device }), '');
    assert.equal(render({ ...value, upperSectionVisible: false, lowerSectionVisible: false }, { previewDevice: device }), '');
    const lowerOnly = render({ ...value, upperSectionVisible: false, lowerContactVisible: true }, { previewDevice: device });
    assert.doesNotMatch(lowerOnly, /site-footer-upper-section/u);
    assert.match(lowerOnly, /data-testid="site-footer-lower-contact"/u);
    assert.doesNotMatch(render({ ...value, upperSectionVisible: false, lowerContactVisible: false }, { previewDevice: device }), /site-footer-lower-contact/u);
    assert.doesNotMatch(render(value, { previewDevice: device }), /site-footer-lower-contact/u);
  }
});

test('editor adapters can expose hidden sections without changing the saved visibility or profile', () => {
  const value = { ...settings(), visible: false, upperSectionVisible: false, lowerSectionVisible: false };
  const before = structuredClone(value);
  const html = render(value, { previewDevice: 'mobile', editorAdapter: { forceVisible: true, showHidden: true, showEmpty: true } });
  assert.match(html, /data-footer-preview-device="mobile"/u);
  assert.match(html, /data-testid="site-footer-upper-section"/u);
  assert.match(html, /data-testid="site-footer-lower-section"/u);
  assert.ok(classes(html, 'aria-label="Povezave v nogi"').includes('grid-cols-1'));
  assert.deepEqual(value, before);
});
