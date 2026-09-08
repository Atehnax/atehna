import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import pg from 'pg';
import { assertAuthenticatedAdmin } from './support/auth';

let database: pg.Pool;
test.beforeAll(() => {
  const connectionString = process.env.E2E_DATABASE_URL;
  if (!connectionString) throw new Error('E2E_DATABASE_URL is required');
  database = new pg.Pool({ connectionString, ssl: false });
});
test.afterAll(async () => { await database.end(); });
test.beforeEach(async ({ request }) => { await assertAuthenticatedAdmin(request); });

test('archive trash action and confirmed permanent deletion remove only the selected order and keep its audit history', async ({ page, request }) => {
  const create = await request.post('/api/admin/orders');
  expect(create.ok()).toBeTruthy();
  const id = Number((await create.json()).orderId);
  const label = `Trash lifecycle ${randomUUID()}`;
  await database.query('update orders set contact_name=$2 where id=$1', [id, label]);
  expect((await request.patch(`/api/admin/orders/${id}/archive`, { data: { archived: true } })).ok()).toBeTruthy();
  await page.goto('/admin/orders?view=archive');
  const archiveDelete = page.getByRole('button', { name: 'Izbriši izbrana naročila', exact: true });
  await expect(archiveDelete).toBeVisible();
  await expect(archiveDelete).toBeDisabled();
  await page.getByRole('row').filter({ hasText: label }).getByRole('checkbox').check();
  await archiveDelete.click();
  const movedToTrash = page.waitForResponse(response => response.url().endsWith('/api/admin/orders/' + id) && response.request().method() === 'DELETE');
  await page.getByRole('dialog').getByRole('button', { name: 'Izbriši', exact: true }).click();
  expect((await movedToTrash).ok()).toBeTruthy();
  const entry = (await database.query("select id from deleted_archive_entries where item_type='order' and order_id=$1", [id])).rows[0];
  expect(entry).toBeTruthy();
  // Restoring from trash returns archived orders to their original archive.
  expect((await request.patch('/api/admin/archive', { data: { ids: [Number(entry.id)] } })).ok()).toBeTruthy();
  const restored = (await database.query('select deleted_at, archived_at from orders where id=$1', [id])).rows[0];
  expect(restored.deleted_at).toBeNull();
  expect(restored.archived_at).not.toBeNull();
  expect((await request.delete(`/api/admin/orders/${id}`)).ok()).toBeTruthy();
  await page.goto('/admin/trash');
  await page.getByRole('searchbox', { name: 'Poišči izbrisana naročila in dokumente' }).fill(label);
  const row = page.getByRole('row').filter({ hasText: label });
  await expect(row).toHaveCount(1);
  await row.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Trajno izbriši izbrano', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Obnova po izbrisu ni več mogoča.');
  await dialog.getByRole('button', { name: 'Prekliči', exact: true }).click();
  expect((await database.query('select id from orders where id=$1', [id])).rowCount).toBe(1);
  await page.getByRole('button', { name: 'Trajno izbriši izbrano', exact: true }).click();
  const deletion = page.waitForResponse(response => response.url().endsWith('/api/admin/archive') && response.request().method() === 'DELETE');
  await page.getByRole('dialog').getByRole('button', { name: 'Trajno izbriši', exact: true }).click();
  expect((await deletion).ok()).toBeTruthy();
  await expect(row).toHaveCount(0);
  expect((await database.query('select id from orders where id=$1', [id])).rowCount).toBe(0);
  expect((await database.query('select id from deleted_archive_entries where order_id=$1', [id])).rowCount).toBe(0);
  expect((await database.query("select id from audit_events where entity_type='order' and entity_id=$1 and metadata_json->>'permanent_delete'='true'", [String(id)])).rowCount).toBe(1);
  // Active resources cannot be targeted without a corresponding trash entry.
  const active = Number((await (await request.post('/api/admin/orders')).json()).orderId);
  const invalid = await request.delete('/api/admin/archive', { data: { targets: [{ item_type: 'order', order_id: active, document_id: null }] } });
  expect(invalid.status()).toBe(409);
  expect((await database.query('select id from orders where id=$1 and deleted_at is null', [active])).rowCount).toBe(1);
  await request.delete(`/api/admin/orders/${active}`);
  const activeTrash = await database.query("select id from deleted_archive_entries where item_type='order' and order_id=$1", [active]);
  expect((await request.delete('/api/admin/archive', { data: { ids: activeTrash.rows.map(record => Number(record.id)) } })).ok()).toBeTruthy();
});

