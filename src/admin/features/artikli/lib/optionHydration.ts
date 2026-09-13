import type { CatalogItemOptionAxisPayload } from '@/shared/domain/catalog/catalogAdminTypes';
import type { ProductOptionAxisDraft } from './familyModel';

/** Keep persisted IDs in the editor so subsequent saves update the same options. */
export function hydrateCatalogOptionAxes(axes: CatalogItemOptionAxisPayload[]): ProductOptionAxisDraft[] {
  return axes.map((axis, axisIndex) => ({
    id: axis.id ? String(axis.id) : `axis-${axisIndex}`,
    name: axis.name,
    slug: axis.slug,
    position: axis.position ?? axisIndex,
    values: axis.values.map((value, valueIndex) => ({
      id: value.id ? String(value.id) : `value-${axisIndex}-${valueIndex}`,
      value: value.value,
      slug: value.slug,
      swatch: value.swatch ?? null,
      position: value.position ?? valueIndex
    }))
  }));
}

export function hydrateVariantOptionSelections(
  axes: readonly ProductOptionAxisDraft[],
  optionValueIds: readonly number[]
): Record<string, string> {
  const selectionByValueId = new Map<number, { axisId: string; valueId: string }>();
  for (const axis of axes) {
    for (const value of axis.values) {
      if (/^\d+$/.test(value.id)) {
        selectionByValueId.set(Number(value.id), { axisId: axis.id, valueId: value.id });
      }
    }
  }
  return Object.fromEntries(optionValueIds.flatMap(valueId => {
    const selection = selectionByValueId.get(valueId);
    return selection ? [[selection.axisId, selection.valueId]] : [];
  }));
}
