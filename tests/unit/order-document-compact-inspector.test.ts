import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const canvasSource = readFileSync(resolve(
  process.cwd(),
  'src/admin/features/urejevalnik/components/OrderDocumentTemplateCanvas.tsx'
), 'utf8');
const quickStyleSource = readFileSync(resolve(
  process.cwd(),
  'src/admin/features/urejevalnik/components/OrderDocumentTableQuickStyleControls.tsx'
), 'utf8');
const toolbarPrimitivesSource = readFileSync(resolve(
  process.cwd(),
  'src/admin/features/podoba/components/AppearanceEditorToolbarPrimitives.tsx'
), 'utf8');

function sourceBetween(source: string, startMarker: string, endMarker: string) {
  const startIndex = source.indexOf(startMarker);
  const endIndex = source.indexOf(endMarker, startIndex + startMarker.length);
  assert.notEqual(startIndex, -1, `Missing source marker: ${startMarker}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${endMarker}`);
  return source.slice(startIndex, endIndex);
}

test('toolbar defaults closed and opens a wrapped centered inspector without nested scrolling', () => {
  const toolbar = sourceBetween(
    canvasSource,
    'function OrderDocumentContextToolbar',
    'function OrderDocumentCompanyContactsControls'
  );
  assert.match(toolbar, /initialPanel = null/u);
  assert.match(toolbar, /useState<OrderDocumentToolbarPanel>\(initialPanel\)/u);
  assert.match(toolbar, /data-order-document-selection-summary/u);
  assert.match(toolbar, /aria-live="polite"/u);
  assert.match(toolbar, /data-order-document-toolbar-wrap="visible"/u);
  assert.match(toolbar, /flex-wrap/u);
  assert.match(toolbar, /overflow-visible/u);
  assert.doesNotMatch(toolbar, /overflow-x-/u);
  assert.doesNotMatch(toolbar, /overflow-y-/u);
  assert.doesNotMatch(toolbar, /maxHeight/u);
  assert.match(toolbar, /data-order-document-settings-dialog-layout="centered"/u);
  assert.match(toolbar, /w-\[min\(1180px,calc\(100vw-2rem\)\)\]/u);
  assert.match(toolbar, /data-order-document-settings-surface/u);
  assert.match(toolbar, /data-order-document-settings-scroll="none"/u);
});

test('All view exposes the responsive geometry/content/style/logic grid', () => {
  const toolbar = sourceBetween(
    canvasSource,
    'function OrderDocumentContextToolbar',
    'function OrderDocumentCompanyContactsControls'
  );
  assert.match(toolbar, /all: 'Nastavitve elementa'/u);
  assert.match(toolbar, /data-order-document-toolbar-panel-trigger=\{'all'\}/u);
  assert.match(toolbar, /data-order-document-unified-settings-grid/u);
  assert.match(toolbar, /grid-cols-4 items-start gap-2\.5 max-\[1000px\]:grid-cols-2 max-\[640px\]:grid-cols-1/u);
  assert.match(toolbar, /data-order-document-unified-settings-section=\{key\}/u);
  assert.match(toolbar, /\['geometry', 'content', 'style', 'logic'\]/u);
  assert.match(toolbar, /\['geometry', 'style'\]/u);
});

