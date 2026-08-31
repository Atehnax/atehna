export const SHIPPING_CALCULATION_VERSION = "shipping-v2" as const;
/** Maximum cents that fits an order money column declared as numeric(12,2). */
export const SHIPPING_MAX_AMOUNT_CENTS = 999_999_999_999;
/** Maximum parcel count that fits the canonical PostgreSQL integer column. */
export const SHIPPING_MAX_PARCEL_COUNT = 2_147_483_647;

export type ShippingAdjustmentType = "fixed" | "percentage";
export const SHIPPING_DIMENSION_COMPARISON_OPERATORS = ['<', '>', '>=', '<='] as const;
export type ShippingDimensionComparisonOperator =
  (typeof SHIPPING_DIMENSION_COMPARISON_OPERATORS)[number];

export type ShippingWeightBand = {
  id: string;
  name: string;
  minWeightGrams: number;
  maxWeightGrams: number | null;
  priceCents: number;
  enabled: boolean;
  position: number;
};

export type ShippingWeightIntervalParseResult =
  | {
      ok: true;
      minWeightGrams: number;
      maxWeightGrams: number | null;
    }
  | {
      ok: false;
      message: string;
    };

function shippingIntervalPrecisionScore(grams: number): number {
  const remainder = Math.abs(grams) % 1_000;
  if (remainder === 0) return 0;
  if (remainder % 100 === 0) return 1;
  if (remainder % 10 === 0) return 2;
  return 3;
}

function formatShippingGramBoundary(grams: number): string {
  return String(grams);
}

/**
 * Formats inclusive whole-gram storage as an equivalent mathematical interval
 * in grams. The simpler boundary is preferred, so 1..4,999 g becomes
 * `(0, 5000)` while 5,000..30,000 g becomes `[5000, 30000]`.
 */
export function formatShippingWeightIntervalGrams(
  band: Pick<ShippingWeightBand, 'minWeightGrams' | 'maxWeightGrams'>
): string {
  const openLowerBoundary = band.minWeightGrams - 1;
  const useOpenLower =
    openLowerBoundary >= 0
    && shippingIntervalPrecisionScore(openLowerBoundary)
      < shippingIntervalPrecisionScore(band.minWeightGrams);
  const lowerBracket = useOpenLower ? '(' : '[';
  const lowerValue = formatShippingGramBoundary(
    useOpenLower ? openLowerBoundary : band.minWeightGrams
  );

  if (band.maxWeightGrams === null) {
    const separator = lowerValue.includes(',') ? '; ' : ', ';
    return `${lowerBracket}${lowerValue}${separator}∞)`;
  }

  const openUpperBoundary = band.maxWeightGrams + 1;
  const useOpenUpper =
    Number.isSafeInteger(openUpperBoundary)
    && shippingIntervalPrecisionScore(openUpperBoundary)
      < shippingIntervalPrecisionScore(band.maxWeightGrams);
  const upperBracket = useOpenUpper ? ')' : ']';
  const upperValue = formatShippingGramBoundary(
    useOpenUpper ? openUpperBoundary : band.maxWeightGrams
  );
  const separator = lowerValue.includes(',') || upperValue.includes(',')
    ? '; '
    : ', ';
  return `${lowerBracket}${lowerValue}${separator}${upperValue}${upperBracket}`;
}

function invalidShippingWeightInterval(message: string): ShippingWeightIntervalParseResult {
  return { ok: false, message };
}

function parseShippingGramBoundary(value: string): number | null {
  const compact = value.trim().replace(/\s+/gu, '');
  if (!/^\d+$/u.test(compact)) return null;
  const grams = Number(compact);
  return Number.isSafeInteger(grams) && grams >= 0 ? grams : null;
}

/**
 * Parses a mathematical interval in grams into inclusive whole-gram storage.
 */
export function parseShippingWeightIntervalGrams(
  value: string
): ShippingWeightIntervalParseResult {
  const source = value.trim();
  if (source.length < 5 || !['(', '['].includes(source[0] ?? '')) {
    return invalidShippingWeightInterval(
      'Območje se mora začeti z »(« ali »[«.'
    );
  }
  const rightBracket = source.at(-1);
  if (rightBracket !== ')' && rightBracket !== ']') {
    return invalidShippingWeightInterval(
      'Območje se mora končati z »)« ali »]«.'
    );
  }

  const inner = source.slice(1, -1).trim();
  const separator = inner.includes(';') ? ';' : ',';
  const boundaries = inner.split(separator);
  if (boundaries.length !== 2) {
    return invalidShippingWeightInterval(
      'Vnesite dve meji v gramih, na primer »[1000, 2000)«.'
    );
  }

  const lowerBoundaryGrams = parseShippingGramBoundary(boundaries[0] ?? '');
  if (lowerBoundaryGrams === null) {
    return invalidShippingWeightInterval(
      'Spodnja meja mora biti nenegativno celo število gramov.'
    );
  }
  const minWeightGrams = source[0] === '['
    ? lowerBoundaryGrams
    : lowerBoundaryGrams + 1;
  if (!Number.isSafeInteger(minWeightGrams) || minWeightGrams <= 0) {
    return invalidShippingWeightInterval(
      'Območje mora vsebovati vsaj en pozitiven cel gram; za začetek pri nič uporabite odprto mejo »(0, …«.'
    );
  }

  const upperBoundary = (boundaries[1] ?? '').trim();
  const isOpenEnded = /^(?:\+?∞|\+?inf(?:inity)?)$/iu.test(upperBoundary);
  if (isOpenEnded) {
    if (rightBracket !== ')') {
      return invalidShippingWeightInterval(
        'Neskončna zgornja meja mora biti odprta: uporabite »∞)«.'
      );
    }
    return { ok: true, minWeightGrams, maxWeightGrams: null };
  }

  const upperBoundaryGrams = parseShippingGramBoundary(upperBoundary);
  if (upperBoundaryGrams === null) {
    return invalidShippingWeightInterval(
      'Zgornja meja mora biti nenegativno celo število gramov ali »∞«.'
    );
  }
  const maxWeightGrams = rightBracket === ']'
    ? upperBoundaryGrams
    : upperBoundaryGrams - 1;
  if (
    !Number.isSafeInteger(maxWeightGrams)
    || maxWeightGrams <= 0
    || maxWeightGrams < minWeightGrams
  ) {
    return invalidShippingWeightInterval(
      'Območje je prazno ali ima zgornjo mejo pred spodnjo.'
    );
  }

  return { ok: true, minWeightGrams, maxWeightGrams };
}

export type ShippingDimensionalRule = {
  id: string;
  name: string;
  comparisonOperator: ShippingDimensionComparisonOperator;
  thresholdMm: number;
  adjustmentType: ShippingAdjustmentType;
  /** Fixed rules store cents; percentage rules store percentage points. */
  adjustmentValue: number | null;
  enabled: boolean;
  position: number;
};

export type ShippingOrderValueDiscountRule = {
  id: string;
  name: string;
  comparisonOperator: ShippingDimensionComparisonOperator;
  minMerchandiseValueCents: number;
  adjustmentType: ShippingAdjustmentType;
  /** Fixed rules store cents; percentage rules store percentage points. */
  adjustmentValue: number | null;
  enabled: boolean;
  position: number;
};

export type ShippingMultiPieceDiscountRule = {
  id: string;
  name: string;
  minParcelCount: number;
  adjustmentType: ShippingAdjustmentType;
  /** Fixed rules store cents per parcel; percentage rules store percentage points. */
  adjustmentValue: number | null;
  enabled: boolean;
  position: number;
};

export type ShippingDraftRule = {
  id: string;
  name: string;
  note: string;
  status: 'draft';
  createdAt: string;
  updatedAt: string;
};

export type ShippingConfiguration = {
  version: number;
  manualQuoteFallbackEnabled: true;
  weightBands: ShippingWeightBand[];
  dimensionalRules: ShippingDimensionalRule[];
  orderValueDiscountRules: ShippingOrderValueDiscountRule[];
  multiPieceDiscountRules: ShippingMultiPieceDiscountRule[];
  draftRules: ShippingDraftRule[];
};

export type ShippingCalculationConfigurationSnapshot = Omit<
  ShippingConfiguration,
  'draftRules'
>;

