import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import test from 'node:test';
import { normalizeHexColor } from '../../src/shared/ui/admin-controls/hexColor';

const sourceRoot = resolve(process.cwd(), 'src');
const sharedFieldPath = resolve(
  sourceRoot,
  'shared/ui/admin-controls/CompactHexColorField.tsx'
);
const sharedControlRoot = resolve(sourceRoot, 'shared/ui/admin-controls');

const auditedColorSurfacePaths = [
  'shared/features/category-showcase/CategoryShowcaseEditor.tsx',
  'admin/features/artikli/components/ProductVariantOptionsCard.tsx',
  'admin/components/AdminRichTextEditor.tsx',
  'admin/features/podoba/components/ProductDescriptionRichTextEditor.tsx',
  'admin/features/podoba/components/ProductAppearanceContextToolbar.tsx',
  'admin/features/podoba/components/AdminProductAppearancePageClient.tsx',
  'admin/features/podoba/components/AdminGlobalStylePageClient.tsx',
  'admin/features/podoba/components/AdminLogoPageClient.tsx',
  'admin/features/podoba/components/AdminNavigationPageClient.tsx',
  'admin/features/podoba/components/AdminLandingPageClient.tsx',
  'admin/features/analitika/components/analytics/AnalyticsAppearancePanel.tsx',
  'admin/features/analitika/components/analytics/AnalyticsBuilderModal.tsx',
  'admin/features/urejevalnik/components/OrderDocumentTemplateCanvas.tsx'
] as const;

const emptyOrInheritedColorSurfacePaths = [
  'admin/features/artikli/components/ProductVariantOptionsCard.tsx',
  'admin/features/podoba/components/ProductAppearanceContextToolbar.tsx',
  'admin/features/podoba/components/AdminProductAppearancePageClient.tsx',
  'admin/features/urejevalnik/components/OrderDocumentTemplateCanvas.tsx'
] as const;

const alphaColorSurfacePaths = [
  'admin/features/analitika/components/analytics/AnalyticsAppearancePanel.tsx'
] as const;

function readSource(relativePath: string) {
  return readFileSync(resolve(sourceRoot, relativePath), 'utf8');
}

function collectFiles(directory: string, suffix: string): string[] {
  return readdirSync(directory)
    .flatMap((entry) => {
      const path = resolve(directory, entry);
      return statSync(path).isDirectory() ? collectFiles(path, suffix) : [path];
    })
    .filter((path) => path.endsWith(suffix));
}

function sourceLocations(path: string, source: string, pattern: RegExp) {
  return source
    .split(/\r?\n/u)
    .flatMap((line, index) => pattern.test(line) ? [`${relative(sourceRoot, path)}:${index + 1}`] : []);
}

test('every audited production color editor consumes the shared palette and HEX field', () => {
  const offenders = auditedColorSurfacePaths.flatMap((relativePath) => {
    const source = readSource(relativePath);
    const reasons = [
      !/CompactHexColorField/u.test(source) ? 'does not render CompactHexColorField' : null,
      !/shared\/ui\/admin-controls\/CompactHexColorField/u.test(source)
        ? 'does not import the canonical shared field'
        : null
    ].filter(Boolean);
    return reasons.length > 0 ? [`${relativePath} (${reasons.join(', ')})`] : [];
  });

  assert.deepEqual(
    offenders,
    [],
    `Audited color editors still own ad hoc UI:\n${offenders.join('\n')}`
  );
});

