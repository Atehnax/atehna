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

function openingTagAround(source: string, index: number) {
  const start = source.lastIndexOf('<', index);
  const end = source.indexOf('>', index);
  return start >= 0 && end >= 0 ? source.slice(start, end + 1) : '';
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

test('settings surfaces never scroll internally and every legitimate scroller states its purpose', () => {
  const settingsSurfaceOffenders: string[] = [];
  const unclassifiedScrollers: string[] = [];
  const allowedPurposes = /data-appearance-editor-scroll-purpose="(?:preview|navigation|content|data)"/u;

  for (const { name, source } of componentFiles) {
    let settingsIndex = source.indexOf('data-appearance-editor-settings-surface');
    while (settingsIndex >= 0) {
      const tag = openingTagAround(source, settingsIndex);
      if (
        !/data-settings-scroll="none"/u.test(tag)
        || /\b(?:overflow(?:-[xy])?-(?:auto|scroll)|max-h-)\b/u.test(tag)
      ) settingsSurfaceOffenders.push(`${name}: ${tag.slice(0, 180)}`);
      settingsIndex = source.indexOf('data-appearance-editor-settings-surface', settingsIndex + 1);
    }

    const scrollPattern = /\b(?:overflow-y-auto|overflow-y-scroll|overflow-auto)\b/gu;
    for (const match of source.matchAll(scrollPattern)) {
      const tag = openingTagAround(source, match.index ?? 0);
      if (!allowedPurposes.test(tag)) {
        unclassifiedScrollers.push(`${name}: ${tag.slice(0, 180)}`);
      }
    }
  }

  assert.deepEqual(settingsSurfaceOffenders, []);
  assert.deepEqual(unclassifiedScrollers, []);
});

test('each Podoba route declares at least one compact non-scrolling settings surface', () => {
  const routeSources = [
    ['landing', landingSource],
    ['logo', logoSource],
    ['navigation', navigationSource],
    ['global', globalSource],
    ['product', `${productPageSource}\n${productToolbarSource}`]
  ] as const;
  for (const [route, source] of routeSources) {
    assert.match(source, /data-appearance-editor-settings-surface/u, `${route} has no declared settings surface`);
    assert.match(source, /data-settings-scroll="none"/u, `${route} does not promise an immediately visible settings surface`);
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
