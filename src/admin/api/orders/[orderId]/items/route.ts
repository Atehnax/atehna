import { NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import { getPool } from '@/shared/server/db';
import { computeOrderLineItemsDiff, countAuditChangedFields, diffHasEntries } from '@/shared/audit/auditDiff';
import type { AuditDiff } from '@/shared/audit/auditTypes';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { isJsonRecord, readRequiredJsonRecord } from '@/shared/server/requestJson';

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
      where (
          ($1::bigint is not null and civ.id = $1)
          or (
            $1::bigint is null
            and lower(trim(coalesce(nullif(civ.variant_sku, ''), nullif(ci.sku, ''), ci.slug)))
              = lower(trim($2))
          )
        )
        and ($3::bigint is null or ci.id = $3)
        and ci.status = 'active'
        and civ.status = 'active'
      order by
        case when civ.id = $1 then 0 else 1 end,
        civ.position asc,
        civ.id asc
      limit 2
    `,
    [item.catalogVariantId ?? null, item.sku, item.catalogItemId ?? null]
  );

  // A legacy SKU without an explicit variant ID is linked only when unambiguous.
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
    imageUrl: asNullableText(row.image_url)
  };
}

function operationalSnapshot(
  item: PricedItem,
  metadata: CatalogMetadata | null,
  taxRate: number,
  currency: string
) {
  return {
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
          total: number;
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
            total,
            tax_rate,
            currency,
            customer_type,
            commitment_status,
            status,
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
      if (order.deleted_at || order.status === 'cancelled') {
        await client.query('ROLLBACK');
        return NextResponse.json(
          {
            message:
              'Postavk izbrisanega ali preklicanega naročila ni mogoče spreminjati.'
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
      const shipping = 0;
      const total = roundAmount(subtotal + tax);

      const oldItemsResult = await client.query(
        `
          select
            id,
            sku,
            name,
            unit,
            quantity,
            unit_price,
            total_price,
            catalog_item_id,
            catalog_variant_id,
            base_unit_net,
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

      const metadataByInputIndex = await Promise.all(
        pricedItems.map((item) => resolveCatalogMetadata(client, item))
      );
      const oldRowsById = new Map(
        oldRows.map((row) => [Number(row.id), row])
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

      if (order.commitment_status === 'binding') {
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
                unit_price = $5,
                total_price = $6,
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
                unit_price,
                total_price,
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
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
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

      await client.query(
        `
          update orders
          set subtotal = $1,
              tax = $2,
              shipping = 0,
              total = $3
          where id = $4
        `,
        [subtotal, tax, total, orderId]
      );

      const oldItems = oldRows.map((row) => ({
        id: row.id,
        sku: row.sku,
        name: row.name,
        unit: row.unit,
        quantity: Number(row.quantity ?? 0),
        unitPrice: Number(row.base_unit_net ?? row.unit_price ?? 0),
        discountPercentage: Number(row.discount_pct ?? 0),
        totalPrice: Number(row.total_price ?? 0)
      }));
      const newItems = savedItems.map((item, index) => ({
        ...item,
        totalPrice: pricedItems[index].lineNet
      }));
      const itemDiff = computeOrderLineItemsDiff(oldItems, newItems);
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
              shipping: 0,
              inventory_adjustments: inventoryAdjustments,
              placement_snapshots_preserved: true
            }
          },
          client
        );
      }

      responsePayload = {
        subtotal,
        tax,
        shipping,
        total,
        items: savedItems
      };
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return NextResponse.json({
      success: true,
      totals: {
        subtotal: responsePayload?.subtotal ?? 0,
        tax: responsePayload?.tax ?? 0,
        shipping: 0,
        total: responsePayload?.total ?? 0
      },
      items: responsePayload?.items ?? []
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
