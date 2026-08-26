export const SITE_LOGO_SETTINGS_KEY = 'website-site-logo';

export const SITE_LOGO_MASTER_KINDS = ['lockup', 'wordmark', 'symbol'] as const;
export const SITE_LOGO_MASTER_TONES = ['default', 'light', 'dark'] as const;
export const SITE_LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const;
export const SITE_LOGO_FIT_MODES = ['contain', 'fill'] as const;
export const SITE_LOGO_MASTER_MAX_COUNT = 24;
export const SITE_LOGO_PURPOSE_IDS = [
  'header-desktop',
  'header-tablet',
  'header-mobile',
  'footer-desktop',
  'footer-tablet',
  'footer-mobile',
  'standalone',
  'pdf-document',
  'favicon',
  'apple-touch-icon',
  'pwa-maskable',
  'social-share'
] as const;

export type SiteLogoMasterKind = (typeof SITE_LOGO_MASTER_KINDS)[number];
export type SiteLogoMasterTone = (typeof SITE_LOGO_MASTER_TONES)[number];
export type SiteLogoMimeType = (typeof SITE_LOGO_MIME_TYPES)[number];
export type SiteLogoFitMode = (typeof SITE_LOGO_FIT_MODES)[number];
export type SiteLogoPurposeId = (typeof SITE_LOGO_PURPOSE_IDS)[number];

export type SiteLogoNormalizedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SiteLogoPurposeDefinition = {
  id: SiteLogoPurposeId;
  label: string;
  group: 'header' | 'footer' | 'standalone' | 'document' | 'icon' | 'social';
  widthPx: number;
  heightPx: number;
  safeArea: 'rectangle' | 'circle';
  defaultSafeAreaInset: number;
};

export const SITE_LOGO_PURPOSE_CATALOG: Record<SiteLogoPurposeId, SiteLogoPurposeDefinition> = {
  'header-desktop': { id: 'header-desktop', label: 'Glava · namizje', group: 'header', widthPx: 176, heightPx: 48, safeArea: 'rectangle', defaultSafeAreaInset: 0 },
  'header-tablet': { id: 'header-tablet', label: 'Glava · tablica', group: 'header', widthPx: 144, heightPx: 44, safeArea: 'rectangle', defaultSafeAreaInset: 0 },
  'header-mobile': { id: 'header-mobile', label: 'Glava · mobilno', group: 'header', widthPx: 112, heightPx: 40, safeArea: 'rectangle', defaultSafeAreaInset: 0 },
  'footer-desktop': { id: 'footer-desktop', label: 'Noga · namizje', group: 'footer', widthPx: 176, heightPx: 56, safeArea: 'rectangle', defaultSafeAreaInset: 0 },
  'footer-tablet': { id: 'footer-tablet', label: 'Noga · tablica', group: 'footer', widthPx: 160, heightPx: 52, safeArea: 'rectangle', defaultSafeAreaInset: 0 },
  'footer-mobile': { id: 'footer-mobile', label: 'Noga · mobilno', group: 'footer', widthPx: 144, heightPx: 48, safeArea: 'rectangle', defaultSafeAreaInset: 0 },
  standalone: { id: 'standalone', label: 'Samostojni logotip', group: 'standalone', widthPx: 512, heightPx: 230, safeArea: 'rectangle', defaultSafeAreaInset: 0 },
  'pdf-document': { id: 'pdf-document', label: 'Dokumenti PDF', group: 'document', widthPx: 946, heightPx: 300, safeArea: 'rectangle', defaultSafeAreaInset: 0 },
  favicon: { id: 'favicon', label: 'Favicon', group: 'icon', widthPx: 48, heightPx: 48, safeArea: 'rectangle', defaultSafeAreaInset: 0.08 },
  'apple-touch-icon': { id: 'apple-touch-icon', label: 'Apple Touch Icon', group: 'icon', widthPx: 180, heightPx: 180, safeArea: 'rectangle', defaultSafeAreaInset: 0.1 },
  'pwa-maskable': { id: 'pwa-maskable', label: 'Maskable PWA', group: 'icon', widthPx: 512, heightPx: 512, safeArea: 'circle', defaultSafeAreaInset: 0.1 },
  'social-share': { id: 'social-share', label: 'Predogled družbenih omrežij', group: 'social', widthPx: 1200, heightPx: 630, safeArea: 'rectangle', defaultSafeAreaInset: 0.08 }
};

export const SITE_LOGO_HEADER_PURPOSE_IDS = [
  'header-desktop',
  'header-tablet',
  'header-mobile'
] as const satisfies readonly SiteLogoPurposeId[];
export type SiteLogoHeaderPurposeId = (typeof SITE_LOGO_HEADER_PURPOSE_IDS)[number];

// Preserve the old header logo's final, post-storefront-zoom size. New values
// use the same visible CSS-pixel unit as top-bar typography.
export const SITE_LOGO_HEADER_DEFAULT_DISPLAY_HEIGHT_PX: Record<SiteLogoHeaderPurposeId, number> = {
  'header-desktop': 18,
  'header-tablet': 16.5,
  'header-mobile': 15
};
export const SITE_LOGO_HEADER_DISPLAY_HEIGHT_MIN_PX = 8;
export const SITE_LOGO_HEADER_DISPLAY_HEIGHT_MAX_PX = 64;

export function isSiteLogoHeaderPurpose(purposeId: SiteLogoPurposeId): purposeId is SiteLogoHeaderPurposeId {
  return (SITE_LOGO_HEADER_PURPOSE_IDS as readonly SiteLogoPurposeId[]).includes(purposeId);
}

export const SITE_LOGO_PRIMARY_USE_CASE_IDS = ['header', 'footer', 'standalone', 'documents'] as const;
export type SiteLogoPrimaryUseCaseId = (typeof SITE_LOGO_PRIMARY_USE_CASE_IDS)[number];

export const SITE_LOGO_USE_CASE_PURPOSE_IDS: Record<SiteLogoPrimaryUseCaseId, readonly SiteLogoPurposeId[]> = {
  header: ['header-desktop', 'header-tablet', 'header-mobile'],
  footer: ['footer-desktop', 'footer-tablet', 'footer-mobile'],
  standalone: ['standalone'],
  documents: ['pdf-document']
};

export type SiteLogoMasterVariant = {
  id: string;
  label: string;
  kind: SiteLogoMasterKind;
  tone: SiteLogoMasterTone;
  url: string;
  pathname: string;
  filename: string;
  mimeType: SiteLogoMimeType;
  size: number;
  intrinsicWidth: number;
  intrinsicHeight: number;
  opticalBounds: SiteLogoNormalizedRect;
};

export const SITE_LOGO_BUILTIN_ORIGINAL_MASTER_ID = 'atehna-original';
export const SITE_LOGO_BUILTIN_ORIGINAL_MASTER: SiteLogoMasterVariant = {
  id: SITE_LOGO_BUILTIN_ORIGINAL_MASTER_ID,
  label: 'ATEHNA · izvirni barvni logotip',
  kind: 'lockup',
  tone: 'default',
  url: '/brand/atehna-document-wordmark.png',
  pathname: 'brand/atehna-document-wordmark.png',
  filename: 'atehna-document-wordmark.png',
  mimeType: 'image/png',
  size: 80384,
  intrinsicWidth: 1873,
  intrinsicHeight: 840,
  opticalBounds: { x: 0, y: 0, width: 1, height: 1 }
};

