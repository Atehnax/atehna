import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import fontkit from '@pdf-lib/fontkit';
import { PDFPage, type PDFFont } from 'pdf-lib';
import {
  ORDER_DOCUMENT_DECORATED_TEXT_INSET_PT,
  cloneDefaultOrderDocumentTemplate,
  getOrderDocumentDecorationOverride,
  resolveOrderDocumentDecoration,
  resolveOrderDocumentDecorationContentInset,
  setOrderDocumentDecoration,
  setOrderDocumentFieldRowPlacement,
  type OrderDocumentDecoration,
  type OrderDocumentDecorationSide,
  type OrderDocumentDecorationTarget
} from '../../src/shared/domain/order/orderDocumentTemplates';
import {
  hasOrderDocumentDecorationBox,
  resolveOrderDocumentDecorationPreviewStyle
} from '../../src/admin/features/urejevalnik/lib/orderDocumentDecorationPreview';
import {
  createOrderDocumentPreviewContext,
  formatOrderDocumentCurrency
} from '../../src/shared/domain/order/orderDocumentPreview';
import {
  generateOrderPdf,
  resolveOrderDocumentPdfNaturalRowGeometry,
  resolveOrderDocumentPdfTextBoxLayout
} from '../../src/shared/server/pdf';

const target = {
  kind: 'field_row',
  group: 'notes',
  rowId: 'notes_label'
} as const satisfies OrderDocumentDecorationTarget;

const decoration = (
  patch: Partial<OrderDocumentDecoration> = {}
): OrderDocumentDecoration => ({
  fillEnabled: false,
  fillColor: '#FFFFFF',
  outlineEnabled: false,
  outlineColor: '#D6A900',
  outlineWidthPt: 4,
  outlineSides: ['left', 'right', 'top', 'bottom'],
  accentEnabled: false,
  accentSide: 'left',
  accentColor: '#D6A900',
  accentWidthPt: 2,
  paddingPt: 0,
  ...patch
});

test('newly boxed rows receive a safety inset without materializing synthetic extra padding', () => {
  for (const outlineSides of [
    ['left'],
    ['right'],
    ['top'],
    ['bottom'],
    ['left', 'bottom'],
    ['left', 'right', 'top', 'bottom']
  ] as const satisfies ReadonlyArray<ReadonlyArray<OrderDocumentDecorationSide>>) {
    const template = setOrderDocumentDecoration(
      cloneDefaultOrderDocumentTemplate('order_summary'),
      target,
      { outlineEnabled: true, outlineSides: [...outlineSides] }
    );

    assert.equal(
      resolveOrderDocumentDecoration(template, target).paddingPt,
      0,
      `outline sides ${outlineSides.join(',')}`
    );
    assert.equal(
      resolveOrderDocumentDecorationContentInset(template, target),
      ORDER_DOCUMENT_DECORATED_TEXT_INSET_PT
    );
    assert.equal(
      getOrderDocumentDecorationOverride(template, target)?.paddingPt,
      undefined,
      'the automatic safety inset must remain a resolved fallback, not stored user data'
    );
  }

  const filled = setOrderDocumentDecoration(
    cloneDefaultOrderDocumentTemplate('order_summary'),
    target,
    { fillEnabled: true }
  );
  assert.equal(
    resolveOrderDocumentDecoration(filled, target).paddingPt,
    0
  );
  assert.equal(
    resolveOrderDocumentDecorationContentInset(filled, target),
    ORDER_DOCUMENT_DECORATED_TEXT_INSET_PT
  );
});

