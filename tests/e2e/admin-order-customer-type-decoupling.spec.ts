import { randomUUID } from 'node:crypto';
import {
  expect,
  test,
  type APIRequestContext,
  type Page
} from '@playwright/test';
import pg, { type Pool as PgPool } from 'pg';
import { assertAuthenticatedAdmin } from './support/auth';

const { Pool } = pg;
const SCHOOL_PURCHASE_ORDER_REQUIRED_MESSAGE =
  'Pred potrditvijo naročila šole ali javnega zavoda mora biti naložena naročilnica.';
const CATALOG_VARIANT_ID = 920001;
const ORDER_LINE = {
  catalogItemId: 910001,
  catalogVariantId: CATALOG_VARIANT_ID,
  sku: 'MAT-KOV-ALU-100',
  name: 'E2E plošča za popravek tipa naročnika',
  unit: 'kos',
  quantity: 1,
  unitPrice: 4.9,
  discountPercentage: 0
} as const;

let database: PgPool;

function buildTinyValidPdf(): Buffer {
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 72 72] >>\nendobj\n'
  ];
  let body = '%PDF-1.4\n';
  const offsets = objects.map((objectBody) => {
    const offset = Buffer.byteLength(body, 'ascii');
    body += objectBody;
    return offset;
  });
  const xrefOffset = Buffer.byteLength(body, 'ascii');
  const xref = [
    'xref',
    '0 4',
    '0000000000 65535 f ',
    ...offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n `)
  ].join('\n');
  return Buffer.from(
    `${body}${xref}\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
    'ascii'
  );
}

const VALID_PDF = buildTinyValidPdf();

type ManualOrderFixture = {
  orderId: number;
  details: {
    orderNumber: string;
    customerType: 'company';
    organizationName: string;
    contactName: string;
    email: string;
    addressLine1: string;
    addressLine2: string;
    postalCode: string;
    city: string;
    countryCode: string;
    reference: string;
    notes: string;
  };
};

type OrderState = {
  customer_type: string;
  status: string;
  commitment_status: string;
  contract_status: string;
  contract_state_version: number;
  is_draft: boolean;
  subtotal: string;
  tax: string;
  shipping: string;
  total: string;
  pricing_revision: number;
  inventory: number;
  held_count: number;
  held_quantity: number;
  purchase_order_count: number;
};

type ResponseLike = {
  ok(): boolean;
  status(): number;
  text(): Promise<string>;
};

async function requireOk(response: ResponseLike, label: string) {
  if (response.ok()) return;
  throw new Error(`${label} failed with ${response.status()}: ${await response.text()}`);
}

async function createFinalizedManualCompanyOrder(
  request: APIRequestContext,
  label: string
): Promise<ManualOrderFixture> {
  const createResponse = await request.post('/api/admin/orders');
  await requireOk(createResponse, 'create manual admin order');
  const created = await createResponse.json() as { orderId?: unknown };
  const orderId = Number(created.orderId);
  expect(Number.isSafeInteger(orderId)).toBe(true);

  const itemsResponse = await request.post(`/api/admin/orders/${orderId}/items`, {
    data: { items: [ORDER_LINE] }
  });
  await requireOk(itemsResponse, 'save manual order item');

  const shippingResponse = await request.post(`/api/admin/orders/${orderId}/shipping`, {
    data: {
      action: 'override',
      amountCents: 300,
      reason: 'E2E stabilna poštnina za popravek tipa naročnika.'
    }
  });
  await requireOk(shippingResponse, 'save manual order shipping');

  const token = randomUUID();
  const details = {
    orderNumber: `#${orderId}`,
    customerType: 'company' as const,
    organizationName: `${label} ${token.slice(0, 8)} d.o.o.`,
    contactName: 'Ana Novak',
    email: `customer-type-${token}@example.test`,
    addressLine1: 'Testna ulica 1',
    addressLine2: '',
    postalCode: '1000',
    city: 'Ljubljana',
    countryCode: 'SI',
    reference: `TYPE-${orderId}`,
    notes: 'E2E popravek tipa naročnika.'
  };
  const detailsResponse = await request.post(`/api/admin/orders/${orderId}/details`, {
    data: details
  });
  await requireOk(detailsResponse, 'finalize manual order');
  expect(await detailsResponse.json()).toMatchObject({
    success: true,
    isDraft: false,
    finalized: true,
    finalizationBlock: null
  });

  return { orderId, details };
}