export const SITE_LOGO_BUILTIN_MASK_URLS = {
  artwork: '/brand/atehna-logo-artwork-mask.png',
  primary: '/brand/atehna-logo-primary-mask.png',
  secondary: '/brand/atehna-logo-secondary-mask.png',
  tagline: '/brand/atehna-logo-tagline-mask.png'
} as const;

export const SITE_LOGO_BUILTIN_MASK_GEOMETRY = {
  width: 1873,
  height: 840,
  finalA: { x: 1332, y: 169, width: 244, height: 222 },
  secondarySuffix: { x: 1603, y: 334, width: 163, height: 56 },
  secondaryComponentCount: 6
} as const;

export const SITE_LOGO_TAGLINE_BAND_RATIO = 500 / 840;

export const SITE_LOGO_TEXT_LAYER_IDS = ['secondaryText', 'taglineText'] as const;
export const SITE_LOGO_TEXT_FONT_FAMILIES = ['Barlow', 'Noto Sans'] as const;
export const SITE_LOGO_TEXT_FONT_STYLES = ['normal', 'italic'] as const;
export const SITE_LOGO_TEXT_FONT_WEIGHTS = [400, 500, 600, 700] as const;
export const SITE_LOGO_TEXT_ALIGNMENTS = ['left', 'center', 'right'] as const;
export const SITE_LOGO_TEXT_POSITION_MIN = -1;
export const SITE_LOGO_TEXT_POSITION_MAX = 2;
export const SITE_LOGO_TEXT_FONT_SIZE_MIN_PX = 8;
export const SITE_LOGO_TEXT_FONT_SIZE_MAX_PX = 420;
export const SITE_LOGO_TEXT_LETTER_SPACING_MIN_PX = -32;
export const SITE_LOGO_TEXT_LETTER_SPACING_MAX_PX = 128;
export const SITE_LOGO_TEXT_CONTENT_MAX_LENGTH = 180;

export type SiteLogoTextLayerId = (typeof SITE_LOGO_TEXT_LAYER_IDS)[number];
export type SiteLogoTextFontFamily = (typeof SITE_LOGO_TEXT_FONT_FAMILIES)[number];
export type SiteLogoTextFontStyle = (typeof SITE_LOGO_TEXT_FONT_STYLES)[number];
export type SiteLogoTextFontWeight = (typeof SITE_LOGO_TEXT_FONT_WEIGHTS)[number];
export type SiteLogoTextAlignment = (typeof SITE_LOGO_TEXT_ALIGNMENTS)[number];

/** x/y are normalized top-left visible-glyph coordinates in the 1873 x 840 source artwork. */
export type SiteLogoTextLayer = {
  enabled: boolean;
  content: string;
  x: number;
  y: number;
  fontFamily: SiteLogoTextFontFamily;
  fontSizePx: number;
  fontStyle: SiteLogoTextFontStyle;
  fontWeight: SiteLogoTextFontWeight;
  letterSpacingPx: number;
  textAlign: SiteLogoTextAlignment;
};

export type SiteLogoTextMaskBounds = { x: number; y: number; width: number; height: number };

export const SITE_LOGO_TEXT_MASK_BOUNDS: Record<SiteLogoTextLayerId, SiteLogoTextMaskBounds> = {
  secondaryText: { x: 1603, y: 334, width: 163, height: 56 },
  taglineText: { x: 100, y: 518, width: 1656, height: 98 }
};

export const DEFAULT_SITE_LOGO_TEXT_LAYERS: Record<SiteLogoTextLayerId, SiteLogoTextLayer> = {
  secondaryText: {
    enabled: true,
    content: 'd.o.o.',
    x: 1603 / SITE_LOGO_BUILTIN_MASK_GEOMETRY.width,
    y: 334 / SITE_LOGO_BUILTIN_MASK_GEOMETRY.height,
    fontFamily: 'Barlow',
    fontSizePx: 56,
    fontStyle: 'italic',
    fontWeight: 400,
    letterSpacingPx: 0,
    textAlign: 'left'
  },
  taglineText: {
    enabled: true,
    content: 'varčevanje z energijo',
    x: 100 / SITE_LOGO_BUILTIN_MASK_GEOMETRY.width,
    y: 518 / SITE_LOGO_BUILTIN_MASK_GEOMETRY.height,
    fontFamily: 'Noto Sans',
    fontSizePx: 98,
    fontStyle: 'normal',
    fontWeight: 400,
    letterSpacingPx: 36,
    textAlign: 'left'
  }
};

export type SiteLogoOutline = {
  enabled: boolean;
  color: string;
  widthPx: number;
};

export type SiteLogoShadow = {
  enabled: boolean;
  color: string;
  opacity: number;
  blurPx: number;
  offsetXpx: number;
  offsetYpx: number;
};

export const SITE_LOGO_CANVAS_EDGE_IDS = ['top', 'right', 'bottom', 'left'] as const;
export const SITE_LOGO_CANVAS_EDGE_MIN = -0.98;
export const SITE_LOGO_CANVAS_EDGE_MAX = 1;
export const SITE_LOGO_CANVAS_MIN_SIZE_RATIO = 0.02;
export const SITE_LOGO_COLOR_CHANNEL_IDS = [
  'background',
  'taglineBackground',
  'primary',
  'secondary',
  'tagline'
] as const;

export type SiteLogoCanvasEdgeId = (typeof SITE_LOGO_CANVAS_EDGE_IDS)[number];
export type SiteLogoColorChannelId = (typeof SITE_LOGO_COLOR_CHANNEL_IDS)[number];

/**
 * Sparse source-relative canvas adjustments. Horizontal edges use source
 * width; vertical edges use source height. Positive values extend the
 * canvas/background and negative values crop that edge. Zero is omitted.
 */
export type SiteLogoCanvasEdges = Partial<Record<SiteLogoCanvasEdgeId, number>>;

/** Sparse boolean map. Normalization omits false; missing channels stay opaque. */
export type SiteLogoTransparentColors = Partial<Record<SiteLogoColorChannelId, boolean>>;

export type ResolvedSiteLogoCanvasEdges = Record<SiteLogoCanvasEdgeId, number>;
export type ResolvedSiteLogoTransparentColors = Record<SiteLogoColorChannelId, boolean>;

export type SiteLogoCanvasLayout = {
  width: number;
  height: number;
  sourceLeft: number;
  sourceTop: number;
  sourceWidth: number;
  sourceHeight: number;
  edges: ResolvedSiteLogoCanvasEdges;
};

export type SiteLogoPresentation = {
  backgroundColor: string;
  taglineBackgroundColor: string;
  primaryTextColor: string;
  secondaryTextColor: string;
  taglineTextColor: string;
  canvasEdges: SiteLogoCanvasEdges;
  transparentColors: SiteLogoTransparentColors;
  secondaryText: SiteLogoTextLayer;
  taglineText: SiteLogoTextLayer;
  outline: SiteLogoOutline;
  shadow: SiteLogoShadow;
};

export const DEFAULT_SITE_LOGO_PRESENTATION: SiteLogoPresentation = {
  backgroundColor: '#39362D',
  taglineBackgroundColor: '#4C483D',
  primaryTextColor: '#C2A918',
  secondaryTextColor: '#AF991B',
  taglineTextColor: '#B8B8B0',
  canvasEdges: {},
  transparentColors: {},
  secondaryText: { ...DEFAULT_SITE_LOGO_TEXT_LAYERS.secondaryText },
  taglineText: { ...DEFAULT_SITE_LOGO_TEXT_LAYERS.taglineText },
  outline: { enabled: false, color: '#C2A918', widthPx: 1 },
  shadow: { enabled: false, color: '#000000', opacity: 0.28, blurPx: 8, offsetXpx: 0, offsetYpx: 3 }
};

