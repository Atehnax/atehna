import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument, PDFPage } from 'pdf-lib';
import {
  DELIVERY_NOTE_CURRENT_ITEMS_LABEL,
  DELIVERY_NOTE_LATER_ITEMS_LABEL,
  createOrderDocumentPreviewContext,
  resolveOrderDocumentItemSections,
  type OrderDocumentPreviewItem
} from '../../src/shared/domain/order/orderDocumentPreview';
import { cloneDefaultOrderDocumentTemplate } from '../../src/shared/domain/order/orderDocumentTemplates';
import { estimateOrderDocumentFlowElementHeightMm } from '../../src/shared/domain/order/orderDocumentFlowLayout';
import {
  generateOrderPdf,
  type GenerateOrderPdfInput,
  type PdfItem,
  type PdfOrder
} from '../../src/shared/server/pdf';

const ISSUED_AT = new Date('2026-08-25T10:00:00.000Z');
const ORDER: PdfOrder = {
  customerType: 'company',
  organizationName: 'Testno podjetje d.o.o.',
  contactName: 'Ana Novak',
  email: 'ana@example.test',
  deliveryAddress: 'Testna cesta 1, 1000 Ljubljana',
  reference: 'NAR-42',
  createdAt: new Date('2026-08-20T10:00:00.000Z'),
  subtotal: 40,
  tax: 8.8,
  taxRate: 22,
  shipping: 0,
  total: 48.8,
  commitmentStatus: 'binding'
};

function item(name: string, shipLater = false): PdfItem {
  return {
    sku: name.toUpperCase().replaceAll(' ', '-'),
    name,
    unit: 'kos',
    quantity: 1,
    unitPrice: 10,
    lineTotal: 10,
    taxRate: 22,
    discountPercentage: 0,
    shipLater
  };
}

function input(type: GenerateOrderPdfInput['type'], items: PdfItem[]): GenerateOrderPdfInput {
  return {
    type,
    template: cloneDefaultOrderDocumentTemplate(type),
    order: ORDER,
    items,
    documentNumber: type === 'dobavnica' ? 'D-2026-0042' : 'R-2026-0042',
    issuedAt: ISSUED_AT
  };
}

async function renderAndObserveText(pdfInput: GenerateOrderPdfInput) {
  const originalDrawText = PDFPage.prototype.drawText;
  const observed: string[] = [];
  const observedDraws: Array<{ text: string; y: number }> = [];
  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    observed.push(text);
    observedDraws.push({ text, y: Number(options.y ?? Number.NaN) });
    return originalDrawText.call(this, text, options);
  };
  try {
    const bytes = await generateOrderPdf(pdfInput);
    const document = await PDFDocument.load(bytes);
    return { observed, observedDraws, pageCount: document.getPageCount() };
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
  }
}

test('delivery-note item sections put current lines first and keep one global row-number sequence', () => {
  const items: OrderDocumentPreviewItem[] = [
    item('Later B', true),
    item('Current A'),
    item('Current C'),
    item('Later D', true)
  ];
  const sections = resolveOrderDocumentItemSections('dobavnica', items);

  assert.deepEqual(sections.map((section) => ({
    id: section.id,
    label: section.label,
    names: section.items.map((entry) => entry.name),
    startRowNumber: section.startRowNumber
  })), [
    {
      id: 'current',
      label: DELIVERY_NOTE_CURRENT_ITEMS_LABEL,
      names: ['Current A', 'Current C'],
      startRowNumber: 1
    },
    {
      id: 'later',
      label: DELIVERY_NOTE_LATER_ITEMS_LABEL,
      names: ['Later B', 'Later D'],
      startRowNumber: 3
    }
  ]);
});

test('all-current delivery notes and non-delivery documents retain the legacy single-table order', () => {
  const allCurrent = [item('First'), item('Second')];
  const deferred = [item('Later first', true), item('Current second')];

  assert.deepEqual(resolveOrderDocumentItemSections('dobavnica', allCurrent), [{
    id: 'all',
    label: null,
    items: allCurrent,
    startRowNumber: 1
  }]);
  assert.deepEqual(resolveOrderDocumentItemSections('invoice', deferred), [{
    id: 'all',
    label: null,
    items: deferred,
    startRowNumber: 1
  }]);
});