export type ShippingCalculationContext = {
  /** Merchandise subtotal including VAT, after other discounts and before shipping. */
  merchandiseSubtotalCents?: number;
  /** Number of physical parcels submitted together. */
  parcelCount?: number;
};

export type ShippingMeasurement = {
  weightGrams: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
};

export type ShippingCalculationItemInput = {
  productId: string;
  variantId: string;
  sku: string;
  name: string;
  quantity: number;
  measurement: Partial<ShippingMeasurement> | null;
};

export type ShippingCalculationItemSnapshot = {
  productId: string;
  variantId: string;
  sku: string;
  name: string;
  quantity: number;
  weightGrams: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
};

export type ShippingTriggeringItem = {
  variantId: string;
  sku: string;
  name: string;
  largestDimensionMm: number;
};

export type ShippingConfigurationIssue = {
  code:
    | "INVALID_VERSION"
    | "MANUAL_FALLBACK_REQUIRED"
    | "INVALID_WEIGHT_BAND"
    | "OVERLAPPING_WEIGHT_BANDS"
    | "DUPLICATE_RULE_ID"
    | "INVALID_DIMENSIONAL_RULE"
    | "DUPLICATE_DIMENSIONAL_THRESHOLD"
    | "INVALID_ORDER_VALUE_DISCOUNT_RULE"
    | "DUPLICATE_ORDER_VALUE_THRESHOLD"
    | "INVALID_MULTI_PIECE_DISCOUNT_RULE"
    | "DUPLICATE_MULTI_PIECE_THRESHOLD"
    | "INVALID_DRAFT_RULE";
  message: string;
  ruleId?: string;
};

export type ShippingCalculationIssue = {
  code:
    | "INVALID_CONFIGURATION"
    | "EMPTY_ORDER"
    | "INVALID_QUANTITY"
    | "MISSING_MEASUREMENT"
    | "INVALID_MEASUREMENT"
    | "WEIGHT_OUTSIDE_CONFIGURED_BANDS"
    | "INVALID_MERCHANDISE_SUBTOTAL"
    | "INVALID_PARCEL_COUNT"
    | "CALCULATION_AMOUNT_OUT_OF_RANGE";
  message: string;
  variantId?: string;
  sku?: string;
};

export type ShippingManualOverride = {
  reason: string;
  automaticAmountCents: number | null;
  originalAmountCents: number | null;
  overrideAmountCents: number;
  actorId: string;
  actorName: string | null;
  appliedAt: string;
};

type ShippingCalculationCommon = {
  calculationVersion: typeof SHIPPING_CALCULATION_VERSION;
  configurationVersion: number;
  items: ShippingCalculationItemSnapshot[];
  combinedWeightGrams: number | null;
  largestDimensionMm: number | null;
  triggeringItem: ShippingTriggeringItem | null;
};

export type CalculatedShipping = ShippingCalculationCommon & {
  status: "calculated";
  source: "automatic" | "manual_override";
  basePriceCents: number;
  surchargeAmountCents: number;
  merchandiseSubtotalCents: number;
  parcelCount: number;
  singleParcelAmountCents: number;
  parcelCountGrossAmountCents: number;
  multiPieceDiscountAmountCents: number;
  afterMultiPieceAmountCents: number;
  orderValueDiscountAmountCents: number;
  automaticAmountCents: number;
  finalAmountCents: number;
  matchedWeightBand: ShippingWeightBand;
  matchedDimensionalRule: ShippingDimensionalRule | null;
  matchedMultiPieceDiscountRule: ShippingMultiPieceDiscountRule | null;
  matchedOrderValueDiscountRule: ShippingOrderValueDiscountRule | null;
  configurationSnapshot: ShippingCalculationConfigurationSnapshot;
  manualOverride: ShippingManualOverride | null;
};

export type ManualQuoteShipping = ShippingCalculationCommon & {
  status: "manual_quote";
  reason: string;
  issues: ShippingCalculationIssue[];
};

export type ShippingCalculation = CalculatedShipping | ManualQuoteShipping;

export const DEFAULT_SHIPPING_CONFIGURATION: Readonly<ShippingConfiguration> = {
  version: 1,
  manualQuoteFallbackEnabled: true,
  weightBands: [
    {
      id: "under-5kg",
      name: "Do 5 kg",
      minWeightGrams: 1,
      maxWeightGrams: 4_999,
      priceCents: 300,
      enabled: true,
      position: 0,
    },
    {
      id: "5kg-to-30kg",
      name: "Od 5 kg do 30 kg",
      minWeightGrams: 5_000,
      maxWeightGrams: 30_000,
      priceCents: 1_000,
      enabled: true,
      position: 1,
    },
  ],
  dimensionalRules: [
    {
      id: "larger-than-1000mm",
      name: "Večji artikel",
      comparisonOperator: ">",
      thresholdMm: 1_000,
      adjustmentType: "fixed",
      adjustmentValue: null,
      enabled: false,
      position: 0,
    },
  ],
  orderValueDiscountRules: [],
  multiPieceDiscountRules: [
    {
      id: "multi-piece-2",
      name: "Od 2 paketov",
      minParcelCount: 2,
      adjustmentType: "percentage",
      adjustmentValue: 50,
      enabled: true,
      position: 0,
    },
  ],
  draftRules: [],
};

function cloneConfiguration(configuration: ShippingConfiguration): ShippingConfiguration {
  type LegacyMultiPieceDiscountRule = Omit<
    ShippingMultiPieceDiscountRule,
    'name'
  > & { name?: unknown };
  const legacyConfiguration = configuration as ShippingConfiguration & {
    orderValueDiscountRules?: ShippingOrderValueDiscountRule[];
    multiPieceDiscountRules?: LegacyMultiPieceDiscountRule[];
    draftRules?: ShippingDraftRule[];
  };
  return {
    ...configuration,
    weightBands: configuration.weightBands.map((band) => ({ ...band })),
    dimensionalRules: configuration.dimensionalRules.map((rule) => ({ ...rule })),
    orderValueDiscountRules: Array.isArray(legacyConfiguration.orderValueDiscountRules)
      ? legacyConfiguration.orderValueDiscountRules.map((rule) => ({ ...rule }))
      : [],
    multiPieceDiscountRules: Array.isArray(legacyConfiguration.multiPieceDiscountRules)
      ? legacyConfiguration.multiPieceDiscountRules.map((rule) => ({
          ...rule,
          name: rule.name === undefined
            ? `Od ${String(rule.minParcelCount)} paketov`
            : rule.name
        } as ShippingMultiPieceDiscountRule))
      : DEFAULT_SHIPPING_CONFIGURATION.multiPieceDiscountRules.map((rule) => ({ ...rule })),
    draftRules: Array.isArray(legacyConfiguration.draftRules)
      ? legacyConfiguration.draftRules.map((rule) => ({ ...rule }))
      : [],
  };
}

export function cloneDefaultShippingConfiguration(): ShippingConfiguration {
  return cloneConfiguration(DEFAULT_SHIPPING_CONFIGURATION);
}

export function normalizeShippingConfiguration(
  configuration: ShippingConfiguration,
): ShippingConfiguration {
  const cloned = cloneConfiguration(configuration);
  return {
    ...cloned,
    weightBands: cloned.weightBands
      .map((band) => ({ ...band }))
      .sort((left, right) =>
        left.position - right.position || left.minWeightGrams - right.minWeightGrams,
      )
      .map((band, position) => ({ ...band, position })),
    dimensionalRules: cloned.dimensionalRules
      .map((rule) => {
        const legacyRule = rule as ShippingDimensionalRule & {
          comparisonOperator?: ShippingDimensionComparisonOperator;
        };
        return {
          ...rule,
          comparisonOperator:
            legacyRule.comparisonOperator === undefined
              ? '>'
              : legacyRule.comparisonOperator
        };
      })
      .sort((left, right) =>
        left.position - right.position || left.thresholdMm - right.thresholdMm,
      )
      .map((rule, position) => ({ ...rule, position })),
    orderValueDiscountRules: cloned.orderValueDiscountRules
      .map((rule) => {
        const legacyRule = rule as ShippingOrderValueDiscountRule & {
          comparisonOperator?: ShippingDimensionComparisonOperator;
        };
        return {
          ...rule,
          comparisonOperator:
            legacyRule.comparisonOperator === undefined
              ? '>='
              : legacyRule.comparisonOperator
        };
      })
      .sort((left, right) =>
        left.position - right.position
        || left.minMerchandiseValueCents - right.minMerchandiseValueCents,
      )
      .map((rule, position) => ({ ...rule, position })),
    multiPieceDiscountRules: cloned.multiPieceDiscountRules
      .map((rule) => ({ ...rule }))
      .sort((left, right) =>
        left.position - right.position || left.minParcelCount - right.minParcelCount,
      )
      .map((rule, position) => ({ ...rule, position })),
  };
}

function isPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isSupportedParcelCount(value: number): boolean {
  return isPositiveInteger(value) && value <= SHIPPING_MAX_PARCEL_COUNT;
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function isSupportedAmountCents(value: number): boolean {
  return isNonNegativeInteger(value) && value <= SHIPPING_MAX_AMOUNT_CENTS;
}

function isPositiveFiniteNumber(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isShippingAdjustmentType(value: unknown): value is ShippingAdjustmentType {
  return value === 'fixed' || value === 'percentage';
}

function isShippingDimensionComparisonOperator(
  value: unknown
): value is ShippingDimensionComparisonOperator {
  return SHIPPING_DIMENSION_COMPARISON_OPERATORS.includes(
    value as ShippingDimensionComparisonOperator
  );
}

function matchesShippingComparison(
  value: number,
  comparisonOperator: ShippingDimensionComparisonOperator,
  threshold: number
): boolean {
  switch (comparisonOperator) {
    case '<':
      return value < threshold;
    case '>':
      return value > threshold;
    case '>=':
      return value >= threshold;
    case '<=':
      return value <= threshold;
    default:
      return false;
  }
}

function matchesShippingDimensionalRule(
  rule: ShippingDimensionalRule,
  largestDimensionMm: number
): boolean {
  return matchesShippingComparison(
    largestDimensionMm,
    rule.comparisonOperator,
    rule.thresholdMm
  );
}

function configurationRuleLabel(
  name: unknown,
  id: unknown,
  fallback: string
): string {
  if (typeof name === 'string' && name.trim()) return `»${name.trim()}«`;
  if (typeof id === 'string' && id.trim()) return `»${id.trim()}«`;
  return fallback;
}

export function validateShippingConfiguration(
  configuration: ShippingConfiguration,
): ShippingConfigurationIssue[] {
  const issues: ShippingConfigurationIssue[] = [];

  if (!isPositiveInteger(configuration.version)) {
    issues.push({
      code: "INVALID_VERSION",
      message: "Različica cenika mora biti pozitivno celo število.",
    });
  }
  if (configuration.manualQuoteFallbackEnabled !== true) {
    issues.push({
      code: "MANUAL_FALLBACK_REQUIRED",
      message: "Ročna ponudba mora ostati varna privzeta možnost za nepokrite primere.",
    });
  }

  const seenIds = new Set<string>();
  for (const band of configuration.weightBands) {
    const label = configurationRuleLabel(band.name, band.id, 'brez naziva');
    if (typeof band.id === 'string' && seenIds.has(band.id)) {
      issues.push({
        code: "DUPLICATE_RULE_ID",
        ruleId: band.id,
        message: `Interval ${label} uporablja podvojen identifikator.`,
      });
    }
    if (typeof band.id === 'string') seenIds.add(band.id);
    const addBandIssue = (message: string) => {
      issues.push({
        code: "INVALID_WEIGHT_BAND",
        ruleId: band.id,
        message,
      });
    };
    if (typeof band.id !== 'string' || !band.id.trim()) {
      addBandIssue(`Masni interval ${label} nima veljavnega identifikatorja.`);
    }
    if (typeof band.name !== 'string' || !band.name.trim()) {
      addBandIssue(`Masni interval ${label} nima naziva.`);
    }
    if (typeof band.enabled !== 'boolean') {
      addBandIssue(`Masni interval ${label} nima veljavnega stanja aktivnosti.`);
    }
    if (!isPositiveInteger(band.minWeightGrams)) {
      addBandIssue(`Masni interval ${label} nima veljavne spodnje meje v celih gramih.`);
    }
    if (
      band.maxWeightGrams !== null &&
      (!isPositiveInteger(band.maxWeightGrams) || band.maxWeightGrams < band.minWeightGrams)
    ) {
      addBandIssue(`Masni interval ${label} nima veljavne zgornje meje v celih gramih.`);
    }
    if (!isPositiveInteger(band.priceCents)) {
      addBandIssue(`Masni interval ${label} mora imeti pozitivno ceno v centih.`);
    } else if (band.priceCents > SHIPPING_MAX_AMOUNT_CENTS) {
      addBandIssue(`Cena masnega intervala ${label} presega največji podprti znesek.`);
    }
  }

  const enabledBands = configuration.weightBands
    .filter((band) => band.enabled)
    .sort((left, right) => left.minWeightGrams - right.minWeightGrams);
  for (let index = 1; index < enabledBands.length; index += 1) {
    const previous = enabledBands[index - 1];
    const current = enabledBands[index];
    if (previous.maxWeightGrams === null || current.minWeightGrams <= previous.maxWeightGrams) {
      issues.push({
        code: "OVERLAPPING_WEIGHT_BANDS",
        ruleId: current.id,
        message: `Aktivni interval ${configurationRuleLabel(current.name, current.id, 'brez naziva')} se prekriva z intervalom ${configurationRuleLabel(previous.name, previous.id, 'brez naziva')}.`,
      });
    }
  }

  const seenDimensionalConditions = new Set<string>();
  for (const rule of configuration.dimensionalRules) {
    const label = configurationRuleLabel(rule.name, rule.id, 'brez naziva');
    const conditionKey = `${String(rule.comparisonOperator)}:${String(rule.thresholdMm)}`;
    if (typeof rule.id === 'string' && seenIds.has(rule.id)) {
      issues.push({
        code: "DUPLICATE_RULE_ID",
        ruleId: rule.id,
        message: `Dimenzijsko pravilo ${label} uporablja podvojen identifikator.`,
      });
    }
    if (typeof rule.id === 'string') seenIds.add(rule.id);
    if (seenDimensionalConditions.has(conditionKey)) {
      issues.push({
        code: "DUPLICATE_DIMENSIONAL_THRESHOLD",
        ruleId: rule.id,
        message: `Dimenzijsko pravilo ${label} uporablja že zaseden pogoj ${String(rule.comparisonOperator)} ${String(rule.thresholdMm)} mm.`,
      });
    }
    seenDimensionalConditions.add(conditionKey);
    const addDimensionalIssue = (message: string) => {
      issues.push({
        code: "INVALID_DIMENSIONAL_RULE",
        ruleId: rule.id,
        message,
      });
    };
    if (typeof rule.id !== 'string' || !rule.id.trim()) {
      addDimensionalIssue(`Dimenzijsko pravilo ${label} nima veljavnega identifikatorja.`);
    }
    if (typeof rule.name !== 'string' || !rule.name.trim()) {
      addDimensionalIssue(`Dimenzijsko pravilo ${label} nima naziva.`);
    }
    if (typeof rule.enabled !== 'boolean') {
      addDimensionalIssue(`Dimenzijsko pravilo ${label} nima veljavnega stanja aktivnosti.`);
    }
    if (!isPositiveFiniteNumber(rule.thresholdMm)) {
      addDimensionalIssue(`Dimenzijsko pravilo ${label} nima veljavne meje v milimetrih.`);
    }
    if (!isShippingDimensionComparisonOperator(rule.comparisonOperator)) {
      addDimensionalIssue(`Dimenzijsko pravilo ${label} nima veljavnega operatorja primerjave.`);
    }
    if (rule.adjustmentType !== 'fixed' && rule.adjustmentType !== 'percentage') {
      addDimensionalIssue(`Dimenzijsko pravilo ${label} nima veljavne vrste dodatka.`);
    }
    if (rule.adjustmentValue !== null) {
      if (!Number.isFinite(rule.adjustmentValue) || rule.adjustmentValue < 0) {
        addDimensionalIssue(`Dimenzijsko pravilo ${label} nima veljavne nenegativne vrednosti dodatka.`);
      } else if (rule.adjustmentType === 'fixed' && !Number.isSafeInteger(rule.adjustmentValue)) {
        addDimensionalIssue(`Fiksni dodatek pravila ${label} mora biti podan v celih centih.`);
      } else if (
        rule.adjustmentType === 'fixed' &&
        rule.adjustmentValue > SHIPPING_MAX_AMOUNT_CENTS
      ) {
        addDimensionalIssue(`Fiksni dodatek pravila ${label} presega največji podprti znesek.`);
      }
    }
    if (rule.enabled && rule.adjustmentValue === null) {
      addDimensionalIssue(`Aktivno dimenzijsko pravilo ${label} mora imeti vrednost dodatka.`);
    } else if (rule.enabled && (rule.adjustmentValue ?? 0) <= 0) {
      addDimensionalIssue(`Aktivno dimenzijsko pravilo ${label} mora imeti pozitiven dodatek.`);
    }
  }

  for (const rule of configuration.dimensionalRules.filter(
    (candidate) => candidate.enabled && candidate.adjustmentValue !== null
  )) {
    const label = configurationRuleLabel(rule.name, rule.id, 'brez naziva');
    const overflowingBand = enabledBands.find((band) => {
      if (!isPositiveInteger(band.priceCents) || band.priceCents > SHIPPING_MAX_AMOUNT_CENTS) {
        return false;
      }
      const surcharge = rule.adjustmentType === 'fixed'
        ? rule.adjustmentValue as number
        : Math.round(band.priceCents * ((rule.adjustmentValue as number) / 100));
      return !isSupportedAmountCents(surcharge)
        || band.priceCents + surcharge > SHIPPING_MAX_AMOUNT_CENTS;
    });
    if (overflowingBand) {
      issues.push({
        code: 'INVALID_DIMENSIONAL_RULE',
        ruleId: rule.id,
        message: `Dodatek pravila ${label} skupaj z intervalom ${configurationRuleLabel(overflowingBand.name, overflowingBand.id, 'brez naziva')} presega največji podprti znesek.`
      });
    }
  }

  const seenOrderValueThresholds = new Set<string>();
  for (const rule of configuration.orderValueDiscountRules) {
    const label = configurationRuleLabel(rule.name, rule.id, 'brez naziva');
    if (typeof rule.id === 'string' && seenIds.has(rule.id)) {
      issues.push({
        code: 'DUPLICATE_RULE_ID',
        ruleId: rule.id,
        message: `Popust glede na vrednost ${label} uporablja podvojen identifikator.`
      });
    }
    if (typeof rule.id === 'string') seenIds.add(rule.id);
    const conditionKey = `${String(rule.comparisonOperator)}:${String(rule.minMerchandiseValueCents)}`;
    if (seenOrderValueThresholds.has(conditionKey)) {
      issues.push({
        code: 'DUPLICATE_ORDER_VALUE_THRESHOLD',
        ruleId: rule.id,
        message: `Popust glede na vrednost ${label} uporablja že zaseden pogoj ${String(rule.comparisonOperator)} ${String(rule.minMerchandiseValueCents)} centov.`
      });
    }
    seenOrderValueThresholds.add(conditionKey);
    const addRuleIssue = (message: string) => {
      issues.push({
        code: 'INVALID_ORDER_VALUE_DISCOUNT_RULE',
        ruleId: typeof rule.id === 'string' ? rule.id : undefined,
        message
      });
    };
    if (typeof rule.id !== 'string' || !rule.id.trim()) {
      addRuleIssue(`Popust glede na vrednost ${label} nima veljavnega identifikatorja.`);
    }
    if (typeof rule.name !== 'string' || !rule.name.trim()) {
      addRuleIssue(`Popust glede na vrednost ${label} nima naziva.`);
    }
    if (typeof rule.enabled !== 'boolean') {
      addRuleIssue(`Popust glede na vrednost ${label} nima veljavnega stanja aktivnosti.`);
    }
    if (!isShippingDimensionComparisonOperator(rule.comparisonOperator)) {
      addRuleIssue(`Popust glede na vrednost ${label} nima veljavnega operatorja primerjave.`);
    }
    if (!isSupportedAmountCents(rule.minMerchandiseValueCents)) {
      addRuleIssue(`Popust glede na vrednost ${label} nima veljavnega mejnega zneska v centih.`);
    }
    if (!isShippingAdjustmentType(rule.adjustmentType)) {
      addRuleIssue(`Popust glede na vrednost ${label} nima veljavne vrste popusta.`);
    }
    if (rule.adjustmentValue !== null) {
      if (!Number.isFinite(rule.adjustmentValue) || rule.adjustmentValue < 0) {
        addRuleIssue(`Popust glede na vrednost ${label} nima veljavne nenegativne vrednosti.`);
      } else if (rule.adjustmentType === 'fixed') {
        if (!isSupportedAmountCents(rule.adjustmentValue)) {
          addRuleIssue(`Fiksni popust glede na vrednost ${label} mora biti podan v podprtem celem številu centov.`);
        }
      } else if (rule.adjustmentType === 'percentage' && rule.adjustmentValue > 100) {
        addRuleIssue(`Odstotni popust glede na vrednost ${label} ne sme presegati 100 %.`);
      }
    }
    if (rule.enabled && rule.adjustmentValue === null) {
      addRuleIssue(`Aktivni popust glede na vrednost ${label} mora imeti vrednost.`);
    } else if (rule.enabled && (rule.adjustmentValue ?? 0) <= 0) {
      addRuleIssue(`Aktivni popust glede na vrednost ${label} mora biti pozitiven.`);
    }
  }

  const seenMultiPieceThresholds = new Set<number>();
  for (const rule of configuration.multiPieceDiscountRules) {
    const label = configurationRuleLabel(rule.name, rule.id, 'brez naziva');
    if (typeof rule.id === 'string' && seenIds.has(rule.id)) {
      issues.push({
        code: 'DUPLICATE_RULE_ID',
        ruleId: rule.id,
        message: `Večkosovni popust ${label} uporablja podvojen identifikator.`
      });
    }
    if (typeof rule.id === 'string') seenIds.add(rule.id);
    if (
      Number.isSafeInteger(rule.minParcelCount)
      && seenMultiPieceThresholds.has(rule.minParcelCount)
    ) {
      issues.push({
        code: 'DUPLICATE_MULTI_PIECE_THRESHOLD',
        ruleId: rule.id,
        message: `Večkosovni popust ${label} uporablja že zaseden prag ${String(rule.minParcelCount)} paketov.`
      });
    }
    if (Number.isSafeInteger(rule.minParcelCount)) {
      seenMultiPieceThresholds.add(rule.minParcelCount);
    }
    const addRuleIssue = (message: string) => {
      issues.push({
        code: 'INVALID_MULTI_PIECE_DISCOUNT_RULE',
        ruleId: typeof rule.id === 'string' ? rule.id : undefined,
        message
      });
    };
    if (typeof rule.id !== 'string' || !rule.id.trim()) {
      addRuleIssue(`Večkosovni popust ${label} nima veljavnega identifikatorja.`);
    }
    if (typeof rule.name !== 'string' || !rule.name.trim()) {
      addRuleIssue(`Večkosovni popust ${label} nima naziva.`);
    }
    if (typeof rule.enabled !== 'boolean') {
      addRuleIssue(`Večkosovni popust ${label} nima veljavnega stanja aktivnosti.`);
    }
    if (
      !isSupportedParcelCount(rule.minParcelCount)
      || rule.minParcelCount < 2
    ) {
      addRuleIssue(
        `Večkosovni popust ${label} mora imeti prag med 2 in ${String(SHIPPING_MAX_PARCEL_COUNT)} paketi.`
      );
    }
    if (!isShippingAdjustmentType(rule.adjustmentType)) {
      addRuleIssue(`Večkosovni popust ${label} nima veljavne vrste popusta.`);
    }
    if (rule.adjustmentValue !== null) {
      if (!Number.isFinite(rule.adjustmentValue) || rule.adjustmentValue < 0) {
        addRuleIssue(`Večkosovni popust ${label} nima veljavne nenegativne vrednosti.`);
      } else if (rule.adjustmentType === 'fixed') {
        if (!isSupportedAmountCents(rule.adjustmentValue)) {
          addRuleIssue(`Fiksni večkosovni popust ${label} mora biti podan v podprtem celem številu centov na paket.`);
        }
      } else if (rule.adjustmentType === 'percentage' && rule.adjustmentValue > 100) {
        addRuleIssue(`Odstotni večkosovni popust ${label} ne sme presegati 100 %.`);
      }
    }
    if (rule.enabled && rule.adjustmentValue === null) {
      addRuleIssue(`Aktivni večkosovni popust ${label} mora imeti vrednost.`);
    } else if (rule.enabled && (rule.adjustmentValue ?? 0) <= 0) {
      addRuleIssue(`Aktivni večkosovni popust ${label} mora biti pozitiven.`);
    }
  }

  for (const draft of configuration.draftRules) {
    const label = configurationRuleLabel(draft.name, draft.id, 'brez naziva');
    if (typeof draft.id === 'string' && seenIds.has(draft.id)) {
      issues.push({
        code: 'DUPLICATE_RULE_ID',
        ruleId: draft.id,
        message: `Osnutek ${label} uporablja podvojen identifikator.`
      });
    }
    if (typeof draft.id === 'string') seenIds.add(draft.id);
    const addDraftIssue = (message: string) => {
      issues.push({
        code: 'INVALID_DRAFT_RULE',
        ruleId: typeof draft.id === 'string' ? draft.id : undefined,
        message
      });
    };
    if (typeof draft.id !== 'string' || !draft.id.trim()) {
      addDraftIssue(`Osnutek ${label} nima veljavnega identifikatorja.`);
    }
    if (typeof draft.name !== 'string' || !draft.name.trim()) {
      addDraftIssue(`Osnutek ${label} nima naziva.`);
    }
    if (typeof draft.note !== 'string') {
      addDraftIssue(`Osnutek ${label} nima veljavne opombe.`);
    }
    if (draft.status !== 'draft') {
      addDraftIssue(`Osnutek ${label} nima statusa »draft«.`);
    }
    if (typeof draft.createdAt !== 'string' || Number.isNaN(Date.parse(draft.createdAt))) {
      addDraftIssue(`Osnutek ${label} nima veljavnega časa nastanka.`);
    }
    if (typeof draft.updatedAt !== 'string' || Number.isNaN(Date.parse(draft.updatedAt))) {
      addDraftIssue(`Osnutek ${label} nima veljavnega časa zadnje spremembe.`);
    }
  }

  return issues;
}

export function parseShippingConfiguration(value: unknown): ShippingConfiguration {
  if (!value || typeof value !== "object") {
    throw new Error("Shipping configuration must be an object.");
  }
  const configuration = value as ShippingConfiguration;
  if (
    !Array.isArray(configuration.weightBands) ||
    !Array.isArray(configuration.dimensionalRules) ||
    !Array.isArray(configuration.draftRules) ||
    (
      configuration.orderValueDiscountRules !== undefined
      && !Array.isArray(configuration.orderValueDiscountRules)
    ) ||
    (
      configuration.multiPieceDiscountRules !== undefined
      && !Array.isArray(configuration.multiPieceDiscountRules)
    )
  ) {
    throw new Error("Shipping configuration arrays are missing.");
  }
  const normalized = normalizeShippingConfiguration(configuration);
  const issues = validateShippingConfiguration(normalized);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join(" "));
  }
  return normalized;
}

