import { NextRequest, NextResponse } from 'next/server';
import type { Pool } from 'pg';
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
  type ConfirmationDocumentRow
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

    const documentsPromise = readConfirmationDocumentsSafely(
      async () => {
        const result = await pool.query(
          `
            select
              distinct on (type)
              type,
              customer_access_id
            from order_documents
            where order_id = $1
              and deleted_at is null
            order by type, created_at desc, id desc
          `,
          [access.orderId]
        );
        return result.rows as ConfirmationDocumentRow[];
      },
      (error) => reportDocumentSubsystemFailure('lookup', access.orderId, error)
    );

    const [orderResult, snapshotsResult, documents] = await Promise.all([
      pool.query(
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
            subtotal,
            tax,
            shipping,
            total,
            currency,
            pricing_version,
            created_at,
            deleted_at
          from orders
          where id = $1
        `,
        [access.orderId]
      ),
      pool.query(
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
      ),
      documentsPromise
    ]);

    const order = orderResult.rows[0] as Record<string, unknown> | undefined;
    if (!order || order.deleted_at) {
      return NextResponse.json(
        { code: 'CONFIRMATION_NOT_FOUND', message: 'Potrditev ne obstaja.' },
        {
          status: 404,
          headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
        }
      );
    }

    const itemRows = snapshotsResult.rows as Record<string, unknown>[];
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
        stockNotCommitted: order.commitment_status === 'pending_confirmation',
        createdAt: String(order.created_at ?? ''),
        pricingVersion: String(order.pricing_version),
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
