import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { PDFPage } from 'pdf-lib';
import {
  cloneDefaultOrderDocumentTemplate,
  normalizeOrderDocumentTemplate,
  resetOrderDocumentTableBorders,
  resolveOrderDocumentTable,
  resolveOrderDocumentTableBorders,
  setOrderDocumentTableBorders,
  validateOrderDocumentTemplatesInput
} from '../../src/shared/domain/order/orderDocumentTemplates';
import { createOrderDocumentPreviewContext } from '../../src/shared/domain/order/orderDocumentPreview';
import {
  generateOrderPdf,
  resolveOrderDocumentPdfJustifiedWordLayout,
  resolveOrderDocumentPdfTableRuleSegments
} from '../../src/shared/server/pdf';

const POINT_TOLERANCE = 0.02;
const mm = (value: number) => value * 72 / 25.4;
const canvasSource = readFileSync(resolve(
  process.cwd(),
  'src/admin/features/urejevalnik/components/OrderDocumentTemplateCanvas.tsx'
), 'utf8');

function sourceAround(source: string, marker: string, radius = 7_000) {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `Missing source marker: ${marker}`);
  return source.slice(
    Math.max(0, markerIndex - radius),
    Math.min(source.length, markerIndex + marker.length + radius)
  );
}

test('table borders stay sparse, inherit line style, normalize, persist, and reset', () => {
  const original = cloneDefaultOrderDocumentTemplate('invoice');
  assert.equal(resolveOrderDocumentTable(original).borders, undefined);
  assert.deepEqual(resolveOrderDocumentTableBorders(original), {
    outer: false,
    horizontal: false,
    vertical: false,
    color: original.style.lineColor,
    widthPt: original.style.lineWidthPt
  });

  const sparse = setOrderDocumentTableBorders(original, { outer: true });
  assert.deepEqual(resolveOrderDocumentTable(sparse).borders, { outer: true });
  const restyled = {
    ...sparse,
    style: { ...sparse.style, lineColor: '#445566', lineWidthPt: 2.25 }
  };
  assert.deepEqual(resolveOrderDocumentTableBorders(restyled), {
    outer: true,
    horizontal: false,
    vertical: false,
    color: '#445566',
    widthPt: 2.25
  });

  const edited = setOrderDocumentTableBorders(original, {
    outer: true,
    horizontal: false,
    vertical: true,
    color: '#12ab34',
    widthPt: 1.26
  });
  assert.deepEqual(resolveOrderDocumentTable(edited).borders, {
    outer: true,
    horizontal: false,
    vertical: true,
    color: '#12AB34',
    widthPt: 1.25
  });

  const roundTripped = normalizeOrderDocumentTemplate(
    'invoice',
    JSON.parse(JSON.stringify(edited))
  );
  assert.deepEqual(
    resolveOrderDocumentTable(roundTripped).borders,
    resolveOrderDocumentTable(edited).borders
  );
  assert.equal(resolveOrderDocumentTable(resetOrderDocumentTableBorders(edited)).borders, undefined);

  const invalid = JSON.parse(JSON.stringify(edited));
  invalid.layout.table.borders = { outer: 'yes', color: '#bad', widthPt: 99 };
  const errors = validateOrderDocumentTemplatesInput({
    templates: {
      order_summary: cloneDefaultOrderDocumentTemplate('order_summary'),
      dobavnica: cloneDefaultOrderDocumentTemplate('dobavnica'),
      predracun: cloneDefaultOrderDocumentTemplate('predracun'),
      invoice: invalid
    }
  });
  assert.ok(errors.some((error) => error.includes('invoice.outer')));
  assert.ok(errors.some((error) => error.includes('Barva obrobe tabele invoice')));
  assert.ok(errors.some((error) => error.includes('Debelina obrobe tabele invoice')));
});

test('table-rule geometry independently resolves outer, horizontal, and visible-column rules', () => {
  assert.deepEqual(resolveOrderDocumentPdfTableRuleSegments({
    x: 10,
    top: 100,
    bottom: 80,
    columnWidths: [20, 30, 10],
    borders: { outer: true, horizontal: true, vertical: true },
    outerTop: true,
    outerBottom: true,
    horizontalTop: true,
    horizontalBottom: true
  }), [
    { start: { x: 10, y: 80 }, end: { x: 10, y: 100 } },
    { start: { x: 70, y: 80 }, end: { x: 70, y: 100 } },
    { start: { x: 10, y: 100 }, end: { x: 70, y: 100 } },
    { start: { x: 10, y: 80 }, end: { x: 70, y: 80 } },
    { start: { x: 30, y: 80 }, end: { x: 30, y: 100 } },
    { start: { x: 60, y: 80 }, end: { x: 60, y: 100 } }
  ]);

  assert.deepEqual(resolveOrderDocumentPdfTableRuleSegments({
    x: 5,
    top: 20,
    bottom: 10,
    columnWidths: [12, 8],
    borders: { outer: false, horizontal: true, vertical: false },
    horizontalTop: true,
    horizontalBottom: true
  }), [
    { start: { x: 5, y: 20 }, end: { x: 25, y: 20 } },
    { start: { x: 5, y: 10 }, end: { x: 25, y: 10 } }
  ]);
});

