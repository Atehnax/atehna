import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db';
import { buildOrderBlobPath, uploadBlob } from '@/lib/server/blob';
import { revalidateAdminOrderPaths } from '@/lib/server/revalidateAdminOrders';

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

function normalizeOrderLookupValue(rawValue: string): string {
  return rawValue.trim().replace(/^#+/, '').trim();
}

export async function POST(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  try {
    const normalizedOrderValue = normalizeOrderLookupValue(params.orderId);
    if (!normalizedOrderValue) {
      return NextResponse.json({ message: 'Neveljavna številka naročila.' }, { status: 400 });
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
    const orderLookupResult = await pool.query(
      `
        SELECT id
        FROM orders
        WHERE regexp_replace(trim(coalesce(order_number, '')), '^#', '') = $1
        ORDER BY id DESC
        LIMIT 1
      `,
      [normalizedOrderValue]
    );

    const parsedOrderId = Number(normalizedOrderValue);
    let order = orderLookupResult.rows[0] as { id: number } | undefined;

    if (!order && Number.isFinite(parsedOrderId)) {
      const fallbackOrderResult = await pool.query('SELECT id FROM orders WHERE id = $1', [parsedOrderId]);
      order = fallbackOrderResult.rows[0] as { id: number } | undefined;
    }

    if (!order) {
      return NextResponse.json({ message: 'Naročilo ne obstaja.' }, { status: 404 });
    }

    const orderId = Number(order.id);
    console.info('[orders.purchase-order.upload] resolved order lookup', {
      normalizedOrderNumber: normalizedOrderValue,
      resolvedOrderId: orderId
    });

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${orderId}-purchase_order-${Date.now()}.${detectedFormat.extension}`;
    const blobPath = buildOrderBlobPath(orderId, fileName);

    const blob = await uploadBlob(blobPath, fileBuffer, detectedFormat.contentType);

    let insertResult;

    try {
      insertResult = await pool.query(
        'INSERT INTO order_documents (order_id, type, filename, blob_url, blob_pathname) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at',
        [orderId, 'purchase_order', fileName, blob.url, blob.pathname]
      );
    } catch (error) {
      const errorCode =
        typeof error === 'object' && error !== null
          ? (error as { code?: string }).code
          : null;

      if (errorCode !== '42703') {
        throw error;
      }

      insertResult = await pool.query(
        'INSERT INTO order_documents (order_id, type, filename, blob_url) VALUES ($1, $2, $3, $4) RETURNING id, created_at',
        [orderId, 'purchase_order', fileName, blob.url]
      );
    }

    console.info('[orders.purchase-order.upload] document persisted', {
      normalizedOrderNumber: normalizedOrderValue,
      resolvedOrderId: orderId,
      documentType: 'purchase_order',
      blobUrl: blob.url
    });

    revalidateAdminOrderPaths(orderId);

    return NextResponse.json({
      id: Number(insertResult.rows[0].id),
      url: blob.url,
      filename: fileName,
      createdAt: insertResult.rows[0].created_at,
      type: 'purchase_order'
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
