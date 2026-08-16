import type {
  CatalogItemEditorHydration,
  CatalogItemEditorVariantPayload,
  CatalogItemPresentationPatch,
  CatalogVariantContentOverride
} from '@/shared/domain/catalog/catalogAdminTypes';
import { normalizeCatalogSpecificationToken } from '@/shared/domain/catalog/catalogSpecification';

export const MAX_VARIANT_SPECIFICATION_ROWS = 50;
export const MAX_VARIANT_SPECIFICATION_LABEL_LENGTH = 100;
export const MAX_VARIANT_SPECIFICATION_VALUE_LENGTH = 500;
export const MAX_VARIANT_PRESENTATION_TEXT_LENGTH = 160;
export const MAX_VARIANT_PRESENTATION_NUMBER = 999_999_999.999;

export type VariantPresentationPatch = NonNullable<
  CatalogItemPresentationPatch['variantSpecifications']
>[number];

export type VariantPatchValidationResult =
  | { ok: true; value: VariantPresentationPatch[] | undefined }
  | { ok: false; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function normalizeOptionalVariantNumber(
  entry: Record<string, unknown>,
  field: 'length' | 'width' | 'thickness' | 'weight'
): { ok: true; value?: number | null } | { ok: false } {
  if (!Object.prototype.hasOwnProperty.call(entry, field)) return { ok: true };
  const value = entry[field];
  if (value === null) return { ok: true, value: null };
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || value < 0
    || value > MAX_VARIANT_PRESENTATION_NUMBER
  ) {
    return { ok: false };
  }
  return { ok: true, value };
}

function normalizeOptionalVariantText(
  entry: Record<string, unknown>,
  field: 'errorTolerance' | 'variantSku'
): { ok: true; value?: string | null } | { ok: false } {
  if (!Object.prototype.hasOwnProperty.call(entry, field)) return { ok: true };
  const value = entry[field];
  if (value === null) return { ok: true, value: null };
  if (
    typeof value !== 'string'
    || value.trim().length > MAX_VARIANT_PRESENTATION_TEXT_LENGTH
  ) {
    return { ok: false };
  }
  return { ok: true, value: value.trim() || null };
}

