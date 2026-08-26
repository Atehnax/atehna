import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import fontkit, { type Font as FontkitFont } from '@pdf-lib/fontkit';
import { PDFDocument, PDFPage, type PDFFont } from 'pdf-lib';

import {
  ORDER_DOCUMENT_DECORATED_TEXT_INSET_PT,
  cloneDefaultOrderDocumentTemplate,
  getOrderDocumentTextAlignmentCascadeTargets,
  getOrderDocumentTextAlignmentOverride,
  materializeOrderDocumentTable,
  normalizeOrderDocumentTemplate,
  orderDocumentTextAlignmentTargetKey,
  resetOrderDocumentTextAlignment,
  resolveOrderDocumentTable,
  resolveOrderDocumentTextAlignment,
  setOrderDocumentDecoration,
  setOrderDocumentTextAlignment,
  setOrderDocumentTypography,
  type OrderDocumentTextAlignmentTarget
} from '../../src/shared/domain/order/orderDocumentTemplates';
import {
  generateOrderPdf,
  resolveOrderDocumentPdfOpticalLeftAlignedTextX,
  resolveOrderDocumentPdfOpticalRightAlignedTextX,
  resolveOrderDocumentPdfPairedTextLayout,
  type GenerateOrderPdfInput,
  type PdfOrder
} from '../../src/shared/server/pdf';

const ISSUED_AT = new Date('2026-08-26T10:00:00.000Z');

const pdfMetricFont = (fileName: string) => fontkit.create(readFileSync(
  `${process.cwd()}/public/fonts/${fileName}`
));

const inkOffsetsPt = (font: FontkitFont, text: string, size: number) => {
  const run = font.layout(text);
  let advance = 0;
  let inkLeft = Number.POSITIVE_INFINITY;
  let inkRight = Number.NEGATIVE_INFINITY;
  run.glyphs.forEach((glyph, index) => {
    const position = run.positions[index];
    if (!position) return;
    const box = glyph.bbox;
    if (box.maxX > box.minX || box.maxY > box.minY) {
      inkLeft = Math.min(inkLeft, advance + position.xOffset + box.minX);
      inkRight = Math.max(inkRight, advance + position.xOffset + box.maxX);
    }
    advance += position.xAdvance;
  });
  assert.ok(Number.isFinite(inkLeft), `missing left glyph ink for ${text}`);
  assert.ok(Number.isFinite(inkRight), `missing right glyph ink for ${text}`);
  const scale = size / font.unitsPerEm;
  return { left: inkLeft * scale, right: inkRight * scale };
};

const leftInkOffsetPt = (font: FontkitFont, text: string, size: number) =>
  inkOffsetsPt(font, text, size).left;

const rightInkOffsetPt = (font: FontkitFont, text: string, size: number) =>
  inkOffsetsPt(font, text, size).right;

const ORDER: PdfOrder = {
  customerType: 'school',
  organizationName: 'Šola poravnav',
  contactName: 'Maja Novak',
  email: 'maja@example.test',
  deliveryAddress: 'Testna 1, Ljubljana',
  reference: 'ALIGN-1',
  notes: '',
  createdAt: new Date('2026-08-20T10:00:00.000Z'),
  subtotal: 65.3,
  shipping: 1.1,
  tax: 14.37,
  taxRate: 22,
  total: 80.77,
  commitmentStatus: 'binding'
};

test('alignment targets share stable identities and table cascades with typography', () => {
  const header = { kind: 'table_header_cell', columnId: 'lineTotal' } as const;
  const cell = { kind: 'table_cell', rowNumber: 2, columnId: 'description' } as const;
  assert.equal(orderDocumentTextAlignmentTargetKey(header), 'table_header_cell:lineTotal');
  assert.equal(orderDocumentTextAlignmentTargetKey(cell), 'table_cell:2:description');
  assert.deepEqual(getOrderDocumentTextAlignmentCascadeTargets(header), [
    { kind: 'table_header' },
    { kind: 'table_column', columnId: 'lineTotal' },
    header
  ]);
  assert.deepEqual(getOrderDocumentTextAlignmentCascadeTargets(cell), [
    { kind: 'table_body' },
    { kind: 'table_column', columnId: 'description' },
    { kind: 'table_row', rowNumber: 2 },
    cell
  ]);
});

