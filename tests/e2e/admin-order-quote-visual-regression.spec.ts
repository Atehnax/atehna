import { randomUUID } from 'node:crypto';
import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
  type Browser,
  type Locator,
  type Page
} from '@playwright/test';
import pg, { type Pool as PgPool } from 'pg';
import {
  ADMIN_STORAGE_STATE_PATH,
  E2E_BASE_URL,
  assertAuthenticatedAdmin
} from './support/auth';

const { Pool } = pg;
const CATALOG_ITEM_ID = 910001;
const CATALOG_VARIANT_ID = 920001;
const VISUAL_QUOTE_TITLE = 'Preglej ponudbo g j p q';
const VISUAL_QUOTE_EMAIL = 'visual.gjpq@example.com';
const VISUAL_ORDER_EMAIL = 'visual.order.gjpq@example.com';
const VISUAL_ORDER_NUMBER = '#987654';
const FIXED_TIMESTAMP = '2026-08-30T17:00:00.000Z';
const VIEWPORTS = [
  { key: 'desktop', width: 1095, height: 920 },
  { key: 'mobile', width: 390, height: 844 }
] as const;

type Rect = { x: number; y: number; width: number; height: number };
type VisualFixture = { quoteRequestId: number; orderId: number; orderNumber: string };

async function requireOk(response: APIResponse, label: string) {
  if (response.ok()) return;
  throw new Error(`${label} failed with ${response.status()}: ${await response.text()}`);
}

async function createVisualQuote(
  browser: Browser,
  adminRequest: APIRequestContext,
  database: PgPool
) {
  let quoteRequestId: number | null = null;
  const publicContext = await browser.newContext({
    baseURL: E2E_BASE_URL,
    storageState: { cookies: [], origins: [] }
  });
  try {
    const estimateResponse = await publicContext.request.post('/api/orders/estimate', {
      data: {
        customerName: 'Vizualni kupec gjpq',
        customerLabels: ['Vizualni kupec gjpq'],
        items: [{ variantId: CATALOG_VARIANT_ID, quantity: 2 }]
      }
    });
    await requireOk(estimateResponse, 'create visual quote estimate');
    const estimate = (await estimateResponse.json()) as {
      quoteFingerprint: string;
      shippingConfigurationVersion: number;
    };
    const networkSeed = randomUUID().replaceAll('-', '');
    const networkSubject = [
      '2001',
      'db8',
      ...Array.from({ length: 6 }, (_, index) => networkSeed.slice(index * 4, (index + 1) * 4))
    ].join(':');
    const createResponse = await publicContext.request.post('/api/quote-requests', {
      headers: {
        Origin: E2E_BASE_URL,
        'X-Forwarded-For': networkSubject,
        'Idempotency-Key': `visual-quote-${randomUUID()}`
      },
      data: {
        customerType: 'individual',
        customerName: 'Vizualni kupec gjpq',
        organizationName: '',
        contactName: 'Vizualni kupec gjpq',
        email: VISUAL_QUOTE_EMAIL,
        addressLine1: 'Preizkusna ulica 7',
        addressLine2: '2. nadstropje',
        city: 'Ljubljana',
        postalCode: '1000',
        countryCode: 'SI',
        reference: 'VIZUALNO-GJPQ',
        quoteReason: 'formal_offer',
        quoteMessage: 'Vizualni pregled postavitve in poravnave.',
        shippingConfigurationVersion: estimate.shippingConfigurationVersion,
        estimateFingerprint: estimate.quoteFingerprint,
        items: [{ variantId: CATALOG_VARIANT_ID, quantity: 2 }]
      }
    });
    await requireOk(createResponse, 'create visual quote request');

    const stored = await database.query<{
      id: string | number;
      draft_offer_version_id: string | number;
      state_version: string | number;
    }>(`
      select request.id, offer.id as draft_offer_version_id, request.state_version
      from quote_requests request
      join quote_offer_versions offer
        on offer.quote_request_id = request.id and offer.status = 'draft'
      where lower(request.email) = lower($1)
      order by request.id desc
      limit 1
    `, [VISUAL_QUOTE_EMAIL]);
    const row = stored.rows[0];
    if (!row) throw new Error('Visual quote request was not persisted.');
    quoteRequestId = Number(row.id);
    const draftOfferVersionId = Number(row.draft_offer_version_id);

    const titleResponse = await adminRequest.put(
      `/api/admin/quote-requests/${quoteRequestId}/title`,
      { data: { title: VISUAL_QUOTE_TITLE, expectedRequestStateVersion: Number(row.state_version) } }
    );
    await requireOk(titleResponse, 'set visual quote title');

    await database.query(`
      update quote_offer_versions
      set valid_until = '2099-09-30T22:00:00.000Z',
          customer_visible_notes = 'Vizualna ponudba za pregled poravnave.',
          delivery_terms = 'Dobava v dveh tednih.',
          payment_terms = 'Plačilo v 30 dneh.',
          state_version = state_version + 1,
          updated_at = $2
      where id = $1 and status = 'draft'
    `, [draftOfferVersionId, FIXED_TIMESTAMP]);
    await database.query(`
      update quote_access_tokens
      set expires_at = '2099-10-15T17:00:00.000Z'
      where quote_request_id = $1
    `, [quoteRequestId]);
    return quoteRequestId;
  } catch (error) {
    if (quoteRequestId) {
      await adminRequest.delete(`/api/admin/quote-requests/${quoteRequestId}`, {
        data: { reason: 'Čiščenje neuspešne E2E vizualne priprave.' }
      }).catch(() => undefined);
    }
    throw error;
  } finally {
    await publicContext.close();
  }
}
async function archiveVisualOrder(adminRequest: APIRequestContext, orderId: number) {
  const cancelResponse = await adminRequest.post(`/api/admin/orders/${orderId}/status`, {
    data: { status: 'cancelled' }
  });
  await requireOk(cancelResponse, 'cancel visual order fixture');
  const archiveResponse = await adminRequest.delete(`/api/admin/orders/${orderId}`);
  await requireOk(archiveResponse, 'archive visual order fixture');
}

