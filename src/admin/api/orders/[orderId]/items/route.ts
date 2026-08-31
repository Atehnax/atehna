import { NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import {
  SHIPPING_MAX_AMOUNT_CENTS,
  calculateShipping,
  shippingCentsToEuros,
  type ShippingCalculation,
  type ShippingMeasurement
} from '@/shared/domain/shipping/shipping';
import { getPool } from '@/shared/server/db';
import { computeOrderLineItemsDiff, countAuditChangedFields, diffHasEntries } from '@/shared/audit/auditDiff';
import type { AuditDiff } from '@/shared/audit/auditTypes';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { isJsonRecord, readRequiredJsonRecord } from '@/shared/server/requestJson';
import { getShippingConfiguration } from '@/shared/server/shipping';
import { SHIPPING_BEARING_ORDER_PDF_TYPES } from '@/shared/domain/order/orderTypes';

type IncomingItem = {
  id?: number;
  catalogItemId?: number;
  catalogVariantId?: number;
  sku: string;
  name: string;
  unit?: string | null;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
};

type CatalogMetadata = {
  catalogItemId: number;
  catalogVariantId: number;
  productSlug: string;
  productName: string;
  variantName: string;
  categoryId: string | null;
  categoryPath: string | null;
  selectedAttributes: Record<string, unknown>;
  imageUrl: string | null;
  shippingMeasurement: Partial<ShippingMeasurement>;
};

type PricedItem = IncomingItem & {
  baseUnitNet: number;
  effectiveUnitNet: number;
  unitTax: number;
  unitGross: number;
  lineNet: number;
  lineTax: number;
  lineGross: number;
};

const FALLBACK_TAX_RATE = 0.22;

const roundAmount = (value: number) => Math.round(value * 100) / 100;

const supportedMoneyCents = (value: number) => {
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents)
    && cents >= 0
    && cents <= SHIPPING_MAX_AMOUNT_CENTS
    ? cents
    : null;
};

const normalizeNumber = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
};

