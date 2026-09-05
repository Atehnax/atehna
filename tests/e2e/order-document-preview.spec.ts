import { expect, test } from '@playwright/test';

const ready = async (page: import('@playwright/test').Page) => {
  await expect(page.getByTestId('order-document-canvas-preview-state')).toHaveText('Predogled je posodobljen', { timeout: 30_000 });
  await expect(page.getByTestId('order-document-canvas').locator('img[data-order-document-pdf-page]')).toBeVisible();
};

test('all templates share exact PDF artwork across views and viewport sizes', async ({ page }) => {
  test.setTimeout(120_000);
  let previewRequests = 0;
  page.on('request', (request) => { if (request.url().endsWith('/api/admin/order-document-templates/preview')) previewRequests += 1; });
  await page.goto('/admin/urejevalnik');
  for (const type of ['order_summary', 'offer', 'dobavnica', 'predracun', 'invoice']) {
    const tab = page.getByTestId(`order-document-template-tab-${type}`);
    if (await tab.count() === 0) continue;
    await tab.click();
    await ready(page);
    const artwork = page.getByTestId('order-document-canvas').locator('img[data-order-document-pdf-page]');
    const pixels = await artwork.getAttribute('src');
    expect(pixels).toMatch(/^data:image\/png;base64,/);
    const requests = previewRequests;
    await page.getByTestId('order-document-template-pdf-mode').click();
    await expect(page.getByTestId('order-document-template-preview').locator('img').first()).toHaveAttribute('src', pixels!);
    await expect(page.getByRole('link', { name: 'Prenesi PDF' })).toHaveAttribute('href', /^blob:/);
    await page.getByTestId('order-document-template-canvas-mode').click();
    await ready(page);
    await expect(artwork).toHaveAttribute('src', pixels!);
    expect(previewRequests).toBe(requests);
  }
  const artwork = page.getByTestId('order-document-canvas').locator('img[data-order-document-pdf-page]');
  const pixels = await artwork.getAttribute('src');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(artwork).toHaveAttribute('src', pixels!);
  const dimensions = await artwork.boundingBox();
  expect(dimensions!.width / dimensions!.height).toBeCloseTo(210 / 297, 2);
});

test('unsaved edits refresh both views and preview failures expose retry without stale artwork', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/admin/urejevalnik');
  await ready(page);
  const artwork = page.getByTestId('order-document-canvas').locator('img[data-order-document-pdf-page]');
  const before = await artwork.getAttribute('src');
  await page.locator('[data-order-document-child-id="title:field-row:title_text"]').click();
  const titleInput = page.locator('[data-order-document-field-row-edit="title_text"]');
  await titleInput.fill('POTRDITEV');
  await ready(page);
  await expect(titleInput).toBeFocused();
  await titleInput.fill('POTRDITEV ZA PREGLED');
  await ready(page);
  await expect(artwork).not.toHaveAttribute('src', before!);
  const after = await artwork.getAttribute('src');
  await page.getByTestId('order-document-template-pdf-mode').click();
  await expect(page.getByTestId('order-document-template-preview').locator('img').first()).toHaveAttribute('src', after!);
  await page.route('**/api/admin/order-document-templates/preview', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Predogled začasno ni na voljo.' }) }));
  await page.getByTestId('order-document-template-preview-refresh').click();
  await expect(page.getByTestId('order-document-template-preview-error')).toBeVisible();
  await expect(page.getByTestId('order-document-template-preview')).toHaveCount(0);
  await page.getByTestId('order-document-template-canvas-mode').click();
  await expect(artwork).toHaveCount(0);
  await page.unroute('**/api/admin/order-document-templates/preview');
  await page.getByRole('button', { name: 'Poskusi znova' }).click();
  await ready(page);
  await expect(artwork).toHaveAttribute('src', after!);
});
