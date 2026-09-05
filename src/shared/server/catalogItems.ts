import { getPool } from '@/shared/server/db';
import { revalidateTag } from '@/shared/server/diagnostics/cache';
import { CATALOG_PUBLIC_TAG } from '@/shared/server/catalogCache';
import type { PoolClient } from 'pg';
import type { CatalogItemType } from '@/shared/domain/catalog/itemType';
import type {
  AdminCatalogListItem,
  AdminCatalogVariantSummary,
  ArchivedCatalogItemSummary,
  CatalogEditorProductType,
  CatalogItemEditorHydration,
  CatalogItemEditorPayload,
  CatalogItemIdentityAvailability,
  CatalogItemIdentityConflict,
  CatalogItemIdentityField,
  CatalogItemQuickPatch,
  CatalogItemQuantityDiscountRule,
  CatalogItemTypeSpecificData,
  CatalogVariantContentOverride,
  CatalogVariantQuickPatch
} from '@/shared/domain/catalog/catalogAdminTypes';
import { fetchOrderItemAllocationsForSkus } from '@/shared/server/orders';
import { validateAndNormalizeCatalogAppearanceOverride } from '@/shared/domain/catalog/catalogSpecification';
import {
  CATALOG_SHIPPING_FIELD_LABELS,
  CATALOG_SHIPPING_FIELDS,
  catalogShippingMeasurementRequirement,
  deriveCatalogVariantShippingMeasurements,
  getCatalogShippingReadiness,
  isValidCatalogShippingMeasurement,
  type CatalogShippingField,
  type CatalogShippingMeasurements
} from '@/shared/domain/catalog/catalogShipping';

export type CatalogItemSeedRow = {
  id: number;
  item_name: string;
  description: string;
  category_path: string;
  category_id: string | null;
  parent_category_id: string | null;
  variant_id: number;
  variant_name: string;
  variant_count: number;
  length: number | null;
  width: number | null;
  thickness: number | null;
  weight: number | null;
  price: number;
  sku: string;
  unit: string;
  images: string[];
  discount_pct: number;
  item_position: number;
};

export class CatalogItemIdentityConflictError extends Error {
  readonly conflicts: CatalogItemIdentityConflict[];
  readonly statusCode = 409;

  constructor(conflicts: CatalogItemIdentityConflict[]) {
    const firstConflict = conflicts[0];
    const suggestionText = firstConflict && firstConflict.suggestions.length > 0
      ? ` Predlogi: ${firstConflict.suggestions.join(', ')}.`
      : '';
    super(firstConflict ? `${firstConflict.message}${suggestionText}` : 'Podatki artikla niso enolični.');
    this.name = 'CatalogItemIdentityConflictError';
    this.conflicts = conflicts;
  }
}

export class CatalogItemValidationError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'CatalogItemValidationError';
  }
}

export class CatalogItemConcurrencyConflictError extends Error {
  readonly statusCode = 409;
  readonly itemId: number;
  readonly currentUpdatedAt: string;

  constructor(itemId: number, currentUpdatedAt: string) {
    super('Artikel je bil medtem spremenjen drugje. Osvežite podatke in ponovno uporabite spremembe.');
    this.name = 'CatalogItemConcurrencyConflictError';
    this.itemId = itemId;
    this.currentUpdatedAt = currentUpdatedAt;
  }
}

function asIsoTimestamp(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function assertCatalogItemPublicationReady(
  categoryId: string | null,
  itemShippingDefaults: CatalogShippingMeasurements,
  variants: Array<{
    variantName?: unknown;
    variantSku?: unknown;
    price?: unknown;
    status?: unknown;
  } & CatalogShippingMeasurements>
) {
  if (!categoryId) {
    throw new CatalogItemValidationError(
      'Za objavo izberite eno veljavno kategorijo ali podkategorijo.'
    );
  }
  const activeVariants = variants.filter((variant) => (variant.status ?? 'active') === 'active');
  if (activeVariants.length === 0) {
    throw new CatalogItemValidationError('Za objavo potrebujete najmanj eno aktivno različico.');
  }
  const invalidActiveVariant = activeVariants.find((variant) =>
    !asStringOrNull(variant.variantSku)
    || typeof variant.price !== 'number'
    || !Number.isFinite(variant.price)
    || variant.price < 0
  );
  if (invalidActiveVariant) {
    throw new CatalogItemValidationError(
      `Aktivna različica »${asStringOrNull(invalidActiveVariant.variantName) ?? 'brez naziva'}« potrebuje veljaven SKU in nenegativno prodajno ceno brez DDV.`
    );
  }
  const shippingIssue = activeVariants
    .map((variant) => ({
      variant,
      readiness: getCatalogShippingReadiness(itemShippingDefaults, variant)
    }))
    .find((entry) => !entry.readiness.isReady);
  if (shippingIssue) {
    const issueFields = Array.from(new Set([
      ...shippingIssue.readiness.missingFields,
      ...shippingIssue.readiness.invalidFields
    ]));
    const sku = asStringOrNull(shippingIssue.variant.variantSku);
    throw new CatalogItemValidationError(
      `Aktivna različica »${asStringOrNull(shippingIssue.variant.variantName) ?? 'brez naziva'}«${sku ? ` (SKU ${sku})` : ''} potrebuje popolne pozitivne podatke za poštnino: ${issueFields.map((field) => CATALOG_SHIPPING_FIELD_LABELS[field]).join(', ')}.`
    );
  }
}

async function ensureCatalogDefaultVariantIsUsable(client: PoolClient, itemId: number) {
  await client.query(
    `
    update catalog_items ci
    set default_variant_id = coalesce(
      (
        select current_default.id
        from catalog_item_variants current_default
        where current_default.id = ci.default_variant_id
          and current_default.item_id = ci.id
          and current_default.status = 'active'
      ),
      (
        select active_variant.id
        from catalog_item_variants active_variant
        where active_variant.item_id = ci.id
          and active_variant.status = 'active'
        order by active_variant.position asc, active_variant.id asc
        limit 1
      ),
      (
        select fallback_variant.id
        from catalog_item_variants fallback_variant
        where fallback_variant.item_id = ci.id
        order by fallback_variant.position asc, fallback_variant.id asc
        limit 1
      )
    ),
    updated_at = now()
    where ci.id = $1
    `,
    [itemId]
  );
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = asNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeActiveState(value: unknown): 'active' | 'inactive' {
  return String(value ?? 'inactive') === 'active' ? 'active' : 'inactive';
}

function normalizeCatalogItemLifecycleState(value: unknown): 'active' | 'inactive' | 'deleted' {
  const normalized = String(value ?? 'inactive');
  if (normalized === 'active' || normalized === 'deleted') return normalized;
  return 'inactive';
}

function normalizeCatalogEditorProductType(value: unknown): CatalogEditorProductType | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized === 'simple' || normalized === 'dimensions' || normalized === 'weight' || normalized === 'unique_machine') {
    return normalized;
  }
  return null;
}

function requireCatalogEditorProductType(value: unknown): CatalogEditorProductType {
  const productType = normalizeCatalogEditorProductType(value);
  if (!productType) throw new Error('Artikel nima veljavne vrste produkta.');
  return productType;
}

function normalizeTypeSpecificData(value: unknown): CatalogItemTypeSpecificData {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as CatalogItemTypeSpecificData;
  }
  return {};
}

function normalizeCanonicalShippingMeasurement(
  value: unknown,
  field: CatalogShippingField,
  contextLabel: string
): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (
    typeof value === 'number'
    && isValidCatalogShippingMeasurement(field, value)
  ) {
    return value;
  }
  throw new CatalogItemValidationError(
    `${contextLabel}: ${CATALOG_SHIPPING_FIELD_LABELS[field]} mora biti ${catalogShippingMeasurementRequirement(field)}.`
  );
}

function normalizeCanonicalShippingMeasurements(
  value: CatalogShippingMeasurements,
  contextLabel: string
): Required<CatalogShippingMeasurements> {
  return Object.fromEntries(
    CATALOG_SHIPPING_FIELDS.map((field) => [
      field,
      normalizeCanonicalShippingMeasurement(value[field], field, contextLabel)
    ])
  ) as Required<CatalogShippingMeasurements>;
}

function normalizeCatalogEditorShippingPayload(
  input: CatalogItemEditorPayload
): CatalogItemEditorPayload {
  requireCatalogEditorProductType(input.productType);
  const itemShipping = normalizeCanonicalShippingMeasurements({}, 'Artikel');
  const variants = input.variants.map((variant, index) => {
    const derivedShipping = deriveCatalogVariantShippingMeasurements(variant);
    return {
      ...variant,
      ...normalizeCanonicalShippingMeasurements(
        derivedShipping,
        `Različica »${variant.variantName || `#${index + 1}`}«`
      )
    };
  });
  return {
    ...input,
    ...itemShipping,
    variants
  };
}

type PublicCatalogSpecification = {
  id: string;
  label: string;
  value: string;
  group?: string;
};

type PublicCatalogPresentationDetails = {
  specifications: PublicCatalogSpecification[];
  includedItems: string[];
  deliveryEstimate: string | null;
};

