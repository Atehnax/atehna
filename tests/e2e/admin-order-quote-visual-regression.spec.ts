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
const VISUAL_PUBLIC_CODE_BASE = '7K3M-4X9P-2D6R-8H4Q';
const FIXED_TIMESTAMP = '2026-08-30T17:00:00.000Z';
const VIEWPORTS = [
  { key: 'desktop', width: 1095, height: 920 },
  { key: 'mobile', width: 390, height: 844 }
] as const;

type Rect = { x: number; y: number; width: number; height: number };
type VisualFixture = { quoteRequestId: number; orderId: number; orderNumber: string };

async function requireOk(response: Pick<APIResponse, 'ok' | 'status' | 'text'>, label: string) {
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
    ? page.getByTestId('quote-admin-notes-card')
    : page.getByTestId('admin-order-admin-notes-card');
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

async function assertMobileCustomerCard(page: Page, kind: 'quote' | 'order', editing: boolean) {
  const card = page.getByTestId(kind === 'quote' ? 'quote-request-details-card' : 'admin-order-data-card');
  const metrics = await card.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const children = Array.from(element.querySelectorAll('h2, dt, dd, input, textarea, button'))
      .filter((child) => child.getClientRects().length > 0)
      .map((child) => {
        const rect = child.getBoundingClientRect();
        return { label: child.getAttribute('aria-label') || child.textContent, left: rect.left, right: rect.right };
      });
    return { left: bounds.left, right: bounds.right, width: window.innerWidth, children };
  });
  expect(metrics.left).toBeGreaterThanOrEqual(0);
  expect(metrics.right).toBeLessThanOrEqual(metrics.width);
  for (const child of metrics.children) {
    expect(child.left, child.label || 'customer control').toBeGreaterThanOrEqual(metrics.left);
    expect(child.right, child.label || 'customer control').toBeLessThanOrEqual(metrics.right);
  }
  if (editing) {
    const address = card.getByRole('group', { name: 'Naslovni podatki' });
    const fields = await address.locator('input').evaluateAll((inputs) => inputs.map((input) => {
      const bounds = input.getBoundingClientRect();
      return { width: bounds.width, top: bounds.top, bottom: bounds.bottom };
    }));
    expect(fields).toHaveLength(5);
    [150, 150, 60, 50, 35].forEach((minimum, index) => {
      expect(fields[index]!.width, `address field ${index}`).toBeGreaterThanOrEqual(minimum);
    });
    expect(fields[1]!.top).toBeGreaterThanOrEqual(fields[0]!.bottom);
    expect(fields[2]!.top).toBeGreaterThanOrEqual(fields[1]!.bottom);
    expect(fields[3]!.top).toBe(fields[2]!.top);
    expect(fields[4]!.top).toBe(fields[2]!.top);
  }
}

