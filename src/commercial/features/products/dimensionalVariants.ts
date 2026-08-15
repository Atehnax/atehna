import type {
  StorefrontOptionAxis,
  StorefrontVariant
} from '@/commercial/features/products/storefrontProduct';

export type DimensionalVariantChoice = {
  axisValueId: string;
  variant: StorefrontVariant;
  thickness: number;
  length: number;
  width?: number;
  sizeLabel: string;
};

export type DimensionalVariantGroup = {
  thickness: number;
  thicknessLabel: string;
  choices: DimensionalVariantChoice[];
};

export type DimensionalVariantSelectorModel = {
  axis: StorefrontOptionAxis;
  groups: DimensionalVariantGroup[];
};

const formatDimensionNumber = (value: number) =>
  new Intl.NumberFormat('sl-SI', {
    maximumFractionDigits: 3
  }).format(value);

const isDimensionAxis = (axis: StorefrontOptionAxis) => {
  const normalized = `${axis.name} ${axis.slug}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('sl');
  return normalized.includes('dimenz');
};

export function buildDimensionalVariantSelectorModel(
  axes: StorefrontOptionAxis[],
  variants: StorefrontVariant[]
): DimensionalVariantSelectorModel | null {
  if (axes.length !== 1 || variants.length < 2) return null;
  const axis = axes[0];
  if (!axis || !isDimensionAxis(axis)) return null;

  const choices: DimensionalVariantChoice[] = [];
  const combinationKeys = new Set<string>();

  for (const variant of variants) {
    const thickness = variant.dimensions?.thickness;
    const length = variant.dimensions?.length;
    const width = variant.dimensions?.width;
    const axisValue = axis.values.find((value) =>
      variant.optionValueIds.includes(value.id)
    );
    if (
      thickness === undefined ||
      length === undefined ||
      !axisValue
    ) {
      return null;
    }

    const combinationKey = `${thickness}:${length}:${width ?? ''}`;
    if (combinationKeys.has(combinationKey)) return null;
    combinationKeys.add(combinationKey);

    choices.push({
      axisValueId: axisValue.id,
      variant,
      thickness,
      length,
      ...(width !== undefined ? { width } : {}),
      sizeLabel:
        width === undefined
          ? `${formatDimensionNumber(length)} mm`
          : `${formatDimensionNumber(length)} × ${formatDimensionNumber(width)} mm`
    });
  }

  const byThickness = new Map<number, DimensionalVariantChoice[]>();
  choices.forEach((choice) => {
    const group = byThickness.get(choice.thickness) ?? [];
    group.push(choice);
    byThickness.set(choice.thickness, group);
  });

  return {
    axis,
    groups: [...byThickness.entries()]
      .sort(([left], [right]) => left - right)
      .map(([thickness, groupChoices]) => ({
        thickness,
        thicknessLabel: `${formatDimensionNumber(thickness)} mm`,
        choices: groupChoices.sort(
          (left, right) => left.variant.position - right.variant.position
        )
      }))
  };
}
