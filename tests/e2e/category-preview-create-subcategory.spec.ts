import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { assertAuthenticatedAdmin } from './support/auth';

type CatalogCategory = {
  id: string;
  slug: string;
  title: string;
  subcategories: Array<{
    id: string;
    slug: string;
    title: string;
  }>;
};

type CatalogPayload = {
  categories: CatalogCategory[];
};

const ADD_CATEGORY_LABEL = 'Ustvari novo kategorijo';
const ADD_SUBCATEGORY_LABEL = 'Ustvari novo podkategorijo';

async function readCatalog(request: APIRequestContext) {
  const response = await request.get('/api/admin/categories');
  expect(response.ok()).toBeTruthy();
  return await response.json() as CatalogPayload;
}

async function guardAgainstPersistentCategoryWrites(page: Page) {
  const blockedMutations: string[] = [];

  await page.route('**/api/admin/categories**', async (route) => {
    const request = route.request();
    const method = request.method();
    const pathname = new URL(request.url()).pathname;
    if (
      !pathname.startsWith('/api/admin/categories') ||
      method === 'GET' ||
      method === 'HEAD' ||
      method === 'OPTIONS'
    ) {
      await route.continue();
      return;
    }

    blockedMutations.push(`${method} ${pathname}`);
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Persistent category writes are blocked by this test.' }),
    });
  });

  return blockedMutations;
}

async function loadRootCategory(page: Page, category: CatalogCategory) {
  await page.goto('/admin/kategorije/predogled');
  const editor = page.locator('[data-category-showcase-editor="category-preview"]');
  const tile = editor.locator(
    `[data-testid="category-showcase-tile"][data-category-slug=${JSON.stringify(category.slug)}]`,
  );
  await expect(tile).toBeVisible({ timeout: 15_000 });
  return { editor, tile };
}

async function openRootCategory(page: Page, category: CatalogCategory) {
  const { editor, tile } = await loadRootCategory(page, category);
  await tile
    .getByRole('button', { name: `Odpri ${category.title}`, exact: true })
    .click();
  return editor;
}

async function expectCreateTileInNextGridCell(
  showcase: Locator,
  showcaseTiles: Locator,
  createCard: Locator,
  createLabel: string,
  expectedTileCount: number,
  viewport: 'desktop' | 'mobile',
  scope: 'root' | 'nested',
) {
  expect(expectedTileCount, `${scope} placement requires a neighboring tile`).toBeGreaterThan(0);
  const grid = showcase.getByTestId('category-showcase-grid');
  const directGridChildren = grid.locator(':scope > *');
  await expect(showcaseTiles).toHaveCount(expectedTileCount);
  await expect(directGridChildren).toHaveCount(expectedTileCount + 1);
  await expect(createCard).toBeVisible();

  const directChildKinds = await directGridChildren.evaluateAll((children, label) => (
    children.map((child) => {
      if (
        child.matches('[data-testid="category-showcase-tile"]') ||
        child.querySelector('[data-testid="category-showcase-tile"]')
      ) {
        return 'tile';
      }
      const button = child.matches('button') ? child : child.querySelector('button');
      return button?.getAttribute('aria-label') === label ? 'create' : 'other';
    })
  ), createLabel);
  expect(directChildKinds).toEqual([
    ...Array.from({ length: expectedTileCount }, () => 'tile'),
    'create',
  ]);
  await expect(
    createCard.evaluate((element) => (
      element.parentElement?.getAttribute('data-testid') === 'category-showcase-grid'
    )),
    `${scope} ${viewport} create card should be a direct child of the shared showcase grid`,
  ).resolves.toBe(true);

  const previousTile = showcaseTiles.nth(expectedTileCount - 1);
  const firstTile = showcaseTiles.first();
  const [firstTileBox, previousTileBox, addCardBox, gridMetrics] = await Promise.all([
    firstTile.boundingBox(),
    previousTile.boundingBox(),
    createCard.boundingBox(),
    grid.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        columns: style.gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length,
        columnGap: Number.parseFloat(style.columnGap) || 0,
        rowGap: Number.parseFloat(style.rowGap) || 0,
      };
    }),
  ]);
  expect(firstTileBox, `${scope} ${viewport} first tile should be measurable`).not.toBeNull();
  expect(previousTileBox, `${scope} ${viewport} previous tile should be measurable`).not.toBeNull();
  expect(addCardBox, `${scope} ${viewport} create card should be measurable`).not.toBeNull();
  expect(gridMetrics.columns).toBeGreaterThan(0);
  expect(
    Math.abs(addCardBox!.width - previousTileBox!.width),
    `${scope} ${viewport} create card width should match its neighboring tile`,
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(addCardBox!.height - previousTileBox!.height),
    `${scope} ${viewport} create card height should match its neighboring tile`,
  ).toBeLessThanOrEqual(1);

  const previousRowIsFull = expectedTileCount % gridMetrics.columns === 0;
  if (previousRowIsFull) {
    expect(
      Math.abs(addCardBox!.x - firstTileBox!.x),
      `${scope} ${viewport} create card should wrap to the first column only after a full row`,
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(addCardBox!.y - previousTileBox!.y - previousTileBox!.height - gridMetrics.rowGap),
      `${scope} ${viewport} wrapped create card should start in the immediately following row`,
    ).toBeLessThanOrEqual(1);
    return;
  }

  expect(
    Math.abs(addCardBox!.y - previousTileBox!.y),
    `${scope} ${viewport} create card should remain in the partially filled row`,
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(addCardBox!.x - previousTileBox!.x - previousTileBox!.width - gridMetrics.columnGap),
    `${scope} ${viewport} create card should occupy the immediate next column`,
  ).toBeLessThanOrEqual(1);
}