export function hasCompleteShippingMeasurement(
  measurement: Partial<ShippingMeasurement> | null | undefined,
): measurement is ShippingMeasurement {
  return Boolean(
    measurement &&
      isPositiveInteger(measurement.weightGrams ?? Number.NaN) &&
      isPositiveFiniteNumber(measurement.lengthMm ?? Number.NaN) &&
      isPositiveFiniteNumber(measurement.widthMm ?? Number.NaN) &&
      isPositiveFiniteNumber(measurement.heightMm ?? Number.NaN),
  );
}

function snapshotItem(item: ShippingCalculationItemInput): ShippingCalculationItemSnapshot {
  const valueOrNull = (value: number | undefined) =>
    Number.isFinite(value) ? (value as number) : null;
  return {
    productId: item.productId,
    variantId: item.variantId,
    sku: item.sku,
    name: item.name,
    quantity: item.quantity,
    weightGrams: valueOrNull(item.measurement?.weightGrams),
    lengthMm: valueOrNull(item.measurement?.lengthMm),
    widthMm: valueOrNull(item.measurement?.widthMm),
    heightMm: valueOrNull(item.measurement?.heightMm),
  };
}

function snapshotCalculationConfiguration(
  configuration: ShippingConfiguration
): ShippingCalculationConfigurationSnapshot {
  const cloned = cloneConfiguration(configuration);
  return {
    version: cloned.version,
    manualQuoteFallbackEnabled: cloned.manualQuoteFallbackEnabled,
    weightBands: cloned.weightBands,
    dimensionalRules: cloned.dimensionalRules,
    orderValueDiscountRules: cloned.orderValueDiscountRules,
    multiPieceDiscountRules: cloned.multiPieceDiscountRules
  };
}

