import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cloneDefaultSiteNavigationConfig,
  getSiteNavigationDesktopGroupLinkColumns,
  getSiteNavigationDesktopGroupDividerVisibility,
  getSiteNavigationDesktopGroupPlacements,
  getVisibleSiteNavigationItems,
  type SiteNavigationGroup,
  type SiteNavigationLink
} from '../../src/shared/domain/navigation/siteNavigation';

function navigationLink(index: number, visible = true): SiteNavigationLink {
  return {
    id: `link-${index}`,
    label: `Link ${index}`,
    description: '',
    href: `/link-${index}`,
    icon: 'box',
    visible,
    position: index - 1
  };
}

function navigationGroup(
  id: string,
  linkCount: number,
  desktopSpan: 1 | 2 | 3 | 4,
  visible = true
): SiteNavigationGroup {
  return {
    id,
    label: id,
    href: '',
    visible,
    position: 0,
    desktopSpan,
    links: Array.from({ length: linkCount }, (_, index) => navigationLink(index + 1))
  };
}

test('a three-column navigation group fills all public columns in admin row order', () => {
  const columns = getSiteNavigationDesktopGroupLinkColumns(
    navigationGroup('categories', 8, 3)
  );

  assert.deepEqual(
    columns.map((column) => column.map((link) => link.id)),
    [
      ['link-1', 'link-4', 'link-7'],
      ['link-2', 'link-5', 'link-8'],
      ['link-3', 'link-6']
    ]
  );
});

test('desktop navigation dividers appear only at group boundaries', () => {
  const dividerVisibility =
    getSiteNavigationDesktopGroupDividerVisibility;

  assert.deepEqual(dividerVisibility(['wide', 'wide', 'wide']), [false, false]);
  assert.deepEqual(dividerVisibility(['wide', 'wide', 'single']), [false, true]);
  assert.deepEqual(dividerVisibility(['single', 'wide', 'wide']), [true, false]);
  assert.deepEqual(dividerVisibility(['first', 'second', 'third']), [true, true]);
});

test('a full-width group consumes the first desktop page before the next group', () => {
  const placements = getSiteNavigationDesktopGroupPlacements([
    navigationGroup('categories', 8, 3),
    navigationGroup('following', 1, 1)
  ]);

  assert.deepEqual(placements.categories, { pageIndex: 0, pageNumber: 1, slotIndex: 0, slotSpan: 3 });
  assert.deepEqual(placements.following, { pageIndex: 1, pageNumber: 2, slotIndex: 0, slotSpan: 1 });
});

test('public navigation excludes hidden top-level items, groups, and links', () => {
  const config = cloneDefaultSiteNavigationConfig();
  config.items = [
    {
      id: 'hidden-top',
      label: 'Hidden top',
      href: '',
      visible: false,
      position: 0,
      groups: [navigationGroup('unused-group', 1, 1)]
    },
    {
      id: 'shown-top',
      label: 'Shown top',
      href: '',
      visible: true,
      position: 1,
      groups: [
        navigationGroup('hidden-group', 1, 1, false),
        {
          ...navigationGroup('shown-group', 2, 2),
          position: 1,
          links: [navigationLink(1), navigationLink(2, false)]
        }
      ]
    }
  ];

  const visibleItems = getVisibleSiteNavigationItems(config);

  assert.deepEqual(visibleItems.map((item) => item.id), ['shown-top']);
  assert.deepEqual(visibleItems[0]?.groups.map((group) => group.id), ['shown-group']);
  assert.deepEqual(visibleItems[0]?.groups[0]?.links.map((link) => link.id), ['link-1']);
});
