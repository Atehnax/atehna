import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ORDER_DOCUMENT_CANVAS_ELEMENT_IDS,
  ORDER_DOCUMENT_SECTION_IDS,
  ORDER_DOCUMENT_TEMPLATE_TYPES,
  arrangeOrderDocumentTemplate,
  cloneDefaultOrderDocumentTemplate,
  materializeOrderDocumentCanvasElement,
  materializeOrderDocumentTable,
  normalizeOrderDocumentTemplate,
  resolveOrderDocumentCanvasElement,
  resolveOrderDocumentFieldRows,
  resolveOrderDocumentTable
} from '../../src/shared/domain/order/orderDocumentTemplates';

const mmPerPt = 25.4 / 72;

test('all five templates leave readable, separate regions inside the printable page', () => {
  for (const type of ORDER_DOCUMENT_TEMPLATE_TYPES) {
    const template = cloneDefaultOrderDocumentTemplate(type);
    const element = (id: Parameters<typeof resolveOrderDocumentCanvasElement>[1]) =>
      resolveOrderDocumentCanvasElement(template, id);
    const { marginMm, smallSizePt } = template.style;
    const header = element('header');
    const title = element('title');
    const customer = element('customer');
    const metadata = element('document_meta');
    const totals = element('totals');
    const footer = element('footer');

    assert.ok(title.yMm >= header.yMm + header.heightMm + 6, type);
    assert.equal(title.xMm, marginMm, type);
    assert.equal(title.widthMm, 210 - marginMm * 2, type);
    assert.ok(customer.yMm >= title.yMm + title.heightMm + 2, type);
    assert.equal(customer.yMm, metadata.yMm, type);
    assert.ok(metadata.xMm - (customer.xMm + customer.widthMm) >= 8, type);
    assert.ok(customer.widthMm >= 90, type);
    assert.ok(metadata.widthMm >= 75, type);
    const metadataRows = resolveOrderDocumentFieldRows(template, 'document_meta').length;
    assert.ok(metadata.heightMm >= metadataRows * (smallSizePt + 0.4) * 1.58 * mmPerPt, type);
    assert.equal(totals.xMm + totals.widthMm, 210 - marginMm, type);
    assert.ok(totals.widthMm < title.widthMm / 2, type);
    assert.ok(element('closing').yMm + element('closing').heightMm + 6 <= footer.yMm, type);
    assert.equal(footer.yMm + footer.heightMm, 297 - marginMm, type);
    for (const id of ORDER_DOCUMENT_CANVAS_ELEMENT_IDS) {
      const box = element(id);
      assert.equal(box.positioning, 'flow', type + '.' + id);
      assert.ok(box.xMm >= marginMm && box.xMm + box.widthMm <= 210 - marginMm, type + '.' + id);
      assert.ok(box.yMm >= marginMm && box.yMm + box.heightMm <= 297 - marginMm, type + '.' + id);
    }
  }
  assert.equal(
    resolveOrderDocumentFieldRows(cloneDefaultOrderDocumentTemplate('invoice'), 'document_meta').length,
    9
  );
});

test('default tables reserve readable line height and most width for the item description', () => {
  for (const type of ORDER_DOCUMENT_TEMPLATE_TYPES) {
    const template = cloneDefaultOrderDocumentTemplate(type);
    const table = resolveOrderDocumentTable(template);
    const description = table.columns.find((column) => column.id === 'description')!;
    assert.equal(table.columns.reduce((total, column) => total + column.widthRatio, 0), 100);
    assert.ok(description.widthRatio >= 40);
    assert.ok(table.rowHeightPt >= template.style.tableSizePt * 1.35 + template.style.rowPaddingPt * 2);
    assert.ok(table.headerHeightPt > table.rowHeightPt);
    assert.ok(template.style.tableSizePt >= 9);
  }
});

