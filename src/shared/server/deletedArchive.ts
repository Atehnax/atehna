import { getPool } from '@/shared/server/db';
import {
  deleteBlob,
  deletePrivateOrderDocumentBlob
} from '@/shared/server/blob';
import { instrumentCatalogLoader } from '@/shared/server/catalogDiagnostics';
import type { ArchiveEntry, ArchiveItemType, RestoreTarget } from '@/shared/domain/archive/archiveTypes';

type DatabaseDateValue = string | number | Date;

type ArchiveEntryRow = {
  id: number | string;
  item_type: ArchiveItemType;
  order_id: number | string | null;
  document_id: number | string | null;
  label: string;
  order_created_at: DatabaseDateValue | null;
  customer_name: string | null;
  address: string | null;
  customer_type: string | null;
  deleted_at: DatabaseDateValue;
  expires_at: DatabaseDateValue;
};

type ArchiveBlobOutboxRow = {
  id: number | string;
  blob_target: string;
  source_item_type: string;
};

type ArchiveTransactionClient = {
  query: (
    text: string,
    params?: unknown[]
  ) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

async function queueDocumentBlobsForOrder(
  client: ArchiveTransactionClient,
  orderId: number
) {
  await client.query(
    `
    insert into archive_blob_deletion_outbox (
      blob_target,
      source_item_type,
      source_order_id,
      source_document_id
    )
    select
      blob_pathname,
      'order',
      order_id,
      id
    from order_documents
    where order_id = $1
    on conflict (blob_target) do nothing
    `,
    [orderId]
  );
}

async function queueDocumentBlob(
  client: ArchiveTransactionClient,
  documentId: number
) {
  await client.query(
    `
    insert into archive_blob_deletion_outbox (
      blob_target,
      source_item_type,
      source_order_id,
      source_document_id
    )
    select
      d.blob_pathname,
      'pdf',
      d.order_id,
      d.id
    from order_documents d
    where d.id = $1
    on conflict (blob_target) do nothing
    `,
    [documentId]
  );
}

export async function processArchiveBlobDeletionOutbox(limit = 200): Promise<{
  deletedCount: number;
  failedCount: number;
  skippedCount: number;
}> {
  const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
  const pool = await getPool();
  const result = await pool.query<ArchiveBlobOutboxRow>(
    `
    select id, blob_target, source_item_type
    from archive_blob_deletion_outbox
    order by queued_at asc, id asc
    limit $1
    `,
    [safeLimit]
  );

  let deletedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const row of result.rows) {
    const id = Number(row.id);
    if (!Number.isFinite(id) || !row.blob_target) continue;

    try {
      const referenceResult = await pool.query<{ still_referenced: boolean }>(
        `
        select (
          exists (
            select 1
            from order_documents
            where blob_pathname = $1
          )
          or exists (
            select 1
            from catalog_media
            where blob_pathname = $1
               or blob_url = $1
          )
        ) as still_referenced
        `,
        [row.blob_target]
      );

      if (referenceResult.rows[0]?.still_referenced) {
        await pool.query(
          `
          update archive_blob_deletion_outbox
          set
            last_attempt_at = now(),
            last_error = 'Blob deletion deferred while the target is still referenced.'
          where id = $1
          `,
          [id]
        );
        skippedCount += 1;
        continue;
      }

      if (row.source_item_type === 'order' || row.source_item_type === 'pdf') {
        await deletePrivateOrderDocumentBlob(row.blob_target);
      } else {
        await deleteBlob(row.blob_target);
      }
      await pool.query('delete from archive_blob_deletion_outbox where id = $1', [id]);
      deletedCount += 1;
    } catch (error) {
      failedCount += 1;
      await pool.query(
        `
        update archive_blob_deletion_outbox
        set
          attempt_count = attempt_count + 1,
          last_attempt_at = now(),
          last_error = $2
        where id = $1
        `,
        [
          id,
          (error instanceof Error ? error.message : 'Unknown blob deletion error').slice(0, 2000)
        ]
      );
    }
  }

  return { deletedCount, failedCount, skippedCount };
}

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
      const documentResult = await client.query('select order_id from order_documents where id = $1 limit 1', [
        candidate.document_id
      ]);
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

