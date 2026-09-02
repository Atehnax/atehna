import 'server-only';

import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import {
  SHIPPING_CALCULATION_VERSION,
  SHIPPING_MAX_AMOUNT_CENTS,
  calculateShipping,
  shippingCentsToEuros,
  type ShippingCalculation,
  type ShippingConfiguration,
  type ShippingMeasurement
} from '@/shared/domain/shipping/shipping';
import {
  getBestQuantityDiscount,
  resolveEffectiveOrderDiscount,
  type DiscountKind
} from '@/shared/server/orderQuantityDiscount';
import { isStockEnforcementEnabled } from '@/shared/server/inventoryPolicy';
import { getShippingConfiguration } from '@/shared/server/shipping';

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

const MAX_ORDER_LINES = 100;
const MAX_LINE_QUANTITY = 1_000_000;
const MONEY_SCALE = 100n;
const PERCENT_SCALE = 10_000n;
const DEFAULT_TAX_RATE = 0.22;

// Keep the established wire prefix while making the domain meaning explicit:
// this is an authoritative checkout estimate, not an issued seller offer.
export const ORDER_ESTIMATE_FINGERPRINT_VERSION = 'order-quote-v1' as const;
/** @deprecated Use ORDER_ESTIMATE_FINGERPRINT_VERSION. */
export const ORDER_QUOTE_FINGERPRINT_VERSION =
  ORDER_ESTIMATE_FINGERPRINT_VERSION;

export type OrderSelection = {
  variantId: number;
  quantity: number;
};

export type ManualQuoteCatalogSelection = OrderSelection & {
  catalogItemId: number | null;
  sku: string | null;
};

export type OrderEstimateOptions = {
  lockVariants?: boolean;
  customerLabels?: readonly string[];
  stockEnforcementEnabled?: boolean;
};

export type OrderEstimateIssue = {
  code: string;
  message: string;
  variantId?: number;
  sku?: string;
  minOrder?: number;
  availableStock?: number;
};

