import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { assertAuthenticatedAdmin } from './support/auth';
import { readFileSync } from 'node:fs';
const institutionSeed = JSON.parse(readFileSync(new URL('../../src/shared/data/schools-and-institutions-seed.json', import.meta.url), 'utf8')) as { directories: Array<{ id: string; rows: Array<{ id: string }> }> };

type DirectoryRow = { id: string; position: number; cells: Record<string, string> };
type Directory = {
  columns: Array<{ id: string; label: string; position: number }>;
  rows: DirectoryRow[];
  persistenceAvailable: boolean;
};

// Row totals audited after consolidating shared emails; combined views keep source identities.
const directoryViews = [
  { id: 'vsi-seznami', label: 'Vsi seznami', count: 1554, alphabetical: true },
  { id: 'osnovne-sole', label: 'Osnovne šole', count: 452, alphabetical: false },
  { id: 'dijaski-domovi', label: 'Dijaški domovi', count: 15, alphabetical: false },
  { id: 'glasbene-sole', label: 'Glasbene šole', count: 67, alphabetical: false },
  { id: 'vrtci', label: 'Vrtci', count: 684, alphabetical: false },
  { id: 'srednje-sole', label: 'Srednje šole', count: 165, alphabetical: false },
  { id: 'visje-strokovne-sole', label: 'Višje strokovne šole', count: 52, alphabetical: false },
  { id: 'izobrazevanje-odraslih', label: 'Izobraževanje odraslih', count: 78, alphabetical: false },
  { id: 'posebne-potrebe', label: 'Posebne potrebe', count: 41, alphabetical: true }
];
const specialTitles = ['Osnovne šole za otroke s posebnimi potrebami', 'Zavodi za otroke in mladostnike s posebnimi potrebami'];
const fullAdultTitle = 'Organizacije za izobraževanje odraslih';
const directoryPage = '/admin/stranke/sole-in-zavodi';
const api = (id?: string) => '/api/admin/schools' + (id ? '?directory=' + id : '');

// A full analytics fixture can add these two deliberately labelled primary records.
// Accept only the exact known identities; unexpected extra or missing source rows fail.
const analyticsFixtureNames = new Map([
  ['analytics-fixture-school-ljubljana', 'PREIZKUS ANALITIKE – Podružnica Ljubljana'],
  ['analytics-fixture-school-maribor', 'PREIZKUS ANALITIKE – Podružnica Maribor']
]);
function primaryFixtureRows(primary: Directory): DirectoryRow[] {
  const seedIds = new Set(institutionSeed.directories.find(directory => directory.id === 'osnovne-sole')!.rows.map(row => row.id));
  const extra = primary.rows.filter(row => !seedIds.has(row.id));
  for (const row of extra) {
    expect(analyticsFixtureNames.has(row.id), `Unexpected primary fixture: ${row.id}`).toBe(true);
    expect(row.cells.naziv).toBe(analyticsFixtureNames.get(row.id));
  }
  return extra;
}
function expectedViewRowIds(viewId: string, fixtureRows: DirectoryRow[]): string[] {
  const sourceDirectories = institutionSeed.directories.filter(directory => viewId === 'vsi-seznami'
    || (viewId === 'posebne-potrebe' ? ['osnovne-sole-posebne-potrebe', 'zavodi-posebne-potrebe'].includes(directory.id) : directory.id === viewId));
  const aggregate = viewId === 'vsi-seznami' || viewId === 'posebne-potrebe';
  return sourceDirectories.flatMap(directory => [
    ...directory.rows.map(row => row.id),
    ...(directory.id === 'osnovne-sole' ? fixtureRows.map(row => row.id) : [])
  ].map(id => aggregate ? directory.id + '::' + id : id));
}

async function readDirectory(request: APIRequestContext, id?: string): Promise<Directory> {
  const response = await request.get(api(id));
  expect(response.status()).toBe(200);
  const { directory } = await response.json() as { directory: Directory };
  expect(directory.persistenceAvailable).toBe(true);
  return directory;
}

async function selectDirectory(page: Page, id: string, label: string) {
  const tab = page.getByRole('tab', { name: label, exact: true });
  await tab.click();
  await expect(page).toHaveURL(new RegExp('\\?tab=' + id + '$'));
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-busy', 'false');
}