const normalizeOptionalId = (value: unknown) => {
  const parsed = normalizeNumber(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const asNullableText = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const shippingMeasurementValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

function mergeOptionAttributes(
  staticAttributes: Record<string, unknown>,
  rawAssignments: unknown
) {
  const attributes = { ...staticAttributes };
  if (!Array.isArray(rawAssignments)) return attributes;

  rawAssignments.forEach((rawAssignment) => {
    if (
      !rawAssignment ||
      typeof rawAssignment !== 'object' ||
      Array.isArray(rawAssignment)
    ) {
      return;
    }
    const assignment = rawAssignment as Record<string, unknown>;
    const axisName = asNullableText(assignment.axisName);
    const axisSlug = asNullableText(assignment.axisSlug);
    const value = asNullableText(assignment.value);
    if (!axisName || !axisSlug || !value) return;
    const key = Object.prototype.hasOwnProperty.call(attributes, axisName)
      ? `option:${axisSlug}`
      : axisName;
    attributes[key] = value;
  });
  return attributes;
}

function priceItem(item: IncomingItem, taxRate: number): PricedItem {
  const baseUnitNet = roundAmount(item.unitPrice);
  const discountPercentage = roundAmount(item.discountPercentage);
  const effectiveUnitNet = roundAmount(
    baseUnitNet * (1 - discountPercentage / 100)
  );
  const unitTax = roundAmount(effectiveUnitNet * taxRate);
  const lineNet = roundAmount(effectiveUnitNet * item.quantity);
  const lineTax = roundAmount(lineNet * taxRate);
  return {
    ...item,
    discountPercentage,
    baseUnitNet,
    effectiveUnitNet,
    unitTax,
    unitGross: roundAmount(effectiveUnitNet + unitTax),
    lineNet,
    lineTax,
    lineGross: roundAmount(lineNet + lineTax)
  };
}

async function resolveCatalogMetadata(
  client: PoolClient,
  item: IncomingItem
): Promise<CatalogMetadata | null> {
  const result = await client.query(
    `
      with recursive category_paths as (
        select id, parent_id, title, title::text as full_path
        from catalog_categories
        where parent_id is null

        union all

        select child.id, child.parent_id, child.title, parent.full_path || ' / ' || child.title
        from catalog_categories child
        join category_paths parent on parent.id = child.parent_id
      )
      select
        ci.id as catalog_item_id,
        civ.id as catalog_variant_id,
        ci.slug as product_slug,
        ci.item_name as product_name,
        civ.variant_name,
        ci.shipping_weight_grams as item_shipping_weight_grams,
        ci.shipping_length_mm as item_shipping_length_mm,
        ci.shipping_width_mm as item_shipping_width_mm,
        ci.shipping_height_mm as item_shipping_height_mm,
        civ.shipping_weight_grams as variant_shipping_weight_grams,
        civ.shipping_length_mm as variant_shipping_length_mm,
        civ.shipping_width_mm as variant_shipping_width_mm,
        civ.shipping_height_mm as variant_shipping_height_mm,
        ci.category_id,
        cp.full_path as category_path,
        jsonb_strip_nulls(
          jsonb_build_object(
            'length', civ.length,
            'width', civ.width,
            'thickness', civ.thickness,
            'weight', civ.weight,
            'errorTolerance', civ.error_tolerance,
            'brand', ci.brand,
            'material', ci.material,
            'colour', ci.colour,
            'shape', ci.shape
          )
        ) as selected_attributes,
        variant_options.option_assignments,
        (
          select coalesce(nullif(media.blob_url, ''), media.external_url)
          from catalog_media media
          where media.item_id = ci.id
            and media.media_kind = 'image'
            and coalesce(nullif(media.blob_url, ''), media.external_url) is not null
          order by
            case when media.role = 'gallery' then 0 else 1 end,
            media.position asc,
            media.id asc
          limit 1
        ) as image_url
      from catalog_item_variants civ
      join catalog_items ci on ci.id = civ.item_id
      left join category_paths cp on cp.id = ci.category_id
      left join lateral (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'axisName', coa.name,
              'axisSlug', coa.slug,
              'value', cov.value
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
      where civ.id = $1
        and ($2::bigint is null or ci.id = $2)
        and ci.status = 'active'
        and civ.status = 'active'
      order by
        civ.position asc,
        civ.id asc
      limit 2
    `,
    [item.catalogVariantId ?? null, item.catalogItemId ?? null]
  );

  if (result.rows.length !== 1) return null;
  const row = result.rows[0] as Record<string, unknown>;
  return {
    catalogItemId: Number(row.catalog_item_id),
    catalogVariantId: Number(row.catalog_variant_id),
    productSlug: String(row.product_slug ?? ''),
    productName: String(row.product_name ?? item.name),
    variantName: String(row.variant_name ?? ''),
    categoryId: asNullableText(row.category_id),
    categoryPath: asNullableText(row.category_path),
    selectedAttributes: mergeOptionAttributes(
      isJsonRecord(row.selected_attributes) ? row.selected_attributes : {},
      row.option_assignments
    ),
    imageUrl: asNullableText(row.image_url),
    shippingMeasurement: {
      weightGrams: shippingMeasurementValue(
        row.variant_shipping_weight_grams ?? row.item_shipping_weight_grams
      ),
      lengthMm: shippingMeasurementValue(
        row.variant_shipping_length_mm ?? row.item_shipping_length_mm
      ),
      widthMm: shippingMeasurementValue(
        row.variant_shipping_width_mm ?? row.item_shipping_width_mm
      ),
      heightMm: shippingMeasurementValue(
        row.variant_shipping_height_mm ?? row.item_shipping_height_mm
      )
    }
  };
}

function operationalSnapshot(
  item: PricedItem,
  metadata: CatalogMetadata | null,
  taxRate: number,
  currency: string
) {
  return {
    shippingMeasurement: metadata?.shippingMeasurement ?? {},
    operationalEdit: {
      catalogItemId:
        metadata?.catalogItemId ?? (item.id ? item.catalogItemId ?? null : null),
      catalogVariantId:
        metadata?.catalogVariantId ?? (item.id ? item.catalogVariantId ?? null : null),
      productSlug: metadata?.productSlug ?? null,
      productName: metadata?.productName ?? item.name,
      variantName: metadata?.variantName ?? null,
      sku: item.sku,
      unit: item.unit ?? null,
      quantity: item.quantity,
      selectedAttributes: metadata?.selectedAttributes ?? {},
      imageUrl: metadata?.imageUrl ?? null,
      baseUnitNet: item.baseUnitNet,
      discountPct: item.discountPercentage,
      unitNet: item.effectiveUnitNet,
      unitTax: item.unitTax,
      unitGross: item.unitGross,
      lineNet: item.lineNet,
      lineTax: item.lineTax,
      lineGross: item.lineGross,
      taxRate,
      currency
    }
  };
}

export async function POST(request: Request, props: { params: Promise<{ orderId: string }> }) {
  const params = await props.params;
  const orderId = Number(params.orderId);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ message: 'Neveljaven ID naročila.' }, { status: 400 });
  }

  try {
    const bodyResult = await readRequiredJsonRecord(request);
    if (!bodyResult.ok) return bodyResult.response;

    const itemsRaw = Array.isArray(bodyResult.body.items) ? bodyResult.body.items : null;
    if (!itemsRaw || itemsRaw.length === 0) {
      return NextResponse.json(
        { message: 'Naročilo mora vsebovati vsaj eno postavko.' },
        { status: 400 }
      );
    }

    const normalizedItems: IncomingItem[] = itemsRaw.map((rawValue) => {
      const rawItem = isJsonRecord(rawValue) ? rawValue : {};
      return {
        id: normalizeOptionalId(rawItem.id),
        catalogItemId: normalizeOptionalId(rawItem.catalogItemId),
        catalogVariantId: normalizeOptionalId(rawItem.catalogVariantId),
        sku: String(rawItem.sku ?? '').trim(),
        name: String(rawItem.name ?? '').trim(),
        unit:
          typeof rawItem.unit === 'string' && rawItem.unit.trim()
            ? rawItem.unit.trim()
            : null,
        quantity: normalizeNumber(rawItem.quantity),
        unitPrice: normalizeNumber(rawItem.unitPrice),
        discountPercentage: normalizeNumber(rawItem.discountPercentage ?? 0)
      };
    });

    const incomingIds = new Set<number>();
    for (const item of normalizedItems) {
      if (!item.sku || !item.name) {
        return NextResponse.json(
          { message: 'Manjkajo podatki postavke (SKU/ime).' },
          { status: 400 }
        );
      }
      if (!item.catalogVariantId) {
        return NextResponse.json(
          { message: 'Vsaka postavka mora imeti veljaven ID različice kataloga.' },
          { status: 400 }
        );
      }
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
        return NextResponse.json(
          { message: 'Količina mora biti celo število in vsaj 1.' },
          { status: 400 }
        );
      }
      if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
        return NextResponse.json(
          { message: 'Neto cena postavke mora biti veljavna.' },
          { status: 400 }
        );
      }
      if (
        !Number.isFinite(item.discountPercentage) ||
        item.discountPercentage < 0 ||
        item.discountPercentage > 100
      ) {
        return NextResponse.json(
          { message: 'Popust mora biti med 0 in 100 %.' },
          { status: 400 }
        );
      }
      if (item.id) {
        if (incomingIds.has(item.id)) {
          return NextResponse.json(
            { message: 'Ista shranjena postavka je navedena večkrat.' },
            { status: 400 }
          );
        }
        incomingIds.add(item.id);
      }
    }

    const pool = await getPool();
    const client = await pool.connect();
    let responsePayload:
      | {
          subtotal: number;
          tax: number;
          shipping: number;
          automaticShipping: number | null;
          shippingOverrideStale: boolean;
          shippingSource: 'automatic' | 'manual_override' | 'manual_quote';
          shippingManualQuoteReason: string | null;
          total: number;
          pricingRevision: number;
          deliveryPlanRevision: number;
          items: Array<{
            id: number;
            catalogItemId: number | null;
            catalogVariantId: number | null;
            sku: string;
            name: string;
            unit: string | null;
            quantity: number;
            unitPrice: number;
            discountPercentage: number;
          }>;
        }
      | undefined;

    try {
      await client.query('BEGIN');
      const orderBeforeResult = await client.query(
        `
          select
            order_number,
            subtotal,
            tax,
            shipping,
            automatic_shipping,
            shipping_snapshot_json,
            shipping_override_json,
            shipping_override_stale,
            parcel_count,
            total,
            tax_rate,
            currency,
            customer_type,
            commitment_status,
            source_quote_offer_version_id,
            is_draft,
            status,
            payment_status,
            deleted_at
          from orders
          where id = $1
          for update
        `,
        [orderId]
      );
      if (orderBeforeResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ message: 'Naročilo ne obstaja.' }, { status: 404 });
      }

      const order = orderBeforeResult.rows[0] as Record<string, unknown>;
      const parcelCount = Number(order.parcel_count);
      if (!Number.isSafeInteger(parcelCount) || parcelCount < 1) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          {
            code: 'ORDER_PARCEL_COUNT_INVALID',
            message: 'Shranjeno število paketov ni veljavno.'
          },
          { status: 409 }
        );
      }
      const orderStatus = String(order.status ?? 'received');
      const paymentStatus = String(order.payment_status ?? 'unpaid');
      const stateLocked =
        order.deleted_at ||
        ['partially_sent', 'sent', 'finished', 'cancelled'].includes(orderStatus) ||
        ['paid', 'refunded'].includes(paymentStatus);
      if (stateLocked) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          {
            code: 'ORDER_SHIPPING_LOCKED',
            message:
              'Postavk plačanega, povrnjenega, poslanega, zaključenega ali preklicanega naročila ni mogoče spreminjati.'
          },
          { status: 409 }
        );
      }

      const stockHoldResult = await client.query(
        `select 1 from order_stock_holds where order_id = $1 limit 1`,
        [orderId]
      );
      if (
        order.source_quote_offer_version_id !== null ||
        (stockHoldResult.rowCount ?? 0) > 0
      ) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          {
            code: 'ORDER_ITEMS_STOCK_LEDGER_LOCKED',
            message:
              'Postavk naročila z evidentirano zalogo ali izvornim posnetkom ponudbe ni mogoče spreminjati. Za spremembo je potreben ločen popravek z novo sledjo zaloge.'
          },
          { status: 409 }
        );
      }

      const issuedDocumentResult = await client.query(
        `select 1
         from order_documents
         where order_id = $1
           and type = any($2::text[])
           and deleted_at is null
         limit 1`,
        [orderId, [...SHIPPING_BEARING_ORDER_PDF_TYPES]]
      );
      if (issuedDocumentResult.rows.length > 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          {
            code: 'ORDER_SHIPPING_LOCKED',
            message:
              'Postavk naročila z že izdanim dokumentom ni mogoče spreminjati.'
          },
          { status: 409 }
        );
      }

      const parsedTaxRate = normalizeNumber(order.tax_rate);
      const taxRate =
        Number.isFinite(parsedTaxRate) && parsedTaxRate >= 0 && parsedTaxRate <= 1
          ? parsedTaxRate
          : FALLBACK_TAX_RATE;
      const currency = asNullableText(order.currency) ?? 'EUR';
      const pricedItems = normalizedItems.map((item) => priceItem(item, taxRate));
      const subtotal = roundAmount(
        pricedItems.reduce((sum, item) => sum + item.lineNet, 0)
      );
      const tax = roundAmount(
        pricedItems.reduce((sum, item) => sum + item.lineTax, 0)
      );

      const oldItemsResult = await client.query(
        `
          select
            id,
            sku,
            name,
            unit,
            quantity,
            catalog_item_id,
            catalog_variant_id,
            base_unit_net,
            line_net,
            discount_pct
          from order_items
          where order_id = $1
          order by id
          for update
        `,
        [orderId]
      );
      const oldRows = oldItemsResult.rows as Array<Record<string, unknown>>;
      const oldIds = new Set(oldRows.map((row) => Number(row.id)));
      const deliveryPlanMembershipChanged =
        oldRows.length !== pricedItems.length ||
        pricedItems.some((item) => !item.id || !oldIds.has(item.id));
      const invalidPersistedId = pricedItems.find(
        (item) => item.id && !oldIds.has(item.id)
      );
      if (invalidPersistedId?.id) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { message: 'Ena od postavk ne pripada temu naročilu.' },
          { status: 409 }
        );
      }

      const oldRowsById = new Map(
        oldRows.map((row) => [Number(row.id), row])
      );
      const catalogIdentityConflict = pricedItems.find((item) => {
        if (!item.id) return false;
        const oldRow = oldRowsById.get(item.id);
        const persistedItemId = normalizeOptionalId(oldRow?.catalog_item_id);
        const persistedVariantId = normalizeOptionalId(oldRow?.catalog_variant_id);
        return (
          persistedVariantId === null
          || item.catalogVariantId !== persistedVariantId
          || (
            item.catalogItemId !== undefined
            && item.catalogItemId !== persistedItemId
          )
        );
      });
      if (catalogIdentityConflict?.id) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          {
            code: 'ORDER_ITEM_CATALOG_IDENTITY_MISMATCH',
            message:
              'Shranjene postavke ni mogoče povezati z drugo kataloško različico.'
          },
          { status: 409 }
        );
      }

      const metadataInputItems = pricedItems.map((item) => {
        if (!item.id) return item;
        const oldRow = oldRowsById.get(item.id);
        return {
          ...item,
          catalogItemId: normalizeOptionalId(oldRow?.catalog_item_id),
          catalogVariantId: normalizeOptionalId(oldRow?.catalog_variant_id)
        };
      });
      const metadataByInputIndex = await Promise.all(
        metadataInputItems.map((item) => resolveCatalogMetadata(client, item))
      );
      const nextVariantIds = pricedItems.map((item, index) => {
        const oldRow = item.id ? oldRowsById.get(item.id) : undefined;
        return (
          normalizeOptionalId(oldRow?.catalog_variant_id) ??
          metadataByInputIndex[index]?.catalogVariantId ??
          null
        );
      });
      const inventoryAdjustments: Array<{
        variantId: number;
        quantityDelta: number;
      }> = [];

      if (order.is_draft !== true && order.commitment_status === 'binding') {
        const oldVariantQuantities = new Map<number, number>();
        const nextVariantQuantities = new Map<number, number>();
        const addQuantity = (
          quantities: Map<number, number>,
          variantId: number,
          quantity: number
        ) => {
          quantities.set(variantId, (quantities.get(variantId) ?? 0) + quantity);
        };

        for (const row of oldRows) {
          const variantId = normalizeOptionalId(row.catalog_variant_id);
          if (!variantId) {
            await client.query('ROLLBACK');
            return NextResponse.json(
              {
                message:
                  'Zavezujočega naročila z nepovezanimi starejšimi postavkami ni mogoče varno urediti.'
              },
              { status: 409 }
            );
          }
          addQuantity(oldVariantQuantities, variantId, Number(row.quantity));
        }
        for (const [index, item] of pricedItems.entries()) {
          const variantId = nextVariantIds[index];
          if (!variantId) {
            await client.query('ROLLBACK');
            return NextResponse.json(
              {
                message:
                  'Vsaka postavka zavezujočega naročila mora biti povezana z veljavno različico kataloga.'
              },
              { status: 409 }
            );
          }
          addQuantity(nextVariantQuantities, variantId, item.quantity);
        }

        const adjustedVariantIds = Array.from(
          new Set([
            ...oldVariantQuantities.keys(),
            ...nextVariantQuantities.keys()
          ])
        )
          .filter(
            (variantId) =>
              (nextVariantQuantities.get(variantId) ?? 0) !==
              (oldVariantQuantities.get(variantId) ?? 0)
          )
          .sort((left, right) => left - right);

        for (const variantId of adjustedVariantIds) {
          const quantityDelta =
            (nextVariantQuantities.get(variantId) ?? 0) -
            (oldVariantQuantities.get(variantId) ?? 0);
          const stockResult = await client.query(
            `
              with recursive category_paths as (
                select
                  id,
                  parent_id,
                  (status = 'active') as ancestors_active
                from catalog_categories
                where parent_id is null

                union all

                select
                  child.id,
                  child.parent_id,
                  parent.ancestors_active and child.status = 'active'
                from catalog_categories child
                join category_paths parent on parent.id = child.parent_id
              )
              select
                civ.inventory,
                civ.status as variant_status,
                ci.status as product_status,
                ci.category_id,
                cp.ancestors_active as category_is_active
              from catalog_item_variants civ
              join catalog_items ci on ci.id = civ.item_id
              left join category_paths cp on cp.id = ci.category_id
              where civ.id = $1
              for update of civ, ci
            `,
            [variantId]
          );
          const variant = stockResult.rows[0] as
            | {
                inventory: string | number;
                variant_status: string;
                product_status: string;
                category_id: string | null;
                category_is_active: boolean | null;
              }
            | undefined;
          if (!variant) {
            await client.query('ROLLBACK');
            return NextResponse.json(
              {
                message: `Različica ${variantId} ne obstaja več; zaloge ni mogoče varno uskladiti.`,
                code: 'INVENTORY_RECONCILIATION_FAILED',
                variantId
              },
              { status: 409 }
            );
          }

          if (
            quantityDelta > 0 &&
            (
              variant.variant_status !== 'active' ||
              variant.product_status !== 'active' ||
              variant.category_id === null ||
              variant.category_is_active !== true ||
              Number(variant.inventory) < quantityDelta
            )
          ) {
            await client.query('ROLLBACK');
            return NextResponse.json(
              {
                message: `Zaloga različice ${variantId} ne zadošča za spremembo naročila.`,
                code: 'INSUFFICIENT_STOCK',
                variantId,
                requestedQuantity: quantityDelta,
                availableStock: Number(variant.inventory)
              },
              { status: 409 }
            );
          }

          const inventoryResult =
            quantityDelta > 0
              ? await client.query(
                  `
                    update catalog_item_variants
                    set inventory = inventory - $1,
                        updated_at = now()
                    where id = $2
                      and inventory >= $1
                  `,
                  [quantityDelta, variantId]
                )
              : await client.query(
                  `
                    update catalog_item_variants
                    set inventory = inventory + $1,
                        updated_at = now()
                    where id = $2
                  `,
                  [-quantityDelta, variantId]
                );
          if (inventoryResult.rowCount !== 1) {
            await client.query('ROLLBACK');
            return NextResponse.json(
              {
                message: `Zaloge različice ${variantId} ni bilo mogoče varno uskladiti.`,
                code: 'INVENTORY_RECONCILIATION_CONFLICT',
                variantId
              },
              { status: 409 }
            );
          }
          inventoryAdjustments.push({ variantId, quantityDelta });
        }
      }

      const savedItems: NonNullable<typeof responsePayload>['items'] = [];

      for (const [index, item] of pricedItems.entries()) {
        const metadata = metadataByInputIndex[index];
        const snapshotPatch = JSON.stringify(
          operationalSnapshot(item, metadata, taxRate, currency)
        );
        let savedRow: Record<string, unknown>;

        if (item.id) {
          const updateResult = await client.query(
            `
              update order_items
              set
                sku = $1,
                name = $2,
                unit = $3,
                quantity = $4,
                catalog_item_id = coalesce(catalog_item_id, $7),
                catalog_variant_id = coalesce(catalog_variant_id, $8),
                product_slug = coalesce(product_slug, $9),
                variant_name = coalesce(variant_name, $10),
                category_id = coalesce(category_id, $11),
                category_path = coalesce(category_path, $12),
                selected_attributes = case
                  when coalesce(selected_attributes, '{}'::jsonb) = '{}'::jsonb
                    then $13::jsonb
                  else selected_attributes
                end,
                image_url = coalesce(image_url, $14),
                base_unit_net = $15,
                discount_pct = $16,
                unit_net = $5,
                unit_tax = $17,
                unit_gross = $18,
                line_net = $6,
                line_tax = $19,
                line_gross = $20,
                tax_rate = $21,
                currency = $22,
                product_snapshot_json =
                  coalesce(product_snapshot_json, '{}'::jsonb) || $23::jsonb
              where id = $24 and order_id = $25
              returning id, catalog_item_id, catalog_variant_id
            `,
            [
              item.sku,
              item.name,
              item.unit,
              item.quantity,
              item.effectiveUnitNet,
              item.lineNet,
              metadata?.catalogItemId ?? null,
              metadata?.catalogVariantId ?? null,
              metadata?.productSlug ?? null,
              metadata?.variantName ?? null,
              metadata?.categoryId ?? null,
              metadata?.categoryPath ?? null,
              JSON.stringify(metadata?.selectedAttributes ?? {}),
              metadata?.imageUrl ?? null,
              item.baseUnitNet,
              item.discountPercentage,
              item.unitTax,
              item.unitGross,
              item.lineTax,
              item.lineGross,
              taxRate,
              currency,
              snapshotPatch,
              item.id,
              orderId
            ]
          );
          savedRow = updateResult.rows[0] as Record<string, unknown>;
        } else {
          const insertResult = await client.query(
            `
              insert into order_items (
                order_id,
                sku,
                name,
                unit,
                quantity,
                catalog_item_id,
                catalog_variant_id,
                product_slug,
                variant_name,
                category_id,
                category_path,
                selected_attributes,
                image_url,
                base_unit_net,
                discount_pct,
                unit_net,
                unit_tax,
                unit_gross,
                line_net,
                line_tax,
                line_gross,
                tax_rate,
                currency,
                product_snapshot_json
              )
              values (
                $1, $2, $3, $4, $5, $8, $9, $10, $11, $12, $13,
                $14::jsonb, $15, $16, $17, $6, $18, $19, $7, $20, $21, $22,
                $23, $24::jsonb
              )
              returning id, catalog_item_id, catalog_variant_id
            `,
            [
              orderId,
              item.sku,
              item.name,
              item.unit,
              item.quantity,
              item.effectiveUnitNet,
              item.lineNet,
              metadata?.catalogItemId ?? null,
              metadata?.catalogVariantId ?? null,
              metadata?.productSlug ?? null,
              metadata?.variantName ?? null,
              metadata?.categoryId ?? null,
              metadata?.categoryPath ?? null,
              JSON.stringify(metadata?.selectedAttributes ?? {}),
              metadata?.imageUrl ?? null,
              item.baseUnitNet,
              item.discountPercentage,
              item.unitTax,
              item.unitGross,
              item.lineTax,
              item.lineGross,
              taxRate,
              currency,
              snapshotPatch
            ]
          );
          savedRow = insertResult.rows[0] as Record<string, unknown>;
        }

        savedItems.push({
          id: Number(savedRow.id),
          catalogItemId:
            normalizeOptionalId(savedRow.catalog_item_id) ?? null,
          catalogVariantId:
            normalizeOptionalId(savedRow.catalog_variant_id) ?? null,
          sku: item.sku,
          name: item.name,
          unit: item.unit ?? null,
          quantity: item.quantity,
          unitPrice: item.baseUnitNet,
          discountPercentage: item.discountPercentage
        });
      }

      const savedItemIds = savedItems.map((item) => item.id);
      await client.query(
        `
          delete from order_items
          where order_id = $1
            and not (id = any($2::bigint[]))
        `,
        [orderId, savedItemIds]
      );

      const oldItems = oldRows.map((row) => ({
        id: row.id,
        sku: row.sku,
        name: row.name,
        unit: row.unit,
        quantity: Number(row.quantity ?? 0),
        unitPrice: Number(row.base_unit_net ?? 0),
        discountPercentage: Number(row.discount_pct ?? 0),
        totalPrice: Number(row.line_net ?? 0)
      }));
      const newItems = savedItems.map((item, index) => ({
        ...item,
        totalPrice: pricedItems[index].lineNet
      }));
      const itemDiff = computeOrderLineItemsDiff(oldItems, newItems);
      if (itemDiff) {
        await client.query(
          'delete from order_line_snapshots where order_id = $1',
          [orderId]
        );
        await client.query(
          `
            insert into order_line_snapshots (
              order_id,
              order_item_id,
              line_number,
              catalog_item_id,
              catalog_variant_id,
              product_slug,
              product_name,
              variant_name,
              sku,
              unit,
              quantity,
              category_id,
              category_path,
              selected_attributes,
              image_url,
              base_unit_net,
              discount_pct,
              unit_net,
              unit_tax,
              unit_gross,
              line_net,
              line_tax,
              line_gross,
              tax_rate,
              currency,
              snapshot_json
            )
            select
              order_line.order_id,
              order_line.id,
              selected.line_number::integer,
              order_line.catalog_item_id,
              order_line.catalog_variant_id,
              coalesce(nullif(order_line.product_slug, ''), 'order-item'),
              coalesce(
                nullif(order_line.product_snapshot_json #>> '{operationalEdit,productName}', ''),
                nullif(order_line.name, ''),
                'Artikel'
              ),
              coalesce(
                nullif(order_line.variant_name, ''),
                nullif(order_line.product_snapshot_json #>> '{operationalEdit,variantName}', ''),
                ''
              ),
              order_line.sku,
              order_line.unit,
              order_line.quantity,
              order_line.category_id,
              order_line.category_path,
              coalesce(order_line.selected_attributes, '{}'::jsonb),
              order_line.image_url,
              order_line.base_unit_net,
              order_line.discount_pct,
              order_line.unit_net,
              order_line.unit_tax,
              order_line.unit_gross,
              order_line.line_net,
              order_line.line_tax,
              order_line.line_gross,
              order_line.tax_rate,
              order_line.currency,
              coalesce(order_line.product_snapshot_json, '{}'::jsonb)
            from unnest($2::bigint[]) with ordinality
              as selected(order_item_id, line_number)
            join order_items order_line
              on order_line.id = selected.order_item_id
             and order_line.order_id = $1
            order by selected.line_number
          `,
          [orderId, savedItemIds]
        );
      }
      const hasShippingOverride = isJsonRecord(order.shipping_override_json);
      let shipping = normalizeNumber(order.shipping);
      if (!Number.isFinite(shipping) || shipping < 0) {
        throw new Error('Shranjena poštnina naročila ni veljavna.');
      }
      let automaticShipping =
        order.automatic_shipping === null || order.automatic_shipping === undefined
          ? null
          : normalizeNumber(order.automatic_shipping);
      let shippingSnapshot: Record<string, unknown> = isJsonRecord(
        order.shipping_snapshot_json
      )
        ? order.shipping_snapshot_json
        : {};
      let shippingOverrideStale = Boolean(order.shipping_override_stale);
      let shippingCalculation: ShippingCalculation | null = null;
      const subtotalCents = supportedMoneyCents(subtotal);
      const taxCents = supportedMoneyCents(tax);
      const merchandiseSubtotalCents =
        subtotalCents === null || taxCents === null
          ? null
          : subtotalCents + taxCents;
      if (
        merchandiseSubtotalCents === null
        || !Number.isSafeInteger(merchandiseSubtotalCents)
        || merchandiseSubtotalCents > SHIPPING_MAX_AMOUNT_CENTS
      ) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          {
            code: 'ORDER_MERCHANDISE_SUBTOTAL_OUT_OF_RANGE',
            message: 'Vrednost blaga presega podprto denarno območje.'
          },
          { status: 409 }
        );
      }

      if (itemDiff) {
        try {
          const shippingConfiguration = await getShippingConfiguration(client, {
            lockForTransaction: true
          });
          shippingCalculation = calculateShipping(
            shippingConfiguration,
            pricedItems.map((item, index) => ({
              productId: String(metadataByInputIndex[index]?.catalogItemId ?? item.catalogItemId ?? ''),
              variantId: String(metadataByInputIndex[index]?.catalogVariantId ?? item.catalogVariantId ?? ''),
              sku: item.sku,
              name: item.name,
              quantity: item.quantity,
              measurement: metadataByInputIndex[index]?.shippingMeasurement ?? null
            })),
            { merchandiseSubtotalCents, parcelCount }
          );
        } catch (error) {
          const isDatabaseError =
            typeof error === 'object' &&
            error !== null &&
            typeof (error as { code?: unknown }).code === 'string';
          if (isDatabaseError) throw error;
          await client.query('ROLLBACK');
          return NextResponse.json(
            {
              code: 'SHIPPING_MANUAL_QUOTE_REQUIRED',
              message:
                'Poštnine po spremembi postavk ni mogoče varno izračunati. Potrebna je ročna ponudba.'
            },
            { status: 409 }
          );
        }
        if (shippingCalculation.status !== 'calculated') {
          if (hasShippingOverride) {
            automaticShipping = null;
            shippingSnapshot = shippingCalculation;
            shippingOverrideStale = true;
          } else if (order.is_draft === true) {
            // A draft must be able to retain the complete item and calculation
            // snapshots before an administrator can supply the required quote.
            // The zero is only a non-operational database placeholder: draft
            // finalization and all shipping-bearing output remain readiness-gated.
            shipping = 0;
            automaticShipping = null;
            shippingSnapshot = shippingCalculation;
            shippingOverrideStale = false;
          } else {
            await client.query('ROLLBACK');
            return NextResponse.json(
              {
                code: 'SHIPPING_MANUAL_QUOTE_REQUIRED',
                message: shippingCalculation.reason,
                shipping: shippingCalculation
              },
              { status: 409 }
            );
          }
        } else {
          automaticShipping = shippingCentsToEuros(
            shippingCalculation.automaticAmountCents
          );
          shippingSnapshot = shippingCalculation;
          if (hasShippingOverride) {
            shippingOverrideStale = true;
          } else {
            shipping = shippingCentsToEuros(shippingCalculation.finalAmountCents);
            shippingOverrideStale = false;
          }
        }
      }

      const shippingCents = supportedMoneyCents(shipping);
      const totalCents =
        subtotalCents === null || taxCents === null || shippingCents === null
          ? null
          : subtotalCents + taxCents + shippingCents;
      if (
        totalCents === null
        || !Number.isSafeInteger(totalCents)
        || totalCents > SHIPPING_MAX_AMOUNT_CENTS
      ) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          {
            code: 'ORDER_TOTAL_OUT_OF_RANGE',
            message: 'Skupni znesek naročila presega podprto denarno območje.'
          },
          { status: 409 }
        );
      }

      const total = totalCents / 100;
      const pricingUpdateResult = await client.query(
        `
          update orders
          set subtotal = $1,
              tax = $2,
              shipping = $3,
              automatic_shipping = $4,
              shipping_snapshot_json = $5::jsonb,
              shipping_override_stale = $6,
              total = $7,
              pricing_revision = pricing_revision + case when $8 then 1 else 0 end,
              delivery_plan_revision = delivery_plan_revision + case when $9 then 1 else 0 end
          where id = $10
          returning pricing_revision, delivery_plan_revision
        `,
        [
          subtotal,
          tax,
          shipping,
          automaticShipping,
          JSON.stringify(shippingSnapshot),
          shippingOverrideStale,
          total,
          Boolean(itemDiff),
          deliveryPlanMembershipChanged,
          orderId
        ]
      );
      const pricingRevision = Number(
        pricingUpdateResult.rows[0]?.pricing_revision
      );
      if (!Number.isSafeInteger(pricingRevision) || pricingRevision < 1) {
        throw new Error('Shranjevanje postavk ni vrnilo veljavne revizije cen.');
      }
      const deliveryPlanRevision = Number(
        pricingUpdateResult.rows[0]?.delivery_plan_revision
      );
      if (
        !Number.isSafeInteger(deliveryPlanRevision) ||
        deliveryPlanRevision < 1
      ) {
        throw new Error('Shranjevanje postavk ni vrnilo veljavne revizije načrta dobave.');
      }
      const shippingSource = hasShippingOverride
        ? 'manual_override'
        : shippingSnapshot.status === 'manual_quote'
          ? 'manual_quote'
          : 'automatic';
      const shippingManualQuoteReason =
        shippingSource === 'manual_quote' && typeof shippingSnapshot.reason === 'string'
          ? shippingSnapshot.reason
          : null;
      const diff: AuditDiff = {
        ...(itemDiff ? { items: itemDiff } : {})
      };
      if (diffHasEntries(diff)) {
        const orderNumber = String(order.order_number ?? `#${orderId}`);
        await insertAuditEventForRequest(
          request,
          {
            entityType: 'order',
            entityId: String(orderId),
            entityLabel: `Naročilo ${orderNumber}`,
            action: 'updated',
            summary: `Naročilo ${orderNumber}: postavke spremenjene`,
            diff,
            metadata: {
              order_number: orderNumber,
              changed_field_count: countAuditChangedFields(diff),
              line_item_count: newItems.length,
              pricing_basis: 'net',
              tax_rate: taxRate,
              shipping,
              shipping_source: shippingSource,
              shipping_override_stale: shippingOverrideStale,
              inventory_adjustments: inventoryAdjustments,
              confirmation_snapshots_refreshed: Boolean(itemDiff)
            }
          },
          client
        );
      }

      responsePayload = {
        subtotal,
        tax,
        shipping,
        automaticShipping,
        shippingOverrideStale,
        shippingSource,
        shippingManualQuoteReason,
        total,
        pricingRevision,
        deliveryPlanRevision,
        items: savedItems
      };
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    if (!responsePayload) {
      throw new Error('Shranjevanje postavk ni vrnilo dokončnih zneskov naročila.');
    }
    return NextResponse.json({
      success: true,
      pricingRevision: responsePayload.pricingRevision,
      deliveryPlanRevision: responsePayload.deliveryPlanRevision,
      totals: {
        subtotal: responsePayload.subtotal,
        tax: responsePayload.tax,
        shipping: responsePayload.shipping,
        automaticShipping: responsePayload.automaticShipping,
        shippingOverrideStale: responsePayload.shippingOverrideStale,
        shippingSource: responsePayload.shippingSource,
        shippingManualQuoteReason: responsePayload.shippingManualQuoteReason,
        total: responsePayload.total
      },
      items: responsePayload.items
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : 'Napaka na strežniku.'
      },
      { status: 500 }
    );
  }
}