export class OrderCommerceError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues: OrderEstimateIssue[];

  constructor(
    status: number,
    code: string,
    message: string,
    issues: OrderEstimateIssue[] = []
  ) {
    super(message);
    this.name = 'OrderCommerceError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

export type AuthoritativeOrderLine = {
  variantId: number;
  productId: number;
  productSlug: string;
  productName: string;
  variantName: string;
  sku: string;
  unit: string | null;
  quantity: number;
  minOrder: number;
  availableStock: number;
  imageUrl: string | null;
  categoryId: string | null;
  categoryPath: string | null;
  attributes: Record<string, string | number>;
  optionAssignments: VariantOptionAssignment[];
  listUnitNet: number;
  baseUnitNet: number;
  discountKind: DiscountKind;
  quantityDiscountPct: number | null;
  discountPct: number;
  discountUnitNet: number;
  unitNet: number;
  unitTax: number;
  unitGross: number;
  lineListNet: number;
  lineDiscountNet: number;
  lineNet: number;
  lineTax: number;
  lineGross: number;
  taxRate: number;
  currency: 'EUR';
  shippingMeasurement: Partial<ShippingMeasurement>;
  snapshot: Record<string, unknown>;
};

export type VariantOptionAssignment = {
  axisId: number;
  axisName: string;
  axisSlug: string;
  valueId: number;
  value: string;
  valueSlug: string;
  swatch: string | null;
};

export type AuthoritativeOrderEstimate = {
  items: AuthoritativeOrderLine[];
  totals: {
    net: number;
    tax: number;
    shipping: number | null;
    gross: number | null;
    currency: 'EUR';
  };
  shipping: ShippingCalculation;
  shippingConfigurationVersion: number;
  quoteFingerprint: string;
  pricingVersion: 'authoritative-net-v1';
};

/** @deprecated Use AuthoritativeOrderEstimate. */
export type AuthoritativeOrderQuote = AuthoritativeOrderEstimate;

/** @deprecated Use OrderEstimateIssue. */
export type OrderQuoteIssue = OrderEstimateIssue;

type CatalogVariantRow = {
  variant_id: string | number;
  product_id: string | number;
  product_slug: string;
  product_name: string;
  product_type: string;
  editor_product_type: string;
  product_status: string;
  product_sku: string | null;
  product_unit: string | null;
  brand: string | null;
  material: string | null;
  colour: string | null;
  shape: string | null;
  catalog_tax_rate: string | number | null;
  category_id: string | null;
  category_path: string | null;
  category_is_active: boolean | null;
  variant_name: string;
  variant_status: string;
  variant_sku: string | null;
  variant_unit: string | null;
  item_shipping_weight_grams: string | number | null;
  item_shipping_length_mm: string | number | null;
  item_shipping_width_mm: string | number | null;
  item_shipping_height_mm: string | number | null;
  variant_shipping_weight_grams: string | number | null;
  variant_shipping_length_mm: string | number | null;
  variant_shipping_width_mm: string | number | null;
  variant_shipping_height_mm: string | number | null;
  length: string | number | null;
  width: string | number | null;
  thickness: string | number | null;
  weight: string | number | null;
  error_tolerance: string | null;
  price: string | number;
  discount_pct: string | number;
  inventory: string | number;
  min_order: string | number;
  badge: string | null;
  image_url: string | null;
  option_assignments: unknown;
  quantity_discounts: unknown;
};

function resolveDefaultTaxRate(): number {
  const configured = Number(process.env.ORDER_DEFAULT_TAX_RATE ?? DEFAULT_TAX_RATE);
  if (!Number.isFinite(configured)) return DEFAULT_TAX_RATE;
  const normalized = configured > 1 ? configured / 100 : configured;
  if (normalized < 0 || normalized > 1) return DEFAULT_TAX_RATE;
  return normalized;
}

export const ORDER_DEFAULT_TAX_RATE = resolveDefaultTaxRate();

function resolveEffectiveTaxRate(value: unknown): number {
  if (value === null || value === undefined || value === '') return ORDER_DEFAULT_TAX_RATE;
  const configured = Number(value);
  if (!Number.isFinite(configured)) return ORDER_DEFAULT_TAX_RATE;
  const normalized = configured > 1 ? configured / 100 : configured;
  return normalized >= 0 && normalized <= 1 ? normalized : ORDER_DEFAULT_TAX_RATE;
}

function parseScaledDecimal(value: unknown, digits: number): bigint {
  const normalized = String(value ?? '0').trim().replace(',', '.');
  const match = normalized.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) {
    throw new OrderCommerceError(500, 'INVALID_CATALOG_PRICE', 'Cena artikla ni veljavna.');
  }

  const sign = match[1] === '-' ? -1n : 1n;
  const fraction = (match[3] ?? '').padEnd(digits, '0').slice(0, digits);
  const scale = 10n ** BigInt(digits);
  return sign * (BigInt(match[2]) * scale + BigInt(fraction || '0'));
}

function roundDivide(value: bigint, divisor: bigint): bigint {
  if (divisor <= 0n) throw new Error('Divisor must be positive.');
  if (value < 0n) return -roundDivide(-value, divisor);
  return (value + divisor / 2n) / divisor;
}

function centsToNumber(value: bigint): number {
  return Number(value) / Number(MONEY_SCALE);
}

function centsToDatabaseValue(value: bigint): string {
  const whole = value / MONEY_SCALE;
  const fraction = (value % MONEY_SCALE).toString().padStart(2, '0');
  return `${whole}.${fraction}`;
}

