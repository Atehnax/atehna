import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const dropdownPath = 'src/shared/ui/admin-controls/AdminChipDropdown.tsx';
const menuItemPath = 'src/shared/ui/menu/menu-item.tsx';
const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const sliceBetween = (value: string, startMarker: string, endMarker: string) => {
  const start = value.indexOf(startMarker);
  assert.notEqual(start, -1, 'Expected to find start marker: ' + startMarker);
  const end = value.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, 'Expected to find end marker after ' + startMarker + ': ' + endMarker);
  return value.slice(start, end);
};

test('admin chip dropdown renders explanatory disabled options without removing them from focus', () => {
  const dropdown = source(dropdownPath);
  const optionType = sliceBetween(
    dropdown,
    'export type AdminChipDropdownOption = {',
    '\n};'
  );
  const optionRow = sliceBetween(dropdown, '{options.map((option, index) => {', '</MenuItem>');

  assert.match(optionType, /disabled\?: boolean;/u);
  assert.match(optionType, /description\?: string;/u);
  assert.match(dropdown, /menuClassName\?: string;/u);
  assert.match(
    dropdown,
    /<MenuPanel className=\{'w-full min-w-\[150px\] ' \+ \(menuClassName \?\? ''\)\}>/u
  );
  assert.match(optionRow, /ariaDisabled=\{option\.disabled\}/u);
  assert.match(optionRow, /ariaDescribedBy=\{descriptionId\}/u);
  assert.match(optionRow, /id=\{descriptionId\}[\s\S]*?\{option\.description\}/u);
  assert.doesNotMatch(optionRow, /disabled=\{option\.disabled\}/u);

  const guardIndex = optionRow.indexOf('if (option.disabled) return;');
  const changeIndex = optionRow.indexOf('onChange(option.value);');
  assert.ok(guardIndex >= 0, 'disabled options must guard activation');
  assert.ok(changeIndex > guardIndex, 'the disabled guard must run before onChange');
});

test('admin chip dropdown supports menu keyboard navigation and predictable focus restoration', () => {
  const dropdown = source(dropdownPath);

  for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape']) {
    assert.match(dropdown, new RegExp("'" + key + "'", 'u'));
  }
  assert.match(dropdown, /querySelectorAll<HTMLButtonElement>\('\[role="menuitem"\]'\)/u);
  assert.match(dropdown, /returnFocusRef: triggerRef/u);
  assert.match(dropdown, /triggerRef\.current\?\.focus\(\)/u);
  assert.match(dropdown, /closeMenuAndRestoreFocus\(\);/u);
  assert.match(dropdown, /aria-controls=\{isOpen \? menuId : undefined\}/u);
  assert.match(dropdown, /data-menu-item-active="true"/u);
});

test('shared menu item exposes additive aria-disabled and description semantics', () => {
  const menuItem = source(menuItemPath);

  assert.match(menuItem, /ariaDisabled\?: boolean;/u);
  assert.match(menuItem, /ariaDescribedBy\?: string;/u);
  assert.match(menuItem, /aria-disabled=\{ariaDisabled \|\| disabled \|\| undefined\}/u);
  assert.match(menuItem, /aria-describedby=\{ariaDescribedBy\}/u);
  assert.match(menuItem, /disabled=\{disabled\}/u);
  assert.match(menuItem, /data-menu-item-active=\{isActive \? 'true' : undefined\}/u);
});
