import { expect, test } from '@playwright/test';

test('category rename Materiali -> Materiali2 saves and persists after refresh', async ({ page }) => {
  await page.goto('/admin/kategorije');

  const row = page.locator('button[title="Materiali"]').first().locator('xpath=ancestor::tr[1]');
  await row.getByRole('button', { name: 'Uredi' }).click();

  await page.locator('input[value="Materiali"]').first().fill('Materiali2');
  await page.getByRole('button', { name: 'Shrani' }).first().click();

  await expect(page.getByText('Shranjeno').first()).toBeVisible();

  await page.reload();
  await expect(page.locator('button[title="Materiali2"]').first()).toBeVisible();

  const renamedRow = page.locator('button[title="Materiali2"]').first().locator('xpath=ancestor::tr[1]');
  await renamedRow.getByRole('button', { name: 'Uredi' }).click();
  await page.locator('input[value="Materiali2"]').first().fill('Materiali');
  await page.getByRole('button', { name: 'Shrani' }).first().click();

  await expect(page.getByText('Shranjeno').first()).toBeVisible();
});
