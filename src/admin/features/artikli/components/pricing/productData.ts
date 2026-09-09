import { createVariant, formatCurrency, type Variant } from '@/admin/features/artikli/lib/familyModel';
import { formatDecimalForDisplay, formatDecimalForSku, parseDecimalInput } from '@/admin/features/artikli/lib/decimalFormat';
import { formatPieceQuantity, formatQuantityWithUnit } from './unitFormatters';
import type {
  CatalogItemQuantityDiscountRule,
  PricingSimulatorOption,
  ProductDataNormalizationContext,
  SimpleProductData,
  SpecRow,
  TypeSpecificProductData,
  UniqueMachineProductData,
  UniversalProductSpecificData,
  WeightFractionInventoryRow,
  WeightProductData,
  WeightVariant
} from './pricingTypes';
import type { QuantityDiscountDraft } from '@/shared/domain/catalog/catalogAdminTypes';
import { parseExplicitPackageDimensionsMm } from '@/shared/domain/catalog/catalogShipping';

export const allDiscountTargetLabel = 'Vse';
export const adminProductInputChipClassName =
  'inline-flex h-5 items-center gap-1 rounded-md border border-[#b9d4fb] bg-[#f3f8fc] px-1.5 text-[11px] font-semibold text-[#1982bf]';

const allQuantityDiscountTargetsJson = '{"variants":["Vse"],"customers":["Vse"]}';

const defaultQuantityDiscountRows: CatalogItemQuantityDiscountRule[] = [
  { minQuantity: 1, discountPercent: 0, appliesTo: allQuantityDiscountTargetsJson, note: '', position: 0 },
  { minQuantity: 10, discountPercent: 3, appliesTo: allQuantityDiscountTargetsJson, note: '', position: 1 },
  { minQuantity: 25, discountPercent: 5, appliesTo: allQuantityDiscountTargetsJson, note: '', position: 2 },
  { minQuantity: 50, discountPercent: 8, appliesTo: allQuantityDiscountTargetsJson, note: '', position: 3 }
];

export const defaultSimpleProductData: SimpleProductData = {
  basePrice: 0,
  actionPrice: 0,
  actionPriceEnabled: false,
  weightGrams: null,
  lengthMm: null,
  widthMm: null,
  thicknessMm: null,
  stock: 0,
  minStock: 0,
  deliveryTime: '',
  moq: 1,
  warehouseLocation: '',
  saleStatus: 'active',
  visibleInStore: true,
  showAsNew: false,
  requireInstructions: false,
  basicInfoRows: [],
  technicalSpecs: []
};

export const defaultWeightProductData: WeightProductData = {
  pricingBasis: 'kg',
  minQuantity: 1,
  fraction: '0-2 mm',
  netMassKg: 25,
  stockKg: 25000,
  deliveryTime: '1-2 delovna dneva',
  packagingChips: ['kg:0,5', 'kg:1', 'kg:2'],
  fractionChips: ['0-2 mm'],
  colorChips: ['—'],
  fractionInventory: [{
    id: 'fraction-0-2-mm',
    fraction: '0-2 mm',
    color: '—',
    stockKg: 25000,
    reservedKg: 0,
    deliveryTime: '1-2 delovna dneva'
  }],
  variants: []
};

export const defaultMachineProductData: UniqueMachineProductData = {
  basePrice: 0,
  discountPercent: 0,
  stock: 0,
  warrantyLabel: 'Garancija',
  warrantyMonths: '',
  warrantyUnit: '',
  serviceIntervalLabel: 'Servisni interval',
  serviceIntervalMonths: '',
  serviceIntervalUnit: '',
  deliveryTime: '',
  packageWeightKg: 0,
  packageWeightUnit: '',
  packageLengthMm: null,
  packageWidthMm: null,
  packageThicknessMm: null,
  packageDimensions: '',
  warnings: '',
  basicInfoRows: [],
  serialNumbers: [],
  specs: [],
  includedItems: []
};

export const defaultDimensionProductData = {
  defaultDeliveryTime: '',
  variantDeliveryTimes: {} as Record<string, string>,
  variantInventory: [] as Array<Record<string, unknown>>
};

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseDecimalInput(value);
    if (parsed !== null) return parsed;
  }
  return fallback;
}

export function asStringArray(value: unknown, fallback: string[] = []): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry).trim()).filter(Boolean) : fallback;
}

export function createLocalId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function splitMachineSpecValueAndUnit(value: string, unit: string): { value: string; unit: string } {
  const trimmedValue = value.trim();
  const trimmedUnit = unit.trim();
  if (trimmedUnit || !trimmedValue) {
    return { value: trimmedValue, unit: trimmedUnit };
  }

  const match = trimmedValue.match(/^(.+?)\s+([^\d\s].*)$/u);
  if (!match) {
    return { value: trimmedValue, unit: '' };
  }

  return { value: match[1].trim(), unit: match[2].trim() };
}

export function normalizeSpecRows(value: unknown, fallback: SpecRow[], idPrefix: string): SpecRow[] {
  if (!Array.isArray(value)) return fallback;
  return value
    .map((entry, index) => {
      const spec = asRecord(entry);
      const rawValue = asString(spec.value, '');
      const rawUnit = asString(spec.unit, '');
      const normalized = idPrefix === 'machine-spec'
        ? splitMachineSpecValueAndUnit(rawValue, rawUnit)
        : { value: rawValue, unit: rawUnit.trim() };
      const rawProperty = asString(spec.property, '');
      return {
        id: asString(spec.id, `${idPrefix}-${index}`),
        property: idPrefix === 'machine-spec' && rawProperty.trim() === 'Teža' ? 'Masa' : rawProperty,
        value: normalized.value,
        unit: normalized.unit
      };
    })
    .filter((entry) => entry.property.trim() || entry.value.trim() || entry.unit.trim());
}

