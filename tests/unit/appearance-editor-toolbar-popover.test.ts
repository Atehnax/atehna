import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { resolveAppearanceEditorToolbarPopoverPosition } from '@/admin/features/podoba/components/AppearanceEditorToolbarPrimitives';

const viewportRect = { left: 0, top: 0, width: 1200, height: 800 };

test('toolbar popover preserves its preferred side when the measured panel fits', () => {
  assert.deepEqual(
    resolveAppearanceEditorToolbarPopoverPosition({
      anchorRect: { left: 320, top: 400, bottom: 440 },
      panelSize: { width: 360, height: 240 },
      viewportRect,
      preferredPlacement: 'top'
    }),
    { left: 320, top: 154, placement: 'top' }
  );
});

test('toolbar popover flips to the fitting side after measuring its actual height', () => {
  assert.deepEqual(
    resolveAppearanceEditorToolbarPopoverPosition({
      anchorRect: { left: 160, top: 100, bottom: 140 },
      panelSize: { width: 360, height: 240 },
      viewportRect,
      preferredPlacement: 'top'
    }),
    { left: 160, top: 146, placement: 'bottom' }
  );
});

test('toolbar popover clamps both axes to the eight pixel viewport margin', () => {
  assert.deepEqual(
    resolveAppearanceEditorToolbarPopoverPosition({
      anchorRect: { left: 980, top: 760, bottom: 790 },
      panelSize: { width: 440, height: 240 },
      viewportRect,
      preferredPlacement: 'bottom'
    }),
    { left: 752, top: 514, placement: 'top' }
  );

  assert.deepEqual(
    resolveAppearanceEditorToolbarPopoverPosition({
      anchorRect: { left: -40, top: 2, bottom: 32 },
      panelSize: { width: 360, height: 240 },
      viewportRect,
      preferredPlacement: 'top'
    }),
    { left: 8, top: 38, placement: 'bottom' }
  );
});

test('shared toolbar popover stays compact and scrolls internally only when the visual viewport is short', () => {
  const source = readFileSync(
    resolve(
      process.cwd(),
      'src/admin/features/podoba/components/AppearanceEditorToolbarPrimitives.tsx'
    ),
    'utf8'
  );
  const start = source.indexOf('export function AppearanceEditorToolbarPopover({');
  const end = source.indexOf('export type AppearanceEditorToolbarButtonProps', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const component = source.slice(start, end);

  assert.match(component, /role="dialog"/u);
  assert.match(component, /aria-label=\{ariaLabel\}/u);
  assert.match(component, /data-appearance-editor-toolbar-popover-placement=\{position\.placement\}/u);
  assert.match(component, /data-appearance-editor-toolbar-popover-ready=/u);
  assert.match(component, /data-settings-scroll="internal"/u);
  assert.match(component, /w-\[min\(360px,calc\(100dvw-16px\)\)\]/u);
  assert.match(component, /w-\[min\(440px,calc\(100dvw-16px\)\)\]/u);
  assert.match(component, /overflow-x-hidden overflow-y-auto overscroll-contain/u);
  assert.match(
    component,
    /viewportRect\.height - appearanceEditorToolbarPopoverMarginPx \* 2/u
  );
  assert.match(component, /maxHeight: position\.maxHeight \?\? 'calc\(100dvh - 16px\)'/u);
  assert.match(component, /new ResizeObserver\(schedulePosition\)/u);
  assert.match(component, /window\.addEventListener\('resize', schedulePosition\)/u);
  assert.match(component, /window\.addEventListener\('scroll', schedulePosition, true\)/u);
  assert.match(component, /window\.visualViewport\?\.addEventListener\('resize', schedulePosition\)/u);
  assert.match(component, /window\.visualViewport\?\.addEventListener\('scroll', schedulePosition\)/u);
  assert.doesNotMatch(component, /overflow-x-auto|overflow-y-scroll/u);
});
