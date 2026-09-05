import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument, PDFPage } from 'pdf-lib';
import { cloneDefaultOrderDocumentTemplate, ORDER_DOCUMENT_TEMPLATE_TYPES, resolveOrderDocumentCanvas, setOrderDocumentFieldRows, resolveOrderDocumentFieldRows } from '../../src/shared/domain/order/orderDocumentTemplates';
import { createOrderDocumentPreviewContext } from '../../src/shared/domain/order/orderDocumentPreview';
import { generateOrderPdf, generateOrderPdfPreview } from '../../src/shared/server/pdf';

test('every canonical PDF includes finite page bounds and real editable child regions', async () => {
  for (const type of ORDER_DOCUMENT_TEMPLATE_TYPES) {
    const template = cloneDefaultOrderDocumentTemplate(type);
    const input = { ...createOrderDocumentPreviewContext(type), template, logoArtwork: null };
    const rendered = await generateOrderPdfPreview(input);
    const pdf = await PDFDocument.load(rendered.pdf);
    assert.equal(rendered.layout.pages.length, pdf.getPageCount());
    assert.deepEqual(await generateOrderPdf(input), rendered.pdf, 'download and preview use the same renderer bytes');
    for (const id of ['header', 'company', 'document_details', 'title', 'customer', 'document_meta', 'items', 'items:table-header', 'items:table-body', 'items:table-row:1', 'items:table-header-cell:sku', 'items:table-cell:1:sku', 'title:field-row:title_text']) {
      assert.ok(rendered.layout.regions.some((region) => region.id === id), type + ' missing ' + id);
    }
    for (const region of rendered.layout.regions) {
      const page = rendered.layout.pages[region.pageNumber - 1]!;
      assert.ok(page);
      assert.ok([region.xMm, region.yMm, region.widthMm, region.heightMm].every(Number.isFinite));
      assert.ok(region.xMm >= 0 && region.yMm >= 0 && region.widthMm > 0 && region.heightMm > 0);
      assert.ok(region.xMm + region.widthMm <= page.widthMm + 0.00001);
      assert.ok(region.yMm + region.heightMm <= page.heightMm + 0.00001);
    }
  }
});

test('manifest table hit regions contain the actual drawn SKU baselines on each paginated page', async () => {
  const context = createOrderDocumentPreviewContext('order_summary');
  context.items = Array.from({ length: 65 }, (_, index) => ({
    ...context.items[0]!, sku: 'LAYOUT-' + String(index + 1), name: 'Preverjen artikel ' + String(index + 1)
  }));
  const template = cloneDefaultOrderDocumentTemplate('order_summary');
  const pageIds = new Map<PDFPage, number>();
  const textPoints: Array<{ text: string; page: number; x: number; y: number }> = [];
  const original = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function (text, options = {}) {
    if (!pageIds.has(this)) pageIds.set(this, pageIds.size + 1);
    if (text.startsWith('LAYOUT-')) textPoints.push({ text, page: pageIds.get(this)!, x: options.x!, y: options.y! });
    return original.call(this, text, options);
  };
  let rendered;
  try {
    rendered = await generateOrderPdfPreview({ ...context, template, logoArtwork: null });
  } finally {
    PDFPage.prototype.drawText = original;
  }
  assert.ok(rendered.layout.pages.length > 1);
  assert.equal(textPoints.length, 65);
  for (const point of textPoints) {
    const row = Number(point.text.slice('LAYOUT-'.length));
    const region = rendered.layout.regions.find((region) => region.id === 'items:table-cell:' + row + ':sku' && region.pageNumber === point.page)!;
    assert.ok(region, 'actual PDF row must have an interactive target');
    const xMm = point.x * 25.4 / 72;
    const yMm = rendered.layout.pages[point.page - 1]!.heightMm - point.y * 25.4 / 72;
    assert.ok(xMm >= region.xMm && xMm <= region.xMm + region.widthMm);
    assert.ok(yMm >= region.yMm && yMm <= region.yMm + region.heightMm);
    assert.ok(rendered.layout.regions.some((entry) => entry.id === 'items:table-header-cell:sku' && entry.pageNumber === point.page));
  }
});

test('placed semantic rows report the exact renderer owner origin and clipped geometry', async () => {
  let template = cloneDefaultOrderDocumentTemplate('order_summary');
  const canvas = resolveOrderDocumentCanvas(template);
  template.layout.canvas = {
    ...canvas, elements: {
      ...canvas.elements,
      customer: { ...canvas.elements.customer, positioning: 'absolute', xMm: 12, yMm: 70, widthMm: 90, heightMm: 18, overflow: 'clip' }
    }
  };
  const rows = resolveOrderDocumentFieldRows(template, 'customer');
  const first = rows[0]!;
  template = setOrderDocumentFieldRows(template, 'customer', rows.map((row, index) => ({
    ...row, visible: index === 0,
    placement: { xMm: 4, yMm: 5, widthMm: 42, heightMm: 24 }
  })));
  const rendered = await generateOrderPdfPreview({ ...createOrderDocumentPreviewContext('order_summary'), template, logoArtwork: null });
  const region = rendered.layout.regions.find((entry) => entry.id === 'customer:field-row:' + first.id)!;
  assert.ok(region);
  assert.equal(region.placementOriginXMm, 12);
  assert.ok(Math.abs(region.placementOriginYMm! - 70) < 0.00001);
  assert.ok(Math.abs(region.xMm - 16) < 0.00001);
  assert.ok(Math.abs(region.yMm - 75) < 0.00001);
  assert.ok(Math.abs(region.widthMm - 42) < 0.00001);
  assert.ok(Math.abs(region.heightMm - 13) < 0.00001, 'hit region must stop at the actual PDF clipping edge');
});

test('materializing resolved canvas defaults does not select a different PDF rendering system', async () => {
  const template = cloneDefaultOrderDocumentTemplate('invoice');
  const input = { ...createOrderDocumentPreviewContext('invoice'), logoArtwork: null };
  const implicit = await generateOrderPdfPreview({ ...input, template });
  const explicit = await generateOrderPdfPreview({
    ...input, template: { ...template, layout: { ...template.layout, canvas: resolveOrderDocumentCanvas(template) } }
  });
  assert.deepEqual(implicit.layout, explicit.layout);
  assert.deepEqual(implicit.pdf, explicit.pdf);
});

