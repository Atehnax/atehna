import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import type { CatalogItemEditorHydration, CatalogItemEditorPayload } from '@/shared/domain/catalog/catalogAdminTypes';
import { assertAuthenticatedAdmin, E2E_BASE_URL } from './support/auth';

const createdSlugs: string[] = [];
const modelName = (index: number) => `Izvedba ${String(index + 1).padStart(2, '0')}`;

async function readProduct(request: APIRequestContext, slug: string) {
  const response = await request.get(`/api/admin/artikli/${encodeURIComponent(slug)}`);
  expect(response.status(), await response.text()).toBe(200);
  return response.json() as Promise<CatalogItemEditorHydration>;
}

async function createMatrixProduct(request: APIRequestContext, count: number) {
  const seed = await readProduct(request, 'aluminijasta-plosca');
  const suffix = `${count}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const slug = `preizkus-matrike-${suffix}`;
  const payload: CatalogItemEditorPayload = {
    itemName: `Preizkus matrike ${suffix}`, slug, sku: `E2E-MATRIX-${suffix}`,
    itemType: 'sheet', productType: 'dimensions', status: 'inactive', categoryPath: seed.categoryPath,
    unit: 'kos', taxRate: 0.22, media: [], quantityDiscounts: [],
    typeSpecificData: { dimensions: { defaultDeliveryTime: '3 dni', variantDeliveryTimes: {} } },
    optionAxes: [{ name: 'Izvedba', slug: 'izvedba', values: Array.from({ length: count }, (_, index) => ({ value: modelName(index), slug: `izvedba-${index}` })) }],
    variants: Array.from({ length: count }, (_, index) => ({
      variantName: modelName(index), variantSku: `E2E-MATRIX-${suffix}-${index}`,
      price: 2 + index / 10, costNet: 1, inventory: 10 + index, discountPct: 0,
      minOrder: 1, status: index % 7 === 6 ? 'inactive' : 'active', unit: 'kos',
      length: 100 + index, width: 100, thickness: 0.5, weight: 0.025,
      optionSelections: { izvedba: `izvedba-${index}` },
      contentOverride: { description: `Opis ${modelName(index)}` }
    }))
  };
  const response = await request.post('/api/admin/artikli', { headers: { origin: E2E_BASE_URL }, data: payload });
  expect(response.status(), await response.text()).toBe(200);
  createdSlugs.push(slug);
  return readProduct(request, slug);
}

async function openMatrix(page: Page, slug: string) {
  await page.goto(`/admin/artikli/${slug}`);
  await page.getByRole('tab', { name: 'Prodaja', exact: true }).click();
  await page.getByRole('button', { name: 'Uredi artikel', exact: true }).first().click();
  const matrix = page.getByRole('table', { name: 'Različice artikla s polji v vrsticah', exact: true });
  await expect(matrix).toBeVisible();
  return matrix;
}

async function sampleExpansion(matrix: Locator, label: string) {
  await matrix.getByRole('button', { name: `Razširi različico ${label}`, exact: true }).scrollIntoViewIfNeeded();
  return matrix.evaluate(async (element, variantLabel) => {
    const trigger = Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(button => button.getAttribute('aria-label') === `Razširi različico ${variantLabel}`);
    if (!trigger) throw new Error(`Missing expansion control for ${variantLabel}`);
    const header = trigger.closest<HTMLElement>('[role="columnheader"]');
    if (!header) throw new Error('Missing variant column header');
    const samples: Array<{ elapsedMs: number; width: number }> = [];
    const start = performance.now();
    samples.push({ elapsedMs: 0, width: header.getBoundingClientRect().width });
    trigger.click();
    await new Promise<void>(resolve => {
      const frame = () => {
        samples.push({ elapsedMs: performance.now() - start, width: header.getBoundingClientRect().width });
        if (performance.now() - start >= 450) resolve();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    return { samples, nodeCount: element.querySelectorAll('*').length };
  }, label);
}

async function inspectGrid(matrix: Locator, selectedIndex: number) {
  return matrix.evaluate((element, selected) => {
    const rows = Array.from(element.querySelectorAll<HTMLElement>('[role="row"]'));
    const header = rows.find(row => row.querySelector('[role="columnheader"]'));
    if (!header) throw new Error('Missing matrix header row');
    const headers = Array.from(header.querySelectorAll<HTMLElement>(':scope > [role="columnheader"]')).slice(1);
    const bodyRows = rows.filter(row => row.querySelector(':scope > [role="rowheader"]'));
    const geometry = bodyRows.map(row => {
      const cells = Array.from(row.querySelectorAll<HTMLElement>(':scope > [role="cell"]'));
      return cells.map((cell, index) => {
        const bounds = cell.getBoundingClientRect();
        const heading = headers[index]?.getBoundingClientRect();
        const style = getComputedStyle(cell);
        return { top: bounds.top, bottom: bounds.bottom,
          leftError: heading ? Math.abs(bounds.left - heading.left) : Infinity,
          widthError: heading ? Math.abs(bounds.width - heading.width) : Infinity,
          leftBorder: parseFloat(style.borderLeftWidth) || 0,
          rightBorder: parseFloat(style.borderRightWidth) || 0,
          rightColor: style.borderRightColor };
      });
    });
    const verticalGaps = geometry.slice(1).map((row, index) => row[selected].top - geometry[index][selected].bottom);
    const selectedSeams = geometry.map(row => row[selected].leftBorder + (row[selected - 1]?.rightBorder ?? 0));
    const neutralIndex = headers.findIndex((_, index) => index !== selected && index + 1 !== selected);
    const neutralDiagonal = headers[neutralIndex]?.querySelector<SVGSVGElement>('[data-matrix-edge]');
    const stickyHeader = header.querySelector<HTMLElement>(':scope > [role="columnheader"]')!;
    const stickyBounds = stickyHeader.getBoundingClientRect();
    const probeY = stickyBounds.bottom - 14;
    const stickyHeaderHits = Array.from({ length: 15 }, (_, index) => stickyBounds.left + 12 + index * 12)
      .filter(x => x < stickyBounds.right - 5 && x >= 0 && x < innerWidth && probeY >= 0 && probeY < innerHeight)
      .map(x => stickyHeader.contains(document.elementFromPoint(x, probeY)));
    const stickyBodyColors = bodyRows.map(row => getComputedStyle(row.querySelector<HTMLElement>(':scope > [role="rowheader"]')!).backgroundColor);
    return {
      stickyHeaderHits, stickyBodyColors,
      rowCount: bodyRows.length, variantCount: headers.length,
      largestLeftError: Math.max(...geometry.flat().map(cell => cell.leftError)),
      largestWidthError: Math.max(...geometry.flat().map(cell => cell.widthError)),
      largestVerticalGap: Math.max(0, ...verticalGaps),
      largestSelectedSeam: Math.max(0, ...selectedSeams),
      headerBodyGap: geometry[0][selected].top - header.getBoundingClientRect().bottom,
      neutralDiagonalColor: neutralDiagonal ? getComputedStyle(neutralDiagonal).color : null,
      neutralBodyColor: geometry[0][neutralIndex]?.rightColor ?? null,
      diagonalRules: headers.filter((_, index) => index !== selected).flatMap(column => Array.from(column.querySelectorAll<SVGSVGElement>('[data-matrix-edge]')).map(rule => {
        const path = rule.querySelector('polyline');
        if (!path) throw new Error('Missing continuous header edge');
        const points = Array.from({ length: path.points.numberOfItems }, (_, index) => {
          const point = path.points.getItem(index);
          return { x: point.x, y: point.y };
        });
        const matrix = rule.getScreenCTM();
        if (!matrix || points.length < 3) throw new Error('Missing rendered header edge geometry');
        const last = points.at(-1)!;
        const end = new DOMPoint(last.x, last.y).matrixTransform(matrix);
        const columnBounds = column.getBoundingClientRect();
        const expectedX = (rule.dataset.matrixEdge === 'left' ? columnBounds.left : columnBounds.right) - 0.5;
        return { points, strokeWidth: parseFloat(getComputedStyle(path).strokeWidth), vectorEffect: getComputedStyle(path).vectorEffect,
          endpointXError: Math.abs(end.x - expectedX), endpointYError: Math.abs(end.y - columnBounds.bottom) };
      }))
    };
  }, selectedIndex);
}

async function saveMatrix(page: Page) {
  await page.getByRole('button', { name: 'Shrani', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Potrdi in shrani', exact: true })).toBeVisible();
  const saved = page.waitForResponse(response => new URL(response.url()).pathname === '/api/admin/artikli' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Potrdi in shrani', exact: true }).click();
  const response = await saved;
  expect(response.status(), await response.text()).toBe(200);
  await expect(page.getByRole('button', { name: 'Shrani', exact: true })).toBeDisabled();
}

test.afterAll(async ({ request }) => {
  for (const slug of createdSlugs) {
    const response = await request.delete(`/api/admin/artikli/${slug}`, { headers: { origin: E2E_BASE_URL } });
    expect(response.status(), await response.text()).toBe(200);
  }
});

for (const count of [20, 60]) {
  test(`${count} variants animate continuously and keep diagonal headers aligned with row separators`, async ({ page, request }, testInfo) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await assertAuthenticatedAdmin(request);
    const before = await createMatrixProduct(request, count);
    const matrix = await openMatrix(page, before.slug);
    const selectedIndex = Math.floor(count / 2);
    const selectedLabel = modelName(selectedIndex);
    const expansion = await sampleExpansion(matrix, selectedLabel);
    const startWidth = expansion.samples[0].width;
    const finalWidth = expansion.samples.at(-1)!.width;
    const intermediate = expansion.samples.filter(sample => sample.width > startWidth + 2 && sample.width < finalWidth - 2);
    const frameGaps = expansion.samples.slice(1).map((sample, index) => sample.elapsedMs - expansion.samples[index].elapsedMs);
    const geometry = await inspectGrid(matrix, selectedIndex);
    const metrics = { count, ...expansion, startWidth, finalWidth, intermediateSamples: intermediate.length, maxFrameGapMs: Math.max(...frameGaps), geometry };
    const metricsPath = testInfo.outputPath(`matrix-${count}-expansion-metrics.json`);
    await writeFile(metricsPath, JSON.stringify(metrics, null, 2));
    await testInfo.attach(`matrix-${count}-expansion-metrics`, { path: metricsPath, contentType: 'application/json' });
    console.info(`[matrix-benchmark] ${JSON.stringify({ count, nodes: expansion.nodeCount, samples: expansion.samples.length, intermediateSamples: intermediate.length, maxFrameGapMs: Math.max(...frameGaps) })}`);
    // Frame rate is reported, not gated: CI scheduling is variable. The regression
    // criterion is actual interpolation rather than jumping between end widths.
    expect.soft(finalWidth).toBeGreaterThan(startWidth + 100);
    expect.soft(intermediate.length, 'Dense layouts must pass through intermediate column widths').toBeGreaterThanOrEqual(2);
    expect.soft(expansion.samples.every((sample, index) => index === 0 || sample.width >= expansion.samples[index - 1].width - 1), 'Expansion should move monotonically').toBe(true);
    expect.soft(geometry.variantCount).toBe(count);
    expect.soft(geometry.rowCount).toBeGreaterThan(10);
    expect.soft(geometry.stickyHeaderHits.length).toBeGreaterThan(0);
    expect.soft(geometry.stickyHeaderHits.every(Boolean), 'Scrolled variant controls must not paint or intercept over the sticky header').toBe(true);
    for (const background of geometry.stickyBodyColors) {
      const alpha = background === 'transparent' ? 0 : Number(/rgba\([^)]*,\s*([\d.]+)\)/.exec(background)?.[1] ?? 1);
      expect.soft(alpha, 'Sticky row labels must have opaque backgrounds to hide scrolled summaries').toBe(1);
    }
    expect.soft(geometry.largestLeftError).toBeLessThanOrEqual(1);
    expect.soft(geometry.largestWidthError).toBeLessThanOrEqual(1);
    expect.soft(Math.abs(geometry.headerBodyGap)).toBeLessThanOrEqual(1);
    expect.soft(geometry.largestVerticalGap, 'Selected column borders must not have a gap at every row boundary').toBeLessThanOrEqual(0.1);
    expect.soft(geometry.largestSelectedSeam, 'Shared column boundaries must not draw two adjacent borders').toBeLessThanOrEqual(1.1);
    expect.soft(geometry.diagonalRules.length, 'Collapsed diagonal headers remain present').toBeGreaterThan(0);
    for (const diagonal of geometry.diagonalRules) {
      const [top, bend, bottom] = diagonal.points;
      expect.soft(Math.abs(Math.abs(bend.x - top.x) - Math.abs(bend.y - top.y)), 'Header edges retain their 45-degree slope').toBeLessThanOrEqual(0.1);
      expect.soft(Math.abs(bottom.x - bend.x), 'The same edge continues vertically below its diagonal').toBeLessThanOrEqual(0.1);
      expect.soft(diagonal.strokeWidth).toBe(1);
      expect.soft(diagonal.vectorEffect).toBe('non-scaling-stroke');
      expect.soft(diagonal.endpointXError, 'Header edge must join the body separator center').toBeLessThanOrEqual(0.6);
      expect.soft(diagonal.endpointYError).toBeLessThanOrEqual(1);
    }
    if (geometry.neutralDiagonalColor && geometry.neutralBodyColor) expect.soft(geometry.neutralDiagonalColor).toBe(geometry.neutralBodyColor);
    const screenshotPath = testInfo.outputPath(`matrix-${count}-expanded.png`);
    await page.screenshot({ path: screenshotPath });
    await testInfo.attach(`matrix-${count}-expanded`, { path: screenshotPath, contentType: 'image/png' });

    const price = matrix.getByLabel(`Prodajna cena brez DDV za ${selectedLabel}`, { exact: true });
    await price.fill('12,34');
    for (const index of [selectedIndex - 1, selectedIndex + 1, selectedIndex + 2]) {
      const bodyRow = matrix.getByRole('row').filter({ has: page.getByRole('rowheader') }).first();
      await bodyRow.getByRole('cell').nth(index).hover();
      await expect(price).toBeFocused();
      await expect(price).toHaveValue('12,34');
    }
    await price.press('Tab');
    const collapse = matrix.getByRole('button', { name: 'Skrči razširjeno različico', exact: true });
    await collapse.focus();
    await collapse.press('Enter');
    const reopen = matrix.getByRole('button', { name: `Razširi različico ${selectedLabel}`, exact: true });
    await expect(reopen).toBeVisible();
    await reopen.focus();
    await reopen.press('Enter');
    await expect(matrix.getByLabel(`Prodajna cena brez DDV za ${selectedLabel}`, { exact: true })).toHaveValue('12,34');
    await saveMatrix(page);
    const after = await readProduct(request, before.slug);
    expect(after.variants).toHaveLength(count);
    expect(after.variants.map(variant => variant.id)).toEqual(before.variants.map(variant => variant.id));
    expect(after.variants[selectedIndex].price).toBe(12.34);
    expect(after.variants.map(variant => variant.inventory)).toEqual(before.variants.map(variant => variant.inventory));
    expect(after.variants.filter((_, index) => index !== selectedIndex).map(variant => variant.price)).toEqual(before.variants.filter((_, index) => index !== selectedIndex).map(variant => variant.price));
  });
}


test('keyboard reordering a dense matrix changes only variant order', async ({ page, request }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  const before = await createMatrixProduct(request, 20);
  const matrix = await openMatrix(page, before.slug);
  const handle = matrix.getByRole('button', { name: `Premakni različico ${modelName(0)}`, exact: true });
  await handle.focus();
  await handle.press('Space');
  const sourceHeader = matrix.locator(`[role="columnheader"][data-variant-matrix-column="${before.variants[0].id}"]`);
  const targetHeader = matrix.locator(`[role="columnheader"][data-variant-matrix-column="${before.variants[1].id}"]`);
  await expect(sourceHeader).toHaveAttribute('data-matrix-dragging', 'true');
  await expect(sourceHeader).toHaveAttribute('data-matrix-over', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(targetHeader).toHaveAttribute('data-matrix-over', 'true');
  await page.keyboard.press('Space');
  const expectedNames = before.variants.map(variant => variant.variantName);
  [expectedNames[0], expectedNames[1]] = [expectedNames[1], expectedNames[0]];
  await expect.poll(async () => matrix.getByRole('button', { name: /^Premakni različico / }).evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label')!.replace('Premakni različico ', '')))).toEqual(expectedNames);
  await saveMatrix(page);
  const after = await readProduct(request, before.slug);
  const expectedIds = before.variants.map(variant => variant.id);
  [expectedIds[0], expectedIds[1]] = [expectedIds[1], expectedIds[0]];
  expect(after.variants.map(variant => variant.id)).toEqual(expectedIds);
  const fieldsById = (product: CatalogItemEditorHydration) => Object.fromEntries(product.variants.map(variant => [String(variant.id), {
    name: variant.variantName, sku: variant.variantSku, price: variant.price, stock: variant.inventory,
    options: variant.optionValueIds, content: variant.contentOverride
  }]));
  expect(fieldsById(after)).toEqual(fieldsById(before));
});
