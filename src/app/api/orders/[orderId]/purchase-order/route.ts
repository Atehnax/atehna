import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db';
import { buildOrderBlobPath, uploadBlob } from '@/lib/server/blob';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

type UploadFormat = {
  extension: 'pdf' | 'jpg';
  contentType: 'application/pdf' | 'image/jpeg';
};

function detectUploadFormat(file: File): UploadFormat | null {
  const fileNameLower = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();

  const isPdf = mimeType === 'application/pdf' || fileNameLower.endsWith('.pdf');
  if (isPdf) {
    return { extension: 'pdf', contentType: 'application/pdf' };
  }

  const isJpeg =
    mimeType === 'image/jpeg' ||
    mimeType === 'image/jpg' ||
    fileNameLower.endsWith('.jpg') ||
    fileNameLower.endsWith('.jpeg');

  if (isJpeg) {
    return { extension: 'jpg', contentType: 'image/jpeg' };
  }

  return null;
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

    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'Datoteka manjka.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ message: 'Datoteka je prevelika.' }, { status: 400 });
    }

    const detectedFormat = detectUploadFormat(file);
    if (!detectedFormat) {
      return NextResponse.json({ message: 'Dovoljeni so PDF ali JPG.' }, { status: 400 });
    }

    const pool = await getPool();
    const orderResult = await pool.query('SELECT id FROM orders WHERE id = $1', [orderId]);
    const order = orderResult.rows[0];

    if (!order) {
      return NextResponse.json({ message: 'Naročilo ne obstaja.' }, { status: 404 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${orderId}-purchase_order-${Date.now()}.${detectedFormat.extension}`;
    const blobPath = buildOrderBlobPath(orderId, fileName);

    const blob = await uploadBlob(blobPath, fileBuffer, detectedFormat.contentType);

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