async function readOrderState(orderId: number): Promise<OrderState> {
  const result = await database.query<OrderState>(
    `select order_record.customer_type,
            order_record.status,
            order_record.commitment_status,
            order_record.contract_status,
            order_record.contract_state_version,
            order_record.is_draft,
            order_record.subtotal::text,
            order_record.tax::text,
            order_record.shipping::text,
            order_record.total::text,
            order_record.pricing_revision,
            variant.inventory,
            (select count(*)::int
             from order_stock_holds stock_hold
             where stock_hold.order_id = order_record.id
               and stock_hold.state = 'held') as held_count,
            (select coalesce(sum(stock_hold.quantity), 0)::int
             from order_stock_holds stock_hold
             where stock_hold.order_id = order_record.id
               and stock_hold.state = 'held') as held_quantity,
            (select count(*)::int
             from order_documents document
             where document.order_id = order_record.id
               and document.type = 'purchase_order'
               and document.deleted_at is null) as purchase_order_count
     from orders order_record
     join catalog_item_variants variant on variant.id = $2
     where order_record.id = $1`,
    [orderId, CATALOG_VARIANT_ID]
  );
  const state = result.rows[0];
  if (!state) throw new Error(`Order ${orderId} disappeared during its E2E workflow.`);
  return {
    ...state,
    contract_state_version: Number(state.contract_state_version),
    pricing_revision: Number(state.pricing_revision),
    inventory: Number(state.inventory),
    held_count: Number(state.held_count),
    held_quantity: Number(state.held_quantity),
    purchase_order_count: Number(state.purchase_order_count)
  };
}

function correctionInvariant(state: OrderState) {
  return {
    status: state.status,
    commitment_status: state.commitment_status,
    contract_status: state.contract_status,
    contract_state_version: state.contract_state_version,
    is_draft: state.is_draft,
    subtotal: state.subtotal,
    tax: state.tax,
    shipping: state.shipping,
    total: state.total,
    pricing_revision: state.pricing_revision,
    inventory: state.inventory,
    held_count: state.held_count,
    held_quantity: state.held_quantity,
    purchase_order_count: state.purchase_order_count
  };
}

async function beginMasterEdit(page: Page) {
  const editButton = page.getByRole('button', { name: 'Uredi celotno naročilo' });
  await expect(editButton).toBeEnabled();
  await editButton.click();
}

async function changeCustomerType(
  page: Page,
  orderId: number,
  customerTypeLabel: 'Podjetje' | 'Šola / javni zavod'
) {
  await beginMasterEdit(page);
  const customerType = page.getByRole('button', { name: 'Tip naročnika' });
  await expect(customerType).toBeEnabled();
  await customerType.click();
  const option = page.getByRole('option', { name: customerTypeLabel, exact: true });
  await expect(option).toBeEnabled();
  await option.click();

  const responsePromise = page.waitForResponse((response) =>
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === `/api/admin/orders/${orderId}/details`
  );
  await page.getByRole('button', { name: 'Shrani', exact: true }).click();
  const response = await responsePromise;
  await requireOk(response, `change customer type to ${customerTypeLabel}`);
  await expect(page.getByRole('button', { name: 'Uredi celotno naročilo' })).toBeEnabled();
}

async function selectStatus(page: Page, label: RegExp) {
  await beginMasterEdit(page);
  const trigger = page
    .getByTestId('admin-order-header-statuses')
    .getByRole('button')
    .first();
  await trigger.click();
  const option = page.getByRole('menuitem', { name: label });
  await expect(option).toBeEnabled();
  await option.click();
}