test('arranging a saved template removes overlapping placements while preserving business and visual content', () => {
  let source = materializeOrderDocumentCanvasElement(
    materializeOrderDocumentCanvasElement(
      materializeOrderDocumentTable(cloneDefaultOrderDocumentTemplate('invoice')),
      'customer'
    ),
    'document_meta'
  );
  source = materializeOrderDocumentCanvasElement(source, 'header');
  source.name = 'Moj račun';
  source.company.name = 'Podjetje po meri';
  source.text.title = 'RAČUN PO MERI';
  source.text.footerText = 'Davčni in bančni podatki po meri';
  source.text.labels.customer = 'Prejemnik';
  source.rules.dueDays = 42;
  source.style.marginMm = 25;
  source.style.textColor = '#163C42';
  source.layout.sections.reverse();
  source.layout.sections.find((section) => section.id === 'notes')!.enabled = false;
  source.layout.fieldRows = {
    customer: [
      { id: 'email', visible: false, placement: { yMm: -60, widthMm: 5 } },
      {
        id: 'customer',
        visible: true,
        typography: { fontWeight: 'bold', fontSizePt: 11 },
        placement: { xMm: 130, yMm: 250, heightMm: 4 },
        decoration: { outlineEnabled: true, outlineColor: '#246810' }
      }
    ],
    footer: []
  };
  const canvas = source.layout.canvas!;
  canvas.deletedElementIds = ['intro'];
  Object.assign(canvas.elements.customer!, {
    positioning: 'absolute', page: 4, xMm: 190, yMm: 280, widthMm: 8, heightMm: 5,
    condition: 'company_customer', backgroundColor: '#EEF4F5',
    typography: { fontFamily: 'barlow', fontSizePt: 11 }, visible: false
  });
  Object.assign(canvas.elements.document_meta!, {
    positioning: 'absolute', xMm: 12, yMm: 12, widthMm: 186, heightMm: 5
  });
  canvas.elements.header!.visible = false;
  source.layout.table!.columns[0].widthRatio = 88;
  source.layout.table!.columns[0].typography = { fontWeight: 'bold' };
  source.layout.table!.columns[0].visible = false;
  source.layout.table!.rowHeightOverrides = [
    { rowNumber: 1, heightPt: 8 },
    { rowNumber: 2, heightPt: 160, typography: { fontWeight: 'bold' }, textAlign: 'right' }
  ];
  source.layout.table!.cellTypographyOverrides = [
    { rowNumber: 1, columnId: 'description', typography: { fontSizePt: 10 } }
  ];
  const before = structuredClone(source);
  const arranged = arrangeOrderDocumentTemplate(source);

  assert.deepEqual(source, before, 'arranging must not mutate the active editor draft');
  assert.deepEqual(arranged.text, before.text);
  assert.deepEqual(arranged.company, before.company);
  assert.deepEqual(arranged.rules, before.rules);
  assert.equal(arranged.name, before.name);
  assert.equal(arranged.style.textColor, before.style.textColor);
  assert.deepEqual(arranged.layout.sections.map((section) => section.id), [...ORDER_DOCUMENT_SECTION_IDS]);
  assert.equal(arranged.layout.sections.find((section) => section.id === 'notes')!.enabled, false);
  assert.deepEqual(arranged.layout.fieldRows!.footer, []);
  assert.deepEqual(arranged.layout.fieldRows!.customer!.map((row) => [row.id, row.visible]), [
    ['email', false], ['customer', true]
  ]);
  assert.ok(arranged.layout.fieldRows!.customer!.every((row) => row.placement === undefined));
  assert.deepEqual(arranged.layout.fieldRows!.customer![1].typography, before.layout.fieldRows!.customer![1].typography);
  assert.deepEqual(arranged.layout.fieldRows!.customer![1].decoration, before.layout.fieldRows!.customer![1].decoration);

  const customer = arranged.layout.canvas!.elements.customer!;
  const metadata = arranged.layout.canvas!.elements.document_meta!;
  assert.equal(customer.visible, false);
  assert.equal(customer.condition, 'company_customer');
  assert.equal(customer.backgroundColor, '#EEF4F5');
  assert.deepEqual(customer.typography, before.layout.canvas!.elements.customer!.typography);
  assert.equal(arranged.layout.canvas!.elements.header!.visible, false);
  assert.equal(customer.positioning, 'flow');
  assert.equal(customer.page, 1);
  assert.ok(customer.xMm + customer.widthMm + 8 <= metadata.xMm);
  assert.equal(arranged.layout.canvas!.elements.intro, undefined);
  assert.deepEqual(arranged.layout.canvas!.deletedElementIds, ['intro']);
  const table = arranged.layout.table!;
  assert.equal(table.columns[0].visible, false);
  assert.deepEqual(table.columns[0].typography, before.layout.table!.columns[0].typography);
  assert.deepEqual(table.rowHeightOverrides, [
    { rowNumber: 2, typography: { fontWeight: 'bold' }, textAlign: 'right' }
  ]);
  assert.deepEqual(table.cellTypographyOverrides, before.layout.table!.cellTypographyOverrides);

  customer.typography!.fontSizePt = 20;
  arranged.layout.fieldRows!.customer![1].typography!.fontSizePt = 20;
  assert.deepEqual(source, before, 'the arranged copy must own all nested overrides');
});

test('arrangement is idempotent and survives saved-template normalization for every document type', () => {
  for (const type of ORDER_DOCUMENT_TEMPLATE_TYPES) {
    const arranged = arrangeOrderDocumentTemplate(cloneDefaultOrderDocumentTemplate(type));
    assert.deepEqual(arrangeOrderDocumentTemplate(arranged), arranged, type);
    assert.deepEqual(normalizeOrderDocumentTemplate(type, arranged), arranged, type);
  }
});

test('every default PDF prints complete quantity and unit column labels', async () => {
  const { PDFPage } = await import('pdf-lib');
  const { generateOrderPdf } = await import('../../src/shared/server/pdf');
  const { createOrderDocumentPreviewContext } = await import('../../src/shared/domain/order/orderDocumentPreview');
  const originalDrawText = PDFPage.prototype.drawText;
  let drawn: string[] = [];
  PDFPage.prototype.drawText = function drawText(value, options) {
    drawn.push(value);
    return originalDrawText.call(this, value, options);
  };
  try {
    for (const type of ORDER_DOCUMENT_TEMPLATE_TYPES) {
      drawn = [];
      const template = cloneDefaultOrderDocumentTemplate(type);
      await generateOrderPdf({ ...createOrderDocumentPreviewContext(type), template });
      for (const label of [template.text.labels.quantity, template.text.labels.unit]) {
        assert.ok(drawn.includes(label), type + ' must print the complete ' + label + ' header');
      }
    }
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
  }
});
