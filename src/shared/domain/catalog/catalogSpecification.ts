export const normalizeCatalogSpecificationToken = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase('sl')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const MAX_CATALOG_SPECIFICATION_LABEL_OVERRIDES = 80;
export const MAX_CATALOG_SPECIFICATION_KEY_LENGTH = 100;
export const MAX_CATALOG_SPECIFICATION_LABEL_LENGTH = 100;

export const CATALOG_CANONICAL_SPECIFICATION_LABELS: Readonly<
  Record<string, string>
> = {
  material: 'Material',
  barva: 'Barva',
  oblika: 'Oblika',
  dimensions: 'Dimenzije',
  teza: 'Teža',
  toleranca: 'Toleranca',
  sku: 'SKU'
};

export type CatalogSpecificationLabelOverrides = Record<string, string>;

export type CatalogSpecificationLabelValidationResult =
  | { ok: true; value: CatalogSpecificationLabelOverrides }
  | { ok: false; message: string };

export type CatalogAppearanceOverrideValidationResult =
  | { ok: true; value: UnknownRecord | null }
  | { ok: false; message: string };

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Validates the persisted display-label map and canonicalises its keys. Labels
 * are presentation-only; callers continue to use the canonical key for
 * ordering and commerce data.
 */
export function validateAndNormalizeCatalogSpecificationLabels(
  value: unknown
): CatalogSpecificationLabelValidationResult {
  if (value === undefined || value === null) return { ok: true, value: {} };
  if (!isRecord(value)) {
    return { ok: false, message: 'Nazivi specifikacij niso veljavni.' };
  }

  const entries = Object.entries(value);
  if (entries.length > MAX_CATALOG_SPECIFICATION_LABEL_OVERRIDES) {
    return {
      ok: false,
      message: `Določite lahko največ ${MAX_CATALOG_SPECIFICATION_LABEL_OVERRIDES} nazivov specifikacij.`
    };
  }

  const normalized: Array<[string, string]> = [];
  const seenKeys = new Set<string>();
  const seenLabels = new Set<string>();
  for (const [rawKey, rawLabel] of entries) {
    const key = normalizeCatalogSpecificationToken(rawKey);
    if (
      !key
      || rawKey.trim().length > MAX_CATALOG_SPECIFICATION_KEY_LENGTH
      || key.length > MAX_CATALOG_SPECIFICATION_KEY_LENGTH
    ) {
      return { ok: false, message: 'Ključ naziva specifikacije ni veljaven.' };
    }
    if (seenKeys.has(key)) {
      return { ok: false, message: 'Ključi nazivov specifikacij morajo biti enolični.' };
    }
    if (typeof rawLabel !== 'string') {
      return { ok: false, message: `Naziv specifikacije »${key}« ni veljaven.` };
    }
    const label = rawLabel.trim();
    if (!label || label.length > MAX_CATALOG_SPECIFICATION_LABEL_LENGTH) {
      return { ok: false, message: `Naziv specifikacije »${key}« ni veljaven.` };
    }
    const normalizedLabel = normalizeCatalogSpecificationToken(label);
    if (!normalizedLabel || seenLabels.has(normalizedLabel)) {
      return { ok: false, message: 'Prikazni nazivi specifikacij morajo biti enolični.' };
    }
    seenKeys.add(key);
    seenLabels.add(normalizedLabel);
    normalized.push([key, label]);
  }

  const normalizedRecord = Object.fromEntries(normalized);
  const finalCanonicalLabels = Object.entries(
    CATALOG_CANONICAL_SPECIFICATION_LABELS
  ).map(([key, defaultLabel]) => normalizedRecord[key] ?? defaultLabel);
  const customOverrideLabels = normalized
    .filter(([key]) => !(key in CATALOG_CANONICAL_SPECIFICATION_LABELS))
    .map(([, label]) => label);
  const finalTokens = [...finalCanonicalLabels, ...customOverrideLabels]
    .map(normalizeCatalogSpecificationToken);
  if (new Set(finalTokens).size !== finalTokens.length) {
    return {
      ok: false,
      message: 'Prikazni nazivi specifikacij morajo biti enolični.'
    };
  }

  return { ok: true, value: normalizedRecord };
}

