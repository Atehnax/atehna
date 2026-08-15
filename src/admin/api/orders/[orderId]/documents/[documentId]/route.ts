import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { insertAuditEventForRequest } from '@/shared/server/audit';

type OrderDocumentDeleteRow = {
  type: string;
  filename: string;
  blob_url: string;
  blob_pathname: string | null;
  order_number: string | null;
  contact_name: string | null;
  delivery_address: string | null;
  customer_type: string | null;
  created_at: string | null;
  deleted_at: string | null;
};

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
      const documentResult = await client.query(
        `
        select d.id, d.type, d.filename, d.blob_url, d.blob_pathname, d.deleted_at,
          o.order_number, o.contact_name, o.delivery_address, o.customer_type, o.created_at
        from order_documents d
        left join orders o on o.id = d.order_id
        where d.id = $1 and d.order_id = $2
        for update of d
        `,
        [documentId, orderId]
      );

      if (documentResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ message: 'Dokument ne obstaja.' }, { status: 404 });
      }

      row = documentResult.rows[0] as OrderDocumentDeleteRow;

      if (!row.deleted_at) {
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
              blobUrl: row.blob_url,
              blobPathname: row.blob_pathname,
              orderCreatedAt: row.created_at,
              customerName: row.contact_name || null,
              address: row.delivery_address || null,
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