function highestQualifyingMultiPieceRule(
  configuration: ShippingConfiguration,
  parcelCount: number
): ShippingMultiPieceDiscountRule | null {
  if (parcelCount <= 1) return null;
  return configuration.multiPieceDiscountRules
    .filter((rule) =>
      rule.enabled
      && rule.adjustmentValue !== null
      && rule.minParcelCount <= parcelCount
    )
    .sort((left, right) =>
      right.minParcelCount - left.minParcelCount || left.position - right.position
    )[0] ?? null;
}

function highestQualifyingOrderValueRule(
  configuration: ShippingConfiguration,
  merchandiseSubtotalCents: number
): ShippingOrderValueDiscountRule | null {
  return configuration.orderValueDiscountRules
    .filter((rule) =>
      rule.enabled
      && rule.adjustmentValue !== null
      && matchesShippingComparison(
        merchandiseSubtotalCents,
        rule.comparisonOperator,
        rule.minMerchandiseValueCents
      )
    )
    .sort((left, right) =>
      right.minMerchandiseValueCents - left.minMerchandiseValueCents
      || left.position - right.position
    )[0] ?? null;
}

function calculationAmountOutOfRange(
  configurationVersion: number,
  items: ShippingCalculationItemSnapshot[],
  combinedWeightGrams: number,
  largestDimensionMm: number,
  triggeringItem: ShippingTriggeringItem | null
): ManualQuoteShipping {
  return manualQuote(
    configurationVersion,
    items,
    [{
      code: 'CALCULATION_AMOUNT_OUT_OF_RANGE',
      message: 'Rezultat pravil poštnine presega podprto denarno območje.'
    }],
    combinedWeightGrams,
    largestDimensionMm,
    triggeringItem
  );
}

function manualQuote(
  configurationVersion: number,
  items: ShippingCalculationItemSnapshot[],
  issues: ShippingCalculationIssue[],
  combinedWeightGrams: number | null = null,
  largestDimensionMm: number | null = null,
  triggeringItem: ShippingTriggeringItem | null = null,
): ManualQuoteShipping {
  return {
    status: "manual_quote",
    calculationVersion: SHIPPING_CALCULATION_VERSION,
    configurationVersion,
    items,
    combinedWeightGrams,
    largestDimensionMm,
    triggeringItem,
    reason: issues.map((issue) => issue.message).join(" "),
    issues,
  };
}