async function assertCustomerDetailsRows(
  page: Page,
  kind: 'quote' | 'order',
  customerLabel: 'Naročnik' | 'Naziv',
  desktop: boolean
) {
  const card = page.getByTestId(kind === 'quote' ? 'quote-request-details-card' : 'admin-order-data-card');
  const rowAttribute = kind === 'quote' ? 'data-quote-detail-row' : 'data-order-data-row';
  const spanAttribute = kind === 'quote' ? 'data-quote-detail-span' : 'data-order-data-span';
  const labels = [
    kind === 'quote' ? 'Št. povpraševanja' : 'Številka naročila',
    'Datum', 'Tip naročnika', customerLabel, 'Email', 'Naslov',
    ...(kind === 'quote' ? ['Kaj potrebuje?'] : []),
    'Sporočilo stranke'
  ];
  const rows = card.locator(`[${rowAttribute}]`);
  await expect(rows).toHaveCount(labels.length);
  expect(await rows.evaluateAll((elements, attribute) => elements.map((element) => element.getAttribute(attribute)), rowAttribute)).toEqual(labels);
  await expect(card.locator(`[${rowAttribute}="Naslov"]`)).not.toHaveAttribute(spanAttribute, 'full');
  const messageRow = card.locator(`[${rowAttribute}="Sporočilo stranke"]`);
  if (kind === 'order') await expect(messageRow).toHaveAttribute(spanAttribute, 'full');
  else await expect(messageRow).not.toHaveAttribute(spanAttribute, 'full');
  const copy = rows.first().getByTestId(`admin-${kind}-public-code-copy`);
  await expect(copy).toBeVisible();
  await expect(copy).toBeEnabled();
  await expect(rows.first().locator('input')).toHaveCount(0);
  const header = page.getByTestId(kind === 'quote' ? 'quote-detail-header' : 'admin-order-detail-header');
  await expect(header.getByTestId(`admin-${kind}-public-code-copy`)).toHaveCount(0);
  if (kind === 'quote') {
    await expect(card.locator(`[${rowAttribute}="Datum"] input`)).toHaveCount(0);
    await expect(card.getByLabel('Referenca', { exact: true })).toHaveCount(0);
  }
  const columnCount = await card.locator('dl').first().evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length);
  if (desktop) expect(columnCount).toBe(2);
  if (columnCount === 2) {
    const boxes = await rows.evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom };
    }));
    for (let index = 0; index + 1 < labels.length; index += 2) {
      expect(Math.abs(boxes[index]!.y - boxes[index + 1]!.y)).toBeLessThanOrEqual(1);
      expect(boxes[index + 1]!.x).toBeGreaterThan(boxes[index]!.right);
      if (index > 0) expect(boxes[index]!.y).toBeGreaterThanOrEqual(boxes[index - 2]!.bottom);
    }
  }
}

function expectCustomerCardTransition(before: Rect, after: Rect, viewport: (typeof VIEWPORTS)[number]) {
  // Address and entity-name editors may expand at any card width; their
  // controls must stay in normal flow without moving the card's outer edges.
  expectSameBox({ ...before, height: after.height }, after);
  expect(after.height, `${viewport.key} customer editor`).toBeGreaterThanOrEqual(before.height);
}

