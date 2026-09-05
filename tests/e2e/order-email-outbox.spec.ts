import { expect, test } from '@playwright/test';
import pg, { type Pool as PgPool } from 'pg';
import {
  parseOrderEmailDeliveryEnvelope,
  type PersistedOrderEmailMessage
} from '@/shared/domain/order/orderEmailDelivery';
import type { OrderEmailSettings } from '@/shared/domain/order/orderEmailSettings';
import { decryptOrderEmailDeliveryEnvelope } from '@/shared/server/orderEmailDeliveryCipher';
import { ADMIN_STORAGE_STATE_PATH } from './support/auth';

const { Pool } = pg;
const SETTINGS_KEY = 'order-email-notifications';
const ADMIN_RECIPIENTS = [
  'e2e-orders-primary@example.com',
  'e2e-orders-secondary@example.com'
] as const;
const E2E_ORDER_ACCESS_BOOTSTRAP_KEY =
  'e2e-only-order-bootstrap-key-with-at-least-32-characters';
const ORDER_ACCESS_TOKEN_PATTERN = /ath_order_[A-Za-z0-9_-]{43}/u;
const PURCHASE_ORDER_UPLOAD_URL_PATTERN =
  /https:\/\/www\.atehna-test\.site\/order\/narocilnica#token=ath_order_[A-Za-z0-9_-]{43}/u;

function standaloneOrderNumberPattern(orderNumber: string): RegExp {
  const escapedOrderNumber = orderNumber.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`${escapedOrderNumber}(?![0-9A-Fa-f])`, 'u');
}

type StoredSettingsRow = {
  config_json: unknown;
  updated_at: Date;
};

type OutboxRow = {
  event_key: string;
  event_type: string;
  id: string;
  order_id: string;
  audience: 'customer' | 'admin';
  recipient_email: string;
  status: string;
  attempts: number;
  claim_id: string | null;
  provider_message_id: string | null;
  payload_json: unknown;
};

let database: PgPool;

function decryptOutboxMessage(row: OutboxRow): PersistedOrderEmailMessage {
  const previousSecret = process.env.ORDER_ACCESS_BOOTSTRAP_KEY;
  process.env.ORDER_ACCESS_BOOTSTRAP_KEY = E2E_ORDER_ACCESS_BOOTSTRAP_KEY;
  try {
    const serialized = decryptOrderEmailDeliveryEnvelope(
      row.payload_json,
      row.id,
      Number(row.order_id)
    );
    const envelope = parseOrderEmailDeliveryEnvelope(serialized);
    expect(envelope.eventType).toBe(row.event_type);
    expect(envelope.audience).toBe(row.audience);
    return envelope.message;
  } finally {
    if (previousSecret === undefined) {
      delete process.env.ORDER_ACCESS_BOOTSTRAP_KEY;
    } else {
      process.env.ORDER_ACCESS_BOOTSTRAP_KEY = previousSecret;
    }
  }
}

function enabledE2eSettings(original: OrderEmailSettings): OrderEmailSettings {
  const disabledEvent = { customer: false, admins: false };
  return {
    ...original,
    enabled: true,
    senderName: 'Atehna E2E',
    fromEmail: 'orders@e2e.example.com',
    replyToEmail: 'support@e2e.example.com',
    adminRecipients: [...ADMIN_RECIPIENTS],
    siteUrl: 'https://www.atehna-test.site',
    events: {
      order_submitted: { customer: true, admins: true },
      order_accepted: { ...disabledEvent },
      order_rejected: { ...disabledEvent },
      predracun_issued: { ...disabledEvent },
      invoice_issued: { ...disabledEvent },
      received: { ...disabledEvent },
      in_progress: { customer: true, admins: true },
      partially_sent: { ...disabledEvent },
      sent: { ...disabledEvent },
      finished: { ...disabledEvent },
      cancelled: { ...disabledEvent }
    },
    updatedAt: null
  };
}

