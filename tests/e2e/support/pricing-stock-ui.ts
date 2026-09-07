import { expect, type Page } from '@playwright/test';
import { formatExactDecimal, parseExactDecimal } from '@/shared/domain/pricingStock/decimal';

export function pricingCell(page: Page, id: number, field: string) {
  return page.locator(`input[data-pricing-cell="${id}:${field}"]`);
}
export function pricingReadCell(page: Page, id: number, field: string) {
  return page.locator(`td[data-pricing-read="${id}:${field}"]`);
}
export async function editPricingRow(page: Page, id: number) {
  const row = page.locator(`tr[data-variant-id="${id}"]`);
  await row.getByRole('button', { name: /^Možnosti za /u }).click();
  await page.getByRole('menuitem', { name: 'Hitro urejanje', exact: true }).click();
  await expect(row.locator('input[data-pricing-cell]').first()).toBeVisible();
}
const normalizedValue = (value: string) => {
  let numeric = value.replace(/\s/gu, '').replace(/(?:€|min)$/u, '');
  if (numeric === '—') return '';
  if (numeric.includes(',')) numeric = numeric.replace(/\./gu, '');
  try {
    const exact = parseExactDecimal(numeric);
    return `${exact.numerator}/${exact.denominator}`;
  } catch { return numeric; }
};
/** Assert display or untouched-input values without entering edit mode; typed raw text uses toHaveValue. */
export async function expectPricingCellValue(page: Page, id: number, field: string, value: string) {
  let expected = value;
  if (field === 'workMinutes' && value.trim()) {
    try { expected = formatExactDecimal(parseExactDecimal(value), 0); } catch { /* Invalid input stays literal. */ }
  }
  await expect.poll(async () => {
    const input = pricingCell(page, id, field);
    if (await input.count()) return normalizedValue(await input.inputValue());
    const display = pricingReadCell(page, id, field);
    return await display.count() ? normalizedValue(await display.innerText()) : '[cell missing]';
  }).toBe(normalizedValue(expected));
}
