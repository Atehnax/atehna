import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/urejevalnik/components/OrderDocumentTemplateCanvas.tsx'
  ),
  'utf8'
);

test('semantic PDF rows expose direct drag, compact X/Y, and natural-position reset contextually', () => {
  for (const marker of [
    'data-order-document-semantic-row-id',
    'data-order-document-row-placement-controls',
    'order-document-row-x-input',
    'order-document-row-y-input',
    'data-order-document-row-placement-reset'
  ]) {
    assert.ok(source.includes(marker), `Missing semantic-row placement UI: ${marker}`);
  }
  assert.match(source, /beginFieldRowInteraction/u);
  assert.match(source, /setOrderDocumentFieldRowPlacement/u);
  assert.match(source, /resetOrderDocumentFieldRowPlacement/u);
  assert.match(source, /compactGeometryAction=\{selectedChild\?\.kind === 'field_row'\}/u);
  assert.doesNotMatch(source, /<aside\b/u);
});

test('fill, outline, sides, and accent bar share one contextual decoration editor', () => {
  assert.ok(source.includes('data-order-document-decoration-controls'));
  for (const control of ['fill', 'outline', 'accent']) {
    assert.ok(
      source.includes(`data-order-document-decoration-toggle="${control}"`),
      `Missing decoration toggle: ${control}`
    );
  }
  assert.ok(source.includes('data-order-document-decoration-outline-side'));
  assert.ok(source.includes('data-order-document-decoration-accent-side'));
  for (const field of ['outlineWidthPt', 'accentWidthPt', 'paddingPt']) {
    assert.ok(source.includes(`marker="${field}"`), `Missing compact decoration field: ${field}`);
  }
  assert.match(source, /setOrderDocumentDecoration/u);
  assert.match(source, /resetOrderDocumentDecoration/u);
  assert.equal(
    source.match(/function OrderDocumentDecorationControls\s*\(/gu)?.length,
    1,
    'decoration settings must stay in one contextual component'
  );
});
