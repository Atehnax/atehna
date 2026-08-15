import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { buildOrderBlobPath, deleteBlob, uploadBlob } from '@/shared/server/blob';
import { getPool } from '@/shared/server/db';
import { generateOrderPdf } from '@/shared/server/pdf';
import {
  buildGeneratedPdfFileName,
  buildOrderDocumentNumber,
  buildPdfContext
} from '@/shared/server/pdfGeneration';
import type { OrderPdfTypeKey } from '@/shared/domain/order/orderTypes';
import { recordOrderDocumentAudit } from './orderDocumentAudit';

export async function generateOrderDocumentRoute(
  request: Request,
  props: { params: Promise<{ orderId: string }> },
  title: string,
  type: OrderPdfTypeKey
) {
  const params = await props.params;
  let uploadedPath: string | null = null;
  let documentPersisted = false;

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

    const pdfBuffer = Buffer.from(
      await generateOrderPdf(title, context.orderForPdf, context.itemsForPdf)
    );
    const contentHash = createHash('sha256').update(pdfBuffer).digest('hex');
    const fileName = buildGeneratedPdfFileName(orderId, type);
    const blobPath = buildOrderBlobPath(orderId, fileName);
    const blob = await uploadBlob(blobPath, pdfBuffer, 'application/pdf');
    uploadedPath = blob.pathname;

    const client = await pool.connect();
    let insertRow: Record<string, unknown>;
    let version: number;
    let documentNumber: string;
    try {
      await client.query('begin');
      await client.query('select id from orders where id = $1 for update', [orderId]);
      const versionResult = await client.query(
        `
          select coalesce(max(version_number), 0)::integer + 1 as next_version
          from order_documents
          where order_id = $1 and type = $2
        `,
        [orderId, type]
      );
      version = Number(versionResult.rows[0]?.next_version ?? 1);
      documentNumber = buildOrderDocumentNumber(orderId, type, version);
      const insertResult = await client.query(
        `
          insert into order_documents (
            order_id,
            type,
            filename,
            blob_url,
            blob_pathname,
            version_number,
            document_number,
            issued_at,
            content_sha256,
            legal_status,
            format_marker
          )
          values (
            $1, $2, $3, $4, $5, $6, $7, now(), $8,
            'operational', 'atehna-generated-pdf-v1'
          )
          returning id, created_at, issued_at
        `,
        [
          orderId,
          type,
          fileName,
          blob.url,
          blob.pathname,
          version,
          documentNumber,
          contentHash
        ]
      );
      insertRow = insertResult.rows[0] as Record<string, unknown>;
      await client.query('commit');
      documentPersisted = true;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }

    try {
      await recordOrderDocumentAudit({
        request,
        orderId,
        orderNumber: context.orderForPdf.orderNumber,
        documentId: Number(insertRow.id),
        documentType: type,
        filename: fileName,
        generated: true
      });
    } catch (auditError) {
      console.error('[orders.document.generate] audit failed', {
        orderId,
        documentId: Number(insertRow.id),
        message: auditError instanceof Error ? auditError.message : 'Unknown error'
      });
    }

    return NextResponse.json(
      {
        url: blob.url,
        filename: fileName,
        id: Number(insertRow.id),
        createdAt: insertRow.created_at,
        issuedAt: insertRow.issued_at,
        type,
        versionNumber: version,
        documentNumber,
        legalStatus: 'operational',
        formatMarker: 'atehna-generated-pdf-v1'
      },
      { status: 201 }
    );
  } catch (error) {
    if (uploadedPath && !documentPersisted) {
      await deleteBlob(uploadedPath).catch(() => undefined);
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
