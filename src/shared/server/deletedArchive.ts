import { getPool } from '@/shared/server/db';
import { deleteBlob } from '@/shared/server/blob';
import { instrumentCatalogLoader } from '@/shared/server/catalogDiagnostics';

const isMissingRelationError = (error: unknown) =>
  Boolean(error && typeof error === 'object' && 'code' in error && error.code === '42P01');

export type ArchiveEntry = {
  id: number;
  item_type: 'order' | 'pdf';
  order_id: number | null;
  document_id: number | null;
  label: string;
  order_created_at: string | null;
  customer_name: string | null;
  address: string | null;
  customer_type: string | null;
  deleted_at: string;
  expires_at: string;
};

export type RestoreTarget = {
  item_type: 'order' | 'pdf';
  order_id: number | null;
  document_id: number | null;
};

async function enforceParentOrderRestoreForDeletedPdfChildren(
  client: { query: (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> },
  selectedOrderIds: number[],
  pdfCandidates: Array<{ order_id: number | null; document_id: number | null }>
) {
  const normalizedSelectedOrders = new Set(selectedOrderIds.filter((id) => Number.isFinite(id) && id > 0));

  const resolvedOrderIds = new Set<number>();
  for (const candidate of pdfCandidates) {
    if (candidate.order_id && candidate.order_id > 0) {
      resolvedOrderIds.add(candidate.order_id);
      continue;
    }

    if (candidate.document_id && candidate.document_id > 0) {
      const documentResult = await client.query('select order_id from order_documents where id = $1 limit 1', [candidate.document_id]);
      const rawOrderId = documentResult.rows[0]?.order_id;
      if (rawOrderId !== undefined && rawOrderId !== null) {
        const resolved = Number(rawOrderId);
        if (Number.isFinite(resolved) && resolved > 0) {
          resolvedOrderIds.add(resolved);
        }
      }
    }
  }

  const orderIds = Array.from(resolvedOrderIds);
  if (orderIds.length === 0) return;

  const deletedParentsResult = await client.query(
    'select id from orders where id = any($1::bigint[]) and deleted_at is not null',
    [orderIds]
  );

  const deletedParentIds = deletedParentsResult.rows
    .map((row) => Number(row.id))
    .filter((id) => Number.isFinite(id) && id > 0);

  const orphanAttempt = deletedParentIds.find((orderId) => !normalizedSelectedOrders.has(orderId));
  if (orphanAttempt) {
    throw new Error('PDF pod izbrisanim naročilom ni mogoče obnoviti brez obnove pripadajočega naročila.');
  }
}

export async function fetchArchiveEntries(itemType?: 'all' | 'order' | 'pdf'): Promise<ArchiveEntry[]> {
  return instrumentCatalogLoader('fetchArchiveEntries', '/admin/arhiv', async () => {
    const pool = await getPool();
    const params: unknown[] = [];
    let where = '';

    if (itemType && itemType !== 'all') {
      params.push(itemType);
      where = `where e.item_type = $${params.length}`;
    }

    const result = await pool.query(
      `
        select
          e.id,
          e.item_type,
          e.order_id,
          e.document_id,
          e.label,
          coalesce(e.payload->>'orderCreatedAt', o.created_at::text) as order_created_at,
          coalesce(e.payload->>'customerName', o.contact_name) as customer_name,
          coalesce(e.payload->>'address', o.delivery_address) as address,
          coalesce(e.payload->>'customerType', o.customer_type) as customer_type,
          e.deleted_at,
          e.expires_at
        from deleted_archive_entries e
        left join orders o on o.id = e.order_id
        ${where}
        order by e.deleted_at desc
        `,
      params
    );

    return result.rows.map((row) => ({
      id: Number(row.id),
      item_type: row.item_type as 'order' | 'pdf',
      order_id: row.order_id === null ? null : Number(row.order_id),
      document_id: row.document_id === null ? null : Number(row.document_id),
      label: String(row.label),
      order_created_at: row.order_created_at ? new Date(row.order_created_at).toISOString() : null,
      customer_name: row.customer_name ? String(row.customer_name) : null,
      address: row.address ? String(row.address) : null,
      customer_type: row.customer_type ? String(row.customer_type) : null,
      deleted_at: new Date(row.deleted_at).toISOString(),
      expires_at: new Date(row.expires_at).toISOString()
    }));
  });
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

    const selectedOrderIds = entries
      .filter((entry) => entry.item_type === 'order' && entry.order_id)
      .map((entry) => Number(entry.order_id));

    const selectedPdfCandidates = entries
      .filter((entry) => entry.item_type === 'pdf')
      .map((entry) => ({ order_id: entry.order_id, document_id: entry.document_id }));

    await enforceParentOrderRestoreForDeletedPdfChildren(client, selectedOrderIds, selectedPdfCandidates);

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

    const selectedOrderIds = targets
      .filter((target) => target.item_type === 'order' && target.order_id)
      .map((target) => Number(target.order_id));

    const selectedPdfCandidates = targets
      .filter((target) => target.item_type === 'pdf')
      .map((target) => ({ order_id: target.order_id, document_id: target.document_id }));

    await enforceParentOrderRestoreForDeletedPdfChildren(client, selectedOrderIds, selectedPdfCandidates);

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
