import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  normalizeHexColor,
  normalizeHexColorPalette
} from '../../src/shared/ui/admin-controls/hexColor';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const fieldSource = source('src/shared/ui/admin-controls/CompactHexColorField.tsx');
const canvasSource = source(
  'src/admin/features/urejevalnik/components/OrderDocumentTemplateCanvas.tsx'
);

test('opaque HEX remains the default and alpha is explicitly opt-in', () => {
  assert.equal(normalizeHexColor('#1234'), null);
  assert.equal(normalizeHexColor('#11223344'), null);
  assert.equal(normalizeHexColor('#1234', { allowAlpha: true }), '#11223344');
  assert.equal(normalizeHexColor('0x11223344', { allowAlpha: true }), '#11223344');
  assert.equal(normalizeHexColor('#aabbccdd', { allowAlpha: true }), '#AABBCCDD');

  assert.deepEqual(
    normalizeHexColorPalette(
      ['#abc', '#AABBCC', 'invalid', '#1234', '#1234'],
      { allowAlpha: true }
    ),
    ['#AABBCC', '#11223344']
  );
});

test('the shared field exposes reusable tone, layout, alpha, clear and input hooks', () => {
  for (const prop of [
    "tone?: 'dark' | 'light'",
    "layout?: 'compact' | 'inline'",
    'disabled?: boolean',
    'allowAlpha?: boolean',
    'allowClear?: boolean',
    'inputAttributes?: CompactHexColorInputAttributes',
    'marker?: string'
  ]) {
    assert.ok(fieldSource.includes(prop), `Missing reusable palette prop: ${prop}`);
  }
  assert.match(fieldSource, /Partial<Record<`data-\$\{string\}`/u);
  assert.match(fieldSource, /data-admin-hex-color-field/u);
  assert.match(fieldSource, /data-admin-hex-color-input/u);
  assert.match(fieldSource, /data-logo-hex-color-control=\{marker\}/u);
});

test('the compact field shrinks inside narrow settings grids without clipping the HEX input', () => {
  assert.match(
    fieldSource,
    /inline-flex min-w-0 items-center gap-2/u
  );
  assert.match(
    fieldSource,
    /flex min-w-0 items-center gap-2 rounded-lg border/u
  );
  assert.match(
    fieldSource,
    /ml-auto grid min-w-\[6\.25rem\] max-w-\[8\.25rem\] flex-1 grid-cols-\[1\.5rem_minmax\(0,1fr\)\]/u
  );
  assert.match(fieldSource, /h-7 min-w-0 w-full rounded-md border/u);
  assert.doesNotMatch(fieldSource, /w-\[6\.6rem\]/u);
});

test('clicking the square opens an accessible arbitrary picker with selected HEX below', () => {
  assert.match(fieldSource, /HexColorPicker/u);
  assert.match(fieldSource, /HexAlphaColorPicker/u);
  assert.match(fieldSource, /data-admin-color-palette-trigger/u);
  assert.match(fieldSource, /aria-haspopup="dialog"/u);
  assert.match(fieldSource, /aria-expanded=\{paletteOpen\}/u);
  assert.match(fieldSource, /onClick=\{\(\) => paletteOpen \? closePalette\(\) : openPalette\(\)\}/u);
  assert.match(fieldSource, /role="dialog"/u);
  assert.match(fieldSource, /createPortal\(/u);
  assert.match(fieldSource, /data-admin-color-palette-portal/u);
  assert.match(fieldSource, /data-admin-color-picker-arbitrary/u);
  assert.match(fieldSource, /data-admin-color-palette-value/u);
  assert.match(fieldSource, /data-admin-color-palette-option/u);

  const arbitraryIndex = fieldSource.indexOf('data-admin-color-picker-arbitrary');
  const selectedIndex = fieldSource.indexOf('data-admin-color-palette-value');
  const presetsIndex = fieldSource.indexOf('data-admin-color-palette-grid');
  assert.ok(arbitraryIndex >= 0 && arbitraryIndex < selectedIndex);
  assert.ok(selectedIndex < presetsIndex, 'Selected HEX must sit directly below the primary picker');
});

test('palette and direct input are draft-safe, dismissible, and keyboard accessible', () => {
  assert.match(fieldSource, /document\.addEventListener\('pointerdown', closeOutside, true\)/u);
  assert.match(fieldSource, /document\.addEventListener\('focusin', closeOutside, true\)/u);
  assert.match(fieldSource, /event\.key !== 'Escape'/u);
  for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End']) {
    assert.ok(fieldSource.includes(`event.key === '${key}'`), `Missing palette key: ${key}`);
  }
  assert.match(fieldSource, /const updateDraft = \(candidate: string\)/u);
  assert.match(fieldSource, /if \(normalized && normalized !== normalizedValue\) onChange\(normalized\)/u);
  assert.match(fieldSource, /onBlur=\{\(event\) => \{[\s\S]*?commit\(event\.currentTarget\.value\)/u);
  assert.doesNotMatch(fieldSource, /type="color"/u);
});

test('PDF floating tools use the shared control without closing around its portal', () => {
  assert.match(canvasSource, /<CompactHexColorField\b/u);
  const wrapperStart = canvasSource.indexOf('function ColorField');
  const wrapperEnd = canvasSource.indexOf('function Toggle', wrapperStart);
  const wrapperSource = canvasSource.slice(wrapperStart, wrapperEnd);
  assert.match(wrapperSource, /<CompactHexColorField\b/u);
  assert.match(wrapperSource, /inheritedColor=\{inherited\}/u);
  assert.match(wrapperSource, /tone="dark"/u);
  assert.match(wrapperSource, /layout="compact"/u);
  assert.match(wrapperSource, /allowClear/u);
  assert.match(wrapperSource, /'data-testid': testId/u);
  assert.doesNotMatch(wrapperSource, /type="text"|validColor/u);
  assert.match(
    canvasSource,
    /ORDER_DOCUMENT_NESTED_POPOVER_SELECTOR\s*=\s*[\s\S]*?data-admin-color-palette-portal[\s\S]*?data-order-document-dark-select-portal/u
  );
  assert.match(
    canvasSource,
    /event\.target\.closest\(ORDER_DOCUMENT_NESTED_POPOVER_SELECTOR\)/u
  );
  assert.doesNotMatch(canvasSource, /type="color"/u);
  assert.doesNotMatch(canvasSource, /<aside\b/u);
});