test('permanent deletion validates requests and rejects unauthenticated callers', async ({ request, playwright, baseURL }) => {
  for (const ids of [[], [0], [-1], [1.5], ['1'], [Number.MAX_SAFE_INTEGER + 1]]) {
    expect((await request.delete('/api/admin/archive', { data: { ids } })).status()).toBe(400);
  }
  const anonymous = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  try { expect((await anonymous.delete('/api/admin/archive', { data: { ids: [1] } })).status()).toBe(401); }
  finally { await anonymous.dispose(); }
});

test('PDF deletion preserves shared blobs and rolls back a mixed selection containing immutable order history', async ({ request }) => {
  const id = Number((await (await request.post('/api/admin/orders')).json()).orderId);
  const otherId = Number((await (await request.post('/api/admin/orders')).json()).orderId);
  const blob = `orders/e2e-trash-${randomUUID()}.pdf`;
  const addDocument = async (orderId: number) => {
    const doc = (await database.query(`insert into order_documents
      (order_id,type,filename,blob_pathname,version_number,document_number,issued_at,content_sha256,legal_status,format_marker,deleted_at)
      values ($1,'invoice','test.pdf',$2,1,'TEST',now(),$3,'test','test',now()) returning id`, [orderId, blob, 'a'.repeat(64)])).rows[0];
    const entry = (await database.query("insert into deleted_archive_entries (item_type,order_id,document_id,label) values ('pdf',$1,$2,'E2E PDF') returning id", [orderId, doc.id])).rows[0];
    return { documentId: Number(doc.id), entryId: Number(entry.id) };
  };
  const first = await addDocument(id);
  const second = await addDocument(otherId);
  expect((await request.delete('/api/admin/archive', { data: { ids: [first.entryId] } })).ok()).toBeTruthy();
  expect((await database.query('select id from order_documents where id=$1', [first.documentId])).rowCount).toBe(0);
  expect((await database.query('select id from order_documents where id=$1', [second.documentId])).rowCount).toBe(1);
  expect((await database.query('select id from archive_blob_deletion_outbox where blob_target=$1', [blob])).rowCount).toBe(0);
  expect((await database.query('select id from orders where id=$1 and deleted_at is null', [id])).rowCount).toBe(1);
  // A restored PDF cannot be deleted through a stale trash row, and the entire batch stays intact.
  await database.query('update order_documents set deleted_at=null where id=$1', [second.documentId]);
  expect((await request.delete('/api/admin/archive', { data: { ids: [second.entryId] } })).status()).toBe(409);
  await database.query('update order_documents set deleted_at=now() where id=$1', [second.documentId]);
  await database.query("insert into order_historical_changes (order_id,revision,actor_id,before_json,after_json) values ($1,1,'e2e','{}','{}')", [id]);
  expect((await request.delete(`/api/admin/orders/${id}`)).ok()).toBeTruthy();
  const protectedEntry = Number((await database.query("select id from deleted_archive_entries where item_type='order' and order_id=$1", [id])).rows[0].id);
  const conflict = await request.delete('/api/admin/archive', { data: { ids: [second.entryId, protectedEntry] } });
  expect(conflict.status()).toBe(409);
  expect((await database.query('select id from order_documents where id=$1', [second.documentId])).rowCount).toBe(1);
  expect((await database.query('select id from archive_blob_deletion_outbox where blob_target=$1', [blob])).rowCount).toBe(0);
  expect((await request.delete('/api/admin/archive', { data: { ids: [second.entryId] } })).ok()).toBeTruthy();
  expect((await database.query('select id from archive_blob_deletion_outbox where blob_target=$1', [blob])).rowCount).toBe(1);
  expect((await database.query('select id from order_historical_changes where order_id=$1', [id])).rowCount).toBe(1);
  await request.delete(`/api/admin/orders/${otherId}`);
});

