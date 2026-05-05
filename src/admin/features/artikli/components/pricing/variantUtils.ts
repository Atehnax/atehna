import { formatCurrency, type Variant } from '@/admin/features/artikli/lib/familyModel';
import { formatDecimalForDisplay } from '@/admin/features/artikli/lib/decimalFormat';
import { formatPieceCount } from './productData';
import type { PricingSimulatorOption } from './pricingTypes';

export function isFiniteDimensionValue(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function getDimensionSimulatorLabel(variant: Variant): string {
  const dimensionValues = [variant.thickness, variant.length, variant.width];
  const dimensions = dimensionValues
    .filter(isFiniteDimensionValue)
    .map((value) => formatDecimalForDisplay(value));

  return dimensions.length > 0 ? `${dimensions.join(' × ')} mm` : variant.label;
}

export function getDimensionSimulatorOptions(variants: readonly Variant[]): PricingSimulatorOption[] {
  return variants.map((variant) => {
    const dimensionLabel = getDimensionSimulatorLabel(variant);

    return {
      id: variant.id,
      label: dimensionLabel,
      dimensionLabel,
      dimensionThickness: variant.thickness ?? undefined,
      dimensionWidth: variant.width ?? undefined,
      dimensionLength: variant.length ?? undefined,
      basePrice: variant.price,
      quantityUnit: 'kos',
      targetKey: variant.sku || variant.id,
      summaryLabel: formatCurrency(variant.price),
      stockLabel: formatPieceCount(variant.stock),
      minOrderLabel: formatPieceCount(Math.max(1, Math.floor(Number(variant.minOrder) || 1)))
    };
  });
}

export function normalizeSkuPart(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function shouldUseGeneratedSku(sku: string | null | undefined, baseSku: string): boolean {
  const normalizedSku = normalizeSkuPart(sku ?? '');
  const normalizedBase = normalizeSkuPart(baseSku);
  return normalizedSku.length === 0 || normalizedSku === normalizedBase || normalizedSku.startsWith(`${normalizedBase}-`);
}