function asPublicDisplayValue(value: unknown): string | null {
  if (typeof value === 'string') return asStringOrNull(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function normalizePublicSpecificationRows(
  value: unknown,
  group: string,
  idPrefix: string
): PublicCatalogSpecification[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const label = asStringOrNull(record.property ?? record.label ?? record.name);
    const rawValue = asPublicDisplayValue(record.value);
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

function buildPublicCatalogPresentationDetails(
  productType: CatalogEditorProductType,
  rawData: unknown
): PublicCatalogPresentationDetails {
  const data = normalizeTypeSpecificData(rawData);
  const simple = normalizeTypeSpecificData(data.simple);
  const dimensions = normalizeTypeSpecificData(data.dimensions ?? data.dimension);
  const weight = normalizeTypeSpecificData(data.weight);
  const machine = normalizeTypeSpecificData(data.uniqueMachine ?? data.machine);
  const specifications: PublicCatalogSpecification[] = [];
  let includedItems: string[] = [];
  let deliveryEstimate: string | null = null;

  if (productType === 'simple') {
    specifications.push(
      ...normalizePublicSpecificationRows(simple.basicInfoRows ?? simple.basicInfo, 'Osnovni podatki', 'simple-basic'),
      ...normalizePublicSpecificationRows(simple.technicalSpecs, 'Tehnične specifikacije', 'simple-technical')
    );
    deliveryEstimate = asStringOrNull(simple.deliveryTime);
  } else if (productType === 'dimensions') {
    deliveryEstimate = asStringOrNull(dimensions.defaultDeliveryTime);
  } else if (productType === 'weight') {
    const fraction = asStringOrNull(weight.fraction);
    const netMassKg = asPublicDisplayValue(weight.netMassKg);
    if (fraction) {
      specifications.push({ id: 'weight-fraction', label: 'Frakcija', value: fraction, group: 'Osnovni podatki' });
    }
    if (netMassKg) {
      specifications.push({ id: 'weight-net-mass', label: 'Neto masa', value: `${netMassKg} kg`, group: 'Osnovni podatki' });
    }
    deliveryEstimate = asStringOrNull(weight.deliveryTime);
  } else if (productType === 'unique_machine') {
    specifications.push(
      ...normalizePublicSpecificationRows(machine.basicInfoRows ?? machine.basicInfo, 'Osnovni podatki', 'machine-basic'),
      ...normalizePublicSpecificationRows(machine.specs ?? machine.technicalSpecs, 'Tehnične specifikacije', 'machine-technical')
    );
    const safeMachineFields: Array<[string, string, unknown, unknown?]> = [
      ['machine-warranty', asStringOrNull(machine.warrantyLabel) ?? 'Garancija', machine.warrantyMonths, machine.warrantyUnit],
      ['machine-service', asStringOrNull(machine.serviceIntervalLabel) ?? 'Servisni interval', machine.serviceIntervalMonths, machine.serviceIntervalUnit],
      ['machine-package-weight', 'Masa paketa', machine.packageWeightKg, machine.packageWeightUnit ?? 'kg'],
      ['machine-package-dimensions', 'Mere paketa', machine.packageDimensions]
    ];
    for (const [id, label, rawValue, rawUnit] of safeMachineFields) {
      const displayValue = asPublicDisplayValue(rawValue);
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

function normalizeAppearanceOverride(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function normalizeStringRecord(value: unknown): Record<string, string> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const entries = Object.entries(value)
    .map(([key, entry]) => [key.trim(), typeof entry === 'string' ? entry.trim() : ''] as const)
    .filter(([key, entry]) => key.length > 0 && entry.length > 0);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function normalizeVariantContentOverride(value: unknown): CatalogVariantContentOverride | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const description = asStringOrNull(record.description) ?? undefined;
  const specifications = normalizeStringRecord(record.specifications);
  const attributes = normalizeStringRecord(record.attributes);
  const includedItems = Array.isArray(record.includedItems)
    ? record.includedItems
        .map((entry) => asStringOrNull(entry))
        .filter((entry): entry is string => entry !== null)
    : undefined;
  const deliveryEstimate = asStringOrNull(record.deliveryEstimate) ?? undefined;
  const documentIds = Array.isArray(record.documentIds)
    ? Array.from(new Set(
        record.documentIds
          .map((entry) => asNumber(entry, -1))
          .filter((entry) => Number.isInteger(entry) && entry > 0)
      ))
    : undefined;
  const normalized: CatalogVariantContentOverride = {
    ...(description ? { description } : {}),
    ...(specifications ? { specifications } : {}),
    ...(attributes ? { attributes } : {}),
    ...(includedItems && includedItems.length > 0 ? { includedItems } : {}),
    ...(deliveryEstimate ? { deliveryEstimate } : {}),
    ...(documentIds && documentIds.length > 0 ? { documentIds } : {})
  };
  return Object.keys(normalized).length > 0 ? normalized : null;
}

const ALL_QUANTITY_DISCOUNT_TARGETS_JSON = '{"variants":["Vse"],"customers":["Vse"]}';

function normalizeQuantityDiscountRule(entry: Record<string, unknown>, fallbackPosition: number): CatalogItemQuantityDiscountRule {
  return {
    id: entry.id === null || entry.id === undefined ? undefined : asNumber(entry.id),
    minQuantity: Math.max(1, Math.floor(asNumber(entry.minQuantity, 1))),
    discountPercent: Math.min(100, Math.max(0, asNumber(entry.discountPercent))),
    appliesTo: asStringOrNull(entry.appliesTo) ?? ALL_QUANTITY_DISCOUNT_TARGETS_JSON,
    note: asStringOrNull(entry.note),
    position: asNumber(entry.position, fallbackPosition)
  };
}

function normalizeIdentityValue(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function normalizeIdentityComparisonValue(value: unknown): string {
  return normalizeIdentityValue(value).toLocaleLowerCase('sl');
}

function normalizeSlugSuggestionBase(value: string) {
  const normalized = normalizeIdentityValue(value)
    .toLocaleLowerCase('sl')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || 'artikel';
}

function normalizeSkuSuggestionBase(value: string) {
  return normalizeIdentityValue(value).toLocaleUpperCase('sl').replace(/\s+/g, '-').replace(/-+/g, '-') || 'SKU';
}

function createIdentitySuggestion(field: CatalogItemIdentityField, value: string, suffix: number) {
  if (field === 'name') return `${normalizeIdentityValue(value)} ${suffix}`;
  if (field === 'slug') return `${normalizeSlugSuggestionBase(value)}-${suffix}`;
  return `${normalizeSkuSuggestionBase(value)}-${suffix}`;
}

async function fetchReservedIdentityValues(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> },
  field: CatalogItemIdentityField,
  currentItemId: number | null,
  currentVariantId: number | null
) {
  if (field === 'name') {
    const result = await client.query(
      `
      select item_name as value
      from catalog_items
      where item_name is not null
        and ($1::bigint is null or id <> $1)
      `,
      [currentItemId]
    );
    return new Set(result.rows.map((row) => normalizeIdentityComparisonValue(row.value)));
  }

  if (field === 'slug') {
    const result = await client.query(
      `
      select slug as value
      from catalog_items
      where slug is not null
        and ($1::bigint is null or id <> $1)
      union all
      select slug as value
      from catalog_item_slug_aliases
      where $1::bigint is null or item_id <> $1
      `,
      [currentItemId]
    );
    return new Set(result.rows.map((row) => normalizeIdentityComparisonValue(row.value)));
  }

  const result = await client.query(
    `
    select sku as value
    from catalog_items
    where nullif(trim(sku), '') is not null
      and ($1::bigint is null or id <> $1)
    union all
    select variant_sku as value
    from catalog_item_variants
    where nullif(trim(variant_sku), '') is not null
      and (
        $1::bigint is null
        or item_id <> $1
        or ($2::bigint is not null and id <> $2)
      )
    `,
    [currentItemId, currentVariantId]
  );
  return new Set(result.rows.map((row) => normalizeIdentityComparisonValue(row.value)));
}

async function buildIdentitySuggestions(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> },
  field: CatalogItemIdentityField,
  value: string,
  currentItemId: number | null,
  currentVariantId: number | null,
  extraReservedValues: string[] = []
) {
  const reserved = await fetchReservedIdentityValues(client, field, currentItemId, currentVariantId);
  extraReservedValues.forEach((entry) => reserved.add(normalizeIdentityComparisonValue(entry)));

  const suggestions: string[] = [];
  for (let suffix = 2; suggestions.length < 5 && suffix <= 99; suffix += 1) {
    const suggestion = createIdentitySuggestion(field, value, suffix);
    const comparison = normalizeIdentityComparisonValue(suggestion);
    if (!comparison || reserved.has(comparison)) continue;
    reserved.add(comparison);
    suggestions.push(suggestion);
  }
  return suggestions;
}

async function findIdentityConflict(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> },
  field: CatalogItemIdentityField,
  value: string,
  currentItemId: number | null,
  currentVariantId: number | null
) {
  const normalized = normalizeIdentityValue(value);
  if (!normalized) return null;

  if (field === 'name') {
    const result = await client.query(
      `
      select item_name as label
      from catalog_items
      where lower(trim(item_name)) = lower(trim($1::text))
        and ($2::bigint is null or id <> $2)
      limit 1
      `,
      [normalized, currentItemId]
    );
    return typeof result.rows[0]?.label === 'string' ? result.rows[0].label : null;
  }

  if (field === 'slug') {
    const result = await client.query(
      `
      select label
      from (
        select item_name as label
        from catalog_items
        where lower(trim(slug)) = lower(trim($1::text))
          and ($2::bigint is null or id <> $2)
        union all
        select ci.item_name as label
        from catalog_item_slug_aliases alias
        join catalog_items ci on ci.id = alias.item_id
        where lower(trim(alias.slug)) = lower(trim($1::text))
          and ($2::bigint is null or alias.item_id <> $2)
      ) matches
      limit 1
      `,
      [normalized, currentItemId]
    );
    return typeof result.rows[0]?.label === 'string' ? result.rows[0].label : null;
  }

  const result = await client.query(
    `
    select label
    from (
      select item_name as label
      from catalog_items
      where lower(trim(sku)) = lower(trim($1::text))
        and ($2::bigint is null or id <> $2)
      union all
      select ci.item_name || coalesce(' / ' || nullif(civ.variant_name, ''), '') as label
      from catalog_item_variants civ
      join catalog_items ci on ci.id = civ.item_id
      where lower(trim(civ.variant_sku)) = lower(trim($1::text))
        and (
          $2::bigint is null
          or civ.item_id <> $2
          or ($3::bigint is not null and civ.id <> $3)
        )
    ) matches
    limit 1
    `,
    [normalized, currentItemId, currentVariantId]
  );
  return typeof result.rows[0]?.label === 'string' ? result.rows[0].label : null;
}

function identityConflictMessage(field: CatalogItemIdentityField, conflictLabel: string | null) {
  const suffix = conflictLabel ? ` (${conflictLabel})` : '';
  if (field === 'name') return `Naziv artikla je že uporabljen${suffix}.`;
  if (field === 'slug') return `URL artikla je že uporabljen${suffix}.`;
  return `SKU je že uporabljen${suffix}.`;
}

async function buildIdentityConflict(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> },
  field: CatalogItemIdentityField,
  value: string,
  currentItemId: number | null,
  currentVariantId: number | null,
  conflictLabel: string | null,
  extraReservedValues: string[] = []
): Promise<CatalogItemIdentityConflict> {
  return {
    field,
    value: normalizeIdentityValue(value),
    isAvailable: false,
    conflictLabel,
    message: identityConflictMessage(field, conflictLabel),
    suggestions: await buildIdentitySuggestions(client, field, value, currentItemId, currentVariantId, extraReservedValues)
  };
}

export async function getCatalogItemIdentityAvailability({
  field,
  value,
  itemId = null,
  variantId = null
}: {
  field: CatalogItemIdentityField;
  value: string;
  itemId?: number | null;
  variantId?: number | null;
}): Promise<CatalogItemIdentityAvailability> {
  const pool = await getPool();
  const normalized = normalizeIdentityValue(value);
  if (!normalized) {
    return { field, value: normalized, isAvailable: false, conflictLabel: null, suggestions: [] };
  }

  const conflictLabel = await findIdentityConflict(pool, field, normalized, itemId, variantId);
  const suggestions = conflictLabel
    ? await buildIdentitySuggestions(pool, field, normalized, itemId, variantId)
    : [];

  return {
    field,
    value: normalized,
    isAvailable: conflictLabel === null,
    conflictLabel,
    suggestions
  };
}

async function assertCatalogItemIdentityAvailable(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> },
  input: {
    itemId: number | null;
    itemName?: string | null;
    slug?: string | null;
    sku?: string | null;
    variantSkus?: Array<{ sku: string | null | undefined; variantId?: number | null; label?: string }>;
  }
) {
  const conflicts: CatalogItemIdentityConflict[] = [];

  const itemName = normalizeIdentityValue(input.itemName);
  if (itemName) {
    const conflictLabel = await findIdentityConflict(client, 'name', itemName, input.itemId, null);
    if (conflictLabel) conflicts.push(await buildIdentityConflict(client, 'name', itemName, input.itemId, null, conflictLabel));
  }

  const slug = normalizeIdentityValue(input.slug);
  if (slug) {
    const conflictLabel = await findIdentityConflict(client, 'slug', slug, input.itemId, null);
    if (conflictLabel) conflicts.push(await buildIdentityConflict(client, 'slug', slug, input.itemId, null, conflictLabel));
  }

  const sku = normalizeIdentityValue(input.sku);
  if (sku) {
    const conflictLabel = await findIdentityConflict(client, 'sku', sku, input.itemId, null);
    if (conflictLabel) conflicts.push(await buildIdentityConflict(client, 'sku', sku, input.itemId, null, conflictLabel));
  }

  const seenVariantSkus = new Map<string, string>();
  for (const variant of input.variantSkus ?? []) {
    const variantSku = normalizeIdentityValue(variant.sku);
    if (!variantSku) continue;

    const comparison = normalizeIdentityComparisonValue(variantSku);
    const duplicateLabel = seenVariantSkus.get(comparison);
    if (duplicateLabel) {
      conflicts.push(
        await buildIdentityConflict(client, 'sku', variantSku, input.itemId, variant.variantId ?? null, duplicateLabel, [...seenVariantSkus.keys()])
      );
      continue;
    }
    seenVariantSkus.set(comparison, variant.label ?? variantSku);

    const conflictLabel = await findIdentityConflict(client, 'sku', variantSku, input.itemId, variant.variantId ?? null);
    if (conflictLabel) {
      conflicts.push(await buildIdentityConflict(client, 'sku', variantSku, input.itemId, variant.variantId ?? null, conflictLabel));
    }
  }

  if (conflicts.length > 0) {
    throw new CatalogItemIdentityConflictError(conflicts);
  }
}

async function resolveItemIdByIdentifier(client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> }, itemIdentifier: string): Promise<number | null> {
  const normalized = itemIdentifier.trim();
  if (!normalized) return null;
  const result = await client.query(
    `
    select id
    from (
      select id, case when slug = $1 then 0 else 1 end as priority
      from catalog_items
      where slug = $1
         or id::text = $1
      union all
      select item_id as id, 2 as priority
      from catalog_item_slug_aliases
      where slug = $1
    ) matches
    order by priority
    limit 1
    `,
    [normalized]
  );
  const id = result.rows[0]?.id;
  return typeof id === 'number' ? id : typeof id === 'string' ? Number(id) : null;
}

async function fetchAdminCatalogListItemByItemId(itemId: number): Promise<AdminCatalogListItem | null> {
  const items = await fetchAdminCatalogListItems();
  return items.find((item) => item.id === itemId) ?? null;
}

function createCopyName(value: unknown, attempt: number) {
  const base = normalizeIdentityValue(value) || 'Artikel';
  return attempt === 0 ? `${base} kopija` : `${base} kopija ${attempt + 1}`;
}

function createCopySku(value: unknown, attempt: number) {
  const base = normalizeIdentityValue(value);
  if (!base) return null;
  return attempt === 0 ? `${base}-KOPIJA` : `${base}-KOPIJA-${attempt + 1}`;
}

function createCopySlug(sourceSlug: unknown, sourceName: unknown, attempt: number) {
  const base = normalizeIdentityValue(sourceSlug) || normalizeSlugSuggestionBase(normalizeIdentityValue(sourceName));
  return attempt === 0 ? `${base}-kopija` : `${base}-kopija-${attempt + 1}`;
}

async function buildCatalogItemCopyIdentity(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> },
  source: Record<string, unknown>,
  variants: Array<Record<string, unknown>>
) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const itemName = createCopyName(source.item_name, attempt);
    const sku = createCopySku(source.sku, attempt);
    const slug = createCopySlug(source.slug, source.item_name, attempt);
    const variantSkus = variants.map((variant) => createCopySku(variant.variant_sku, attempt));

    try {
      await assertCatalogItemIdentityAvailable(client, {
        itemId: null,
        itemName,
        slug,
        sku,
        variantSkus: variants.map((variant, index) => ({
          sku: variantSkus[index],
          variantId: null,
          label: String(variant.variant_name ?? `Različica ${index + 1}`)
        }))
      });
      return { itemName, sku, slug, variantSkus };
    } catch (error) {
      if (error instanceof CatalogItemIdentityConflictError) continue;
      throw error;
    }
  }

  throw new Error('Ni bilo mogoče najti prostega naziva, SKU ali URL za kopijo artikla.');
}

