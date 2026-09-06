import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n');
const navigation = read('src/admin/features/podoba/components/AdminNavigationPageClient.tsx');
const header = read('src/commercial/components/SiteHeader.tsx');
const preview = read('src/admin/features/podoba/components/LogoPlacementPreview.tsx');

test('public header and navigation overlay share navigation-owned logo fitting', () => {
  for (const source of [navigation, header]) {
    assert.match(source, /resolveHeaderLogoSize\(/);
    assert.doesNotMatch(source, /resolveSiteLogoDisplaySize|shared\/domain\/logo\/siteLogo/);
    assert.match(source, /item\.anchorWidthPx/);
  }
  assert.match(navigation, /updateSettings\(\{ logoHeightPx:/);
});

test('logo composition preview reuses real header and footer with an isolated published context', () => {
  assert.match(preview, /<SiteLogoProvider config=\{config\} previewDevice=\{device\}/);
  assert.match(preview, /<SiteHeader/);
  assert.match(preview, /previewMode="inline"/);
  assert.match(preview, /<SiteFooter settings=\{normalized.footer\}/);
  assert.doesNotMatch(preview, /admin-site-navigation-preview/);
});

test('navigation root-preview bridge and logo drag visibility preserve the existing navbar contract', () => {
  assert.match(navigation, /admin-site-navigation-preview/);
  assert.match(navigation, /new CustomEvent\(adminSiteNavigationPreviewEventName/);
  assert.match(navigation, /\[&_a\[data-navbar-left\]\]:invisible/);
  assert.match(header, /commercial-storefront-scale admin-site-header-preview-scale/);
  assert.match(header, /href="\/"[\s\S]*?aria-label="Atehna home"/);
});