async function createVisualOrder(adminRequest: APIRequestContext) {
  let orderId: number | null = null;
  try {
  const createResponse = await adminRequest.post('/api/admin/orders');
  await requireOk(createResponse, 'create visual order draft');
  const created = (await createResponse.json()) as { orderId?: unknown };
  orderId = Number(created.orderId);
  if (!Number.isSafeInteger(orderId) || orderId < 1) throw new Error('Visual order id is invalid.');
  const orderNumber = `#${orderId}`;

  const itemResponse = await adminRequest.post(`/api/admin/orders/${orderId}/items`, {
    data: {
      items: [{
        catalogItemId: CATALOG_ITEM_ID,
        catalogVariantId: CATALOG_VARIANT_ID,
        sku: 'MAT-KOV-ALU-100',
        name: 'Aluminijasta plošča',
        unit: 'kos',
        quantity: 2,
        unitPrice: 4.9,
        discountPercentage: 0
      }]
    }
  });
  await requireOk(itemResponse, 'save visual order items');
  const shippingResponse = await adminRequest.post(`/api/admin/orders/${orderId}/shipping`, {
    data: {
      action: 'override',
      amountCents: 300,
      reason: 'Vizualni preizkus ročne poštnine.'
    }
  });
  await requireOk(shippingResponse, 'set visual order shipping');
  const detailsResponse = await adminRequest.post(`/api/admin/orders/${orderId}/details`, {
    data: {
      orderNumber,
      customerType: 'company',
      organizationName: 'Vizualno podjetje gjpq d.o.o.',
      contactName: 'Gaja Jopq',
      email: VISUAL_ORDER_EMAIL,
      addressLine1: 'Preizkusna ulica 7',
      addressLine2: '2. nadstropje',
      postalCode: '1000',
      city: 'Ljubljana',
      countryCode: 'SI',
      reference: 'VIZUALNO-GJPQ',
      notes: 'Opomba stranke za pregled geometrije.',
      orderDate: '2026-08-30'
    }
  });
  await requireOk(detailsResponse, 'finalize visual order');

  return { orderId, orderNumber };
  } catch (error) {
    if (orderId) await archiveVisualOrder(adminRequest, orderId).catch(() => undefined);
    throw error;
  }
}

