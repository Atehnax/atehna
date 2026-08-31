type LegacyCatalogEditorProductType = 'simple' | 'dimensions' | 'weight' | 'unique_machine';
type LegacyCatalogItemTypeSpecificData = Record<string, unknown>;

export const CATALOG_SHIPPING_FIELDS = [
  'shippingWeightGrams',
  'shippingLengthMm',
  'shippingWidthMm',
  'shippingHeightMm'
] as const;

export type CatalogShippingField = (typeof CATALOG_SHIPPING_FIELDS)[number];

export type CatalogShippingMeasurements = {
  shippingWeightGrams?: number | null;
  shippingLengthMm?: number | null;
  shippingWidthMm?: number | null;
  shippingHeightMm?: number | null;
};

export type CatalogShippingReadiness = {
  isReady: boolean;
  missingFields: CatalogShippingField[];
  invalidFields: CatalogShippingField[];
};

export type LegacyCatalogShippingDerivation = {
  measurements: Required<CatalogShippingMeasurements>;
  conflictFields: CatalogShippingField[];
};

export const CATALOG_SHIPPING_FIELD_LABELS: Record<CatalogShippingField, string> = {
  shippingWeightGrams: 'masa (g)',
  shippingLengthMm: 'dolžina (mm)',
  shippingWidthMm: 'širina (mm)',
  shippingHeightMm: 'višina/debelina (mm)'
};

/** Maximum positive value representable by the canonical numeric(12,3) columns. */
export const CATALOG_SHIPPING_MAX_DECIMAL_VALUE = 999_999_999.999;
export const CATALOG_SHIPPING_MAX_WEIGHT_GRAMS = 999_999_999;

export function isValidCatalogShippingMeasurement(
  field: CatalogShippingField,
  value: number
): boolean {
  if (!Number.isFinite(value) || value <= 0) return false;
  if (field === 'shippingWeightGrams') {
    return Number.isSafeInteger(value) && value <= CATALOG_SHIPPING_MAX_WEIGHT_GRAMS;
  }
  if (value > CATALOG_SHIPPING_MAX_DECIMAL_VALUE) return false;
  const scaled = value * 1000;
  const nearestInteger = Math.round(scaled);
  return Number.isSafeInteger(nearestInteger)
    && Math.abs(scaled - nearestInteger) < 1e-7;
}

export function catalogShippingMeasurementRequirement(field: CatalogShippingField): string {
  return field === 'shippingWeightGrams'
    ? `pozitivno celo število do ${CATALOG_SHIPPING_MAX_WEIGHT_GRAMS} g`
    : `pozitivno število do ${CATALOG_SHIPPING_MAX_DECIMAL_VALUE} mm z največ tremi decimalkami`;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asPositiveNumberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

const kilogramsToWholeGrams = (value: unknown): number | null => {
  const kilograms = asPositiveNumberOrNull(value);
  if (kilograms === null) return null;
  const grams = kilograms * 1000;
  const rounded = Math.round(grams);
  return Number.isSafeInteger(rounded) && Math.abs(grams - rounded) < 1e-9
    ? rounded
    : null;
};

const measurementsConflict = (left: number, right: number) =>
  Math.abs(left - right) > 1e-9;

export function hasCatalogShippingFields(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return CATALOG_SHIPPING_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(value, field));
}

export function hasCatalogShippingValue(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return CATALOG_SHIPPING_FIELDS.some((field) => {
    const fieldValue = value[field];
    return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
  });
}

export function readCatalogShippingMeasurements(value: unknown): Required<CatalogShippingMeasurements> {
  const record = isRecord(value) ? value : {};
  return {
    shippingWeightGrams: record.shippingWeightGrams == null
      ? null
      : typeof record.shippingWeightGrams === 'number'
        ? record.shippingWeightGrams
        : null,
    shippingLengthMm: record.shippingLengthMm == null
      ? null
      : typeof record.shippingLengthMm === 'number'
        ? record.shippingLengthMm
        : null,
    shippingWidthMm: record.shippingWidthMm == null
      ? null
      : typeof record.shippingWidthMm === 'number'
        ? record.shippingWidthMm
        : null,
    shippingHeightMm: record.shippingHeightMm == null
      ? null
      : typeof record.shippingHeightMm === 'number'
        ? record.shippingHeightMm
        : null
  };
}

export function getEffectiveCatalogShippingMeasurements(
  itemDefaults: CatalogShippingMeasurements,
  variantOverrides: CatalogShippingMeasurements
): Required<CatalogShippingMeasurements> {
  const defaults = readCatalogShippingMeasurements(itemDefaults);
  const overrides = readCatalogShippingMeasurements(variantOverrides);
  return {
    shippingWeightGrams: overrides.shippingWeightGrams ?? defaults.shippingWeightGrams,
    shippingLengthMm: overrides.shippingLengthMm ?? defaults.shippingLengthMm,
    shippingWidthMm: overrides.shippingWidthMm ?? defaults.shippingWidthMm,
    shippingHeightMm: overrides.shippingHeightMm ?? defaults.shippingHeightMm
  };
}

