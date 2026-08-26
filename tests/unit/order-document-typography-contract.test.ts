import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import test from 'node:test';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFPage } from 'pdf-lib';
import {
  ORDER_DOCUMENT_FONT_FAMILY_CATALOG,
  ORDER_DOCUMENT_FONT_FAMILY_IDS,
  getOrderDocumentTypographyOverride,
  normalizeOrderDocumentTemplate,
  normalizeOrderDocumentTypographyOverride,
  resetOrderDocumentTypography,
  resolveOrderDocumentTypography,
  resolveSupportedOrderDocumentTypography,
  setOrderDocumentTypography,
  cloneDefaultOrderDocumentTemplate,
  type OrderDocumentFontFamilyId,
  type OrderDocumentFontStyleId,
  type OrderDocumentFontWeightId,
  type OrderDocumentTypographyTarget
} from '../../src/shared/domain/order/orderDocumentTemplates';
import {
  generateOrderPdf,
  type GenerateOrderPdfInput,
  type PdfItem,
  type PdfOrder
} from '../../src/shared/server/pdf';

const SLOVENE_GLYPHS = 'ČčŠšŽž';
const REQUIRED_PDF_GLYPHS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ČčŠšŽž';
const REPRESENTATIVE_PDF_TEXT = `${REQUIRED_PDF_GLYPHS} .,;:!?+-/%()[]`;
const ISSUED_AT = new Date('2026-08-25T10:00:00.000Z');

const SAMPLE_ORDER: PdfOrder = {
  customerType: 'school',
  organizationName: 'Osnovna šola',
  contactName: 'Maja Novak',
  email: 'maja.novak@example.test',
  deliveryAddress: 'Begunjska cesta 7, 4248 Lesce',
  reference: 'NAR-2026-0042',
  notes: 'Dostava v tajništvo.',
  createdAt: new Date('2026-08-20T10:00:00.000Z'),
  subtotal: 10,
  tax: 2.2,
  taxRate: 22,
  shipping: 0,
  total: 12.2,
  commitmentStatus: 'binding'
};

const SAMPLE_ITEMS: PdfItem[] = [
  {
    sku: 'ART-1',
    name: 'Testni izdelek',
    unit: 'kos',
    quantity: 1,
    unitPrice: 10,
    lineTotal: 10,
    taxRate: 22,
    discountPercentage: 0
  }
];

const canvasSource = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/urejevalnik/components/OrderDocumentTemplateCanvas.tsx'
  ),
  'utf8'
);
const editorSource = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/urejevalnik/components/AdminOrderDocumentTemplateEditor.tsx'
  ),
  'utf8'
);
const previewRouteSource = readFileSync(
  resolve(process.cwd(), 'src/admin/api/order-document-templates/preview/route.ts'),
  'utf8'
);
const productionRouteSource = readFileSync(
  resolve(process.cwd(), 'src/admin/api/orders/generateOrderDocumentRoute.ts'),
  'utf8'
);
const rendererSource = readFileSync(
  resolve(process.cwd(), 'src/shared/server/pdf.ts'),
  'utf8'
);

function buildInput(): GenerateOrderPdfInput {
  return {
    type: 'order_summary',
    template: cloneDefaultOrderDocumentTemplate('order_summary'),
    order: SAMPLE_ORDER,
    items: SAMPLE_ITEMS,
    documentNumber: 'PN-2026-0042',
    issuedAt: ISSUED_AT,
    logoArtwork: null
  };
}