function serializeJsonbValue(value: unknown) {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function clampPercent(value: unknown, fallback = 0): number {
  return Math.min(100, Math.max(0, asNumber(value, fallback)));
}

function getDiscountedPrice(basePrice: number, discountPercent: number): number {
  return Number((Math.max(0, basePrice) * (1 - clampPercent(discountPercent) / 100)).toFixed(2));
}

function getSimpleActionPriceEnabled(simpleData: Record<string, unknown>, fallbackDiscountPercent: number): boolean {
  if (typeof simpleData.actionPriceEnabled === 'boolean') return simpleData.actionPriceEnabled;
  const basePrice = asNumber(simpleData.basePrice);
  const actionPrice = asNumber(simpleData.actionPrice, getDiscountedPrice(basePrice, fallbackDiscountPercent));
  return fallbackDiscountPercent > 0 || actionPrice < basePrice;
}

function getSimpleDiscountPercent(
  simpleData: Record<string, unknown>,
  fallbackBasePrice: number,
  fallbackDiscountPercent: number
): number {
  const basePrice = asNumber(simpleData.basePrice, fallbackBasePrice);
  const actionPrice = asNumber(simpleData.actionPrice, getDiscountedPrice(basePrice, fallbackDiscountPercent));
  if (getSimpleActionPriceEnabled(simpleData, fallbackDiscountPercent) && basePrice > 0) {
    return clampPercent(((basePrice - actionPrice) / basePrice) * 100);
  }
  return fallbackDiscountPercent;
}

function patchSingleVariantEditorPricingData(
  productType: CatalogEditorProductType,
  currentData: unknown,
  variantPatch: CatalogVariantQuickPatch,
  existingVariant: Record<string, unknown>
): CatalogItemTypeSpecificData | null {
  if (variantPatch.price === undefined && variantPatch.discountPct === undefined) return null;

  const data = { ...normalizeTypeSpecificData(currentData) };
  if (productType === 'simple') {
    const simpleData = { ...normalizeTypeSpecificData(data.simple) };
    const currentBasePrice = asNumber(simpleData.basePrice, asNumber(existingVariant.price));
    const fallbackDiscountPercent = clampPercent(
      simpleData.discountPercent,
      clampPercent(variantPatch.discountPct, asNumber(existingVariant.discount_pct))
    );
    const discountPercent =
      variantPatch.discountPct !== undefined
        ? clampPercent(variantPatch.discountPct)
        : getSimpleDiscountPercent(simpleData, currentBasePrice, fallbackDiscountPercent);
    const nextBasePrice = variantPatch.price !== undefined ? Math.max(0, asNumber(variantPatch.price)) : currentBasePrice;

    data.simple = {
      ...simpleData,
      basePrice: nextBasePrice,
      discountPercent,
      actionPrice: getDiscountedPrice(nextBasePrice, discountPercent),
      actionPriceEnabled: discountPercent > 0
    };
    return data;
  }

  if (productType === 'unique_machine') {
    const machineData = { ...normalizeTypeSpecificData(data.uniqueMachine ?? data.machine) };
    data.uniqueMachine = {
      ...machineData,
      ...(variantPatch.price !== undefined ? { basePrice: Math.max(0, asNumber(variantPatch.price)) } : {}),
      ...(variantPatch.discountPct !== undefined ? { discountPercent: clampPercent(variantPatch.discountPct) } : {})
    };
    return data;
  }

  return null;
}

async function syncSingleVariantEditorPricing(
  client: PoolClient,
  itemId: number,
  variantPatch: CatalogVariantQuickPatch,
  existingVariant: Record<string, unknown>
) {
  if (variantPatch.price === undefined && variantPatch.discountPct === undefined) return;

  const editorResult = await client.query<{
    product_type: string;
    data: unknown;
    variant_count: string | number;
  }>(
    `
    select
      cied.product_type,
      coalesce(cied.data, '{}'::jsonb) as data,
      (
        select count(*)
        from catalog_item_variants civ
        where civ.item_id = ci.id
      ) as variant_count
    from catalog_items ci
    join catalog_item_editor_details cied on cied.item_id = ci.id
    where ci.id = $1
    limit 1
    `,
    [itemId]
  );
  const editorRow = editorResult.rows[0];
  if (!editorRow || asNumber(editorRow.variant_count) !== 1) return;

  const productType = requireCatalogEditorProductType(editorRow.product_type);
  if (productType !== 'simple' && productType !== 'unique_machine') return;

  const nextData = patchSingleVariantEditorPricingData(productType, editorRow.data, variantPatch, existingVariant);
  if (!nextData) return;

  await client.query(
    `
    insert into catalog_item_editor_details (item_id, product_type, data)
    values ($1,$2,$3::jsonb)
    on conflict (item_id) do update
    set product_type = excluded.product_type,
        data = excluded.data,
        updated_at = now()
    `,
    [itemId, productType, serializeJsonbValue(nextData) ?? '{}']
  );
}

export async function duplicateCatalogItemByIdentifier(itemIdentifier: string): Promise<AdminCatalogListItem | null> {
  const normalizedIdentifier = itemIdentifier.trim();
  if (!normalizedIdentifier) throw new Error('Neveljaven identifikator artikla.');

  const pool = await getPool();
  const client = await pool.connect();
  let newItemId: number | null = null;

  try {
    await client.query('begin');

    const itemId = await resolveItemIdByIdentifier(client, normalizedIdentifier);
    if (!itemId) {
      await client.query('rollback');
      return null;
    }

    const sourceResult = await client.query(
      `
      select id, item_name, item_type, badge, status, category_id, sku, slug, unit, brand, material, colour, shape,
             description, admin_notes, position, default_variant_id, tax_rate, appearance_override_json,
             shipping_weight_grams, shipping_length_mm, shipping_width_mm, shipping_height_mm
      from catalog_items
      where id = $1
      limit 1
      `,
      [itemId]
    );
    const source = sourceResult.rows[0] as Record<string, unknown> | undefined;
    if (!source) {
      await client.query('rollback');
      return null;
    }

    const variants = (
      await client.query(
        `
        select id, variant_name, length, width, thickness, weight, error_tolerance, price, cost_net,
               content_override_json, discount_pct, inventory, min_order, variant_sku, unit, status, badge, position,
               shipping_weight_grams, shipping_length_mm, shipping_width_mm, shipping_height_mm
        from catalog_item_variants
        where item_id = $1
        order by position asc, id asc
        `,
        [itemId]
      )
    ).rows as Array<Record<string, unknown>>;
    const optionAxes = (
      await client.query(
        `
        select id, name, slug, position
        from catalog_option_axes
        where item_id = $1
        order by position asc, id asc
        `,
        [itemId]
      )
    ).rows as Array<Record<string, unknown>>;
    const optionValues = (
      await client.query(
        `
        select cov.id, cov.axis_id, cov.value, cov.slug, cov.swatch, cov.position
        from catalog_option_values cov
        join catalog_option_axes coa on coa.id = cov.axis_id
        where coa.item_id = $1
        order by coa.position asc, cov.position asc, cov.id asc
        `,
        [itemId]
      )
    ).rows as Array<Record<string, unknown>>;
    const optionAssignments = (
      await client.query(
        `
        select variant_id, axis_id, option_value_id
        from catalog_variant_option_values
        where item_id = $1
        `,
        [itemId]
      )
    ).rows as Array<Record<string, unknown>>;

    const media = (
      await client.query(
        `
        select id, media_kind, role, source_kind, filename, blob_url, blob_pathname, external_url, mime_type,
               alt_text, image_type, image_dimensions, video_type, hidden, position
        from catalog_media
        where item_id = $1
        order by position asc, id asc
        `,
        [itemId]
      )
    ).rows as Array<Record<string, unknown>>;
    const variantMediaAssignments = (
      await client.query(
        `
        select variant_id, media_id, position
        from catalog_variant_media
        where item_id = $1
        order by variant_id asc, position asc, media_id asc
        `,
        [itemId]
      )
    ).rows as Array<Record<string, unknown>>;
    const quantityDiscounts = (
      await client.query(
        `
        select min_quantity, discount_percent, applies_to, note, position
        from catalog_item_quantity_discounts
        where item_id = $1
        order by position asc, min_quantity asc, id asc
        `,
        [itemId]
      )
    ).rows as Array<Record<string, unknown>>;
    const editorDetails = (
      await client.query(
        `
        select product_type, data
        from catalog_item_editor_details
        where item_id = $1
        limit 1
        `,
        [itemId]
      )
    ).rows[0] as Record<string, unknown> | undefined;

    if (normalizeActiveState(source.status) === 'active') {
      const categoryId = asStringOrNull(source.category_id);
      assertCatalogItemPublicationReady(
        categoryId,
        normalizeCanonicalShippingMeasurements({}, 'Artikel'),
        variants.map((variant) => ({
          variantName: variant.variant_name,
          variantSku: variant.variant_sku,
          price: asNumber(variant.price, Number.NaN),
          status: variant.status,
          ...normalizeCanonicalShippingMeasurements(
            deriveCatalogVariantShippingMeasurements({
              weight: asNullableNumber(variant.weight),
              length: asNullableNumber(variant.length),
              width: asNullableNumber(variant.width),
              thickness: asNullableNumber(variant.thickness)
            }),
            `Različica »${String(variant.variant_name ?? '') || asNumber(variant.id)}«`
          )
        }))
      );
      await assertCatalogCategoryPathActive(client, categoryId);
      await assertPersistedCatalogOptionAssignmentsReady(client, itemId);
    }

    const identity = await buildCatalogItemCopyIdentity(client, source, variants);
    const sourcePosition = asNumber(source.position);
    const nextPosition = sourcePosition + 1;

    await client.query(
      `
      update catalog_items
      set position = position + 1,
          updated_at = now()
      where position > $1
      `,
      [sourcePosition]
    );

    const itemResult = await client.query(
      `
      insert into catalog_items (
        item_name, item_type, badge, status, category_id, sku, slug, unit, brand, material, colour, shape,
        description, admin_notes, position, tax_rate, appearance_override_json,
        shipping_weight_grams, shipping_length_mm, shipping_width_mm, shipping_height_mm
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20,$21)
      returning id
      `,
      [
        identity.itemName,
        String(source.item_type ?? 'unit'),
        asStringOrNull(source.badge),
        normalizeActiveState(source.status),
        asStringOrNull(source.category_id),
        identity.sku,
        identity.slug,
        asStringOrNull(source.unit),
        asStringOrNull(source.brand),
        asStringOrNull(source.material),
        asStringOrNull(source.colour),
        asStringOrNull(source.shape),
        String(source.description ?? ''),
        asStringOrNull(source.admin_notes),
        nextPosition,
        asNumber(source.tax_rate, 0.22),
        serializeJsonbValue(normalizeAppearanceOverride(source.appearance_override_json)),
        null,
        null,
        null,
        null
      ]
    );
    newItemId = asNumber(itemResult.rows[0]?.id, -1);
    if (!newItemId || newItemId < 0) throw new Error('Kopiranje artikla ni uspelo.');

    const variantIdBySourceId = new Map<number, number>();
    for (let index = 0; index < variants.length; index += 1) {
      const variant = variants[index];
      const derivedShipping = normalizeCanonicalShippingMeasurements(
        deriveCatalogVariantShippingMeasurements({
          weight: asNullableNumber(variant.weight),
          length: asNullableNumber(variant.length),
          width: asNullableNumber(variant.width),
          thickness: asNullableNumber(variant.thickness)
        }),
        `Različica »${String(variant.variant_name ?? '') || asNumber(variant.id)}«`
      );
      const variantResult = await client.query(
        `
        insert into catalog_item_variants (
          item_id, variant_name, length, width, thickness, weight, error_tolerance, price, cost_net,
          content_override_json, discount_pct, inventory, min_order, variant_sku, unit, status, badge, position,
          shipping_weight_grams, shipping_length_mm, shipping_width_mm, shipping_height_mm
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
        returning id
        `,
        [
          newItemId,
          String(variant.variant_name ?? ''),
          variant.length ?? null,
          variant.width ?? null,
          variant.thickness ?? null,
          variant.weight ?? null,
          asStringOrNull(variant.error_tolerance),
          asNumber(variant.price),
          variant.cost_net === null ? null : asNumber(variant.cost_net),
          serializeJsonbValue(normalizeVariantContentOverride(variant.content_override_json)),
          asNumber(variant.discount_pct),
          asNumber(variant.inventory),
          Math.max(1, asNumber(variant.min_order, 1)),
          identity.variantSkus[index],
          asStringOrNull(variant.unit),
          normalizeActiveState(variant.status),
          asStringOrNull(variant.badge),
          asNumber(variant.position, index),
          derivedShipping.shippingWeightGrams,
          derivedShipping.shippingLengthMm,
          derivedShipping.shippingWidthMm,
          derivedShipping.shippingHeightMm
        ]
      );
      variantIdBySourceId.set(asNumber(variant.id), asNumber(variantResult.rows[0]?.id));
    }

    const axisIdBySourceId = new Map<number, number>();
    for (const axis of optionAxes) {
      const axisResult = await client.query(
        `
        insert into catalog_option_axes (item_id, name, slug, position)
        values ($1,$2,$3,$4)
        returning id
        `,
        [
          newItemId,
          String(axis.name ?? ''),
          String(axis.slug ?? ''),
          asNumber(axis.position)
        ]
      );
      axisIdBySourceId.set(asNumber(axis.id), asNumber(axisResult.rows[0]?.id));
    }

    const valueIdBySourceId = new Map<number, number>();
    for (const optionValue of optionValues) {
      const nextAxisId = axisIdBySourceId.get(asNumber(optionValue.axis_id));
      if (!nextAxisId) continue;
      const valueResult = await client.query(
        `
        insert into catalog_option_values (axis_id, value, slug, swatch, position)
        values ($1,$2,$3,$4,$5)
        returning id
        `,
        [
          nextAxisId,
          String(optionValue.value ?? ''),
          String(optionValue.slug ?? ''),
          asStringOrNull(optionValue.swatch),
          asNumber(optionValue.position)
        ]
      );
      valueIdBySourceId.set(asNumber(optionValue.id), asNumber(valueResult.rows[0]?.id));
    }

    for (const assignment of optionAssignments) {
      const nextVariantId = variantIdBySourceId.get(asNumber(assignment.variant_id));
      const nextAxisId = axisIdBySourceId.get(asNumber(assignment.axis_id));
      const nextValueId = valueIdBySourceId.get(asNumber(assignment.option_value_id));
      if (!nextVariantId || !nextAxisId || !nextValueId) continue;
      await client.query(
        `
        insert into catalog_variant_option_values (variant_id, item_id, axis_id, option_value_id)
        values ($1,$2,$3,$4)
        `,
        [nextVariantId, newItemId, nextAxisId, nextValueId]
      );
    }

    const sourceDefaultVariantId = source.default_variant_id === null
      ? null
      : asNumber(source.default_variant_id);
    const nextDefaultVariantId =
      (sourceDefaultVariantId === null ? null : variantIdBySourceId.get(sourceDefaultVariantId))
      ?? variantIdBySourceId.get(asNumber(variants[0]?.id))
      ?? null;
    await client.query(
      'update catalog_items set default_variant_id = $1 where id = $2',
      [nextDefaultVariantId, newItemId]
    );

    const mediaIdBySourceId = new Map<number, number>();
    for (const mediaEntry of media) {

      const mediaResult = await client.query(
        `
        insert into catalog_media (
          item_id, media_kind, role, source_kind, filename, blob_url, blob_pathname, external_url, mime_type,
          alt_text, image_type, image_dimensions, video_type, hidden, position
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15)
        returning id
        `,
        [
          newItemId,
          String(mediaEntry.media_kind ?? 'image'),
          String(mediaEntry.role ?? 'gallery'),
          String(mediaEntry.source_kind ?? 'upload'),
          asStringOrNull(mediaEntry.filename),
          asStringOrNull(mediaEntry.blob_url),
          asStringOrNull(mediaEntry.blob_pathname),
          asStringOrNull(mediaEntry.external_url),
          asStringOrNull(mediaEntry.mime_type),
          asStringOrNull(mediaEntry.alt_text),
          asStringOrNull(mediaEntry.image_type),
          serializeJsonbValue(mediaEntry.image_dimensions),
          asStringOrNull(mediaEntry.video_type),
          Boolean(mediaEntry.hidden),
          asNumber(mediaEntry.position)
        ]
      );
      mediaIdBySourceId.set(asNumber(mediaEntry.id), asNumber(mediaResult.rows[0]?.id));
    }

    for (const assignment of variantMediaAssignments) {
      const nextVariantId = variantIdBySourceId.get(asNumber(assignment.variant_id));
      const nextMediaId = mediaIdBySourceId.get(asNumber(assignment.media_id));
      if (!nextVariantId || !nextMediaId) continue;
      await client.query(
        `
        insert into catalog_variant_media (variant_id, item_id, media_id, position)
        values ($1,$2,$3,$4)
        on conflict (variant_id, media_id) do update
        set position = excluded.position
        `,
        [nextVariantId, newItemId, nextMediaId, asNumber(assignment.position)]
      );
    }

    for (const variant of variants) {
      const nextVariantId = variantIdBySourceId.get(asNumber(variant.id));
      const contentOverride = normalizeVariantContentOverride(variant.content_override_json);
      if (!nextVariantId || !contentOverride?.documentIds?.length) continue;
      const documentIds = contentOverride.documentIds
        .map((documentId) => mediaIdBySourceId.get(documentId))
        .filter((documentId): documentId is number => Boolean(documentId));
      const nextContentOverride: CatalogVariantContentOverride = { ...contentOverride };
      if (documentIds.length > 0) nextContentOverride.documentIds = documentIds;
      else delete nextContentOverride.documentIds;
      await client.query(
        `
        update catalog_item_variants
        set content_override_json = $1::jsonb,
            updated_at = now()
        where id = $2
          and item_id = $3
        `,
        [
          serializeJsonbValue(Object.keys(nextContentOverride).length > 0 ? nextContentOverride : null),
          nextVariantId,
          newItemId
        ]
      );
    }

    for (const quantityDiscount of quantityDiscounts) {
      await client.query(
        `
        insert into catalog_item_quantity_discounts (
          item_id, min_quantity, discount_percent, applies_to, note, position
        ) values ($1,$2,$3,$4,$5,$6)
        `,
        [
          newItemId,
          Math.max(1, Math.floor(asNumber(quantityDiscount.min_quantity, 1))),
          Math.min(100, Math.max(0, asNumber(quantityDiscount.discount_percent))),
          asStringOrNull(quantityDiscount.applies_to) ?? ALL_QUANTITY_DISCOUNT_TARGETS_JSON,
          asStringOrNull(quantityDiscount.note),
          asNumber(quantityDiscount.position)
        ]
      );
    }

    await client.query(
      `
      insert into catalog_item_editor_details (item_id, product_type, data)
      values ($1,$2,$3::jsonb)
      on conflict (item_id) do update
      set product_type = excluded.product_type,
          data = excluded.data,
          updated_at = now()
      `,
      [
        newItemId,
        requireCatalogEditorProductType(editorDetails?.product_type),
        serializeJsonbValue(normalizeTypeSpecificData(editorDetails?.data)) ?? '{}'
      ]
    );
    await ensureCatalogDefaultVariantIsUsable(client, newItemId);

    await client.query('commit');
    revalidateTag(CATALOG_PUBLIC_TAG, { expire: 0 });
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  return newItemId ? await fetchAdminCatalogListItemByItemId(newItemId) : null;
}

async function resolveCategoryIdByPath(
  path: string[],
  queryable?: { query: PoolClient['query'] }
): Promise<string | null> {
  if (path.length === 0) return null;
  const executor = queryable ?? await getPool();
  let parentId: string | null = null;
  let lastId: string | null = null;

  for (const segment of path) {
    const result = await executor.query(
      `
      select id
      from catalog_categories
      where coalesce(parent_id, '') = coalesce($1::text, '')
        and lower(trim(title)) = lower(trim($2::text))
      order by position asc, id asc
      limit 1
      `,
      [parentId, segment]
    );

    const row = result.rows[0] as { id?: string } | undefined;
    if (!row?.id) return null;
    parentId = row.id;
    lastId = row.id;
  }

  return lastId;
}

async function assertCatalogCategoryPathActive(client: PoolClient, categoryId: string | null) {
  if (!categoryId) {
    throw new CatalogItemValidationError(
      'Za objavo izberite eno veljavno kategorijo ali podkategorijo.'
    );
  }
  const result = await client.query(
    `
    with recursive category_chain as (
      select id, parent_id
      from catalog_categories
      where id = $1
      union all
      select parent.id, parent.parent_id
      from catalog_categories parent
      join category_chain child on child.parent_id = parent.id
    )
    select category.id, category.title, category.status
    from catalog_categories category
    join category_chain on category_chain.id = category.id
    for share of category
    `,
    [categoryId]
  );
  if (result.rows.length === 0) {
    throw new CatalogItemValidationError('Izbrana kategorija ne obstaja.');
  }
  const inactiveLabels = result.rows
    .filter((row) => row.status !== 'active')
    .map((row) => asStringOrNull(row.title))
    .filter((label): label is string => label !== null);
  if (inactiveLabels.length > 0) {
    throw new CatalogItemValidationError(
      `Pred objavo aktivirajte kategorijo: ${inactiveLabels.join(' / ')}.`
    );
  }
}

export async function fetchCatalogItemSeeds(): Promise<CatalogItemSeedRow[]> {
  const pool = await getPool();
  const result = await pool.query(
    `
    with recursive category_paths as (
      select id, parent_id, title, title::text as full_path
      from catalog_categories
      where parent_id is null
      union all
      select c.id, c.parent_id, c.title, cp.full_path || ' / ' || c.title
      from catalog_categories c
      join category_paths cp on cp.id = c.parent_id
    ),
    media_images as (
      select item_id,
             coalesce(
               array_agg(coalesce(nullif(blob_url, ''), external_url) order by position asc, id asc)
                 filter (where media_kind = 'image' and role = 'gallery' and coalesce(nullif(blob_url, ''), external_url) is not null),
               array[]::text[]
             ) as image_urls
      from catalog_media
      group by item_id
    )
    select
      ci.id,
      ci.item_name,
      ci.description,
      coalesce(cp.full_path, '') as category_path,
      ci.category_id,
      cc.parent_id as parent_category_id,
      civ.id as variant_id,
      civ.variant_name,
      count(civ.id) over (partition by ci.id)::int as variant_count,
      civ.length::text as variant_length,
      civ.width::text as variant_width,
      civ.thickness::text as variant_thickness,
      civ.weight::text as variant_weight,
      coalesce(civ.price, 0)::text as price,
      coalesce(nullif(civ.variant_sku, ''), nullif(ci.sku, ''), ci.slug) as sku,
      coalesce(nullif(civ.unit, ''), nullif(ci.unit, ''), 'kos') as unit,
      coalesce(mi.image_urls, array[]::text[]) as images,
      coalesce(civ.discount_pct, 0)::text as discount_pct,
      ci.position as item_position
    from catalog_items ci
    left join catalog_item_variants civ on civ.item_id = ci.id and civ.status = 'active'
    left join media_images mi on mi.item_id = ci.id
    left join category_paths cp on cp.id = ci.category_id
    left join catalog_categories cc on cc.id = ci.category_id
    where ci.status = 'active'
    order by ci.position asc, ci.id asc, civ.position asc, civ.id asc
    `
  );

  return (result.rows as Record<string, unknown>[])
    .filter((row) => row.variant_id !== null)
    .map((row) => ({
      id: Number(row.id),
      item_name: String(row.item_name ?? ''),
      description: String(row.description ?? ''),
      category_path: String(row.category_path ?? ''),
      category_id: asStringOrNull(row.parent_category_id) ?? asStringOrNull(row.category_id),
      parent_category_id: asStringOrNull(row.category_id),
      variant_id: Number(row.variant_id),
      variant_name: String(row.variant_name ?? ''),
      variant_count: asNumber(row.variant_count),
      length: row.variant_length === null ? null : asNumber(row.variant_length),
      width: row.variant_width === null ? null : asNumber(row.variant_width),
      thickness: row.variant_thickness === null ? null : asNumber(row.variant_thickness),
      weight: row.variant_weight === null ? null : asNumber(row.variant_weight),
      price: asNumber(row.price),
      sku: String(row.sku ?? ''),
      unit: String(row.unit ?? 'kos'),
      images: Array.isArray(row.images) ? row.images.map((image) => String(image)) : [],
      discount_pct: asNumber(row.discount_pct),
      item_position: asNumber(row.item_position)
    }));
}

export async function fetchCatalogItemsForCategory(categoryIds: string[]): Promise<Array<{ category_id: string; item: Record<string, unknown> }>> {
  if (categoryIds.length === 0) return [];

  const pool = await getPool();
  const result = await pool.query(
    `
    with variants_agg as (
      select
        item_id,
        min(price)::text as min_price,
        max(price)::text as max_price,
        coalesce(
          json_agg(
            json_build_object(
              'id', id,
              'variantName', variant_name,
              'length', length,
              'width', width,
              'thickness', thickness,
              'weight', weight,
              'errorTolerance', error_tolerance,
              'price', price,
              'contentOverride', json_strip_nulls(json_build_object(
                'description', content_override_json->>'description',
                'specifications', content_override_json->'specifications',
                'attributes', content_override_json->'attributes',
                'includedItems', content_override_json->'includedItems',
                'deliveryEstimate', content_override_json->>'deliveryEstimate',
                'documentIds', content_override_json->'documentIds'
              )),
              'discountPct', discount_pct,
              'inventory', inventory,
              'minOrder', min_order,
              'variantSku', variant_sku,
              'position', position,
              'unit', unit,
              'status', status,
              'badge', badge,
              'optionValueIds', coalesce((
                select json_agg(cvov.option_value_id order by coa.position asc, cov.position asc, cov.id asc)
                from catalog_variant_option_values cvov
                join catalog_option_axes coa on coa.id = cvov.axis_id
                join catalog_option_values cov on cov.id = cvov.option_value_id
                where cvov.variant_id = civ.id
              ), '[]'::json)
            )
            order by position asc, id asc
          ),
          '[]'::json
        ) as variants
      from catalog_item_variants civ
      where civ.status = 'active'
      group by item_id
    ),
    media_agg as (
      select
        item_id,
        coalesce(json_agg(
          json_build_object(
            'id', id,
            'mediaKind', media_kind,
            'role', role,
            'sourceKind', source_kind,
            'filename', filename,
            'blobUrl', blob_url,
            'externalUrl', external_url,
            'mimeType', mime_type,
            'altText', alt_text,
            'imageType', image_type,
            'imageDimensions', image_dimensions,
            'videoType', video_type,
            'variantIds', coalesce((
              select json_agg(cvm.variant_id order by cvm.position asc, cvm.variant_id asc)
              from catalog_variant_media cvm
              join catalog_item_variants assigned_variant on assigned_variant.id = cvm.variant_id
              where cvm.media_id = catalog_media.id
                and assigned_variant.status = 'active'
            ), '[]'::json),
            'variantPositions', coalesce((
              select json_object_agg(cvm.variant_id::text, cvm.position)
              from catalog_variant_media cvm
              join catalog_item_variants positioned_variant on positioned_variant.id = cvm.variant_id
              where cvm.media_id = catalog_media.id
                and positioned_variant.status = 'active'
            ), '{}'::json),
            'hidden', hidden,
            'position', position
          )
          order by position asc, id asc
        ), '[]'::json) as media
      from catalog_media
      where coalesce(hidden, false) = false
        and (
          exists (
            select 1
            from catalog_variant_media active_media_assignment
            join catalog_item_variants active_media_variant
              on active_media_variant.id = active_media_assignment.variant_id
            where active_media_assignment.media_id = catalog_media.id
              and active_media_variant.status = 'active'
          )
          or not exists (
            select 1
            from catalog_variant_media any_media_assignment
            where any_media_assignment.media_id = catalog_media.id
          )
        )
      group by item_id
    )
    select
      ci.category_id,
      cied.product_type as editor_product_type,
      coalesce(cied.data, '{}'::jsonb) as editor_data,
      json_build_object(
        'id', ci.id,
        'slug', ci.slug,
        'name', ci.item_name,
        'description', ci.description,
        'sku', ci.sku,
        'brand', ci.brand,
        'material', ci.material,
        'colour', ci.colour,
        'shape', ci.shape,
        'unit', ci.unit,
        'badge', ci.badge,
        'status', ci.status,
        'taxRate', ci.tax_rate,
        'defaultVariantId', ci.default_variant_id,
        'appearanceOverride', ci.appearance_override_json,
        'optionAxes', coalesce((
          select json_agg(
            json_build_object(
              'id', coa.id,
              'name', coa.name,
              'slug', coa.slug,
              'position', coa.position,
              'values', coalesce((
                select json_agg(
                  json_build_object(
                    'id', cov.id,
                    'value', cov.value,
                    'slug', cov.slug,
                    'swatch', cov.swatch,
                    'position', cov.position
                  )
                  order by cov.position asc, cov.id asc
                )
                from catalog_option_values cov
                where cov.axis_id = coa.id
              ), '[]'::json)
            )
            order by coa.position asc, coa.id asc
          )
          from catalog_option_axes coa
          where coa.item_id = ci.id
        ), '[]'::json),
        'image', coalesce((
          select coalesce(nullif(cm.blob_url, ''), cm.external_url)
          from catalog_media cm
          where cm.item_id = ci.id
            and cm.media_kind = 'image'
            and cm.role = 'gallery'
            and coalesce(cm.hidden, false) = false
            and (
              exists (
                select 1
                from catalog_variant_media active_primary_assignment
                join catalog_item_variants active_primary_variant
                  on active_primary_variant.id = active_primary_assignment.variant_id
                where active_primary_assignment.media_id = cm.id
                  and active_primary_variant.status = 'active'
              )
              or not exists (
                select 1
                from catalog_variant_media any_primary_assignment
                where any_primary_assignment.media_id = cm.id
              )
            )
          order by cm.position asc, cm.id asc
          limit 1
        ), ''),
        'images', coalesce((
          select json_agg(coalesce(nullif(cm.blob_url, ''), cm.external_url) order by cm.position asc, cm.id asc)
          from catalog_media cm
          where cm.item_id = ci.id
            and cm.media_kind = 'image'
            and cm.role = 'gallery'
            and coalesce(cm.hidden, false) = false
            and coalesce(nullif(cm.blob_url, ''), cm.external_url) is not null
            and (
              exists (
                select 1
                from catalog_variant_media active_gallery_assignment
                join catalog_item_variants active_gallery_variant
                  on active_gallery_variant.id = active_gallery_assignment.variant_id
                where active_gallery_assignment.media_id = cm.id
                  and active_gallery_variant.status = 'active'
              )
              or not exists (
                select 1
                from catalog_variant_media any_gallery_assignment
                where any_gallery_assignment.media_id = cm.id
              )
            )
        ), '[]'::json),
        'price', coalesce(va.min_price, '0')::numeric,
        'discountPct', coalesce((
          select max(discount_pct)
          from catalog_item_variants civ
          where civ.item_id = ci.id
            and civ.status = 'active'
        ), 0),
        'displayOrder', ci.position,
        'variants', coalesce(va.variants, '[]'::json),
        'media', coalesce(ma.media, '[]'::json)
      ) as item
    from catalog_items ci
    left join variants_agg va on va.item_id = ci.id
    left join media_agg ma on ma.item_id = ci.id
    join catalog_item_editor_details cied on cied.item_id = ci.id
    where ci.status = 'active'
      and ci.category_id = any($1::text[])
      and va.item_id is not null
    order by ci.position asc, ci.item_name asc, ci.id asc
    `,
    [categoryIds]
  );

  return (result.rows as Array<{
    category_id: string;
    editor_product_type: string;
    editor_data: unknown;
    item: Record<string, unknown>;
  }>).map((row) => {
    const variants = Array.isArray(row.item.variants)
      ? row.item.variants as Array<Record<string, unknown>>
      : [];
    const productType = requireCatalogEditorProductType(row.editor_product_type);
    const presentation = buildPublicCatalogPresentationDetails(productType, row.editor_data);
    const metadataSpecifications: PublicCatalogSpecification[] = [
      ['material', 'Material', row.item.material],
      ['colour', 'Barva', row.item.colour],
      ['shape', 'Oblika', row.item.shape]
    ].flatMap(([id, label, value]) => {
      const displayValue = asPublicDisplayValue(value);
      return displayValue
        ? [{ id: `product-${String(id)}`, label: String(label), value: displayValue, group: 'Osnovni podatki' }]
        : [];
    });

    return {
      category_id: row.category_id,
      item: {
        ...row.item,
        productType,
        specifications: [...metadataSpecifications, ...presentation.specifications],
        includedItems: presentation.includedItems,
        deliveryEstimate: presentation.deliveryEstimate
      }
    };
  });
}

export async function resolveCatalogItemCanonicalSlug(slugOrAlias: string): Promise<string | null> {
  const normalized = slugOrAlias.trim();
  if (!normalized) return null;
  const pool = await getPool();
  const result = await pool.query(
    `
    select ci.slug
    from catalog_items ci
    left join catalog_item_slug_aliases alias on alias.item_id = ci.id
    where ci.status = 'active'
      and (ci.slug = $1 or alias.slug = $1)
    order by case when ci.slug = $1 then 0 else 1 end
    limit 1
    `,
    [normalized]
  );
  return asStringOrNull(result.rows[0]?.slug);
}

export async function fetchAdminCatalogListItems(): Promise<AdminCatalogListItem[]> {
  const pool = await getPool();
  const result = await pool.query(
    `
    with recursive category_paths as (
      select id, parent_id, title, title::text as full_path
      from catalog_categories
      where parent_id is null
      union all
      select c.id, c.parent_id, c.title, cp.full_path || ' / ' || c.title
      from catalog_categories c
      join category_paths cp on cp.id = c.parent_id
    ),
    variants_agg as (
      select
        civ.item_id,
        coalesce(count(*), 0)::int as variant_count,
        coalesce(min(civ.price), 0)::numeric as min_price,
        coalesce(max(civ.price), 0)::numeric as max_price,
        coalesce(max(civ.discount_pct), 0)::numeric as max_discount_pct,
        coalesce(
          json_agg(
            json_build_object(
              'id', civ.id,
              'variantName', civ.variant_name,
              'variantSku', civ.variant_sku,
              'length', civ.length,
              'width', civ.width,
              'thickness', civ.thickness,
              'weight', civ.weight,
              'shippingWeightGrams', civ.shipping_weight_grams,
              'shippingLengthMm', civ.shipping_length_mm,
              'shippingWidthMm', civ.shipping_width_mm,
              'shippingHeightMm', civ.shipping_height_mm,
              'price', civ.price,
              'costNet', civ.cost_net,
              'discountPct', civ.discount_pct,
              'inventory', civ.inventory,
              'minOrder', civ.min_order,
              'status', civ.status,
              'badge', civ.badge,
              'position', civ.position
            )
            order by civ.position asc, civ.id asc
          ),
          '[]'::json
        ) as variants
      from catalog_item_variants civ
      group by civ.item_id
    )
    select
      ci.id,
      ci.slug,
      ci.item_name,
      cied.product_type as editor_product_type,
      coalesce(cied.data, '{}'::jsonb) as type_specific_data,
      ci.description,
      ci.brand,
      ci.material,
      ci.unit,
      ci.tax_rate,
      ci.sku,
      ci.status,
      ci.shipping_weight_grams,
      ci.shipping_length_mm,
      ci.shipping_width_mm,
      ci.shipping_height_mm,
      ci.default_variant_id,
      ci.badge,
      ci.admin_notes,
      coalesce(cp.full_path, '') as category_label,
      coalesce(va.variant_count, 0) as variant_count,
      coalesce(va.min_price, 0)::text as min_price,
      coalesce(va.max_price, 0)::text as max_price,
      coalesce(va.max_discount_pct, 0)::text as default_discount_pct,
      (
        select coalesce(nullif(cm.blob_url, ''), nullif(cm.external_url, ''))
        from catalog_media cm
        where cm.item_id = ci.id
          and cm.media_kind = 'image'
          and cm.role = 'gallery'
          and coalesce(cm.hidden, false) = false
          and coalesce(nullif(cm.blob_url, ''), nullif(cm.external_url, '')) is not null
          and (
            exists (
              select 1
              from catalog_variant_media active_assignment
              join catalog_item_variants active_variant
                on active_variant.id = active_assignment.variant_id
              where active_assignment.media_id = cm.id
                and active_variant.status = 'active'
            )
            or not exists (
              select 1
              from catalog_variant_media any_assignment
              where any_assignment.media_id = cm.id
            )
          )
        order by cm.position asc, cm.id asc
        limit 1
      ) as image_url,
      coalesce(va.variants, '[]'::json) as variants
    from catalog_items ci
    left join category_paths cp on cp.id = ci.category_id
    left join variants_agg va on va.item_id = ci.id
    join catalog_item_editor_details cied on cied.item_id = ci.id
    where ci.status <> 'deleted'
    order by ci.position asc, ci.item_name asc, ci.id asc
    `
  );

  return (result.rows as Record<string, unknown>[]).map((row) => {
    const variantsJson = Array.isArray(row.variants) ? row.variants : [];
    const itemShipping = {
      shippingWeightGrams: asNullableNumber(row.shipping_weight_grams),
      shippingLengthMm: asNullableNumber(row.shipping_length_mm),
      shippingWidthMm: asNullableNumber(row.shipping_width_mm),
      shippingHeightMm: asNullableNumber(row.shipping_height_mm)
    };
    const variants = variantsJson.map((variant) => {
      const entry = variant as Record<string, unknown>;
      const shipping = {
        shippingWeightGrams: asNullableNumber(entry.shippingWeightGrams),
        shippingLengthMm: asNullableNumber(entry.shippingLengthMm),
        shippingWidthMm: asNullableNumber(entry.shippingWidthMm),
        shippingHeightMm: asNullableNumber(entry.shippingHeightMm)
      };
      const readiness = getCatalogShippingReadiness(itemShipping, shipping);
      return {
        id: asNumber(entry.id),
        variantName: String(entry.variantName ?? ''),
        variantSku: asStringOrNull(entry.variantSku),
        length: entry.length === null ? null : asNumber(entry.length),
        width: entry.width === null ? null : asNumber(entry.width),
        thickness: entry.thickness === null ? null : asNumber(entry.thickness),
        weight: entry.weight === null ? null : asNumber(entry.weight),
        price: asNumber(entry.price),
        costNet: entry.costNet === null ? null : asNumber(entry.costNet),
        discountPct: asNumber(entry.discountPct),
        inventory: asNumber(entry.inventory),
        minOrder: Math.max(1, asNumber(entry.minOrder, 1)),
        status: (String(entry.status ?? 'inactive') === 'active' ? 'active' : 'inactive') as 'active' | 'inactive',
        badge: asStringOrNull(entry.badge),
        position: asNumber(entry.position),
        ...shipping,
        shippingReady: readiness.isReady,
        shippingMissingFields: [...readiness.missingFields, ...readiness.invalidFields]
      };
    });
    const shippingIssueCount = variants.filter(
      (variant) => variant.status === 'active' && !variant.shippingReady
    ).length;

    return {
      id: Number(row.id),
      slug: String(row.slug ?? ''),
      itemName: String(row.item_name ?? ''),
      productType: requireCatalogEditorProductType(row.editor_product_type),
      typeSpecificData: normalizeTypeSpecificData(row.type_specific_data),
      description: asStringOrNull(row.description),
      brand: asStringOrNull(row.brand),
      material: asStringOrNull(row.material),
      unit: asStringOrNull(row.unit),
      imageUrl: asStringOrNull(row.image_url),
      taxRate: Math.min(1, Math.max(0, asNumber(row.tax_rate, 0.22))),
      baseSku: asStringOrNull(row.sku),
      categoryLabel: String(row.category_label ?? ''),
      status: String(row.status ?? 'inactive') === 'active' ? 'active' : 'inactive',
      badge: asStringOrNull(row.badge),
      variantCount: asNumber(row.variant_count),
      minPrice: asNumber(row.min_price),
      maxPrice: asNumber(row.max_price),
      defaultDiscountPct: asNumber(row.default_discount_pct),
      adminNotes: asStringOrNull(row.admin_notes),
      defaultVariantId: row.default_variant_id === null ? null : asNumber(row.default_variant_id),
      ...itemShipping,
      variants,
      shippingReady: shippingIssueCount === 0,
      shippingIssueCount
    };
  });
}

export async function fetchCatalogItemEditorBySlug(slug: string): Promise<CatalogItemEditorHydration | null> {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) return null;

  const pool = await getPool();
  const result = await pool.query(
    `
    with item as (
      select *
      from catalog_items
      where slug = $1
         or id::text = $1
         or id = (
           select alias.item_id
           from catalog_item_slug_aliases alias
           where alias.slug = $1
           limit 1
         )
      order by
        case when id::text = $1 then 0 when slug = $1 then 1 else 2 end
      limit 1
    ),
    category_path as (
      with recursive chain as (
        select cc.id, cc.parent_id, cc.title, 0 as depth
        from catalog_categories cc
        join item i on i.category_id = cc.id
        union all
        select parent.id, parent.parent_id, parent.title, chain.depth + 1
        from catalog_categories parent
        join chain on chain.parent_id = parent.id
      )
      select coalesce(array_agg(title order by depth desc), array[]::text[]) as path
      from chain
    )
    select
      i.id,
      i.updated_at,
      i.item_name,
      i.item_type,
      i.badge,
      i.status,
      i.sku,
      i.slug,
      i.unit,
      i.brand,
      i.material,
      i.colour,
      i.shape,
      i.description,
      i.admin_notes,
      i.position,
      i.tax_rate,
      i.appearance_override_json,
      i.shipping_weight_grams,
      i.shipping_length_mm,
      i.shipping_width_mm,
      i.shipping_height_mm,
      i.default_variant_id,
      i.deleted_at,
      i.purge_after,
      i.status_before_delete,
      (
        select cied.product_type
        from catalog_item_editor_details cied
        where cied.item_id = i.id
        limit 1
      ) as editor_product_type,
      coalesce((
        select cied.data
        from catalog_item_editor_details cied
        where cied.item_id = i.id
        limit 1
      ), '{}'::jsonb) as type_specific_data,
      coalesce((select path from category_path), array[]::text[]) as category_path,
      coalesce((
        select json_agg(
          json_build_object(
            'id', civ.id,
            'variantName', civ.variant_name,
            'length', civ.length,
            'width', civ.width,
            'thickness', civ.thickness,
            'weight', civ.weight,
            'shippingWeightGrams', civ.shipping_weight_grams,
            'shippingLengthMm', civ.shipping_length_mm,
            'shippingWidthMm', civ.shipping_width_mm,
            'shippingHeightMm', civ.shipping_height_mm,
            'errorTolerance', civ.error_tolerance,
            'price', civ.price,
            'costNet', civ.cost_net,
            'contentOverride', civ.content_override_json,
            'discountPct', civ.discount_pct,
            'inventory', civ.inventory,
            'minOrder', civ.min_order,
            'variantSku', civ.variant_sku,
            'unit', civ.unit,
            'status', civ.status,
            'badge', civ.badge,
            'position', civ.position,
            'optionValueIds', coalesce((
              select json_agg(cvov.option_value_id order by coa.position asc, cov.position asc, cov.id asc)
              from catalog_variant_option_values cvov
              join catalog_option_axes coa on coa.id = cvov.axis_id
              join catalog_option_values cov on cov.id = cvov.option_value_id
              where cvov.variant_id = civ.id
            ), '[]'::json)
          )
          order by civ.position asc, civ.id asc
        )
        from catalog_item_variants civ
        where civ.item_id = i.id
      ), '[]'::json) as variants,
      coalesce((
        select json_agg(
          json_build_object(
            'id', coa.id,
            'name', coa.name,
            'slug', coa.slug,
            'position', coa.position,
            'values', coalesce((
              select json_agg(
                json_build_object(
                  'id', cov.id,
                  'value', cov.value,
                  'slug', cov.slug,
                  'swatch', cov.swatch,
                  'position', cov.position
                )
                order by cov.position asc, cov.id asc
              )
              from catalog_option_values cov
              where cov.axis_id = coa.id
            ), '[]'::json)
          )
          order by coa.position asc, coa.id asc
        )
        from catalog_option_axes coa
        where coa.item_id = i.id
      ), '[]'::json) as option_axes,
      coalesce((
        select json_agg(
          json_build_object(
            'id', cqd.id,
            'minQuantity', cqd.min_quantity,
            'discountPercent', cqd.discount_percent,
            'appliesTo', cqd.applies_to,
            'note', cqd.note,
            'position', cqd.position
          )
          order by cqd.position asc, cqd.min_quantity asc, cqd.id asc
        )
        from catalog_item_quantity_discounts cqd
        where cqd.item_id = i.id
      ), '[]'::json) as quantity_discounts,
      coalesce((
        select json_agg(
          json_build_object(
            'id', cm.id,
            'variantIds', coalesce((
              select json_agg(cvm.variant_id order by cvm.position asc, cvm.variant_id asc)
              from catalog_variant_media cvm
              where cvm.media_id = cm.id
            ), '[]'::json),
            'mediaKind', cm.media_kind,
            'role', cm.role,
            'sourceKind', cm.source_kind,
            'filename', cm.filename,
            'blobUrl', cm.blob_url,
            'blobPathname', cm.blob_pathname,
            'externalUrl', cm.external_url,
            'mimeType', cm.mime_type,
            'altText', cm.alt_text,
            'imageType', cm.image_type,
            'imageDimensions', cm.image_dimensions,
            'videoType', cm.video_type,
            'hidden', cm.hidden,
            'position', cm.position
          )
          order by cm.position asc, cm.id asc
        )
        from catalog_media cm
        where cm.item_id = i.id
      ), '[]'::json) as media
    from item i
    `
    ,
    [normalizedSlug]
  );

  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  const variantsJson = Array.isArray(row.variants) ? row.variants : [];
  const optionAxesJson = Array.isArray(row.option_axes) ? row.option_axes : [];
  const quantityDiscountsJson = Array.isArray(row.quantity_discounts) ? row.quantity_discounts : [];
  const mediaJson = Array.isArray(row.media) ? row.media : [];
  const variantIdToIndex = new Map<number, number>();
  const variants = variantsJson.map((entry, index) => {
    const variant = entry as Record<string, unknown>;
    const id = asNumber(variant.id);
    variantIdToIndex.set(id, index);
    return {
      id,
      variantName: String(variant.variantName ?? ''),
      length: variant.length === null ? null : asNumber(variant.length),
      width: variant.width === null ? null : asNumber(variant.width),
      thickness: variant.thickness === null ? null : asNumber(variant.thickness),
      weight: variant.weight === null ? null : asNumber(variant.weight),
      shippingWeightGrams: asNullableNumber(variant.shippingWeightGrams),
      shippingLengthMm: asNullableNumber(variant.shippingLengthMm),
      shippingWidthMm: asNullableNumber(variant.shippingWidthMm),
      shippingHeightMm: asNullableNumber(variant.shippingHeightMm),
      errorTolerance: asStringOrNull(variant.errorTolerance),
      price: asNumber(variant.price),
      costNet: variant.costNet === null ? null : asNumber(variant.costNet),
      contentOverride: normalizeVariantContentOverride(variant.contentOverride),
      discountPct: asNumber(variant.discountPct),
      inventory: asNumber(variant.inventory),
      minOrder: Math.max(1, asNumber(variant.minOrder, 1)),
      variantSku: asStringOrNull(variant.variantSku),
      unit: asStringOrNull(variant.unit),
      status: (String(variant.status ?? 'inactive') === 'active' ? 'active' : 'inactive') as 'active' | 'inactive',
      badge: asStringOrNull(variant.badge),
      position: asNumber(variant.position, index),
      optionValueIds: Array.isArray(variant.optionValueIds)
        ? variant.optionValueIds.map((entry) => asNumber(entry)).filter((entry) => entry > 0)
        : [],
      imageAssignments: [] as number[]
    };
  });
  const optionAxes = optionAxesJson.map((entry, axisIndex) => {
    const axis = entry as Record<string, unknown>;
    const values = Array.isArray(axis.values) ? axis.values : [];
    return {
      id: asNumber(axis.id),
      name: String(axis.name ?? ''),
      slug: String(axis.slug ?? ''),
      position: asNumber(axis.position, axisIndex),
      values: values.map((valueEntry, valueIndex) => {
        const value = valueEntry as Record<string, unknown>;
        return {
          id: asNumber(value.id),
          value: String(value.value ?? ''),
          slug: String(value.slug ?? ''),
          swatch: asStringOrNull(value.swatch),
          position: asNumber(value.position, valueIndex)
        };
      })
    };
  });

  const media = mediaJson.map((entry, index) => {
    const item = entry as Record<string, unknown>;
    const variantIds = Array.isArray(item.variantIds)
      ? item.variantIds.map((entry) => asNumber(entry)).filter((entry) => entry > 0)
      : [];
    const firstVariantId = variantIds[0] ?? null;
    return {
      id: asNumber(item.id),
      variantIndex: firstVariantId !== null && variantIdToIndex.has(firstVariantId)
        ? variantIdToIndex.get(firstVariantId) ?? null
        : null,
      variantIds,
      mediaKind: String(item.mediaKind ?? 'image') as 'image' | 'video' | 'document',
      role: String(item.role ?? 'gallery') as 'gallery' | 'technical_sheet',
      sourceKind: String(item.sourceKind ?? 'upload') as 'upload' | 'youtube',
      filename: asStringOrNull(item.filename),
      blobUrl: asStringOrNull(item.blobUrl),
      blobPathname: asStringOrNull(item.blobPathname),
      externalUrl: asStringOrNull(item.externalUrl),
      mimeType: asStringOrNull(item.mimeType),
      altText: asStringOrNull(item.altText),
      imageType: asStringOrNull(item.imageType),
      imageDimensions: (typeof item.imageDimensions === 'object' && item.imageDimensions !== null
        ? (item.imageDimensions as { width?: number; height?: number })
        : null),
      videoType: asStringOrNull(item.videoType),
      hidden: Boolean(item.hidden),
      position: asNumber(item.position, index)
    };
  });
  const galleryImages = media.filter((entry) => entry.mediaKind === 'image' && entry.role === 'gallery');
  for (const variant of variants) {
    variant.imageAssignments = galleryImages.flatMap((mediaEntry, slotIndex) =>
      mediaEntry.variantIds.includes(variant.id) ? [slotIndex] : []
    );
  }
  const quantityDiscounts = quantityDiscountsJson.map((entry, index) =>
    normalizeQuantityDiscountRule(entry as Record<string, unknown>, index)
  );
  const productType = requireCatalogEditorProductType(row.editor_product_type);
  const machineSerialOrderMatchSkus = productType === 'unique_machine'
    ? [
        asStringOrNull(row.sku),
        ...variants.map((variant) => variant.variantSku)
      ].filter((entry): entry is string => Boolean(entry?.trim()))
    : [];
  const machineSerialOrderMatches = machineSerialOrderMatchSkus.length > 0
    ? await fetchOrderItemAllocationsForSkus(machineSerialOrderMatchSkus)
    : [];

  return {
    id: asNumber(row.id),
    updatedAt: row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : String(row.updated_at ?? ''),
    itemName: String(row.item_name ?? ''),
    itemType: String(row.item_type ?? 'unit') as CatalogItemType,
    productType,
    typeSpecificData: normalizeTypeSpecificData(row.type_specific_data),
    badge: asStringOrNull(row.badge),
    status: normalizeCatalogItemLifecycleState(row.status),
    statusBeforeDelete: row.status_before_delete === null ? null : normalizeActiveState(row.status_before_delete),
    deletedAt: row.deleted_at instanceof Date ? row.deleted_at.toISOString() : asStringOrNull(row.deleted_at),
    purgeAfter: row.purge_after instanceof Date ? row.purge_after.toISOString() : asStringOrNull(row.purge_after),
    categoryPath: Array.isArray(row.category_path) ? row.category_path.map((entry) => String(entry)) : [],
    sku: asStringOrNull(row.sku),
    slug: String(row.slug ?? ''),
    unit: asStringOrNull(row.unit),
    brand: asStringOrNull(row.brand),
    material: asStringOrNull(row.material),
    colour: asStringOrNull(row.colour),
    shape: asStringOrNull(row.shape),
    description: asStringOrNull(row.description),
    adminNotes: asStringOrNull(row.admin_notes),
    taxRate: Math.min(1, Math.max(0, asNumber(row.tax_rate, 0.22))),
    appearanceOverride: normalizeAppearanceOverride(row.appearance_override_json),
    shippingWeightGrams: asNullableNumber(row.shipping_weight_grams),
    shippingLengthMm: asNullableNumber(row.shipping_length_mm),
    shippingWidthMm: asNullableNumber(row.shipping_width_mm),
    shippingHeightMm: asNullableNumber(row.shipping_height_mm),
    position: asNumber(row.position),
    defaultVariantId: row.default_variant_id === null ? null : asNumber(row.default_variant_id),
    optionAxes,
    variants,
    quantityDiscounts,
    media,
    machineSerialOrderMatches
  };
}

export async function quickPatchCatalogItemByIdentifier(
  itemIdentifier: string,
  patch: CatalogItemQuickPatch
): Promise<AdminCatalogListItem | null> {
  const normalizedIdentifier = itemIdentifier.trim();
  if (!normalizedIdentifier) throw new Error('Neveljaven identifikator artikla.');

  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');

    const itemId = await resolveItemIdByIdentifier(client, normalizedIdentifier);
    if (!itemId) {
      await client.query('rollback');
      return null;
    }

    const existingResult = await client.query(
      `
      select id, item_name, sku, status, badge, category_id,
             shipping_weight_grams, shipping_length_mm, shipping_width_mm, shipping_height_mm
      from catalog_items
      where id = $1
      limit 1
      `,
      [itemId]
    );
    const existing = existingResult.rows[0];
    if (!existing) {
      await client.query('rollback');
      return null;
    }

    const nextCategoryId =
      patch.categoryId !== undefined
        ? asStringOrNull(patch.categoryId)
        : patch.categoryPath !== undefined
          ? await resolveCategoryIdByPath(patch.categoryPath, client)
          : asStringOrNull(existing.category_id);
    const nextItemName = patch.itemName !== undefined ? patch.itemName : String(existing.item_name ?? '');
    const nextSku = patch.sku !== undefined ? asStringOrNull(patch.sku) : asStringOrNull(existing.sku);
    const nextStatus = patch.status !== undefined ? patch.status : normalizeActiveState(existing.status);
    const nextItemShipping = normalizeCanonicalShippingMeasurements({}, 'Artikel');

    if (nextCategoryId) {
      const categoryExists = await client.query(
        'select 1 from catalog_categories where id = $1 limit 1',
        [nextCategoryId]
      );
      if (categoryExists.rows.length === 0) {
        throw new CatalogItemValidationError('Izbrana kategorija ne obstaja.');
      }
    }
    if (nextStatus === 'active') {
      await assertCatalogCategoryPathActive(client, nextCategoryId);
      const variantsResult = await client.query(
        `
        select variant_name, variant_sku, price, status,
               shipping_weight_grams, shipping_length_mm, shipping_width_mm, shipping_height_mm
        from catalog_item_variants
        where item_id = $1
        `,
        [itemId]
      );
      assertCatalogItemPublicationReady(
        nextCategoryId,
        nextItemShipping,
        variantsResult.rows.map((variant) => ({
          variantName: variant.variant_name,
          variantSku: variant.variant_sku,
          price: asNumber(variant.price, Number.NaN),
          status: variant.status,
          shippingWeightGrams: asNullableNumber(variant.shipping_weight_grams),
          shippingLengthMm: asNullableNumber(variant.shipping_length_mm),
          shippingWidthMm: asNullableNumber(variant.shipping_width_mm),
          shippingHeightMm: asNullableNumber(variant.shipping_height_mm)
        }))
      );
    }

    await assertCatalogItemIdentityAvailable(client, {
      itemId,
      itemName: nextItemName,
      sku: nextSku
    });

    await client.query(
      `
      update catalog_items
      set item_name = $1,
          sku = $2,
          status = $3,
          badge = $4,
          category_id = $5,
          shipping_weight_grams = $6,
          shipping_length_mm = $7,
          shipping_width_mm = $8,
          shipping_height_mm = $9,
          updated_at = now()
      where id = $10
      `,
      [
        nextItemName,
        nextSku,
        nextStatus,
        patch.badge !== undefined ? asStringOrNull(patch.badge) : asStringOrNull(existing.badge),
        nextCategoryId,
        nextItemShipping.shippingWeightGrams,
        nextItemShipping.shippingLengthMm,
        nextItemShipping.shippingWidthMm,
        nextItemShipping.shippingHeightMm,
        itemId
      ]
    );
    await ensureCatalogDefaultVariantIsUsable(client, itemId);
    if (nextStatus === 'active') {
      await assertPersistedCatalogOptionAssignmentsReady(client, itemId);
    }

    await client.query('commit');
    revalidateTag(CATALOG_PUBLIC_TAG, { expire: 0 });
    return await fetchAdminCatalogListItemByItemId(itemId);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function quickPatchCatalogVariantByIdentifier(
  itemIdentifier: string,
  variantId: number,
  patch: CatalogVariantQuickPatch
): Promise<{ item: AdminCatalogListItem; variant: AdminCatalogVariantSummary } | null> {
  const normalizedIdentifier = itemIdentifier.trim();
  if (!normalizedIdentifier || !Number.isFinite(variantId)) throw new Error('Neveljaven identifikator različice.');

  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');

    const itemId = await resolveItemIdByIdentifier(client, normalizedIdentifier);
    if (!itemId) {
      await client.query('rollback');
      return null;
    }

    const existingResult = await client.query(
      `
      select
        civ.id,
        civ.item_id,
        civ.variant_name,
        civ.variant_sku,
        civ.length,
        civ.width,
        civ.thickness,
        civ.weight,
        civ.shipping_weight_grams,
        civ.shipping_length_mm,
        civ.shipping_width_mm,
        civ.shipping_height_mm,
        civ.error_tolerance,
        civ.price,
        civ.discount_pct,
        civ.inventory,
        civ.min_order,
        civ.status,
        civ.badge,
        civ.position,
        ci.status as item_status,
        ci.category_id,
        ci.shipping_weight_grams as item_shipping_weight_grams,
        ci.shipping_length_mm as item_shipping_length_mm,
        ci.shipping_width_mm as item_shipping_width_mm,
        ci.shipping_height_mm as item_shipping_height_mm
      from catalog_item_variants civ
      join catalog_items ci on ci.id = civ.item_id
      where civ.id = $1 and civ.item_id = $2
      limit 1
      `,
      [variantId, itemId]
    );
    const existing = existingResult.rows[0];
    if (!existing) {
      await client.query('rollback');
      return null;
    }
    const nextVariantSku = patch.variantSku !== undefined ? asStringOrNull(patch.variantSku) : asStringOrNull(existing.variant_sku);
    const nextVariantStatus = patch.status !== undefined ? patch.status : normalizeActiveState(existing.status);
    const nextVariantPrice = patch.price !== undefined ? patch.price : asNumber(existing.price, Number.NaN);
    const nextLength = patch.length !== undefined ? patch.length : asNullableNumber(existing.length);
    const nextWidth = patch.width !== undefined ? patch.width : asNullableNumber(existing.width);
    const nextThickness = patch.thickness !== undefined ? patch.thickness : asNullableNumber(existing.thickness);
    const nextWeight = patch.weight !== undefined ? patch.weight : asNullableNumber(existing.weight);
    const itemShipping = normalizeCanonicalShippingMeasurements({}, 'Artikel');
    const nextVariantShipping = normalizeCanonicalShippingMeasurements(
      deriveCatalogVariantShippingMeasurements({
        weight: nextWeight,
        length: nextLength,
        width: nextWidth,
        thickness: nextThickness
      }),
      `Različica »${String(existing.variant_name ?? '') || variantId}«`
    );

    if (normalizeActiveState(existing.item_status) === 'active') {
      await assertCatalogCategoryPathActive(client, asStringOrNull(existing.category_id));
      const variantsResult = await client.query(
        `
        select id, variant_name, variant_sku, price, status,
               shipping_weight_grams, shipping_length_mm, shipping_width_mm, shipping_height_mm
        from catalog_item_variants
        where item_id = $1
        `,
        [itemId]
      );
      assertCatalogItemPublicationReady(
        asStringOrNull(existing.category_id),
        itemShipping,
        variantsResult.rows.map((variant) => (
          asNumber(variant.id) === variantId
            ? {
                variantName: patch.variantName ?? variant.variant_name,
                variantSku: nextVariantSku,
                price: nextVariantPrice,
                status: nextVariantStatus,
                ...nextVariantShipping
              }
            : {
                variantName: variant.variant_name,
                variantSku: variant.variant_sku,
                price: asNumber(variant.price, Number.NaN),
                status: variant.status,
                shippingWeightGrams: asNullableNumber(variant.shipping_weight_grams),
                shippingLengthMm: asNullableNumber(variant.shipping_length_mm),
                shippingWidthMm: asNullableNumber(variant.shipping_width_mm),
                shippingHeightMm: asNullableNumber(variant.shipping_height_mm)
              }
        ))
      );
    }

    await assertCatalogItemIdentityAvailable(client, {
      itemId,
      variantSkus: [{ sku: nextVariantSku, variantId, label: String(existing.variant_name ?? '') }]
    });

    await client.query(
      `
      update catalog_item_variants
      set variant_name = $1,
          variant_sku = $2,
          length = $3,
          width = $4,
          thickness = $5,
          weight = $6,
          error_tolerance = $7,
          price = $8,
          discount_pct = $9,
          inventory = $10,
          min_order = $11,
          status = $12,
          badge = $13,
          position = $14,
          shipping_weight_grams = $15,
          shipping_length_mm = $16,
          shipping_width_mm = $17,
          shipping_height_mm = $18
      where id = $19
        and item_id = $20
      `,
      [
        patch.variantName !== undefined ? patch.variantName : String(existing.variant_name ?? ''),
        nextVariantSku,
        nextLength,
        nextWidth,
        nextThickness,
        nextWeight,
        patch.errorTolerance !== undefined ? asStringOrNull(patch.errorTolerance) : asStringOrNull(existing.error_tolerance),
        nextVariantPrice,
        patch.discountPct !== undefined ? patch.discountPct : asNumber(existing.discount_pct),
        patch.inventory !== undefined ? patch.inventory : asNumber(existing.inventory),
        patch.minOrder !== undefined ? Math.max(1, patch.minOrder) : Math.max(1, asNumber(existing.min_order, 1)),
        nextVariantStatus,
        patch.badge !== undefined ? asStringOrNull(patch.badge) : asStringOrNull(existing.badge),
        patch.position !== undefined ? Math.max(1, patch.position) : asNumber(existing.position, 1),
        nextVariantShipping.shippingWeightGrams,
        nextVariantShipping.shippingLengthMm,
        nextVariantShipping.shippingWidthMm,
        nextVariantShipping.shippingHeightMm,
        variantId,
        itemId
      ]
    );
    await ensureCatalogDefaultVariantIsUsable(client, itemId);
    if (normalizeActiveState(existing.item_status) === 'active') {
      await assertPersistedCatalogOptionAssignmentsReady(client, itemId);
    }
    await syncSingleVariantEditorPricing(client, itemId, patch, existing);
    await client.query(
      `
      update catalog_items
      set shipping_weight_grams = null,
          shipping_length_mm = null,
          shipping_width_mm = null,
          shipping_height_mm = null,
          updated_at = now()
      where id = $1
      `,
      [itemId]
    );

    await client.query('commit');
    revalidateTag(CATALOG_PUBLIC_TAG, { expire: 0 });
    const item = await fetchAdminCatalogListItemByItemId(itemId);
    if (!item) return null;
    const variant = item.variants.find((entry) => entry.id === variantId);
    if (!variant) return null;
    return { item, variant };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function syncCatalogOptionAxes(
  client: PoolClient,
  itemId: number,
  optionAxes: NonNullable<CatalogItemEditorPayload['optionAxes']>
) {
  const existingAxesResult = await client.query(
    `
    select id
    from catalog_option_axes
    where item_id = $1
    `,
    [itemId]
  );
  const existingAxisIds = new Set(existingAxesResult.rows.map((row) => asNumber(row.id)));
  const retainedAxisIds: number[] = [];

  for (let axisIndex = 0; axisIndex < optionAxes.length; axisIndex += 1) {
    const axis = optionAxes[axisIndex];
    const name = axis.name.trim();
    const slug = axis.slug.trim();
    if (!name || !slug) throw new CatalogItemValidationError('Vsaka izbirna lastnost potrebuje naziv in slug.');
    if (!Array.isArray(axis.values) || axis.values.length === 0) {
      throw new CatalogItemValidationError(`Izbirna lastnost »${name}« potrebuje najmanj eno vrednost.`);
    }

    const requestedAxisId = axis.id && Number.isInteger(axis.id) && axis.id > 0 ? axis.id : null;
    if (requestedAxisId !== null && !existingAxisIds.has(requestedAxisId)) {
      throw new Error(`Izbirna lastnost ${requestedAxisId} ne pripada temu artiklu.`);
    }

    const axisId = requestedAxisId !== null
      ? asNumber((
          await client.query(
            `
            update catalog_option_axes
            set name = $1,
                slug = $2,
                position = $3,
                updated_at = now()
            where id = $4
              and item_id = $5
            returning id
            `,
            [name, slug, axis.position ?? axisIndex, requestedAxisId, itemId]
          )
        ).rows[0]?.id)
      : asNumber((
          await client.query(
            `
            insert into catalog_option_axes (item_id, name, slug, position)
            values ($1,$2,$3,$4)
            returning id
            `,
            [itemId, name, slug, axis.position ?? axisIndex]
          )
        ).rows[0]?.id);

    if (!axisId) throw new Error('Shranjevanje izbirne lastnosti ni uspelo.');
    retainedAxisIds.push(axisId);

    const existingValuesResult = await client.query(
      `
      select id
      from catalog_option_values
      where axis_id = $1
      `,
      [axisId]
    );
    const existingValueIds = new Set(existingValuesResult.rows.map((row) => asNumber(row.id)));
    const retainedValueIds: number[] = [];

    for (let valueIndex = 0; valueIndex < axis.values.length; valueIndex += 1) {
      const optionValue = axis.values[valueIndex];
      const value = optionValue.value.trim();
      const valueSlug = optionValue.slug.trim();
      if (!value || !valueSlug) {
        throw new CatalogItemValidationError(`Vsaka vrednost lastnosti »${name}« potrebuje naziv in slug.`);
      }

      const requestedValueId =
        optionValue.id && Number.isInteger(optionValue.id) && optionValue.id > 0
          ? optionValue.id
          : null;
      if (requestedValueId !== null && !existingValueIds.has(requestedValueId)) {
        throw new Error(`Vrednost ${requestedValueId} ne pripada izbirni lastnosti »${name}«.`);
      }

      const valueId = requestedValueId !== null
        ? asNumber((
            await client.query(
              `
              update catalog_option_values
              set value = $1,
                  slug = $2,
                  swatch = $3,
                  position = $4,
                  updated_at = now()
              where id = $5
                and axis_id = $6
              returning id
              `,
              [value, valueSlug, asStringOrNull(optionValue.swatch), optionValue.position ?? valueIndex, requestedValueId, axisId]
            )
          ).rows[0]?.id)
        : asNumber((
            await client.query(
              `
              insert into catalog_option_values (axis_id, value, slug, swatch, position)
              values ($1,$2,$3,$4,$5)
              returning id
              `,
              [axisId, value, valueSlug, asStringOrNull(optionValue.swatch), optionValue.position ?? valueIndex]
            )
          ).rows[0]?.id);

      if (!valueId) throw new Error('Shranjevanje vrednosti izbirne lastnosti ni uspelo.');
      retainedValueIds.push(valueId);
    }

    if (retainedValueIds.length > 0) {
      await client.query(
        `
        delete from catalog_option_values
        where axis_id = $1
          and not (id = any($2::bigint[]))
        `,
        [axisId, retainedValueIds]
      );
    } else {
      await client.query('delete from catalog_option_values where axis_id = $1', [axisId]);
    }
  }

  if (retainedAxisIds.length > 0) {
    await client.query(
      `
      delete from catalog_option_axes
      where item_id = $1
        and not (id = any($2::bigint[]))
      `,
      [itemId, retainedAxisIds]
    );
  } else {
    await client.query('delete from catalog_option_axes where item_id = $1', [itemId]);
  }
}

async function syncCatalogVariantOptionAssignments(
  client: PoolClient,
  itemId: number,
  variantId: number,
  variant: CatalogItemEditorPayload['variants'][number],
  requireComplete: boolean
) {
  const optionRows = (
    await client.query(
      `
      select
        coa.id as axis_id,
        coa.slug as axis_slug,
        cov.id as value_id,
        cov.slug as value_slug
      from catalog_option_axes coa
      join catalog_option_values cov on cov.axis_id = coa.id
      where coa.item_id = $1
      `,
      [itemId]
    )
  ).rows as Array<Record<string, unknown>>;
  const optionByValueId = new Map<number, { axisId: number; valueId: number }>();
  const optionBySlugs = new Map<string, { axisId: number; valueId: number }>();
  for (const row of optionRows) {
    const option = { axisId: asNumber(row.axis_id), valueId: asNumber(row.value_id) };
    optionByValueId.set(option.valueId, option);
    optionBySlugs.set(`${String(row.axis_slug)}\u0000${String(row.value_slug)}`, option);
  }
  const configuredAxisIds = new Set(optionRows.map((row) => asNumber(row.axis_id)));
  if (configuredAxisIds.size === 0) {
    await client.query('delete from catalog_variant_option_values where variant_id = $1', [variantId]);
    return;
  }
  if (variant.optionValueIds === undefined && variant.optionSelections === undefined) {
    if (requireComplete) {
      throw new CatalogItemValidationError(
        'Vsaka aktivna različica mora imeti izbrano eno vrednost vsake izbirne lastnosti.'
      );
    }
    return;
  }

  const selectedByAxis = new Map<number, number>();
  for (const rawValueId of variant.optionValueIds ?? []) {
    const valueId = asNumber(rawValueId);
    const option = optionByValueId.get(valueId);
    if (!option) throw new CatalogItemValidationError(`Izbirna vrednost ${valueId} ne pripada temu artiklu.`);
    const existingValueId = selectedByAxis.get(option.axisId);
    if (existingValueId !== undefined && existingValueId !== option.valueId) {
      throw new CatalogItemValidationError('Različica ima izbranih več vrednosti iste lastnosti.');
    }
    selectedByAxis.set(option.axisId, option.valueId);
  }
  for (const [axisSlug, valueSlug] of Object.entries(variant.optionSelections ?? {})) {
    const option = optionBySlugs.get(`${axisSlug.trim()}\u0000${valueSlug.trim()}`);
    if (!option) throw new CatalogItemValidationError(`Izbira ${axisSlug}: ${valueSlug} ne pripada temu artiklu.`);
    const existingValueId = selectedByAxis.get(option.axisId);
    if (existingValueId !== undefined && existingValueId !== option.valueId) {
      throw new CatalogItemValidationError('Različica ima izbranih več vrednosti iste lastnosti.');
    }
    selectedByAxis.set(option.axisId, option.valueId);
  }
  if (requireComplete && selectedByAxis.size !== configuredAxisIds.size) {
    throw new CatalogItemValidationError(
      'Vsaka aktivna različica mora imeti izbrano eno vrednost vsake izbirne lastnosti.'
    );
  }

  await client.query('delete from catalog_variant_option_values where variant_id = $1', [variantId]);
  for (const [axisId, optionValueId] of selectedByAxis) {
    await client.query(
      `
      insert into catalog_variant_option_values (variant_id, item_id, axis_id, option_value_id)
      values ($1,$2,$3,$4)
      `,
      [variantId, itemId, axisId, optionValueId]
    );
  }
}

async function assertUniqueCatalogVariantOptionCombinations(
  client: PoolClient,
  itemId: number,
  variantIds: number[]
) {
  if (variantIds.length < 2) return;
  const duplicateResult = await client.query(
    `
    select combination.signature
    from (
      select
        cvov.variant_id,
        string_agg(cvov.option_value_id::text, ',' order by cvov.axis_id) as signature
      from catalog_variant_option_values cvov
      where cvov.item_id = $1
        and cvov.variant_id = any($2::bigint[])
      group by cvov.variant_id
    ) combination
    group by combination.signature
    having count(*) > 1
    limit 1
    `,
    [itemId, variantIds]
  );
  if (duplicateResult.rows.length > 0) {
    throw new CatalogItemValidationError(
      'Vsaka različica mora imeti enolično kombinacijo izbirnih lastnosti.'
    );
  }
}

async function assertPersistedCatalogOptionAssignmentsReady(
  client: PoolClient,
  itemId: number
) {
  const axisCountResult = await client.query(
    'select count(*)::int as count from catalog_option_axes where item_id = $1',
    [itemId]
  );
  const axisCount = asNumber(axisCountResult.rows[0]?.count);
  if (axisCount === 0) return;

  const activeVariantsResult = await client.query(
    `
    select
      civ.id,
      civ.variant_name,
      count(distinct cvov.axis_id)::int as assignment_count
    from catalog_item_variants civ
    left join catalog_variant_option_values cvov on cvov.variant_id = civ.id
    where civ.item_id = $1
      and civ.status = 'active'
    group by civ.id, civ.variant_name
    order by civ.position asc, civ.id asc
    `,
    [itemId]
  );
  const incompleteVariant = activeVariantsResult.rows.find(
    (variant) => asNumber(variant.assignment_count) !== axisCount
  );
  if (incompleteVariant) {
    throw new CatalogItemValidationError(
      `Aktivna različica »${asStringOrNull(incompleteVariant.variant_name) ?? 'brez naziva'}« mora imeti izbrano eno vrednost vsake izbirne lastnosti.`
    );
  }
  await assertUniqueCatalogVariantOptionCombinations(
    client,
    itemId,
    activeVariantsResult.rows.map((variant) => asNumber(variant.id)).filter((id) => id > 0)
  );
}

export async function upsertCatalogItem(inputPayload: CatalogItemEditorPayload): Promise<{ id: number; slug: string; updatedAt: string }> {
  const payload = normalizeCatalogEditorShippingPayload(inputPayload);
  const appearanceOverrideResult = validateAndNormalizeCatalogAppearanceOverride(
    payload.appearanceOverride
  );
  if (!appearanceOverrideResult.ok) {
    throw new CatalogItemValidationError(appearanceOverrideResult.message);
  }
  const normalizedAppearanceOverride = appearanceOverrideResult.value;
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');

    const categoryId = await resolveCategoryIdByPath(payload.categoryPath, client);
    if (payload.status === 'active') {
      assertCatalogItemPublicationReady(categoryId, payload, payload.variants);
      await assertCatalogCategoryPathActive(client, categoryId);
    }
    let effectiveId = payload.id ?? null;
    if (effectiveId === null) {
      const deletedMatch = await client.query(
        `
        select id
        from catalog_items
        where slug = $1
          and status = 'deleted'
        limit 1
        `,
        [payload.slug]
      );
      effectiveId = deletedMatch.rows[0]?.id === undefined ? null : asNumber(deletedMatch.rows[0].id);
    }

    const existingItemResult = effectiveId === null
      ? { rows: [] }
      : await client.query(
          `
          select id, slug, default_variant_id, updated_at
          from catalog_items
          where id = $1
          limit 1
          for update
          `,
          [effectiveId]
        );
    if (effectiveId !== null && existingItemResult.rows.length === 0) {
      throw new Error('Artikel za posodobitev ni bil najden.');
    }
    if (payload.id !== undefined) {
      const expectedUpdatedAt = asIsoTimestamp(payload.expectedUpdatedAt);
      if (!expectedUpdatedAt) {
        throw new CatalogItemValidationError('Manjka različica podatkov artikla. Osvežite stran in poskusite znova.');
      }
      const currentUpdatedAt = asIsoTimestamp(existingItemResult.rows[0]?.updated_at);
      if (!currentUpdatedAt) {
        throw new Error('Različice podatkov artikla ni bilo mogoče preveriti.');
      }
      if (currentUpdatedAt !== expectedUpdatedAt) {
        throw new CatalogItemConcurrencyConflictError(effectiveId as number, currentUpdatedAt);
      }
    }

    const existingVariants = effectiveId === null
      ? []
      : (
          await client.query(
            `
            select id, variant_name, variant_sku, position
            from catalog_item_variants
            where item_id = $1
            order by position asc, id asc
            `,
            [effectiveId]
          )
        ).rows as Array<Record<string, unknown>>;
    const existingVariantById = new Map(existingVariants.map((variant) => [asNumber(variant.id), variant]));
    const claimedVariantIds = new Set<number>();
    const resolvedExistingVariantIds = payload.variants.map((variant, index) => {
      const requestedId =
        variant.id && Number.isInteger(variant.id) && variant.id > 0
          ? variant.id
          : null;
      if (requestedId !== null) {
        if (!existingVariantById.has(requestedId)) {
          throw new CatalogItemValidationError(`Različica ${requestedId} ne pripada temu artiklu.`);
        }
        if (claimedVariantIds.has(requestedId)) {
          throw new CatalogItemValidationError('Ista različica je bila poslana večkrat.');
        }
        claimedVariantIds.add(requestedId);
        return requestedId;
      }

      const normalizedSku = normalizeIdentityComparisonValue(variant.variantSku);
      const skuMatch = normalizedSku
        ? existingVariants.find((entry) =>
            !claimedVariantIds.has(asNumber(entry.id))
            && normalizeIdentityComparisonValue(entry.variant_sku) === normalizedSku
          )
        : undefined;
      const positionMatch = skuMatch ?? existingVariants.find((entry) =>
        !claimedVariantIds.has(asNumber(entry.id))
        && asNumber(entry.position, index) === (variant.position ?? index)
        && normalizeIdentityComparisonValue(entry.variant_name) === normalizeIdentityComparisonValue(variant.variantName)
      );
      if (!positionMatch) return null;

      const matchedId = asNumber(positionMatch.id);
      claimedVariantIds.add(matchedId);
      return matchedId;
    });

    await assertCatalogItemIdentityAvailable(client, {
      itemId: effectiveId,
      itemName: payload.itemName,
      slug: payload.slug,
      sku: payload.sku,
      variantSkus: payload.variants.map((variant, index) => ({
        sku: variant.variantSku,
        variantId: resolvedExistingVariantIds[index],
        label: variant.variantName || `Različica ${index + 1}`
      }))
    });

    const previousSlug = asStringOrNull(existingItemResult.rows[0]?.slug);
    if (effectiveId !== null && previousSlug && previousSlug !== payload.slug) {
      await client.query(
        'delete from catalog_item_slug_aliases where item_id = $1 and slug = $2',
        [effectiveId, payload.slug]
      );
      await client.query(
        `
        insert into catalog_item_slug_aliases (item_id, slug)
        values ($1,$2)
        on conflict (slug) do nothing
        `,
        [effectiveId, previousSlug]
      );
    }

    const itemResult = effectiveId
      ? await client.query(
          `
          update catalog_items
          set item_name = $1,
              item_type = $2,
              badge = $3,
              status = $4,
              category_id = $5,
              sku = $6,
              slug = $7,
              unit = $8,
              brand = $9,
              material = $10,
              colour = $11,
              shape = $12,
              description = $13,
              admin_notes = $14,
              position = $15,
              tax_rate = $16,
              appearance_override_json = $17::jsonb,
              shipping_weight_grams = $18,
              shipping_length_mm = $19,
              shipping_width_mm = $20,
              shipping_height_mm = $21,
              deleted_at = null,
              purge_after = null,
              status_before_delete = null
          where id = $22
          returning id, slug, updated_at
          `,
          [
            payload.itemName,
            payload.itemType,
            asStringOrNull(payload.badge),
            payload.status,
            categoryId,
            asStringOrNull(payload.sku),
            payload.slug,
            asStringOrNull(payload.unit),
            asStringOrNull(payload.brand),
            asStringOrNull(payload.material),
            asStringOrNull(payload.colour),
            asStringOrNull(payload.shape),
            payload.description ?? '',
            asStringOrNull(payload.adminNotes),
            payload.position ?? 0,
            Math.min(1, Math.max(0, payload.taxRate ?? 0.22)),
            serializeJsonbValue(normalizedAppearanceOverride),
            payload.shippingWeightGrams,
            payload.shippingLengthMm,
            payload.shippingWidthMm,
            payload.shippingHeightMm,
            effectiveId
          ]
        )
      : await client.query(
          `
          insert into catalog_items (
            item_name, item_type, badge, status, category_id, sku, slug, unit, brand, material, colour, shape,
            description, admin_notes, position, tax_rate, appearance_override_json,
            shipping_weight_grams, shipping_length_mm, shipping_width_mm, shipping_height_mm
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20,$21)
          returning id, slug, updated_at
          `,
          [
            payload.itemName,
            payload.itemType,
            asStringOrNull(payload.badge),
            payload.status,
            categoryId,
            asStringOrNull(payload.sku),
            payload.slug,
            asStringOrNull(payload.unit),
            asStringOrNull(payload.brand),
            asStringOrNull(payload.material),
            asStringOrNull(payload.colour),
            asStringOrNull(payload.shape),
            payload.description ?? '',
            asStringOrNull(payload.adminNotes),
            payload.position ?? 0,
            Math.min(1, Math.max(0, payload.taxRate ?? 0.22)),
            serializeJsonbValue(normalizedAppearanceOverride),
            payload.shippingWeightGrams,
            payload.shippingLengthMm,
            payload.shippingWidthMm,
            payload.shippingHeightMm
          ]
        );

    const itemRow = itemResult.rows[0] as { id: number; slug: string; updated_at: unknown } | undefined;
    if (!itemRow) throw new Error('Shranjevanje artikla ni uspelo.');

    if (payload.optionAxes !== undefined) {
      await syncCatalogOptionAxes(client, itemRow.id, payload.optionAxes);
    }

    await client.query(
      `
      insert into catalog_item_editor_details (item_id, product_type, data)
      values ($1,$2,$3::jsonb)
      on conflict (item_id) do update
      set product_type = excluded.product_type,
          data = excluded.data,
          updated_at = now()
      `,
      [
        itemRow.id,
        requireCatalogEditorProductType(payload.productType),
        serializeJsonbValue(normalizeTypeSpecificData(payload.typeSpecificData)) ?? '{}'
      ]
    );

    await client.query('delete from catalog_item_quantity_discounts where item_id = $1', [itemRow.id]);
    const quantityDiscounts = payload.quantityDiscounts ?? [];
    for (let index = 0; index < quantityDiscounts.length; index += 1) {
      const discount = normalizeQuantityDiscountRule(quantityDiscounts[index] as Record<string, unknown>, index);
      await client.query(
        `
        insert into catalog_item_quantity_discounts (
          item_id, min_quantity, discount_percent, applies_to, note, position
        ) values ($1,$2,$3,$4,$5,$6)
        `,
        [
          itemRow.id,
          discount.minQuantity,
          discount.discountPercent,
          discount.appliesTo ?? ALL_QUANTITY_DISCOUNT_TARGETS_JSON,
          asStringOrNull(discount.note),
          discount.position ?? index
        ]
      );
    }

    const variantIdByIndex: Array<number | null> = [];
    for (let index = 0; index < payload.variants.length; index += 1) {
      const variant = payload.variants[index];
      const existingVariantId = resolvedExistingVariantIds[index];
      const variantResult = existingVariantId !== null
        ? await client.query(
            `
            update catalog_item_variants
            set variant_name = $1,
                length = $2,
                width = $3,
                thickness = $4,
                weight = $5,
                error_tolerance = $6,
                price = $7,
                cost_net = $8,
                content_override_json = $9::jsonb,
                discount_pct = $10,
                inventory = $11,
                min_order = $12,
                variant_sku = $13,
                unit = $14,
                status = $15,
                badge = $16,
                position = $17,
                shipping_weight_grams = $18,
                shipping_length_mm = $19,
                shipping_width_mm = $20,
                shipping_height_mm = $21,
                updated_at = now()
            where id = $22
              and item_id = $23
            returning id
            `,
            [
              variant.variantName,
              variant.length ?? null,
              variant.width ?? null,
              variant.thickness ?? null,
              variant.weight ?? null,
              asStringOrNull(variant.errorTolerance),
              variant.price,
              variant.costNet ?? null,
              serializeJsonbValue(normalizeVariantContentOverride(variant.contentOverride)),
              variant.discountPct ?? 0,
              variant.inventory ?? 0,
              Math.max(1, variant.minOrder ?? 1),
              asStringOrNull(variant.variantSku),
              asStringOrNull(variant.unit),
              variant.status ?? 'active',
              asStringOrNull(variant.badge),
              variant.position ?? index,
              variant.shippingWeightGrams,
              variant.shippingLengthMm,
              variant.shippingWidthMm,
              variant.shippingHeightMm,
              existingVariantId,
              itemRow.id
            ]
          )
        : await client.query(
            `
            insert into catalog_item_variants (
              item_id, variant_name, length, width, thickness, weight, error_tolerance, price, cost_net,
              content_override_json, discount_pct, inventory, min_order, variant_sku, unit, status, badge, position,
              shipping_weight_grams, shipping_length_mm, shipping_width_mm, shipping_height_mm
            ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
            returning id
            `,
            [
              itemRow.id,
              variant.variantName,
              variant.length ?? null,
              variant.width ?? null,
              variant.thickness ?? null,
              variant.weight ?? null,
              asStringOrNull(variant.errorTolerance),
              variant.price,
              variant.costNet ?? null,
              serializeJsonbValue(normalizeVariantContentOverride(variant.contentOverride)),
              variant.discountPct ?? 0,
              variant.inventory ?? 0,
              Math.max(1, variant.minOrder ?? 1),
              asStringOrNull(variant.variantSku),
              asStringOrNull(variant.unit),
              variant.status ?? 'active',
              asStringOrNull(variant.badge),
              variant.position ?? index,
              variant.shippingWeightGrams,
              variant.shippingLengthMm,
              variant.shippingWidthMm,
              variant.shippingHeightMm
            ]
          );
      const persistedVariantId = asNumber(variantResult.rows[0]?.id);
      if (!persistedVariantId) throw new Error('Shranjevanje različice ni uspelo.');
      variantIdByIndex[index] = persistedVariantId;
      await syncCatalogVariantOptionAssignments(
        client,
        itemRow.id,
        persistedVariantId,
        variant,
        payload.status === 'active' && (variant.status ?? 'active') === 'active'
      );
    }

    const retainedVariantIds = variantIdByIndex.filter((id): id is number => typeof id === 'number' && id > 0);
    const publicVariantIds = variantIdByIndex.filter(
      (id, index): id is number =>
        payload.status === 'active'
        && typeof id === 'number'
        && id > 0
        && (payload.variants[index].status ?? 'active') === 'active'
    );
    await assertUniqueCatalogVariantOptionCombinations(client, itemRow.id, publicVariantIds);
    if (retainedVariantIds.length > 0) {
      await client.query(
        `
        update catalog_items
        set default_variant_id = null
        where id = $1
          and default_variant_id is not null
          and not (default_variant_id = any($2::bigint[]))
        `,
        [itemRow.id, retainedVariantIds]
      );
      await client.query(
        `
        delete from catalog_item_variants
        where item_id = $1
          and not (id = any($2::bigint[]))
        `,
        [itemRow.id, retainedVariantIds]
      );
    } else {
      await client.query('update catalog_items set default_variant_id = null where id = $1', [itemRow.id]);
      await client.query('delete from catalog_item_variants where item_id = $1', [itemRow.id]);
    }

    const currentDefaultVariantId =
      existingItemResult.rows[0]?.default_variant_id === null
      || existingItemResult.rows[0]?.default_variant_id === undefined
        ? null
        : asNumber(existingItemResult.rows[0].default_variant_id);
    const eligibleDefaultVariantIds = payload.status === 'active'
      ? variantIdByIndex.filter(
          (id, index): id is number =>
            typeof id === 'number'
            && id > 0
            && (payload.variants[index].status ?? 'active') === 'active'
        )
      : retainedVariantIds;
    const requestedDefaultVariantId =
      payload.defaultVariantId !== null
      && payload.defaultVariantId !== undefined
      && eligibleDefaultVariantIds.includes(payload.defaultVariantId)
        ? payload.defaultVariantId
        : null;
    const defaultVariantByIndex =
      typeof payload.defaultVariantIndex === 'number'
      && payload.defaultVariantIndex >= 0
        && eligibleDefaultVariantIds.includes(variantIdByIndex[payload.defaultVariantIndex] ?? -1)
        ? variantIdByIndex[payload.defaultVariantIndex] ?? null
        : null;
    const defaultVariantId =
      requestedDefaultVariantId
      ?? defaultVariantByIndex
      ?? (currentDefaultVariantId !== null && eligibleDefaultVariantIds.includes(currentDefaultVariantId)
        ? currentDefaultVariantId
        : eligibleDefaultVariantIds[0] ?? null);
    const finalItemUpdate = await client.query(
      `
      update catalog_items
      set default_variant_id = $1,
          updated_at = greatest(clock_timestamp(), updated_at + interval '1 millisecond')
      where id = $2
      returning updated_at
      `,
      [defaultVariantId, itemRow.id]
    );
    const updatedAt = asIsoTimestamp(finalItemUpdate.rows[0]?.updated_at);
    if (!updatedAt) throw new Error('Različice shranjenega artikla ni bilo mogoče prebrati.');

    const existingMedia = (
      await client.query(
        `
        select id, media_kind, source_kind, blob_url, blob_pathname, external_url
        from catalog_media
        where item_id = $1
        order by id asc
        `,
        [itemRow.id]
      )
    ).rows as Array<Record<string, unknown>>;
    const existingMediaById = new Map(existingMedia.map((entry) => [asNumber(entry.id), entry]));
    const claimedMediaIds = new Set<number>();
    const retainedMediaIds: number[] = [];
    const retainedDocumentIds = new Set<number>();
    const retainedGalleryImageIds: number[] = [];
    const directMediaAssignments: Array<{ variantId: number; mediaId: number; position: number }> = [];
    for (const media of payload.media) {
      const variantId = typeof media.variantIndex === 'number' ? variantIdByIndex[media.variantIndex] ?? null : null;
      const requestedMediaId =
        media.id && Number.isInteger(media.id) && media.id > 0
          ? media.id
          : null;
      if (requestedMediaId !== null && !existingMediaById.has(requestedMediaId)) {
        throw new CatalogItemValidationError(`Medijska datoteka ${requestedMediaId} ne pripada temu artiklu.`);
      }
      const payloadIdentity =
        asStringOrNull(media.blobPathname)
        ?? asStringOrNull(media.blobUrl)
        ?? asStringOrNull(media.externalUrl);
      const identityMatch = requestedMediaId === null && payloadIdentity
        ? existingMedia.find((entry) =>
            !claimedMediaIds.has(asNumber(entry.id))
            && entry.media_kind === media.mediaKind
            && entry.source_kind === media.sourceKind
            && (
              asStringOrNull(entry.blob_pathname)
              ?? asStringOrNull(entry.blob_url)
              ?? asStringOrNull(entry.external_url)
            ) === payloadIdentity
          )
        : undefined;
      const existingMediaId = requestedMediaId ?? (identityMatch ? asNumber(identityMatch.id) : null);
      if (existingMediaId !== null && claimedMediaIds.has(existingMediaId)) {
        throw new CatalogItemValidationError('Ista medijska datoteka je bila poslana večkrat.');
      }

      const mediaResult = existingMediaId !== null
        ? await client.query(
            `
            update catalog_media
            set media_kind = $1,
                role = $2,
                source_kind = $3,
                filename = $4,
                blob_url = $5,
                blob_pathname = $6,
                external_url = $7,
                mime_type = $8,
                alt_text = $9,
                image_type = $10,
                image_dimensions = $11::jsonb,
                video_type = $12,
                hidden = $13,
                position = $14,
                updated_at = now()
            where id = $15
              and item_id = $16
            returning id
            `,
            [
              media.mediaKind,
              media.role,
              media.sourceKind,
              asStringOrNull(media.filename),
              asStringOrNull(media.blobUrl),
              asStringOrNull(media.blobPathname),
              asStringOrNull(media.externalUrl),
              asStringOrNull(media.mimeType),
              asStringOrNull(media.altText),
              asStringOrNull(media.imageType),
              media.imageDimensions ? JSON.stringify(media.imageDimensions) : null,
              asStringOrNull(media.videoType),
              Boolean(media.hidden),
              media.position ?? 0,
              existingMediaId,
              itemRow.id
            ]
          )
        : await client.query(
            `
            insert into catalog_media (
              item_id, media_kind, role, source_kind, filename, blob_url, blob_pathname, external_url, mime_type,
              alt_text, image_type, image_dimensions, video_type, hidden, position
            ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15)
            returning id
            `,
            [
              itemRow.id,
              media.mediaKind,
              media.role,
              media.sourceKind,
              asStringOrNull(media.filename),
              asStringOrNull(media.blobUrl),
              asStringOrNull(media.blobPathname),
              asStringOrNull(media.externalUrl),
              asStringOrNull(media.mimeType),
              asStringOrNull(media.altText),
              asStringOrNull(media.imageType),
              media.imageDimensions ? JSON.stringify(media.imageDimensions) : null,
              asStringOrNull(media.videoType),
              Boolean(media.hidden),
              media.position ?? 0
            ]
          );
      const persistedMediaId = asNumber(mediaResult.rows[0]?.id);
      if (!persistedMediaId) throw new Error('Shranjevanje medijske datoteke ni uspelo.');
      claimedMediaIds.add(persistedMediaId);
      retainedMediaIds.push(persistedMediaId);
      if (media.mediaKind === 'document' && !media.hidden) retainedDocumentIds.add(persistedMediaId);
      if (variantId !== null) {
        directMediaAssignments.push({
          variantId,
          mediaId: persistedMediaId,
          position: media.position ?? 0
        });
      }
      if (media.mediaKind === 'image' && media.role === 'gallery' && !media.hidden) {
        retainedGalleryImageIds.push(persistedMediaId);
      }
    }

    if (retainedMediaIds.length > 0) {
      await client.query(
        `
        delete from catalog_media
        where item_id = $1
          and not (id = any($2::bigint[]))
        `,
        [itemRow.id, retainedMediaIds]
      );
    } else {
      await client.query('delete from catalog_media where item_id = $1', [itemRow.id]);
    }

    await client.query('delete from catalog_variant_media where item_id = $1', [itemRow.id]);
    for (const assignment of directMediaAssignments) {
      await client.query(
        `
        insert into catalog_variant_media (variant_id, item_id, media_id, position)
        values ($1,$2,$3,$4)
        on conflict (variant_id, media_id)
        do update set position = excluded.position
        `,
        [assignment.variantId, itemRow.id, assignment.mediaId, assignment.position]
      );
    }

    for (let variantIndex = 0; variantIndex < payload.variants.length; variantIndex += 1) {
      const variantId = variantIdByIndex[variantIndex];
      if (!variantId) continue;
      const assignedSlots = Array.from(new Set(payload.variants[variantIndex].imageAssignments ?? []));
      for (let position = 0; position < assignedSlots.length; position += 1) {
        const slotIndex = assignedSlots[position];
        if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= retainedGalleryImageIds.length) {
          throw new CatalogItemValidationError(
            `Različica »${payload.variants[variantIndex].variantName || variantIndex + 1}« vsebuje neveljavno dodelitev slike.`
          );
        }
        await client.query(
          `
          insert into catalog_variant_media (variant_id, item_id, media_id, position)
          values ($1,$2,$3,$4)
          on conflict (variant_id, media_id)
          do update set position = excluded.position
          `,
          [variantId, itemRow.id, retainedGalleryImageIds[slotIndex], position]
        );
      }
    }

    for (let index = 0; index < payload.variants.length; index += 1) {
      const variantId = variantIdByIndex[index];
      if (!variantId) continue;
      const contentOverride = normalizeVariantContentOverride(payload.variants[index].contentOverride);
      if (!contentOverride?.documentIds?.length) continue;
      const documentIds = contentOverride.documentIds.filter((documentId) => retainedDocumentIds.has(documentId));
      const nextContentOverride: CatalogVariantContentOverride = { ...contentOverride };
      if (documentIds.length > 0) nextContentOverride.documentIds = documentIds;
      else delete nextContentOverride.documentIds;
      await client.query(
        `
        update catalog_item_variants
        set content_override_json = $1::jsonb,
            updated_at = now()
        where id = $2
          and item_id = $3
        `,
        [
          serializeJsonbValue(Object.keys(nextContentOverride).length > 0 ? nextContentOverride : null),
          variantId,
          itemRow.id
        ]
      );
    }

    await client.query('commit');
    revalidateTag(CATALOG_PUBLIC_TAG, { expire: 0 });
    return { id: itemRow.id, slug: itemRow.slug, updatedAt };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function fetchArchivedCatalogItems(): Promise<ArchivedCatalogItemSummary[]> {
  const pool = await getPool();
  const result = await pool.query(
    `
    with recursive category_paths as (
      select id, parent_id, title, title::text as full_path
      from catalog_categories
      where parent_id is null
      union all
      select category.id, category.parent_id, category.title, parent.full_path || ' / ' || category.title
      from catalog_categories category
      join category_paths parent on parent.id = category.parent_id
    )
    select
      ci.id,
      ci.slug,
      ci.item_name,
      ci.sku,
      ci.status_before_delete,
      ci.deleted_at,
      ci.purge_after,
      coalesce(cp.full_path, '') as category_label,
      coalesce(default_variant.price, 0)::text as price,
      coalesce(default_variant.discount_pct, 0)::text as discount_pct,
      (ci.purge_after <= now()) as can_purge
    from catalog_items ci
    left join category_paths cp on cp.id = ci.category_id
    left join lateral (
      select civ.price, civ.discount_pct
      from catalog_item_variants civ
      where civ.item_id = ci.id
      order by
        case when civ.id = ci.default_variant_id then 0 else 1 end,
        civ.position asc,
        civ.id asc
      limit 1
    ) default_variant on true
    where ci.status = 'deleted'
    order by ci.deleted_at desc, ci.id desc
    `
  );
  return (result.rows as Array<Record<string, unknown>>).map((row) => ({
    id: asNumber(row.id),
    slug: String(row.slug ?? ''),
    itemName: String(row.item_name ?? ''),
    categoryLabel: String(row.category_label ?? ''),
    sku: asStringOrNull(row.sku),
    price: asNumber(row.price),
    discountPct: asNumber(row.discount_pct),
    statusBeforeDelete: row.status_before_delete === null ? null : normalizeActiveState(row.status_before_delete),
    deletedAt: row.deleted_at instanceof Date ? row.deleted_at.toISOString() : String(row.deleted_at ?? ''),
    purgeAfter: row.purge_after instanceof Date ? row.purge_after.toISOString() : String(row.purge_after ?? ''),
    canPurge: Boolean(row.can_purge)
  }));
}

export async function deleteCatalogItemBySlug(slug: string): Promise<boolean> {
  return archiveCatalogItemBySlug(slug);
}

export async function archiveCatalogItemBySlug(slug: string): Promise<boolean> {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) return false;
  const pool = await getPool();
  const result = await pool.query(
    `
    update catalog_items
    set status_before_delete = case when status = 'deleted' then status_before_delete else status end,
        status = 'deleted',
        deleted_at = case when status = 'deleted' then deleted_at else now() end,
        purge_after = case when status = 'deleted' then purge_after else now() + interval '90 days' end,
        updated_at = now()
    where (slug = $1 or id::text = $1)
      and status <> 'deleted'
    returning id
    `,
    [normalizedSlug]
  );
  if ((result.rowCount ?? 0) > 0) {
    revalidateTag(CATALOG_PUBLIC_TAG, { expire: 0 });
    return true;
  }
  return false;
}

export async function restoreCatalogItemBySlug(slug: string): Promise<boolean> {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) return false;
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    const itemResult = await client.query(
      `
      select id, category_id, status_before_delete,
             shipping_weight_grams, shipping_length_mm, shipping_width_mm, shipping_height_mm
      from catalog_items
      where (slug = $1 or id::text = $1)
        and status = 'deleted'
      limit 1
      for update
      `,
      [normalizedSlug]
    );
    const item = itemResult.rows[0] as Record<string, unknown> | undefined;
    if (!item) {
      await client.query('rollback');
      return false;
    }

    const itemId = asNumber(item.id);
    let restoredStatus = normalizeActiveState(item.status_before_delete);
    if (restoredStatus === 'active') {
      try {
        const variantsResult = await client.query(
          `
          select variant_name, variant_sku, price, status,
                 shipping_weight_grams, shipping_length_mm, shipping_width_mm, shipping_height_mm
          from catalog_item_variants
          where item_id = $1
          `,
          [itemId]
        );
        const categoryId = asStringOrNull(item.category_id);
        assertCatalogItemPublicationReady(
          categoryId,
          {
            shippingWeightGrams: asNullableNumber(item.shipping_weight_grams),
            shippingLengthMm: asNullableNumber(item.shipping_length_mm),
            shippingWidthMm: asNullableNumber(item.shipping_width_mm),
            shippingHeightMm: asNullableNumber(item.shipping_height_mm)
          },
          variantsResult.rows.map((variant) => ({
            variantName: variant.variant_name,
            variantSku: variant.variant_sku,
            price: asNumber(variant.price, Number.NaN),
            status: variant.status,
            shippingWeightGrams: asNullableNumber(variant.shipping_weight_grams),
            shippingLengthMm: asNullableNumber(variant.shipping_length_mm),
            shippingWidthMm: asNullableNumber(variant.shipping_width_mm),
            shippingHeightMm: asNullableNumber(variant.shipping_height_mm)
          }))
        );
        await assertCatalogCategoryPathActive(client, categoryId);
        await assertPersistedCatalogOptionAssignmentsReady(client, itemId);
      } catch (error) {
        if (!(error instanceof CatalogItemValidationError)) throw error;
        restoredStatus = 'inactive';
      }
    }

    const result = await client.query(
      `
      update catalog_items
      set status = $1,
          status_before_delete = null,
          deleted_at = null,
          purge_after = null,
          updated_at = now()
      where id = $2
        and status = 'deleted'
      returning id
      `,
      [restoredStatus, itemId]
    );
    await ensureCatalogDefaultVariantIsUsable(client, itemId);
    await client.query('commit');
    if ((result.rowCount ?? 0) > 0) {
      revalidateTag(CATALOG_PUBLIC_TAG, { expire: 0 });
      return true;
    }
    return false;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export type CatalogItemPurgeResult = {
  purged: boolean;
  reason: 'not_found' | 'not_deleted' | 'retention_active' | null;
  purgeAfter: string | null;
};

async function queueCatalogMediaBlobDeletion(
  client: PoolClient,
  itemIds: number[]
) {
  if (itemIds.length === 0) return;
  await client.query(
    `
    with media_targets as (
      select
        cm.item_id,
        coalesce(nullif(cm.blob_pathname, ''), nullif(cm.blob_url, '')) as blob_target
      from catalog_media cm
      where cm.item_id = any($1::bigint[])
        and coalesce(nullif(cm.blob_pathname, ''), nullif(cm.blob_url, '')) is not null
    ),
    deletable_targets as (
      select target.blob_target, min(target.item_id) as source_product_id
      from media_targets target
      where not exists (
        select 1
        from catalog_media retained_media
        where retained_media.item_id <> all($1::bigint[])
          and coalesce(
            nullif(retained_media.blob_pathname, ''),
            nullif(retained_media.blob_url, '')
          ) = target.blob_target
      )
      group by target.blob_target
    )
    insert into archive_blob_deletion_outbox (
      blob_target,
      source_item_type,
      source_product_id
    )
    select blob_target, 'product_media', source_product_id
    from deletable_targets
    on conflict (blob_target) do nothing
    `,
    [itemIds]
  );
}

export async function purgeCatalogItemBySlug(slug: string): Promise<CatalogItemPurgeResult> {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) return { purged: false, reason: 'not_found', purgeAfter: null };
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    const itemResult = await client.query(
      `
      select id, status, purge_after, (purge_after <= now()) as retention_elapsed
      from catalog_items
      where slug = $1
         or id::text = $1
      order by case when slug = $1 then 0 else 1 end
      limit 1
      for update
      `,
      [normalizedSlug]
    );
    const item = itemResult.rows[0] as Record<string, unknown> | undefined;
    if (!item) {
      await client.query('rollback');
      return { purged: false, reason: 'not_found', purgeAfter: null };
    }
    const purgeAfter = item.purge_after instanceof Date
      ? item.purge_after.toISOString()
      : asStringOrNull(item.purge_after);
    if (item.status !== 'deleted') {
      await client.query('rollback');
      return { purged: false, reason: 'not_deleted', purgeAfter };
    }
    if (!Boolean(item.retention_elapsed)) {
      await client.query('rollback');
      return { purged: false, reason: 'retention_active', purgeAfter };
    }

    const itemId = asNumber(item.id);
    await queueCatalogMediaBlobDeletion(client, [itemId]);
    const result = await client.query(
      `
      delete from catalog_items
      where id = $1
        and status = 'deleted'
        and purge_after <= now()
      returning id
      `,
      [itemId]
    );
    const purged = (result.rowCount ?? 0) > 0;
    await client.query('commit');
    if (purged) revalidateTag(CATALOG_PUBLIC_TAG, { expire: 0 });
    return { purged, reason: purged ? null : 'retention_active', purgeAfter };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function purgeExpiredCatalogItems(limit = 100): Promise<number> {
  const normalizedLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    const expiredResult = await client.query(
      `
      select id
      from catalog_items
      where status = 'deleted'
        and purge_after <= now()
      order by purge_after asc, id asc
      limit $1
      for update skip locked
      `,
      [normalizedLimit]
    );
    const itemIds = expiredResult.rows.map((row) => asNumber(row.id)).filter((id) => id > 0);
    if (itemIds.length === 0) {
      await client.query('commit');
      return 0;
    }
    await queueCatalogMediaBlobDeletion(client, itemIds);
    const deleteResult = await client.query(
      `
      delete from catalog_items
      where id = any($1::bigint[])
        and status = 'deleted'
        and purge_after <= now()
      returning id
      `,
      [itemIds]
    );
    await client.query('commit');
    const purgedCount = deleteResult.rowCount ?? 0;
    if (purgedCount > 0) revalidateTag(CATALOG_PUBLIC_TAG, { expire: 0 });
    return purgedCount;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
