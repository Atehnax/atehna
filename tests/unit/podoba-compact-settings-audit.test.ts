import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import test from 'node:test';

const componentsDirectory = resolve(
  process.cwd(),
  'src/admin/features/podoba/components'
);
const componentFiles = readdirSync(componentsDirectory)
  .filter((name) => name.endsWith('.tsx'))
  .map((name) => ({
    name,
    source: readFileSync(resolve(componentsDirectory, name), 'utf8')
  }));
const sourceFor = (name: string) => componentFiles.find((file) => file.name === name)?.source ?? '';

const primitivesSource = sourceFor('AppearanceEditorToolbarPrimitives.tsx');
const landingSource = sourceFor('AdminLandingPageClient.tsx');
const logoSource = sourceFor('AdminLogoPageClient.tsx');
const logoTextSource = sourceFor('SiteLogoTextLayerControls.tsx');
const navigationSource = sourceFor('AdminNavigationPageClient.tsx');
const globalSource = sourceFor('AdminGlobalStylePageClient.tsx');
const productPageSource = sourceFor('AdminProductAppearancePageClient.tsx');
const productToolbarSource = sourceFor('ProductAppearanceContextToolbar.tsx');
const productDescriptionSource = sourceFor('ProductDescriptionRichTextEditor.tsx');

function openingTagAround(source: string, index: number) {
  const start = source.lastIndexOf('<', index);
  const end = source.indexOf('>', index);
  return start >= 0 && end >= 0 ? source.slice(start, end + 1) : '';
}

function compactSelectOpeningTags(source: string) {
  const tags: string[] = [];
  let index = source.indexOf('<AppearanceEditorCompactSelect');
  while (index >= 0) {
    tags.push(openingTagAround(source, index));
    index = source.indexOf('<AppearanceEditorCompactSelect', index + 1);
  }
  return tags;
}

function compactSelectOpeningTagForMarker(source: string, marker: string) {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `Missing compact select marker: ${marker}`);
  return openingTagAround(source, markerIndex);
}

test('every Podoba selector uses the compact themed listbox instead of a native select', () => {
  const offenders = componentFiles
    .filter(({ source }) => /<select\b/u.test(source))
    .map(({ name }) => name);
  assert.deepEqual(offenders, []);

  for (const source of [landingSource, logoSource, navigationSource, globalSource, productPageSource, productToolbarSource]) {
    assert.match(source, /AppearanceEditorCompactSelect/u);
  }
});

test('the landing-page header uses the standard compact Podoba publication status', () => {
  assert.match(
    landingSource,
    /mr-1 inline-flex items-center gap-1\.5 text-\[11px\] font-medium text-slate-500/u
  );
  assert.match(
    landingSource,
    /h-1\.5 w-1\.5 rounded-full.*bg-amber-500.*bg-emerald-500/u
  );
  assert.match(landingSource, /aria-live="polite"/u);
  assert.doesNotMatch(
    landingSource,
    /inline-flex h-8 items-center rounded-full border px-3 text-\[12px\] font-semibold/u
  );
});

