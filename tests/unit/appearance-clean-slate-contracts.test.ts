import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('appearance domains contain only current-schema normalizers', () => {
  const productAppearance = source('src/shared/domain/style/productAppearance.ts');
  const landingPage = source('src/shared/domain/landing/landingPage.ts');
  const globalStyle = source('src/shared/domain/style/globalStyle.ts');

  assert.doesNotMatch(
    productAppearance,
    /LEGACY_|upgradeLegacy|storedSchemaVersion|scaleLegacy|SCHEMA_[67]_RELATED|normalizeProductCanvas\([^)]*,/u
  );
  assert.doesNotMatch(
    landingPage,
    /normalizeLegacyElementConfig|LEGACY_DEFAULT_HOMEPAGE_CATEGORY_ORDER|ordersMatch/u
  );
  assert.doesNotMatch(globalStyle, /upgradeLegacyDefaultColor/u);
});

test('navigation stores only responsive layouts and a rich footer', () => {
  const navigation = source('src/shared/domain/navigation/siteNavigation.ts');
  const navigationServer = source('src/shared/server/siteNavigation.ts');
  const navigationEditor = source(
    'src/admin/features/podoba/components/AdminNavigationPageClient.tsx'
  );

  assert.doesNotMatch(
    navigation,
    /legacySiteNavigationIconAliases|migrateLegacyFooterLinks|footerLinks|footer_links|SiteNavigationTopBarLayoutMode|SiteNavigationTopBarLayoutItem|normalizeSiteNavigationTopBarOffset|SITE_NAVIGATION_TOP_BAR_OFFSET|site_layout|topbar_|width_mode/u
  );
  assert.doesNotMatch(
    navigationServer,
    /hasStoredRichFooter|Failed to migrate legacy footer settings|initialMode|initialOffset\.|offset\.(?:logo|navigation|search|ai|cart)/u
  );
  assert.doesNotMatch(
    navigationEditor,
    /LegacyTopBarLayoutEditor|topBarPreviewDeviceWidths|getTopBarOffsetForZone/u
  );
});

test('category showcase uses stored canonical image URLs and explicit hover defaults', () => {
  const categorySchema = source(
    'src/shared/features/category-showcase/categoryShowcaseSchema.ts'
  );
  const categoryRenderer = source(
    'src/shared/features/category-showcase/CategoryShowcase.tsx'
  );
  const categoryServer = source('src/shared/server/categoryShowcase.ts');
  const catalogServer = source('src/shared/server/catalogCategories.ts');

  for (const file of [categorySchema, categoryRenderer, categoryServer, catalogServer]) {
    assert.doesNotMatch(
      file,
      /\bresolveCategoryShowcaseImage\b|DEFAULT_CATEGORY_SHOWCASE_CUTOUTS|deriveCategoryShowcaseBackgroundHoverColor/u
    );
  }

  assert.match(
    source('database/schema.sql'),
    /\/images\/categories\/cutouts\/materiali\.png/u
  );
});

test('deprecated appearance route aliases remain deleted', () => {
  const routes = [
    'src/admin/pages/podoba/vizualno/page.tsx',
    'src/app/admin/podoba/vizualno/page.tsx',
    'src/admin/pages/podoba/globalni-slog/page.tsx',
    'src/app/admin/podoba/globalni-slog/page.tsx'
  ];

  for (const route of routes) {
    assert.equal(existsSync(resolve(process.cwd(), route)), false, route);
  }

  const tabs = source('src/admin/features/podoba/components/AdminPodobaTabs.tsx');
  assert.doesNotMatch(tabs, /\/admin\/podoba\/(?:vizualno|globalni-slog)/u);
});
