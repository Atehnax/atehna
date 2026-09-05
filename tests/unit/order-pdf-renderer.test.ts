import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument, PDFPage } from 'pdf-lib';
import {
  ORDER_DOCUMENT_TEMPLATE_TYPES,
  cloneDefaultOrderDocumentTemplate,
  materializeOrderDocumentCanvasElement,
  materializeOrderDocumentTable,
  removeOrderDocumentFieldRow,
  resolveOrderDocumentFieldRows,
  resolveOrderDocumentTable,
  setOrderDocumentDecoration,
  setOrderDocumentFieldRowPlacement,
  setOrderDocumentFieldRows,
  setOrderDocumentCompanyContacts,
  type OrderDocumentTemplateType
} from '../../src/shared/domain/order/orderDocumentTemplates';
import {
  generateOrderPdf,
  type GenerateOrderPdfInput,
  type PdfItem,
  type PdfOrder
} from '../../src/shared/server/pdf';
import {
  cloneDefaultSiteLogoConfig,
  resolveSiteLogoFittedArtworkRect,
  resolveSiteLogoGeometry
} from '../../src/shared/domain/logo/siteLogo';

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const POINT_TOLERANCE = 0.02;
const ISSUED_AT = new Date('2026-08-25T10:00:00.000Z');

const SAMPLE_ORDER: PdfOrder = {
  customerType: 'school',
  organizationName: 'Osnovna šola F. S. Finžgarja Lesce',
  contactName: 'Maja Novak',
  email: 'maja.novak@example.test',
  deliveryAddress: 'Begunjska cesta 7, 4248 Lesce',
  reference: 'ŠOLA-2026-08',
  notes: 'Dostava med delovnim časom tajništva.',
  createdAt: new Date('2026-08-20T10:00:00.000Z'),
  subtotal: 587.3,
  tax: 129.21,
  taxRate: 22,
  shipping: 0,
  total: 716.51,
  commitmentStatus: 'binding'
};

const SAMPLE_ITEMS: PdfItem[] = [
  {
    sku: '7058',
    name: 'ŽAGICE za vibracijsko žago - srednje, komplet 12 kosov',
    unit: 'kos',
    quantity: 1,
    unitPrice: 7,
    lineTotal: 7,
    taxRate: 22,
    discountPercentage: 0
  },
  {
    sku: '7071',
    name: 'NAMIZNI VRTALNI STROJ - SCHEPPACH DP60',
    unit: 'kos',
    quantity: 1,
    unitPrice: 189,
    lineTotal: 189,
    taxRate: 22,
    discountPercentage: 0
  }
];

const DOCUMENT_NUMBERS: Record<OrderDocumentTemplateType, string> = {
  order_summary: 'PN-2026-0042',
  offer: 'PON-2026-0042-V1',
  dobavnica: 'D-2026-0042',
  predracun: 'P-2026-0042',
  invoice: 'R-2026-0042'
};

function buildInput(
  type: OrderDocumentTemplateType,
  items: PdfItem[] = SAMPLE_ITEMS
): GenerateOrderPdfInput {
  return {
    type,
    template: cloneDefaultOrderDocumentTemplate(type),
    order: SAMPLE_ORDER,
    items,
    documentNumber: DOCUMENT_NUMBERS[type],
    issuedAt: ISSUED_AT
  };
}

function assertA4Pages(document: PDFDocument) {
  assert.ok(document.getPageCount() > 0);
  for (const page of document.getPages()) {
    const { width, height } = page.getSize();
    assert.ok(Math.abs(width - A4_WIDTH_PT) <= POINT_TOLERANCE);
    assert.ok(Math.abs(height - A4_HEIGHT_PT) <= POINT_TOLERANCE);
  }
}

test('generateOrderPdf creates valid A4 PDFs with deterministic metadata for every default template', async () => {
  for (const type of ORDER_DOCUMENT_TEMPLATE_TYPES) {
    const input = buildInput(type);
    const bytes = await generateOrderPdf(input);

    assert.equal(new TextDecoder('ascii').decode(bytes.slice(0, 5)), '%PDF-');

    const document = await PDFDocument.load(bytes);
    assertA4Pages(document);
    assert.equal(document.getTitle(), `${input.template.text.title} ${input.documentNumber}`);
    assert.equal(document.getAuthor(), input.template.company.name);
    assert.equal(document.getSubject(), input.template.name);
    assert.equal(document.getCreator(), 'Atehna order document renderer');
    assert.equal(document.getProducer(), 'pdf-lib (https://github.com/Hopding/pdf-lib)');
    assert.equal(document.getCreationDate()?.toISOString(), ISSUED_AT.toISOString());
    assert.ok(document.getModificationDate() instanceof Date);
  }
});