async function cleanupOrder(request: APIRequestContext, orderId: number) {
  const exists = await database.query<{
    status: string;
  }>('select status from orders where id = $1', [orderId]);
  if (!exists.rows[0]) return;

  // A correction to a non-school type makes an uploaded purchase order removable,
  // including when the test failed after accepting the order.
  await database.query(
    "update orders set customer_type = 'company' where id = $1",
    [orderId]
  );
  const documents = await database.query<{ id: string }>(
    `select id
     from order_documents
     where order_id = $1
       and deleted_at is null`,
    [orderId]
  );
  for (const document of documents.rows) {
    const response = await request.delete(
      `/api/admin/orders/${orderId}/documents/${document.id}`
    );
    await requireOk(response, `delete E2E order document ${document.id}`);
  }

  if (exists.rows[0].status !== 'cancelled') {
    const cancelResponse = await request.post(`/api/admin/orders/${orderId}/status`, {
      data: { status: 'cancelled' }
    });
    await requireOk(cancelResponse, `cancel E2E order ${orderId}`);
  }
  await database.query(
    "update orders set commitment_status = 'rejected' where id = $1",
    [orderId]
  );
  const archiveResponse = await request.delete(`/api/admin/orders/${orderId}`);
  await requireOk(archiveResponse, `archive E2E order ${orderId}`);
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

test('decouples customer type from order state while retaining the school purchase-order gate', async ({
  page,
  request
}) => {
  test.setTimeout(90_000);
  const ownedOrderIds: number[] = [];

  try {
    const pending = await createFinalizedManualCompanyOrder(
      request,
      'E2E prejeto naročilo'
    );
    ownedOrderIds.push(pending.orderId);
    const beforeSchoolCorrection = await readOrderState(pending.orderId);
    expect(beforeSchoolCorrection).toMatchObject({
      customer_type: 'company',
      status: 'received',
      commitment_status: 'binding',
      contract_status: 'pending_seller_acceptance',
      is_draft: false,
      held_count: 1,
      held_quantity: 1,
      purchase_order_count: 0
    });

    await page.goto(`/admin/orders/${pending.orderId}`);
    await expect(page.getByTestId('admin-order-detail-header')).toBeVisible();
    await changeCustomerType(page, pending.orderId, 'Šola / javni zavod');

    const correctedPending = await readOrderState(pending.orderId);
    expect(correctedPending.customer_type).toBe('school');
    expect(correctionInvariant(correctedPending)).toEqual(
      correctionInvariant(beforeSchoolCorrection)
    );
    await expect(
      page.getByTestId('missing-school-purchase-order-evidence-compact')
    ).toContainText('Manjka veljavna naročilnica');

    await selectStatus(page, /^V obdelavi/u);
    const blockedStatusPromise = page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === `/api/admin/orders/${pending.orderId}/status`
    );
    await page.getByRole('button', { name: 'Shrani', exact: true }).click();
    const blockedStatus = await blockedStatusPromise;
    expect(blockedStatus.status()).toBe(409);
    expect(await blockedStatus.json()).toEqual({
      code: 'SCHOOL_PURCHASE_ORDER_REQUIRED',
      message: SCHOOL_PURCHASE_ORDER_REQUIRED_MESSAGE
    });
    await expect(
      page.getByRole('status').filter({
        hasText: SCHOOL_PURCHASE_ORDER_REQUIRED_MESSAGE
      })
    ).toBeVisible();
    expect(correctionInvariant(await readOrderState(pending.orderId))).toEqual(
      correctionInvariant(beforeSchoolCorrection)
    );

    const uploadResponse = await request.post(
      `/api/admin/orders/${pending.orderId}/documents`,
      {
        multipart: {
          type: 'purchase_order',
          file: {
            name: 'e2e-corrected-school-purchase-order.pdf',
            mimeType: 'application/pdf',
            buffer: VALID_PDF
          }
        }
      }
    );
    await requireOk(uploadResponse, 'upload corrected-school purchase order');
    expect((await uploadResponse.json()) as { formatMarker?: string }).toMatchObject({
      formatMarker: 'admin-upload-pdf-v1'
    });

    const acceptedStatusPromise = page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === `/api/admin/orders/${pending.orderId}/status`
      && (response.request().postDataJSON() as { confirmationOnly?: boolean } | null)
        ?.confirmationOnly !== true
    );
    await page.getByRole('button', { name: 'Shrani', exact: true }).click();
    const acceptedStatus = await acceptedStatusPromise;
    await requireOk(acceptedStatus, 'accept corrected school order');
    expect(await acceptedStatus.json()).toMatchObject({
      status: 'in_progress',
      commitmentStatus: 'binding',
      contractStatus: 'accepted'
    });

    const acceptedSchool = await readOrderState(pending.orderId);
    expect(acceptedSchool).toMatchObject({
      customer_type: 'school',
      status: 'in_progress',
      commitment_status: 'binding',
      contract_status: 'accepted',
      purchase_order_count: 1
    });
    expect({
      subtotal: acceptedSchool.subtotal,
      tax: acceptedSchool.tax,
      shipping: acceptedSchool.shipping,
      total: acceptedSchool.total,
      pricing_revision: acceptedSchool.pricing_revision,
      inventory: acceptedSchool.inventory,
      held_count: acceptedSchool.held_count,
      held_quantity: acceptedSchool.held_quantity
    }).toEqual({
      subtotal: beforeSchoolCorrection.subtotal,
      tax: beforeSchoolCorrection.tax,
      shipping: beforeSchoolCorrection.shipping,
      total: beforeSchoolCorrection.total,
      pricing_revision: beforeSchoolCorrection.pricing_revision,
      inventory: beforeSchoolCorrection.inventory,
      held_count: beforeSchoolCorrection.held_count,
      held_quantity: beforeSchoolCorrection.held_quantity
    });

    const accepted = await createFinalizedManualCompanyOrder(
      request,
      'E2E sprejeto naročilo'
    );
    ownedOrderIds.push(accepted.orderId);
    const acceptResponse = await request.post(
      `/api/admin/orders/${accepted.orderId}/status`,
      { data: { status: 'in_progress' } }
    );
    await requireOk(acceptResponse, 'accept manual non-school order');
    const acceptedBeforeCorrections = await readOrderState(accepted.orderId);
    expect(acceptedBeforeCorrections).toMatchObject({
      customer_type: 'company',
      status: 'in_progress',
      commitment_status: 'binding',
      contract_status: 'accepted',
      held_count: 1,
      held_quantity: 1,
      purchase_order_count: 0
    });

    await page.goto(`/admin/orders/${accepted.orderId}`);
    await expect(page.getByTestId('admin-order-detail-header')).toBeVisible();
    await changeCustomerType(page, accepted.orderId, 'Šola / javni zavod');
    const acceptedAsSchool = await readOrderState(accepted.orderId);
    expect(acceptedAsSchool.customer_type).toBe('school');
    expect(correctionInvariant(acceptedAsSchool)).toEqual(
      correctionInvariant(acceptedBeforeCorrections)
    );
    const missingEvidence = page.getByTestId(
      'missing-school-purchase-order-evidence-compact'
    );
    await expect(missingEvidence).toBeVisible();
    await expect(missingEvidence).toContainText(
      'Trenutni status, obdelava in zavezujočnost ostanejo nespremenjeni'
    );

    await changeCustomerType(page, accepted.orderId, 'Podjetje');
    const acceptedBackAsCompany = await readOrderState(accepted.orderId);
    expect(acceptedBackAsCompany.customer_type).toBe('company');
    expect(correctionInvariant(acceptedBackAsCompany)).toEqual(
      correctionInvariant(acceptedBeforeCorrections)
    );
    await expect(missingEvidence).toHaveCount(0);

    await changeCustomerType(page, accepted.orderId, 'Šola / javni zavod');
    expect(correctionInvariant(await readOrderState(accepted.orderId))).toEqual(
      correctionInvariant(acceptedBeforeCorrections)
    );
    await expect(
      page.getByTestId('missing-school-purchase-order-evidence-compact')
    ).toBeVisible();

    await selectStatus(page, /^Poslano/u);
    const laterStatusPromise = page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === `/api/admin/orders/${accepted.orderId}/status`
      && (response.request().postDataJSON() as { confirmationOnly?: boolean } | null)
        ?.confirmationOnly !== true
    );
    await page.getByRole('button', { name: 'Shrani', exact: true }).click();
    const laterStatus = await laterStatusPromise;
    await requireOk(laterStatus, 'advance corrected accepted school order');
    expect(await laterStatus.json()).toMatchObject({
      status: 'sent',
      commitmentStatus: 'binding',
      contractStatus: 'accepted'
    });
    const sentSchool = await readOrderState(accepted.orderId);
    expect(sentSchool).toMatchObject({
      customer_type: 'school',
      status: 'sent',
      commitment_status: 'binding',
      contract_status: 'accepted',
      purchase_order_count: 0
    });
    expect({
      contract_state_version: sentSchool.contract_state_version,
      subtotal: sentSchool.subtotal,
      tax: sentSchool.tax,
      shipping: sentSchool.shipping,
      total: sentSchool.total,
      pricing_revision: sentSchool.pricing_revision,
      inventory: sentSchool.inventory,
      held_count: sentSchool.held_count,
      held_quantity: sentSchool.held_quantity
    }).toEqual({
      contract_state_version: acceptedBeforeCorrections.contract_state_version,
      subtotal: acceptedBeforeCorrections.subtotal,
      tax: acceptedBeforeCorrections.tax,
      shipping: acceptedBeforeCorrections.shipping,
      total: acceptedBeforeCorrections.total,
      pricing_revision: acceptedBeforeCorrections.pricing_revision,
      inventory: acceptedBeforeCorrections.inventory,
      held_count: acceptedBeforeCorrections.held_count,
      held_quantity: acceptedBeforeCorrections.held_quantity
    });

    const correctionAudits = await database.query<{ correction_count: number }>(
      `select count(*)::int as correction_count
       from audit_events
       where entity_type = 'order'
         and entity_id = $1
         and action = 'updated'
         and metadata_json->>'customer_type_corrected' = 'true'`,
      [String(accepted.orderId)]
    );
    expect(Number(correctionAudits.rows[0]?.correction_count)).toBe(3);
  } finally {
    for (const orderId of ownedOrderIds.reverse()) {
      await cleanupOrder(request, orderId);
    }
  }
});
