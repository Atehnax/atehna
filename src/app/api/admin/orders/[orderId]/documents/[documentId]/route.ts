import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db';

export async function DELETE(
  _request: Request,
  { params }: { params: { orderId: string; documentId: string } }
) {
  try {
    const orderId = Number(params.orderId);
    const documentId = Number(params.documentId);

    if (!Number.isFinite(orderId) || !Number.isFinite(documentId)) {
      return NextResponse.json({ message: 'Neveljaven ID.' }, { status: 400 });
    }

    const pool = await getPool();
    const documentResult = await pool.query(
      'select id, type, filename, blob_url, blob_pathname, deleted_at from order_documents where id = $1 and order_id = $2',
      [documentId, orderId]
    );

    if (documentResult.rows.length === 0) {
      return NextResponse.json({ message: 'Dokument ne obstaja.' }, { status: 404 });
    }

    const row = documentResult.rows[0] as {
      type: string;
      filename: string;
      blob_url: string;
      blob_pathname: string | null;
      deleted_at: string | null;
    };

    if (!row.deleted_at) {
      try {
        await pool.query('update order_documents set deleted_at = now() where id = $1 and order_id = $2', [documentId, orderId]);
      } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === '42703')) {
          throw error;
        }
        await pool.query('delete from order_documents where id = $1 and order_id = $2', [documentId, orderId]);
        return NextResponse.json({ success: true });
      }

      try {
        await pool.query(
          `
          insert into deleted_archive_entries (item_type, order_id, document_id, label, payload)
          values ($1, $2, $3, $4, $5::jsonb)
          `,
          [
            'pdf',
            orderId,
            documentId,
            row.filename,
            JSON.stringify({ type: row.type, blobUrl: row.blob_url, blobPathname: row.blob_pathname })
          ]
        );
      } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === '42P01')) {
          throw error;
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
