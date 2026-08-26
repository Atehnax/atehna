import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const canvasSource = source(
  'src/admin/features/urejevalnik/components/OrderDocumentTemplateCanvas.tsx'
);
const editorSource = source(
  'src/admin/features/urejevalnik/components/AdminOrderDocumentTemplateEditor.tsx'
);
const dismissSource = source('src/shared/ui/dropdown/use-dropdown-dismiss.ts');
const colorFieldSource = source('src/shared/ui/admin-controls/CompactHexColorField.tsx');

function sourceBetween(
  wholeSource: string,
  startMarker: string,
  endMarker: string,
  fromIndex = 0
) {
  const start = wholeSource.indexOf(startMarker, fromIndex);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  const end = wholeSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing source marker after ${startMarker}: ${endMarker}`);
  return wholeSource.slice(start, end);
}

function sourceAround(wholeSource: string, marker: string, radius = 900) {
  const markerIndex = wholeSource.indexOf(marker);
  assert.notEqual(markerIndex, -1, `Missing source marker: ${marker}`);
  return wholeSource.slice(
    Math.max(0, markerIndex - radius),
    Math.min(wholeSource.length, markerIndex + marker.length + radius)
  );
}

function hookCallFor(openState: string) {
  const marker = `open: ${openState}`;
  const markerIndex = canvasSource.indexOf(marker);
  assert.notEqual(markerIndex, -1, `Missing dismissal state: ${marker}`);
  const callStart = canvasSource.lastIndexOf('useDropdownDismiss(', markerIndex);
  assert.notEqual(callStart, -1, `Missing useDropdownDismiss call for ${openState}`);
  return canvasSource.slice(callStart, Math.min(canvasSource.length, markerIndex + 900));
}

test('the shared dismiss primitive closes outside while preserving registered roots and ignored portals', () => {
  const pointerHandler = sourceBetween(
    dismissSource,
    'const handlePointerDown',
    'const handleEscape'
  );
  const layerIndex = pointerHandler.indexOf('isTopmostDropdownDismissLayer');
  const rootsIndex = pointerHandler.indexOf('currentRoots()');
  const pathIndex = pointerHandler.indexOf('event.composedPath()');
  const classifyIndex = pointerHandler.indexOf('shouldDismissDropdownPointer');
  const closeIndex = pointerHandler.indexOf('onCloseRef.current()');
  assert.ok(layerIndex >= 0, 'only the top transient layer may own outside dismissal');
  assert.ok(rootsIndex > layerIndex, 'registered trigger, panel, and portal roots must be resolved');
  assert.ok(pathIndex > rootsIndex, 'outside dismissal must inspect the composed event path');
  assert.ok(classifyIndex > pathIndex, 'inside and ignored portal paths must remain interactive');
  assert.ok(closeIndex > classifyIndex, 'only a classified outside target may close');
  assert.match(dismissSource, /window\.addEventListener\('pointerdown', handlePointerDown, true\)/u);
  assert.match(dismissSource, /window\.addEventListener\('keydown', handleEscape, true\)/u);
  assert.match(
    dismissSource,
    /dropdownDismissPathMatchesSelector\(event\.composedPath\(\), ignoreEscapeSelector\)/u
  );
  assert.match(dismissSource, /returnFocusRef\?\.current\s*\?\?\s*focusOriginRef\.current/u);
});

test('all three canvas topbar windows use dedicated roots and the shared dismiss primitive', () => {
  assert.match(
    canvasSource,
    /import\s*\{\s*useDropdownDismiss\s*\}\s*from\s*['"]@\/shared\/ui\/dropdown\/use-dropdown-dismiss['"]/u
  );

  const windows = [
    {
      state: 'restoreElementsOpen',
      setter: 'setRestoreElementsOpen',
      root: 'restore-elements',
      testId: 'order-document-restore-elements'
    },
    {
      state: 'layersOpen',
      setter: 'setLayersOpen',
      root: 'layers',
      testId: 'order-document-layers'
    },
    {
      state: 'pageSettingsOpen',
      setter: 'setPageSettingsOpen',
      root: 'page-settings',
      testId: 'order-document-page-settings'
    }
  ] as const;

  for (const window of windows) {
    const call = hookCallFor(window.state);
    assert.match(call, /refs\s*:/u, `${window.root} must register its inside boundary`);
    assert.match(call, /returnFocusRef\s*:/u, `${window.root} must restore its own trigger`);
    assert.match(call, /dismissGroup:\s*ORDER_DOCUMENT_CANVAS_POPOVER_DISMISS_GROUP/u);
    assert.match(
      call,
      /ignoreSelector:\s*ORDER_DOCUMENT_NESTED_POPOVER_SELECTOR/u,
      `${window.root} must preserve nested portals`
    );
    assert.match(
      call,
      /ignoreEscapeSelector:\s*ORDER_DOCUMENT_NESTED_POPOVER_SELECTOR/u,
      `${window.root} must let a nested portal own the first Escape`
    );
    assert.match(
      call,
      new RegExp(`${window.setter}\\(false\\)`, 'u'),
      `${window.root} must close through its state owner`
    );

    const root = sourceAround(
      canvasSource,
      `data-order-document-canvas-popover-root="${window.root}"`,
      350
    );
    assert.match(root, /ref=\{[^}]+\}/u, `${window.root} must own a narrow DOM ref`);
    assert.ok(
      canvasSource.includes(`data-testid="${window.testId}"`),
      `Missing stable panel test id: ${window.testId}`
    );
    assert.match(root, /\bpopover\b/u, `${window.root} must opt into trigger semantics`);
  }

  assert.match(
    canvasSource,
    /data-order-document-canvas-popover-trigger=\{popover \|\| undefined\}/u,
    'the shared topbar button must emit a stable trigger marker for every popover instance'
  );
  assert.ok(
    (canvasSource.match(/data-order-document-canvas-popover-panel/gu)?.length ?? 0) >= 3,
    'each topbar window needs a stable panel marker'
  );
  assert.equal((canvasSource.match(/data-order-document-canvas-popover-dismiss="outside-pointer"/gu)?.length ?? 0), 3);
  assert.equal((canvasSource.match(/data-order-document-canvas-popover-group="toolbar"/gu)?.length ?? 0), 3);
});

test('opening a canvas topbar peer closes the two previously eligible windows', () => {
  const restoreTrigger = sourceBetween(
    canvasSource,
    'label="Dodaj izbrisan element"',
    '{restoreElementsOpen ?'
  );
  assert.match(restoreTrigger, /setLayersOpen\(false\)/u);
  assert.match(restoreTrigger, /setPageSettingsOpen\(false\)/u);

  const layersTrigger = sourceBetween(
    canvasSource,
    'label="Elementi dokumenta"',
    '{layersOpen ?'
  );
  assert.match(layersTrigger, /setRestoreElementsOpen\(false\)/u);
  assert.match(layersTrigger, /setPageSettingsOpen\(false\)/u);

  const pageTrigger = sourceBetween(
    canvasSource,
    'label="Nastavitve strani"',
    '{pageSettingsOpen ?'
  );
  assert.match(pageTrigger, /setLayersOpen\(false\)/u);
  assert.match(pageTrigger, /setRestoreElementsOpen\(false\)/u);
});

test('contextual inspector windows share dismissal and restore focus to their own trigger', () => {
  const contextToolbar = sourceBetween(
    canvasSource,
    'function OrderDocumentContextToolbar',
    'function OrderDocumentCompanyContactsControls'
  );

  assert.match(contextToolbar, /useDropdownDismiss\s*\(/u);
  assert.match(contextToolbar, /ignoreSelector:\s*ORDER_DOCUMENT_NESTED_POPOVER_SELECTOR/u);
  assert.match(contextToolbar, /data-order-document-toolbar-panel-trigger/u);
  assert.match(contextToolbar, /data-order-document-toolbar-popover/u);
  assert.match(
    contextToolbar,
    /querySelector<HTMLElement>\([\s\S]*?data-order-document-toolbar-panel-trigger[\s\S]*?\.focus\(\)/u,
    'Escape dismissal must return keyboard focus to the contextual trigger'
  );
});

test('compact dark selects stay inside the contextual window and own their first Escape', () => {
  const darkSelect = sourceBetween(
    canvasSource,
    'function CompactDarkSelect',
    'const TEXT_ALIGNMENT_LABELS'
  );
  assert.match(darkSelect, /const listboxId = useId\(\)/u);
  assert.match(darkSelect, /aria-haspopup="listbox"/u);
  assert.match(darkSelect, /aria-expanded=\{open\}/u);
  assert.match(darkSelect, /aria-controls=\{listboxId\}/u);
  assert.match(darkSelect, /id=\{listboxId\}/u);
  assert.match(darkSelect, /role="listbox"/u);
  assert.match(darkSelect, /role="option"/u);
  assert.match(darkSelect, /aria-selected=\{option\.value === value\}/u);
  assert.doesNotMatch(darkSelect, /<select\b/u);

  const portalIndex = darkSelect.indexOf('data-order-document-dark-select-portal');
  assert.ok(portalIndex >= 0, 'the listbox must identify its portaled root');
  const portal = darkSelect.slice(portalIndex);
  assert.match(portal, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/u);
  const escapeIndex = portal.indexOf("if (event.key === 'Escape')");
  const optionChangeIndex = portal.indexOf('onChange(option.value)');
  assert.ok(escapeIndex >= 0 && optionChangeIndex > escapeIndex);
  const escape = portal.slice(escapeIndex, optionChangeIndex);
  const stopIndex = escape.indexOf('event.stopPropagation()');
  const closeIndex = escape.indexOf('setOpen(false)');
  const focusIndex = escape.indexOf('triggerRef.current?.focus()');
  assert.ok(stopIndex >= 0 && stopIndex < closeIndex);
  assert.ok(closeIndex < focusIndex, 'Escape must close the listbox before restoring its trigger');

  const option = sourceAround(portal, 'onChange(option.value)', 280);
  assert.ok(option.indexOf('onChange(option.value)') < option.indexOf('setOpen(false)'));
  assert.ok(option.indexOf('setOpen(false)') < option.indexOf('triggerRef.current?.focus()'));

  const nestedSelector = sourceAround(
    canvasSource,
    'ORDER_DOCUMENT_NESTED_POPOVER_SELECTOR',
    350
  );
  assert.match(nestedSelector, /data-admin-color-palette-portal/u);
  assert.match(nestedSelector, /data-order-document-dark-select-portal/u);
});

test('Escape dismisses the nested surface before canvas selection can be cleared', () => {
  const selector = sourceAround(
    canvasSource,
    'ORDER_DOCUMENT_NESTED_POPOVER_SELECTOR',
    1_000
  );
  assert.match(selector, /data-admin-color-palette-portal/u);
  assert.match(selector, /data-order-document-dark-select-portal/u);
  assert.match(selector, /data-order-document-canvas-popover-root/u);
  assert.match(selector, /data-order-document-toolbar-popover/u);

  const escapeHandler = sourceBetween(
    canvasSource,
    'const handleKeyDown = (event: KeyboardEvent)',
    "window.addEventListener('keydown', handleKeyDown"
  );
  const clearSelectionIndex = escapeHandler.indexOf('setSelectionEntries([])');
  assert.ok(clearSelectionIndex >= 0, 'the final Escape fallback should still clear selection');
  const beforeSelectionFallback = escapeHandler.slice(0, clearSelectionIndex);
  assert.match(beforeSelectionFallback, /ORDER_DOCUMENT_NESTED_POPOVER_SELECTOR/u);
  for (const openState of ['restoreElementsOpen', 'layersOpen', 'pageSettingsOpen']) {
    assert.ok(
      beforeSelectionFallback.includes(openState),
      `${openState} must stop Escape from falling through to selection clearing`
    );
  }

  const paletteEscape = sourceAround(colorFieldSource, 'onKeyDownCapture={(event) =>', 550);
  const paletteCloseIndex = paletteEscape.indexOf('closePalette(true)');
  assert.match(paletteEscape, /event\.key !== 'Escape'/u);
  assert.ok(paletteEscape.indexOf('event.stopPropagation()') < paletteCloseIndex);
  assert.ok(paletteCloseIndex >= 0, 'the first Escape must close the palette itself');
});

test('template and preview-mode switches remount the canvas without stale open windows', () => {
  assert.match(
    editorSource,
    /viewMode === 'canvas'[\s\S]*?<OrderDocumentTemplateCanvas\s+key=\{selectedType\}/u
  );
  assert.match(editorSource, /setSelectedType\(type\)/u);
  assert.match(editorSource, /setViewMode\('pdf'\)/u);
  assert.match(editorSource, /setViewMode\('canvas'\)/u);
});
