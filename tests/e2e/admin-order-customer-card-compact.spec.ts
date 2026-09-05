import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import pg, { type Pool as PgPool } from 'pg';
import { assertAuthenticatedAdmin } from './support/auth';

const { Pool } = pg;

let database: PgPool;

test.beforeAll(() => {
  const databaseUrl = process.env.E2E_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('[e2e-preflight] E2E_DATABASE_URL is required.');
  }
  database = new Pool({ connectionString: databaseUrl, ssl: false });
});

test.afterAll(async () => {
  if (!database) return;
  await (database as PgPool & { end: () => Promise<void> }).end();
});

test.beforeEach(async ({ request }) => {
  await assertAuthenticatedAdmin(request);
});

test('customer actions sit beside the order data title and preserve behavior', async ({
  page,
  request
}) => {
  const token = randomUUID();
  const organizationName = `E2E kompaktna stranka ${token.slice(0, 8)}`;
  const email = `compact-customer-${token}@example.test`;
  let orderId: number | null = null;

  try {
    const createResponse = await request.post('/api/admin/orders');
    expect(createResponse.status()).toBe(200);
    const created = await createResponse.json() as { orderId?: unknown };
    orderId = Number(created.orderId);
    expect(Number.isSafeInteger(orderId) && orderId > 0).toBe(true);

    await database.query(
      `
        update orders
        set customer_type = 'company',
            organization_name = $2,
            contact_name = 'Ana Novak',
            email = $3,
            address_line1 = 'Testna ulica 1',
            address_line2 = '2. nadstropje',
            postal_code = '1000',
            city = 'Ljubljana',
            country_code = 'SI',
            notes = 'E2E opombe stranke'
        where id = $1
      `,
      [orderId, organizationName, email]
    );

    await page.goto(`/admin/orders/${orderId}`);
    await page.waitForLoadState('networkidle');
    const orderDataCard = page.getByTestId('admin-order-data-card');
    const orderDataRows = orderDataCard.locator('[data-order-data-row]');
    const addressRow = orderDataCard.locator('[data-order-data-row="Naslov"]');
    const notesRow = orderDataCard.locator('[data-order-data-row="Sporočilo stranke"]');
    const compactRow = orderDataCard.locator('[data-order-data-row="Datum"]');
    const orderDataEditAction = orderDataCard.getByRole('button', {
      name: 'Uredi podatke naročila'
    });

    await expect(orderDataCard).toBeVisible();
    await expect(orderDataRows).toHaveCount(7);
    await expect(orderDataCard.locator('input, select, textarea')).toHaveCount(0);
    await expect(addressRow).toContainText(
      'Testna ulica 1, 2. nadstropje, 1000 Ljubljana, SI'
    );
    await expect(notesRow).toContainText('E2E opombe stranke');

    const readCardBox = await orderDataCard.boundingBox();
    const readRowBoxes = await orderDataRows.evaluateAll((rows) =>
      rows.map((row) => {
        const rect = row.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        };
      })
    );
    const [addressRowBox, notesRowBox, compactRowBox] = await Promise.all([
      addressRow.boundingBox(),
      notesRow.boundingBox(),
      compactRow.boundingBox()
    ]);
    expect(readCardBox).not.toBeNull();
    expect(addressRowBox).not.toBeNull();
    expect(notesRowBox).not.toBeNull();
    expect(compactRowBox).not.toBeNull();
    for (const rowBox of readRowBoxes) {
      expect(rowBox.height).toBeGreaterThanOrEqual(35);
    }
    if (addressRowBox && notesRowBox && compactRowBox) {
      expect(Math.abs(addressRowBox.width - compactRowBox.width)).toBeLessThanOrEqual(1);
      expect(notesRowBox.width).toBeGreaterThan(compactRowBox.width * 1.9);
    }

    const detailMutationRequests: string[] = [];
    page.on('request', (outboundRequest) => {
      if (
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(outboundRequest.method()) &&
        outboundRequest.url().includes('/api/admin/orders/' + orderId)
      ) {
        detailMutationRequests.push(outboundRequest.method() + ' ' + outboundRequest.url());
      }
    });

    await orderDataEditAction.click();
    const addressEditor = orderDataCard.getByTestId('admin-order-address-fields');
    await expect(addressEditor).toBeVisible();
    await expect(addressEditor.getByLabel('Naslov', { exact: true })).toHaveValue(
      'Testna ulica 1'
    );
    await expect(
      addressEditor.getByLabel('Dodatni naslov', { exact: true })
    ).toHaveValue('2. nadstropje');
    await expect(
      addressEditor.getByLabel('Poštna številka', { exact: true })
    ).toHaveValue('1000');
    await expect(addressEditor.getByLabel('Kraj', { exact: true })).toHaveValue(
      'Ljubljana'
    );
    await expect(addressEditor.getByLabel('Država', { exact: true })).toHaveValue(
      'SI'
    );

    const editCardBox = await orderDataCard.boundingBox();
    const editRowBoxes = await orderDataRows.evaluateAll((rows) =>
      rows.map((row) => {
        const rect = row.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        };
      })
    );
    expect(editCardBox).not.toBeNull();
    expect(editRowBoxes).toHaveLength(readRowBoxes.length);
    if (readCardBox && editCardBox) {
      for (const key of ['x', 'y', 'width'] as const) {
        expect(Math.abs(readCardBox[key] - editCardBox[key])).toBeLessThanOrEqual(1);
      }
      expect(editCardBox.height).toBeGreaterThanOrEqual(readCardBox.height);
    }
    for (let index = 0; index < readRowBoxes.length; index += 1) {
      for (const key of ['x', 'width'] as const) {
        expect(
          Math.abs(readRowBoxes[index][key] - editRowBoxes[index][key])
        ).toBeLessThanOrEqual(1);
      }
      expect(editRowBoxes[index].height).toBeGreaterThanOrEqual(35);
      expect(editRowBoxes[index].y).toBeGreaterThanOrEqual(readRowBoxes[index].y);
    }

    await orderDataEditAction.click();
    await expect(addressEditor).toHaveCount(0);
    await expect(orderDataCard.locator('input, select, textarea')).toHaveCount(0);
    expect(detailMutationRequests).toEqual([]);

    const orderDataTitle = orderDataCard.getByRole('heading', {
      name: 'Podatki naročila',
      exact: true
    });
    const customerActions = orderDataCard.getByTestId('admin-order-customer-actions');
    const openButton = customerActions.getByTestId('admin-order-customer-open');
    const copyButton = customerActions.getByTestId('admin-order-customer-copy');
    await expect(orderDataTitle).toBeVisible();
    await expect(customerActions).toBeVisible();
    await expect(customerActions.getByRole('button')).toHaveCount(2);
    await expect(
      page.getByRole('heading', { name: 'Naročnik in dostava', exact: true })
    ).toHaveCount(0);
    expect(
      await customerActions.evaluate(
        (element) => element.previousElementSibling?.textContent?.trim()
      )
    ).toBe('Podatki naročila');
    await expect(openButton).toHaveAttribute('aria-label', 'Odpri stranko');
    await expect(openButton).toHaveAttribute('title', 'Odpri stranko');
    await expect(openButton).toHaveText('');
    await expect(copyButton).toHaveAttribute('aria-label', 'Kopiraj podatke');
    await expect(copyButton).toHaveAttribute('title', 'Kopiraj podatke');
    await expect(copyButton).toHaveText('');
    await expect(customerActions.getByText('Kopiraj podatke', { exact: true })).toHaveCount(0);

    const [orderDataTitleBox, customerActionsBox, openButtonBox, copyButtonBox] = await Promise.all([
      orderDataTitle.boundingBox(),
      customerActions.boundingBox(),
      openButton.boundingBox(),
      copyButton.boundingBox()
    ]);
    expect(orderDataTitleBox).not.toBeNull();
    expect(customerActionsBox).not.toBeNull();
    expect(openButtonBox).not.toBeNull();
    expect(copyButtonBox).not.toBeNull();
    if (orderDataTitleBox && customerActionsBox && openButtonBox && copyButtonBox) {
      const titleCenter = orderDataTitleBox.y + orderDataTitleBox.height / 2;
      const actionsCenter = customerActionsBox.y + customerActionsBox.height / 2;
      expect(Math.abs(actionsCenter - titleCenter)).toBeLessThan(2);
      expect(customerActionsBox.x).toBeGreaterThan(
        orderDataTitleBox.x + orderDataTitleBox.width
      );
      expect(Math.abs(openButtonBox.y + openButtonBox.height / 2 - actionsCenter)).toBeLessThan(2);
      expect(Math.abs(copyButtonBox.y + copyButtonBox.height / 2 - actionsCenter)).toBeLessThan(2);
      expect(openButtonBox.width).toBe(copyButtonBox.width);
      expect(openButtonBox.height).toBe(copyButtonBox.height);
      expect(copyButtonBox.x).toBeGreaterThan(openButtonBox.x);
    }

    const [openIconBox, copyIconBox] = await Promise.all([
      openButton.locator('svg').boundingBox(),
      copyButton.locator('svg').boundingBox()
    ]);
    expect(openIconBox).not.toBeNull();
    expect(copyIconBox).not.toBeNull();
    if (openIconBox && copyIconBox) {
      expect(openIconBox.width).toBe(copyIconBox.width);
      expect(openIconBox.height).toBe(copyIconBox.height);
    }

    await page.context().grantPermissions(
      ['clipboard-read', 'clipboard-write'],
      { origin: new URL(page.url()).origin }
    );
    await copyButton.click();
    await expect(page.getByText('Podatki stranke so kopirani.')).toBeVisible();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain(
      organizationName
    );

    await openButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();
  } finally {
    if (orderId !== null) {
      await database.query(
        `delete from audit_events where entity_type = 'order' and entity_id = $1`,
        [String(orderId)]
      );
      await database.query('delete from orders where id = $1', [orderId]);
    }
  }
});
