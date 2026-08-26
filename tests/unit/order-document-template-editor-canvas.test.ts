import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const EDITOR_ROOT = resolve(
  process.cwd(),
  'src/admin/features/urejevalnik'
);

function readTypeScriptSources(directory: string): string {
  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) return readTypeScriptSources(entryPath);
      return /\.tsx?$/u.test(entry.name) ? readFileSync(entryPath, 'utf8') : '';
    })
    .join('\n');
}

const editorSource = readTypeScriptSources(EDITOR_ROOT);

function sourceAround(marker: string, radius = 1_400) {
  const markerIndex = editorSource.indexOf(marker);
  assert.notEqual(markerIndex, -1, `Missing editor source marker: ${marker}`);
  return editorSource.slice(
    Math.max(0, markerIndex - radius),
    Math.min(editorSource.length, markerIndex + marker.length + radius)
  );
}

test('PDF template editor exposes one interactive A4 canvas with editing aids', () => {
  assert.match(editorSource, /\bA4\b/u);
  assert.ok(editorSource.includes('data-testid="order-document-canvas"'));
  assert.ok(editorSource.includes('data-testid="order-document-ruler-horizontal"'));
  assert.ok(editorSource.includes('data-testid="order-document-ruler-vertical"'));
  assert.ok(editorSource.includes('data-testid="order-document-guides"'));

  const snapToggleSource = sourceAround('data-testid="order-document-snap-toggle"');
  assert.match(snapToggleSource, /(?:checked|aria-pressed)=/u);
  assert.match(snapToggleSource, /(?:onChange|onClick)=/u);

  const guidesSource = sourceAround('data-testid="order-document-guides"');
  assert.match(guidesSource, /pointer-events-none|pointerEvents:\s*['"]none['"]/u);
});

test('PDF canvas elements support direct selection, pointer dragging, and resizing', () => {
  const elementSource = sourceAround('data-order-document-element-id={id}', 2_000);
  assert.ok(elementSource.includes('data-order-document-element-selected'));
  assert.match(elementSource, /onClick=/u);

  const dragHandleSource = sourceAround('data-order-document-drag-handle');
  assert.match(dragHandleSource, /onPointerDown=/u);

  const resizeHandleSource = sourceAround('data-order-document-resize-handle');
  assert.match(resizeHandleSource, /onPointerDown=/u);
  assert.match(editorSource, /setPointerCapture|pointerId/u);
});

test('semantic-row numeric geometry controls expose signed page-safe movement bounds', () => {
  const rowXSource = sourceAround('order-document-row-x-input', 1_000);
  assert.match(rowXSource, /resolveOrderDocumentFieldRowPageBounds/u);
  assert.match(rowXSource, /min=\{rowBounds\.minXmm\}/u);
  assert.match(rowXSource, /max=\{rowBounds\.maxXmm\}/u);

  const rowYSource = sourceAround('order-document-row-y-input', 1_000);
  assert.match(rowYSource, /min=\{rowBounds\.minYmm\}/u);
  assert.match(rowYSource, /max=\{rowBounds\.maxYmm\}/u);
  assert.doesNotMatch(rowXSource, /min=\{0\}/u);
  assert.doesNotMatch(rowYSource, /min=\{0\}/u);
});

test('selected-element inspector owns geometry, color, visibility, and logic controls', () => {
  const requiredInspectorControls = [
    'order-document-element-inspector',
    'order-document-element-x',
    'order-document-element-y',
    'order-document-element-width',
    'order-document-element-height',
    'order-document-element-color',
    'order-document-element-visible',
    'order-document-element-logic-controls'
  ];

  for (const testId of requiredInspectorControls) {
    assert.ok(
      editorSource.includes(`data-testid="${testId}"`),
      `Missing selected-element inspector control: ${testId}`
    );
  }

  for (const testId of [
    'order-document-element-x',
    'order-document-element-y',
    'order-document-element-width',
    'order-document-element-height'
  ]) {
    const controlSource = sourceAround(`data-testid="${testId}"`, 700);
    assert.match(controlSource, /value=/u);
    assert.match(controlSource, /onChange=/u);
  }

  const colorSource = sourceAround('data-testid="order-document-element-color"', 700);
  assert.match(colorSource, /ColorField|type="color"/u);
  assert.match(colorSource, /onChange=/u);

  const visibilitySource = sourceAround(
    'data-testid="order-document-element-visible"',
    700
  );
  assert.match(visibilitySource, /(?:checked|aria-pressed)=/u);
  assert.match(visibilitySource, /(?:onChange|onClick)=/u);
});

test('canvas-first inspector preserves the existing PDF visibility and logic inputs', () => {
  assert.ok(editorSource.includes('order-document-template-layout-${field.key}'));
  assert.ok(editorSource.includes('order-document-template-column-${field.key}'));
  assert.ok(editorSource.includes('order-document-template-section-${section.id}'));
  assert.ok(editorSource.includes('order-document-template-section-${section.id}-enabled'));
});
