import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument, PDFPage } from 'pdf-lib';
import {
  cloneDefaultOrderDocumentTemplate,
  materializeOrderDocumentCanvasElement,
  normalizeOrderDocumentTemplate,
  resolveOrderDocumentCanvas,
  setOrderDocumentDecoration,
  type OrderDocumentCanvasElementId,
  type OrderDocumentTemplate
} from '../../src/shared/domain/order/orderDocumentTemplates';
import {
  ORDER_DOCUMENT_FLOW_SECTION_GAP_PT,
  ORDER_DOCUMENT_FLOW_SECTION_GAP_MM,
  resolveOrderDocumentFlowPreviewElements
} from '../../src/shared/domain/order/orderDocumentFlowLayout';
import {
  createOrderDocumentPreviewContext,
  type OrderDocumentPreviewItem
} from '../../src/shared/domain/order/orderDocumentPreview';
import { generateOrderPdf } from '../../src/shared/server/pdf';

const BODY_IDS = ['intro', 'items', 'totals', 'notes', 'closing', 'signatures'] as const;

function currentSavedOrderSummary(): OrderDocumentTemplate {
  let template = cloneDefaultOrderDocumentTemplate('order_summary');
  for (const id of BODY_IDS) {
    template = materializeOrderDocumentCanvasElement(template, id);
  }
  template.layout.sections = template.layout.sections.map((section) => ({
    ...section,
    enabled: section.id !== 'notes'
      && section.id !== 'closing'
      && section.id !== 'signatures'
  }));
  template.layout.canvas!.elements.notes!.visible = false;
  template.layout.canvas!.elements.closing!.visible = false;
  template.layout.canvas!.elements.signatures!.visible = false;
  return template;
}

test('current materialized body defaults stay in document flow across storage round-trips', () => {
  const template = currentSavedOrderSummary();
  const normalized = normalizeOrderDocumentTemplate('order_summary', JSON.parse(JSON.stringify(template)));
  assert.equal(normalized.layout.canvas?.flowLayoutVersion, 1);
  for (const id of BODY_IDS) {
    assert.equal(normalized.layout.canvas?.elements[id]?.positioning, 'flow');
  }
  assert.deepEqual(normalized.layout.canvas, template.layout.canvas);
  assert.deepEqual(normalizeOrderDocumentTemplate('order_summary', normalized), normalized);
});

test('explicit absolute body geometry remains authoritative with or without a version marker', () => {
  const geometry = {
    intro: { yMm: 90, heightMm: 7.5, zIndex: 20 },
    items: { yMm: 102.5, heightMm: 80, zIndex: 30 },
    totals: { yMm: 177.5, heightMm: 28, zIndex: 40 },
    notes: { yMm: 230, heightMm: 14, zIndex: 50 },
    closing: { yMm: 207.5, heightMm: 16, zIndex: 60 },
    signatures: { yMm: 247.5, heightMm: 16, zIndex: 70 }
  };
  for (const version of [undefined, 1]) {
    const template = currentSavedOrderSummary();
    for (const id of BODY_IDS) {
      Object.assign(template.layout.canvas!.elements[id]!, geometry[id], {
        positioning: 'absolute', xMm: 10, widthMm: 190, page: 1, repeat: 'once'
      });
    }
    if (version === undefined) delete (template.layout.canvas as { flowLayoutVersion?: number }).flowLayoutVersion;
    const normalized = normalizeOrderDocumentTemplate('order_summary', JSON.parse(JSON.stringify(template)));
    assert.deepEqual(normalized.layout.canvas?.elements, template.layout.canvas?.elements);
  }
});


test('interactive flow preview sizes product and total sections from actual content', () => {
  const template = normalizeOrderDocumentTemplate(
    'order_summary',
    currentSavedOrderSummary()
  );
  const oneItemContext = createOrderDocumentPreviewContext('order_summary');
  oneItemContext.items = oneItemContext.items.slice(0, 1);
  const severalItemsContext = createOrderDocumentPreviewContext('order_summary');
  const canvas = resolveOrderDocumentCanvas(template);

  const sparse = resolveOrderDocumentFlowPreviewElements(
    template,
    canvas,
    oneItemContext
  );
  const populated = resolveOrderDocumentFlowPreviewElements(
    template,
    canvas,
    severalItemsContext
  );

  assert.ok(sparse.items.heightMm < populated.items.heightMm);
  assert.ok(sparse.totals.yMm < populated.totals.yMm);
  assert.ok(
    Math.abs(
      sparse.totals.yMm
        - (sparse.items.yMm + sparse.items.heightMm)
        - ORDER_DOCUMENT_FLOW_SECTION_GAP_MM
    ) <= 0.11,
    'totals must follow the rendered one-row table by only the shared flow gap'
  );
  assert.equal(sparse.items.positioning, 'flow');
  assert.equal(sparse.totals.positioning, 'flow');
});

