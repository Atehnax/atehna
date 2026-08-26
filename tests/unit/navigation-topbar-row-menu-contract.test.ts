import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const navigationEditorSource = readFileSync(
  resolve(process.cwd(), 'src/admin/features/podoba/components/AdminNavigationPageClient.tsx'),
  'utf8'
).replace(/\r\n?/gu, '\n');

const rowActionsDropdownSource = readFileSync(
  resolve(process.cwd(), 'src/shared/ui/table/row-actions-dropdown.tsx'),
  'utf8'
).replace(/\r\n?/gu, '\n');

const rowStart = navigationEditorSource.indexOf('function TopBarElementRow(');
const rowEnd = navigationEditorSource.indexOf('function TopBarLayoutEditor(', rowStart);

assert.notEqual(rowStart, -1, 'Missing TopBarElementRow source boundary.');
assert.notEqual(rowEnd, -1, 'Missing TopBarLayoutEditor source boundary.');

const topBarElementRowSource = navigationEditorSource.slice(rowStart, rowEnd);

test('top-bar row actions use the clipping-safe portal dropdown above the table overlay', () => {
  assert.match(topBarElementRowSource, /<RowActionsDropdown/u);
  assert.match(topBarElementRowSource, /menuZIndex=\{2147483647\}/u);
  assert.match(
    topBarElementRowSource,
    /menuTestId=\{`top-bar-element-menu-\$\{item\.id\}`\}/u
  );
  assert.match(
    topBarElementRowSource,
    /<div onClick=\{\(event\) => event\.stopPropagation\(\)\}>\s*<RowActionsDropdown/u
  );
  assert.doesNotMatch(
    topBarElementRowSource,
    /<MenuPanel className="absolute right-0 top-full/u
  );
});

test('shared row actions portal, flip, clamp, dismiss, and reposition outside clipping ancestors', () => {
  assert.match(rowActionsDropdownSource, /createPortal\(/u);
  assert.match(rowActionsDropdownSource, /document\.body/u);
  assert.match(rowActionsDropdownSource, /position: 'fixed'/u);
  assert.match(rowActionsDropdownSource, /visibility: 'hidden'/u);
  assert.match(rowActionsDropdownSource, /const shouldFlipAbove = !fitsBelow && fitsAbove;/u);
  assert.match(rowActionsDropdownSource, /const left = clamp\(/u);
  assert.match(rowActionsDropdownSource, /top = menuHeight > 0\s*\? clamp\(/u);
  assert.match(rowActionsDropdownSource, /refs: dismissRefs/u);
  assert.match(rowActionsDropdownSource, /window\.addEventListener\('resize', updateMenuPosition\)/u);
  assert.match(rowActionsDropdownSource, /window\.addEventListener\('scroll', updateMenuPosition, true\)/u);
  assert.match(rowActionsDropdownSource, /aria-haspopup="menu"/u);
  assert.match(rowActionsDropdownSource, /aria-expanded=\{isOpen\}/u);
  assert.match(rowActionsDropdownSource, /role="menu"/u);
  assert.match(rowActionsDropdownSource, /data-testid=\{menuTestId\}/u);
});
