import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test';
import {
  catalogCategoryHref,
  catalogSubcategoryHref,
} from '../../src/commercial/catalog/catalogRoutes';
import { toStorefrontPlainText } from '../../src/commercial/features/products/storefrontProduct';
import type { CatalogItemEditorHydration } from '../../src/shared/domain/catalog/catalogAdminTypes';
import {
  chooseAppearanceEditorCompactSelectOption,
  getAppearanceEditorCompactSelect,
  readAppearanceEditorCompactSelectValue,
} from './support/appearance-editor-compact-select';
import { assertAuthenticatedAdmin } from './support/auth';

type CatalogProduct = {
  slug: string;
  name: string;
  image?: string | null;
  status?: string;
};

type CatalogSubcategory = {
  slug: string;
  title: string;
  items: CatalogProduct[];
};

type CatalogCategory = {
  slug: string;
  title: string;
  image: string;
  items: CatalogProduct[];
  subcategories: CatalogSubcategory[];
};

type CatalogPayload = {
  categories: CatalogCategory[];
  statuses: Record<string, 'active' | 'inactive'>;
};

const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isActive(statuses: CatalogPayload['statuses'], key: string) {
  return statuses[key] !== 'inactive';
}

function hasPublicProductImage(items: CatalogProduct[]) {
  return items.some((item) => (
    item.status !== 'inactive' && Boolean(item.image?.trim())
  ));
}

type PublicVariantListingBranch = {
  category: CatalogCategory;
  subcategory: CatalogSubcategory;
  product: CatalogProduct;
  productRecord: CatalogItemEditorHydration;
  sourceDescription: string;
};

async function findPublicVariantListingBranch(
  request: APIRequestContext,
  catalog: CatalogPayload,
): Promise<PublicVariantListingBranch | undefined> {
  for (const category of catalog.categories) {
    if (!isActive(catalog.statuses, `cat:${category.slug}`)) continue;

    for (const subcategory of category.subcategories) {
      if (!isActive(
        catalog.statuses,
        `sub:${category.slug}:${subcategory.slug}`,
      )) continue;

      for (const product of subcategory.items) {
        if (product.status === 'inactive' || !product.image?.trim()) continue;

        const response = await request.get(
          `/api/admin/artikli/${encodeURIComponent(product.slug)}`,
        );
        if (!response.ok()) continue;

        const productRecord = await response.json() as CatalogItemEditorHydration;
        const sourceDescription = toStorefrontPlainText(
          productRecord.description,
        ).replace(/\s+/gu, ' ').trim();
        const hasPurchasableVariant = productRecord.variants.some((variant) => (
          typeof variant.id === 'number'
          && variant.status !== 'inactive'
          && (
            typeof variant.inventory !== 'number'
            || variant.inventory >= Math.max(1, variant.minOrder ?? 1)
          )
        ));
        if (
          productRecord.status === 'active'
          && productRecord.variants.length > 1
          && hasPurchasableVariant
          && sourceDescription.length > 0
          && sourceDescription.toLocaleLowerCase('sl')
            !== productRecord.itemName.trim().toLocaleLowerCase('sl')
        ) {
          return {
            category,
            subcategory,
            product,
            productRecord,
            sourceDescription,
          };
        }
      }
    }
  }

  return undefined;
}

