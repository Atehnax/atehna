import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFPage } from 'pdf-lib';

import {
  cloneDefaultOrderDocumentTemplate,
  getOrderDocumentTypographyCascadeTargets,
  getOrderDocumentTypographyOverride,
  materializeOrderDocumentTable,
  normalizeOrderDocumentTemplate,
  orderDocumentTypographyTargetKey,
  resetOrderDocumentTypography,
  resolveOrderDocumentTable,
  resolveOrderDocumentTableRowHeight,
  resolveOrderDocumentTypography,
  setOrderDocumentTable,
  setOrderDocumentTypography,
  type OrderDocumentTypographyTarget
} from '../../src/shared/domain/order/orderDocumentTemplates';
import {
  generateOrderPdf,
  type GenerateOrderPdfInput,
  type PdfOrder
} from '../../src/shared/server/pdf';

const ISSUED_AT = new Date('2026-08-25T10:00:00.000Z');

const SAMPLE_ORDER: PdfOrder = {
  customerType: 'school',
  organizationName: 'Osnovna šola',
  contactName: 'Maja Novak',
  email: 'maja.novak@example.test',
  deliveryAddress: 'Begunjska cesta 7, 4248 Lesce',
  reference: 'NAR-2026-0042',
  notes: '',
  createdAt: new Date('2026-08-20T10:00:00.000Z'),
  subtotal: 999,
  tax: 219.78,
  taxRate: 22,
  shipping: 0,
  total: 1218.78,
  commitmentStatus: 'binding'
};

const headerCellTarget = (columnId: 'sku' | 'lineTotal') => ({
  kind: 'table_header_cell' as const,
  columnId
});

const bodyCellTarget = (
  rowNumber: number,
  columnId: 'description' | 'lineTotal'
) => ({ kind: 'table_cell' as const, rowNumber, columnId });

function postscriptName(asset: string) {
  return fontkit.create(
    readFileSync(resolve(process.cwd(), 'public/fonts', asset))
  ).postscriptName;
}

test('table typography exposes stable identities and deterministic scope cascades', () => {
  const header = headerCellTarget('lineTotal');
  const body = bodyCellTarget(2, 'description');

  assert.equal(orderDocumentTypographyTargetKey(header), 'table_header_cell:lineTotal');
  assert.equal(orderDocumentTypographyTargetKey(body), 'table_cell:2:description');
  assert.deepEqual(getOrderDocumentTypographyCascadeTargets(header), [
    { kind: 'table_header' },
    { kind: 'table_column', columnId: 'lineTotal' },
    header
  ]);
  assert.deepEqual(getOrderDocumentTypographyCascadeTargets(body), [
    { kind: 'table_body' },
    { kind: 'table_column', columnId: 'description' },
    { kind: 'table_row', rowNumber: 2 },
    body
  ]);
});

test('header/body, column/row, and exact-cell typography resolve with exact cells last', () => {
  let template = cloneDefaultOrderDocumentTemplate('order_summary');
  const patches: ReadonlyArray<readonly [OrderDocumentTypographyTarget, Parameters<typeof setOrderDocumentTypography>[2]]> = [
    [{ kind: 'element', elementId: 'items' }, { fontFamily: 'barlow', fontSizePt: 8 }],
    [{ kind: 'table_header' }, { fontWeight: 'regular', fontStyle: 'italic' }],
    [{ kind: 'table_column', columnId: 'lineTotal' }, { fontWeight: 'medium', fontSizePt: 10 }],
    [headerCellTarget('lineTotal'), { fontWeight: 'bold', fontStyle: 'normal' }],
    [{ kind: 'table_body' }, { fontWeight: 'medium', fontSizePt: 9 }],
    [{ kind: 'table_column', columnId: 'description' }, { fontWeight: 'bold', fontSizePt: 10 }],
    [{ kind: 'table_row', rowNumber: 2 }, { fontWeight: 'regular', fontStyle: 'italic' }],
    [bodyCellTarget(2, 'description'), { fontWeight: 'semibold', fontSizePt: 11 }]
  ];
  for (const [target, patch] of patches) {
    template = setOrderDocumentTypography(template, target, patch);
  }

  assert.deepEqual(resolveOrderDocumentTypography(template, headerCellTarget('lineTotal')), {
    fontFamily: 'barlow',
    fontWeight: 'bold',
    fontStyle: 'normal',
    fontSizePt: 10
  });
  assert.deepEqual(resolveOrderDocumentTypography(template, headerCellTarget('sku')), {
    fontFamily: 'barlow',
    fontWeight: 'regular',
    fontStyle: 'italic',
    fontSizePt: 8
  });
  assert.deepEqual(resolveOrderDocumentTypography(template, bodyCellTarget(2, 'description')), {
    fontFamily: 'barlow',
    fontWeight: 'semibold',
    fontStyle: 'italic',
    fontSizePt: 11
  });
});