test('delivery-note template preview reserves room for both labels and both table headers', () => {
  const template = cloneDefaultOrderDocumentTemplate('dobavnica');
  const splitContext = createOrderDocumentPreviewContext('dobavnica');
  const singleTableContext = {
    ...splitContext,
    items: splitContext.items.map((entry) => ({ ...entry, shipLater: false }))
  };
  const splitHeight = estimateOrderDocumentFlowElementHeightMm(
    template,
    splitContext,
    'items',
    190
  );
  const singleTableHeight = estimateOrderDocumentFlowElementHeightMm(
    template,
    singleTableContext,
    'items',
    190
  );

  assert.equal(resolveOrderDocumentItemSections('dobavnica', splitContext.items).length, 2);
  assert.ok(splitHeight > singleTableHeight);
});

test('Dobavnica renders two labelled tables, current lines first, and one totals block', async () => {
  const pdfInput = input('dobavnica', [
    item('Later B', true),
    item('Current A'),
    item('Current C'),
    item('Later D', true)
  ]);
  const { observed } = await renderAndObserveText(pdfInput);
  const positions = [
    DELIVERY_NOTE_CURRENT_ITEMS_LABEL,
    'Current A',
    'Current C',
    DELIVERY_NOTE_LATER_ITEMS_LABEL,
    'Later B',
    'Later D'
  ].map((text) => observed.indexOf(text));

  assert.ok(positions.every((position) => position >= 0), 'both section labels and every line must render');
  assert.deepEqual([...positions].sort((left, right) => left - right), positions);
  assert.equal(
    observed.filter((text) => text === pdfInput.template.text.labels.subtotal).length,
    1,
    'the full-order totals block must render once after both item sections'
  );
});

test('split delivery-note labels repeat with table headers after page breaks', async () => {
  const current = Array.from({ length: 64 }, (_, index) => item(
    `Current item ${index + 1} with a sufficiently long description for pagination`
  ));
  const later = Array.from({ length: 4 }, (_, index) => item(
    `Later item ${index + 1}`,
    true
  ));
  const pdfInput = input('dobavnica', [...current, ...later]);
  const { observed, pageCount } = await renderAndObserveText(pdfInput);

  assert.ok(pageCount > 1);
  assert.ok(
    observed.filter((text) => text === DELIVERY_NOTE_CURRENT_ITEMS_LABEL).length > 1,
    'the active section label must repeat when its table continues on another page'
  );
  assert.ok(observed.includes(DELIVERY_NOTE_LATER_ITEMS_LABEL));
  assert.equal(
    observed.filter((text) => text === pdfInput.template.text.labels.subtotal).length,
    1
  );
});

test('a tall wrapped delivery-note row continues above the page bottom with its section context', async () => {
  const tallDescription = Array.from(
    { length: 240 },
    (_, index) => `TALLROW-${String(index).padStart(4, '0')}`
  ).join(' ');
  const pdfInput = input('dobavnica', [
    item(tallDescription),
    item('Later item', true)
  ]);
  const { observed, observedDraws, pageCount } = await renderAndObserveText(pdfInput);
  const tallRowDraws = observedDraws.filter(({ text }) => text.includes('TALLROW-'));

  assert.ok(pageCount > 2, 'the oversized wrapped row must continue across pages');
  assert.ok(tallRowDraws.length > 2, 'the complete description must render as wrapped chunks');
  assert.ok(
    tallRowDraws.every(({ y }) => Number.isFinite(y) && y >= 0),
    'no wrapped description baseline may cross the physical page bottom'
  );
  assert.ok(observed.some((text) => text.includes('TALLROW-0239')));
  assert.ok(
    observed.filter((text) => text === DELIVERY_NOTE_CURRENT_ITEMS_LABEL).length > 1,
    'the current-delivery label must repeat for every continuation table'
  );
  assert.equal(
    observed.filter((text) => text === pdfInput.template.text.labels.subtotal).length,
    1
  );
});
test('shipLater never splits invoices and all-current Dobavnica output stays unlabelled', async () => {
  for (const pdfInput of [
    input('invoice', [item('Later', true), item('Current')]),
    input('dobavnica', [item('First'), item('Second')])
  ]) {
    const { observed } = await renderAndObserveText(pdfInput);
    assert.equal(observed.includes(DELIVERY_NOTE_CURRENT_ITEMS_LABEL), false);
    assert.equal(observed.includes(DELIVERY_NOTE_LATER_ITEMS_LABEL), false);
  }
});