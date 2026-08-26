import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const primitivesSource = source(
  'src/admin/features/podoba/components/AppearanceEditorToolbarPrimitives.tsx'
);
const hiddenFlagSource = source(
  'src/shared/ui/product-canvas/CanvasHiddenElementFlag.tsx'
);
const landingSource = source(
  'src/admin/features/podoba/components/AdminLandingPageClient.tsx'
);
const navigationSource = source(
  'src/admin/features/podoba/components/AdminNavigationPageClient.tsx'
);
const categorySource = source(
  'src/shared/features/category-showcase/CategoryShowcaseEditor.tsx'
);
const headerFilterSource = source('src/shared/ui/admin-header-filter.tsx');

function sourceBetween(whole: string, startMarker: string, endMarker: string) {
  const start = whole.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  const end = whole.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing source marker after ${startMarker}: ${endMarker}`);
  return whole.slice(start, end);
}

test('appearance listboxes use the shared portaled-layer dismissal contract', () => {
  const compactSelect = sourceBetween(
    primitivesSource,
    'export function AppearanceEditorCompactSelect',
    'export type AppearanceEditorToolbarTone'
  );

  assert.match(compactSelect, /useDropdownDismiss\(\{/u);
  assert.match(compactSelect, /refs: dismissRefs/u);
  assert.match(compactSelect, /portalRefs/u);
  assert.match(compactSelect, /returnFocusRef: triggerRef/u);
  assert.match(compactSelect, /dismissGroup: 'appearance-compact-select'/u);
  assert.doesNotMatch(compactSelect, /document\.addEventListener\('pointerdown'/u);
  assert.match(compactSelect, /window\.addEventListener\('resize', closeForViewportChange\)/u);
});

test('hidden canvas flags close outside and restore their own trigger', () => {
  assert.match(hiddenFlagSource, /useDropdownDismiss\(\{/u);
  assert.match(hiddenFlagSource, /refs: dismissRefs/u);
  assert.match(hiddenFlagSource, /portalRefs/u);
  assert.match(hiddenFlagSource, /returnFocusRef: flagRef/u);
  assert.match(hiddenFlagSource, /dismissGroup: 'canvas-hidden-element'/u);
  assert.doesNotMatch(hiddenFlagSource, /document\.addEventListener\('pointerdown'/u);
});

test('homepage toolbar, row, and nested add-section menus share outside dismissal', () => {
  assert.match(landingSource, /dismissGroup: 'homepage-toolbar-popover'/u);
  assert.match(landingSource, /refs: toolbarPopoverDismissRefs/u);
  assert.match(landingSource, /ignoreSelector: '\[data-admin-color-palette-portal\]'/u);
  assert.match(landingSource, /ignoreEscapeSelector: '\[data-admin-color-palette-portal\]'/u);
  assert.match(landingSource, /dismissGroup: 'homepage-section-menu'/u);
  assert.match(landingSource, /ignoreSelector: '\[data-homepage-section-menu\]'/u);
  assert.match(landingSource, /dismissGroup: 'homepage-add-section-menu'/u);
  assert.match(landingSource, /refs: addSectionMenuDismissRefs/u);
  assert.match(landingSource, /ref=\{addSectionMenuRef\}/u);
  assert.match(
    landingSource,
    /setActiveToolbarPopover\(null\);[\s\S]*?setActiveToolbarHost\(null\);[\s\S]*?setAddSectionMenuOpen\(false\);/u
  );
});

test('navigation icon picker dismisses on canvas clicks with accessible dialog state', () => {
  const iconPicker = sourceBetween(
    navigationSource,
    'function IconPicker({',
    'function DeleteButton({'
  );

  assert.match(iconPicker, /useDropdownDismiss\(\{/u);
  assert.match(iconPicker, /refs: dismissRefs/u);
  assert.match(iconPicker, /returnFocusRef: triggerRef/u);
  assert.match(iconPicker, /dismissGroup: 'navigation-icon-picker'/u);
  assert.match(iconPicker, /ref=\{rootRef\}/u);
  assert.match(iconPicker, /ref=\{triggerRef\}/u);
  assert.match(iconPicker, /aria-haspopup="dialog"/u);
  assert.match(iconPicker, /aria-expanded=\{open\}/u);
  assert.match(iconPicker, /role="dialog"/u);
});

test('anchored category controls preserve nested palettes and close outside the editor', () => {
  const editor = sourceBetween(
    categorySource,
    'export function CategoryShowcaseEditor({',
    '  const controls = controlsOpen && selectedItem ? ('
  );

  assert.match(editor, /useDropdownDismiss\(\{/u);
  assert.match(editor, /open: Boolean\(anchored && controlsOpen && selectedSlug && onClose\)/u);
  assert.match(editor, /refs: dismissRefs/u);
  assert.match(editor, /portalRefs/u);
  assert.match(editor, /ignoreSelector: '\[data-admin-color-palette-portal\]'/u);
  assert.match(editor, /ignoreEscapeSelector: '\[data-admin-color-palette-portal\]'/u);
  assert.match(editor, /dismissGroup: 'category-showcase-controls'/u);
  assert.doesNotMatch(editor, /document\.addEventListener\('keydown', handleKeyDown\)/u);
});

test('a selector representing the surface itself does not suppress Escape dismissal', () => {
  assert.match(headerFilterSource, /ignoreSelector: rootSelector/u);
  assert.doesNotMatch(headerFilterSource, /ignoreEscapeSelector/u);
  const sectionMenuHook = sourceBetween(
    landingSource,
    'open: Boolean(openSectionMenuId)',
    'open: addSectionMenuOpen'
  );
  assert.match(sectionMenuHook, /ignoreSelector: '\[data-homepage-section-menu\]'/u);
  assert.doesNotMatch(sectionMenuHook, /ignoreEscapeSelector/u);
});
