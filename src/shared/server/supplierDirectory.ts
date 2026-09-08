import 'server-only';

import type { PoolClient } from 'pg';
import type { SchoolDirectoryRow } from '@/shared/domain/schoolDirectory';
import {
  SUPPLIER_DIRECTORY_COLUMNS,
  SUPPLIER_DIRECTORY_MAX_ROWS,
  SupplierDirectoryValidationError,
  parseSupplierDirectoryMutation,
  type SupplierDirectoryData,
  type SupplierDirectoryMutation
} from '@/shared/domain/supplierDirectory';
import type { AuditActor, AuditDiff } from '@/shared/audit/auditTypes';
import { getPool } from '@/shared/server/db';
import { insertAuditEvent } from '@/shared/server/audit';

export class SupplierDirectoryConflictError extends Error {
  constructor(message: string, readonly rows: SchoolDirectoryRow[], readonly missingRowIds: string[] = []) {
    super(message);
  }
  get row() { return this.rows[0]; }
}

type StoredRow = {
  id: string;
  position: number;
  cells: Record<string, string>;
  catalog_item_id: string | null;
  article_label: string;
  updated_at: Date;
};
type MutationResult = {
  updatedAt: string;
  row?: SchoolDirectoryRow;
  rows?: SchoolDirectoryRow[];
  deletedRowIds?: string[];
};
type AuditContext = { actor: AuditActor; requestId: string; ipHash: string | null; userAgentHash: string | null };
const emptyCells = () => Object.fromEntries(SUPPLIER_DIRECTORY_COLUMNS.map(column => [column.id, '']));
const publicRow = (row: StoredRow): SchoolDirectoryRow => ({ id: row.id, position: row.position, cells: { ...emptyCells(), ...row.cells } });
const articleLabel = (row: { item_name: string; sku: string | null }) => row.sku ? `${row.item_name} (${row.sku})` : row.item_name;

export async function getSupplierDirectory(): Promise<SupplierDirectoryData> {
  const pool = await getPool();
  const [rowResult, catalogResult] = await Promise.all([
    pool.query<StoredRow>('select id, position, cells, catalog_item_id::text, article_label, updated_at from catalog_supplier_rows order by position, id'),
    pool.query<{ id: string; item_name: string; sku: string | null; status: string }>(
      `select id::text, item_name, sku, status from catalog_items
       where status <> 'deleted' or id in (select catalog_item_id from catalog_supplier_rows)
       order by position, item_name, id`)
  ]);
  const articles = catalogResult.rows.map(row => ({ value: row.id, label: articleLabel(row), disabled: row.status === 'deleted' }));
  const knownIds = new Set(articles.map(article => article.value));
  for (const row of rowResult.rows) {
    if (row.cells.artikel && !knownIds.has(row.cells.artikel)) {
      articles.push({ value: row.cells.artikel, label: `${row.article_label || 'Odstranjen artikel'} (odstranjen)`, disabled: true });
      knownIds.add(row.cells.artikel);
    }
  }
  return {
    columns: SUPPLIER_DIRECTORY_COLUMNS,
    rows: rowResult.rows.map(publicRow),
    articles,
    updatedAt: rowResult.rows.reduce<string | null>((latest, row) => {
      const date = new Date(row.updated_at).toISOString();
      return !latest || date > latest ? date : latest;
    }, null),
    persistenceAvailable: true
  };
}

async function lockRows(client: PoolClient, ids: string[]) {
  const result = await client.query<StoredRow>(
    `select id, position, cells, catalog_item_id::text, article_label, updated_at
     from catalog_supplier_rows where id = any($1::text[]) order by id for update`, [ids]
  );
  return result.rows;
}
function verifySnapshots(requested: Array<{ rowId: string; expectedCells: Record<string, string> }>, rows: StoredRow[]) {
  const byId = new Map(rows.map(row => [row.id, row]));
  const missing: string[] = [];
  const changed: SchoolDirectoryRow[] = [];
  for (const request of requested) {
    const current = byId.get(request.rowId);
    if (!current) missing.push(request.rowId);
    else if (Object.entries(request.expectedCells).some(([key, value]) => (current.cells[key] ?? '') !== value)) changed.push(publicRow(current));
  }
  if (missing.length || changed.length) {
    throw new SupplierDirectoryConflictError('Podatki dobavitelja so se med urejanjem spremenili.', changed, missing);
  }
}
async function nextPosition(client: PoolClient, amount: number) {
  const result = await client.query<{ position: number; count: number }>(
    'select coalesce(min(position), 0)::integer as position, count(*)::integer as count from catalog_supplier_rows'
  );
  if (result.rows[0].count + amount > SUPPLIER_DIRECTORY_MAX_ROWS) {
    throw new SupplierDirectoryValidationError('Doseženo je največje dovoljeno število dobaviteljev.');
  }
  return result.rows[0].position - amount;
}
async function auditRows(client: PoolClient, context: AuditContext, action: 'created' | 'updated' | 'deleted', rows: StoredRow[], before: StoredRow[] = []) {
  const beforeMap = new Map(before.map(row => [row.id, row]));
  for (const row of rows) {
    const previous = beforeMap.get(row.id);
    const diff: AuditDiff = {};
    for (const column of SUPPLIER_DIRECTORY_COLUMNS) {
      const beforeValue = column.id === 'artikel' ? previous?.article_label : previous?.cells[column.id];
      const afterValue = column.id === 'artikel' ? row.article_label : row.cells[column.id];
      if (action === 'deleted' || beforeValue !== afterValue) diff[column.id] = {
        label: column.label,
        before: action === 'deleted' ? afterValue : beforeValue ?? '',
        after: action === 'deleted' ? '' : afterValue
      };
    }
    await insertAuditEvent({
      ...context,
      entityType: 'system',
      entityId: `supplier:${row.id}`,
      entityLabel: row.cells.dobavitelj || 'Dobavitelj',
      action,
      summary: action === 'created' ? 'Dobavitelj dodan' : action === 'deleted' ? 'Dobavitelj izbrisan' : 'Dobavitelj posodobljen',
      diff,
      metadata: { route: '/admin/artikli?view=suppliers', section: 'Dobavitelji', catalog_item_id: row.catalog_item_id }
    }, client);
  }
}

