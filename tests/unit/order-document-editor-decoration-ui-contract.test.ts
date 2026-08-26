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

test('canvas decoration preview uses the shared resolver without hardcoded intro or total ink', () => {
  assert.match(source, /resolveOrderDocumentDecoration\(template/u);
  assert.match(
    source,
    /resolveOrderDocumentDecorationPreviewStyle\(\s*elementDecoration,\s*elementDecorationInsetPt/u
  );
  assert.match(source, /resolveOrderDocumentDecorationContentInset/u);
  assert.ok(source.includes('data-order-document-decoration-content-centered'));
  assert.ok(source.includes('data-order-document-decoration-content-inset-pt'));
  assert.match(
    source,
    /const centerElementText = id === 'intro'\s*&& hasOrderDocumentDecorationContentFrame\(elementDecoration\)/u,
    'only the direct Intro text box may center at parent-element level'
  );
  assert.doesNotMatch(
    source,
    /TEXT_STACK_ELEMENT_IDS/u,
    'composite parent frames must retain their established row flow'
  );
  assert.doesNotMatch(source, /borderLeftColor:\s*accentColor/u);
  assert.doesNotMatch(source, /row\.id === 'total'\s*\?\s*\{\s*borderColor/u);
  assert.ok(source.includes('data-order-document-editor-only-hidden-state'));
  assert.ok(source.includes('samo urejevalnik'));
});

test('Datum is rendered by Podatki naročila while the title keeps only title content', () => {
  assert.doesNotMatch(source, /row\.id === 'issue_date'[\s\S]{0,500}group="title"/u);
  assert.match(
    source,
    /id === 'document_meta'[\s\S]{0,500}resolveOrderDocumentMetadataRows/u
  );
  assert.match(
    source,
    /row\.id === 'document_number'[\s\S]{0,500}className="ml-5 shrink-0 text-right"/u
  );
});