test('compact selects are portal-layered, dismiss externally, and preserve keyboard/focus semantics', () => {
  assert.match(primitivesSource, /createPortal\(/u);
  assert.match(primitivesSource, /data-appearance-editor-compact-select-trigger/u);
  assert.match(
    primitivesSource,
    /data-appearance-editor-compact-select-value=\{value \|\| undefined\}/u
  );
  assert.match(primitivesSource, /data-appearance-editor-compact-select-portal/u);
  assert.match(
    primitivesSource,
    /data-appearance-editor-compact-select-option=\{option\.value\}/u
  );
  assert.match(primitivesSource, /role="listbox"/u);
  assert.match(primitivesSource, /role="option"/u);
  assert.match(primitivesSource, /aria-selected=/u);
  assert.match(primitivesSource, /data-appearance-editor-compact-select-tone=\{resolvedTone\}/u);
  assert.match(primitivesSource, /border-slate-300 bg-white font-normal text-slate-700/u);
  assert.match(primitivesSource, /rounded-md border-slate-200 bg-white text-slate-700/u);
  assert.match(primitivesSource, /bg-slate-800/u);
  assert.match(primitivesSource, /bg-slate-950\/95/u);
  assert.match(primitivesSource, /z-\[2147483647\]/u);
  assert.match(primitivesSource, /useDropdownDismiss\(\{/u);
  assert.match(primitivesSource, /refs: dismissRefs/u);
  assert.match(primitivesSource, /portalRefs/u);
  assert.match(primitivesSource, /returnFocusRef: triggerRef/u);
  assert.match(primitivesSource, /dismissGroup: 'appearance-compact-select'/u);
  assert.doesNotMatch(primitivesSource, /document\.addEventListener\('pointerdown', dismiss/u);
  assert.match(primitivesSource, /event\.key === 'Escape'/u);
  assert.match(primitivesSource, /triggerRef\.current\?\.focus\(\)/u);
  assert.match(primitivesSource, /setPosition\(\(current\) => \(\{ \.\.\.current, ready: false \}\)\)/u);
  assert.match(primitivesSource, /position\.columns/u);
  assert.match(primitivesSource, /'ArrowLeft', 'ArrowRight', 'Home', 'End'/u);

  const portalIndex = primitivesSource.indexOf('data-appearance-editor-compact-select-portal');
  const portalTag = openingTagAround(primitivesSource, portalIndex);
  assert.doesNotMatch(portalTag, /overflow(?:-[xy])?-(?:auto|scroll)/u);
});

test('light settings inherit the admin palette while dark editor surfaces opt in', () => {
  assert.match(primitivesSource, /createContext<AppearanceEditorToolbarTone>\('light'\)/u);
  assert.match(primitivesSource, /const resolvedTone = tone \?\? inheritedTone/u);

  for (const source of [navigationSource, productPageSource]) {
    const tags = compactSelectOpeningTags(source);
    assert.ok(tags.length > 0);
    for (const tag of tags) assert.doesNotMatch(tag, /tone="dark"/u);
  }

  for (const source of [landingSource, productToolbarSource, productDescriptionSource, logoTextSource]) {
    const tags = compactSelectOpeningTags(source);
    assert.ok(tags.length > 0);
    for (const tag of tags) assert.match(tag, /tone="dark"/u);
  }
  const logoSelectTags = compactSelectOpeningTags(logoSource);
  assert.equal(logoSelectTags.length, 1);
  assert.equal(logoSelectTags.filter((tag) => /tone="dark"/u.test(tag)).length, 1);
});

test('page-level product and top-bar typography selectors pin the light admin tone and aligned sizing', () => {
  const productPreviewSelect = compactSelectOpeningTagForMarker(
    productPageSource,
    'marker="product-preview-product"'
  );
  assert.match(productPreviewSelect, /tone="light"/u);
  assert.match(productPreviewSelect, /triggerClassName="[^"]*!h-8[^"]*!rounded-md[^"]*!bg-white/u);
  assert.match(productPageSource, /className="grid max-w-xl gap-1\.5"/u);

  for (const marker of [
    'marker={`topbar-${device}-font-family`}',
    'marker={`topbar-${device}-font-weight`}',
    'marker={`topbar-${device}-font-style`}'
  ]) {
    const select = compactSelectOpeningTagForMarker(navigationSource, marker);
    assert.match(select, /tone="light"/u);
    assert.match(select, /triggerClassName="[^"]*!h-9[^"]*!rounded-lg[^"]*!bg-white/u);
  }

  const colorsRowIndex = navigationSource.indexOf('data-testid="top-bar-colors-row"');
  const typographyRowIndex = navigationSource.indexOf('data-testid="top-bar-typography-row"');
  assert.notEqual(colorsRowIndex, -1);
  assert.notEqual(typographyRowIndex, -1);
  assert.ok(colorsRowIndex < typographyRowIndex);
});

test('the shared alignment control is a roving keyboard radiogroup including justified text', () => {
  assert.match(primitivesSource, /type AppearanceEditorAlignment = 'inherit' \| 'left' \| 'center' \| 'right' \| 'justify'/u);
  assert.match(primitivesSource, /role="radiogroup"/u);
  assert.match(primitivesSource, /role="radio"/u);
  assert.match(primitivesSource, /aria-checked=\{active\}/u);
  assert.match(primitivesSource, /data-appearance-editor-alignment-mixed=\{mixed \|\| undefined\}/u);
  assert.match(primitivesSource, /tabIndex=\{active \|\| \(mixed && option === options\[0\]\) \? 0 : -1\}/u);
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']) {
    assert.ok(primitivesSource.includes(`'${key}'`), `Missing ${key} radiogroup handling`);
  }
  assert.match(primitivesSource, /onValueChange\(nextValue\)/u);
  assert.match(primitivesSource, /radios\?\.\[nextIndex\]\?\.focus\(\)/u);

  assert.match(landingSource, /options=\{\['left', 'center', 'right', 'justify'\] as const\}/u);
  assert.match(productPageSource, /options=\{\['inherit', 'left', 'center', 'right', 'justify'\] as const\}/u);
  assert.match(productToolbarSource, /options=\{\['inherit', 'left', 'center', 'right', 'justify'\] as const\}/u);
  assert.match(logoTextSource, /options=\{\['left', 'center', 'right'\] as const\}/u);
});

test('settings surfaces avoid internal scrolling except for the shared short-viewport fallback', () => {
  const settingsSurfaceOffenders: string[] = [];
  const unclassifiedScrollers: string[] = [];
  const allowedPurposes = /data-appearance-editor-scroll-purpose="(?:preview|navigation|content|data)"/u;

  for (const { name, source } of componentFiles) {
    let settingsIndex = source.indexOf('data-appearance-editor-settings-surface');
    while (settingsIndex >= 0) {
      const tag = openingTagAround(source, settingsIndex);
      const viewportFallback = (
        /(?:data-appearance-editor-toolbar-popover|data-homepage-toolbar-popover-scroll-region)/u.test(tag)
        && /data-settings-scroll="internal"/u.test(tag)
        && /overflow-y-auto/u.test(tag)
      );
      if (
        !viewportFallback
        && (
          !/data-settings-scroll="none"/u.test(tag)
          || /\b(?:overflow(?:-[xy])?-(?:auto|scroll)|max-h-)\b/u.test(tag)
        )
      ) settingsSurfaceOffenders.push(`${name}: ${tag.slice(0, 180)}`);
      settingsIndex = source.indexOf('data-appearance-editor-settings-surface', settingsIndex + 1);
    }

    const scrollPattern = /\b(?:overflow-y-auto|overflow-y-scroll|overflow-auto)\b/gu;
    for (const match of source.matchAll(scrollPattern)) {
      const tag = openingTagAround(source, match.index ?? 0);
      if (!allowedPurposes.test(tag) && !/(?:data-appearance-editor-toolbar-popover|data-homepage-toolbar-popover-scroll-region)/u.test(tag)) {
        unclassifiedScrollers.push(`${name}: ${tag.slice(0, 180)}`);
      }
    }
  }

  assert.deepEqual(settingsSurfaceOffenders, []);
  assert.deepEqual(unclassifiedScrollers, []);
});

test('each Podoba route declares at least one compact, bounded settings surface', () => {
  const routeSources = [
    ['landing', landingSource],
    ['logo', `${logoSource}\n${primitivesSource}`],
    ['navigation', navigationSource],
    ['global', globalSource],
    ['product', `${productPageSource}\n${productToolbarSource}`]
  ] as const;
  assert.match(logoSource, /<AppearanceEditorToolbarPopover/u);
  for (const [route, source] of routeSources) {
    assert.match(source, /data-appearance-editor-settings-surface/u, `${route} has no declared settings surface`);
    assert.match(
      source,
      route === 'logo'
        ? /data-appearance-editor-toolbar-popover[\s\S]*?data-settings-scroll="internal"/u
        : route === 'landing'
          ? /data-homepage-toolbar-popover-scroll-region[\s\S]*?data-settings-scroll="internal"/u
          : /data-settings-scroll="none"/u,
      `${route} does not promise an immediately visible or viewport-bounded settings surface`
    );
  }
});

test('the audit covers the complete current Podoba component inventory', () => {
  assert.ok(componentFiles.length >= 10);
  assert.equal(basename(componentsDirectory), 'components');
  for (const required of [
    'AdminLandingPageClient.tsx',
    'AdminNavigationPageClient.tsx',
    'AdminLogoPageClient.tsx',
    'AdminGlobalStylePageClient.tsx',
    'AdminProductAppearancePageClient.tsx',
    'ProductAppearanceContextToolbar.tsx',
    'ProductDescriptionRichTextEditor.tsx',
    'SiteLogoTextLayerControls.tsx'
  ]) {
    assert.ok(componentFiles.some(({ name }) => name === required), `Missing ${required} from audit inventory`);
  }
});