test('current flow one-row PDF compacts totals immediately after the table', async () => {
  const context = createOrderDocumentPreviewContext('order_summary');
  context.items = context.items.slice(0, 1);
  const template = normalizeOrderDocumentTemplate(
    'order_summary',
    currentSavedOrderSummary()
  );
  const itemSku = context.items[0]!.sku;
  const subtotalLabel = template.text.labels.subtotal;
  const positions = new Map<string, number[]>();
  const originalDrawText = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    if (text === itemSku || text === subtotalLabel) {
      positions.set(text, [...(positions.get(text) ?? []), options.y ?? Number.NaN]);
    }
    return originalDrawText.call(this, text, options);
  };

  let bytes: Uint8Array;
  try {
    bytes = await generateOrderPdf({ ...context, template, logoArtwork: null });
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
  }

  const itemY = positions.get(itemSku)?.[0];
  const subtotalY = positions.get(subtotalLabel)?.[0];
  assert.equal(typeof itemY, 'number');
  assert.equal(typeof subtotalY, 'number');
  assert.ok(itemY! > subtotalY!);
  assert.ok(
    itemY! - subtotalY! < 60,
    `one-row table left ${(itemY! - subtotalY!).toFixed(1)} pt before totals`
  );
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 1);
});

test('current flow one-row items fill and outline end before compact totals', async () => {
  const context = createOrderDocumentPreviewContext('order_summary');
  context.items = context.items.slice(0, 1);
  let template = normalizeOrderDocumentTemplate(
    'order_summary',
    currentSavedOrderSummary()
  );
  template = setOrderDocumentDecoration(
    template,
    { kind: 'element', elementId: 'items' },
    {
      fillEnabled: true,
      fillColor: '#D1E2F3',
      outlineEnabled: true,
      outlineColor: '#A142E5',
      outlineWidthPt: 1,
      outlineSides: ['left', 'right', 'top', 'bottom'],
      accentEnabled: false
    }
  );

  const matchesRgb = (value: unknown, hex: string) => {
    if (typeof value !== 'object' || value === null || !('red' in value)) return false;
    const rgb = value as { red: number; green: number; blue: number };
    return [rgb.red, rgb.green, rgb.blue].every((component, index) => {
      const expected = Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
      return Math.abs(component - expected) < 0.0001;
    });
  };
  let fillFrame: { bottom: number; height: number } | undefined;
  const outlineYs: number[] = [];
  let subtotal: { y: number; textTop: number } | undefined;
  const originalDrawRectangle = PDFPage.prototype.drawRectangle;
  const originalDrawLine = PDFPage.prototype.drawLine;
  const originalDrawText = PDFPage.prototype.drawText;
  PDFPage.prototype.drawRectangle = function drawRectangle(options = {}) {
    if (matchesRgb(options.color, '#D1E2F3')) {
      fillFrame = { bottom: options.y ?? Number.NaN, height: options.height ?? Number.NaN };
    }
    return originalDrawRectangle.call(this, options);
  };
  PDFPage.prototype.drawLine = function drawLine(options) {
    if (matchesRgb(options.color, '#A142E5')) {
      outlineYs.push(options.start.y, options.end.y);
    }
    return originalDrawLine.call(this, options);
  };
  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    if (text === template.text.labels.subtotal) {
      const y = options.y ?? Number.NaN;
      const size = options.size ?? Number.NaN;
      subtotal = {
        y,
        textTop: y + (options.font?.heightAtSize(size, { descender: false }) ?? size)
      };
    }
    return originalDrawText.call(this, text, options);
  };

  try {
    await generateOrderPdf({ ...context, template, logoArtwork: null });
  } finally {
    PDFPage.prototype.drawRectangle = originalDrawRectangle;
    PDFPage.prototype.drawLine = originalDrawLine;
    PDFPage.prototype.drawText = originalDrawText;
  }

  assert.ok(fillFrame, 'items element fill must render');
  assert.ok(subtotal, 'totals must render');
  assert.equal(outlineYs.length, 8, 'all four items outline sides must render');
  const outlineBottom = Math.min(...outlineYs);
  assert.ok(Math.abs(outlineBottom - fillFrame.bottom) < 0.01);
  assert.ok(
    fillFrame.bottom > subtotal.textTop,
    `items fill bottom ${fillFrame.bottom.toFixed(2)} must finish above totals text ${(
      subtotal.textTop
    ).toFixed(2)}`
  );
  assert.ok(
    outlineBottom > subtotal.textTop,
    'items outline must finish above the first totals row'
  );
  assert.ok(
    fillFrame.bottom - subtotal.y >= ORDER_DOCUMENT_FLOW_SECTION_GAP_PT - 0.1,
    'the shared flow gap must separate the items frame from the totals baseline'
  );
  assert.ok(
    fillFrame.height < 80 * 72 / 25.4 / 2,
    'the 80 mm canvas fallback must not determine the one-row decoration height'
  );
});

