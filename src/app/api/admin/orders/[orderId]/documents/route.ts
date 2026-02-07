import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db';
import { uploadBlob } from '@/lib/server/blob';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_DOCUMENT_TYPES = new Set([
  'order_summary',
  'predracun',
  'dobavnica',
  'invoice'
]);

function isPdfFile(file: File): boolean {
  const fileNameLower = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();
  return mimeType === 'application/pdf' || fileNameLower.endsWith('.pdf');
}

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
    const rawType = formData.get('type');

    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'Datoteka manjka.' }, { status: 400 });
    }

    if (typeof rawType !== 'string' || !rawType.trim()) {
      return NextResponse.json({ message: 'Vrsta dokumenta manjka.' }, { status: 400 });
    }

    const normalizedType = rawType.trim().toLowerCase();
    if (!ALLOWED_DOCUMENT_TYPES.has(normalizedType)) {
      return NextResponse.json({ message: 'Neveljavna vrsta dokumenta.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ message: 'Datoteka je prevelika.' }, { status: 400 });
    }

    if (!isPdfFile(file)) {
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

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${order.order_number}-${normalizedType}-${Date.now()}.pdf`;
    const blobPath = `orders/${order.order_number}/${fileName}`;

    // force correct metadata, never pass browser mime directly
    const blob = await uploadBlob(blobPath, fileBuffer, 'application/pdf');

    try {
      await pool.query(
        'INSERT INTO order_documents (order_id, type, filename, blob_url, blob_pathname) VALUES ($1, $2, $3, $4, $5)',
        [orderId, normalizedType, fileName, blob.url, blob.pathname]
      );
    } catch (error) {
      const errorCode =
        typeof error === 'object' && error !== null
          ? (error as { code?: string }).code
          : null;

      if (errorCode !== '42703') {
        throw error;
      }

      await pool.query(
        'INSERT INTO order_documents (order_id, type, filename, blob_url) VALUES ($1, $2, $3, $4)',
        [orderId, normalizedType, fileName, blob.url]
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