export function weightSkuPart(value: string): string {
  return value
    .trim()
    .toLocaleUpperCase('sl-SI')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function normalizeDiscountTarget(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLocaleLowerCase('sl-SI') === 'vse' ? allDiscountTargetLabel : trimmed;
}

export function normalizeDiscountTargetList(values?: readonly string[], fallback = [allDiscountTargetLabel]): string[] {
  const normalized: string[] = [];
  for (const value of values ?? []) {
    const target = normalizeDiscountTarget(value);
    if (!target) continue;
    if (target === allDiscountTargetLabel) return [allDiscountTargetLabel];
    if (!normalized.some((entry) => entry.toLocaleLowerCase('sl-SI') === target.toLocaleLowerCase('sl-SI'))) {
      normalized.push(target);
    }
  }
  return normalized.length > 0 ? normalized : fallback;
}

export function normalizeDiscountSuggestionList(values: readonly string[]): string[] {
  const normalized: string[] = [];
  for (const value of values) {
    const target = normalizeDiscountTarget(value);
    if (!target) continue;
    if (!normalized.some((entry) => entry.toLocaleLowerCase('sl-SI') === target.toLocaleLowerCase('sl-SI'))) {
      normalized.push(target);
    }
  }
  return normalized;
}

export function parseQuantityDiscountTargets(appliesTo?: string | null): {
  variantTargets: string[];
  customerTargets: string[];
} {
  const normalized = appliesTo?.trim();
  if (!normalized) {
    return { variantTargets: [allDiscountTargetLabel], customerTargets: [allDiscountTargetLabel] };
  }
  try {
    const record = asRecord(JSON.parse(normalized));
    return {
      variantTargets: normalizeDiscountTargetList(asStringArray(record.variants), []),
      customerTargets: normalizeDiscountTargetList(asStringArray(record.customers), [])
    };
  } catch {
    return { variantTargets: [], customerTargets: [] };
  }
}

export function serializeQuantityDiscountTargets(rule: Pick<QuantityDiscountDraft, 'variantTargets' | 'customerTargets'>): string {
  const variantTargets = normalizeDiscountTargetList(rule.variantTargets);
  const customerTargets = normalizeDiscountTargetList(rule.customerTargets);
  return JSON.stringify({ variants: variantTargets, customers: customerTargets });
}

export function createQuantityDiscountDraft(rule: CatalogItemQuantityDiscountRule | Record<string, unknown>, index: number): QuantityDiscountDraft {
  const record = asRecord(rule);
  const targets = parseQuantityDiscountTargets(asString(record.appliesTo, allQuantityDiscountTargetsJson));
  const minQuantity = Math.max(1, Math.floor(asNumber(record.minQuantity, 1)));
  const discountPercent = Math.min(100, Math.max(0, asNumber(record.discountPercent, 0)));
  const targetKey = weightSkuPart([...targets.variantTargets, ...targets.customerTargets].join('-')) || 'ALL';
  const persistedId = typeof record.id === 'number' ? record.id : null;
  return {
    id: persistedId ? `persisted-${persistedId}` : `quantity-discount-${index}-${minQuantity}-${weightSkuPart(String(discountPercent)) || '0'}-${targetKey}`,
    persistedId,
    minQuantity,
    discountPercent,
    appliesTo: JSON.stringify({ variants: targets.variantTargets, customers: targets.customerTargets }),
    variantTargets: targets.variantTargets,
    customerTargets: targets.customerTargets,
    note: asString(record.note, ''),
    position: Math.floor(asNumber(record.position, index))
  };
}

export function createInitialQuantityDiscountDrafts(
  rules: readonly CatalogItemQuantityDiscountRule[] | undefined,
  productType = 'dimensions'
): QuantityDiscountDraft[] {
  const source = rules && rules.length > 0 ? rules : productType === 'unique_machine' ? [] : defaultQuantityDiscountRows;
  return source
    .map((rule, index) => createQuantityDiscountDraft(rule, index))
    .sort((left, right) => left.position - right.position || left.minQuantity - right.minQuantity);
}

export function cloneQuantityDiscountDraft(rule: QuantityDiscountDraft): QuantityDiscountDraft {
  return {
    ...rule,
    variantTargets: [...rule.variantTargets],
    customerTargets: [...rule.customerTargets]
  };
}

export function normalizeWeightFractionValue(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) return normalized;
  const unitSpaced = normalized
    .replace(/([0-9])\s*mm\b/gi, '$1 mm')
    .replace(/\s+mm\b/gi, ' mm')
    .replace(/\bmm(?:\s+mm)+\b/gi, 'mm')
    .trim();
  return /\bmm\b/i.test(unitSpaced) ? unitSpaced : `${unitSpaced} mm`;
}

export function createWeightFractionKey(fraction: string): string {
  return normalizeWeightFractionValue(fraction).toLocaleLowerCase('sl-SI');
}

function createWeightColorKey(color: string): string {
  return normalizeSingleWeightColorValue(color).toLocaleLowerCase('sl-SI');
}

export function createWeightInventoryKey(fraction: string, color = '—'): string {
  return `${createWeightFractionKey(fraction)}|${createWeightColorKey(color)}`;
}

function getWeightFractionSortParts(fraction: string): { start: number; end: number; label: string } {
  const label = normalizeWeightFractionValue(fraction)
    .replace(/[–—]/g, '-')
    .replace(/\s*mm$/i, '')
    .trim();
  const numbers = label.match(/\d+(?:[,.]\d+)?/g) ?? [];
  const start = numbers[0] ? Number.parseFloat(numbers[0].replace(',', '.')) : Number.POSITIVE_INFINITY;
  const end = numbers[1] ? Number.parseFloat(numbers[1].replace(',', '.')) : start;
  return { start, end, label };
}

export function compareWeightFractions(left: string, right: string): number {
  const leftParts = getWeightFractionSortParts(left);
  const rightParts = getWeightFractionSortParts(right);
  if (leftParts.start !== rightParts.start) return leftParts.start - rightParts.start;
  if (leftParts.end !== rightParts.end) return leftParts.end - rightParts.end;
  return leftParts.label.localeCompare(rightParts.label, 'sl-SI', { numeric: true });
}

export function createWeightFractionInventoryId(fraction: string, color = '—'): string {
  const fractionPart = weightSkuPart(normalizeWeightFractionValue(fraction)).toLocaleLowerCase('sl-SI') || 'item';
  const colorPart = weightSkuPart(normalizeSingleWeightColorValue(color)).toLocaleLowerCase('sl-SI');
  return colorPart && colorPart !== '-' ? `fraction-${fractionPart}-${colorPart}` : `fraction-${fractionPart}`;
}

export function getWeightAvailableStockKg(entry: Pick<WeightFractionInventoryRow, 'stockKg' | 'reservedKg'>): number {
  return Math.max(0, Number((entry.stockKg - entry.reservedKg).toFixed(4)));
}

export function normalizeSingleWeightColorValue(value: string): string {
  return value.trim() || '—';
}

export function getWeightInventoryLabel(entry: Pick<WeightFractionInventoryRow, 'fraction' | 'color'>): string {
  const color = normalizeSingleWeightColorValue(entry.color);
  const rawFraction = entry.fraction.trim();
  const fraction = rawFraction && rawFraction !== '—' ? normalizeWeightFractionValue(rawFraction) : '';
  return [color === '—' ? '' : color, fraction].filter(Boolean).join(' | ') || '—';
}

export function normalizeWeightChip(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('kg:')) return `kg:${trimmed.slice(3).replace(/p/i, ',').trim()}`;
  if (trimmed.startsWith('fr:') || trimmed.startsWith('kos:')) return '';
  const mass = parseDecimalInput(trimmed.replace(/kg/i, '').trim());
  return mass !== null ? `kg:${formatDecimalForDisplay(mass)}` : '';
}

