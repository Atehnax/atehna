import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import {
  buildOrderDocumentBlobPath,
  deletePrivateOrderDocumentBlob,
  uploadPrivateOrderDocumentBlob
} from '@/shared/server/blob';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { buildOrderDocumentNumber } from '@/shared/server/pdfGeneration';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Opaque administrator bytes cannot prove that financial totals and shipping
// match the current order revision. Operational documents are server-generated;
// only external purchase-order evidence may be uploaded.
const ALLOWED_DOCUMENT_TYPES = new Set(['purchase_order']);

function isPdfFile(file: File): boolean {
  const fileNameLower = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();
  return mimeType === 'application/pdf' || fileNameLower.endsWith('.pdf');
}

function hasPdfSignature(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

export async function POST(request: Request, props: { params: Promise<{ orderId: string }> }) {
  const params = await props.params;
  let uploadedPath: string | null = null;
  let documentPersisted = false;

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
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: 'Datoteka mora biti manjša od 10 MB.' },
        { status: 400 }
      );
    }
    if (!isPdfFile(file)) {
      return NextResponse.json({ message: 'Dovoljeni so samo PDF-ji.' }, { status: 400 });
    }

    const pool = await getPool();
    const orderResult = await pool.query(
      `select id, order_number, source_quote_offer_version_id, contract_status
       from orders where id = $1`,
      [orderId]
    );
    const order = orderResult.rows[0] as
      | {
          id: string | number;
          order_number: string | null;
          source_quote_offer_version_id: string | number | null;
          contract_status: string | null;
        }
      | undefined;
    if (!order) {
      return NextResponse.json({ message: 'Naročilo ne obstaja.' }, { status: 404 });
    }
    if (
      normalizedType === 'purchase_order' &&
      order.source_quote_offer_version_id !== null &&
      order.contract_status !== 'accepted'
    ) {
      return NextResponse.json(
        {
          code: 'QUOTE_PURCHASE_ORDER_EVIDENCE_IMMUTABLE',
          message:
            'Naročilnice, vezane na ponudbo, ni mogoče nadomestiti prek splošnega nalaganja dokumentov.'
        },
        { status: 409 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    if (!hasPdfSignature(fileBuffer)) {
      return NextResponse.json({ message: 'Datoteka ni veljaven PDF.' }, { status: 400 });
    }

    const contentHash = createHash('sha256').update(fileBuffer).digest('hex');
    const documentAccessId = randomUUID();
    const fileName = `${normalizedType}-${randomUUID()}.pdf`;
    const blobPath = buildOrderDocumentBlobPath(documentAccessId, 'pdf');
    const blob = await uploadPrivateOrderDocumentBlob(blobPath, fileBuffer, 'application/pdf');
    uploadedPath = blob.pathname;

    const client = await pool.connect();
    let insertRow: Record<string, unknown>;
    let version: number;
    let documentNumber: string;
    try {
      await client.query('begin');
      const lockedOrderResult = await client.query(
        `
          select
            id,
            deleted_at,
            source_quote_offer_version_id,
            contract_status
          from orders
          where id = $1
          for update
        `,
        [orderId]
      );
      const lockedOrder = lockedOrderResult.rows[0] as
        | Record<string, unknown>
        | undefined;
      if (!lockedOrder) {
        await client.query('rollback');
        await deletePrivateOrderDocumentBlob(blob.pathname).catch(() => undefined);
        uploadedPath = null;
        return NextResponse.json(
          { message: 'Naročilo ne obstaja.' },
          { status: 404 }
        );
      }
      if (lockedOrder.deleted_at) {
        await client.query('rollback');
        await deletePrivateOrderDocumentBlob(blob.pathname).catch(() => undefined);
        uploadedPath = null;
        return NextResponse.json(
          {
            code: 'ORDER_DOCUMENT_ORDER_DELETED',
            message: 'Dokumenta ni mogoče naložiti na izbrisano naročilo.'
          },
          { status: 409 }
        );
      }
      if (
        normalizedType === 'purchase_order' &&
        lockedOrder.source_quote_offer_version_id !== null &&
        lockedOrder.contract_status !== 'accepted'
      ) {
        await client.query('rollback');
        await deletePrivateOrderDocumentBlob(blob.pathname).catch(() => undefined);
        uploadedPath = null;
        return NextResponse.json(
          {
            code: 'QUOTE_PURCHASE_ORDER_EVIDENCE_IMMUTABLE',
            message:
              'Naročilnice, vezane na ponudbo, ni mogoče nadomestiti prek splošnega nalaganja dokumentov.'
          },
          { status: 409 }
        );
      }
      const versionResult = await client.query(
        `
          select coalesce(max(version_number), 0)::integer + 1 as next_version
          from order_documents
          where order_id = $1 and type = $2
        `,
        [orderId, normalizedType]
      );
      version = Number(versionResult.rows[0]?.next_version ?? 1);
      documentNumber = buildOrderDocumentNumber(normalizedType, version, documentAccessId);
      const insertResult = await client.query(
        `
          insert into order_documents (
            order_id,
            customer_access_id,
            type,
            filename,
            blob_pathname,
            version_number,
            order_pricing_revision,
            document_number,
            issued_at,
            content_sha256,
            legal_status,
            format_marker
          )
          values (
            $1, $2, $3, $4, $5, $6,
            (select pricing_revision from orders where id = $1), $7, now(), $8,
            'operational', 'admin-upload-pdf-v1'
          )
          returning id, created_at, issued_at
        `,
        [
          orderId,
          documentAccessId,
          normalizedType,
          fileName,
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

    const orderNumber = String(order.order_number ?? `#${orderId}`);
    try {
      await insertAuditEventForRequest(request, {
        entityType: 'order',
        entityId: String(orderId),
        entityLabel: `Naročilo ${orderNumber}`,
        action: 'uploaded',
        summary: `Naročilo ${orderNumber}: dokument naložen`,
        diff: {
          documents: {
            label: 'Dokumenti',
            added: [fileName]
          }
        },
        metadata: {
          order_number: orderNumber,
          document_id: Number(insertRow.id),
          document_type: normalizedType,
          filename: fileName,
          version_number: version,
          document_number: documentNumber,
          content_sha256: contentHash
        }
      });
    } catch (auditError) {
      console.error('[orders.document.upload] audit failed', {
        orderId,
        documentId: Number(insertRow.id),
        message: auditError instanceof Error ? auditError.message : 'Unknown error'
      });
    }

    return NextResponse.json(
      {
        id: Number(insertRow.id),
        url: `/api/admin/orders/${orderId}/documents/${Number(insertRow.id)}`,
        filename: fileName,
        createdAt: insertRow.created_at,
        issuedAt: insertRow.issued_at,
        type: normalizedType,
        versionNumber: version,
        documentNumber,
        legalStatus: 'operational',
        formatMarker: 'admin-upload-pdf-v1'
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