export type SiteLogoGeometry = {
  scale: number;
  translateX: number;
  translateY: number;
  crop: SiteLogoNormalizedRect;
  safeAreaInset: number;
};

export type SiteLogoFitSuggestion = SiteLogoGeometry & {
  algorithmVersion: string;
};

export type SiteLogoGeometryOverride = Partial<SiteLogoGeometry>;

export type SiteLogoPlacement = {
  purposeId: SiteLogoPurposeId;
  enabled: boolean;
  fitMode: SiteLogoFitMode;
  masterId: string | null;
  displayHeightPx?: number | null;
  suggestion: SiteLogoFitSuggestion;
  override: SiteLogoGeometryOverride | null;
  presentation: SiteLogoPresentation;
};

export type SiteLogoConfig = {
  version: 1;
  masters: SiteLogoMasterVariant[];
  placements: Record<SiteLogoPurposeId, SiteLogoPlacement>;
  updatedAt?: string | null;
};

type UnknownRecord = Record<string, unknown>;

const FULL_RECT: SiteLogoNormalizedRect = { x: 0, y: 0, width: 1, height: 1 };
const PDF_DOCUMENT_RECT: SiteLogoNormalizedRect = { x: 0, y: 70 / 840, width: 1, height: 594 / 840 };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const asRecord = (value: unknown): UnknownRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
const asString = (value: unknown, fallback = '', maxLength = 4000) => typeof value === 'string' ? value.trim().slice(0, maxLength) : fallback;
const asNumber = (value: unknown, fallback: number, min: number, max: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : fallback;
};
const asInteger = (value: unknown, fallback: number, min: number, max: number) => Math.round(asNumber(value, fallback, min, max));
const asEnum = <T extends string>(value: unknown, values: readonly T[], fallback: T): T => values.includes(value as T) ? value as T : fallback;
const asBoolean = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback;
const asColor = (value: unknown, fallback: string) => {
  const color = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return /^#[0-9A-F]{6}$/.test(color) ? color : fallback;
};
const SITE_LOGO_TEXT_CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/gu;

export function sanitizeSiteLogoTextContent(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.replace(SITE_LOGO_TEXT_CONTROL_CHARACTERS, '').trim().slice(0, SITE_LOGO_TEXT_CONTENT_MAX_LENGTH);
}

function normalizeSiteLogoCanvasAxis(
  record: UnknownRecord,
  first: SiteLogoCanvasEdgeId,
  second: SiteLogoCanvasEdgeId
): Pick<ResolvedSiteLogoCanvasEdges, typeof first | typeof second> {
  let firstValue = record[first] === undefined
    ? 0
    : asNumber(record[first], 0, SITE_LOGO_CANVAS_EDGE_MIN, SITE_LOGO_CANVAS_EDGE_MAX);
  let secondValue = record[second] === undefined
    ? 0
    : asNumber(record[second], 0, SITE_LOGO_CANVAS_EDGE_MIN, SITE_LOGO_CANVAS_EDGE_MAX);
  const resultingSize = 1 + firstValue + secondValue;

  if (resultingSize < SITE_LOGO_CANVAS_MIN_SIZE_RATIO) {
    const positiveTotal = Math.max(0, firstValue) + Math.max(0, secondValue);
    const negativeTotal = Math.max(0, -firstValue) + Math.max(0, -secondValue);
    const allowedNegativeTotal = 1 + positiveTotal - SITE_LOGO_CANVAS_MIN_SIZE_RATIO;
    const cropScale = negativeTotal > 0 ? allowedNegativeTotal / negativeTotal : 1;
    if (firstValue < 0) firstValue *= cropScale;
    if (secondValue < 0) secondValue *= cropScale;
  }

  return { [first]: firstValue, [second]: secondValue } as Pick<
    ResolvedSiteLogoCanvasEdges,
    typeof first | typeof second
  >;
}

export function normalizeSiteLogoCanvasEdges(value: unknown): SiteLogoCanvasEdges {
  const record = asRecord(value);
  const horizontal = normalizeSiteLogoCanvasAxis(record, 'left', 'right');
  const vertical = normalizeSiteLogoCanvasAxis(record, 'top', 'bottom');
  const resolved = { ...horizontal, ...vertical } as ResolvedSiteLogoCanvasEdges;
  return Object.fromEntries(
    SITE_LOGO_CANVAS_EDGE_IDS
      .filter((edge) => Math.abs(resolved[edge]) > Number.EPSILON)
      .map((edge) => [edge, resolved[edge]])
  ) as SiteLogoCanvasEdges;
}

export function resolveSiteLogoCanvasEdges(value: unknown): ResolvedSiteLogoCanvasEdges {
  const normalized = normalizeSiteLogoCanvasEdges(value);
  return {
    top: normalized.top ?? 0,
    right: normalized.right ?? 0,
    bottom: normalized.bottom ?? 0,
    left: normalized.left ?? 0
  };
}

export function normalizeSiteLogoTransparentColors(value: unknown): SiteLogoTransparentColors {
  const record = asRecord(value);
  return Object.fromEntries(
    SITE_LOGO_COLOR_CHANNEL_IDS
      .filter((channel) => record[channel] === true)
      .map((channel) => [channel, true])
  ) as SiteLogoTransparentColors;
}

export function resolveSiteLogoTransparentColors(value: unknown): ResolvedSiteLogoTransparentColors {
  const normalized = normalizeSiteLogoTransparentColors(value);
  return Object.fromEntries(
    SITE_LOGO_COLOR_CHANNEL_IDS.map((channel) => [channel, normalized[channel] === true])
  ) as ResolvedSiteLogoTransparentColors;
}

/** Derives deterministic integer canvas dimensions and source offsets. */
export function resolveSiteLogoCanvasLayout(
  intrinsicWidth: number,
  intrinsicHeight: number,
  value: unknown
): SiteLogoCanvasLayout {
  const sourceWidth = Math.max(1, Math.round(Number.isFinite(intrinsicWidth) ? intrinsicWidth : 1));
  const sourceHeight = Math.max(1, Math.round(Number.isFinite(intrinsicHeight) ? intrinsicHeight : 1));
  const edges = resolveSiteLogoCanvasEdges(value);
  const sourceLeft = Math.round(sourceWidth * edges.left);
  const sourceTop = Math.round(sourceHeight * edges.top);
  const right = Math.round(sourceWidth * edges.right);
  const bottom = Math.round(sourceHeight * edges.bottom);
  return {
    width: Math.max(1, sourceWidth + sourceLeft + right),
    height: Math.max(1, sourceHeight + sourceTop + bottom),
    sourceLeft,
    sourceTop,
    sourceWidth,
    sourceHeight,
    edges
  };
}

export type SiteLogoNormalizedPoint = { x: number; y: number };

export function mapSiteLogoSourcePointToCanvas(
  layout: SiteLogoCanvasLayout,
  point: SiteLogoNormalizedPoint
): SiteLogoNormalizedPoint {
  return {
    x: (layout.sourceLeft + point.x * layout.sourceWidth) / layout.width,
    y: (layout.sourceTop + point.y * layout.sourceHeight) / layout.height
  };
}