function fontPostscriptName(
  familyId: OrderDocumentFontFamilyId,
  weight: OrderDocumentFontWeightId,
  style: OrderDocumentFontStyleId
) {
  const family = ORDER_DOCUMENT_FONT_FAMILY_CATALOG.find(
    (candidate) => candidate.id === familyId
  );
  const face = family?.faces.find(
    (candidate) => candidate.weight === weight && candidate.style === style
  );
  assert.ok(face, `Missing ${familyId} ${weight}/${style} catalog face`);
  const bytes = readFileSync(resolve(
    process.cwd(),
    'public',
    face.assetPath.replace(/^\//u, '')
  ));
  const name = fontkit.create(bytes).postscriptName;
  assert.ok(name, `Missing PostScript name for ${face.assetPath}`);
  return name;
}

function resolvePdftoppmCommand() {
  const executableName = process.platform === 'win32' ? 'pdftoppm.exe' : 'pdftoppm';
  const configured = process.env.PDFTOPPM_PATH?.trim();
  if (configured && existsSync(configured)) return configured;

  if (process.env.USERPROFILE) {
    const bundled = resolve(
      process.env.USERPROFILE,
      '.cache',
      'codex-runtimes',
      'codex-primary-runtime',
      'dependencies',
      'native',
      'poppler',
      'Library',
      'bin',
      executableName
    );
    if (existsSync(bundled)) return bundled;
  }

  const probe = spawnSync('pdftoppm', ['-v'], {
    encoding: 'utf8',
    timeout: 10_000,
    windowsHide: true
  });
  return probe.error ? null : 'pdftoppm';
}

test('PDF font catalog declares deploy-safe complete Latin and Slovenian faces', () => {
  assert.deepEqual(
    ORDER_DOCUMENT_FONT_FAMILY_CATALOG.map((family) => family.id),
    [...ORDER_DOCUMENT_FONT_FAMILY_IDS]
  );
  assert.equal(new Set(ORDER_DOCUMENT_FONT_FAMILY_IDS).size, 9);
  assert.ok(
    ORDER_DOCUMENT_FONT_FAMILY_IDS.length >= 8,
    'the PDF editor must offer a broad professional family catalog'
  );

  const seenAssets = new Set<string>();
  for (const family of ORDER_DOCUMENT_FONT_FAMILY_CATALOG) {
    assert.ok(family.faces.length > 0, `${family.id} must expose at least one face`);
    assert.match(
      family.cssFontFamily,
      new RegExp(family.label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'),
      `${family.id} browser preview must name its selected family before fallbacks`
    );
    for (const face of family.faces) {
      assert.match(
        face.assetPath,
        /\.(?:ttf|otf)$/iu,
        `${face.assetPath} is not a broadly supported PDF font container`
      );
      assert.doesNotMatch(face.assetPath, /\.(?:woff2?|eot)$/iu);
      assert.equal(
        seenAssets.has(face.assetPath),
        false,
        `Duplicate font asset in the PDF catalog: ${face.assetPath}`
      );
      seenAssets.add(face.assetPath);

      const assetPath = resolve(
        process.cwd(),
        'public',
        face.assetPath.replace(/^\//u, '')
      );
      const bytes = readFileSync(assetPath);
      assert.ok(bytes.byteLength > 1_024, `${face.assetPath} is unexpectedly small`);
      const parsed = fontkit.create(bytes);
      const outlineFingerprints = new Set<string>();
      for (const character of REPRESENTATIVE_PDF_TEXT) {
        const codePoint = character.codePointAt(0)!;
        assert.equal(
          parsed.hasGlyphForCodePoint(codePoint),
          true,
          `${family.id}/${face.weight}/${face.style} lacks ${character}`
        );
        assert.ok(
          parsed.characterSet.includes(codePoint),
          `${family.id}/${face.weight}/${face.style} cmap omits ${character}`
        );
        const glyph = parsed.glyphForCodePoint(codePoint);
        assert.notEqual(
          glyph.id,
          0,
          `${family.id}/${face.weight}/${face.style} maps ${character} to .notdef`
        );
        if (!/\s/u.test(character)) {
          const outline = glyph.path.toSVG();
          assert.ok(
            outline.length > 0 && glyph.bbox.width > 0 && glyph.bbox.height > 0,
            `${family.id}/${face.weight}/${face.style} has no drawable outline for ${character}`
          );
          outlineFingerprints.add(outline);
        }
      }
      assert.ok(
        outlineFingerprints.size >= 55,
        `${family.id}/${face.weight}/${face.style} maps representative text to too few distinct outlines`
      );
      assert.equal(
        parsed.layout(REPRESENTATIVE_PDF_TEXT).glyphs.some((glyph) => glyph.id === 0),
        false,
        `${family.id}/${face.weight}/${face.style} shapes representative text with .notdef`
      );
      if (face.style === 'italic') {
        assert.ok(
          parsed.head.macStyle.italic
            || parsed.italicAngle !== 0
            || /italic/iu.test(parsed.subfamilyName ?? ''),
          `${face.assetPath} must be a real italic face`
        );
      }
    }
  }
});

test('Poppler rasterizes representative Barlow text without invalid or missing glyphs', async (t) => {
  const pdftoppm = resolvePdftoppmCommand();
  if (!pdftoppm) {
    t.skip('Poppler pdftoppm is not available in this environment.');
    return;
  }

  const input = buildInput();
  input.template.text.title = SLOVENE_GLYPHS;
  input.template.text.intro = REPRESENTATIVE_PDF_TEXT;
  input.template.layout.showHeader = false;
  input.template.layout.showFooter = false;
  input.template.layout.showPageNumbers = false;
  input.template.layout.sections = input.template.layout.sections.map((section) => ({
    ...section,
    enabled: section.id === 'intro'
  }));
  input.template = setOrderDocumentTypography(
    input.template,
    { kind: 'element', elementId: 'intro' },
    {
      fontFamily: 'barlow',
      fontWeight: 'regular',
      fontStyle: 'normal',
      fontSizePt: 12
    }
  );
  const tempDirectory = mkdtempSync(join(tmpdir(), 'atehna-poppler-font-'));
  const pdfPath = join(tempDirectory, 'barlow-slovenian.pdf');
  const outputPrefix = join(tempDirectory, 'barlow-slovenian-page');
  const expectedFontName = fontPostscriptName('barlow', 'regular', 'normal');
  const drawnLines: string[] = [];
  const originalDrawText = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    if (options.font?.name === expectedFontName) {
      drawnLines.push(text);
      const encoded = options.font.encodeText(text).asBytes();
      assert.equal(encoded.length % 2, 0, 'custom-font CIDs must use two-byte codes');
      for (let index = 0; index < encoded.length; index += 2) {
        assert.notDeepEqual(
          [encoded[index], encoded[index + 1]],
          [0, 0],
          `renderer encoded .notdef for representative text line: ${text}`
        );
      }
    }
    return originalDrawText.call(this, text, options);
  };

  try {
    let bytes: Uint8Array;
    try {
      bytes = await generateOrderPdf(input);
    } finally {
      PDFPage.prototype.drawText = originalDrawText;
    }
    assert.equal(
      drawnLines.join('').replace(/\s/gu, ''),
      REPRESENTATIVE_PDF_TEXT.replace(/\s/gu, ''),
      'the generated page must draw every representative character with Barlow'
    );
    writeFileSync(pdfPath, bytes);
    const result = spawnSync(
      pdftoppm,
      ['-f', '1', '-l', '1', '-singlefile', '-png', pdfPath, outputPrefix],
      {
        encoding: 'utf8',
        timeout: 30_000,
        windowsHide: true
      }
    );
    const diagnostics = [result.stdout, result.stderr].filter(Boolean).join('\n');
    assert.equal(result.error, undefined, diagnostics);
    assert.equal(result.status, 0, diagnostics);
    assert.doesNotMatch(
      diagnostics,
      /Embedded font file may be invalid|Syntax (?:Error|Warning).*font/iu
    );

    const imagePath = `${outputPrefix}.png`;
    assert.equal(existsSync(imagePath), true, 'Poppler did not create the rasterized page');
    assert.deepEqual(
      [...readFileSync(imagePath).subarray(0, 8)],
      [137, 80, 78, 71, 13, 10, 26, 10],
      'Poppler output is not a valid PNG'
    );
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
    rmSync(tempDirectory, { recursive: true, force: true });
  }
});

test('Poppler rasterizes representative text in every curated PDF family', async (t) => {
  const pdftoppm = resolvePdftoppmCommand();
  if (!pdftoppm) {
    t.skip('Poppler pdftoppm is not available in this environment.');
    return;
  }

  const tempDirectory = mkdtempSync(join(tmpdir(), 'atehna-poppler-font-catalog-'));
  try {
    for (const family of ORDER_DOCUMENT_FONT_FAMILY_CATALOG) {
      const face = family.faces.find(
        (candidate) => candidate.weight === 'regular' && candidate.style === 'normal'
      );
      assert.ok(face, `${family.id} must expose a regular upright face`);
      const input = buildInput();
      input.template.text.intro = `${family.label}: ${REPRESENTATIVE_PDF_TEXT}`;
      input.template.layout.showHeader = false;
      input.template.layout.showFooter = false;
      input.template.layout.showPageNumbers = false;
      input.template.layout.sections = input.template.layout.sections.map((section) => ({
        ...section,
        enabled: section.id === 'intro'
      }));
      input.template = setOrderDocumentTypography(
        input.template,
        { kind: 'element', elementId: 'intro' },
        {
          fontFamily: family.id,
          fontWeight: face.weight,
          fontStyle: face.style,
          fontSizePt: 12
        }
      );

      const pdfPath = join(tempDirectory, `${family.id}.pdf`);
      const outputPrefix = join(tempDirectory, `${family.id}-page`);
      writeFileSync(pdfPath, await generateOrderPdf(input));
      const rasterResult: SpawnSyncReturns<string> = spawnSync(
        pdftoppm,
        ['-f', '1', '-l', '1', '-singlefile', '-png', pdfPath, outputPrefix],
        {
          encoding: 'utf8',
          timeout: 30_000,
          windowsHide: true
        }
      );
      const diagnostics = [rasterResult.stdout, rasterResult.stderr]
        .filter(Boolean)
        .join('\n');
      assert.equal(rasterResult.error, undefined, `${family.id}: ${diagnostics}`);
      assert.equal(rasterResult.status, 0, `${family.id}: ${diagnostics}`);
      assert.doesNotMatch(
        diagnostics,
        /Embedded font file may be invalid|Syntax (?:Error|Warning).*font/iu,
        `${family.id}: ${diagnostics}`
      );
      assert.deepEqual(
        [...readFileSync(`${outputPrefix}.png`).subarray(0, 8)],
        [137, 80, 78, 71, 13, 10, 26, 10],
        `${family.id} did not produce a valid PNG`
      );
    }
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
});

test('typography overrides stay sparse, survive normalization, and reset to inheritance', () => {
  const targets: OrderDocumentTypographyTarget[] = [
    { kind: 'element', elementId: 'title' },
    { kind: 'field_row', group: 'title', rowId: 'subtitle' },
    { kind: 'company_contact', contactId: 'phone' },
    { kind: 'table_column', columnId: 'description' },
    { kind: 'table_row', rowNumber: 2 }
  ];
  let template = cloneDefaultOrderDocumentTemplate('invoice');
  for (const target of targets) {
    template = setOrderDocumentTypography(template, target, {
      fontFamily: 'barlow'
    });
    template = setOrderDocumentTypography(template, target, {
      fontWeight: 'medium',
      fontStyle: 'italic',
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
      fontWeight: 'medium',
      fontStyle: 'italic',
      fontSizePt: 10.5
    });
    template = resetOrderDocumentTypography(template, target);
    assert.equal(
      getOrderDocumentTypographyOverride(template, target),
      undefined,
      `${target.kind} reset must delete the sparse override instead of storing defaults`
    );
  }

  assert.deepEqual(
    normalizeOrderDocumentTypographyOverride({
      fontFamily: 'unsupported',
      fontWeight: 'heavy',
      fontStyle: 'oblique',
      fontSizePt: 100
    }),
    { fontSizePt: 48 }
  );
  assert.deepEqual(
    resolveSupportedOrderDocumentTypography({
      fontFamily: 'noto_sans',
      fontWeight: 'semibold',
      fontStyle: 'italic',
      fontSizePt: 4
    }),
    {
      fontFamily: 'noto_sans',
      fontWeight: 'bold',
      fontStyle: 'normal',
      fontSizePt: 5
    },
    'an unsupported Noto face must coerce to bundled Noto, never Helvetica'
  );
  assert.deepEqual(
    resolveSupportedOrderDocumentTypography({
      fontFamily: 'space_grotesk',
      fontWeight: 'semibold',
      fontStyle: 'italic',
      fontSizePt: 10
    }),
    {
      fontFamily: 'space_grotesk',
      fontWeight: 'bold',
      fontStyle: 'normal',
      fontSizePt: 10
    },
    'unsupported weight/style must choose the nearest real face without changing family'
  );
});

test('typography resolution applies role, element, child, column, and row specificity', () => {
  let template = cloneDefaultOrderDocumentTemplate('dobavnica');
  template = setOrderDocumentTypography(
    template,
    { kind: 'element', elementId: 'document_meta' },
    {
      fontFamily: 'barlow',
      fontWeight: 'medium',
      fontSizePt: 11
    }
  );
  template = setOrderDocumentTypography(
    template,
    { kind: 'field_row', group: 'document_meta', rowId: 'dispatch_method' },
    {
      fontWeight: 'bold',
      fontStyle: 'italic',
      fontSizePt: 8.5
    }
  );
  assert.deepEqual(
    resolveOrderDocumentTypography(template, {
      kind: 'field_row',
      group: 'document_meta',
      rowId: 'dispatch_method'
    }),
    {
      fontFamily: 'barlow',
      fontWeight: 'bold',
      fontStyle: 'italic',
      fontSizePt: 8.5
    }
  );

  template = setOrderDocumentTypography(
    template,
    { kind: 'element', elementId: 'items' },
    { fontFamily: 'barlow', fontSizePt: 9 }
  );
  template = setOrderDocumentTypography(
    template,
    { kind: 'table_column', columnId: 'description' },
    { fontWeight: 'medium', fontSizePt: 10 }
  );
  template = setOrderDocumentTypography(
    template,
    { kind: 'table_row', rowNumber: 1 },
    { fontWeight: 'bold', fontStyle: 'italic' }
  );
  assert.deepEqual(
    resolveOrderDocumentTypography(template, [
      { kind: 'table_column', columnId: 'description' },
      { kind: 'table_row', rowNumber: 1 }
    ]),
    {
      fontFamily: 'barlow',
      fontWeight: 'bold',
      fontStyle: 'italic',
      fontSizePt: 10
    },
    'table row typography must win at the row/column intersection'
  );
});

test('every supported PDF face generates Slovene glyphs with a horizontal baseline', async () => {
  const originalDrawText = PDFPage.prototype.drawText;
  let expectedTitle = '';
  const observations: Array<{
    fontName: string | undefined;
    size: number | undefined;
    rotate: unknown;
    xSkew: unknown;
    ySkew: unknown;
  }> = [];

  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    if (text === expectedTitle) {
      observations.push({
        fontName: options.font?.name,
        size: options.size,
        rotate: options.rotate,
        xSkew: options.xSkew,
        ySkew: options.ySkew
      });
    }
    return originalDrawText.call(this, text, options);
  };

  try {
    for (const family of ORDER_DOCUMENT_FONT_FAMILY_CATALOG) {
      for (const face of family.faces) {
        const input = buildInput();
        expectedTitle = SLOVENE_GLYPHS;
        input.template.text.title = expectedTitle;
        input.template = setOrderDocumentTypography(
          input.template,
          { kind: 'field_row', group: 'title', rowId: 'title_text' },
          {
            fontFamily: family.id,
            fontWeight: face.weight,
            fontStyle: face.style,
            fontSizePt: 17.5
          }
        );
        observations.length = 0;

        const bytes = await generateOrderPdf(input);
        assert.equal(new TextDecoder('ascii').decode(bytes.slice(0, 5)), '%PDF-');
        const document = await PDFDocument.load(bytes);
        assert.ok(document.getPageCount() > 0);

        const assetBytes = readFileSync(resolve(
          process.cwd(),
          'public',
          face.assetPath.replace(/^\//u, '')
        ));
        const parsed = fontkit.create(assetBytes);
        const observed = observations.at(-1);
        assert.ok(observed, `${family.id}/${face.weight}/${face.style} title did not render`);
        assert.equal(
          observed.fontName,
          parsed.postscriptName,
          `${family.id}/${face.weight}/${face.style} must embed the selected face`
        );
        assert.equal(observed.size, 17.5);
        assert.equal(observed.rotate, undefined, 'font style must not rotate the text baseline');
        assert.equal(observed.xSkew, undefined, 'font style must not skew the text baseline');
        if (face.style === 'normal') {
          assert.equal(observed.ySkew, undefined);
        }
      }
    }
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
  }
});

test('PDF renderer applies typography to elements, semantic rows, contacts, and table cells', async () => {
  const input = buildInput();
  input.template.text.intro = 'UVOD-TIPOGRAFIJA';
  input.template.text.labels.total = 'SKUPAJ-TIPOGRAFIJA';
  input.template.text.footerText = 'NOGA-TIPOGRAFIJA';
  input.order.notes = 'OPOMBA-TIPOGRAFIJA';
  input.items[0] = { ...input.items[0]!, name: 'IZDELEK-TIPOGRAFIJA' };
  input.template.company.contacts = input.template.company.contacts.map((contact) =>
    contact.id === 'phone'
      ? { ...contact, value: 'KONTAKT-TIPOGRAFIJA' }
      : contact
  );

  input.template = setOrderDocumentTypography(
    input.template,
    { kind: 'element', elementId: 'intro' },
    {
      fontFamily: 'barlow',
      fontWeight: 'semibold',
      fontStyle: 'italic',
      fontSizePt: 12.5
    }
  );
  input.template = setOrderDocumentTypography(
    input.template,
    { kind: 'company_contact', contactId: 'phone' },
    {
      fontFamily: 'barlow',
      fontWeight: 'medium',
      fontStyle: 'italic',
      fontSizePt: 7.5
    }
  );
  input.template = setOrderDocumentTypography(
    input.template,
    { kind: 'table_column', columnId: 'description' },
    {
      fontFamily: 'barlow',
      fontWeight: 'medium',
      fontStyle: 'normal',
      fontSizePt: 10
    }
  );
  input.template = setOrderDocumentTypography(
    input.template,
    { kind: 'table_row', rowNumber: 1 },
    { fontWeight: 'bold', fontStyle: 'italic' }
  );
  input.template = setOrderDocumentTypography(
    input.template,
    { kind: 'field_row', group: 'totals', rowId: 'total' },
    {
      fontFamily: 'barlow',
      fontWeight: 'bold',
      fontStyle: 'italic',
      fontSizePt: 13
    }
  );
  input.template = setOrderDocumentTypography(
    input.template,
    { kind: 'field_row', group: 'notes', rowId: 'notes_content' },
    {
      fontFamily: 'barlow',
      fontWeight: 'regular',
      fontStyle: 'italic',
      fontSizePt: 8
    }
  );
  input.template = setOrderDocumentTypography(
    input.template,
    { kind: 'field_row', group: 'footer', rowId: 'footer_text' },
    {
      fontFamily: 'barlow',
      fontWeight: 'semibold',
      fontStyle: 'normal',
      fontSizePt: 6.5
    }
  );

  const expectations = new Map([
    ['UVOD-TIPOGRAFIJA', { fontName: fontPostscriptName('barlow', 'semibold', 'italic'), size: 12.5 }],
    ['KONTAKT-TIPOGRAFIJA', { fontName: fontPostscriptName('barlow', 'medium', 'italic'), size: 7.5 }],
    ['IZDELEK-TIPOGRAFIJA', { fontName: fontPostscriptName('barlow', 'bold', 'italic'), size: 10 }],
    ['SKUPAJ-TIPOGRAFIJA', { fontName: fontPostscriptName('barlow', 'bold', 'italic'), size: 13 }],
    ['OPOMBA-TIPOGRAFIJA', { fontName: fontPostscriptName('barlow', 'regular', 'italic'), size: 8 }],
    ['NOGA-TIPOGRAFIJA', { fontName: fontPostscriptName('barlow', 'semibold', 'normal'), size: 6.5 }]
  ]);
  const observed = new Map<string, { fontName?: string; size?: number }>();
  const originalDrawText = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    for (const token of expectations.keys()) {
      if (text.includes(token)) {
        observed.set(token, { fontName: options.font?.name, size: options.size });
      }
    }
    return originalDrawText.call(this, text, options);
  };

  try {
    const bytes = await generateOrderPdf(input);
    await PDFDocument.load(bytes);
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
  }

  for (const [token, expected] of expectations) {
    assert.deepEqual(observed.get(token), expected, `${token} ignored its typography target`);
  }
});

test('typography editing is contextual, floating, and shared by canvas and PDF output', () => {
  assert.match(
    canvasSource,
    /(?:data-testid|testId)="order-document-floating-toolbar"/u
  );
  assert.ok(canvasSource.includes('data-order-document-typography-controls'));
  for (const field of ['fontFamily', 'fontWeight', 'fontStyle', 'fontSizePt']) {
    assert.ok(
      canvasSource.includes(`data-order-document-typography-control="${field}"`),
      `Missing contextual typography control: ${field}`
    );
  }
  assert.ok(canvasSource.includes('data-order-document-typography-reset'));
  assert.ok(
    (canvasSource.match(/<OrderDocumentTypographyControls\b/gu)?.length ?? 0) > 0,
    'the contextual control must be mounted, not merely declared'
  );
  assert.equal(
    canvasSource.match(/data-order-document-typography-controls/gu)?.length,
    1,
    'typography controls must not be duplicated into a global panel'
  );
  assert.match(canvasSource, /<FloatingAppearanceEditorContextToolbar\b/u);
  assert.doesNotMatch(canvasSource, /<aside\b/u);
  assert.match(canvasSource, /resolveOrderDocumentTypography/u);
  assert.match(canvasSource, /ORDER_DOCUMENT_FONT_FAMILY_CATALOG/u);
  assert.match(canvasSource, /cssFontFamily/u);
  assert.match(canvasSource, /fontWeight/u);
  assert.match(canvasSource, /fontStyle/u);
  assert.match(canvasSource, /fontSizePt/u);
  assert.match(canvasSource, /setOrderDocumentTypography/u);
  assert.match(canvasSource, /resetOrderDocumentTypography/u);
  assert.match(
    canvasSource,
    /resolutionTargets\s*\?\?\s*target/u,
    'the toolbar must be able to display the same inherited target chain as the preview'
  );
  assert.match(
    canvasSource,
    /selectedChild\.kind\s*===\s*'company_contact'[\s\S]{0,260}rowId:\s*'contacts'[\s\S]{0,160}selectedTypographyTarget/u,
    'a contact must inherit its company contacts-row typography in both preview and toolbar'
  );

  assert.match(editorSource, /template:\s*currentTemplate/u);
  assert.match(previewRouteSource, /generateOrderPdf\s*\(/u);
  assert.match(previewRouteSource, /template/u);
  assert.match(productionRouteSource, /generateOrderPdf\s*\(/u);
  assert.match(productionRouteSource, /template/u);
  assert.match(rendererSource, /resolveOrderDocumentTypography/u);
  assert.doesNotMatch(
    rendererSource,
    /StandardFonts\.Helvetica/u,
    'production must never fall back to WinAnsi Helvetica for Slovene text'
  );
});
