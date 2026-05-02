import type { Variant } from '@/admin/features/artikli/lib/familyModel';
import type { SimulatorOption } from './pricingTypes';

export function isFiniteDimensionValue(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function getDimensionSimulatorLabel(variant: Variant, index: number): string {
  const measurements = [variant.length, variant.width, variant.thickness]
    .filter(isFiniteDimensionValue)
    .map((value) => `${value}`);

  if (measurements.length > 0) {
    return `${measurements.join(' × ')} mm`;
  }

  return variant.label?.trim() || `Različica ${index + 1}`;
}

export function getDimensionSimulatorOptions(variants: readonly Variant[]): SimulatorOption[] {
  return variants.map((variant, index) => ({
    id: variant.id,
    label: getDimensionSimulatorLabel(variant, index),
    sku: variant.sku,
    discountUnitLabel: 'kos',
    stockLabel: `${variant.stock ?? 0} kos`,
    minOrderLabel: `${variant.minOrder ?? 1} kos`
  }));
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
