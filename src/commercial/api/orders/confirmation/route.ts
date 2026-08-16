import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { verifyOrderAccessToken } from '@/shared/server/orderAccess';

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

function deriveStreetAddress(deliveryAddress: unknown, postalCode: unknown, city: unknown) {
  const address = String(deliveryAddress ?? '').trim();
  const locality = `${String(postalCode ?? '').trim()} ${String(city ?? '').trim()}`.trim();
  if (!locality) return address;
  return address.replace(new RegExp(`,?\\s*${locality.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '').trim();
}

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get('token')?.trim() ?? '';
    if (!token) {
      return NextResponse.json(
        { code: 'CONFIRMATION_TOKEN_REQUIRED', message: 'Povezava za potrditev ni veljavna.' },
        {
          status: 400,
          headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
        }
      );
    }

    const pool = await getPool();
    const access = await verifyOrderAccessToken(pool, token, 'confirmation');
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

    const [orderResult, snapshotsResult, documentsResult] = await Promise.all([
      pool.query(
        `
          select
            id,
            order_number,
            customer_type,
            organization_name,
            contact_name,
            email,
            delivery_address,
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
      pool.query(
        `
          select
            id,
            type,
            filename,
            blob_url,
            version_number,
            document_number,
            issued_at,
            content_sha256,
            legal_status,
            format_marker,
            created_at
          from order_documents
          where order_id = $1
            and deleted_at is null
          order by created_at desc, id desc
        `,
        [access.orderId]
      )
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

    let itemRows = snapshotsResult.rows as Record<string, unknown>[];
    if (itemRows.length === 0) {
      const legacyItemsResult = await pool.query(
        `
          select
            id as line_number,
            catalog_item_id,
            catalog_variant_id,
            coalesce(product_slug, '') as product_slug,
            name as product_name,
            coalesce(variant_name, '') as variant_name,
            sku,
            unit,
            quantity,
            category_id,
            category_path,
            coalesce(selected_attributes, '{}'::jsonb) as selected_attributes,
            image_url,
            coalesce(base_unit_net, unit_price, 0) as base_unit_net,
            coalesce(discount_pct, 0) as discount_pct,
            coalesce(unit_net, unit_price, 0) as unit_net,
            coalesce(unit_tax, 0) as unit_tax,
            coalesce(unit_gross, unit_price, 0) as unit_gross,
            coalesce(line_net, total_price, 0) as line_net,
            coalesce(line_tax, 0) as line_tax,
            coalesce(line_gross, total_price, 0) as line_gross,
            coalesce(tax_rate, 0) as tax_rate,
            coalesce(currency, 'EUR') as currency,
            coalesce(product_snapshot_json, '{}'::jsonb) as snapshot_json
          from order_items
          where order_id = $1
          order by id asc
        `,
        [access.orderId]
      );
      itemRows = legacyItemsResult.rows as Record<string, unknown>[];
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
        currency: String(row.currency ?? 'EUR'),
        snapshot
      };
    });

    const documents = (documentsResult.rows as Record<string, unknown>[]).map((document) => ({
      id: numberValue(document.id),
      type: String(document.type ?? ''),
      filename: String(document.filename ?? ''),
      url: String(document.blob_url ?? ''),
      versionNumber: document.version_number === null ? null : numberValue(document.version_number),
      documentNumber: document.document_number ? String(document.document_number) : null,
      issuedAt: document.issued_at ? String(document.issued_at) : null,
      contentSha256: document.content_sha256 ? String(document.content_sha256) : null,
      legalStatus: String(document.legal_status ?? 'operational'),
      formatMarker: String(document.format_marker ?? 'legacy'),
      createdAt: String(document.created_at ?? '')
    }));
    const latestSummary = documents.find((document) => document.type === 'order_summary') ?? null;
    const customerName = String(order.organization_name ?? order.contact_name ?? '');
    const addressLine1 =
      String(order.address_line1 ?? '').trim() ||
      deriveStreetAddress(order.delivery_address, order.postal_code, order.city);

    return NextResponse.json(
      {
        orderId: numberValue(order.id),
        orderNumber: String(order.order_number ?? ''),
        status: String(order.status ?? 'received'),
        paymentStatus: String(order.payment_status ?? 'unpaid'),
        commitmentStatus: String(order.commitment_status ?? 'binding'),
        stockNotCommitted: order.commitment_status === 'pending_confirmation',
        createdAt: String(order.created_at ?? ''),
        pricingVersion: String(order.pricing_version ?? 'legacy'),
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
          deliveryAddress: String(order.delivery_address ?? ''),
          reference: order.reference ? String(order.reference) : null,
          notes: order.notes ? String(order.notes) : null
        },
        items,
        totals: {
          net: numberValue(order.subtotal),
          tax: numberValue(order.tax),
          shipping: numberValue(order.shipping),
          gross: numberValue(order.total),
          currency: String(order.currency ?? 'EUR')
        },
        documents,
        documentUrl: latestSummary?.url ?? null,
        documentType: latestSummary?.type ?? null,
        tokenExpiresAt: access.expiresAt
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
