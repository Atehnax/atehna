import { randomUUID } from 'node:crypto';
import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
  type Page
} from '@playwright/test';
import pg, { type Pool as PgPool } from 'pg';
import { assertAuthenticatedAdmin } from './support/auth';

const { Pool } = pg;

const CATALOG_LINES = [
  {
    catalogItemId: 910001,
    catalogVariantId: 920001,
    sku: 'MAT-KOV-ALU-100',
    name: 'E2E aluminijasta plošča za trenutno pošiljko',
    unit: 'kos',
    quantity: 1,
    unitPrice: 4.9,
    discountPercentage: 0
  },
  {
    catalogItemId: 910002,
    catalogVariantId: 920011,
    sku: 'MAT-KOV-BAK-100',
    name: 'E2E bakrena plošča za poznejšo dobavo',
    unit: 'kos',
    quantity: 1,
    unitPrice: 6.4,
    discountPercentage: 0
  }
] as const;

const PARTIAL_PLAN_REQUIRED_MESSAGE =
  'Za status »Delno poslano« mora biti vsaj ena postavka v tej pošiljki in vsaj ena postavka označena za poznejšo dobavo.';
const PARTIAL_OPTION_EXPLANATION =
  'Najprej premaknite vsaj eno postavko v razdelek »Pošljemo pozneje«.';
const FOREIGN_ITEM_MESSAGE =
  'Ena ali več izbranih postavk ne pripada temu naročilu. Osvežite stran in poskusite znova.';
const STALE_DELIVERY_PLAN_MESSAGE =
  'Načrt dobave je medtem spremenil drug uporabnik. Osvežite stran in poskusite znova.';

type CreatedOrder = {
  orderId: number;
  itemIds: number[];
  itemNames: string[];
  deliveryPlanRevision: number;
};

let database: PgPool;

async function requireOk(response: APIResponse, label: string) {
  if (response.ok()) return;
  throw new Error(`${label} failed with ${response.status()}: ${await response.text()}`);
}

async function createOrderWithItems(
  request: APIRequestContext,
  lines: ReadonlyArray<(typeof CATALOG_LINES)[number]>
): Promise<CreatedOrder> {
  const createResponse = await request.post('/api/admin/orders');
  await requireOk(createResponse, 'create admin order');
  const created = await createResponse.json() as { orderId?: unknown };
  const orderId = Number(created.orderId);
  if (!Number.isSafeInteger(orderId) || orderId < 1) {
    throw new Error('Created admin order has an invalid id.');
  }

  const itemsResponse = await request.post(`/api/admin/orders/${orderId}/items`, {
    data: { items: lines }
  });
  await requireOk(itemsResponse, 'save order items');
  const itemsPayload = await itemsResponse.json() as {
    items?: Array<{ id?: unknown; name?: unknown }>;
    deliveryPlanRevision?: unknown;
  };
  const itemIds = (itemsPayload.items ?? []).map((item) => Number(item.id));
  const itemNames = (itemsPayload.items ?? []).map((item) => String(item.name ?? ''));
  const deliveryPlanRevision = Number(itemsPayload.deliveryPlanRevision);
  if (
    itemIds.length !== lines.length
    || itemIds.some((itemId) => !Number.isSafeInteger(itemId) || itemId < 1)
    || itemNames.some((name) => !name)
    || new Set(itemNames).size !== lines.length
    || !Number.isSafeInteger(deliveryPlanRevision)
    || deliveryPlanRevision < 1
  ) {
    throw new Error('Order items response did not return every distinct persisted item.');
  }

  return { orderId, itemIds, itemNames, deliveryPlanRevision };
}

async function finalizeAndAcceptOrder(
  request: APIRequestContext,
  orderId: number
) {
  const shippingResponse = await request.post(`/api/admin/orders/${orderId}/shipping`, {
    data: {
      action: 'override',
      amountCents: 300,
      reason: 'E2E potrjena poštnina za delno dobavo.'
    }
  });
  await requireOk(shippingResponse, 'set order shipping');

  const token = randomUUID();
  const detailsResponse = await request.post(`/api/admin/orders/${orderId}/details`, {
    data: {
      orderNumber: `#${orderId}`,
      customerType: 'company',
      organizationName: `E2E delna dobava ${token.slice(0, 8)} d.o.o.`,
      contactName: 'Ana Novak',
      email: `partial-delivery-${token}@example.test`,
      addressLine1: 'Testna ulica 1',
      addressLine2: '',
      postalCode: '1000',
      city: 'Ljubljana',
      countryCode: 'SI',
      reference: `DELNA-${orderId}`,
      notes: 'E2E preverjanje razdeljene dobave.'
    }
  });
  await requireOk(detailsResponse, 'finalize order details');

  const acceptResponse = await request.post(
    `/api/admin/orders/${orderId}/contract-status`,
    { data: { contractStatus: 'accepted' } }
  );
  await requireOk(acceptResponse, 'accept direct order');
}

