import { expect, test, type Page } from '@playwright/test';
import { calculatePricingStockRow, createDefaultPricingStockModel } from '@/shared/domain/pricingStock';
import type { PricingStockBatchRequest, PricingStockRow, PricingStockState } from '@/shared/domain/pricingStock/api';
import { editPricingRow, expectPricingCellValue, pricingCell, pricingReadCell } from './support/pricing-stock-ui';

const sourceId = 880000, firstId = 880001, secondId = 880002;
const sku = (id: number) => `QUICK-${id - sourceId + 1}`;
const row = (page: Page, id: number) => page.locator(`tr[data-variant-id="${id}"]`);
const saveRow = (page: Page, id: number) => page.getByRole('button', { name: `Shrani urejanje za ${sku(id)}`, exact: true });
const cancelRow = (page: Page, id: number) => page.getByRole('button', { name: `Prekliči urejanje za ${sku(id)}`, exact: true });

function fixture(): PricingStockState {
  const model = createDefaultPricingStockModel('3');
  const rows: PricingStockRow[] = [sourceId, firstId, secondId].map((variantId, index) => {
    const values = { purchaseNet: index === 0 ? '2.00' : '1.50', saleNet: index === 0 ? '3.00' : '3.10', workMinutes: index === 0 ? '3.0000' : '4.0000', otherCosts: '0.20', inventory: 10 };
    return { ...values, variantId, itemId: 8800, itemName: 'Preizkus hitrega urejanja', variantName: `Različica ${index + 1}`, sku: sku(variantId), unit: 'kos', categoryId: 'quick', categoryLabel: 'Preizkus', itemSlug: 'quick-edit-fixture', status: 'active', stockRevision: '5', pricingRevision: '7', purchaseUpdatedAt: null, updatedAt: '2026-09-06T10:00:00.000Z', reserved: 0, available: 10, reservationNote: null, sizing: { productType: 'dimensions', lengthMm: String((index + 1) * 100), widthMm: '100', thicknessMm: '0.5', weightKg: null, material: null, shape: null }, calculation: calculatePricingStockRow(values, model) };
  });
  return { rows, model, stockEnforcementEnabled: false, capabilities: { viewCosts: true, editCosts: true, editPrices: true, editStock: true, editModel: true } };
}

async function mockWorkspace(page: Page, configure?: (state: PricingStockState) => void) {
  const state = fixture(), writes: PricingStockBatchRequest[] = [], blocked: string[] = [];
  configure?.(state);
  for (const target of state.rows) target.calculation = calculatePricingStockRow(target, state.model);
  // Every browser mutation is intercepted; this spec has no database fixture hooks.
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path === '/api/admin/pricing-stock') {
      if (request.method() === 'GET') { await route.fulfill({ status: 200, json: state }); return; }
      if (request.method() === 'PATCH') {
        const body = request.postDataJSON() as PricingStockBatchRequest;
        writes.push(body);
        if (body.model) state.model = { ...body.model, revision: String(BigInt(state.model.revision) + 1n) };
        for (const change of body.rows) {
          const target = state.rows.find(candidate => candidate.variantId === change.variantId);
          expect(target).toBeDefined();
          Object.assign(target!, change.patch, { pricingRevision: String(BigInt(target!.pricingRevision) + 1n) });
        }
        for (const target of state.rows) target.calculation = calculatePricingStockRow(target, state.model);
        await route.fulfill({ status: 200, json: state }); return;
      }
    }
    if (!['GET', 'HEAD'].includes(request.method())) {
      blocked.push(`${request.method()} ${path}`);
      await route.fulfill({ status: 409, json: { message: 'Mocked quick-edit verification blocks unrelated writes.' } }); return;
    }
    await route.continue();
  });
  await page.goto('/admin/artikli?view=pricing-stock');
  await expect(page.getByTestId('pricing-stock-table')).toBeVisible();
  return { state, writes, blocked };
}

async function requestRowSwitch(page: Page, id: number) {
  await row(page, id).getByRole('button', { name: /^Možnosti za /u }).click();
  await page.getByRole('menuitem', { name: 'Hitro urejanje', exact: true }).click();
  return page.getByRole('dialog', { name: 'Neshranjene spremembe', exact: true });
}