export function mapSiteLogoCanvasPointToSource(
  layout: SiteLogoCanvasLayout,
  point: SiteLogoNormalizedPoint
): SiteLogoNormalizedPoint {
  return {
    x: (point.x * layout.width - layout.sourceLeft) / layout.sourceWidth,
    y: (point.y * layout.height - layout.sourceTop) / layout.sourceHeight
  };
}

export function mapSiteLogoCanvasDeltaToSource(
  layout: SiteLogoCanvasLayout,
  delta: SiteLogoNormalizedPoint
): SiteLogoNormalizedPoint {
  return {
    x: delta.x * layout.width / layout.sourceWidth,
    y: delta.y * layout.height / layout.sourceHeight
  };
}

function normalizeTextLayer(value: unknown, layerId: SiteLogoTextLayerId): SiteLogoTextLayer {
  const fallback = DEFAULT_SITE_LOGO_TEXT_LAYERS[layerId];
  const record = asRecord(value);
  const fontWeight = SITE_LOGO_TEXT_FONT_WEIGHTS.includes(record.fontWeight as SiteLogoTextFontWeight)
    ? record.fontWeight as SiteLogoTextFontWeight
    : fallback.fontWeight;
  return {
    enabled: asBoolean(record.enabled, fallback.enabled),
    content: sanitizeSiteLogoTextContent(record.content, fallback.content),
    x: asNumber(record.x, fallback.x, SITE_LOGO_TEXT_POSITION_MIN, SITE_LOGO_TEXT_POSITION_MAX),
    y: asNumber(record.y, fallback.y, SITE_LOGO_TEXT_POSITION_MIN, SITE_LOGO_TEXT_POSITION_MAX),
    fontFamily: asEnum(record.fontFamily, SITE_LOGO_TEXT_FONT_FAMILIES, fallback.fontFamily),
    fontSizePx: asNumber(record.fontSizePx, fallback.fontSizePx, SITE_LOGO_TEXT_FONT_SIZE_MIN_PX, SITE_LOGO_TEXT_FONT_SIZE_MAX_PX),
    fontStyle: asEnum(record.fontStyle, SITE_LOGO_TEXT_FONT_STYLES, fallback.fontStyle),
    fontWeight,
    letterSpacingPx: asNumber(record.letterSpacingPx, fallback.letterSpacingPx, SITE_LOGO_TEXT_LETTER_SPACING_MIN_PX, SITE_LOGO_TEXT_LETTER_SPACING_MAX_PX),
    textAlign: asEnum(record.textAlign, SITE_LOGO_TEXT_ALIGNMENTS, fallback.textAlign)
  };
}

function normalizeRect(value: unknown, fallback: SiteLogoNormalizedRect = FULL_RECT): SiteLogoNormalizedRect {
  const record = asRecord(value);
  const x = asNumber(record.x, fallback.x, 0, 1);
  const y = asNumber(record.y, fallback.y, 0, 1);
  const width = Math.min(asNumber(record.width, fallback.width, 0.0001, 1), 1 - x);
  const height = Math.min(asNumber(record.height, fallback.height, 0.0001, 1), 1 - y);
  return { x, y, width: Math.max(0.0001, width), height: Math.max(0.0001, height) };
}

function defaultSuggestion(purposeId: SiteLogoPurposeId): SiteLogoFitSuggestion {
  return {
    scale: 1,
    translateX: 0,
    translateY: 0,
    crop: clone(purposeId === 'pdf-document' ? PDF_DOCUMENT_RECT : FULL_RECT),
    safeAreaInset: SITE_LOGO_PURPOSE_CATALOG[purposeId].defaultSafeAreaInset,
    algorithmVersion: purposeId === 'pdf-document' ? 'atehna-document-crop-v1' : 'optical-fit-v1'
  };
}

function defaultPlacement(purposeId: SiteLogoPurposeId): SiteLogoPlacement {
  return {
    purposeId,
    enabled: true,
    fitMode: purposeId === 'pdf-document' ? 'fill' : 'contain',
    masterId: purposeId === 'standalone' || purposeId === 'pdf-document' ? SITE_LOGO_BUILTIN_ORIGINAL_MASTER_ID : null,
    displayHeightPx: null,
    suggestion: defaultSuggestion(purposeId),
    override: null,
    presentation: clone(DEFAULT_SITE_LOGO_PRESENTATION)
  };
}

export const DEFAULT_SITE_LOGO_CONFIG: SiteLogoConfig = {
  version: 1,
  masters: [],
  placements: Object.fromEntries(SITE_LOGO_PURPOSE_IDS.map((purposeId) => [purposeId, defaultPlacement(purposeId)])) as Record<SiteLogoPurposeId, SiteLogoPlacement>,
  updatedAt: null
};

export function cloneDefaultSiteLogoConfig(): SiteLogoConfig {
  return clone(DEFAULT_SITE_LOGO_CONFIG);
}

function normalizeMaster(value: unknown, index: number): SiteLogoMasterVariant | null {
  const record = asRecord(value);
  const id = asString(record.id, `logo-${index + 1}`, 80).replace(/[^a-zA-Z0-9._-]/g, '-');
  const url = asString(record.url, '', 4000);
  const pathname = asString(record.pathname, '', 1000);
  if (!id || !url || !pathname) return null;
  return {
    id,
    label: asString(record.label, `Logotip ${index + 1}`, 120),
    kind: asEnum(record.kind, SITE_LOGO_MASTER_KINDS, 'lockup'),
    tone: asEnum(record.tone, SITE_LOGO_MASTER_TONES, 'default'),
    url,
    pathname,
    filename: asString(record.filename, 'logo', 255),
    mimeType: asEnum(record.mimeType, SITE_LOGO_MIME_TYPES, 'image/png'),
    size: asInteger(record.size, 0, 0, 10 * 1024 * 1024),
    intrinsicWidth: asInteger(record.intrinsicWidth, 1, 1, 32768),
    intrinsicHeight: asInteger(record.intrinsicHeight, 1, 1, 32768),
    opticalBounds: normalizeRect(record.opticalBounds)
  };
}

function normalizeGeometry(value: unknown, fallback: SiteLogoFitSuggestion): SiteLogoFitSuggestion {
  const record = asRecord(value);
  return {
    scale: asNumber(record.scale, fallback.scale, 0.05, 20),
    translateX: asNumber(record.translateX, fallback.translateX, -2, 2),
    translateY: asNumber(record.translateY, fallback.translateY, -2, 2),
    crop: normalizeRect(record.crop, fallback.crop),
    safeAreaInset: asNumber(record.safeAreaInset, fallback.safeAreaInset, 0, 0.45),
    algorithmVersion: asString(record.algorithmVersion, fallback.algorithmVersion, 80)
  };
}

function normalizeOverride(value: unknown): SiteLogoGeometryOverride | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as UnknownRecord;
  const result: SiteLogoGeometryOverride = {};
  if (record.scale !== undefined) result.scale = asNumber(record.scale, 1, 0.05, 20);
  if (record.translateX !== undefined) result.translateX = asNumber(record.translateX, 0, -2, 2);
  if (record.translateY !== undefined) result.translateY = asNumber(record.translateY, 0, -2, 2);
  if (record.crop !== undefined) result.crop = normalizeRect(record.crop);
  if (record.safeAreaInset !== undefined) result.safeAreaInset = asNumber(record.safeAreaInset, 0, 0, 0.45);
  return Object.keys(result).length > 0 ? result : null;
}