test('Canvas paints table rules without changing cell gaps, padding, or row-gap continuity', () => {
  const items = sourceAround(canvasSource, "if (id === 'items')");
  assert.match(items, /resolveOrderDocumentTableBorders\(template, table\)/u);
  for (const marker of ['outer', 'horizontal', 'vertical']) {
    assert.match(
      items,
      new RegExp(`data-order-document-table-border-${marker}`, 'u')
    );
  }
  assert.match(items, /className="grid items-center gap-1 px-1 font-bold"/u);
  assert.match(items, /className="grid w-full items-center gap-1 px-1 text-left"/u);
  assert.match(items, /boxShadow:\s*tableBorders\.horizontal/u);
  assert.match(items, /outlineOffset:\s*`-\$\{tableBorders\.widthPt\}pt`/u);
  assert.match(items, /data-order-document-table-vertical-rule-overlay/u);
  assert.match(items, /className="pointer-events-none absolute inset-0 z-20 grid gap-1 px-1"/u);
  assert.match(items, /visibleColumns\.slice\(0, -1\)/u);
  assert.doesNotMatch(items, /padding(?:Left|Right):\s*tableBorders\.vertical/u);
  assert.doesNotMatch(items, /borderLeft:\s*tableBorders\.vertical/u);
});

test('justified word geometry fills the complete line while single words remain left aligned', () => {
  assert.deepEqual(resolveOrderDocumentPdfJustifiedWordLayout({
    x: 10,
    width: 100,
    wordWidths: [20, 10, 20]
  }), [10, 55, 90]);
  assert.deepEqual(resolveOrderDocumentPdfJustifiedWordLayout({
    x: 12,
    width: 80,
    wordWidths: [15]
  }), [12]);
});

test('generated PDF draws configured table borders at exact A4 content edges', async () => {
  const context = createOrderDocumentPreviewContext('invoice');
  let template = cloneDefaultOrderDocumentTemplate('invoice');
  template.layout.showHeader = false;
  template.layout.showFooter = false;
  template.layout.sections = template.layout.sections.map((section) => ({
    ...section,
    enabled: section.id === 'items'
  }));
  template = setOrderDocumentTableBorders(template, {
    outer: true,
    horizontal: true,
    vertical: true,
    color: '#12AB34',
    widthPt: 1.25
  });

  const originalDrawLine = PDFPage.prototype.drawLine;
  const lines: Array<{
    start: { x: number; y: number };
    end: { x: number; y: number };
  }> = [];
  PDFPage.prototype.drawLine = function drawLine(options) {
    const color = options.color && 'red' in options.color
      ? options.color
      : undefined;
    if (
      options.thickness === 1.25
      && Math.abs((color?.red ?? 0) - 0x12 / 255) < 0.0001
      && Math.abs((color?.green ?? 0) - 0xAB / 255) < 0.0001
      && Math.abs((color?.blue ?? 0) - 0x34 / 255) < 0.0001
    ) {
      lines.push({ start: options.start, end: options.end });
    }
    return originalDrawLine.call(this, options);
  };
  try {
    await generateOrderPdf({ ...context, template, logoArtwork: null });
  } finally {
    PDFPage.prototype.drawLine = originalDrawLine;
  }

  const left = mm(template.style.marginMm);
  const right = 595.28 - left;
  const top = 841.89 - left;
  assert.ok(lines.some((line) =>
    Math.abs(line.start.x - left) < POINT_TOLERANCE
    && Math.abs(line.end.x - right) < POINT_TOLERANCE
    && Math.abs(line.start.y - top) < POINT_TOLERANCE
    && Math.abs(line.end.y - top) < POINT_TOLERANCE
  ));
  assert.ok(lines.some((line) =>
    Math.abs(line.start.x - left) < POINT_TOLERANCE
    && Math.abs(line.end.x - left) < POINT_TOLERANCE
    && line.end.y > line.start.y
  ));
  assert.ok(lines.some((line) =>
    line.start.x > left + POINT_TOLERANCE
    && line.start.x < right - POINT_TOLERANCE
    && Math.abs(line.start.x - line.end.x) < POINT_TOLERANCE
  ));
});

test('outer table borders close and restart once on every paginated segment', async () => {
  const context = createOrderDocumentPreviewContext('invoice');
  let template = cloneDefaultOrderDocumentTemplate('invoice');
  template.layout.showHeader = false;
  template.layout.showFooter = false;
  template.layout.sections = template.layout.sections.map((section) => ({
    ...section,
    enabled: section.id === 'items'
  }));
  template = setOrderDocumentTableBorders(template, {
    outer: true,
    horizontal: false,
    vertical: false,
    color: '#ABCDEF',
    widthPt: 2
  });
  const items = Array.from({ length: 100 }, (_, index) => ({
    ...context.items[0]!,
    sku: `PAGE-${String(index + 1)}`,
    name: `Pagination border item ${String(index + 1)}`
  }));

  const originalDrawLine = PDFPage.prototype.drawLine;
  const linesByPage = new Map<PDFPage, Array<{
    start: { x: number; y: number };
    end: { x: number; y: number };
  }>>();
  PDFPage.prototype.drawLine = function drawLine(options) {
    if (options.thickness === 2) {
      const lines = linesByPage.get(this) ?? [];
      lines.push({ start: options.start, end: options.end });
      linesByPage.set(this, lines);
    }
    return originalDrawLine.call(this, options);
  };
  try {
    await generateOrderPdf({ ...context, items, template, logoArtwork: null });
  } finally {
    PDFPage.prototype.drawLine = originalDrawLine;
  }

  assert.ok(linesByPage.size > 1, 'fixture must span more than one PDF page');
  for (const lines of linesByPage.values()) {
    const horizontal = lines.filter((line) =>
      Math.abs(line.start.y - line.end.y) < POINT_TOLERANCE
    );
    assert.equal(
      horizontal.length,
      2,
      'each page segment needs exactly one outer top and one outer bottom rule'
    );
  }
});