async function readOutbox(orderId: number) {
  const result = await database.query<OutboxRow>(
    `select id,
            order_id,
            event_key,
            event_type,
            audience,
            recipient_email,
            status,
            attempts,
            claim_id,
            provider_message_id,
            payload_json
     from order_email_jobs
     where order_id = $1
     order by event_type, audience, recipient_email`,
    [orderId]
  );
  return result.rows;
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
    { message: 'initial order-summary worker should settle before cleanup', timeout: 10_000 }
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

function expectPendingRecipients(
  rows: OutboxRow[],
  eventType: 'order_submitted' | 'in_progress',
  eventKey: string | RegExp,
  customerEmail: string
) {
  const eventRows = rows.filter((row) => row.event_type === eventType);
  expect(eventRows).toHaveLength(3);
  expect(eventRows.map(({ audience, recipient_email: recipientEmail }) => ({
    audience,
    recipientEmail
  }))).toEqual([
    { audience: 'admin', recipientEmail: ADMIN_RECIPIENTS[0] },
    { audience: 'admin', recipientEmail: ADMIN_RECIPIENTS[1] },
    { audience: 'customer', recipientEmail: customerEmail }
  ]);
  for (const row of eventRows) {
    if (typeof eventKey === 'string') {
      expect(row.event_key).toBe(eventKey);
    } else {
      expect(row.event_key).toMatch(eventKey);
    }
    expect(row).toMatchObject({
      status: 'pending',
      attempts: 0,
      claim_id: null,
      provider_message_id: null
    });
  }
}

test.use({ storageState: ADMIN_STORAGE_STATE_PATH });

test.describe('order email outbox integration', () => {
  test.beforeAll(() => {
    const databaseUrl = process.env.E2E_DATABASE_URL?.trim();
    if (!databaseUrl) {
      throw new Error('[e2e-preflight] E2E_DATABASE_URL is required.');
    }
    database = new Pool({ connectionString: databaseUrl, ssl: false });
  });

  test.afterAll(async () => {
    if (!database) return;
    await (
      database as PgPool & { end: () => Promise<void> }
    ).end();
  });

  test('creates one durable job per recipient, deduplicates events, and never invokes transport', async ({
    request
  }) => {
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
    const email = `order-email-outbox-${crypto.randomUUID()}@example.com`;
    const idempotencyKey = `order-email-outbox-${crypto.randomUUID()}`;
    let orderId: number | null = null;

    try {
      // Seed the disposable database directly so the exact previous row,
      // including its timestamp or absence, can be restored. The E2E transport
      // guard remains active and is asserted below.
      await database.query(
        `insert into order_email_settings (key, config_json, updated_at)
         values ($1, $2::jsonb, now())
         on conflict (key)
         do update set config_json = excluded.config_json, updated_at = now()`,
        [SETTINGS_KEY, JSON.stringify(enabledE2eSettings(settingsPayload.state.config))]
      );

      const configuredResponse = await request.get('/api/admin/order-email-settings');
      expect(configuredResponse.ok()).toBeTruthy();
      const configured = await configuredResponse.json() as {
        state: {
          config: OrderEmailSettings;
          delivery: { e2eDisabled: boolean; ready: boolean };
        };
      };
      expect(configured.state.config.enabled).toBe(true);
      expect(configured.state.delivery).toMatchObject({
        e2eDisabled: true,
        ready: false
      });

      const orderData = {
        customerType: 'school',
        customerName: 'E2E šola',
        organizationName: 'E2E šola',
        contactName: 'Ana Novak',
        email,
        addressLine1: 'Testna ulica 1',
        city: 'Ljubljana',
        postalCode: '1000',
        countryCode: 'SI',
        reference: 'E2E-REF-2026',
        notes: '',
        items: [{ variantId: 920001, quantity: 1 }]
      };
      const estimateResponse = await request.post('/api/orders/estimate', {
        data: {
          customerName: orderData.customerName,
          customerLabels: [orderData.customerName, orderData.contactName],
          items: orderData.items
        }
      });
      expect(estimateResponse.ok()).toBeTruthy();
      const estimate = await estimateResponse.json() as {
        shippingConfigurationVersion: number;
        quoteFingerprint: string;
      };
      const createResponse = await request.post('/api/orders', {
        headers: { 'Idempotency-Key': idempotencyKey },
        data: {
          ...orderData,
          shippingConfigurationVersion: estimate.shippingConfigurationVersion,
          quoteFingerprint: estimate.quoteFingerprint
        }
      });
      expect(createResponse.status()).toBe(201);

      const orderResult = await database.query<{ id: string; order_number: string }>(
        'select id, order_number from orders where email = $1 order by id desc limit 1',
        [email]
      );
      const createdOrderId = Number(orderResult.rows[0]?.id);
      const orderNumber = String(orderResult.rows[0]?.order_number ?? '');
      expect(Number.isSafeInteger(createdOrderId)).toBe(true);
      expect(orderNumber).not.toBe('');
      if (!Number.isSafeInteger(createdOrderId)) {
        throw new Error('The E2E order was not persisted with a safe integer ID.');
      }
      orderId = createdOrderId;
      await waitForInitialSummaryWorker(orderId);

      let jobs = await readOutbox(orderId);
      expect(jobs).toHaveLength(3);
      expectPendingRecipients(
        jobs,
        'order_submitted',
        `order-submitted:${orderId}`,
        email
      );
      const submissionJobs = jobs.filter((job) => job.event_type === 'order_submitted');
      const customerSubmission = submissionJobs.find((job) => job.audience === 'customer');
      const adminSubmission = submissionJobs.find((job) => job.audience === 'admin');
      if (!customerSubmission || !adminSubmission) {
        throw new Error('Expected one customer and at least one admin submission job.');
      }
      for (const job of submissionJobs) {
        const rawPayload = JSON.stringify(job.payload_json);
        expect(job.payload_json).toMatchObject({
          version: 1,
          algorithm: 'aes-256-gcm'
        });
        expect(rawPayload).not.toMatch(ORDER_ACCESS_TOKEN_PATTERN);
        expect(rawPayload).not.toContain('narocilnica#token');
        expect(rawPayload).not.toContain('"message"');
      }
      const customerSubmissionMessage = decryptOutboxMessage(customerSubmission);
      const adminSubmissionMessage = decryptOutboxMessage(adminSubmission);
      const customerSubmissionContent = [
        customerSubmissionMessage.subject,
        customerSubmissionMessage.html,
        customerSubmissionMessage.text
      ].join('\n');
      expect(customerSubmissionMessage.subject).toBe(
        '[Atehna] Va\u0161e naro\u010dilo je bilo prejeto \u2013 nalo\u017eite naro\u010dilnico'
      );
      expect(customerSubmissionContent).toContain('Podatki za naro\u010dilnico');
      expect(customerSubmissionContent).toContain('Naro\u010dnik:');
      expect(customerSubmissionContent).toContain('E2E \u0161ola');
      expect(customerSubmissionContent).toContain('Kontaktna oseba:');
      expect(customerSubmissionContent).toContain('Ana Novak');
      expect(customerSubmissionContent).toContain('Va\u0161a referenca:');
      expect(customerSubmissionContent).toContain('E2E-REF-2026');
      expect(customerSubmissionContent).toMatch(PURCHASE_ORDER_UPLOAD_URL_PATTERN);
      expect(customerSubmissionContent).toContain('Nalo\u017ei naro\u010dilnico');
      expect(customerSubmissionContent).not.toContain('/order/narocilnica?');
      const accessToken = customerSubmissionContent.match(
        ORDER_ACCESS_TOKEN_PATTERN
      )?.[0];
      expect(accessToken).toMatch(ORDER_ACCESS_TOKEN_PATTERN);
      expect(customerSubmissionContent).not.toMatch(
        standaloneOrderNumberPattern(orderNumber)
      );
      expect(customerSubmissionContent).not.toContain(`/admin/orders/${createdOrderId}`);
      expect(customerSubmissionContent).not.toContain('Naro\u010dilo:');
      expect(adminSubmissionMessage.html).toContain(orderNumber);
      expect(adminSubmissionMessage.html).toContain(
        `https://www.atehna-test.site/admin/orders/${createdOrderId}`
      );
      for (const adminJob of submissionJobs.filter((job) => job.audience === 'admin')) {
        const adminMessage = decryptOutboxMessage(adminJob);
        const adminContent = [
          adminMessage.subject,
          adminMessage.html,
          adminMessage.text
        ].join('\n');
        expect(adminContent).not.toMatch(ORDER_ACCESS_TOKEN_PATTERN);
        expect(adminContent).not.toContain('/order/narocilnica');
      }
      for (const job of submissionJobs) {
        expect(decryptOutboxMessage(job).html).toContain(
          'src="https://www.atehna-test.site/images/categories/materiali.png"'
        );
      }

      const replayResponse = await request.post('/api/orders', {
        headers: { 'Idempotency-Key': idempotencyKey },
        data: {
          ...orderData,
          shippingConfigurationVersion: estimate.shippingConfigurationVersion,
          quoteFingerprint: estimate.quoteFingerprint
        }
      });
      expect(replayResponse.status()).toBe(200);
      const replayedJobs = await readOutbox(orderId);
      expect(replayedJobs).toHaveLength(3);
      const replayedCustomer = replayedJobs.find(
        (job) => job.audience === 'customer'
      );
      if (!replayedCustomer) {
        throw new Error('Expected the replayed customer email job.');
      }
      const replayedCustomerMessage = decryptOutboxMessage(replayedCustomer);
      const replayedCustomerContent = [
        replayedCustomerMessage.subject,
        replayedCustomerMessage.html,
        replayedCustomerMessage.text
      ].join('\n');
      expect(replayedCustomerContent.match(ORDER_ACCESS_TOKEN_PATTERN)?.[0]).toBe(
        accessToken
      );

      await database.query(
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
           'e2e-purchase-order.pdf',
           $2,
           1,
           $3,
           now(),
           $4,
           'operational',
           'customer-upload-pdf-v1'
         )`,
        [
          orderId,
          `e2e/order-email-outbox/${crypto.randomUUID()}.pdf`,
          `NAROCILNICA-${orderId}-V1`,
          '0'.repeat(64)
        ]
      );
      // This test owns the email outbox contract, not the separately covered
      // school acceptance workflow. Seed a constraint-valid accepted state so
      // fulfilment status mail can be exercised without moving shared stock.
      const bindingResult = await database.query(
        `update orders
         set commitment_status = 'binding',
             contract_status = 'accepted',
             contract_accepted_at = now(),
             contract_accepted_actor_type = 'system',
             contract_accepted_actor_id = null,
             contract_acceptance_evidence_json =
               '{"channel":"e2e_fixture","action":"accept_order"}'::jsonb,
             committed_at = now()
         where id = $1 and customer_type = 'school'`,
        [orderId]
      );
      expect(bindingResult.rowCount).toBe(1);

      const statusConfirmationResponse = await request.post(
        `/api/admin/orders/${orderId}/status`,
        { data: { status: 'in_progress' } }
      );
      expect(statusConfirmationResponse.status()).toBe(428);
      const statusConfirmationPayload = await statusConfirmationResponse.json() as {
        code?: unknown;
        scope?: unknown;
        action?: unknown;
        eventType?: unknown;
        recipientEmail?: unknown;
        confirmationToken?: unknown;
        deliveries?: unknown;
      };
      expect(statusConfirmationPayload).toMatchObject({
        code: 'CUSTOMER_EMAIL_CONFIRMATION_REQUIRED',
        scope: 'order',
        action: 'change_order_status',
        eventType: 'in_progress',
        recipientEmail: email,
        deliveries: [{
          scope: 'order',
          entityId: orderId,
          eventType: 'in_progress',
          recipientEmail: email
        }]
      });
      expect(typeof statusConfirmationPayload.confirmationToken).toBe('string');
      const customerEmailConfirmationToken = String(
        statusConfirmationPayload.confirmationToken
      );
      expect(await readOutbox(orderId)).toHaveLength(3);

      const statusResponse = await request.post(
        `/api/admin/orders/${orderId}/status`,
        {
          data: {
            status: 'in_progress',
            customerEmailConfirmationToken
          }
        }
      );
      expect(statusResponse.ok()).toBeTruthy();

      jobs = await readOutbox(orderId);
      expect(jobs).toHaveLength(6);
      expectPendingRecipients(
        jobs,
        'in_progress',
        /^order-status:\d+$/u,
        email
      );

      const customerStatus = jobs.find((job) => (
        job.event_type === 'in_progress' && job.audience === 'customer'
      ));
      if (!customerStatus) {
        throw new Error('Expected the customer status email job.');
      }
      const customerStatusMessage = decryptOutboxMessage(customerStatus);
      const customerStatusContent = [
        customerStatusMessage.subject,
        customerStatusMessage.html,
        customerStatusMessage.text
      ].join('\n');
      expect(customerStatusContent).not.toMatch(
        standaloneOrderNumberPattern(orderNumber)
      );
      expect(customerStatusContent).not.toContain(`/admin/orders/${createdOrderId}`);
      for (const statusJob of jobs.filter((job) => job.event_type === 'in_progress')) {
        const rawPayload = JSON.stringify(statusJob.payload_json);
        expect(statusJob.payload_json).toMatchObject({
          version: 1,
          algorithm: 'aes-256-gcm'
        });
        expect(rawPayload).not.toMatch(ORDER_ACCESS_TOKEN_PATTERN);
        const statusMessage = decryptOutboxMessage(statusJob);
        const statusContent = [
          statusMessage.subject,
          statusMessage.html,
          statusMessage.text
        ].join('\n');
        expect(statusContent).not.toMatch(ORDER_ACCESS_TOKEN_PATTERN);
        expect(statusContent).not.toContain('/order/narocilnica');
      }
      const duplicateStatusResponse = await request.post(
        `/api/admin/orders/${orderId}/status`,
        { data: { status: 'in_progress' } }
      );
      expect(duplicateStatusResponse.ok()).toBeTruthy();
      expect(await readOutbox(orderId)).toHaveLength(6);

      const workerResponse = await request.post(
        '/api/admin/e2e/order-email-worker'
      );
      expect(workerResponse.ok()).toBeTruthy();
      expect(await workerResponse.json()).toEqual({
        claimed: 0,
        sent: 0,
        retried: 0,
        failed: 0,
        disabled: true
      });

      jobs = await readOutbox(orderId);
      expect(jobs).toHaveLength(6);
      expect(jobs.every((job) => (
        job.status === 'pending'
        && job.attempts === 0
        && job.claim_id === null
        && job.provider_message_id === null
      ))).toBe(true);
    } finally {
      if (orderId !== null) {
        await database.query(
          `delete from audit_events
           where entity_type = 'order'
             and entity_id = $1
             and action = 'status_changed'`,
          [String(orderId)]
        );
        await database.query('delete from orders where id = $1', [orderId]);
      } else {
        await database.query('delete from orders where email = $1', [email]);
      }

      if (originalSettings) {
        await database.query(
          `insert into order_email_settings (key, config_json, updated_at)
           values ($1, $2::jsonb, $3)
           on conflict (key)
           do update set config_json = excluded.config_json,
                         updated_at = excluded.updated_at`,
          [SETTINGS_KEY, JSON.stringify(originalSettings.config_json), originalSettings.updated_at]
        );
      } else {
        await database.query(
          'delete from order_email_settings where key = $1',
          [SETTINGS_KEY]
        );
      }
    }
  });
});
