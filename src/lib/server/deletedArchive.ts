import { getPool } from '@/lib/server/db';

export type ArchiveEntry = {
  id: number;
  item_type: 'order' | 'pdf';
  order_id: number | null;
  document_id: number | null;
  label: string;
  payload: Record<string, unknown> | null;
  deleted_at: string;
  expires_at: string;
};

const isMissingRelationError = (error: unknown) =>
  Boolean(error && typeof error === 'object' && 'code' in error && error.code === '42P01');

export async function recordDeletedArchiveEntry(entry: {
  itemType: 'order' | 'pdf';
  orderId?: number | null;
  documentId?: number | null;
  label: string;
  payload?: Record<string, unknown> | null;
}) {
  const pool = await getPool();

  try {
    await pool.query(
      `
      insert into deleted_archive_entries (item_type, order_id, document_id, label, payload)
      values ($1, $2, $3, $4, $5::jsonb)
      `,
      [
        entry.itemType,
        entry.orderId ?? null,
        entry.documentId ?? null,
        entry.label,
        JSON.stringify(entry.payload ?? null)
      ]
    );
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }
}

export async function fetchArchiveEntries(itemType?: 'all' | 'order' | 'pdf'): Promise<ArchiveEntry[]> {
  const pool = await getPool();
  const params: unknown[] = [];
  let whereClause = '';

  if (itemType && itemType !== 'all') {
    params.push(itemType);
    whereClause = `where item_type = $${params.length}`;
  }

  try {
    const result = await pool.query(
      `
      select id, item_type, order_id, document_id, label, payload, deleted_at, expires_at
      from deleted_archive_entries
      ${whereClause}
      order by deleted_at desc
      `,
      params
    );

    return result.rows as ArchiveEntry[];
  } catch (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
}