test('granular table typography survives saved JSON normalization and resets sparsely', () => {
  let template = materializeOrderDocumentTable(
    cloneDefaultOrderDocumentTemplate('invoice')
  );
  const targets: ReadonlyArray<OrderDocumentTypographyTarget> = [
    { kind: 'table_header' },
    { kind: 'table_body' },
    headerCellTarget('lineTotal'),
    { kind: 'table_row', rowNumber: 3 },
    bodyCellTarget(3, 'lineTotal')
  ];
  for (const target of targets) {
    template = setOrderDocumentTypography(template, target, {
      fontFamily: 'barlow',
      fontWeight: 'semibold',
      fontSizePt: 10.26
    });
  }

  template = normalizeOrderDocumentTemplate(
    'invoice',
    JSON.parse(JSON.stringify(template))
  );
  for (const target of targets) {
    assert.deepEqual(getOrderDocumentTypographyOverride(template, target), {
      fontFamily: 'barlow',
      fontWeight: 'semibold',
      fontSizePt: 10.5
    });
  }
  assert.deepEqual(
    resolveOrderDocumentTable(template).cellTypographyOverrides.map((cell) => [
      cell.rowNumber,
      cell.columnId
    ]),
    [[3, 'lineTotal']]
  );

  template = resetOrderDocumentTypography(template, bodyCellTarget(3, 'lineTotal'));
  assert.equal(
    getOrderDocumentTypographyOverride(template, bodyCellTarget(3, 'lineTotal')),
    undefined
  );
  assert.ok(getOrderDocumentTypographyOverride(template, { kind: 'table_row', rowNumber: 3 }));
  assert.equal(resolveOrderDocumentTable(template).cellTypographyOverrides.length, 0);
});

test('legacy shared column typography still affects both header and body cells', () => {
  let template = materializeOrderDocumentTable(
    cloneDefaultOrderDocumentTemplate('order_summary')
  );
  template = setOrderDocumentTypography(
    template,
    { kind: 'table_column', columnId: 'lineTotal' },
    { fontFamily: 'barlow', fontStyle: 'italic', fontSizePt: 10.5 }
  );
  const serialized = JSON.parse(JSON.stringify(template));
  delete serialized.layout.table.headerTypography;
  delete serialized.layout.table.bodyTypography;
  delete serialized.layout.table.cellTypographyOverrides;
  for (const column of serialized.layout.table.columns) delete column.headerTypography;
  template = normalizeOrderDocumentTemplate('order_summary', serialized);

  const header = resolveOrderDocumentTypography(template, headerCellTarget('lineTotal'));
  const body = resolveOrderDocumentTypography(template, bodyCellTarget(1, 'lineTotal'));
  assert.equal(header.fontFamily, 'barlow');
  assert.equal(header.fontStyle, 'italic');
  assert.equal(header.fontSizePt, 10.5);
  assert.equal(header.fontWeight, 'bold', 'legacy header default remains bold');
  assert.equal(body.fontFamily, 'barlow');
  assert.equal(body.fontStyle, 'italic');
  assert.equal(body.fontSizePt, 10.5);
  assert.equal(body.fontWeight, 'regular', 'legacy body default remains regular');
});

