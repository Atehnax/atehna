import type {
  CatalogItemEditorPayload,
  CatalogItemEditorVariantPayload,
  CatalogItemOptionAxisPayload,
  CatalogItemOptionValuePayload
} from '@/shared/domain/catalog/catalogAdminTypes';

/** These legacy option axes duplicate the structured dimension fields. */
export function isCatalogDimensionOptionAxis(axis: { name: string; slug: string }): boolean {
  return [axis.name, axis.slug].some((value) =>
    /^(dimenzije|dimensions)$/.test(value.normalize('NFKC').trim().toLowerCase())
  );
}

function selectedValue(axis: CatalogItemOptionAxisPayload, variant: CatalogItemEditorVariantPayload) {
  const selection = Object.entries(variant.optionSelections ?? {})
    .find(([slug]) => slug.trim() === axis.slug.trim())?.[1]?.trim();
  return axis.values.find((value) => value.slug.trim() === selection)
    ?? axis.values.find((value) => value.id !== undefined && variant.optionValueIds?.includes(value.id));
}

function dimensionOption(variant: CatalogItemEditorVariantPayload, selected?: CatalogItemOptionValuePayload) {
  const measurements = [variant.thickness, variant.length, variant.width].map((value) =>
    typeof value === 'number' && Number.isFinite(value) ? value : null
  );
  if (measurements.some((value) => value !== null)) {
    return {
      value: `${measurements.filter((value) => value !== null).map((value) => String(value).replace('.', ',')).join(' × ')} mm`,
      // Keep missing axes in the key: length 200 is different from thickness 200.
      slug: `dimensions-${measurements.map((value, index) => `${['t', 'l', 'w'][index]}-${value === null ? 'none' : String(value).replace('.', 'p')}`).join('-')}`
    };
  }
  if (selected) return { value: selected.value, slug: selected.slug.trim() };

  const value = variant.variantName.trim() || variant.variantSku?.trim() || 'Brez dimenzij';
  const nameSlug = value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
  return { value, slug: `dimensions-unspecified-${nameSlug || 'none'}` };
}

/**
 * Use physical dimensions as the source of legacy dimension options when
 * saving. Optional measurements and commercial fields remain optional.
 */
export function normalizeCatalogDimensionOptions(payload: CatalogItemEditorPayload): CatalogItemEditorPayload {
  const isDimensional = payload.productType === 'dimensions'
    || (payload.productType === undefined && payload.itemType === 'sheet');
  if (!isDimensional || !payload.optionAxes?.some(isCatalogDimensionOptionAxis)) return payload;

  let variants = payload.variants;
  const optionAxes = payload.optionAxes.map((axis) => {
    if (!isCatalogDimensionOptionAxis(axis)) return axis;

    const descriptors = variants.map((variant) => {
      const selected = selectedValue(axis, variant);
      return { ...dimensionOption(variant, selected), selected };
    });
    const groups = new Map<string, {
      value: string;
      slug: string;
      candidates: CatalogItemOptionValuePayload[];
      source?: CatalogItemOptionValuePayload;
    }>();
    for (const descriptor of descriptors) {
      const group = groups.get(descriptor.slug) ?? { ...descriptor, candidates: [] };
      if (descriptor.selected) group.candidates.push(descriptor.selected);
      groups.set(descriptor.slug, group);
    }

    const claimed = new Set<CatalogItemOptionValuePayload>();
    const claimedIds = new Set<number>();
    const isAvailable = (value: CatalogItemOptionValuePayload) =>
      !claimed.has(value) && (value.id === undefined || !claimedIds.has(value.id));
    const claim = (group: NonNullable<ReturnType<typeof groups.get>>, source?: CatalogItemOptionValuePayload) => {
      if (!source) return;
      group.source = source;
      claimed.add(source);
      if (source.id !== undefined) claimedIds.add(source.id);
    };

    // Reserve existing canonical values first so variant order cannot steal an
    // ID from a dimension tuple that still exists elsewhere in the product.
    for (const group of groups.values()) {
      claim(group, axis.values.find((value) => value.slug.trim() === group.slug && isAvailable(value)));
    }
    for (const group of groups.values()) {
      if (!group.source) claim(group, group.candidates.find(isAvailable));
    }

    const replacements = new Map<CatalogItemOptionValuePayload, CatalogItemOptionValuePayload>();
    const additions: CatalogItemOptionValuePayload[] = [];
    for (const group of groups.values()) {
      if (group.source) {
        replacements.set(group.source, { ...group.source, value: group.value, slug: group.slug });
      } else {
        additions.push({ value: group.value, slug: group.slug, position: axis.values.length + additions.length });
      }
    }

    const managedValueIds = new Set(axis.values.flatMap((value) => value.id === undefined ? [] : [value.id]));
    variants = variants.map((variant, index) => ({
      ...variant,
      ...(variant.optionValueIds === undefined ? {} : {
        optionValueIds: variant.optionValueIds.filter((id) => !managedValueIds.has(id))
      }),
      optionSelections: {
        ...Object.fromEntries(Object.entries(variant.optionSelections ?? {}).filter(([slug]) => slug.trim() !== axis.slug.trim())),
        [axis.slug.trim()]: descriptors[index].slug
      }
    }));

    return { ...axis, values: [...axis.values.map((value) => replacements.get(value) ?? value), ...additions] };
  });

  return { ...payload, optionAxes, variants };
}
