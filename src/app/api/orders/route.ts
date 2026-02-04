import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db';
import { uploadBlob } from '@/lib/server/blob';
import { generateOrderPdf } from '@/lib/server/pdf';

const TAX_RATE = 0.22;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      customerType,
      organizationName,
      deliveryAddress,
      contactName,
      email,
      phone,
      reference,
      notes,
      items
    } = body ?? {};

    if (!customerType || !contactName || !email) {
      return NextResponse.json(
        { message: 'Manjkajo obvezni podatki.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { message: 'Naročilo mora vsebovati vsaj en izdelek.' },
        { status: 400 }
      );
    }

    const normalizedItems = items.map((item: any) => ({
      sku: String(item.sku ?? ''),
      name: String(item.name ?? ''),
      unit: item.unit ? String(item.unit) : null,
      quantity: Number(item.quantity ?? 0),
      unitPrice: item.unitPrice ? Number(item.unitPrice) : null
    }));

    if (normalizedItems.some((item: any) => !item.sku || !item.name || item.quantity <= 0)) {
      return NextResponse.json({ message: 'Podatki o izdelkih niso veljavni.' }, { status: 400 });
    }

    const subtotal = normalizedItems.reduce(
      (sum: number, item: any) => sum + (item.unitPrice ?? 0) * item.quantity,
      0
    );
    const tax = subtotal > 0 ? subtotal * TAX_RATE : 0;
    const total = subtotal + tax;

    const pool = await getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const insertOrderQuery = `
        WITH next_id AS (
          SELECT nextval('orders_id_seq') AS id
        )
        INSERT INTO orders (
          id,
          order_number,
          customer_type,
          organization_name,
          contact_name,
          email,
          phone,
          delivery_address,
          reference,
          notes,
          subtotal,
          tax,
          total
        )
        SELECT
          id,
          'ORD-' || id,
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11
        FROM next_id
        RETURNING id, order_number, created_at
      `;

      const orderResult = await client.query(insertOrderQuery, [
        customerType,
        organizationName || null,
        contactName,
        email,
        phone || null,
        deliveryAddress || null,
        reference || null,
        notes || null,
        subtotal,
        tax,
        total
      ]);

      const order = orderResult.rows[0];

      const itemInsertQuery = `
        INSERT INTO order_items (order_id, sku, name, unit, quantity, unit_price, total_price)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;

      for (const item of normalizedItems) {
        const totalPrice = item.unitPrice ? item.unitPrice * item.quantity : null;
        await client.query(itemInsertQuery, [
          order.id,
          item.sku,
          item.name,
          item.unit,
          item.quantity,
          item.unitPrice,
          totalPrice
        ]);
      }

      const documentType = customerType === 'school' ? 'order_summary' : 'predracun';
      const pdfBuffer = await generateOrderPdf(
        documentType === 'order_summary' ? 'Ponudba' : 'Predračun',
        {
          orderNumber: order.order_number,
          customerType,
          organizationName: organizationName || null,
          contactName,
          email,
          phone: phone || null,
          deliveryAddress: deliveryAddress || null,
          reference: reference || null,
          notes: notes || null,
          createdAt: new Date(order.created_at),
          subtotal,
          tax,
          total
        },
        normalizedItems
      );

      const fileName = `${order.order_number}-${documentType}.pdf`;
      const blobPath = `orders/${order.order_number}/${fileName}`;
      const blob = await uploadBlob(blobPath, pdfBuffer, 'application/pdf');

      await client.query(
        'INSERT INTO order_documents (order_id, type, filename, blob_url, blob_pathname) VALUES ($1, $2, $3, $4, $5)',
        [order.id, documentType, fileName, blob.url, blob.pathname]
      );

      await client.query('COMMIT');

      return NextResponse.json({
        orderId: order.id,
        orderNumber: order.order_number,
        documentUrl: blob.url,
        documentType
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