export async function fetchArchiveEntries(itemType?: 'all' | ArchiveItemType): Promise<ArchiveEntry[]> {
  return instrumentCatalogLoader('fetchArchiveEntries', '/admin/arhiv', async () => {
    const pool = await getPool();
    const params: unknown[] = [];
    let where = '';

    if (itemType && itemType !== 'all') {
      params.push(itemType);
      where = `where e.item_type = $${params.length}`;
    }

    const result = await pool.query<ArchiveEntryRow>(
      `
      select
        e.id,
        e.item_type,
        e.order_id,
        e.document_id,
        e.label,
        coalesce(e.payload->>'orderCreatedAt', o.created_at::text) as order_created_at,
        coalesce(e.payload->>'customerName', o.contact_name) as customer_name,
        coalesce(
          e.payload->>'address',
          nullif(
            concat_ws(
              ', ',
              nullif(btrim(o.address_line1), ''),
              nullif(btrim(o.address_line2), ''),
              nullif(concat_ws(' ', nullif(btrim(o.postal_code), ''), nullif(btrim(o.city), '')), ''),
              case when upper(coalesce(o.country_code, 'SI')) <> 'SI' then upper(o.country_code) end
            ),
            ''
          )
        ) as address,
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
      item_type: row.item_type,
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
        await client.query('delete from deleted_archive_entries where item_type = $1 and order_id = $2', [
          'order',
          target.order_id
        ]);
      }

      if (target.item_type === 'pdf' && target.document_id) {
        await client.query('update order_documents set deleted_at = null where id = $1', [target.document_id]);
        await client.query('delete from deleted_archive_entries where item_type = $1 and document_id = $2', [
          'pdf',
          target.document_id
        ]);
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
      select
        id,
        item_type,
        order_id,
        document_id,
        expires_at,
        expires_at <= now() as retention_expired
      from deleted_archive_entries
      where id = any($1::bigint[])
      for update
      `,
      [entryIds]
    );

    const entries = entriesResult.rows as Array<{
      id: number;
      item_type: 'order' | 'pdf';
      order_id: number | null;
      document_id: number | null;
      expires_at: DatabaseDateValue;
      retention_expired: boolean;
    }>;

    const retentionLockedEntry = entries.find((entry) => !entry.retention_expired);
    if (retentionLockedEntry) {
      throw new Error(
        'Trajni izbris je dovoljen šele po poteku 90-dnevne hrambe.'
      );
    }

    const selectedOrderIds = Array.from(new Set(
      entries
        .filter((entry) => entry.item_type === 'order' && entry.order_id)
        .map((entry) => Number(entry.order_id))
    ));
    const selectedOrderIdSet = new Set(selectedOrderIds);

    if (selectedOrderIds.length > 0) {
      const protectedChildrenResult = await client.query(
        `
        select id
        from deleted_archive_entries
        where item_type = 'pdf'
          and order_id = any($1::bigint[])
          and expires_at > now()
        limit 1
        `,
        [selectedOrderIds]
      );
      if (protectedChildrenResult.rows.length > 0) {
        throw new Error(
          'Trajni izbris naročila je dovoljen šele po poteku hrambe vseh pripadajočih dokumentov.'
        );
      }
    }

    const selectedPdfEntries = entries.filter(
      (entry) =>
        entry.item_type === 'pdf'
        && entry.document_id
        && !(entry.order_id && selectedOrderIdSet.has(Number(entry.order_id)))
    );

    for (const entry of selectedPdfEntries) {
      if (!entry.order_id) continue;
      const deletedParentResult = await client.query(
        'select id from orders where id = $1 and deleted_at is not null limit 1',
        [entry.order_id]
      );
      if (deletedParentResult.rows.length > 0) {
        throw new Error(
          'Dokument pod izbrisanim naročilom se trajno izbriše skupaj s pripadajočim naročilom.'
        );
      }
    }

    for (const orderId of selectedOrderIds) {
      await queueDocumentBlobsForOrder(client, orderId);
      await client.query('delete from orders where id = $1', [orderId]);
      await client.query('delete from deleted_archive_entries where order_id = $1', [orderId]);
    }

    for (const entry of selectedPdfEntries) {
      await queueDocumentBlob(client, Number(entry.document_id));
      await client.query('delete from order_documents where id = $1', [entry.document_id]);
    }

    await client.query('delete from deleted_archive_entries where id = any($1::bigint[])', [entryIds]);
    await client.query('COMMIT');

    await processArchiveBlobDeletionOutbox().catch(() => {
      // The durable outbox preserves failed targets for the next cleanup run.
    });

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
    `
    select e.id
    from deleted_archive_entries e
    where e.expires_at <= now()
      and not (
        e.item_type = 'order'
        and exists (
          select 1
          from deleted_archive_entries child
          where child.item_type = 'pdf'
            and child.order_id = e.order_id
            and child.expires_at > now()
        )
      )
      and (
        e.item_type = 'order'
        or not exists (
          select 1
          from orders o
          where o.id = e.order_id
            and o.deleted_at is not null
        )
      )
    order by e.id asc
    limit 200
    `
  );

  const ids = result.rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
  const deletedCount = ids.length === 0 ? 0 : await permanentlyDeleteArchiveEntries(ids);
  await processArchiveBlobDeletionOutbox();
  return deletedCount;
}
