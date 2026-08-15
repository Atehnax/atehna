import 'server-only';

import type { Pool, PoolClient } from 'pg';

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

const MAX_ORDER_LINES = 100;
const MAX_LINE_QUANTITY = 1_000_000;
const MONEY_SCALE = 100n;
const PERCENT_SCALE = 10_000n;
const DEFAULT_TAX_RATE = 0.22;

export type OrderSelection = {
  variantId: number;
  quantity: number;
};

type UnresolvedOrderSelection = {
  variantId: number | null;
  sku: string | null;
  quantity: number;
};

export type OrderQuoteIssue = {
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
  readonly issues: OrderQuoteIssue[];

  constructor(
    status: number,
    code: string,
    message: string,
    issues: OrderQuoteIssue[] = []
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

export type AuthoritativeOrderQuote = {
  items: AuthoritativeOrderLine[];
  totals: {
    net: number;
    tax: number;
    shipping: number;
    gross: number;
    currency: 'EUR';
  };
  pricingVersion: 'authoritative-net-v1';
};

type CatalogVariantRow = {
  variant_id: string | number;
  product_id: string | number;
  product_slug: string;
  product_name: string;
  product_type: string;
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

function parseRawSelections(rawItems: unknown, allowLegacySku: boolean): UnresolvedOrderSelection[] {
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

  return rawItems.map((rawItem, index) => {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      throw new OrderCommerceError(
        400,
        'INVALID_ORDER_ITEM',
        `Postavka ${index + 1} ni veljavna.`
      );
    }

    const item = rawItem as Record<string, unknown>;
    const variantId = Number(item.variantId);
    const sku = allowLegacySku ? cleanText(item.sku) : '';
    const quantity = Number(item.quantity);

    if (
      (!Number.isSafeInteger(variantId) || variantId <= 0) &&
      (!allowLegacySku || !sku)
    ) {
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

    return {
      variantId: Number.isSafeInteger(variantId) && variantId > 0 ? variantId : null,
      sku: sku || null,
      quantity
    };
  });
}

async function resolveLegacySkus(
  database: Queryable,
  selections: UnresolvedOrderSelection[]
): Promise<OrderSelection[]> {
  const unresolvedSkus = Array.from(
    new Set(
      selections
        .filter((selection) => selection.variantId === null)
        .map((selection) => selection.sku!.toLocaleLowerCase('sl-SI'))
    )
  );

  const variantIdsBySku = new Map<string, number[]>();
  if (unresolvedSkus.length > 0) {
    const result = await database.query(
      `
        select
          civ.id,
          lower(trim(coalesce(nullif(civ.variant_sku, ''), nullif(ci.sku, ''), ci.slug))) as resolved_sku
        from catalog_item_variants civ
        join catalog_items ci on ci.id = civ.item_id
        where ci.status = 'active'
          and civ.status = 'active'
          and lower(trim(coalesce(nullif(civ.variant_sku, ''), nullif(ci.sku, ''), ci.slug))) = any($1::text[])
      `,
      [unresolvedSkus]
    );

    (result.rows as Array<{ id: string | number; resolved_sku: string }>).forEach((row) => {
      const key = String(row.resolved_sku);
      const current = variantIdsBySku.get(key) ?? [];
      current.push(Number(row.id));
      variantIdsBySku.set(key, current);
    });
  }

  const resolved = selections.map((selection): OrderSelection => {
    if (selection.variantId !== null) {
      return { variantId: selection.variantId, quantity: selection.quantity };
    }

    const skuKey = selection.sku!.toLocaleLowerCase('sl-SI');
    const matches = variantIdsBySku.get(skuKey) ?? [];
    if (matches.length !== 1) {
      throw new OrderCommerceError(
        409,
        matches.length === 0 ? 'SKU_NOT_AVAILABLE' : 'SKU_AMBIGUOUS',
        matches.length === 0
          ? `Artikel s SKU ${selection.sku} ni na voljo.`
          : `SKU ${selection.sku} ne določa enolične različice.`,
        [{ code: matches.length === 0 ? 'SKU_NOT_AVAILABLE' : 'SKU_AMBIGUOUS', message: selection.sku!, sku: selection.sku! }]
      );
    }
    return { variantId: matches[0], quantity: selection.quantity };
  });

  const quantityByVariant = new Map<number, number>();
  resolved.forEach((selection) => {
    const quantity = (quantityByVariant.get(selection.variantId) ?? 0) + selection.quantity;
    if (quantity > MAX_LINE_QUANTITY) {
      throw new OrderCommerceError(
        400,
        'INVALID_QUANTITY',
        `Skupna količina različice ${selection.variantId} je previsoka.`
      );
    }
    quantityByVariant.set(selection.variantId, quantity);
  });

  return Array.from(quantityByVariant.entries())
    .map(([variantId, quantity]) => ({ variantId, quantity }))
    .sort((left, right) => left.variantId - right.variantId);
}

export async function parseOrderSelections(
  database: Queryable,
  rawItems: unknown,
  options?: { allowLegacySku?: boolean }
): Promise<OrderSelection[]> {
  const unresolved = parseRawSelections(rawItems, options?.allowLegacySku ?? false);
  return resolveLegacySkus(database, unresolved);
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
  taxRate: number
): AuthoritativeOrderLine {
  const listUnitNetCents = parseScaledDecimal(row.price, 2);
  const discountBasisPoints = parseScaledDecimal(row.discount_pct, 2);
  if (listUnitNetCents < 0n || discountBasisPoints < 0n || discountBasisPoints > PERCENT_SCALE) {
    throw new OrderCommerceError(
      500,
      'INVALID_CATALOG_PRICE',
      `Cena različice ${selection.variantId} ni veljavna.`
    );
  }

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
  const sku =
    cleanText(row.variant_sku) ||
    cleanText(row.product_sku) ||
    cleanText(row.product_slug);
  const unit = cleanText(row.variant_unit) || cleanText(row.product_unit) || null;
  const minOrder = Math.max(1, asInteger(row.min_order));
  const availableStock = Math.max(0, asInteger(row.inventory));

  const snapshot = {
    productId,
    variantId,
    productSlug: row.product_slug,
    productName: row.product_name,
    productType: row.product_type,
    variantName: row.variant_name,
    sku,
    unit,
    minOrder,
    availableStock,
    categoryId: row.category_id,
    categoryPath: row.category_path,
    imageUrl: row.image_url,
    attributes,
    optionAssignments,
    listUnitNet: centsToNumber(listUnitNetCents),
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
    listUnitNet: centsToNumber(listUnitNetCents),
    baseUnitNet: centsToNumber(listUnitNetCents),
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

export async function buildAuthoritativeOrderQuote(
  database: Queryable,
  selections: OrderSelection[],
  options?: { lockVariants?: boolean }
): Promise<AuthoritativeOrderQuote> {
  const variantIds = selections.map((selection) => selection.variantId);
  const lockClause = options?.lockVariants ? 'for update of civ, ci' : '';

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
        variant_options.option_assignments
      from catalog_item_variants civ
      join catalog_items ci on ci.id = civ.item_id
      left join category_paths cp on cp.id = ci.category_id
      left join lateral (
        select coalesce(nullif(cm.blob_url, ''), cm.external_url) as image_url
        from catalog_media cm
        where cm.item_id = ci.id
          and cm.media_kind = 'image'
          and cm.role = 'gallery'
          and coalesce(cm.hidden, false) = false
          and (cm.variant_id = civ.id or cm.variant_id is null)
          and coalesce(nullif(cm.blob_url, ''), cm.external_url) is not null
        order by
          case when cm.variant_id = civ.id then 0 else 1 end,
          cm.position asc,
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
      where civ.id = any($1::bigint[])
      ${lockClause}
    `,
    [variantIds]
  );

  const rowsByVariantId = new Map<number, CatalogVariantRow>(
    (result.rows as CatalogVariantRow[]).map((row) => [Number(row.variant_id), row])
  );
  const issues: OrderQuoteIssue[] = [];

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
    if (selection.quantity > availableStock) {
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
    return priceLine(row, selection, resolveEffectiveTaxRate(row.catalog_tax_rate));
  });
  const netCents = items.reduce(
    (sum, item) => sum + parseScaledDecimal(item.lineNet, 2),
    0n
  );
  const taxCents = items.reduce(
    (sum, item) => sum + parseScaledDecimal(item.lineTax, 2),
    0n
  );
  const shippingCents = 0n;
  const grossCents = netCents + taxCents + shippingCents;

  return {
    items,
    totals: {
      net: centsToNumber(netCents),
      tax: centsToNumber(taxCents),
      shipping: centsToNumber(shippingCents),
      gross: centsToNumber(grossCents),
      currency: 'EUR'
    },
    pricingVersion: 'authoritative-net-v1'
  };
}

export function moneyToDatabaseValue(value: number): string {
  return centsToDatabaseValue(parseScaledDecimal(value, 2));
}