export function calculateShipping(
  configurationInput: ShippingConfiguration,
  inputItems: ShippingCalculationItemInput[],
  context: ShippingCalculationContext = {},
): ShippingCalculation {
  const configuration = normalizeShippingConfiguration(configurationInput);
  const items = inputItems.map(snapshotItem);
  const merchandiseSubtotalCents = context.merchandiseSubtotalCents ?? 0;
  const parcelCount = context.parcelCount ?? 1;
  const configurationIssues = validateShippingConfiguration(configuration);
  if (configurationIssues.length > 0) {
    return manualQuote(configuration.version, items, [
      {
        code: "INVALID_CONFIGURATION",
        message: configurationIssues.map((issue) => issue.message).join(" "),
      },
    ]);
  }
  const contextIssues: ShippingCalculationIssue[] = [];
  if (!isSupportedAmountCents(merchandiseSubtotalCents)) {
    contextIssues.push({
      code: 'INVALID_MERCHANDISE_SUBTOTAL',
      message:
        'Vrednost blaga z DDV mora biti podana kot podprto nenegativno celo število centov.'
    });
  }
  if (!isSupportedParcelCount(parcelCount)) {
    contextIssues.push({
      code: 'INVALID_PARCEL_COUNT',
      message: `Število skupaj oddanih paketov mora biti celo število med 1 in ${String(SHIPPING_MAX_PARCEL_COUNT)}.`
    });
  }
  if (contextIssues.length > 0) {
    return manualQuote(configuration.version, items, contextIssues);
  }
  if (inputItems.length === 0) {
    return manualQuote(configuration.version, items, [
      {
        code: "EMPTY_ORDER",
        message: "Dostave za prazno naročilo ni mogoče izračunati.",
      },
    ]);
  }

  const inputIssues: ShippingCalculationIssue[] = [];
  let combinedWeightGrams = 0;
  let largestDimensionMm = 0;
  let triggeringItem: ShippingTriggeringItem | null = null;

  for (const item of inputItems) {
    if (!isPositiveInteger(item.quantity)) {
      inputIssues.push({
        code: "INVALID_QUANTITY",
        variantId: item.variantId,
        sku: item.sku,
        message: `Količina za ${item.sku || item.name} ni veljavna.`,
      });
      continue;
    }
    if (!item.measurement) {
      inputIssues.push({
        code: "MISSING_MEASUREMENT",
        variantId: item.variantId,
        sku: item.sku,
        message: `Za ${item.sku || item.name} manjkajo podatki za dostavo.`,
      });
      continue;
    }
    if (!hasCompleteShippingMeasurement(item.measurement)) {
      const hasAnyValue = Object.values(item.measurement).some(
        (value) => value !== null && value !== undefined,
      );
      inputIssues.push({
        code: hasAnyValue ? "INVALID_MEASUREMENT" : "MISSING_MEASUREMENT",
        variantId: item.variantId,
        sku: item.sku,
        message: `Podatki za dostavo pri ${item.sku || item.name} niso popolni ali veljavni.`,
      });
      continue;
    }

    const lineWeight = item.measurement.weightGrams * item.quantity;
    if (!Number.isSafeInteger(lineWeight) || !Number.isSafeInteger(combinedWeightGrams + lineWeight)) {
      inputIssues.push({
        code: "INVALID_MEASUREMENT",
        variantId: item.variantId,
        sku: item.sku,
        message: `Skupna masa za ${item.sku || item.name} presega podprto območje.`,
      });
      continue;
    }
    combinedWeightGrams += lineWeight;
    const itemLargestDimension = Math.max(
      item.measurement.lengthMm,
      item.measurement.widthMm,
      item.measurement.heightMm,
    );
    if (itemLargestDimension > largestDimensionMm) {
      largestDimensionMm = itemLargestDimension;
      triggeringItem = {
        variantId: item.variantId,
        sku: item.sku,
        name: item.name,
        largestDimensionMm: itemLargestDimension,
      };
    }
  }

  if (inputIssues.length > 0) {
    return manualQuote(
      configuration.version,
      items,
      inputIssues,
      combinedWeightGrams || null,
      largestDimensionMm || null,
      triggeringItem,
    );
  }

  const activeRuleRegistry = getActiveShippingRuleRegistry(configuration);
  const matchedWeightEntry = activeRuleRegistry.find(
    (entry) =>
      entry.type === 'weight_band' &&
      combinedWeightGrams >= entry.rule.minWeightGrams &&
      (entry.rule.maxWeightGrams === null || combinedWeightGrams <= entry.rule.maxWeightGrams)
  );
  const matchedWeightBand = matchedWeightEntry?.type === 'weight_band'
    ? matchedWeightEntry.rule
    : null;
  if (!matchedWeightBand) {
    return manualQuote(
      configuration.version,
      items,
      [
        {
          code: "WEIGHT_OUTSIDE_CONFIGURED_BANDS",
          message: `Skupna masa ${combinedWeightGrams} g ni pokrita z aktivnim razredom. Potrebna je ročna ponudba.`,
        },
      ],
      combinedWeightGrams,
      largestDimensionMm,
      triggeringItem,
    );
  }

  const matchedDimensionalEntry = activeRuleRegistry.find(
    (entry): entry is Extract<ShippingRuleRegistryEntry, { type: 'dimensional_surcharge' }> =>
      entry.type === 'dimensional_surcharge' &&
      entry.rule.adjustmentValue !== null &&
      matchesShippingDimensionalRule(entry.rule, largestDimensionMm)
  );
  const matchedDimensionalRule = matchedDimensionalEntry?.rule ?? null;
  const surchargeAmountCents = matchedDimensionalRule
    ? matchedDimensionalRule.adjustmentType === "fixed"
      ? Math.round(matchedDimensionalRule.adjustmentValue ?? 0)
      : Math.round(
          matchedWeightBand.priceCents *
            ((matchedDimensionalRule.adjustmentValue ?? 0) / 100),
        )
    : 0;
  const singleParcelAmountCents = matchedWeightBand.priceCents + surchargeAmountCents;
  if (
    !isSupportedAmountCents(surchargeAmountCents) ||
    !isSupportedAmountCents(singleParcelAmountCents)
  ) {
    return calculationAmountOutOfRange(
      configuration.version,
      items,
      combinedWeightGrams,
      largestDimensionMm,
      triggeringItem
    );
  }

  const parcelCountGrossAmountCents = singleParcelAmountCents * parcelCount;
  if (!isSupportedAmountCents(parcelCountGrossAmountCents)) {
    return calculationAmountOutOfRange(
      configuration.version,
      items,
      combinedWeightGrams,
      largestDimensionMm,
      triggeringItem
    );
  }

  const matchedMultiPieceDiscountRule = highestQualifyingMultiPieceRule(
    configuration,
    parcelCount
  );
  let afterMultiPieceAmountCents = parcelCountGrossAmountCents;
  if (
    matchedMultiPieceDiscountRule
    && matchedMultiPieceDiscountRule.adjustmentValue !== null
  ) {
    afterMultiPieceAmountCents =
      matchedMultiPieceDiscountRule.adjustmentType === 'percentage'
        ? Math.round(
            parcelCountGrossAmountCents
            * (1 - matchedMultiPieceDiscountRule.adjustmentValue / 100)
          )
        : parcelCount * Math.max(
            0,
            singleParcelAmountCents - matchedMultiPieceDiscountRule.adjustmentValue
          );
  }
  const multiPieceDiscountAmountCents =
    parcelCountGrossAmountCents - afterMultiPieceAmountCents;
  if (
    !isSupportedAmountCents(afterMultiPieceAmountCents)
    || !isSupportedAmountCents(multiPieceDiscountAmountCents)
  ) {
    return calculationAmountOutOfRange(
      configuration.version,
      items,
      combinedWeightGrams,
      largestDimensionMm,
      triggeringItem
    );
  }

  const matchedOrderValueDiscountRule = highestQualifyingOrderValueRule(
    configuration,
    merchandiseSubtotalCents
  );
  const requestedOrderValueDiscountCents = matchedOrderValueDiscountRule
    && matchedOrderValueDiscountRule.adjustmentValue !== null
    ? matchedOrderValueDiscountRule.adjustmentType === 'percentage'
      ? Math.round(
          afterMultiPieceAmountCents
          * (matchedOrderValueDiscountRule.adjustmentValue / 100)
        )
      : matchedOrderValueDiscountRule.adjustmentValue
    : 0;
  const orderValueDiscountAmountCents = Math.min(
    afterMultiPieceAmountCents,
    requestedOrderValueDiscountCents
  );
  const automaticAmountCents = Math.max(
    0,
    afterMultiPieceAmountCents - orderValueDiscountAmountCents
  );
  if (
    !isSupportedAmountCents(orderValueDiscountAmountCents)
    || !isSupportedAmountCents(automaticAmountCents)
  ) {
    return calculationAmountOutOfRange(
      configuration.version,
      items,
      combinedWeightGrams,
      largestDimensionMm,
      triggeringItem
    );
  }

  return {
    status: "calculated",
    source: "automatic",
    calculationVersion: SHIPPING_CALCULATION_VERSION,
    configurationVersion: configuration.version,
    items,
    combinedWeightGrams,
    largestDimensionMm,
    triggeringItem,
    basePriceCents: matchedWeightBand.priceCents,
    surchargeAmountCents,
    merchandiseSubtotalCents,
    parcelCount,
    singleParcelAmountCents,
    parcelCountGrossAmountCents,
    multiPieceDiscountAmountCents,
    afterMultiPieceAmountCents,
    orderValueDiscountAmountCents,
    automaticAmountCents,
    finalAmountCents: automaticAmountCents,
    matchedWeightBand: { ...matchedWeightBand },
    matchedDimensionalRule: matchedDimensionalRule
      ? { ...matchedDimensionalRule }
      : null,
    matchedMultiPieceDiscountRule: matchedMultiPieceDiscountRule
      ? { ...matchedMultiPieceDiscountRule }
      : null,
    matchedOrderValueDiscountRule: matchedOrderValueDiscountRule
      ? { ...matchedOrderValueDiscountRule }
      : null,
    configurationSnapshot: snapshotCalculationConfiguration(configuration),
    manualOverride: null,
  };
}

