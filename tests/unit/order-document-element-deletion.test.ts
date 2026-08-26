import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { PDFPage } from 'pdf-lib';
import {
  deleteOrderDocumentCanvasElement,
  isOrderDocumentCanvasElementDeleted,
  isOrderDocumentCanvasElementDirectlyDeleted,
  materializeOrderDocumentCanvasElement,
  normalizeOrderDocumentTemplate,
  resolveOrderDocumentCanvasElement,
  resolveOrderDocumentDeletedCanvasElementIds,
  restoreOrderDocumentCanvasElement,
  validateOrderDocumentTemplatesInput,
  cloneDefaultOrderDocumentTemplate,
  cloneDefaultOrderDocumentTemplatesConfig
} from '../../src/shared/domain/order/orderDocumentTemplates';
import {
  generateOrderPdf,
  type GenerateOrderPdfInput
} from '../../src/shared/server/pdf';

test('hide preserves an exact override while delete tombstones and resets it', () => {
  let template = materializeOrderDocumentCanvasElement(
    cloneDefaultOrderDocumentTemplate('order_summary'),
    'intro'
  );
  template.layout.canvas!.elements.intro = {
    ...template.layout.canvas!.elements.intro!,
    visible: false,
    positioning: 'absolute',
    xMm: 71,
    yMm: 123,
    widthMm: 88,
    heightMm: 19,
    backgroundColor: '#123456'
  };
  const hiddenOverride = structuredClone(template.layout.canvas!.elements.intro);

  const hiddenRoundTrip = normalizeOrderDocumentTemplate(
    'order_summary',
    structuredClone(template)
  );
  assert.deepEqual(hiddenRoundTrip.layout.canvas!.elements.intro, hiddenOverride);
  assert.equal(isOrderDocumentCanvasElementDeleted(hiddenRoundTrip, 'intro'), false);
  assert.equal(resolveOrderDocumentCanvasElement(hiddenRoundTrip, 'intro').visible, false);
  hiddenRoundTrip.layout.sections = hiddenRoundTrip.layout.sections.map((section) =>
    section.id === 'intro' ? { ...section, enabled: false } : section
  );
  assert.deepEqual(
    restoreOrderDocumentCanvasElement(hiddenRoundTrip, 'intro'),
    hiddenRoundTrip
  );

  const deleted = deleteOrderDocumentCanvasElement(hiddenRoundTrip, 'intro');
  assert.deepEqual(resolveOrderDocumentDeletedCanvasElementIds(deleted), ['intro']);
  assert.equal(deleted.layout.canvas!.elements.intro, undefined);
  assert.equal(isOrderDocumentCanvasElementDirectlyDeleted(deleted, 'intro'), true);
  assert.equal(resolveOrderDocumentCanvasElement(deleted, 'intro').visible, false);
  assert.equal(
    materializeOrderDocumentCanvasElement(deleted, 'intro').layout.canvas!.elements.intro,
    undefined
  );

  const storedRoundTrip = normalizeOrderDocumentTemplate(
    'order_summary',
    structuredClone(deleted)
  );
  assert.deepEqual(resolveOrderDocumentDeletedCanvasElementIds(storedRoundTrip), ['intro']);
  assert.equal(storedRoundTrip.layout.canvas!.elements.intro, undefined);

  const restored = restoreOrderDocumentCanvasElement(storedRoundTrip, 'intro');
  assert.deepEqual(resolveOrderDocumentDeletedCanvasElementIds(restored), []);
  assert.equal(restored.layout.canvas!.elements.intro, undefined);
  const canonical = resolveOrderDocumentCanvasElement(restored, 'intro');
  assert.equal(canonical.xMm, 10);
  assert.equal(canonical.yMm, 98);
  assert.equal(canonical.backgroundColor, '');
  assert.equal(canonical.visible, true);
  assert.equal(
    restored.layout.sections.find((section) => section.id === 'intro')?.enabled,
    true
  );
});

test('deleting a group suppresses children without manufacturing or erasing child tombstones', () => {
  let template = materializeOrderDocumentCanvasElement(
    cloneDefaultOrderDocumentTemplate('order_summary'),
    'company'
  );
  template.layout.canvas!.elements.company = {
    ...template.layout.canvas!.elements.company!,
    textColor: '#123456'
  };
  template = deleteOrderDocumentCanvasElement(template, 'logo');
  template = deleteOrderDocumentCanvasElement(template, 'header');

  assert.deepEqual(
    new Set(resolveOrderDocumentDeletedCanvasElementIds(template)),
    new Set(['logo', 'header'])
  );
  assert.equal(isOrderDocumentCanvasElementDirectlyDeleted(template, 'company'), false);
  assert.equal(isOrderDocumentCanvasElementDeleted(template, 'company'), true);
  assert.equal(resolveOrderDocumentCanvasElement(template, 'company').visible, false);
  assert.equal(template.layout.canvas!.elements.company!.textColor, '#123456');

  const restoredParent = restoreOrderDocumentCanvasElement(template, 'header');
  assert.equal(isOrderDocumentCanvasElementDeleted(restoredParent, 'header'), false);
  assert.equal(isOrderDocumentCanvasElementDeleted(restoredParent, 'company'), false);
  assert.equal(resolveOrderDocumentCanvasElement(restoredParent, 'company').visible, true);
  assert.equal(restoredParent.layout.canvas!.elements.company!.textColor, '#123456');
  assert.equal(isOrderDocumentCanvasElementDeleted(restoredParent, 'logo'), true);
  assert.equal(resolveOrderDocumentCanvasElement(restoredParent, 'logo').visible, false);
});