async function settleRenderedPage(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.addStyleTag({ content: `
    html { scroll-behavior: auto !important; }
    nextjs-portal, [data-next-badge-root] { display: none !important; }
  ` });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    window.scrollTo(0, 0);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
}

async function box(locator: Locator): Promise<Rect> {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value as Rect;
}

function expectSameBox(before: Rect, after: Rect, tolerance = 1) {
  for (const dimension of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(before[dimension] - after[dimension])).toBeLessThanOrEqual(tolerance);
  }
}

async function assertDetailColumns(
  page: Page,
  kind: 'quote' | 'order',
  viewport: (typeof VIEWPORTS)[number]
) {
  const leftCard = kind === 'quote'
    ? page.getByTestId('quote-request-details-card')
    : page.getByTestId('admin-order-data-card');
  const rightCard = kind === 'quote'
    ? page.getByTestId('quote-customer-card')
    : page.getByTestId('admin-order-customer-card');
  const [left, right] = await Promise.all([box(leftCard.locator('..')), box(rightCard.locator('..'))]);
  if (viewport.key === 'desktop') {
    expect(Math.abs(left.y - right.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(right.x - left.x - left.width - 20)).toBeLessThanOrEqual(1);
    expect(left.width / right.width).toBeGreaterThan(1.5);
    expect(left.width / right.width).toBeLessThan(1.7);
  } else {
    expect(Math.abs(left.x - right.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(left.width - right.width)).toBeLessThanOrEqual(1);
    expect(right.y).toBeGreaterThanOrEqual(left.y + left.height + 19);
  }
}

async function assertSectionEditIcons(page: Page, minimumCount: number) {
  const geometry = await page.locator('button[data-admin-card-edit-action]').evaluateAll((buttons) =>
    buttons.flatMap((button) => {
      const icon = button.querySelector('svg');
      if (!icon || button.getClientRects().length === 0) return [];
      const buttonBox = button.getBoundingClientRect();
      const iconBox = icon.getBoundingClientRect();
      return [{
        width: iconBox.width,
        height: iconBox.height,
        horizontalOffset: Math.abs(iconBox.x + iconBox.width / 2 - (buttonBox.x + buttonBox.width / 2)),
        verticalOffset: Math.abs(iconBox.y + iconBox.height / 2 - (buttonBox.y + buttonBox.height / 2))
      }];
    })
  );
  expect(geometry.length).toBeGreaterThanOrEqual(minimumCount);
  for (const icon of geometry) {
    expect(Math.abs(icon.width - 18)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(icon.height - 18)).toBeLessThanOrEqual(0.5);
    expect(icon.horizontalOffset).toBeLessThanOrEqual(1);
    expect(icon.verticalOffset).toBeLessThanOrEqual(1);
  }
}

async function assertQuoteTitleDescenders(page: Page) {
  const title = page.getByTestId('quote-title-slot').locator('h1 > span');
  await expect(title).toHaveText(VISUAL_QUOTE_TITLE);
  const metrics = await title.evaluate((element) => {
    const titleBox = element.getBoundingClientRect();
    const headingBox = element.parentElement?.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element);
    const textBox = range.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      text: element.textContent ?? '',
      titleTop: titleBox.top,
      titleBottom: titleBox.bottom,
      headingTop: headingBox?.top ?? Number.NEGATIVE_INFINITY,
      headingBottom: headingBox?.bottom ?? Number.POSITIVE_INFINITY,
      textTop: textBox.top,
      textBottom: textBox.bottom,
      lineHeight: Number.parseFloat(style.lineHeight),
      fontSize: Number.parseFloat(style.fontSize)
    };
  });
  for (const letter of ['g', 'j', 'p', 'q']) expect(metrics.text).toContain(letter);
  expect(metrics.lineHeight).toBeGreaterThan(metrics.fontSize);
  expect(metrics.titleTop).toBeGreaterThanOrEqual(metrics.headingTop - 1);
  expect(metrics.titleBottom).toBeLessThanOrEqual(metrics.headingBottom + 1);
  expect(metrics.textTop).toBeGreaterThanOrEqual(metrics.headingTop - 1);
  expect(metrics.textBottom).toBeLessThanOrEqual(metrics.headingBottom + 1);
}
async function assertQuoteItemGeometry(page: Page) {
  const table = page.getByTestId('quote-items-comparison-table');
  await expect(table).toBeVisible();
  const geometry = await table.locator('tr[data-item-row]').evaluateAll((rows) => rows.map((row) => {
    const fields = Array.from(row.querySelectorAll('[data-item-field]')).map((field) => {
      const cell = field.closest('td');
      if (!cell) throw new Error('Quote value is missing its table cell.');
      const fieldBox = field.getBoundingClientRect();
      const cellBox = cell.getBoundingClientRect();
      return {
        key: field.getAttribute('data-item-field') ?? '',
        centerX: fieldBox.x + fieldBox.width / 2,
        horizontalOffset: Math.abs(fieldBox.x + fieldBox.width / 2 - (cellBox.x + cellBox.width / 2)),
        verticalOffset: Math.abs(fieldBox.y + fieldBox.height / 2 - (cellBox.y + cellBox.height / 2))
      };
    });
    const articleControl = row.querySelector('[data-item-title]')
      ?? row.querySelector('button[aria-label^="Ponujeni artikel "]');
    const sku = row.querySelector('[data-item-sku]');
    const checkbox = row.querySelector('input[type="checkbox"]');
    const checkboxCell = checkbox?.closest('td');
    if (!articleControl || !sku) throw new Error('Quote row geometry markers are incomplete.');
    const checkboxBox = checkbox?.getBoundingClientRect() ?? null;
    const checkboxCellBox = checkboxCell?.getBoundingClientRect() ?? null;
    return {
      rowType: row.getAttribute('data-item-row') ?? '',
      fields,
      titleSkuGap: sku.getBoundingClientRect().top - articleControl.getBoundingClientRect().bottom,
      checkboxCenterX: checkboxBox ? checkboxBox.x + checkboxBox.width / 2 : null,
      checkboxOffset: checkboxBox && checkboxCellBox
        ? Math.abs(checkboxBox.x + checkboxBox.width / 2 - (checkboxCellBox.x + checkboxCellBox.width / 2))
        : null
    };
  }));
  expect(geometry.map((row) => row.rowType)).toEqual(['requested', 'offered']);
  for (const row of geometry) {
    expect(row.fields.map((field) => field.key)).toEqual(['quantity', 'unit-net', 'discount']);
    if (row.checkboxOffset !== null) expect(row.checkboxOffset).toBeLessThanOrEqual(1);
    for (const field of row.fields) {
      expect(field.horizontalOffset).toBeLessThanOrEqual(1);
      expect(field.verticalOffset).toBeLessThanOrEqual(1);
    }
  }
  expect(geometry[0]!.checkboxCenterX).toBeNull();
  expect(geometry[1]!.checkboxCenterX).not.toBeNull();
  const headerCheckbox = await box(table.locator('thead input[type="checkbox"]'));
  expect(Math.abs(
    geometry[1]!.checkboxCenterX! - (headerCheckbox.x + headerCheckbox.width / 2)
  )).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry[0]!.titleSkuGap - geometry[1]!.titleSkuGap)).toBeLessThanOrEqual(1);
  for (const key of ['quantity', 'unit-net', 'discount']) {
    const centers = geometry.map((row) => row.fields.find((field) => field.key === key)?.centerX ?? 0);
    expect(Math.abs(centers[0]! - centers[1]!)).toBeLessThanOrEqual(1);
  }
}

