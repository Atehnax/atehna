import { insertAuditEventForRequest } from '@/shared/server/audit';
import { getPool } from '@/shared/server/db';
import { instrumentCatalogLoader } from '@/shared/server/diagnostics/instrumentation';
import type { ArchiveEntry, ArchiveItemType, RestoreTarget } from '@/shared/domain/archive/archiveTypes';

export class ArchiveRestoreConflictError extends Error {
  constructor(
    message: string,
    readonly code = 'ARCHIVE_DOCUMENT_PRICING_REVISION_MISMATCH'
  ) {
    super(message);
  }
}

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
  expires_at: DatabaseDateValue | null;
};


type ArchiveTransactionClient = {
  query: (
    text: string,
    params?: unknown[]
  ) => Promise<{ rows: Array<Record<string, unknown>> }>;
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

async function enforceCurrentPricingRevisionForRestoredDocuments(
  client: ArchiveTransactionClient,
  pdfCandidates: Array<{ order_id: number | null; document_id: number | null }>
) {
  const documentIds = pdfCandidates
    .map((candidate) => Number(candidate.document_id))
    .filter((documentId) => Number.isSafeInteger(documentId) && documentId > 0);
  if (documentIds.length === 0) return;

  const staleResult = await client.query(
    `
      select d.id
      from order_documents d
      join orders o on o.id = d.order_id
      where d.id = any($1::bigint[])
        and (
          d.order_pricing_revision <> o.pricing_revision
          or (
            d.type = 'dobavnica'
            and d.order_delivery_plan_revision <> o.delivery_plan_revision
          )
        )
      for update of d, o
    `,
    [documentIds]
  );
  if (staleResult.rows.length > 0) {
    throw new ArchiveRestoreConflictError(
      'Dokumenta ni mogoče obnoviti, ker se je po izdaji spremenila cena, poštnina ali načrt dobave naročila.'
    );
  }
}

async function enforceImmutableQuotePurchaseOrderEvidence(
  client: ArchiveTransactionClient,
  pdfCandidates: Array<{ order_id: number | null; document_id: number | null }>
) {
  const documentIds = pdfCandidates
    .map((candidate) => Number(candidate.document_id))
    .filter((documentId) => Number.isSafeInteger(documentId) && documentId > 0);
  if (documentIds.length === 0) return;

  const quoteEvidenceResult = await client.query(
    `
      select document.id
      from order_documents document
      join orders order_record on order_record.id = document.order_id
      where document.id = any($1::bigint[])
        and document.type = 'purchase_order'
        and order_record.source_quote_offer_version_id is not null
      for update of document, order_record
    `,
    [documentIds]
  );
  if (quoteEvidenceResult.rows.length > 0) {
    throw new ArchiveRestoreConflictError(
      'Naročilnice, ki je dokaz sprejema ponudbe, ni mogoče obnoviti prek koša.',
      'ARCHIVE_QUOTE_PURCHASE_ORDER_IMMUTABLE'
    );
  }
}

export async function fetchArchiveEntries(itemType?: 'all' | ArchiveItemType): Promise<ArchiveEntry[]> {
  return instrumentCatalogLoader('fetchArchiveEntries', '/admin/trash', async () => {
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
      expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : null
    }));
  });
}

type LockedArchiveEntry = { id: number; item_type: ArchiveItemType; order_id: number | null; document_id: number | null; label: string };
const restoreIds = (values: Array<number | null>) => [...new Set(values.filter((value): value is number => Number.isSafeInteger(value) && Number(value) > 0))];
const staleRestoreSelection = () => new ArchiveRestoreConflictError('Izbrani zapisi niso več v košu. Osvežite stran.', 'ARCHIVE_RESTORE_CONFLICT');

