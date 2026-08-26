import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasOrderDocumentDecorationBox,
  hasOrderDocumentDecorationContentFrame,
  resolveOrderDocumentDecorationPreviewStyle,
  resolveOrderDocumentFinancialOpticalEdgeOffsetPx,
  resolveOrderDocumentFinancialPairPreviewStyle,
  resolveOrderDocumentNaturalFinancialFramePreview
} from '../../src/admin/features/urejevalnik/lib/orderDocumentDecorationPreview';
import type { OrderDocumentDecoration } from '../../src/shared/domain/order/orderDocumentTemplates';

const decoration = (
  patch: Partial<OrderDocumentDecoration> = {}
): OrderDocumentDecoration => ({
  fillEnabled: false,
  fillColor: '#FFFFFF',
  outlineEnabled: false,
  outlineColor: '#D6A900',
  outlineWidthPt: 1,
  outlineSides: ['left', 'right', 'top', 'bottom'],
  accentEnabled: false,
  accentSide: 'left',
  accentColor: '#D6A900',
  accentWidthPt: 2,
  paddingPt: 0,
  ...patch
});

test('undecorated text keeps its existing layout geometry', () => {
  const style = resolveOrderDocumentDecorationPreviewStyle(
    decoration(),
    0,
    { centerText: true }
  );

  assert.equal(hasOrderDocumentDecorationBox(decoration()), false);
  assert.equal(hasOrderDocumentDecorationContentFrame(decoration()), false);
  assert.equal(style.padding, undefined);
  assert.equal(style.display, undefined);
  assert.equal(style.alignItems, undefined);
  assert.equal(style.justifyContent, undefined);
});

test('outlined text uses one symmetric inset and centers its line box', () => {
  const outlined = decoration({ outlineEnabled: true });
  const style = resolveOrderDocumentDecorationPreviewStyle(
    outlined,
    3,
    { centerText: true, alignment: 'left' }
  );

  assert.equal(hasOrderDocumentDecorationBox(outlined), true);
  assert.equal(hasOrderDocumentDecorationContentFrame(outlined), true);
  assert.equal(style.padding, '3pt');
  assert.equal(style.display, 'flex');
  assert.equal(style.alignItems, 'center');
  assert.equal(style.justifyContent, 'flex-start');
  assert.equal(
    style.boxShadow,
    [
      'inset 1pt 0 0 0 #D6A900',
      'inset -1pt 0 0 0 #D6A900',
      'inset 0 1pt 0 0 #D6A900',
      'inset 0 -1pt 0 0 #D6A900'
    ].join(', ')
  );
});

test('explicit zero padding remains zero while fixed-height outlined text stays vertically centered', () => {
  const style = resolveOrderDocumentDecorationPreviewStyle(
    decoration({ outlineEnabled: true }),
    0,
    { centerText: true, alignment: 'right' }
  );

  assert.equal(style.padding, undefined);
  assert.equal(style.alignItems, 'center');
  assert.equal(style.justifyContent, 'flex-end');
});

test('accent-only or padding-only text preserves its legacy top-aligned geometry', () => {
  const style = resolveOrderDocumentDecorationPreviewStyle(
    decoration({
      accentEnabled: true,
      paddingPt: 10
    }),
    10,
    { centerText: true, alignment: 'left' }
  );

  assert.equal(style.padding, '10pt');
  assert.equal(style.boxShadow, 'inset 2pt 0 0 #D6A900');
  assert.equal(style.display, undefined);
  assert.equal(style.alignItems, undefined);
  assert.equal(style.justifyContent, undefined);
});

test('distributed decorated rows retain their existing horizontal layout', () => {
  const style = resolveOrderDocumentDecorationPreviewStyle(
    decoration({ fillEnabled: true }),
    6,
    { centerText: true, alignment: 'distributed' }
  );

  assert.equal(style.padding, '6pt');
  assert.equal(style.alignItems, 'center');
  assert.equal(style.justifyContent, undefined);
});

test('a thick one-sided outline paints without consuming the symmetric content inset', () => {
  const style = resolveOrderDocumentDecorationPreviewStyle(
    decoration({
      outlineEnabled: true,
      outlineWidthPt: 8,
      outlineSides: ['left']
    }),
    3,
    { centerText: true, alignment: 'left' }
  );

  assert.equal(style.padding, '3pt');
  assert.equal(style.boxShadow, 'inset 8pt 0 0 0 #D6A900');
  assert.equal(style.borderLeftWidth, undefined);
  assert.equal(style.justifyContent, 'flex-start');
});

