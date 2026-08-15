import type { ProductAppearanceConfig } from '@/shared/domain/style/productAppearance';

export type RelatedProductRelationKind = 'related' | 'accessory';

export type RelatedProductCandidate<TProduct> = {
  product: TProduct;
  slug: string;
  categorySlug?: string | null;
  subcategorySlug?: string | null;
  relationKind?: RelatedProductRelationKind;
  eligible?: boolean;
};

export type RelatedProductSelectionConfig = Pick<
  ProductAppearanceConfig['relatedProducts'],
  | 'enabled'
  | 'sourceMode'
  | 'manualProductSlugs'
  | 'manualPlacement'
  | 'maxItems'
  | 'showAccessoriesFirst'
>;

export type RelatedProductSelectionInput<TProduct> = {
  currentSlug: string;
  currentCategorySlug?: string | null;
  currentSubcategorySlug?: string | null;
  candidates: readonly RelatedProductCandidate<TProduct>[];
  config: RelatedProductSelectionConfig;
};

const normalizeKey = (value: string | null | undefined) =>
  value?.trim().toLocaleLowerCase('sl') ?? '';

function prioritizeAccessories<TProduct>(
  candidates: readonly RelatedProductCandidate<TProduct>[],
  enabled: boolean
) {
  if (!enabled) return [...candidates];
  return [
    ...candidates.filter((candidate) => candidate.relationKind === 'accessory'),
    ...candidates.filter((candidate) => candidate.relationKind !== 'accessory')
  ];
}

function belongsToAutomaticSource<TProduct>(
  candidate: RelatedProductCandidate<TProduct>,
  input: RelatedProductSelectionInput<TProduct>
) {
  if (input.config.sourceMode === 'manual-only') return false;

  const currentCategory = normalizeKey(input.currentCategorySlug);
  if (
    !currentCategory
    || normalizeKey(candidate.categorySlug) !== currentCategory
  ) {
    return false;
  }
  if (input.config.sourceMode === 'same-category') return true;

  return (
    normalizeKey(candidate.subcategorySlug)
    === normalizeKey(input.currentSubcategorySlug)
  );
}

/**
 * Selects recommendation candidates without fetching or mutating data.
 *
 * Manual slugs are resolved across every supplied candidate. Automatic
 * candidates retain their input order, which lets the catalog query own the
 * ranking. Ineligible, duplicate, missing and self-referential candidates are
 * ignored.
 */
export function selectRelatedProductCandidates<TProduct>(
  input: RelatedProductSelectionInput<TProduct>
): RelatedProductCandidate<TProduct>[] {
  if (!input.config.enabled) return [];

  const currentSlug = normalizeKey(input.currentSlug);
  const uniqueCandidates: RelatedProductCandidate<TProduct>[] = [];
  const candidateBySlug = new Map<string, RelatedProductCandidate<TProduct>>();

  for (const candidate of input.candidates) {
    const slug = normalizeKey(candidate.slug);
    if (
      !slug
      || slug === currentSlug
      || candidate.eligible === false
      || candidateBySlug.has(slug)
    ) {
      continue;
    }
    candidateBySlug.set(slug, candidate);
    uniqueCandidates.push(candidate);
  }

  const manualCandidates: RelatedProductCandidate<TProduct>[] = [];
  const manualSlugs = new Set<string>();
  for (const manualSlug of input.config.manualProductSlugs) {
    const slug = normalizeKey(manualSlug);
    if (!slug || manualSlugs.has(slug)) continue;
    manualSlugs.add(slug);
    const candidate = candidateBySlug.get(slug);
    if (candidate) manualCandidates.push(candidate);
  }

  const automaticCandidates = uniqueCandidates.filter((candidate) => {
    const slug = normalizeKey(candidate.slug);
    return (
      !manualSlugs.has(slug)
      && belongsToAutomaticSource(candidate, input)
    );
  });
  const manual = prioritizeAccessories(
    manualCandidates,
    input.config.showAccessoriesFirst
  );
  const automatic = prioritizeAccessories(
    automaticCandidates,
    input.config.showAccessoriesFirst
  );
  const ordered = input.config.manualPlacement === 'after-auto'
    ? [...automatic, ...manual]
    : [...manual, ...automatic];
  const maximum = Number.isFinite(input.config.maxItems)
    ? Math.max(0, Math.floor(input.config.maxItems))
    : 0;

  return ordered.slice(0, maximum);
}