async function captureQuoteOfferLayout(page: Page) {
  return page.getByTestId('quote-offer-card').evaluate((card) => {
    const rect = (element: Element | null) => {
      if (!element) throw new Error('Expected quote layout element.');
      const bounds = element.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    };
    return {
      card: rect(card),
      details: rect(card.querySelector('[data-testid="quote-offer-details"]')),
      actionBar: rect(card.querySelector('[data-testid="quote-offer-action-bar"]')),
      fields: Array.from(card.querySelectorAll('[data-quote-offer-field]')).map((field) => ({
        key: field.getAttribute('data-quote-offer-field') ?? '',
        ...rect(field)
      })),
      items: Array.from(card.querySelectorAll('[data-item-row]')).map((row, index) => ({
        key: `${row.getAttribute('data-item-row')}:${index}`,
        ...rect(row)
      }))
    };
  });
}

function assertQuoteOfferLayoutUnchanged(
  before: Awaited<ReturnType<typeof captureQuoteOfferLayout>>,
  after: Awaited<ReturnType<typeof captureQuoteOfferLayout>>
) {
  expectSameBox(before.card, after.card);
  expectSameBox(before.details, after.details);
  expectSameBox(before.actionBar, after.actionBar);
  expect(after.fields).toHaveLength(before.fields.length);
  expect(after.items).toHaveLength(before.items.length);
  before.fields.forEach((field, index) => {
    expect(after.fields[index]?.key).toBe(field.key);
    expectSameBox(field, after.fields[index]!);
  });
  before.items.forEach((item, index) => {
    expect(after.items[index]?.key).toBe(item.key);
    expectSameBox(item, after.items[index]!);
  });
}

