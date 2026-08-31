import path from 'node:path';
import fs from 'node:fs/promises';
import fontkit, { type Font as FontkitFont } from '@pdf-lib/fontkit';
import {
  PDFDocument,
  clip,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  type PDFImage,
  type PDFPage,
  type PDFFont,
  type RGB
} from 'pdf-lib';
import {
  DEFAULT_ORDER_DOCUMENT_TYPOGRAPHY,
  ORDER_DOCUMENT_CANVAS_ELEMENT_IDS,
  ORDER_DOCUMENT_FIELD_GROUP_IDS,
  ORDER_DOCUMENT_FONT_FAMILY_CATALOG,
  getDefaultOrderDocumentTypography,
  hasOrderDocumentBoxDecoration,
  resolveOrderDocumentDecoration,
  resolveOrderDocumentDecorationInset,
  resolveOrderDocumentCanvas,
  resolveOrderDocumentCompanyContacts,
  resolveOrderDocumentFieldRows,
  resolveOrderDocumentTable,
  resolveOrderDocumentTableBorders,
  resolveOrderDocumentTableRowHeight,
  resolveOrderDocumentTextAlignment,
  resolveOrderDocumentTypography,
  resolveSupportedOrderDocumentTypography,
  type OrderDocumentCanvasElement,
  type OrderDocumentDecoration,
  type OrderDocumentDecorationSide,
  type OrderDocumentFieldGroupId,
  type OrderDocumentFieldRowId,
  type OrderDocumentFieldRowPlacement,
  type OrderDocumentFontFamilyId,
  type OrderDocumentFontStyleId,
  type OrderDocumentFontWeightId,
  type OrderDocumentSectionId,
  type OrderDocumentTableColumnId,
  type ResolvedOrderDocumentTableBorders,
  type OrderDocumentTemplate,
  type OrderDocumentTemplateType,
  type OrderDocumentResolvedTextAlignment,
  type OrderDocumentTextAlignmentTarget,
  type OrderDocumentTypography,
  type OrderDocumentTypographyOverride,
  type OrderDocumentTypographyTarget
} from '@/shared/domain/order/orderDocumentTemplates';
import {
  cloneDefaultSiteLogoConfig,
  normalizeSiteLogoConfig,
  resolveSiteLogoFittedArtworkRect,
  resolveSiteLogoGeometry,
  type SiteLogoConfig
} from '@/shared/domain/logo/siteLogo';
import {
  formatOrderDocumentCurrency as formatCurrency,
  matchesOrderDocumentElementCondition,
  resolveOrderDocumentCustomerRows,
  resolveOrderDocumentFooterRows,
  resolveOrderDocumentItemCells,
  resolveOrderDocumentMetadataRows,
  resolveOrderDocumentPreviewText,
  resolveOrderDocumentTotalRows,
  toSafeOrderDocumentText as toSafeText,
  type OrderDocumentPreviewContext,
  type OrderDocumentPreviewItem,
  type OrderDocumentPreviewOrder
} from '@/shared/domain/order/orderDocumentPreview';
import {
  ORDER_DOCUMENT_FLOW_SECTION_GAP_PT,
  estimateOrderDocumentFlowElementHeightMm
} from '@/shared/domain/order/orderDocumentFlowLayout';

export type PdfItem = OrderDocumentPreviewItem;
export type PdfOrder = OrderDocumentPreviewOrder;

export type GenerateOrderPdfInput = {
  type: OrderDocumentTemplateType;
  template: OrderDocumentTemplate;
  order: PdfOrder;
  items: PdfItem[];
  documentNumber: string;
  issuedAt: Date;
  logoConfig?: SiteLogoConfig;
  logoArtwork?: Uint8Array | null;
};

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MM_TO_PT = 72 / 25.4;
const FLOW_DECORATION_BOTTOM_INSET_PT = 2;

const mm = (value: number) => value * MM_TO_PT;

function colorFromHex(value: string): RGB {
  const normalized = /^#[0-9A-F]{6}$/iu.test(value) ? value.slice(1) : '000000';
  return rgb(
    Number.parseInt(normalized.slice(0, 2), 16) / 255,
    Number.parseInt(normalized.slice(2, 4), 16) / 255,
    Number.parseInt(normalized.slice(4, 6), 16) / 255
  );
}

type OrderPdfFontFaceKey = `${OrderDocumentFontFamilyId}:${OrderDocumentFontWeightId}:${OrderDocumentFontStyleId}`;
type OrderPdfFontBytes = Map<OrderPdfFontFaceKey, Uint8Array>;
type OrderPdfFontRegistry = Map<OrderPdfFontFaceKey, PDFFont>;

const fontFaceKey = (
  family: OrderDocumentFontFamilyId,
  weight: OrderDocumentFontWeightId,
  style: OrderDocumentFontStyleId
): OrderPdfFontFaceKey => `${family}:${weight}:${style}`;

const cachedFonts: OrderPdfFontBytes = new Map();
const cachedMetricFonts = new Map<OrderPdfFontFaceKey, FontkitFont>();
const catalogFontFaces = new Map(
  ORDER_DOCUMENT_FONT_FAMILY_CATALOG.flatMap((family) =>
    family.faces.map((face) => [
      fontFaceKey(family.id, face.weight, face.style),
      face
    ] as const)
  )
);

async function readFileIfExists(filePath: string): Promise<Uint8Array | null> {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
    ) {
      return null;
    }
    throw error;
  }
}

async function loadFontsFromPublic(requiredKeys: ReadonlySet<OrderPdfFontFaceKey>) {
  const fontDir = path.join(process.cwd(), 'public', 'fonts');
  await Promise.all([...requiredKeys].map(async (key) => {
    if (cachedFonts.has(key)) return;
    const face = catalogFontFaces.get(key);
    if (!face) throw new Error(`PDF font face is not declared in the catalog: ${key}`);
    const bytes = await readFileIfExists(
      path.join(fontDir, path.basename(face.assetPath))
    );
    if (!bytes) throw new Error(`Required Unicode PDF font is missing: ${face.assetPath}`);
    if (bytes.length < 1024) {
      throw new Error(`Bundled PDF font is unexpectedly small: ${face.assetPath}`);
    }
    cachedFonts.set(key, bytes);
  }));
  return new Map([...requiredKeys].map((key) => [key, cachedFonts.get(key)!]));
}

function orderDocumentPdfInkSideBearingsPt(
  typography: OrderDocumentTypography,
  text: string,
  size: number
) {
  const key = fontFaceKey(
    typography.fontFamily,
    typography.fontWeight,
    typography.fontStyle
  );
  const bytes = cachedFonts.get(key);
  if (!bytes || text.length === 0) return { left: 0, right: 0 };
  let metricFont = cachedMetricFonts.get(key);
  if (!metricFont) {
    metricFont = fontkit.create(bytes);
    cachedMetricFonts.set(key, metricFont);
  }
  const run = metricFont.layout(text);
  let advance = 0;
  let inkLeft = Number.POSITIVE_INFINITY;
  let inkRight = Number.NEGATIVE_INFINITY;
  run.glyphs.forEach((glyph, index) => {
    const position = run.positions[index];
    if (!position) return;
    const box = glyph.bbox;
    if (box.maxX > box.minX || box.maxY > box.minY) {
      inkLeft = Math.min(inkLeft, advance + position.xOffset + box.minX);
      inkRight = Math.max(inkRight, advance + position.xOffset + box.maxX);
    }
    advance += position.xAdvance;
  });
  if (
    !Number.isFinite(inkLeft)
    || !Number.isFinite(inkRight)
    || metricFont.unitsPerEm <= 0
  ) return { left: 0, right: 0 };
  const scale = size / metricFont.unitsPerEm;
  return {
    left: inkLeft * scale,
    right: (advance - inkRight) * scale
  };
}

function orderDocumentPdfLeftSideBearingPt(
  typography: OrderDocumentTypography,
  text: string,
  size: number
) {
  return orderDocumentPdfInkSideBearingsPt(typography, text, size).left;
}

function orderDocumentPdfRightSideBearingPt(
  typography: OrderDocumentTypography,
  text: string,
  size: number
) {
  return orderDocumentPdfInkSideBearingsPt(typography, text, size).right;
}

function requiredOrderPdfFontFaceKeys(input: GenerateOrderPdfInput) {
  const required = new Set<OrderPdfFontFaceKey>();
  const addTypography = (typography: OrderDocumentTypography) => {
    const weights = new Set<OrderDocumentFontWeightId>([
      typography.fontWeight,
      'regular',
      'bold'
    ]);
    for (const fontWeight of weights) {
      const supported = resolveSupportedOrderDocumentTypography({
        ...typography,
        fontWeight
      });
      required.add(fontFaceKey(
        supported.fontFamily,
        supported.fontWeight,
        supported.fontStyle
      ));
    }
  };
  const addTarget = (
    target: OrderDocumentTypographyTarget | readonly OrderDocumentTypographyTarget[]
  ) => addTypography(resolveOrderDocumentTypography(input.template, target));

  addTypography(DEFAULT_ORDER_DOCUMENT_TYPOGRAPHY);
  for (const elementId of ORDER_DOCUMENT_CANVAS_ELEMENT_IDS) {
    addTarget({ kind: 'element', elementId });
  }
  for (const group of ORDER_DOCUMENT_FIELD_GROUP_IDS) {
    for (const row of resolveOrderDocumentFieldRows(input.template, group)) {
      addTarget({ kind: 'field_row', group, rowId: row.id });
    }
  }
  const contactsRowTarget = {
    kind: 'field_row',
    group: 'company',
    rowId: 'contacts'
  } as const satisfies OrderDocumentTypographyTarget;
  for (const contact of resolveOrderDocumentCompanyContacts(input.template)) {
    const contactTarget = {
      kind: 'company_contact',
      contactId: contact.id
    } as const satisfies OrderDocumentTypographyTarget;
    addTarget(contactTarget);
    addTarget([contactsRowTarget, contactTarget]);
  }
  const table = resolveOrderDocumentTable(input.template);
  addTarget({ kind: 'table_header' });
  addTarget({ kind: 'table_body' });
  const rowTargets = input.items.map((_, index) => ({
    kind: 'table_row',
    rowNumber: index + 1
  } as const satisfies OrderDocumentTypographyTarget));
  for (const column of table.columns) {
    const columnTarget = {
      kind: 'table_column',
      columnId: column.id
    } as const satisfies OrderDocumentTypographyTarget;
    addTarget(columnTarget);
    addTarget({ kind: 'table_header_cell', columnId: column.id });
    for (const rowTarget of rowTargets) {
      addTarget({
        kind: 'table_cell',
        columnId: column.id,
        rowNumber: rowTarget.rowNumber
      });
    }
  }
  for (const rowTarget of rowTargets) addTarget(rowTarget);
  return required;
}

async function loadOrderPdfFonts(doc: PDFDocument, input: GenerateOrderPdfInput) {
  doc.registerFontkit(fontkit);
  const fonts = await loadFontsFromPublic(requiredOrderPdfFontFaceKeys(input));
  const embedded: OrderPdfFontRegistry = new Map();
  await Promise.all([...fonts.entries()].map(async ([key, bytes]) => {
    embedded.set(key, await doc.embedFont(bytes, { subset: false }));
  }));
  return embedded;
}

async function loadDocumentLogo(
  doc: PDFDocument,
  artwork: Uint8Array | null | undefined
): Promise<PDFImage | null> {
  if (artwork === null) return null;
  const logoBytes = artwork ?? await readFileIfExists(
    path.join(process.cwd(), 'public', 'brand', 'atehna-document-wordmark.png')
  );
  if (!logoBytes) throw new Error('Required ATEHNA document logo asset is missing.');
  return doc.embedPng(logoBytes);
}

function splitLongToken(font: PDFFont, token: string, size: number, width: number) {
  const chunks: string[] = [];
  let current = '';
  for (const character of token) {
    const candidate = `${current}${character}`;
    if (current && font.widthOfTextAtSize(candidate, size) > width) {
      chunks.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function wrapText(font: PDFFont, value: unknown, size: number, width: number) {
  const paragraphs = toSafeText(value).split('\n');
  const lines: string[] = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const words = paragraph.split(/\s+/u).filter(Boolean).flatMap((word) =>
      font.widthOfTextAtSize(word, size) > width
        ? splitLongToken(font, word, size, width)
        : [word]
    );
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && font.widthOfTextAtSize(candidate, size) > width) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    if (!current && !paragraph) lines.push('');
    if (paragraphIndex < paragraphs.length - 1 && lines.at(-1) !== '') lines.push('');
  });
  return lines.length > 0 ? lines : [''];
}

function clampText(font: PDFFont, value: unknown, size: number, width: number) {
  const text = toSafeText(value).replace(/\n/gu, ' ');
  if (!text) return '';
  if (font.widthOfTextAtSize(text, size) <= width) return text;
  let result = text;
  while (result.length > 1 && font.widthOfTextAtSize(`${result}...`, size) > width) {
    result = result.slice(0, -1);
  }
  return `${result}...`;
}

function fitTextSize(
  font: PDFFont,
  value: unknown,
  size: number,
  width: number,
  minimumSize = 5
) {
  const text = toSafeText(value).replace(/\n/gu, ' ');
  if (!text) return size;
  const textWidth = font.widthOfTextAtSize(text, size);
  if (textWidth <= width) return size;
  return Math.max(
    minimumSize,
    Math.min(size, size * Math.max(1, width - 0.5) / textWidth)
  );
}

type Column = {
  key: OrderDocumentTableColumnId;
  label: string;
  width: number;
  align: 'left' | 'right';
};

type SemanticPdfRow = {
  id: OrderDocumentFieldRowId;
  label: string;
  value: string;
  bold?: boolean;
};

type SemanticTotalRow = {
  id: OrderDocumentFieldRowId;
  label: string;
  value: number;
  bold?: boolean;
};