test('explicit padding is extra to box safety while accent-only and empty outlines stay unboxed', () => {
  for (const paddingPt of [0, 1.5, 9]) {
    const template = setOrderDocumentDecoration(
      cloneDefaultOrderDocumentTemplate('order_summary'),
      target,
      { outlineEnabled: true, outlineSides: ['left'], paddingPt }
    );
    assert.equal(resolveOrderDocumentDecoration(template, target).paddingPt, paddingPt);
    assert.equal(
      resolveOrderDocumentDecorationContentInset(template, target),
      ORDER_DOCUMENT_DECORATED_TEXT_INSET_PT + paddingPt
    );
  }

  const accentOnly = setOrderDocumentDecoration(
    cloneDefaultOrderDocumentTemplate('order_summary'),
    target,
    { accentEnabled: true, outlineEnabled: false, fillEnabled: false }
  );
  assert.equal(resolveOrderDocumentDecoration(accentOnly, target).paddingPt, 0);

  const emptyOutline = setOrderDocumentDecoration(
    cloneDefaultOrderDocumentTemplate('order_summary'),
    target,
    { outlineEnabled: true, outlineSides: [] }
  );
  assert.equal(resolveOrderDocumentDecoration(emptyOutline, target).paddingPt, 0);
});

test('canvas outline ink is layout-neutral for every side and cannot displace centered text', () => {
  const expectedShadow: Record<OrderDocumentDecorationSide, string> = {
    left: 'inset 4pt 0 0 0 #D6A900',
    right: 'inset -4pt 0 0 0 #D6A900',
    top: 'inset 0 4pt 0 0 #D6A900',
    bottom: 'inset 0 -4pt 0 0 #D6A900'
  };

  for (const side of ['left', 'right', 'top', 'bottom'] as const) {
    const style = resolveOrderDocumentDecorationPreviewStyle(
      decoration({ outlineEnabled: true, outlineSides: [side] }),
      ORDER_DOCUMENT_DECORATED_TEXT_INSET_PT,
      { centerText: true, alignment: 'center' }
    );

    assert.equal(style.boxShadow, expectedShadow[side]);
    assert.equal(style.padding, `${ORDER_DOCUMENT_DECORATED_TEXT_INSET_PT}pt`);
    assert.equal(style.display, 'flex');
    assert.equal(style.alignItems, 'center');
    assert.equal(style.justifyContent, 'center');
    assert.equal(style.borderLeftWidth, undefined);
    assert.equal(style.borderRightWidth, undefined);
    assert.equal(style.borderTopWidth, undefined);
    assert.equal(style.borderBottomWidth, undefined);
  }
});

test('canvas centering preserves left, center, right, and distributed content semantics', () => {
  const boxed = decoration({ outlineEnabled: true });
  assert.equal(hasOrderDocumentDecorationBox(boxed), true);

  assert.equal(
    resolveOrderDocumentDecorationPreviewStyle(
      boxed,
      ORDER_DOCUMENT_DECORATED_TEXT_INSET_PT,
      { centerText: true, alignment: 'left' }
    ).justifyContent,
    'flex-start'
  );
  assert.equal(
    resolveOrderDocumentDecorationPreviewStyle(
      boxed,
      ORDER_DOCUMENT_DECORATED_TEXT_INSET_PT,
      { centerText: true, alignment: 'center' }
    ).justifyContent,
    'center'
  );
  assert.equal(
    resolveOrderDocumentDecorationPreviewStyle(
      boxed,
      ORDER_DOCUMENT_DECORATED_TEXT_INSET_PT,
      { centerText: true, alignment: 'right' }
    ).justifyContent,
    'flex-end'
  );
  assert.equal(
    resolveOrderDocumentDecorationPreviewStyle(
      boxed,
      ORDER_DOCUMENT_DECORATED_TEXT_INSET_PT,
      { centerText: true, alignment: 'distributed' }
    ).justifyContent,
    undefined,
    'distributed totals/signatures must keep their existing justify-between or flexible rule'
  );
});

test('plain undecorated rows retain their original block geometry', () => {
  const style = resolveOrderDocumentDecorationPreviewStyle(
    decoration(),
    0,
    { centerText: true, alignment: 'center' }
  );

  assert.equal(hasOrderDocumentDecorationBox(decoration()), false);
  assert.equal(style.display, undefined);
  assert.equal(style.alignItems, undefined);
  assert.equal(style.justifyContent, undefined);
  assert.equal(style.padding, undefined);
  assert.equal(style.boxShadow, undefined);
});

