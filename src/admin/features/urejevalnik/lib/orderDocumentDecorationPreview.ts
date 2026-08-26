import type { CSSProperties } from 'react';
import {
  hasOrderDocumentBoxDecoration,
  resolveOrderDocumentDecorationInset,
  type OrderDocumentDecoration,
  type OrderDocumentResolvedTextAlignment
} from '@/shared/domain/order/orderDocumentTemplates';

export type OrderDocumentDecorationContentAlignment =
  | 'left'
  | 'center'
  | 'right'
  | 'justify'
  | 'distributed';

export const hasOrderDocumentDecorationBox = hasOrderDocumentBoxDecoration;

export const hasOrderDocumentDecorationContentFrame = (
  decoration: OrderDocumentDecoration
) => hasOrderDocumentDecorationBox(decoration);

export type OrderDocumentNaturalFinancialFramePreview = {
  leftInsetPt: number;
  rightInsetPt: number;
  style: CSSProperties;
};

export type OrderDocumentFinancialOpticalEdge = 'left' | 'right';

export type OrderDocumentFinancialTextMetrics = Pick<
  TextMetrics,
  'width' | 'actualBoundingBoxLeft' | 'actualBoundingBoxRight'
>;

/**
 * CSS aligns a text run by its advance box, while users judge alignment by
 * the first/last painted glyph pixel. Bold and italic faces can have visibly
 * different side bearings even when their layout anchors are identical.
 * Return the translation that puts that optical edge back on the anchor.
 */
export function resolveOrderDocumentFinancialOpticalEdgeOffsetPx(
  metrics: Partial<OrderDocumentFinancialTextMetrics>,
  edge: OrderDocumentFinancialOpticalEdge
) {
  const width = Number(metrics.width);
  const actualLeft = Number(metrics.actualBoundingBoxLeft);
  const actualRight = Number(metrics.actualBoundingBoxRight);
  if (
    !Number.isFinite(width)
    || !Number.isFinite(actualLeft)
    || !Number.isFinite(actualRight)
  ) return 0;

  const offset = edge === 'left' ? actualLeft : width - actualRight;
  return Number.isFinite(offset) ? offset : 0;
}

/**
 * A natural (unplaced) financial row owns the full label/value width. Box ink
 * therefore grows outside that width instead of consuming either content
 * anchor. Explicitly placed rows are intentionally excluded: their saved
 * width remains authoritative.
 */
export function resolveOrderDocumentNaturalFinancialFramePreview(
  decoration: OrderDocumentDecoration,
  placed: boolean,
  contentInsetPt = resolveOrderDocumentDecorationInset(decoration)
): OrderDocumentNaturalFinancialFramePreview | null {
  if (placed || !hasOrderDocumentDecorationContentFrame(decoration)) return null;
  const leftInsetPt = contentInsetPt + (
    decoration.accentEnabled && decoration.accentSide === 'left'
      ? decoration.accentWidthPt
      : 0
  );
  const rightInsetPt = contentInsetPt + (
    decoration.accentEnabled && decoration.accentSide === 'right'
      ? decoration.accentWidthPt
      : 0
  );
  return {
    leftInsetPt,
    rightInsetPt,
    style: {
      width: `calc(100% + ${leftInsetPt + rightInsetPt}pt)`,
      marginLeft: `${-leftInsetPt}pt`,
      marginRight: `${-rightInsetPt}pt`,
      paddingLeft: `${leftInsetPt}pt`,
      paddingRight: `${rightInsetPt}pt`
    }
  };
}

export function resolveOrderDocumentFinancialPairPreviewStyle(
  alignment: OrderDocumentResolvedTextAlignment
) {
  const explicitAlignment = alignment === 'distributed' ? null : alignment;
  return {
    container: {
      display: 'grid',
      gridTemplateColumns: '67% 33%',
      justifyContent: 'stretch',
      columnGap: 0
    } satisfies CSSProperties,
    label: {
      textAlign: explicitAlignment ?? 'left'
    } satisfies CSSProperties,
    value: {
      textAlign: explicitAlignment ?? 'right'
    } satisfies CSSProperties
  };
}

/**
 * Mirrors the PDF decoration frame in the interactive canvas. Text centering
 * is opt-in so undecorated rows keep their existing block/flex geometry.
 */
export function resolveOrderDocumentDecorationPreviewStyle(
  decoration: OrderDocumentDecoration,
  contentInsetPt: number,
  {
    centerText = false,
    alignment = 'left'
  }: {
    centerText?: boolean;
    alignment?: OrderDocumentDecorationContentAlignment;
  } = {}
): CSSProperties {
  const style: CSSProperties = {
    boxSizing: 'border-box',
    backgroundColor: decoration.fillEnabled ? decoration.fillColor : 'transparent'
  };
  const inkShadows: string[] = [];

  if (contentInsetPt > 0) style.padding = `${contentInsetPt}pt`;
  if (decoration.outlineEnabled && decoration.outlineSides.length > 0) {
    const width = `${decoration.outlineWidthPt}pt`;
    for (const side of decoration.outlineSides) {
      if (side === 'left') {
        inkShadows.push(`inset ${width} 0 0 0 ${decoration.outlineColor}`);
      }
      if (side === 'right') {
        inkShadows.push(`inset -${width} 0 0 0 ${decoration.outlineColor}`);
      }
      if (side === 'top') {
        inkShadows.push(`inset 0 ${width} 0 0 ${decoration.outlineColor}`);
      }
      if (side === 'bottom') {
        inkShadows.push(`inset 0 -${width} 0 0 ${decoration.outlineColor}`);
      }
    }
  }
  if (decoration.accentEnabled) {
    const width = `${decoration.accentWidthPt}pt`;
    inkShadows.push(decoration.accentSide === 'left'
      ? `inset ${width} 0 0 ${decoration.accentColor}`
      : decoration.accentSide === 'right'
        ? `inset -${width} 0 0 ${decoration.accentColor}`
        : decoration.accentSide === 'top'
          ? `inset 0 ${width} 0 ${decoration.accentColor}`
          : `inset 0 -${width} 0 ${decoration.accentColor}`);
  }
  if (inkShadows.length > 0) style.boxShadow = inkShadows.join(', ');

  const hasContentFrame = hasOrderDocumentDecorationContentFrame(
    decoration
  );
  if (centerText && hasContentFrame) {
    style.display = 'flex';
    style.alignItems = 'center';
    if (alignment !== 'distributed') {
      style.justifyContent = alignment === 'right'
        ? 'flex-end'
        : alignment === 'center'
          ? 'center'
          : 'flex-start';
    }
  }

  return style;
}
