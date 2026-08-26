import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { GenerateOrderPdfType } from '@/shared/domain/order/orderTypes';
import {
  buildOrderDocumentBlobPath,
  deletePrivateOrderDocumentBlob,
  uploadPrivateOrderDocumentBlob
} from '@/shared/server/blob';
import { getPool } from '@/shared/server/db';
import { getOrderDocumentTemplate } from '@/shared/server/orderDocumentTemplates';
import { generateOrderPdf } from '@/shared/server/pdf';
import { getSiteLogoConfig } from '@/shared/server/siteLogo';
import { resolveSiteLogoArtwork } from '@/shared/server/siteLogoArtwork';
import {
  allocateOrderDocumentNumber,
  buildGeneratedPdfFileName,
  buildPdfContext
} from '@/shared/server/pdfGeneration';
import { recordOrderDocumentAudit } from './orderDocumentAudit';

export async function generateOrderDocumentRoute(
  request: Request,
  props: { params: Promise<{ orderId: string }> },
  type: GenerateOrderPdfType
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
    const [context, template, logoConfig] = await Promise.all([
      buildPdfContext(pool, orderId),
      getOrderDocumentTemplate(type),
      getSiteLogoConfig()
    ]);
    if (!context.ok) {
      return NextResponse.json({ message: context.message }, { status: context.status });
    }
    const logoArtwork = await resolveSiteLogoArtwork(logoConfig, 'pdf-document');

    const issuedAt = new Date();
    const documentAccessId = randomUUID();
    const fileName = buildGeneratedPdfFileName(type, issuedAt);
    const client = await pool.connect();
    let insertRow: Record<string, unknown> | null = null;
    let version = 1;
    let documentNumber = '';

    try {
      await client.query('begin');
      const lockedOrder = await client.query(
        'select id from orders where id = $1 for update',
        [orderId]
      );
      if ((lockedOrder.rowCount ?? 0) === 0) {
        await client.query('rollback');
        return NextResponse.json({ message: 'Naročilo ne obstaja.' }, { status: 404 });
      }

      const versionResult = await client.query(
        `select coalesce(max(version_number), 0)::integer + 1 as next_version
         from order_documents
         where order_id = $1 and type = $2`,
        [orderId, type]
      );
      version = Number(versionResult.rows[0]?.next_version ?? 1);
      documentNumber = await allocateOrderDocumentNumber(client, type, issuedAt);

      const pdfBuffer = Buffer.from(
        await generateOrderPdf({
          type,
          template,
          order: context.orderForPdf,
          items: context.itemsForPdf,
          documentNumber,
          issuedAt,
          logoConfig,
          logoArtwork: logoArtwork?.bytes ?? null
        })
      );
      const contentHash = createHash('sha256').update(pdfBuffer).digest('hex');
      const blobPath = buildOrderDocumentBlobPath(documentAccessId, 'pdf');
      const blob = await uploadPrivateOrderDocumentBlob(
        blobPath,
        pdfBuffer,
        'application/pdf'
      );
      uploadedPath = blob.pathname;

      const insertResult = await client.query(
        `insert into order_documents (
           order_id,
           customer_access_id,
           type,
           filename,
           blob_pathname,
           version_number,
           document_number,
           issued_at,
           content_sha256,
           legal_status,
           format_marker
         )
         values (
           $1, $2, $3, $4, $5, $6, $7, $8, $9,
           'operational', 'atehna-template-pdf-v3'
         )
         returning id, created_at, issued_at`,
        [
          orderId,
          documentAccessId,
          type,
          fileName,
          blob.pathname,
          version,
          documentNumber,
          issuedAt,
          contentHash
        ]
      );
      insertRow = insertResult.rows[0] as Record<string, unknown>;
      await client.query('commit');
      documentPersisted = true;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    if (!insertRow) throw new Error('Shranjevanje PDF ni vrnilo dokumenta.');

    try {
      await recordOrderDocumentAudit({
        request,
        orderId,
        orderNumber: context.orderNumber,
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
        url: `/api/admin/orders/${orderId}/documents/${Number(insertRow.id)}`,
        filename: fileName,
        id: Number(insertRow.id),
        createdAt: insertRow.created_at,
        issuedAt: insertRow.issued_at,
        type,
        versionNumber: version,
        documentNumber,
        legalStatus: 'operational',
        formatMarker: 'atehna-template-pdf-v3'
      },
      { status: 201 }
    );
  } catch (error) {
    if (uploadedPath && !documentPersisted) {
      await deletePrivateOrderDocumentBlob(uploadedPath).catch(() => undefined);
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
