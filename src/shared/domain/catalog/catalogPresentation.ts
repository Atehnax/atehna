import type { CatalogEditorProductType } from '@/shared/domain/catalog/catalogAdminTypes';

export type CatalogPresentationSpecification = {
  id: string;
  label: string;
  value: string;
  group?: string;
};

export type CatalogPresentationDetails = {
  specifications: CatalogPresentationSpecification[];
  includedItems: string[];
  deliveryEstimate: string | null;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const asStringOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;

export function toCatalogPresentationDisplayValue(
  value: unknown
): string | null {
  if (typeof value === 'string') return asStringOrNull(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function normalizeSpecificationRows(
  value: unknown,
  group: string,
  idPrefix: string
): CatalogPresentationSpecification[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    const record = asRecord(entry);
    const label = asStringOrNull(record.property ?? record.label ?? record.name);
    const rawValue = toCatalogPresentationDisplayValue(record.value);
    const unit = asStringOrNull(record.unit);
    if (!label || !rawValue) return [];
    return [{
      id: `${idPrefix}-${index}`,
      label,
      value: unit ? `${rawValue} ${unit}` : rawValue,
      group
    }];
  });
}

export function buildCatalogPresentationDetails(
  productType: CatalogEditorProductType,
  rawData: unknown
): CatalogPresentationDetails {
  const data = asRecord(rawData);
  const simple = asRecord(data.simple);
  const dimensions = asRecord(data.dimensions ?? data.dimension);
  const weight = asRecord(data.weight);
  const machine = asRecord(data.uniqueMachine ?? data.machine);
  const specifications: CatalogPresentationSpecification[] = [];
  let includedItems: string[] = [];
  let deliveryEstimate: string | null = null;

  if (productType === 'simple') {
    specifications.push(
      ...normalizeSpecificationRows(
        simple.basicInfoRows ?? simple.basicInfo,
        'Osnovni podatki',
        'simple-basic'
      ),
      ...normalizeSpecificationRows(
        simple.technicalSpecs,
        'Tehnične specifikacije',
        'simple-technical'
      )
    );
    deliveryEstimate = asStringOrNull(simple.deliveryTime);
  } else if (productType === 'dimensions') {
    deliveryEstimate = asStringOrNull(dimensions.defaultDeliveryTime);
  } else if (productType === 'weight') {
    const fraction = asStringOrNull(weight.fraction);
    const netMassKg = toCatalogPresentationDisplayValue(weight.netMassKg);
    if (fraction) {
      specifications.push({
        id: 'weight-fraction',
        label: 'Frakcija',
        value: fraction,
        group: 'Osnovni podatki'
      });
    }
    if (netMassKg) {
      specifications.push({
        id: 'weight-net-mass',
        label: 'Neto masa',
        value: `${netMassKg} kg`,
        group: 'Osnovni podatki'
      });
    }
    deliveryEstimate = asStringOrNull(weight.deliveryTime);
  } else if (productType === 'unique_machine') {
    specifications.push(
      ...normalizeSpecificationRows(
        machine.basicInfoRows ?? machine.basicInfo,
        'Osnovni podatki',
        'machine-basic'
      ),
      ...normalizeSpecificationRows(
        machine.specs ?? machine.technicalSpecs,
        'Tehnične specifikacije',
        'machine-technical'
      )
    );
    const safeMachineFields: Array<[string, string, unknown, unknown?]> = [
      [
        'machine-warranty',
        asStringOrNull(machine.warrantyLabel) ?? 'Garancija',
        machine.warrantyMonths,
        machine.warrantyUnit
      ],
      [
        'machine-service',
        asStringOrNull(machine.serviceIntervalLabel) ?? 'Servisni interval',
        machine.serviceIntervalMonths,
        machine.serviceIntervalUnit
      ],
      [
        'machine-package-weight',
        'Masa paketa',
        machine.packageWeightKg,
        machine.packageWeightUnit ?? 'kg'
      ],
      [
        'machine-package-dimensions',
        'Mere paketa',
        machine.packageDimensions
      ]
    ];
    for (const [id, label, rawValue, rawUnit] of safeMachineFields) {
      const displayValue = toCatalogPresentationDisplayValue(rawValue);
      const unit = asStringOrNull(rawUnit);
      if (!displayValue) continue;
      specifications.push({
        id,
        label,
        value: unit ? `${displayValue} ${unit}` : displayValue,
        group: 'Osnovni podatki'
      });
    }
    includedItems = Array.isArray(machine.includedItems)
      ? machine.includedItems
          .map((entry) => asStringOrNull(entry))
          .filter((entry): entry is string => entry !== null)
      : [];
    deliveryEstimate = asStringOrNull(machine.deliveryTime);
  }

  return { specifications, includedItems, deliveryEstimate };
}
