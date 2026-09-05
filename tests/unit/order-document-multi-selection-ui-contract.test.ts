import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const canvasSource = readFileSync(resolve(
  process.cwd(),
  'src/admin/features/urejevalnik/components/OrderDocumentTemplateCanvas.tsx'
), 'utf8');
const tableControlsSource = readFileSync(resolve(
  process.cwd(),
  'src/admin/features/urejevalnik/components/OrderDocumentTableContextControls.tsx'
), 'utf8');
const decorationPreviewSource = readFileSync(resolve(
  process.cwd(),
  'src/admin/features/urejevalnik/lib/orderDocumentDecorationPreview.ts'
), 'utf8');

function sourceAround(source: string, marker: string, radius = 2_500) {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `Missing source marker: ${marker}`);
  return source.slice(
    Math.max(0, markerIndex - radius),
    Math.min(source.length, markerIndex + marker.length + radius)
  );
}

function sourceBetween(source: string, startMarker: string, endMarker: string) {
  const startIndex = source.indexOf(startMarker);
  const endIndex = source.indexOf(endMarker, startIndex + startMarker.length);
  assert.notEqual(startIndex, -1, `Missing source marker: ${startMarker}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${endMarker}`);
  return source.slice(startIndex, endIndex);
}

test('Ctrl/Cmd toggles every selectable kind while ordinary selection remains replace', () => {
  const state = sourceAround(canvasSource, 'const selectElement', 2_600);
  assert.match(state, /reduceOrderDocumentCanvasSelection/u);
  assert.match(state, /type:\s*gesture\.additive\s*\?\s*'toggle'\s*:\s*'replace'/u);

  const guard = sourceAround(canvasSource, 'function useAdditiveSelectionPointerGuard', 3_200);
  assert.match(guard, /event\.ctrlKey && !event\.metaKey/u);
  assert.match(guard, /event\.preventDefault\(\)/u);
  assert.match(guard, /event\.stopPropagation\(\)/u);
  assert.match(guard, /onAdditiveSelect\(\)/u);
  assert.match(guard, /consumeTrailingClick/u);

  const child = sourceAround(canvasSource, 'function CanvasChildTarget', 4_800);
  assert.match(child, /useAdditiveSelectionPointerGuard/u);
  assert.match(child, /onSelect\(selection,\s*\{\s*additive:\s*true\s*\}\)/u);
  assert.match(child, /handlePointerDown\(event\)/u);
  assert.match(child, /consumeTrailingClick\(\)/u);

  const semanticRow = sourceAround(canvasSource, 'const beginFieldRowInteraction', 2_000);
  assert.match(semanticRow, /if \(event\.ctrlKey \|\| event\.metaKey\)/u);
  assert.match(semanticRow, /event\.preventDefault\(\)/u);
  assert.match(semanticRow, /selectChild\(selection,\s*\{\s*additive:\s*true\s*\}\)/u);
  assert.match(semanticRow, /armNextCanvasClickSuppression\(\)/u);

  const topLevel = sourceAround(canvasSource, 'const beginInteraction', 2_600);
  assert.match(topLevel, /event\.ctrlKey \|\| event\.metaKey/u);
  assert.match(topLevel, /selectElement\(id,\s*\{\s*additive:\s*true\s*\}\)/u);
  assert.match(topLevel, /armNextCanvasClickSuppression\(\)/u);

  const topLevelMarkup = sourceAround(canvasSource, 'data-order-document-element-id={id}', 2_000);
  assert.match(
    topLevelMarkup,
    /selectElement\(id,\s*\{\s*additive:\s*event\.ctrlKey\s*\|\|\s*event\.metaKey\s*\}\)/u
  );
  assert.match(canvasSource, /data-order-document-selection-count=\{selectionEntries\.length\}/u);
  assert.match(canvasSource, /data-testid="order-document-selection-count"/u);
});

test('batch typography is mounted, reports mixed values, and applies or resets every compatible target', () => {
  const controls = sourceAround(canvasSource, 'function OrderDocumentBatchTypographyControls', 9_000);
  assert.match(controls, /resolveOrderDocumentMixedTypography/u);
  assert.match(controls, /applyOrderDocumentTypographyToTargets/u);
  assert.match(controls, /resetOrderDocumentTypographyTargets/u);
  assert.match(controls, /data-order-document-typography-batch=\{targets\.length\}/u);
  assert.match(controls, /data-order-document-typography-mixed=/u);
  assert.match(controls, /Različno/u);
  assert.match(controls, /Različne vrednosti/u);

  const mount = sourceAround(canvasSource, '<OrderDocumentBatchTypographyControls', 2_200);
  assert.match(mount, /multipleSelection/u);
  assert.match(mount, /selectedTypographyTargets\.length > 0/u);
  assert.match(mount, /targets=\{selectedTypographyTargets\}/u);
  assert.match(canvasSource, /data-order-document-multi-selection-geometry/u);
});