function normalizePresentation(value: unknown): SiteLogoPresentation {
  const record = asRecord(value);
  const outline = asRecord(record.outline);
  const shadow = asRecord(record.shadow);
  return {
    backgroundColor: asColor(record.backgroundColor, DEFAULT_SITE_LOGO_PRESENTATION.backgroundColor),
    taglineBackgroundColor: asColor(record.taglineBackgroundColor, DEFAULT_SITE_LOGO_PRESENTATION.taglineBackgroundColor),
    primaryTextColor: asColor(record.primaryTextColor, DEFAULT_SITE_LOGO_PRESENTATION.primaryTextColor),
    secondaryTextColor: asColor(record.secondaryTextColor, DEFAULT_SITE_LOGO_PRESENTATION.secondaryTextColor),
    taglineTextColor: asColor(record.taglineTextColor, DEFAULT_SITE_LOGO_PRESENTATION.taglineTextColor),
    canvasEdges: normalizeSiteLogoCanvasEdges(record.canvasEdges),
    transparentColors: normalizeSiteLogoTransparentColors(record.transparentColors),
    secondaryText: normalizeTextLayer(record.secondaryText, 'secondaryText'),
    taglineText: normalizeTextLayer(record.taglineText, 'taglineText'),
    outline: {
      enabled: asBoolean(outline.enabled, DEFAULT_SITE_LOGO_PRESENTATION.outline.enabled),
      color: asColor(outline.color, DEFAULT_SITE_LOGO_PRESENTATION.outline.color),
      widthPx: asNumber(outline.widthPx, DEFAULT_SITE_LOGO_PRESENTATION.outline.widthPx, 0, 24)
    },
    shadow: {
      enabled: asBoolean(shadow.enabled, DEFAULT_SITE_LOGO_PRESENTATION.shadow.enabled),
      color: asColor(shadow.color, DEFAULT_SITE_LOGO_PRESENTATION.shadow.color),
      opacity: asNumber(shadow.opacity, DEFAULT_SITE_LOGO_PRESENTATION.shadow.opacity, 0, 1),
      blurPx: asNumber(shadow.blurPx, DEFAULT_SITE_LOGO_PRESENTATION.shadow.blurPx, 0, 64),
      offsetXpx: asNumber(shadow.offsetXpx, DEFAULT_SITE_LOGO_PRESENTATION.shadow.offsetXpx, -64, 64),
      offsetYpx: asNumber(shadow.offsetYpx, DEFAULT_SITE_LOGO_PRESENTATION.shadow.offsetYpx, -64, 64)
    }
  };
}

export function normalizeSiteLogoConfig(value: unknown): SiteLogoConfig {
  const record = asRecord(value);
  const masters = Array.isArray(record.masters)
    ? record.masters.map(normalizeMaster).filter((master): master is SiteLogoMasterVariant => Boolean(master)).slice(0, 30)
    : [];
  const masterIds = new Set([...masters.map((master) => master.id), SITE_LOGO_BUILTIN_ORIGINAL_MASTER_ID]);
  const placementsRecord = asRecord(record.placements);
  const placements = Object.fromEntries(SITE_LOGO_PURPOSE_IDS.map((purposeId) => {
    const raw = asRecord(placementsRecord[purposeId]);
    const fallback = defaultPlacement(purposeId);
    const headerPurpose = isSiteLogoHeaderPurpose(purposeId);
    const hasExplicitDisplayHeight = raw.displayHeightPx !== undefined && raw.displayHeightPx !== null;
    const displayHeightPx = headerPurpose && hasExplicitDisplayHeight
      ? asNumber(
          raw.displayHeightPx,
          SITE_LOGO_HEADER_DEFAULT_DISPLAY_HEIGHT_PX[purposeId],
          SITE_LOGO_HEADER_DISPLAY_HEIGHT_MIN_PX,
          SITE_LOGO_HEADER_DISPLAY_HEIGHT_MAX_PX
        )
      : null;
    const hasExplicitMasterId = Object.prototype.hasOwnProperty.call(raw, 'masterId');
    const enabled = typeof raw.enabled === 'boolean' ? raw.enabled : fallback.enabled;
    const normalizedMasterId = hasExplicitMasterId
      ? typeof raw.masterId === 'string' && masterIds.has(raw.masterId) ? raw.masterId : null
      : fallback.masterId;
    const masterId = headerPurpose && displayHeightPx != null && enabled && normalizedMasterId === null
      ? SITE_LOGO_BUILTIN_ORIGINAL_MASTER_ID
      : normalizedMasterId;
    return [purposeId, {
      purposeId,
      enabled,
      fitMode: asEnum(raw.fitMode, SITE_LOGO_FIT_MODES, fallback.fitMode),
      masterId,
      displayHeightPx,
      suggestion: normalizeGeometry(raw.suggestion, fallback.suggestion),
      override: normalizeOverride(raw.override),
      presentation: normalizePresentation(raw.presentation)
    } satisfies SiteLogoPlacement];
  })) as Record<SiteLogoPurposeId, SiteLogoPlacement>;

  return {
    version: 1,
    masters,
    placements,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : typeof record.updated_at === 'string' ? record.updated_at : null
  };
}

export function toStoredSiteLogoConfig(value: unknown): SiteLogoConfig {
  const normalized = normalizeSiteLogoConfig(value);
  const { updatedAt: _updatedAt, ...stored } = normalized;
  return stored;
}

export function resolveSiteLogoGeometry(placement: SiteLogoPlacement): SiteLogoGeometry {
  return {
    scale: placement.override?.scale ?? placement.suggestion.scale,
    translateX: placement.override?.translateX ?? placement.suggestion.translateX,
    translateY: placement.override?.translateY ?? placement.suggestion.translateY,
    crop: placement.override?.crop ?? placement.suggestion.crop,
    safeAreaInset: placement.override?.safeAreaInset ?? placement.suggestion.safeAreaInset
  };
}

export type SiteLogoFittedArtworkRect = {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
};

/** Shared top-left placement math for browser, generated image, and PDF output. */
export function resolveSiteLogoFittedArtworkRect({
  sourceWidth,
  sourceHeight,
  viewportWidth,
  viewportHeight,
  geometry,
  fitMode,
  artworkScale = 1
}: {
  sourceWidth: number;
  sourceHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  geometry: SiteLogoGeometry;
  fitMode: SiteLogoFitMode;
  artworkScale?: number;
}): SiteLogoFittedArtworkRect {
  const normalizedSourceWidth = Math.max(0.0001, sourceWidth);
  const normalizedSourceHeight = Math.max(0.0001, sourceHeight);
  const normalizedViewportWidth = Math.max(1, viewportWidth);
  const normalizedViewportHeight = Math.max(1, viewportHeight);
  const crop = geometry.crop;
  const safeWidth = Math.max(1, normalizedViewportWidth * (1 - geometry.safeAreaInset * 2));
  const safeHeight = Math.max(1, normalizedViewportHeight * (1 - geometry.safeAreaInset * 2));
  const cropWidth = Math.max(0.0001, normalizedSourceWidth * crop.width);
  const cropHeight = Math.max(0.0001, normalizedSourceHeight * crop.height);
  const baseScale = fitMode === 'fill'
    ? Math.max(safeWidth / cropWidth, safeHeight / cropHeight)
    : Math.min(safeWidth / cropWidth, safeHeight / cropHeight);
  const scale = baseScale * artworkScale;
  const width = normalizedSourceWidth * scale;
  const height = normalizedSourceHeight * scale;
  const renderedCropWidth = cropWidth * scale;
  const renderedCropHeight = cropHeight * scale;
  return {
    left: normalizedViewportWidth * geometry.safeAreaInset
      + (safeWidth - renderedCropWidth) / 2
      - crop.x * width
      + geometry.translateX * normalizedViewportWidth,
    top: normalizedViewportHeight * geometry.safeAreaInset
      + (safeHeight - renderedCropHeight) / 2
      - crop.y * height
      + geometry.translateY * normalizedViewportHeight,
    width,
    height,
    scale
  };
}

