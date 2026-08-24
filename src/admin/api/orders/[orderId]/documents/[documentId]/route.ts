import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { readPrivateOrderDocumentBlob } from '@/shared/server/blob';
import { formatOrderRowAddress } from '@/shared/domain/order/orderAddress';
import {
  SCHOOL_PURCHASE_ORDER_PROOF_FORMAT_MARKERS,
  schoolPurchaseOrderDeletionBlock
} from '@/shared/domain/order/schoolOrderWorkflow';

type OrderDocumentDeleteRow = {
  type: string;
  format_marker: string | null;
  filename: string;
  order_number: string | null;
  contact_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country_code: string | null;
  customer_type: string | null;
  status: string;
  commitment_status: string | null;
  created_at: string | null;
  deleted_at: string | null;
};

type OrderDocumentDownloadRow = {
  filename: string;
  blob_pathname: string;
};

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const PRIVATE_DOCUMENT_HEADERS = {
  'Cache-Control': 'no-store, private',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff'
};

function documentNotFoundResponse() {
  return NextResponse.json(
    { message: 'Dokument ne obstaja.' },
    { status: 404, headers: PRIVATE_DOCUMENT_HEADERS }
  );
}

export async function GET(
  _request: Request,
  props: { params: Promise<{ orderId: string; documentId: string }> }
) {
  try {
    const params = await props.params;
    const orderId = Number(params.orderId);
    const documentId = Number(params.documentId);
    if (
      !Number.isSafeInteger(orderId) ||
      orderId <= 0 ||
      !Number.isSafeInteger(documentId) ||
      documentId <= 0
    ) {
      return documentNotFoundResponse();
    }

    const pool = await getPool();
    const result = await pool.query(
      `
        select d.filename, d.blob_pathname
        from order_documents d
        join orders o on o.id = d.order_id
        where d.id = $1
          and d.order_id = $2
          and d.deleted_at is null
          and o.deleted_at is null
        limit 1
      `,
      [documentId, orderId]
    );
    const document = result.rows[0] as OrderDocumentDownloadRow | undefined;
    if (!document) return documentNotFoundResponse();

    const blob = await readPrivateOrderDocumentBlob(document.blob_pathname);
    if (!blob) return documentNotFoundResponse();
    if (blob.size <= 0 || blob.size > MAX_DOCUMENT_BYTES) {
      throw new Error('Order document has an invalid size.');
    }

    const contentType = blob.contentType.split(';', 1)[0].trim().toLowerCase();
    if (contentType !== 'application/pdf' && contentType !== 'image/jpeg') {
      throw new Error('Order document has an unsupported content type.');
    }
    const extension = contentType === 'application/pdf' ? 'pdf' : 'jpg';
    const safeFilename = document.filename.replace(/["\r\n]/gu, '_').trim()
      || `dokument.${extension}`;

    return new NextResponse(blob.stream, {
      status: 200,
      headers: {
        ...PRIVATE_DOCUMENT_HEADERS,
        'Content-Type': contentType,
        'Content-Length': String(blob.size),
        'Content-Disposition': `inline; filename="${safeFilename}"`
      }
    });
  } catch (error) {
    console.error('[admin.orders.documents.download] failed', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { message: 'Dokumenta trenutno ni mogoče odpreti.' },
      { status: 500, headers: PRIVATE_DOCUMENT_HEADERS }
    );
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ orderId: string; documentId: string }> }
) {
  const params = await props.params;
  try {
    const orderId = Number(params.orderId);
    const documentId = Number(params.documentId);

    if (!Number.isFinite(orderId) || !Number.isFinite(documentId)) {
      return NextResponse.json({ message: 'Neveljaven ID.' }, { status: 400 });
    }

    const pool = await getPool();
    const client = await pool.connect();
    let row: OrderDocumentDeleteRow | null = null;
    let newlyDeleted = false;

    try {
      await client.query('BEGIN');
      const orderResult = await client.query(
        `
          select order_number, contact_name, address_line1, address_line2,
            postal_code, city, country_code, customer_type, created_at,
            status, commitment_status
          from orders
          where id = $1
          for update
        `,
        [orderId]
      );
      if (orderResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ message: 'Dokument ne obstaja.' }, { status: 404 });
      }

      const documentResult = await client.query(
        `
          select id, type, filename, deleted_at, format_marker
          from order_documents
          where id = $1 and order_id = $2
          for update
        `,
        [documentId, orderId]
      );
      if (documentResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ message: 'Dokument ne obstaja.' }, { status: 404 });
      }

      row = {
        ...documentResult.rows[0],
        ...orderResult.rows[0]
      } as OrderDocumentDeleteRow;

      if (!row.deleted_at) {
        if (row.type === 'purchase_order') {
          const otherPurchaseOrderResult = await client.query(
            `
              select id
              from order_documents
              where order_id = $1
                and id <> $2
                and type = 'purchase_order'
                and deleted_at is null
                and format_marker = any($3::text[])
              order by id desc
              limit 1
              for share
            `,
            [
              orderId,
              documentId,
              [...SCHOOL_PURCHASE_ORDER_PROOF_FORMAT_MARKERS]
            ]
          );
          const deletionBlock = schoolPurchaseOrderDeletionBlock(
            row.customer_type ?? '',
            row.commitment_status,
            row.status,
            row.type,
            row.format_marker,
            otherPurchaseOrderResult.rowCount === 1
          );
          if (deletionBlock) {
            await client.query('ROLLBACK');
            return NextResponse.json(deletionBlock, { status: 409 });
          }
        }

        const deletedAtResult = await client.query(
          `
          update order_documents
          set deleted_at = now()
          where id = $1 and order_id = $2
          returning deleted_at
          `,
          [documentId, orderId]
        );
        const deletedAt = deletedAtResult.rows[0]?.deleted_at;

        await client.query(
          `
          insert into deleted_archive_entries (
            item_type,
            order_id,
            document_id,
            label,
            deleted_at,
            expires_at,
            payload
          )
          values ($1, $2, $3, $4, $5, $5::timestamptz + interval '90 days', $6::jsonb)
          `,
          [
            'pdf',
            orderId,
            documentId,
            row.filename,
            deletedAt,
            JSON.stringify({
              type: row.type,
              orderCreatedAt: row.created_at,
              customerName: row.contact_name || null,
              address: formatOrderRowAddress(row) || null,
              customerType: row.customer_type || null
            })
          ]
        );
        newlyDeleted = true;
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    if (!row) {
      return NextResponse.json({ message: 'Dokument ne obstaja.' }, { status: 404 });
    }

    if (!newlyDeleted) {
      return NextResponse.json({ success: true });
    }

    const orderNumber = row.order_number || `#${orderId}`;
    await insertAuditEventForRequest(request, {
      entityType: 'order',
      entityId: String(orderId),
      entityLabel: `Naročilo ${orderNumber}`,
      action: 'removed',
      summary: `Naročilo ${orderNumber}: dokument odstranjen`,
      diff: {
        documents: {
          label: 'Dokumenti',
          removed: [row.filename]
        }
      },
      metadata: {
        order_number: orderNumber,
        document_id: documentId,
        document_type: row.type,
        soft_delete: true
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