async function stageOtherRows(page: Page) {
  await row(page, sourceId).getByRole('checkbox').check();
  await page.getByTestId('pricing-column-copy-purchaseNet').click();
  await expectPricingCellValue(page, firstId, 'purchaseNet', '2.00');
  await expectPricingCellValue(page, secondId, 'purchaseNet', '2.00');
  await expect(page.locator('input[data-pricing-cell]')).toHaveCount(0);
}

test('row quick edit starts explicitly and cancel or guarded switching restores the entry draft', async ({ page }) => {
  const mock = await mockWorkspace(page);
  await expect(page.locator('#pricing-model-body')).toBeVisible();
  await expect(page.getByRole('button', { name: /^(Skrij|Prikaži) model$/u })).toHaveCount(0);
  const explanation = page.getByRole('button', { name: 'Prikaži razlago', exact: true });
  await expect(explanation).toHaveText('');await expect(explanation.locator('svg')).toHaveCount(1);
  await expect(explanation).toHaveAttribute('aria-expanded', 'false');await explanation.click();
  const hideExplanation = page.getByRole('button', { name: 'Skrij razlago', exact: true });
  await expect(hideExplanation).toHaveText('');await expect(hideExplanation).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#pricing-model-definitions-body')).toBeVisible();await expect(page.locator('#pricing-model-body')).toBeVisible();
  await hideExplanation.click();await expect(page.locator('#pricing-model-definitions-body')).toBeHidden();await expect(page.locator('#pricing-model-body')).toBeVisible();
  await expect(page.locator('input[data-pricing-cell]')).toHaveCount(0);
  await expect(pricingReadCell(page, firstId, 'purchaseNet')).toBeVisible();
  await stageOtherRows(page);
  await editPricingRow(page, firstId);
  await expect(row(page, firstId)).toHaveAttribute('data-editing', 'true');
  await expect(pricingCell(page, secondId, 'purchaseNet')).toHaveCount(0);
  await pricingCell(page, firstId, 'purchaseNet').fill('2,67');
  await cancelRow(page, firstId).click();
  await expect(page.locator('input[data-pricing-cell]')).toHaveCount(0);
  await expectPricingCellValue(page, firstId, 'purchaseNet', '2.00');
  await expectPricingCellValue(page, secondId, 'purchaseNet', '2.00');
  await editPricingRow(page, firstId);await pricingCell(page, firstId, 'purchaseNet').fill('3,67');
  let guard = await requestRowSwitch(page, secondId);
  await guard.getByRole('button', { name: 'Nadaljuj urejanje', exact: true }).click();
  await expectPricingCellValue(page, firstId, 'purchaseNet', '3.67');
  await expect(pricingCell(page, secondId, 'purchaseNet')).toHaveCount(0);
  guard = await requestRowSwitch(page, secondId);
  await guard.getByRole('button', { name: 'Zavrzi spremembe', exact: true }).click();
  await expect(row(page, secondId)).toHaveAttribute('data-editing', 'true');
  await expect(pricingCell(page, firstId, 'purchaseNet')).toHaveCount(0);
  await expectPricingCellValue(page, firstId, 'purchaseNet', '2.00');
  await cancelRow(page, secondId).click();
  await expect(page.getByTestId('pricing-stock-save-status')).toHaveText('Neshranjeno');
  expect(mock.writes).toEqual([]);expect(mock.blocked).toEqual([]);
  await editPricingRow(page, secondId);
  await page.getByRole('button', { name: 'Razveljavi', exact: true }).click();
  await expect(page.locator('input[data-pricing-cell]')).toHaveCount(0);
  await expectPricingCellValue(page, firstId, 'purchaseNet', '1.50');
  await expect(page.getByTestId('pricing-stock-save-status')).toHaveText('Shranjeno');
});