export type SiteLogoDisplaySize = {
  widthPx: number;
  heightPx: number;
  explicit: boolean;
};

export function resolveSiteLogoDisplaySize(
  purposeId: SiteLogoPurposeId,
  placement: Pick<SiteLogoPlacement, 'displayHeightPx' | 'suggestion' | 'override'>
): SiteLogoDisplaySize | null {
  if (!isSiteLogoHeaderPurpose(purposeId)) return null;
  const purpose = SITE_LOGO_PURPOSE_CATALOG[purposeId];
  const explicit = placement.displayHeightPx !== undefined && placement.displayHeightPx !== null;
  const heightPx = asNumber(
    placement.displayHeightPx
      ?? SITE_LOGO_HEADER_DEFAULT_DISPLAY_HEIGHT_PX[purposeId],
    SITE_LOGO_HEADER_DEFAULT_DISPLAY_HEIGHT_PX[purposeId],
    SITE_LOGO_HEADER_DISPLAY_HEIGHT_MIN_PX,
    SITE_LOGO_HEADER_DISPLAY_HEIGHT_MAX_PX
  );

  return {
    widthPx: heightPx * (purpose.widthPx / purpose.heightPx),
    heightPx,
    explicit
  };
}

export function resolveSiteLogoPresentation(
  placement?: { presentation?: unknown } | null
): SiteLogoPresentation {
  return normalizePresentation(placement?.presentation);
}

export function resolveSiteLogoTextLayer(
  presentation: SiteLogoPresentation,
  layerId: SiteLogoTextLayerId
): SiteLogoTextLayer {
  return normalizeTextLayer(presentation[layerId], layerId);
}

export function isDefaultSiteLogoTextLayer(layer: SiteLogoTextLayer, layerId: SiteLogoTextLayerId): boolean {
  return JSON.stringify(normalizeTextLayer(layer, layerId)) === JSON.stringify(DEFAULT_SITE_LOGO_TEXT_LAYERS[layerId]);
}

/** Position and size deliberately do not affect whether the authentic mask can be transformed. */
export function usesCanonicalSiteLogoTextMask(layer: SiteLogoTextLayer, layerId: SiteLogoTextLayerId): boolean {
  const normalized = normalizeTextLayer(layer, layerId);
  const fallback = DEFAULT_SITE_LOGO_TEXT_LAYERS[layerId];
  return normalized.content === fallback.content
    && normalized.fontFamily === fallback.fontFamily
    && normalized.fontStyle === fallback.fontStyle
    && normalized.fontWeight === fallback.fontWeight
    && normalized.letterSpacingPx === fallback.letterSpacingPx;
}

export function updateSiteLogoTextLayer(
  config: SiteLogoConfig,
  purposeId: SiteLogoPurposeId,
  layerId: SiteLogoTextLayerId,
  patch: Partial<SiteLogoTextLayer>
): SiteLogoConfig {
  const placement = config.placements[purposeId];
  const presentation = resolveSiteLogoPresentation(placement);
  return {
    ...config,
    placements: {
      ...config.placements,
      [purposeId]: {
        ...placement,
        presentation: {
          ...presentation,
          [layerId]: normalizeTextLayer({ ...presentation[layerId], ...patch }, layerId)
        }
      }
    }
  };
}

export function resetSiteLogoTextLayer(
  config: SiteLogoConfig,
  purposeId: SiteLogoPurposeId,
  layerId: SiteLogoTextLayerId
): SiteLogoConfig {
  const placement = config.placements[purposeId];
  const presentation = resolveSiteLogoPresentation(placement);
  return {
    ...config,
    placements: {
      ...config.placements,
      [purposeId]: {
        ...placement,
        presentation: {
          ...presentation,
          [layerId]: { ...DEFAULT_SITE_LOGO_TEXT_LAYERS[layerId] }
        }
      }
    }
  };
}

export function updateSiteLogoCanvasEdges(
  config: SiteLogoConfig,
  purposeId: SiteLogoPurposeId,
  patch: Partial<Record<SiteLogoCanvasEdgeId, number | null | undefined>>
): SiteLogoConfig {
  const placement = config.placements[purposeId];
  const presentation = resolveSiteLogoPresentation(placement);
  const nextEdges: Record<string, unknown> = { ...presentation.canvasEdges };
  for (const edge of SITE_LOGO_CANVAS_EDGE_IDS) {
    if (!Object.prototype.hasOwnProperty.call(patch, edge)) continue;
    const value = patch[edge];
    if (value == null || value === 0) delete nextEdges[edge];
    else nextEdges[edge] = value;
  }
  return {
    ...config,
    placements: {
      ...config.placements,
      [purposeId]: {
        ...placement,
        presentation: {
          ...presentation,
          canvasEdges: normalizeSiteLogoCanvasEdges(nextEdges)
        }
      }
    }
  };
}

export function updateSiteLogoColorTransparency(
  config: SiteLogoConfig,
  purposeId: SiteLogoPurposeId,
  channel: SiteLogoColorChannelId,
  transparent: boolean
): SiteLogoConfig {
  const placement = config.placements[purposeId];
  const presentation = resolveSiteLogoPresentation(placement);
  const nextTransparentColors: Record<string, unknown> = { ...presentation.transparentColors };
  if (transparent) nextTransparentColors[channel] = true;
  else delete nextTransparentColors[channel];
  return {
    ...config,
    placements: {
      ...config.placements,
      [purposeId]: {
        ...placement,
        presentation: {
          ...presentation,
          transparentColors: normalizeSiteLogoTransparentColors(nextTransparentColors)
        }
      }
    }
  };
}

export function isDefaultSiteLogoPresentation(presentation: SiteLogoPresentation): boolean {
  return JSON.stringify(resolveSiteLogoPresentation({ presentation })) === JSON.stringify(DEFAULT_SITE_LOGO_PRESENTATION);
}

export function isBuiltInAtehnaLogoMaster(
  masterOrId: SiteLogoMasterVariant | string | null | undefined
): boolean {
  return (typeof masterOrId === 'string' ? masterOrId : masterOrId?.id) === SITE_LOGO_BUILTIN_ORIGINAL_MASTER_ID;
}

export function isTrustedSiteLogoMasterSource(
  master: Pick<SiteLogoMasterVariant, 'url' | 'pathname'>
): boolean {
  const normalizedPathname = master.pathname.trim().replace(/^\/+/, '');
  if (!/^site-logo\/masters\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/u.test(normalizedPathname)) {
    return false;
  }
  try {
    const url = new URL(master.url);
    const urlPathname = url.pathname.replace(/^\/+/, '');
    return url.protocol === 'https:'
      && !url.username
      && !url.password
      && !url.port
      && !url.search
      && !url.hash
      && !url.pathname.includes('%')
      && /(?:^|\.)blob\.vercel-storage\.com$/iu.test(url.hostname)
      && urlPathname === normalizedPathname;
  } catch {
    return false;
  }
}