async function openStatusMenu(page: Page) {
  const statusTrigger = page
    .getByTestId('admin-order-header-statuses')
    .getByRole('button')
    .first();
  await statusTrigger.click();
  return statusTrigger;
}

async function cleanupOrders(
  request: APIRequestContext,
  orderIds: number[]
) {
  if (orderIds.length === 0) return;
  const hardDeleteOrderIds: number[] = [];

  for (const orderId of orderIds) {
    const stock = await database.query<{
      held_count: number;
      total_count: number;
    }>(
      `select count(*) filter (where state = 'held')::int as held_count,
              count(*)::int as total_count
       from order_stock_holds
       where order_id = $1`,
      [orderId]
    );
    if (stock.rows[0]?.held_count) {
      const cancelResponse = await request.post(`/api/admin/orders/${orderId}/status`, {
        data: { status: 'cancelled' }
      });
      await requireOk(cancelResponse, `release stock for order ${orderId}`);
    }

    if (stock.rows[0]?.total_count) {
      const remainingHeldStock = await database.query<{ held_count: number }>(
        `select count(*) filter (where state = 'held')::int as held_count
         from order_stock_holds
         where order_id = $1`,
        [orderId]
      );
      if (remainingHeldStock.rows[0]?.held_count) {
        throw new Error('E2E cleanup refused to archive an order with held stock.');
      }
      const archiveResponse = await request.delete(`/api/admin/orders/${orderId}`);
      await requireOk(archiveResponse, `archive order ${orderId}`);
    } else {
      hardDeleteOrderIds.push(orderId);
    }
  }

  if (hardDeleteOrderIds.length === 0) return;
  const entityIds = hardDeleteOrderIds.map(String);
  await database.query(
    `delete from audit_events
     where entity_type = 'order'
       and entity_id = any($1::text[])`,
    [entityIds]
  );
  await database.query(
    'delete from orders where id = any($1::bigint[])',
    [hardDeleteOrderIds]
  );
}
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

