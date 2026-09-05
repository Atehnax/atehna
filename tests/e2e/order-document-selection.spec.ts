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
    await expect(page.getByTestId('order-document-canvas-preview-state')).toHaveText('Predogled je posodobljen', { timeout: 30_000 });
  });

  test('Ctrl pointerdown adds top-level elements and its trailing click cannot undo the toggle', async ({ page }) => {
    const title = page.locator('[data-order-document-element-id="title"]');
    const intro = page.locator('[data-order-document-element-id="intro"]');

    // Dispatch to the top-level drag targets themselves. Their visible content
    // contains independently selectable child rows, so a geometric click is
    // intentionally owned by whichever child happens to occupy that point.
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

    await firstRow.click();
    await secondRow.click({ modifiers: ['Meta'] });
    await expect(firstRow).toHaveAttribute('data-canvas-element-selected', 'true');
    await expect(secondRow).toHaveAttribute('data-canvas-element-selected', 'true');

    const tableCells = page.locator('[data-order-document-table-scope="table_cell"]');
    expect(await tableCells.count()).toBeGreaterThanOrEqual(2);
    const firstCell = tableCells.nth(0);
    const secondCell = tableCells.nth(1);
    await firstCell.click();
    await secondCell.click({ modifiers: ['Control'] });
    await expect(firstCell).toHaveAttribute('data-canvas-element-selected', 'true');
    await expect(secondCell).toHaveAttribute('data-canvas-element-selected', 'true');
  });

  test('table header/body/row/column scope buttons retain additive selections', async ({ page }) => {
    const header = page.locator('[data-order-document-table-scope="table_header"]');
    const body = page.locator('[data-order-document-table-scope="table_body"]');
    const headerHandle = header.locator(
      '[data-order-document-table-scope-keyboard-handle="table_header"]'
    );
    const bodyHandle = body.locator(
      '[data-order-document-table-scope-keyboard-handle="table_body"]'
    );
    await headerHandle.focus();
    await headerHandle.click();
    await bodyHandle.focus();
    await bodyHandle.click({ modifiers: ['Control'] });
    await expect(header).toHaveAttribute('data-canvas-element-selected', 'true');
    await expect(body).toHaveAttribute('data-canvas-element-selected', 'true');

    const tableRow = page.locator('[data-order-document-table-scope="table_row"]').first();
    const rowHandle = tableRow.locator(
      '[data-order-document-table-scope-keyboard-handle="table_row"]'
    );
    await rowHandle.focus();
    await rowHandle.click({ modifiers: ['Control'] });
    await expect(tableRow).toHaveAttribute('data-canvas-element-selected', 'true');

    const cell = page.locator('[data-order-document-table-scope="table_cell"]').first();
    await cell.scrollIntoViewIfNeeded();
    await expect(cell).toBeVisible();
    // Moving keyboard focus hides the preceding row scope handle before the
    // cell activation, matching how a keyboard user proceeds through controls.
    await cell.focus();
    await expect(cell).toBeFocused();
    await cell.press('Enter');
    await expect(cell).toHaveAttribute('data-canvas-element-selected', 'true');
    await expect(page.getByTestId('order-document-floating-toolbar')).toHaveAttribute(
      'data-toolbar-ready',
      'true'
    );
    const inspector = page.getByTestId('order-document-element-inspector');
    await inspector.getByRole('button', { name: 'Vse nastavitve', exact: true }).click();
    const columnScope = page.locator('[data-order-document-table-quick-scope="column"]');
    await expect(columnScope).toBeVisible();
    await expect(columnScope).toBeEnabled();
    await columnScope.click({ modifiers: ['Control'] });
    await expect(cell).toHaveAttribute('data-canvas-element-selected', 'true');
    await expect(page.getByTestId('order-document-canvas')).toHaveAttribute(
      'data-order-document-selection-count',
      '2'
    );
    await expect(page.getByTestId('order-document-selection-count')).toHaveText('2 izbranih');
  });
});
