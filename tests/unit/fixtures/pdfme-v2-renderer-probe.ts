import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readFile as readFileBytes } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { BlankPdf, Plugin, Schema } from '@pdfme/common';
import { PDFDocument } from 'pdf-lib';
import {
  PDFME_V2_ITEM_TABLE_HEADERS,
  PDFME_V2_LIMITS,
  PdfmeV2ValidationError,
  compilePdfmeV2Template,
  createDefaultPdfmeV2Template,
  getDefaultPdfmeV2ElementIds,
  toPdfmeV2Input
} from '../../../src/shared/domain/pdfmeV2/index';
import { PDFME_V2_PLUGINS } from '../../../src/shared/pdfmeV2/plugins';
import {
  PDFME_V2_FONT_ASSETS,
  PDFME_V2_FONT_HASHES,
  PDFME_V2_MAX_PDF_BYTES,
  PdfmeV2RenderError,
  assertPdfmeV2GeneratedPdf,
  getPdfmeV2ServerFontHashes,
  loadPdfmeV2ServerFonts,
  renderPdfmeV2Document
} from '../../../src/shared/server/pdfmeV2/index';
import {
  PDFME_V2_PREVIEW_MAX_REQUEST_BYTES,
  POST
} from '../../../src/admin/api/order-document-templates-v2/preview/route';
import {
  PDFME_V2_RENDERER_LONG_NOTES,
  PDFME_V2_RENDERER_NOTES_MARKER,
  PDFME_V2_RENDERER_SCENARIOS,
  PDFME_V2_RENDERER_SLOVENE_GLYPHS,
  createPathologicalPdfmeV2RendererData,
  createPdfmeV2RendererData
} from './pdfme-v2-renderer-fixtures';

const A4_WIDTH_PT = 210 * 72 / 25.4;
const A4_HEIGHT_PT = 297 * 72 / 25.4;
const POINT_TOLERANCE = 0.05;
const BOX_TOLERANCE_MM = 0.01;

interface RenderEvent {
  type: string;
  name: string;
  atehnaId: string | null;
  page: number;
  value: string;
  x: number;
  y: number;
  width: number;
  height: number;
  drawnTexts: string[];
  isStatic: boolean;
}

type DrawText = (text: string, options?: unknown) => unknown;

let activeEvents: RenderEvent[] | null = null;
let activeStaticNames = new Set<string>();
const originalPluginRenderers: Array<{ plugin: Plugin; pdf: Plugin['pdf'] }> = [];

for (const plugin of Object.values(PDFME_V2_PLUGINS)) {
  const originalPdf = plugin.pdf;
  originalPluginRenderers.push({ plugin, pdf: originalPdf });
  plugin.pdf = async (args) => {
    const schema = args.schema as Schema & {
      atehnaId?: string;
    };
    const event: RenderEvent = {
      type: schema.type,
      name: schema.name,
      atehnaId: schema.atehnaId ?? null,
      page: args.pdfDoc.getPages().findIndex((page) => page === args.page) + 1,
      value: String(args.value),
      x: schema.position.x,
      y: schema.position.y,
      width: schema.width,
      height: schema.height,
      drawnTexts: [],
      isStatic: activeStaticNames.has(schema.name)
    };
    activeEvents?.push(event);

    const page = args.page as unknown as { drawText: DrawText };
    const originalDrawText = page.drawText;
    page.drawText = (text, options) => {
      event.drawnTexts.push(text);
      return originalDrawText.call(page, text, options);
    };
    try {
      await originalPdf(args);
    } finally {
      page.drawText = originalDrawText;
    }
  };
}

function stableId(schema: Schema): string | null {
  const value = (schema as Schema & { atehnaId?: unknown }).atehnaId;
  return typeof value === 'string' ? value : null;
}

function countOccurrences(values: readonly string[], needle: string): number {
  return values.reduce((count, value) => (
    count + (value.includes(needle) ? 1 : 0)
  ), 0);
}

function boxIntersects(a: RenderEvent, b: RenderEvent): boolean {
  return a.x < b.x + b.width - BOX_TOLERANCE_MM
    && a.x + a.width > b.x + BOX_TOLERANCE_MM
    && a.y < b.y + b.height - BOX_TOLERANCE_MM
    && a.y + a.height > b.y + BOX_TOLERANCE_MM;
}

