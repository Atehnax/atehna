import { NextRequest, NextResponse } from 'next/server';
import type { Pool } from 'pg';
import {
  SHIPPING_CALCULATION_VERSION,
  validatePersistedOrderShippingReadiness,
  type ShippingCalculation,
  type ShippingManualOverride
} from '@/shared/domain/shipping/shipping';
import { getPool } from '@/shared/server/db';
import {
  readOrderAccessSession,
  verifyOrderAccessToken,
  type VerifiedOrderAccess
} from '@/shared/server/orderAccess';
import { scheduleInitialOrderSummaryJob } from '@/shared/server/orderSummaryJobs';
import {
  readConfirmationDocumentsSafely,
  scheduleConfirmationDocumentRepairSafely,
  type ConfirmationDocumentRow,
  type CustomerConfirmationDocument
} from '@/commercial/api/orders/confirmation/documentResilience';

export const runtime = 'nodejs';

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nullableObjectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function moneyCents(value: unknown): number {
  return Math.round(numberValue(value) * 100);
}

function frozenShippingValue(order: Record<string, unknown>): ShippingCalculation {
  const snapshot = nullableObjectValue(order.shipping_snapshot_json);
  const override = nullableObjectValue(order.shipping_override_json);
  if (snapshot?.status === 'calculated') {
    const automaticAmountCents =
      order.automatic_shipping === null || order.automatic_shipping === undefined
        ? numberValue(snapshot.automaticAmountCents)
        : moneyCents(order.automatic_shipping);
    return {
      ...(snapshot as unknown as ShippingCalculation & Record<string, unknown>),
      status: 'calculated',
      source: override ? 'manual_override' : 'automatic',
      automaticAmountCents,
      finalAmountCents: moneyCents(order.shipping),
      manualOverride: override as ShippingManualOverride | null
    } as ShippingCalculation;
  }
  if (snapshot?.status === 'manual_quote') {
    return snapshot as unknown as ShippingCalculation;
  }
  const reason =
    'Shranjeni podatki o izračunu poštnine niso na voljo za to starejše naročilo.';
  return {
    status: 'manual_quote',
    calculationVersion: SHIPPING_CALCULATION_VERSION,
    configurationVersion: 1,
    items: [],
    combinedWeightGrams: null,
    largestDimensionMm: null,
    triggeringItem: null,
    reason,
    issues: [{ code: 'INVALID_CONFIGURATION', message: reason }]
  };
}

function frozenShippingOverrideValue(order: Record<string, unknown>) {
  const override = nullableObjectValue(order.shipping_override_json);
  if (!override) return null;
  return {
    amount: numberValue(order.shipping),
    reason: typeof override.reason === 'string' ? override.reason : ''
  };
}

function reportDocumentSubsystemFailure(
  stage: 'lookup' | 'scheduling',
  orderId: number,
  error: unknown
): void {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(
    `[orders.confirmation] document ${stage} failed for order ${orderId}: ${message}`
  );
}

async function verifyConfirmationRequest(
  request: NextRequest,
  pool: Pool
): Promise<VerifiedOrderAccess | null> {
  const session = readOrderAccessSession(request);
  if (!session) return null;
  const access = await verifyOrderAccessToken(
    pool,
    session.token,
    'confirmation'
  );
  return access?.tokenId.toLowerCase() === session.accessId ? access : null;
}