function asInteger(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

export function normalizeOrderEstimateCustomerLabels(
  labels: readonly unknown[]
): string[] {
  return Array.from(
    new Set(
      labels
        .map((label) => cleanText(label).toLocaleLowerCase('sl-SI'))
        .filter(Boolean)
    )
  ).sort();
}

/** @deprecated Use normalizeOrderEstimateCustomerLabels. */
export const normalizeOrderQuoteCustomerLabels =
  normalizeOrderEstimateCustomerLabels;

function canonicalJson(value: unknown): string {
  const normalize = (candidate: unknown): unknown => {
    if (Array.isArray(candidate)) return candidate.map(normalize);
    if (candidate && typeof candidate === 'object') {
      return Object.keys(candidate as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((result, key) => {
          const nested = (candidate as Record<string, unknown>)[key];
          if (nested !== undefined) result[key] = normalize(nested);
          return result;
        }, {});
    }
    if (typeof candidate === 'number' && Object.is(candidate, -0)) return 0;
    return candidate;
  };

  return JSON.stringify(normalize(value));
}

function orderEstimateFingerprint(input: {
  selections: OrderSelection[];
  customerLabels: string[];
  items: AuthoritativeOrderLine[];
  totals: AuthoritativeOrderEstimate['totals'];
  shipping: ShippingCalculation;
  shippingConfiguration: Omit<ShippingConfiguration, 'draftRules'> | null;
}): string {
  const fingerprintInput = {
    version: ORDER_ESTIMATE_FINGERPRINT_VERSION,
    selections: input.selections.map(({ variantId, quantity }) => ({
      variantId,
      quantity
    })),
    customerContext: {
      labels: input.customerLabels
    },
    catalogContext: input.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      pricing: {
        listUnitNet: item.listUnitNet,
        discountKind: item.discountKind,
        quantityDiscountPct: item.quantityDiscountPct,
        discountPct: item.discountPct,
        unitNet: item.unitNet,
        unitTax: item.unitTax,
        unitGross: item.unitGross,
        lineNet: item.lineNet,
        lineTax: item.lineTax,
        lineGross: item.lineGross,
        taxRate: item.taxRate,
        currency: item.currency
      },
      shippingMeasurement: {
        weightGrams: item.shippingMeasurement.weightGrams ?? null,
        lengthMm: item.shippingMeasurement.lengthMm ?? null,
        widthMm: item.shippingMeasurement.widthMm ?? null,
        heightMm: item.shippingMeasurement.heightMm ?? null
      }
    })),
    shippingConfiguration: input.shippingConfiguration,
    shippingCalculation: input.shipping,
    totals: input.totals,
    pricingVersion: 'authoritative-net-v1'
  };
  const digest = createHash('sha256')
    .update(canonicalJson(fingerprintInput))
    .digest('hex');
  return `${ORDER_ESTIMATE_FINGERPRINT_VERSION}:${digest}`;
}

function buildShippingMeasurement(
  row: CatalogVariantRow
): Partial<ShippingMeasurement> {
  const value = (variantValue: unknown, itemValue: unknown) =>
    optionalNumber(variantValue) ?? optionalNumber(itemValue) ?? undefined;
  return {
    weightGrams: value(
      row.variant_shipping_weight_grams,
      row.item_shipping_weight_grams
    ),
    lengthMm: value(
      row.variant_shipping_length_mm,
      row.item_shipping_length_mm
    ),
    widthMm: value(
      row.variant_shipping_width_mm,
      row.item_shipping_width_mm
    ),
    heightMm: value(
      row.variant_shipping_height_mm,
      row.item_shipping_height_mm
    )
  };
}

export function parseOrderSelections(rawItems: unknown): OrderSelection[] {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new OrderCommerceError(
      400,
      'ORDER_ITEMS_REQUIRED',
      'Naročilo mora vsebovati vsaj en artikel.'
    );
  }
  if (rawItems.length > MAX_ORDER_LINES) {
    throw new OrderCommerceError(
      400,
      'TOO_MANY_ORDER_LINES',
      `Naročilo lahko vsebuje največ ${MAX_ORDER_LINES} postavk.`
    );
  }

  const quantityByVariant = new Map<number, number>();
  rawItems.forEach((rawItem, index) => {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      throw new OrderCommerceError(
        400,
        'INVALID_ORDER_ITEM',
        `Postavka ${index + 1} ni veljavna.`
      );
    }

    const item = rawItem as Record<string, unknown>;
    const variantId = Number(item.variantId);
    const quantity = Number(item.quantity);

    if (!Number.isSafeInteger(variantId) || variantId <= 0) {
      throw new OrderCommerceError(
        400,
        'VARIANT_ID_REQUIRED',
        `Postavka ${index + 1} nima veljavnega ID-ja različice.`
      );
    }
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
      throw new OrderCommerceError(
        400,
        'INVALID_QUANTITY',
        `Količina postavke ${index + 1} mora biti celo število med 1 in ${MAX_LINE_QUANTITY}.`
      );
    }

    const combinedQuantity = (quantityByVariant.get(variantId) ?? 0) + quantity;
    if (combinedQuantity > MAX_LINE_QUANTITY) {
      throw new OrderCommerceError(
        400,
        'INVALID_QUANTITY',
        `Skupna količina različice ${variantId} je previsoka.`
      );
    }
    quantityByVariant.set(variantId, combinedQuantity);
  });

  return Array.from(quantityByVariant.entries())
    .map(([variantId, quantity]) => ({ variantId, quantity }))
    .sort((left, right) => left.variantId - right.variantId);
}

