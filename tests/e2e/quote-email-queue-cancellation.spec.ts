import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import pg, { type Pool as PgPool } from 'pg';
import { ADMIN_STORAGE_STATE_PATH } from './support/auth';

const { Pool } = pg;
const QUOTE_CRON_SECRET =
  'e2e-only-quote-cron-secret-with-at-least-32-characters';

type QuoteEmailJobRow = {
  status: string;
  attempts: number;
  claim_id: string | null;
  locked_at: Date | null;
  provider_message_id: string | null;
  sent_at: Date | null;
  cancelled_at: Date | null;
  cancelled_by_actor_id: string | null;
  recipient_name: string | null;
  last_error: string | null;
  payload_json: unknown;
};

let database: PgPool;

async function readJob(jobId: string): Promise<QuoteEmailJobRow> {
  const result = await database.query<QuoteEmailJobRow>(
    `
      select status, attempts, claim_id, locked_at, provider_message_id,
             sent_at, cancelled_at, cancelled_by_actor_id, recipient_name,
             last_error, payload_json
      from quote_email_jobs
      where id = $1
    `,
    [jobId]
  );
  expect(result.rowCount).toBe(1);
  return result.rows[0]!;
}

test.use({ storageState: ADMIN_STORAGE_STATE_PATH });

test.beforeAll(async () => {
  const databaseUrl = process.env.E2E_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('[e2e-preflight] E2E_DATABASE_URL is required.');
  }
  database = new Pool({ connectionString: databaseUrl, ssl: false });
});

test.afterAll(async () => {
  await database.end();
});

test('admin cancellation removes a pending quote email from the worker without sending it', async ({
  page,
  request
}) => {
  test.setTimeout(60_000);
  const token = randomUUID();
  const recipientEmail = `quote-queue-cancel-${token}@example.test`;
  let quoteRequestId: number | null = null;

  try {
    const createResponse = await request.post('/api/admin/quote-requests', {
      data: { mode: 'draft' }
    });
    expect(createResponse.status()).toBe(201);
    const created = await createResponse.json() as {
      quoteRequestId?: unknown;
    };
    quoteRequestId = Number(created.quoteRequestId);
    expect(Number.isSafeInteger(quoteRequestId) && quoteRequestId > 0).toBe(true);

    const inserted = await database.query<{ id: string }>(
      `
        insert into quote_email_jobs (
          quote_request_id, quote_offer_version_id, event_key, event_type,
          audience, recipient_email, recipient_name, payload_json, status,
          attempts, next_attempt_at
        )
        values (
          $1, null, $2, 'quote_request_submitted', 'customer', $3,
          'E2E prejemnik', $4::jsonb, 'pending', 0, now() - interval '1 minute'
        )
        returning id
      `,
      [
        quoteRequestId,
        `e2e-quote-email-cancellation:${token}`,
        recipientEmail,
        JSON.stringify({
          version: 1,
          fixture: 'quote-email-queue-cancellation',
          mustNotBeDelivered: true
        })
      ]
    );
    expect(inserted.rowCount).toBe(1);
    const jobId = inserted.rows[0]!.id;

    expect(await readJob(jobId)).toMatchObject({
      status: 'pending',
      attempts: 0,
      claim_id: null,
      locked_at: null,
      provider_message_id: null,
      sent_at: null,
      cancelled_at: null,
      cancelled_by_actor_id: null
    });

    await page.goto('/admin/email');
    await expect(page.getByTestId('order-email-client-surface')).toHaveAttribute(
      'data-client-ready',
      'true'
    );
    await page.getByRole('tab', { name: 'Ponudbe', exact: true }).click();

    const pendingRow = page.getByTestId(`quote-email-pending-row-${jobId}`);
    await expect(pendingRow).toBeVisible();
    await expect(pendingRow).toContainText(recipientEmail);

    await page.getByTestId(`quote-email-cancel-${jobId}`).click();
    const cancellationDialog = page.getByRole('dialog', {
      name: 'Odstrani e-pošto iz čakalne vrste?'
    });
    await expect(cancellationDialog).toBeVisible();
    await expect(cancellationDialog).toContainText(recipientEmail);

    const deleteResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        new URL(response.url()).pathname ===
          `/api/admin/quote-email-jobs/${jobId}`
    );
    await cancellationDialog
      .getByRole('button', { name: 'Odstrani', exact: true })
      .click();
    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.status()).toBe(200);
    await expect(deleteResponse.json()).resolves.toMatchObject({
      jobId,
      status: 'cancelled'
    });
    await expect(pendingRow).toHaveCount(0);

    const cancelledJob = await readJob(jobId);
    expect(cancelledJob).toMatchObject({
      status: 'cancelled',
      attempts: 0,
      claim_id: null,
      locked_at: null,
      provider_message_id: null,
      sent_at: null,
      recipient_name: null,
      last_error: null,
      payload_json: {
        cancelled: true,
        cancelled_at: expect.any(String)
      }
    });
    expect(cancelledJob.cancelled_at).toBeInstanceOf(Date);
    expect(cancelledJob.cancelled_by_actor_id).toEqual(expect.any(String));
    expect(cancelledJob.cancelled_by_actor_id?.trim()).not.toBe('');

    const workerResponse = await request.get(
      '/api/admin/quote-workflow/process',
      { headers: { Authorization: `Bearer ${QUOTE_CRON_SECRET}` } }
    );
    expect(workerResponse.status()).toBe(200);
    await expect(workerResponse.json()).resolves.toMatchObject({
      success: true,
      disabled: false,
      email: {
        claimed: expect.any(Number),
        sent: expect.any(Number),
        retried: expect.any(Number),
        failed: expect.any(Number)
      }
    });

    expect(await readJob(jobId)).toEqual(cancelledJob);
    const deliveryEvents = await database.query<{ count: number }>(
      `
        select count(*)::int as count
        from quote_events
        where quote_request_id = $1
          and event_type in (
            'quote_email_provider_accepted',
            'quote_email_provider_failed'
          )
          and metadata_json ->> 'jobId' = $2
      `,
      [quoteRequestId, jobId]
    );
    expect(deliveryEvents.rows[0]?.count).toBe(0);
  } finally {
    if (quoteRequestId !== null) {
      const cleanupResponse = await request.delete(
        `/api/admin/quote-requests/${quoteRequestId}`,
        {
          data: {
            reason: `E2E cleanup after quote queue cancellation ${token}`
          }
        }
      );
      if (!cleanupResponse.ok()) {
        throw new Error(
          `[e2e-cleanup] Could not logically remove quote request ${quoteRequestId}; status ${cleanupResponse.status()}.`
        );
      }
    }
  }
});
