import { expect, test } from '@playwright/test';
import pg, { type Pool as PgPool } from 'pg';
import type { OrderEmailSettings } from '@/shared/domain/order/orderEmailSettings';
import { ADMIN_STORAGE_STATE_PATH } from './support/auth';

const { Pool } = pg;
const SETTINGS_KEY = 'order-email-notifications';
const ADMIN_RECIPIENTS = [
  'e2e-orders-primary@example.com',
  'e2e-orders-secondary@example.com'
] as const;

type StoredSettingsRow = {
  config_json: unknown;
  updated_at: Date;
};

type OutboxRow = {
  event_key: string;
  event_type: string;
  audience: 'customer' | 'admin';
  recipient_email: string;
  status: string;
  attempts: number;
  claim_id: string | null;
  provider_message_id: string | null;
};

let database: PgPool;

function enabledE2eSettings(original: OrderEmailSettings): OrderEmailSettings {
  const disabledEvent = { customer: false, admins: false };
  return {
    ...original,
    enabled: true,
    senderName: 'Atehna E2E',
    fromEmail: 'orders@e2e.example.com',
    replyToEmail: 'support@e2e.example.com',
    adminRecipients: [...ADMIN_RECIPIENTS],
    events: {
      order_submitted: { customer: true, admins: true },
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
    `select event_key,
            event_type,
            audience,
            recipient_email,
            status,
            attempts,
            claim_id,
            provider_message_id
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
        notes: '',
        items: [{ variantId: 920001, quantity: 1 }]
      };
      const createResponse = await request.post('/api/orders', {
        headers: { 'Idempotency-Key': idempotencyKey },
        data: orderData
      });
      expect(createResponse.status()).toBe(201);

      const orderResult = await database.query<{ id: string }>(
        'select id from orders where email = $1 order by id desc limit 1',
        [email]
      );
      const createdOrderId = Number(orderResult.rows[0]?.id);
      expect(Number.isSafeInteger(createdOrderId)).toBe(true);
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

      const replayResponse = await request.post('/api/orders', {
        headers: { 'Idempotency-Key': idempotencyKey },
        data: orderData
      });
      expect(replayResponse.status()).toBe(200);
      expect(await readOutbox(orderId)).toHaveLength(3);

      const statusResponse = await request.post(
        `/api/admin/orders/${orderId}/status`,
        { data: { status: 'in_progress' } }
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
