import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db';
import { uploadBlob } from '@/lib/server/blob';
import { generateOrderPdf } from '@/lib/server/pdf';

export async function POST(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  try {
    const orderId = Number(params.orderId);
    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ message: 'Neveljaven ID naročila.' }, { status: 400 });
    }

    const pool = await getPool();
    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    const order = orderResult.rows[0];

    if (!order) {
      return NextResponse.json({ message: 'Naročilo ne obstaja.' }, { status: 404 });
    }

    const itemsResult = await pool.query(
      'SELECT sku, name, unit, quantity, unit_price FROM order_items WHERE order_id = $1 ORDER BY id',
      [orderId]
    );

    const pdfBuffer = await generateOrderPdf(
      'Račun',
      {
        orderNumber: order.order_number,
        customerType: order.customer_type,
        organizationName: order.organization_name,
        contactName: order.contact_name,
        email: order.email,
        phone: order.phone,
        deliveryAddress: order.delivery_address,
        reference: order.reference,
        notes: order.notes,
        createdAt: new Date(order.created_at),
        subtotal: Number(order.subtotal),
        tax: Number(order.tax),
        total: Number(order.total)
      },
      itemsResult.rows
    );

    const fileName = `${order.order_number}-invoice-${Date.now()}.pdf`;
    const blobPath = `orders/${order.order_number}/${fileName}`;
    const blob = await uploadBlob(blobPath, Buffer.from(pdfBuffer), 'application/pdf');

    const insertResult = await pool.query(
      'INSERT INTO order_documents (order_id, type, filename, blob_url, blob_pathname) VALUES ($1, $2, $3, $4, $5) RETURNING created_at',
      [orderId, 'invoice', fileName, blob.url, blob.pathname]
    );

    return NextResponse.json({
      url: blob.url,
      filename: fileName,
      createdAt: insertResult.rows[0].created_at,
      type: 'invoice'
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