test('requires and atomically persists a two-section plan for partial delivery', async ({
  page,
  request
}) => {
  test.setTimeout(60_000);
  const ownedOrderIds: number[] = [];
  const staleDocumentIds: number[] = [];

  try {
    const order = await createOrderWithItems(request, CATALOG_LINES);
    ownedOrderIds.push(order.orderId);
    await finalizeAndAcceptOrder(request, order.orderId);
    const [currentItemName, laterItemName] = order.itemNames;

    const foreignOrder = await createOrderWithItems(request, [CATALOG_LINES[0]]);
    ownedOrderIds.push(foreignOrder.orderId);

    const missingPlanResponse = await request.post(
      `/api/admin/orders/${order.orderId}/status`,
      {
        data: {
          status: 'partially_sent',
          shipLaterItemIds: [],
          expectedDeliveryPlanRevision: order.deliveryPlanRevision
        }
      }
    );
    expect(missingPlanResponse.status()).toBe(409);
    expect(await missingPlanResponse.json()).toEqual({
      code: 'PARTIAL_DELIVERY_PLAN_REQUIRED',
      message: PARTIAL_PLAN_REQUIRED_MESSAGE
    });

    const foreignItemResponse = await request.post(
      `/api/admin/orders/${order.orderId}/delivery-plan`,
      {
        data: {
          shipLaterItemIds: [foreignOrder.itemIds[0]],
          expectedDeliveryPlanRevision: order.deliveryPlanRevision
        }
      }
    );
    expect(foreignItemResponse.status()).toBe(409);
    expect(await foreignItemResponse.json()).toEqual({
      code: 'ORDER_DELIVERY_PLAN_ITEM_MISMATCH',
      message: FOREIGN_ITEM_MESSAGE
    });

    const membershipChangeResponse = await request.post(
      `/api/admin/orders/${foreignOrder.orderId}/items`,
      { data: { items: CATALOG_LINES } }
    );
    await requireOk(membershipChangeResponse, 'change foreign order item membership');
    const membershipChangePayload = await membershipChangeResponse.json() as {
      deliveryPlanRevision?: unknown;
    };
    expect(Number(membershipChangePayload.deliveryPlanRevision)).toBe(
      foreignOrder.deliveryPlanRevision + 1
    );
    const staleAfterMembershipChangeResponse = await request.post(
      `/api/admin/orders/${foreignOrder.orderId}/delivery-plan`,
      {
        data: {
          shipLaterItemIds: [],
          expectedDeliveryPlanRevision: foreignOrder.deliveryPlanRevision
        }
      }
    );
    expect(staleAfterMembershipChangeResponse.status()).toBe(409);
    expect(await staleAfterMembershipChangeResponse.json()).toEqual({
      code: 'ORDER_DELIVERY_PLAN_STALE',
      message: STALE_DELIVERY_PLAN_MESSAGE
    });

    await page.goto(`/admin/orders/${order.orderId}`);
    await expect(page.getByTestId('admin-order-detail-header')).toBeVisible();

    const currentGroup = page.getByTestId('admin-order-items-current-group');
    const laterGroup = page.getByTestId('admin-order-items-later-group');
    await expect(currentGroup).toBeVisible();
    await expect(laterGroup).toBeVisible();
    await expect(currentGroup).toContainText('V tej pošiljki');
    await expect(currentGroup).toContainText(currentItemName);
    await expect(currentGroup).toContainText(laterItemName);
    await expect(laterGroup).toContainText(
      'Izberite postavke zgoraj in jih premaknite v poznejšo dobavo.'
    );

    await page.getByRole('button', { name: 'Uredi celotno naročilo' }).click();
    await openStatusMenu(page);
    const blockedPartialOption = page.getByRole('menuitem', {
      name: /^Delno poslano/u
    });
    await expect(blockedPartialOption).toHaveAttribute('aria-disabled', 'true');
    await expect(blockedPartialOption).toContainText(PARTIAL_OPTION_EXPLANATION);
    await page.keyboard.press('Escape');

    await currentGroup
      .getByRole('checkbox', { name: `Izberi postavko ${laterItemName}` })
      .click();
    const transferButton = page.getByTestId('admin-order-items-transfer');
    await expect(transferButton).toHaveAttribute(
      'aria-label',
      'Premakni izbrane v poznejšo dobavo'
    );
    await transferButton.click();
    await expect(currentGroup).not.toContainText(laterItemName);
    await expect(laterGroup).toContainText(laterItemName);

    await openStatusMenu(page);
    const partialOption = page.getByRole('menuitem', {
      name: /^Delno poslano/u
    });
    await expect(partialOption).not.toHaveAttribute('aria-disabled', 'true');
    await partialOption.click();

    const firstSaveMutations: string[] = [];
    page.on('request', (outboundRequest) => {
      if (outboundRequest.method() !== 'POST') return;
      const pathname = new URL(outboundRequest.url()).pathname;
      if (
        pathname === `/api/admin/orders/${order.orderId}/status`
        || pathname === `/api/admin/orders/${order.orderId}/delivery-plan`
      ) {
        firstSaveMutations.push(pathname);
      }
    });
    const partialStatusResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === `/api/admin/orders/${order.orderId}/status`
    );
    await page.getByRole('button', { name: 'Shrani', exact: true }).click();
    const partialStatusResponse = await partialStatusResponsePromise;
    expect(partialStatusResponse.status()).toBe(200);
    expect(partialStatusResponse.request().postDataJSON()).toEqual({
      status: 'partially_sent',
      shipLaterItemIds: [order.itemIds[1]],
      expectedDeliveryPlanRevision: order.deliveryPlanRevision
    });
    const partialStatusPayload = await partialStatusResponse.json() as {
      deliveryPlanRevision?: unknown;
    };
    const partialDeliveryPlanRevision = Number(
      partialStatusPayload.deliveryPlanRevision
    );
    expect(partialDeliveryPlanRevision).toBe(order.deliveryPlanRevision + 1);
    await expect(page.getByText('Naročilo je shranjeno.', { exact: true })).toBeVisible();
    expect(firstSaveMutations).toEqual([
      `/api/admin/orders/${order.orderId}/status`
    ]);

    const noOpPlanResponse = await request.post(
      `/api/admin/orders/${order.orderId}/delivery-plan`,
      {
        data: {
          shipLaterItemIds: [order.itemIds[1]],
          expectedDeliveryPlanRevision: partialDeliveryPlanRevision
        }
      }
    );
    await requireOk(noOpPlanResponse, 'save unchanged delivery plan');
    expect(await noOpPlanResponse.json()).toMatchObject({
      changed: false,
      shipLaterItemIds: [order.itemIds[1]],
      deliveryPlanRevision: partialDeliveryPlanRevision
    });

    const stalePlanResponse = await request.post(
      `/api/admin/orders/${order.orderId}/delivery-plan`,
      {
        data: {
          shipLaterItemIds: [],
          expectedDeliveryPlanRevision: order.deliveryPlanRevision
        }
      }
    );
    expect(stalePlanResponse.status()).toBe(409);
    expect(await stalePlanResponse.json()).toEqual({
      code: 'ORDER_DELIVERY_PLAN_STALE',
      message: STALE_DELIVERY_PLAN_MESSAGE
    });

    const partialState = await database.query<{
      status: string;
      id: string | number;
      ship_later: boolean;
    }>(
      `select orders.status, order_items.id, order_items.ship_later
       from orders
       join order_items on order_items.order_id = orders.id
       where orders.id = $1
       order by order_items.id`,
      [order.orderId]
    );
    expect(partialState.rows.map((row) => ({
      status: row.status,
      id: Number(row.id),
      shipLater: row.ship_later
    }))).toEqual([
      { status: 'partially_sent', id: order.itemIds[0], shipLater: false },
      { status: 'partially_sent', id: order.itemIds[1], shipLater: true }
    ]);

    const staleDocumentAccessId = randomUUID();
    const staleDocumentFilename = `stale-dobavnica-${order.orderId}.pdf`;
    const staleDocument = await database.query<{
      id: string | number;
      customer_access_id: string;
    }>(
      `insert into order_documents (
         order_id,
         customer_access_id,
         type,
         filename,
         blob_pathname,
         version_number,
         order_pricing_revision,
         order_delivery_plan_revision,
         document_number,
         issued_at,
         content_sha256,
         legal_status,
         format_marker
       )
       values (
         $1,
         $2,
         'dobavnica',
         $3,
         $4,
         1,
         (select pricing_revision from orders where id = $1),
         $5,
         $6,
         now(),
         $7,
         'operational',
         'atehna-template-pdf-v3'
       )
       returning id, customer_access_id`,
      [
        order.orderId,
        staleDocumentAccessId,
        staleDocumentFilename,
        `e2e/stale-dobavnica-${order.orderId}.pdf`,
        order.deliveryPlanRevision,
        `DOB-E2E-${order.orderId}`,
        '0'.repeat(64)
      ]
    );
    const staleDocumentId = Number(staleDocument.rows[0]?.id);
    staleDocumentIds.push(staleDocumentId);
    expect(
      (await request.get(
        `/api/admin/orders/${order.orderId}/documents/${staleDocumentId}`
      )).status()
    ).toBe(404);
    expect(
      (await request.get(
        `/api/orders/documents/${staleDocument.rows[0]?.customer_access_id}`
      )).status()
    ).toBe(404);

    await page.reload();
    await expect(page.getByText(staleDocumentFilename, { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('admin-order-detail-header')).toContainText('Delno poslano');
    await expect(page.getByTestId('admin-order-items-current-group')).toContainText(
      currentItemName
    );
    await expect(page.getByTestId('admin-order-items-later-group')).toContainText(
      laterItemName
    );

    await page.getByRole('button', { name: 'Uredi celotno naročilo' }).click();
    await page
      .getByTestId('admin-order-items-later-group')
      .getByRole('checkbox', { name: `Izberi postavko ${laterItemName}` })
      .click();
    await expect(transferButton).toHaveAttribute(
      'aria-label',
      'Premakni izbrane v trenutno pošiljko'
    );
    await transferButton.click();

    await openStatusMenu(page);
    const sentOption = page.getByRole('menuitem', { name: /^Poslano/u });
    await expect(sentOption).not.toHaveAttribute('aria-disabled', 'true');
    await sentOption.click();

    const finalSaveMutations: string[] = [];
    page.on('request', (outboundRequest) => {
      if (outboundRequest.method() !== 'POST') return;
      const pathname = new URL(outboundRequest.url()).pathname;
      if (
        pathname === `/api/admin/orders/${order.orderId}/status`
        || pathname === `/api/admin/orders/${order.orderId}/delivery-plan`
      ) {
        finalSaveMutations.push(pathname);
      }
    });
    const sentStatusResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === `/api/admin/orders/${order.orderId}/status`
    );
    await page.getByRole('button', { name: 'Shrani', exact: true }).click();
    const sentStatusResponse = await sentStatusResponsePromise;
    expect(sentStatusResponse.status()).toBe(200);
    expect(sentStatusResponse.request().postDataJSON()).toEqual({
      status: 'sent',
      shipLaterItemIds: [],
      expectedDeliveryPlanRevision: partialDeliveryPlanRevision
    });
    const sentStatusPayload = await sentStatusResponse.json() as {
      deliveryPlanRevision?: unknown;
    };
    expect(Number(sentStatusPayload.deliveryPlanRevision)).toBe(
      partialDeliveryPlanRevision + 1
    );
    await expect(page.getByText('Naročilo je shranjeno.', { exact: true })).toBeVisible();
    expect(finalSaveMutations).toEqual([
      `/api/admin/orders/${order.orderId}/status`
    ]);

    const finalState = await database.query<{
      status: string;
      deferred_count: number;
    }>(
      `select orders.status,
              count(*) filter (where order_items.ship_later)::int as deferred_count
       from orders
       join order_items on order_items.order_id = orders.id
       where orders.id = $1
       group by orders.status`,
      [order.orderId]
    );
    expect(finalState.rows[0]).toMatchObject({
      status: 'sent',
      deferred_count: 0
    });

    await page.reload();
    await expect(page.getByTestId('admin-order-detail-header')).toContainText('Poslano');
    await expect(page.getByTestId('admin-order-items-current-group')).toContainText(
      currentItemName
    );
    await expect(page.getByTestId('admin-order-items-current-group')).toContainText(
      laterItemName
    );
    await expect(page.getByTestId('admin-order-items-later-group')).not.toContainText(
      laterItemName
    );
  } finally {
    if (staleDocumentIds.length > 0) {
      await database.query(
        'delete from order_documents where id = any($1::bigint[])',
        [staleDocumentIds]
      );
    }
    await cleanupOrders(request, ownedOrderIds);
  }
});

