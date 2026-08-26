import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { normalizeHexColor } from '../../src/shared/ui/admin-controls/hexColor';

const compactFieldSource = readFileSync(
  resolve(process.cwd(), 'src/shared/ui/admin-controls/CompactHexColorField.tsx'),
  'utf8'
);
const logoEditorSource = readFileSync(
  resolve(process.cwd(), 'src/admin/features/podoba/components/AdminLogoPageClient.tsx'),
  'utf8'
);
const documentCanvasSource = readFileSync(
  resolve(process.cwd(), 'src/admin/features/urejevalnik/components/OrderDocumentTemplateCanvas.tsx'),
  'utf8'
);

const logoColorMarkers = [
  'backgroundColor',
  'taglineBackgroundColor',
  'primaryTextColor',
  'secondaryTextColor',
  'taglineTextColor',
  'outline.color',
  'shadow.color'
] as const;

test('HEX normalization accepts common pasted HEX forms and persists #RRGGBB', () => {
  assert.equal(normalizeHexColor('#abc'), '#AABBCC');
  assert.equal(normalizeHexColor('abc'), '#AABBCC');
  assert.equal(normalizeHexColor('  #a1b2c3  '), '#A1B2C3');
  assert.equal(normalizeHexColor('0x09afEF'), '#09AFEF');
  assert.equal(normalizeHexColor('ffffff'), '#FFFFFF');

  for (const invalid of [
    '',
    '#1',
    '#12',
    '#1234',
    '#12345',
    '#1234567',
    '#12345678',
    '#gggggg',
    'rgb(1, 2, 3)',
    'hsl(0 0% 0%)',
    'transparent'
  ]) {
    assert.equal(normalizeHexColor(invalid), null, `Expected invalid HEX draft: ${invalid}`);
  }
});

test('the shared logo field keeps invalid drafts local and commits valid typed HEX', () => {
  assert.match(compactFieldSource, /value=\{draft\}/u);
  assert.match(compactFieldSource, /const updateDraft = \(candidate: string\) => \{/u);
  assert.match(compactFieldSource, /const normalized = normalizeHexColor\(candidate, normalizeOptions\)/u);
  assert.match(compactFieldSource, /normalized && normalized !== normalizedValue\) onChange\(normalized\)/u);
  assert.match(compactFieldSource, /onBlur=\{\(event\) => \{[\s\S]*?commit\(event\.currentTarget\.value\)/u);
  assert.match(compactFieldSource, /event\.key === 'Enter'/u);
  assert.match(compactFieldSource, /event\.key === 'Escape'/u);
  assert.match(compactFieldSource, /data-logo-hex-color-control=\{marker\}/u);
  assert.doesNotMatch(compactFieldSource, /type="color"/u);
});

test('Podoba and Urejevalnik share one HEX-only control for every logo color', () => {
  for (const source of [logoEditorSource, documentCanvasSource]) {
    assert.match(source, /import \{ CompactHexColorField \}/u);
    assert.doesNotMatch(source, /type="color"/u);
    assert.doesNotMatch(source, /<aside\b/u);
    for (const marker of logoColorMarkers) {
      assert.ok(
        source.includes(`marker="${marker}"`),
        `Missing shared HEX logo color: ${marker}`
      );
    }
    assert.match(source, /label="Barva d\.o\.o\."/u);
    assert.doesNotMatch(source, /Sekundarna (?:barva|rumena)|zadnji A/iu);
  }
});
