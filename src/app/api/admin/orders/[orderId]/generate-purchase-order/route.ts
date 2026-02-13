import { NextResponse } from 'next/server';
import { uploadBlob } from '@/lib/server/blob';
import { getPool } from '@/lib/server/db';
import { generateOrderPdf } from '@/lib/server/pdf';
import { buildGeneratedPdfFileName, buildPdfContext } from '@/lib/server/pdfGeneration';

export async function POST(
  _request: Request,
  { params }: { params: { orderId: string } }
) {
  try {
    const orderId = Number(params.orderId);
    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ message: 'Neveljaven ID naročila.' }, { status: 400 });
    }

    const pool = await getPool();
    const context = await buildPdfContext(pool, orderId);
    if (!context.ok) {
      return NextResponse.json({ message: context.message }, { status: context.status });
    }

    const pdfBuffer = await generateOrderPdf(
      'Naročilnica',
      context.orderForPdf,
      context.itemsForPdf
    );

    const fileName = await buildGeneratedPdfFileName(pool, orderId, 'purchase_order');
    const blobPath = `orders/${context.orderToken}/${fileName}`;
    const blob = await uploadBlob(blobPath, Buffer.from(pdfBuffer), 'application/pdf');

    const insertResult = await pool.query(
      'INSERT INTO order_documents (order_id, type, filename, blob_url, blob_pathname) VALUES ($1, $2, $3, $4, $5) RETURNING created_at',
      [orderId, 'purchase_order', fileName, blob.url, blob.pathname]
    );

    return NextResponse.json({
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
