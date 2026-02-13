import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db';
import { recordDeletedArchiveEntry } from '@/lib/server/deletedArchive';

const isMissingColumnError = (error: unknown) =>
  Boolean(error && typeof error === 'object' && 'code' in error && error.code === '42703');

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
    const result = await pool.query(
      'select id, type, filename, blob_url, blob_pathname from order_documents where id = $1 and order_id = $2',
      [documentId, orderId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ message: 'Dokument ne obstaja.' }, { status: 404 });
    }

    const row = result.rows[0] as {
      id: number;
      type: string;
      filename: string;
      blob_url: string;
      blob_pathname: string | null;
    };

    try {
      await pool.query('update order_documents set deleted_at = now() where id = $1 and order_id = $2', [
        documentId,
        orderId
      ]);
    } catch (error) {
      if (!isMissingColumnError(error)) throw error;
      await pool.query('delete from order_documents where id = $1 and order_id = $2', [
        documentId,
        orderId
      ]);
      return NextResponse.json({ success: true });
    }

    await recordDeletedArchiveEntry({
      itemType: 'pdf',
      orderId,
      documentId,
      label: row.filename,
      payload: {
        type: row.type,
        blobUrl: row.blob_url,
        blobPathname: row.blob_pathname
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