export function normalizeWeightChipList(values: string[]): string[] {
  const normalized: string[] = [];
  values.forEach((value) => {
    const chip = normalizeWeightChip(value);
    if (chip && !normalized.includes(chip)) normalized.push(chip);
  });
  return normalized.length > 0 ? normalized : defaultWeightProductData.packagingChips;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function getDiscountedPrice(basePrice: number, discountPercent: number): number {
  return Number((Math.max(0, basePrice) * (1 - clampPercent(discountPercent) / 100)).toFixed(2));
}

export function parsePackagingMass(label: string): number | null {
  const normalized = label.startsWith('kg:') ? label.slice(3) : label;
  return parseDecimalInput(normalized.replace(/kg/i, '').replace(/p/i, '.').trim());
}

export function getWeightVariantTotalMass(variant: Pick<WeightVariant, 'netMassKg'>): number | null {
  return variant.netMassKg === null ? null : Number(variant.netMassKg.toFixed(4));
}

export function getWeightVariantUnitPrice(variant: WeightVariant): number {
  if (typeof variant.unitPrice === 'number' && Number.isFinite(variant.unitPrice)) return Math.max(0, variant.unitPrice);
  return 0;
}

function getWeightVariantMinimumOrderKg(variant: Pick<WeightVariant, 'minQuantity' | 'netMassKg'>, fallbackMinQuantity: number): number {
  const packageCount = Math.max(1, variant.minQuantity || fallbackMinQuantity || 1);
  if (variant.netMassKg !== null && Number.isFinite(variant.netMassKg) && variant.netMassKg > 0) {
    return Number((packageCount * variant.netMassKg).toFixed(4));
  }
  return packageCount;
}

function getWeightVariantMassLabel(variant: Pick<WeightVariant, 'netMassKg'>): string {
  return variant.netMassKg === null
    ? 'Brez pakiranja'
    : `${formatDecimalForDisplay(variant.netMassKg)} kg`;
}

function getWeightVariantColorLabel(variant: Pick<WeightVariant, 'color'>): string {
  return normalizeSingleWeightColorValue(variant.color);
}

function getWeightVariantFractionLabel(variant: Pick<WeightVariant, 'fraction'>): string {
  const rawFraction = variant.fraction.trim();
  return rawFraction && rawFraction !== '—' ? normalizeWeightFractionValue(rawFraction) : '';
}

function getWeightVariantQualityLabel(variant: Pick<WeightVariant, 'fraction' | 'color' | 'netMassKg'>): string {
  const color = getWeightVariantColorLabel(variant);
  const fraction = getWeightVariantFractionLabel(variant);
  return [
    getWeightVariantMassLabel(variant),
    color === '—' ? '' : color,
    fraction
  ].filter(Boolean).join(' | ');
}

export function getWeightVariantFractionColorLabel(variant: Pick<WeightVariant, 'fraction' | 'color'>): string {
  const color = getWeightVariantColorLabel(variant);
  const fraction = getWeightVariantFractionLabel(variant);
  return [color === '—' ? '' : color, fraction].filter(Boolean).join(' | ') || '—';
}

export function getWeightVariantSimulatorLabel(variant: Pick<WeightVariant, 'fraction' | 'color' | 'netMassKg' | 'label'>): string {
  return variant.label?.trim() || getWeightVariantQualityLabel(variant);
}

export function getWeightVariantDisplayLabel(variant: Pick<WeightVariant, 'fraction' | 'color' | 'netMassKg' | 'label'>): string {
  return variant.label?.trim() || getWeightVariantQualityLabel(variant);
}

export function formatWeightKg(value: number): string {
  return `${formatDecimalForDisplay(Math.max(0, value))} kg`;
}

export function createWeightVariantFromCombination(options: {
  netMassKg: number | null;
  fraction: string;
  color: string;
  index: number;
  data: WeightProductData;
  baseSku?: string;
}): WeightVariant {
  const { netMassKg, fraction, color, index, data, baseSku } = options;
  const normalizedColor = normalizeSingleWeightColorValue(color);
  const sku = [
    baseSku || 'SKU',
    weightSkuPart(fraction),
    netMassKg === null ? 'BULK' : `${formatDecimalForSku(netMassKg)}KG`,
    weightSkuPart(normalizedColor)
  ].filter(Boolean).join('-');

  return {
    id: [
      'weight-variant',
      weightSkuPart(fraction) || 'fraction',
      netMassKg ?? 'bulk',
      weightSkuPart(normalizedColor) || 'color',
      index
    ].join('-'),
    sku,
    fraction,
    color: normalizedColor,
    netMassKg,
    lengthMm: null,
    widthMm: null,
    thicknessMm: null,
    minQuantity: Math.max(1, Math.floor(data.minQuantity || 1)),
    unitPrice: 0,
    costNet: null,
    discountPct: 0,
    stockKg: data.stockKg,
    tolerance: '',
    deliveryTime: data.deliveryTime,
    active: true,
    noteTag: 'na-zalogi',
    position: index + 1
  };
}

export function createWeightVariantsFromChips(data: WeightProductData, baseSku?: string, fallbackColor = ''): WeightVariant[] {
  const fractions = [...data.fractionChips].sort(compareWeightFractions);
  const masses = data.packagingChips.map(parsePackagingMass).filter((value): value is number => value !== null);
  const colors = data.colorChips.length > 0
    ? data.colorChips.map(normalizeSingleWeightColorValue)
    : [normalizeSingleWeightColorValue(fallbackColor || '—')];
  if (fractions.length === 0 || masses.length === 0) return [];
  const variants: WeightVariant[] = [];

  fractions.forEach((fraction) => {
    colors.forEach((color) => {
      masses.forEach((mass) => {
        variants.push(createWeightVariantFromCombination({
          netMassKg: mass,
          fraction: normalizeWeightFractionValue(fraction),
          color,
          index: variants.length,
          data,
          baseSku
        }));
      });
    });
  });

  return variants;
}

function normalizeWeightVariantSkuKey(value: unknown): string {
  return asString(value).trim().toLocaleLowerCase('sl-SI');
}

function findMatchingCatalogVariant(
  record: Record<string, unknown>,
  index: number,
  catalogVariants: readonly Variant[]
): Variant | undefined {
  const recordId = asString(record.id).trim();
  const idMatch = recordId
    ? catalogVariants.find((variant) => variant.id === recordId)
    : undefined;
  if (idMatch) return idMatch;

  const skuKey = normalizeWeightVariantSkuKey(record.sku);
  const skuMatch = skuKey
    ? catalogVariants.find((variant) => normalizeWeightVariantSkuKey(variant.sku) === skuKey)
    : undefined;
  if (skuMatch) return skuMatch;
  return recordId || skuKey ? undefined : catalogVariants[index];
}

function normalizeOptionalNonNegativeNumber(value: unknown, fallback: number | null): number | null {
  if (value === undefined) return fallback;
  if (value === null) return null;
  const parsed = asNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function getWeightVariantRetainedFields(source: unknown): Pick<WeightVariant, 'optionValueIds' | 'optionSelections' | 'contentOverride' | 'imageOverride' | 'imageAssignments' | 'deliveryEstimate'> {
  const record = asRecord(source);
  return {
    optionValueIds: Array.isArray(record.optionValueIds) ? record.optionValueIds.filter((value): value is number => typeof value === 'number') : [],
    optionSelections: Object.fromEntries(Object.entries(asRecord(record.optionSelections)).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
    contentOverride: record.contentOverride && typeof record.contentOverride === 'object' ? JSON.parse(JSON.stringify(record.contentOverride)) : null,
    imageOverride: typeof record.imageOverride === 'string' ? record.imageOverride : null,
    imageAssignments: Array.isArray(record.imageAssignments) ? record.imageAssignments.filter((value): value is number => typeof value === 'number') : [],
    deliveryEstimate: typeof record.deliveryEstimate === 'string' ? record.deliveryEstimate : null
  };
}

function normalizeWeightVariant(
  value: unknown,
  index: number,
  data: WeightProductData,
  baseSku?: string,
  catalogVariants: readonly Variant[] = []
): WeightVariant {
  const record = asRecord(value);
  const fallback = createWeightVariantsFromChips(data, baseSku)[index] ?? createWeightVariantFromCombination({
    netMassKg: data.netMassKg,
    fraction: data.fraction,
    color: '—',
    index,
    data,
    baseSku
  });
  const matchingCatalogVariant = findMatchingCatalogVariant(record, index, catalogVariants);
  const fraction = normalizeWeightFractionValue(asString(record.fraction, fallback.fraction));
  const netMassKgRaw = record.netMassKg === null ? null : asNumber(record.netMassKg, fallback.netMassKg ?? data.netMassKg);
  const netMassKg = netMassKgRaw === null ? null : Math.max(0, netMassKgRaw);
  return {
    ...getWeightVariantRetainedFields({ ...record, ...matchingCatalogVariant }),
    label: matchingCatalogVariant?.label ?? asString(record.label),
    physicalWeightKg: record.physicalWeightKg === undefined ? undefined : normalizeOptionalNonNegativeNumber(record.physicalWeightKg, null),
    stockManagedPerVariant: asBoolean(record.stockManagedPerVariant, data.pricingBasis === 'kg'),
    id: matchingCatalogVariant?.id ?? asString(record.id, fallback.id),
    stockRevision: matchingCatalogVariant?.stockRevision ?? (typeof record.stockRevision === 'string' ? record.stockRevision : undefined),
    pricingRevision: matchingCatalogVariant?.pricingRevision ?? (typeof record.pricingRevision === 'string' ? record.pricingRevision : undefined),
    sku: asString(record.sku, fallback.sku),
    fraction,
    color: normalizeSingleWeightColorValue(asString(record.color, fallback.color)),
    netMassKg,
    lengthMm: normalizeOptionalNonNegativeNumber(
      record.lengthMm ?? record.length,
      matchingCatalogVariant?.length ?? fallback.lengthMm
    ),
    widthMm: normalizeOptionalNonNegativeNumber(
      record.widthMm ?? record.width,
      matchingCatalogVariant?.width ?? fallback.widthMm
    ),
    thicknessMm: normalizeOptionalNonNegativeNumber(
      record.thicknessMm ?? record.thickness,
      matchingCatalogVariant?.thickness ?? fallback.thicknessMm
    ),
    minQuantity: Math.max(0, asNumber(record.minQuantity, fallback.minQuantity)),
    unitPrice: record.unitPrice === null ? null : Math.max(0, asNumber(record.unitPrice ?? record.price, getWeightVariantUnitPrice(fallback))),
    costNet: normalizeOptionalNonNegativeNumber(
      record.costNet,
      matchingCatalogVariant?.costNet ?? fallback.costNet
    ),
    discountPct: clampPercent(
      asNumber(record.discountPct, matchingCatalogVariant?.discountPct ?? fallback.discountPct)
    ),
    stockKg: Math.max(0, asNumber(record.stockKg, fallback.stockKg)),
    tolerance: asString(record.tolerance ?? record.errorTolerance, fallback.tolerance),
    deliveryTime: asString(record.deliveryTime, fallback.deliveryTime),
    active: asBoolean(record.active, true),
    noteTag: asString(record.noteTag, fallback.noteTag),
    position: Math.max(1, Math.floor(asNumber(record.position, index + 1)))
  };
}

function normalizeWeightFractionInventoryList(
  value: unknown,
  data: Omit<WeightProductData, 'fractionInventory'>,
  variants: readonly WeightVariant[]
): WeightFractionInventoryRow[] {
  const rawEntries = Array.isArray(value) ? value.map(asRecord) : [];
  const rawByInventoryKey = new Map<string, Record<string, unknown>>();
  const rawByFraction = new Map<string, Record<string, unknown>>();
  for (const entry of rawEntries) {
    const fraction = normalizeWeightFractionValue(asString(entry.fraction, ''));
    if (!fraction) continue;
    const color = normalizeSingleWeightColorValue(asString(entry.color, '—'));
    rawByInventoryKey.set(createWeightInventoryKey(fraction, color), entry);
    if (!rawByFraction.has(createWeightFractionKey(fraction)) || color === '—') {
      rawByFraction.set(createWeightFractionKey(fraction), entry);
    }
  }

  const inventoryGroups: Array<{ fraction: string; color: string }> = [];
  const addInventoryGroup = (fraction: string, color = '—') => {
    const normalized = normalizeWeightFractionValue(fraction);
    if (!normalized) return;
    const normalizedColor = normalizeSingleWeightColorValue(color);
    const key = createWeightInventoryKey(normalized, normalizedColor);
    if (!inventoryGroups.some((entry) => createWeightInventoryKey(entry.fraction, entry.color) === key)) {
      inventoryGroups.push({ fraction: normalized, color: normalizedColor });
    }
  };

  rawEntries.forEach((entry) => {
    const fraction = normalizeWeightFractionValue(asString(entry.fraction, ''));
    if (fraction) addInventoryGroup(fraction, asString(entry.color, '—'));
  });
  const colors = data.colorChips.length > 0
    ? data.colorChips.map(normalizeSingleWeightColorValue)
    : ['—'];
  data.fractionChips.forEach((fraction) => colors.forEach((color) => addInventoryGroup(fraction, color)));
  variants.forEach((variant) => addInventoryGroup(variant.fraction, variant.color));
  addInventoryGroup(data.fraction, colors[0] ?? '—');

  const visibleInventoryGroups = inventoryGroups.filter((group) =>
    group.color !== '—' ||
    !inventoryGroups.some((entry) => createWeightFractionKey(entry.fraction) === createWeightFractionKey(group.fraction) && entry.color !== '—')
  );

  return visibleInventoryGroups.sort((left, right) =>
    compareWeightFractions(left.fraction, right.fraction) ||
    left.color.localeCompare(right.color, 'sl-SI', { numeric: true, sensitivity: 'base' })
  ).map(({ fraction, color }) => {
    const inventoryKey = createWeightInventoryKey(fraction, color);
    const key = createWeightFractionKey(fraction);
    const exactRaw = rawByInventoryKey.get(inventoryKey);
    const raw = exactRaw ?? rawByFraction.get(key);
    const matchingVariant =
      variants.find((variant) => createWeightInventoryKey(variant.fraction, variant.color) === inventoryKey) ??
      variants.find((variant) => createWeightFractionKey(variant.fraction) === key);
    const stockKg = Math.max(0, asNumber(raw?.stockKg ?? raw?.stock ?? raw?.availableKg, matchingVariant?.stockKg ?? data.stockKg));
    const reservedKg = Math.max(0, asNumber(raw?.reservedKg ?? raw?.reserved, 0));
    return {
      id: asString(exactRaw?.id, createWeightFractionInventoryId(fraction, color)),
      fraction,
      color,
      stockKg,
      reservedKg: Math.min(reservedKg, stockKg),
      deliveryTime: asString(raw?.deliveryTime, matchingVariant?.deliveryTime ?? data.deliveryTime)
    };
  });
}

export function syncWeightVariantsWithFractionInventory(
  variants: readonly WeightVariant[],
  fractionInventory: readonly WeightFractionInventoryRow[]
): WeightVariant[] {
  const inventoryByKey = new Map(fractionInventory.map((entry) => [createWeightInventoryKey(entry.fraction, entry.color), entry]));
  const inventoryByFraction = new Map<string, WeightFractionInventoryRow>();
  fractionInventory.forEach((entry) => {
    const fractionKey = createWeightFractionKey(entry.fraction);
    if (!inventoryByFraction.has(fractionKey) || normalizeSingleWeightColorValue(entry.color) === '—') {
      inventoryByFraction.set(fractionKey, entry);
    }
  });
  return variants.map((variant) => {
    const inventory =
      inventoryByKey.get(createWeightInventoryKey(variant.fraction, variant.color)) ??
      inventoryByFraction.get(createWeightFractionKey(variant.fraction));
    if (!inventory) return variant;
    return {
      ...variant,
      stockKg: getWeightAvailableStockKg(inventory),
      deliveryTime: inventory.deliveryTime
    };
  });
}

export function normalizeSimpleProductData(value: unknown, context: ProductDataNormalizationContext = {}): SimpleProductData {
  const record = asRecord(value);
  const firstVariant = context.variants?.[0];
  const basePrice = asNumber(record.basePrice, firstVariant?.price ?? defaultSimpleProductData.basePrice);
  const fallbackDiscountPercent = clampPercent(asNumber(record.discountPercent, firstVariant?.discountPct ?? 0));
  const actionPrice = asNumber(record.actionPrice, getDiscountedPrice(basePrice, fallbackDiscountPercent));
  const actionPriceEnabled = asBoolean(
    record.actionPriceEnabled,
    fallbackDiscountPercent > 0 || actionPrice < basePrice
  );
  return {
    basePrice,
    actionPrice,
    actionPriceEnabled,
    weightGrams: normalizeOptionalNonNegativeNumber(
      record.weightGrams,
      firstVariant?.weight == null ? null : firstVariant.weight * 1000
    ),
    lengthMm: normalizeOptionalNonNegativeNumber(
      record.lengthMm ?? record.length,
      firstVariant?.length ?? null
    ),
    widthMm: normalizeOptionalNonNegativeNumber(
      record.widthMm ?? record.width,
      firstVariant?.width ?? null
    ),
    thicknessMm: normalizeOptionalNonNegativeNumber(
      record.thicknessMm ?? record.thickness,
      firstVariant?.thickness ?? null
    ),
    stock: Math.max(0, Math.floor(asNumber(record.stock, firstVariant?.stock ?? defaultSimpleProductData.stock))),
    minStock: Math.max(0, Math.floor(asNumber(record.minStock, defaultSimpleProductData.minStock))),
    deliveryTime: asString(record.deliveryTime, defaultSimpleProductData.deliveryTime),
    moq: Math.max(1, Math.floor(asNumber(record.moq, firstVariant?.minOrder ?? defaultSimpleProductData.moq))),
    warehouseLocation: asString(record.warehouseLocation, defaultSimpleProductData.warehouseLocation),
    saleStatus: asString(record.saleStatus, firstVariant?.active === false ? 'inactive' : 'active') === 'inactive' ? 'inactive' : 'active',
    visibleInStore: asBoolean(record.visibleInStore, true),
    showAsNew: asBoolean(record.showAsNew, false),
    requireInstructions: asBoolean(record.requireInstructions, false),
    basicInfoRows: normalizeSpecRows(record.basicInfoRows ?? record.basicInfo, defaultSimpleProductData.basicInfoRows, 'simple-basic-info'),
    technicalSpecs: normalizeSpecRows(record.technicalSpecs ?? record.specs, defaultSimpleProductData.technicalSpecs, 'simple-spec')
  };
}

/** Seed the weight tools from real sellable rows without generating sample products. */
export function createWeightProductDataFromVariants(previousData: unknown, variants: readonly Variant[], baseSku: string): WeightProductData {
  const previous = asRecord(previousData);
  const previousVariants = Array.isArray(previous.variants) ? previous.variants.map(asRecord) : [];
  const rows = variants.map((variant, index) => {
    // Only reuse explicitly matching weight metadata, never a sample row at the same index.
    const stored = previousVariants.find((row) => asString(row.id) === variant.id)
      ?? previousVariants.find((row) => asString(row.sku).trim() === variant.sku.trim() && variant.sku.trim())
      ?? {};
    return {
      ...getWeightVariantRetainedFields(variant),
      id: variant.id,
      label: variant.label,
      sku: variant.sku,
      stockRevision: variant.stockRevision,
      pricingRevision: variant.pricingRevision,
      stockManagedPerVariant: true,
      physicalWeightKg: variant.weight ?? null,
      fraction: asString(stored.fraction),
      color: asString(stored.color, '—'),
      netMassKg: stored.netMassKg === undefined ? null : normalizeOptionalNonNegativeNumber(stored.netMassKg, null),
      lengthMm: variant.length,
      widthMm: variant.width,
      thicknessMm: variant.thickness,
      minQuantity: variant.minOrder ?? 1,
      unitPrice: variant.price,
      costNet: variant.costNet ?? null,
      discountPct: variant.discountPct,
      stockKg: variant.stock,
      tolerance: variant.errorTolerance ?? '',
      deliveryTime: variant.contentOverride?.deliveryEstimate ?? variant.deliveryEstimate ?? asString(stored.deliveryTime),
      active: variant.active,
      noteTag: variant.badge ?? '',
      position: variant.sort || index + 1
    };
  });
  const fractions = [...new Set(rows.map((row) => row.fraction).filter(Boolean))];
  const colors = [...new Set(rows.map((row) => row.color).filter((value) => value !== '—'))];
  const masses = [...new Set(rows.map((row) => row.netMassKg).filter((value): value is number => value !== null))];
  return normalizeWeightProductData({
    ...previous,
    pricingBasis: previous.pricingBasis === 'package' ? 'package' : 'kg',
    minQuantity: rows[0]?.minQuantity ?? 1,
    fraction: fractions[0] ?? '',
    netMassKg: masses[0] ?? 0,
    stockKg: rows[0]?.stockKg ?? 0,
    deliveryTime: rows[0]?.deliveryTime ?? '',
    packagingChips: masses.map((mass) => 'kg:' + formatDecimalForDisplay(mass)),
    fractionChips: fractions,
    colorChips: colors,
    fractionInventory: [],
    variants: rows
  }, { baseSku, variants: [...variants] });
}

export function normalizeWeightProductData(value: unknown, context: ProductDataNormalizationContext = {}): WeightProductData {
  const record = asRecord(value);
  if ((!Array.isArray(record.variants) || record.variants.length === 0) && context.variants?.length) {
    return createWeightProductDataFromVariants(value, context.variants, context.baseSku ?? '');
  }
  const baseData: WeightProductData = {
    ...defaultWeightProductData,
    pricingBasis: record.pricingBasis === 'kg' ? 'kg' : record.pricingBasis === 'package' || Array.isArray(record.variants) ? 'package' : 'kg',
    minQuantity: Math.max(0, asNumber(record.minQuantity, context.variants?.[0]?.minOrder ?? defaultWeightProductData.minQuantity)),
    fraction: normalizeWeightFractionValue(asString(record.fraction, defaultWeightProductData.fraction)),
    netMassKg: Math.max(0, asNumber(record.netMassKg, context.variants?.[0]?.weight ?? defaultWeightProductData.netMassKg)),
    stockKg: Math.max(0, asNumber(record.stockKg, context.variants?.[0]?.stock ?? defaultWeightProductData.stockKg)),
    deliveryTime: asString(record.deliveryTime, defaultWeightProductData.deliveryTime),
    packagingChips: Array.isArray(record.packagingChips) && record.packagingChips.length === 0 ? [] : normalizeWeightChipList(asStringArray(record.packagingChips, defaultWeightProductData.packagingChips)),
    fractionChips: asStringArray(record.fractionChips, defaultWeightProductData.fractionChips).map(normalizeWeightFractionValue),
    colorChips: asStringArray(record.colorChips, defaultWeightProductData.colorChips).map(normalizeSingleWeightColorValue),
    fractionInventory: [],
    variants: []
  };
  const sourceVariants = Array.isArray(record.variants)
    ? record.variants
    : createWeightVariantsFromChips(baseData, context.baseSku);
  const variants = sourceVariants.map((entry, index) =>
    normalizeWeightVariant(entry, index, baseData, context.baseSku, context.variants)
  );
  const fractionInventory = normalizeWeightFractionInventoryList(record.fractionInventory, baseData, variants);
  const legacySyncedVariants = syncWeightVariantsWithFractionInventory(variants, fractionInventory);
  // Registered SKU stock is canonical; explicit group edits already synchronize
  // their chosen values before normalization. Do not reapply stale group JSON.
  const syncedVariants = variants.map((variant, index) => variant.stockRevision !== undefined || variant.stockManagedPerVariant ? variant : legacySyncedVariants[index]);
  return {
    ...baseData,
    stockKg: fractionInventory[0]?.stockKg ?? baseData.stockKg,
    deliveryTime: fractionInventory[0]?.deliveryTime ?? baseData.deliveryTime,
    fractionInventory,
    variants: syncedVariants
  };
}

function normalizeMachineSerialStatus(value: unknown): UniqueMachineProductData['serialNumbers'][number]['status'] {
  const normalized = String(value ?? '').trim();
  return normalized === 'sold' || normalized === 'reserved' || normalized === 'service' ? normalized : 'in_stock';
}

function normalizeMachineSerialRows(value: unknown): UniqueMachineProductData['serialNumbers'] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => {
      const row = asRecord(entry);
      const serialNumber = asString(row.serialNumber ?? row.serial, '');
      const orderReference = asString(row.orderReference ?? row.order, '');
      const shippedAt = asString(row.shippedAt ?? row.shipped, '');
      const hasExplicitId = typeof row.id === 'string' && row.id.trim().length > 0;
      const hasExplicitStatus = row.status !== undefined && row.status !== null && String(row.status).trim().length > 0;
      if (!hasExplicitId && !hasExplicitStatus && !serialNumber.trim() && !orderReference.trim() && !shippedAt.trim()) {
        return null;
      }
      return {
        id: asString(row.id, `serial-${index}`),
        serialNumber,
        status: normalizeMachineSerialStatus(row.status),
        orderReference,
        shippedAt
      };
    })
    .filter((entry): entry is UniqueMachineProductData['serialNumbers'][number] => entry !== null);
}

export function normalizeUniqueMachineProductData(value: unknown, context: ProductDataNormalizationContext = {}): UniqueMachineProductData {
  const record = asRecord(value);
  const firstVariant = context.variants?.[0];
  const legacyPackageDimensions = parseExplicitPackageDimensionsMm(asString(record.packageDimensions));
  const packageLengthMm = normalizeOptionalNonNegativeNumber(
    record.packageLengthMm === null && legacyPackageDimensions
      ? legacyPackageDimensions.shippingLengthMm
      : record.packageLengthMm !== undefined ? record.packageLengthMm : record.lengthMm,
    legacyPackageDimensions?.shippingLengthMm ?? firstVariant?.length ?? defaultMachineProductData.packageLengthMm
  );
  const packageWidthMm = normalizeOptionalNonNegativeNumber(
    record.packageWidthMm === null && legacyPackageDimensions
      ? legacyPackageDimensions.shippingWidthMm
      : record.packageWidthMm !== undefined ? record.packageWidthMm : record.widthMm,
    legacyPackageDimensions?.shippingWidthMm ?? firstVariant?.width ?? defaultMachineProductData.packageWidthMm
  );
  const packageThicknessMm = normalizeOptionalNonNegativeNumber(
    record.packageThicknessMm === null && legacyPackageDimensions
      ? legacyPackageDimensions.shippingHeightMm
      : record.packageThicknessMm !== undefined ? record.packageThicknessMm : record.thicknessMm,
    legacyPackageDimensions?.shippingHeightMm ?? firstVariant?.thickness ?? defaultMachineProductData.packageThicknessMm
  );
  const packageDimensions = packageLengthMm !== null && packageWidthMm !== null && packageThicknessMm !== null
    ? `${formatDecimalForDisplay(packageLengthMm)} x ${formatDecimalForDisplay(packageWidthMm)} x ${formatDecimalForDisplay(packageThicknessMm)} mm`
    : '';
  return {
    ...defaultMachineProductData,
    basePrice: asNumber(record.basePrice, firstVariant?.price ?? defaultMachineProductData.basePrice),
    discountPercent: Math.max(0, Math.min(100, asNumber(record.discountPercent, firstVariant?.discountPct ?? defaultMachineProductData.discountPercent))),
    stock: Math.max(0, Math.floor(asNumber(record.stock, firstVariant?.stock ?? defaultMachineProductData.stock))),
    warrantyLabel: asString(record.warrantyLabel, defaultMachineProductData.warrantyLabel),
    warrantyMonths: asString(record.warrantyMonths, defaultMachineProductData.warrantyMonths),
    warrantyUnit: asString(record.warrantyUnit, defaultMachineProductData.warrantyUnit),
    serviceIntervalLabel: asString(record.serviceIntervalLabel, defaultMachineProductData.serviceIntervalLabel),
    serviceIntervalMonths: asString(record.serviceIntervalMonths, defaultMachineProductData.serviceIntervalMonths),
    serviceIntervalUnit: asString(record.serviceIntervalUnit, defaultMachineProductData.serviceIntervalUnit),
    deliveryTime: asString(record.deliveryTime, defaultMachineProductData.deliveryTime),
    packageWeightKg: Math.max(0, asNumber(record.packageWeightKg, firstVariant?.weight ?? defaultMachineProductData.packageWeightKg)),
    packageWeightUnit: asString(record.packageWeightUnit, defaultMachineProductData.packageWeightUnit),
    packageLengthMm,
    packageWidthMm,
    packageThicknessMm,
    packageDimensions,
    warnings: asString(record.warnings, defaultMachineProductData.warnings),
    basicInfoRows: normalizeSpecRows(record.basicInfoRows ?? record.basicInfo, defaultMachineProductData.basicInfoRows, 'machine-basic-info'),
    serialNumbers: normalizeMachineSerialRows(record.serialNumbers),
    specs: normalizeSpecRows(record.specs ?? record.technicalSpecs, defaultMachineProductData.specs, 'machine-spec'),
    includedItems: asStringArray(record.includedItems, defaultMachineProductData.includedItems)
  };
}

export function normalizeDimensionProductData(value: unknown): Record<string, unknown> {
  const record = asRecord(value);
  const rawDeliveryTimes = asRecord(record.variantDeliveryTimes ?? record.deliveryTimes);
  const variantDeliveryTimes = Object.fromEntries(
    Object.entries(rawDeliveryTimes)
      .map(([key, deliveryTime]) => [key, asString(deliveryTime)])
      .filter(([key, deliveryTime]) => key.trim().length > 0 && deliveryTime.trim().length > 0)
  );

  return {
    ...defaultDimensionProductData,
    ...record,
    defaultDeliveryTime: asString(record.defaultDeliveryTime, defaultDimensionProductData.defaultDeliveryTime),
    variantDeliveryTimes,
    variantInventory: Array.isArray(record.variantInventory) ? record.variantInventory : defaultDimensionProductData.variantInventory
  };
}

export function createInitialTypeSpecificData(value?: unknown, context: ProductDataNormalizationContext = {}): UniversalProductSpecificData {
  const record = asRecord(value);
  return {
    dimensions: normalizeDimensionProductData(record.dimensions ?? record.dimension),
    simple: normalizeSimpleProductData(record.simple, context),
    weight: normalizeWeightProductData(record.weight, context),
    uniqueMachine: normalizeUniqueMachineProductData(record.uniqueMachine ?? record.machine, context)
  };
}

export function cloneTypeSpecificData(data: UniversalProductSpecificData): UniversalProductSpecificData {
  return createInitialTypeSpecificData(JSON.parse(JSON.stringify(data)));
}

export function buildSimpleCatalogVariants(dataInput: TypeSpecificProductData, fallback: Variant | readonly Variant[] | undefined, baseSku: string, name: string): Variant[] {
  // Variant rows are authoritative, including when there is only one row.
  // The scalar form is retained for older callers of the legacy product module.
  if (Array.isArray(fallback)) {
    return fallback.length > 0
      ? fallback.map((variant) => structuredClone(variant))
      : buildSimpleCatalogVariants(dataInput, undefined, baseSku, name);
  }
  const legacyFallback = fallback as Variant | undefined;
  const data = normalizeSimpleProductData(dataInput);
  const discountPct = data.actionPriceEnabled && data.basePrice > 0
    ? Number(clampPercent(((data.basePrice - data.actionPrice) / data.basePrice) * 100).toFixed(2))
    : 0;
  return [
    createVariant({
      ...(legacyFallback ?? {}),
      id: legacyFallback?.id ?? createLocalId('simple-variant'),
      label: name || 'Osnovni artikel',
      sku: legacyFallback?.sku || baseSku,
      price: data.basePrice,
      weight: data.weightGrams === null ? null : data.weightGrams / 1000,
      length: data.lengthMm,
      width: data.widthMm,
      thickness: data.thicknessMm,
      discountPct,
      stock: data.stock,
      minOrder: data.moq,
      active: data.saleStatus === 'active',
      sort: 1
    })
  ];
}

export function buildWeightCatalogVariants(dataInput: TypeSpecificProductData, baseSku: string, fallbackVariants: readonly Variant[] = []): Variant[] {
  const data = normalizeWeightProductData(dataInput, { baseSku, variants: [...fallbackVariants] });
  return data.variants.map((variant, index) => {
    const unitPrice = getWeightVariantUnitPrice(variant);
    const fallback = findMatchingCatalogVariant(asRecord(variant), index, fallbackVariants);
    const retained = getWeightVariantRetainedFields(fallback ?? variant);
    const contentOverride = { ...(retained.contentOverride ?? {}) };
    if (variant.deliveryTime.trim()) contentOverride.deliveryEstimate = variant.deliveryTime.trim();
    else delete contentOverride.deliveryEstimate;
    return createVariant({
      ...(fallback ? structuredClone(fallback) : {}),
      ...retained,
      contentOverride: Object.keys(contentOverride).length > 0 ? contentOverride : null,
      deliveryEstimate: variant.deliveryTime.trim() || null,
      id: variant.id,
      stockRevision: variant.stockRevision,
      pricingRevision: variant.pricingRevision,
      label: getWeightVariantDisplayLabel(variant),
      unit: 'kg',
      weight: variant.physicalWeightKg !== undefined ? variant.physicalWeightKg : getWeightVariantTotalMass(variant) ?? variant.netMassKg,
      length: variant.lengthMm,
      width: variant.widthMm,
      thickness: variant.thicknessMm,
      minOrder: Math.max(1, variant.minQuantity || 1),
      errorTolerance: variant.tolerance || null,
      sku: variant.sku || `${baseSku || 'SKU'}-${index + 1}`,
      price: unitPrice,
      costNet: variant.costNet,
      discountPct: variant.discountPct,
      stock: variant.stockKg,
      active: variant.active,
      sort: variant.position || index + 1,
      badge: variant.noteTag || null
    });
  });
}

export function buildMachineCatalogVariants(dataInput: TypeSpecificProductData, fallback: Variant | readonly Variant[] | undefined, baseSku: string, name: string): Variant[] {
  if (Array.isArray(fallback)) {
    return fallback.length > 0
      ? fallback.map((variant) => structuredClone(variant))
      : buildMachineCatalogVariants(dataInput, undefined, baseSku, name);
  }
  const legacyFallback = fallback as Variant | undefined;
  const data = normalizeUniqueMachineProductData(dataInput);
  return [
    createVariant({
      ...(legacyFallback ?? {}),
      id: legacyFallback?.id ?? createLocalId('machine-variant'),
      label: name || 'Stroj / oprema',
      sku: legacyFallback?.sku || baseSku,
      price: data.basePrice,
      weight: data.packageWeightKg > 0 ? data.packageWeightKg : null,
      length: data.packageLengthMm,
      width: data.packageWidthMm,
      thickness: data.packageThicknessMm,
      discountPct: data.discountPercent,
      stock: data.stock,
      minOrder: 1,
      active: true,
      sort: 1
    })
  ];
}

export function formatPieceCount(value: number): string {
  return formatPieceQuantity(Math.max(0, Math.floor(value)));
}

function getCatalogVariantSimulatorOptions(variants: readonly Variant[], fallbackLabel: string, machine = false): PricingSimulatorOption[] {
  return variants.map((variant) => {
    const price = machine ? variant.price : getDiscountedPrice(variant.price, variant.discountPct);
    const unit = variant.unit?.trim() || 'kos';
    return {
      id: variant.id,
      label: variant.label.trim() || fallbackLabel,
      basePrice: price,
      ...(machine ? { discountPercent: variant.discountPct } : {}),
      quantityUnit: unit,
      targetKey: variant.sku.trim() || variant.id,
      summaryLabel: formatCurrency(price),
      stockLabel: formatQuantityWithUnit(variant.stock, unit),
      minOrderLabel: formatQuantityWithUnit(Math.max(1, variant.minOrder ?? 1), unit)
    };
  });
}

export function getSimpleSimulatorOptions(dataInput: TypeSpecificProductData, label = 'Osnovni artikel', sku = '', variants?: readonly Variant[]): PricingSimulatorOption[] {
  if (variants) return getCatalogVariantSimulatorOptions(variants, label);
  const data = normalizeSimpleProductData(dataInput);
  const price = data.actionPriceEnabled ? data.actionPrice : data.basePrice;
  const targetKey = sku.trim() || 'Standardni';
  return [{
    id: 'simple',
    label,
    basePrice: price,
    quantityUnit: 'kos',
    targetKey,
    summaryLabel: formatCurrency(price),
    stockLabel: formatPieceCount(data.stock),
    minOrderLabel: formatPieceCount(Math.max(1, Math.floor(Number(data.moq) || 1)))
  }];
}

export function getWeightBillableQuantity(quantityKg: number, netMassKg?: number | null, pricingBasis: 'kg' | 'package' = 'package'): number {
  const quantity = Number.isFinite(quantityKg) ? Math.max(0, quantityKg) : 0;
  if (pricingBasis === 'kg' || !netMassKg || !Number.isFinite(netMassKg) || netMassKg <= 0) return quantity;
  return Number((quantity / netMassKg).toFixed(4));
}

/** The generator adds combinations; deleting rows remains an explicit action. */
export function mergeGeneratedWeightVariants(existing: readonly WeightVariant[], generated: readonly WeightVariant[]): WeightVariant[] {
  const identity = (row: WeightVariant) => [createWeightInventoryKey(row.fraction, row.color), row.netMassKg === null ? 'bulk' : Number(row.netMassKg.toFixed(4)).toString()].join('|');
  const seenCombinations = new Set(existing.map(identity));
  const result = existing.map((row) => structuredClone(row));
  const usedIds = new Set(result.map((row) => row.id));
  const usedSkus = new Set(result.map((row) => row.sku.toLocaleLowerCase('sl-SI')));
  for (const row of generated) {
    if (seenCombinations.has(identity(row))) continue;
    seenCombinations.add(identity(row));
    let id = row.id;
    let sku = row.sku;
    let suffix = 2;
    while (usedIds.has(id) || usedSkus.has(sku.toLocaleLowerCase('sl-SI'))) {
      id = row.id + '-' + suffix;
      sku = row.sku + '-' + suffix;
      suffix += 1;
    }
    usedIds.add(id);
    usedSkus.add(sku.toLocaleLowerCase('sl-SI'));
    result.push({ ...structuredClone(row), id, sku });
  }
  return result.map((row, index) => ({ ...row, position: index + 1 }));
}

export function getWeightSimulatorOptions(dataInput: TypeSpecificProductData): PricingSimulatorOption[] {
  const data = normalizeWeightProductData(dataInput);
  return data.variants.map((variant) => {
    const packagePrice = getDiscountedPrice(
      getWeightVariantUnitPrice(variant),
      variant.discountPct
    );
    const packageLabel = getWeightVariantMassLabel(variant);
    const fractionColorLabel = getWeightVariantFractionColorLabel(variant);
    const selectionLabel = getWeightVariantSimulatorLabel(variant);
    return {
      id: variant.id,
      label: selectionLabel,
      basePrice: packagePrice,
      weightPricingBasis: data.pricingBasis,
      quantityUnit: 'kg',
      targetKey: variant.sku || variant.id,
      summaryLabel: `${formatCurrency(packagePrice)} / ${data.pricingBasis === 'kg' ? 'kg' : 'pak.'}`,
      discountUnitLabel: 'kg',
      stockLabel: formatWeightKg(variant.stockKg),
      minOrderLabel: formatWeightKg(data.pricingBasis === 'kg' ? Math.max(1, variant.minQuantity || data.minQuantity || 1) : getWeightVariantMinimumOrderKg(variant, data.minQuantity)),
      weightFraction: variant.fraction || undefined,
      weightColor: getWeightVariantColorLabel(variant),
      weightPackageLabel: packageLabel,
      weightFractionColorLabel: fractionColorLabel,
      weightSelectionLabel: selectionLabel,
      weightNetMassKg: variant.netMassKg ?? undefined
    };
  });
}

function getAvailableMachineSerialLabels(rows: readonly UniqueMachineProductData['serialNumbers'][number][]): string[] {
  return rows.filter((row) => row.status === 'in_stock').map((row) => row.serialNumber).filter(Boolean);
}

export function getMachineSimulatorOptions(dataInput: TypeSpecificProductData, label = 'Stroj / oprema', variants?: readonly Variant[]): PricingSimulatorOption[] {
  const data = normalizeUniqueMachineProductData(dataInput);
  if (variants) {
    // Serials belong to physical inventory, not a shared pool on every model.
    return getCatalogVariantSimulatorOptions(variants, label, true).map((option) => ({
      ...option,
      serialLabels: variants.length === 1 ? getAvailableMachineSerialLabels(data.serialNumbers) : undefined
    }));
  }
  return [{
    id: 'machine',
    label,
    basePrice: data.basePrice,
    discountPercent: data.discountPercent,
    quantityUnit: 'kos',
    summaryLabel: formatCurrency(data.basePrice),
    stockLabel: formatPieceCount(data.stock),
    minOrderLabel: formatPieceCount(1),
    serialLabels: getAvailableMachineSerialLabels(data.serialNumbers)
  }];
}