test('default pdf-document fit fills the accepted 73 mm logo frame edge to edge', async () => {
  const originalDrawImage = PDFPage.prototype.drawImage;
  const images: Array<{ x?: number; width?: number }> = [];
  PDFPage.prototype.drawImage = function drawImage(image, options) {
    images.push({ x: options?.x, width: options?.width });
    return originalDrawImage.call(this, image, options);
  };
  try {
    const logoConfig = cloneDefaultSiteLogoConfig();
    assert.equal(logoConfig.placements['pdf-document'].fitMode, 'fill');
    await generateOrderPdf({ ...buildInput('dobavnica'), logoConfig });
  } finally {
    PDFPage.prototype.drawImage = originalDrawImage;
  }
  const millimetres = (value: number) => value * 72 / 25.4;
  assert.ok(images.length > 0);
  assert.ok(Math.abs((images[0].x ?? 0) - millimetres(buildInput('dobavnica').template.style.marginMm)) < POINT_TOLERANCE);
  assert.ok(Math.abs((images[0].width ?? 0) - millimetres(73)) < POINT_TOLERANCE);
});

test('generateOrderPdf keeps every document title baseline horizontal', async () => {
  const originalDrawText = PDFPage.prototype.drawText;
  const observedTitles: Array<{
    type: OrderDocumentTemplateType;
    rotate: unknown;
    xSkew: unknown;
    ySkew: unknown;
  }> = [];
  let activeType: OrderDocumentTemplateType | null = null;
  let activeTitle = '';

  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    if (
      activeType &&
      text.startsWith(activeTitle)
    ) {
      observedTitles.push({
        type: activeType,
        rotate: options.rotate,
        xSkew: options.xSkew,
        ySkew: options.ySkew
      });
    }
    return originalDrawText.call(this, text, options);
  };

  try {
    for (const type of ORDER_DOCUMENT_TEMPLATE_TYPES) {
      const input = buildInput(type);
      activeType = type;
      activeTitle = input.template.text.title;
      await generateOrderPdf(input);
    }
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
  }

  assert.deepEqual(
    observedTitles.map(({ type }) => type),
    ORDER_DOCUMENT_TEMPLATE_TYPES
  );
  for (const title of observedTitles) {
    assert.equal(title.rotate, undefined, `${title.type} title must not be rotated`);
    assert.equal(title.xSkew, undefined, `${title.type} title baseline must not be skewed`);
    assert.equal(title.ySkew, undefined, `${title.type} title baseline must not be skewed`);
  }
});

test('Datum placement preserves signed document-meta owner offsets in the real PDF', async () => {
  const input = buildInput('order_summary');
  let template = materializeOrderDocumentCanvasElement(input.template, 'document_meta');
  Object.assign(template.layout.canvas!.elements.document_meta!, {
    positioning: 'absolute',
    xMm: 110,
    yMm: 52,
    widthMm: 80,
    heightMm: 30,
    page: 1,
    visible: true,
    overflow: 'visible'
  });
  template = setOrderDocumentFieldRowPlacement(
    template,
    'document_meta',
    'issue_date',
    { xMm: -10, yMm: -12, widthMm: 60, heightMm: 7 }
  );
  input.template = template;

  const issueDateLabel = `${template.text.labels.issueDate}:`;
  const observed: Array<{ x?: number; y?: number; size?: number }> = [];
  const originalDrawText = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    if (text === issueDateLabel) {
      observed.push({ x: options.x, y: options.y, size: options.size });
    }
    return originalDrawText.call(this, text, options);
  };

  try {
    await generateOrderPdf(input);
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
  }

  assert.equal(observed.length, 1);
  const toPt = (value: number) => value * 72 / 25.4;
  assert.ok(Math.abs((observed[0].x ?? 0) - toPt(110 - 10)) < POINT_TOLERANCE);
  assert.ok(
    Math.abs(
      (observed[0].y ?? 0)
        - (A4_HEIGHT_PT - toPt(52 - 12) - (observed[0].size ?? 0))
    ) < POINT_TOLERANCE
  );
});