test('native color inputs and direct palette ownership do not leak outside the shared control', () => {
  const productionSources = collectFiles(sourceRoot, '.tsx').map((path) => ({
    path,
    source: readFileSync(path, 'utf8')
  }));

  const nativePickerLocations = productionSources.flatMap(({ path, source }) =>
    sourceLocations(path, source, /type\s*=\s*["']color["']/u)
  );
  assert.deepEqual(
    nativePickerLocations,
    [],
    `Native type=color inputs bypass the shared palette + HEX behavior:\n${nativePickerLocations.join('\n')}`
  );

  const directPaletteLocations = productionSources
    .filter(({ path }) => !path.startsWith(sharedControlRoot))
    .flatMap(({ path, source }) =>
      sourceLocations(path, source, /\bHex(?:Alpha)?ColorPicker\b/u)
    );
  assert.deepEqual(
    directPaletteLocations,
    [],
    `Only shared admin controls may own HexColorPicker:\n${directPaletteLocations.join('\n')}`
  );
});

test('local HEX field implementations cannot reappear beside the shared control', () => {
  const localImplementationPattern =
    /function\s+(ColorField|ColorPopoverField|HexColorControl|TopBarAppearanceColorField)\s*\(/gu;
  const manualHexPattern =
    /placeholder\s*=\s*["']#(?:RRGGBB|[0-9A-Fa-f]{6})|\bhexDraft\b|maxLength\s*=\s*\{7\}/u;

  const offenders = collectFiles(sourceRoot, '.tsx')
    .filter((path) => path !== sharedFieldPath)
    .flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      const adHocComponents = [...source.matchAll(localImplementationPattern)].flatMap((match) => {
        const tail = source.slice(match.index ?? 0);
        const nextFunctionOffset = tail.slice(match[0].length).search(
          /\n(?:export\s+(?:default\s+)?)?function\s+/u
        );
        const componentSource = nextFunctionOffset < 0
          ? tail
          : tail.slice(0, match[0].length + nextFunctionOffset);
        return componentSource.includes('CompactHexColorField') ? [] : [match[1]];
      });
      const reasons = [
        adHocComponents.length > 0
          ? `local color component: ${adHocComponents.join(', ')}`
          : null,
        manualHexPattern.test(source) ? 'manual HEX input' : null
      ].filter(Boolean);
      return reasons.length > 0
        ? [`${relative(sourceRoot, path)} (${reasons.join(', ')})`]
        : [];
    });

  assert.deepEqual(
    offenders,
    [],
    `Ad hoc color-field implementations remain:\n${offenders.join('\n')}`
  );
});

test('the canonical field owns palette, HEX, clear/inherit, alpha, and stable selectors', () => {
  const sharedFieldSource = readFileSync(sharedFieldPath, 'utf8');
  const sharedControlBundle = collectFiles(sharedControlRoot, '.ts')
    .concat(collectFiles(sharedControlRoot, '.tsx'))
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n');

  assert.match(sharedControlBundle, /\bADMIN_HEX_COLOR_PALETTE\b/u);
  assert.match(sharedFieldSource, /\bHexColorPicker\b/u);
  assert.match(sharedFieldSource, /\bHexAlphaColorPicker\b/u);
  assert.match(sharedFieldSource, /from ['"]react-colorful['"]/u);
  assert.match(sharedFieldSource, /data-admin-hex-color-field/u);
  assert.match(sharedFieldSource, /data-admin-color-palette-trigger/u);
  assert.match(sharedFieldSource, /data-admin-hex-color-input/u);
  assert.match(sharedFieldSource, /data-admin-color-picker-arbitrary/u);
  assert.match(sharedFieldSource, /data-admin-color-palette-grid/u);
  assert.match(sharedFieldSource, /data-admin-color-palette-option/u);
  assert.match(sharedFieldSource, /data-admin-color-palette-clear/u);
  assert.match(sharedFieldSource, /allowClear\s*&&\s*!candidate\.trim\(\)/u);
  assert.match(sharedFieldSource, /onChange\(['"]['"]\)/u);
  const spectrumOffset = Math.min(
    ...['<HexColorPicker', '<HexAlphaColorPicker']
      .map((token) => sharedFieldSource.indexOf(token))
      .filter((offset) => offset >= 0)
  );
  const selectedHexOffset = sharedFieldSource.indexOf('data-admin-color-palette-value');
  assert.ok(
    Number.isFinite(spectrumOffset) && spectrumOffset < selectedHexOffset,
    'the selected HEX output must render below the shared color spectrum'
  );
  assert.match(
    sharedControlBundle,
    /allowClear|allowEmpty|clearable|clearLabel|emptyLabel|inherit(?:ed|Label)?/iu,
    'shared field must model empty/inherited colors explicitly'
  );
  assert.match(
    sharedControlBundle,
    /allowAlpha|withAlpha|alphaEnabled|(?:\{6\}[^\n]{0,120}\{8\})/iu,
    'shared field must preserve analytics #RRGGBBAA values'
  );
});

test('8-digit HEX stays opt-in and is preserved exactly for analytics', () => {
  assert.equal(normalizeHexColor('#12345678'), null);
  assert.equal(normalizeHexColor('#12345678', { allowAlpha: true }), '#12345678');
  assert.equal(normalizeHexColor('#abcd', { allowAlpha: true }), '#AABBCCDD');
  assert.equal(normalizeHexColor('0x09afeF80', { allowAlpha: true }), '#09AFEF80');
});

test('nullable and analytics surfaces opt into their nonstandard color semantics', () => {
  const emptyCapability =
    /allowClear|allowEmpty|clearable|clearLabel|emptyLabel|inherit(?:ed|Label)?/iu;
  const alphaCapability = /allowAlpha|withAlpha|alphaEnabled/iu;
  const offenders = [
    ...emptyOrInheritedColorSurfacePaths.flatMap((relativePath) =>
      emptyCapability.test(readSource(relativePath))
        ? []
        : [`${relativePath} (missing clear/inherit capability)`]
    ),
    ...alphaColorSurfacePaths.flatMap((relativePath) =>
      alphaCapability.test(readSource(relativePath))
        ? []
        : [`${relativePath} (missing 8-digit HEX opt-in)`]
    )
  ];

  assert.deepEqual(
    offenders,
    [],
    `Nonstandard color semantics were lost during consolidation:\n${offenders.join('\n')}`
  );
});