async function captureOrderItemSlots(page: Page) {
  const table = page.getByTestId('admin-order-items-toolbar').locator('..').locator('table');
  const headers = await table.locator('thead th').evaluateAll((cells) => cells.map((cell) => {
    const bounds = cell.getBoundingClientRect();
    return bounds.x + bounds.width / 2;
  }));
  const slots = await table.locator('[data-admin-order-item-value-slot]').evaluateAll((elements) => elements.map((element) => {
    const cell = element.closest('td');
    if (!cell) throw new Error('Order value is missing its table cell.');
    const bounds = element.getBoundingClientRect();
    const cellBounds = cell.getBoundingClientRect();
    return {
      key: element.getAttribute('data-admin-order-item-value-slot') ?? '',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      horizontalOffset: Math.abs(bounds.x + bounds.width / 2 - (cellBounds.x + cellBounds.width / 2)),
      verticalOffset: Math.abs(bounds.y + bounds.height / 2 - (cellBounds.y + cellBounds.height / 2))
    };
  }));
  expect(slots.map((slot) => slot.key)).toEqual(['quantity', 'unit-price', 'discount']);
  slots.forEach((slot, index) => {
    expect(slot.horizontalOffset).toBeLessThanOrEqual(1);
    expect(slot.verticalOffset).toBeLessThanOrEqual(1);
    expect(Math.abs(slot.x + slot.width / 2 - (headers[index + 2] ?? 0))).toBeLessThanOrEqual(1);
  });
  return slots.map(({ horizontalOffset: _horizontalOffset, verticalOffset: _verticalOffset, ...slot }) => slot);
}

async function normalizeVolatileActivityTimestamps(page: Page) {
  await page
    .locator('[data-testid$="-activity-timeline"] time')
    .evaluateAll((timestamps) => {
      timestamps.forEach((timestamp) => {
        // Activity evidence is append-only, so normalize only rendered labels.
        timestamp.textContent = '30.8. 19:00';
      });
    });
}

