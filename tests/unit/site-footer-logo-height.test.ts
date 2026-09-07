import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import {
  DEFAULT_HOMEPAGE_SETTINGS,
  normalizeHomepageFooterSettings,
  toStoredLandingPageConfig,
  type HomepageFooterSettings
} from '@/shared/domain/landing/landingPage';
import {
  cloneDefaultSiteNavigationConfig,
  normalizeSiteNavigationConfig,
  toStoredSiteNavigationConfig
} from '@/shared/domain/navigation/siteNavigation';

const devices = ['desktop', 'tablet', 'mobile'] as const;

function assertNoOverride(footer: HomepageFooterSettings) {
  for (const device of devices) {
    assert.equal(Object.hasOwn(footer.responsive[device], 'logoHeightPx'), false, device);
  }
  assert.equal(Object.hasOwn(footer, 'logoHeightPx'), false);
}

test('existing and default footers do not acquire any logo size override', () => {
  assertNoOverride(DEFAULT_HOMEPAGE_SETTINGS.footer);
  assertNoOverride(normalizeHomepageFooterSettings({}));
  assertNoOverride(toStoredSiteNavigationConfig(cloneDefaultSiteNavigationConfig()).footer);
  assertNoOverride(toStoredLandingPageConfig(DEFAULT_HOMEPAGE_SETTINGS).footer);
});

test('only explicit finite numbers enable a footer logo size override', () => {
  for (const input of [undefined, null, '40', '', true, false, {}, [], Number.NaN, Infinity, -Infinity]) {
    assertNoOverride(normalizeHomepageFooterSettings({
      responsive: Object.fromEntries(devices.map((device) => [device, { logoHeightPx: input }]))
    }));
  }
});

test('explicit footer heights clamp to safe bounds and preserve fractional pixels', () => {
  for (const [input, expected] of [[-20, 8], [0, 8], [8, 8], [40.5, 40.5], [160, 160], [900, 160]]) {
    const footer = normalizeHomepageFooterSettings({ responsive: { desktop: { logoHeightPx: input } } });
    assert.equal(footer.responsive.desktop.logoHeightPx, expected);
    assert.equal(Object.hasOwn(footer.responsive.tablet, 'logoHeightPx'), false);
    assert.equal(Object.hasOwn(footer.responsive.mobile, 'logoHeightPx'), false);
  }
});

test('each device retains its own height through full navigation and landing storage round trips', () => {
  const original = toStoredSiteNavigationConfig(cloneDefaultSiteNavigationConfig());
  const config = structuredClone(original);
  config.footer.responsive.desktop.logoHeightPx = 80;
  config.footer.responsive.tablet.logoHeightPx = 42.5;
  config.footer.responsive.mobile.logoHeightPx = 24;

  const stored = toStoredSiteNavigationConfig(config);
  const restored = normalizeSiteNavigationConfig(JSON.parse(JSON.stringify(stored)));
  assert.deepEqual(devices.map((device) => restored.footer.responsive[device].logoHeightPx), [80, 42.5, 24]);
  assert.deepEqual(restored.topBarLayout, original.topBarLayout);
  assert.deepEqual(restored.topBarInitialLayout, original.topBarInitialLayout);
  assert.equal(Object.hasOwn(restored.footer, 'logoHeightPx'), false);
  assert.deepEqual(toStoredSiteNavigationConfig(restored), stored);

  const landing = toStoredLandingPageConfig({ ...DEFAULT_HOMEPAGE_SETTINGS, footer: restored.footer });
  assert.deepEqual(landing.footer.responsive, restored.footer.responsive);
  assert.equal(Object.hasOwn(landing.footer, 'logoHeightPx'), false);
});

test('clearing one explicit height restores its original sizing without changing other devices', () => {
  const config = cloneDefaultSiteNavigationConfig();
  config.footer.responsive.desktop.logoHeightPx = 64;
  config.footer.responsive.tablet.logoHeightPx = 32;
  delete config.footer.responsive.desktop.logoHeightPx;
  const stored = toStoredSiteNavigationConfig(config);
  assert.equal(Object.hasOwn(stored.footer.responsive.desktop, 'logoHeightPx'), false);
  assert.equal(stored.footer.responsive.tablet.logoHeightPx, 32);
  assert.equal(Object.hasOwn(stored.footer.responsive.mobile, 'logoHeightPx'), false);
});

// Execute the real pure audit functions without importing the server module's DB/cache dependencies.
function loadFooterAudit() {
  const path = resolve(process.cwd(), 'src/shared/server/siteNavigation.ts');
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  const names = new Set([
    'navigationFieldLabels', 'topBarDeviceAuditLabels', 'topBarElementAuditLabels',
    'topBarRegionAuditLabels', 'textAlignmentAuditLabels', 'topBarSettingAuditLabels',
    'topBarAuditFieldLabel', 'auditEntityKey', 'visibleLabel', 'auditValueLabel',
    'flatFooterSettings', 'diffNavigationValues'
  ]);
  const selected = source.statements.filter((statement) => {
    if (ts.isFunctionDeclaration(statement)) return names.has(statement.name?.text ?? '');
    return ts.isVariableStatement(statement) && statement.declarationList.declarations.some(
      (declaration) => ts.isIdentifier(declaration.name) && names.has(declaration.name.text)
    );
  });
  assert.equal(selected.length, names.size);
  const code = ts.transpileModule(selected.map((node) => node.getText(source)).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText;
  return runInNewContext(`${code}; ({ flatFooterSettings, diffNavigationValues });`) as {
    flatFooterSettings(footer: HomepageFooterSettings): { values: Record<string, unknown> };
    diffNavigationValues(before: Record<string, unknown>, after: Record<string, unknown>): Record<
      string, { label: string; before: string; after: string }
    >;
  };
}

test('audit history records each device height with a localized label and detects removing an override', () => {
  const audit = loadFooterAudit();
  const before = audit.flatFooterSettings(normalizeHomepageFooterSettings({})).values;
  const after = audit.flatFooterSettings(normalizeHomepageFooterSettings({
    responsive: { desktop: { logoHeightPx: 80 }, tablet: { logoHeightPx: 42.5 }, mobile: { logoHeightPx: 24 } }
  })).values;
  const diff = audit.diffNavigationValues(before, after);
  assert.deepEqual(Object.keys(diff).sort(), devices.map((device) => `footerResponsive.${device}.logoHeightPx`).sort());
  for (const [device, label, value] of [
    ['desktop', 'Desktop', '80'], ['tablet', 'Tablica', '42.5'], ['mobile', 'Mobilno', '24']
  ]) {
    const change = diff[`footerResponsive.${device}.logoHeightPx`];
    assert.equal(change.label, `${label}: Višina logotipa (px)`);
    assert.equal(change.before, '');
    assert.equal(change.after, value);
  }
  const removal = audit.diffNavigationValues(after, before);
  assert.equal(removal['footerResponsive.tablet.logoHeightPx'].before, '42.5');
  assert.equal(removal['footerResponsive.tablet.logoHeightPx'].after, '');
  assert.equal(Object.keys(audit.diffNavigationValues(after, after)).length, 0);
});