function makeExpectedListingDescription(sourceDescription: string) {
  const normalized = sourceDescription.replace(/\s+/gu, ' ').trim();
  if (normalized.length <= 180) return normalized;
  const clipped = normalized.slice(0, 181);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, Math.max(lastSpace, 156)).trim()}…`;
}

async function publicCatalogBranch(request: APIRequestContext) {
  await assertAuthenticatedAdmin(request);
  const response = await request.get('/api/admin/categories');
  expect(response.ok()).toBeTruthy();
  const catalog = await response.json() as CatalogPayload;
  const branch = catalog.categories
    .filter(category => isActive(catalog.statuses, 'cat:' + category.slug))
    .flatMap(category => category.subcategories.map(subcategory => ({ category, subcategory })))
    .find(({ category, subcategory }) =>
      isActive(catalog.statuses, 'sub:' + category.slug + ':' + subcategory.slug)
      && hasPublicProductImage(subcategory.items)
    );
  expect(branch, 'The catalog needs an active subcategory with an illustrated product.').toBeDefined();
  return { ...branch!, catalog };
}

async function waitForCatalogHydration(page: Page) {
  const search = page.getByRole('searchbox', { name: 'Poiščite izdelek, material ali oznako', exact: true });
  await expect(search).toBeVisible();
  // SSR controls can be visible before their React change handlers are attached.
  await expect.poll(() => search.evaluate(element =>
    Object.keys(element).some(key => key.startsWith('__reactProps$'))
  )).toBeTruthy();
}

function catalogResults(page: Page) {
  return page.getByRole('region', { name: 'Katalog izdelkov', exact: true });
}

function catalogPrice(row: Locator) {
  return row.locator('span[aria-label$="z DDV"]');
}

function euroAmount(value: string) {
  const amount = value.match(/\d[\d.\s]*,\d{2}/u)?.[0];
  expect(amount, 'a visible catalogue price should contain a euro amount').toBeDefined();
  return Number(amount!.replace(/[.\s]/gu, '').replace(',', '.'));
}

async function clearCatalogFilters(page: Page) {
  await page.getByRole('button', { name: 'Počisti filtre', exact: true }).first().click();
}

test('category page shows its expanded hierarchy and supports branch navigation', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { category, subcategory } = await publicCatalogBranch(request);
  await page.goto(catalogCategoryHref(category.slug));
  await waitForCatalogHydration(page);
  await expect(page.getByRole('heading', { level: 1, name: category.title, exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Kategorije', exact: true })
    .locator('a[href="' + catalogCategoryHref(category.slug) + '"]')).toHaveAttribute('aria-current', 'location');
  const results = catalogResults(page);
  const rows = results.locator('[data-catalog-product]:visible');
  await expect(rows.first()).toBeVisible();
  const total = await rows.count();
  await expect(results.getByRole('status')).toHaveText('Vse kategorije so razširjene');
  const branchHeading = results.getByRole('heading', { level: 3, name: subcategory.title, exact: true });
  const branchHeader = branchHeading.locator('..');
  const branch = branchHeader.locator('button[aria-controls^="catalog-children-"]');
  const branchLink = branchHeading.getByRole('link', { name: subcategory.title, exact: true });
  await expect(branch).toHaveCount(1);
  await expect(branch).toHaveAccessibleName('Strni kategorijo ' + subcategory.title);
  await expect(branch).toHaveAttribute('aria-expanded', 'true');
  await expect(branchLink).toHaveAttribute('href', catalogSubcategoryHref(category.slug, subcategory.slug));
  await expect(branchHeader.getByRole('link')).toHaveCount(1);
  const controlledId = await branch.getAttribute('aria-controls');
  expect(controlledId).toBeTruthy();
  const branchContent = results.locator('[id="' + controlledId + '"]');
  await expect(branchContent).toBeVisible();
  await branch.click();
  await expect(branch).toHaveAttribute('aria-expanded', 'false');
  await expect(branch).toHaveAccessibleName('Razširi kategorijo ' + subcategory.title);
  await expect(branchContent).toBeHidden();
  await expect(branchLink).toBeVisible();
  await expect(page).toHaveURL(catalogCategoryHref(category.slug));
  await branch.click();
  await expect(branch).toHaveAccessibleName('Strni kategorijo ' + subcategory.title);
  await expect(branchContent).toBeVisible();
  await expect(page).toHaveURL(catalogCategoryHref(category.slug));
  await results.getByRole('button', { name: 'Strni vse', exact: true }).click();
  await expect(rows).toHaveCount(0);
  await results.getByRole('button', { name: 'Razširi vse', exact: true }).click();
  await expect(rows).toHaveCount(total);
  expect(await results.locator('button[aria-controls^="catalog-children-"]').evaluateAll(buttons =>
    buttons.every(button => button.getAttribute('aria-expanded') === 'true')
  )).toBeTruthy();
  await expect(page.locator('[data-storefront-subcategory-showcase]')).toHaveCount(0);
  const illustratedRow = branchContent.locator('[data-catalog-product]').filter({ has: page.locator('img') }).first();
  await expect(illustratedRow).toBeVisible();
  await expect(illustratedRow.getByRole('link')).toHaveCount(1);
  const productId = await illustratedRow.getAttribute('data-catalog-product');
  expect(productId).toBeTruthy();
  const retainedRow = results.locator('[data-catalog-product=' + JSON.stringify(productId) + ']');
  const retainedImage = retainedRow.locator('img').first();
  const rowHandle = await retainedRow.elementHandle();
  const imageHandle = await retainedImage.elementHandle();
  expect(rowHandle).not.toBeNull();
  expect(imageHandle).not.toBeNull();
  const expectRetainedProduct = async () => {
    await expect(retainedRow).toBeVisible();
    expect(await rowHandle!.evaluate(element => element.isConnected)).toBeTruthy();
    expect(await imageHandle!.evaluate(element => element.isConnected)).toBeTruthy();
    expect(await retainedRow.evaluate((element, original) => element === original, rowHandle!)).toBeTruthy();
    expect(await retainedImage.evaluate((element, original) => element === original, imageHandle!)).toBeTruthy();
  };
  try {
    await branchLink.click();
    await expect(page).toHaveURL(catalogSubcategoryHref(category.slug, subcategory.slug));
    await expect(page.getByRole('heading', { level: 1, name: subcategory.title, exact: true })).toBeVisible();
    const categoryBreadcrumb = page.getByRole('navigation', { name: 'Drobtinice', exact: true })
      .getByRole('link', { name: category.title, exact: true });
    await expect(categoryBreadcrumb).toHaveAttribute('href', catalogCategoryHref(category.slug));
    await expectRetainedProduct();
    await categoryBreadcrumb.click();
    await expect(page).toHaveURL(catalogCategoryHref(category.slug));
    await expect(page.getByRole('heading', { level: 1, name: category.title, exact: true })).toBeVisible();
    await expectRetainedProduct();
  } finally {
    await rowHandle?.dispose();
    await imageHandle?.dispose();
  }
});

test('category and subcategory search, stock filters, and sorting operate on product rows', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { category, subcategory } = await publicCatalogBranch(request);
  const product = subcategory.items.find(item => item.status !== 'inactive' && item.image?.trim())!;
  for (const route of [
    { href: catalogCategoryHref(category.slug), title: category.title },
    { href: catalogSubcategoryHref(category.slug, subcategory.slug), title: subcategory.title },
  ]) {
    await page.goto(route.href);
    await waitForCatalogHydration(page);
    await expect(page.getByRole('heading', { level: 1, name: route.title, exact: true })).toBeVisible();
    const results = catalogResults(page);
    const rows = results.locator('[data-catalog-product]:visible');
    await expect(rows.first()).toBeVisible();
    const total = await rows.count();
    const search = page.getByRole('searchbox', { name: 'Poiščite izdelek, material ali oznako', exact: true });
    const sortGroups = results.getByRole('group', { name: 'Razvrsti izdelke', exact: true }).filter({ visible: true });
    const sort = sortGroups.first();
    await expect(sort).toBeVisible();
    await expect(sort.locator('button[data-sort-key]')).toHaveCount(3);
    const nameSort = sort.locator('button[data-sort-key="name"]');
    await expect(nameSort).toHaveAttribute('data-direction', 'ascending');
    await expect(nameSort).toHaveAttribute('aria-pressed', 'true');
    await expect(nameSort).toHaveAccessibleName('Izdelek: razvrsti Z–A');
    await expect(sort.locator('button[data-direction="none"][aria-pressed="false"]')).toHaveCount(2);
    await search.fill(product.name);
    await expect(results).toHaveAttribute('aria-busy', 'false');
    await expect(rows.filter({ has: page.getByText(product.name, { exact: true }) })).toHaveCount(1);
    await expect.poll(async () => {
      const count = Number((await results.getByRole('status').innerText()).match(/^\d+/u)?.[0]);
      return await results.getAttribute('aria-busy') === 'false' && count === await rows.count();
    }).toBeTruthy();
    await search.fill('zzzz-no-catalog-product-match-827493');
    await expect(rows).toHaveCount(0);
    await expect(results.getByRole('heading', { name: 'Ni izdelkov, ki ustrezajo izbranim filtrom', exact: true })).toBeVisible();
    await clearCatalogFilters(page);
    await expect(rows).toHaveCount(total);
    const stocked = await rows.filter({ has: page.locator('[data-tone="stock"]') }).count();
    await page.getByRole('checkbox', { name: 'Na zalogi', exact: true }).check();
    await expect(rows).toHaveCount(stocked);
    await expect(rows.locator('[data-tone="order"], [data-tone="unavailable"]')).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Na zalogi', exact: true }).uncheck();
    await expect(rows).toHaveCount(total);
    await expect(results).toHaveAttribute('aria-busy', 'false');
    const readDisplayedRows = () => rows.evaluateAll(elements => elements.map(row => ({
      id: row.getAttribute('data-catalog-product') ?? '',
      parentId: row.parentElement?.id ?? '',
      name: row.querySelector('a')?.getAttribute('aria-label') ?? '',
      priceLabel: row.querySelector(':scope > span[aria-label]')?.getAttribute('aria-label') ?? '',
      availabilityTone: row.querySelector('[data-tone]')?.getAttribute('data-tone') ?? '',
    })));
    const defaultRows = await readDisplayedRows();
    const defaultProductOrder = defaultRows.map(row => row.id);
    const defaultParents = new Map(defaultRows.map(row => [row.id, row.parentId]));
    expect(defaultRows.every(row => row.parentId.startsWith('catalog-children-'))).toBeTruthy();
    const categoryHeadings = results.locator('[id^="catalog-heading-"]:visible');
    const defaultHeadingOrder = await categoryHeadings.evaluateAll(headings => headings.map(heading => heading.id));
    expect(defaultHeadingOrder.length).toBeGreaterThan(0);
    const headerHandles = await sortGroups.elementHandles();
    const retainedRow = rows.filter({ has: page.locator('img') }).first();
    const rowHandle = await retainedRow.elementHandle();
    const imageHandle = await retainedRow.locator('img').first().elementHandle();
    expect(rowHandle).not.toBeNull();
    expect(imageHandle).not.toBeNull();
    const retainedProductId = await retainedRow.getAttribute('data-catalog-product');
    expect(retainedProductId).toBeTruthy();
    const retainedProduct = results.locator('[data-catalog-product=' + JSON.stringify(retainedProductId) + ']');
    const nameCollator = new Intl.Collator('sl', { sensitivity: 'base' });
    expect(defaultRows.every((row, index) => row.name.length > 0 && (
      index === 0 || defaultRows[index - 1].parentId !== row.parentId
      || nameCollator.compare(defaultRows[index - 1].name, row.name) <= 0
    ))).toBeTruthy();
    const availabilityRanks = new Map([['stock', 0], ['order', 1], ['unavailable', 2]]);
    const sortColumns = [
      { key: 'name', title: 'Izdelek', ascending: 'razvrsti A–Z', descending: 'razvrsti Z–A' },
      { key: 'price', title: 'Cena z DDV', ascending: 'razvrsti naraščajoče', descending: 'razvrsti padajoče' },
      { key: 'availability', title: 'Dobavljivost', ascending: 'najprej na zalogi', descending: 'najprej ni na zalogi' },
    ] as const;
    try {
      for (const column of sortColumns) {
        const restoreLabel = column.title + ': povrni prvotni vrstni red';
        const steps = column.key === 'name' ? [
          { direction: 'descending', label: 'Izdelek: razvrsti Z–A', nextLabel: 'Izdelek: razvrsti A–Z' },
          { direction: 'ascending', label: 'Izdelek: razvrsti A–Z', nextLabel: 'Izdelek: razvrsti Z–A' },
          { direction: 'descending', label: 'Izdelek: razvrsti Z–A', nextLabel: 'Izdelek: razvrsti A–Z' },
          { direction: 'ascending', label: 'Izdelek: razvrsti A–Z', nextLabel: 'Izdelek: razvrsti Z–A' },
        ] as const : [
          { direction: 'ascending', label: column.title + ': ' + column.ascending, nextLabel: column.title + ': ' + column.descending },
          { direction: 'descending', label: column.title + ': ' + column.descending, nextLabel: restoreLabel },
          { direction: 'none', label: restoreLabel, nextLabel: column.title + ': ' + column.ascending },
        ] as const;
        for (const step of steps) {
          await sort.getByRole('button', { name: step.label, exact: true }).click();
          const activeSort = sort.locator('button[data-sort-key="' + column.key + '"]');
          await expect(activeSort).toHaveAccessibleName(step.nextLabel);
          await expect(activeSort).toHaveAttribute('data-direction', step.direction);
          await expect(activeSort).toHaveAttribute('aria-pressed', String(step.direction !== 'none'));
          await expect(sort.locator('button[data-direction="none"][aria-pressed="false"]')).toHaveCount(2);
          if (step.direction === 'none') {
            await expect(nameSort).toHaveAttribute('data-direction', 'ascending');
            await expect(nameSort).toHaveAttribute('aria-pressed', 'true');
            await expect(nameSort).toHaveAccessibleName('Izdelek: razvrsti Z–A');
          }
          await expect(rows).toHaveCount(total);
          await expect(results.getByRole('button', { name: 'Po kategorijah', exact: true })).toHaveCount(0);
          await expect.poll(async () => {
            const displayedRows = await readDisplayedRows();
            if (displayedRows.length !== total
              || displayedRows.some(row => defaultParents.get(row.id) !== row.parentId)) return false;
            if (step.direction === 'none') {
              return displayedRows.every((row, index) => row.id === defaultProductOrder[index]);
            }
            const siblingGroups = new Map<string, typeof displayedRows>();
            for (const row of displayedRows) {
              const siblings = siblingGroups.get(row.parentId) ?? [];
              siblings.push(row);
              siblingGroups.set(row.parentId, siblings);
            }
            if (column.key === 'price' && !displayedRows.some(row => row.priceLabel.endsWith('z DDV'))) return false;
            return [...siblingGroups.values()].every(siblings => {
              if (column.key === 'name') {
                return siblings.every((row, index) => row.name.length > 0 && (index === 0 || (
                  step.direction === 'ascending'
                    ? nameCollator.compare(siblings[index - 1].name, row.name) <= 0
                    : nameCollator.compare(siblings[index - 1].name, row.name) >= 0
                )));
              }
              if (column.key === 'availability') {
                const ranks = siblings.map(row => availabilityRanks.get(row.availabilityTone));
                return ranks.every((rank, index) => rank !== undefined && (index === 0 || (
                  step.direction === 'ascending' ? ranks[index - 1]! <= rank : ranks[index - 1]! >= rank
                )));
              }
              const prices = siblings
                .filter(row => row.priceLabel.endsWith('z DDV'))
                .map(row => euroAmount(row.priceLabel));
              return prices.every((price, index) => index === 0 || (step.direction === 'ascending'
                ? prices[index - 1] <= price : prices[index - 1] >= price));
            });
          }).toBeTruthy();
          await expect.poll(() => categoryHeadings.evaluateAll(headings => headings.map(heading => heading.id)))
            .toEqual(defaultHeadingOrder);
          await expect(sortGroups).toHaveCount(headerHandles.length);
          for (const [index, handle] of headerHandles.entries()) {
            expect(await sortGroups.nth(index).evaluate((element, original) => element === original, handle)).toBeTruthy();
          }
          await expect(retainedProduct).toBeVisible();
          expect(await retainedProduct.evaluate((element, original) => element === original, rowHandle!)).toBeTruthy();
          expect(await retainedProduct.locator('img').first().evaluate((element, original) => element === original, imageHandle!)).toBeTruthy();
        }
      }
    } finally {
      await rowHandle?.dispose();
      await imageHandle?.dispose();
      for (const handle of headerHandles) await handle.dispose();
    }
  }
});

test('compact category rows retain price filtering and product detail navigation', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { category, subcategory } = await publicCatalogBranch(request);
  await page.goto(catalogSubcategoryHref(category.slug, subcategory.slug));
  await waitForCatalogHydration(page);
  const results = catalogResults(page);
  const rows = results.locator('[data-catalog-product]');
  const imageRow = rows.filter({ has: page.locator('img') }).first();
  await expect(imageRow).toBeVisible();
  const image = imageRow.locator('img').first();
  const [rowBox, imageBox] = await Promise.all([imageRow.boundingBox(), image.boundingBox()]);
  expect(rowBox).not.toBeNull();
  expect(imageBox).not.toBeNull();
  expect(rowBox!.width).toBeGreaterThan(rowBox!.height * 3);
  expect(imageBox!.width).toBeLessThanOrEqual(100);
  expect(imageBox!.height).toBeLessThanOrEqual(60);
  await expect(page.locator('.storefront-product-grid')).toHaveCount(0);
  const pricedRow = rows.filter({ has: page.locator(':scope > span[aria-label$="z DDV"]') }).first();
  await expect(pricedRow).toBeVisible();
  const price = euroAmount(await catalogPrice(pricedRow).getAttribute('aria-label') ?? '');
  const min = page.getByRole('spinbutton', { name: 'Najnižja cena v evrih', exact: true });
  const max = page.getByRole('spinbutton', { name: 'Najvišja cena v evrih', exact: true });
  await min.fill(String(price));
  await max.fill(String(price));
  await expect(rows.first()).toBeVisible();
  await expect.poll(async () => {
    const filteredPrices = await rows.locator(':scope > span[aria-label]').evaluateAll(elements =>
      elements.map(element => element.getAttribute('aria-label') ?? '')
    );
    return filteredPrices.length > 0 && filteredPrices.every(label => euroAmount(label) === price);
  }).toBeTruthy();
  await min.fill(String(price + 1));
  await expect(page.getByRole('complementary', { name: 'Kategorije in filtri' }).getByRole('alert'))
    .toHaveText('Najnižja cena ne sme presegati najvišje.');
  await expect(rows).toHaveCount(0);
  await clearCatalogFilters(page);
  await expect(rows.first()).toBeVisible();
  const view = rows.first().getByRole('link');
  await expect(view).toHaveCount(1);
  const label = await view.getAttribute('aria-label');
  expect(label).toBeTruthy();
  await expect(view).toHaveAttribute('href', /^\/products\/[^/]+\/items\/[^/]+$/u);
  await view.click();
  await expect(page.getByRole('heading', {
    level: 1, name: label!, exact: true,
  })).toBeVisible();
});

test('catalog rows retain product price, description, and detail navigation alongside the admin preview', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await assertAuthenticatedAdmin(request);

  const catalogResponse = await request.get('/api/admin/categories');
  expect(catalogResponse.ok()).toBeTruthy();
  const catalog = await catalogResponse.json() as CatalogPayload;
  const branch = await findPublicVariantListingBranch(request, catalog);
  expect(
    branch,
    'The catalog needs an active multi-variant product with a public image.',
  ).toBeDefined();
  if (!branch) return;

  const writes: string[] = [];
  await page.route('**/api/admin/**', async (route) => {
    const outgoing = route.request();
    // Session activity does not persist content or unsaved editor changes.
    if (outgoing.method() === 'POST'
      && new URL(outgoing.url()).pathname === '/api/admin/session/activity') {
      await route.continue();
      return;
    }
    if (writeMethods.has(outgoing.method())) {
      writes.push(`${outgoing.method()} ${new URL(outgoing.url()).pathname}`);
      await route.abort();
      return;
    }
    await route.continue();
  });

  await page.goto(catalogSubcategoryHref(
    branch.category.slug,
    branch.subcategory.slug,
  ));
  const publicRow = catalogResults(page).locator('[data-catalog-product]').filter({
    has: page.getByText(branch.product.name, { exact: true }),
  });
  await expect(publicRow).toHaveCount(1);
  await expect(publicRow).toBeVisible();
  await expect(publicRow).toContainText(makeExpectedListingDescription(branch.sourceDescription));
  const publicMinimumPrice = euroAmount(await catalogPrice(publicRow).getAttribute('aria-label') ?? '');
  const publicImageSource = await publicRow.locator('img').getAttribute('src');
  await expect(publicRow.getByRole('link')).toHaveCount(1);
  const productHref = await publicRow.getByRole('link').getAttribute('href');
  expect(productHref, 'the listing card should link to its product detail')
    .toMatch(/^\/products\/[^/]+\/items\/[^/]+$/);

  await page.goto(productHref!);
  await expect(page.getByRole('heading', {
    level: 1,
    name: branch.productRecord.itemName,
    exact: true,
  })).toBeVisible({ timeout: 15_000 });
  const detailTaxBreakdown = page.locator(
    '.storefront-product-purchase-area .storefront-price-tax',
  );
  await expect(
    detailTaxBreakdown,
    'the linked product detail should retain its tax breakdown',
  ).toBeVisible();
  const detailTaxCopy = (await detailTaxBreakdown.textContent() ?? '')
    .replace(/\s+/gu, ' ')
    .trim();
  expect(detailTaxCopy, 'product detail should expose the net-price label')
    .toMatch(/\bbrez\s+DDV\b/iu);
  expect(detailTaxCopy, 'product detail should expose its DDV percentage')
    .toMatch(/\bDDV\s*\d+(?:[.,]\d+)?\s*%/iu);

  await page.goto('/admin/podoba/artikli');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Artikli', exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  const productSelect = getAppearanceEditorCompactSelect(
    page,
    'Artikel v predogledu',
  );
  await expect(productSelect).toBeVisible();
  await chooseAppearanceEditorCompactSelectOption(
    page,
    productSelect,
    branch.productRecord.slug,
  );
  expect(await readAppearanceEditorCompactSelectValue(productSelect))
    .toBe(branch.productRecord.slug);

  const listingButton = page.getByRole('group', {
    name: 'Stran predogleda',
  }).getByRole('button', {
    name: 'Seznam',
    exact: true,
  });
  await listingButton.click();
  await expect(listingButton).toHaveAttribute('aria-pressed', 'true');

  const preview = page.locator(
    '[data-product-preview-frame] [data-admin-product-live-preview="true"]:visible',
  ).first();
  await expect(preview).toBeVisible({ timeout: 15_000 });
  const adminRow = preview.locator('[data-catalog-product]').filter({
    has: page.getByRole('link', { name: branch.productRecord.itemName, exact: true }),
  });
  await expect(adminRow).toHaveCount(1);
  await expect(adminRow).toBeVisible();
  await expect(adminRow.getByRole('link')).toHaveAttribute('href', productHref!);
  const adminDescription = adminRow.locator('[data-product-canvas-element="catalog-product-description"]');
  await expect(adminDescription).toHaveText(makeExpectedListingDescription(branch.sourceDescription));
  await expect(adminRow.locator('[data-product-canvas-element="catalog-product-name"]'))
    .toHaveText(branch.productRecord.itemName);
  expect(euroAmount(await catalogPrice(adminRow).getAttribute('aria-label') ?? ''),
    'the public row and admin preview should use the same lowest gross price')
    .toBe(publicMinimumPrice);
  expect(await adminRow.locator('img').getAttribute('src'),
    'the public catalog and appearance preview must share product imagery')
    .toBe(publicImageSource);
  expect(
    writes,
    'opening the public listing and its admin preview must remain read-only',
  ).toEqual([]);
});

test('admin Seznam preview shares catalog rows, live filters, and editable elements without saving', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await assertAuthenticatedAdmin(request);
  const persistedWrites: string[] = [];
  await page.route('**/api/admin/**', async route => {
    const outgoing = route.request();
    const pathname = new URL(outgoing.url()).pathname;
    if (writeMethods.has(outgoing.method()) && pathname !== '/api/admin/session/activity') {
      persistedWrites.push(outgoing.method() + ' ' + pathname);
      await route.abort();
      return;
    }
    await route.continue();
  });

  await page.goto('/admin/podoba/artikli');
  await expect(page.getByRole('heading', { level: 1, name: 'Artikli', exact: true }))
    .toBeVisible({ timeout: 15_000 });
  await expect(getAppearanceEditorCompactSelect(page, 'Artikel v predogledu')).toBeVisible();
  const listingButton = page.getByRole('group', { name: 'Stran predogleda' })
    .getByRole('button', { name: 'Seznam', exact: true });
  await listingButton.click();
  await expect(listingButton).toHaveAttribute('aria-pressed', 'true');
  const preview = page.locator(
    '[data-product-preview-frame] [data-admin-product-live-preview="true"]:visible',
  ).first();
  const results = preview.getByRole('region', { name: 'Katalog izdelkov', exact: true });
  const rows = results.locator('[data-catalog-product]:visible');
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  await expect(preview.getByRole('heading', { level: 1, name: 'Katalog izdelkov', exact: true })).toBeVisible();
  await expect(preview.getByRole('searchbox', { name: 'Poiščite izdelek, material ali oznako' })).toBeVisible();

  const representativeIds = [
    'catalog-product-image', 'catalog-product-name', 'catalog-product-description',
    'catalog-product-availability', 'catalog-product-price',
  ];
  for (const id of [
    'catalog-heading', 'catalog-search', 'catalog-categories', 'catalog-stock-filter',
    'catalog-price-filter', ...representativeIds,
  ]) {
    const element = preview.locator('[data-product-canvas-element="' + id + '"]');
    await expect(element, id + ' should expose exactly one editable representative').toHaveCount(1);
    await expect(element).toBeVisible();
    await expect(element.locator('[data-product-canvas-element="' + id + '"]')).toHaveCount(0);
  }
  const representatives = await preview.locator(
    '[data-product-canvas-element^="catalog-product-"]',
  ).evaluateAll(elements => elements.map(element => element.closest('[data-catalog-product]')?.getAttribute('data-catalog-product')));
  expect(new Set(representatives).size, 'all repeated row controls should edit the selected representative').toBe(1);
  expect(representatives[0]).toBeTruthy();

  const title = preview.locator('[data-product-canvas-element="catalog-product-name"]');
  const representativeRow = title.locator('xpath=ancestor::article[1]');
  const name = await representativeRow.getByRole('link').getAttribute('aria-label');
  expect(name).toBeTruthy();
  await expect(representativeRow.getByRole('link')).toHaveAttribute('href', /^\/products\/[^/]+\/items\/[^/]+$/u);
  const rowGeometry = await representativeRow.evaluate(element => {
    const row = element as HTMLElement;
    const image = row.querySelector('img')!;
    const imageBox = image.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    const text = row.querySelector('[data-product-canvas-element="catalog-product-name"]')!.getBoundingClientRect();
    const price = row.querySelector('span[aria-label$="z DDV"]')!.getBoundingClientRect();
    return {
      imageRatio: imageBox.width / imageBox.height,
      imageRight: imageBox.right, titleLeft: text.left, titleRight: text.right,
      priceLeft: price.left, priceRight: price.right, rowRight: rowBox.right,
      compactRatio: rowBox.height / rowBox.width,
    };
  });
  expect(rowGeometry.imageRatio).toBeCloseTo(1, 2);
  expect(rowGeometry.imageRight).toBeLessThanOrEqual(rowGeometry.titleLeft);
  expect(rowGeometry.titleRight).toBeLessThanOrEqual(rowGeometry.priceLeft);
  expect(rowGeometry.priceRight).toBeLessThanOrEqual(rowGeometry.rowRight + 1);
  expect(rowGeometry.compactRatio).toBeLessThan(0.25);
  await title.click();
  await expect(title).toHaveAttribute('data-product-canvas-selected', 'true');
  await expect(page.locator('[role="toolbar"][data-toolbar-mode="floating"]'))
    .toHaveAttribute('data-product-toolbar-anchor-id', 'catalog-product-name');

  await preview.getByRole('button', { name: 'Preizkusi povezave in filtre', exact: true }).click();
  await expect(preview.locator('[data-product-canvas-element^="catalog-product-"]')).toHaveCount(0);
  const search = preview.getByRole('searchbox', { name: 'Poiščite izdelek, material ali oznako' });
  await search.fill(name!);
  await expect(results).toHaveAttribute('aria-busy', 'false');
  await expect(rows).toHaveCount(1);
  await expect(rows.first().getByRole('link')).toHaveAccessibleName(name!);
  await search.fill('izdelek-ki-zagotovo-ne-obstaja-98765');
  await expect(rows).toHaveCount(0);
  await expect(results.getByRole('heading', { name: 'Ni izdelkov, ki ustrezajo izbranim filtrom' })).toBeVisible();
  await preview.getByRole('button', { name: 'Počisti filtre', exact: true }).first().click();
  await expect(rows.first()).toBeVisible();

  await preview.getByRole('navigation', { name: 'Kategorije', exact: true })
    .getByRole('link', { name: 'Vse kategorije', exact: true }).click();
  await expect(preview.getByRole('heading', { level: 1, name: 'Vse kategorije', exact: true })).toBeVisible();
  await expect(page).toHaveURL('/admin/podoba/artikli');
  const prices = () => rows.locator('span[aria-label$="z DDV"]').evaluateAll(elements =>
    elements.map(element => Number((element.textContent ?? '').replace(/[^\d,]/gu, '').replace(',', '.'))));
  const priceSort = results.locator('button[data-sort-key="price"]');
  await priceSort.click();
  await expect(priceSort).toHaveAttribute('data-direction', 'ascending');
  const ascending = await prices();
  expect(ascending).toEqual([...ascending].sort((a, b) => a - b));
  await priceSort.click();
  await expect(priceSort).toHaveAttribute('data-direction', 'descending');
  expect(await prices()).toEqual([...ascending].sort((a, b) => b - a));
  const available = preview.getByRole('checkbox', { name: 'Na zalogi', exact: true });
  await available.check();
  for (const row of await rows.all()) await expect(row.locator('[data-tone]')).toHaveAttribute('data-tone', 'stock');
  await available.uncheck();

  await preview.getByRole('button', { name: 'Uredi videz', exact: true }).click();
  await expect(preview.locator('[data-product-canvas-element="catalog-product-name"]')).toHaveCount(1);
  expect(persistedWrites, 'preview navigation, filters and canvas selection must not save settings or products').toEqual([]);
});