test('a trashed child PDF can be permanently deleted without selecting or restoring its parent order', async ({ page, request }) => {
  const id = Number((await (await request.post('/api/admin/orders')).json()).orderId);
  const label = `Child PDF ${randomUUID()}`;
  const doc = (await database.query(`insert into order_documents
    (order_id,type,filename,blob_pathname,version_number,document_number,issued_at,content_sha256,legal_status,format_marker,deleted_at)
    values ($1,'invoice','child.pdf',$2,1,'TEST',now(),$3,'test','test',now()) returning id`, [id, `orders/${label}.pdf`, 'b'.repeat(64)])).rows[0];
  await database.query("insert into deleted_archive_entries (item_type,order_id,document_id,label) values ('pdf',$1,$2,$3)", [id, doc.id, label]);
  expect((await request.delete(`/api/admin/orders/${id}`)).ok()).toBeTruthy();
  await page.goto('/admin/trash');
  await page.getByRole('button', { name: new RegExp(`Prikaži dokumente #${id} ·`) }).click();
  await page.getByRole('row').filter({ hasText: label }).getByRole('checkbox').check();
  await expect(page.getByRole('button', { name: 'Obnovi izbrano', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Trajno izbriši izbrano', exact: true }).click();
  const deletion = page.waitForResponse(response => response.url().endsWith('/api/admin/archive') && response.request().method() === 'DELETE');
  await page.getByRole('dialog').getByRole('button', { name: 'Trajno izbriši', exact: true }).click();
  expect((await deletion).ok()).toBeTruthy();
  expect((await database.query('select id from orders where id=$1 and deleted_at is not null', [id])).rowCount).toBe(1);
  expect((await database.query('select id from order_documents where id=$1', [doc.id])).rowCount).toBe(0);
  const entries = await database.query("select id from deleted_archive_entries where item_type='order' and order_id=$1", [id]);
  expect((await request.delete('/api/admin/archive', { data: { ids: entries.rows.map(entry => Number(entry.id)) } })).ok()).toBeTruthy();
});

test('a restore queued behind permanent deletion returns a conflict and never records a false restoration', async ({ request }) => {
  test.setTimeout(60_000);
  const created = await request.post('/api/admin/orders');
  expect(created.ok()).toBeTruthy();
  const orderId = Number((await created.json()).orderId);
  expect((await request.delete(`/api/admin/orders/${orderId}`)).ok()).toBeTruthy();
  const archiveId = Number((await database.query("select id from deleted_archive_entries where item_type='order' and order_id=$1", [orderId])).rows[0].id);
  const blocker = await database.connect();
  let holdingLock = false;
  let purge: ReturnType<typeof request.delete> | undefined;
  let restore: ReturnType<typeof request.patch> | undefined;
  try {
    await blocker.query('BEGIN');
    holdingLock = true;
    const blockerPid = Number((await blocker.query('select pg_backend_pid() as pid')).rows[0].pid);
    await blocker.query('select id from orders where id=$1 for update', [orderId]);
    purge = request.delete('/api/admin/archive', { data: { ids: [archiveId] } });
    let purgePid: number | null = null;
    await expect.poll(async () => {
      const waiting = await database.query(`select pid from pg_stat_activity
        where datname=current_database() and wait_event_type='Lock'
          and $1::int = any(pg_blocking_pids(pid))
          and query like '%select id, deleted_at, source_quote_offer_version_id from orders%'`, [blockerPid]);
      purgePid = waiting.rows.length ? Number(waiting.rows[0].pid) : null;
      return purgePid;
    }, { timeout: 10_000, message: 'Purge holds the archive entry while waiting for the test-owned order lock.' }).not.toBeNull();
    restore = request.patch('/api/admin/archive', { data: { ids: [archiveId] } });
    await expect.poll(async () => {
      const waiting = await database.query(`select pid from pg_stat_activity
        where datname=current_database() and wait_event_type='Lock'
          and $1::int = any(pg_blocking_pids(pid))
          and query like '%from deleted_archive_entries e%'`, [purgePid]);
      return waiting.rows.length;
    }, { timeout: 10_000, message: 'Restore must wait on the same archive entry before reading or updating resources.' }).toBe(1);
    await blocker.query('COMMIT');
    holdingLock = false;
    const [purged, restored] = await Promise.all([purge, restore]);
    expect(purged.status()).toBe(200);
    expect(restored.status()).toBe(409);
    expect((await restored.json()).code).toBe('ARCHIVE_RESTORE_CONFLICT');
    expect((await database.query('select id from orders where id=$1', [orderId])).rowCount).toBe(0);
    expect((await database.query("select id from audit_events where entity_type='order' and entity_id=$1 and action='restored' and metadata_json->>'archive_entry_id'=$2", [String(orderId), String(archiveId)])).rowCount).toBe(0);
    expect((await database.query("select id from audit_events where entity_type='order' and entity_id=$1 and metadata_json->>'permanent_delete'='true'", [String(orderId)])).rowCount).toBe(1);
  } finally {
    try { if (holdingLock) await blocker.query('ROLLBACK'); }
    finally { blocker.release(); }
    await Promise.allSettled([purge, restore].filter((operation): operation is NonNullable<typeof operation> => operation !== undefined));
  }
});
