import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse
} from '@playwright/test';
import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg, { type Pool as PgPool } from 'pg';
import { parseOrderEmailDeliveryEnvelope } from '@/shared/domain/order/orderEmailDelivery';
import type { OrderEmailSettings } from '@/shared/domain/order/orderEmailSettings';
import { decryptOrderEmailDeliveryEnvelope } from '@/shared/server/orderEmailDeliveryCipher';
import { ADMIN_STORAGE_STATE_PATH } from './support/auth';

const { Pool } = pg;
const SETTINGS_KEY = 'order-email-notifications';
const SCHOOL_VARIANT_ID = 920001;
const E2E_ORDER_ACCESS_BOOTSTRAP_KEY =
  'e2e-only-order-bootstrap-key-with-at-least-32-characters';
const ORDER_ACCESS_TOKEN_PATTERN = /ath_order_[A-Za-z0-9_-]{43}/u;
const PURCHASE_ORDER_UPLOAD_URL_PATTERN =
  /https:\/\/www\.atehna-test\.site\/order\/narocilnica#token=ath_order_[A-Za-z0-9_-]{43}/u;
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
const VALID_PDF_SHA256 = createHash('sha256')
  .update(VALID_PDF)
  .digest('hex');

async function listE2ePrivateBlobFiles(namespace: string): Promise<string[]> {
  const root = join(
    tmpdir(),
    'atehna-e2e-private-order-documents-v1',
    namespace
  );
  const visit = async (directory: string): Promise<string[]> => {
    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const pathname = join(directory, entry.name);
      if (entry.isDirectory()) {
        files.push(...await visit(pathname));
      } else if (entry.isFile()) {
        files.push(pathname);
      }
    }
    return files;
  };

  try {
    return (await visit(root)).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

type StoredSettingsRow = {
  config_json: unknown;
  updated_at: Date;
};

type CustomerOutboxRow = {
  id: string;
  order_id: string;
  event_type: string;
  audience: 'customer';
  payload_json: unknown;
};

type StoredDocumentRow = {
  id: string;
  blob_pathname: string;
  customer_access_id: string;
  content_sha256: string;
  deleted_at: Date | null;
  format_marker: string;
};

let database: PgPool;

function schoolWorkflowSettings(
  original: OrderEmailSettings
): OrderEmailSettings {
  const disabledEvent = { customer: false, admins: false };
  return {
    ...original,
    enabled: true,
    senderName: 'Atehna E2E',
    fromEmail: 'orders@e2e.example.com',
    replyToEmail: 'support@e2e.example.com',
    adminRecipients: ['school-workflow-admin@example.com'],
    siteUrl: 'https://www.atehna-test.site',
    events: {
      order_submitted: { customer: true, admins: false },
      order_accepted: { ...disabledEvent },
      order_rejected: { ...disabledEvent },
      received: { ...disabledEvent },
      in_progress: { ...disabledEvent },
      partially_sent: { ...disabledEvent },
      sent: { ...disabledEvent },
      finished: { ...disabledEvent },
      cancelled: { ...disabledEvent }
    },
    updatedAt: null
  };
}

function decryptCustomerSubmission(row: CustomerOutboxRow) {
  const previousSecret = process.env.ORDER_ACCESS_BOOTSTRAP_KEY;
  process.env.ORDER_ACCESS_BOOTSTRAP_KEY = E2E_ORDER_ACCESS_BOOTSTRAP_KEY;
  try {
    return parseOrderEmailDeliveryEnvelope(
      decryptOrderEmailDeliveryEnvelope(
        row.payload_json,
        row.id,
        Number(row.order_id)
      )
    );
  } finally {
    if (previousSecret === undefined) {
      delete process.env.ORDER_ACCESS_BOOTSTRAP_KEY;
    } else {
      process.env.ORDER_ACCESS_BOOTSTRAP_KEY = previousSecret;
    }
  }
}

async function waitForInitialSummaryWorker(orderId: number) {
  await expect.poll(
    async () => {
      const result = await database.query<{
        attempts: number;
        status: string;
      }>(
        `select attempts, status
         from order_document_jobs
         where order_id = $1
           and document_type = 'order_summary'
         limit 1`,
        [orderId]
      );
      const job = result.rows[0];
      return Boolean(job && job.attempts >= 1 && job.status !== 'processing');
    },
    {
      message: 'initial order-summary worker should settle before workflow assertions',
      timeout: 10_000
    }
  ).toBe(true);

  await database.query(
    `update order_document_jobs
     set next_attempt_at = now() + interval '1 hour'
     where order_id = $1
       and document_type = 'order_summary'
       and status = 'pending'`,
    [orderId]
  );
}

async function requireOk(response: APIResponse, label: string) {
  if (response.ok()) return;
  throw new Error(
    `${label} failed with ${response.status()}: ${await response.text()}`
  );
}

async function permanentlyDeleteArchivedEntries(
  request: APIRequestContext,
  entryIds: number[]
) {
  if (entryIds.length === 0) return;
  await database.query(
    `update deleted_archive_entries
     set expires_at = now() - interval '1 second'
     where id = any($1::bigint[])`,
    [entryIds]
  );
  const response = await request.delete('/api/admin/archive', {
    data: { ids: entryIds }
  });
  await requireOk(response, 'permanent archive cleanup');
  const payload = await response.json() as { deletedCount?: number };
  if (payload.deletedCount !== entryIds.length) {
    throw new Error(
      `Permanent archive cleanup deleted ${payload.deletedCount ?? 0} of ${entryIds.length} entries.`
    );
  }
}

async function cleanupOrderThroughArchive(
  request: APIRequestContext,
  orderId: number
) {
  const orderExists = await database.query(
    'select id from orders where id = $1',
    [orderId]
  );
  if (orderExists.rowCount !== 1) return;

  const cancelResponse = await request.post(
    `/api/admin/orders/${orderId}/status`,
    { data: { status: 'cancelled' } }
  );
  await requireOk(cancelResponse, 'order cancellation for E2E cleanup');
  await database.query(
    `update orders
     set commitment_status = 'rejected'
     where id = $1`,
    [orderId]
  );

  const activeDocuments = await database.query<{ id: string }>(
    `select id
     from order_documents
     where order_id = $1
       and deleted_at is null
     order by id`,
    [orderId]
  );
  for (const document of activeDocuments.rows) {
    const deleteResponse = await request.delete(
      `/api/admin/orders/${orderId}/documents/${Number(document.id)}`
    );
    await requireOk(deleteResponse, 'allowed order-document cleanup');
  }

  const documentArchiveEntries = await database.query<{ id: string }>(
    `select id
     from deleted_archive_entries
     where item_type = 'pdf'
       and order_id = $1
     order by id`,
    [orderId]
  );
  await permanentlyDeleteArchivedEntries(
    request,
    documentArchiveEntries.rows.map((entry) => Number(entry.id))
  );

  const remainingDocuments = await database.query(
    'select id from order_documents where order_id = $1',
    [orderId]
  );
  if (remainingDocuments.rowCount !== 0) {
    throw new Error('Order-document archive cleanup left database rows behind.');
  }
  const remainingBlobJobs = await database.query(
    `select id
     from archive_blob_deletion_outbox
     where source_order_id = $1`,
    [orderId]
  );
  if (remainingBlobJobs.rowCount !== 0) {
    throw new Error('Order-document archive cleanup left blob deletion jobs behind.');
  }

  const orderDeleteResponse = await request.delete(
    `/api/admin/orders/${orderId}`
  );
  await requireOk(orderDeleteResponse, 'order archive cleanup');
  const orderArchiveEntry = await database.query<{ id: string }>(
    `select id
     from deleted_archive_entries
     where item_type = 'order'
       and order_id = $1
     limit 1`,
    [orderId]
  );
  if (orderArchiveEntry.rowCount !== 1) {
    throw new Error('Order archive cleanup did not create its scoped archive entry.');
  }
  const durableCommerceEvidence = await database.query(
    `select 1
     from orders order_record
     where order_record.id = $1
       and (
         order_record.source_quote_offer_version_id is not null
         or exists (
           select 1
           from order_stock_holds stock_hold
           where stock_hold.order_id = order_record.id
         )
       )
     limit 1`,
    [orderId]
  );
  if (durableCommerceEvidence.rowCount === 1) {
    // Production intentionally retains archived orders that have contractual
    // or stock-ledger evidence. The disposable E2E database is reset later.
    return;
  }
  await permanentlyDeleteArchivedEntries(
    request,
    [Number(orderArchiveEntry.rows[0].id)]
  );

  const remainingOrder = await database.query(
    'select id from orders where id = $1',
    [orderId]
  );
  if (remainingOrder.rowCount !== 0) {
    throw new Error('Order archive cleanup left the order behind.');
  }
}

async function restoreSettings(originalSettings: StoredSettingsRow | null) {
  if (originalSettings) {
    await database.query(
      `insert into order_email_settings (key, config_json, updated_at)
       values ($1, $2::jsonb, $3)
       on conflict (key)
       do update set config_json = excluded.config_json,
                     updated_at = excluded.updated_at`,
      [
        SETTINGS_KEY,
        JSON.stringify(originalSettings.config_json),
        originalSettings.updated_at
      ]
    );
    return;
  }

  await database.query(
    'delete from order_email_settings where key = $1',
    [SETTINGS_KEY]
  );
}

test.use({ storageState: ADMIN_STORAGE_STATE_PATH });

test.describe('school purchase-order workflow', () => {
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

  test('requires the secure customer upload before binding and processing', async ({
    browser,
    request
  }, testInfo) => {
    test.setTimeout(45_000);
    const settingsResponse = await request.get('/api/admin/order-email-settings');
    expect(settingsResponse.ok()).toBeTruthy();
    const settingsPayload = await settingsResponse.json() as {
      state: { config: OrderEmailSettings };
    };
    const originalSettingsResult = await database.query<StoredSettingsRow>(
      `select config_json, updated_at
       from order_email_settings
       where key = $1`,
      [SETTINGS_KEY]
    );
    const originalSettings = originalSettingsResult.rows[0] ?? null;
    const inventoryResult = await database.query<{ inventory: string }>(
      'select inventory from catalog_item_variants where id = $1',
      [SCHOOL_VARIANT_ID]
    );
    const originalInventory = Number(inventoryResult.rows[0]?.inventory);
    expect(Number.isFinite(originalInventory)).toBe(true);
    expect(originalInventory).toBeGreaterThan(0);

    const email = `school-purchase-order-${crypto.randomUUID()}@example.com`;
    let customerContext: Awaited<ReturnType<typeof browser.newContext>> | null = null;
    let orderId: number | null = null;
    let cleanupCompleted = false;

    try {
      await database.query(
        `insert into order_email_settings (key, config_json, updated_at)
         values ($1, $2::jsonb, now())
         on conflict (key)
         do update set config_json = excluded.config_json, updated_at = now()`,
        [
          SETTINGS_KEY,
          JSON.stringify(schoolWorkflowSettings(settingsPayload.state.config))
        ]
      );

      const estimateResponse = await request.post('/api/orders/estimate', {
        data: {
          customerName: 'E2E javni zavod',
          customerLabels: ['E2E javni zavod', 'Ana Novak'],
          items: [{ variantId: SCHOOL_VARIANT_ID, quantity: 1 }]
        }
      });
      expect(estimateResponse.ok()).toBeTruthy();
      const estimate = await estimateResponse.json() as {
        shippingConfigurationVersion: number;
        quoteFingerprint: string;
      };
      const createResponse = await request.post('/api/orders', {
        headers: {
          'Idempotency-Key': `school-purchase-order-${crypto.randomUUID()}`
        },
        data: {
          customerType: 'school',
          customerName: 'E2E javni zavod',
          organizationName: 'E2E javni zavod',
          contactName: 'Ana Novak',
          email,
          addressLine1: 'Testna ulica 1',
          city: 'Ljubljana',
          postalCode: '1000',
          countryCode: 'SI',
          reference: 'E2E-NAROCILNICA-2026',
          notes: '',
          items: [{ variantId: SCHOOL_VARIANT_ID, quantity: 1 }],
          shippingConfigurationVersion: estimate.shippingConfigurationVersion,
          quoteFingerprint: estimate.quoteFingerprint
        }
      });
      expect(createResponse.status()).toBe(201);

      const orderResult = await database.query<{ id: string }>(
        `select id
         from orders
         where email = $1
         order by id desc
         limit 1`,
        [email]
      );
      const createdOrderId = Number(orderResult.rows[0]?.id);
      expect(Number.isSafeInteger(createdOrderId)).toBe(true);
      if (!Number.isSafeInteger(createdOrderId)) {
        throw new Error('The school E2E order did not receive a safe integer ID.');
      }
      orderId = createdOrderId;
      await waitForInitialSummaryWorker(orderId);

      const processingBlocked = await request.post(
        `/api/admin/orders/${orderId}/status`,
        { data: { status: 'in_progress' } }
      );
      expect(processingBlocked.status()).toBe(409);
      await expect(processingBlocked.json()).resolves.toMatchObject({
        code: 'SCHOOL_PURCHASE_ORDER_REQUIRED'
      });
      const blockedState = await database.query<{
        commitment_status: string;
        status: string;
      }>(
        'select commitment_status, status from orders where id = $1',
        [orderId]
      );
      expect(blockedState.rows[0]).toEqual({
        commitment_status: 'pending_confirmation',
        status: 'received'
      });

      const storageNamespace = process.env.E2E_STORAGE_NAMESPACE?.trim();
      expect(storageNamespace).toMatch(/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,127}$/u);
      if (!storageNamespace) {
        throw new Error('E2E_STORAGE_NAMESPACE is required for document cleanup.');
      }
      const generatedProofResult = await database.query<{ id: string }>(
        `insert into order_documents (
           order_id,
           type,
           filename,
           blob_pathname,
           version_number,
           document_number,
           issued_at,
           content_sha256,
           legal_status,
           format_marker
         )
         values (
           $1,
           'purchase_order',
           'generated-purchase-order.pdf',
           $2,
           1,
           $3,
           now(),
           $4,
           'operational',
           'atehna-generated-pdf-v2'
         )
         returning id`,
        [
          orderId,
          `${storageNamespace}/generated-order-documents/${crypto.randomUUID()}.pdf`,
          `NAROCILNICA-${orderId}-V1`,
          '0'.repeat(64)
        ]
      );
      expect(generatedProofResult.rowCount).toBe(1);

      const generatedProcessingBlocked = await request.post(
        `/api/admin/orders/${orderId}/status`,
        { data: { status: 'in_progress' } }
      );
      expect(generatedProcessingBlocked.status()).toBe(409);
      await expect(generatedProcessingBlocked.json()).resolves.toMatchObject({
        code: 'SCHOOL_PURCHASE_ORDER_REQUIRED'
      });
      const inventoryAfterGeneratedDocument = await database.query<{
        inventory: string;
      }>(
        'select inventory from catalog_item_variants where id = $1',
        [SCHOOL_VARIANT_ID]
      );
      expect(Number(inventoryAfterGeneratedDocument.rows[0]?.inventory)).toBe(
        originalInventory
      );

      let customerJob: CustomerOutboxRow | undefined;
      await expect.poll(async () => {
        const result = await database.query<CustomerOutboxRow>(
          `select id, order_id, event_type, audience, payload_json
           from order_email_jobs
           where order_id = $1
             and event_type = 'order_submitted'
             and audience = 'customer'
             and recipient_email = $2
           limit 1`,
          [orderId, email]
        );
        customerJob = result.rows[0];
        return result.rowCount;
      }).toBe(1);
      if (!customerJob) {
        throw new Error('The encrypted school customer email job was not created.');
      }
      const rawOutboxPayload = JSON.stringify(customerJob.payload_json);
      expect(customerJob.payload_json).toMatchObject({
        version: 1,
        algorithm: 'aes-256-gcm'
      });
      expect(rawOutboxPayload).not.toMatch(ORDER_ACCESS_TOKEN_PATTERN);
      expect(rawOutboxPayload).not.toContain('/order/narocilnica');
      expect(rawOutboxPayload).not.toContain('"message"');

      const envelope = decryptCustomerSubmission(customerJob);
      expect(envelope).toMatchObject({
        eventType: 'order_submitted',
        audience: 'customer'
      });
      const uploadUrlMatch = envelope.message.text.match(
        PURCHASE_ORDER_UPLOAD_URL_PATTERN
      );
      expect(uploadUrlMatch).not.toBeNull();
      const uploadUrl = new URL(uploadUrlMatch![0]);
      expect(uploadUrl.origin).toBe('https://www.atehna-test.site');
      expect(uploadUrl.pathname).toBe('/order/narocilnica');
      expect(uploadUrl.search).toBe('');
      const token = new URLSearchParams(uploadUrl.hash.slice(1)).get('token');
      expect(token).toMatch(ORDER_ACCESS_TOKEN_PATTERN);
      if (!token) throw new Error('The secure upload URL did not contain its token.');

      const baseURL = String(testInfo.project.use.baseURL ?? '');
      customerContext = await browser.newContext({ baseURL });
      const page = await customerContext.newPage();
      const requests: Array<{
        method: string;
        pathname: string;
        postData: string;
        url: string;
        referer: string;
      }> = [];
      page.on('request', (observedRequest) => {
        requests.push({
          method: observedRequest.method(),
          pathname: new URL(observedRequest.url()).pathname,
          postData: observedRequest.postData() ?? '',
          url: observedRequest.url(),
          referer: observedRequest.headers().referer ?? ''
        });
      });
      const exchangeResponsePromise = page.waitForResponse((response) =>
        new URL(response.url()).pathname === '/api/orders/access-session'
      );
      const documentResponse = await page.goto(
        `${uploadUrl.pathname}${uploadUrl.hash}`
      );
      expect(documentResponse?.ok()).toBe(true);
      expect(await documentResponse!.text()).not.toContain(token);
      const exchangeResponse = await exchangeResponsePromise;
      expect(exchangeResponse.status()).toBe(200);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Naloži naročilnico' })
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Naloži naročilnico' })
      ).toBeEnabled();

      const scrubbedUrl = new URL(page.url());
      expect(scrubbedUrl.pathname).toBe('/order/narocilnica');
      expect(scrubbedUrl.search).toBe('');
      expect(scrubbedUrl.hash).toBe('');
      expect(requests.length).toBeGreaterThan(0);
      expect(requests.every((entry) => (
        !entry.url.includes(token) && !entry.referer.includes(token)
      ))).toBe(true);
      expect(await page.content()).not.toContain(token);
      const browserVisibleState = await page.evaluate(() => ({
        cookies: document.cookie,
        html: document.documentElement.outerHTML,
        resources: performance.getEntriesByType('resource').map((entry) => entry.name),
        sessionStorage: Object.fromEntries(
          Array.from({ length: window.sessionStorage.length }, (_, index) => {
            const key = window.sessionStorage.key(index) ?? '';
            return [key, window.sessionStorage.getItem(key) ?? ''];
          })
        )
      }));
      expect(JSON.stringify(browserVisibleState)).not.toContain(token);
      const accessCookie = (await customerContext.cookies()).find((cookie) =>
        cookie.name.startsWith('ath_order_access_')
      );
      expect(accessCookie).toMatchObject({
        value: token,
        httpOnly: true,
        sameSite: 'Strict',
        path: '/api/orders'
      });

      const uploadResponsePromise = page.waitForResponse((response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/orders/purchase-order'
      );
      await page.locator('input[name="purchaseOrder"]').setInputFiles({
        name: 'e2e-narocilnica.pdf',
        mimeType: 'application/pdf',
        buffer: VALID_PDF
      });
      await expect(page.getByText('e2e-narocilnica.pdf')).toBeVisible();
      await page.getByRole('button', { name: 'Naloži naročilnico' }).click();
      const uploadResponse = await uploadResponsePromise;
      expect(uploadResponse.status()).toBe(201);
      await expect(
        page.getByText(
          'Naročilnica je uspešno naložena in povezana z vašim naročilom.'
        )
      ).toBeVisible();
      expect(requests.every((entry) => (
        !entry.url.includes(token) && !entry.referer.includes(token)
      ))).toBe(true);
      const tokenPostRequests = requests.filter((entry) =>
        entry.postData.includes(token)
      );
      expect(tokenPostRequests).toHaveLength(1);
      expect(tokenPostRequests[0]).toMatchObject({
        method: 'POST',
        pathname: '/api/orders/access-session'
      });
      expect(
        requests.reduce(
          (count, entry) => count + entry.postData.split(token).length - 1,
          0
        )
      ).toBe(1);
      const purchaseOrderRequest = requests.find((entry) =>
        entry.method === 'POST' &&
        entry.pathname === '/api/orders/purchase-order'
      );
      expect(purchaseOrderRequest).toBeDefined();
      expect(purchaseOrderRequest?.postData).not.toContain(token);
      expect(await page.content()).not.toContain(token);

      const documentResult = await database.query<StoredDocumentRow>(
        `select id,
                blob_pathname,
                customer_access_id,
                content_sha256,
                deleted_at,
                format_marker
         from order_documents
         where order_id = $1
           and type = 'purchase_order'
           and deleted_at is null
           and format_marker = 'customer-upload-pdf-v1'
         order by id desc
         limit 1`,
        [orderId]
      );
      const purchaseOrder = documentResult.rows[0];
      expect(purchaseOrder).toBeDefined();
      expect(purchaseOrder).toMatchObject({
        deleted_at: null,
        format_marker: 'customer-upload-pdf-v1'
      });
      expect(purchaseOrder.blob_pathname).toContain('/order-documents/');
      expect(purchaseOrder.customer_access_id).toMatch(
        /^[0-9a-f-]{36}$/u
      );
      expect(purchaseOrder.content_sha256).toBe(VALID_PDF_SHA256);

      const storedDocumentResponse = await request.get(
        `/api/admin/orders/${orderId}/documents/${Number(purchaseOrder.id)}`
      );
      expect(storedDocumentResponse.ok()).toBeTruthy();
      expect(storedDocumentResponse.headers()['content-type']).toContain(
        'application/pdf'
      );
      const storedDocumentBytes = await storedDocumentResponse.body();
      expect(storedDocumentBytes).toEqual(VALID_PDF);

      const processingResponse = await request.post(
        `/api/admin/orders/${orderId}/status`,
        { data: { status: 'in_progress' } }
      );
      expect(processingResponse.ok()).toBeTruthy();
      await expect(processingResponse.json()).resolves.toMatchObject({
        status: 'in_progress',
        commitmentStatus: 'binding',
        contractStatus: 'accepted'
      });
      const inventoryAfterProcessing = await database.query<{
        inventory: string;
      }>(
        'select inventory from catalog_item_variants where id = $1',
        [SCHOOL_VARIANT_ID]
      );
      expect(Number(inventoryAfterProcessing.rows[0]?.inventory)).toBe(
        originalInventory - 1
      );
      const documentCountBeforeClosedUpload = await database.query<{
        count: string;
      }>(
        'select count(*)::text as count from order_documents where order_id = $1',
        [orderId]
      );
      const blobFilesBeforeClosedUpload = await listE2ePrivateBlobFiles(
        storageNamespace
      );
      const closedUploadResponsePromise = page.waitForResponse((response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/orders/purchase-order'
      );
      await page.locator('input[name="purchaseOrder"]').setInputFiles({
        name: 'e2e-narocilnica-po-obdelavi.pdf',
        mimeType: 'application/pdf',
        buffer: VALID_PDF
      });
      await page.locator('form button[type="submit"]').click();
      const closedUploadResponse = await closedUploadResponsePromise;
      expect(closedUploadResponse.status()).toBe(409);
      await expect(closedUploadResponse.json()).resolves.toMatchObject({
        code: 'SCHOOL_PURCHASE_ORDER_UPLOAD_CLOSED'
      });

      const documentCountAfterClosedUpload = await database.query<{
        count: string;
      }>(
        'select count(*)::text as count from order_documents where order_id = $1',
        [orderId]
      );
      expect(documentCountAfterClosedUpload.rows[0]?.count).toBe(
        documentCountBeforeClosedUpload.rows[0]?.count
      );
      await expect.poll(
        () => listE2ePrivateBlobFiles(storageNamespace)
      ).toEqual(blobFilesBeforeClosedUpload);
      const purchaseOrderUploadRequests = requests.filter((entry) =>
        entry.method === 'POST' &&
        entry.pathname === '/api/orders/purchase-order'
      );
      expect(purchaseOrderUploadRequests).toHaveLength(2);
      expect(
        purchaseOrderUploadRequests.every((entry) => !entry.postData.includes(token))
      ).toBe(true);
      expect(
        requests.reduce(
          (count, entry) => count + entry.postData.split(token).length - 1,
          0
        )
      ).toBe(1);

      const activeAlternatePurchaseOrders = await database.query<{
        id: string;
        format_marker: string;
      }>(
        `select id, format_marker
         from order_documents
         where order_id = $1
           and id <> $2
           and type = 'purchase_order'
           and deleted_at is null
         order by id`,
        [orderId, Number(purchaseOrder.id)]
      );
      expect(activeAlternatePurchaseOrders.rows).toEqual([
        {
          id: generatedProofResult.rows[0]?.id,
          format_marker: 'atehna-generated-pdf-v2'
        }
      ]);

      const deleteBlocked = await request.delete(
        `/api/admin/orders/${orderId}/documents/${Number(purchaseOrder.id)}`
      );
      expect(deleteBlocked.status()).toBe(409);
      await expect(deleteBlocked.json()).resolves.toMatchObject({
        code: 'SCHOOL_PURCHASE_ORDER_DELETE_BLOCKED'
      });
      const protectedDocument = await database.query<{
        deleted_at: Date | null;
      }>(
        'select deleted_at from order_documents where id = $1',
        [Number(purchaseOrder.id)]
      );
      expect(protectedDocument.rows[0]?.deleted_at).toBeNull();

      await cleanupOrderThroughArchive(request, orderId);
      cleanupCompleted = true;
    } finally {
      await customerContext?.close();
      if (orderId !== null && !cleanupCompleted) {
        const cleanupOrderId = orderId;
        await cleanupOrderThroughArchive(request, cleanupOrderId).catch(async () => {
          await database.query(
            `delete from orders order_record
             where order_record.id = $1
               and not exists (
                 select 1
                 from order_stock_holds stock_hold
                 where stock_hold.order_id = order_record.id
               )`,
            [cleanupOrderId]
          );
        });
      }
      if (orderId !== null) {
        await database.query(
          `delete from audit_events
           where (entity_type = 'order' and entity_id = $1)
              or (
                entity_type = 'media'
                and action = 'deleted'
                and metadata_json->>'item_type' = 'pdf'
                and metadata_json->>'order_id' = $1
              )`,
          [String(orderId)]
        );
      }
      await database.query(
        'update catalog_item_variants set inventory = $1 where id = $2',
        [originalInventory, SCHOOL_VARIANT_ID]
      );
      await restoreSettings(originalSettings);
      await database.query(
        `delete from orders order_record
         where order_record.email = $1
           and not exists (
             select 1
             from order_stock_holds stock_hold
             where stock_hold.order_id = order_record.id
           )`,
        [email]
      );
    }
  });

  test('accepts a received direct school order after an admin purchase-order upload', async ({
    page,
    request
  }) => {
    test.setTimeout(45_000);
    const inventoryResult = await database.query<{ inventory: string }>(
      'select inventory from catalog_item_variants where id = $1',
      [SCHOOL_VARIANT_ID]
    );
    const originalInventory = Number(inventoryResult.rows[0]?.inventory);
    expect(Number.isFinite(originalInventory)).toBe(true);
    expect(originalInventory).toBeGreaterThan(0);

    const email = `school-admin-purchase-order-${crypto.randomUUID()}@example.com`;
    let orderId: number | null = null;
    let cleanupCompleted = false;

    try {
      const estimateResponse = await request.post('/api/orders/estimate', {
        data: {
          customerName: 'E2E javni zavod admin upload',
          customerLabels: ['E2E javni zavod admin upload', 'Ana Novak'],
          items: [{ variantId: SCHOOL_VARIANT_ID, quantity: 1 }]
        }
      });
      expect(estimateResponse.ok()).toBeTruthy();
      const estimate = await estimateResponse.json() as {
        shippingConfigurationVersion: number;
        quoteFingerprint: string;
      };
      const createResponse = await request.post('/api/orders', {
        headers: {
          'Idempotency-Key': `school-admin-purchase-order-${crypto.randomUUID()}`
        },
        data: {
          customerType: 'school',
          customerName: 'E2E javni zavod admin upload',
          organizationName: 'E2E javni zavod admin upload',
          contactName: 'Ana Novak',
          email,
          addressLine1: 'Testna ulica 1',
          city: 'Ljubljana',
          postalCode: '1000',
          countryCode: 'SI',
          reference: 'E2E-ADMIN-NAROCILNICA-2026',
          notes: '',
          items: [{ variantId: SCHOOL_VARIANT_ID, quantity: 1 }],
          shippingConfigurationVersion: estimate.shippingConfigurationVersion,
          quoteFingerprint: estimate.quoteFingerprint
        }
      });
      expect(createResponse.status()).toBe(201);

      const orderResult = await database.query<{ id: string }>(
        `select id
         from orders
         where email = $1
         order by id desc
         limit 1`,
        [email]
      );
      const createdOrderId = Number(orderResult.rows[0]?.id);
      expect(Number.isSafeInteger(createdOrderId)).toBe(true);
      if (!Number.isSafeInteger(createdOrderId)) {
        throw new Error(
          'The admin-upload school E2E order did not receive a safe integer ID.'
        );
      }
      orderId = createdOrderId;
      await waitForInitialSummaryWorker(orderId);

      const uploadResponse = await request.post(
        `/api/admin/orders/${orderId}/documents`,
        {
          multipart: {
            type: 'purchase_order',
            file: {
              name: 'e2e-admin-narocilnica.pdf',
              mimeType: 'application/pdf',
              buffer: VALID_PDF
            }
          }
        }
      );
      expect(uploadResponse.status()).toBe(201);
      const uploadedDocument = await uploadResponse.json() as {
        id: number;
        url: string;
        filename: string;
        createdAt: string;
        issuedAt: string;
        type: string;
        versionNumber: number;
        documentNumber: string;
        legalStatus: string;
        formatMarker: string;
      };
      expect(Number.isSafeInteger(uploadedDocument.id)).toBe(true);
      expect(uploadedDocument.id).toBeGreaterThan(0);
      expect(uploadedDocument).toMatchObject({
        url: `/api/admin/orders/${orderId}/documents/${uploadedDocument.id}`,
        type: 'purchase_order',
        versionNumber: 1,
        legalStatus: 'operational',
        formatMarker: 'admin-upload-pdf-v1'
      });
      expect(uploadedDocument.filename).toMatch(/\.pdf$/u);
      expect(uploadedDocument.documentNumber).not.toHaveLength(0);
      expect(Number.isNaN(Date.parse(uploadedDocument.createdAt))).toBe(false);
      expect(Number.isNaN(Date.parse(uploadedDocument.issuedAt))).toBe(false);

      const storedDocumentResult = await database.query<{
        id: string;
        filename: string;
        version_number: number;
        order_pricing_revision: number;
        current_pricing_revision: number;
        document_number: string;
        content_sha256: string;
        legal_status: string;
        format_marker: string;
        deleted_at: Date | null;
      }>(
        `select document.id,
                document.filename,
                document.version_number,
                document.order_pricing_revision,
                orders.pricing_revision as current_pricing_revision,
                document.document_number,
                document.content_sha256,
                document.legal_status,
                document.format_marker,
                document.deleted_at
         from order_documents document
         join orders on orders.id = document.order_id
         where document.id = $1
           and document.order_id = $2`,
        [uploadedDocument.id, orderId]
      );
      expect(storedDocumentResult.rows[0]).toMatchObject({
        id: String(uploadedDocument.id),
        filename: uploadedDocument.filename,
        version_number: 1,
        document_number: uploadedDocument.documentNumber,
        content_sha256: VALID_PDF_SHA256,
        legal_status: 'operational',
        format_marker: 'admin-upload-pdf-v1',
        deleted_at: null
      });
      expect(storedDocumentResult.rows[0]?.order_pricing_revision).toBe(
        storedDocumentResult.rows[0]?.current_pricing_revision
      );

      const uploadAuditResult = await database.query<{
        document_id: string;
        document_type: string;
        version_number: string;
        document_number: string;
        content_sha256: string;
      }>(
        `select metadata_json->>'document_id' as document_id,
                metadata_json->>'document_type' as document_type,
                metadata_json->>'version_number' as version_number,
                metadata_json->>'document_number' as document_number,
                metadata_json->>'content_sha256' as content_sha256
         from audit_events
         where entity_type = 'order'
           and entity_id = $1
           and action = 'uploaded'
           and metadata_json->>'document_id' = $2
         order by occurred_at desc, created_at desc
         limit 1`,
        [String(orderId), String(uploadedDocument.id)]
      );
      expect(uploadAuditResult.rows[0]).toEqual({
        document_id: String(uploadedDocument.id),
        document_type: 'purchase_order',
        version_number: '1',
        document_number: uploadedDocument.documentNumber,
        content_sha256: VALID_PDF_SHA256
      });

      const afterUploadResult = await database.query<{
        status: string;
        commitment_status: string;
        contract_status: string;
        contract_accepted_at: Date | null;
        contract_accepted_actor_type: string | null;
        contract_accepted_actor_id: string | null;
        contract_acceptance_evidence_json: Record<string, unknown> | null;
        committed_at: Date | null;
      }>(
        `select status,
                commitment_status,
                contract_status,
                contract_accepted_at,
                contract_accepted_actor_type,
                contract_accepted_actor_id,
                contract_acceptance_evidence_json,
                committed_at
         from orders
         where id = $1`,
        [orderId]
      );
      expect(afterUploadResult.rows[0]).toEqual({
        status: 'received',
        commitment_status: 'pending_confirmation',
        contract_status: 'pending_seller_acceptance',
        contract_accepted_at: null,
        contract_accepted_actor_type: null,
        contract_accepted_actor_id: null,
        contract_acceptance_evidence_json: null,
        committed_at: null
      });
      const inventoryAfterUpload = await database.query<{ inventory: string }>(
        'select inventory from catalog_item_variants where id = $1',
        [SCHOOL_VARIANT_ID]
      );
      expect(Number(inventoryAfterUpload.rows[0]?.inventory)).toBe(
        originalInventory
      );
      const holdsAfterUpload = await database.query<{ count: number }>(
        'select count(*)::int as count from order_stock_holds where order_id = $1',
        [orderId]
      );
      expect(holdsAfterUpload.rows[0]?.count).toBe(0);

      await page.goto(`/admin/orders/${orderId}`);
      const accessCard = page.getByTestId('admin-order-customer-access-compact');
      await expect(accessCard).toContainText('Čaka na status »V obdelavi«');
      await page.getByRole('button', { name: 'Uredi celotno naročilo' }).click();
      await page
        .getByTestId('admin-order-header-statuses')
        .getByRole('button')
        .first()
        .click();
      const inProgressOption = page.getByRole('menuitem', { name: /^V obdelavi/u });
      await expect(inProgressOption).toContainText(
        'Sprejme naročilo in ga potrdi kot zavezujoče.'
      );
      await inProgressOption.click();

      const processingResponsePromise = page.waitForResponse((response) =>
        response.request().method() === 'POST'
        && new URL(response.url()).pathname === `/api/admin/orders/${orderId}/status`
        && (response.request().postDataJSON() as {
          confirmationOnly?: unknown;
        }).confirmationOnly !== true
      );
      await page.getByRole('button', { name: 'Shrani', exact: true }).click();
      const processingResponse = await processingResponsePromise;
      expect(processingResponse.status()).toBe(200);
      expect(await processingResponse.json()).toMatchObject({
        status: 'in_progress',
        commitmentStatus: 'binding',
        contractStatus: 'accepted'
      });
      await expect(accessCard).toContainText('Potrjeno kot zavezujoče');
      await expect(accessCard).not.toContainText('Čaka na status »V obdelavi«');

      const acceptedOrderResult = await database.query<{
        status: string;
        commitment_status: string;
        contract_status: string;
        contract_accepted_at: Date | null;
        contract_accepted_actor_type: string | null;
        contract_accepted_actor_id: string | null;
        contract_acceptance_evidence_json: Record<string, unknown> | null;
        committed_at: Date | null;
      }>(
        `select status,
                commitment_status,
                contract_status,
                contract_accepted_at,
                contract_accepted_actor_type,
                contract_accepted_actor_id,
                contract_acceptance_evidence_json,
                committed_at
         from orders
         where id = $1`,
        [orderId]
      );
      const acceptedOrder = acceptedOrderResult.rows[0];
      expect(acceptedOrder).toMatchObject({
        status: 'in_progress',
        commitment_status: 'binding',
        contract_status: 'accepted',
        contract_accepted_actor_type: 'school_purchase_order',
        contract_accepted_actor_id: String(uploadedDocument.id)
      });
      expect(acceptedOrder.contract_accepted_at).not.toBeNull();
      expect(acceptedOrder.committed_at).not.toBeNull();
      expect(acceptedOrder.contract_acceptance_evidence_json).toMatchObject({
        channel: 'admin_status_transition',
        action: 'accept_school_order_for_processing',
        trigger: 'received_to_in_progress',
        buttonWording: 'V obdelavi',
        purchaseOrderDocumentId: uploadedDocument.id,
        draftAtAcceptance: false,
        stockFinalization: 'committed_or_verified'
      });

      const inventoryAfterAcceptance = await database.query<{
        inventory: string;
      }>(
        'select inventory from catalog_item_variants where id = $1',
        [SCHOOL_VARIANT_ID]
      );
      expect(Number(inventoryAfterAcceptance.rows[0]?.inventory)).toBe(
        originalInventory - 1
      );
      const stockHoldResult = await database.query<{
        catalog_variant_id: string;
        quantity: number;
        state: string;
        committed_at: Date | null;
        committed_by_actor_type: string | null;
        committed_by_actor_id: string | null;
        released_at: Date | null;
      }>(
        `select catalog_variant_id,
                quantity,
                state,
                committed_at,
                committed_by_actor_type,
                committed_by_actor_id,
                released_at
         from order_stock_holds
         where order_id = $1
         order by id`,
        [orderId]
      );
      expect(stockHoldResult.rows).toHaveLength(1);
      expect(stockHoldResult.rows[0]).toMatchObject({
        catalog_variant_id: String(SCHOOL_VARIANT_ID),
        quantity: 1,
        state: 'held',
        committed_by_actor_type: 'school_purchase_order',
        committed_by_actor_id: String(uploadedDocument.id),
        released_at: null
      });
      expect(stockHoldResult.rows[0]?.committed_at).not.toBeNull();

      const statusLogResult = await database.query<{
        previous_status: string;
        new_status: string;
      }>(
        `select previous_status, new_status
         from order_status_logs
         where order_id = $1
         order by id desc
         limit 1`,
        [orderId]
      );
      expect(statusLogResult.rows[0]).toEqual({
        previous_status: 'received',
        new_status: 'in_progress'
      });

      const statusAuditResult = await database.query<{
        status_before: string;
        status_after: string;
        commitment_before: string;
        commitment_after: string;
        contract_before: string;
        contract_after: string;
        changed_field_count: string;
        contract_accepted_automatically: string;
        contract_acceptance_trigger: string;
        purchase_order_document_id: string;
        school_stock_finalization_outcome: string;
      }>(
        `select diff_json->'status'->>'before' as status_before,
                diff_json->'status'->>'after' as status_after,
                diff_json->'commitment_status'->>'before' as commitment_before,
                diff_json->'commitment_status'->>'after' as commitment_after,
                diff_json->'contract_status'->>'before' as contract_before,
                diff_json->'contract_status'->>'after' as contract_after,
                metadata_json->>'changed_field_count' as changed_field_count,
                metadata_json->>'contract_accepted_automatically' as contract_accepted_automatically,
                metadata_json->>'contract_acceptance_trigger' as contract_acceptance_trigger,
                metadata_json->>'purchase_order_document_id' as purchase_order_document_id,
                metadata_json->>'school_stock_finalization_outcome' as school_stock_finalization_outcome
         from audit_events
         where entity_type = 'order'
           and entity_id = $1
           and action = 'status_changed'
         order by occurred_at desc, created_at desc
         limit 1`,
        [String(orderId)]
      );
      expect(statusAuditResult.rows[0]).toEqual({
        status_before: 'received',
        status_after: 'in_progress',
        commitment_before: 'pending_confirmation',
        commitment_after: 'binding',
        contract_before: 'pending_seller_acceptance',
        contract_after: 'accepted',
        changed_field_count: '3',
        contract_accepted_automatically: 'true',
        contract_acceptance_trigger: 'received_to_in_progress_with_purchase_order',
        purchase_order_document_id: String(uploadedDocument.id),
        school_stock_finalization_outcome: 'committed_or_verified'
      });

      await cleanupOrderThroughArchive(request, orderId);
      cleanupCompleted = true;
    } finally {
      if (orderId !== null && !cleanupCompleted) {
        const cleanupOrderId = orderId;
        await cleanupOrderThroughArchive(request, cleanupOrderId).catch(async () => {
          await database.query(
            `delete from orders order_record
             where order_record.id = $1
               and not exists (
                 select 1
                 from order_stock_holds stock_hold
                 where stock_hold.order_id = order_record.id
               )`,
            [cleanupOrderId]
          );
        });
      }
      if (orderId !== null) {
        await database.query(
          `delete from audit_events
           where (entity_type = 'order' and entity_id = $1)
              or (
                entity_type = 'media'
                and action = 'deleted'
                and metadata_json->>'item_type' = 'pdf'
                and metadata_json->>'order_id' = $1
              )`,
          [String(orderId)]
        );
      }
      await database.query(
        'update catalog_item_variants set inventory = $1 where id = $2',
        [originalInventory, SCHOOL_VARIANT_ID]
      );
      await database.query(
        `delete from orders order_record
         where order_record.email = $1
           and not exists (
             select 1
             from order_stock_holds stock_hold
             where stock_hold.order_id = order_record.id
           )`,
        [email]
      );
    }
  });
});
