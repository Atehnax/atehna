import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFPage } from 'pdf-lib';
import {
  cloneDefaultOrderDocumentTemplate,
  getOrderDocumentTypographyCascadeTargets,
  getOrderDocumentTypographyOverride,
  normalizeOrderDocumentTemplate,
  orderDocumentTypographyTargetKey,
  resolveOrderDocumentTable,
  resolveOrderDocumentTableRowHeight,
  resolveOrderDocumentTypography,
  setOrderDocumentTable,
  setOrderDocumentTypography
} from '../../src/shared/domain/order/orderDocumentTemplates';
import {
  formatOrderDocumentCurrency
} from '../../src/shared/domain/order/orderDocumentPreview';
import {
  generateOrderPdf,
  type GenerateOrderPdfInput,
  type PdfItem,
  type PdfOrder
} from '../../src/shared/server/pdf';

const ISSUED_AT = new Date('2026-08-25T10:00:00.000Z');

const ORDER: PdfOrder = {
  customerType: 'company',
  organizationName: 'Typography test',
  contactName: 'Test',
  email: 'test@example.test',
  deliveryAddress: 'Testna 1, Ljubljana',
  reference: 'REF-TYPE',
  notes: '',
  createdAt: ISSUED_AT,
  subtotal: 33.33,
  tax: 7.33,
  taxRate: 22,
  shipping: 0,
  total: 40.66,
  commitmentStatus: 'binding'
};

const ITEMS: PdfItem[] = [
  {
    sku: 'CELL-1',
    name: 'Prva vrstica',
    unit: 'kos',
    quantity: 1,
    unitPrice: 3.21,
    lineTotal: 11.11,
    taxRate: 22,
    discountPercentage: 0
  },
  {
    sku: 'CELL-2',
    name: 'Druga vrstica',
    unit: 'kos',
    quantity: 1,
    unitPrice: 4.32,
    lineTotal: 22.22,
    taxRate: 22,
    discountPercentage: 0
  }
];

test('table typography target keys and cascades are stable and deterministic', () => {
  const headerCell = { kind: 'table_header_cell', columnId: 'lineTotal' } as const;
  const bodyCell = {
    kind: 'table_cell',
    rowNumber: 2,
    columnId: 'lineTotal'
  } as const;

  assert.equal(orderDocumentTypographyTargetKey(headerCell), 'table_header_cell:lineTotal');
  assert.equal(orderDocumentTypographyTargetKey(bodyCell), 'table_cell:2:lineTotal');
  assert.deepEqual(getOrderDocumentTypographyCascadeTargets(headerCell), [
    { kind: 'table_header' },
    { kind: 'table_column', columnId: 'lineTotal' },
    headerCell
  ]);
  assert.deepEqual(getOrderDocumentTypographyCascadeTargets(bodyCell), [
    { kind: 'table_body' },
    { kind: 'table_column', columnId: 'lineTotal' },
    { kind: 'table_row', rowNumber: 2 },
    bodyCell
  ]);
});

test('table typography resolves items then header/body, column, row, and cell precedence', () => {
  let template = cloneDefaultOrderDocumentTemplate('order_summary');
  template = setOrderDocumentTypography(
    template,
    { kind: 'element', elementId: 'items' },
    { fontFamily: 'barlow', fontSizePt: 7 }
  );
  template = setOrderDocumentTypography(
    template,
    { kind: 'table_header' },
    { fontWeight: 'regular', fontSizePt: 8 }
  );
  template = setOrderDocumentTypography(
    template,
    { kind: 'table_body' },
    { fontWeight: 'medium', fontSizePt: 8.5 }
  );
  template = setOrderDocumentTypography(
    template,
    { kind: 'table_column', columnId: 'lineTotal' },
    { fontStyle: 'italic', fontSizePt: 9 }
  );
  template = setOrderDocumentTypography(
    template,
    { kind: 'table_header_cell', columnId: 'lineTotal' },
    { fontWeight: 'bold', fontSizePt: 12 }
  );
  template = setOrderDocumentTypography(
    template,
    { kind: 'table_row', rowNumber: 1 },
    { fontWeight: 'regular', fontSizePt: 10 }
  );
  template = setOrderDocumentTypography(
    template,
    { kind: 'table_cell', rowNumber: 1, columnId: 'lineTotal' },
    { fontWeight: 'bold', fontSizePt: 11 }
  );

  assert.deepEqual(resolveOrderDocumentTypography(template, {
    kind: 'table_header_cell',
    columnId: 'lineTotal'
  }), {
    fontFamily: 'barlow',
    fontWeight: 'bold',
    fontStyle: 'italic',
    fontSizePt: 12
  });
  assert.deepEqual(resolveOrderDocumentTypography(template, {
    kind: 'table_cell',
    rowNumber: 1,
    columnId: 'lineTotal'
  }), {
    fontFamily: 'barlow',
    fontWeight: 'bold',
    fontStyle: 'italic',
    fontSizePt: 11
  });
  assert.deepEqual(resolveOrderDocumentTypography(template, {
    kind: 'table_cell',
    rowNumber: 2,
    columnId: 'lineTotal'
  }), {
    fontFamily: 'barlow',
    fontWeight: 'medium',
    fontStyle: 'italic',
    fontSizePt: 9
  });
  assert.equal(
    resolveOrderDocumentTypography(template, {
      kind: 'table_cell',
      rowNumber: 1,
      columnId: 'description'
    }).fontSizePt,
    10,
    'row scope applies across body columns'
  );
});

