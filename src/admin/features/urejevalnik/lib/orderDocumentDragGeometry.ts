export type OrderDocumentPageSize = {
  widthMm: number;
  heightMm: number;
};

export type OrderDocumentRectGeometry = {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
};

export type OrderDocumentPointerDragInput = {
  startXmm: number;
  startYmm: number;
  startClientX: number;
  startClientY: number;
  clientX: number;
  clientY: number;
  pagePixelWidth: number;
  pagePixelHeight: number;
  page: OrderDocumentPageSize;
};

export type OrderDocumentRelativeBounds = {
  minXmm: number;
  maxXmm: number;
  minYmm: number;
  maxYmm: number;
};

export type OrderDocumentPositionBounds = {
  minXmm: number;
  maxXmm: number;
  minYmm: number;
  maxYmm: number;
};

const roundMm = (value: number) => Math.round(value * 10) / 10;

const clampToOrderedRange = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(minimum, maximum), Math.max(minimum, value));

/**
 * Converts every pointer frame from the immutable drag origin. This avoids
 * accumulating snapped/clamped deltas, so reversing direction always follows
 * the pointer immediately.
 */
export function resolveOrderDocumentPointerDragPosition({
  startXmm,
  startYmm,
  startClientX,
  startClientY,
  clientX,
  clientY,
  pagePixelWidth,
  pagePixelHeight,
  page
}: OrderDocumentPointerDragInput) {
  const deltaXmm = ((clientX - startClientX) / Math.max(1, pagePixelWidth)) * page.widthMm;
  const deltaYmm = ((clientY - startClientY) / Math.max(1, pagePixelHeight)) * page.heightMm;
  return {
    xMm: startXmm + deltaXmm,
    yMm: startYmm + deltaYmm
  };
}

/** Keeps an element's complete rectangle on the page without inverting bounds. */
export function clampOrderDocumentRectToPage(
  rect: OrderDocumentRectGeometry,
  page: OrderDocumentPageSize
): OrderDocumentRectGeometry {
  const maxXmm = Math.max(0, page.widthMm - Math.max(0, rect.widthMm));
  const maxYmm = Math.max(0, page.heightMm - Math.max(0, rect.heightMm));
  return {
    ...rect,
    xMm: roundMm(clampToOrderedRange(rect.xMm, 0, maxXmm)),
    yMm: roundMm(clampToOrderedRange(rect.yMm, 0, maxYmm))
  };
}

/**
 * Clamps a group by the union of the group and all elements that move with it.
 * Children therefore never need an independent destructive clamp on commit,
 * preserving their exact offsets when a group is moved out and back.
 */
export function resolveOrderDocumentMoveWithDependentsBounds(
  moving: OrderDocumentRectGeometry,
  dependents: ReadonlyArray<OrderDocumentRectGeometry>,
  page: OrderDocumentPageSize
): OrderDocumentPositionBounds {
  const rectangles = [moving, ...dependents];
  const unionLeft = Math.min(...rectangles.map((rect) => rect.xMm));
  const unionTop = Math.min(...rectangles.map((rect) => rect.yMm));
  const unionRight = Math.max(...rectangles.map((rect) => rect.xMm + rect.widthMm));
  const unionBottom = Math.max(...rectangles.map((rect) => rect.yMm + rect.heightMm));
  const minXmm = moving.xMm - unionLeft;
  const minYmm = moving.yMm - unionTop;
  return {
    minXmm: roundMm(minXmm),
    maxXmm: roundMm(Math.max(minXmm, moving.xMm + page.widthMm - unionRight)),
    minYmm: roundMm(minYmm),
    maxYmm: roundMm(Math.max(minYmm, moving.yMm + page.heightMm - unionBottom))
  };
}

export function clampOrderDocumentMoveWithDependents(
  position: Pick<OrderDocumentRectGeometry, 'xMm' | 'yMm'>,
  moving: OrderDocumentRectGeometry,
  dependents: ReadonlyArray<OrderDocumentRectGeometry>,
  page: OrderDocumentPageSize
) {
  const bounds = resolveOrderDocumentMoveWithDependentsBounds(moving, dependents, page);
  return {
    xMm: roundMm(clampToOrderedRange(position.xMm, bounds.minXmm, bounds.maxXmm)),
    yMm: roundMm(clampToOrderedRange(position.yMm, bounds.minYmm, bounds.maxYmm))
  };
}

/**
 * A semantic row is positioned relative to its owner, but its useful movement
 * area is the A4 page. Negative relative coordinates are therefore valid when
 * the owner does not begin at the page edge.
 */
export function resolveOrderDocumentFieldRowPageBounds(
  owner: Pick<OrderDocumentRectGeometry, 'xMm' | 'yMm'>,
  row: Pick<OrderDocumentRectGeometry, 'widthMm' | 'heightMm'>,
  page: OrderDocumentPageSize
): OrderDocumentRelativeBounds {
  const minXmm = -owner.xMm;
  const minYmm = -owner.yMm;
  return {
    minXmm: roundMm(minXmm),
    maxXmm: roundMm(Math.max(minXmm, page.widthMm - owner.xMm - row.widthMm)),
    minYmm: roundMm(minYmm),
    maxYmm: roundMm(Math.max(minYmm, page.heightMm - owner.yMm - row.heightMm))
  };
}

export function clampOrderDocumentFieldRowToPage(
  position: Pick<OrderDocumentRectGeometry, 'xMm' | 'yMm'>,
  owner: Pick<OrderDocumentRectGeometry, 'xMm' | 'yMm'>,
  row: Pick<OrderDocumentRectGeometry, 'widthMm' | 'heightMm'>,
  page: OrderDocumentPageSize
) {
  const bounds = resolveOrderDocumentFieldRowPageBounds(owner, row, page);
  return {
    xMm: roundMm(clampToOrderedRange(position.xMm, bounds.minXmm, bounds.maxXmm)),
    yMm: roundMm(clampToOrderedRange(position.yMm, bounds.minYmm, bounds.maxYmm))
  };
}