/** Reads only valid label entries from an item appearance override. */
export function readCatalogSpecificationLabels(
  appearanceOverride: unknown
): CatalogSpecificationLabelOverrides {
  if (!isRecord(appearanceOverride)) return {};
  const secondaryContent = isRecord(appearanceOverride.secondaryContent)
    ? appearanceOverride.secondaryContent
    : {};
  const result = validateAndNormalizeCatalogSpecificationLabels(
    secondaryContent.specificationLabels
  );
  return result.ok ? result.value : {};
}

/**
 * Writes the label map without disturbing any other item appearance settings.
 * An empty map removes the field and prunes an otherwise empty section.
 */
export function writeCatalogSpecificationLabels(
  appearanceOverride: unknown,
  labels: CatalogSpecificationLabelOverrides
): UnknownRecord | null {
  const current = isRecord(appearanceOverride) ? { ...appearanceOverride } : {};
  const secondaryContent = isRecord(current.secondaryContent)
    ? { ...current.secondaryContent }
    : {};
  const result = validateAndNormalizeCatalogSpecificationLabels(labels);
  if (!result.ok) return Object.keys(current).length > 0 ? current : null;

  if (Object.keys(result.value).length > 0) {
    secondaryContent.specificationLabels = result.value;
  } else {
    delete secondaryContent.specificationLabels;
  }
  if (Object.keys(secondaryContent).length > 0) {
    current.secondaryContent = secondaryContent;
  } else {
    delete current.secondaryContent;
  }
  return Object.keys(current).length > 0 ? current : null;
}

/** Validates the typed specification-label portion while preserving all other appearance fields. */
export function validateAndNormalizeCatalogAppearanceOverride(
  value: unknown
): CatalogAppearanceOverrideValidationResult {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (!isRecord(value)) {
    return { ok: false, message: 'Lokalne nastavitve prikaza niso veljavne.' };
  }

  const normalized = { ...value };
  if (!Object.prototype.hasOwnProperty.call(normalized, 'secondaryContent')) {
    return { ok: true, value: normalized };
  }
  if (!isRecord(normalized.secondaryContent)) {
    return { ok: false, message: 'Nastavitve prikaza specifikacij niso veljavne.' };
  }
  const secondaryContent = { ...normalized.secondaryContent };
  if (Object.prototype.hasOwnProperty.call(secondaryContent, 'specificationLabels')) {
    const labels = validateAndNormalizeCatalogSpecificationLabels(
      secondaryContent.specificationLabels
    );
    if (!labels.ok) return labels;
    if (Object.keys(labels.value).length > 0) {
      secondaryContent.specificationLabels = labels.value;
    } else {
      delete secondaryContent.specificationLabels;
    }
  }
  if (Object.keys(secondaryContent).length > 0) {
    normalized.secondaryContent = secondaryContent;
  } else {
    delete normalized.secondaryContent;
  }
  return { ok: true, value: Object.keys(normalized).length > 0 ? normalized : null };
}

/**
 * Migrates a renamed custom specification key in the configured order and
 * label map. Canonical labels should never call this: their key is immutable.
 */
export function migrateCatalogSpecificationKey(
  specificationOrder: readonly string[],
  specificationLabels: CatalogSpecificationLabelOverrides,
  previousKey: string,
  nextKey: string
) {
  const previous = normalizeCatalogSpecificationToken(previousKey);
  const next = normalizeCatalogSpecificationToken(nextKey);
  if (!previous || !next || previous === next) {
    return {
      specificationOrder: [...specificationOrder],
      specificationLabels: { ...specificationLabels }
    };
  }

  const seenOrderKeys = new Set<string>();
  const nextOrder = specificationOrder.flatMap((rawKey) => {
    const key = normalizeCatalogSpecificationToken(rawKey);
    const migrated = key === previous ? next : key;
    if (!migrated || seenOrderKeys.has(migrated)) return [];
    seenOrderKeys.add(migrated);
    return [migrated];
  });
  const nextLabels = { ...specificationLabels };
  if (Object.prototype.hasOwnProperty.call(nextLabels, previous)) {
    if (!Object.prototype.hasOwnProperty.call(nextLabels, next)) {
      nextLabels[next] = nextLabels[previous] as string;
    }
    delete nextLabels[previous];
  }

  return {
    specificationOrder: nextOrder,
    specificationLabels: nextLabels
  };
}
