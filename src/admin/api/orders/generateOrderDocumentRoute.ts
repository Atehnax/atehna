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
import { validatePersistedOrderShippingReadiness } from '@/shared/domain/shipping/shipping';
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
    const [initialContext, template, logoConfig] = await Promise.all([
      buildPdfContext(pool, orderId),
      getOrderDocumentTemplate(type),
      getSiteLogoConfig()
    ]);
    if (!initialContext.ok) {
      return NextResponse.json(
        { message: initialContext.message },
        { status: initialContext.status }
      );
    }
    let context = initialContext;
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
        'select id, contract_status from orders where id = $1 for update',
        [orderId]
      );
      if ((lockedOrder.rowCount ?? 0) === 0) {
        await client.query('rollback');
        return NextResponse.json({ message: 'Naročilo ne obstaja.' }, { status: 404 });
      }

      const lockedContext = await buildPdfContext(client, orderId);
      if (!lockedContext.ok) {
        await client.query('rollback');
        return NextResponse.json(
          { message: lockedContext.message },
          { status: lockedContext.status }
        );
      }
      if (
        type !== 'order_summary' &&
        String(lockedOrder.rows[0]?.contract_status ?? '') !== 'accepted'
      ) {
        await client.query('rollback');
        return NextResponse.json(
          {
            code: 'ORDER_CONTRACT_NOT_ACCEPTED',
            message:
              'Operativni dokument lahko izdate šele po sprejemu naročila.'
          },
          { status: 409 }
        );
      }
      context = lockedContext;
      if (context.order.is_draft === true) {
        await client.query('rollback');
        return NextResponse.json(
          {
            code: 'ORDER_DRAFT_DOCUMENT_BLOCKED',
            message:
              'Dokument lahko ustvarite šele po dokončanju osnutka in potrditvi poštnine.'
          },
          { status: 409 }
        );
      }

      const shippingCountsResult = await client.query(
        `
          select
            (select count(*)::integer from order_items where order_id = $1) as item_count,
            (
              select count(*)::integer
              from order_line_snapshots
              where order_id = $1
            ) as snapshot_line_count
        `,
        [orderId]
      );
      const shippingCounts = shippingCountsResult.rows[0] as {
        item_count?: number;
        snapshot_line_count?: number;
      } | undefined;
      const shippingReadiness = validatePersistedOrderShippingReadiness({
        expectedItemCount: Number(shippingCounts?.item_count ?? 0),
        snapshotLineCount: Number(shippingCounts?.snapshot_line_count ?? 0),
        subtotal: context.order.subtotal,
        tax: context.order.tax,
        shipping: context.order.shipping,
        automaticShipping: context.order.automatic_shipping,
        total: context.order.total,
        shippingSnapshot: context.order.shipping_snapshot_json,
        shippingOverride: context.order.shipping_override_json,
        shippingOverrideStale: context.order.shipping_override_stale,
        parcelCount: context.order.parcel_count
      });
      if (!shippingReadiness.ok) {
        await client.query('rollback');
        return NextResponse.json(
          {
            code: 'ORDER_SHIPPING_NOT_READY',
            message: shippingReadiness.message
          },
          { status: 409 }
        );
      }

      const versionResult = await client.query(
        `select coalesce(max(version_number), 0)::integer + 1 as next_version
         from order_documents
         where order_id = $1 and type = $2`,
        [orderId, type]
      );
      version = Number(versionResult.rows[0]?.next_version ?? 1);
      if (type === 'order_summary') {
        documentNumber = context.orderForPdf.publicCode?.trim() ?? '';
        if (!documentNumber) {
          throw new Error('Naročilo nima veljavne kode za potrditev.');
        }
      } else {
        documentNumber = await allocateOrderDocumentNumber(client, type, issuedAt);
      }

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
           order_pricing_revision,
           order_delivery_plan_revision,
           document_number,
           issued_at,
           content_sha256,
           legal_status,
           format_marker
         )
         values (
           $1, $2, $3, $4, $5, $6,
           (select pricing_revision from orders where id = $1),
           (select delivery_plan_revision from orders where id = $1),
           $7, $8, $9, 'operational', 'atehna-template-pdf-v3'
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