/** Resolve both selection forms once, with the same archive → order → document lock order as purge. */
export async function restoreArchiveSelection(entryIds: number[], targets: RestoreTarget[], request?: Request): Promise<number> {
  if (!entryIds.length && !targets.length) return 0;
  const client = await (await getPool()).connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<LockedArchiveEntry>(`
      select e.id, e.item_type, e.order_id, e.document_id, e.label
      from deleted_archive_entries e
      where e.id = any($1::bigint[]) or exists (
        select 1 from jsonb_to_recordset($2::jsonb) as t(item_type text, order_id bigint, document_id bigint)
        where t.item_type = e.item_type
          and t.order_id is not distinct from e.order_id
          and t.document_id is not distinct from e.document_id
      )
      order by e.id for update
    `, [entryIds, JSON.stringify(targets)]);
    const entries = result.rows.map(entry => ({ ...entry, id: Number(entry.id), order_id: entry.order_id == null ? null : Number(entry.order_id), document_id: entry.document_id == null ? null : Number(entry.document_id) }));
    const missing = entryIds.some(id => !entries.some(entry => entry.id === id)) || targets.some(target => !entries.some(entry =>
      entry.item_type === target.item_type && entry.order_id === target.order_id && entry.document_id === target.document_id));
    if (!entries.length || missing) throw staleRestoreSelection();
    const orderIds = restoreIds(entries.filter(entry => entry.item_type === 'order').map(entry => entry.order_id));
    const pdfEntries = entries.filter(entry => entry.item_type === 'pdf');
    const documentIds = restoreIds(pdfEntries.map(entry => entry.document_id));
    if (entries.some(entry => entry.item_type === 'order' ? !orderIds.includes(entry.order_id!) : !documentIds.includes(entry.document_id!))) throw staleRestoreSelection();

    // Legacy PDF archive entries may omit their parent ID. Resolve it before
    // locking resources, then verify it again on the locked document below.
    const parents = await client.query('select id, order_id from order_documents where id = any($1::bigint[])', [documentIds]);
    const relatedOrderIds = restoreIds([...entries.map(entry => entry.order_id), ...parents.rows.map(row => Number(row.order_id))]);
    const orders = await client.query('select id, deleted_at from orders where id = any($1::bigint[]) order by id for update', [relatedOrderIds]);
    const documents = await client.query('select id, order_id, deleted_at from order_documents where id = any($1::bigint[]) order by id for update', [documentIds]);
    for (const id of orderIds) {
      const order = orders.rows.find(row => Number(row.id) === id);
      if (!order?.deleted_at) throw staleRestoreSelection();
    }
    for (const entry of pdfEntries) {
      const document = documents.rows.find(row => Number(row.id) === entry.document_id);
      if (!document?.deleted_at || !orders.rows.some(row => Number(row.id) === Number(document.order_id)) ||
        (entry.order_id !== null && entry.order_id !== Number(document.order_id))) throw staleRestoreSelection();
    }
    const selectedPdfCandidates = documents.rows.map(row => ({ order_id: Number(row.order_id), document_id: Number(row.id) }));
    await enforceParentOrderRestoreForDeletedPdfChildren(client, orderIds, selectedPdfCandidates);
    await enforceCurrentPricingRevisionForRestoredDocuments(client, selectedPdfCandidates);
    await enforceImmutableQuotePurchaseOrderEvidence(client, selectedPdfCandidates);

    const restoredOrders = await client.query('update orders set deleted_at = null where id = any($1::bigint[]) and deleted_at is not null returning id', [orderIds]);
    const restoredDocuments = await client.query('update order_documents set deleted_at = null where id = any($1::bigint[]) and deleted_at is not null returning id', [documentIds]);
    if (restoredOrders.rows.length !== orderIds.length || restoredDocuments.rows.length !== documentIds.length) throw staleRestoreSelection();
    const removedEntries = await client.query('delete from deleted_archive_entries where id = any($1::bigint[]) returning id', [entries.map(entry => entry.id)]);
    if (removedEntries.rows.length !== entries.length) throw staleRestoreSelection();
    if (request) for (const entry of entries) {
      await insertAuditEventForRequest(request, {
        entityType: 'order', entityId: String(entry.order_id ?? entry.document_id ?? entry.id),
        entityLabel: entry.item_type === 'order' ? `Naročilo ${entry.label.split(' ')[0] ?? entry.order_id}` : entry.label,
        action: 'restored', summary: entry.item_type === 'order' ? 'Naročilo obnovljeno' : 'Dokument obnovljen',
        diff: { status: { label: 'Status', before: 'v košu', after: 'obnovljeno' } },
        metadata: { archive_entry_id: entry.id, item_type: entry.item_type, order_id: entry.order_id, document_id: entry.document_id }
      }, client);
    }
    await client.query('COMMIT');
    return entries.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function restoreArchiveEntries(entryIds: number[]): Promise<number> {
  return restoreArchiveSelection(entryIds, []);
}
export async function restoreArchiveTargets(targets: RestoreTarget[]): Promise<number> {
  return restoreArchiveSelection([], targets);
}
