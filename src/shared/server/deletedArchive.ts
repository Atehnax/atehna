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
    await enforceCurrentPricingRevisionForRestoredDocuments(client, selectedPdfCandidates);
    await enforceImmutableQuotePurchaseOrderEvidence(client, selectedPdfCandidates);

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
    await enforceCurrentPricingRevisionForRestoredDocuments(client, selectedPdfCandidates);
    await enforceImmutableQuotePurchaseOrderEvidence(client, selectedPdfCandidates);

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