test('each document type renders exactly one Datum label through document metadata', async () => {
  const counts = new Map<OrderDocumentTemplateType, number>();
  let activeType: OrderDocumentTemplateType = 'order_summary';
  let activeLabel = '';
  const originalDrawText = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    if (text === activeLabel) {
      counts.set(activeType, (counts.get(activeType) ?? 0) + 1);
    }
    return originalDrawText.call(this, text, options);
  };

  try {
    for (const type of ORDER_DOCUMENT_TEMPLATE_TYPES) {
      const input = buildInput(type);
      activeType = type;
      activeLabel = `${input.template.text.labels.issueDate}:`;
      await generateOrderPdf(input);
    }
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
  }

  for (const type of ORDER_DOCUMENT_TEMPLATE_TYPES) {
    assert.equal(counts.get(type), 1, `${type} must render one Datum label`);
  }
});

test('invoice title and first order-data row occupy separate vertical bands', async () => {
  const input = buildInput('invoice');
  const observed: Record<'title' | 'date', { y: number; size: number } | undefined> = {
    title: undefined,
    date: undefined
  };
  const originalDrawText = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    if (text === input.template.text.title && options.y != null && options.size != null) {
      observed.title = { y: options.y, size: options.size };
    }
    if (text === `${input.template.text.labels.issueDate}:` && options.y != null && options.size != null) {
      observed.date = { y: options.y, size: options.size };
    }
    return originalDrawText.call(this, text, options);
  };

  try {
    await generateOrderPdf(input);
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
  }

  assert.ok(observed.title);
  assert.ok(observed.date);
  assert.ok(
    observed.date.y + observed.date.size < observed.title.y,
    'Datum must sit completely below the invoice title baseline'
  );
});

test('renderer draws generic accent, outline-side, and signature-fill decorations', async () => {
  const rectangles: Array<{ color?: { red: number; green: number; blue: number } }> = [];
  const lines: Array<{ color?: { red: number; green: number; blue: number } }> = [];
  const originalDrawRectangle = PDFPage.prototype.drawRectangle;
  const originalDrawLine = PDFPage.prototype.drawLine;
  PDFPage.prototype.drawRectangle = function drawRectangle(options) {
    rectangles.push({ color: options?.color as typeof rectangles[number]['color'] });
    return originalDrawRectangle.call(this, options);
  };
  PDFPage.prototype.drawLine = function drawLine(options) {
    lines.push({ color: options.color as typeof lines[number]['color'] });
    return originalDrawLine.call(this, options);
  };

  const hasColor = (
    entries: Array<{ color?: { red: number; green: number; blue: number } }>,
    hex: string
  ) => {
    const numeric = Number.parseInt(hex.slice(1), 16);
    const expected = [
      ((numeric >> 16) & 255) / 255,
      ((numeric >> 8) & 255) / 255,
      (numeric & 255) / 255
    ];
    return entries.some(({ color }) => color
      && Math.abs(color.red - expected[0]!) < 0.0001
      && Math.abs(color.green - expected[1]!) < 0.0001
      && Math.abs(color.blue - expected[2]!) < 0.0001);
  };

  try {
    const summary = buildInput('order_summary');
    summary.template = setOrderDocumentDecoration(
      summary.template,
      { kind: 'element', elementId: 'intro' },
      {
        accentEnabled: true,
        accentSide: 'right',
        accentColor: '#AA7700',
        accentWidthPt: 5
      }
    );
    summary.template = setOrderDocumentDecoration(
      summary.template,
      { kind: 'field_row', group: 'totals', rowId: 'total' },
      {
        outlineEnabled: true,
        outlineColor: '#123ABC',
        outlineWidthPt: 1,
        outlineSides: ['top', 'bottom']
      }
    );
    await generateOrderPdf(summary);

    const delivery = buildInput('dobavnica');
    delivery.template = setOrderDocumentDecoration(
      delivery.template,
      { kind: 'field_row', group: 'signatures', rowId: 'handed_over_by' },
      { fillEnabled: true, fillColor: '#FFF0C2' }
    );
    await generateOrderPdf(delivery);
  } finally {
    PDFPage.prototype.drawRectangle = originalDrawRectangle;
    PDFPage.prototype.drawLine = originalDrawLine;
  }

  assert.equal(hasColor(rectangles, '#AA7700'), true, 'intro accent bar was not drawn');
  assert.equal(hasColor(lines, '#123ABC'), true, 'selected total outline sides were not drawn');
  assert.equal(hasColor(rectangles, '#FFF0C2'), true, 'signature fill was not drawn');
});

