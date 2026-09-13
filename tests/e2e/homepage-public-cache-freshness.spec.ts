import { expect, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';
import type { LandingPageConfig } from '@/shared/domain/landing/landingPage';
import type { SiteNavigationConfig } from '@/shared/domain/navigation/siteNavigation';
import type { GlobalStyleConfig } from '@/shared/domain/style/globalStyle';
import type { ProductAppearanceConfig } from '@/shared/domain/style/productAppearance';
import type { InventoryPolicySettings } from '@/shared/domain/inventory/inventoryPolicy';
import { assertAuthenticatedAdmin } from './support/auth';

async function config<T>(request: APIRequestContext, path: string): Promise<T> {
  const response = await request.get(path);
  expect(response.ok(), `Read ${path}: HTTP ${response.status()}`).toBeTruthy();
  return (await response.json() as { config: T }).config;
}

async function save(request: APIRequestContext, path: string, value: unknown) {
  const response = await request.put(path, { data: { config: value } });
  expect(response.ok(), `Save ${path}: HTTP ${response.status()}`).toBeTruthy();
}

async function homepageHtml(response: APIResponse) {
  expect(response.ok(), `Homepage: HTTP ${response.status()}`).toBeTruthy();
  return response.text();
}

async function cachedHomepage(request: APIRequestContext) {
  let html = '';
  await expect.poll(async () => {
    const response = await request.get('/');
    html = await homepageHtml(response);
    return response.headers()['x-nextjs-cache'];
  }, { timeout: 15_000, intervals: [100, 250, 500], message: 'The actual complete homepage must reach the Next full-route cache' }).toBe('HIT');
  return html;
}

async function readPublicHtml(page: Page, html: string) {
  // Parse the HTTP document without executing its scripts. Text in an RSC script
  // alone cannot satisfy the server-rendered hero/category/footer assertions.
  return page.evaluate((source) => {
    const document = new DOMParser().parseFromString(source, 'text/html');
    const hero = document.querySelector('[data-homepage-hero-root] h1');
    const categories = [...document.querySelectorAll('[data-homepage-category-card]')];
    const theme = document.querySelector<HTMLElement>('main')?.closest<HTMLElement>('[data-storefront-theme]');
    return {
      hero: hero?.textContent?.trim(),
      heroHidden: !!hero?.closest('[hidden]'),
      categories: categories.length,
      hiddenCategories: categories.filter((element) => element.closest('[hidden]')).length,
      footer: document.querySelector('footer')?.textContent ?? '',
      pageColor: theme?.style.getPropertyValue('--site-color-page').trim(),
      cartWidth: theme?.style.getPropertyValue('--product-cart-width').trim()
    };
  }, html);
}

test('cached public homepage immediately reflects each public admin setting', async ({ page, request, baseURL }) => {
  test.setTimeout(90_000);
  // This test deliberately writes only through the isolated local E2E server.
  expect(new URL(baseURL!).origin).toMatch(/^http:\/\/localhost:\d+$/u);
  await assertAuthenticatedAdmin(request);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const paths = {
    landing: '/api/admin/landing-page', navigation: '/api/admin/site-navigation',
    style: '/api/admin/global-style', appearance: '/api/admin/product-appearance',
    inventory: '/api/admin/inventory-policy'
  };
  const [landing, navigation, style, appearance, inventory] = await Promise.all([
    config<LandingPageConfig>(request, paths.landing),
    config<SiteNavigationConfig>(request, paths.navigation),
    config<GlobalStyleConfig>(request, paths.style),
    config<ProductAppearanceConfig>(request, paths.appearance),
    config<InventoryPolicySettings>(request, paths.inventory)
  ]);
  const original = await readPublicHtml(page, await cachedHomepage(request));
  expect(original.hero).toBe(landing.hero.title);
  expect(original.heroHidden).toBe(false);
  expect(original.categories).toBeGreaterThan(0);
  expect(original.hiddenCategories).toBe(0);
  const title = `Cache freshness hero ${Date.now()}`;
  const footer = `Cache freshness footer ${Date.now()}`;
  const pageColor = style.colors.pageBackground.toUpperCase() === '#F7F9FB' ? '#F6F8FA' : '#F7F9FB';
  const cartWidth = appearance.cartSidebar.widthPx >= 640 ? 480 : appearance.cartSidebar.widthPx + 1;
  const restores: Array<() => Promise<void>> = [];
  let expectedTitle = landing.hero.title;
  const complete = async (html: string) => {
    const rendered = await readPublicHtml(page, html);
    expect(rendered.hero).toBe(expectedTitle);
    expect(rendered.heroHidden).toBe(false);
    expect(rendered.categories).toBe(original.categories);
    expect(rendered.hiddenCategories).toBe(0);
    return rendered;
  };
  const check = async (assertHtml: (html: string) => Promise<void>, assertVisible: () => Promise<void>) => {
    // The FIRST read after the save must already be current: no query-string
    // cache bypass, waiting for TTL expiry, or content retry can mask a stale hit.
    const html = await homepageHtml(await request.get('/'));
    await complete(html);
    await assertHtml(html);
    const response = await page.goto('/');
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('[data-homepage-hero-root] h1')).toHaveText(expectedTitle);
    await expect(page.locator('[data-homepage-category-card]').first()).toBeVisible();
    await assertVisible();
    const cached = await cachedHomepage(request);
    await complete(cached);
    await assertHtml(cached);
  };
  try {
    await test.step('hero content invalidates a complete cached homepage', async () => {
      restores.push(() => save(request, paths.landing, landing));
      await save(request, paths.landing, { ...landing, hero: { ...landing.hero, title } });
      expectedTitle = title;
      await check(async (html) => { expect((await readPublicHtml(page, html)).hero).toBe(title); }, async () => {
        await expect(page.locator('[data-homepage-hero-root] h1')).toBeVisible();
      });
    });
    await test.step('canonical footer edit invalidates navigation data and homepage HTML', async () => {
      const patchFooter = async (description: string) => {
        const response = await request.patch(paths.navigation, { data: { footer: { description } } });
        expect(response.ok()).toBeTruthy();
      };
      restores.push(() => patchFooter(navigation.footer.description));
      await patchFooter(footer);
      await check(async (html) => { expect((await readPublicHtml(page, html)).footer).toContain(footer); }, async () => {
        await expect(page.locator('footer').getByText(footer, { exact: true })).toBeVisible();
      });
    });
    await test.step('global page background refreshes the shared public style', async () => {
      restores.push(() => save(request, paths.style, style));
      await save(request, paths.style, { ...style, colors: { ...style.colors, pageBackground: pageColor } });
      await check(async (html) => { expect((await readPublicHtml(page, html)).pageColor?.toUpperCase()).toBe(pageColor); }, async () => {
        const expectedRgb = pageColor === '#F7F9FB' ? 'rgb(247, 249, 251)' : 'rgb(246, 248, 250)';
        await expect(page.locator('main')).toHaveCSS('background-color', expectedRgb);
      });
    });
    await test.step('public cart appearance refreshes the shared product configuration', async () => {
      restores.push(() => save(request, paths.appearance, appearance));
      await save(request, paths.appearance, { ...appearance, cartSidebar: { ...appearance.cartSidebar, widthPx: cartWidth } });
      const expectedWidth = cartWidth / 0.75;
      await check(async (html) => { expect(Number.parseFloat((await readPublicHtml(page, html)).cartWidth ?? '')).toBeCloseTo(expectedWidth, 5); }, async () => {
        expect(await page.locator('main').evaluate((element) => Number.parseFloat(getComputedStyle(element).getPropertyValue('--product-cart-width')))).toBeCloseTo(expectedWidth, 5);
      });
    });
    await test.step('stock-policy changes invalidate the homepage server provider payload', async () => {
      restores.push(() => save(request, paths.inventory, inventory));
      const enabled = !inventory.stockEnforcementEnabled;
      await save(request, paths.inventory, { stockEnforcementEnabled: enabled });
      await check(async (html) => {
        const payload = html.replaceAll('\\"', '"');
        expect(payload).toContain(`"stockEnforcementEnabled":${enabled}`);
        expect(payload).not.toContain(`"stockEnforcementEnabled":${!enabled}`);
      }, async () => {
        // Checkout/stock enforcement itself is covered by inventory-policy-ordering.
        await expect(page.locator('[data-homepage-hero-root] h1')).toBeVisible();
      });
    });
  } finally {
    for (const restore of restores.reverse()) {
      try { await restore(); } catch (error) { expect.soft(error, 'Restore the original public setting').toBeUndefined(); }
    }
  }
});