/**
 * Recalculates automatic shipping for a changed parcel count exclusively from
 * the configuration, merchandise subtotal, and item measurements frozen on
 * the original calculated snapshot. It never reads current catalogue or
 * shipping settings and does not reapply a manual override.
 */
export function recalculateShippingFromSnapshot(
  calculation: CalculatedShipping,
  parcelCount: number
): ShippingCalculation {
  const configuration: ShippingConfiguration = {
    ...calculation.configurationSnapshot,
    weightBands: calculation.configurationSnapshot.weightBands.map((rule) => ({ ...rule })),
    dimensionalRules: calculation.configurationSnapshot.dimensionalRules.map((rule) => ({ ...rule })),
    orderValueDiscountRules:
      calculation.configurationSnapshot.orderValueDiscountRules.map((rule) => ({ ...rule })),
    multiPieceDiscountRules:
      calculation.configurationSnapshot.multiPieceDiscountRules.map((rule) => ({ ...rule })),
    draftRules: []
  };
  const items: ShippingCalculationItemInput[] = calculation.items.map((item) => {
    const measurement: Partial<ShippingMeasurement> = {};
    if (item.weightGrams !== null) measurement.weightGrams = item.weightGrams;
    if (item.lengthMm !== null) measurement.lengthMm = item.lengthMm;
    if (item.widthMm !== null) measurement.widthMm = item.widthMm;
    if (item.heightMm !== null) measurement.heightMm = item.heightMm;
    return {
      productId: item.productId,
      variantId: item.variantId,
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      measurement: Object.keys(measurement).length > 0 ? measurement : null
    };
  });
  return calculateShipping(configuration, items, {
    merchandiseSubtotalCents: calculation.merchandiseSubtotalCents,
    parcelCount
  });
}

export function applyShippingManualOverride(
  calculation: CalculatedShipping,
  override: ShippingManualOverride,
): CalculatedShipping {
  if (!isSupportedAmountCents(override.overrideAmountCents) || !override.reason.trim()) {
    throw new Error("A shipping override needs a non-negative amount and a reason.");
  }
  return {
    ...calculation,
    source: "manual_override",
    finalAmountCents: override.overrideAmountCents,
    manualOverride: { ...override },
  };
}

export function resetShippingManualOverride(
  calculation: CalculatedShipping
): CalculatedShipping {
  return {
    ...calculation,
    source: 'automatic',
    finalAmountCents: calculation.automaticAmountCents,
    manualOverride: null
  };
}

export function shippingCentsToEuros(cents: number): number {
  if (!isSupportedAmountCents(cents)) {
    throw new Error("Shipping cents must be a supported non-negative integer amount.");
  }
  return cents / 100;
}

export type PersistedOrderShippingReadinessInput = {
  expectedItemCount: number;
  snapshotLineCount: number;
  subtotal: unknown;
  tax: unknown;
  shipping: unknown;
  automaticShipping: unknown;
  total: unknown;
  shippingSnapshot: unknown;
  shippingOverride: unknown;
  shippingOverrideStale: unknown;
  /** Persisted physical parcel count; optional for compatibility with older callers. */
  parcelCount?: unknown;
};

export type PersistedOrderShippingReadiness =
  | { ok: true }
  | { ok: false; message: string };

function persistedJsonRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function persistedJsonEquivalent(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => persistedJsonEquivalent(value, right[index]));
  }
  if (
    !left || typeof left !== 'object'
    || !right || typeof right !== 'object'
  ) {
    return false;
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) =>
      key === rightKeys[index]
      && persistedJsonEquivalent(leftRecord[key], rightRecord[key])
    );
}

function persistedMoneyCents(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    const cents = Math.round(value * 100);
    return Number.isSafeInteger(cents)
      && Math.abs(value * 100 - cents) < 1e-7
      && cents <= SHIPPING_MAX_AMOUNT_CENTS
      ? cents
      : null;
  }
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/u);
  if (!match) return null;
  const cents =
    BigInt(match[1]) * 100n
    + BigInt((match[2] ?? '').padEnd(2, '0'));
  return cents <= BigInt(SHIPPING_MAX_AMOUNT_CENTS)
    ? Number(cents)
    : null;
}

function persistedShippingNotReady(message: string): PersistedOrderShippingReadiness {
  return {
    ok: false,
    message: `Naročila ni mogoče dokončati ali izdati dokumenta: ${message}`
  };
}

/**
 * Validates the frozen order-level shipping contract before a draft becomes
 * operational or a document is issued. It deliberately consumes persisted
 * values instead of recalculating historical orders.
 */
