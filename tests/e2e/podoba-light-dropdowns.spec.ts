import { expect, test, type Locator } from '@playwright/test';
import { getAppearanceEditorCompactSelect } from './support/appearance-editor-compact-select';

test.beforeEach(async ({ page }) => {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!username || !password) throw new Error('Local admin credentials are required.');

  const login = await page.request.post('/api/admin/login', {
    data: { username, password }
  });
  expect(login.ok()).toBeTruthy();
});

async function expectLightSelect(trigger: Locator, expectedHeight: number) {
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await expect(trigger).toHaveAttribute('data-appearance-editor-compact-select-tone', 'light');

  const presentation = await trigger.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas colour probe is unavailable.');
    context.fillStyle = style.color;
    context.fillRect(0, 0, 1, 1);
    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
    return {
      backgroundColor: style.backgroundColor,
      borderRadius: Number.parseFloat(style.borderRadius),
      textRgb: [red, green, blue],
      height: rect.height
    };
  });

  expect(presentation.backgroundColor).toBe('rgb(255, 255, 255)');
  expect(Math.max(...presentation.textRgb)).toBeLessThan(140);
  expect(presentation.borderRadius).toBe(6);
  expect(Math.abs(presentation.height - expectedHeight)).toBeLessThanOrEqual(0.5);
}

test.describe('Podoba light dropdowns', () => {
  test('keeps the article preview selector light, standard-sized, and separated from its label and hint', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/admin/podoba/artikli');

    const product = getAppearanceEditorCompactSelect(page, 'Artikel v predogledu');
    await expectLightSelect(product, 32);

    const gaps = await product.locator('xpath=../..').evaluate((group) => {
      const [label, control, hint] = Array.from(group.children).map((child) => child.getBoundingClientRect());
      return {
        labelToControl: control.top - label.bottom,
        controlToHint: hint.top - control.bottom
      };
    });
    expect(gaps.labelToControl).toBeGreaterThanOrEqual(5.5);
    expect(gaps.controlToHint).toBeGreaterThanOrEqual(5.5);
  });

  test('keeps navigation typography selectors light, aligned, and positively spaced', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/admin/podoba/navigacija');

    const appearance = page.getByTestId('top-bar-appearance-settings');
    const typographyRow = page.getByTestId('top-bar-typography-row');
    const family = getAppearanceEditorCompactSelect(appearance, 'Pisava zgornje vrstice');
    const weight = getAppearanceEditorCompactSelect(appearance, 'Debelina pisave zgornje vrstice');
    const style = getAppearanceEditorCompactSelect(appearance, 'Slog pisave zgornje vrstice');

    for (const select of [family, weight, style]) {
      await expectLightSelect(select, 36);
    }

    const [rowBox, familyBox, weightBox, styleBox] = await Promise.all(
      [typographyRow, family, weight, style].map((locator) => locator.boundingBox())
    );
    if (!rowBox || !familyBox || !weightBox || !styleBox) {
      throw new Error('The navigation typography row must be measurable.');
    }
    expect(Math.abs(familyBox.y - weightBox.y)).toBeLessThanOrEqual(4);
    expect(Math.abs(familyBox.y - styleBox.y)).toBeLessThanOrEqual(4);
    expect(familyBox.x).toBeGreaterThanOrEqual(rowBox.x);
    expect(styleBox.x + styleBox.width).toBeLessThanOrEqual(rowBox.x + rowBox.width);
    expect(familyBox.x).toBeLessThan(weightBox.x);
    expect(weightBox.x).toBeLessThan(styleBox.x);
  });
});
