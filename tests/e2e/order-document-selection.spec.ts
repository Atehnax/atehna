import { expect, test } from '@playwright/test';

const modifiedPointerDown = {
  button: 0,
  buttons: 1,
  pointerId: 41,
  pointerType: 'mouse'
} as const;
const modifiedClick = { button: 0 } as const;

test.describe('order-document canvas additive selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/urejevalnik');
    await expect(page.getByTestId('order-document-canvas')).toBeVisible();
  });

  test('Ctrl pointerdown adds top-level elements and its trailing click cannot undo the toggle', async ({ page }) => {
    const title = page.locator('[data-order-document-element-id="title"]');
    const intro = page.locator('[data-order-document-element-id="intro"]');

    await title.dispatchEvent('click', modifiedClick);
    await intro.dispatchEvent('pointerdown', {
      ...modifiedPointerDown,
      ctrlKey: true
    });
    await expect(title).toHaveAttribute('data-order-document-element-selected', 'true');
    await expect(intro).toHaveAttribute('data-order-document-element-selected', 'true');

    await intro.dispatchEvent('click', { ...modifiedClick, ctrlKey: true });
    await expect(title).toHaveAttribute('data-order-document-element-selected', 'true');
    await expect(intro).toHaveAttribute('data-order-document-element-selected', 'true');
    await expect(page.getByTestId('order-document-selection-count')).toHaveText('2 izbranih');
  });

  test('Cmd pointerdown adds semantic rows and table cells through React pointer handlers', async ({ page }) => {
    const semanticRows = page.locator('[data-order-document-semantic-row-id]');
    expect(await semanticRows.count()).toBeGreaterThanOrEqual(2);
    const firstRow = semanticRows.nth(0);
    const secondRow = semanticRows.nth(1);

    await firstRow.dispatchEvent('click', modifiedClick);
    await secondRow.dispatchEvent('pointerdown', {
      ...modifiedPointerDown,
      metaKey: true
    });
    await secondRow.dispatchEvent('click', { ...modifiedClick, metaKey: true });
    await expect(firstRow).toHaveAttribute('data-canvas-element-selected', 'true');
    await expect(secondRow).toHaveAttribute('data-canvas-element-selected', 'true');

    const tableCells = page.locator('[data-order-document-table-scope="table_cell"]');
    expect(await tableCells.count()).toBeGreaterThanOrEqual(2);
    const firstCell = tableCells.nth(0);
    const secondCell = tableCells.nth(1);
    await firstCell.dispatchEvent('click', modifiedClick);
    await secondCell.dispatchEvent('pointerdown', {
      ...modifiedPointerDown,
      ctrlKey: true
    });
    await secondCell.dispatchEvent('click', { ...modifiedClick, ctrlKey: true });
    await expect(firstCell).toHaveAttribute('data-canvas-element-selected', 'true');
    await expect(secondCell).toHaveAttribute('data-canvas-element-selected', 'true');
  });

  test('table header/body/row/column scope buttons retain additive selections', async ({ page }) => {
    const header = page.locator('[data-order-document-table-scope="table_header"]');
    const body = page.locator('[data-order-document-table-scope="table_body"]');
    await header.dispatchEvent('click', modifiedClick);
    await body.dispatchEvent('pointerdown', {
      ...modifiedPointerDown,
      ctrlKey: true
    });
    await body.dispatchEvent('click', { ...modifiedClick, ctrlKey: true });
    await expect(header).toHaveAttribute('data-canvas-element-selected', 'true');
    await expect(body).toHaveAttribute('data-canvas-element-selected', 'true');

    const tableRow = page.locator('[data-order-document-table-scope="table_row"]').first();
    await tableRow.dispatchEvent('pointerdown', {
      ...modifiedPointerDown,
      ctrlKey: true
    });
    await tableRow.dispatchEvent('click', { ...modifiedClick, ctrlKey: true });
    await expect(tableRow).toHaveAttribute('data-canvas-element-selected', 'true');

    const cell = page.locator('[data-order-document-table-scope="table_cell"]').first();
    await cell.dispatchEvent('click', modifiedClick);
    await page
      .getByTestId('order-document-element-inspector')
      .getByRole('button', { name: 'Vsebina', exact: true })
      .click();
    const columnScope = page.locator(
      '[data-order-document-table-typography-scope="table_column"]'
    );
    await expect(columnScope).toBeVisible();
    await columnScope.dispatchEvent('pointerdown', {
      ...modifiedPointerDown,
      ctrlKey: true
    });
    await columnScope.dispatchEvent('click', { ...modifiedClick, ctrlKey: true });
    await expect(cell).toHaveAttribute('data-canvas-element-selected', 'true');
    await expect(columnScope).toHaveAttribute('aria-pressed', 'true');
  });
});