async function applyMutation(client: PoolClient, mutation: SupplierDirectoryMutation, audit: AuditContext): Promise<Omit<MutationResult, 'updatedAt'>> {
  if (mutation.operation === 'update-row') {
    const rows = await lockRows(client, [mutation.rowId]);
    verifySnapshots([{ rowId: mutation.rowId, expectedCells: mutation.expectedCells }], rows);
    const row = rows[0];
    let catalogItemId = row.catalog_item_id;
    let label = row.article_label;
    if (Object.hasOwn(mutation.cells, 'artikel')) {
      const articleId = mutation.cells.artikel;
      if (articleId) {
        const article = await client.query<{ id: string; item_name: string; sku: string | null }>(
          "select id::text, item_name, sku from catalog_items where id = $1 and status <> 'deleted' for key share", [articleId]
        );
        if (!article.rowCount) throw new SupplierDirectoryValidationError('Izbrani artikel ne obstaja več. Osvežite seznam.');
        catalogItemId = article.rows[0].id;
        label = articleLabel(article.rows[0]);
      } else { catalogItemId = null; label = ''; }
    }
    const result = await client.query<StoredRow>(
      `update catalog_supplier_rows set cells = cells || $2::jsonb, catalog_item_id = $3, article_label = $4, updated_at = now()
       where id = $1 returning id, position, cells, catalog_item_id::text, article_label, updated_at`,
      [row.id, JSON.stringify(mutation.cells), catalogItemId, label]
    );
    await auditRows(client, audit, 'updated', result.rows, rows);
    return { row: publicRow(result.rows[0]) };
  }
  await client.query("select pg_advisory_xact_lock(hashtext('catalog-supplier-directory'))");
  if (mutation.operation === 'add-row') {
    const position = await nextPosition(client, 1);
    const result = await client.query<StoredRow>(
      `insert into catalog_supplier_rows(id, position, cells) values ($1,$2,$3::jsonb)
       on conflict (id) do nothing returning id, position, cells, catalog_item_id::text, article_label, updated_at`,
      [mutation.rowId, position, JSON.stringify(emptyCells())]
    );
    if (!result.rowCount) throw new SupplierDirectoryValidationError('Vrstica s to oznako že obstaja.');
    await auditRows(client, audit, 'created', result.rows);
    return { row: publicRow(result.rows[0]) };
  }
  const requested = mutation.rows.map(row => ({
    rowId: 'sourceRowId' in row ? row.sourceRowId : row.rowId,
    expectedCells: row.expectedCells
  }));
  const rows = await lockRows(client, requested.map(row => row.rowId));
  verifySnapshots(requested, rows);
  if (mutation.operation === 'delete-rows') {
    await client.query('delete from catalog_supplier_rows where id = any($1::text[])', [requested.map(row => row.rowId)]);
    await auditRows(client, audit, 'deleted', rows);
    return { deletedRowIds: requested.map(row => row.rowId) };
  }
  const position = await nextPosition(client, mutation.rows.length);
  const byId = new Map(rows.map(row => [row.id, row]));
  const newRows: StoredRow[] = [];
  for (const [index, requestedRow] of mutation.rows.entries()) {
    const source = byId.get(requestedRow.sourceRowId)!;
    const result = await client.query<StoredRow>(
      `insert into catalog_supplier_rows(id,position,cells,catalog_item_id,article_label) values ($1,$2,$3::jsonb,$4,$5)
       on conflict(id) do nothing returning id, position, cells, catalog_item_id::text, article_label, updated_at`,
      [requestedRow.newRowId, position + index, JSON.stringify(source.cells), source.catalog_item_id, source.article_label]
    );
    if (!result.rowCount) throw new SupplierDirectoryValidationError('Nova vrstica s to oznako že obstaja.');
    newRows.push(result.rows[0]);
  }
  await auditRows(client, audit, 'created', newRows);
  return { rows: newRows.map(publicRow) };
}

export async function mutateSupplierDirectory(input: unknown, audit: AuditContext): Promise<MutationResult> {
  const mutation = parseSupplierDirectoryMutation(input);
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await applyMutation(client, mutation, audit);
    await client.query('commit');
    return { ...result, updatedAt: new Date().toISOString() };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { client.release(); }
}