test('accent-only content keeps its established flow instead of becoming a centered box', () => {
  const style = resolveOrderDocumentDecorationPreviewStyle(
    decoration({
      accentEnabled: true,
      accentSide: 'left',
      accentWidthPt: 2,
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

test('PDF single-line text is vertically centered with independent left, center, and right x', () => {
  const content = { x: 12, bottom: 20, width: 100, height: 40 };
  const lineWidths = [24];

  assert.deepEqual(
    resolveOrderDocumentPdfTextBoxLayout({
      content,
      lineWidths,
      textAscentPt: 8,
      textDescentPt: 2,
      lineHeightPt: 14,
      alignment: 'left'
    }),
    [{ x: 12, y: 37 }]
  );
  assert.deepEqual(
    resolveOrderDocumentPdfTextBoxLayout({
      content,
      lineWidths,
      textAscentPt: 8,
      textDescentPt: 2,
      lineHeightPt: 14,
      alignment: 'center'
    }),
    [{ x: 50, y: 37 }]
  );
  assert.deepEqual(
    resolveOrderDocumentPdfTextBoxLayout({
      content,
      lineWidths,
      textAscentPt: 8,
      textDescentPt: 2,
      lineHeightPt: 14,
      alignment: 'right'
    }),
    [{ x: 88, y: 37 }]
  );
});

test('PDF multiline text centers the complete ascent/descender block, not each line independently', () => {
  const layout = resolveOrderDocumentPdfTextBoxLayout({
    content: { x: 20, bottom: 30, width: 80, height: 50 },
    lineWidths: [40, 20, 50],
    textAscentPt: 6,
    textDescentPt: 2,
    lineHeightPt: 12,
    alignment: 'center'
  });

  assert.deepEqual(layout, [
    { x: 40, y: 65 },
    { x: 50, y: 53 },
    { x: 35, y: 41 }
  ]);
  assert.equal(
    80 - (layout[0]!.y + 6),
    layout[2]!.y - 2 - 30,
    'visible whitespace above and below the full line block must match'
  );
});

test('PDF text-box layout handles empty, compressed, and over-height frames deterministically', () => {
  assert.deepEqual(
    resolveOrderDocumentPdfTextBoxLayout({
      content: { x: 0, bottom: 0, width: 20, height: 20 },
      lineWidths: [],
      textAscentPt: 6,
      textDescentPt: 2,
      lineHeightPt: 12,
      alignment: 'left'
    }),
    []
  );

  assert.deepEqual(
    resolveOrderDocumentPdfTextBoxLayout({
      content: { x: 0, bottom: 10, width: 20, height: 10 },
      lineWidths: [5, 5],
      textAscentPt: 6,
      textDescentPt: 2,
      lineHeightPt: 2,
      alignment: 'right'
    }),
    [
      { x: 15, y: 14 },
      { x: 15, y: 6 }
    ],
    'line height is never smaller than measured glyph height and overflow remains stable'
  );
});

test('PDF natural-row geometry prevents decorated sibling overlap without moving plain rows', () => {
  const firstPlain = resolveOrderDocumentPdfNaturalRowGeometry({
    desiredBaseline: 500,
    frameTopOffset: 10,
    preventOverlap: false
  });
  assert.deepEqual(firstPlain, { baseline: 500, top: 510 });

  const secondPlain = resolveOrderDocumentPdfNaturalRowGeometry({
    desiredBaseline: 484.2,
    frameTopOffset: 10,
    previousFrameBottom: 494.2,
    preventOverlap: false
  });
  assert.deepEqual(
    secondPlain,
    { baseline: 484.2, top: 494.2 },
    'two undecorated rows must retain exact legacy renderer coordinates'
  );

  const afterDefaultInsetBox = resolveOrderDocumentPdfNaturalRowGeometry({
    desiredBaseline: 484.2,
    frameTopOffset: 10,
    previousFrameBottom: 491.2,
    preventOverlap: true
  });
  assert.deepEqual(
    afterDefaultInsetBox,
    { baseline: 481.2, top: 491.2 },
    'the next row moves by only the overlapping 3pt default bottom inset'
  );

  assert.deepEqual(
    resolveOrderDocumentPdfNaturalRowGeometry({
      desiredBaseline: 484.2,
      frameTopOffset: 10,
      collisionTopOffset: 12,
      previousFrameBottom: 491.2,
      preventOverlap: true
    }),
    { baseline: 479.2, top: 489.2 },
    'measured glyph clearance may exceed the nominal frame without changing its offset'
  );

  const boxedAfterPlain = resolveOrderDocumentPdfNaturalRowGeometry({
    desiredBaseline: 468.4,
    frameTopOffset: 13,
    previousFrameBottom: 478.4,
    preventOverlap: true
  });
  assert.deepEqual(
    boxedAfterPlain,
    { baseline: 465.4, top: 478.4 },
    'a following boxed row must also keep its 3pt top inset outside its plain sibling'
  );

  assert.deepEqual(
    resolveOrderDocumentPdfNaturalRowGeometry({
      desiredBaseline: 460,
      frameTopOffset: 13,
      previousFrameBottom: 474,
      preventOverlap: true
    }),
    { baseline: 460, top: 473 },
    'existing positive whitespace is preserved rather than normalized away'
  );
});

test('generated PDF advances an unplaced metadata sibling past the default outline inset', async () => {
  const context = createOrderDocumentPreviewContext('order_summary');
  const plainTemplate = cloneDefaultOrderDocumentTemplate('order_summary');
  const firstTarget = {
    kind: 'field_row',
    group: 'document_meta',
    rowId: 'issue_date'
  } as const satisfies OrderDocumentDecorationTarget;
  const outlineWidthPt = 8.25;
  const outlinedTemplate = setOrderDocumentDecoration(
    plainTemplate,
    firstTarget,
    {
      outlineEnabled: true,
      outlineSides: ['left', 'right', 'top', 'bottom'],
      outlineWidthPt
    }
  );
  assert.equal(
    getOrderDocumentDecorationOverride(outlinedTemplate, firstTarget)?.paddingPt,
    undefined,
    'the regression must exercise the automatic 3pt inset, not explicit padding'
  );
  assert.equal(
    resolveOrderDocumentDecoration(outlinedTemplate, firstTarget).paddingPt,
    0
  );
  assert.equal(
    resolveOrderDocumentDecorationContentInset(outlinedTemplate, firstTarget),
    ORDER_DOCUMENT_DECORATED_TEXT_INSET_PT
  );

  const issueDateLabel = plainTemplate.text.labels.issueDate + ':';
  const orderDateLabel = plainTemplate.text.labels.orderDate + ':';
  const customerTypeLabel = plainTemplate.text.labels.customerType + ':';
  type TextObservation = {
    text: string;
    y: number;
    size: number;
    font: PDFFont;
  };
  type LineObservation = {
    start: { x: number; y: number };
    end: { x: number; y: number };
  };
  const observe = async (template: typeof plainTemplate) => {
    const texts: TextObservation[] = [];
    const lines: LineObservation[] = [];
    const originalDrawText = PDFPage.prototype.drawText;
    const originalDrawLine = PDFPage.prototype.drawLine;
    PDFPage.prototype.drawText = function drawText(text, options = {}) {
      if (
        text === issueDateLabel
        || text === orderDateLabel
        || text === customerTypeLabel
      ) {
        if (
          typeof options.y !== 'number'
          || typeof options.size !== 'number'
          || !options.font
        ) {
          throw new Error('Incomplete PDF row geometry for ' + text);
        }
        texts.push({
          text,
          y: options.y,
          size: options.size,
          font: options.font
        });
      }
      return originalDrawText.call(this, text, options);
    };
    PDFPage.prototype.drawLine = function drawLine(options) {
      if (options.thickness === outlineWidthPt) {
        lines.push({ start: options.start, end: options.end });
      }
      return originalDrawLine.call(this, options);
    };
    try {
      await generateOrderPdf({ ...context, template, logoArtwork: null });
    } finally {
      PDFPage.prototype.drawText = originalDrawText;
      PDFPage.prototype.drawLine = originalDrawLine;
    }
    const text = (value: string) => {
      const match = texts.find((candidate) => candidate.text === value);
      assert.ok(match, 'missing generated PDF row ' + value);
      return match;
    };
    return {
      issueDate: text(issueDateLabel),
      orderDate: text(orderDateLabel),
      customerType: text(customerTypeLabel),
      lines
    };
  };

  const plain = await observe(plainTemplate);
  const outlined = await observe(outlinedTemplate);
  const plainLineHeight = plain.issueDate.size * 1.58;
  assert.ok(
    Math.abs((plain.issueDate.y - plain.orderDate.y) - plainLineHeight) < 0.001,
    'the undecorated metadata baseline gap must remain coordinate-compatible'
  );
  assert.ok(
    Math.abs((plain.orderDate.y - plain.customerType.y) - plainLineHeight) < 0.001,
    'a third undecorated metadata row must retain the exact legacy baseline gap'
  );

  assert.equal(outlined.lines.length, 4, 'expected one four-sided metadata outline');
  const outlineBottom = Math.min(
    ...outlined.lines.flatMap((line) => [line.start.y, line.end.y])
  );
  const orderDateAscent = outlined.orderDate.font.heightAtSize(
    outlined.orderDate.size,
    { descender: false }
  );
  assert.ok(
    outlined.orderDate.y + orderDateAscent <= outlineBottom + 0.001,
    'the next row glyph ink must remain outside the preceding outline'
  );
  const propagatedShift = plain.orderDate.y - outlined.orderDate.y;
  assert.ok(
    propagatedShift >= ORDER_DOCUMENT_DECORATED_TEXT_INSET_PT,
    'the previous default inset must contribute to the sibling advance'
  );
  assert.ok(
    Math.abs((outlined.orderDate.y - outlined.customerType.y) - plainLineHeight) < 0.001,
    'the second-to-third plain row gap must stay coordinate-compatible'
  );
  assert.ok(
    Math.abs(
      (plain.customerType.y - outlined.customerType.y) - propagatedShift
    ) < 0.001,
    'the third row must retain the accumulated shift instead of snapping back'
  );
});

test('generated PDF centers placed multiline text and shrink-wraps sparse outlined rows', async () => {
  const context = createOrderDocumentPreviewContext('order_summary');
  let template = cloneDefaultOrderDocumentTemplate('order_summary');
  template = setOrderDocumentFieldRowPlacement(
    template,
    'notes',
    'notes_label',
    { xMm: 7, yMm: 3 }
  );
  template = setOrderDocumentDecoration(
    template,
    { kind: 'field_row', group: 'notes', rowId: 'notes_label' },
    {
      outlineEnabled: true,
      outlineSides: ['left', 'right', 'top', 'bottom'],
      outlineWidthPt: 6.25,
      paddingPt: 4
    }
  );
  template = setOrderDocumentFieldRowPlacement(
    template,
    'notes',
    'notes_content',
    { xMm: 20, yMm: 10, widthMm: 60, heightMm: 30 }
  );
  template = setOrderDocumentDecoration(
    template,
    { kind: 'field_row', group: 'notes', rowId: 'notes_content' },
    {
      outlineEnabled: true,
      outlineSides: ['left', 'right', 'top', 'bottom'],
      outlineWidthPt: 7.5,
      paddingPt: 5
    }
  );

  type TextObservation = {
    text: string;
    x: number;
    y: number;
    size: number;
    font: PDFFont;
  };
  type LineObservation = {
    start: { x: number; y: number };
    end: { x: number; y: number };
    thickness: number;
  };
  const textObservations: TextObservation[] = [];
  const outlineObservations: LineObservation[] = [];
  const originalDrawText = PDFPage.prototype.drawText;
  const originalDrawLine = PDFPage.prototype.drawLine;
  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    if (
      text === 'Opombe:'
      || text === 'ALFA'
      || text === 'BETA'
      || text === 'GAMA'
    ) {
      if (
        typeof options.x !== 'number'
        || typeof options.y !== 'number'
        || typeof options.size !== 'number'
        || !options.font
      ) {
        throw new Error(`Incomplete PDF text geometry for ${text}`);
      }
      textObservations.push({
        text,
        x: options.x,
        y: options.y,
        size: options.size,
        font: options.font
      });
    }
    return originalDrawText.call(this, text, options);
  };
  PDFPage.prototype.drawLine = function drawLine(options) {
    if (options.thickness === 6.25 || options.thickness === 7.5) {
      outlineObservations.push({
        start: options.start,
        end: options.end,
        thickness: options.thickness
      });
    }
    return originalDrawLine.call(this, options);
  };

  try {
    await generateOrderPdf({
      ...context,
      order: {
        ...context.order,
        notes: 'ALFA\nBETA\nGAMA'
      },
      template,
      logoArtwork: null
    });
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
    PDFPage.prototype.drawLine = originalDrawLine;
  }

  const frameForThickness = (thickness: number) => {
    const lines = outlineObservations.filter((line) => line.thickness === thickness);
    assert.equal(lines.length, 4, `expected one four-sided ${thickness}pt outline`);
    const xs = lines.flatMap((line) => [line.start.x, line.end.x]);
    const ys = lines.flatMap((line) => [line.start.y, line.end.y]);
    const x = Math.min(...xs);
    const bottom = Math.min(...ys);
    return {
      x,
      bottom,
      width: Math.max(...xs) - x,
      height: Math.max(...ys) - bottom
    };
  };

  const label = textObservations.find((item) => item.text === 'Opombe:');
  assert.ok(label);
  const sparseFrame = frameForThickness(6.25);
  const expectedSparseWidth = label.font.widthOfTextAtSize(label.text, label.size) + 14;
  assert.ok(
    Math.abs(sparseFrame.width - expectedSparseWidth) < 0.001,
    `x/y-only placement should shrink-wrap (${sparseFrame.width} vs ${expectedSparseWidth})`
  );
  assert.ok(sparseFrame.width < 100, 'sparse placement must not expand to owner width');

  const multiline = ['ALFA', 'BETA', 'GAMA'].map((text) => {
    const observation = textObservations.find((item) => item.text === text);
    assert.ok(observation, `missing generated PDF line ${text}`);
    return observation;
  });
  const multilineFrame = frameForThickness(7.5);
  const content = {
    x: multilineFrame.x + 8,
    bottom: multilineFrame.bottom + 8,
    width: multilineFrame.width - 16,
    height: multilineFrame.height - 16
  };
  const first = multiline[0]!;
  const wrappedLines = ['ALFA', '', 'BETA', '', 'GAMA'];
  const expectedLayout = resolveOrderDocumentPdfTextBoxLayout({
    content,
    lineWidths: wrappedLines.map((line) =>
      first.font.widthOfTextAtSize(line, first.size)
    ),
    textAscentPt: first.font.heightAtSize(first.size, { descender: false }),
    textDescentPt: first.font.heightAtSize(first.size)
      - first.font.heightAtSize(first.size, { descender: false }),
    lineHeightPt: first.size * 1.45,
    alignment: 'left'
  });
  multiline.forEach((line, index) => {
    const expected = expectedLayout[index * 2]!;
    assert.ok(
      Math.abs(line.x - expected.x) < 0.001,
      `${line.text} x=${line.x}, expected ${expected.x}`
    );
    assert.ok(
      Math.abs(line.y - expected.y) < 0.001,
      `${line.text} y=${line.y}, expected ${expected.y}; frame=${JSON.stringify(multilineFrame)} content=${JSON.stringify(content)}`
    );
  });
});

test('generated PDF preserves right, distributed, center, and page-number alignment inside boxes', async () => {
  const context = createOrderDocumentPreviewContext('order_summary');
  let template = cloneDefaultOrderDocumentTemplate('order_summary');
  template = {
    ...template,
    style: { ...template.style, titleAlignment: 'right' },
    text: {
      ...template.text,
      title: 'RIGHT-TITLE',
      footerText: 'CENTER-FOOTER',
      labels: { ...template.text.labels, total: 'LEFT-TOTAL' }
    },
    layout: { ...template.layout, showPageNumbers: true }
  };
  const configure = (
    group: 'title' | 'totals' | 'footer',
    rowId: 'title_text' | 'total' | 'footer_text' | 'page_numbers',
    widthMm: number,
    heightMm: number,
    outlineWidthPt: number
  ) => {
    template = setOrderDocumentFieldRowPlacement(
      template,
      group,
      rowId,
      { xMm: 2, yMm: 2, widthMm, heightMm }
    );
    template = setOrderDocumentDecoration(
      template,
      { kind: 'field_row', group, rowId },
      {
        outlineEnabled: true,
        outlineSides: ['left', 'right', 'top', 'bottom'],
        outlineWidthPt,
        paddingPt: 3
      }
    );
  };
  configure('title', 'title_text', 70, 15, 4.25);
  configure('totals', 'total', 80, 12, 4.5);
  configure('footer', 'footer_text', 80, 10, 4.75);
  configure('footer', 'page_numbers', 40, 10, 5);

  const totalValue = formatOrderDocumentCurrency(context.order.total);
  const wanted = new Set([
    'RIGHT-TITLE',
    'LEFT-TOTAL',
    totalValue,
    'CENTER-FOOTER',
    'Stran 1 / 1'
  ]);
  const texts: Array<{
    text: string;
    x: number;
    size: number;
    font: PDFFont;
  }> = [];
  const lines: Array<{
    start: { x: number; y: number };
    end: { x: number; y: number };
    thickness: number;
  }> = [];
  const originalDrawText = PDFPage.prototype.drawText;
  const originalDrawLine = PDFPage.prototype.drawLine;
  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    if (wanted.has(text)) {
      if (
        typeof options.x !== 'number'
        || typeof options.size !== 'number'
        || !options.font
      ) {
        throw new Error(`Incomplete PDF horizontal geometry for ${text}`);
      }
      texts.push({ text, x: options.x, size: options.size, font: options.font });
    }
    return originalDrawText.call(this, text, options);
  };
  PDFPage.prototype.drawLine = function drawLine(options) {
    if (
      typeof options.thickness === 'number'
      && [4.25, 4.5, 4.75, 5].includes(options.thickness)
    ) {
      lines.push({
        start: options.start,
        end: options.end,
        thickness: options.thickness
      });
    }
    return originalDrawLine.call(this, options);
  };

  try {
    await generateOrderPdf({ ...context, template, logoArtwork: null });
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
    PDFPage.prototype.drawLine = originalDrawLine;
  }

  const frame = (thickness: number) => {
    const matches = lines.filter((line) => line.thickness === thickness);
    assert.equal(matches.length, 4, `expected one ${thickness}pt outline`);
    const xs = matches.flatMap((line) => [line.start.x, line.end.x]);
    const x = Math.min(...xs);
    return { x, width: Math.max(...xs) - x };
  };
  const text = (value: string) => {
    const match = texts.find((candidate) => candidate.text === value);
    assert.ok(match, `missing PDF text ${value}`);
    return match;
  };
  const textWidth = (value: ReturnType<typeof text>) =>
    value.font.widthOfTextAtSize(value.text, value.size);
  const close = (actual: number, expected: number, label: string) => assert.ok(
    Math.abs(actual - expected) < 0.001,
    `${label}: ${actual} vs ${expected}`
  );

  const titleFrame = frame(4.25);
  const title = text('RIGHT-TITLE');
  close(
    title.x,
    titleFrame.x + titleFrame.width - 6 - textWidth(title),
    'right-aligned title'
  );

  const totalFrame = frame(4.5);
  const totalLabel = text('LEFT-TOTAL');
  const totalAmount = text(totalValue);
  const notoBold = fontkit.create(readFileSync(resolve(
    process.cwd(),
    'public/fonts/NotoSans-Bold.ttf'
  )));
  const inkBounds = (value: ReturnType<typeof text>) => {
    const run = notoBold.layout(value.text);
    let advance = 0;
    let left = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    run.glyphs.forEach((glyph, index) => {
      const position = run.positions[index];
      if (!position) return;
      const box = glyph.bbox;
      if (box.maxX > box.minX || box.maxY > box.minY) {
        left = Math.min(left, advance + position.xOffset + box.minX);
        right = Math.max(right, advance + position.xOffset + box.maxX);
      }
      advance += position.xAdvance;
    });
    const scale = value.size / notoBold.unitsPerEm;
    return { left: value.x + left * scale, right: value.x + right * scale };
  };
  close(
    inkBounds(totalLabel).left,
    totalFrame.x + 6,
    'distributed total label optical edge'
  );
  close(
    inkBounds(totalAmount).right,
    totalFrame.x + totalFrame.width - 6,
    'distributed total value optical edge'
  );

  const centerFrame = frame(4.75);
  const center = text('CENTER-FOOTER');
  close(
    center.x,
    centerFrame.x + 6 + (centerFrame.width - 12 - textWidth(center)) / 2,
    'centered footer'
  );

  const pageFrame = frame(5);
  const pageNumber = text('Stran 1 / 1');
  close(
    pageNumber.x,
    pageFrame.x + pageFrame.width - 6 - textWidth(pageNumber),
    'right-aligned page number'
  );
});

test('semantic canvas rows preserve inline/multiline content and their alignment matrix', () => {
  const source = readFileSync(
    resolve(
      process.cwd(),
      'src/admin/features/urejevalnik/components/OrderDocumentTemplateCanvas.tsx'
    ),
    'utf8'
  );

  assert.match(
    source,
    /centeredDecorationContent\s*&&\s*contentAlignment\s*!==\s*'distributed'[\s\S]{0,300}data-order-document-decoration-text-content/u,
    'non-distributed decorated text needs one stable wrapper so anonymous flex items cannot alter spacing or wrapping'
  );
  assert.match(
    source,
    /data-order-document-decoration-text-content[\s\S]{0,180}className="[^"]*min-w-0[^"]*w-full[^"]*"[\s\S]{0,120}style=\{textAlignmentCss\(resolvedTextAlignment\)\}/u,
    'the wrapper must retain multiline shrink/wrap behavior and use the resolved explicit or semantic alignment'
  );
  assert.match(source, /group="company"[\s\S]{0,180}contentAlignment="right"/u);
  assert.match(source, /group="document_meta"[\s\S]{0,180}contentAlignment="right"/u);
  assert.match(source, /group="totals"[\s\S]{0,260}contentAlignment="distributed"/u);
  assert.match(source, /group="signatures"[\s\S]{0,260}contentAlignment="distributed"/u);
  assert.match(
    source,
    /group="footer"[\s\S]{0,260}contentAlignment=\{row\.alignment === 'right' \? 'right' : 'center'\}/u
  );
  assert.match(
    source,
    /group="title"[\s\S]{0,260}template\.style\.titleAlignment === 'right' \? 'right' : 'left'/u
  );
  assert.match(
    source,
    /const centerElementText = id === 'intro'[\s\S]{0,120}hasOrderDocumentDecorationContentFrame\(elementDecoration\)/u,
    'only the direct-text Intro element may center its whole top-level box'
  );
  assert.doesNotMatch(
    source,
    /TEXT_STACK_ELEMENT_IDS/u,
    'composite top-level frames must retain flow; their semantic child boxes center independently'
  );
});