test('naturally expired homepage regenerates one footer and hydrates without errors', async ({ page, request }) => {
  test.setTimeout(100_000);
  await assertAuthenticatedAdmin(request);
  const reset = await request.post('/api/e2e/health');
  expect(reset.ok()).toBeTruthy();
  const initial = await cachedHomepage(request);
  expect((initial.match(/<footer(?:\s|>)/g) ?? []).length).toBe(1);

  // Exercise the real 60-second ISR expiry. Keep this browser off the homepage
  // until regeneration completes so it cannot prefetch or refresh the homepage.
  await new Promise(resolve => setTimeout(resolve, 61_000));
  const expired = await request.get('/');
  expect(expired.ok()).toBeTruthy();
  expect(expired.headers()['x-nextjs-cache']).toBe('STALE');
  const regenerated = await cachedHomepage(request);
  expect((regenerated.match(/<footer(?:\s|>)/g) ?? []).length).toBe(1);

  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator('footer')).toHaveCount(1);
  await expect(page.locator('[data-homepage-hero-root] h1')).toBeVisible();
  // A successful existing client interaction confirms that hydration and the
  // deferred storefront controls have run before checking recoverable errors.
  await page.getByRole('button', { name: 'Košarica', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /^Košarica/ })).toBeVisible();
  expect(errors).toEqual([]);
});
