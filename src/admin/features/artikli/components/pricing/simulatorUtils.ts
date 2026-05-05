import type { PricingSimulatorOption, SimulatorOption as CatalogSimulatorOption } from './pricingTypes';

function readNumber(record: Record<string, unknown>, key: string, fallback = 0): number {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readOptionalNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readStringArray(record: Record<string, unknown>, key: string): string[] | undefined {
  const value = record[key];
  if (!Array.isArray(value)) return undefined;
  const entries = value.map((entry) => String(entry).trim()).filter(Boolean);
  return entries.length > 0 ? entries : undefined;
}

export function toPricingSimulatorOption(option: CatalogSimulatorOption): PricingSimulatorOption {
  const record = option as CatalogSimulatorOption & Record<string, unknown>;
  return {
    ...option,
    label: option.label ?? option.sku ?? option.id,
    basePrice: readNumber(record, 'basePrice'),
    discountPercent: readOptionalNumber(record, 'discountPercent'),
    quantityUnit: readString(record, 'quantityUnit'),
    targetKey: readString(record, 'targetKey'),
    dimensionLabel: readString(record, 'dimensionLabel'),
    dimensionThickness: readOptionalNumber(record, 'dimensionThickness'),
    dimensionWidth: readOptionalNumber(record, 'dimensionWidth'),
    dimensionLength: readOptionalNumber(record, 'dimensionLength'),
    summaryLabel: readString(record, 'summaryLabel'),
    discountUnitLabel: option.discountUnitLabel,
    stockLabel: option.stockLabel,
    minOrderLabel: option.minOrderLabel,
    serialLabels: readStringArray(record, 'serialLabels'),
    weightFraction: readString(record, 'weightFraction'),
    weightColor: readString(record, 'weightColor'),
    weightPackageLabel: readString(record, 'weightPackageLabel'),
    weightFractionColorLabel: readString(record, 'weightFractionColorLabel'),
    weightSelectionLabel: readString(record, 'weightSelectionLabel'),
    weightNetMassKg: readNumber(record, 'weightNetMassKg', Number.NaN)
  };
}

export function toPricingSimulatorOptions(
  options: readonly CatalogSimulatorOption[]
): PricingSimulatorOption[] {
  return options.map(toPricingSimulatorOption).map((option) => ({
    ...option,
    weightNetMassKg: Number.isFinite(option.weightNetMassKg) ? option.weightNetMassKg : undefined
  }));
}