test('order-summary subtitle renders on its own baseline below the title row', async () => {
  const input = buildInput('order_summary');
  const originalDrawText = PDFPage.prototype.drawText;
  const observed: Array<{ kind: 'title' | 'subtitle'; y?: number }> = [];
  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    if (text.startsWith(input.template.text.title)) {
      observed.push({ kind: 'title', y: options.y });
    }
    if (text === input.template.text.subtitle) {
      observed.push({ kind: 'subtitle', y: options.y });
    }
    return originalDrawText.call(this, text, options);
  };

  try {
    await generateOrderPdf(input);
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
  }

  const title = observed.find((row) => row.kind === 'title');
  const subtitle = observed.find((row) => row.kind === 'subtitle');
  assert.ok(title, 'title text must render');
  assert.ok(subtitle, 'subtitle must render as a separate draw operation');
  assert.ok(
    typeof title.y === 'number'
      && typeof subtitle.y === 'number'
      && subtitle.y < title.y,
    'subtitle must use its own lower baseline instead of being joined to the title line'
  );
});

test('every default PDF keeps its colorful header and body rows out of the header/title area', async () => {
  const originalDrawImage = PDFPage.prototype.drawImage;
  const originalDrawText = PDFPage.prototype.drawText;

  for (const type of ORDER_DOCUMENT_TEMPLATE_TYPES) {
    const input = buildInput(type);
    const observed: {
      logo?: { y?: number; height?: number };
      companyY?: number;
      titleY?: number;
      subtitleY?: number;
      customerY?: number;
    } = {};
    PDFPage.prototype.drawImage = function drawImage(image, options) {
      observed.logo = { y: options?.y, height: options?.height };
      return originalDrawImage.call(this, image, options);
    };
    PDFPage.prototype.drawText = function drawText(text, options = {}) {
      if (text === input.template.company.name) observed.companyY = options.y;
      if (text === input.template.text.title) observed.titleY = options.y;
      if (text === input.template.text.subtitle) observed.subtitleY = options.y;
      if (text === `${input.template.text.labels.customer}:`) {
        observed.customerY = options.y;
      }
      return originalDrawText.call(this, text, options);
    };

    try {
      await generateOrderPdf(input);
    } finally {
      PDFPage.prototype.drawImage = originalDrawImage;
      PDFPage.prototype.drawText = originalDrawText;
    }

    assert.ok(observed.logo, `${type} must render the colorful logo image`);
    assert.equal(typeof observed.companyY, 'number', `${type} must render company details`);
    assert.equal(typeof observed.titleY, 'number', `${type} must render its title`);
    assert.equal(typeof observed.customerY, 'number', `${type} must render customer rows`);
    assert.ok(
      observed.logo.y! + observed.logo.height! > observed.titleY!,
      `${type} title must start below the logo header`
    );
    assert.ok(
      Math.abs(observed.customerY! - observed.titleY!) > 6,
      `${type} customer and title baselines must not overlap`
    );
    if (input.template.text.subtitle) {
      assert.equal(typeof observed.subtitleY, 'number');
      assert.ok(
        Math.abs(observed.customerY! - observed.subtitleY!) > 6,
        `${type} customer and subtitle baselines must not overlap`
      );
    }
  }
});

test('generateOrderPdf paginates a long item list onto multiple A4 pages', async () => {
  const longItems: PdfItem[] = Array.from({ length: 64 }, (_, index) => ({
    sku: `ART-${String(index + 1).padStart(3, '0')}`,
    name: `Učni pripomoček ${index + 1} z daljšim opisom za preverjanje preloma vrstice in strani`,
    unit: 'kos',
    quantity: (index % 5) + 1,
    unitPrice: 12.5,
    lineTotal: ((index % 5) + 1) * 12.5,
    taxRate: 22,
    discountPercentage: 0
  }));
  const bytes = await generateOrderPdf(buildInput('invoice', longItems));
  const document = await PDFDocument.load(bytes);

  assert.ok(document.getPageCount() > 1);
  assertA4Pages(document);
});