test('restoring a deleted child also restores its deleted parent but not a deleted sibling', () => {
  const cases = [
    {
      parent: 'header',
      child: 'company',
      sibling: 'logo'
    },
    {
      parent: 'document_details',
      child: 'title',
      sibling: 'document_meta'
    }
  ] as const;

  for (const { parent, child, sibling } of cases) {
    let template = cloneDefaultOrderDocumentTemplate('order_summary');
    template = deleteOrderDocumentCanvasElement(template, sibling);
    template = deleteOrderDocumentCanvasElement(template, child);
    template = deleteOrderDocumentCanvasElement(template, parent);

    const restoredChild = restoreOrderDocumentCanvasElement(template, child);
    assert.equal(isOrderDocumentCanvasElementDeleted(restoredChild, parent), false);
    assert.equal(isOrderDocumentCanvasElementDeleted(restoredChild, child), false);
    assert.equal(resolveOrderDocumentCanvasElement(restoredChild, parent).visible, true);
    assert.equal(resolveOrderDocumentCanvasElement(restoredChild, child).visible, true);
    assert.equal(isOrderDocumentCanvasElementDirectlyDeleted(restoredChild, sibling), true);
    assert.equal(resolveOrderDocumentCanvasElement(restoredChild, sibling).visible, false);
    assert.deepEqual(resolveOrderDocumentDeletedCanvasElementIds(restoredChild), [sibling]);
  }
});

test('normalization and validation keep tombstones explicit and reject contradictory input', () => {
  const config = cloneDefaultOrderDocumentTemplatesConfig();
  const template = deleteOrderDocumentCanvasElement(
    config.templates.invoice,
    'notes'
  );
  config.templates.invoice = template;
  assert.deepEqual(validateOrderDocumentTemplatesInput(config), []);

  const invalid = structuredClone(config);
  invalid.templates.invoice.layout.canvas!.deletedElementIds = ['notes', 'notes'];
  invalid.templates.invoice.layout.canvas!.elements.notes =
    resolveOrderDocumentCanvasElement(invalid.templates.invoice, 'notes');
  const errors = validateOrderDocumentTemplatesInput(invalid);
  assert.ok(errors.some((error) => error.includes('je podvojen')));
  assert.ok(errors.some((error) => error.includes('ne sme imeti shranjene postavitve')));

  const normalized = normalizeOrderDocumentTemplate('invoice', invalid.templates.invoice);
  assert.deepEqual(normalized.layout.canvas!.deletedElementIds, ['notes']);
  assert.equal(normalized.layout.canvas!.elements.notes, undefined);
});

test('generated PDF omits a deleted default element even when no element override remains', async () => {
  let template = cloneDefaultOrderDocumentTemplate('order_summary');
  template.text.title = 'IZBRISANI NASLOV DOKUMENTA';
  template = deleteOrderDocumentCanvasElement(template, 'title');
  const input: GenerateOrderPdfInput = {
    type: 'order_summary',
    template,
    order: {
      customerType: 'consumer',
      organizationName: '',
      contactName: 'Testna stranka',
      email: 'test@example.test',
      deliveryAddress: 'Testni naslov 1',
      reference: '',
      notes: '',
      createdAt: new Date('2026-08-25T10:00:00.000Z'),
      subtotal: 10,
      tax: 2.2,
      taxRate: 22,
      shipping: 0,
      total: 12.2,
      commitmentStatus: 'binding'
    },
    items: [{
      sku: 'TEST-1',
      name: 'Testni artikel',
      unit: 'kos',
      quantity: 1,
      unitPrice: 10,
      lineTotal: 10,
      taxRate: 22,
      discountPercentage: 0
    }],
    documentNumber: 'TEST-DELETE-1',
    issuedAt: new Date('2026-08-25T10:00:00.000Z')
  };
  const observed: string[] = [];
  const originalDrawText = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    observed.push(text);
    return originalDrawText.call(this, text, options);
  };
  try {
    await generateOrderPdf(input);
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
  }
  assert.equal(observed.includes('IZBRISANI NASLOV DOKUMENTA'), false);
  assert.ok(observed.some((text) => text.includes('Testni artikel')));
});

test('editor exposes direct delete and a compact restore-only list outside ordinary layers', () => {
  const source = readFileSync(resolve(
    process.cwd(),
    'src/admin/features/urejevalnik/components/OrderDocumentTemplateCanvas.tsx'
  ), 'utf8');
  assert.ok(source.includes('data-testid="order-document-element-delete"'));
  assert.ok(source.includes('data-testid="order-document-restore-elements"'));
  assert.ok(source.includes("data-testid={'order-document-restore-element-' + id}"));
  assert.match(source, /activeElementIds\.map\(\(id\) =>/u);
  assert.match(source, /activeSections\.map\(\(section, index\) =>/u);
  assert.match(source, /deleteOrderDocumentCanvasElement\(template, id\)/u);
  assert.match(source, /restoreOrderDocumentCanvasElement\(template, id\)/u);
  assert.match(source, /label="Dodaj izbrisan element"/u);
  assert.match(source, /label="Izbriši element"/u);
});