type ActiveCanvasFrame = {
  element: OrderDocumentCanvasElement;
  x: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

type PdfDecorationFrame = Pick<
  ActiveCanvasFrame,
  'x' | 'top' | 'width' | 'height' | 'right' | 'bottom'
>;

export type OrderDocumentPdfTextBoxAlignment = 'left' | 'center' | 'right' | 'justify';

export type OrderDocumentPdfTextBoxLine = {
  x: number;
  y: number;
};

export type OrderDocumentPdfNaturalRowGeometry = {
  baseline: number;
  top: number;
};

export type OrderDocumentPdfTableRuleSegment = {
  start: { x: number; y: number };
  end: { x: number; y: number };
};

/** Pure table-grid geometry shared by renderer tests and page-segment drawing. */
export function resolveOrderDocumentPdfTableRuleSegments(input: {
  x: number;
  top: number;
  bottom: number;
  columnWidths: readonly number[];
  borders: Pick<
    ResolvedOrderDocumentTableBorders,
    'outer' | 'horizontal' | 'vertical'
  >;
  outerTop?: boolean;
  outerBottom?: boolean;
  horizontalTop?: boolean;
  horizontalBottom?: boolean;
}): OrderDocumentPdfTableRuleSegment[] {
  const width = input.columnWidths.reduce((sum, value) => sum + value, 0);
  const right = input.x + width;
  const segments: OrderDocumentPdfTableRuleSegment[] = [];
  const horizontalY = new Set<number>();
  const addHorizontal = (y: number) => {
    if (horizontalY.has(y)) return;
    horizontalY.add(y);
    segments.push({ start: { x: input.x, y }, end: { x: right, y } });
  };
  if (input.borders.outer) {
    segments.push(
      { start: { x: input.x, y: input.bottom }, end: { x: input.x, y: input.top } },
      { start: { x: right, y: input.bottom }, end: { x: right, y: input.top } }
    );
    if (input.outerTop) addHorizontal(input.top);
    if (input.outerBottom) addHorizontal(input.bottom);
  }
  if (input.borders.vertical) {
    let boundary = input.x;
    for (const columnWidth of input.columnWidths.slice(0, -1)) {
      boundary += columnWidth;
      segments.push({
        start: { x: boundary, y: input.bottom },
        end: { x: boundary, y: input.top }
      });
    }
  }
  if (input.borders.horizontal) {
    if (input.horizontalTop) addHorizontal(input.top);
    if (input.horizontalBottom) addHorizontal(input.bottom);
  }
  return segments;
}

export function resolveOrderDocumentPdfJustifiedWordLayout(input: {
  x: number;
  width: number;
  wordWidths: readonly number[];
}): number[] {
  if (input.wordWidths.length === 0) return [];
  if (input.wordWidths.length === 1) return [input.x];
  const wordsWidth = input.wordWidths.reduce((sum, width) => sum + width, 0);
  const gap = Math.max(0, input.width - wordsWidth) / (input.wordWidths.length - 1);
  let cursor = input.x;
  return input.wordWidths.map((wordWidth) => {
    const x = cursor;
    cursor += wordWidth + gap;
    return x;
  });
}

const resolvedSingleTextAlignment = (
  alignment: OrderDocumentResolvedTextAlignment,
  distributedFallback: OrderDocumentPdfTextBoxAlignment = 'left'
): OrderDocumentPdfTextBoxAlignment => (
  alignment === 'distributed' ? distributedFallback : alignment
);

export function resolveOrderDocumentPdfAlignedTextX(input: {
  x: number;
  width: number;
  textWidth: number;
  alignment: OrderDocumentResolvedTextAlignment;
  distributedFallback?: OrderDocumentPdfTextBoxAlignment;
}) {
  const alignment = resolvedSingleTextAlignment(
    input.alignment,
    input.distributedFallback
  );
  if (alignment === 'right') return input.x + input.width - input.textWidth;
  if (alignment === 'center') return input.x + (input.width - input.textWidth) / 2;
  return input.x;
}

/**
 * Aligns visible glyph ink, rather than the font's advance box, to a right
 * content anchor. This removes weight-dependent euro side-bearing drift while
 * leaving the financial column geometry unchanged.
 */
export function resolveOrderDocumentPdfOpticalRightAlignedTextX(input: {
  right: number;
  advanceWidth: number;
  rightSideBearing: number;
}) {
  return input.right - input.advanceWidth + input.rightSideBearing;
}

/** Aligns the first visible glyph edge to a left content anchor. */
export function resolveOrderDocumentPdfOpticalLeftAlignedTextX(input: {
  left: number;
  leftSideBearing: number;
}) {
  return input.left - input.leftSideBearing;
}

/**
 * Aligns each side inside its established financial/metadata column. Explicit
 * alignment never collapses the label and value into one packed string.
 */
export function resolveOrderDocumentPdfPairedTextLayout(input: {
  x: number;
  width: number;
  labelWidth: number;
  valueWidth: number;
  labelColumnRatio: number;
  alignment: OrderDocumentResolvedTextAlignment;
}) {
  const ratio = Math.max(0.05, Math.min(0.95, input.labelColumnRatio));
  const labelColumnWidth = input.width * ratio;
  const valueColumnX = input.x + labelColumnWidth;
  const valueColumnWidth = input.width - labelColumnWidth;
  const labelAlignment = input.alignment === 'distributed' ? 'left' : input.alignment;
  const valueAlignment = input.alignment === 'distributed' ? 'right' : input.alignment;
  return {
    labelX: resolveOrderDocumentPdfAlignedTextX({
      x: input.x,
      width: labelColumnWidth,
      textWidth: input.labelWidth,
      alignment: labelAlignment
    }),
    valueX: resolveOrderDocumentPdfAlignedTextX({
      x: valueColumnX,
      width: valueColumnWidth,
      textWidth: input.valueWidth,
      alignment: valueAlignment
    })
  };
}

/**
 * Keeps the renderer's established baseline cursor for ordinary text while
 * shifting only the rows whose visible boxes would intersect a sibling box.
 */
export function resolveOrderDocumentPdfNaturalRowGeometry(input: {
  desiredBaseline: number;
  frameTopOffset: number;
  collisionTopOffset?: number;
  previousFrameBottom?: number;
  preventOverlap: boolean;
}): OrderDocumentPdfNaturalRowGeometry {
  const desiredCollisionTop = input.desiredBaseline
    + (input.collisionTopOffset ?? input.frameTopOffset);
  const overlap = input.preventOverlap && input.previousFrameBottom != null
    ? Math.max(0, desiredCollisionTop - input.previousFrameBottom)
    : 0;
  const baseline = input.desiredBaseline - overlap;
  return {
    baseline,
    top: baseline + input.frameTopOffset
  };
}

/**
 * Positions a complete line block inside an already-inset decoration frame.
 * The measured glyph height, rather than the nominal font size, makes the
 * visible top and bottom whitespace equal. Horizontal placement is resolved
 * per line so existing left/center/right layouts remain intact.
 */
export function resolveOrderDocumentPdfTextBoxLayout(input: {
  content: Pick<PdfDecorationFrame, 'x' | 'bottom' | 'width' | 'height'>;
  lineWidths: readonly number[];
  textAscentPt: number;
  textDescentPt: number;
  lineHeightPt: number;
  alignment: OrderDocumentPdfTextBoxAlignment;
}): OrderDocumentPdfTextBoxLine[] {
  if (input.lineWidths.length === 0) return [];
  const textAscent = Math.max(0, input.textAscentPt);
  const textDescent = Math.max(0, input.textDescentPt);
  const glyphHeight = textAscent + textDescent;
  const lineHeight = Math.max(glyphHeight, input.lineHeightPt);
  const blockHeight = glyphHeight + (input.lineWidths.length - 1) * lineHeight;
  const freeHeight = Math.max(0, input.content.height - blockHeight);
  const firstBaseline = input.content.bottom
    + input.content.height
    - freeHeight / 2
    - textAscent;
  return input.lineWidths.map((lineWidth, index) => ({
    x: input.alignment === 'right'
      ? input.content.x + input.content.width - lineWidth
      : input.alignment === 'center'
        ? input.content.x + (input.content.width - lineWidth) / 2
        : input.content.x,
    y: firstBaseline - index * lineHeight
  }));
}

class OrderPdfRenderer {
  private page!: PDFPage;
  private y = 0;
  private readonly defaultMargin: number;
  private readonly defaultContentWidth: number;
  private readonly defaultFooterReserve: number;
  private readonly canvas;
  private readonly table;
  private readonly tableBorders: ResolvedOrderDocumentTableBorders;
  private readonly canvasMode: boolean;
  private activeCanvasFrame: ActiveCanvasFrame | null = null;
  private activeCanvasElement: OrderDocumentCanvasElement | null = null;

  constructor(
    private readonly doc: PDFDocument,
    private readonly fonts: OrderPdfFontRegistry,
    private readonly logoImage: PDFImage | null,
    private readonly input: GenerateOrderPdfInput
  ) {
    this.defaultMargin = mm(input.template.style.marginMm);
    this.defaultContentWidth = A4_WIDTH - this.defaultMargin * 2;
    this.canvas = resolveOrderDocumentCanvas(input.template);
    this.table = resolveOrderDocumentTable(input.template);
    this.tableBorders = resolveOrderDocumentTableBorders(input.template, this.table);
    this.canvasMode = Object.keys(input.template.layout.canvas?.elements ?? {}).length > 0
      || (input.template.layout.canvas?.deletedElementIds?.length ?? 0) > 0;
    this.defaultFooterReserve = (
      this.canvasMode ? this.canvas.elements.footer.visible : input.template.layout.showFooter
    ) ? 45 : 18;
  }

  private get font() {
    const font = this.fonts.get(fontFaceKey('noto_sans', 'regular', 'normal'));
    if (!font) throw new Error('Required Noto Sans Regular PDF font was not embedded.');
    return font;
  }

  private get fontBold() {
    const font = this.fonts.get(fontFaceKey('noto_sans', 'bold', 'normal'));
    if (!font) throw new Error('Required Noto Sans Bold PDF font was not embedded.');
    return font;
  }

  private fontFor(typography: OrderDocumentTypography) {
    return this.fonts.get(fontFaceKey(
      typography.fontFamily,
      typography.fontWeight,
      typography.fontStyle
    )) ?? (
      typography.fontWeight === 'bold' || typography.fontWeight === 'semibold'
        ? this.fontBold
        : this.font
    );
  }

  private textStyle(
    target: OrderDocumentTypographyTarget | readonly OrderDocumentTypographyTarget[],
    fallbackOverride: OrderDocumentTypographyOverride = {}
  ) {
    const targets = Array.isArray(target) ? target : [target];
    const firstTarget = targets[0] as OrderDocumentTypographyTarget | undefined;
    const fallback = firstTarget
      ? { ...getDefaultOrderDocumentTypography(this.input.template, firstTarget), ...fallbackOverride }
      : { ...DEFAULT_ORDER_DOCUMENT_TYPOGRAPHY, ...fallbackOverride };
    const typography = resolveOrderDocumentTypography(this.input.template, targets, fallback);
    return { typography, font: this.fontFor(typography), size: typography.fontSizePt };
  }

  private textAlignment(
    target: OrderDocumentTextAlignmentTarget
      | readonly OrderDocumentTextAlignmentTarget[],
    fallback?: OrderDocumentResolvedTextAlignment
  ) {
    return resolveOrderDocumentTextAlignment(this.input.template, target, fallback);
  }

  private singleTextAlignment(
    target: OrderDocumentTextAlignmentTarget
      | readonly OrderDocumentTextAlignmentTarget[],
    distributedFallback: OrderDocumentPdfTextBoxAlignment = 'left'
  ) {
    return resolvedSingleTextAlignment(
      this.textAlignment(target),
      distributedFallback
    );
  }

  private get margin() {
    return this.activeCanvasFrame?.x ?? this.defaultMargin;
  }

  private get contentWidth() {
    return this.activeCanvasFrame?.width ?? this.defaultContentWidth;
  }

  private get contentRight() {
    return this.activeCanvasFrame?.right ?? A4_WIDTH - this.defaultMargin;
  }

  private get footerReserve() {
    return this.activeCanvasFrame ? 0 : this.defaultFooterReserve;
  }

  private get style() {
    const base = this.input.template.style;
    const element = this.activeCanvasElement;
    if (!element) return base;
    return {
      ...base,
      textColor: element.textColor || base.textColor,
      mutedTextColor: element.mutedTextColor || base.mutedTextColor,
      lineColor: element.borderColor || base.lineColor,
      accentColor: element.accentColor || base.accentColor
    };
  }

  private get labels() {
    return this.input.template.text.labels;
  }

  private get documentContext(): OrderDocumentPreviewContext {
    return {
      type: this.input.type,
      order: this.input.order,
      items: this.input.items,
      documentNumber: this.input.documentNumber,
      issuedAt: this.input.issuedAt
    };
  }

  private fieldRows(group: OrderDocumentFieldGroupId) {
    return resolveOrderDocumentFieldRows(this.input.template, group)
      .filter((row) => row.visible);
  }

  private fieldRow(
    group: OrderDocumentFieldGroupId,
    rowId: OrderDocumentFieldRowId
  ) {
    return this.fieldRows(group).find((row) => row.id === rowId);
  }

  private fieldRowPlacement(
    group: OrderDocumentFieldGroupId,
    rowId: OrderDocumentFieldRowId
  ): OrderDocumentFieldRowPlacement | undefined {
    return this.fieldRow(group, rowId)?.placement;
  }

  private decorationFrame(
    placement: OrderDocumentFieldRowPlacement | undefined,
    baseX: number,
    baseTop: number,
    baseWidth: number,
    defaultHeight: number
  ): PdfDecorationFrame {
    const x = Math.max(0, baseX + mm(placement?.xMm ?? 0));
    const top = Math.min(A4_HEIGHT, baseTop - mm(placement?.yMm ?? 0));
    const width = Math.max(
      1,
      Math.min(
        placement?.widthMm == null ? baseWidth : mm(placement.widthMm),
        A4_WIDTH - x
      )
    );
    const height = Math.max(
      1,
      Math.min(
        placement?.heightMm == null ? defaultHeight : mm(placement.heightMm),
        top
      )
    );
    return {
      x,
      top,
      width,
      height,
      right: x + width,
      bottom: top - height
    };
  }

  private drawDecorationBox(
    decoration: OrderDocumentDecoration,
    frame: Pick<PdfDecorationFrame, 'x' | 'bottom' | 'width' | 'height'>,
    outlineOnly = false
  ) {
    const right = frame.x + frame.width;
    const top = frame.bottom + frame.height;
    if (!outlineOnly) {
      if (decoration.fillEnabled) {
        this.page.drawRectangle({
          x: frame.x,
          y: frame.bottom,
          width: frame.width,
          height: frame.height,
          color: colorFromHex(decoration.fillColor)
        });
      }
      if (decoration.accentEnabled) {
        const thickness = Math.min(
          decoration.accentWidthPt,
          decoration.accentSide === 'left' || decoration.accentSide === 'right'
            ? frame.width
            : frame.height
        );
        const accentRect = decoration.accentSide === 'left'
          ? { x: frame.x, y: frame.bottom, width: thickness, height: frame.height }
          : decoration.accentSide === 'right'
            ? { x: right - thickness, y: frame.bottom, width: thickness, height: frame.height }
            : decoration.accentSide === 'top'
              ? { x: frame.x, y: top - thickness, width: frame.width, height: thickness }
              : { x: frame.x, y: frame.bottom, width: frame.width, height: thickness };
        this.page.drawRectangle({
          ...accentRect,
          color: colorFromHex(decoration.accentColor)
        });
      }
      return;
    }
    if (!decoration.outlineEnabled || decoration.outlineSides.length === 0) return;
    const sideLine = (side: OrderDocumentDecorationSide) => {
      const points = side === 'left'
        ? [{ x: frame.x, y: frame.bottom }, { x: frame.x, y: top }]
        : side === 'right'
          ? [{ x: right, y: frame.bottom }, { x: right, y: top }]
          : side === 'top'
            ? [{ x: frame.x, y: top }, { x: right, y: top }]
            : [{ x: frame.x, y: frame.bottom }, { x: right, y: frame.bottom }];
      this.page.drawLine({
        start: points[0]!,
        end: points[1]!,
        thickness: decoration.outlineWidthPt,
        color: colorFromHex(decoration.outlineColor)
      });
    };
    decoration.outlineSides.forEach(sideLine);
  }

  private rowDecoration(
    group: OrderDocumentFieldGroupId,
    rowId: OrderDocumentFieldRowId
  ) {
    return resolveOrderDocumentDecoration(this.input.template, {
      kind: 'field_row',
      group,
      rowId
    });
  }

  private rowContentFrame(frame: PdfDecorationFrame, decoration: OrderDocumentDecoration) {
    const inset = resolveOrderDocumentDecorationInset(decoration);
    const leftAccent = decoration.accentEnabled && decoration.accentSide === 'left'
      ? decoration.accentWidthPt
      : 0;
    const rightAccent = decoration.accentEnabled && decoration.accentSide === 'right'
      ? decoration.accentWidthPt
      : 0;
    const topAccent = decoration.accentEnabled && decoration.accentSide === 'top'
      ? decoration.accentWidthPt
      : 0;
    const bottomAccent = decoration.accentEnabled && decoration.accentSide === 'bottom'
      ? decoration.accentWidthPt
      : 0;
    const left = inset + leftAccent;
    const right = inset + rightAccent;
    const top = inset + topAccent;
    const bottom = inset + bottomAccent;
    return {
      x: frame.x + left,
      top: frame.top - top,
      width: Math.max(1, frame.width - left - right),
      height: Math.max(1, frame.height - top - bottom),
      bottom: frame.bottom + bottom
    };
  }

  private rowHorizontalInsets(decoration: OrderDocumentDecoration) {
    const inset = resolveOrderDocumentDecorationInset(decoration);
    return {
      left: inset + (
        decoration.accentEnabled && decoration.accentSide === 'left'
          ? decoration.accentWidthPt
          : 0
      ),
      right: inset + (
        decoration.accentEnabled && decoration.accentSide === 'right'
          ? decoration.accentWidthPt
          : 0
      )
    };
  }

  private measuredDecorationWidth(
    contentWidth: number,
    decoration: OrderDocumentDecoration,
    maximumWidth: number
  ) {
    const horizontalAccent = decoration.accentEnabled
      && (decoration.accentSide === 'left' || decoration.accentSide === 'right')
      ? decoration.accentWidthPt
      : 0;
    const inset = resolveOrderDocumentDecorationInset(decoration);
    return Math.max(1, Math.min(
      maximumWidth,
      contentWidth + inset * 2 + horizontalAccent
    ));
  }

  private boxedTextLayout(
    content: ReturnType<OrderPdfRenderer['rowContentFrame']>,
    decoration: OrderDocumentDecoration,
    font: PDFFont,
    size: number,
    lineHeight: number,
    lineWidths: readonly number[],
    alignment: OrderDocumentPdfTextBoxAlignment = 'left'
  ) {
    if (!hasOrderDocumentBoxDecoration(decoration)) return null;
    return resolveOrderDocumentPdfTextBoxLayout({
      content,
      lineWidths,
      textAscentPt: font.heightAtSize(size, { descender: false }),
      textDescentPt: Math.max(
        0,
        font.heightAtSize(size) - font.heightAtSize(size, { descender: false })
      ),
      lineHeightPt: lineHeight,
      alignment
    });
  }

  private drawAlignedTextLine(
    value: string,
    options: {
      x: number;
      width: number;
      y: number;
      size: number;
      font: PDFFont;
      color: RGB;
      alignment: OrderDocumentPdfTextBoxAlignment;
      justify?: boolean;
    }
  ) {
    if (options.alignment === 'justify' && options.justify) {
      const words = value.trim().split(/\s+/u).filter(Boolean);
      const wordWidths = words.map((word) => options.font.widthOfTextAtSize(
        word,
        options.size
      ));
      const wordsWidth = wordWidths.reduce((sum, width) => sum + width, 0);
      if (words.length > 1 && wordsWidth <= options.width) {
        const positions = resolveOrderDocumentPdfJustifiedWordLayout({
          x: options.x,
          width: options.width,
          wordWidths
        });
        words.forEach((word, index) => {
          this.page.drawText(word, {
            x: positions[index]!,
            y: options.y,
            size: options.size,
            font: options.font,
            color: options.color
          });
        });
        return;
      }
    }
    this.page.drawText(value, {
      x: resolveOrderDocumentPdfAlignedTextX({
        x: options.x,
        width: options.width,
        textWidth: options.font.widthOfTextAtSize(value, options.size),
        alignment: options.alignment
      }),
      y: options.y,
      size: options.size,
      font: options.font,
      color: options.color
    });
  }

  private orderSemanticRows(
    group: OrderDocumentFieldGroupId,
    candidates: readonly SemanticPdfRow[]
  ) {
    const byId = new Map<OrderDocumentFieldRowId, SemanticPdfRow[]>();
    for (const candidate of candidates) {
      byId.set(candidate.id, [...(byId.get(candidate.id) ?? []), candidate]);
    }
    return this.fieldRows(group).flatMap((row) => byId.get(row.id) ?? []);
  }

  private matchesElementCondition(element: OrderDocumentCanvasElement) {
    return matchesOrderDocumentElementCondition(element, this.documentContext);
  }

  private shouldRenderElement(element: OrderDocumentCanvasElement, pageNumber = 1) {
    if (!element.visible || !this.matchesElementCondition(element)) return false;
    return element.repeat === 'every_page' || element.page === pageNumber;
  }

  private resolve(value: string) {
    return resolveOrderDocumentPreviewText(
      value,
      this.input.template,
      this.documentContext
    );
  }
  private ensureCanvasPage(pageNumber: number) {
    while (this.doc.getPageCount() < pageNumber) {
      const page = this.doc.addPage([A4_WIDTH, A4_HEIGHT]);
      page.drawRectangle({
        x: 0,
        y: 0,
        width: A4_WIDTH,
        height: A4_HEIGHT,
        color: colorFromHex(this.input.template.style.pageBackground)
      });
    }
    return this.doc.getPages()[pageNumber - 1]!;
  }

  private drawCanvasElementBox(
    element: OrderDocumentCanvasElement,
    frame: Pick<ActiveCanvasFrame, 'x' | 'bottom' | 'width' | 'height'>,
    borderOnly = false
  ) {
    this.drawDecorationBox(
      resolveOrderDocumentDecoration(this.input.template, {
        kind: 'element',
        elementId: element.id
      }),
      frame,
      borderOnly
    );
  }

  private renderCanvasChildInBox(
    element: OrderDocumentCanvasElement,
    frame: Pick<ActiveCanvasFrame, 'x' | 'bottom' | 'width' | 'height'>,
    draw: () => void
  ) {
    const previousElement = this.activeCanvasElement;
    this.activeCanvasElement = element;
    this.drawCanvasElementBox(element, frame);
    try {
      draw();
    } finally {
      this.drawCanvasElementBox(element, frame, true);
      this.activeCanvasElement = previousElement;
    }
  }

  private renderAbsoluteCanvasElement(
    element: OrderDocumentCanvasElement,
    draw: () => void,
    pageNumber = element.page
  ) {
    const previousPage = this.page;
    const previousY = this.y;
    const previousFrame = this.activeCanvasFrame;
    const previousElement = this.activeCanvasElement;
    const page = this.ensureCanvasPage(pageNumber);
    const x = mm(element.xMm);
    const top = A4_HEIGHT - mm(element.yMm);
    const width = mm(element.widthMm);
    const height = mm(element.heightMm);
    const frame: ActiveCanvasFrame = {
      element,
      x,
      top,
      width,
      height,
      right: x + width,
      bottom: top - height
    };

    this.page = page;
    this.activeCanvasFrame = frame;
    this.activeCanvasElement = element;
    const textLedElement = (
      element.id === 'intro'
      || element.id === 'totals'
      || element.id === 'notes'
      || element.id === 'closing'
    );
    const elementFontSize = this.textStyle({ kind: 'element', elementId: element.id }).size;
    this.y = top - (textLedElement ? elementFontSize + 1 : 0);
    this.drawCanvasElementBox(element, frame);
    const clipped = element.overflow === 'clip';
    if (clipped) {
      this.page.pushOperators(
        pushGraphicsState(),
        rectangle(frame.x, frame.bottom, frame.width, frame.height),
        clip(),
        endPath()
      );
    }
    try {
      draw();
    } finally {
      if (clipped) this.page.pushOperators(popGraphicsState());
      this.drawCanvasElementBox(element, frame, true);
      this.page = previousPage;
      this.y = previousY;
      this.activeCanvasFrame = previousFrame;
      this.activeCanvasElement = previousElement;
    }
  }

  private renderFlowCanvasElement(
    element: OrderDocumentCanvasElement,
    draw: () => void
  ) {
    const previousElement = this.activeCanvasElement;
    this.activeCanvasElement = element;
    const naturalHeight = mm(estimateOrderDocumentFlowElementHeightMm(
      this.input.template,
      this.documentContext,
      element.id,
      this.contentWidth / MM_TO_PT
    ));
    const decoration = resolveOrderDocumentDecoration(this.input.template, {
      kind: 'element',
      elementId: element.id
    });
    const hasDecoration = decoration.fillEnabled
      || decoration.accentEnabled
      || (decoration.outlineEnabled && decoration.outlineSides.length > 0);
    const theoreticalPageCapacity = A4_HEIGHT
      - this.defaultMargin * 2
      - this.defaultFooterReserve;
    const sectionDrawReserve = element.id === 'items'
      ? 60
      : element.id === 'totals'
        ? 50
        : element.id === 'notes'
          ? 48
          : element.id === 'signatures'
            ? 65
            : element.id === 'closing'
              ? naturalHeight + 24
              : naturalHeight + 8;

    // A flow-owned box can only be painted safely when its estimated natural
    // content fits on one page. For genuinely paginated sections (normally a
    // long items table), suppress the enclosing element box: drawing one large
    // fill before pagination, or its outline on the final page afterwards,
    // would overpaint unrelated content. Table/row decorations remain intact.
    if (
      hasDecoration
      && naturalHeight > 0
      && naturalHeight + ORDER_DOCUMENT_FLOW_SECTION_GAP_PT <= theoreticalPageCapacity
    ) {
      this.ensureSpace(Math.max(
        sectionDrawReserve,
        naturalHeight + ORDER_DOCUMENT_FLOW_SECTION_GAP_PT
      ));
    }

    const availableHeight = this.y - (this.defaultMargin + this.defaultFooterReserve);
    const canPaintSinglePageFrame = hasDecoration
      && naturalHeight > 0
      && naturalHeight + ORDER_DOCUMENT_FLOW_SECTION_GAP_PT <= availableHeight;
    // The estimators include the final line/row leading. Keep the enclosing
    // decoration just inside that trailing space so its bottom edge cannot
    // touch the next section's first glyph while the content flow stays at the
    // established compact eight-point gap.
    const decorationHeight = Math.max(
      1,
      naturalHeight - FLOW_DECORATION_BOTTOM_INSET_PT
    );
    const frame = canPaintSinglePageFrame
      ? {
          x: this.margin,
          bottom: this.y - decorationHeight,
          width: this.contentWidth,
          height: decorationHeight
        }
      : null;
    const framePage = frame ? this.page : null;
    if (frame) this.drawCanvasElementBox(element, frame);
    try {
      draw();
    } finally {
      // The shared estimator is deliberately conservative. If content still
      // paginates, never draw the closing outline on a different page.
      if (frame && this.page === framePage) {
        this.drawCanvasElementBox(element, frame, true);
      }
      this.activeCanvasElement = previousElement;
    }
  }


  private startPage(continuation = false) {
    this.page = this.doc.addPage([A4_WIDTH, A4_HEIGHT]);
    this.page.drawRectangle({
      x: 0,
      y: 0,
      width: A4_WIDTH,
      height: A4_HEIGHT,
      color: colorFromHex(this.style.pageBackground)
    });
    const pageNumber = this.doc.getPageCount();
    const header = this.canvas.elements.header;
    const headerVisible = this.canvasMode
      ? this.shouldRenderElement(header, pageNumber)
      : this.input.template.layout.showHeader;
    this.y = A4_HEIGHT - (headerVisible ? mm(10) : this.defaultMargin);
    if (this.canvasMode && headerVisible) {
      const headerBottom = header.positioning === 'absolute'
        ? A4_HEIGHT - mm(header.yMm + header.heightMm)
        : this.y - mm(this.input.template.style.headerHeightMm);
      this.y = headerBottom - mm(continuation ? 7 : 18);
    } else if (headerVisible) {
      this.drawHeader(continuation);
    }
    if (continuation) {
      const target = { kind: 'element', elementId: 'header' } as const;
      const continuationStyle = this.textStyle(
        target,
        { fontWeight: 'bold', fontSizePt: this.style.smallSizePt }
      );
      const label = clampText(
        continuationStyle.font,
        `${this.input.template.text.title}  ${this.input.documentNumber}`,
        continuationStyle.size,
        this.contentWidth
      );
      this.page.drawText(label, {
        x: resolveOrderDocumentPdfAlignedTextX({
          x: this.margin,
          width: this.contentWidth,
          textWidth: continuationStyle.font.widthOfTextAtSize(
            label,
            continuationStyle.size
          ),
          alignment: this.singleTextAlignment(target)
        }),
        y: this.y,
        size: continuationStyle.size,
        font: continuationStyle.font,
        color: colorFromHex(this.style.mutedTextColor)
      });
      this.y -= continuationStyle.size + 10;
    }
  }

  private drawHeaderLogo(x: number, top: number, width: number, height: number) {
    if (!this.logoImage) return;
    const sourceWidth = this.logoImage.width;
    const sourceHeight = this.logoImage.height;
    const placement = this.input.logoConfig!.placements['pdf-document'];
    const geometry = resolveSiteLogoGeometry(placement);
    const fitted = resolveSiteLogoFittedArtworkRect({
      sourceWidth,
      sourceHeight,
      viewportWidth: width,
      viewportHeight: height,
      geometry,
      fitMode: placement.fitMode,
      artworkScale: geometry.scale
    });
    const imageX = x + fitted.left;
    const imageTop = top - fitted.top;
    const bottom = top - height;

    this.page.pushOperators(
      pushGraphicsState(),
      rectangle(x, bottom, width, height),
      clip(),
      endPath()
    );
    this.page.drawImage(this.logoImage, {
      x: imageX,
      y: imageTop - fitted.height,
      width: fitted.width,
      height: fitted.height
    });
    this.page.pushOperators(popGraphicsState());
  }

  private drawHeaderCompany(x: number, top: number, width: number) {
    const company = this.input.template.company;
    const contactsRowTarget: OrderDocumentTypographyTarget = {
      kind: 'field_row',
      group: 'company',
      rowId: 'contacts'
    };
    const contactLines = resolveOrderDocumentCompanyContacts(this.input.template)
      .filter((contact) => contact.visible && Boolean(toSafeText(contact.value)))
      .map((contact) => {
        const label = toSafeText(contact.label).replace(/:\s*$/u, '');
        const value = toSafeText(contact.value);
        return {
          text: label ? label + ': ' + value : value,
          emphasis: contact.emphasis,
          targets: [
            contactsRowTarget,
            { kind: 'company_contact', contactId: contact.id } as const
          ]
        };
      });
    const companyBlocks = this.fieldRows('company').map((row) => {
      const targets: readonly OrderDocumentTypographyTarget[] = [{
        kind: 'field_row',
        group: 'company',
        rowId: row.id
      }];
      if (row.id === 'company_name') {
        return { row, lines: [{ text: toSafeText(company.name), emphasis: false, targets }] };
      }
      if (row.id === 'address_line_1') {
        return { row, lines: [{ text: toSafeText(company.addressLine1), emphasis: false, targets }] };
      }
      if (row.id === 'address_line_2') {
        return { row, lines: [{ text: toSafeText(company.addressLine2), emphasis: false, targets }] };
      }
      if (row.id === 'contacts') return { row, lines: contactLines };
      return { row, lines: [] };
    }).map((block) => ({
      ...block,
      lines: block.lines.filter((line) => Boolean(line.text))
    })).filter((block) => block.lines.length > 0);
    const ownerTop = top;
    let companyY = top;
    let previousNaturalBoundary: { bottom: number; boxed: boolean } | null = null;
    companyBlocks.forEach((block) => {
      const renderedLines = block.lines.map((line) => {
        const textStyle = this.textStyle(line.targets, {
          fontWeight: line.emphasis ? 'bold' : 'regular',
          fontSizePt: this.style.smallSizePt
        });
        return {
          ...line,
          ...textStyle,
          alignment: this.singleTextAlignment(line.targets, 'right')
        };
      });
      const decoration = this.rowDecoration('company', block.row.id);
      const boxed = hasOrderDocumentBoxDecoration(decoration);
      const placement = block.row.placement;
      const naturalHeight = renderedLines.reduce(
        (height, line) => height + line.size + Math.max(1.8, line.size * 0.22),
        resolveOrderDocumentDecorationInset(decoration) * 2
      );
      const frameBaseWidth = placement?.widthMm == null
        ? this.measuredDecorationWidth(
            Math.max(...renderedLines.map((line) =>
              line.font.widthOfTextAtSize(line.text, line.size)
            )),
            decoration,
            width
          )
        : width;
      const firstLine = renderedLines[0]!;
      const naturalTopOffset = firstLine.size + resolveOrderDocumentDecorationInset(decoration);
      const naturalGeometry: OrderDocumentPdfNaturalRowGeometry | null = placement
        ? null
        : resolveOrderDocumentPdfNaturalRowGeometry({
            desiredBaseline: companyY - naturalTopOffset,
            frameTopOffset: naturalTopOffset,
            collisionTopOffset: boxed
              ? naturalTopOffset
              : firstLine.font.heightAtSize(firstLine.size, { descender: false }),
            previousFrameBottom: previousNaturalBoundary?.bottom,
            preventOverlap: boxed || Boolean(previousNaturalBoundary?.boxed)
          });
      const frame: PdfDecorationFrame = placement
        ? this.decorationFrame(placement, x, ownerTop, frameBaseWidth, naturalHeight)
        : this.decorationFrame(undefined, x, naturalGeometry!.top, width, naturalHeight);
      const content = this.rowContentFrame(frame, decoration);
      const safeLines = renderedLines.map((line) => {
        const text = clampText(line.font, line.text, line.size, content.width);
        return {
          ...line,
          text,
          width: line.font.widthOfTextAtSize(text, line.size)
        };
      });
      const boxedLayout = boxed
        ? resolveOrderDocumentPdfTextBoxLayout({
            content,
            lineWidths: safeLines.map((line) => line.width),
            textAscentPt: Math.max(...safeLines.map((line) =>
              line.font.heightAtSize(line.size, { descender: false })
            )),
            textDescentPt: Math.max(...safeLines.map((line) => Math.max(
              0,
              line.font.heightAtSize(line.size)
                - line.font.heightAtSize(line.size, { descender: false })
            ))),
            lineHeightPt: Math.max(...safeLines.map((line) =>
              line.size + Math.max(1.8, line.size * 0.22)
            )),
            alignment: 'left'
          })
        : null;
      let baseline = content.top;
      this.drawDecorationBox(decoration, frame);
      for (const [index, line] of safeLines.entries()) {
        baseline = boxedLayout?.[index]?.y ?? baseline - line.size;
        if (baseline < content.bottom) break;
        this.page.drawText(line.text, {
          x: resolveOrderDocumentPdfAlignedTextX({
            x: content.x,
            width: content.width,
            textWidth: line.width,
            alignment: line.alignment
          }),
          y: baseline,
          size: line.size,
          font: line.font,
          color: colorFromHex(this.style.textColor)
        });
        if (!boxedLayout) baseline -= Math.max(1.8, line.size * 0.22);
      }
      this.drawDecorationBox(decoration, frame, true);
      if (!placement) {
        previousNaturalBoundary = { bottom: frame.bottom, boxed };
        companyY = frame.bottom;
      }
    });
  }  private drawHeader(continuation: boolean, canvasPageNumber?: number) {
    const headerTop = this.y;
    const headerHeight = this.activeCanvasFrame?.height ?? mm(this.style.headerHeightMm);
    const headerBottom = headerTop - headerHeight;
    const logoWidth = Math.min(mm(this.style.logoWidthMm), this.contentWidth * 0.56);
    const canvasManaged = canvasPageNumber !== undefined;
    const logo = this.canvas.elements.logo;
    const company = this.canvas.elements.company;
    const showLogoArtwork = this.input.template.layout.showLogoMark && Boolean(this.logoImage);
    const renderLogoArtwork = canvasManaged
      ? this.shouldRenderElement(logo, canvasPageNumber) && logo.positioning === 'flow'
      : showLogoArtwork;
    const showCompany = canvasManaged
      ? this.shouldRenderElement(company, canvasPageNumber) && company.positioning === 'flow'
      : true;
    const reserveLogoSpace = canvasManaged
      ? this.shouldRenderElement(logo, canvasPageNumber)
      : showLogoArtwork;

    if (renderLogoArtwork) {
      const frame = {
        x: this.margin,
        bottom: headerBottom,
        width: logoWidth,
        height: headerHeight
      };
      if (canvasManaged) {
        this.renderCanvasChildInBox(
          logo,
          frame,
          () => this.drawHeaderLogo(this.margin, headerTop, logoWidth, headerHeight)
        );
      } else {
        this.drawHeaderLogo(this.margin, headerTop, logoWidth, headerHeight);
      }
    }

    if (showCompany) {
      const companyX = this.margin + (reserveLogoSpace ? logoWidth + 18 : 0);
      const companyWidth = this.contentRight - companyX;
      const frame = {
        x: companyX,
        bottom: headerBottom,
        width: companyWidth,
        height: headerHeight
      };
      if (canvasManaged) {
        this.renderCanvasChildInBox(
          company,
          frame,
          () => this.drawHeaderCompany(companyX, headerTop, companyWidth)
        );
      } else {
        this.drawHeaderCompany(companyX, headerTop, companyWidth);
      }
    }

    this.y = headerBottom - mm(continuation ? 7 : 18);
  }
  private ensureSpace(requiredHeight: number) {
    if (this.activeCanvasFrame) return false;
    const bottom = this.margin + this.footerReserve;
    if (this.y - requiredHeight >= bottom) return false;
    this.startPage(true);
    return true;
  }

  private drawParagraph(
    value: string,
    options: {
      x?: number;
      width?: number;
      size?: number;
      font?: PDFFont;
      color?: RGB;
      lineHeight?: number;
      gapAfter?: number;
    } = {}
  ) {
    const x = options.x ?? this.margin;
    const width = options.width ?? this.contentWidth;
    const size = options.size ?? this.style.bodySizePt;
    const font = options.font ?? this.font;
    const color = options.color ?? colorFromHex(this.style.textColor);
    const lineHeight = options.lineHeight ?? size * 1.45;
    const lines = wrapText(font, value, size, width);
    for (const line of lines) {
      this.ensureSpace(lineHeight + 2);
      if (line) this.page.drawText(line, { x, y: this.y, size, font, color });
      this.y -= lineHeight;
    }
    this.y -= options.gapAfter ?? 4;
  }

  private drawCanvasTitleBlock(x: number, top: number, width: number) {
    const rows = this.orderSemanticRows('title', [
      {
        id: 'title_text',
        label: '',
        value: this.resolve(this.input.template.text.title),
        bold: true
      },
      { id: 'document_number', label: '', value: this.input.documentNumber, bold: true },
      {
        id: 'subtitle',
        label: '',
        value: this.resolve(this.input.template.text.subtitle)
      }
    ]).filter((row) => Boolean(row.value));
    if (rows.length === 0) return top;
    const segments = rows.map((row) => {
      const prominent = row.id === 'title_text' || row.id === 'document_number';
      const textStyle = this.textStyle(
        { kind: 'field_row', group: 'title', rowId: row.id },
        {
          fontWeight: prominent ? 'bold' : 'regular',
          fontSizePt: row.id === 'title_text'
            ? this.style.titleSizePt
            : row.id === 'document_number'
              ? Math.max(this.style.bodySizePt + 2, this.style.titleSizePt - 2.5)
              : this.style.smallSizePt + 0.4
        }
      );
      return {
        ...row,
        font: textStyle.font,
        size: textStyle.size,
        typography: textStyle.typography,
        placement: this.fieldRowPlacement('title', row.id)
      };
    });
    const largestSize = Math.max(...segments.map((segment) => segment.size));
    const ownerTop = this.activeCanvasFrame?.top ?? top;
    let lowest = top;

    const drawSegment = (
      segment: (typeof segments)[number],
      naturalX: number,
      naturalBaseline: number,
      naturalWidth: number,
      previousNaturalBoundary?: { bottom: number; boxed: boolean } | null
    ) => {
      const decoration = this.rowDecoration('title', segment.id);
      const boxed = hasOrderDocumentBoxDecoration(decoration);
      const inset = resolveOrderDocumentDecorationInset(decoration);
      const naturalHeight = Math.max(segment.size * 1.55, segment.size + inset * 2);
      const naturalTopOffset = segment.size + inset;
      const placedBaseWidth = segment.placement?.widthMm == null
        ? this.measuredDecorationWidth(
            segment.font.widthOfTextAtSize(segment.value, segment.size),
            decoration,
            width
          )
        : width;
      const naturalGeometry: OrderDocumentPdfNaturalRowGeometry | null = segment.placement
        ? null
        : resolveOrderDocumentPdfNaturalRowGeometry({
            desiredBaseline: naturalBaseline,
            frameTopOffset: naturalTopOffset,
            collisionTopOffset: boxed
              ? naturalTopOffset
              : segment.font.heightAtSize(segment.size, { descender: false }),
            previousFrameBottom: previousNaturalBoundary?.bottom,
            preventOverlap: boxed || Boolean(previousNaturalBoundary?.boxed)
          });
      const frame = segment.placement
        ? this.decorationFrame(
            segment.placement,
            x,
            ownerTop,
            placedBaseWidth,
            naturalHeight
          )
        : this.decorationFrame(
            undefined,
            naturalX,
            naturalGeometry!.top,
            naturalWidth,
            naturalHeight
          );
      const content = this.rowContentFrame(frame, decoration);
      const value = clampText(segment.font, segment.value, segment.size, content.width);
      const textWidth = segment.font.widthOfTextAtSize(value, segment.size);
      const alignment = this.singleTextAlignment({
        kind: 'field_row',
        group: 'title',
        rowId: segment.id
      });
      const boxedLayout = this.boxedTextLayout(
        content,
        decoration,
        segment.font,
        segment.size,
        segment.size,
        [textWidth],
        alignment
      )?.[0];
      const baseline = boxedLayout?.y ?? (
        segment.placement
          ? content.top - segment.size
          : naturalGeometry!.baseline
      );
      const textX = boxedLayout?.x ?? (
        resolveOrderDocumentPdfAlignedTextX({
          x: content.x,
          width: content.width,
          textWidth,
          alignment
        })
      );
      this.drawDecorationBox(decoration, frame);
      this.page.drawText(value, {
        x: textX,
        y: baseline,
        size: segment.size,
        font: segment.font,
        color: colorFromHex(this.style.textColor)
      });
      this.drawDecorationBox(decoration, frame, true);
      lowest = Math.min(lowest, frame.bottom, baseline - 3);
      return segment.placement ? null : { bottom: frame.bottom, boxed };
    };

    const title = segments.find((segment) => segment.id === 'title_text');
    const number = segments.find((segment) => segment.id === 'document_number');
    const subtitle = segments.find((segment) => segment.id === 'subtitle');
    const gap = 14;
    const firstLine = [title, number].filter(
      (segment): segment is (typeof segments)[number] => Boolean(segment && !segment.placement)
    );
    const firstLineBoundaries: Array<{ bottom: number; boxed: boolean }> = [];
    if (firstLine.length > 0) {
      const numberWidth = number && !number.placement
        ? Math.min(width * 0.26, number.font.widthOfTextAtSize(number.value, number.size) + 8)
        : 0;
      const titleWidth = Math.max(24, width - numberWidth - (numberWidth > 0 ? gap : 0));
      if (title && !title.placement) {
        const boundary = drawSegment(title, x, top, titleWidth);
        if (boundary) firstLineBoundaries.push(boundary);
      }
      if (number && !number.placement) {
        const boundary = drawSegment(number, x + width - numberWidth, top, numberWidth);
        if (boundary) firstLineBoundaries.push(boundary);
      }
    }
    [title, number].filter(
      (segment): segment is (typeof segments)[number] => Boolean(segment?.placement)
    ).forEach((segment) => drawSegment(segment, x, top, width));

    if (subtitle) {
      const subtitleBaseline = top - largestSize * 1.45 - 1;
      const firstLineBoundary = firstLineBoundaries.length > 0
        ? {
            bottom: Math.min(...firstLineBoundaries.map((boundary) => boundary.bottom)),
            boxed: firstLineBoundaries.some((boundary) => boundary.boxed)
          }
        : null;
      drawSegment(subtitle, x, subtitleBaseline, width, firstLineBoundary);
    }
    return lowest - 5;
  }

  private customerRows() {
    return resolveOrderDocumentCustomerRows(
      this.input.template,
      this.documentContext
    );
  }

  private drawCanvasCustomerBlock(x: number, top: number, width: number) {
    const entries = this.customerRows();
    const ownerTop = this.activeCanvasFrame?.top ?? top;
    let rowY = top;
    let lowest = top;
    let previousNaturalBoundary: { bottom: number; boxed: boolean } | null = null;
    for (const entry of entries) {
      const target: OrderDocumentTypographyTarget = {
        kind: 'field_row',
        group: 'customer',
        rowId: entry.id
      };
      const labelStyle = this.textStyle(target, {
        fontWeight: 'bold',
        fontSizePt: this.style.bodySizePt
      });
      const valueStyle = this.textStyle(target, {
        fontWeight: entry.bold ? 'bold' : 'regular',
        fontSizePt: this.style.bodySizePt
      });
      const lineHeight = Math.max(labelStyle.size, valueStyle.size) * 1.52;
      const placement = this.fieldRowPlacement('customer', entry.id);
      const decoration = this.rowDecoration('customer', entry.id);
      const boxed = hasOrderDocumentBoxDecoration(decoration);
      const measuredContentWidth = labelStyle.font.widthOfTextAtSize(
        `${entry.label}:`,
        labelStyle.size
      ) + 8 + valueStyle.font.widthOfTextAtSize(entry.value, valueStyle.size);
      const frameBaseWidth = placement?.widthMm == null
        ? this.measuredDecorationWidth(measuredContentWidth, decoration, width)
        : width;
      const preliminaryWidth = placement?.widthMm == null
        ? placement ? frameBaseWidth : width
        : mm(placement.widthMm);
      const preliminaryLabelWidth = Math.min(54, preliminaryWidth * 0.3);
      const preliminaryLines = wrapText(
        valueStyle.font,
        entry.value,
        valueStyle.size,
        Math.max(1, preliminaryWidth - preliminaryLabelWidth - resolveOrderDocumentDecorationInset(decoration) * 2)
      );
      const naturalHeight = Math.max(1, preliminaryLines.length) * lineHeight
        + resolveOrderDocumentDecorationInset(decoration) * 2;
      const naturalTopOffset = Math.max(labelStyle.size, valueStyle.size)
        + resolveOrderDocumentDecorationInset(decoration);
      const naturalGeometry: OrderDocumentPdfNaturalRowGeometry | null = placement
        ? null
        : resolveOrderDocumentPdfNaturalRowGeometry({
            desiredBaseline: rowY,
            frameTopOffset: naturalTopOffset,
            collisionTopOffset: boxed
              ? naturalTopOffset
              : Math.max(
                  labelStyle.font.heightAtSize(labelStyle.size, { descender: false }),
                  valueStyle.font.heightAtSize(valueStyle.size, { descender: false })
                ),
            previousFrameBottom: previousNaturalBoundary?.bottom,
            preventOverlap: boxed || Boolean(previousNaturalBoundary?.boxed)
          });
      const frame: PdfDecorationFrame = placement
        ? this.decorationFrame(placement, x, ownerTop, frameBaseWidth, naturalHeight)
        : this.decorationFrame(
            undefined,
            x,
            naturalGeometry!.top,
            width,
            naturalHeight
          );
      const content = this.rowContentFrame(frame, decoration);
      const labelWidth = Math.min(54, content.width * 0.3);
      const label = clampText(
        labelStyle.font,
        `${entry.label}:`,
        labelStyle.size,
        Math.max(1, labelWidth - 5)
      );
      const lines = wrapText(
        valueStyle.font,
        entry.value,
        valueStyle.size,
        Math.max(1, content.width - labelWidth)
      ).slice(0, Math.max(1, Math.floor(content.height / lineHeight)));
      const boxedLayout = hasOrderDocumentBoxDecoration(decoration)
        ? resolveOrderDocumentPdfTextBoxLayout({
            content,
            lineWidths: lines.map(() => 0),
            textAscentPt: Math.max(
              labelStyle.font.heightAtSize(labelStyle.size, { descender: false }),
              valueStyle.font.heightAtSize(valueStyle.size, { descender: false })
            ),
            textDescentPt: Math.max(
              0,
              labelStyle.font.heightAtSize(labelStyle.size)
                - labelStyle.font.heightAtSize(labelStyle.size, { descender: false }),
              valueStyle.font.heightAtSize(valueStyle.size)
                - valueStyle.font.heightAtSize(valueStyle.size, { descender: false })
            ),
            lineHeightPt: lineHeight,
            alignment: 'left'
          })
        : null;
      const baseline = boxedLayout?.[0]?.y ?? (
        placement
          ? content.top - Math.max(labelStyle.size, valueStyle.size)
          : naturalGeometry!.baseline
      );
      const alignment = this.textAlignment(target);
      const columnAlignment = alignment === 'distributed' ? 'left' : alignment;
      const labelTextWidth = labelStyle.font.widthOfTextAtSize(label, labelStyle.size);
      const labelX = resolveOrderDocumentPdfAlignedTextX({
        x: content.x,
        width: labelWidth,
        textWidth: labelTextWidth,
        alignment: columnAlignment
      });
      this.drawDecorationBox(decoration, frame);
      this.page.drawText(label, {
        x: labelX,
        y: baseline,
        size: labelStyle.size,
        font: labelStyle.font,
        color: colorFromHex(this.style.textColor)
      });
      lines.forEach((line, index) => {
        const lineWidth = valueStyle.font.widthOfTextAtSize(line, valueStyle.size);
        this.page.drawText(line, {
          x: resolveOrderDocumentPdfAlignedTextX({
            x: content.x + labelWidth,
            width: Math.max(1, content.width - labelWidth),
            textWidth: lineWidth,
            alignment: columnAlignment
          }),
          y: boxedLayout?.[index]?.y ?? baseline - index * lineHeight,
          size: valueStyle.size,
          font: valueStyle.font,
          color: colorFromHex(this.style.textColor)
        });
      });
      this.drawDecorationBox(decoration, frame, true);
      lowest = Math.min(lowest, frame.bottom);
      if (!placement) {
        previousNaturalBoundary = { bottom: frame.bottom, boxed };
        rowY = naturalGeometry!.baseline - Math.max(1, lines.length) * lineHeight;
      }
    }
    return Math.min(rowY, lowest);
  }

  private drawCanvasMetadataBlock(x: number, top: number, width: number) {
    const rows = this.documentMetadata();
    const ownerTop = this.activeCanvasFrame?.top ?? top;
    let rowY = top;
    let lowest = top;
    let previousNaturalBoundary: { bottom: number; boxed: boolean } | null = null;
    for (const row of rows) {
      if (!row.value) continue;
      const target: OrderDocumentTypographyTarget = {
        kind: 'field_row',
        group: 'document_meta',
        rowId: row.id
      };
      const labelStyle = this.textStyle(target, {
        fontWeight: 'regular',
        fontSizePt: this.style.smallSizePt + 0.4
      });
      const valueStyle = this.textStyle(target, {
        fontWeight: row.bold ? 'bold' : 'regular',
        fontSizePt: this.style.smallSizePt + 0.4
      });
      const lineHeight = Math.max(labelStyle.size, valueStyle.size) * 1.58;
      const placement = this.fieldRowPlacement('document_meta', row.id);
      const decoration = this.rowDecoration('document_meta', row.id);
      const boxed = hasOrderDocumentBoxDecoration(decoration);
      const measuredContentWidth = Math.max(
        (labelStyle.font.widthOfTextAtSize(`${row.label}:`, labelStyle.size) + 6) / 0.58,
        valueStyle.font.widthOfTextAtSize(row.value, valueStyle.size) / 0.42
      );
      const frameBaseWidth = placement?.widthMm == null
        ? this.measuredDecorationWidth(measuredContentWidth, decoration, width)
        : width;
      const naturalHeight = lineHeight + resolveOrderDocumentDecorationInset(decoration) * 2;
      const naturalTopOffset = Math.max(labelStyle.size, valueStyle.size)
        + resolveOrderDocumentDecorationInset(decoration);
      const naturalGeometry: OrderDocumentPdfNaturalRowGeometry | null = placement
        ? null
        : resolveOrderDocumentPdfNaturalRowGeometry({
            desiredBaseline: rowY,
            frameTopOffset: naturalTopOffset,
            collisionTopOffset: boxed
              ? naturalTopOffset
              : Math.max(
                  labelStyle.font.heightAtSize(labelStyle.size, { descender: false }),
                  valueStyle.font.heightAtSize(valueStyle.size, { descender: false })
                ),
            previousFrameBottom: previousNaturalBoundary?.bottom,
            preventOverlap: boxed || Boolean(previousNaturalBoundary?.boxed)
          });
      const frame: PdfDecorationFrame = placement
        ? this.decorationFrame(placement, x, ownerTop, frameBaseWidth, naturalHeight)
        : this.decorationFrame(
            undefined,
            x,
            naturalGeometry!.top,
            width,
            naturalHeight
          );
      const content = this.rowContentFrame(frame, decoration);
      const labelWidth = content.width * 0.58;
      const label = clampText(
        labelStyle.font,
        `${row.label}:`,
        labelStyle.size,
        Math.max(1, labelWidth - 6)
      );
      const value = clampText(
        valueStyle.font,
        row.value,
        valueStyle.size,
        Math.max(1, content.width - labelWidth)
      );
      const labelTextWidth = labelStyle.font.widthOfTextAtSize(label, labelStyle.size);
      const valueTextWidth = valueStyle.font.widthOfTextAtSize(value, valueStyle.size);
      const paired = resolveOrderDocumentPdfPairedTextLayout({
        x: content.x,
        width: content.width,
        labelWidth: labelTextWidth,
        valueWidth: valueTextWidth,
        labelColumnRatio: 0.58,
        alignment: this.textAlignment(target)
      });
      const boxedBaseline = hasOrderDocumentBoxDecoration(decoration)
        ? resolveOrderDocumentPdfTextBoxLayout({
            content,
            lineWidths: [0],
            textAscentPt: Math.max(
              labelStyle.font.heightAtSize(labelStyle.size, { descender: false }),
              valueStyle.font.heightAtSize(valueStyle.size, { descender: false })
            ),
            textDescentPt: Math.max(
              0,
              labelStyle.font.heightAtSize(labelStyle.size)
                - labelStyle.font.heightAtSize(labelStyle.size, { descender: false }),
              valueStyle.font.heightAtSize(valueStyle.size)
                - valueStyle.font.heightAtSize(valueStyle.size, { descender: false })
            ),
            lineHeightPt: lineHeight,
            alignment: 'left'
          })[0]?.y
        : undefined;
      const baseline = boxedBaseline ?? (
        placement
          ? content.top - Math.max(labelStyle.size, valueStyle.size)
          : naturalGeometry!.baseline
      );
      this.drawDecorationBox(decoration, frame);
      this.page.drawText(label, {
        x: paired.labelX,
        y: baseline,
        size: labelStyle.size,
        font: labelStyle.font,
        color: colorFromHex(this.style.mutedTextColor)
      });
      this.page.drawText(value, {
        x: paired.valueX,
        y: baseline,
        size: valueStyle.size,
        font: valueStyle.font,
        color: colorFromHex(this.style.textColor)
      });
      this.drawDecorationBox(decoration, frame, true);
      lowest = Math.min(lowest, frame.bottom);
      if (!placement) {
        previousNaturalBoundary = { bottom: frame.bottom, boxed };
        rowY = naturalGeometry!.baseline - lineHeight;
      }
    }
    return Math.min(rowY, lowest);
  }

  private drawCanvasDocumentDetails(pageNumber = 1) {
    const childIds = ['title', 'customer', 'document_meta'] as const;
    const hasChildCanvasState = childIds.some((id) =>
      Object.prototype.hasOwnProperty.call(
        this.input.template.layout.canvas?.elements ?? {},
        id
      ) || this.canvas.deletedElementIds.includes(id)
    );
    if (!hasChildCanvasState) {
      this.drawClassicDocumentDetails();
      return;
    }

    const parent = this.canvas.elements.document_details;
    const top = this.y;
    const gap = 22;
    let flowBottom = top - mm(parent.heightMm);
    const drawChild = (
      id: (typeof childIds)[number],
      flowBox: { x: number; top: number; width: number },
      draw: (x: number, top: number, width: number) => number
    ) => {
      const element = this.canvas.elements[id];
      if (!element.visible || !this.matchesElementCondition(element)) return null;
      if (element.positioning === 'absolute') {
        const elementTextSize = this.textStyle(
          { kind: 'element', elementId: id },
          {
            fontSizePt: id === 'title'
              ? this.style.titleSizePt
              : id === 'customer'
                ? this.style.bodySizePt
                : this.style.smallSizePt + 0.4
          }
        ).size;
        this.renderAbsoluteCanvasElement(
          element,
          () => draw(
            this.margin,
            this.activeCanvasFrame!.top - elementTextSize,
            this.contentWidth
          ),
          element.repeat === 'every_page' ? pageNumber : element.page
        );
        return null;
      }
      let bottom = flowBox.top;
      const frame = {
        x: flowBox.x,
        bottom: flowBox.top - mm(element.heightMm),
        width: flowBox.width,
        height: mm(element.heightMm)
      };
      this.renderCanvasChildInBox(element, frame, () => {
        bottom = draw(flowBox.x, flowBox.top, flowBox.width);
      });
      return bottom;
    };

    const title = this.canvas.elements.title;
    const titleBottom = drawChild(
      'title',
      { x: this.margin, top, width: this.contentWidth },
      (x, childTop, width) => this.drawCanvasTitleBlock(x, childTop, width)
    );
    const detailTop = title.positioning === 'flow' && titleBottom !== null
      ? titleBottom - 2
      : top;
    const leftWidth = this.contentWidth * 0.54;
    const rightX = this.margin + leftWidth + gap;
    const rightWidth = Math.max(20, this.contentRight - rightX);
    const customerBottom = drawChild(
      'customer',
      { x: this.margin, top: detailTop, width: leftWidth },
      (x, childTop, width) => this.drawCanvasCustomerBlock(x, childTop, width)
    );
    const metadataBottom = drawChild(
      'document_meta',
      { x: rightX, top: detailTop, width: rightWidth },
      (x, childTop, width) => this.drawCanvasMetadataBlock(x, childTop, width)
    );
    const flowBottoms = [titleBottom, customerBottom, metadataBottom]
      .filter((value): value is number => value !== null);
    if (flowBottoms.length > 0) flowBottom = Math.min(...flowBottoms) - 7;
    this.y = flowBottom;
    this.page.drawLine({
      start: { x: this.margin, y: this.y },
      end: { x: this.contentRight, y: this.y },
      thickness: this.style.lineWidthPt,
      color: colorFromHex(this.style.lineColor)
    });
    this.y -= ORDER_DOCUMENT_FLOW_SECTION_GAP_PT;
  }

  private drawClassicDocumentDetails() {
    this.ensureSpace(150);
    const lineColor = colorFromHex(this.style.lineColor);

    const drawRecipient = (top: number, width: number) =>
      this.drawCanvasCustomerBlock(this.margin, top, width);

    const drawMetadata = (top: number, x: number, width: number) =>
      this.drawCanvasMetadataBlock(x, top, width);

    const drawTitle = (baseline: number) =>
      this.drawCanvasTitleBlock(this.margin, baseline, this.contentWidth);

    if (this.input.type === 'predracun' || this.input.type === 'offer') {
      const top = this.y;
      const leftWidth = this.contentWidth * 0.54;
      const gap = 24;
      const rightX = this.margin + leftWidth + gap;
      const recipientBottom = drawRecipient(top, leftWidth);
      const metadataBottom = drawMetadata(
        top,
        rightX,
        this.contentWidth - leftWidth - gap
      );
      this.y = Math.min(recipientBottom, metadataBottom, top - 60) - 58;
      this.y = drawTitle(this.y);
    } else if (this.input.type === 'invoice') {
      const top = this.y;
      const titleBottom = drawTitle(top);
      const detailsTop = titleBottom - 4;
      const recipientBottom = drawRecipient(detailsTop, this.contentWidth * 0.5);
      const metadataBottom = drawMetadata(
        detailsTop,
        this.margin + this.contentWidth * 0.57,
        this.contentWidth * 0.43
      );
      this.y = Math.min(recipientBottom, metadataBottom) - 9;
    } else {
      this.y = drawTitle(this.y);
      const gap = 24;
      const leftWidth = this.contentWidth * 0.54;
      const rightX = this.margin + leftWidth + gap;
      const recipientBottom = drawRecipient(this.y, leftWidth);
      const metadataBottom = drawMetadata(
        this.y,
        rightX,
        this.contentWidth - leftWidth - gap
      );
      this.y = Math.min(recipientBottom, metadataBottom) - 7;
    }

    this.page.drawLine({
      start: { x: this.margin, y: this.y },
      end: { x: this.contentRight, y: this.y },
      thickness: this.style.lineWidthPt,
      color: lineColor
    });
    this.y -= ORDER_DOCUMENT_FLOW_SECTION_GAP_PT;
  }

  private drawDocumentDetails() {
    this.ensureSpace(150);
    const textColor = colorFromHex(this.style.textColor);
    const muted = colorFromHex(this.style.mutedTextColor);
    const accent = colorFromHex(this.style.accentColor);
    const title = this.resolve(this.input.template.text.title);
    const number = this.input.documentNumber;
    const rawTitleLine = `${title}  ${number}`;
    const requestedTitleSize = this.style.titleSizePt;
    const requestedTitleWidth = this.fontBold.widthOfTextAtSize(
      rawTitleLine,
      requestedTitleSize
    );
    const titleSize = Math.max(
      this.style.bodySizePt + 2,
      Math.min(
        requestedTitleSize,
        (requestedTitleSize * this.contentWidth) / requestedTitleWidth
      )
    );
    const titleLine = clampText(
      this.fontBold,
      rawTitleLine,
      titleSize,
      this.contentWidth
    );
    const titleWidth = this.fontBold.widthOfTextAtSize(titleLine, titleSize);
    const titleX = this.style.titleAlignment === 'right'
      ? Math.max(this.margin, this.contentRight - titleWidth)
      : this.margin;

    this.page.drawText(titleLine, {
      x: titleX,
      y: this.y,
      size: titleSize,
      font: this.fontBold,
      color: textColor
    });
    this.y -= titleSize + 8;

    if (this.input.template.text.subtitle) {
      const subtitleLines = wrapText(
        this.font,
        this.resolve(this.input.template.text.subtitle),
        this.style.smallSizePt,
        this.contentWidth
      );
      subtitleLines.forEach((line) => {
        this.page.drawText(line, {
          x: this.margin,
          y: this.y,
          size: this.style.smallSizePt,
          font: this.font,
          color: muted
        });
        this.y -= this.style.smallSizePt * 1.4;
      });
      this.y -= 4;
    }

    this.page.drawLine({
      start: { x: this.margin, y: this.y },
      end: { x: this.contentRight, y: this.y },
      thickness: this.style.lineWidthPt,
      color: accent
    });
    this.y -= 15;

    const top = this.y;
    const gap = 22;
    const leftWidth = this.contentWidth * 0.54;
    const rightX = this.margin + leftWidth + gap;
    const rightWidth = this.contentWidth - leftWidth - gap;
    const recipientLines = [
      {
        text: this.input.order.organizationName || this.input.order.contactName,
        bold: true
      },
      ...(this.input.order.organizationName
        ? [{ text: `${this.labels.contact}: ${this.input.order.contactName}`, bold: false }]
        : []),
      ...(this.input.order.deliveryAddress
        ? [{ text: this.input.order.deliveryAddress, bold: false }]
        : []),
      { text: `${this.labels.email}: ${this.input.order.email}`, bold: false }
    ];
    let leftY = top;
    recipientLines.forEach((line, index) => {
      const font = line.bold ? this.fontBold : this.font;
      const size = line.bold ? this.style.bodySizePt + 1 : this.style.bodySizePt;
      const wrapped = wrapText(font, line.text, size, leftWidth);
      wrapped.forEach((wrappedLine) => {
        this.page.drawText(wrappedLine, { x: this.margin, y: leftY, size, font, color: textColor });
        leftY -= size * 1.48;
      });
      if (index === 0) leftY -= 3;
    });

    const metadata = this.documentMetadata();
    let rightY = top;
    const labelWidth = rightWidth * 0.52;
    metadata.forEach(({ label, value, bold }) => {
      if (!value) return;
      const size = this.style.smallSizePt + 0.3;
      const safeLabel = clampText(this.font, `${label}:`, size, labelWidth - 5);
      const valueFont = bold ? this.fontBold : this.font;
      const safeValue = clampText(valueFont, value, size, rightWidth - labelWidth);
      this.page.drawText(safeLabel, {
        x: rightX,
        y: rightY,
        size,
        font: this.font,
        color: muted
      });
      this.page.drawText(safeValue, {
        x: rightX + rightWidth - valueFont.widthOfTextAtSize(safeValue, size),
        y: rightY,
        size,
        font: valueFont,
        color: textColor
      });
      rightY -= size * 1.65;
    });
    this.y = Math.min(leftY, rightY) - 12;
  }

  private documentMetadata() {
    return resolveOrderDocumentMetadataRows(
      this.input.template,
      this.documentContext
    );
  }

  private drawIntro() {
    const value = this.resolve(this.input.template.text.intro);
    if (!value) return;
    const target = { kind: 'element', elementId: 'intro' } as const;
    const introStyle = this.textStyle(
      target,
      { fontWeight: 'regular', fontSizePt: this.style.bodySizePt }
    );
    const decoration = resolveOrderDocumentDecoration(this.input.template, {
      kind: 'element',
      elementId: 'intro'
    });
    const size = introStyle.size;
    const horizontalAccent = decoration.accentEnabled
      && (decoration.accentSide === 'left' || decoration.accentSide === 'right')
      ? decoration.accentWidthPt
      : 0;
    const innerWidth = Math.max(
      1,
      this.contentWidth - resolveOrderDocumentDecorationInset(decoration) * 2 - horizontalAccent
    );
    const lines = wrapText(introStyle.font, value, size, innerWidth);
    const height = Math.max(
      24,
      lines.length * size * 1.45 + resolveOrderDocumentDecorationInset(decoration) * 2
    );
    this.ensureSpace(height + 8);
    const canvasManaged = this.canvasMode && this.activeCanvasElement?.id === 'intro';
    const frame = this.activeCanvasFrame
      ? {
          x: this.activeCanvasFrame.x,
          top: this.activeCanvasFrame.top,
          width: this.activeCanvasFrame.width,
          height: this.activeCanvasFrame.height,
          right: this.activeCanvasFrame.right,
          bottom: this.activeCanvasFrame.bottom
        }
      : this.decorationFrame(
          undefined,
          this.margin,
          this.y,
          this.contentWidth,
          canvasManaged
            ? Math.max(height, mm(this.activeCanvasElement?.heightMm ?? 0))
            : height
        );
    const content = this.rowContentFrame(frame, decoration);
    const alignment = this.singleTextAlignment(target);
    if (!canvasManaged) this.drawDecorationBox(decoration, frame);
    const boxedLayout = this.boxedTextLayout(
      content,
      decoration,
      introStyle.font,
      size,
      size * 1.45,
      lines.map((line) => introStyle.font.widthOfTextAtSize(line, size)),
      alignment
    );
    let textY = boxedLayout?.[0]?.y ?? content.top - size;
    lines.forEach((line, index) => {
      textY = boxedLayout?.[index]?.y ?? textY;
      if (textY < content.bottom) return;
      this.drawAlignedTextLine(line, {
        x: content.x,
        width: content.width,
        y: textY,
        size,
        font: introStyle.font,
        color: colorFromHex(this.style.textColor),
        alignment,
        justify: index < lines.length - 1
      });
      if (!boxedLayout) textY -= size * 1.45;
    });
    if (!canvasManaged) this.drawDecorationBox(decoration, frame, true);
    this.y = frame.bottom - ORDER_DOCUMENT_FLOW_SECTION_GAP_PT;
  }

  private drawTableRules(
    page: PDFPage,
    columns: readonly Column[],
    top: number,
    bottom: number,
    options: {
      outerTop?: boolean;
      outerBottom?: boolean;
      horizontalTop?: boolean;
      horizontalBottom?: boolean;
    } = {}
  ) {
    const color = colorFromHex(this.tableBorders.color);
    for (const segment of resolveOrderDocumentPdfTableRuleSegments({
      x: this.margin,
      top,
      bottom,
      columnWidths: columns.map((column) => column.width),
      borders: this.tableBorders,
      ...options
    })) {
      page.drawLine({
        ...segment,
        thickness: this.tableBorders.widthPt,
        color
      });
    }
  }

  private tableColumns(): Column[] {
    const labels: Record<OrderDocumentTableColumnId, string> = {
      sku: this.labels.code,
      quantity: this.labels.quantity,
      unit: this.labels.unit,
      description: this.labels.description,
      unitPrice: this.labels.unitPrice,
      lineTotal: this.labels.lineTotal
    };
    const alignment: Record<OrderDocumentTableColumnId, Column['align']> = {
      sku: 'left',
      quantity: 'right',
      unit: 'left',
      description: 'left',
      unitPrice: 'right',
      lineTotal: 'right'
    };
    const enabled = this.table.columns.filter((column) => column.visible);
    const widthTotal = enabled.reduce((sum, column) => sum + column.widthRatio, 0);
    return enabled.map((column) => ({
      key: column.id,
      label: labels[column.id],
      align: alignment[column.id],
      width: this.contentWidth * (column.widthRatio / widthTotal)
    }));
  }

  private drawTableHeader(columns: Column[], outerBottom = false) {
    const columnStyles = columns.map((column) => {
      const target = { kind: 'table_header_cell', columnId: column.key } as const;
      return {
        ...this.textStyle(
          target,
          { fontWeight: 'bold', fontSizePt: this.style.tableSizePt }
        ),
        alignment: this.singleTextAlignment(target, column.align)
      };
    });
    const height = Math.max(
      this.table.headerHeightPt,
      ...columnStyles.map(({ size }) => size + this.style.rowPaddingPt * 2 + 2)
    );
    this.ensureSpace(height + 20);
    const top = this.y;
    const bottom = top - height;
    if (this.style.tableHeaderBackground !== this.style.pageBackground) {
      this.page.drawRectangle({
        x: this.margin,
        y: bottom,
        width: this.contentWidth,
        height,
        color: colorFromHex(this.style.tableHeaderBackground)
      });
    }
    let x = this.margin;
    columns.forEach((column, index) => {
      const { font, size, alignment } = columnStyles[index]!;
      const label = clampText(font, column.label, size, column.width - 8);
      this.drawAlignedTextLine(label, {
        x: x + 5,
        width: Math.max(1, column.width - 10),
        y: bottom + (height - size) / 2,
        size,
        font,
        color: colorFromHex(this.style.tableHeaderTextColor),
        alignment
      });
      x += column.width;
    });
    this.drawTableRules(this.page, columns, top, bottom, {
      outerTop: true,
      outerBottom,
      horizontalBottom: true
    });
    this.y = bottom;
  }

  private itemCell(item: PdfItem, key: Column['key']) {
    return resolveOrderDocumentItemCells(item)[key];
  }

  private drawItems() {
    const columns = this.tableColumns();
    this.ensureSpace(60);
    this.drawTableHeader(columns, this.input.items.length === 0);
    const rowGap = this.table.rowGapPt;
    let rowIndex = 0;
    let rowsInPageSegment = 0;
    let segmentBottom = this.y;

    for (const item of this.input.items) {
      const rowNumber = rowIndex + 1;
      const cells = columns.map((column) => {
        const cellStyle = this.textStyle(
          {
            kind: 'table_cell',
            columnId: column.key,
            rowNumber
          },
          { fontWeight: 'regular', fontSizePt: this.style.tableSizePt }
        );
        const value = this.itemCell(item, column.key);
        const size = column.key === 'sku'
          ? fitTextSize(cellStyle.font, value, cellStyle.size, column.width - 10)
          : cellStyle.size;
        const lines = column.key === 'description'
          ? wrapText(cellStyle.font, value, cellStyle.size, column.width - 10)
          : [clampText(cellStyle.font, value, size, column.width - 10)];
        return {
          lines,
          ...cellStyle,
          size,
          alignment: this.singleTextAlignment(
            { kind: 'table_cell', columnId: column.key, rowNumber },
            column.align
          )
        };
      });
      const rowHeight = Math.max(
        resolveOrderDocumentTableRowHeight(this.table, rowNumber),
        ...cells.map((cell) =>
          cell.lines.length * cell.size * 1.35 + this.style.rowPaddingPt * 2
        )
      );
      const previousPage = this.page;
      if (this.ensureSpace(rowHeight + rowGap + 4)) {
        if (this.tableBorders.outer) {
          previousPage.drawLine({
            start: { x: this.margin, y: segmentBottom },
            end: { x: this.margin + this.contentWidth, y: segmentBottom },
            thickness: this.tableBorders.widthPt,
            color: colorFromHex(this.tableBorders.color)
          });
        }
        this.drawTableHeader(columns);
        rowsInPageSegment = 0;
        segmentBottom = this.y;
      }
      const top = this.y;
      const bottom = top - rowHeight;
      const ruleTop = rowsInPageSegment > 0 ? top + rowGap : top;
      if (
        rowIndex % 2 === 1 &&
        this.style.tableStripeColor !== this.style.pageBackground
      ) {
        this.page.drawRectangle({
          x: this.margin,
          y: bottom,
          width: this.contentWidth,
          height: rowHeight,
          color: colorFromHex(this.style.tableStripeColor)
        });
      }
      let x = this.margin;
      columns.forEach((column, columnIndex) => {
        const cell = cells[columnIndex]!;
        cell.lines.forEach((line, lineIndex) => {
          this.drawAlignedTextLine(line, {
            x: x + 5,
            width: Math.max(1, column.width - 10),
            y: this.y - this.style.rowPaddingPt - cell.size
              - lineIndex * cell.size * 1.35 + 2,
            size: cell.size,
            font: cell.font,
            color: colorFromHex(this.style.textColor),
            alignment: cell.alignment,
            justify: lineIndex < cell.lines.length - 1
          });
        });
        x += column.width;
      });
      this.drawTableRules(this.page, columns, ruleTop, bottom, {
        horizontalTop: rowsInPageSegment > 0
      });
      rowsInPageSegment += 1;
      segmentBottom = bottom;
      this.y = bottom - rowGap;
      rowIndex += 1;
    }
    if (this.input.items.length > 0 && this.tableBorders.outer) {
      this.page.drawLine({
        start: { x: this.margin, y: segmentBottom },
        end: { x: this.margin + this.contentWidth, y: segmentBottom },
        thickness: this.tableBorders.widthPt,
        color: colorFromHex(this.tableBorders.color)
      });
    }
    this.y -= ORDER_DOCUMENT_FLOW_SECTION_GAP_PT;
  }

  private totalRows(): SemanticTotalRow[] {
    return resolveOrderDocumentTotalRows(
      this.input.template,
      this.documentContext
    );
  }

  private drawClassicTotals() {
    const textColor = colorFromHex(this.style.textColor);
    const muted = colorFromHex(this.style.mutedTextColor);
    const rightWidth = Math.min(220, this.contentWidth * 0.46);
    const rightX = this.contentRight - rightWidth;
    const rows = this.totalRows();
    if (rows.length === 0) return;

    const estimatedHeight = rows.reduce((height, row) => height + this.textStyle(
      { kind: 'field_row', group: 'totals', rowId: row.id },
      {
        fontWeight: row.bold ? 'bold' : 'regular',
        fontSizePt: row.bold ? this.style.bodySizePt + 0.7 : this.style.bodySizePt
      }
    ).size * 1.7, 16);
    // Resolve a possible page break before anchoring placed rows and tracking
    // the section's lowest point. Otherwise those values still describe the
    // previous page and can push the following section far down (or onto an
    // unnecessary extra page).
    this.ensureSpace(Math.max(50, estimatedHeight));
    const initialY = this.y;
    const ownerTop = this.activeCanvasFrame?.top ?? initialY;
    let lowest = initialY;
    let previousNaturalBoundary: { bottom: number; boxed: boolean } | null = null;
    const drawRightRow = (row: SemanticTotalRow) => {
      const target = {
        kind: 'field_row',
        group: 'totals',
        rowId: row.id
      } as const satisfies OrderDocumentTextAlignmentTarget;
      const { font, size, typography } = this.textStyle(
        target,
        {
          fontWeight: row.bold ? 'bold' : 'regular',
          fontSizePt: row.bold ? this.style.bodySizePt + 0.7 : this.style.bodySizePt
        }
      );
      const placement = this.fieldRowPlacement('totals', row.id);
      const decoration = this.rowDecoration('totals', row.id);
      const boxed = hasOrderDocumentBoxDecoration(decoration);
      const safeValue = formatCurrency(row.value);
      const measuredContentWidth = Math.max(
        font.widthOfTextAtSize(row.label, size) / 0.67,
        font.widthOfTextAtSize(safeValue, size) / 0.33
      );
      const frameBaseWidth = placement?.widthMm == null
        ? this.measuredDecorationWidth(measuredContentWidth, decoration, this.contentWidth)
        : this.contentWidth;
      const naturalHeight = size * 1.7 + resolveOrderDocumentDecorationInset(decoration) * 2;
      const naturalTopOffset = size + resolveOrderDocumentDecorationInset(decoration);
      const naturalGeometry: OrderDocumentPdfNaturalRowGeometry | null = placement
        ? null
        : resolveOrderDocumentPdfNaturalRowGeometry({
            desiredBaseline: this.y,
            frameTopOffset: naturalTopOffset,
            collisionTopOffset: boxed
              ? naturalTopOffset
              : font.heightAtSize(size, { descender: false }),
            previousFrameBottom: previousNaturalBoundary?.bottom,
            preventOverlap: boxed || Boolean(previousNaturalBoundary?.boxed)
          });
      const horizontalInsets = this.rowHorizontalInsets(decoration);
      // Natural decoration is layout-neutral: expand ink around the existing
      // financial content frame instead of consuming its left/right anchors.
      const naturalFrameX = boxed ? rightX - horizontalInsets.left : rightX;
      const naturalFrameWidth = boxed
        ? rightWidth + horizontalInsets.left + horizontalInsets.right
        : rightWidth;
      const frame = placement
        ? this.decorationFrame(
            placement,
            this.margin,
            ownerTop,
            frameBaseWidth,
            naturalHeight
          )
        : this.decorationFrame(
            undefined,
            naturalFrameX,
            naturalGeometry!.top,
            naturalFrameWidth,
            naturalHeight
          );
      const content = this.rowContentFrame(frame, decoration);
      const safeLabel = clampText(font, row.label, size, content.width * 0.67);
      const labelWidth = font.widthOfTextAtSize(safeLabel, size);
      const valueWidth = font.widthOfTextAtSize(safeValue, size);
      const alignment = this.textAlignment(target);
      const paired = resolveOrderDocumentPdfPairedTextLayout({
        x: content.x,
        width: content.width,
        labelWidth,
        valueWidth,
        labelColumnRatio: 0.67,
        alignment
      });
      const labelX = alignment === 'left' || alignment === 'distributed'
        ? resolveOrderDocumentPdfOpticalLeftAlignedTextX({
            left: content.x,
            leftSideBearing: orderDocumentPdfLeftSideBearingPt(
              typography,
              safeLabel,
              size
            )
          })
        : paired.labelX;
      const valueX = alignment === 'right' || alignment === 'distributed'
        ? resolveOrderDocumentPdfOpticalRightAlignedTextX({
            right: content.x + content.width,
            advanceWidth: valueWidth,
            rightSideBearing: orderDocumentPdfRightSideBearingPt(
              typography,
              safeValue,
              size
            )
          })
        : paired.valueX;
      const boxedBaseline = this.boxedTextLayout(
        content,
        decoration,
        font,
        size,
        size * 1.7,
        [0],
        'left'
      )?.[0]?.y;
      const baseline = boxedBaseline ?? (
        placement ? content.top - size : naturalGeometry!.baseline
      );
      this.drawDecorationBox(decoration, frame);
      this.page.drawText(safeLabel, {
        x: labelX,
        y: baseline,
        size,
        font,
        color: row.bold ? textColor : muted
      });
      this.page.drawText(safeValue, {
        x: valueX,
        y: baseline,
        size,
        font,
        color: textColor
      });
      this.drawDecorationBox(decoration, frame, true);
      lowest = Math.min(lowest, frame.bottom);
      if (!placement) {
        previousNaturalBoundary = { bottom: frame.bottom, boxed };
        this.y = naturalGeometry!.baseline - size * 1.7;
      }
    };

    for (const row of rows) {
      drawRightRow(row);
    }
    this.y = Math.min(this.y, lowest) - ORDER_DOCUMENT_FLOW_SECTION_GAP_PT;
  }

  private drawTotals() {
    const rows = this.totalRows().map((row) => ({
      ...row,
      value: formatCurrency(row.value)
    }));
    if (rows.length === 0) return;

    const boxWidth = Math.min(255, this.contentWidth * 0.55);
    const rowHeight = this.style.bodySizePt * 1.55 + 4;
    const boxHeight = rows.length * rowHeight + 16;
    this.ensureSpace(boxHeight + 8);
    const boxX = this.contentRight - boxWidth;
    const boxBottom = this.y - boxHeight;
    this.page.drawRectangle({
      x: boxX,
      y: boxBottom,
      width: boxWidth,
      height: boxHeight,
      color: colorFromHex(this.style.totalBackground),
      borderColor: colorFromHex(this.style.lineColor),
      borderWidth: this.style.lineWidthPt
    });
    let rowY = this.y - 13;
    rows.forEach((row, index) => {
      const font = row.bold ? this.fontBold : this.font;
      const size = row.bold ? this.style.bodySizePt + 0.7 : this.style.bodySizePt;
      const label = clampText(font, row.label, size, boxWidth * 0.62 - 15);
      const value = clampText(font, row.value, size, boxWidth * 0.38 - 12);
      this.page.drawText(label, {
        x: boxX + 10,
        y: rowY,
        size,
        font,
        color: colorFromHex(this.style.textColor)
      });
      this.page.drawText(value, {
        x: boxX + boxWidth - 10 - font.widthOfTextAtSize(value, size),
        y: rowY,
        size,
        font,
        color: colorFromHex(this.style.textColor)
      });
      if (row.bold && index > 0) {
        this.page.drawLine({
          start: { x: boxX + 10, y: rowY + size + 4 },
          end: { x: boxX + boxWidth - 10, y: rowY + size + 4 },
          thickness: Math.max(0.8, this.style.lineWidthPt),
          color: colorFromHex(this.style.accentColor)
        });
      }
      rowY -= rowHeight;
    });
    this.y = boxBottom - ORDER_DOCUMENT_FLOW_SECTION_GAP_PT;
  }

  private drawNotes() {
    const notes = toSafeText(this.input.order.notes);
    const rows = this.fieldRows('notes');
    if (rows.length === 0 || !notes) return;
    this.ensureSpace(48);
    const ownerTop = this.activeCanvasFrame?.top ?? this.y;
    let lowest = this.y;
    let previousNaturalBoundary: { bottom: number; boxed: boolean } | null = null;
    for (const row of rows) {
      if (row.id === 'notes_label') {
        const target = { kind: 'field_row', group: 'notes', rowId: row.id } as const;
        const noteLabelStyle = this.textStyle(
          target,
          { fontWeight: 'bold', fontSizePt: this.style.bodySizePt }
        );
        const placement = row.placement;
        const decoration = this.rowDecoration('notes', row.id);
        const boxed = hasOrderDocumentBoxDecoration(decoration);
        const labelText = `${this.labels.notes}:`;
        const frameBaseWidth = placement?.widthMm == null
          ? this.measuredDecorationWidth(
              noteLabelStyle.font.widthOfTextAtSize(labelText, noteLabelStyle.size),
              decoration,
              this.contentWidth
            )
          : this.contentWidth;
        const naturalHeight = noteLabelStyle.size * 1.55
          + resolveOrderDocumentDecorationInset(decoration) * 2;
        const naturalTopOffset = noteLabelStyle.size
          + resolveOrderDocumentDecorationInset(decoration);
        const naturalGeometry: OrderDocumentPdfNaturalRowGeometry | null = placement
          ? null
          : resolveOrderDocumentPdfNaturalRowGeometry({
              desiredBaseline: this.y,
              frameTopOffset: naturalTopOffset,
              collisionTopOffset: boxed
                ? naturalTopOffset
                : noteLabelStyle.font.heightAtSize(
                    noteLabelStyle.size,
                    { descender: false }
                  ),
              previousFrameBottom: previousNaturalBoundary?.bottom,
              preventOverlap: boxed || Boolean(previousNaturalBoundary?.boxed)
            });
        const frame: PdfDecorationFrame = placement
          ? this.decorationFrame(placement, this.margin, ownerTop, frameBaseWidth, naturalHeight)
          : this.decorationFrame(
              undefined,
              this.margin,
              naturalGeometry!.top,
              this.contentWidth,
              naturalHeight
            );
        const content = this.rowContentFrame(frame, decoration);
        const alignment = this.singleTextAlignment(target);
        const safeLabel = clampText(
          noteLabelStyle.font,
          labelText,
          noteLabelStyle.size,
          content.width
        );
        const labelWidth = noteLabelStyle.font.widthOfTextAtSize(
          safeLabel,
          noteLabelStyle.size
        );
        const boxedBaseline = this.boxedTextLayout(
          content,
          decoration,
          noteLabelStyle.font,
          noteLabelStyle.size,
          noteLabelStyle.size * 1.55,
          [labelWidth],
          alignment
        )?.[0]?.y;
        const baseline = boxedBaseline ?? (
          placement ? content.top - noteLabelStyle.size : naturalGeometry!.baseline
        );
        this.drawDecorationBox(decoration, frame);
        this.page.drawText(safeLabel, {
          x: resolveOrderDocumentPdfAlignedTextX({
            x: content.x,
            width: content.width,
            textWidth: labelWidth,
            alignment
          }),
          y: baseline,
          size: noteLabelStyle.size,
          font: noteLabelStyle.font,
          color: colorFromHex(this.style.textColor)
        });
        this.drawDecorationBox(decoration, frame, true);
        lowest = Math.min(lowest, frame.bottom);
        if (!placement) {
          previousNaturalBoundary = { bottom: frame.bottom, boxed };
          this.y = naturalGeometry!.baseline - noteLabelStyle.size * 1.55;
        }
      }
      if (row.id === 'notes_content') {
        const target = { kind: 'field_row', group: 'notes', rowId: row.id } as const;
        const noteContentStyle = this.textStyle(
          target,
          { fontWeight: 'regular', fontSizePt: this.style.smallSizePt + 0.5 }
        );
        const placement = row.placement;
        const decoration = this.rowDecoration('notes', row.id);
        const boxed = hasOrderDocumentBoxDecoration(decoration);
        const frameBaseWidth = placement?.widthMm == null
          ? this.measuredDecorationWidth(
              noteContentStyle.font.widthOfTextAtSize(notes, noteContentStyle.size),
              decoration,
              this.contentWidth
            )
          : this.contentWidth;
        const preliminaryWidth = placement?.widthMm == null
          ? placement ? frameBaseWidth : this.contentWidth
          : mm(placement.widthMm);
        const lines = wrapText(
          noteContentStyle.font,
          notes,
          noteContentStyle.size,
          Math.max(1, preliminaryWidth - resolveOrderDocumentDecorationInset(decoration) * 2)
        );
        const lineHeight = noteContentStyle.size * 1.45;
        const naturalHeight = lines.length * lineHeight
          + resolveOrderDocumentDecorationInset(decoration) * 2;
        const naturalTopOffset = noteContentStyle.size
          + resolveOrderDocumentDecorationInset(decoration);
        const naturalGeometry: OrderDocumentPdfNaturalRowGeometry | null = placement
          ? null
          : resolveOrderDocumentPdfNaturalRowGeometry({
              desiredBaseline: this.y,
              frameTopOffset: naturalTopOffset,
              collisionTopOffset: boxed
                ? naturalTopOffset
                : noteContentStyle.font.heightAtSize(
                    noteContentStyle.size,
                    { descender: false }
                  ),
              previousFrameBottom: previousNaturalBoundary?.bottom,
              preventOverlap: boxed || Boolean(previousNaturalBoundary?.boxed)
            });
        const frame: PdfDecorationFrame = placement
          ? this.decorationFrame(placement, this.margin, ownerTop, frameBaseWidth, naturalHeight)
          : this.decorationFrame(
              undefined,
              this.margin,
              naturalGeometry!.top,
              this.contentWidth,
              naturalHeight
            );
        const content = this.rowContentFrame(frame, decoration);
        const alignment = this.singleTextAlignment(target);
        const boxedLayout = this.boxedTextLayout(
          content,
          decoration,
          noteContentStyle.font,
          noteContentStyle.size,
          lineHeight,
          lines.map((line) => noteContentStyle.font.widthOfTextAtSize(line, noteContentStyle.size)),
          alignment
        );
        let baseline = boxedLayout?.[0]?.y ?? (
          placement ? content.top - noteContentStyle.size : naturalGeometry!.baseline
        );
        this.drawDecorationBox(decoration, frame);
        for (const [index, line] of lines.entries()) {
          baseline = boxedLayout?.[index]?.y ?? baseline;
          if (baseline < content.bottom) break;
          this.drawAlignedTextLine(line, {
            x: content.x,
            width: content.width,
            y: baseline,
            size: noteContentStyle.size,
            font: noteContentStyle.font,
            color: colorFromHex(this.style.mutedTextColor),
            alignment,
            justify: index < lines.length - 1
          });
          if (!boxedLayout) baseline -= lineHeight;
        }
        this.drawDecorationBox(decoration, frame, true);
        lowest = Math.min(lowest, frame.bottom);
        if (!placement) {
          previousNaturalBoundary = { bottom: frame.bottom, boxed };
          this.y = frame.bottom - ORDER_DOCUMENT_FLOW_SECTION_GAP_PT;
        }
      }
    }
    this.y = Math.min(this.y, lowest);
  }

  private drawClosing() {
    const content = new Map<OrderDocumentFieldRowId, { text: string; bold: boolean }>([
      [
        'payment_terms',
        { text: this.resolve(this.input.template.text.paymentTerms), bold: false }
      ],
      [
        'closing_text',
        { text: this.resolve(this.input.template.text.closing), bold: false }
      ],
      [
        'signer_name',
        { text: this.resolve(this.input.template.text.signerName), bold: true }
      ]
    ]);
    const parts = this.fieldRows('closing').flatMap((row) => {
      const part = content.get(row.id);
      return part?.text ? [{ id: row.id, ...part }] : [];
    });
    if (parts.length === 0) return;
    const estimatedHeight = parts.reduce((height, part) => {
      const textStyle = this.textStyle(
        { kind: 'field_row', group: 'closing', rowId: part.id },
        {
          fontWeight: part.bold ? 'bold' : 'regular',
          fontSizePt: this.style.smallSizePt + 0.7
        }
      );
      return height + wrapText(textStyle.font, part.text, textStyle.size, this.contentWidth)
        .length * textStyle.size * 1.45 + 8;
    }, 0);
    this.ensureSpace(estimatedHeight);
    const ownerTop = this.activeCanvasFrame?.top ?? this.y;
    let lowest = this.y;
    let previousNaturalBoundary: { bottom: number; boxed: boolean } | null = null;
    for (const part of parts) {
      const target = { kind: 'field_row', group: 'closing', rowId: part.id } as const;
      const textStyle = this.textStyle(
        target,
        {
          fontWeight: part.bold ? 'bold' : 'regular',
          fontSizePt: this.style.smallSizePt + 0.7
        }
      );
      const placement = this.fieldRowPlacement('closing', part.id);
      const decoration = this.rowDecoration('closing', part.id);
      const boxed = hasOrderDocumentBoxDecoration(decoration);
      const frameBaseWidth = placement?.widthMm == null
        ? this.measuredDecorationWidth(
            textStyle.font.widthOfTextAtSize(part.text, textStyle.size),
            decoration,
            this.contentWidth
          )
        : this.contentWidth;
      const preliminaryWidth = placement?.widthMm == null
        ? placement ? frameBaseWidth : this.contentWidth
        : mm(placement.widthMm);
      const lines = wrapText(
        textStyle.font,
        part.text,
        textStyle.size,
        Math.max(1, preliminaryWidth - resolveOrderDocumentDecorationInset(decoration) * 2)
      );
      const lineHeight = textStyle.size * 1.45;
      const naturalHeight = lines.length * lineHeight
        + resolveOrderDocumentDecorationInset(decoration) * 2;
      const naturalTopOffset = textStyle.size
        + resolveOrderDocumentDecorationInset(decoration);
      const naturalGeometry: OrderDocumentPdfNaturalRowGeometry | null = placement
        ? null
        : resolveOrderDocumentPdfNaturalRowGeometry({
            desiredBaseline: this.y,
            frameTopOffset: naturalTopOffset,
            collisionTopOffset: boxed
              ? naturalTopOffset
              : textStyle.font.heightAtSize(textStyle.size, { descender: false }),
            previousFrameBottom: previousNaturalBoundary?.bottom,
            preventOverlap: boxed || Boolean(previousNaturalBoundary?.boxed)
          });
      const frame: PdfDecorationFrame = placement
        ? this.decorationFrame(placement, this.margin, ownerTop, frameBaseWidth, naturalHeight)
        : this.decorationFrame(
            undefined,
            this.margin,
            naturalGeometry!.top,
            this.contentWidth,
            naturalHeight
          );
      const contentFrame = this.rowContentFrame(frame, decoration);
      const alignment = this.singleTextAlignment(target);
      const boxedLayout = this.boxedTextLayout(
        contentFrame,
        decoration,
        textStyle.font,
        textStyle.size,
        lineHeight,
        lines.map((line) => textStyle.font.widthOfTextAtSize(line, textStyle.size)),
        alignment
      );
      let baseline = boxedLayout?.[0]?.y ?? (
        placement ? contentFrame.top - textStyle.size : naturalGeometry!.baseline
      );
      this.drawDecorationBox(decoration, frame);
      for (const [index, line] of lines.entries()) {
        baseline = boxedLayout?.[index]?.y ?? baseline;
        if (baseline < contentFrame.bottom) break;
        this.drawAlignedTextLine(line, {
          x: contentFrame.x,
          width: contentFrame.width,
          y: baseline,
          size: textStyle.size,
          font: textStyle.font,
          color: part.bold
            ? colorFromHex(this.style.textColor)
            : colorFromHex(this.style.mutedTextColor),
          alignment,
          justify: index < lines.length - 1
        });
        if (!boxedLayout) baseline -= lineHeight;
      }
      this.drawDecorationBox(decoration, frame, true);
      lowest = Math.min(lowest, frame.bottom);
      if (!placement) {
        previousNaturalBoundary = { bottom: frame.bottom, boxed };
        this.y = frame.bottom - ORDER_DOCUMENT_FLOW_SECTION_GAP_PT;
      }
    }
    this.y = Math.min(this.y, lowest);
  }

  private drawSignatures() {
    if (this.input.type === 'dobavnica' && this.y > 335) {
      this.y = 335;
    }
    const rows = this.fieldRows('signatures');
    if (rows.length === 0) return;
    this.ensureSpace(65);
    const ownerTop = this.activeCanvasFrame?.top ?? this.y;
    const slotWidth = this.contentWidth / rows.length;
    let lowest = this.y;
    rows.forEach((row, index) => {
      const target = {
        kind: 'field_row',
        group: 'signatures',
        rowId: row.id
      } as const;
      const label = row.id === 'handed_over_by'
        ? this.labels.handedOverBy
        : this.labels.receivedBy;
      const signatureStyle = this.textStyle(
        { kind: 'field_row', group: 'signatures', rowId: row.id },
        { fontWeight: 'bold', fontSizePt: this.style.smallSizePt }
      );
      const naturalX = this.margin + index * slotWidth;
      const decoration = this.rowDecoration('signatures', row.id);
      const labelText = `${label}:`;
      const labelWidth = signatureStyle.font.widthOfTextAtSize(
        labelText,
        signatureStyle.size
      );
      // The canvas' max-content signature row retains a short usable signing
      // rule after the label. Match that intrinsic width for x/y-only rows.
      const frameBaseWidth = row.placement?.widthMm == null
        ? this.measuredDecorationWidth(
            labelWidth + 8 + 24,
            decoration,
            this.contentWidth
          )
        : this.contentWidth;
      const frame = row.placement
        ? this.decorationFrame(row.placement, this.margin, ownerTop, frameBaseWidth, 55)
        : this.decorationFrame(undefined, naturalX, this.y, slotWidth - 8, 55);
      const content = this.rowContentFrame(frame, decoration);
      const resolvedAlignment = this.textAlignment(target);
      const alignment = resolvedAlignment === 'distributed' ? 'left' : resolvedAlignment;
      const labelColumnWidth = resolvedAlignment === 'distributed'
        ? Math.min(content.width, labelWidth + 8)
        : Math.min(
            content.width,
            Math.min(
              Math.max(labelWidth + 8, content.width * 0.45),
              Math.max(labelWidth + 8, content.width - 24)
            )
          );
      const signatureGlyphHeight = signatureStyle.font.heightAtSize(
        signatureStyle.size,
        { descender: false }
      );
      const boxedGroupBottom = hasOrderDocumentBoxDecoration(decoration)
        ? resolveOrderDocumentPdfTextBoxLayout({
            content,
            lineWidths: [labelWidth],
            textAscentPt: signatureGlyphHeight + 4,
            textDescentPt: 0,
            lineHeightPt: signatureGlyphHeight + 4,
            alignment: 'left'
          })[0]
        : undefined;
      const labelY = boxedGroupBottom
        ? boxedGroupBottom.y + 4
        : content.top - signatureStyle.size - 4;
      const lineY = boxedGroupBottom
        ? boxedGroupBottom.y
        : Math.max(content.bottom + 5, labelY - 4);
      this.drawDecorationBox(decoration, frame);
      this.page.drawText(labelText, {
        x: resolveOrderDocumentPdfAlignedTextX({
          x: content.x,
          width: labelColumnWidth,
          textWidth: labelWidth,
          alignment
        }),
        y: labelY,
        size: signatureStyle.size,
        font: signatureStyle.font,
        color: colorFromHex(this.style.textColor)
      });
      this.page.drawLine({
        start: { x: content.x + labelColumnWidth, y: lineY },
        end: { x: content.x + content.width, y: lineY },
        thickness: this.style.lineWidthPt,
        color: colorFromHex(this.style.lineColor)
      });
      this.drawDecorationBox(decoration, frame, true);
      lowest = Math.min(lowest, frame.bottom);
    });
    this.y = lowest - ORDER_DOCUMENT_FLOW_SECTION_GAP_PT;
  }

  private drawSection(sectionId: OrderDocumentSectionId, canvasPageNumber?: number) {
    if (sectionId === 'document_details') {
      if (canvasPageNumber === undefined) this.drawClassicDocumentDetails();
      else this.drawCanvasDocumentDetails(canvasPageNumber);
    }
    if (sectionId === 'intro') this.drawIntro();
    if (sectionId === 'items') this.drawItems();
    if (sectionId === 'totals') this.drawClassicTotals();
    if (sectionId === 'notes') this.drawNotes();
    if (sectionId === 'closing') this.drawClosing();
    if (sectionId === 'signatures') this.drawSignatures();
  }

  private renderCanvasSections() {
    const absoluteSections: Array<{
      element: OrderDocumentCanvasElement;
      sectionId: OrderDocumentSectionId;
    }> = [];

    for (const section of this.input.template.layout.sections) {
      const element = this.canvas.elements[section.id];
      if (!element.visible || !this.matchesElementCondition(element)) continue;
      if (element.positioning === 'absolute') {
        absoluteSections.push({ element, sectionId: section.id });
        continue;
      }
      this.renderFlowCanvasElement(
        element,
        () => this.drawSection(section.id, this.doc.getPageCount())
      );
    }

    absoluteSections
      .sort((left, right) => left.element.zIndex - right.element.zIndex)
      .forEach(({ element, sectionId }) => {
        this.renderAbsoluteCanvasElement(
          element,
          () => this.drawSection(sectionId, element.page)
        );
      });
  }

  private drawCanvasHeaders() {
    const header = this.canvas.elements.header;
    const logo = this.canvas.elements.logo;
    const company = this.canvas.elements.company;
    const footer = this.canvas.elements.footer;
    const requestedPage = [header, logo, company, footer]
      .filter((element) => element.visible && element.repeat === 'once')
      .reduce((highest, element) => Math.max(highest, element.page), 1);
    this.ensureCanvasPage(Math.max(this.doc.getPageCount(), requestedPage));
    const pages = [...this.doc.getPages()];

    pages.forEach((page, index) => {
      const pageNumber = index + 1;
      if (!this.shouldRenderElement(header, pageNumber)) return;
      const continuation = index > 0;
      if (header.positioning === 'absolute') {
        this.renderAbsoluteCanvasElement(
          header,
          () => this.drawHeader(continuation, pageNumber),
          pageNumber
        );
      } else {
        const previousPage = this.page;
        const previousY = this.y;
        this.page = page;
        this.y = A4_HEIGHT - mm(10);
        const height = mm(this.input.template.style.headerHeightMm);
        const frame = {
          x: this.defaultMargin,
          bottom: this.y - height,
          width: this.defaultContentWidth,
          height
        };
        this.renderCanvasChildInBox(
          header,
          frame,
          () => this.drawHeader(continuation, pageNumber)
        );
        this.page = previousPage;
        this.y = previousY;
      }

      if (
        logo.positioning === 'absolute'
        && this.shouldRenderElement(logo, pageNumber)
      ) {
        this.renderAbsoluteCanvasElement(
          logo,
          () => this.drawHeaderLogo(
            this.margin,
            this.activeCanvasFrame!.top,
            this.contentWidth,
            this.activeCanvasFrame!.height
          ),
          pageNumber
        );
      }
      if (
        company.positioning === 'absolute'
        && this.shouldRenderElement(company, pageNumber)
      ) {
        this.renderAbsoluteCanvasElement(
          company,
          () => this.drawHeaderCompany(
            this.margin,
            this.activeCanvasFrame!.top,
            this.contentWidth
          ),
          pageNumber
        );
      }
    });
  }

  private drawCanvasFooterContent(pageIndex: number, pageCount: number) {
    const hasAbsoluteFrame = Boolean(this.activeCanvasFrame);
    const legacyFooterY = Math.max(19, this.defaultMargin * 0.42);
    let rowY = hasAbsoluteFrame
      ? this.activeCanvasFrame!.top - (this.style.smallSizePt - 0.4)
      : legacyFooterY + 14;
    const ownerTop = this.activeCanvasFrame?.top
      ?? legacyFooterY + mm(this.canvas.elements.footer.heightMm);
    let previousNaturalBoundary: { bottom: number; boxed: boolean } | null = null;
    for (const row of resolveOrderDocumentFooterRows(
      this.input.template,
      this.documentContext,
      pageIndex,
      pageCount
    )) {
      const target = { kind: 'field_row', group: 'footer', rowId: row.id } as const;
      const footerStyle = this.textStyle(
        target,
        { fontWeight: 'regular', fontSizePt: this.style.smallSizePt - 0.4 }
      );
      const { font, size } = footerStyle;
      const placement = this.fieldRowPlacement('footer', row.id);
      const decoration = this.rowDecoration('footer', row.id);
      const boxed = hasOrderDocumentBoxDecoration(decoration);
      const frameBaseWidth = placement?.widthMm == null
        ? this.measuredDecorationWidth(
            font.widthOfTextAtSize(row.value, size),
            decoration,
            this.contentWidth
          )
        : this.contentWidth;
      const naturalHeight = Math.max(11, size * 1.35)
        + resolveOrderDocumentDecorationInset(decoration) * 2;
      const naturalTopOffset = size + resolveOrderDocumentDecorationInset(decoration);
      const naturalGeometry: OrderDocumentPdfNaturalRowGeometry | null = placement
        ? null
        : resolveOrderDocumentPdfNaturalRowGeometry({
            desiredBaseline: rowY,
            frameTopOffset: naturalTopOffset,
            collisionTopOffset: boxed
              ? naturalTopOffset
              : font.heightAtSize(size, { descender: false }),
            previousFrameBottom: previousNaturalBoundary?.bottom,
            preventOverlap: boxed || Boolean(previousNaturalBoundary?.boxed)
          });
      const frame: PdfDecorationFrame = placement
        ? this.decorationFrame(
            placement,
            this.margin,
            ownerTop,
            frameBaseWidth,
            naturalHeight
          )
        : this.decorationFrame(
            undefined,
            this.margin,
            naturalGeometry!.top,
            this.contentWidth,
            naturalHeight
          );
      const content = this.rowContentFrame(frame, decoration);
      const value = clampText(font, row.value, size, content.width);
      const textWidth = font.widthOfTextAtSize(value, size);
      const alignment = this.singleTextAlignment(
        target,
        row.alignment === 'right' ? 'right' : 'center'
      );
      const boxedLine = this.boxedTextLayout(
        content,
        decoration,
        font,
        size,
        Math.max(11, size * 1.35),
        [textWidth],
        alignment
      )?.[0];
      const x = boxedLine?.x ?? resolveOrderDocumentPdfAlignedTextX({
        x: content.x,
        width: content.width,
        textWidth,
        alignment
      });
      const baseline = boxedLine?.y ?? (
        placement ? content.top - size : naturalGeometry!.baseline
      );
      this.drawDecorationBox(decoration, frame);
      this.page.drawText(value, {
        x,
        y: baseline,
        size,
        font,
        color: colorFromHex(this.style.mutedTextColor)
      });
      this.drawDecorationBox(decoration, frame, true);
      if (!placement) {
        previousNaturalBoundary = { bottom: frame.bottom, boxed };
        rowY = naturalGeometry!.baseline - Math.max(11, size * 1.35);
      }
    }
  }

  private drawCanvasFooters() {
    const footer = this.canvas.elements.footer;
    const pages = [...this.doc.getPages()];
    pages.forEach((page, index) => {
      const pageNumber = index + 1;
      if (!this.shouldRenderElement(footer, pageNumber)) return;
      if (footer.positioning === 'absolute') {
        this.renderAbsoluteCanvasElement(
          footer,
          () => this.drawCanvasFooterContent(index, pages.length),
          pageNumber
        );
        return;
      }
      const previousPage = this.page;
      const previousElement = this.activeCanvasElement;
      this.page = page;
      this.activeCanvasElement = footer;
      const footerY = Math.max(19, this.defaultMargin * 0.42);
      const frame = {
        x: this.defaultMargin,
        bottom: footerY,
        width: this.defaultContentWidth,
        height: mm(footer.heightMm)
      };
      this.drawCanvasElementBox(footer, frame);
      this.drawCanvasFooterContent(index, pages.length);
      this.drawCanvasElementBox(footer, frame, true);
      this.page = previousPage;
      this.activeCanvasElement = previousElement;
    });
  }

  private drawFooters() {
    const pages = this.doc.getPages();
    const previousPage = this.page;
    pages.forEach((page, index) => {
      this.page = page;
      const footerY = Math.max(19, this.margin * 0.42);
      let rowY = footerY + 14;
      const ownerTop = footerY + mm(this.canvas.elements.footer.heightMm);
      let previousNaturalBoundary: { bottom: number; boxed: boolean } | null = null;
      for (const row of resolveOrderDocumentFooterRows(
        this.input.template,
        this.documentContext,
        index,
        pages.length
      )) {
        if (row.id !== 'page_numbers' && !this.input.template.layout.showFooter) continue;
        const target = { kind: 'field_row', group: 'footer', rowId: row.id } as const;
        const footerStyle = this.textStyle(
          target,
          { fontWeight: 'regular', fontSizePt: this.style.smallSizePt - 0.4 }
        );
        const { font, size } = footerStyle;
        const placement = this.fieldRowPlacement('footer', row.id);
        const decoration = this.rowDecoration('footer', row.id);
        const boxed = hasOrderDocumentBoxDecoration(decoration);
        const frameBaseWidth = placement?.widthMm == null
          ? this.measuredDecorationWidth(
              font.widthOfTextAtSize(row.value, size),
              decoration,
              this.contentWidth
            )
          : this.contentWidth;
        const naturalHeight = Math.max(11, size * 1.35)
          + resolveOrderDocumentDecorationInset(decoration) * 2;
        const naturalTopOffset = size + resolveOrderDocumentDecorationInset(decoration);
        const naturalGeometry: OrderDocumentPdfNaturalRowGeometry | null = placement
          ? null
          : resolveOrderDocumentPdfNaturalRowGeometry({
              desiredBaseline: rowY,
              frameTopOffset: naturalTopOffset,
              collisionTopOffset: boxed
                ? naturalTopOffset
                : font.heightAtSize(size, { descender: false }),
              previousFrameBottom: previousNaturalBoundary?.bottom,
              preventOverlap: boxed || Boolean(previousNaturalBoundary?.boxed)
            });
        const frame: PdfDecorationFrame = placement
          ? this.decorationFrame(
              placement,
              this.margin,
              ownerTop,
              frameBaseWidth,
              naturalHeight
            )
          : this.decorationFrame(
              undefined,
              this.margin,
              naturalGeometry!.top,
              this.contentWidth,
              naturalHeight
            );
        const content = this.rowContentFrame(frame, decoration);
        const value = clampText(font, row.value, size, content.width);
        const textWidth = font.widthOfTextAtSize(value, size);
        const alignment = this.singleTextAlignment(
          target,
          row.alignment === 'right' ? 'right' : 'center'
        );
        const boxedLine = this.boxedTextLayout(
          content,
          decoration,
          font,
          size,
          Math.max(11, size * 1.35),
          [textWidth],
          alignment
        )?.[0];
        const x = boxedLine?.x ?? resolveOrderDocumentPdfAlignedTextX({
          x: content.x,
          width: content.width,
          textWidth,
          alignment
        });
        const baseline = boxedLine?.y ?? (
          placement ? content.top - size : naturalGeometry!.baseline
        );
        this.drawDecorationBox(decoration, frame);
        page.drawText(value, {
          x,
          y: baseline,
          size,
          font,
          color: colorFromHex(this.style.mutedTextColor)
        });
        this.drawDecorationBox(decoration, frame, true);
        if (!placement) {
          previousNaturalBoundary = { bottom: frame.bottom, boxed };
          rowY = naturalGeometry!.baseline - Math.max(11, size * 1.35);
        }
      }
    });
    this.page = previousPage;
  }

  render() {
    this.startPage();
    if (this.canvasMode) {
      this.renderCanvasSections();
      this.drawCanvasHeaders();
      this.drawCanvasFooters();
      return;
    }
    for (const section of this.input.template.layout.sections) {
      if (section.enabled) this.drawSection(section.id);
    }
    this.drawFooters();
  }
}

export async function generateOrderPdf(input: GenerateOrderPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const logoConfig = normalizeSiteLogoConfig(input.logoConfig ?? cloneDefaultSiteLogoConfig());
  const [fonts, logoImage] = await Promise.all([
    loadOrderPdfFonts(doc, input),
    loadDocumentLogo(doc, input.logoArtwork)
  ]);
  doc.setTitle(`${input.template.text.title} ${input.documentNumber}`);
  doc.setAuthor(input.template.company.name);
  doc.setSubject(input.template.name);
  doc.setCreator('Atehna order document renderer');
  doc.setProducer('Atehna');
  doc.setCreationDate(input.issuedAt);
  doc.setModificationDate(input.issuedAt);

  const renderer = new OrderPdfRenderer(doc, fonts, logoImage, {
    ...input,
    logoConfig,
    template: {
      ...input.template,
      text: {
        ...input.template.text,
        title: toSafeText(input.template.text.title)
      }
    }
  });
  renderer.render();
  return doc.save({ useObjectStreams: false });
}