test('sparse alignment persists and resets independently at every table scope', () => {
  let template = materializeOrderDocumentTable(
    cloneDefaultOrderDocumentTemplate('order_summary')
  );
  const targets: readonly OrderDocumentTextAlignmentTarget[] = [
    { kind: 'element', elementId: 'items' },
    { kind: 'table_header' },
    { kind: 'table_body' },
    { kind: 'table_column', columnId: 'lineTotal' },
    { kind: 'table_header_cell', columnId: 'lineTotal' },
    { kind: 'table_row', rowNumber: 2 },
    { kind: 'table_cell', rowNumber: 2, columnId: 'lineTotal' }
  ];
  for (const [index, target] of targets.entries()) {
    template = setOrderDocumentTextAlignment(
      template,
      target,
      (['left', 'center', 'right'] as const)[index % 3]!
    );
  }
  template = setOrderDocumentTypography(
    template,
    { kind: 'table_cell', rowNumber: 2, columnId: 'lineTotal' },
    { fontWeight: 'bold' }
  );
  template = normalizeOrderDocumentTemplate(
    'order_summary',
    JSON.parse(JSON.stringify(template))
  );

  for (const [index, target] of targets.entries()) {
    assert.equal(
      getOrderDocumentTextAlignmentOverride(template, target),
      (['left', 'center', 'right'] as const)[index % 3]
    );
  }
  assert.equal(
    resolveOrderDocumentTextAlignment(template, {
      kind: 'table_cell',
      rowNumber: 2,
      columnId: 'lineTotal'
    }),
    'left',
    'the exact cell wins after body, column, and row scopes'
  );

  template = resetOrderDocumentTextAlignment(template, {
    kind: 'table_cell',
    rowNumber: 2,
    columnId: 'lineTotal'
  });
  const exactCell = resolveOrderDocumentTable(template).cellTypographyOverrides.find(
    (cell) => cell.rowNumber === 2 && cell.columnId === 'lineTotal'
  );
  assert.equal(exactCell?.textAlign, undefined);
  assert.equal(exactCell?.typography?.fontWeight, 'bold');
});

test('justify persists through the ordinary and exact-cell alignment cascades', () => {
  const fieldTarget = {
    kind: 'field_row', group: 'notes', rowId: 'notes_content'
  } as const;
  const cellTarget = {
    kind: 'table_cell', rowNumber: 1, columnId: 'description'
  } as const;
  let template = setOrderDocumentTextAlignment(
    cloneDefaultOrderDocumentTemplate('order_summary'),
    fieldTarget,
    'justify'
  );
  template = setOrderDocumentTextAlignment(template, cellTarget, 'justify');
  template = normalizeOrderDocumentTemplate(
    'order_summary',
    JSON.parse(JSON.stringify(template))
  );
  assert.equal(getOrderDocumentTextAlignmentOverride(template, fieldTarget), 'justify');
  assert.equal(resolveOrderDocumentTextAlignment(template, fieldTarget), 'justify');
  assert.equal(getOrderDocumentTextAlignmentOverride(template, cellTarget), 'justify');
  assert.equal(resolveOrderDocumentTextAlignment(template, cellTarget), 'justify');
});

test('automatic semantic alignment preserves title, totals, footer, and numeric columns', () => {
  const template = cloneDefaultOrderDocumentTemplate('order_summary');
  assert.equal(resolveOrderDocumentTextAlignment(template, {
    kind: 'field_row', group: 'totals', rowId: 'tax'
  }), 'distributed');
  assert.equal(resolveOrderDocumentTextAlignment(template, {
    kind: 'field_row', group: 'footer', rowId: 'footer_text'
  }), 'center');
  assert.equal(resolveOrderDocumentTextAlignment(template, {
    kind: 'field_row', group: 'footer', rowId: 'page_numbers'
  }), 'right');
  assert.equal(resolveOrderDocumentTextAlignment(template, {
    kind: 'table_cell', rowNumber: 1, columnId: 'lineTotal'
  }), 'right');
  assert.equal(resolveOrderDocumentTextAlignment(template, {
    kind: 'table_cell', rowNumber: 1, columnId: 'description'
  }), 'left');

  const rightTitle = {
    ...template,
    style: { ...template.style, titleAlignment: 'right' as const }
  };
  assert.equal(resolveOrderDocumentTextAlignment(rightTitle, {
    kind: 'field_row', group: 'title', rowId: 'title_text'
  }), 'right');
});

