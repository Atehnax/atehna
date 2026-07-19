export const CATEGORY_SHOWCASE_FIT_MODES = ['contain', 'cover', 'fill'] as const;

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
  offsetX: number;
  offsetY: number;
  fit: CategoryShowcaseFit;
  backgroundColor: string;
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
  offsetX: 0,
  offsetY: 0,
  fit: 'contain',
  backgroundColor: '#F5F3EF'
};

const DEFAULT_CATEGORY_SHOWCASE_CUTOUTS: Record<string, string> = {
  'tehnika-in-tehnologija': 'tehnika-in-tehnologija',
  materiali: 'materiali',
  'stroji-in-naprave': 'stroji-in-naprave',
  'merilno-orodje-in-geometrija': 'merilno-orodje-in-geometrija',
  'elektricni-in-mehanicni-elementi': 'elektricni-in-mehanicni-elementi',
  'električni-in-mehanični-elementi': 'elektricni-in-mehanicni-elementi',
  'rocno-orodje-in-delavniski-pribor': 'rocno-orodje-in-delavniski-pribor',
  'ročno-orodje-in-delavniški-pribor': 'rocno-orodje-in-delavniski-pribor',
  'zascita-pri-delu': 'zascita-pri-delu',
  'zaščita-pri-delu': 'zascita-pri-delu',
  'dodatki-in-nadomestni-deli': 'dodatki-in-nadomestni-deli'
};

/**
 * Transparently upgrades only the original bundled category artwork to the
 * editorial cutouts. User uploads and every other stored media URL pass
 * through unchanged, so both admin routes still edit one persisted image.
 */
export function resolveCategoryShowcaseImage(image: unknown, categorySlug: string): string {
  if (typeof image !== 'string') return '';
  const normalized = image.trim();
  if (!normalized) return '';
  const bundledFileSlug = DEFAULT_CATEGORY_SHOWCASE_CUTOUTS[categorySlug];
  if (
    bundledFileSlug
    && normalized === `/images/categories/${bundledFileSlug}.png`
  ) {
    return `/images/categories/cutouts/${bundledFileSlug}.png`;
  }
  return normalized;
}

const MIN_CROP_SIZE = 0.05;
const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const MIN_OFFSET_PERCENT = -100;
const MAX_OFFSET_PERCENT = 100;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

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

  const width = clampNumber(crop.width, defaults.crop.width, MIN_CROP_SIZE, 1);
  const height = clampNumber(crop.height, defaults.crop.height, MIN_CROP_SIZE, 1);
  const x = clampNumber(crop.x, defaults.crop.x, 0, 1 - width);
  const y = clampNumber(crop.y, defaults.crop.y, 0, 1 - height);
  const fit = CATEGORY_SHOWCASE_FIT_MODES.includes(record.fit as CategoryShowcaseFit)
    ? record.fit as CategoryShowcaseFit
    : defaults.fit;
  const rawBackgroundColor = typeof record.backgroundColor === 'string'
    ? record.backgroundColor.trim()
    : '';

  return {
    crop: {
      x: roundNormalized(x),
      y: roundNormalized(y),
      width: roundNormalized(width),
      height: roundNormalized(height)
    },
    focalPoint: {
      x: roundNormalized(clampNumber(focalPoint.x, defaults.focalPoint.x, 0, 1)),
      y: roundNormalized(clampNumber(focalPoint.y, defaults.focalPoint.y, 0, 1))
    },
    scale: roundNormalized(clampNumber(record.scale, defaults.scale, MIN_SCALE, MAX_SCALE)),
    offsetX: roundNormalized(clampNumber(record.offsetX, defaults.offsetX, MIN_OFFSET_PERCENT, MAX_OFFSET_PERCENT)),
    offsetY: roundNormalized(clampNumber(record.offsetY, defaults.offsetY, MIN_OFFSET_PERCENT, MAX_OFFSET_PERCENT)),
    fit,
    backgroundColor: HEX_COLOR_PATTERN.test(rawBackgroundColor)
      ? rawBackgroundColor.toUpperCase()
      : defaults.backgroundColor
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Validates a complete settings payload before it is persisted. Database reads
 * should use the normalizer instead so legacy `{}` records receive defaults.
 */
export function validateCategoryShowcaseMediaSettings(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['Nastavitve predstavitve kategorije niso veljavne.'];
  }

  const record = value as Record<string, unknown>;
  const crop = asRecord(record.crop);
  const focalPoint = asRecord(record.focalPoint);
  const errors: string[] = [];

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
    cropX < 0 || cropY < 0 || cropWidth < MIN_CROP_SIZE || cropHeight < MIN_CROP_SIZE ||
    cropX + cropWidth > 1 || cropY + cropHeight > 1
  ) {
    errors.push('Obrez slike mora ostati znotraj normaliziranega območja 0–1.');
  }

  if (
    !isFiniteNumber(focalPoint.x) || !isFiniteNumber(focalPoint.y) ||
    focalPoint.x < 0 || focalPoint.x > 1 || focalPoint.y < 0 || focalPoint.y > 1
  ) {
    errors.push('Žariščna točka mora biti znotraj normaliziranega območja 0–1.');
  }

  if (!isFiniteNumber(record.scale) || record.scale < MIN_SCALE || record.scale > MAX_SCALE) {
    errors.push(`Povečava mora biti med ${MIN_SCALE} in ${MAX_SCALE}.`);
  }
  if (!isFiniteNumber(record.offsetX) || record.offsetX < MIN_OFFSET_PERCENT || record.offsetX > MAX_OFFSET_PERCENT) {
    errors.push('Vodoravni odmik mora biti med -100 in 100 %.');
  }
  if (!isFiniteNumber(record.offsetY) || record.offsetY < MIN_OFFSET_PERCENT || record.offsetY > MAX_OFFSET_PERCENT) {
    errors.push('Navpični odmik mora biti med -100 in 100 %.');
  }
  if (!CATEGORY_SHOWCASE_FIT_MODES.includes(record.fit as CategoryShowcaseFit)) {
    errors.push('Način prilagajanja slike ni veljaven.');
  }
  if (typeof record.backgroundColor !== 'string' || !HEX_COLOR_PATTERN.test(record.backgroundColor.trim())) {
    errors.push('Barva ozadja mora biti zapisana v obliki #RRGGBB.');
  }

  return errors;
}