function parseOptionAssignments(value: unknown): VariantOptionAssignment[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((rawValue) => {
    if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) return [];
    const raw = rawValue as Record<string, unknown>;
    const axisId = Number(raw.axisId);
    const valueId = Number(raw.valueId);
    const axisName = cleanText(raw.axisName);
    const axisSlug = cleanText(raw.axisSlug);
    const optionValue = cleanText(raw.value);
    const valueSlug = cleanText(raw.valueSlug);
    if (
      !Number.isSafeInteger(axisId) ||
      axisId <= 0 ||
      !Number.isSafeInteger(valueId) ||
      valueId <= 0 ||
      !axisName ||
      !axisSlug ||
      !optionValue ||
      !valueSlug
    ) {
      return [];
    }
    return [{
      axisId,
      axisName,
      axisSlug,
      valueId,
      value: optionValue,
      valueSlug,
      swatch: cleanText(raw.swatch) || null
    }];
  });
}

function buildAttributes(
  row: CatalogVariantRow,
  optionAssignments: VariantOptionAssignment[]
): Record<string, string | number> {
  const attributes: Record<string, string | number> = {};
  const candidates: Array<[string, unknown]> = [
    ['length', row.length],
    ['width', row.width],
    ['thickness', row.thickness],
    ['weight', row.weight],
    ['errorTolerance', row.error_tolerance],
    ['brand', row.brand],
    ['material', row.material],
    ['colour', row.colour],
    ['shape', row.shape],
    ['badge', row.badge]
  ];

  candidates.forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    const numeric = optionalNumber(value);
    attributes[key] = numeric ?? String(value);
  });

  optionAssignments.forEach((assignment) => {
    const preferredKey = assignment.axisName;
    const attributeKey = Object.prototype.hasOwnProperty.call(attributes, preferredKey)
      ? `option:${assignment.axisSlug}`
      : preferredKey;
    attributes[attributeKey] = assignment.value;
  });

  return attributes;
}