test('ordinary field rows inherit their element, persist an exact override, and reset to auto', () => {
  let template = cloneDefaultOrderDocumentTemplate('order_summary');
  template = setOrderDocumentTextAlignment(
    template,
    { kind: 'element', elementId: 'notes' },
    'right'
  );
  assert.equal(resolveOrderDocumentTextAlignment(template, {
    kind: 'field_row', group: 'notes', rowId: 'notes_label'
  }), 'right');

  const contentTarget = {
    kind: 'field_row', group: 'notes', rowId: 'notes_content'
  } as const;
  template = setOrderDocumentTextAlignment(template, contentTarget, 'center');
  template = normalizeOrderDocumentTemplate(
    'order_summary',
    JSON.parse(JSON.stringify(template))
  );
  assert.equal(getOrderDocumentTextAlignmentOverride(template, contentTarget), 'center');
  assert.equal(resolveOrderDocumentTextAlignment(template, contentTarget), 'center');

  template = resetOrderDocumentTextAlignment(template, contentTarget);
  assert.equal(resolveOrderDocumentTextAlignment(template, contentTarget), 'right');
  template = resetOrderDocumentTextAlignment(
    template,
    { kind: 'element', elementId: 'notes' }
  );
  assert.equal(resolveOrderDocumentTextAlignment(template, contentTarget), 'left');
});

test('real PDF places ordinary single-text rows left, center, and right inside padded frames', async () => {
  let template = cloneDefaultOrderDocumentTemplate('order_summary');
  template = {
    ...template,
    text: {
      ...template.text,
      paymentTerms: 'LEFT-SINGLE',
      closing: 'CENTER-SINGLE',
      signerName: 'RIGHT-SINGLE'
    }
  };
  const rows = [
    { rowId: 'payment_terms' as const, alignment: 'left' as const, text: 'LEFT-SINGLE', line: 5.25 },
    { rowId: 'closing_text' as const, alignment: 'center' as const, text: 'CENTER-SINGLE', line: 5.5 },
    { rowId: 'signer_name' as const, alignment: 'right' as const, text: 'RIGHT-SINGLE', line: 5.75 }
  ];
  for (const row of rows) {
    template = setOrderDocumentTextAlignment(
      template,
      { kind: 'field_row', group: 'closing', rowId: row.rowId },
      row.alignment
    );
    template = setOrderDocumentDecoration(
      template,
      { kind: 'field_row', group: 'closing', rowId: row.rowId },
      {
        outlineEnabled: true,
        outlineSides: ['left', 'right', 'top', 'bottom'],
        outlineWidthPt: row.line,
        paddingPt: 3
      }
    );
  }
  const wanted = new Set(rows.map((row) => row.text));
  const texts = new Map<string, { x: number; size: number; font: PDFFont }>();
  const outlines = new Map<number, number[]>();
  const originalDrawText = PDFPage.prototype.drawText;
  const originalDrawLine = PDFPage.prototype.drawLine;
  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    if (wanted.has(text) && typeof options.x === 'number' && options.font && options.size) {
      texts.set(text, { x: options.x, size: options.size, font: options.font });
    }
    return originalDrawText.call(this, text, options);
  };
  PDFPage.prototype.drawLine = function drawLine(options) {
    const thickness = options.thickness;
    if (typeof thickness === 'number' && rows.some((row) => row.line === thickness)) {
      outlines.set(
        thickness,
        [...(outlines.get(thickness) ?? []), options.start.x, options.end.x]
      );
    }
    return originalDrawLine.call(this, options);
  };
  try {
    await generateOrderPdf({
      type: 'order_summary',
      template,
      order: ORDER,
      items: [{
        sku: 'SINGLE-ALIGN',
        name: 'Single alignment item',
        unit: 'kos',
        quantity: 1,
        unitPrice: 65.3,
        lineTotal: 65.3,
        taxRate: 22,
        discountPercentage: 0
      }],
      documentNumber: 'PN-SINGLE-ALIGN',
      issuedAt: ISSUED_AT,
      logoArtwork: null
    });
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
    PDFPage.prototype.drawLine = originalDrawLine;
  }
  for (const row of rows) {
    const text = texts.get(row.text);
    assert.ok(text, `missing ordinary PDF row ${row.text}`);
    const xs = outlines.get(row.line);
    assert.ok(xs && xs.length === 8, `missing four-sided ${row.line}pt outline`);
    const frameX = Math.min(...xs);
    const frameRight = Math.max(...xs);
    const contentX = frameX + 6;
    const contentWidth = frameRight - frameX - 12;
    const textWidth = text.font.widthOfTextAtSize(row.text, text.size);
    const expected = row.alignment === 'right'
      ? contentX + contentWidth - textWidth
      : row.alignment === 'center'
        ? contentX + (contentWidth - textWidth) / 2
        : contentX;
    assert.ok(
      Math.abs(text.x - expected) < 0.01,
      `${row.alignment} ordinary row: ${text.x} vs ${expected}`
    );
  }
});