test('document metadata output follows persisted row order and omits deleted rows', async () => {
  const input = buildInput('dobavnica');
  const defaults = resolveOrderDocumentFieldRows(input.template, 'document_meta');
  const dispatchDate = defaults.find((row) => row.id === 'dispatch_date');
  const dispatchMethod = defaults.find((row) => row.id === 'dispatch_method');
  assert.ok(dispatchDate);
  assert.ok(dispatchMethod);

  input.template = setOrderDocumentFieldRows(input.template, 'document_meta', [
    dispatchMethod,
    dispatchDate
  ]);
  const labels = [
    `${input.template.text.labels.dispatchMethod}:`,
    `${input.template.text.labels.dispatchDate}:`
  ];
  const originalDrawText = PDFPage.prototype.drawText;
  const observed: string[] = [];
  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    if (labels.includes(text)) observed.push(text);
    return originalDrawText.call(this, text, options);
  };

  try {
    await generateOrderPdf(input);
    assert.deepEqual(observed, labels);

    observed.length = 0;
    input.template = removeOrderDocumentFieldRow(
      input.template,
      'document_meta',
      'dispatch_method'
    );
    await generateOrderPdf(input);
    assert.deepEqual(observed, [labels[1]]);
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
  }
});

test('default Dobavnica totals keep the intended subtotal and tax without shipping or grand total', async () => {
  const input = buildInput('dobavnica');
  const { subtotal, shipping, tax, total } = input.template.text.labels;
  const originalDrawText = PDFPage.prototype.drawText;
  const observed: string[] = [];
  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    if (
      text === subtotal
      || text === shipping
      || text === total
      || text.startsWith(`${tax} `)
    ) {
      observed.push(text);
    }
    return originalDrawText.call(this, text, options);
  };

  try {
    await generateOrderPdf(input);
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
  }

  assert.ok(observed.includes(subtotal));
  assert.ok(observed.some((text) => text.startsWith(`${tax} `)));
  assert.equal(observed.includes(shipping), false);
  assert.equal(observed.includes(total), false);
});

