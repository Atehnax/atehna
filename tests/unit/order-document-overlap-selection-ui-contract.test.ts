import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const canvasSource = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/urejevalnik/components/OrderDocumentTemplateCanvas.tsx'
  ),
  'utf8'
);

function sourceAround(marker: string, radius = 1_800) {
  const markerIndex = canvasSource.indexOf(marker);
  assert.notEqual(markerIndex, -1, `Missing source marker: ${marker}`);
  return canvasSource.slice(
    Math.max(0, markerIndex - radius),
    Math.min(canvasSource.length, markerIndex + marker.length + radius)
  );
}

test('the canvas discovers every selectable layer at the pointer before child handlers stop propagation', () => {
  const canvasMarkup = sourceAround('data-testid="order-document-canvas"', 2_500);
  assert.match(canvasMarkup, /onPointerDownCapture=\{handleCanvasPointerDownCapture\}/u);
  assert.match(canvasMarkup, /onClickCapture=\{handleCanvasClickCapture\}/u);

  const hitTest = sourceAround('const overlapCandidatesAtPoint', 1_400);
  assert.match(hitTest, /document\.elementsFromPoint\(clientX, clientY\)/u);
  assert.match(hitTest, /page\.contains\(node\)/u);
  assert.match(hitTest, /resolveOrderDocumentSelectionCandidatesFromHitStack/u);
  assert.match(hitTest, /getElementLabel:\s*selectionElementLabel/u);
});

test('Ctrl/Cmd remains additive while Alt cycles the overlap stack without breaking drag', () => {
  const handler = sourceAround('const handleCanvasPointerDownCapture', 3_200);
  const modifierGate = handler.indexOf('if (!event.altKey) return;');
  const preventDefault = handler.indexOf('event.preventDefault()', modifierGate);
  assert.ok(modifierGate >= 0, 'Alt modifier gate is required for overlap cycling');
  assert.ok(
    preventDefault > modifierGate,
    'ordinary pointerdown must not be prevented before the modifier-only cycle path'
  );
  assert.doesNotMatch(
    handler,
    /if \(!event\.ctrlKey && !event\.metaKey\) return;/u,
    'Ctrl/Cmd is reserved for additive selection and must not cycle overlaps'
  );
  assert.match(handler, /cycleOrderDocumentSelectionCandidate/u);
  assert.match(handler, /event\.shiftKey\s*\?\s*-1\s*:\s*1/u);
  assert.match(handler, /armNextCanvasClickSuppression\(\)/u);

  const childTarget = sourceAround('function CanvasChildTarget', 5_500);
  assert.match(
    childTarget,
    /useAdditiveSelectionPointerGuard/u,
    'both Ctrl and Cmd must toggle exact child targets'
  );
  assert.match(childTarget, /onSelect\(selection,\s*\{\s*additive:\s*true\s*\}\)/u);
  assert.match(childTarget, /consumeTrailingClick\(\)/u);

  const dragHandler = sourceAround('const handlePointerMove', 4_500);
  assert.match(
    dragHandler,
    /Math\.hypot\(pixelDeltaX, pixelDeltaY\)\s*<\s*DRAG_START_THRESHOLD_PX/u
  );
  assert.match(dragHandler, /setOverlapSelection\(null\)/u);
});

test('the local overlap chooser is a body portal above the clipped A4 canvas', () => {
  const chooser = sourceAround("{typeof document !== 'undefined' && overlapSelection", 7_000);
  assert.match(chooser, /createPortal\s*\(/u);
  assert.match(chooser, /document\.body/u);
  assert.match(chooser, /data-order-document-selection-chrome/u);
  assert.match(chooser, /data-order-document-editor-only/u);
  assert.match(chooser, /className=\{`fixed z-\[2147483646\]/u);
  assert.match(chooser, /onPointerDown=\{\(event\)\s*=>\s*event\.stopPropagation\(\)\}/u);
  assert.match(chooser, /onClick=\{\(event\)\s*=>\s*event\.stopPropagation\(\)\}/u);
});

test('the chooser exposes an accessible trigger, checkbox menu, keyboard movement, and status', () => {
  const chooser = sourceAround('data-order-document-overlap-trigger', 6_000);
  assert.match(chooser, /aria-haspopup="menu"/u);
  assert.match(chooser, /aria-expanded=\{overlapSelection\.open\}/u);
  assert.match(chooser, /Izberi plast \(\{overlapSelection\.candidates\.length\}\)/u);
  assert.match(chooser, /data-order-document-overlap-menu/u);
  assert.match(chooser, /role="menu"/u);
  assert.match(chooser, /role="menuitemcheckbox"/u);
  assert.match(chooser, /aria-checked=\{selected\}/u);
  assert.match(chooser, /selectedCandidateKeys\.has\(candidate\.key\)/u);
  assert.match(chooser, /data-order-document-overlap-candidate-primary=\{primary \|\| undefined\}/u);
  assert.match(chooser, /data-order-document-overlap-candidate-kind=\{candidate\.kind\}/u);
  assert.match(chooser, /candidate\.kind === 'child' \? 'Pod-element' : 'Element'/u);

  const keyboard = sourceAround('const handleOverlapMenuKeyDown', 2_400);
  for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) {
    assert.ok(keyboard.includes(`'${key}'`), `Missing overlap-menu key: ${key}`);
  }
  const escape = sourceAround('const handleKeyDown = (event: KeyboardEvent)', 2_400);
  assert.match(escape, /overlapSelection\?\.open/u);
  assert.match(escape, /overlapTriggerRef\.current\?\.focus\(\)/u);

  const status = sourceAround('data-order-document-overlap-status', 700);
  assert.match(status, /role="status"/u);
  assert.match(status, /aria-live="polite"/u);
  assert.match(status, /\{overlapAnnouncement\}/u);
});

test('hidden, unmatched, and other-page element candidates are identified rather than ambiguous', () => {
  const labels = sourceAround('const selectionElementLabel', 1_500);
  assert.match(labels, /\(skrito\)/u);
  assert.match(labels, /\(pogoj ni izpolnjen\)/u);
  assert.match(labels, /\(ni na tej strani\)/u);
});