test('real PDF table honors header, body, column, row, and exact-cell alignment precedence', async () => {
  let template = cloneDefaultOrderDocumentTemplate('order_summary');
  template = {
    ...template,
    text: {
      ...template.text,
      labels: {
        ...template.text.labels,
        unitPrice: 'TABLE-UNIT',
        lineTotal: 'TABLE-TOTAL'
      }
    }
  };
  template = setOrderDocumentTextAlignment(template, { kind: 'table_header' }, 'right');
  template = setOrderDocumentTextAlignment(
    template,
    { kind: 'table_column', columnId: 'lineTotal' },
    'left'
  );
  template = setOrderDocumentTextAlignment(
    template,
    { kind: 'table_header_cell', columnId: 'lineTotal' },
    'center'
  );
  template = setOrderDocumentTextAlignment(template, { kind: 'table_body' }, 'center');
  template = setOrderDocumentTextAlignment(
    template,
    { kind: 'table_row', rowNumber: 1 },
    'right'
  );
  template = setOrderDocumentTextAlignment(
    template,
    { kind: 'table_cell', rowNumber: 1, columnId: 'lineTotal' },
    'left'
  );

  const wanted = new Set(['TABLE-TOTAL', '42,42\u00A0€', '84,84\u00A0€']);
  const texts = new Map<string, { x: number; size: number; font: PDFFont }>();
  const originalDrawText = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    if (wanted.has(text) && typeof options.x === 'number' && options.font && options.size) {
      texts.set(text, { x: options.x, size: options.size, font: options.font });
    }
    return originalDrawText.call(this, text, options);
  };
  try {
    await generateOrderPdf({
      type: 'order_summary',
      template,
      order: ORDER,
      items: [{
        sku: 'TABLE-ALIGN',
        name: 'Table alignment item',
        unit: 'kos',
        quantity: 2,
        unitPrice: 42.42,
        lineTotal: 84.84,
        taxRate: 22,
        discountPercentage: 0
      }],
      documentNumber: 'PN-TABLE-ALIGN',
      issuedAt: ISSUED_AT,
      logoArtwork: null
    });
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
  }
  const table = resolveOrderDocumentTable(template);
  const visible = table.columns.filter((column) => column.visible);
  const ratioTotal = visible.reduce((sum, column) => sum + column.widthRatio, 0);
  const pageWidth = 595.28;
  const margin = template.style.marginMm * 72 / 25.4;
  const contentWidth = pageWidth - margin * 2;
  const geometry = new Map<string, { x: number; width: number }>();
  let columnX = margin;
  for (const column of visible) {
    const columnWidth = contentWidth * column.widthRatio / ratioTotal;
    geometry.set(column.id, { x: columnX, width: columnWidth });
    columnX += columnWidth;
  }
  const observed = (text: string) => {
    const value = texts.get(text);
    assert.ok(value, `missing PDF table text ${text}`);
    return value;
  };
  const width = (text: string) => {
    const value = observed(text);
    return value.font.widthOfTextAtSize(text, value.size);
  };
  const close = (actual: number, expected: number, label: string) => assert.ok(
    Math.abs(actual - expected) < 0.01,
    `${label}: ${actual} vs ${expected}`
  );
  const totalColumn = geometry.get('lineTotal')!;
  close(
    observed('TABLE-TOTAL').x,
    totalColumn.x + 5 + (totalColumn.width - 10 - width('TABLE-TOTAL')) / 2,
    'exact header cell center wins'
  );
  close(
    observed('84,84\u00A0€').x,
    totalColumn.x + 5,
    'exact body cell left wins'
  );
  const unitPriceColumn = geometry.get('unitPrice')!;
  close(
    observed('42,42\u00A0€').x + width('42,42\u00A0€'),
    unitPriceColumn.x + unitPriceColumn.width - 5,
    'row right alignment wins over body center'
  );

  for (const target of [
    { kind: 'table_header' } as const,
    { kind: 'table_column', columnId: 'lineTotal' } as const,
    { kind: 'table_header_cell', columnId: 'lineTotal' } as const,
    { kind: 'table_body' } as const,
    { kind: 'table_row', rowNumber: 1 } as const,
    { kind: 'table_cell', rowNumber: 1, columnId: 'lineTotal' } as const
  ]) {
    template = resetOrderDocumentTextAlignment(template, target);
  }
  assert.equal(resolveOrderDocumentTextAlignment(template, {
    kind: 'table_cell', rowNumber: 1, columnId: 'lineTotal'
  }), 'right');
  assert.equal(resolveOrderDocumentTextAlignment(template, {
    kind: 'table_cell', rowNumber: 1, columnId: 'description'
  }), 'left');
});