test('batch font-family edits remain sparse and do not freeze inherited size or unchanged faces', () => {
  const controls = sourceAround(canvasSource, 'function OrderDocumentBatchTypographyControls', 9_000);
  assert.doesNotMatch(
    controls,
    /setOrderDocumentTypography\(next,\s*target,\s*supported\)/u,
    'changing only the family must not persist the full resolved typography object'
  );
  assert.match(controls, /setOrderDocumentTypography\(next,\s*target,\s*\{/u);
  assert.match(controls, /fontFamily/u);
  assert.match(controls, /supported\.fontWeight === current\.fontWeight/u);
  assert.match(controls, /supported\.fontStyle === current\.fontStyle/u);
});

test('alignment toolbar exposes automatic and all four persisted alignments as an accessible exclusive group', () => {
  const controls = sourceAround(canvasSource, 'function TextAlignmentButtons', 7_500);
  assert.match(
    canvasSource,
    /TEXT_ALIGNMENT_OPTIONS = \['left', 'center', 'right', 'justify'\]/u
  );
  assert.match(controls, /role="radiogroup"/u);
  assert.match(controls, /aria-label=\{`Poravnava besedila/u);
  assert.match(controls, /data-order-document-text-alignment="auto"/u);
  assert.match(controls, /TEXT_ALIGNMENT_OPTIONS\.map/u);
  assert.match(controls, /role="radio"/u);
  assert.match(controls, /aria-checked/u);
  assert.match(controls, /ArrowLeft/u);
  assert.match(controls, /querySelectorAll<HTMLButtonElement>\('\[role="radio"\]'\)/u);
  assert.match(controls, /tabIndex=\{/u);
  assert.match(controls, /Samodejno/u);
  assert.match(controls, /oznaka levo in vrednost desno/u);
  assert.match(controls, /Obojestransko/u);
  for (const icon of ['AlignLeft', 'AlignCenter', 'AlignRight', 'AlignJustify']) {
    assert.ok(controls.includes(`<${icon}`), `Missing alignment icon ${icon}`);
  }
});

test('single and multi-selection alignment changes use sparse domain APIs for every text target', () => {
  const single = sourceAround(canvasSource, 'function OrderDocumentTypographyControls', 13_000);
  assert.match(single, /resolveOrderDocumentTextAlignment/u);
  assert.match(single, /getOrderDocumentTextAlignmentOverride/u);
  assert.match(single, /setOrderDocumentTextAlignment/u);
  assert.match(single, /resetOrderDocumentTextAlignment/u);

  const batch = sourceAround(canvasSource, 'function OrderDocumentBatchTypographyControls', 13_000);
  assert.match(batch, /resolveOrderDocumentMixedTextAlignment/u);
  assert.match(batch, /applyOrderDocumentTextAlignmentToTargets/u);
  assert.match(batch, /resetOrderDocumentTextAlignmentTargets/u);
  assert.match(batch, /batchCount=\{targets\.length\}/u);
  assert.match(batch, /aria-pressed=\{mixed\.fontWeight\.mixed[\s\S]*?'mixed'/u);
  assert.match(batch, /aria-pressed=\{mixed\.fontStyle\.mixed[\s\S]*?'mixed'/u);
});

test('table header, body, and row scopes have a keyboard activation path', () => {
  const group = sourceAround(canvasSource, 'function CanvasGroupTarget', 6_000);
  assert.match(group, /data-order-document-table-scope-keyboard-handle=\{selection\.kind\}/u);
  assert.match(group, /type="button"/u);
  assert.match(group, /aria-label=\{groupLabel\}/u);
  assert.match(group, /focus:not-sr-only/u);
  assert.match(group, /additive:\s*event\.ctrlKey\s*\|\|\s*event\.metaKey/u);
});

test('table text scopes expose header, body, whole column, row, and exact cells', () => {
  const scopes = sourceAround(canvasSource, 'const renderTableTypographyScopeControls', 4_500);
  for (const label of [
    'Glava tabele',
    'Vrstice izdelkov',
    'Cel stolpec',
    'Ta naslovna celica',
    'Ta celica'
  ]) {
    assert.ok(scopes.includes(label), `Missing discoverable table scope: ${label}`);
  }
  for (const kind of [
    'table_header',
    'table_body',
    'table_column',
    'table_row',
    'table_header_cell',
    'table_cell'
  ]) {
    assert.ok(canvasSource.includes(`kind: '${kind}'`), `Missing table target kind: ${kind}`);
  }
  assert.match(scopes, /<CanvasTableScopeSelectionButton/u);
  assert.match(scopes, /selection=\{scope\.selection\}/u);
  assert.match(scopes, /onSelect=\{selectChild\}/u);
  assert.match(scopes, /Ctrl\/Cmd \+ klik/u);

  const scopeButton = sourceAround(
    canvasSource,
    'function CanvasTableScopeSelectionButton',
    3_000
  );
  assert.match(scopeButton, /data-order-document-table-typography-scope=\{selection\.kind\}/u);
  assert.match(scopeButton, /aria-pressed=\{active\}/u);
  assert.match(scopeButton, /useAdditiveSelectionPointerGuard/u);
  assert.match(scopeButton, /onSelect\(selection,\s*\{\s*additive:\s*true\s*\}\)/u);
  assert.match(scopeButton, /additive:\s*event\.ctrlKey\s*\|\|\s*event\.metaKey/u);
});

test('all selected layers remain visible and the overlap chooser uses checkbox semantics', () => {
  const elements = sourceAround(canvasSource, 'data-order-document-element-id={id}', 2_000);
  assert.match(elements, /const selected = selectedElementIdSet\.has\(id\)/u);
  assert.match(elements, /data-order-document-element-selected=\{selected \|\| undefined\}/u);

  const chooser = sourceAround(canvasSource, 'role="menuitemcheckbox"', 3_500);
  assert.match(chooser, /selectedCandidateKeys\.has\(candidate\.key\)/u);
  assert.match(chooser, /aria-checked=\{selected\}/u);
  assert.match(chooser, /data-order-document-overlap-candidate-primary=\{primary \|\| undefined\}/u);
  assert.match(chooser, /Glavni izbor/u);

  const group = sourceAround(canvasSource, 'function CanvasGroupTarget', 2_500);
  assert.match(group, /role="group"/u);
  assert.doesNotMatch(group, /role="button"/u);
  assert.match(canvasSource, /aria-live="polite"/u);
});

test('child-only table selections cannot invoke destructive parent-element actions', () => {
  const toolbar = sourceAround(canvasSource, 'function OrderDocumentContextToolbar', 12_000);
  assert.match(toolbar, /data-order-document-parent-actions-enabled=\{showElementActions \|\| undefined\}/u);
  assert.match(toolbar, /\{showElementActions \? \(/u);
  assert.match(toolbar, /data-testid=.order-document-element-delete./u);

  const mount = sourceAround(canvasSource, '<OrderDocumentContextToolbar', 7_500);
  assert.match(
    mount,
    /showElementActions=\{!selectedChild \|\| selectedElementIds\.length > 0\}/u,
    'table cells and other child-only selections must not expose hide, lock, or delete for their parent'
  );
  assert.match(mount, /selectedChild\?\.kind\.startsWith\('table_'\)/u);
  assert.match(mount, /Polo[^\n]+tabele[^\n]+izbran le obseg besedila/u);
});

test('multi-drag preserves selection, moves a bounded common group, and suppresses the trailing click', () => {
  const begin = sourceAround(canvasSource, 'const beginInteraction', 4_000);
  assert.match(begin, /groupStarts/u);
  assert.match(begin, /selectedElementIdSet\.has\(id\)/u);
  assert.match(begin, /selectedElementIds\.filter\(\(selectedId\) =>[\s\S]{0,180}!previewElements\[selectedId\]\.locked/u);

  assert.match(begin, /!isSplitFlowElement\(selectedId\)/u);

  const move = sourceAround(canvasSource, 'if (interaction.kind === \'move\')', 5_000);
  assert.match(move, /Object\.entries\(interaction\.groupStarts\)/u);
  assert.match(move, /dependents/u);
  assert.match(move, /excludedIds/u);

  const finish = sourceAround(canvasSource, 'const endInteraction', 9_000);
  assert.match(
    finish,
    /interaction\.groupStarts/u,
    'the common delta must be persisted for every selected start, not only the primary'
  );
  assert.match(
    finish,
    /suppressNextCanvasClickRef\.current\s*=\s*true/u,
    'a successful move must not emit a trailing click that collapses the selection'
  );
});

test('modified semantic-row activation is additive and multi-row movement commits atomically', () => {
  const semantic = sourceAround(canvasSource, 'function CanvasSemanticRowTarget', 7_000);
  assert.match(
    semantic,
    /select\(\{\s*additive:\s*event\.ctrlKey\s*\|\|\s*event\.metaKey\s*\}\)/u
  );
  assert.match(semantic, /event\.key !== 'Enter' && event\.key !== ' '/u);

  const begin = sourceAround(canvasSource, 'const beginFieldRowInteraction', 7_000);
  assert.match(begin, /if \(event\.ctrlKey \|\| event\.metaKey\)/u);
  assert.match(begin, /const selectedRows = selectionEntries\.flatMap/u);
  assert.match(begin, /selectedChildIds\.includes\(selection\.id\)\s*\? selectedRows\s*:\s*\[selection\]/u);
  assert.match(begin, /entries,\s*pointerId/u);

  const movement = sourceAround(
    canvasSource,
    'setTransientFieldRowPlacements(fieldRowInteraction.entries.map',
    2_800
  );
  assert.match(movement, /const deltaX = assisted\.xMm - primaryOrigin\.xMm/u);
  assert.match(movement, /const deltaY = assisted\.yMm - primaryOrigin\.yMm/u);
  assert.match(movement, /clampOrderDocumentFieldRowToPage/u);

  const finish = sourceAround(canvasSource, 'const endInteraction', 3_000);
  const rowBranchEnd = finish.indexOf('const interaction = interactionRef.current');
  assert.ok(rowBranchEnd > 0);
  const rowBranch = finish.slice(0, rowBranchEnd);
  const loopIndex = rowBranch.indexOf('for (const placement of latest)');
  const setIndex = rowBranch.indexOf('setOrderDocumentFieldRowPlacement', loopIndex);
  const commitIndex = rowBranch.indexOf('onChange(next)', setIndex);
  assert.ok(loopIndex >= 0 && setIndex > loopIndex && commitIndex > setIndex);
  assert.equal(
    rowBranch.slice(loopIndex, commitIndex).match(/onChange\(/gu)?.length ?? 0,
    0,
    'all row placements must be assembled before the single template commit'
  );
});

test('exact table cells keep shared inline controls and expose the unified inspector explicitly', () => {
  const mount = sourceAround(canvasSource, '<OrderDocumentContextToolbar', 10_000);
  const toolbar = sourceBetween(
    canvasSource,
    'function OrderDocumentContextToolbar',
    'function OrderDocumentCompanyContactsControls'
  );
  assert.match(mount, /initialPanel=\{null\}/u);
  assert.match(mount, /inlineStyleControls=\{selectedTypographyTargets\.length > 0/u);
  assert.match(toolbar, /data-order-document-toolbar-panel-trigger=\{'all'\}/u);
  assert.match(toolbar, /onClick=\{\(\) => togglePanel\('all'\)\}/u);
  assert.match(
    mount,
    /selectedChild && selectedTypographyTarget[\s\S]*?<OrderDocumentTypographyControls/u
  );
  assert.match(mount, /data-order-document-multi-selection-compatible-move/u);
  assert.match(mount, /data-order-document-multi-selection-style-summary/u);
  assert.match(mount, /selectedTypographyTargets\.length < selectionEntries\.length/u);
});

test('the dense centered modal uses portaled compact selects without a nested settings scrollbar', () => {
  const darkSelect = sourceAround(canvasSource, 'function CompactDarkSelect', 8_000);
  assert.doesNotMatch(darkSelect, /<select\b/u);
  assert.match(darkSelect, /createPortal\(/u);
  assert.match(darkSelect, /multiColumn \? 'grid-cols-2' : 'grid-cols-1'/u);
  assert.match(darkSelect, /typographyControlClassName/u);

  const toolbar = sourceBetween(
    canvasSource,
    'function OrderDocumentContextToolbar',
    'function OrderDocumentCompanyContactsControls'
  );
  assert.match(toolbar, /data-order-document-settings-dialog-backdrop/u);
  assert.match(toolbar, /data-order-document-settings-dialog-layout="centered"/u);
  assert.match(toolbar, /data-order-document-settings-dialog="navy"/u);
  assert.match(toolbar, /w-\[min\(1180px,calc\(100vw-2rem\)\)\]/u);
  assert.match(toolbar, /data-order-document-settings-scroll="none"/u);
  assert.ok((toolbar.match(/overflow-visible/gu)?.length ?? 0) >= 2);
  assert.doesNotMatch(toolbar, /overflow-x-/u);
  assert.doesNotMatch(toolbar, /overflow-y-auto/u);
  assert.doesNotMatch(toolbar, /maxHeight/u);
});

test('row-height controls preserve typography-only row overrides', () => {
  const setHeight = sourceAround(tableControlsSource, 'const setSelectedRowHeight', 2_400);
  assert.match(setHeight, /\.\.\.existing/u);
  assert.doesNotMatch(
    setHeight,
    /\.filter\(\(override\) => override\.rowNumber !== selectedRow\)\s*\.concat\(\{ rowNumber: selectedRow, heightPt/u
  );
  assert.doesNotMatch(
    tableControlsSource,
    /rowHeightOverrides:\s*\[\]/u,
    'equalizing geometry must not erase saved row typography'
  );
  assert.match(tableControlsSource, /remaining\.typography \|\| remaining\.textAlign/u);
  assert.match(tableControlsSource, /removeOrderDocumentTableRowHeight/u);
});