function priceLine(
  row: CatalogVariantRow,
  selection: OrderSelection,
  taxRate: number,
  customerLabels: readonly string[]
): AuthoritativeOrderLine {
  const listUnitNetCents = parseScaledDecimal(row.price, 2);
  const variantDiscountBasisPoints = parseScaledDecimal(row.discount_pct, 2);
  if (
    listUnitNetCents < 0n ||
    variantDiscountBasisPoints < 0n ||
    variantDiscountBasisPoints > PERCENT_SCALE
  ) {
    throw new OrderCommerceError(
      500,
      'INVALID_CATALOG_PRICE',
      `Cena različice ${selection.variantId} ni veljavna.`
    );
  }

  const sku =
    cleanText(row.variant_sku) ||
    cleanText(row.product_sku) ||
    cleanText(row.product_slug);
  const quantityDiscount = getBestQuantityDiscount(row.quantity_discounts, {
    quantity: selection.quantity,
    sku,
    variantName: row.variant_name,
    customerLabels,
    productType: row.editor_product_type
  });
  const effectiveDiscount = resolveEffectiveOrderDiscount(
    Number(variantDiscountBasisPoints) / 100,
    quantityDiscount
  );
  const discountBasisPoints = parseScaledDecimal(effectiveDiscount.discountPct, 2);

  const unitNetCents = roundDivide(
    listUnitNetCents * (PERCENT_SCALE - discountBasisPoints),
    PERCENT_SCALE
  );
  const discountUnitNetCents = listUnitNetCents - unitNetCents;
  const quantity = BigInt(selection.quantity);
  const lineListNetCents = listUnitNetCents * quantity;
  const lineNetCents = unitNetCents * quantity;
  const lineDiscountNetCents = lineListNetCents - lineNetCents;
  const taxBasisPoints = BigInt(Math.round(taxRate * Number(PERCENT_SCALE)));
  const unitTaxCents = roundDivide(unitNetCents * taxBasisPoints, PERCENT_SCALE);
  const lineTaxCents = roundDivide(lineNetCents * taxBasisPoints, PERCENT_SCALE);
  const unitGrossCents = unitNetCents + unitTaxCents;
  const lineGrossCents = lineNetCents + lineTaxCents;
  const optionAssignments = parseOptionAssignments(row.option_assignments);
  const attributes = buildAttributes(row, optionAssignments);
  const productId = Number(row.product_id);
  const variantId = Number(row.variant_id);
  const unit = cleanText(row.variant_unit) || cleanText(row.product_unit) || null;
  const minOrder = Math.max(1, asInteger(row.min_order));
  const availableStock = Math.max(0, asInteger(row.inventory));
  const shippingMeasurement = buildShippingMeasurement(row);

  const snapshot = {
    productId,
    variantId,
    productSlug: row.product_slug,
    productName: row.product_name,
    productType: row.product_type,
    productStatus: row.product_status,
    variantName: row.variant_name,
    variantStatus: row.variant_status,
    sku,
    unit,
    minOrder,
    availableStock,
    categoryId: row.category_id,
    categoryPath: row.category_path,
    categoryIsActive: row.category_is_active,
    imageUrl: row.image_url,
    attributes,
    optionAssignments,
    shippingMeasurement,
    listUnitNet: centsToNumber(listUnitNetCents),
    discountKind: effectiveDiscount.discountKind,
    quantityDiscountPct: effectiveDiscount.quantityDiscountPct,
    discountPct: Number(discountBasisPoints) / 100,
    unitNet: centsToNumber(unitNetCents),
    unitTax: centsToNumber(unitTaxCents),
    unitGross: centsToNumber(unitGrossCents),
    taxRate,
    currency: 'EUR'
  };

  return {
    variantId,
    productId,
    productSlug: row.product_slug,
    productName: row.product_name,
    variantName: row.variant_name,
    sku,
    unit,
    quantity: selection.quantity,
    minOrder,
    availableStock,
    imageUrl: row.image_url ? String(row.image_url) : null,
    categoryId: row.category_id ? String(row.category_id) : null,
    categoryPath: row.category_path ? String(row.category_path) : null,
    attributes,
    optionAssignments,
    shippingMeasurement,
    listUnitNet: centsToNumber(listUnitNetCents),
    baseUnitNet: centsToNumber(listUnitNetCents),
    discountKind: effectiveDiscount.discountKind,
    quantityDiscountPct: effectiveDiscount.quantityDiscountPct,
    discountPct: Number(discountBasisPoints) / 100,
    discountUnitNet: centsToNumber(discountUnitNetCents),
    unitNet: centsToNumber(unitNetCents),
    unitTax: centsToNumber(unitTaxCents),
    unitGross: centsToNumber(unitGrossCents),
    lineListNet: centsToNumber(lineListNetCents),
    lineDiscountNet: centsToNumber(lineDiscountNetCents),
    lineNet: centsToNumber(lineNetCents),
    lineTax: centsToNumber(lineTaxCents),
    lineGross: centsToNumber(lineGrossCents),
    taxRate,
    currency: 'EUR',
    snapshot
  };
}