export function getCatalogShippingReadiness(
  itemDefaults: CatalogShippingMeasurements,
  variantOverrides: CatalogShippingMeasurements
): CatalogShippingReadiness {
  const effective = getEffectiveCatalogShippingMeasurements(itemDefaults, variantOverrides);
  const missingFields: CatalogShippingField[] = [];
  const invalidFields: CatalogShippingField[] = [];

  for (const field of CATALOG_SHIPPING_FIELDS) {
    const value = effective[field];
    if (value === null || value === undefined) {
      missingFields.push(field);
    } else if (!isValidCatalogShippingMeasurement(field, value)) {
      invalidFields.push(field);
    }
  }

  return {
    isReady: missingFields.length === 0 && invalidFields.length === 0,
    missingFields,
    invalidFields
  };
}

/**
 * Derives the checkout-facing shipping snapshot from the physical measurements
 * authored for a purchasable catalogue variant.
 *
 * Catalogue variant weight is stored in kilograms with gram precision, while
 * its three physical axes are stored in millimetres. Shipping snapshots use
 * whole grams and map thickness to the package height axis.
 */
export function deriveCatalogVariantShippingMeasurements(variant: {
  weight?: unknown;
  length?: unknown;
  width?: unknown;
  thickness?: unknown;
}): Required<CatalogShippingMeasurements> {
  return {
    shippingWeightGrams: kilogramsToWholeGrams(variant.weight),
    shippingLengthMm: asPositiveNumberOrNull(variant.length),
    shippingWidthMm: asPositiveNumberOrNull(variant.width),
    shippingHeightMm: asPositiveNumberOrNull(variant.thickness)
  };
}

const DIMENSION_UNIT_FACTORS_TO_MM = {
  mm: 1,
  cm: 10,
  m: 1000
} as const;

type DimensionUnit = keyof typeof DIMENSION_UNIT_FACTORS_TO_MM;

function parseExplicitDimensionPart(value: string): { amount: number; unit: DimensionUnit | null } | null {
  const match = value.trim().match(/^([+]?(?:\d+(?:[.,]\d+)?|[.,]\d+))\s*(mm|cm|m)?$/iu);
  if (!match) return null;
  const amount = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    amount,
    unit: match[2]?.toLowerCase() as DimensionUnit | undefined ?? null
  };
}

/**
 * Parses only an explicit three-axis package value such as `620 x 380 x 330 mm`.
 * Axis order is length x width x height. A unit is mandatory and is never guessed.
 */
export function parseExplicitPackageDimensionsMm(value: unknown): {
  shippingLengthMm: number;
  shippingWidthMm: number;
  shippingHeightMm: number;
} | null {
  if (typeof value !== 'string') return null;
  const parts = value.trim().split(/\s*(?:x|×)\s*/iu);
  if (parts.length !== 3) return null;
  const parsed = parts.map(parseExplicitDimensionPart);
  if (parsed.some((entry) => entry === null)) return null;
  const dimensions = parsed as Array<{ amount: number; unit: DimensionUnit | null }>;
  const explicitUnits = dimensions.map((entry) => entry.unit).filter((entry): entry is DimensionUnit => entry !== null);
  const resolvedUnits = explicitUnits.length === dimensions.length
    ? dimensions.map((entry) => entry.unit as DimensionUnit)
    : explicitUnits.length === 1 && dimensions[2].unit !== null
      ? dimensions.map(() => dimensions[2].unit as DimensionUnit)
      : null;
  if (resolvedUnits === null) return null;
  const valuesMm = dimensions.map((entry, index) =>
    entry.amount * DIMENSION_UNIT_FACTORS_TO_MM[resolvedUnits[index]]
  );
  if (valuesMm.some((entry) => !Number.isFinite(entry) || entry <= 0)) return null;
  return {
    shippingLengthMm: valuesMm[0],
    shippingWidthMm: valuesMm[1],
    shippingHeightMm: valuesMm[2]
  };
}

function findWeightVariantData(
  typeSpecificData: LegacyCatalogItemTypeSpecificData,
  variant: Record<string, unknown>,
  variantIndex: number
): Record<string, unknown> {
  const weightData = isRecord(typeSpecificData.weight) ? typeSpecificData.weight : {};
  const entries = Array.isArray(weightData.variants)
    ? weightData.variants.filter(isRecord)
    : [];
  const variantId = variant.id == null ? '' : String(variant.id);
  const variantSku = typeof variant.variantSku === 'string'
    ? variant.variantSku.trim().toLocaleLowerCase('sl')
    : typeof variant.sku === 'string'
      ? variant.sku.trim().toLocaleLowerCase('sl')
      : '';
  return entries.find((entry) => variantId && String(entry.id ?? '') === variantId)
    ?? entries.find((entry) => {
      const entrySku = typeof entry.sku === 'string' ? entry.sku.trim().toLocaleLowerCase('sl') : '';
      return Boolean(variantSku && entrySku === variantSku);
    })
    ?? entries[variantIndex]
    ?? weightData;
}