test('saving one row preserves other drafts and a dirty model requires the combined save', async ({ page }) => {
  const mock = await mockWorkspace(page);await stageOtherRows(page);
  await editPricingRow(page, firstId);
  await pricingCell(page, firstId, 'purchaseNet').fill('2,67');await pricingCell(page, firstId, 'saleNet').fill('4,44');
  await saveRow(page, firstId).click();
  await expect.poll(() => mock.writes.length).toBe(1);
  await expect(page.locator('input[data-pricing-cell]')).toHaveCount(0);
  expect(mock.writes[0]).toEqual({ expectedModelRevision: '3', rows: [{ variantId: firstId, expectedPricingRevision: '7', patch: { purchaseNet: '2.67', saleNet: '4.44' } }] });
  expect(mock.state.rows.find(candidate => candidate.variantId === secondId)!.purchaseNet).toBe('1.50');
  await expectPricingCellValue(page, secondId, 'purchaseNet', '2.00');
  await expect(page.getByTestId('pricing-stock-save-status')).toHaveText('Neshranjeno');
  await editPricingRow(page, firstId);await pricingCell(page, firstId, 'purchaseNet').fill('3,11');await cancelRow(page, firstId).click();
  await expectPricingCellValue(page, firstId, 'purchaseNet', '2.67');expect(mock.writes).toHaveLength(1);
  await editPricingRow(page, secondId);await pricingCell(page, secondId, 'purchaseNet').fill('3,11');
  await page.locator('#pricing-model-targetProfit').fill('2500');
  await expect(saveRow(page, secondId)).toBeDisabled();
  await expect(saveRow(page, secondId).locator('..')).toHaveAttribute('title', /enačbo|model/u);
  await page.getByRole('button', { name: 'Shrani spremembe', exact: true }).click();
  await expect.poll(() => mock.writes.length).toBe(2);
  expect(mock.writes[1]).toMatchObject({ expectedModelRevision: '3', model: { parameters: { targetProfit: '2500.00' } }, rows: [{ variantId: secondId, expectedPricingRevision: '7', patch: { purchaseNet: '3.11' } }] });
  expect(mock.writes[1].rows).toHaveLength(1);
  await expect(page.locator('input[data-pricing-cell]')).toHaveCount(0);
  await expect(page.getByTestId('pricing-stock-save-status')).toHaveText('Shranjeno');
  await page.reload();await expectPricingCellValue(page, firstId, 'saleNet', '4.44');await expectPricingCellValue(page, secondId, 'purchaseNet', '3.11');
  await expect(page.locator('input[data-pricing-cell]')).toHaveCount(0);
  expect(mock.blocked).toEqual([]);
});


