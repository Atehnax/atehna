import { NextResponse } from 'next/server';
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
      notes
    } = body ?? {};

    if (!contactName || !email || !customerType) {
      return NextResponse.json({ message: 'Manjkajo obvezni podatki.' }, { status: 400 });
    }

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
            is_draft = false
        WHERE id = $9
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
            notes = $8
        WHERE id = $9
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
          orderId
        ]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
