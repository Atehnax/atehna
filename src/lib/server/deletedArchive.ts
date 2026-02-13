import { getPool } from '@/lib/server/db';
import { deleteBlob } from '@/lib/server/blob';

export type ArchiveEntry = {
  id: number;
  item_type: 'order' | 'pdf';
  order_id: number | null;
  document_id: number | null;
  label: string;
  deleted_at: string;
  expires_at: string;
};

export async function fetchArchiveEntries(itemType?: 'all' | 'order' | 'pdf'): Promise<ArchiveEntry[]> {
  const pool = await getPool();
  const params: unknown[] = [];
  let where = '';

  if (itemType && itemType !== 'all') {
    params.push(itemType);
    where = `where item_type = $${params.length}`;
  }

  const result = await pool.query(
    `
    select id, item_type, order_id, document_id, label, deleted_at, expires_at
    from deleted_archive_entries
    ${where}
    order by deleted_at desc
    `,
    params
  );

  return result.rows as ArchiveEntry[];
}

export async function permanentlyDeleteArchiveEntries(entryIds: number[]): Promise<number> {
  if (entryIds.length === 0) return 0;

  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const entriesResult = await client.query(
      `
      select id, item_type, order_id, document_id, payload
      from deleted_archive_entries
      where id = any($1::bigint[])
      `,
      [entryIds]
    );

    const entries = entriesResult.rows as Array<{
      id: number;
      item_type: 'order' | 'pdf';
      order_id: number | null;
      document_id: number | null;
      payload: { blobPathname?: string; blobUrl?: string } | null;
    }>;

    for (const entry of entries) {
      if (entry.item_type === 'order' && entry.order_id) {
        await client.query('delete from order_items where order_id = $1', [entry.order_id]);
        await client.query('delete from order_attachments where order_id = $1', [entry.order_id]);
        await client.query('delete from order_documents where order_id = $1', [entry.order_id]);
        await client.query('delete from orders where id = $1', [entry.order_id]);
      }

      if (entry.item_type === 'pdf' && entry.document_id) {
        await client.query('delete from order_documents where id = $1', [entry.document_id]);
      }

      const blobTarget = entry.payload?.blobPathname || entry.payload?.blobUrl;
      if (blobTarget) {
        try {
          await deleteBlob(blobTarget);
        } catch {
          // best effort
        }
      }
    }

    await client.query('delete from deleted_archive_entries where id = any($1::bigint[])', [entryIds]);
    await client.query('COMMIT');

    return entries.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function cleanupExpiredArchiveEntries(): Promise<number> {
  const pool = await getPool();
  const result = await pool.query(
    'select id from deleted_archive_entries where expires_at <= now() order by id asc limit 200'
  );

  const ids = result.rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
  if (ids.length === 0) return 0;
  return permanentlyDeleteArchiveEntries(ids);
}