test('granular typography survives normalization and does not freeze inherited row height', () => {
  let template = cloneDefaultOrderDocumentTemplate('order_summary');
  template = setOrderDocumentTypography(
    template,
    { kind: 'table_header_cell', columnId: 'lineTotal' },
    { fontWeight: 'bold' }
  );
  template = setOrderDocumentTypography(
    template,
    { kind: 'table_row', rowNumber: 2 },
    { fontWeight: 'semibold' }
  );
  template = setOrderDocumentTypography(
    template,
    { kind: 'table_cell', rowNumber: 2, columnId: 'sku' },
    { fontStyle: 'italic' }
  );

  let table = resolveOrderDocumentTable(template);
  const fontOnlyRow = table.rowHeightOverrides.find((row) => row.rowNumber === 2);
  assert.equal(fontOnlyRow?.heightPt, undefined);
  assert.equal(resolveOrderDocumentTableRowHeight(table, 2), table.rowHeightPt);

  template = setOrderDocumentTable(template, { ...table, rowHeightPt: 37 });
  table = resolveOrderDocumentTable(template);
  assert.equal(resolveOrderDocumentTableRowHeight(table, 2), 37);

  const normalized = normalizeOrderDocumentTemplate(
    'order_summary',
    JSON.parse(JSON.stringify(template)) as unknown
  );
  assert.deepEqual(getOrderDocumentTypographyOverride(normalized, {
    kind: 'table_header_cell',
    columnId: 'lineTotal'
  }), { fontWeight: 'bold' });
  assert.deepEqual(getOrderDocumentTypographyOverride(normalized, {
    kind: 'table_row',
    rowNumber: 2
  }), { fontWeight: 'semibold' });
  assert.deepEqual(getOrderDocumentTypographyOverride(normalized, {
    kind: 'table_cell',
    rowNumber: 2,
    columnId: 'sku'
  }), { fontStyle: 'italic' });
  assert.equal(resolveOrderDocumentTableRowHeight(resolveOrderDocumentTable(normalized), 2), 37);
});

test('PDF renderer applies header-cell and exact body-cell typography independently', async () => {
  let template = cloneDefaultOrderDocumentTemplate('order_summary');
  template = {
    ...template,
    text: {
      ...template.text,
      labels: { ...template.text.labels, lineTotal: 'Znesek' }
    }
  };
  template = setOrderDocumentTypography(
    template,
    { kind: 'table_header' },
    { fontWeight: 'regular', fontSizePt: 8 }
  );
  template = setOrderDocumentTypography(
    template,
    { kind: 'table_header_cell', columnId: 'lineTotal' },
    { fontWeight: 'bold', fontSizePt: 12 }
  );
  template = setOrderDocumentTypography(
    template,
    { kind: 'table_column', columnId: 'lineTotal' },
    { fontWeight: 'regular', fontSizePt: 7.5 }
  );
  template = setOrderDocumentTypography(
    template,
    { kind: 'table_cell', rowNumber: 1, columnId: 'lineTotal' },
    { fontWeight: 'bold', fontSizePt: 11 }
  );

  const watched = new Set([
    'Znesek',
    formatOrderDocumentCurrency(11.11),
    formatOrderDocumentCurrency(22.22)
  ]);
  const observations = new Map<string, Array<{ size?: number; fontName?: string }>>();
  const originalDrawText = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    if (watched.has(text)) {
      observations.set(text, [
        ...(observations.get(text) ?? []),
        { size: options.size, fontName: options.font?.name }
      ]);
    }
    return originalDrawText.call(this, text, options);
  };
  try {
    const input: GenerateOrderPdfInput = {
      type: 'order_summary',
      template,
      order: ORDER,
      items: ITEMS,
      documentNumber: 'PN-TYPE',
      issuedAt: ISSUED_AT
    };
    await generateOrderPdf(input);
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
  }

  const header = observations.get('Znesek')?.[0];
  const firstCell = observations.get(formatOrderDocumentCurrency(11.11))?.[0];
  const secondCell = observations.get(formatOrderDocumentCurrency(22.22))?.[0];
  assert.equal(header?.size, 12);
  assert.match(header?.fontName ?? '', /bold|700/iu);
  assert.equal(firstCell?.size, 11);
  assert.match(firstCell?.fontName ?? '', /bold|700/iu);
  assert.equal(secondCell?.size, 7.5);
  assert.doesNotMatch(secondCell?.fontName ?? '', /bold|700/iu);
});
