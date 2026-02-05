import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db';
import { uploadBlob } from '@/lib/server/blob';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg']);

export async function POST(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  try {
    const orderId = Number(params.orderId);
    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ message: 'Neveljaven ID naročila.' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'Datoteka manjka.' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ message: 'Dovoljeni so PDF ali JPG.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ message: 'Datoteka je prevelika.' }, { status: 400 });
    }

    const pool = await getPool();
    const orderResult = await pool.query('SELECT order_number FROM orders WHERE id = $1', [
      orderId
    ]);
    const order = orderResult.rows[0];

    if (!order) {
      return NextResponse.json({ message: 'Naročilo ne obstaja.' }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = file.type === 'application/pdf' ? 'pdf' : 'jpg';
    const fileName = `purchase-order-${Date.now()}.${extension}`;
    const blobPath = `orders/${order.order_number}/${fileName}`;

    const blob = await uploadBlob(blobPath, buffer, file.type);

    await pool.query(
      'INSERT INTO order_attachments (order_id, type, filename, blob_url) VALUES ($1, $2, $3, $4)',
      [orderId, 'purchase_order', fileName, blob.url]
    );

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