test('totals and notes stay compact across the current 22-27 row page-break boundary', async () => {
  for (const itemCount of [22, 23, 24, 25, 26, 27]) {
    const context = createOrderDocumentPreviewContext('order_summary');
    const baseItem = context.items[0]!;
    context.items = Array.from({ length: itemCount }, (_, index) => ({
      ...baseItem,
      sku: `BOUNDARY-${String(index + 1).padStart(2, '0')}`,
      name: `Artikel ${index + 1}`
    }));
    context.order.notes = 'Opomba za preverjanje neprekinjenega toka.';

    const saved = currentSavedOrderSummary();
    saved.layout.sections = saved.layout.sections.map((section) => ({
      ...section,
      enabled: section.id === 'notes' ? true : section.enabled
    }));
    saved.layout.canvas!.elements.notes!.visible = true;
    const template = normalizeOrderDocumentTemplate('order_summary', saved);
    const subtotalLabel = template.text.labels.subtotal;
    const notesLabel = `${template.text.labels.notes}:`;
    const pageIds = new WeakMap<PDFPage, number>();
    let nextPageId = 1;
    let totalPageId: number | undefined;
    let notesPageId: number | undefined;
    let totalY: number | undefined;
    let notesY: number | undefined;
    const originalDrawText = PDFPage.prototype.drawText;
    PDFPage.prototype.drawText = function drawText(text, options = {}) {
      let pageId = pageIds.get(this);
      if (pageId === undefined) {
        pageId = nextPageId;
        nextPageId += 1;
        pageIds.set(this, pageId);
      }
      if (text === subtotalLabel) {
        totalPageId = pageId;
        totalY = options.y;
      }
      if (text === notesLabel) {
        notesPageId = pageId;
        notesY = options.y;
      }
      return originalDrawText.call(this, text, options);
    };

    let bytes: Uint8Array;
    try {
      bytes = await generateOrderPdf({ ...context, template, logoArtwork: null });
    } finally {
      PDFPage.prototype.drawText = originalDrawText;
    }

    assert.equal(
      (await PDFDocument.load(bytes)).getPageCount(),
      2,
      `${itemCount} rows must not create a blank third page`
    );
    assert.equal(typeof totalPageId, 'number', 'totals must render');
    assert.equal(typeof notesPageId, 'number', 'notes must render');
    assert.equal(typeof totalY, 'number');
    assert.equal(typeof notesY, 'number');
    if (itemCount < 24) {
      assert.notEqual(
        notesPageId,
        totalPageId,
        `${itemCount} rows should move only notes to the second page`
      );
      assert.ok(notesY! > 650, 'notes must start naturally at the top of their new page');
      continue;
    }
    assert.equal(
      notesPageId,
      totalPageId,
      `${itemCount} rows must keep notes on the totals page`
    );
    assert.ok(totalY! > notesY!);
    assert.ok(
      totalY! - notesY! < 80,
      `${itemCount} rows left ${(totalY! - notesY!).toFixed(1)} pt before notes`
    );
  }
});

test('current flow long product tables paginate and keep totals inside a page', async () => {
  const context = createOrderDocumentPreviewContext('order_summary');
  const longItems: OrderDocumentPreviewItem[] = Array.from({ length: 72 }, (_, index) => ({
    sku: `FLOW-${String(index + 1).padStart(3, '0')}`,
    name: `Artikel ${index + 1} z daljšim opisom za preverjanje vsebinskega preloma`,
    unit: 'kos',
    quantity: 1,
    unitPrice: 10,
    lineTotal: 10,
    taxRate: 22
  }));
  context.items = longItems;
  const template = normalizeOrderDocumentTemplate(
    'order_summary',
    currentSavedOrderSummary()
  );
  const lastSku = longItems.at(-1)!.sku;
  const totalLabel = template.text.labels.total;
  const observed: Record<'lastSkuY' | 'totalY', number | undefined> = {
    lastSkuY: undefined,
    totalY: undefined
  };
  const originalDrawText = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    if (text === lastSku) observed.lastSkuY = options.y;
    if (text === totalLabel) observed.totalY = options.y;
    return originalDrawText.call(this, text, options);
  };

  let bytes: Uint8Array;
  try {
    bytes = await generateOrderPdf({ ...context, template, logoArtwork: null });
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
  }

  const document = await PDFDocument.load(bytes);
  assert.ok(document.getPageCount() > 1);
  assert.equal(typeof observed.lastSkuY, 'number');
  assert.equal(typeof observed.totalY, 'number');
  assert.ok(observed.lastSkuY! > 45, 'last item must stay above the footer reserve');
  assert.ok(observed.totalY! > 45, 'totals must stay above the footer reserve');
});
