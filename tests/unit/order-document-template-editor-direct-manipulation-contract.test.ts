import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const canvasPath = resolve(
  process.cwd(),
  'src/admin/features/urejevalnik/components/OrderDocumentTemplateCanvas.tsx'
);
const canvasSource = readFileSync(canvasPath, 'utf8');
const domainSource = readFileSync(
  resolve(process.cwd(), 'src/shared/domain/order/orderDocumentTemplates.ts'),
  'utf8'
);
const flowLayoutSource = readFileSync(
  resolve(process.cwd(), 'src/shared/domain/order/orderDocumentFlowLayout.ts'),
  'utf8'
);
const rendererSource = readFileSync(resolve(process.cwd(), 'src/shared/server/pdf.ts'), 'utf8');

function sourceBetween(startMarker: string, endMarker: string, fromIndex = 0) {
  const start = canvasSource.indexOf(startMarker, fromIndex);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  const end = canvasSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing source marker after ${startMarker}: ${endMarker}`);
  return canvasSource.slice(start, end);
}

function sourceAround(marker: string, radius = 1_200) {
  const markerIndex = canvasSource.indexOf(marker);
  assert.notEqual(markerIndex, -1, `Missing source marker: ${marker}`);
  return canvasSource.slice(
    Math.max(0, markerIndex - radius),
    Math.min(canvasSource.length, markerIndex + marker.length + radius)
  );
}

test('PDF child labels are selected on the canvas and edited through one contextual control', () => {
  const selectableLabelSource = sourceAround('data-order-document-label-id={key}');
  assert.match(selectableLabelSource, /on(?:Click|PointerDown)=/u);

  const labelEditSource = sourceAround('data-order-document-label-edit');
  assert.match(labelEditSource, /value=/u);
  assert.match(labelEditSource, /onChange=/u);
});

test('document metadata does not dump every label field into the inspector', () => {
  const inspectorStart = canvasSource.indexOf('const renderContentInspector');
  assert.notEqual(inspectorStart, -1, 'Missing content inspector');
  const metadataBranch = sourceBetween(
    "if (id === 'document_meta')",
    "if (id === 'intro')",
    inspectorStart
  );
  assert.doesNotMatch(metadataBranch, /renderLabelFields\s*\(/u);
  assert.match(metadataBranch, /data-order-document-label-edit/u);
});

test('the authentic logo uses the verified crop and fills its editable rectangle', () => {
  const previewStart = canvasSource.indexOf('function ElementPreview');
  assert.notEqual(previewStart, -1, 'Missing element preview');
  const logoBranch = sourceBetween("if (id === 'logo')", "if (id === 'company')", previewStart);
  assert.match(logoBranch, /<AtehnaDocumentLogo\b/u);
  assert.doesNotMatch(logoBranch, /object-contain|objectFit:\s*['"]contain['"]/u);

  const cropHelper = sourceBetween('function AtehnaDocumentLogo', 'function CanvasChildTarget');
  assert.match(cropHelper, /atehna-document-wordmark\.png/u);
  assert.match(cropHelper, /object-fill/u);
  assert.match(cropHelper, /height:\s*['"]141\.414%['"]/u);
  assert.match(cropHelper, /top:\s*['"]-11\.7845%['"]/u);
  assert.doesNotMatch(cropHelper, /object-contain|objectFit:\s*['"]contain['"]/u);
});

test('PDF canvas uses the shared admin selection outline without changing document stacking', () => {
  assert.match(
    canvasSource,
    /import\s*\{[^}]*adminEditorSelectionOutlineTokenClasses[^}]*\}\s*from\s*['"]@\/shared\/ui\/theme\/tokens['"]/su
  );
  assert.match(
    canvasSource,
    /selected\s*(?:&&|\?)\s*adminEditorSelectionOutlineTokenClasses/u
  );
  assert.doesNotMatch(canvasSource, /zIndex:\s*selected\s*\?\s*2000/u);
});

test('selected PDF elements use the shared floating context toolbar instead of a sidebar', () => {
  assert.match(
    canvasSource,
    /import\s*\{[^}]*FloatingAppearanceEditorContextToolbar[^}]*\}\s*from\s*['"]@\/admin\/features\/podoba\/components\/AppearanceEditorToolbarPrimitives['"]/su
  );
  assert.match(canvasSource, /<FloatingAppearanceEditorContextToolbar\b/u);
  assert.match(canvasSource, /data-canvas-element-id=/u);
  assert.match(canvasSource, /data-order-document-toolbar-popover/u);

  assert.doesNotMatch(canvasSource, /<aside\b/u);
  assert.doesNotMatch(
    canvasSource,
    /grid-cols-\[minmax\(0,1fr\)_(?:280|330)px\]/u
  );
});

test('company contact rows are selectable and managed contextually', () => {
  assert.match(domainSource, /contacts\s*:/u);
  assert.match(canvasSource, /kind === 'contact'\) return companyContactChild/u);

  const contactRowSource = sourceAround('data-order-document-child-id={selection.id}', 5000);
  assert.match(contactRowSource, /on(?:Click|PointerDown)=/u);

  for (const marker of [
    'data-order-document-company-contact-add',
    'data-order-document-company-contact-edit',
    'data-order-document-company-contact-remove',
    'data-order-document-company-contact-reorder'
  ]) {
    assert.ok(canvasSource.includes(marker), `Missing contextual company-contact control: ${marker}`);
  }
});

test('company contact output is data-driven and never hard-codes an always-visible fax row', () => {
  const previewStart = canvasSource.indexOf('function ElementPreview');
  assert.notEqual(previewStart, -1, 'Missing element preview');
  const companyBranch = sourceBetween("if (id === 'company')", "if (id === 'title')", previewStart);
  assert.doesNotMatch(companyBranch, /Fax:|template\.company\.fax/u);
  assert.doesNotMatch(rendererSource, /`Fax:|['"]Fax:/u);
});

test('interactive geometry comes from the current PDF page without an approximate second renderer', () => {
  const previewDerivation = sourceAround('const previewElements = useMemo');
  assert.match(previewDerivation, /previewLayout\?\.regions/u);
  assert.match(previewDerivation, /region\.pageNumber !== currentPage/u);
  assert.match(previewDerivation, /previewElements\[selectedElementId\]/u);
  assert.doesNotMatch(canvasSource, /resolveOrderDocumentFlowPreviewElements/u);
  assert.doesNotMatch(flowLayoutSource, /export function resolveOrderDocumentFlowPreviewElements/u);
});
