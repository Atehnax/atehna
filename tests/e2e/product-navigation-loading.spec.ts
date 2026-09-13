import { expect, test, type Page, type Route } from '@playwright/test';

const productPath = '/products/materiali/items/aluminijasta-plosca';
const productName = 'Aluminijasta plošča';
const searchName = 'Poiščite izdelek, material ali oznako';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('atehna-cart-v3'));
});

async function openCatalog(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/products', { waitUntil: 'networkidle' });
  await expect(page.locator('[data-catalog-product]').first()).toBeVisible();
  const search = page.getByRole('searchbox', { name: searchName, exact: true });
  await search.fill('Aluminijasta');
  const product = page.locator(`main a[href="${productPath}"]`).first();
  await expect(product).toBeVisible();
  return { search, product };
}

// Delay the first detail-only client code, after its RSC response can arrive.
// Delaying the whole request would not exercise the intermediate loading boundary.
async function holdNewClientCode(page: Page) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const requests: string[] = [];
  const continuations: Promise<void>[] = [];
  const pattern = '**/_next/static/**/*.js';
  const handle = async (route: Route) => {
    requests.push(route.request().url());
    const continuation = held.then(() => route.continue());
    continuations.push(continuation);
    await continuation;
  };
  await page.route(pattern, handle);
  return {
    requests,
    release,
    async close() {
      release();
      await Promise.all(continuations);
      await page.unroute(pattern, handle);
    }
  };
}

async function expectCompleteProduct(page: Page) {
  await expect(page).toHaveURL(new RegExp(`${productPath}$`, 'u'));
  await expect(page.getByRole('heading', { level: 1, name: productName, exact: true })).toBeVisible();
  const gallery = page.locator('.storefront-product-gallery');
  await expect(gallery).toBeVisible();
  await expect.poll(() => gallery.locator('img').first().evaluate((image: HTMLImageElement) => (
    image.complete && image.naturalWidth > 0
  ))).toBeTruthy();
  await expect(page.locator('.storefront-dimensional-variant-selector')).toBeVisible();
  await expect(page.locator('#product-quantity')).toBeVisible();
  await expect(page.locator('.storefront-product-primary-action').filter({ visible: true }).first()).toBeEnabled();
  await expect(page.getByRole('status', { name: 'Nalaganje kataloga', exact: true })).toHaveCount(0);
}

test('direct catalog content and product controls remain complete and functional', async ({ page }) => {
  await openCatalog(page);
  await page.goto(productPath);
  await expectCompleteProduct(page);
  const quantity = page.locator('#product-quantity');
  const initialQuantity = Number(await quantity.inputValue());
  await page.locator('.storefront-product-quantity-button').filter({ hasText: '+' }).click();
  await expect(quantity).toHaveValue(String(initialQuantity + 1));
  await page.locator('.storefront-product-primary-action').filter({ visible: true }).first().click();
  const cart = page.getByRole('dialog', { name: /^Košarica/u });
  await expect(cart).toBeVisible();
  await expect(cart.getByLabel(`Količina za ${productName}`, { exact: true })).toHaveValue(String(initialQuantity + 1));
});

test('slow detail code retains the current catalog and URL until the complete product is ready', async ({ page }) => {
  const { search, product } = await openCatalog(page);
  const gate = await holdNewClientCode(page);
  try {
    await product.click();
    await expect.poll(() => gate.requests.length).toBeGreaterThan(0);
    await expect(page).toHaveURL(/\/products$/u);
    await expect(search).toBeVisible();
    await expect(search).toHaveValue('Aluminijasta');
    await expect(product).toBeVisible();
    await expect(page.locator('[data-product-layout]')).toHaveCount(0);
    gate.release();
    await expectCompleteProduct(page);
    const quantity = page.locator('#product-quantity');
    const initialQuantity = Number(await quantity.inputValue());
    await page.locator('.storefront-product-quantity-button').filter({ hasText: '+' }).click();
    await expect(quantity).toHaveValue(String(initialQuantity + 1));
  } finally {
    await gate.close();
  }
});