async function buildAuthoritativeOrderEstimateInternal(
  database: Queryable,
  selections: OrderSelection[],
  options: OrderEstimateOptions | undefined,
  enforceOrderability: boolean
): Promise<AuthoritativeOrderEstimate> {
  const variantIds = selections.map((selection) => selection.variantId);
  const lockClause = options?.lockVariants ? 'for update of civ, ci' : '';
  const customerLabels = normalizeOrderEstimateCustomerLabels(
    options?.customerLabels ?? []
  );
  const stockEnforcementEnabled = enforceOrderability
    ? (options?.stockEnforcementEnabled ??
      (await isStockEnforcementEnabled(database)))
    : false;

  const result = await database.query(
    `
      with recursive category_paths as (
        select
          id,
          parent_id,
          title,
          title::text as full_path,
          (status = 'active') as ancestors_active
        from catalog_categories
        where parent_id is null

        union all

        select
          child.id,
          child.parent_id,
          child.title,
          parent.full_path || ' / ' || child.title,
          parent.ancestors_active and child.status = 'active'
        from catalog_categories child
        join category_paths parent on parent.id = child.parent_id
      )
      select
        civ.id as variant_id,
        ci.id as product_id,
        ci.slug as product_slug,
        ci.item_name as product_name,
        ci.item_type as product_type,
        cied.product_type as editor_product_type,
        ci.status as product_status,
        ci.sku as product_sku,
        ci.unit as product_unit,
        ci.brand,
        ci.material,
        ci.colour,
        ci.shape,
        to_jsonb(ci) ->> 'tax_rate' as catalog_tax_rate,
        ci.category_id,
        cp.full_path as category_path,
        cp.ancestors_active as category_is_active,
        civ.variant_name,
        civ.status as variant_status,
        civ.variant_sku,
        civ.unit as variant_unit,
        ci.shipping_weight_grams as item_shipping_weight_grams,
        ci.shipping_length_mm as item_shipping_length_mm,
        ci.shipping_width_mm as item_shipping_width_mm,
        ci.shipping_height_mm as item_shipping_height_mm,
        civ.shipping_weight_grams as variant_shipping_weight_grams,
        civ.shipping_length_mm as variant_shipping_length_mm,
        civ.shipping_width_mm as variant_shipping_width_mm,
        civ.shipping_height_mm as variant_shipping_height_mm,
        civ.length,
        civ.width,
        civ.thickness,
        civ.weight,
        civ.error_tolerance,
        civ.price,
        civ.discount_pct,
        civ.inventory,
        civ.min_order,
        civ.badge,
        primary_media.image_url,
        variant_options.option_assignments,
        quantity_discount_rules.quantity_discounts
      from catalog_item_variants civ
      join catalog_items ci on ci.id = civ.item_id
      join catalog_item_editor_details cied on cied.item_id = ci.id
      left join category_paths cp on cp.id = ci.category_id
      left join lateral (
        select coalesce(nullif(cm.blob_url, ''), cm.external_url) as image_url
        from catalog_media cm
        where cm.item_id = ci.id
          and cm.media_kind = 'image'
          and cm.role = 'gallery'
          and coalesce(cm.hidden, false) = false
          and (
            exists (
              select 1
              from catalog_variant_media assigned_media
              where assigned_media.media_id = cm.id
                and assigned_media.variant_id = civ.id
            )
            or not exists (
              select 1
              from catalog_variant_media any_assignment
              where any_assignment.media_id = cm.id
            )
          )
          and coalesce(nullif(cm.blob_url, ''), cm.external_url) is not null
        order by
          case when exists (
            select 1
            from catalog_variant_media assigned_media
            where assigned_media.media_id = cm.id
              and assigned_media.variant_id = civ.id
          ) then 0 else 1 end,
          coalesce((
            select assigned_media.position
            from catalog_variant_media assigned_media
            where assigned_media.media_id = cm.id
              and assigned_media.variant_id = civ.id
          ), cm.position) asc,
          cm.id asc
        limit 1
      ) primary_media on true
      left join lateral (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'axisId', coa.id,
              'axisName', coa.name,
              'axisSlug', coa.slug,
              'valueId', cov.id,
              'value', cov.value,
              'valueSlug', cov.slug,
              'swatch', cov.swatch
            )
            order by coa.position asc, coa.id asc, cov.position asc, cov.id asc
          ),
          '[]'::jsonb
        ) as option_assignments
        from catalog_variant_option_values cvov
        join catalog_option_axes coa
          on coa.id = cvov.axis_id
         and coa.item_id = cvov.item_id
        join catalog_option_values cov
          on cov.id = cvov.option_value_id
         and cov.axis_id = cvov.axis_id
        where cvov.variant_id = civ.id
          and cvov.item_id = ci.id
      ) variant_options on true
      left join lateral (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'minQuantity', cqd.min_quantity,
              'discountPercent', cqd.discount_percent,
              'appliesTo', cqd.applies_to
            )
            order by cqd.position asc, cqd.id asc
          ),
          '[]'::jsonb
        ) as quantity_discounts
        from catalog_item_quantity_discounts cqd
        where cqd.item_id = ci.id
      ) quantity_discount_rules on true
      where civ.id = any($1::bigint[])
      order by civ.id asc
      ${lockClause}
    `,
    [variantIds]
  );

  const rowsByVariantId = new Map<number, CatalogVariantRow>(
    (result.rows as CatalogVariantRow[]).map((row) => [Number(row.variant_id), row])
  );
  const issues: OrderEstimateIssue[] = [];

  selections.forEach((selection) => {
    const row = rowsByVariantId.get(selection.variantId);
    if (!row) {
      issues.push({
        code: 'VARIANT_NOT_FOUND',
        message: `Različica ${selection.variantId} ne obstaja.`,
        variantId: selection.variantId
      });
      return;
    }

    if (!enforceOrderability) return;

    if (
      row.product_status !== 'active' ||
      row.variant_status !== 'active' ||
      row.category_id === null ||
      row.category_is_active !== true
    ) {
      issues.push({
        code: 'VARIANT_NOT_AVAILABLE',
        message: `${row.product_name} – ${row.variant_name} trenutno ni na voljo.`,
        variantId: selection.variantId
      });
      return;
    }

    const minOrder = Math.max(1, asInteger(row.min_order));
    const availableStock = Math.max(0, asInteger(row.inventory));
    if (selection.quantity < minOrder) {
      issues.push({
        code: 'MINIMUM_ORDER_NOT_MET',
        message: `Najmanjša količina za ${row.product_name} – ${row.variant_name} je ${minOrder}.`,
        variantId: selection.variantId,
        minOrder,
        availableStock
      });
    }
    if (stockEnforcementEnabled && selection.quantity > availableStock) {
      issues.push({
        code: 'INSUFFICIENT_STOCK',
        message: `Za ${row.product_name} – ${row.variant_name} je na voljo ${availableStock}.`,
        variantId: selection.variantId,
        minOrder,
        availableStock
      });
    }
  });

  if (issues.length > 0) {
    throw new OrderCommerceError(
      409,
      'ORDER_ITEMS_UNAVAILABLE',
      'Nekaterih izbranih artiklov ni mogoče naročiti.',
      issues
    );
  }

  const items = selections.map((selection) => {
    const row = rowsByVariantId.get(selection.variantId)!;
    return priceLine(
      row,
      selection,
      resolveEffectiveTaxRate(row.catalog_tax_rate),
      customerLabels
    );
  });
  const netCents = items.reduce(
    (sum, item) => sum + parseScaledDecimal(item.lineNet, 2),
    0n
  );
  const taxCents = items.reduce(
    (sum, item) => sum + parseScaledDecimal(item.lineTax, 2),
    0n
  );
  const merchandiseSubtotalCents = Number(netCents + taxCents);
  const parcelCount = 1;
  let shippingConfigurationVersion = 1;
  let shippingCalculationConfiguration: Omit<
    ShippingConfiguration,
    'draftRules'
  > | null = null;
  let shipping: ShippingCalculation;
  try {
    const shippingConfiguration = await getShippingConfiguration(database, {
      lockForTransaction: options?.lockVariants === true
    });
    const { draftRules: _draftRules, ...calculationConfiguration } =
      shippingConfiguration;
    shippingCalculationConfiguration = calculationConfiguration;
    shippingConfigurationVersion = shippingConfiguration.version;
    shipping = calculateShipping(
      shippingConfiguration,
      items.map((item) => ({
        productId: String(item.productId),
        variantId: String(item.variantId),
        sku: item.sku,
        name: `${item.productName} – ${item.variantName}`,
        quantity: item.quantity,
        measurement: item.shippingMeasurement
      })),
      { merchandiseSubtotalCents, parcelCount }
    );
  } catch (error) {
    const isDatabaseError =
      typeof error === 'object' &&
      error !== null &&
      typeof (error as { code?: unknown }).code === 'string';
    if (isDatabaseError) {
      throw error;
    }
    const reason =
      'Konfiguracije poštnine trenutno ni mogoče varno uporabiti. Potrebna je ročna ponudba.';
    shipping = {
      status: 'manual_quote',
      calculationVersion: SHIPPING_CALCULATION_VERSION,
      configurationVersion: shippingConfigurationVersion,
      items: items.map((item) => ({
        productId: String(item.productId),
        variantId: String(item.variantId),
        sku: item.sku,
        name: [item.productName, item.variantName].filter(Boolean).join(' - '),
        quantity: item.quantity,
        weightGrams: Number.isFinite(item.shippingMeasurement.weightGrams)
          ? item.shippingMeasurement.weightGrams ?? null
          : null,
        lengthMm: Number.isFinite(item.shippingMeasurement.lengthMm)
          ? item.shippingMeasurement.lengthMm ?? null
          : null,
        widthMm: Number.isFinite(item.shippingMeasurement.widthMm)
          ? item.shippingMeasurement.widthMm ?? null
          : null,
        heightMm: Number.isFinite(item.shippingMeasurement.heightMm)
          ? item.shippingMeasurement.heightMm ?? null
          : null
      })),
      combinedWeightGrams: null,
      largestDimensionMm: null,
      triggeringItem: null,
      reason,
      issues: [{ code: 'INVALID_CONFIGURATION', message: reason }]
    };
  }
  if (
    shipping.status === 'calculated'
    && netCents + taxCents + BigInt(shipping.finalAmountCents) > BigInt(SHIPPING_MAX_AMOUNT_CENTS)
  ) {
    const reason =
      'Skupni znesek naročila presega podprto vrednost. Potrebna je ročna ponudba.';
    shipping = {
      status: 'manual_quote',
      calculationVersion: shipping.calculationVersion,
      configurationVersion: shipping.configurationVersion,
      items: shipping.items,
      combinedWeightGrams: shipping.combinedWeightGrams,
      largestDimensionMm: shipping.largestDimensionMm,
      triggeringItem: shipping.triggeringItem,
      reason,
      issues: [{ code: 'INVALID_CONFIGURATION', message: reason }]
    };
  }
  const shippingAmount =
    shipping.status === 'calculated'
      ? shippingCentsToEuros(shipping.finalAmountCents)
      : null;
  const grossCents =
    shipping.status === 'calculated'
      ? netCents + taxCents + BigInt(shipping.finalAmountCents)
      : null;
  const totals: AuthoritativeOrderEstimate['totals'] = {
    net: centsToNumber(netCents),
    tax: centsToNumber(taxCents),
    shipping: shippingAmount,
    gross: grossCents === null ? null : centsToNumber(grossCents),
    currency: 'EUR'
  };
  const quoteFingerprint = orderEstimateFingerprint({
    selections,
    customerLabels,
    items,
    totals,
    shipping,
    shippingConfiguration: shippingCalculationConfiguration
  });

  return {
    items,
    totals,
    shipping,
    shippingConfigurationVersion: shipping.configurationVersion,
    quoteFingerprint,
    pricingVersion: 'authoritative-net-v1'
  };
}

