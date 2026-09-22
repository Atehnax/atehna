import { expect, test } from '@playwright/test';

const ready = async (page: import('@playwright/test').Page) => {
  await expect(page.getByTestId('order-document-canvas-preview-state')).toHaveText('Predogled je posodobljen', { timeout: 60_000 });
  await expect(page.getByTestId('order-document-canvas').locator('img[data-order-document-pdf-page]')).toBeVisible();
};
const artworkFingerprint = (page: import('@playwright/test').Page) => page.getByTestId('order-document-canvas').locator('img').first().evaluate(async (image) => {
  const bytes = new TextEncoder().encode(image.getAttribute('src') ?? '');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
});
const deferredLayer = (page: import('@playwright/test').Page) => page.locator('[data-order-document-layers-panel]').getByRole('button', { name: /^Izberi plast: Naslov kasnejše dobave/ });

test('layers select an obscured delivery heading, save it, and discard later unsaved text', async ({ page, request }) => {
  test.setTimeout(90_000);
  const originalResponse = await request.get('/api/admin/order-document-templates');
  expect(originalResponse.ok()).toBeTruthy();
  const original = (await originalResponse.json()).config;
  const changedText = original.templates.dobavnica.text.deferredItemsTitle === 'Postavke za kasnejšo dobavo'
    ? 'Postavke za kasnejšo dobavo – preverjeno'
    : 'Postavke za kasnejšo dobavo';
  try {
    await page.goto('/admin/urejevalnik');
    await page.getByTestId('order-document-template-tab-dobavnica').click();
    await expect(page.locator('[data-order-document-layers-panel]')).toBeVisible();
    await ready(page);
    await page.getByLabel('Poišči plast ali besedilo').fill(original.templates.dobavnica.text.deferredItemsTitle);
    await deferredLayer(page).click();
    const heading = page.getByTestId('order-document-template-text-deferredItemsTitle');
    await expect(heading).toBeVisible();
    await expect(page.locator('[data-order-document-child-id="items:text:deferredItemsTitle"]').first()).toHaveAttribute('data-canvas-element-selected', 'true');
    const pixels = await artworkFingerprint(page);
    await heading.fill(changedText);
    await ready(page);
    await expect(heading).toBeFocused();
    expect(await artworkFingerprint(page)).not.toBe(pixels);
    const saved = page.waitForResponse(response => response.url().endsWith('/api/admin/order-document-templates') && response.request().method() === 'PUT');
    await page.getByTestId('order-document-template-save').click();
    expect((await saved).ok()).toBeTruthy();
    await expect(page.getByTestId('order-document-template-dirty-state')).not.toHaveText('Neshranjene spremembe');
    expect((await (await request.get('/api/admin/order-document-templates')).json()).config.templates.dobavnica.text.deferredItemsTitle).toBe(changedText);
    await page.reload();
    await page.getByTestId('order-document-template-tab-dobavnica').click();
    await ready(page);
    await page.getByLabel('Poišči plast ali besedilo').fill('kasnejso');
    await deferredLayer(page).click();
    await expect(heading).toHaveValue(changedText);
    await heading.fill('Neshranjeno besedilo');
    page.once('dialog', dialog => dialog.accept());
    await page.reload();
    await page.getByTestId('order-document-template-tab-dobavnica').click();
    await ready(page);
    await page.getByLabel('Poišči plast ali besedilo').fill('kasnejso');
    await deferredLayer(page).click();
    await expect(heading).toHaveValue(changedText);
    await page.screenshot({path:'tmp/pdf-editor/layers-desktop.png',fullPage:true});
  } finally {
    const restored = await request.put('/api/admin/order-document-templates', {data:original, headers:{Origin:new URL(test.info().project.use.baseURL!).origin}});
    expect(restored.ok(), await restored.text()).toBeTruthy();
  }
});

test('switching back reuses exact rendered PDFs; one worker serves new templates', async ({ page }) => {
  test.setTimeout(90_000);
  let requests = 0;
  const workers: string[] = [];
  page.on('request', request => { if (request.url().endsWith('/api/admin/order-document-templates/preview')) requests++; });
  page.on('worker', worker => { if (worker.url().includes('pdf.worker')) workers.push(worker.url()); });
  await page.goto('/admin/urejevalnik');
  await ready(page);
  const originalPixels = await artworkFingerprint(page);
  await page.getByTestId('order-document-template-tab-dobavnica').click();
  await ready(page);
  const dobavnicaPixels = await artworkFingerprint(page);
  const before = requests;
  const started = Date.now();
  await page.getByTestId('order-document-template-tab-order_summary').click();
  await ready(page);
  expect(await artworkFingerprint(page)).toBe(originalPixels);
  await page.getByTestId('order-document-template-tab-dobavnica').click();
  await ready(page);
  expect(await artworkFingerprint(page)).toBe(dobavnicaPixels);
  expect(requests).toBe(before);
  expect(workers).toHaveLength(1);
  test.info().annotations.push({type:'cached-switches',description:`Two exact cached switches: ${Date.now()-started} ms; zero preview requests; one PDF worker.`});
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('[data-order-document-layers-panel]')).toBeVisible();
  await page.getByLabel('Poišči plast ali besedilo').fill('Naslov kasnejše dobave');
  await deferredLayer(page).click();
  await expect(page.getByTestId('order-document-template-text-deferredItemsTitle')).toBeVisible();
  await page.screenshot({path:'tmp/pdf-editor/layers-mobile.png',fullPage:true});
});