async function assertQuoteSectionTitleStyles(page: Page) {
  const sectionTitles = [
    'Podatki povpraševanja',
    'Ponudba',
    'Opombe administratorja',
    'PDF dokumenti',
    'Stranka in dostop'
  ] as const;
  const renderedStyles: Array<{
    fontSize: string;
    fontWeight: string;
    lineHeight: string;
    color: string;
  }> = [];

  for (const name of sectionTitles) {
    const heading = page.getByRole('heading', { name, exact: true, level: 2 });
    await expect(heading).toHaveCount(1);
    await expect(heading).toBeVisible();
    renderedStyles.push(await heading.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        color: style.color
      };
    }));
  }

  const reference = renderedStyles[0]!;
  expect(reference.fontSize).toBe('16px');
  expect(reference.fontWeight).toBe('600');
  for (const style of renderedStyles.slice(1)) expect(style).toEqual(reference);
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
  after: Awaited<ReturnType<typeof captureQuoteOfferLayout>>,
  verticalShift = 0
) {
  const shifted = (rect: Rect) => ({ ...rect, y: rect.y + verticalShift });
  expectSameBox(shifted(before.card), after.card);
  expectSameBox(shifted(before.details), after.details);
  expectSameBox(shifted(before.actionBar), after.actionBar);
  expect(after.fields).toHaveLength(before.fields.length);
  expect(after.items).toHaveLength(before.items.length);
  before.fields.forEach((field, index) => {
    expect(after.fields[index]?.key).toBe(field.key);
    expectSameBox(shifted(field), after.fields[index]!);
  });
  before.items.forEach((item, index) => {
    expect(after.items[index]?.key).toBe(item.key);
    expectSameBox(shifted(item), after.items[index]!);
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

async function assertOrderItemsTerminalGutter(page: Page) {
  const table = page.getByTestId('admin-order-items-toolbar').locator('..').locator('table');
  const scroller = table.locator('..');
  const headerLabel = page.getByTestId('admin-order-items-total-header');
  const valueCell = table.locator('[data-admin-order-item-total]').first();
  const originalScrollLeft = await scroller.evaluate((element) => element.scrollLeft);

  await scroller.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  try {
    await expect(headerLabel).toBeVisible();
    await expect(valueCell).toBeVisible();

    const headerGeometry = await headerLabel.evaluate((label) => {
      const cell = label.closest('th');
      if (!cell) throw new Error('Order total header is missing its table cell.');
      const cellBounds = cell.getBoundingClientRect();
      const styles = getComputedStyle(cell);
      return {
        paddingRight: Number.parseFloat(styles.paddingRight),
        textAlign: styles.textAlign,
        cellRight: cellBounds.right
      };
    });
    const valueGeometry = await valueCell.evaluate((cell) => {
      const value = cell.querySelector('[data-admin-order-item-total-value]');
      if (!value) throw new Error('Order total value is missing its label.');
      const cellBounds = cell.getBoundingClientRect();
      const valueBounds = value.getBoundingClientRect();
      const styles = getComputedStyle(cell);
      return {
        paddingRight: Number.parseFloat(styles.paddingRight),
        textAlign: styles.textAlign,
        cellRight: cellBounds.right,
        gap: cellBounds.right - valueBounds.right
      };
    });

    expect(headerGeometry.paddingRight).toBe(16);
    expect(valueGeometry.paddingRight).toBe(16);
    expect(headerGeometry.textAlign).toBe('right');
    expect(valueGeometry.textAlign).toBe('right');
    expect(valueGeometry.gap).toBeGreaterThanOrEqual(15);
    expect(Math.abs(headerGeometry.cellRight - valueGeometry.cellRight)).toBeLessThanOrEqual(1);
  } finally {
    await scroller.evaluate((element, left) => {
      element.scrollLeft = left;
    }, originalScrollLeft);
  }
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
  await page.locator('[data-quote-detail-row="Datum"] dd span').evaluateAll((dates, timestamp) => {
    const stableDate = new Intl.DateTimeFormat('sl-SI', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Ljubljana'
    }).format(new Date(timestamp));
    // This helper runs only before PNG comparisons; stored creation dates and
    // all behavioral assertions retain their real values.
    dates.forEach((date) => { date.textContent = stableDate; });
  }, FIXED_TIMESTAMP);
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

async function normalizeVolatilePublicCodes(page: Page) {
  await page.evaluate((stableBase) => {
    const publicCodePattern = /\b(N|PV|PN)-(?:[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}-){3}[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}(-V[1-9]\d*)?\b/gu;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.nodeValue) {
        // Public codes are immutable: normalize only rendered random text, not
        // database records, code prefixes/versions, controls, or their geometry.
        node.nodeValue = node.nodeValue.replace(
          publicCodePattern,
          (_match, prefix: string, version: string | undefined) =>
            `${prefix}-${stableBase}${version ?? ''}`
        );
      }
      node = walker.nextNode();
    }
  }, VISUAL_PUBLIC_CODE_BASE);
}

async function expectPageScreenshot(page: Page, name: string, masks: Locator[] = []) {
  await normalizeVolatileActivityTimestamps(page);
  await normalizeVolatileOrderNumbers(page);
  await normalizeVolatilePublicCodes(page);
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

async function expectOrderShippingScreenshot(page: Page, name: string) {
  const shippingCard = page.getByTestId('admin-order-shipping-card');
  await expect(shippingCard).toBeVisible();
  await shippingCard.scrollIntoViewIfNeeded();
  await expect(shippingCard).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
    threshold: 0.25,
    maxDiffPixelRatio: 0.003
  });
}

