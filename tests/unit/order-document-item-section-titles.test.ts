import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFPage } from 'pdf-lib';
import {
  DELIVERY_NOTE_CURRENT_ITEMS_LABEL,
  DELIVERY_NOTE_LATER_ITEMS_LABEL,
  ORDER_DOCUMENT_ITEM_SECTION_TITLE_MAX_LENGTH,
  cloneDefaultOrderDocumentTemplatesConfig,
  normalizeOrderDocumentTemplatesConfig,
  toStoredOrderDocumentTemplatesConfig,
  validateOrderDocumentTemplatesInput
} from '../../src/shared/domain/order/orderDocumentTemplates';
import {
  createOrderDocumentPreviewContext,
  resolveOrderDocumentItemSections
} from '../../src/shared/domain/order/orderDocumentPreview';
import { estimateOrderDocumentFlowElementHeightMm } from '../../src/shared/domain/order/orderDocumentFlowLayout';
import type { OrderDocumentPreviewRegion } from '../../src/shared/domain/order/orderDocumentPreviewLayout';
import { generateOrderPdfPreview } from '../../src/shared/server/pdf';

test('legacy settings retain both delivery-note headings when the new text fields are absent', () => {
  const config = cloneDefaultOrderDocumentTemplatesConfig();
  const { currentItemsTitle: _current, deferredItemsTitle: _deferred, ...legacyText } =
    config.templates.dobavnica.text;
  const legacy = {
    ...config,
    templates: {
      ...config.templates,
      dobavnica: { ...config.templates.dobavnica, text: legacyText }
    }
  };
  assert.deepEqual(validateOrderDocumentTemplatesInput(legacy), []);
  const restored = normalizeOrderDocumentTemplatesConfig(legacy).templates.dobavnica;
  assert.equal(restored.text.currentItemsTitle, DELIVERY_NOTE_CURRENT_ITEMS_LABEL);
  assert.equal(restored.text.deferredItemsTitle, DELIVERY_NOTE_LATER_ITEMS_LABEL);
});

test('edited section titles survive the storage roundtrip and have accurate hit regions on every PDF page', async () => {
  const config = cloneDefaultOrderDocumentTemplatesConfig();
  config.templates.dobavnica.text.currentItemsTitle = '  Artikli v trenutni dobavi  ';
  config.templates.dobavnica.text.deferredItemsTitle = '  Postavke za kasnejšo dobavo  ';
  assert.deepEqual(validateOrderDocumentTemplatesInput(config), []);
  const saved = toStoredOrderDocumentTemplatesConfig(config);
  const restored = normalizeOrderDocumentTemplatesConfig(JSON.parse(JSON.stringify(saved)));
  const template = restored.templates.dobavnica;
  assert.equal(template.text.currentItemsTitle, 'Artikli v trenutni dobavi');
  assert.equal(template.text.deferredItemsTitle, 'Postavke za kasnejšo dobavo');
  assert.deepEqual(restored.templates.invoice, config.templates.invoice);

  const context = createOrderDocumentPreviewContext('dobavnica');
  context.items = [
    { ...context.items[0]!, shipLater: false },
    ...Array.from({ length: 75 }, (_, index) => ({
      ...context.items[1]!, name: `Artikel za kasnejšo dobavo ${index + 1}`, shipLater: true
    }))
  ];
  assert.deepEqual(
    resolveOrderDocumentItemSections('dobavnica', context.items, template.text)
      .map((section) => section.label),
    [template.text.currentItemsTitle, template.text.deferredItemsTitle]
  );
  const pageIds = new Map<PDFPage, number>();
  const drawn: Array<{ text: string; pageNumber: number; x: number; y: number }> = [];
  const originalDrawText = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    if (!pageIds.has(this)) pageIds.set(this, pageIds.size + 1);
    drawn.push({ text, pageNumber: pageIds.get(this)!, x: options.x!, y: options.y! });
    return originalDrawText.call(this, text, options);
  };
  let rendered;
  try {
    rendered = await generateOrderPdfPreview({ ...context, template, logoArtwork: null });
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
  }
  assert.ok(rendered.layout.pages.length > 1);
  assert.equal(drawn.some(({ text }) => text === DELIVERY_NOTE_CURRENT_ITEMS_LABEL), false);
  assert.equal(drawn.some(({ text }) => text === DELIVERY_NOTE_LATER_ITEMS_LABEL), false);
  assert.ok(drawn.filter(({ text }) => text === template.text.deferredItemsTitle).length > 1);
  for (const key of ['currentItemsTitle', 'deferredItemsTitle'] as const) {
    const headingDraws = drawn.filter(({ text }) => text === template.text[key]);
    assert.ok(headingDraws.length > 0);
    for (const draw of headingDraws) {
      const region: OrderDocumentPreviewRegion | undefined = rendered.layout.regions.find((entry) => (
        entry.id === `items:text:${key}` && entry.pageNumber === draw.pageNumber
      ));
      assert.ok(region, 'every rendered heading needs a selectable text child');
      assert.equal(region.parentId, 'items');
      assert.equal(region.kind, 'child');
      const xMm = draw.x * 25.4 / 72;
      const yMm = rendered.layout.pages[draw.pageNumber - 1]!.heightMm - draw.y * 25.4 / 72;
      assert.ok(xMm >= region.xMm - 0.00001 && xMm <= region.xMm + region.widthMm);
      assert.ok(yMm >= region.yMm && yMm <= region.yMm + region.heightMm);
    }
  }
});

test('blank section titles remain blank after saving and remove their PDF hit regions and reserved label height', async () => {
  const config = cloneDefaultOrderDocumentTemplatesConfig();
  const template = config.templates.dobavnica;
  const context = createOrderDocumentPreviewContext('dobavnica');
  const originalHeight = estimateOrderDocumentFlowElementHeightMm(template, context, 'items', 190);
  template.text.currentItemsTitle = '';
  template.text.deferredItemsTitle = '';
  assert.deepEqual(validateOrderDocumentTemplatesInput(config), []);
  const saved = toStoredOrderDocumentTemplatesConfig(config).templates.dobavnica;
  assert.equal(saved.text.currentItemsTitle, '');
  assert.equal(saved.text.deferredItemsTitle, '');
  assert.ok(estimateOrderDocumentFlowElementHeightMm(saved, context, 'items', 190) < originalHeight);
  const rendered = await generateOrderPdfPreview({ ...context, template: saved, logoArtwork: null });
  assert.equal(rendered.layout.regions.some((region) => (
    region.id === 'items:text:currentItemsTitle' || region.id === 'items:text:deferredItemsTitle'
  )), false);
});

test('section title validation rejects malformed values and excess length before storage normalization', () => {
  const config = cloneDefaultOrderDocumentTemplatesConfig();
  for (const key of ['currentItemsTitle', 'deferredItemsTitle'] as const) {
    for (const value of [null, 42, 'a'.repeat(ORDER_DOCUMENT_ITEM_SECTION_TITLE_MAX_LENGTH + 1)]) {
      const invalid = {
        ...config,
        templates: {
          ...config.templates,
          dobavnica: {
            ...config.templates.dobavnica,
            text: { ...config.templates.dobavnica.text, [key]: value }
          }
        }
      };
      assert.ok(validateOrderDocumentTemplatesInput(invalid).some((error) => (
        error.includes(`dobavnica.text.${key}`)
      )));
    }
  }
});