test('manual draft persists its delivery plan before implicit seller acceptance', async ({
  page,
  request
}) => {
  test.setTimeout(90_000);
  const ownedOrderIds: number[] = [];

  try {
    const order = await createOrderWithItems(request, CATALOG_LINES);
    ownedOrderIds.push(order.orderId);
    const laterItemName = order.itemNames[1];
    const detailsPath = `/api/admin/orders/${order.orderId}/details`;
    const planPath = `/api/admin/orders/${order.orderId}/delivery-plan`;
    const statusPath = `/api/admin/orders/${order.orderId}/status`;
    const saveMutations: string[] = [];

    page.on('request', (outboundRequest) => {
      if (outboundRequest.method() !== 'POST') return;
      const pathname = new URL(outboundRequest.url()).pathname;
      if ([detailsPath, planPath, statusPath].includes(pathname)) {
        saveMutations.push(pathname);
      }
    });

    await page.goto(`/admin/orders/${order.orderId}`);
    await expect(page.getByTestId('admin-order-detail-header')).toBeVisible();
    await page.getByRole('button', { name: 'Uredi celotno naročilo' }).click();

    const customerType = page.getByRole('button', { name: 'Tip naročnika' });
    await expect(customerType).toBeEnabled();
    await customerType.click();
    const schoolOption = page.getByText('Šola / javni zavod', {
      exact: true
    });
    await expect(schoolOption).toBeVisible();
    const schoolOptionControl = schoolOption.locator(
      'xpath=ancestor-or-self::*[@role="menuitem" or self::button][1]'
    );
    await expect(schoolOptionControl).not.toHaveAttribute('aria-disabled', 'true');
    await expect(schoolOptionControl).toBeEnabled();
    await page.keyboard.press('Escape');

    const currentGroup = page.getByTestId('admin-order-items-current-group');
    const laterGroup = page.getByTestId('admin-order-items-later-group');
    await currentGroup
      .getByRole('checkbox', { name: `Izberi postavko ${laterItemName}` })
      .click();
    const transferButton = page.getByTestId('admin-order-items-transfer');
    await expect(transferButton).toBeEnabled();
    await transferButton.click();
    await expect(currentGroup).not.toContainText(laterItemName);
    await expect(laterGroup).toContainText(laterItemName);

    const planResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === planPath
    );
    await page.getByRole('button', { name: 'Shrani', exact: true }).click();
    const planResponse = await planResponsePromise;
    expect(planResponse.status()).toBe(200);
    expect(planResponse.request().postDataJSON()).toEqual({
      shipLaterItemIds: [order.itemIds[1]],
      expectedDeliveryPlanRevision: order.deliveryPlanRevision
    });
    const planPayload = await planResponse.json() as {
      deliveryPlanRevision?: unknown;
    };
    const savedPlanRevision = Number(planPayload.deliveryPlanRevision);
    expect(savedPlanRevision).toBe(order.deliveryPlanRevision + 1);
    expect(saveMutations).toEqual([planPath]);
    expect(saveMutations).not.toContain(detailsPath);

    const draftPlanState = await database.query<{
      is_draft: boolean;
      status: string;
      contract_status: string;
      deferred_count: number;
    }>(
      `select orders.is_draft,
              orders.status,
              orders.contract_status,
              count(*) filter (where order_items.ship_later)::int as deferred_count
       from orders
       join order_items on order_items.order_id = orders.id
       where orders.id = $1
       group by orders.id`,
      [order.orderId]
    );
    expect(draftPlanState.rows[0]).toMatchObject({
      is_draft: true,
      status: 'received',
      contract_status: 'pending_seller_acceptance',
      deferred_count: 1
    });

    saveMutations.length = 0;
    await page.getByRole('button', { name: 'Uredi celotno naročilo' }).click();
    await openStatusMenu(page);
    const inProgressOption = page.getByRole('menuitem', {
      name: /^V obdelavi/u
    });
    await expect(inProgressOption).not.toHaveAttribute('aria-disabled', 'true');
    await inProgressOption.click();

    const statusResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === statusPath
    );
    await page.getByRole('button', { name: 'Shrani', exact: true }).click();
    const statusResponse = await statusResponsePromise;
    expect(statusResponse.status()).toBe(200);
    expect(statusResponse.request().postDataJSON()).toEqual({
      status: 'in_progress',
      shipLaterItemIds: [order.itemIds[1]],
      expectedDeliveryPlanRevision: savedPlanRevision
    });
    expect(await statusResponse.json()).toMatchObject({
      status: 'in_progress',
      contractStatus: 'accepted',
      notificationSuppressed: true,
      shipLaterItemIds: [order.itemIds[1]],
      deliveryPlanRevision: savedPlanRevision
    });
    expect(saveMutations).toEqual([statusPath]);
    expect(saveMutations).not.toContain(detailsPath);

    const acceptedDraft = await database.query<{
      is_draft: boolean;
      status: string;
      contract_status: string;
      contract_accepted_at: Date | null;
      contract_accepted_actor_type: string | null;
      contract_accepted_actor_id: string | null;
      contract_acceptance_evidence_json: Record<string, unknown> | null;
      committed_at: Date | null;
      delivery_plan_revision: number;
      deferred_count: number;
    }>(
      `select orders.is_draft,
              orders.status,
              orders.contract_status,
              orders.contract_accepted_at,
              orders.contract_accepted_actor_type,
              orders.contract_accepted_actor_id,
              orders.contract_acceptance_evidence_json,
              orders.committed_at,
              orders.delivery_plan_revision,
              count(*) filter (where order_items.ship_later)::int as deferred_count
       from orders
       join order_items on order_items.order_id = orders.id
       where orders.id = $1
       group by orders.id`,
      [order.orderId]
    );
    const accepted = acceptedDraft.rows[0];
    expect(accepted).toMatchObject({
      is_draft: true,
      status: 'in_progress',
      contract_status: 'accepted',
      contract_accepted_actor_type: 'admin',
      contract_accepted_actor_id: null,
      delivery_plan_revision: savedPlanRevision,
      deferred_count: 1
    });
    expect(accepted.contract_accepted_at).not.toBeNull();
    expect(accepted.committed_at).not.toBeNull();
    expect(accepted.contract_acceptance_evidence_json).toMatchObject({
      channel: 'admin',
      action: 'accept_direct_order',
      trigger: 'status_transition',
      previousStatus: 'received',
      nextStatus: 'in_progress',
      draftAtAcceptance: true
    });

    const statusEmailJobs = await database.query<{ queued_count: number }>(
      `select count(*)::int as queued_count
       from order_email_jobs
       where order_id = $1
         and (event_key like 'order-status:%' or event_type = 'in_progress')`,
      [order.orderId]
    );
    expect(statusEmailJobs.rows[0]?.queued_count).toBe(0);
  } finally {
    await cleanupOrders(request, ownedOrderIds);
  }
});
