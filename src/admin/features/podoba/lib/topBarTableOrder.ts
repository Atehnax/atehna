import type {
  SiteNavigationTopBarElementId,
  SiteNavigationTopBarResponsiveItem
} from '@/shared/domain/navigation/siteNavigation';

export type TopBarResolvedXPxById = Readonly<
  Partial<Record<SiteNavigationTopBarElementId, number>>
>;

/**
 * Orders editor rows by the X coordinate the storefront layout actually resolves.
 * The returned array is a view only: persisted items and their canonical IDs are untouched.
 */
export function sortTopBarTableItemsByResolvedX(
  items: readonly SiteNavigationTopBarResponsiveItem[],
  resolvedXPxById: TopBarResolvedXPxById
) {
  const originalIndexById = new Map(items.map((item, index) => [item.id, index]));

  return [...items].sort((first, second) => {
    const firstXPx = resolvedXPxById[first.id] ?? first.xPx;
    const secondXPx = resolvedXPxById[second.id] ?? second.xPx;
    const xDelta = firstXPx - secondXPx;
    if (xDelta !== 0) return xDelta;

    const zIndexDelta = first.zIndex - second.zIndex;
    if (zIndexDelta !== 0) return zIndexDelta;

    return (originalIndexById.get(first.id) ?? 0) - (originalIndexById.get(second.id) ?? 0);
  });
}
