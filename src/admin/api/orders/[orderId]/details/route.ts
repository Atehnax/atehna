import { NextResponse } from 'next/server';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';
import { getPool } from '@/shared/server/db';
import { getOrderNumberAvailability } from '@/shared/server/orders';
import { computeObjectDiff, countAuditChangedFields, diffHasEntries } from '@/shared/audit/auditDiff';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';


export async function POST(request: Request, props: { params: Promise<{ orderId: string }> }) {
  const params = await props.params;
  try {
    const orderId = Number(params.orderId);
    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ message: 'Neveljaven ID naročila.' }, { status: 400 });
    }

    const bodyResult = await readRequiredJsonRecord(request);
    if (!bodyResult.ok) return bodyResult.response;

    const body = bodyResult.body;
    const {
      customerType,
      organizationName,
      contactName,
      email,
      deliveryAddress,
      postalCode,
      reference,
      notes,
      orderDate,
      orderNumber
    } = body ?? {};

    if (!contactName || !email || !customerType) {
      return NextResponse.json({ message: 'Manjkajo obvezni podatki.' }, { status: 400 });
    }


    const normalizeOrderDate = (value: unknown) => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();

      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return `${trimmed}T00:00:00.000Z`;
      }

      const displayMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
      if (!displayMatch) return null;

      const [, day, month, year] = displayMatch;
      const isoDate = `${year}-${month}-${day}`;
      const parsed = new Date(`${isoDate}T00:00:00`);
      if (
        Number.isNaN(parsed.getTime()) ||
        parsed.getUTCFullYear() !== Number(year) ||
        parsed.getUTCMonth() + 1 !== Number(month) ||
        parsed.getUTCDate() !== Number(day)
      ) {
        return null;
      }

      return `${isoDate}T00:00:00.000Z`;
    };

    const normalizedOrderDate = normalizeOrderDate(orderDate);

    const pool = await getPool();
    const detailFields = [
      'order_number',
      'customer_type',
      'organization_name',
      'contact_name',
      'email',
      'delivery_address',
      'postal_code',
      'reference',
      'notes',
      'created_at'
    ];
    const beforeResult = await pool.query(
      `
      select order_number, customer_type, organization_name, contact_name, email, delivery_address, postal_code, reference, notes, created_at
      from orders
      where id = $1
      `,
      [orderId]
    );
    if (beforeResult.rows.length === 0) {
      return NextResponse.json({ message: 'NaroÄilo ne obstaja.' }, { status: 404 });
    }
    const trimmedOrderNumber = typeof orderNumber === 'string' ? orderNumber.trim() : '';
    const orderNumberAvailability = trimmedOrderNumber
      ? await getOrderNumberAvailability(trimmedOrderNumber, orderId, 0)
      : null;

    if (orderNumberAvailability && orderNumberAvailability.normalizedOrderNumber === null) {
      return NextResponse.json({ message: 'Vnesite veljavno številko naročila.' }, { status: 400 });
    }

    if (orderNumberAvailability && !orderNumberAvailability.isAvailable) {
      return NextResponse.json(
        { message: 'Številka naročila je že zasedena.' },
        { status: 409 }
      );
    }

    const normalizedOrderNumber = orderNumberAvailability?.formattedOrderNumber ?? null;

    await pool.query(
      `
      UPDATE orders
      SET customer_type = $1,
          organization_name = $2,
          contact_name = $3,
          email = $4,
          delivery_address = $5,
          postal_code = $6,
          reference = $7,
          notes = $8,
          order_number = coalesce(nullif($9::text, ''), order_number),
          created_at = coalesce($10::timestamptz, created_at),
          is_draft = false
      WHERE id = $11
      `,
      [
        customerType,
        organizationName || null,
        contactName,
        email,
        deliveryAddress || null,
        typeof postalCode === 'string' ? postalCode.trim().slice(0, 4) || null : null,
        reference || null,
        notes || null,
        normalizedOrderNumber,
        normalizedOrderDate,
        orderId
      ]
    );

    const afterResult = await pool.query(
      `
      select order_number, customer_type, organization_name, contact_name, email, delivery_address, postal_code, reference, notes, created_at
      from orders
      where id = $1
      `,
      [orderId]
    );
    const after = afterResult.rows[0] as Record<string, unknown> | undefined;
    const before = beforeResult.rows[0] as Record<string, unknown>;
    const diff = computeObjectDiff(before, after ?? {}, {
      entityType: 'order',
      fields: detailFields
    });
    if (diffHasEntries(diff)) {
      const orderNumberLabel = String(after?.order_number ?? before.order_number ?? `#${orderId}`);
      await insertAuditEventForRequest(request, {
        entityType: 'order',
        entityId: String(orderId),
        entityLabel: `Naročilo ${orderNumberLabel}`,
        action: 'updated',
        summary: `Naročilo ${orderNumberLabel}: podatki spremenjeni`,
        diff,
        metadata: {
          order_number: orderNumberLabel,
          changed_field_count: countAuditChangedFields(diff)
        }
      });
    }

    revalidateAdminOrderPaths(orderId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