export function validatePersistedOrderShippingReadiness(
  input: PersistedOrderShippingReadinessInput
): PersistedOrderShippingReadiness {
  if (
    !Number.isSafeInteger(input.expectedItemCount)
    || input.expectedItemCount < 1
  ) {
    return persistedShippingNotReady('dodajte vsaj eno veljavno postavko.');
  }
  if (input.snapshotLineCount !== input.expectedItemCount) {
    return persistedShippingNotReady(
      'shranjene postavke potrditve niso usklajene z naročilom.'
    );
  }
  if (input.shippingOverrideStale === true) {
    return persistedShippingNotReady(
      'ročna poštnina je po spremembi postavk zastarela.'
    );
  }
  const persistedParcelCount =
    input.parcelCount === null || input.parcelCount === undefined
      ? null
      : Number(input.parcelCount);
  if (
    persistedParcelCount !== null
    && !isSupportedParcelCount(persistedParcelCount)
  ) {
    return persistedShippingNotReady(
      'shranjeno število skupaj oddanih paketov ni veljavno.'
    );
  }

  const subtotalCents = persistedMoneyCents(input.subtotal);
  const taxCents = persistedMoneyCents(input.tax);
  const shippingCents = persistedMoneyCents(input.shipping);
  const totalCents = persistedMoneyCents(input.total);
  if (
    subtotalCents === null
    || taxCents === null
    || shippingCents === null
    || totalCents === null
    || subtotalCents + taxCents + shippingCents > SHIPPING_MAX_AMOUNT_CENTS
    || subtotalCents + taxCents + shippingCents !== totalCents
  ) {
    return persistedShippingNotReady(
      'shranjeni denarni zneski poštnine in seštevka niso veljavni.'
    );
  }

  const snapshot = persistedJsonRecord(input.shippingSnapshot);
  if (
    !snapshot
    || snapshot.calculationVersion !== SHIPPING_CALCULATION_VERSION
    || !Number.isSafeInteger(snapshot.configurationVersion)
    || Number(snapshot.configurationVersion) < 1
    || !Array.isArray(snapshot.items)
    || snapshot.items.length !== input.expectedItemCount
    || snapshot.items.some((item) => {
      const record = persistedJsonRecord(item);
      return !record || !Number.isSafeInteger(record.quantity) || Number(record.quantity) < 1;
    })
  ) {
    return persistedShippingNotReady(
      'manjka veljaven zamrznjen izračun poštnine za vse postavke.'
    );
  }

  const automaticShippingCents =
    input.automaticShipping === null || input.automaticShipping === undefined
      ? null
      : persistedMoneyCents(input.automaticShipping);
  const override = persistedJsonRecord(input.shippingOverride);
  if (override) {
    if (
      typeof override.reason !== 'string'
      || !override.reason.trim()
      || !isSupportedAmountCents(Number(override.overrideAmountCents))
      || Number(override.overrideAmountCents) !== shippingCents
      || !(
        override.originalAmountCents === null
        || isSupportedAmountCents(Number(override.originalAmountCents))
      )
    ) {
      return persistedShippingNotReady('ročna poštnina nima veljavnega zneska in razloga.');
    }
  }

  if (snapshot.status === 'calculated') {
    const snapshotParcelCount = Number(snapshot.parcelCount);
    const merchandiseSubtotalCents = Number(snapshot.merchandiseSubtotalCents);
    const basePriceCents = Number(snapshot.basePriceCents);
    const surchargeAmountCents = Number(snapshot.surchargeAmountCents);
    const singleParcelAmountCents = Number(snapshot.singleParcelAmountCents);
    const parcelCountGrossAmountCents = Number(snapshot.parcelCountGrossAmountCents);
    const multiPieceDiscountAmountCents = Number(snapshot.multiPieceDiscountAmountCents);
    const afterMultiPieceAmountCents = Number(snapshot.afterMultiPieceAmountCents);
    const orderValueDiscountAmountCents = Number(snapshot.orderValueDiscountAmountCents);
    const snapshotAutomaticAmountCents = Number(snapshot.automaticAmountCents);
    const snapshotFinalAmountCents = Number(snapshot.finalAmountCents);
    const configurationSnapshot = persistedJsonRecord(snapshot.configurationSnapshot);
    let parsedConfigurationSnapshot: ShippingConfiguration | null = null;
    if (
      configurationSnapshot
      && Array.isArray(configurationSnapshot.weightBands)
      && Array.isArray(configurationSnapshot.dimensionalRules)
      && Array.isArray(configurationSnapshot.orderValueDiscountRules)
      && Array.isArray(configurationSnapshot.multiPieceDiscountRules)
    ) {
      try {
        parsedConfigurationSnapshot = parseShippingConfiguration({
          ...configurationSnapshot,
          draftRules: []
        });
      } catch {
        parsedConfigurationSnapshot = null;
      }
    }
    if (
      automaticShippingCents === null
      || !isSupportedParcelCount(snapshotParcelCount)
      || (persistedParcelCount !== null && snapshotParcelCount !== persistedParcelCount)
      || !isSupportedAmountCents(merchandiseSubtotalCents)
      || merchandiseSubtotalCents !== subtotalCents + taxCents
      || !isSupportedAmountCents(basePriceCents)
      || !isSupportedAmountCents(surchargeAmountCents)
      || !isSupportedAmountCents(singleParcelAmountCents)
      || basePriceCents + surchargeAmountCents !== singleParcelAmountCents
      || !isSupportedAmountCents(parcelCountGrossAmountCents)
      || !Number.isSafeInteger(singleParcelAmountCents * snapshotParcelCount)
      || singleParcelAmountCents * snapshotParcelCount !== parcelCountGrossAmountCents
      || !isSupportedAmountCents(multiPieceDiscountAmountCents)
      || multiPieceDiscountAmountCents > parcelCountGrossAmountCents
      || parcelCountGrossAmountCents - multiPieceDiscountAmountCents
        !== afterMultiPieceAmountCents
      || !isSupportedAmountCents(afterMultiPieceAmountCents)
      || !isSupportedAmountCents(orderValueDiscountAmountCents)
      || orderValueDiscountAmountCents > afterMultiPieceAmountCents
      || afterMultiPieceAmountCents - orderValueDiscountAmountCents
        !== snapshotAutomaticAmountCents
      || !isSupportedAmountCents(snapshotAutomaticAmountCents)
      || !isSupportedAmountCents(snapshotFinalAmountCents)
      || snapshotAutomaticAmountCents !== automaticShippingCents
      || snapshotFinalAmountCents !== automaticShippingCents
      || !parsedConfigurationSnapshot
      || parsedConfigurationSnapshot.version !== Number(snapshot.configurationVersion)
    ) {
      return persistedShippingNotReady(
        'samodejni izračun poštnine ni usklajen s shranjenim zneskom.'
      );
    }

    const replaySnapshot = {
      ...snapshot,
      configurationSnapshot: snapshotCalculationConfiguration(
        parsedConfigurationSnapshot as ShippingConfiguration
      )
    } as unknown as CalculatedShipping;
    const recalculated = recalculateShippingFromSnapshot(
      replaySnapshot,
      snapshotParcelCount
    );
    const persistedRuleMatches = (
      value: unknown,
      expected: Record<string, unknown> | null
    ) => {
      if (expected === null) return value === null;
      const persisted = persistedJsonRecord(value);
      return persisted !== null
        && persistedJsonEquivalent(persisted, expected);
    };
    const persistedOrderValueRuleMatches = (
      value: unknown,
      expected: Record<string, unknown> | null
    ) => {
      if (expected === null) return value === null;
      const persisted = persistedJsonRecord(value);
      if (!persisted) return false;
      const compatiblePersisted = persisted.comparisonOperator === undefined
        ? { ...persisted, comparisonOperator: '>=' }
        : persisted;
      return persistedJsonEquivalent(compatiblePersisted, expected);
    };
    if (
      recalculated.status !== 'calculated'
      || recalculated.basePriceCents !== basePriceCents
      || recalculated.surchargeAmountCents !== surchargeAmountCents
      || recalculated.singleParcelAmountCents !== singleParcelAmountCents
      || recalculated.parcelCountGrossAmountCents !== parcelCountGrossAmountCents
      || recalculated.multiPieceDiscountAmountCents !== multiPieceDiscountAmountCents
      || recalculated.afterMultiPieceAmountCents !== afterMultiPieceAmountCents
      || recalculated.orderValueDiscountAmountCents !== orderValueDiscountAmountCents
      || recalculated.automaticAmountCents !== snapshotAutomaticAmountCents
      || !persistedRuleMatches(
        snapshot.matchedWeightBand,
        recalculated.matchedWeightBand as unknown as Record<string, unknown>
      )
      || !persistedRuleMatches(
        snapshot.matchedDimensionalRule,
        recalculated.matchedDimensionalRule as unknown as Record<string, unknown> | null
      )
      || !persistedRuleMatches(
        snapshot.matchedMultiPieceDiscountRule,
        recalculated.matchedMultiPieceDiscountRule as unknown as Record<string, unknown> | null
      )
      || !persistedOrderValueRuleMatches(
        snapshot.matchedOrderValueDiscountRule,
        recalculated.matchedOrderValueDiscountRule as unknown as Record<string, unknown> | null
      )
    ) {
      return persistedShippingNotReady(
        'zamrznjena pravila in razčlenitev poštnine niso medsebojno usklajeni.'
      );
    }
    if (override) {
      if (
        !isSupportedAmountCents(Number(override.automaticAmountCents))
        || Number(override.automaticAmountCents) !== automaticShippingCents
      ) {
        return persistedShippingNotReady(
          'ročna poštnina ne ohranja pravilnega samodejnega izhodišča.'
        );
      }
    } else if (shippingCents !== automaticShippingCents) {
      return persistedShippingNotReady(
        'končni znesek poštnine se ne ujema s samodejnim izračunom.'
      );
    }
    return { ok: true };
  }

  if (snapshot.status === 'manual_quote') {
    if (
      automaticShippingCents !== null
      || !override
      || override.automaticAmountCents !== null
    ) {
      return persistedShippingNotReady(
        'poštnina po dogovoru zahteva veljavno ročno določitev.'
      );
    }
    return { ok: true };
  }

  return persistedShippingNotReady('status izračuna poštnine ni veljaven.');
}

export type ShippingRuleRegistryEntry =
  | { type: "weight_band"; rule: ShippingWeightBand }
  | { type: "dimensional_surcharge"; rule: ShippingDimensionalRule }
  | { type: "order_value_discount"; rule: ShippingOrderValueDiscountRule }
  | { type: "multi_piece_discount"; rule: ShippingMultiPieceDiscountRule };

export function getActiveShippingRuleRegistry(
  configuration: ShippingConfiguration,
): ShippingRuleRegistryEntry[] {
  return [
    ...configuration.weightBands
      .filter((rule) => rule.enabled)
      .map((rule) => ({ type: "weight_band" as const, rule: { ...rule } })),
    ...configuration.dimensionalRules
      .filter((rule) => rule.enabled)
      .map((rule) => ({ type: "dimensional_surcharge" as const, rule: { ...rule } })),
    ...configuration.orderValueDiscountRules
      .filter((rule) => rule.enabled)
      .map((rule) => ({ type: "order_value_discount" as const, rule: { ...rule } })),
    ...configuration.multiPieceDiscountRules
      .filter((rule) => rule.enabled)
      .map((rule) => ({ type: "multi_piece_discount" as const, rule: { ...rule } })),
  ];
}