async function expectCreateTileIsOnlyGridCell(
  showcase: Locator,
  createCard: Locator,
  createLabel: string,
) {
  const grid = showcase.getByTestId('category-showcase-grid');
  const directGridChildren = grid.locator(':scope > *');
  await expect(directGridChildren).toHaveCount(1);
  await expect(createCard).toBeVisible();
  await expect(directGridChildren.first()).toHaveAttribute('aria-label', createLabel);
}

async function expectCreateDialogForParent(page: Page, category: CatalogCategory) {
  const addSubcategory = page.getByRole('button', {
    name: ADD_SUBCATEGORY_LABEL,
    exact: true,
  });
  await expect(addSubcategory).toBeVisible({ timeout: 15_000 });
  await addSubcategory.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByText('Nova kategorija', { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole('group', { name: 'Izbira poti kategorije', exact: true }),
  ).toContainText(category.title);
  await expect(dialog.getByRole('button', { name: 'Ustvari', exact: true })).toBeDisabled();

  await dialog.getByRole('button', { name: 'Prekliči', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(addSubcategory).toBeVisible();
}

test.describe('nested category Preview create affordance', () => {
  test.beforeEach(async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await assertAuthenticatedAdmin(request);
  });

  test('stays available after existing subcategory cards', async ({ page, request }) => {
    const catalog = await readCatalog(request);
    const category = catalog.categories.find((entry) => entry.subcategories.length > 0);
    expect(
      category,
      'The catalog needs a root category with direct subcategories for this regression.',
    ).toBeDefined();
    const blockedMutations = await guardAgainstPersistentCategoryWrites(page);

    const { editor, tile: rootCategoryTile } = await loadRootCategory(page, category!);
    const rootTiles = editor.getByTestId('category-showcase-tile');
    const addCategoryCard = page.getByRole('button', {
      name: ADD_CATEGORY_LABEL,
      exact: true,
    });
    await expectCreateTileInNextGridCell(
      editor,
      rootTiles,
      addCategoryCard,
      ADD_CATEGORY_LABEL,
      catalog.categories.length,
      'desktop',
      'root',
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await expectCreateTileInNextGridCell(
      editor,
      rootTiles,
      addCategoryCard,
      ADD_CATEGORY_LABEL,
      catalog.categories.length,
      'mobile',
      'root',
    );

    await page.setViewportSize({ width: 1440, height: 1000 });
    await rootCategoryTile
      .getByRole('button', { name: `Odpri ${category!.title}`, exact: true })
      .click();
    const nestedTiles = editor.getByTestId('category-showcase-tile');
    await expect(nestedTiles).toHaveCount(
      category!.subcategories.length,
    );
    const addSubcategoryCard = page.getByRole('button', {
      name: ADD_SUBCATEGORY_LABEL,
      exact: true,
    });
    await expectCreateTileInNextGridCell(
      editor,
      nestedTiles,
      addSubcategoryCard,
      ADD_SUBCATEGORY_LABEL,
      category!.subcategories.length,
      'desktop',
      'nested',
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await expectCreateTileInNextGridCell(
      editor,
      nestedTiles,
      addSubcategoryCard,
      ADD_SUBCATEGORY_LABEL,
      category!.subcategories.length,
      'mobile',
      'nested',
    );
    await expectCreateDialogForParent(page, category!);

    expect(blockedMutations).toEqual([]);
  });

  test('stays available when the category has no subcategories yet', async ({ page, request }) => {
    const catalog = await readCatalog(request);
    const category = catalog.categories.find((entry) => entry.subcategories.length === 0);
    expect(
      category,
      'The catalog needs a root category without direct subcategories for this regression.',
    ).toBeDefined();
    const blockedMutations = await guardAgainstPersistentCategoryWrites(page);

    const editor = await openRootCategory(page, category!);
    await expect(editor.getByTestId('category-showcase-tile')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: `${category!.title} — izdelki`, exact: true }),
    ).toBeVisible();
    await expectCreateTileIsOnlyGridCell(
      editor,
      page.getByRole('button', { name: ADD_SUBCATEGORY_LABEL, exact: true }),
      ADD_SUBCATEGORY_LABEL,
    );
    await expectCreateDialogForParent(page, category!);

    expect(blockedMutations).toEqual([]);
  });
});