export async function GET(request: NextRequest) {
  try {
    if (!request.headers.has('x-order-access-id')) {
      return NextResponse.json(
        { code: 'CONFIRMATION_ACCESS_REQUIRED', message: 'Povezava za potrditev ni veljavna.' },
        {
          status: 400,
          headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
        }
      );
    }

    const pool = await getPool();
    const access = await verifyConfirmationRequest(request, pool);
    if (!access) {
      return NextResponse.json(
        {
          code: 'CONFIRMATION_NOT_FOUND',
          message: 'Potrditev ne obstaja, je potekla ali je bila preklicana.'
        },
        {
          status: 404,
          headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
        }
      );
    }

    scheduleConfirmationDocumentRepairSafely(
      () => scheduleInitialOrderSummaryJob(pool, access.orderId),
      (error) => reportDocumentSubsystemFailure('scheduling', access.orderId, error)
    );

    const client = await pool.connect();
    let order: Record<string, unknown> | undefined;
    let itemRows: Record<string, unknown>[] = [];
    let documents: CustomerConfirmationDocument[] = [];
    try {
      await client.query('begin isolation level repeatable read read only');
      const orderResult = await client.query(
        `
          select
            customer_type,
            organization_name,
            contact_name,
            email,
            address_line1,
            address_line2,
            postal_code,
            city,
            gurs_house_number_id,
            country_code,
            reference,
            notes,
            status,
            payment_status,
            commitment_status,
            stock_enforcement_applied,
            contract_status,
            subtotal,
            tax,
            shipping,
            automatic_shipping,
            shipping_snapshot_json,
            shipping_override_json,
            shipping_override_stale,
            parcel_count,
            total,
            currency,
            pricing_version,
            pricing_revision,
            is_draft,
            (select count(*)::integer from order_items where order_id = orders.id) as item_count,
            created_at,
            deleted_at
          from orders
          where id = $1
        `,
        [access.orderId]
      );
      order = orderResult.rows[0] as Record<string, unknown> | undefined;

      if (order) {
        const snapshotsResult = await client.query(
        `
          select
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
          from order_line_snapshots
          where order_id = $1
          order by line_number asc
        `,
        [access.orderId]
        );
        itemRows = snapshotsResult.rows as Record<string, unknown>[];

        documents = await readConfirmationDocumentsSafely(
          async () => {
            await client.query('savepoint confirmation_document_lookup');
            try {
              const result = await client.query(
                `
                  select
                    distinct on (type)
                    type,
                    customer_access_id
                  from order_documents
                  where order_id = $1
                    and deleted_at is null
                    and order_pricing_revision = $2
                    and (
                      type <> 'dobavnica'
                      or order_delivery_plan_revision = $3
                    )
                  order by type, created_at desc, id desc
                `,
                [
                  access.orderId,
                  order?.pricing_revision,
                  order?.delivery_plan_revision
                ]
              );
              await client.query('release savepoint confirmation_document_lookup');
              return result.rows as ConfirmationDocumentRow[];
            } catch (error) {
              await client.query('rollback to savepoint confirmation_document_lookup');
              await client.query('release savepoint confirmation_document_lookup');
              throw error;
            }
          },
          (error) => reportDocumentSubsystemFailure('lookup', access.orderId, error)
        );
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    if (!order || order.deleted_at) {
      return NextResponse.json(
        { code: 'CONFIRMATION_NOT_FOUND', message: 'Potrditev ne obstaja.' },
        {
          status: 404,
          headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
        }
      );
    }

    if (itemRows.length === 0) {
      return NextResponse.json(
        {
          code: 'ORDER_FORMAT_UNSUPPORTED',
          message: 'Naročilo ni v podprtem formatu. Oddajte novo naročilo.'
        },
        {
          status: 409,
          headers: {
            'Cache-Control': 'no-store',
            'Referrer-Policy': 'no-referrer'
          }
        }
      );
    }

    const shippingReadiness = validatePersistedOrderShippingReadiness({
      expectedItemCount: Number(order.item_count ?? 0),
      snapshotLineCount: itemRows.length,
      subtotal: order.subtotal,
      tax: order.tax,
      shipping: order.shipping,
      automaticShipping: order.automatic_shipping,
      total: order.total,
      shippingSnapshot: order.shipping_snapshot_json,
      shippingOverride: order.shipping_override_json,
      shippingOverrideStale: order.shipping_override_stale,
      parcelCount: order.parcel_count
    });
    if (order.is_draft === true) {
      return NextResponse.json(
        {
          code: 'CONFIRMATION_SHIPPING_PENDING',
          message: 'Potrditev bo na voljo, ko bo naročilo dokončano.'
        },
        {
          status: 409,
          headers: {
            'Cache-Control': 'no-store, private',
            'Referrer-Policy': 'no-referrer'
          }
        }
      );
    }
    if (!shippingReadiness.ok) {
      return NextResponse.json(
        {
          code: 'CONFIRMATION_SHIPPING_PENDING',
          message: shippingReadiness.message
        },
        {
          status: 409,
          headers: {
            'Cache-Control': 'no-store, private',
            'Referrer-Policy': 'no-referrer'
          }
        }
      );
    }
    const items = itemRows.map((row) => {
      const snapshot = objectValue(row.snapshot_json);
      const quantity = Math.max(1, Math.trunc(numberValue(row.quantity)));
      const listUnitNet = numberValue(row.base_unit_net);
      const unitNet = numberValue(row.unit_net);
      const lineNet = numberValue(row.line_net);
      const unitTax = numberValue(row.unit_tax);
      const lineTax = numberValue(row.line_tax);
      const unitGross = numberValue(row.unit_gross);
      const lineGross = numberValue(row.line_gross);
      const discountKind =
        snapshot.discountKind === 'quantity' ||
        snapshot.discountKind === 'variant'
          ? snapshot.discountKind
          : null;
      const snapshotQuantityDiscountPct = numberValue(
        snapshot.quantityDiscountPct
      );
      const quantityDiscountPct =
        discountKind === 'quantity' && snapshotQuantityDiscountPct > 0
          ? snapshotQuantityDiscountPct
          : null;

      return {
        variantId: numberValue(row.catalog_variant_id),
        productId: numberValue(row.catalog_item_id),
        productSlug: String(row.product_slug ?? ''),
        productName: String(row.product_name ?? ''),
        variantName: String(row.variant_name ?? ''),
        sku: String(row.sku ?? ''),
        unit: row.unit ? String(row.unit) : null,
        quantity,
        minOrder: Math.max(1, Math.trunc(numberValue(snapshot.minOrder) || 1)),
        availableStock: Math.max(0, Math.trunc(numberValue(snapshot.availableStock))),
        imageUrl: row.image_url ? String(row.image_url) : null,
        categoryId: row.category_id ? String(row.category_id) : null,
        categoryPath: row.category_path ? String(row.category_path) : null,
        attributes: objectValue(row.selected_attributes),
        listUnitNet,
        baseUnitNet: listUnitNet,
        discountPct: numberValue(row.discount_pct),
        discountKind,
        quantityDiscountPct,
        discountUnitNet: Math.max(0, listUnitNet - unitNet),
        unitNet,
        unitTax,
        unitGross,
        lineListNet: listUnitNet * quantity,
        lineDiscountNet: Math.max(0, listUnitNet * quantity - lineNet),
        lineNet,
        lineTax,
        lineGross,
        taxRate: numberValue(row.tax_rate),
        currency: String(row.currency),
        snapshot
      };
    });

    const customerName = String(order.organization_name ?? order.contact_name ?? '');
    const addressLine1 = String(order.address_line1 ?? '').trim();

    return NextResponse.json(
      {
        status: String(order.status ?? 'received'),
        paymentStatus: String(order.payment_status ?? 'unpaid'),
        commitmentStatus: String(order.commitment_status ?? 'binding'),
        contractStatus: String(
          order.contract_status ?? 'pending_seller_acceptance'
        ),
        stockNotCommitted:
          order.commitment_status === 'pending_confirmation' ||
          order.stock_enforcement_applied === false,
        createdAt: String(order.created_at ?? ''),
        pricingVersion: String(order.pricing_version),
        parcelCount: Math.max(1, Math.trunc(numberValue(order.parcel_count) || 1)),
        customer: {
          customerType: String(order.customer_type ?? ''),
          customerName,
          organizationName: order.organization_name ? String(order.organization_name) : null,
          contactName: String(order.contact_name ?? ''),
          email: String(order.email ?? ''),
          addressLine1,
          addressLine2: order.address_line2
            ? String(order.address_line2)
            : null,
          city: String(order.city ?? ''),
          postalCode: String(order.postal_code ?? ''),
          gursHouseNumberId: order.gurs_house_number_id
            ? String(order.gurs_house_number_id)
            : null,
          countryCode: String(order.country_code ?? 'SI'),
          reference: order.reference ? String(order.reference) : null,
          notes: order.notes ? String(order.notes) : null
        },
        items,
        totals: {
          net: numberValue(order.subtotal),
          tax: numberValue(order.tax),
          shipping: numberValue(order.shipping),
          gross: numberValue(order.total),
          currency: String(order.currency)
        },
        shipping: frozenShippingValue(order),
        frozenShippingOverride: frozenShippingOverrideValue(order),
        documents
      },
      {
        headers: {
          'Cache-Control': 'no-store, private',
          'Referrer-Policy': 'no-referrer'
        }
      }
    );
  } catch (error) {
    console.error('[orders.confirmation] failed', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { code: 'CONFIRMATION_FAILED', message: 'Potrditve trenutno ni mogoče prikazati.' },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
      }
    );
  }
}