async function editRow(page: Page, name: string) {
  const row = page.getByRole('tabpanel').locator('tbody tr').filter({ hasText: name });
  await row.getByRole('button', { name: 'Dejanja vrstice', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Uredi', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Naslov, urejanje vrstice', exact: true })).toBeVisible();
}

test.beforeEach(async ({ request }) => {
  await assertAuthenticatedAdmin(request);
});

test('all lists open by default and nine views preserve source rows and standard table controls', async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const primaryBefore = await readDirectory(request);
  const fixtureRows = primaryFixtureRows(primaryBefore);
  await page.goto('/admin/stranke/sole');
  await expect(page).toHaveURL(new RegExp(directoryPage + '$'));
  await expect(page.getByRole('tab', { name: 'Stranke', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Vse stranke', exact: true })).toHaveCount(0);
  const tabs = page.getByRole('tablist', { name: 'Vrste šol in zavodov' });
  await expect(tabs.getByRole('tab')).toHaveCount(9);
  await expect(tabs.getByRole('tab').first()).toHaveText('Vsi seznami');
  await expect(tabs.getByRole('tab', { name: 'Vsi seznami', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.getByRole('tab', { name: 'Vrtci', exact: true })).toHaveCount(1);
  await expect(tabs.getByRole('tab').filter({ hasText: /Javni in zasebni|Javne in zasebne|Vrtci z enotami/ })).toHaveCount(0);
  const panel = page.getByRole('tabpanel');
  const table = panel.getByRole('table');
  await expect(table).toBeVisible();
  const originalHeaders = await table.getByRole('columnheader').allTextContents();
  expect(originalHeaders).toEqual(['', '#', 'Naziv', 'Naslov', 'P. št.', 'Pošta', 'Telefon', 'Kontakti', 'E-naslov', 'Spletna stran', 'Uredi']);
  const collator = new Intl.Collator('sl', { sensitivity: 'base', numeric: true });

  for (const view of directoryViews) {
    await test.step(view.label, async () => {
      const data = await readDirectory(request, view.id);
      const expectedIds = expectedViewRowIds(view.id, fixtureRows);
      expect(expectedViewRowIds(view.id, [])).toHaveLength(view.count);
      expect(data.rows.map(row => row.id).sort()).toEqual(expectedIds.sort());
      expect(new Set(data.rows.map(row => row.id)).size).toBe(expectedIds.length);
      expect(data.columns).toEqual(primaryBefore.columns);
      if (view.id !== 'vsi-seznami') await selectDirectory(page, view.id, view.label);
      await expect(table.getByRole('columnheader')).toHaveText(originalHeaders);
      const firstRow = [...data.rows].sort((left, right) => {
        const blankOrder = Number(!left.cells.naziv.trim()) - Number(!right.cells.naziv.trim());
        const byName = view.alphabetical ? blankOrder || collator.compare(left.cells.naziv.trim(), right.cells.naziv.trim()) : 0;
        return byName || left.position - right.position || left.id.localeCompare(right.id);
      })[0];
      await expect(table.locator('tbody tr').first()).toContainText(firstRow.cells.naziv);
      if (view.id === 'izobrazevanje-odraslih') await expect(panel.getByText(fullAdultTitle, { exact: true })).toBeVisible();
      if (view.id === 'posebne-potrebe') {
        for (const title of specialTitles) await expect(panel.getByText(title, { exact: true })).toBeVisible();
      }
    });
  }

  const primaryAfter = await readDirectory(request);
  expect(primaryAfter.columns).toEqual(primaryBefore.columns);
  expect(primaryAfter.rows).toEqual(primaryBefore.rows);
  const special = await readDirectory(request, 'posebne-potrebe');
  for (const [sourceId, count] of [['osnovne-sole-posebne-potrebe', 28], ['zavodi-posebne-potrebe', 13]] as const) {
    const source = await readDirectory(request, sourceId);
    expect(source.rows).toHaveLength(count);
    expect(special.rows.map(row => row.id)).toEqual(expect.arrayContaining(source.rows.map(row => sourceId + '::' + row.id)));
    await page.goto(directoryPage + '?tab=' + sourceId);
    await expect(page).toHaveURL(directoryPage + '?tab=posebne-potrebe');
    await expect(tabs.getByRole('tab', { name: 'Posebne potrebe', exact: true })).toHaveAttribute('aria-selected', 'true');
    for (const title of specialTitles) await expect(panel.getByText(title, { exact: true })).toBeVisible();
  }
  await page.goto(directoryPage + '?tab=vrtci-z-enotami');
  await expect(page).toHaveURL(directoryPage + '?tab=vrtci');
  await expect(tabs.getByRole('tab', { name: 'Vrtci', exact: true })).toHaveAttribute('aria-selected', 'true');
  const mergedKindergartens = await readDirectory(request, 'vrtci');
  expect((await readDirectory(request, 'vrtci-z-enotami')).rows).toEqual(mergedKindergartens.rows);
});

test('row edits persist only in their selected directory and switching tabs protects an unsaved draft', async ({ page, request }) => {
  test.setTimeout(90_000);
  const primaryBefore = await readDirectory(request);
  const targetId = 'dijaski-domovi';
  const otherId = 'glasbene-sole';
  const rowId = 'e2e-institution-' + randomUUID();
  const name = 'E2E zavod ' + rowId;
  const targetBefore = await readDirectory(request, targetId);
  const otherBefore = await readDirectory(request, otherId);
  const created: string[] = [];
  try {
    // An intentionally identical temporary ID in two directories exposes accidental
    // cross-directory lookup without touching a supplied or pre-existing record.
    for (const id of [targetId, otherId]) {
      const added = await request.patch(api(id), { data: { operation: 'add-row', rowId } });
      expect(added.status()).toBe(200);
      created.push(id);
      const updated = await request.patch(api(id), {
        data: { operation: 'update-row', rowId, expectedCells: { naziv: '', naslov: '' }, cells: { naziv: name, naslov: 'Prvotni naslov ' + id } }
      });
      expect(updated.status()).toBe(200);
    }
    await page.goto(directoryPage + '?tab=' + targetId);
    await editRow(page, name);
    const address = page.getByRole('textbox', { name: 'Naslov, urejanje vrstice', exact: true });
    await address.fill('Shranjen naslov 24');
    const saved = page.waitForResponse(response => response.url().endsWith(api(targetId)) && response.request().method() === 'PATCH');
    await page.getByRole('button', { name: 'Shrani urejanje vrstice ' + name, exact: true }).click();
    expect((await saved).status()).toBe(200);
    await expect(address).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('tabpanel').locator('tbody tr').filter({ hasText: name })).toContainText('Shranjen naslov 24');
    expect((await readDirectory(request, targetId)).rows.find(row => row.id === rowId)?.cells.naslov).toBe('Shranjen naslov 24');
    expect((await readDirectory(request, otherId)).rows.find(row => row.id === rowId)?.cells.naslov).toBe('Prvotni naslov ' + otherId);

    await editRow(page, name);
    await address.fill('Neshranjeno besedilo');
    const otherTab = page.getByRole('tab', { name: 'Glasbene šole', exact: true });
    await otherTab.click();
    const confirmation = page.getByRole('dialog', { name: 'Zavrzi neshranjene spremembe?' });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Ostani v zavihku', exact: true }).click();
    await expect(page).toHaveURL(new RegExp('\\?tab=' + targetId + '$'));
    await expect(address).toHaveValue('Neshranjeno besedilo');
    await otherTab.click();
    await confirmation.getByRole('button', { name: 'Zavrzi in nadaljuj', exact: true }).click();
    await expect(otherTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel').locator('tbody tr').filter({ hasText: name })).toContainText('Prvotni naslov ' + otherId);
    await selectDirectory(page, targetId, 'Dijaški domovi');
    await expect(page.getByRole('tabpanel').locator('tbody tr').filter({ hasText: name })).toContainText('Shranjen naslov 24');
    await expect(address).toHaveCount(0);

    const conflict = await request.patch(api(targetId), {
      data: { operation: 'update-row', rowId, expectedCells: { naslov: 'Stara vrednost' }, cells: { naslov: 'Ne sme se shraniti' } }
    });
    expect(conflict.status()).toBe(409);
    expect((await readDirectory(request, targetId)).rows.find(row => row.id === rowId)?.cells.naslov).toBe('Shranjen naslov 24');
    expect((await readDirectory(request)).rows).toEqual(primaryBefore.rows);
  } finally {
    for (const id of created) {
      const current = await readDirectory(request, id);
      const temporary = current.rows.find(row => row.id === rowId);
      if (!temporary) continue;
      const deleted = await request.patch(api(id), { data: { operation: 'delete-rows', rows: [{ rowId, expectedCells: temporary.cells }] } });
      expect(deleted.status()).toBe(200);
    }
  }
  expect((await readDirectory(request, targetId)).rows).toEqual(targetBefore.rows);
  expect((await readDirectory(request, otherId)).rows).toEqual(otherBefore.rows);
});

test('combined lists edit the right source and new records use the chosen source category', async ({ page, request }) => {
  test.setTimeout(120_000);
  const primaryBefore = await readDirectory(request);
  const targetId = 'dijaski-domovi';
  const otherId = 'glasbene-sole';
  const sourceBefore = new Map(await Promise.all([targetId, otherId].map(async id => [id, await readDirectory(request, id)] as const)));
  const rowId = 'e2e-combined-' + randomUUID();
  const baseName = 'E2E skupni zapis ' + rowId;
  const targetName = baseName + ' dom';
  const otherName = baseName + ' glasba';
  const created = new Map<string, Set<string>>();
  const recordCreated = (id: string, newId: string) => created.set(id, new Set([...(created.get(id) ?? []), newId]));
  try {
    for (const [id, name] of [[targetId, targetName], [otherId, otherName]]) {
      expect((await request.patch(api(id), { data: { operation: 'add-row', rowId } })).status()).toBe(200);
      recordCreated(id, rowId);
      expect((await request.patch(api(id), { data: { operation: 'update-row', rowId, expectedCells: { naziv: '', naslov: '' }, cells: { naziv: name, naslov: 'Prvotni naslov ' + id } } })).status()).toBe(200);
    }
    const combined = await readDirectory(request, 'vsi-seznami');
    expect(combined.rows.find(row => row.id === targetId + '::' + rowId)?.cells.naziv).toBe(targetName);
    expect(combined.rows.find(row => row.id === otherId + '::' + rowId)?.cells.naziv).toBe(otherName);
    await page.goto(directoryPage);
    const search = page.getByPlaceholder('Išči po vseh podatkih zavodov ...', { exact: true });
    await search.fill(baseName);
    await expect(page.getByRole('tabpanel').locator('tbody tr')).toHaveCount(2);
    await editRow(page, targetName);
    await page.getByRole('textbox', { name: 'Naslov, urejanje vrstice', exact: true }).fill('Naslov shranjen v skupnem seznamu');
    const saved = page.waitForResponse(response => response.url().endsWith(api('vsi-seznami')) && response.request().method() === 'PATCH');
    await page.getByRole('button', { name: 'Shrani urejanje vrstice ' + targetName, exact: true }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByRole('textbox', { name: 'Naslov, urejanje vrstice', exact: true })).toHaveCount(0);
    await page.reload();
    await search.fill(baseName);
    await expect(page.getByRole('tabpanel').locator('tbody tr').filter({ hasText: targetName })).toContainText('Naslov shranjen v skupnem seznamu');
    await expect(page.getByRole('tabpanel').locator('tbody tr').filter({ hasText: otherName })).toContainText('Prvotni naslov ' + otherId);
    expect((await readDirectory(request, targetId)).rows.find(row => row.id === rowId)?.cells.naslov).toBe('Naslov shranjen v skupnem seznamu');
    expect((await readDirectory(request, otherId)).rows.find(row => row.id === rowId)?.cells.naslov).toBe('Prvotni naslov ' + otherId);

    await page.getByRole('button', { name: 'Nov zapis', exact: true }).click();
    const menu = page.getByRole('menu', { name: 'Seznam za nov zapis', exact: true });
    await expect(menu.getByRole('menuitem')).toHaveCount(9);
    const added = page.waitForResponse(response => response.url().endsWith(api('vsi-seznami')) && response.request().method() === 'PATCH');
    await menu.getByRole('menuitem', { name: 'Dijaški domovi', exact: true }).click();
    const addedResponse = await added;
    expect(addedResponse.status()).toBe(200);
    const addedPayload = await addedResponse.json() as { row: DirectoryRow };
    const [addedSourceId, addedRowId] = addedPayload.row.id.split('::');
    recordCreated(addedSourceId, addedRowId);
    expect(addedSourceId).toBe(targetId);
    expect((await readDirectory(request, targetId)).rows.some(row => row.id === addedRowId)).toBe(true);
    expect((await readDirectory(request, otherId)).rows.some(row => row.id === addedRowId)).toBe(false);
    await expect(menu).toHaveCount(0);
    const addedRow = page.getByRole('tabpanel').locator('tbody tr').filter({ has: page.getByRole('checkbox', { name: 'Izberi vrstico', exact: true }) });
    await expect(addedRow).toHaveCount(1);
    await addedRow.getByRole('button', { name: 'Dejanja vrstice', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Uredi', exact: true }).click();
    const addedName = 'E2E nov skupni zapis ' + rowId;
    await page.getByRole('textbox', { name: 'Naziv, urejanje vrstice', exact: true }).fill(addedName);
    await page.getByRole('textbox', { name: 'Naslov, urejanje vrstice', exact: true }).fill('Nov dijaški dom');
    const newSaved = page.waitForResponse(response => response.url().endsWith(api('vsi-seznami')) && response.request().method() === 'PATCH');
    await page.getByRole('button', { name: 'Shrani urejanje vrstice ' + addedPayload.row.id, exact: true }).click();
    expect((await newSaved).status()).toBe(200);
    await expect(page.getByRole('textbox', { name: 'Naziv, urejanje vrstice', exact: true })).toHaveCount(0);
    await page.reload();
    await search.fill(addedName);
    await expect(page.getByRole('tabpanel').locator('tbody tr')).toHaveCount(1);
    await expect(page.getByRole('tabpanel').locator('tbody tr')).toContainText('Nov dijaški dom');
    expect((await readDirectory(request, targetId)).rows.find(row => row.id === addedRowId)?.cells.naziv).toBe(addedName);
    expect((await readDirectory(request)).rows).toEqual(primaryBefore.rows);
  } finally {
    for (const [id, rowIds] of created) {
      const current = await readDirectory(request, id);
      const temporary = current.rows.filter(row => rowIds.has(row.id));
      if (!temporary.length) continue;
      expect((await request.patch(api(id), { data: { operation: 'delete-rows', rows: temporary.map(row => ({ rowId: row.id, expectedCells: row.cells })) } })).status()).toBe(200);
    }
  }
  for (const [id, before] of sourceBefore) expect((await readDirectory(request, id)).rows).toEqual(before.rows);
});

test('combined special needs and both full titles are accessible inside a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(directoryPage);
  const first = page.getByRole('tab', { name: 'Vsi seznami', exact: true });
  await first.focus();
  await first.press('End');
  const last = page.getByRole('tab', { name: 'Posebne potrebe', exact: true });
  await expect(last).toHaveAttribute('aria-selected', 'true');
  await expect(last).toBeFocused();
  await expect(page).toHaveURL(directoryPage + '?tab=posebne-potrebe');
  await expect.poll(async () => last.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.left >= -1 && rect.right <= window.innerWidth + 1;
  })).toBe(true);
  for (const title of specialTitles) await expect(page.getByRole('tabpanel').getByText(title, { exact: true })).toBeVisible();
  await expect(page.getByRole('tabpanel').getByRole('table')).toBeVisible();
  await last.press('Home');
  await expect(first).toHaveAttribute('aria-selected', 'true');
  await expect(first).toBeFocused();
  await expect(page).toHaveURL(directoryPage + '?tab=vsi-seznami');
});

test('directory API rejects unauthenticated access and invalid directory identifiers', async ({ request, playwright, baseURL }) => {
  const anonymous = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  try {
    for (const id of ['vrtci', 'vsi-seznami', 'posebne-potrebe']) expect((await anonymous.get(api(id))).status()).toBe(401);
    expect((await anonymous.patch(api('vrtci'), { data: { operation: 'add-row', rowId: 'must-not-exist' } })).status()).toBe(401);
    expect((await anonymous.patch(api('vsi-seznami'), { data: { operation: 'add-row', rowId: 'dijaski-domovi::must-not-exist' } })).status()).toBe(401);
  } finally {
    await anonymous.dispose();
  }
  expect((await request.get(api('not-a-directory'))).status()).toBe(400);
  expect((await request.patch(api('not-a-directory'), { data: { operation: 'add-row', rowId: 'must-not-exist' } })).status()).toBe(400);
});
