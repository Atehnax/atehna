import { getPool } from '@/lib/server/db';
import { deleteBlob } from '@/lib/server/blob';

const isMissingRelationError = (error: unknown) =>
  Boolean(error && typeof error === 'object' && 'code' in error && error.code === '42P01');

const isMissingColumnError = (error: unknown) =>
  Boolean(error && typeof error === 'object' && 'code' in error && error.code === '42703');

export type ArchiveEntry = {
  id: number;
  item_type: 'order' | 'pdf';
  order_id: number | null;
  document_id: number | null;
  label: string;
  deleted_at: string;
  expires_at: string;
};

type SoftDeletedEntry = {
  item_type: 'order' | 'pdf';
  order_id: number | null;
  document_id: number | null;
  label: string;
  deleted_at: string;
  expires_at: string;
};

export type RestoreTarget = {
  item_type: 'order' | 'pdf';
  order_id: number | null;
  document_id: number | null;
};

async function fetchSoftDeletedFallbackEntries(
  itemType?: 'all' | 'order' | 'pdf'
): Promise<SoftDeletedEntry[]> {
  const pool = await getPool();
  const entries: SoftDeletedEntry[] = [];

  if (!itemType || itemType === 'all' || itemType === 'order') {
    try {
      const ordersResult = await pool.query(
        `
        select
          id as order_id,
          order_number,
          contact_name,
          deleted_at,
          deleted_at + interval '60 days' as expires_at
        from orders
        where deleted_at is not null
        order by deleted_at desc
        `
      );

      entries.push(
        ...ordersResult.rows.map((row) => ({
          item_type: 'order' as const,
          order_id: Number(row.order_id),
          document_id: null,
          label: `${String(row.order_number || `#${row.order_id}`)} · ${String(row.contact_name || 'Naročilo')}`,
          deleted_at: new Date(row.deleted_at).toISOString(),
          expires_at: new Date(row.expires_at ?? new Date(row.deleted_at).getTime() + 60 * 24 * 60 * 60 * 1000).toISOString()
        }))
      );
    } catch (error) {
      if (!isMissingColumnError(error) && !isMissingRelationError(error)) throw error;
    }
  }

  if (!itemType || itemType === 'all' || itemType === 'pdf') {
    try {
      const documentsResult = await pool.query(
        `
        select
          id as document_id,
          order_id,
          filename,
          deleted_at,
          deleted_at + interval '60 days' as expires_at
        from order_documents
        where deleted_at is not null
        order by deleted_at desc
        `
      );

      entries.push(
        ...documentsResult.rows.map((row) => ({
          item_type: 'pdf' as const,
          order_id: Number(row.order_id),
          document_id: Number(row.document_id),
          label: String(row.filename || 'PDF dokument'),
          deleted_at: new Date(row.deleted_at).toISOString(),
          expires_at: new Date(row.expires_at ?? new Date(row.deleted_at).getTime() + 60 * 24 * 60 * 60 * 1000).toISOString()
        }))
      );
    } catch (error) {
      if (!isMissingColumnError(error) && !isMissingRelationError(error)) throw error;
    }
  }

  return entries;
}

export async function fetchArchiveEntries(itemType?: 'all' | 'order' | 'pdf'): Promise<ArchiveEntry[]> {
  const pool = await getPool();
  const params: unknown[] = [];
  let where = '';

  if (itemType && itemType !== 'all') {
    params.push(itemType);
    where = `where item_type = $${params.length}`;
  }

  let explicitEntries: ArchiveEntry[] = [];
  try {
    const result = await pool.query(
      `
      select id, item_type, order_id, document_id, label, deleted_at, expires_at
      from deleted_archive_entries
      ${where}
      order by deleted_at desc
      `,
      params
    );

    explicitEntries = result.rows.map((row) => ({
      id: Number(row.id),
      item_type: row.item_type as 'order' | 'pdf',
      order_id: row.order_id === null ? null : Number(row.order_id),
      document_id: row.document_id === null ? null : Number(row.document_id),
      label: String(row.label),
      deleted_at: new Date(row.deleted_at).toISOString(),
      expires_at: new Date(row.expires_at).toISOString()
    }));
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }

  const fallbackRows = await fetchSoftDeletedFallbackEntries(itemType);

  const dedup = new Set(
    explicitEntries.map((entry) => `${entry.item_type}:${entry.order_id ?? '-'}:${entry.document_id ?? '-'}`)
  );

  const syntheticEntries: ArchiveEntry[] = [];
  fallbackRows.forEach((row, index) => {
    const key = `${row.item_type}:${row.order_id ?? '-'}:${row.document_id ?? '-'}`;
    if (dedup.has(key)) return;
    syntheticEntries.push({
      id: -(index + 1),
      ...row
    });
  });

  return [...explicitEntries, ...syntheticEntries].sort(
    (left, right) => new Date(right.deleted_at).getTime() - new Date(left.deleted_at).getTime()
  );
}

export async function restoreArchiveEntries(entryIds: number[]): Promise<number> {
  if (entryIds.length === 0) return 0;

  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const entriesResult = await client.query(
      `
      select id, item_type, order_id, document_id
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
    }>;

    for (const entry of entries) {
      if (entry.item_type === 'order' && entry.order_id) {
        await client.query('update orders set deleted_at = null where id = $1', [entry.order_id]);
      }

      if (entry.item_type === 'pdf' && entry.document_id) {
        await client.query('update order_documents set deleted_at = null where id = $1', [entry.document_id]);
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

export async function restoreArchiveTargets(targets: RestoreTarget[]): Promise<number> {
  if (targets.length === 0) return 0;

  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const target of targets) {
      if (target.item_type === 'order' && target.order_id) {
        await client.query('update orders set deleted_at = null where id = $1', [target.order_id]);
        await client.query('delete from deleted_archive_entries where item_type = $1 and order_id = $2', ['order', target.order_id]);
      }

      if (target.item_type === 'pdf' && target.document_id) {
        await client.query('update order_documents set deleted_at = null where id = $1', [target.document_id]);
        await client.query('delete from deleted_archive_entries where item_type = $1 and document_id = $2', ['pdf', target.document_id]);
      }
    }

    await client.query('COMMIT');
    return targets.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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
  try {
    const pool = await getPool();
    const result = await pool.query(
      'select id from deleted_archive_entries where expires_at <= now() order by id asc limit 200'
    );

    const ids = result.rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
    if (ids.length === 0) return 0;
    return permanentlyDeleteArchiveEntries(ids);
  } catch (error) {
    if (isMissingRelationError(error)) return 0;
    throw error;
  }
}