/**
 * One-way compatibility adapter for rows created before canonical shipping columns.
 * It relies only on audited editor-type contracts or explicit unit-bearing fields.
 * It deliberately does not infer units from the numeric magnitude.
 */
export function deriveLegacyCatalogVariantShippingWithConflicts(options: {
  productType: LegacyCatalogEditorProductType;
  typeSpecificData?: LegacyCatalogItemTypeSpecificData;
  variant: Record<string, unknown>;
  variantIndex: number;
}): LegacyCatalogShippingDerivation {
  const { productType, variant, variantIndex } = options;
  const typeSpecificData = options.typeSpecificData ?? {};
  const empty: Required<CatalogShippingMeasurements> = {
    shippingWeightGrams: null,
    shippingLengthMm: null,
    shippingWidthMm: null,
    shippingHeightMm: null
  };

  if (productType === 'dimensions') {
    // Legacy dimension-editor rows were authored as kg despite the later `g` UI suffix.
    const legacyWeightGrams = kilogramsToWholeGrams(variant.weight);
    return {
      measurements: {
        shippingWeightGrams: legacyWeightGrams,
        shippingLengthMm: asPositiveNumberOrNull(variant.length),
        shippingWidthMm: asPositiveNumberOrNull(variant.width),
        shippingHeightMm: asPositiveNumberOrNull(variant.thickness)
      },
      conflictFields: []
    };
  }

  if (productType === 'weight') {
    const weightVariant = findWeightVariantData(typeSpecificData, variant, variantIndex);
    const explicitNetMassGrams = kilogramsToWholeGrams(weightVariant.netMassKg);
    return {
      measurements: {
        ...empty,
        shippingWeightGrams: explicitNetMassGrams
      },
      conflictFields: []
    };
  }

  if (productType === 'unique_machine') {
    const machineData = isRecord(typeSpecificData.uniqueMachine)
      ? typeSpecificData.uniqueMachine
      : isRecord(typeSpecificData.machine)
        ? typeSpecificData.machine
        : {};
    const packageWeightGrams = kilogramsToWholeGrams(machineData.packageWeightKg);
    const packageDimensions = parseExplicitPackageDimensionsMm(machineData.packageDimensions);
    const axisDimensions = {
      shippingLengthMm: asPositiveNumberOrNull(variant.length),
      shippingWidthMm: asPositiveNumberOrNull(variant.width),
      shippingHeightMm: asPositiveNumberOrNull(variant.thickness)
    };
    const dimensionFields = [
      'shippingLengthMm',
      'shippingWidthMm',
      'shippingHeightMm'
    ] as const;
    const explicitPackageDimensions = packageDimensions;
    const dimensionConflictFields = explicitPackageDimensions === null
      ? []
      : dimensionFields.filter((field) => {
          const axisValue = axisDimensions[field];
          return axisValue !== null
            && measurementsConflict(explicitPackageDimensions[field], axisValue);
        });
    const conflictFields: CatalogShippingField[] = [
      ...dimensionConflictFields
    ];
    // Package dimensions and structured axes are two representations of one
    // physical package. If even one supplied axis conflicts, do not create a
    // seemingly complete hybrid from the remaining package values.
    const resolvedDimensions = Object.fromEntries(
      dimensionFields.map((field) => [
        field,
        dimensionConflictFields.length > 0
          ? null
          : packageDimensions?.[field] ?? axisDimensions[field]
      ])
    ) as Pick<Required<CatalogShippingMeasurements>, typeof dimensionFields[number]>;
    return {
      measurements: {
        shippingWeightGrams: packageWeightGrams,
        shippingLengthMm: resolvedDimensions.shippingLengthMm,
        shippingWidthMm: resolvedDimensions.shippingWidthMm,
        shippingHeightMm: resolvedDimensions.shippingHeightMm
      },
      conflictFields
    };
  }

  // The legacy simple editor labelled generic weight as grams in some places
  // and kilograms in others. Do not guess: require a canonical value instead.
  return {
    measurements: {
      shippingWeightGrams: null,
      shippingLengthMm: asPositiveNumberOrNull(variant.length),
      shippingWidthMm: asPositiveNumberOrNull(variant.width),
      shippingHeightMm: asPositiveNumberOrNull(variant.thickness)
    },
    conflictFields: []
  };
}

export function deriveLegacyCatalogVariantShipping(options: {
  productType: LegacyCatalogEditorProductType;
  typeSpecificData?: LegacyCatalogItemTypeSpecificData;
  variant: Record<string, unknown>;
  variantIndex: number;
}): Required<CatalogShippingMeasurements> {
  return deriveLegacyCatalogVariantShippingWithConflicts(options).measurements;
}