test('filter tags narrow rows independently and whole-minute presentation preserves exact work', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const mock = await mockWorkspace(page, state => {
    state.rows[1].workMinutes = '3.6000';
    state.rows[2].workMinutes = null;
    state.rows[2].categoryId = 'other';state.rows[2].categoryLabel = 'Druga skupina';
  });
  const table = page.getByTestId('pricing-stock-table'), visibleRows = table.locator('tbody tr[data-variant-id]');
  await expect(visibleRows).toHaveCount(3);
  await expect(pricingReadCell(page, sourceId, 'workMinutes')).toHaveText(/^3\s*min$/u);
  await expect(pricingReadCell(page, firstId, 'workMinutes')).toHaveText(/^4\s*min$/u);
  await expect(pricingReadCell(page, secondId, 'workMinutes')).toHaveText('—');
  await expect(pricingReadCell(page, firstId, 'workMinutes')).toHaveAttribute('title', /izračun uporablja 3,6 min/u);
  const savedRow = structuredClone(mock.state.rows[1]);
  const target = page.locator(`[data-target-rvc="${firstId}"]`);
  await expect(target).toHaveText(savedRow.calculation.targetRvc!.replace('.', ',') + ' €');
  const targetBefore = await target.innerText();
  await editPricingRow(page, firstId);
  await expect(pricingCell(page, firstId, 'workMinutes')).toHaveValue('4');
  await expect(saveRow(page, firstId)).toBeDisabled();
  await cancelRow(page, firstId).click();
  await expect(pricingReadCell(page, firstId, 'workMinutes')).toHaveText(/^4\s*min$/u);
  await expect(target).toHaveText(targetBefore);
  expect(mock.state.rows[1]).toEqual(savedRow);
  await expect(page.getByTestId('pricing-stock-save-status')).toHaveText('Shranjeno');

  await page.getByRole('button', { name: 'Filtriraj po nabavni ceni', exact: true }).click();
  const range = page.getByRole('dialog', { name: 'Nabavna cena brez DDV (€)', exact: true });
  await range.getByRole('textbox', { name: 'Od', exact: true }).fill('2');
  await range.getByRole('button', { name: 'Potrdi', exact: true }).click();
  await expect(visibleRows).toHaveCount(1);await expect(row(page, sourceId)).toBeVisible();
  const tags = page.getByTestId('pricing-stock-active-filters');
  await expect(tags).toContainText('Nabavna cena: ≥ 2 €');
  await tags.scrollIntoViewIfNeeded();
  const tagBox = await tags.boundingBox(), pagerBox = await page.locator('[aria-label="Paginacija tabele"]').first().boundingBox();
  expect(tagBox).not.toBeNull();expect(pagerBox).not.toBeNull();
  expect(tagBox!.x + tagBox!.width).toBeLessThanOrEqual(pagerBox!.x);
  expect(Math.abs((tagBox!.y + tagBox!.height / 2) - (pagerBox!.y + pagerBox!.height / 2))).toBeLessThanOrEqual(2);

  const search = page.getByLabel('Poišči artikel ali SKU', { exact: true });
  await search.fill('QUICK');
  await page.getByRole('button', { name: 'Filtriraj po kategoriji', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Preizkus', exact: true }).click();
  await page.getByRole('button', { name: 'Filtriraj po pokritju', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Pod pragom', exact: true }).click();
  await expect(tags.getByRole('button')).toHaveCount(4);
  await tags.getByRole('button', { name: 'Odstrani filter Nabavna cena: ≥ 2 €', exact: true }).click();
  await expect(visibleRows).toHaveCount(2);
  await expect(tags).toContainText('Iskanje: QUICK');await expect(tags).toContainText('Kategorija: Preizkus');await expect(tags).toContainText('Pokritje: Pod pragom');
  await search.fill('QUICK-1');await expect(visibleRows).toHaveCount(1);
  await tags.getByRole('button', { name: 'Odstrani filter Iskanje: QUICK-1', exact: true }).click();
  await expect(search).toHaveValue('');await expect(visibleRows).toHaveCount(2);
  await expect(tags.getByRole('button')).toHaveCount(2);
  await tags.getByRole('button', { name: 'Odstrani filter Kategorija: Preizkus', exact: true }).click();
  await expect(visibleRows).toHaveCount(2);await expect(tags).toContainText('Pokritje: Pod pragom');
  await tags.getByRole('button', { name: 'Odstrani filter Pokritje: Pod pragom', exact: true }).click();
  await expect(tags).toHaveCount(0);await expect(visibleRows).toHaveCount(3);
  await expect(page.getByTestId('pricing-stock-save-status')).toHaveText('Shranjeno');
  expect(mock.state.rows[1]).toEqual(savedRow);expect(mock.writes).toEqual([]);expect(mock.blocked).toEqual([]);
});


test('RVC percentage filters retain independent euro ranges and distinguish zero from missing', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const mock = await mockWorkspace(page, state => {
    const seed = state.rows[0];
    const values: Array<{ purchaseNet: string | null; saleNet: string }> = [
      { purchaseNet: '112.50', saleNet: '100.00' },
      { purchaseNet: '100.00', saleNet: '100.00' },
      { purchaseNet: '0.00', saleNet: '0.00' },
      { purchaseNet: '75.00', saleNet: '100.00' },
      { purchaseNet: '150.00', saleNet: '200.00' },
      { purchaseNet: null, saleNet: '100.00' }
    ];
    state.rows = values.map((value, index) => ({
      ...structuredClone(seed), ...value, variantId: sourceId + index,
      variantName: 'Filter ' + (index + 1), sku: 'RVC-' + (index + 1)
    }));
  });
  expect(mock.state.rows.map(candidate => candidate.calculation.rvcPercent)).toEqual(['-12.50', '0.00', null, '25.00', '25.00', null]);
  const table = page.getByTestId('pricing-stock-table');
  const visibleRows = table.locator('tbody tr[data-variant-id]');
  const tags = page.getByTestId('pricing-stock-active-filters');
  const trigger = page.getByRole('button', { name: 'Filtriraj po RVC', exact: true });
  const dialog = page.getByRole('dialog', { name: /^RVC \([€%]\)$/u });
  const assertRows = async (indices: number[]) => {
    await expect.poll(() => visibleRows.evaluateAll(elements => elements.map(element => Number(element.getAttribute('data-variant-id')))))
      .toEqual(indices.map(index => sourceId + index));
  };
  const open = async (unit: '€' | '%') => {
    await trigger.click();
    await dialog.getByRole('button', { name: unit, exact: true }).click();
    await expect(dialog).toHaveAttribute('aria-label', 'RVC (' + unit + ')');
    await expect(dialog.getByRole('button', { name: unit, exact: true })).toHaveAttribute('aria-pressed', 'true');
  };
  const fill = async (min: string, max: string) => {
    await dialog.getByRole('textbox', { name: 'Od', exact: true }).fill(min);
    await dialog.getByRole('textbox', { name: 'Do', exact: true }).fill(max);
  };
  const confirm = () => dialog.getByRole('button', { name: 'Potrdi', exact: true }).click();
  const assertRange = async (min: string, max: string) => {
    await expect(dialog.getByRole('textbox', { name: 'Od', exact: true })).toHaveValue(min);
    await expect(dialog.getByRole('textbox', { name: 'Do', exact: true })).toHaveValue(max);
  };
  const remove = (unit: '€' | '%') => tags.getByRole('button', { name: new RegExp('^Odstrani filter RVC:.*' + unit + '$', 'u') }).click();

  await assertRows([0, 1, 2, 3, 4, 5]);
  await open('%');await fill('-12,5', '-12,5');await confirm();await assertRows([0]);
  await expect(tags).toContainText('RVC: -12,5 – -12,5 %');
  await trigger.click();await expect(dialog).toHaveAttribute('aria-label', 'RVC (%)');await assertRange('-12,5', '-12,5');
  await dialog.getByRole('button', { name: '€', exact: true }).click();await assertRange('', '');
  await fill('0', '50');await confirm();await assertRows([]);
  await expect(tags.getByRole('button')).toHaveCount(2);
  await remove('%');await assertRows([1, 2, 3, 4]);
  await expect(tags).toContainText('RVC: 0 – 50 €');await expect(tags.getByRole('button')).toHaveCount(1);

  await open('%');await assertRange('', '');await fill('0', '25');await confirm();await assertRows([1, 3, 4]);
  await open('€');await assertRange('0', '50');
  await dialog.getByRole('button', { name: '%', exact: true }).click();await assertRange('0', '25');
  await fill('0', '0');await confirm();await assertRows([1]);
  await open('€');await assertRange('0', '50');
  await dialog.getByRole('button', { name: '%', exact: true }).click();await assertRange('0', '0');
  await page.keyboard.press('Escape');await remove('€');await assertRows([1]);
  await expect(tags).toContainText('RVC: 0 – 0 %');await expect(tags.getByRole('button')).toHaveCount(1);

  await open('%');await fill('25', '25');await confirm();await assertRows([3, 4]);
  await open('€');await assertRange('', '');await fill('30', '');await confirm();await assertRows([4]);
  await expect(tags).toContainText('RVC: 25 – 25 %');await expect(tags).toContainText('RVC: ≥ 30 €');
  await open('%');await assertRange('25', '25');
  const box = await dialog.boundingBox();expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(8);expect(box!.x + box!.width).toBeLessThanOrEqual(1366 - 8);
  expect(box!.y).toBeGreaterThanOrEqual(8);expect(box!.y + box!.height).toBeLessThanOrEqual(900 - 8);
  await expect(dialog.getByRole('button', { name: 'Potrdi', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '%', exact: true })).toHaveCSS('background-color', 'rgb(233, 239, 255)');
  const screenshot = testInfo.outputPath('rvc-percent-filter.png');
  await page.screenshot({ path: screenshot });await testInfo.attach('RVC percentage filter', { path: screenshot, contentType: 'image/png' });
  await page.keyboard.press('Escape');await remove('%');await assertRows([4]);
  await expect(tags).toContainText('RVC: ≥ 30 €');await expect(tags.getByRole('button')).toHaveCount(1);
  await remove('€');await assertRows([0, 1, 2, 3, 4, 5]);await expect(tags).toHaveCount(0);
  await expect(page.getByTestId('pricing-stock-save-status')).toHaveText('Shranjeno');
  await expect(page.locator('input[data-pricing-cell]')).toHaveCount(0);
  expect(mock.writes).toEqual([]);expect(mock.blocked).toEqual([]);
});