test('natural financial box expands outward and keeps both content anchors unchanged', () => {
  const frame = resolveOrderDocumentNaturalFinancialFramePreview(
    decoration({
      outlineEnabled: true,
      paddingPt: 3
    }),
    false
  );

  assert.deepEqual(frame, {
    leftInsetPt: 6,
    rightInsetPt: 6,
    style: {
      width: 'calc(100% + 12pt)',
      marginLeft: '-6pt',
      marginRight: '-6pt',
      paddingLeft: '6pt',
      paddingRight: '6pt'
    }
  });
  assert.equal(frame!.leftInsetPt + Number.parseFloat(String(frame!.style.marginLeft)), 0);
  assert.equal(frame!.rightInsetPt + Number.parseFloat(String(frame!.style.marginRight)), 0);
});

test('zero extra padding still expands the natural financial frame by its safety inset', () => {
  const frame = resolveOrderDocumentNaturalFinancialFramePreview(
    decoration({ outlineEnabled: true, paddingPt: 0 }),
    false
  );

  assert.deepEqual(frame, {
    leftInsetPt: 3,
    rightInsetPt: 3,
    style: {
      width: 'calc(100% + 6pt)',
      marginLeft: '-3pt',
      marginRight: '-3pt',
      paddingLeft: '3pt',
      paddingRight: '3pt'
    }
  });
  assert.equal(frame!.leftInsetPt + Number.parseFloat(String(frame!.style.marginLeft)), 0);
  assert.equal(frame!.rightInsetPt + Number.parseFloat(String(frame!.style.marginRight)), 0);
});

test('natural financial frame includes one-sided accent ink without shifting content', () => {
  const frame = resolveOrderDocumentNaturalFinancialFramePreview(
    decoration({
      outlineEnabled: true,
      accentEnabled: true,
      accentSide: 'left',
      accentWidthPt: 2,
      paddingPt: 3
    }),
    false
  );

  assert.equal(frame?.leftInsetPt, 8);
  assert.equal(frame?.rightInsetPt, 6);
  assert.equal(frame?.style.width, 'calc(100% + 14pt)');
  assert.equal(frame?.style.marginLeft, '-8pt');
  assert.equal(frame?.style.paddingLeft, '8pt');
  assert.equal(frame?.style.paddingRight, '6pt');
});

test('explicit financial placement keeps its saved width authoritative', () => {
  assert.equal(
    resolveOrderDocumentNaturalFinancialFramePreview(
      decoration({ outlineEnabled: true, paddingPt: 3 }),
      true
    ),
    null
  );
});

test('financial pair keeps 67/33 columns and aligns each cell independently', () => {
  const automatic = resolveOrderDocumentFinancialPairPreviewStyle('distributed');
  assert.deepEqual(automatic.container, {
    display: 'grid',
    gridTemplateColumns: '67% 33%',
    justifyContent: 'stretch',
    columnGap: 0
  });
  assert.equal(automatic.label.textAlign, 'left');
  assert.equal(automatic.value.textAlign, 'right');

  for (const alignment of ['left', 'center', 'right', 'justify'] as const) {
    const explicit = resolveOrderDocumentFinancialPairPreviewStyle(alignment);
    assert.equal(explicit.label.textAlign, alignment);
    assert.equal(explicit.value.textAlign, alignment);
    assert.equal(explicit.container.gridTemplateColumns, '67% 33%');
  }
});

test('financial optical offsets cancel left and right glyph side bearings', () => {
  const anchor = 50;
  const leftMetrics = {
    width: 100,
    actualBoundingBoxLeft: 1.25,
    actualBoundingBoxRight: 98
  };
  const leftOffset = resolveOrderDocumentFinancialOpticalEdgeOffsetPx(
    leftMetrics,
    'left'
  );
  assert.equal(leftOffset, 1.25);
  assert.equal(
    anchor - leftMetrics.actualBoundingBoxLeft + leftOffset,
    anchor,
    'a positive left bearing means the ink begins left of its anchor'
  );

  const rightMetrics = {
    width: 100,
    actualBoundingBoxLeft: -0.5,
    actualBoundingBoxRight: 98
  };
  const rightOffset = resolveOrderDocumentFinancialOpticalEdgeOffsetPx(
    rightMetrics,
    'right'
  );
  assert.equal(rightOffset, 2);
  assert.equal(
    anchor - rightMetrics.width + rightMetrics.actualBoundingBoxRight + rightOffset,
    anchor
  );
  assert.equal(
    resolveOrderDocumentFinancialOpticalEdgeOffsetPx(
      { width: 100 },
      'right'
    ),
    0
  );
});