test('a pending detail navigation can be interrupted without publishing a stale product', async ({ page }) => {
  const { search, product } = await openCatalog(page);
  const gate = await holdNewClientCode(page);
  try {
    await product.click();
    await expect.poll(() => gate.requests.length).toBeGreaterThan(0);
    await expect(search).toBeVisible();
    await page.getByRole('navigation', { name: 'Kategorije', exact: true })
      .getByRole('link', { name: 'Vse kategorije', exact: true }).click();
    await expect(page).toHaveURL(/\/products\/vsi-izdelki$/u);
    await expect(page.getByRole('heading', { level: 1, name: 'Vse kategorije', exact: true })).toBeVisible();
    await expect(search).toHaveValue('Aluminijasta');
    gate.release();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/products\/vsi-izdelki$/u);
    await expect(search).toHaveValue('Aluminijasta');
    await expect(page.locator('[data-product-layout]')).toHaveCount(0);
  } finally {
    await gate.close();
  }
});


test('fresh catalog exposes every server row while client code is still unavailable', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  type InitialRows = { parsedAt: number | null; visibleAt: number | null; paintOpportunityAt: number | null };
  await page.addInitScript(() => {
    const probe: InitialRows = { parsedAt: null, visibleAt: null, paintOpportunityAt: null };
    (window as typeof window & { __initialRows: InitialRows }).__initialRows = probe;
    const inspect = () => {
      const rows = [...document.querySelectorAll('[data-catalog-product]')];
      if (rows.length === 0) return;
      probe.parsedAt ??= performance.now();
      if (probe.visibleAt !== null || rows.some((row) => row.getBoundingClientRect().height === 0)) return;
      probe.visibleAt = performance.now();
      requestAnimationFrame(() => requestAnimationFrame(() => { probe.paintOpportunityAt = performance.now(); }));
    };
    new MutationObserver(inspect).observe(document, { childList: true, subtree: true, attributes: true });
    const frame = () => { inspect(); if (probe.paintOpportunityAt === null) requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  });
  const session = await page.context().newCDPSession(page);
  // Let the streamed document span browser frames, so a hidden whole-catalog
  // fallback cannot be masked by localhost delivering the entire HTML at once.
  await session.send('Network.emulateNetworkConditions', {
    offline: false, latency: 20, downloadThroughput: 256 * 1024, uploadThroughput: -1
  });
  const gate = await holdNewClientCode(page);
  try {
    const response = await page.goto('/products', { waitUntil: 'commit' });
    expect(response?.ok()).toBeTruthy();
    await response!.finished();
    await expect.poll(() => gate.requests.length).toBeGreaterThan(0);
    await page.waitForFunction(() => (window as typeof window & { __initialRows: InitialRows }).__initialRows.paintOpportunityAt !== null);
    const result = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('[data-catalog-product]')];
      return {
        ...(window as typeof window & { __initialRows: InitialRows }).__initialRows,
        stylesheetsReadyAt: Math.max(0, ...performance.getEntriesByType('resource')
          .filter((entry) => new URL(entry.name).pathname.endsWith('.css'))
          .map((entry) => (entry as PerformanceResourceTiming).responseEnd)),
        total: rows.length,
        visible: rows.filter((row) => row.getBoundingClientRect().height > 0).length
      };
    });
    expect(result.total).toBeGreaterThan(0);
    expect(result.visible).toBe(result.total);
    await test.info().attach('initial-catalog-paint', {
      body: JSON.stringify(result, null, 2), contentType: 'application/json'
    });
    // Global bandwidth throttling also delays render-blocking CSS. Measure the
    // reveal after both HTML rows and stylesheets are available, rather than
    // mislabeling CSS transfer time as React's observed 300 ms fallback hold.
    const readyAt = Math.max(result.parsedAt!, result.stylesheetsReadyAt);
    expect(result.paintOpportunityAt! - readyAt).toBeLessThan(200);
  } finally {
    await session.send('Network.emulateNetworkConditions', {
      offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1
    });
    await gate.close();
    await page.waitForLoadState('domcontentloaded');
  }
});
