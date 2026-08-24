export const CATEGORY_SHOWCASE_FIT_MODES = ['contain', 'cover', 'fill'] as const;

export const CATEGORY_SHOWCASE_CONSTRAINTS = {
  crop: { minSize: 0.05, maxSize: 1 },
  focalPoint: { min: 0, max: 1 },
  scale: { min: 0.25, max: 4, step: 0.05 },
  offsetPercent: { min: -100, max: 100 },
  ordinalFontSizePx: { min: 8, max: 32 }
} as const;

export type CategoryShowcaseFit = (typeof CATEGORY_SHOWCASE_FIT_MODES)[number];

export type CategoryShowcaseNormalizedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CategoryShowcaseFocalPoint = {
  x: number;
  y: number;
};

/**
 * Non-destructive category artwork settings shared by each category-showcase
 * renderer. Crop and focal-point values are normalized (0..1), while offsets
 * are percentages of the media box.
 */
export type CategoryShowcaseMediaSettings = {
  crop: CategoryShowcaseNormalizedRect;
  focalPoint: CategoryShowcaseFocalPoint;
  scale: number;
  /** Persisted zero point; the visible translation is origin + relative offset. */
  offsetOriginX: number;
  offsetOriginY: number;
  offsetX: number;
  offsetY: number;
  fit: CategoryShowcaseFit;
  titleColor: string;
  titleHoverColor: string;
  backgroundColor: string;
  backgroundHoverColor: string;
  ordinalFontSizePx: number;
  ordinalColor: string;
  ordinalHoverColor: string;
};

export type CategoryShowcaseItem = {
  id?: string;
  slug: string;
  title: string;
  summary?: string | null;
  description?: string | null;
  image?: string | null;
  presentation?: CategoryShowcaseMediaSettings;
  /** Revision token derived only from shared image/presentation fields. */
  revision?: string;
};