test('absolute canvas elements drive real logo geometry, title color, clipping frame, and visibility', async () => {
  const input = buildInput('invoice');
  let template = materializeOrderDocumentCanvasElement(input.template, 'logo');
  template = materializeOrderDocumentCanvasElement(template, 'title');

  Object.assign(template.layout.canvas!.elements.logo!, {
    positioning: 'absolute',
    xMm: 37,
    yMm: 21,
    widthMm: 52,
    heightMm: 18,
    page: 1,
    visible: true,
    repeat: 'once',
    backgroundColor: '#123456',
    borderColor: '#654321',
    overflow: 'clip'
  });
  Object.assign(template.layout.canvas!.elements.title!, {
    positioning: 'absolute',
    xMm: 92,
    yMm: 58,
    widthMm: 88,
    heightMm: 14,
    page: 1,
    visible: true,
    textColor: '#FF00AA',
    backgroundColor: '#010203',
    borderColor: '#A0B0C0',
    overflow: 'clip'
  });
  template.style.titleAlignment = 'left';
  input.template = template;
  input.logoConfig = cloneDefaultSiteLogoConfig();

  const originalDrawImage = PDFPage.prototype.drawImage;
  const originalDrawText = PDFPage.prototype.drawText;
  const originalDrawRectangle = PDFPage.prototype.drawRectangle;
  const images: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    sourceWidth: number;
    sourceHeight: number;
  }> = [];
  const rectangles: Array<{ x?: number; y?: number; width?: number; height?: number }> = [];
  const titles: Array<{
    x?: number;
    y?: number;
    color?: { red: number; green: number; blue: number };
  }> = [];

  PDFPage.prototype.drawImage = function drawImage(image, options) {
    if (
      options
      && typeof options.x === 'number'
      && typeof options.y === 'number'
      && typeof options.width === 'number'
      && typeof options.height === 'number'
    ) {
      images.push({
        x: options.x,
        y: options.y,
        width: options.width,
        height: options.height,
        sourceWidth: image.width,
        sourceHeight: image.height
      });
    }
    return originalDrawImage.call(this, image, options);
  };
  PDFPage.prototype.drawRectangle = function drawRectangle(options) {
    if (options) {
      rectangles.push({
        x: options.x,
        y: options.y,
        width: options.width,
        height: options.height
      });
    }
    return originalDrawRectangle.call(this, options);
  };
  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    if (text.startsWith(input.template.text.title)) {
      titles.push({
        x: options.x,
        y: options.y,
        color: options.color as { red: number; green: number; blue: number } | undefined
      });
    }
    return originalDrawText.call(this, text, options);
  };

  try {
    await generateOrderPdf(input);

    const toPt = (value: number) => value * 72 / 25.4;
    const logoFrame = {
      x: toPt(37),
      y: A4_HEIGHT_PT - toPt(21 + 18),
      width: toPt(52),
      height: toPt(18)
    };
    const logoImage = images[0];
    assert.ok(logoImage);
    const logoPlacement = input.logoConfig.placements['pdf-document'];
    const logoGeometry = resolveSiteLogoGeometry(logoPlacement);
    const fittedLogo = resolveSiteLogoFittedArtworkRect({
      sourceWidth: logoImage.sourceWidth,
      sourceHeight: logoImage.sourceHeight,
      viewportWidth: logoFrame.width,
      viewportHeight: logoFrame.height,
      geometry: logoGeometry,
      fitMode: logoPlacement.fitMode,
      artworkScale: logoGeometry.scale
    });
    assert.ok(Math.abs(logoImage.x - (logoFrame.x + fittedLogo.left)) < POINT_TOLERANCE);
    assert.ok(Math.abs(logoImage.width - fittedLogo.width) < POINT_TOLERANCE);
    assert.ok(rectangles.some((rectangle) =>
      Math.abs((rectangle.x ?? 0) - logoFrame.x) < POINT_TOLERANCE
      && Math.abs((rectangle.y ?? 0) - logoFrame.y) < POINT_TOLERANCE
      && Math.abs((rectangle.width ?? 0) - logoFrame.width) < POINT_TOLERANCE
      && Math.abs((rectangle.height ?? 0) - logoFrame.height) < POINT_TOLERANCE
    ));

    assert.equal(titles.length, 1);
    assert.ok(Math.abs((titles[0].x ?? 0) - toPt(92)) < POINT_TOLERANCE);
    assert.ok(
      Math.abs(
        (titles[0].y ?? 0)
          - (A4_HEIGHT_PT - toPt(58) - template.style.titleSizePt)
      ) < POINT_TOLERANCE
    );
    const titleFrame = {
      x: toPt(92),
      y: A4_HEIGHT_PT - toPt(58 + 14),
      width: toPt(88),
      height: toPt(14)
    };
    assert.ok(rectangles.some((rectangle) =>
      Math.abs((rectangle.x ?? 0) - titleFrame.x) < POINT_TOLERANCE
      && Math.abs((rectangle.y ?? 0) - titleFrame.y) < POINT_TOLERANCE
      && Math.abs((rectangle.width ?? 0) - titleFrame.width) < POINT_TOLERANCE
      && Math.abs((rectangle.height ?? 0) - titleFrame.height) < POINT_TOLERANCE
    ));
    assert.ok(Math.abs((titles[0].color?.red ?? 0) - 1) < 0.0001);
    assert.ok(Math.abs((titles[0].color?.green ?? 1) - 0) < 0.0001);
    assert.ok(Math.abs((titles[0].color?.blue ?? 0) - (170 / 255)) < 0.0001);

    images.length = 0;
    template.layout.canvas!.elements.logo!.visible = false;
    await generateOrderPdf({ ...input, template });
    assert.equal(images.length, 0, 'a hidden logo must not be drawn into the PDF');
  } finally {
    PDFPage.prototype.drawImage = originalDrawImage;
    PDFPage.prototype.drawRectangle = originalDrawRectangle;
    PDFPage.prototype.drawText = originalDrawText;
  }
});

