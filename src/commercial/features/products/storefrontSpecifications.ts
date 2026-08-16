import type {
  StorefrontSpecification
} from '@/commercial/features/products/storefrontProduct';
import {
  normalizeCatalogSpecificationToken,
  type CatalogSpecificationLabelOverrides
} from '@/shared/domain/catalog/catalogSpecification';

export const normalizeStorefrontSpecificationToken = normalizeCatalogSpecificationToken;

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

const dimensionPartForLabel = (
  label: string
): DimensionPart | 'combined' | null =>
  dimensionLabels[normalizeStorefrontSpecificationToken(label)] ?? null;

const canonicalSpecificationOrderKeys: Record<string, string> = {
  material: 'material',
  barva: 'barva',
  color: 'barva',
  colour: 'barva',
  oblika: 'oblika',
  shape: 'oblika',
  teza: 'teza',
  weight: 'teza',
  toleranca: 'toleranca',
  tolerance: 'toleranca',
  sku: 'sku'
};

export function getStorefrontSpecificationOrderKey(
  specification: Pick<StorefrontSpecification, 'label' | 'orderKey'>
) {
  const explicitKey = normalizeStorefrontSpecificationToken(
    specification.orderKey ?? ''
  );
  if (
    dimensionPartForLabel(explicitKey)
    || dimensionPartForLabel(specification.label)
  ) {
    return STOREFRONT_DIMENSIONS_SPECIFICATION_KEY;
  }
  const inferredKey = explicitKey
    || normalizeStorefrontSpecificationToken(specification.label);
  return canonicalSpecificationOrderKeys[inferredKey] ?? inferredKey;
}

export function mergeStorefrontSpecifications(
  ...sources: StorefrontSpecification[][]
) {
  const byLabel = new Map<string, StorefrontSpecification>();
  for (const source of sources) {
    for (const entry of source) {
      byLabel.set(normalizeStorefrontSpecificationToken(entry.label), entry);
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
  specificationOrder: readonly string[],
  specificationLabels: CatalogSpecificationLabelOverrides = {}
) {
  const dimensionParts: Partial<
    Record<DimensionPart, StorefrontSpecification>
  > = {};
  let explicitDimensions: StorefrontSpecification | null = null;
  let firstDimensionIndex = -1;
  const remaining: StorefrontSpecification[] = [];

  specifications.forEach((specification, index) => {
    const dimensionPart = dimensionPartForLabel(specification.orderKey ?? '')
      ?? dimensionPartForLabel(specification.label);
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
          orderKey: STOREFRONT_DIMENSIONS_SPECIFICATION_KEY,
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
      canonicalSpecificationOrderKeys[normalizeStorefrontSpecificationToken(key)]
        ?? normalizeStorefrontSpecificationToken(key),
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
    .map(({ specification }) => {
      const stableKey = getStorefrontSpecificationOrderKey(specification);
      const label = specificationLabels[stableKey];
      return label && label !== specification.label
        ? { ...specification, label, orderKey: stableKey }
        : specification;
    });
}