test('paired PDF layout keeps label and value in their logical columns', () => {
  const base = { x: 100, width: 300, labelWidth: 70, valueWidth: 40, labelColumnRatio: 0.67 };
  assert.deepEqual(resolveOrderDocumentPdfPairedTextLayout({
    ...base,
    alignment: 'distributed'
  }), { labelX: 100, valueX: 360 });
  assert.deepEqual(resolveOrderDocumentPdfPairedTextLayout({
    ...base,
    alignment: 'left'
  }), { labelX: 100, valueX: 301 });
  assert.deepEqual(resolveOrderDocumentPdfPairedTextLayout({
    ...base,
    alignment: 'center'
  }), { labelX: 165.5, valueX: 330.5 });
  assert.deepEqual(resolveOrderDocumentPdfPairedTextLayout({
    ...base,
    alignment: 'right'
  }), { labelX: 231, valueX: 360 });
  assert.equal(resolveOrderDocumentPdfOpticalRightAlignedTextX({
    right: 400,
    advanceWidth: 40,
    rightSideBearing: 0.5
  }), 360.5);
  assert.equal(resolveOrderDocumentPdfOpticalLeftAlignedTextX({
    left: 100,
    leftSideBearing: 0.75
  }), 99.25);
});

test('real PDF gives default tax and zero-padding naturally outlined total identical content anchors', async () => {
  let template = cloneDefaultOrderDocumentTemplate('order_summary');
  template = {
    ...template,
    text: {
      ...template.text,
      labels: {
        ...template.text.labels,
        tax: 'Davek',
        total: 'Vrednost naročila'
      }
    }
  };
  template = setOrderDocumentDecoration(
    template,
    { kind: 'field_row', group: 'totals', rowId: 'total' },
    {
      outlineEnabled: true,
      outlineSides: ['left', 'right', 'top', 'bottom'],
      outlineWidthPt: 4.5,
      paddingPt: 0
    }
  );
  for (const rowId of ['tax', 'total'] as const) {
    template = setOrderDocumentTypography(
      template,
      { kind: 'field_row', group: 'totals', rowId },
      { fontFamily: 'barlow' }
    );
  }
  const wanted = new Set([
    'Davek 22 %',
    'Vrednost naročila',
    '14,37\u00A0€',
    '80,77\u00A0€'
  ]);
  const texts = new Map<string, { x: number; size: number; font: PDFFont }>();
  const outlineXs: number[] = [];
  const originalDrawText = PDFPage.prototype.drawText;
  const originalDrawLine = PDFPage.prototype.drawLine;
  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    if (wanted.has(text) && typeof options.x === 'number' && options.font && options.size) {
      texts.set(text, { x: options.x, size: options.size, font: options.font });
    }
    return originalDrawText.call(this, text, options);
  };
  PDFPage.prototype.drawLine = function drawLine(options) {
    if (options.thickness === 4.5) {
      outlineXs.push(options.start.x, options.end.x);
    }
    return originalDrawLine.call(this, options);
  };
  try {
    await generateOrderPdf({
      type: 'order_summary',
      template,
      order: ORDER,
      items: [{
        sku: 'TAX-ANCHOR',
        name: 'Tax anchor item',
        unit: 'kos',
        quantity: 1,
        unitPrice: 65.3,
        lineTotal: 65.3,
        taxRate: 22,
        discountPercentage: 0
      }],
      documentNumber: 'PN-ANCHOR-1',
      issuedAt: ISSUED_AT,
      logoArtwork: null
    });
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
    PDFPage.prototype.drawLine = originalDrawLine;
  }
  const observed = (text: string) => {
    const value = texts.get(text);
    assert.ok(value, `missing PDF text ${text}`);
    return value;
  };
  const advanceRightEdge = (text: string) => {
    const value = observed(text);
    return value.x + value.font.widthOfTextAtSize(text, value.size);
  };
  const barlowRegular = pdfMetricFont('Barlow-400-normal.ttf');
  const barlowBold = pdfMetricFont('Barlow-700-normal.ttf');
  const inkRightEdge = (text: string, metricFont: FontkitFont) => {
    const value = observed(text);
    return value.x + rightInkOffsetPt(metricFont, text, value.size);
  };
  const inkLeftEdge = (text: string, metricFont: FontkitFont) => {
    const value = observed(text);
    return value.x + leftInkOffsetPt(metricFont, text, value.size);
  };
  const close = (left: number, right: number, label: string) => assert.ok(
    Math.abs(left - right) < 0.01,
    `${label}: ${left} vs ${right}`
  );
  close(
    inkLeftEdge('Davek 22 %', barlowRegular),
    inkLeftEdge('Vrednost naročila', barlowBold),
    'tax and total label optical left edges'
  );
  assert.ok(
    Math.abs(observed('Davek 22 %').x - observed('Vrednost naročila').x) > 0.1,
    'different first-glyph bearings retain different draw origins while their visible ink aligns'
  );
  close(
    inkRightEdge('14,37\u00A0€', barlowRegular),
    inkRightEdge('80,77\u00A0€', barlowBold),
    'tax and total amount optical right edges'
  );
  assert.ok(
    Math.abs(
      advanceRightEdge('14,37\u00A0€') - advanceRightEdge('80,77\u00A0€')
    ) > 0.1,
    'different Barlow weights retain different advance edges while their visible ink aligns'
  );
  assert.equal(outlineXs.length, 8, 'the total keeps a four-sided outline');
  close(
    inkLeftEdge('Vrednost naročila', barlowBold),
    Math.min(...outlineXs) + ORDER_DOCUMENT_DECORATED_TEXT_INSET_PT,
    'balanced automatic optical-left safety inset'
  );
  close(
    inkRightEdge('80,77\u00A0€', barlowBold),
    Math.max(...outlineXs) - ORDER_DOCUMENT_DECORATED_TEXT_INSET_PT,
    'balanced automatic optical-right safety inset'
  );
});