test('product table honors column order, visibility, width ratios, and row heights without reordering items', async () => {
  const items: PdfItem[] = [
    {
      sku: 'FIRST',
      name: 'Alpha',
      unit: 'kos',
      quantity: 1,
      unitPrice: 10,
      lineTotal: 10
    },
    {
      sku: 'SECOND',
      name: 'Beta',
      unit: 'kos',
      quantity: 2,
      unitPrice: 12,
      lineTotal: 24
    }
  ];
  const input = buildInput('invoice', items);
  const template = materializeOrderDocumentTable(input.template);
  const table = resolveOrderDocumentTable(template);
  const byId = new Map(table.columns.map((column) => [column.id, column]));
  table.columns = [
    { ...byId.get('description')!, visible: true, widthRatio: 50 },
    { ...byId.get('sku')!, visible: true, widthRatio: 20 },
    { ...byId.get('quantity')!, visible: true, widthRatio: 10 },
    { ...byId.get('lineTotal')!, visible: true, widthRatio: 20 },
    { ...byId.get('unit')!, visible: false, widthRatio: 5 },
    { ...byId.get('unitPrice')!, visible: false, widthRatio: 5 }
  ];
  table.headerHeightPt = 31;
  table.rowHeightPt = 24;
  table.rowGapPt = 5;
  table.rowHeightOverrides = [{ rowNumber: 1, heightPt: 38 }];
  template.layout.table = table;
  input.template = template;

  const expectedHeaders = [
    template.text.labels.description,
    template.text.labels.code,
    template.text.labels.quantity,
    template.text.labels.lineTotal
  ];
  const originalDrawText = PDFPage.prototype.drawText;
  const observedHeaders: Array<{ text: string; x?: number }> = [];
  const observedNames: Array<{ text: string; y?: number }> = [];

  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    if (expectedHeaders.includes(text)) observedHeaders.push({ text, x: options.x });
    if (text === 'Alpha' || text === 'Beta') observedNames.push({ text, y: options.y });
    return originalDrawText.call(this, text, options);
  };

  try {
    await generateOrderPdf(input);
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
  }

  assert.deepEqual(observedHeaders.map(({ text }) => text), expectedHeaders);
  assert.deepEqual(observedNames.map(({ text }) => text), ['Alpha', 'Beta']);
  const contentWidth = A4_WIDTH_PT - 2 * (10 * 72 / 25.4);
  const expectedSkuX = 10 * 72 / 25.4 + contentWidth * 0.5 + 5;
  assert.ok(Math.abs((observedHeaders[1].x ?? 0) - expectedSkuX) < POINT_TOLERANCE);
  assert.ok(
    Math.abs((observedNames[0].y ?? 0) - (observedNames[1].y ?? 0) - 43)
      < POINT_TOLERANCE,
    'the first-row override and shared row gap must affect the next source row position'
  );
  assert.equal(observedHeaders.some(({ text }) => text === template.text.labels.unit), false);
  assert.equal(observedHeaders.some(({ text }) => text === template.text.labels.unitPrice), false);
});

test('company header renders ordered visible contacts, omits Fax and empty values, and honors emphasis', async () => {
  const input = buildInput('invoice');
  input.template = setOrderDocumentCompanyContacts(input.template, [
    {
      id: 'support',
      label: 'Podpora:',
      value: 'podpora@example.test',
      visible: true,
      emphasis: false
    },
    {
      id: 'fax',
      label: 'Fax',
      value: 'SKRITI FAKS',
      visible: false,
      emphasis: false
    },
    {
      id: 'empty',
      label: 'Prazno',
      value: '   ',
      visible: true,
      emphasis: false
    },
    {
      id: 'website',
      label: '',
      value: 'nova.example.test',
      visible: true,
      emphasis: true
    }
  ]);
  input.template.company.fax = 'ZASTARELI FAKS SE NE SME IZPISATI';

  const originalDrawText = PDFPage.prototype.drawText;
  const observed: Array<{ text: string; font: unknown }> = [];
  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    observed.push({ text, font: options.font });
    return originalDrawText.call(this, text, options);
  };

  try {
    await generateOrderPdf(input);
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
  }

  const supportIndex = observed.findIndex(
    ({ text }) => text === 'Podpora: podpora@example.test'
  );
  const websiteIndex = observed.findIndex(({ text }) => text === 'nova.example.test');
  assert.ok(supportIndex >= 0);
  assert.ok(websiteIndex > supportIndex);
  assert.equal(
    observed.some(({ text }) => text.includes('SKRITI FAKS') || text.includes('ZASTARELI FAKS')),
    false
  );
  assert.equal(observed.some(({ text }) => text.includes('Prazno')), false);
  assert.notEqual(
    observed[supportIndex].font,
    observed[websiteIndex].font,
    'emphasized contacts must use the bold PDF font'
  );
});
