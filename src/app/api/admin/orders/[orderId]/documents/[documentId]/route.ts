import { NextResponse } from 'next/server';
import { deleteBlob } from '@/lib/server/blob';
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
      'select id, blob_url, blob_pathname from order_documents where id = $1 and order_id = $2',
      [documentId, orderId]
    );

    if (documentResult.rows.length === 0) {
      return NextResponse.json({ message: 'Dokument ne obstaja.' }, { status: 404 });
    }

    const row = documentResult.rows[0] as { blob_url: string; blob_pathname: string | null };

    await pool.query('delete from order_documents where id = $1 and order_id = $2', [documentId, orderId]);

    try {
      const target = row.blob_pathname || row.blob_url;
      if (target) await deleteBlob(target);
    } catch {
      // Best effort cleanup; DB deletion is source of truth.
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
