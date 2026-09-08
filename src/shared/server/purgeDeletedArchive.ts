import type { PoolClient } from 'pg';
import { getPool } from '@/shared/server/db';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import type { RestoreTarget } from '@/shared/domain/archive/archiveTypes';

export class ArchiveDeleteConflictError extends Error {
  readonly code = 'ARCHIVE_DELETE_CONFLICT';
}

type Entry = { id: number; item_type: 'order' | 'pdf'; order_id: number | null; document_id: number | null; label: string };
const positiveIds = (values: Array<number | null>) => [...new Set(values.filter((value): value is number => Number.isSafeInteger(value) && Number(value) > 0))];

async function queueDocumentDeletion(client: PoolClient, documentIds: number[]) {
  if (!documentIds.length) return;
  // The existing storage lifecycle processes these durable intents and rechecks
  // retained references before removing private bytes from the blob store.
  await client.query(`
    insert into archive_blob_deletion_outbox (blob_target, source_item_type, source_order_id, source_document_id)
    select d.blob_pathname, 'pdf', min(d.order_id), min(d.id)
    from order_documents d
    where d.id = any($1::bigint[])
      and not exists (select 1 from order_documents retained where retained.blob_pathname = d.blob_pathname and retained.id <> all($1::bigint[]))
      and not exists (select 1 from quote_documents retained where retained.blob_pathname = d.blob_pathname)
      and not exists (select 1 from quote_manual_documents retained where retained.blob_pathname = d.blob_pathname)
    group by d.blob_pathname
    on conflict (blob_target) do nothing
  `, [documentIds]);
}

export async function permanentlyDeleteArchiveEntries(request: Request, ids: number[], targets: RestoreTarget[]) {
  const client = await (await getPool()).connect();
  try {
    await client.query('BEGIN');
    // Targets only resolve existing trash entries; callers cannot delete an
    // active order or document by submitting its resource id directly.
    const result = await client.query<Entry>(`
      select e.id, e.item_type, e.order_id, e.document_id, e.label
      from deleted_archive_entries e
      where e.id = any($1::bigint[]) or exists (
        select 1 from jsonb_to_recordset($2::jsonb) as t(item_type text, order_id bigint, document_id bigint)
        where t.item_type = e.item_type
          and t.order_id is not distinct from e.order_id
          and t.document_id is not distinct from e.document_id
      )
      order by e.id for update
    `, [ids, JSON.stringify(targets)]);
    const entries = result.rows.map(entry => ({ ...entry, id: Number(entry.id), order_id: entry.order_id == null ? null : Number(entry.order_id), document_id: entry.document_id == null ? null : Number(entry.document_id) }));
    const missingSelection = ids.some(id => !entries.some(entry => entry.id === id)) || targets.some(target => !entries.some(entry =>
      entry.item_type === target.item_type && entry.order_id === target.order_id && entry.document_id === target.document_id));
    if (!entries.length || missingSelection) throw new ArchiveDeleteConflictError('Izbrani zapisi niso več v košu. Osvežite stran.');
    const orderIds = positiveIds(entries.filter(entry => entry.item_type === 'order').map(entry => entry.order_id));
    const selectedDocumentIds = positiveIds(entries.filter(entry => entry.item_type === 'pdf').map(entry => entry.document_id));
    const relatedOrderIds = positiveIds(entries.map(entry => entry.order_id));
    const orders = await client.query(`select id, deleted_at, source_quote_offer_version_id from orders where id = any($1::bigint[]) order by id for update`, [relatedOrderIds]);
    for (const id of orderIds) {
      const order = orders.rows.find(row => Number(row.id) === id);
      if (order && !order.deleted_at) throw new ArchiveDeleteConflictError('Naročilo je bilo že obnovljeno. Osvežite stran.');
      if (order?.source_quote_offer_version_id != null) throw new ArchiveDeleteConflictError('Naročilo je povezano z dokazom sprejema ponudbe in ga ni mogoče trajno izbrisati.');
    }
    const evidence = await client.query(`
      select order_id from order_stock_holds where order_id = any($1::bigint[])
      union all select order_id from order_historical_changes where order_id = any($1::bigint[])
      limit 1
    `, [orderIds]);
    if (evidence.rows.length) throw new ArchiveDeleteConflictError('Naročilo ima trajno evidenco zaloge ali zgodovinskih sprememb in ga ni mogoče trajno izbrisati. Dokumente v košu lahko izberete posebej.');
    const documents = await client.query(`
      select d.id, d.order_id, d.deleted_at, d.type, o.source_quote_offer_version_id
      from order_documents d join orders o on o.id = d.order_id
      where d.id = any($1::bigint[]) or d.order_id = any($2::bigint[])
      order by d.id for update of d
    `, [selectedDocumentIds, orderIds]);
    for (const document of documents.rows) {
      if (!orderIds.includes(Number(document.order_id)) && !document.deleted_at) throw new ArchiveDeleteConflictError('Dokument je bil že obnovljen. Osvežite stran.');
      if (document.type === 'purchase_order' && document.source_quote_offer_version_id != null) throw new ArchiveDeleteConflictError('Naročilnice, ki je dokaz sprejema ponudbe, ni mogoče trajno izbrisati.');
    }
    const documentIds = positiveIds(documents.rows.map(document => Number(document.id)));
    await queueDocumentDeletion(client, documentIds);
    await client.query('delete from order_documents where id = any($1::bigint[])', [documentIds]);
    await client.query('delete from orders where id = any($1::bigint[]) and deleted_at is not null', [orderIds]);
    const deleted = await client.query(`
      delete from deleted_archive_entries
      where id = any($1::bigint[]) or order_id = any($2::bigint[]) or document_id = any($3::bigint[])
      returning id
    `, [entries.map(entry => entry.id), orderIds, documentIds]);
    for (const entry of entries) {
      await insertAuditEventForRequest(request, {
        entityType: 'order', entityId: String(entry.order_id ?? entry.document_id ?? entry.id),
        entityLabel: entry.label, action: 'deleted',
        summary: entry.item_type === 'order' ? 'Naročilo trajno izbrisano' : 'Dokument trajno izbrisan',
        metadata: { permanent_delete: true, archive_entry_id: entry.id, item_type: entry.item_type, order_id: entry.order_id, document_id: entry.document_id }
      }, client);
    }
    await client.query('COMMIT');
    return { deletedCount: deleted.rowCount ?? 0, deletedIds: deleted.rows.map(row => Number(row.id)) };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error && typeof error === 'object' && 'code' in error && error.code === '23503') throw new ArchiveDeleteConflictError('Zapis je povezan s trajno evidenco in ga ni mogoče trajno izbrisati.');
    throw error;
  } finally {
    client.release();
  }
}