export const DEFAULT_CATEGORY_SHOWCASE_MEDIA_SETTINGS: CategoryShowcaseMediaSettings = {
  crop: { x: 0, y: 0, width: 1, height: 1 },
  focalPoint: { x: 0.5, y: 0.5 },
  scale: 1,
  offsetOriginX: 0,
  offsetOriginY: 0,
  offsetX: 0,
  offsetY: 0,
  fit: 'contain',
  titleColor: '#111827',
  titleHoverColor: '#111827',
  backgroundColor: '#F5F3EF',
  backgroundHoverColor: '#F6F1EA',
  ordinalFontSizePx: 11,
  ordinalColor: '#354052',
  ordinalHoverColor: '#354052'
};

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function normalizeHexColor(value: unknown, fallback: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return HEX_COLOR_PATTERN.test(normalized) ? normalized.toUpperCase() : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function roundNormalized(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function cloneDefaultCategoryShowcaseMediaSettings(): CategoryShowcaseMediaSettings {
  return {
    ...DEFAULT_CATEGORY_SHOWCASE_MEDIA_SETTINGS,
    crop: { ...DEFAULT_CATEGORY_SHOWCASE_MEDIA_SETTINGS.crop },
    focalPoint: { ...DEFAULT_CATEGORY_SHOWCASE_MEDIA_SETTINGS.focalPoint }
  };
}

export function normalizeCategoryShowcaseMediaSettings(value: unknown): CategoryShowcaseMediaSettings {
  const record = asRecord(value);
  const crop = asRecord(record.crop);
  const focalPoint = asRecord(record.focalPoint);
  const defaults = DEFAULT_CATEGORY_SHOWCASE_MEDIA_SETTINGS;
  const constraints = CATEGORY_SHOWCASE_CONSTRAINTS;

  const width = clampNumber(crop.width, defaults.crop.width, constraints.crop.minSize, constraints.crop.maxSize);
  const height = clampNumber(crop.height, defaults.crop.height, constraints.crop.minSize, constraints.crop.maxSize);
  const x = clampNumber(crop.x, defaults.crop.x, 0, constraints.crop.maxSize - width);
  const y = clampNumber(crop.y, defaults.crop.y, 0, constraints.crop.maxSize - height);
  const fit = CATEGORY_SHOWCASE_FIT_MODES.includes(record.fit as CategoryShowcaseFit)
    ? record.fit as CategoryShowcaseFit
    : defaults.fit;
  const titleColor = normalizeHexColor(record.titleColor, defaults.titleColor);
  const ordinalColor = normalizeHexColor(record.ordinalColor, defaults.ordinalColor);
  const backgroundColor = normalizeHexColor(record.backgroundColor, defaults.backgroundColor);
  const offsetOriginX = roundNormalized(clampNumber(record.offsetOriginX, defaults.offsetOriginX, constraints.offsetPercent.min, constraints.offsetPercent.max));
  const offsetOriginY = roundNormalized(clampNumber(record.offsetOriginY, defaults.offsetOriginY, constraints.offsetPercent.min, constraints.offsetPercent.max));

  return {
    crop: {
      x: roundNormalized(x),
      y: roundNormalized(y),
      width: roundNormalized(width),
      height: roundNormalized(height)
    },
    focalPoint: {
      x: roundNormalized(clampNumber(focalPoint.x, defaults.focalPoint.x, constraints.focalPoint.min, constraints.focalPoint.max)),
      y: roundNormalized(clampNumber(focalPoint.y, defaults.focalPoint.y, constraints.focalPoint.min, constraints.focalPoint.max))
    },
    scale: roundNormalized(clampNumber(record.scale, defaults.scale, constraints.scale.min, constraints.scale.max)),
    offsetOriginX,
    offsetOriginY,
    offsetX: roundNormalized(clampNumber(record.offsetX, defaults.offsetX, constraints.offsetPercent.min - offsetOriginX, constraints.offsetPercent.max - offsetOriginX)),
    offsetY: roundNormalized(clampNumber(record.offsetY, defaults.offsetY, constraints.offsetPercent.min - offsetOriginY, constraints.offsetPercent.max - offsetOriginY)),
    fit,
    titleColor,
    titleHoverColor: normalizeHexColor(record.titleHoverColor, defaults.titleHoverColor),
    backgroundColor,
    backgroundHoverColor: normalizeHexColor(
      record.backgroundHoverColor,
      defaults.backgroundHoverColor
    ),
    ordinalFontSizePx: roundNormalized(clampNumber(
      record.ordinalFontSizePx,
      defaults.ordinalFontSizePx,
      constraints.ordinalFontSizePx.min,
      constraints.ordinalFontSizePx.max
    )),
    ordinalColor,
    ordinalHoverColor: normalizeHexColor(record.ordinalHoverColor, defaults.ordinalHoverColor)
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Validates a complete settings payload before it is persisted. Database reads
 * should use the normalizer so invalid or omitted fields receive canonical defaults.
 */
export function validateCategoryShowcaseMediaSettings(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['Nastavitve predstavitve kategorije niso veljavne.'];
  }

  const record = value as Record<string, unknown>;
  const crop = asRecord(record.crop);
  const focalPoint = asRecord(record.focalPoint);
  const constraints = CATEGORY_SHOWCASE_CONSTRAINTS;
  const errors: string[] = [];
  const offsetOriginX = Object.prototype.hasOwnProperty.call(record, 'offsetOriginX')
    ? record.offsetOriginX
    : 0;
  const offsetOriginY = Object.prototype.hasOwnProperty.call(record, 'offsetOriginY')
    ? record.offsetOriginY
    : 0;

  const cropX = crop.x;
  const cropY = crop.y;
  const cropWidth = crop.width;
  const cropHeight = crop.height;
  if (
    !isFiniteNumber(cropX) || !isFiniteNumber(cropY) ||
    !isFiniteNumber(cropWidth) || !isFiniteNumber(cropHeight)
  ) {
    errors.push('Obrez slike mora vsebovati veljavne normalizirane vrednosti.');
  } else if (
    cropX < 0 || cropY < 0 || cropWidth < constraints.crop.minSize || cropHeight < constraints.crop.minSize ||
    cropX + cropWidth > constraints.crop.maxSize || cropY + cropHeight > constraints.crop.maxSize
  ) {
    errors.push('Obrez slike mora ostati znotraj normaliziranega območja 0–1.');
  }

  if (
    !isFiniteNumber(focalPoint.x) || !isFiniteNumber(focalPoint.y) ||
    focalPoint.x < constraints.focalPoint.min || focalPoint.x > constraints.focalPoint.max ||
    focalPoint.y < constraints.focalPoint.min || focalPoint.y > constraints.focalPoint.max
  ) {
    errors.push('Žariščna točka mora biti znotraj normaliziranega območja 0–1.');
  }

  if (!isFiniteNumber(record.scale) || record.scale < constraints.scale.min || record.scale > constraints.scale.max) {
    errors.push(`Povečava mora biti med ${constraints.scale.min} in ${constraints.scale.max}.`);
  }
  if (
    !isFiniteNumber(record.offsetX)
    || !isFiniteNumber(offsetOriginX)
    || record.offsetX + offsetOriginX < constraints.offsetPercent.min
    || record.offsetX + offsetOriginX > constraints.offsetPercent.max
  ) {
    errors.push('Vodoravni odmik mora biti med -100 in 100 %.');
  }
  if (
    !isFiniteNumber(record.offsetY)
    || !isFiniteNumber(offsetOriginY)
    || record.offsetY + offsetOriginY < constraints.offsetPercent.min
    || record.offsetY + offsetOriginY > constraints.offsetPercent.max
  ) {
    errors.push('Navpični odmik mora biti med -100 in 100 %.');
  }
  if (
    Object.prototype.hasOwnProperty.call(record, 'offsetOriginX')
    && (!isFiniteNumber(record.offsetOriginX) || record.offsetOriginX < constraints.offsetPercent.min || record.offsetOriginX > constraints.offsetPercent.max)
  ) {
    errors.push('Vodoravno izhodišče odmika ni veljavno.');
  }
  if (
    Object.prototype.hasOwnProperty.call(record, 'offsetOriginY')
    && (!isFiniteNumber(record.offsetOriginY) || record.offsetOriginY < constraints.offsetPercent.min || record.offsetOriginY > constraints.offsetPercent.max)
  ) {
    errors.push('Navpično izhodišče odmika ni veljavno.');
  }
  if (!CATEGORY_SHOWCASE_FIT_MODES.includes(record.fit as CategoryShowcaseFit)) {
    errors.push('Način prilagajanja slike ni veljaven.');
  }
  if (typeof record.backgroundColor !== 'string' || !HEX_COLOR_PATTERN.test(record.backgroundColor.trim())) {
    errors.push('Barva ozadja mora biti zapisana v obliki #RRGGBB.');
  }
  if (
    Object.prototype.hasOwnProperty.call(record, 'titleColor')
    && (typeof record.titleColor !== 'string' || !HEX_COLOR_PATTERN.test(record.titleColor.trim()))
  ) {
    errors.push('Barva naslova kategorije mora biti zapisana v obliki #RRGGBB.');
  }
  if (
    Object.prototype.hasOwnProperty.call(record, 'titleHoverColor')
    && (typeof record.titleHoverColor !== 'string' || !HEX_COLOR_PATTERN.test(record.titleHoverColor.trim()))
  ) {
    errors.push('Barva naslova kategorije ob lebdenju mora biti zapisana v obliki #RRGGBB.');
  }
  if (
    Object.prototype.hasOwnProperty.call(record, 'backgroundHoverColor')
    && (typeof record.backgroundHoverColor !== 'string' || !HEX_COLOR_PATTERN.test(record.backgroundHoverColor.trim()))
  ) {
    errors.push('Barva ozadja kartice ob lebdenju mora biti zapisana v obliki #RRGGBB.');
  }
  if (
    Object.prototype.hasOwnProperty.call(record, 'ordinalFontSizePx')
    && (
      !isFiniteNumber(record.ordinalFontSizePx)
      || record.ordinalFontSizePx < constraints.ordinalFontSizePx.min
      || record.ordinalFontSizePx > constraints.ordinalFontSizePx.max
    )
  ) {
    errors.push(`Velikost številke kategorije mora biti med ${constraints.ordinalFontSizePx.min} in ${constraints.ordinalFontSizePx.max} px.`);
  }
  if (
    Object.prototype.hasOwnProperty.call(record, 'ordinalColor')
    && (typeof record.ordinalColor !== 'string' || !HEX_COLOR_PATTERN.test(record.ordinalColor.trim()))
  ) {
    errors.push('Barva številke kategorije mora biti zapisana v obliki #RRGGBB.');
  }
  if (
    Object.prototype.hasOwnProperty.call(record, 'ordinalHoverColor')
    && (typeof record.ordinalHoverColor !== 'string' || !HEX_COLOR_PATTERN.test(record.ordinalHoverColor.trim()))
  ) {
    errors.push('Barva številke kategorije ob lebdenju mora biti zapisana v obliki #RRGGBB.');
  }

  return errors;
}
