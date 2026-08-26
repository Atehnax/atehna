import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendDropdownDismissLayer,
  dropdownDismissPathMatchesSelector,
  isTopmostDropdownDismissLayer,
  removeDropdownDismissLayer,
  shouldDismissDropdownPointer
} from '../../src/shared/ui/dropdown/use-dropdown-dismiss';

test('outside-pointer classification honors trigger roots, portal roots, and ignored portal selectors', () => {
  const triggerRoot = {} as HTMLElement;
  const portalRoot = {} as HTMLElement;
  const outsideTarget = {} as EventTarget;
  const ignoredPortal = {
    matches: (selector: string) => selector.includes('[data-nested-portal]')
  } as unknown as EventTarget;

  assert.equal(shouldDismissDropdownPointer([outsideTarget, triggerRoot], [triggerRoot]), false);
  assert.equal(shouldDismissDropdownPointer([outsideTarget, portalRoot], [triggerRoot, portalRoot]), false);
  assert.equal(shouldDismissDropdownPointer([outsideTarget, ignoredPortal], [triggerRoot], '[data-nested-portal]'), false);
  assert.equal(dropdownDismissPathMatchesSelector([outsideTarget, ignoredPortal], '[data-nested-portal]'), true);
  assert.equal(shouldDismissDropdownPointer([outsideTarget], [triggerRoot, portalRoot], '[data-nested-portal]'), true);
});

test('dismiss layers remain unique and only the newest layer owns dismissal', () => {
  const parent = Symbol('parent');
  const child = Symbol('child');
  let layers: readonly symbol[] = [];

  layers = appendDropdownDismissLayer(layers, parent);
  assert.equal(isTopmostDropdownDismissLayer(layers, parent), true);
  layers = appendDropdownDismissLayer(layers, child);
  assert.equal(isTopmostDropdownDismissLayer(layers, parent), false);
  assert.equal(isTopmostDropdownDismissLayer(layers, child), true);
  layers = appendDropdownDismissLayer(layers, parent);
  assert.deepEqual(layers, [child, parent]);
  layers = removeDropdownDismissLayer(layers, parent);
  assert.deepEqual(layers, [child]);
  assert.equal(isTopmostDropdownDismissLayer(layers, child), true);
});
