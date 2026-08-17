import { expect, test } from '@playwright/test';
import type { ProductAppearanceConfig } from '@/shared/domain/style/productAppearance';

test('saving product appearance invalidates the cached configuration read', async ({ request }) => {
  const beforeResponse = await request.get('/api/admin/product-appearance');
  expect(beforeResponse.ok()).toBeTruthy();
  const beforePayload = await beforeResponse.json() as { config: ProductAppearanceConfig };
  const { updatedAt: _beforeUpdatedAt, ...storedBefore } = beforePayload.config;
  const nextGap = storedBefore.variants.labelControlGapPx >= 32
    ? storedBefore.variants.labelControlGapPx - 1
    : storedBefore.variants.labelControlGapPx + 1;
  const changedConfig = {
    ...storedBefore,
    variants: {
      ...storedBefore.variants,
      labelControlGapPx: nextGap
    }
  };
  let changed = false;

  try {
    const update = await request.put('/api/admin/product-appearance', {
      data: { config: changedConfig }
    });
    expect(update.ok()).toBeTruthy();
    changed = true;

    const afterResponse = await request.get(
      `/api/admin/product-appearance?cache-check=${Date.now()}`
    );
    expect(afterResponse.ok()).toBeTruthy();
    const afterPayload = await afterResponse.json() as { config: ProductAppearanceConfig };
    expect(afterPayload.config.variants.labelControlGapPx).toBe(nextGap);
  } finally {
    if (changed) {
      const restore = await request.put('/api/admin/product-appearance', {
        data: { config: storedBefore }
      });
      expect.soft(restore.ok()).toBeTruthy();
    }
  }
});
