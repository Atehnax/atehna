import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db';
import { uploadBlob } from '@/lib/server/blob';

const ALLOWED_TYPES = new Set(['application/pdf']);

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
    const type = formData.get('type');

    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'Datoteka manjka.' }, { status: 400 });
    }
    if (typeof type !== 'string' || !type) {
      return NextResponse.json({ message: 'Vrsta dokumenta manjka.' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ message: 'Dovoljeni so samo PDF-ji.' }, { status: 400 });
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
    const fileName = `${order.order_number}-${type}-${Date.now()}.pdf`;
    const blobPath = `orders/${order.order_number}/${fileName}`;
    const blob = await uploadBlob(blobPath, buffer, file.type);

    try {
      await pool.query(
        'INSERT INTO order_documents (order_id, type, filename, blob_url, blob_pathname) VALUES ($1, $2, $3, $4, $5)',
        [orderId, type, fileName, blob.url, blob.pathname]
      );
    } catch (error) {
      const code = typeof error === 'object' && error !== null ? (error as { code?: string }).code : null;
      if (code !== '42703') {
        throw error;
      }
      await pool.query(
        'INSERT INTO order_documents (order_id, type, filename, blob_url) VALUES ($1, $2, $3, $4)',
        [orderId, type, fileName, blob.url]
      );
    }

    return NextResponse.json({ url: blob.url, filename: fileName });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
