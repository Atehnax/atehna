import type {
  StorefrontSpecification
} from '@/commercial/features/products/storefrontProduct';

export const STOREFRONT_DIMENSIONS_SPECIFICATION_KEY = 'dimensions';

const dimensionPartOrder = ['thickness', 'length', 'width'] as const;
type DimensionPart = (typeof dimensionPartOrder)[number];

const dimensionLabels: Record<string, DimensionPart | 'combined'> = {
  dimensions: 'combined',
  dimenzije: 'combined',
  thickness: 'thickness',
  debelina: 'thickness',
  length: 'length',
  dolzina: 'length',
  width: 'width',
  sirina: 'width'
};

const normalizeSpecificationToken = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase('sl')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const dimensionPartForLabel = (
  label: string
): DimensionPart | 'combined' | null =>
  dimensionLabels[normalizeSpecificationToken(label)] ?? null;

export function getStorefrontSpecificationOrderKey(
  specification: Pick<StorefrontSpecification, 'label'>
) {
  return dimensionPartForLabel(specification.label)
    ? STOREFRONT_DIMENSIONS_SPECIFICATION_KEY
    : normalizeSpecificationToken(specification.label);
}

export function mergeStorefrontSpecifications(
  ...sources: StorefrontSpecification[][]
) {
  const byLabel = new Map<string, StorefrontSpecification>();
  for (const source of sources) {
    for (const entry of source) {
      byLabel.set(normalizeSpecificationToken(entry.label), entry);
    }
  }
  return [...byLabel.values()];
}

function splitDimensionValue(value: string) {
  const normalized = value.trim();
  const match = normalized.match(/^(.*?)\s*(mm|cm|m)$/i);
  const localizeNumericValue = (rawValue: string) => (
    /^-?\d+(?:\.\d+)?$/.test(rawValue)
      ? rawValue.replace('.', ',')
      : rawValue
  );
  return match
    ? {
        value: localizeNumericValue(match[1]?.trim() ?? normalized),
        unit: match[2] ?? ''
      }
    : { value: localizeNumericValue(normalized), unit: '' };
}

function combinedDimensionValue(
  dimensions: Partial<Record<DimensionPart, StorefrontSpecification>>
) {
  const parts = dimensionPartOrder.flatMap((part) => {
    const specification = dimensions[part];
    return specification ? [splitDimensionValue(specification.value)] : [];
  });
  const commonUnit =
    parts.length > 0
    && parts.every((part) => part.unit.toLocaleLowerCase('sl') === parts[0]?.unit.toLocaleLowerCase('sl'))
      ? parts[0]?.unit
      : '';

  return parts
    .map((part) => commonUnit ? part.value : `${part.value}${part.unit ? ` ${part.unit}` : ''}`)
    .join(' × ')
    .concat(commonUnit ? ` ${commonUnit}` : '');
}

export function prepareStorefrontSpecifications(
  specifications: StorefrontSpecification[],
  specificationOrder: readonly string[]
) {
  const dimensionParts: Partial<
    Record<DimensionPart, StorefrontSpecification>
  > = {};
  let explicitDimensions: StorefrontSpecification | null = null;
  let firstDimensionIndex = -1;
  const remaining: StorefrontSpecification[] = [];

  specifications.forEach((specification, index) => {
    const dimensionPart = dimensionPartForLabel(specification.label);
    if (!dimensionPart) {
      remaining.push(specification);
      return;
    }
    if (firstDimensionIndex < 0) firstDimensionIndex = index;
    if (dimensionPart === 'combined') {
      explicitDimensions = specification;
    } else {
      dimensionParts[dimensionPart] = specification;
    }
  });

  const generatedDimensionValue = combinedDimensionValue(dimensionParts);
  const dimensionSpecification = explicitDimensions
    ?? (generatedDimensionValue
      ? {
          id: 'combined-dimensions',
          label: 'Dimenzije',
          value: generatedDimensionValue,
          ...(Object.values(dimensionParts).find(Boolean)?.group
            ? {
                group: Object.values(dimensionParts).find(Boolean)?.group
              }
            : {})
        }
      : null);

  const collapsed = [...remaining];
  if (dimensionSpecification) {
    const insertionIndex = Math.min(
      Math.max(firstDimensionIndex, 0),
      collapsed.length
    );
    collapsed.splice(insertionIndex, 0, dimensionSpecification);
  }

  const orderIndex = new Map(
    specificationOrder.map((key, index) => [
      normalizeSpecificationToken(key),
      index
    ])
  );
  return collapsed
    .map((specification, index) => ({
      specification,
      index,
      order:
        orderIndex.get(getStorefrontSpecificationOrderKey(specification))
        ?? Number.POSITIVE_INFINITY
    }))
    .sort((left, right) => left.order - right.order || left.index - right.index)
    .map(({ specification }) => specification);
}