test('inline typography uses shared dark compact selects and alignment radios for every text target', () => {
  const inline = sourceBetween(
    canvasSource,
    'function OrderDocumentInlineTypographyControls',
    'function CompactDecorationNumber'
  );
  assert.match(inline, /data-order-document-inline-typography/u);
  assert.match(inline, /data-order-document-inline-typography-targets=\{targets\.length\}/u);
  assert.match(inline, /data-order-document-inline-typography-mixed=/u);
  assert.ok((inline.match(/<AppearanceEditorCompactSelect/gu)?.length ?? 0) >= 2);
  assert.match(inline, /order-document\.inline\.font-family/u);
  assert.match(inline, /order-document\.inline\.font-weight/u);
  assert.match(inline, /data-order-document-inline-font-size/u);
  assert.match(inline, /data-order-document-inline-bold/u);
  assert.match(inline, /data-order-document-inline-italic/u);
  assert.match(inline, /data-order-document-inline-alignment/u);
  assert.match(inline, /<AppearanceEditorAlignmentControl/u);
  assert.match(inline, /mixed=\{alignmentMixed\}/u);
  assert.match(inline, /Poravnava izbranih besedil: mešane vrednosti/u);
  assert.match(inline, /data-order-document-inline-style-mixed/u);
  assert.match(inline, />\s*Mešano\s*</u);
  assert.match(canvasSource, /ORDER_DOCUMENT_INLINE_ALIGNMENT_OPTIONS = \[[\s\S]*?'inherit'[\s\S]*?'left'[\s\S]*?'center'[\s\S]*?'right'[\s\S]*?'justify'/u);
  assert.match(inline, /resetOrderDocumentTextAlignmentTargets/u);
  assert.match(inline, /applyOrderDocumentTextAlignmentToTargets/u);
  assert.match(inline, /data-order-document-inline-style-reset/u);
  assert.match(inline, /aria-pressed=\{mixed\.fontWeight\.mixed \? 'mixed'/u);
  assert.match(inline, /aria-pressed=\{mixed\.fontStyle\.mixed \? 'mixed'/u);
  assert.doesNotMatch(inline, /<select\b/u);
});

test('shared alignment radios expose a truthful mixed state without selecting Samodejno', () => {
  const alignment = sourceBetween(
    toolbarPrimitivesSource,
    'export function AppearanceEditorAlignmentControl',
    'export function AppearanceEditorToolbarToneProvider'
  );
  assert.match(alignment, /mixed = false/u);
  assert.match(alignment, /mixed\?: boolean/u);
  assert.match(alignment, /data-appearance-editor-alignment-mixed=\{mixed \|\| undefined\}/u);
  assert.match(alignment, /const active = !mixed && option === value/u);
  assert.match(alignment, /aria-checked=\{active\}/u);
  assert.match(alignment, /tabIndex=\{active \|\| \(mixed && option === options\[0\]\) \? 0 : -1\}/u);
});

test('table quick style is mounted first and receives active, available, and additive scope behavior', () => {
  assert.match(canvasSource, /import OrderDocumentTableQuickStyleControls/u);
  const mapper = sourceBetween(
    canvasSource,
    'const renderTableQuickStyleControls',
    'const renderContentPanel'
  );
  assert.match(mapper, /activeScope/u);
  assert.match(mapper, /availableScopes/u);
  assert.match(mapper, /onSelectScope=\{\(scope, gesture\)/u);
  assert.match(mapper, /selectChild\(selection, gesture\)/u);
  for (const constructor of [
    'tableHeaderChild',
    'tableBodyChild',
    'tableColumnChild',
    'tableRowChild',
    'tableHeaderCellChild',
    'tableCellChild'
  ]) {
    assert.ok(mapper.includes(constructor), `Missing quick-style scope mapper ${constructor}`);
  }

  const styleMount = sourceBetween(
    canvasSource,
    'stylePanel={',
    'logicPanel={multipleSelection'
  );
  const quickIndex = styleMount.indexOf('{renderTableQuickStyleControls()}');
  const typographyIndex = styleMount.indexOf('<OrderDocumentTypographyControls');
  assert.ok(quickIndex >= 0 && typographyIndex > quickIndex);
  assert.match(styleMount, /showAlignment=\{!selectedChild\.kind\.startsWith\('table_'\)\}/u);
  assert.match(quickStyleSource, /data-order-document-table-quick-style/u);
  assert.doesNotMatch(quickStyleSource, /<select\b/u);
});

test('page settings are a responsive compact no-scroll grid', () => {
  const pageSettings = sourceBetween(
    canvasSource,
    'data-order-document-canvas-popover-root="page-settings"',
    '<div className="grid min-w-0 bg-slate-100">'
  );
  assert.match(pageSettings, /data-order-document-settings-surface/u);
  assert.match(pageSettings, /data-order-document-settings-scroll="none"/u);
  assert.match(pageSettings, /w-\[min\(760px,calc\(100vw-3rem\)\)\]/u);
  assert.match(pageSettings, /grid-cols-3/u);
  assert.match(pageSettings, /max-\[900px\]:grid-cols-2/u);
  assert.match(pageSettings, /max-md:grid-cols-1/u);
  assert.doesNotMatch(pageSettings, /overflow-(?:x|y|auto|scroll)/u);
});
