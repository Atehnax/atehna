export const SITE_LOGO_SETTINGS_KEY = 'website-site-logo';

export const SITE_LOGO_MASTER_KINDS = ['lockup', 'wordmark', 'symbol'] as const;
export const SITE_LOGO_MASTER_TONES = ['default', 'light', 'dark'] as const;
export const SITE_LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const;
export const SITE_LOGO_PURPOSE_IDS = [
  'header-desktop',
  'header-tablet',
  'header-mobile',
  'footer-desktop',
  'footer-tablet',
  'footer-mobile',
  'favicon',
  'apple-touch-icon',
  'pwa-maskable',
  'social-share'
] as const;

export type SiteLogoMasterKind = (typeof SITE_LOGO_MASTER_KINDS)[number];
export type SiteLogoMasterTone = (typeof SITE_LOGO_MASTER_TONES)[number];
export type SiteLogoMimeType = (typeof SITE_LOGO_MIME_TYPES)[number];
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
  group: 'header' | 'footer' | 'icon' | 'social';
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
  favicon: { id: 'favicon', label: 'Favicon', group: 'icon', widthPx: 48, heightPx: 48, safeArea: 'rectangle', defaultSafeAreaInset: 0.08 },
  'apple-touch-icon': { id: 'apple-touch-icon', label: 'Apple Touch Icon', group: 'icon', widthPx: 180, heightPx: 180, safeArea: 'rectangle', defaultSafeAreaInset: 0.1 },
  'pwa-maskable': { id: 'pwa-maskable', label: 'Maskable PWA', group: 'icon', widthPx: 512, heightPx: 512, safeArea: 'circle', defaultSafeAreaInset: 0.1 },
  'social-share': { id: 'social-share', label: 'Predogled družbenih omrežij', group: 'social', widthPx: 1200, heightPx: 630, safeArea: 'rectangle', defaultSafeAreaInset: 0.08 }
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
  masterId: string | null;
  suggestion: SiteLogoFitSuggestion;
  override: SiteLogoGeometryOverride | null;
};

export type SiteLogoConfig = {
  version: 1;
  masters: SiteLogoMasterVariant[];
  placements: Record<SiteLogoPurposeId, SiteLogoPlacement>;
  updatedAt?: string | null;
};

type UnknownRecord = Record<string, unknown>;

const FULL_RECT: SiteLogoNormalizedRect = { x: 0, y: 0, width: 1, height: 1 };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const asRecord = (value: unknown): UnknownRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
const asString = (value: unknown, fallback = '', maxLength = 4000) => typeof value === 'string' ? value.trim().slice(0, maxLength) : fallback;
const asNumber = (value: unknown, fallback: number, min: number, max: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : fallback;
};
const asInteger = (value: unknown, fallback: number, min: number, max: number) => Math.round(asNumber(value, fallback, min, max));
const asEnum = <T extends string>(value: unknown, values: readonly T[], fallback: T): T => values.includes(value as T) ? value as T : fallback;

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
    crop: clone(FULL_RECT),
    safeAreaInset: SITE_LOGO_PURPOSE_CATALOG[purposeId].defaultSafeAreaInset,
    algorithmVersion: 'optical-fit-v1'
  };
}

function defaultPlacement(purposeId: SiteLogoPurposeId): SiteLogoPlacement {
  return { purposeId, enabled: true, masterId: null, suggestion: defaultSuggestion(purposeId), override: null };
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

export function normalizeSiteLogoConfig(value: unknown): SiteLogoConfig {
  const record = asRecord(value);
  const masters = Array.isArray(record.masters)
    ? record.masters.map(normalizeMaster).filter((master): master is SiteLogoMasterVariant => Boolean(master)).slice(0, 30)
    : [];
  const masterIds = new Set(masters.map((master) => master.id));
  const placementsRecord = asRecord(record.placements);
  const placements = Object.fromEntries(SITE_LOGO_PURPOSE_IDS.map((purposeId) => {
    const raw = asRecord(placementsRecord[purposeId]);
    const fallback = defaultPlacement(purposeId);
    const masterId = typeof raw.masterId === 'string' && masterIds.has(raw.masterId) ? raw.masterId : null;
    return [purposeId, {
      purposeId,
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : fallback.enabled,
      masterId,
      suggestion: normalizeGeometry(raw.suggestion, fallback.suggestion),
      override: normalizeOverride(raw.override)
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

export function validateSiteLogoConfigInput(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['Nastavitve logotipa niso veljavne.'];
  const record = value as UnknownRecord;
  const errors: string[] = [];
  if (!Array.isArray(record.masters)) errors.push('Seznam glavnih različic manjka.');
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
      if (!Number.isFinite(Number(master.intrinsicWidth)) || !Number.isFinite(Number(master.intrinsicHeight))) errors.push(`Mere glavne različice ${index + 1} niso veljavne.`);
      const bounds = asRecord(master.opticalBounds);
      const x = Number(bounds.x); const y = Number(bounds.y); const width = Number(bounds.width); const height = Number(bounds.height);
      if (![x, y, width, height].every(Number.isFinite) || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1.000001 || y + height > 1.000001) errors.push(`Optične meje glavne različice ${index + 1} niso veljavne.`);
    }
  }
  for (const purposeId of SITE_LOGO_PURPOSE_IDS) {
    if (!(purposeId in asRecord(record.placements))) errors.push(`Mesto uporabe ${purposeId} manjka.`);
  }
  return errors;
}