export function resolveSiteLogoMaster(
  config: SiteLogoConfig,
  purposeId: SiteLogoPurposeId
): SiteLogoMasterVariant | null {
  const masterId = config.placements[purposeId]?.masterId;
  if (!masterId) return null;
  if (isBuiltInAtehnaLogoMaster(masterId)) return clone(SITE_LOGO_BUILTIN_ORIGINAL_MASTER);
  return config.masters.find((master) => master.id === masterId) ?? null;
}

export type SiteLogoPlacementCopyOptions = {
  enabled?: boolean;
  master?: boolean;
  presentation?: boolean;
  geometry?: boolean;
};

export function suggestSiteLogoPlacement(
  config: SiteLogoConfig,
  sourcePurposeId: SiteLogoPurposeId,
  targetPurposeId: SiteLogoPurposeId
): SiteLogoPlacement {
  const source = config.placements[sourcePurposeId] ?? defaultPlacement(sourcePurposeId);
  const target = config.placements[targetPurposeId] ?? defaultPlacement(targetPurposeId);
  return {
    ...clone(target),
    masterId: source.masterId,
    presentation: resolveSiteLogoPresentation(source)
  };
}

export function copySiteLogoPlacement(
  config: SiteLogoConfig,
  sourcePurposeId: SiteLogoPurposeId,
  targetPurposeId: SiteLogoPurposeId,
  options: SiteLogoPlacementCopyOptions = {}
): SiteLogoConfig {
  const source = config.placements[sourcePurposeId] ?? defaultPlacement(sourcePurposeId);
  const target = config.placements[targetPurposeId] ?? defaultPlacement(targetPurposeId);
  const copyEnabled = options.enabled ?? false;
  const copyMaster = options.master ?? true;
  const copyPresentation = options.presentation ?? true;
  const copyGeometry = options.geometry ?? false;
  return {
    ...clone(config),
    placements: {
      ...clone(config.placements),
      [targetPurposeId]: {
        ...clone(target),
        ...(copyEnabled ? { enabled: source.enabled } : {}),
        ...(copyMaster ? { masterId: source.masterId } : {}),
        ...(copyPresentation ? { presentation: resolveSiteLogoPresentation(source) } : {}),
        ...(copyGeometry ? {
          fitMode: source.fitMode,
          suggestion: clone(source.suggestion),
          override: clone(source.override),
          ...(isSiteLogoHeaderPurpose(sourcePurposeId) && isSiteLogoHeaderPurpose(targetPurposeId)
            ? { displayHeightPx: source.displayHeightPx ?? null }
            : {})
        } : {}),
        purposeId: targetPurposeId
      }
    }
  };
}

export function getSiteLogoPresentationCapabilities(
  masterOrId: SiteLogoMasterVariant | string | null | undefined
) {
  const artworkColors = isBuiltInAtehnaLogoMaster(masterOrId);
  return {
    backgroundColors: true,
    artworkColors,
    editableText: artworkColors,
    outline: true,
    shadow: true
  } as const;
}

