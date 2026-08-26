import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const orderItemsSource = source(
  'src/admin/features/orders/components/AdminOrderItemsEditor.tsx'
);
const richTextSource = source(
  'src/admin/features/podoba/components/ProductDescriptionRichTextEditor.tsx'
);
const siteHeaderSource = source('src/commercial/components/SiteHeader.tsx');

function sourceBetween(wholeSource: string, startMarker: string, endMarker: string) {
  const start = wholeSource.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  const end = wholeSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing source marker after ${startMarker}: ${endMarker}`);
  return wholeSource.slice(start, end);
}

test('the order item picker owns outside dismissal, Escape focus return, and modal focus', () => {
  const picker = sourceBetween(
    orderItemsSource,
    'const pickerDialogRef',
    'const itemsEditable'
  );
  assert.match(orderItemsSource, /useDropdownDismiss/u);
  assert.match(picker, /open:\s*isPickerOpen/u);
  assert.match(picker, /refs:\s*pickerDismissRefs/u);
  assert.match(picker, /returnFocusRef:\s*pickerTriggerRef/u);
  assert.match(picker, /event\.key !== 'Tab'/u);
  assert.match(orderItemsSource, /role="dialog"/u);
  assert.match(orderItemsSource, /aria-modal="true"/u);
  assert.match(orderItemsSource, /data-admin-order-item-picker-dialog/u);
  assert.match(orderItemsSource, /<AdminSearchInput\s+autoFocus/u);
});

test('the rich-text link panel is a registered transient child with focus restoration', () => {
  const linkState = sourceBetween(
    richTextSource,
    'const linkTriggerRef',
    'onChangeRef.current = onChange'
  );
  assert.match(richTextSource, /useDropdownDismiss/u);
  assert.match(linkState, /open:\s*linkOpen/u);
  assert.match(linkState, /refs:\s*linkDismissRefs/u);
  assert.match(linkState, /returnFocusRef:\s*linkTriggerRef/u);
  assert.match(linkState, /dismissGroup:\s*'product-description-rich-text-toolbar'/u);
  assert.match(richTextSource, /buttonRef=\{linkTriggerRef\}/u);
  assert.match(richTextSource, /expanded=\{linkOpen\}/u);
  assert.match(richTextSource, /ref=\{linkPanelRef\}[\s\S]*?role="dialog"/u);
  assert.match(richTextSource, /data-product-description-link-panel/u);
  assert.match(richTextSource, /ref=\{linkInputRef\}/u);
});

test('navbar search results dismiss in every mode without query-gated outside logic', () => {
  const navbarSearch = sourceBetween(
    siteHeaderSource,
    'function NavbarSearch',
    'function NavbarCartControl'
  );
  const dismissCallback = sourceBetween(
    navbarSearch,
    'const closeSearchSurface',
    'useDropdownDismiss'
  );
  assert.match(siteHeaderSource, /useDropdownDismiss/u);
  assert.match(navbarSearch, /open:\s*open \|\| expanded/u);
  assert.match(navbarSearch, /refs:\s*searchDismissRefs/u);
  assert.match(
    navbarSearch,
    /returnFocusRef:\s*!mobile && !desktopFieldMode \? compactTriggerRef : inputRef/u
  );
  assert.match(
    dismissCallback,
    /setOpen\(false\);\s*if \(!mobile && !desktopFieldMode\) setExpanded\(false\)/u
  );
  assert.doesNotMatch(dismissCallback, /setQuery/u);
  assert.match(navbarSearch, /data-site-search-results/u);
  assert.doesNotMatch(navbarSearch, /!rootRef\.current\?\.contains\(target\) && !query/u);
  assert.doesNotMatch(navbarSearch, /document\.addEventListener\('pointerdown'/u);
});