test('font-only row edits keep inheriting global height until height is explicitly overridden', () => {
  let template = materializeOrderDocumentTable(
    cloneDefaultOrderDocumentTemplate('order_summary')
  );
  template = setOrderDocumentTable(template, {
    ...resolveOrderDocumentTable(template),
    rowHeightPt: 20
  });
  template = setOrderDocumentTypography(
    template,
    { kind: 'table_row', rowNumber: 2 },
    { fontWeight: 'bold' }
  );

  let table = resolveOrderDocumentTable(template);
  const typographyOnly = table.rowHeightOverrides.find((row) => row.rowNumber === 2);
  assert.ok(typographyOnly?.typography);
  assert.equal(Object.hasOwn(typographyOnly, 'heightPt'), false);
  assert.equal(resolveOrderDocumentTableRowHeight(table, 2), 20);

  template = setOrderDocumentTable(template, { ...table, rowHeightPt: 36 });
  table = resolveOrderDocumentTable(template);
  assert.equal(
    resolveOrderDocumentTableRowHeight(table, 2),
    36,
    'a later global row-height edit must still reach a typography-only row'
  );

  template = setOrderDocumentTable(template, {
    ...table,
    rowHeightOverrides: table.rowHeightOverrides.map((row) =>
      row.rowNumber === 2 ? { ...row, heightPt: 24 } : row
    )
  });
  table = resolveOrderDocumentTable(template);
  template = setOrderDocumentTable(template, { ...table, rowHeightPt: 40 });
  assert.equal(resolveOrderDocumentTableRowHeight(resolveOrderDocumentTable(template), 2), 24);

  template = resetOrderDocumentTypography(
    template,
    { kind: 'table_row', rowNumber: 2 }
  );
  table = resolveOrderDocumentTable(template);
  assert.equal(getOrderDocumentTypographyOverride(template, {
    kind: 'table_row',
    rowNumber: 2
  }), undefined);
  assert.equal(resolveOrderDocumentTableRowHeight(table, 2), 24);
});

test("generated PDF bolds only the exact 'Skupna cena' header cell", async () => {
  let template = cloneDefaultOrderDocumentTemplate('order_summary');
  template = setOrderDocumentTypography(
    template,
    { kind: 'element', elementId: 'items' },
    { fontFamily: 'barlow', fontWeight: 'regular', fontStyle: 'normal' }
  );
  template = setOrderDocumentTypography(
    template,
    { kind: 'table_header' },
    { fontWeight: 'regular' }
  );
  template = setOrderDocumentTypography(
    template,
    headerCellTarget('lineTotal'),
    { fontWeight: 'bold' }
  );

  const input: GenerateOrderPdfInput = {
    type: 'order_summary',
    template,
    order: SAMPLE_ORDER,
    items: [{
      sku: 'SKU-EXACT',
      name: 'Izdelek za preverjanje',
      unit: 'kos',
      quantity: 1,
      unitPrice: 12.34,
      lineTotal: 12.34,
      taxRate: 22,
      discountPercentage: 0
    }],
    documentNumber: 'PN-2026-0042',
    issuedAt: ISSUED_AT,
    logoArtwork: null
  };
  const expectedRegular = postscriptName('Barlow-400-normal.ttf');
  const expectedBold = postscriptName('Barlow-700-normal.ttf');
  const observations = new Map<string, string | undefined>();
  const watched = new Set([
    template.text.labels.code,
    template.text.labels.lineTotal,
    '12,34\u00A0€'
  ]);
  const originalDrawText = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    if (watched.has(text)) observations.set(text, options.font?.name);
    return originalDrawText.call(this, text, options);
  };

  try {
    const bytes = await generateOrderPdf(input);
    await PDFDocument.load(bytes);
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
  }

  assert.equal(observations.get(template.text.labels.code), expectedRegular);
  assert.equal(observations.get(template.text.labels.lineTotal), expectedBold);
  assert.equal(observations.get('12,34\u00A0€'), expectedRegular);
});