async function normalizeVolatileOrderNumbers(page: Page) {
  await page.evaluate((stableOrderNumber) => {
    const replaceOrderNumber = (value: string) => value.replace(/#\d+/gu, stableOrderNumber);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.nodeValue) node.nodeValue = replaceOrderNumber(node.nodeValue);
      node = walker.nextNode();
    }
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach((field) => {
      field.value = replaceOrderNumber(field.value);
    });
  }, VISUAL_ORDER_NUMBER);
  const orderNumberInput = page.getByLabel('Številka naročila');
  if (await orderNumberInput.count()) {
    await orderNumberInput.fill(VISUAL_ORDER_NUMBER.replace(/^#/u, ''));
    await orderNumberInput.blur();
    await page.waitForTimeout(400);
  }
}

async function expectPageScreenshot(page: Page, name: string, masks: Locator[] = []) {
  await normalizeVolatileActivityTimestamps(page);
  await normalizeVolatileOrderNumbers(page);
  await expect(page).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
    mask: masks,
    maskColor: '#e2e8f0',
    threshold: 0.25,
    maxDiffPixelRatio: 0.01
  });
}

function quoteMasks(page: Page) {
  return [
    page.getByText(/^Povpraševanje POV-\d{4}-\d{6}$/u).first(),
    page.getByTestId('quote-detail-header').locator('p').first().locator('span').first()
  ];
}
test.describe.serial('admin quote and order rendered visual regression', () => {
  test.use({
    storageState: ADMIN_STORAGE_STATE_PATH,
    locale: 'sl-SI',
    timezoneId: 'Europe/Ljubljana',
    colorScheme: 'light'
  });

  let database: PgPool;
  let fixture: VisualFixture;
  let createdQuoteRequestId: number | null = null;
  let createdOrderId: number | null = null;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(90_000);
    const databaseUrl = process.env.E2E_DATABASE_URL?.trim();
    if (!databaseUrl) throw new Error('[e2e-preflight] E2E_DATABASE_URL is required.');
    database = new Pool({ connectionString: databaseUrl, ssl: false });
    const adminContext = await browser.newContext({
      baseURL: E2E_BASE_URL,
      storageState: ADMIN_STORAGE_STATE_PATH
    });
    try {
      await assertAuthenticatedAdmin(adminContext.request);
      const quoteRequestId = await createVisualQuote(browser, adminContext.request, database);
      createdQuoteRequestId = quoteRequestId;
      const order = await createVisualOrder(adminContext.request);
      createdOrderId = order.orderId;
      fixture = { quoteRequestId, ...order };
    } finally {
      await adminContext.close();
    }
  });

  test.afterAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60_000);
    if (!database) return;
    try {
      if (createdOrderId || createdQuoteRequestId) {
        const adminContext = await browser.newContext({
          baseURL: E2E_BASE_URL,
          storageState: ADMIN_STORAGE_STATE_PATH
        });
        try {
          try {
            if (createdOrderId) await archiveVisualOrder(adminContext.request, createdOrderId);
          } finally {
            if (createdQuoteRequestId) {
              const response = await adminContext.request.delete(
                `/api/admin/quote-requests/${createdQuoteRequestId}`,
                { data: { reason: 'Čiščenje E2E vizualnega regresijskega preizkusa.' } }
              );
              await requireOk(response, 'remove visual quote fixture');
            }
          }
        } finally {
          await adminContext.close();
        }
      }
    } finally {
      await (database as PgPool & { end: () => Promise<void> }).end();
    }
  });

  test.beforeEach(async ({}, testInfo) => {
    testInfo.setTimeout(60_000);
    // Keep one approved Chromium baseline portable across Windows and Linux.
    testInfo.snapshotSuffix = '';
  });

  for (const viewport of VIEWPORTS) {
    test(`quote ${viewport.key} read mode`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/admin/orders/quotes/${fixture.quoteRequestId}`);
      await expect(page.getByTestId('admin-quote-detail')).toBeVisible();
      await expect(page.getByTestId('quote-header-status-edit')).toBeEnabled();
      await settleRenderedPage(page);

      await assertQuoteTitleDescenders(page);
      await assertSectionEditIcons(page, 3);
      await assertDetailColumns(page, 'quote', viewport);
      await assertQuoteItemGeometry(page);
      if (viewport.key === 'desktop') {
        await expect(page.getByTestId('quote-title-slot')).toHaveScreenshot(
          'quote-title-descenders-desktop-read.png',
          {
            animations: 'disabled',
            caret: 'hide',
            scale: 'css',
            threshold: 0.25,
            maxDiffPixelRatio: 0.001
          }
        );
      }
      await expectPageScreenshot(page, `quote-${viewport.key}-read.png`, quoteMasks(page));
    });

    test(`quote ${viewport.key} edit mode`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/admin/orders/quotes/${fixture.quoteRequestId}`);
      await expect(page.getByTestId('admin-quote-detail')).toBeVisible();
      await settleRenderedPage(page);

      const titleSlot = page.getByTestId('quote-title-slot');
      const requestCard = page.getByTestId('quote-request-details-card');
      const before = {
        title: await box(titleSlot),
        request: await box(requestCard),
        offer: await captureQuoteOfferLayout(page)
      };
      const masterEdit = page.getByTestId('quote-header-status-edit');
      await expect(masterEdit).toBeEnabled();
      await masterEdit.click();
      await expect(masterEdit).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('quote-request-title-input')).toHaveValue(VISUAL_QUOTE_TITLE);
      await expect(page.getByLabel('Dobavni pogoji')).toBeVisible();
      await expect(page.locator('tr[data-item-row="offered"] [data-item-field="unit-net"]')).toBeVisible();
      await settleRenderedPage(page);

      expectSameBox(before.title, await box(titleSlot));
      expectSameBox(before.request, await box(requestCard));
      assertQuoteOfferLayoutUnchanged(before.offer, await captureQuoteOfferLayout(page));
      await assertSectionEditIcons(page, 3);
      await assertDetailColumns(page, 'quote', viewport);
      await assertQuoteItemGeometry(page);
      if (viewport.key === 'desktop') {
        await expect(titleSlot).toHaveScreenshot('quote-title-descenders-desktop-edit.png', {
          animations: 'disabled',
          caret: 'hide',
          scale: 'css',
          threshold: 0.25,
          maxDiffPixelRatio: 0.001
        });
      }
      await expectPageScreenshot(page, `quote-${viewport.key}-edit.png`, quoteMasks(page));
    });

    test(`order ${viewport.key} read mode`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/admin/orders/${fixture.orderId}`);
      await expect(page.getByTestId('admin-order-detail-header')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Uredi celotno naročilo' })).toBeEnabled();
      await settleRenderedPage(page);

      await expect(page.getByTestId('admin-order-title-slot')).toContainText(`Naročilo ${fixture.orderNumber}`);
      await assertSectionEditIcons(page, 4);
      await assertDetailColumns(page, 'order', viewport);
      await captureOrderItemSlots(page);
      await expectPageScreenshot(page, `order-${viewport.key}-read.png`);
    });

    test(`order ${viewport.key} edit mode`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/admin/orders/${fixture.orderId}`);
      await expect(page.getByTestId('admin-order-detail-header')).toBeVisible();
      await settleRenderedPage(page);

      const titleSlot = page.getByTestId('admin-order-title-slot');
      const dataCard = page.getByTestId('admin-order-data-card');
      const before = {
        title: await box(titleSlot),
        dataCard: await box(dataCard),
        itemSlots: await captureOrderItemSlots(page)
      };
      await page.getByRole('button', { name: 'Uredi celotno naročilo' }).click();
      await expect(page.getByLabel('Številka naročila')).toBeVisible();
      await expect(page.getByTestId('admin-order-address-fields')).toBeVisible();
      await expect(page.locator('[data-admin-order-item-value-input]').first()).toBeVisible();
      await settleRenderedPage(page);

      expectSameBox(before.title, await box(titleSlot));
      expectSameBox(before.dataCard, await box(dataCard));
      const afterSlots = await captureOrderItemSlots(page);
      expect(afterSlots).toHaveLength(before.itemSlots.length);
      before.itemSlots.forEach((slot, index) => {
        expect(afterSlots[index]?.key).toBe(slot.key);
        expectSameBox(slot, afterSlots[index]!);
      });
      await assertSectionEditIcons(page, 4);
      await assertDetailColumns(page, 'order', viewport);
      await expectPageScreenshot(page, `order-${viewport.key}-edit.png`);
    });
  }
});