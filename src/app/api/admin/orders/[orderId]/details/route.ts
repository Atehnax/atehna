import { NextResponse } from 'next/server';
import { revalidateAdminOrderPaths } from '@/lib/server/revalidateAdminOrders';
import { getPool } from '@/lib/server/db';


export async function POST(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  try {
    const orderId = Number(params.orderId);
    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ message: 'Neveljaven ID naročila.' }, { status: 400 });
    }

    const body = await request.json();
    const {
      customerType,
      organizationName,
      contactName,
      email,
      phone,
      deliveryAddress,
      reference,
      notes,
      orderDate,
      orderNumber
    } = body ?? {};

    if (!contactName || !email || !customerType) {
      return NextResponse.json({ message: 'Manjkajo obvezni podatki.' }, { status: 400 });
    }


    const normalizedOrderDate =
      typeof orderDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(orderDate)
        ? `${orderDate}T00:00:00.000Z`
        : null;

    const pool = await getPool();
    try {
      await pool.query(
        `
        UPDATE orders
        SET customer_type = $1,
            organization_name = $2,
            contact_name = $3,
            email = $4,
            phone = $5,
            delivery_address = $6,
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
          phone || null,
          deliveryAddress || null,
          reference || null,
          notes || null,
          typeof orderNumber === 'string' ? orderNumber.trim() : null,
          normalizedOrderDate,
          orderId
        ]
      );
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === '42703')) {
        throw error;
      }

      await pool.query(
        `
        UPDATE orders
        SET customer_type = $1,
            organization_name = $2,
            contact_name = $3,
            email = $4,
            phone = $5,
            delivery_address = $6,
            reference = $7,
            notes = $8,
            order_number = coalesce(nullif($9::text, ''), order_number),
            created_at = coalesce($10::timestamptz, created_at)
        WHERE id = $11
        `,
        [
          customerType,
          organizationName || null,
          contactName,
          email,
          phone || null,
          deliveryAddress || null,
          reference || null,
          notes || null,
          typeof orderNumber === 'string' ? orderNumber.trim() : null,
          normalizedOrderDate,
          orderId
        ]
      );
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
