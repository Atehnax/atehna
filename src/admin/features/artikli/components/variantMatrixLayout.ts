'use client';

import { useCallback, useRef, type MouseEvent } from 'react';

/** Pixel tracks interpolate at every catalog size; mixing flexible compact
 * tracks with a fixed editor track makes expansion jump in dense catalogs. */
export function getVariantMatrixLayout(count: number, expandedIndex: number) {
  const compactCount = Math.max(0, count - 1);
  const compactWidth = compactCount <= 2 ? 220
    : compactCount <= 4 ? 140
      : compactCount <= 6 ? 100
        : compactCount <= 8 ? 82
          : compactCount <= 12 ? 58
            : compactCount <= 15 ? 44
              : compactCount <= 19 ? 34 : 40;
  const expandedWidth = 336;
  return {
    compactWidth,
    expandedWidth,
    // Reserve editor space when everything is collapsed, keeping the scroll
    // extent stable while only the grid tracks animate.
    minWidth: Math.max(720, 205 + count * compactWidth + expandedWidth - compactWidth),
    gridTemplateColumns: [
      '205px',
      ...Array.from({ length: count }, (_, index) => `${index === expandedIndex ? expandedWidth : compactWidth}px`),
      'minmax(0px, 1fr)'
    ].join(' ')
  };
}

/** Hover changes only the two affected columns, without rerendering the editor. */
export function useVariantMatrixHover() {
  const hovered = useRef<{ id: string; cells: HTMLElement[] } | null>(null);
  const clearHover = useCallback(() => {
    hovered.current?.cells.forEach((cell) => cell.removeAttribute('data-matrix-hovered'));
    hovered.current = null;
  }, []);
  const onMouseOver = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-variant-matrix-column]') : null;
    const id = target?.dataset.variantMatrixColumn;
    if (!id || !event.currentTarget.contains(target)) {
      clearHover();
      return;
    }
    if (hovered.current?.id === id) return;
    clearHover();
    const cells = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      `[data-variant-matrix-column="${CSS.escape(id)}"]`
    ));
    cells.forEach((cell) => cell.setAttribute('data-matrix-hovered', 'true'));
    hovered.current = { id, cells };
  }, [clearHover]);
  return { onMouseOver, onMouseLeave: clearHover, clearHover };
}