function assertEventInsideA4(event: RenderEvent) {
  for (const value of [event.x, event.y, event.width, event.height]) {
    assert.equal(Number.isFinite(value), true, `${event.name} geometry must be finite`);
  }
  assert.ok(event.x >= -BOX_TOLERANCE_MM, `${event.name} extends left of A4`);
  assert.ok(event.y >= -BOX_TOLERANCE_MM, `${event.name} extends above A4`);
  assert.ok(
    event.x + event.width <= 210 + BOX_TOLERANCE_MM,
    `${event.name} extends right of A4`
  );
  assert.ok(
    event.y + event.height <= 297 + BOX_TOLERANCE_MM,
    `${event.name} extends below A4`
  );
}

function assertComesAfter(previous: RenderEvent, next: RenderEvent, message: string) {
  assert.ok(
    next.page > previous.page
      || (
        next.page === previous.page
        && next.y + BOX_TOLERANCE_MM >= previous.y + previous.height
      ),
    message
  );
}

async function inspectScenario(
  documentType: (typeof PDFME_V2_RENDERER_SCENARIOS)[number]['documentType'],
  rowCount: number
) {
  const canonicalTemplate = createDefaultPdfmeV2Template(documentType);
  const defaultIds = getDefaultPdfmeV2ElementIds(documentType);
  const canonicalBeforeCompile = JSON.stringify(canonicalTemplate);
  const repeatingIds = new Set([
    ...canonicalTemplate.envelope.repeating.header,
    ...canonicalTemplate.envelope.repeating.footer
  ]);
  const authoredPage = canonicalTemplate.template.schemas[0];
  const repeatingNames = authoredPage
    .filter((schema) => repeatingIds.has(schema.atehnaId))
    .map((schema) => schema.name);
  activeStaticNames = new Set(repeatingNames);

  const compiled = compilePdfmeV2Template(canonicalTemplate);
  assert.equal(
    JSON.stringify(canonicalTemplate),
    canonicalBeforeCompile,
    'header/footer compilation must not mutate the canonical template'
  );
  const blankBase = compiled.basePdf as BlankPdf;
  const compiledStatic = blankBase.staticSchema ?? [];
  assert.deepEqual(
    compiledStatic.map(stableId),
    authoredPage.filter((schema) => repeatingIds.has(schema.atehnaId)).map(stableId)
  );
  assert.equal(
    compiled.schemas[0].some((schema) => repeatingIds.has(stableId(schema) ?? '')),
    false,
    'compiled repeating schemas must be removed from the ordinary page'
  );
  assert.equal(
    canonicalTemplate.template.basePdf.staticSchema,
    undefined,
    'the authored template must keep header/footer as ordinary schemas'
  );

  const authoredTable = authoredPage.find((schema) => schema.name === 'itemsTable');
  assert.ok(authoredTable);
  assert.equal(authoredTable.showHead, true);
  assert.equal(authoredTable.repeatHead, true);
  assert.equal(authoredTable.content, '[]');

  const renderData = createPdfmeV2RendererData(documentType, rowCount);
  assert.equal(renderData.notes.length, rowCount === 100 ? 4000 : renderData.notes.length);
  activeEvents = [];
  const bytes = await renderPdfmeV2Document({ canonicalTemplate, renderData });
  const events = activeEvents;
  activeEvents = null;

  assert.equal(new TextDecoder('ascii').decode(bytes.subarray(0, 5)), '%PDF-');
  assert.ok(bytes.byteLength < PDFME_V2_MAX_PDF_BYTES);
  const pdf = await PDFDocument.load(bytes);
  const pageCount = pdf.getPageCount();
  assert.ok(pageCount >= 1);
  for (const page of pdf.getPages()) {
    const mediaBox = page.getMediaBox();
    assert.ok(Math.abs(mediaBox.x) <= POINT_TOLERANCE);
    assert.ok(Math.abs(mediaBox.y) <= POINT_TOLERANCE);
    assert.ok(Math.abs(mediaBox.width - A4_WIDTH_PT) <= POINT_TOLERANCE);
    assert.ok(Math.abs(mediaBox.height - A4_HEIGHT_PT) <= POINT_TOLERANCE);
  }
  if (rowCount <= 1) assert.equal(pageCount, 1);
  if (rowCount >= 27) assert.ok(pageCount > 1);

  assert.ok(events.length > 0);
  events.forEach(assertEventInsideA4);
  assert.equal(
    events.some((event) => event.page === pageCount && !event.isStatic),
    true,
    'the final page must contain ordinary content, not only static header/footer'
  );

  const headerEvents = events.filter(
    (event) => event.atehnaId === defaultIds.headerTitle
  );
  const footerEvents = events.filter(
    (event) => event.atehnaId === defaultIds.footerPageNumber
  );
  assert.equal(headerEvents.length, pageCount);
  assert.equal(footerEvents.length, pageCount);
  for (let page = 1; page <= pageCount; page += 1) {
    assert.equal(footerEvents.find((event) => event.page === page)?.value, `Stran ${page} / ${pageCount}`);
    const pageEvents = events.filter((event) => event.page === page);
    const lastStaticIndex = pageEvents.reduce(
      (last, event, index) => event.isStatic ? index : last,
      -1
    );
    const firstOrdinaryIndex = pageEvents.findIndex((event) => !event.isStatic);
    if (firstOrdinaryIndex >= 0) {
      assert.ok(
        lastStaticIndex < firstOrdinaryIndex,
        'static schemas must render beneath ordinary schemas'
      );
    }
  }

  const tableEvents = events.filter((event) => event.name === 'itemsTable');
  assert.ok(tableEvents.length >= 1);
  assert.equal(new Set(tableEvents.map((event) => event.page)).size, tableEvents.length);
  const tableDrawnTexts = tableEvents.flatMap((event) => event.drawnTexts);
  for (const header of PDFME_V2_ITEM_TABLE_HEADERS) {
    assert.equal(
      tableDrawnTexts.filter((text) => text === header).length,
      tableEvents.length,
      `${header} must repeat once on every table page`
    );
  }
  for (let row = 1; row <= rowCount; row += 1) {
    const marker = `V2-ROW-${String(row).padStart(3, '0')}`;
    assert.equal(
      countOccurrences(tableDrawnTexts, marker),
      1,
      `${marker} must be rendered exactly once`
    );
  }

  const totalsEvents = events.filter(
    (event) => event.atehnaId === defaultIds.totals
  );
  const notesEvents = events.filter(
    (event) => event.atehnaId === defaultIds.notes
  );
  assert.equal(totalsEvents.length, 1, 'totals must render exactly once');
  assert.ok(notesEvents.length >= 1);
  const lastTable = tableEvents.at(-1);
  const firstNotes = notesEvents[0];
  assert.ok(lastTable && firstNotes);
  assertComesAfter(lastTable, totalsEvents[0], 'totals must follow the final table row');
  assertComesAfter(totalsEvents[0], firstNotes, 'notes must follow totals');

  if (rowCount === 100) {
    assert.equal(renderData.notes, PDFME_V2_RENDERER_LONG_NOTES);
    assert.equal(
      countOccurrences(notesEvents.flatMap((event) => event.drawnTexts), PDFME_V2_RENDERER_NOTES_MARKER),
      1,
      'the long notes marker must render exactly once'
    );
  }

  const dynamicIds = new Set([
    defaultIds.itemsTable,
    defaultIds.totals,
    defaultIds.notes
  ]);
  const dynamicEvents = events.filter(
    (event) => event.atehnaId !== null && dynamicIds.has(event.atehnaId)
  );
  const staticEvents = events.filter((event) => event.isStatic);
  for (const dynamicEvent of dynamicEvents) {
    for (const staticEvent of staticEvents) {
      if (dynamicEvent.page !== staticEvent.page) continue;
      assert.equal(
        boxIntersects(dynamicEvent, staticEvent),
        false,
        `${dynamicEvent.name} overlaps static ${staticEvent.name} on page ${dynamicEvent.page}`
      );
    }
  }

  const renderedText = events.flatMap((event) => event.drawnTexts).join(' ');
  for (const glyph of PDFME_V2_RENDERER_SLOVENE_GLYPHS.split(' ').filter(Boolean)) {
    assert.ok(renderedText.includes(glyph), `missing Slovene glyph ${glyph}`);
  }

  const input = toPdfmeV2Input(renderData);
  assert.equal(JSON.parse(input.itemsTable).length, rowCount);
  return { documentType, rowCount, pageCount, byteLength: bytes.byteLength };
}

