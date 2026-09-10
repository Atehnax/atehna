import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test, type APIRequestContext } from '@playwright/test';
import pg from 'pg';
import type { SchoolDirectoryRow } from '@/shared/domain/schoolDirectory';
import type { SupplierDirectoryData } from '@/shared/domain/supplierDirectory';
import { E2E_BASE_URL } from './support/auth';

const endpoint = '/api/admin/suppliers';
const headers = { origin: E2E_BASE_URL };
async function directory(request: APIRequestContext): Promise<SupplierDirectoryData> {
  const response = await request.get(endpoint);
  expect(response.status()).toBe(200);
  return (await response.json()).directory;
}
async function mutate(request: APIRequestContext, data: unknown) {
  return request.patch(endpoint, { headers, data });
}
async function add(request: APIRequestContext, id: string): Promise<SchoolDirectoryRow> {
  const response = await mutate(request, { operation: 'add-row', rowId: id });
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).row;
}

test.describe('supplier directory', () => {
  let database: pg.Pool;
  const ownedIds = new Set<string>();
  let ownedCatalogId: string | undefined;
  test.beforeAll(() => {
    if (!process.env.E2E_DATABASE_URL || process.env.E2E_MODE !== '1') throw new Error('Supplier tests require the isolated E2E database.');
    database = new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL, ssl: false });
  });
  test.afterEach(async () => {
    await database.query('delete from catalog_supplier_rows where id = any($1::text[])', [[...ownedIds]]);
    ownedIds.clear();
    if (ownedCatalogId) await database.query('delete from catalog_items where id = $1', [ownedCatalogId]);
    ownedCatalogId = undefined;
  });
  test.afterAll(async () => { await database?.end(); });

  test('supplier reads and writes require authentication and same-origin mutations', async ({ playwright, request }) => {
    const anonymous = await playwright.request.newContext({ baseURL: E2E_BASE_URL, storageState: { cookies: [], origins: [] } });
    try {
      expect((await anonymous.get(endpoint)).status()).toBe(401);
      expect((await anonymous.patch(endpoint, { data: { operation: 'add-row', rowId: 'forged' } })).status()).toBe(401);
    } finally { await anonymous.dispose(); }
    const forged = await request.patch(endpoint, { headers: { origin: 'https://attacker.test', 'sec-fetch-site': 'cross-site' }, data: { operation: 'add-row', rowId: 'forged' } });
    expect(forged.status()).toBe(403);
    const invalid = await mutate(request, { operation: 'delete-column', columnId: 'artikel' });
    expect(invalid.status()).toBe(400);
    expect((await request.get(endpoint)).headers()['cache-control']).toContain('no-store');
  });

  test('persistent supplier rows reject stale edits and make batch operations atomic', async ({ request }) => {
    const ids: string[] = [randomUUID(), randomUUID(), randomUUID()];
    ids.forEach(id => ownedIds.add(id));
    const first = await add(request, ids[0]);
    const second = await add(request, ids[1]);
    const article = (await directory(request)).articles.find(option => !option.disabled)!;
    const changed = await mutate(request, { operation: 'update-row', rowId: first.id,
      cells: { artikel: article.value, dobavitelj: 'Preverjen dobavitelj', 'e-naslov': 'supplier@example.test', 'spletna-stran': 'https://example.test' },
      expectedCells: { artikel: '', dobavitelj: '', 'e-naslov': '', 'spletna-stran': '' } });
    expect(changed.status(), await changed.text()).toBe(200);
    const updated = (await changed.json()).row as SchoolDirectoryRow;
    const conflict = await mutate(request, { operation: 'update-row', rowId: first.id, cells: { dobavitelj: 'Lost update' }, expectedCells: { dobavitelj: '' } });
    expect(conflict.status()).toBe(409);
    expect((await conflict.json()).row.cells.dobavitelj).toBe('Preverjen dobavitelj');
    const invalidEmail = await mutate(request, { operation: 'update-row', rowId: first.id, cells: { 'e-naslov': 'broken@' }, expectedCells: { 'e-naslov': 'supplier@example.test' } });
    expect(invalidEmail.status()).toBe(400);
    const batchConflict = await mutate(request, { operation: 'delete-rows', rows: [{ rowId: first.id, expectedCells: first.cells }, { rowId: second.id, expectedCells: second.cells }] });
    expect(batchConflict.status()).toBe(409);
    expect((await directory(request)).rows.filter(row => ids.includes(row.id))).toHaveLength(2);
    const duplicate = await mutate(request, { operation: 'duplicate-rows', rows: [{ sourceRowId: first.id, newRowId: ids[2], expectedCells: updated.cells }] });
    expect(duplicate.status(), await duplicate.text()).toBe(200);
    const copied = (await duplicate.json()).rows[0] as SchoolDirectoryRow;
    expect(copied.cells).toEqual(updated.cells);
    const saved = await database.query('select catalog_item_id::text from catalog_supplier_rows where id=$1', [ids[2]]);
    expect(saved.rows[0].catalog_item_id).toBe(article.value);
    const audit = await database.query("select actor_name,summary from audit_events where entity_id=$1 order by occurred_at desc", [`supplier:${first.id}`]);
    expect(audit.rows.some(row => row.summary === 'Dobavitelj posodobljen' && row.actor_name === process.env.E2E_ADMIN_USERNAME)).toBe(true);
    const removed = await mutate(request, { operation: 'delete-rows', rows: [updated, second, copied].map(row => ({ rowId: row.id, expectedCells: row.cells })) });
    expect(removed.status()).toBe(200);
    expect((await directory(request)).rows.filter(row => ids.includes(row.id))).toHaveLength(0);
  });

  test('removing a catalog article preserves supplier details and the article label', async ({ request }) => {
    const label = 'Dobaviteljev testni artikel ' + randomUUID();
    const catalog = await database.query("insert into catalog_items(item_name,item_type,slug) values($1,'unit',$2) returning id::text", [label, randomUUID()]);
    ownedCatalogId = catalog.rows[0].id;
    const id = randomUUID(); ownedIds.add(id);
    await add(request, id);
    const updated = await mutate(request, { operation: 'update-row', rowId: id, cells: { artikel: ownedCatalogId, dobavitelj: 'Ohranjen dobavitelj' }, expectedCells: { artikel: '', dobavitelj: '' } });
    expect(updated.status()).toBe(200);
    await database.query('delete from catalog_items where id=$1', [ownedCatalogId]);
    const state = await directory(request);
    expect(state.rows.find(row => row.id === id)?.cells.dobavitelj).toBe('Ohranjen dobavitelj');
    expect(state.articles.find(article => article.value === ownedCatalogId)).toMatchObject({ label: label + ' (odstranjen)', disabled: true });
    const retained = await database.query('select catalog_item_id,article_label from catalog_supplier_rows where id=$1', [id]);
    expect(retained.rows[0]).toEqual({ catalog_item_id: null, article_label: label });
  });

  test('Dobavitelji reuses table editing, filters, sorting, selection and exports', async ({ page, request }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/admin/artikli');
    await page.getByRole('tab', { name: 'Dobavitelji', exact: true }).click();
    await expect(page).toHaveURL(/view=suppliers/);
    const addResponse = page.waitForResponse(response => response.url().endsWith(endpoint) && response.request().method() === 'PATCH');
    await page.getByRole('button', { name: 'Nov dobavitelj', exact: true }).click();
    const initial = (await (await addResponse).json()).row as SchoolDirectoryRow;
    ownedIds.add(initial.id);
    const firstRow = page.locator('tbody tr').first();
    await firstRow.getByRole('button', { name: 'Dejanja vrstice', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Uredi', exact: true }).click();
    const state = await directory(request);
    const article = state.articles.find(option => !option.disabled)!;
    await page.getByRole('button', { name: 'Artikel, urejanje vrstice', exact: true }).click();
    await page.getByRole('option', { name: article.label, exact: true }).click();
    const supplier = 'UI Dobavitelj ' + randomUUID().slice(0, 8);
    await page.getByRole('textbox', { name: 'Dobavitelj, urejanje vrstice', exact: true }).fill(supplier);
    await page.getByRole('textbox', { name: 'Naslov, urejanje vrstice', exact: true }).fill('Testna ulica 1, Ljubljana');
    await page.getByRole('textbox', { name: 'Kontakt, urejanje vrstice', exact: true }).fill('Ana, 01 234 567');
    await page.getByRole('textbox', { name: 'E-naslov, urejanje vrstice', exact: true }).fill('contact@example.test');
    await page.getByRole('textbox', { name: 'Spletna stran, urejanje vrstice', exact: true }).fill('https://example.test');
    const notes = page.getByRole('textbox', { name: 'Opombe, urejanje vrstice', exact: true });
    await expect(notes).toHaveJSProperty('tagName', 'TEXTAREA');
    await notes.fill('Dobava po dogovoru; kontakt Ana');
    await notes.press('End');
    await notes.press('Enter');
    await notes.press('Enter');
    await notes.pressSequentially('Prevzem ob torkih');
    const multilineNotes = 'Dobava po dogovoru; kontakt Ana\n\nPrevzem ob torkih';
    await expect(notes).toHaveValue(multilineNotes);
    expect((await directory(request)).rows.find(row => row.id === initial.id)?.cells.opombe).toBe('');
    await page.getByRole('button', { name: /^Shrani urejanje vrstice/ }).click();
    await expect(page.getByRole('textbox', { name: 'Dobavitelj, urejanje vrstice', exact: true })).toHaveCount(0);
    expect((await directory(request)).rows.find(row => row.id === initial.id)?.cells.opombe).toBe(multilineNotes);
    await page.reload();
    const savedNote = page.getByRole('button', { name: 'Opombe: ' + multilineNotes + '. Kopiraj vrednost.', exact: true });
    await expect(savedNote).toHaveCSS('white-space', 'pre-wrap');
    await expect(savedNote).toHaveText(multilineNotes);
    const search = page.getByPlaceholder('Išči po vseh podatkih dobaviteljev ...');
    await search.fill(supplier);
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody')).toContainText(article.label);
    await page.getByRole('button', { name: 'Dobavitelj: razvrsti naraščajoče', exact: true }).click();
    await expect(page.getByRole('columnheader').filter({ hasText: 'Dobavitelj' })).toHaveAttribute('aria-sort', 'ascending');
    await page.getByRole('button', { name: 'Filtriraj Dobavitelj', exact: true }).click();
    await page.getByRole('option', { name: supplier, exact: true }).click();
    await expect(page.getByRole('button', { name: `Odstrani filter Dobavitelj ${supplier}` })).toBeVisible();
    await page.getByRole('button', { name: 'Filtriraj stolpce', exact: true }).click();
    const menu = page.getByRole('menu', { name: 'Filtriraj stolpce', exact: true });
    await menu.getByRole('checkbox', { name: 'Opombe', exact: true }).click();
    await menu.press('Escape');
    await expect(page.getByRole('button', { name: 'Opombe: razvrsti naraščajoče', exact: true })).toHaveCount(0);
    for (const format of ['CSV', 'XLSX']) {
      const downloaded = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Izvozi tabelo', exact: true }).click();
      await page.getByRole('menuitem', { name: format, exact: true }).click();
      const download = await downloaded;
      expect(download.suggestedFilename()).toBe('dobavitelji.' + format.toLowerCase());
      if (format === 'CSV') {
        const content = await readFile((await download.path())!, 'utf8');
        expect(content).toContain(supplier); expect(content).toContain(article.label);
        expect(content).toContain('Opombe');
      }
    }
    await page.screenshot({ path: testInfo.outputPath('supplier-table.png'), fullPage: true });
    await page.getByRole('checkbox', { name: `Izberi ${supplier}`, exact: true }).check();
    const duplicateResponse = page.waitForResponse(response => response.url().endsWith(endpoint) && response.request().method() === 'PATCH');
    await page.getByRole('button', { name: 'Podvoji izbrane vrstice (1)', exact: true }).click();
    const duplicateRows = (await (await duplicateResponse).json()).rows as SchoolDirectoryRow[];
    duplicateRows.forEach(row => ownedIds.add(row.id));
    await page.getByRole('button', { name: 'Izbriši izbrane vrstice (1)', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Izbriši', exact: true }).click();
    await expect.poll(async () => (await directory(request)).rows.some(row => row.id === duplicateRows[0].id)).toBe(false);
    await page.reload();
    await search.fill(supplier);
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody')).toContainText('Dobava po dogovoru');
  });
});