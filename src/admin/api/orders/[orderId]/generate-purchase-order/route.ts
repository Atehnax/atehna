import { NextResponse } from 'next/server';
import { buildOrderBlobPath, uploadBlob } from '@/shared/server/blob';
import { getPool } from '@/shared/server/db';
import { generateOrderPdf } from '@/shared/server/pdf';
import { buildGeneratedPdfFileName, buildPdfContext } from '@/shared/server/pdfGeneration';

export async function POST(_request: Request, props: { params: Promise<{ orderId: string }> }) {
  const params = await props.params;
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
    const blobPath = buildOrderBlobPath(orderId, fileName);
    const blob = await uploadBlob(blobPath, Buffer.from(pdfBuffer), 'application/pdf');

    const insertResult = await pool.query(
      'INSERT INTO order_documents (order_id, type, filename, blob_url, blob_pathname) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at',
      [orderId, 'purchase_order', fileName, blob.url, blob.pathname]
    );

    return NextResponse.json({
      url: blob.url,
      filename: fileName,
      id: Number(insertResult.rows[0].id),
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