test('real PDF keeps outlined total on adjacent total anchors and renders all alignments', async () => {
  let template = cloneDefaultOrderDocumentTemplate('order_summary');
  template = {
    ...template,
    text: {
      ...template.text,
      labels: {
        ...template.text.labels,
        subtotal: 'LEFT-LABEL',
        shipping: 'CENTER-LABEL',
        tax: 'RIGHT-LABEL',
        total: 'DISTRIBUTED-LABEL'
      }
    }
  };
  template = setOrderDocumentTextAlignment(
    template,
    { kind: 'field_row', group: 'totals', rowId: 'subtotal' },
    'left'
  );
  template = setOrderDocumentTextAlignment(
    template,
    { kind: 'field_row', group: 'totals', rowId: 'shipping' },
    'center'
  );
  template = setOrderDocumentTextAlignment(
    template,
    { kind: 'field_row', group: 'totals', rowId: 'tax' },
    'right'
  );
  template = setOrderDocumentDecoration(
    template,
    { kind: 'field_row', group: 'totals', rowId: 'total' },
    {
      outlineEnabled: true,
      outlineSides: ['left', 'right', 'top', 'bottom'],
      outlineWidthPt: 4.25,
      paddingPt: 3
    }
  );

  const input: GenerateOrderPdfInput = {
    type: 'order_summary',
    template,
    order: ORDER,
    items: [{
      sku: 'ALIGN-SKU',
      name: 'Alignment item',
      unit: 'kos',
      quantity: 1,
      unitPrice: 65.3,
      lineTotal: 65.3,
      taxRate: 22,
      discountPercentage: 0
    }],
    documentNumber: 'PN-ALIGN-1',
    issuedAt: ISSUED_AT,
    logoArtwork: null
  };
  const wanted = new Set([
    'LEFT-LABEL',
    'CENTER-LABEL',
    'RIGHT-LABEL 22 %',
    'DISTRIBUTED-LABEL',
    '65,30\u00A0€',
    '1,10\u00A0€',
    '14,37\u00A0€',
    '80,77\u00A0€'
  ]);
  const texts = new Map<string, { x: number; size: number; font: PDFFont }>();
  const outlineLines: Array<{ startX: number; endX: number }> = [];
  const originalDrawText = PDFPage.prototype.drawText;
  const originalDrawLine = PDFPage.prototype.drawLine;
  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    if (wanted.has(text) && typeof options.x === 'number' && options.font && options.size) {
      texts.set(text, { x: options.x, size: options.size, font: options.font });
    }
    return originalDrawText.call(this, text, options);
  };
  PDFPage.prototype.drawLine = function drawLine(options) {
    if (options.thickness === 4.25) {
      outlineLines.push({ startX: options.start.x, endX: options.end.x });
    }
    return originalDrawLine.call(this, options);
  };

  try {
    const bytes = await generateOrderPdf(input);
    await PDFDocument.load(bytes);
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
    PDFPage.prototype.drawLine = originalDrawLine;
  }

  const observed = (text: string) => {
    const value = texts.get(text);
    assert.ok(value, `missing PDF text ${text}`);
    return value;
  };
  const width = (text: string) => {
    const value = observed(text);
    return value.font.widthOfTextAtSize(text, value.size);
  };
  const notoRegular = pdfMetricFont('NotoSans-Regular.ttf');
  const notoBold = pdfMetricFont('NotoSans-Bold.ttf');
  const opticalRight = (text: string, metricFont: FontkitFont) => {
    const value = observed(text);
    return value.x + rightInkOffsetPt(metricFont, text, value.size);
  };
  const opticalLeft = (text: string, metricFont: FontkitFont) => {
    const value = observed(text);
    return value.x + leftInkOffsetPt(metricFont, text, value.size);
  };
  const close = (actual: number, expected: number, label: string) => assert.ok(
    Math.abs(actual - expected) < 0.01,
    `${label}: ${actual} vs ${expected}`
  );

  assert.equal(outlineLines.length, 4, 'the emphasized total retains its four-sided outline');
  const outlineX = Math.min(...outlineLines.flatMap((line) => [line.startX, line.endX]));
  const outlineRight = Math.max(...outlineLines.flatMap((line) => [line.startX, line.endX]));
  const contentX = outlineX + 6;
  const contentRight = outlineRight - 6;
  const contentWidth = contentRight - contentX;
  const splitX = contentX + contentWidth * 0.67;

  close(
    opticalLeft('DISTRIBUTED-LABEL', notoBold),
    contentX,
    'outlined distributed label optical anchor'
  );
  close(
    opticalRight('80,77\u00A0€', notoBold),
    contentRight,
    'outlined distributed amount optical edge'
  );
  close(opticalLeft('LEFT-LABEL', notoRegular), contentX, 'left label optical anchor');
  close(observed('65,30\u00A0€').x, splitX, 'left amount starts its value column');
  close(
    observed('CENTER-LABEL').x,
    contentX + (contentWidth * 0.67 - width('CENTER-LABEL')) / 2,
    'centered label'
  );
  close(
    observed('1,10\u00A0€').x,
    splitX + (contentWidth * 0.33 - width('1,10\u00A0€')) / 2,
    'centered amount'
  );
  close(
    observed('RIGHT-LABEL 22 %').x + width('RIGHT-LABEL 22 %'),
    splitX,
    'right-aligned label stays in its label column'
  );
  close(
    opticalRight('14,37\u00A0€', notoRegular),
    contentRight,
    'right-aligned amount keeps the established optical right edge'
  );
});
