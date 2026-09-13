import { expect, test } from '@playwright/test';
import type { ProductAppearanceConfig } from '@/shared/domain/style/productAppearance';

/** Explicit legacy presentation coverage; setup/teardown use the isolated E2E API. */
export const legacyProductAppearanceTest = test.extend<{ legacyProductAppearance: void }>({
  legacyProductAppearance: [async ({ request }, runTest) => {
    const response = await request.get('/api/admin/product-appearance');
    expect(response.ok()).toBeTruthy();
    const { config } = await response.json() as { config: ProductAppearanceConfig };
    const headers = { origin: new URL(response.url()).origin };
    const legacy = { ...config, productPage: { ...config.productPage, layout: 'columns' } };
    try {
      const applied = await request.put('/api/admin/product-appearance', { headers, data: { config: legacy } });
      expect(applied.ok()).toBeTruthy();
      await runTest();
    } finally {
      const restored = await request.put('/api/admin/product-appearance', { headers, data: { config } });
      expect(restored.ok(), 'legacy appearance fixture restores the original configuration').toBeTruthy();
    }
  }, { auto: true }]
});