export function validateAndNormalizeVariantPresentationPatches(
  value: unknown,
  item: Pick<CatalogItemEditorHydration, 'variants'>
): VariantPatchValidationResult {
  if (value === undefined) return { ok: true, value: undefined };
  if (!Array.isArray(value)) {
    return { ok: false, message: 'Specifikacije niso veljavne.' };
  }
  if (value.length > item.variants.length) {
    return { ok: false, message: 'Poslanih je preveč zapisov različic.' };
  }

  const ownedVariantIds = new Set(
    item.variants
      .map((variant) => variant.id)
      .filter((id): id is number => (
        typeof id === 'number'
        && Number.isInteger(id)
        && id > 0
      ))
  );
  const seenVariantIds = new Set<number>();
  const normalized: VariantPresentationPatch[] = [];

  for (const rawEntry of value) {
    if (!isRecord(rawEntry)) {
      return { ok: false, message: 'Zapis specifikacij različice ni veljaven.' };
    }
    const variantId = rawEntry.variantId;
    if (
      typeof variantId !== 'number'
      || !Number.isInteger(variantId)
      || variantId <= 0
      || !ownedVariantIds.has(variantId)
    ) {
      return { ok: false, message: 'Izbrana različica ne pripada temu artiklu.' };
    }
    if (seenVariantIds.has(variantId)) {
      return { ok: false, message: 'Ista različica je bila poslana večkrat.' };
    }
    seenVariantIds.add(variantId);

    if (!isRecord(rawEntry.specifications)) {
      return { ok: false, message: 'Specifikacije različice morajo biti zapis nazivov in vrednosti.' };
    }
    const specificationEntries = Object.entries(rawEntry.specifications);
    if (specificationEntries.length > MAX_VARIANT_SPECIFICATION_ROWS) {
      return {
        ok: false,
        message: `Različica ima lahko največ ${MAX_VARIANT_SPECIFICATION_ROWS} dodatnih specifikacij.`
      };
    }
    const seenLabels = new Set<string>();
    const normalizedSpecificationEntries: Array<[string, string]> = [];
    for (const [rawLabel, rawValue] of specificationEntries) {
      const label = rawLabel.trim();
      if (!label || label.length > MAX_VARIANT_SPECIFICATION_LABEL_LENGTH) {
        return { ok: false, message: 'Naziv specifikacije ni veljaven.' };
      }
      if (typeof rawValue !== 'string') {
        return { ok: false, message: `Vrednost specifikacije »${label}« ni veljavna.` };
      }
      const specificationValue = rawValue.trim();
      if (
        !specificationValue
        || specificationValue.length > MAX_VARIANT_SPECIFICATION_VALUE_LENGTH
      ) {
        return { ok: false, message: `Vrednost specifikacije »${label}« ni veljavna.` };
      }
      const normalizedLabel = normalizeCatalogSpecificationToken(label);
      if (!normalizedLabel || seenLabels.has(normalizedLabel)) {
        return { ok: false, message: 'Nazivi specifikacij morajo biti enolični.' };
      }
      seenLabels.add(normalizedLabel);
      normalizedSpecificationEntries.push([label, specificationValue]);
    }

    const length = normalizeOptionalVariantNumber(rawEntry, 'length');
    const width = normalizeOptionalVariantNumber(rawEntry, 'width');
    const thickness = normalizeOptionalVariantNumber(rawEntry, 'thickness');
    const weight = normalizeOptionalVariantNumber(rawEntry, 'weight');
    if (!length.ok || !width.ok || !thickness.ok || !weight.ok) {
      return { ok: false, message: 'Mere in teža morajo biti nenegativna števila.' };
    }
    const errorTolerance = normalizeOptionalVariantText(rawEntry, 'errorTolerance');
    const variantSku = normalizeOptionalVariantText(rawEntry, 'variantSku');
    if (!errorTolerance.ok || !variantSku.ok) {
      return { ok: false, message: 'Toleranca ali SKU različice nista veljavna.' };
    }

    normalized.push({
      variantId,
      specifications: Object.fromEntries(normalizedSpecificationEntries),
      ...(length.value !== undefined ? { length: length.value } : {}),
      ...(width.value !== undefined ? { width: width.value } : {}),
      ...(thickness.value !== undefined ? { thickness: thickness.value } : {}),
      ...(weight.value !== undefined ? { weight: weight.value } : {}),
      ...(errorTolerance.value !== undefined ? { errorTolerance: errorTolerance.value } : {}),
      ...(variantSku.value !== undefined ? { variantSku: variantSku.value } : {})
    });
  }

  return { ok: true, value: normalized };
}

export function applyVariantPresentationPatch(
  variant: CatalogItemEditorVariantPayload,
  patch: VariantPresentationPatch | undefined
): CatalogItemEditorVariantPayload {
  if (!patch) return variant;

  const contentOverride: CatalogVariantContentOverride = {
    ...(variant.contentOverride ?? {})
  };
  if (Object.keys(patch.specifications).length > 0) {
    contentOverride.specifications = patch.specifications;
  } else {
    delete contentOverride.specifications;
  }

  return {
    ...variant,
    length: patch.length !== undefined ? patch.length : variant.length,
    width: patch.width !== undefined ? patch.width : variant.width,
    thickness: patch.thickness !== undefined ? patch.thickness : variant.thickness,
    weight: patch.weight !== undefined ? patch.weight : variant.weight,
    errorTolerance: patch.errorTolerance !== undefined
      ? patch.errorTolerance
      : variant.errorTolerance,
    variantSku: patch.variantSku !== undefined
      ? patch.variantSku
      : variant.variantSku,
    contentOverride: Object.keys(contentOverride).length > 0
      ? contentOverride
      : null
  };
}
