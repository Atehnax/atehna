import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const canvasSource = readFileSync(resolve(
  process.cwd(),
  'src/admin/features/urejevalnik/components/OrderDocumentTemplateCanvas.tsx'
), 'utf8');

const sourceBetween = (startMarker: string, endMarker: string) => {
  const start = canvasSource.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  const end = canvasSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing source marker after ${startMarker}: ${endMarker}`);
  return canvasSource.slice(start, end);
};

const contextToolbar = sourceBetween(
  'function OrderDocumentContextToolbar',
  'function OrderDocumentCompanyContactsControls'
);

test('substantive element settings use a centered accessible navy dialog', () => {
  assert.match(contextToolbar, /createPortal\s*\(/u);
  assert.match(contextToolbar, /role="dialog"/u);
  assert.match(contextToolbar, /aria-modal="true"/u);
  assert.match(contextToolbar, /aria-labelledby=\{dialogTitleId\}/u);
  assert.match(contextToolbar, /data-order-document-settings-dialog-backdrop/u);
  assert.match(contextToolbar, /data-order-document-settings-dialog-layout="centered"/u);
  assert.match(contextToolbar, /data-order-document-settings-dialog="navy"/u);
  assert.match(contextToolbar, /fixed inset-0[^\n]*place-items-center/u);
  assert.match(contextToolbar, /bg-\[#17212d\]/u);
  assert.match(contextToolbar, /data-order-document-settings-scroll="none"/u);
  assert.doesNotMatch(contextToolbar, /data-order-document-settings-scroll="none"[\s\S]{0,250}overflow-(?:auto|scroll)/u);
});

test('dialog categories are compact, icon-led, and keep typography controls visible', () => {
  assert.match(contextToolbar, /geometry: 'Postavitev'/u);
  assert.match(contextToolbar, /content: 'Vsebina'/u);
  assert.match(contextToolbar, /style: 'Videz'/u);
  assert.match(contextToolbar, /logic: 'Logika'/u);
  assert.match(contextToolbar, /role="toolbar" aria-label="Skupine nastavitev"/u);
  assert.match(contextToolbar, /aria-pressed=\{panel === key\}/u);
  assert.doesNotMatch(contextToolbar, /role="tab"|role="tabpanel"/u);
  assert.match(contextToolbar, /data-order-document-unified-settings-grid/u);
  assert.match(contextToolbar, /data-order-document-unified-settings-section=\{key\}/u);
  assert.match(canvasSource, /grid-cols-\[minmax\(0,1\.35fr\)_minmax\(0,\.9fr\)_4rem\]/u);
  assert.ok((canvasSource.match(/data-order-document-typography-visible-label/gu)?.length ?? 0) >= 6);
  assert.match(canvasSource, />\s*Družina pisave\s*</u);
  assert.match(canvasSource, />\s*Debelina\s*</u);
  assert.match(canvasSource, />\s*Velikost\s*</u);
  assert.match(canvasSource, /data-order-document-typography-control="fontWeightBold"/u);
  assert.match(canvasSource, /data-order-document-typography-control="fontStyle"/u);
  assert.match(canvasSource, /data-order-document-text-alignment-controls/u);
});

test('the settings dialog has explicit rollback and commit actions', () => {
  assert.match(contextToolbar, /data-order-document-settings-dialog-action="cancel-close"/u);
  assert.match(contextToolbar, /data-order-document-settings-dialog-action="cancel"/u);
  assert.match(contextToolbar, /data-order-document-settings-dialog-action="save"/u);
  assert.match(contextToolbar, /onCancelEdit\(\)[\s\S]*?setPanel\(null\)/u);
  assert.match(contextToolbar, /onCommitEdit\(\)[\s\S]*?setPanel\(null\)/u);
  assert.match(canvasSource, /createOrderDocumentInspectorSnapshot\(template, logoConfig\)/u);
  assert.match(canvasSource, /onChange\(snapshot\.template\)/u);
  assert.match(canvasSource, /onLogoConfigChange\(snapshot\.logoConfig\)/u);
});

test('outside click, layered Escape, focus trap, and portaled controls preserve modal behavior', () => {
  assert.match(contextToolbar, /portalRefs: panelPortalRefs/u);
  assert.match(contextToolbar, /ignoreSelector: ORDER_DOCUMENT_NESTED_POPOVER_SELECTOR/u);
  assert.match(contextToolbar, /ignoreEscapeSelector: ORDER_DOCUMENT_NESTED_POPOVER_SELECTOR/u);
  assert.match(contextToolbar, /dismissGroup: 'order-document-settings-dialog'/u);
  assert.match(contextToolbar, /document\.body\.style\.overflow = 'hidden'/u);
  assert.match(contextToolbar, /event\.key !== 'Tab'/u);
  assert.match(contextToolbar, /data-order-document-dialog-initial-focus/u);
});

test('selection keeps inline editing available and does not auto-open a blocking dialog', () => {
  assert.match(contextToolbar, /initialPanel = null/u);
  assert.match(canvasSource, /initialPanel=\{null\}/u);
  assert.match(canvasSource, /data-order-document-inline-style-surface/u);
  assert.match(canvasSource, /data-order-document-inline-typography/u);
});

test('topbar quick-action windows remain anchored instead of becoming modal dialogs', () => {
  for (const marker of [
    'data-testid="order-document-restore-elements"',
    'data-testid="order-document-layers"',
    'data-testid="order-document-page-settings"'
  ]) {
    const index = canvasSource.indexOf(marker);
    assert.notEqual(index, -1, `Missing quick menu: ${marker}`);
    const quickMenu = canvasSource.slice(Math.max(0, index - 500), index + 700);
    assert.match(quickMenu, /className="absolute right-0 top-10/u);
    assert.doesNotMatch(quickMenu, /aria-modal="true"/u);
  }
});