export function validateSiteLogoConfigInput(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['Nastavitve logotipa niso veljavne.'];
  const record = value as UnknownRecord;
  const errors: string[] = [];
  if (!Array.isArray(record.masters)) errors.push('Seznam glavnih različic manjka.');
  else if (record.masters.length > SITE_LOGO_MASTER_MAX_COUNT) errors.push('Seznam glavnih različic je predolg.');
  if (!record.placements || typeof record.placements !== 'object' || Array.isArray(record.placements)) errors.push('Nastavitve mest uporabe manjkajo.');
  if (Array.isArray(record.masters)) {
    const ids = new Set<string>();
    for (const [index, entry] of record.masters.entries()) {
      const master = asRecord(entry);
      const id = asString(master.id, '', 80);
      if (!id || !/^[a-zA-Z0-9._-]+$/.test(id)) errors.push(`ID glavne različice ${index + 1} ni veljaven.`);
      if (ids.has(id)) errors.push(`ID glavne različice ${id} je podvojen.`);
      ids.add(id);
      if (!SITE_LOGO_MASTER_KINDS.includes(master.kind as SiteLogoMasterKind)) errors.push(`Vrsta glavne različice ${index + 1} ni veljavna.`);
      if (!SITE_LOGO_MASTER_TONES.includes(master.tone as SiteLogoMasterTone)) errors.push(`Tonska različica ${index + 1} ni veljavna.`);
      if (!SITE_LOGO_MIME_TYPES.includes(master.mimeType as SiteLogoMimeType)) errors.push(`Vrsta datoteke glavne različice ${index + 1} ni dovoljena.`);
      if (!asString(master.url) || !asString(master.pathname)) errors.push(`Vir glavne različice ${index + 1} manjka.`);
      if (asString(master.url) && asString(master.pathname) && !isTrustedSiteLogoMasterSource({
        url: asString(master.url),
        pathname: asString(master.pathname)
      })) errors.push(`Vir glavne različice ${index + 1} ni zaupanja vreden.`);
      if (
        typeof master.size !== 'number'
        || !Number.isInteger(master.size)
        || master.size < 1
        || master.size > 10 * 1024 * 1024
      ) errors.push(`Velikost datoteke glavne različice ${index + 1} ni veljavna.`);
      if (
        typeof master.intrinsicWidth !== 'number'
        || typeof master.intrinsicHeight !== 'number'
        || !Number.isInteger(master.intrinsicWidth)
        || !Number.isInteger(master.intrinsicHeight)
        || master.intrinsicWidth < 1
        || master.intrinsicHeight < 1
        || master.intrinsicWidth > 32768
        || master.intrinsicHeight > 32768
      ) errors.push(`Mere glavne različice ${index + 1} niso veljavne.`);
      const bounds = asRecord(master.opticalBounds);
      const x = Number(bounds.x); const y = Number(bounds.y); const width = Number(bounds.width); const height = Number(bounds.height);
      if (![x, y, width, height].every(Number.isFinite) || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1.000001 || y + height > 1.000001) errors.push(`Optične meje glavne različice ${index + 1} niso veljavne.`);
    }
  }
  const placementRecord = asRecord(record.placements);
  const knownMasterIds = new Set([
    SITE_LOGO_BUILTIN_ORIGINAL_MASTER_ID,
    ...(Array.isArray(record.masters)
      ? record.masters.map((entry) => asString(asRecord(entry).id, '', 80)).filter(Boolean)
      : [])
  ]);
  const isValidColor = (input: unknown) => typeof input === 'string' && /^#[0-9A-F]{6}$/iu.test(input.trim());
  for (const purposeId of SITE_LOGO_PURPOSE_IDS) {
    if (!(purposeId in placementRecord)) {
      errors.push(`Mesto uporabe ${purposeId} manjka.`);
      continue;
    }
    const placement = asRecord(placementRecord[purposeId]);
    if (placement.fitMode !== undefined && !SITE_LOGO_FIT_MODES.includes(placement.fitMode as SiteLogoFitMode)) {
      errors.push(`Način prilagajanja za ${purposeId} ni veljaven.`);
    }
    if (
      placement.masterId !== undefined
      && placement.masterId !== null
      && (typeof placement.masterId !== 'string' || !knownMasterIds.has(placement.masterId))
    ) {
      errors.push(`Izbrani glavni logotip za ${purposeId} ni veljaven.`);
    }
    if (placement.displayHeightPx !== undefined && placement.displayHeightPx !== null) {
      const displayHeightPx = Number(placement.displayHeightPx);
      if (
        !isSiteLogoHeaderPurpose(purposeId)
        || typeof placement.displayHeightPx !== 'number'
        || !Number.isFinite(displayHeightPx)
        || displayHeightPx < SITE_LOGO_HEADER_DISPLAY_HEIGHT_MIN_PX
        || displayHeightPx > SITE_LOGO_HEADER_DISPLAY_HEIGHT_MAX_PX
      ) {
        errors.push(`Višina logotipa za ${purposeId} ni veljavna.`);
      }
    }
    if (placement.presentation === undefined) continue;
    const presentation = asRecord(placement.presentation);
    for (const field of [
      'backgroundColor',
      'taglineBackgroundColor',
      'primaryTextColor',
      'secondaryTextColor',
      'taglineTextColor'
    ]) {
      if (!isValidColor(presentation[field])) errors.push(`Barva ${field} za ${purposeId} ni veljavna.`);
    }
    if (presentation.canvasEdges !== undefined) {
      if (!presentation.canvasEdges || typeof presentation.canvasEdges !== 'object' || Array.isArray(presentation.canvasEdges)) {
        errors.push(`Robovi platna za ${purposeId} niso veljavni.`);
      } else {
        const canvasEdges = asRecord(presentation.canvasEdges);
        for (const edge of SITE_LOGO_CANVAS_EDGE_IDS) {
          if (canvasEdges[edge] === undefined) continue;
          const numeric = Number(canvasEdges[edge]);
          if (
            typeof canvasEdges[edge] !== 'number'
            || !Number.isFinite(numeric)
            || numeric < SITE_LOGO_CANVAS_EDGE_MIN
            || numeric > SITE_LOGO_CANVAS_EDGE_MAX
          ) {
            errors.push(`Rob platna ${edge} za ${purposeId} ni veljaven.`);
          }
        }
        const left = typeof canvasEdges.left === 'number' ? canvasEdges.left : 0;
        const right = typeof canvasEdges.right === 'number' ? canvasEdges.right : 0;
        const top = typeof canvasEdges.top === 'number' ? canvasEdges.top : 0;
        const bottom = typeof canvasEdges.bottom === 'number' ? canvasEdges.bottom : 0;
        if (1 + left + right < SITE_LOGO_CANVAS_MIN_SIZE_RATIO - Number.EPSILON) {
          errors.push(`Vodoravni izrez platna za ${purposeId} je prevelik.`);
        }
        if (1 + top + bottom < SITE_LOGO_CANVAS_MIN_SIZE_RATIO - Number.EPSILON) {
          errors.push(`Navpični izrez platna za ${purposeId} je prevelik.`);
        }
      }
    }
    if (presentation.transparentColors !== undefined) {
      if (!presentation.transparentColors || typeof presentation.transparentColors !== 'object' || Array.isArray(presentation.transparentColors)) {
        errors.push(`Prosojnost barv za ${purposeId} ni veljavna.`);
      } else {
        const transparentColors = asRecord(presentation.transparentColors);
        for (const channel of SITE_LOGO_COLOR_CHANNEL_IDS) {
          if (transparentColors[channel] !== undefined && typeof transparentColors[channel] !== 'boolean') {
            errors.push(`Prosojnost barve ${channel} za ${purposeId} ni veljavna.`);
          }
        }
      }
    }
    const outline = asRecord(presentation.outline);
    for (const layerId of SITE_LOGO_TEXT_LAYER_IDS) {
      if (presentation[layerId] === undefined) continue;
      const layer = asRecord(presentation[layerId]);
      if (typeof layer.enabled !== 'boolean') errors.push(`Besedilna plast ${layerId} za ${purposeId} nima veljavne vidnosti.`);
      if (
        typeof layer.content !== 'string'
        || layer.content.length > SITE_LOGO_TEXT_CONTENT_MAX_LENGTH
        || SITE_LOGO_TEXT_CONTROL_CHARACTERS.test(layer.content)
      ) {
        errors.push(`Vsebina besedilne plasti ${layerId} za ${purposeId} ni veljavna.`);
      }
      SITE_LOGO_TEXT_CONTROL_CHARACTERS.lastIndex = 0;
      for (const coordinate of ['x', 'y'] as const) {
        const numeric = Number(layer[coordinate]);
        if (typeof layer[coordinate] !== 'number' || !Number.isFinite(numeric) || numeric < SITE_LOGO_TEXT_POSITION_MIN || numeric > SITE_LOGO_TEXT_POSITION_MAX) {
          errors.push(`Položaj ${coordinate} besedilne plasti ${layerId} za ${purposeId} ni veljaven.`);
        }
      }
      if (!SITE_LOGO_TEXT_FONT_FAMILIES.includes(layer.fontFamily as SiteLogoTextFontFamily)) errors.push(`Pisava besedilne plasti ${layerId} za ${purposeId} ni veljavna.`);
      if (!SITE_LOGO_TEXT_FONT_STYLES.includes(layer.fontStyle as SiteLogoTextFontStyle)) errors.push(`Slog besedilne plasti ${layerId} za ${purposeId} ni veljaven.`);
      if (!SITE_LOGO_TEXT_FONT_WEIGHTS.includes(layer.fontWeight as SiteLogoTextFontWeight)) errors.push(`Debelina besedilne plasti ${layerId} za ${purposeId} ni veljavna.`);
      if (
        layer.textAlign !== undefined
        && !SITE_LOGO_TEXT_ALIGNMENTS.includes(layer.textAlign as SiteLogoTextAlignment)
      ) errors.push(`Poravnava besedilne plasti ${layerId} za ${purposeId} ni veljavna.`);
      const fontSizePx = Number(layer.fontSizePx);
      if (typeof layer.fontSizePx !== 'number' || !Number.isFinite(fontSizePx) || fontSizePx < SITE_LOGO_TEXT_FONT_SIZE_MIN_PX || fontSizePx > SITE_LOGO_TEXT_FONT_SIZE_MAX_PX) errors.push(`Velikost besedilne plasti ${layerId} za ${purposeId} ni veljavna.`);
      const letterSpacingPx = Number(layer.letterSpacingPx);
      if (typeof layer.letterSpacingPx !== 'number' || !Number.isFinite(letterSpacingPx) || letterSpacingPx < SITE_LOGO_TEXT_LETTER_SPACING_MIN_PX || letterSpacingPx > SITE_LOGO_TEXT_LETTER_SPACING_MAX_PX) errors.push(`Razmik besedilne plasti ${layerId} za ${purposeId} ni veljaven.`);
    }
    if (typeof outline.enabled !== 'boolean') errors.push(`Obroba za ${purposeId} nima veljavne vidnosti.`);
    if (!isValidColor(outline.color)) errors.push(`Barva obrobe za ${purposeId} ni veljavna.`);
    const outlineWidth = Number(outline.widthPx);
    if (!Number.isFinite(outlineWidth) || outlineWidth < 0 || outlineWidth > 24) {
      errors.push(`Širina obrobe za ${purposeId} ni veljavna.`);
    }
    const shadow = asRecord(presentation.shadow);
    if (typeof shadow.enabled !== 'boolean') errors.push(`Senca za ${purposeId} nima veljavne vidnosti.`);
    if (!isValidColor(shadow.color)) errors.push(`Barva sence za ${purposeId} ni veljavna.`);
    for (const [field, min, max] of [
      ['opacity', 0, 1],
      ['blurPx', 0, 64],
      ['offsetXpx', -64, 64],
      ['offsetYpx', -64, 64]
    ] as const) {
      const numeric = Number(shadow[field]);
      if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
        errors.push(`Nastavitev sence ${field} za ${purposeId} ni veljavna.`);
      }
    }
  }
  return errors;
}