async function expectOrderItemsScreenshot(page: Page, name: string) {
  const card = page.getByTestId('admin-order-items-toolbar').locator('..');
  const scroller = card.locator('table').locator('..');
  await card.scrollIntoViewIfNeeded();
  const originalScrollLeft = await scroller.evaluate((element) => element.scrollLeft);
  await scroller.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  try {
    await expect(card).toHaveScreenshot(name, {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      threshold: 0.25,
      maxDiffPixelRatio: 0.003
    });
  } finally {
    await scroller.evaluate((element, left) => {
      element.scrollLeft = left;
    }, originalScrollLeft);
  }
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
  });

  for (const kind of ['quote', 'order'] as const) {
    test(`${kind} mobile customer details keep every address field usable`, async ({ page }, testInfo) => {
      for (const width of [360, 390, 640]) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(kind === 'quote'
          ? `/admin/orders/quotes/${fixture.quoteRequestId}`
          : `/admin/orders/${fixture.orderId}`);
        const card = page.getByTestId(kind === 'quote' ? 'quote-request-details-card' : 'admin-order-data-card');
        await expect(card).toBeVisible();
        await settleRenderedPage(page);
        await assertMobileCustomerCard(page, kind, false);
        if (width === 390) {
          await testInfo.attach(`${kind}-customer-mobile-read`, { body: await card.screenshot({ path: testInfo.outputPath(`${kind}-customer-mobile-read.png`) }), contentType: 'image/png' });
        }
        const edit = card.locator('button[data-admin-card-edit-action]');
        await expect(edit).toBeEnabled();
        await edit.click();
        await expect(edit).toHaveAttribute('aria-pressed', 'true');
        await assertMobileCustomerCard(page, kind, true);
        const prefix = kind === 'quote' ? 'admin-quote' : 'admin-order';
        const street = card.getByTestId(`${prefix}-address-autocomplete`);
        await street.fill('Preizkusna ulica 7');
        await expect(street).toHaveValue('Preizkusna ulica 7');
        await card.getByLabel('Dodatni naslov', { exact: true }).fill('2. nadstropje');
        await expect(card.getByLabel('Dodatni naslov', { exact: true })).toHaveValue('2. nadstropje');
        await card.getByLabel('Država', { exact: true }).focus();
        if (width === 390) {
          await testInfo.attach(`${kind}-customer-mobile-edit`, { body: await card.screenshot({ path: testInfo.outputPath(`${kind}-customer-mobile-edit.png`) }), contentType: 'image/png' });
        }
      }
    });
  }

  for (const viewport of VIEWPORTS) {
    test(`quote ${viewport.key} read mode`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/admin/orders/quotes/${fixture.quoteRequestId}`);
      await expect(page.getByTestId('admin-quote-detail')).toBeVisible();
      await expect(page.getByTestId('quote-header-status-edit')).toBeEnabled();
      await settleRenderedPage(page);

      await assertQuoteTitleDescenders(page);
      await assertCustomerDetailsRows(page, 'quote', 'Naročnik', viewport.key === 'desktop');
      await assertQuoteSectionTitleStyles(page);
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
      const requestAfter = await box(requestCard);
      await assertCustomerDetailsRows(page, 'quote', 'Naročnik', viewport.key === 'desktop');
      expectCustomerCardTransition(before.request, requestAfter, viewport);
      assertQuoteOfferLayoutUnchanged(before.offer, await captureQuoteOfferLayout(page), requestAfter.height - before.request.height);
      await assertQuoteSectionTitleStyles(page);
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
      await assertCustomerDetailsRows(page, 'order', 'Naziv', viewport.key === 'desktop');
      await assertSectionEditIcons(page, 4);
      await assertDetailColumns(page, 'order', viewport);
      await captureOrderItemSlots(page);
      await assertOrderItemsTerminalGutter(page);
      await expectPageScreenshot(page, `order-${viewport.key}-read.png`);
      await expectOrderItemsScreenshot(page, `order-items-${viewport.key}-read.png`);
      await expectOrderShippingScreenshot(page, `order-shipping-${viewport.key}-read.png`);
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
      const dataCardAfter = await box(dataCard);
      await assertCustomerDetailsRows(page, 'order', 'Naziv', viewport.key === 'desktop');
      expectCustomerCardTransition(before.dataCard, dataCardAfter, viewport);
      const afterSlots = await captureOrderItemSlots(page);
      expect(afterSlots).toHaveLength(before.itemSlots.length);
      before.itemSlots.forEach((slot, index) => {
        expect(afterSlots[index]?.key).toBe(slot.key);
        expectSameBox({ ...slot, y: slot.y + dataCardAfter.height - before.dataCard.height }, afterSlots[index]!);
      });
      await assertSectionEditIcons(page, 4);
      await assertDetailColumns(page, 'order', viewport);
      await assertOrderItemsTerminalGutter(page);
      await expectPageScreenshot(page, `order-${viewport.key}-edit.png`);
      await expectOrderItemsScreenshot(page, `order-items-${viewport.key}-edit.png`);
      await expectOrderShippingScreenshot(page, `order-shipping-${viewport.key}-edit.png`);
    });
  }

  for (const kind of ['quote', 'order'] as const) {
    test(`${kind} first data row copies the complete immutable public code`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 1280, height: 920 });
      await page.goto(kind === 'quote'
        ? `/admin/orders/quotes/${fixture.quoteRequestId}`
        : `/admin/orders/${fixture.orderId}`);
      const card = page.getByTestId(kind === 'quote' ? 'quote-request-details-card' : 'admin-order-data-card');
      const rowAttribute = kind === 'quote' ? 'data-quote-detail-row' : 'data-order-data-row';
      const numberRow = card.locator(`[${rowAttribute}]`).first();
      const code = (await numberRow.locator('dd').innerText()).match(/\b(?:N|PV)-(?:[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}-){3}[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}\b/u)?.[0];
      expect(code).toBeTruthy();
      expect(code?.startsWith(kind === 'quote' ? 'PV-' : 'N-')).toBe(true);
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(page.url()).origin });
      const copy = numberRow.getByTestId(`admin-${kind}-public-code-copy`);
      await assertCustomerDetailsRows(page, kind, kind === 'quote' ? 'Naročnik' : 'Naziv', true);
      await testInfo.attach(`${kind}-customer-desktop-read`, { body: await card.screenshot({ path: testInfo.outputPath(`${kind}-customer-desktop-read.png`) }), contentType: 'image/png' });
      await copy.click();
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(code);
      await card.locator('button[data-admin-card-edit-action]').click();
      await expect(numberRow.locator('input')).toHaveCount(0);
      await assertCustomerDetailsRows(page, kind, kind === 'quote' ? 'Naročnik' : 'Naziv', true);
      await testInfo.attach(`${kind}-customer-desktop-edit`, { body: await card.screenshot({ path: testInfo.outputPath(`${kind}-customer-desktop-edit.png`) }), contentType: 'image/png' });
      await copy.click();
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(code);
    });

    test(`${kind} keeps full customer names and distinct organization contacts when saving details`, async ({ page }, testInfo) => {
      testInfo.setTimeout(120_000);
      const id = kind === 'quote' ? fixture.quoteRequestId : fixture.orderId;
      const table = kind === 'quote' ? 'quote_requests' : 'orders';
      const endpoint = kind === 'quote' ? `/api/admin/quote-requests/${id}/details` : `/api/admin/orders/${id}/details`;
      for (const customerType of ['individual', 'company', 'school'] as const) {
        const organization = customerType === 'individual' ? 'Ana' : customerType === 'company' ? 'Podjetje Gaja d.o.o.' : 'Osnovna šola Gaja';
        const contact = 'Ana Novak';
        const label = customerType === 'individual' ? 'Naročnik' : 'Naziv';
        // These are this suite's synthetic, pre-issue fixtures only. A stale
        // first name in organization_name must never replace the full contact.
        await database.query(`update ${table} set customer_type = $2, organization_name = $3, contact_name = $4${kind === 'quote' ? ', state_version = state_version + 1' : ''} where id = $1`, [id, customerType, organization, contact]);
        const before = (await database.query<{ reference: string | null; created_at: Date }>(`select reference, created_at from ${table} where id = $1`, [id])).rows[0]!;
        await page.goto(kind === 'quote' ? `/admin/orders/quotes/${id}` : `/admin/orders/${id}`);
        const card = page.getByTestId(kind === 'quote' ? 'quote-request-details-card' : 'admin-order-data-card');
        const rowAttribute = kind === 'quote' ? 'data-quote-detail-row' : 'data-order-data-row';
        const customerRow = card.locator(`[${rowAttribute}="${label}"]`);
        await expect(customerRow.locator('dd')).toHaveText(customerType === 'individual' ? contact : `${organization} (${contact})`);
        await card.locator('button[data-admin-card-edit-action]').click();
        const nameInput = card.getByLabel(customerType === 'individual' ? 'Naročnik' : 'Kontaktna oseba', { exact: true });
        await expect(nameInput).toHaveValue(contact);
        if (customerType === 'individual') {
          await expect(card.getByLabel('Naziv', { exact: true })).toHaveCount(0);
          await expect(card.getByLabel('Kontaktna oseba', { exact: true })).toHaveCount(0);
        } else {
          await expect(card.getByLabel('Naziv', { exact: true })).toHaveValue(organization);
        }
        await expect(card.getByLabel('Referenca', { exact: true })).toHaveCount(0);
        await card.getByLabel('Sporočilo stranke', { exact: true }).fill(`Nepovezana opomba ${kind} ${customerType}`);
        const savedResponse = page.waitForResponse((response) => response.url().endsWith(endpoint) && response.request().method() === (kind === 'quote' ? 'PUT' : 'POST'));
        await page.getByRole('button', { name: 'Shrani', exact: true }).click();
        const saved = await savedResponse;
        await requireOk(saved, `save ${kind} ${customerType} unrelated note`);
        expect(saved.request().postDataJSON().contactName).toBe(contact);
        const persisted = (await database.query<{ contact_name: string; organization_name: string | null; reference: string | null; created_at: Date }>(`select contact_name, organization_name, reference, created_at from ${table} where id = $1`, [id])).rows[0]!;
        expect(persisted.contact_name).toBe(contact);
        if (customerType !== 'individual') expect(persisted.organization_name).toBe(organization);
        expect(persisted.reference).toBe(before.reference);
        if (kind === 'quote') expect(persisted.created_at.toISOString()).toBe(before.created_at.toISOString());
        await page.reload();
        await expect(customerRow.locator('dd')).toHaveText(customerType === 'individual' ? contact : `${organization} (${contact})`);
        await card.locator('button[data-admin-card-edit-action]').click();
        const editedName = 'Ana Novak Kovač';
        await nameInput.fill('Ana');
        await nameInput.pressSequentially(' Novak Kovač');
        await expect(nameInput).toHaveValue(editedName);
        const renamedResponse = page.waitForResponse((response) => response.url().endsWith(endpoint) && response.request().method() === (kind === 'quote' ? 'PUT' : 'POST'));
        await page.getByRole('button', { name: 'Shrani', exact: true }).click();
        await requireOk(await renamedResponse, `edit ${kind} ${customerType} contact`);
        await page.reload();
        await expect(customerRow.locator('dd')).toHaveText(customerType === 'individual' ? editedName : `${organization} (${editedName})`);
        const search = new URLSearchParams({ q: editedName });
        if (kind === 'quote') search.set('view', 'quotes');
        await page.goto(`/admin/orders?${search.toString()}`);
        const tableName = page.getByTestId(`${kind}-table-customer-name-${id}`);
        const tableContact = page.getByTestId(`${kind}-table-contact-${id}`);
        await expect(tableName).toBeVisible();
        await expect(tableName).toHaveText(customerType === 'individual' ? editedName : organization);
        if (customerType === 'individual') {
          await expect(tableContact).toHaveCount(0);
        } else {
          await expect(tableContact).toBeVisible();
          await expect(tableContact).toHaveText(editedName);
          const [nameFontSize, contactFontSize] = await Promise.all([
            tableName.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
            tableContact.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
          ]);
          expect(contactFontSize).toBeLessThan(nameFontSize);
        }
      }
    });
  }
});