export async function buildAuthoritativeOrderEstimate(
  database: Queryable,
  selections: OrderSelection[],
  options?: OrderEstimateOptions
): Promise<AuthoritativeOrderEstimate> {
  return buildAuthoritativeOrderEstimateInternal(
    database,
    selections,
    options,
    true
  );
}

/**
 * Loads a locked, canonical catalog snapshot for a non-binding manual quote
 * request. Unlike checkout, intake records the requested quantity even when
 * the item is inactive, below its minimum, or above current stock. It neither
 * reserves stock nor makes the inquiry orderable.
 */
export async function loadAuthoritativeManualQuoteCatalogSnapshot(
  database: Queryable,
  selection: ManualQuoteCatalogSelection,
  options?: { customerLabels?: readonly string[] }
): Promise<AuthoritativeOrderEstimate> {
  const [normalizedSelection] = parseOrderSelections([selection]);
  const estimate = await buildAuthoritativeOrderEstimateInternal(
    database,
    [normalizedSelection],
    { lockVariants: true, customerLabels: options?.customerLabels },
    false
  );
  const item = estimate.items[0];
  if (!item) {
    throw new OrderCommerceError(
      409,
      'CATALOG_SELECTION_MISMATCH',
      'Izbrane kataloške različice ni bilo mogoče preveriti.'
    );
  }
  if (
    selection.catalogItemId !== null
    && item.productId !== selection.catalogItemId
  ) {
    throw new OrderCommerceError(
      409,
      'CATALOG_SELECTION_MISMATCH',
      'Izbrana kataloška različica ne pripada izbranemu artiklu.'
    );
  }
  const expectedSku = cleanText(selection.sku).toLocaleLowerCase('sl-SI');
  if (expectedSku && item.sku.trim().toLocaleLowerCase('sl-SI') !== expectedSku) {
    throw new OrderCommerceError(
      409,
      'CATALOG_SELECTION_MISMATCH',
      'SKU izbrane kataloške različice se je spremenil. Osvežite izbor.'
    );
  }

  item.snapshot = {
    ...item.snapshot,
    manualQuoteIntake: {
      snapshotOnly: true,
      orderabilityEnforced: false,
      minimumOrderMet: selection.quantity >= item.minOrder,
      stockSufficient: selection.quantity <= item.availableStock,
      stockReserved: false
    }
  };
  return estimate;
}

/**
 * Compatibility alias for older callers and `/api/orders/quote`. The returned
 * value is an estimate and must never be persisted as a seller offer.
 */
export async function buildAuthoritativeOrderQuote(
  database: Queryable,
  selections: OrderSelection[],
  options?: OrderEstimateOptions
): Promise<AuthoritativeOrderEstimate> {
  return buildAuthoritativeOrderEstimate(database, selections, options);
}

export function moneyToDatabaseValue(value: number): string {
  return centsToDatabaseValue(parseScaledDecimal(value, 2));
}