async function inspectFonts() {
  const fonts = await loadPdfmeV2ServerFonts();
  assert.deepEqual(Object.keys(fonts), ['NotoSans', 'NotoSansBold']);
  assert.equal(Object.values(fonts).filter((font) => font.fallback === true).length, 1);
  assert.equal(fonts.NotoSans.fallback, true);
  assert.equal(fonts.NotoSansBold.fallback, false);

  const runtimeHashes = await getPdfmeV2ServerFontHashes();
  assert.deepEqual(runtimeHashes, PDFME_V2_FONT_HASHES);
  for (const name of ['NotoSans', 'NotoSansBold'] as const) {
    const bytes = fonts[name].data;
    assert.ok(bytes instanceof Uint8Array);
    const diskBytes = await readFileBytes(resolve(process.cwd(), PDFME_V2_FONT_ASSETS[name].filePath));
    assert.equal(Buffer.from(bytes).equals(diskBytes), true);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), PDFME_V2_FONT_HASHES[name]);
  }
}

async function inspectPreviewRoute() {
  const canonicalTemplate = createDefaultPdfmeV2Template('dobavnica');
  const renderData = createPdfmeV2RendererData('dobavnica', 1);
  const requestBody = JSON.stringify({ canonicalTemplate, renderData });
  const response = await POST(new Request('http://localhost/api/admin/order-document-templates-v2/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: requestBody
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.match(response.headers.get('cache-control') ?? '', /(?:^|,)\s*no-store\b/u);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(new TextDecoder('ascii').decode(bytes.subarray(0, 5)), '%PDF-');
  assert.ok(bytes.byteLength < PDFME_V2_MAX_PDF_BYTES);
  assert.equal(response.headers.get('content-length'), String(bytes.byteLength));

  const mismatchedResponse = await POST(new Request('http://localhost/preview', {
    method: 'POST',
    body: JSON.stringify({
      canonicalTemplate,
      renderData: { ...renderData, documentType: 'invoice' }
    })
  }));
  assert.equal(mismatchedResponse.status, 400);
  assert.match(mismatchedResponse.headers.get('cache-control') ?? '', /no-store/u);
  assert.equal(mismatchedResponse.headers.get('x-content-type-options'), 'nosniff');

  const oversizedResponse = await POST(new Request('http://localhost/preview', {
    method: 'POST',
    headers: { 'Content-Length': String(PDFME_V2_PREVIEW_MAX_REQUEST_BYTES + 1) },
    body: '{}'
  }));
  assert.equal(oversizedResponse.status, 413);

  const invalidJsonResponse = await POST(new Request('http://localhost/preview', {
    method: 'POST',
    body: '{'
  }));
  assert.equal(invalidJsonResponse.status, 400);
  return { status: response.status, byteLength: bytes.byteLength };
}

try {
  assert.equal(PDFME_V2_MAX_PDF_BYTES, PDFME_V2_LIMITS.MAX_GENERATED_PDF_BYTES);
  assert.throws(
    () => assertPdfmeV2GeneratedPdf(new Uint8Array([1, 2, 3, 4, 5])),
    (error) => error instanceof PdfmeV2RenderError && error.code === 'invalid-pdf-signature'
  );
  const exactlyAtLimit = new Uint8Array(PDFME_V2_MAX_PDF_BYTES);
  exactlyAtLimit.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
  assert.throws(
    () => assertPdfmeV2GeneratedPdf(exactlyAtLimit),
    (error) => error instanceof PdfmeV2RenderError && error.code === 'pdf-size-limit'
  );

  await inspectFonts();
  const scenarios = [];
  for (const scenario of PDFME_V2_RENDERER_SCENARIOS) {
    scenarios.push(await inspectScenario(scenario.documentType, scenario.rowCount));
  }

  await assert.rejects(
    () => renderPdfmeV2Document({
      canonicalTemplate: createDefaultPdfmeV2Template('invoice'),
      renderData: createPathologicalPdfmeV2RendererData()
    }),
    (error) => error instanceof PdfmeV2ValidationError
      && (error.code === 'STRING_TOO_LONG' || error.code === 'JSON_TOO_LARGE')
  );

  const route = await inspectPreviewRoute();
  const serverSources = await Promise.all([
    readFile(resolve(process.cwd(), 'src/shared/server/pdfmeV2/renderer.ts'), 'utf8'),
    readFile(resolve(process.cwd(), 'src/admin/api/order-document-templates-v2/preview/route.ts'), 'utf8')
  ]);
  for (const source of serverSources) {
    assert.doesNotMatch(source, /@vercel\/blob|shared\/server\/(?:db|audit)|orderSummaryJobs|generateOrderDocumentRoute/u);
  }

  process.stdout.write(JSON.stringify({ scenarios, route }));
} finally {
  for (const { plugin, pdf } of originalPluginRenderers) plugin.pdf = pdf;
}
