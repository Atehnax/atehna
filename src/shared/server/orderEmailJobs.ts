import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { after } from 'next/server';
import type { Pool, PoolClient } from 'pg';
import { isCustomerType } from '@/shared/domain/order/customerType';
import { SCHOOL_PURCHASE_ORDER_PROOF_FORMAT_MARKERS } from '@/shared/domain/order/schoolOrderWorkflow';
import {
  buildPurchaseOrderAccessUrl,
  hashOrderAccessToken
} from '@/shared/server/orderAccess';
import {
  type OrderEmailCustomerOrderSnapshot,
  type OrderEmailJobPayload,
  type OrderEmailOrderSnapshot
} from '@/shared/domain/order/orderEmailTemplates';
import {
  classifyOrderEmailDeliveryValidationFailure,
  classifyResendFailure,
  createOrderEmailDeliveryEnvelope,
  parseOrderEmailDeliveryEnvelope,
  OrderEmailDeliveryEnvelopeValidationError,
  redactOrderEmailDeliveryEnvelope,
  serializeOrderEmailDeliveryEnvelope,
  type OrderEmailDeliveryEnvelope,
  type PersistedOrderEmailMessage,
  type ResendFailure,
  type ResendFailureClassification
} from '@/shared/domain/order/orderEmailDelivery';
import {
  ORDER_EMAIL_EVENT_DEFINITIONS,
  isOrderEmailEventType,
  normalizeOrderEmailSettings,
  toStoredOrderEmailSettings,
  validateOrderEmailSettingsInput,
  type OrderEmailEventType,
  type OrderEmailSettings
} from '@/shared/domain/order/orderEmailSettings';
import {
  isOrderEmailRetryEventCurrent,
  isRetryableOrderEmailFailure
} from '@/shared/domain/order/orderEmailRetryPolicy';
import {
  getOrderEmailSettings,
  isOrderEmailTransportDisabledForE2e,
  isResendApiKeyConfigured
} from '@/shared/server/orderEmailSettings';
import { runOrderEmailWorker } from '@/shared/server/orderEmailWorker';
import {
  decryptOrderEmailDeliveryEnvelope,
  encryptOrderEmailDeliveryEnvelope
} from '@/shared/server/orderEmailDeliveryCipher';

const RESEND_EMAILS_ENDPOINT = 'https://api.resend.com/emails';
const STALE_CLAIM_INTERVAL = '5 minutes';
const MAX_ATTEMPTS = 8;
const MAX_CLAIM_SIZE = 2;
const IMMEDIATE_MAX_JOBS = 21;
const WORKER_DEADLINE_MS = 45_000;
const DEFAULT_SENT_RETENTION_DAYS = 30;
const DEFAULT_PRUNE_LIMIT = 1_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

const ORDER_ACCESS_TOKEN_PATTERN = /ath_order_[A-Za-z0-9_-]{43}/gu;
type EnqueueOrderEmailEventInput = {
  orderId: number;
  eventKey: string;
  eventType: OrderEmailEventType;
  occurredAt?: string;
  previousStatus?: string | null;
  customerOrderAccessToken?: string | null;
};

type ClaimedOrderEmailJob = {
  id: string;
  claimId: string;
  orderId: number;
  attempts: number;
  payloadJson: unknown;
  eventType: OrderEmailEventType;
  audience: 'customer' | 'admin';
  recipientEmail: string;
  envelope?: OrderEmailDeliveryEnvelope;
  payloadEncrypted: boolean;
};

export type OrderEmailProcessingResult = {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
  disabled: boolean;
};

export class OrderEmailDeliveryError extends Error {
  readonly status: number;
  readonly resendFailure: ResendFailure | null;

  constructor(
    message: string,
    status = 502,
    resendFailure: ResendFailure | null = null
  ) {
    super(message);
    this.name = 'OrderEmailDeliveryError';
    this.status = status;
    this.resendFailure =
      resendFailure ??
      (status >= 502 && status <= 504 ? { kind: 'http', status } : null);
  }
}

class OrderEmailClaimPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderEmailClaimPersistenceError';
  }
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoValue(value: unknown): string {
  const parsed = value instanceof Date ? value : new Date(String(value ?? ''));
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}

function optionalString(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  return normalized || null;
}

function redactDeliveryError(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value ?? 'Unknown error');
  return message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, '[email]')
    .replace(/re_[A-Za-z0-9_-]+/gu, '[api-key]')
    .replace(/ath_order_[A-Za-z0-9_-]{43}/gu, '[order-access-token]')
    .slice(0, 2000);
}

function isEncryptedDeliveryPayload(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return [
    'algorithm',
    'ciphertext',
    'initializationVector',
    'authenticationTag'
  ].some((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function parseClaimedOrderEmailEnvelope(
  job: ClaimedOrderEmailJob
): OrderEmailDeliveryEnvelope {
  let persistedValue = job.payloadJson;
  if (job.payloadEncrypted) {
    try {
      persistedValue = decryptOrderEmailDeliveryEnvelope(
        job.payloadJson,
        job.id,
        job.orderId
      );
    } catch {
      throw new OrderEmailDeliveryEnvelopeValidationError(
        '$.encryptedPayload',
        'could not be authenticated or decrypted'
      );
    }
  }
  const envelope = parseOrderEmailDeliveryEnvelope(persistedValue);
  job.envelope = envelope;
  return envelope;
}

function purchaseOrderTokenFromEnvelope(
  envelope: OrderEmailDeliveryEnvelope
): string | null {
  const tokens = new Set(
    [envelope.message.subject, envelope.message.html, envelope.message.text]
      .flatMap((value) => value.match(ORDER_ACCESS_TOKEN_PATTERN) ?? [])
  );
  if (tokens.size === 0) return null;
  if (
    tokens.size !== 1 ||
    envelope.audience !== 'customer' ||
    envelope.eventType !== 'order_submitted'
  ) {
    throw new OrderEmailDeliveryEnvelopeValidationError(
      '$.message',
      'contains an unexpected order access token'
    );
  }
  return tokens.values().next().value ?? null;
}

function clampClaimSize(value: number | undefined): number {
  if (!Number.isFinite(value)) return MAX_CLAIM_SIZE;
  return Math.max(1, Math.min(MAX_CLAIM_SIZE, Math.trunc(value ?? MAX_CLAIM_SIZE)));
}

async function readOrderSnapshot(
  client: PoolClient,
  orderId: number
): Promise<OrderEmailOrderSnapshot | null> {
  const [orderResult, itemsResult] = await Promise.all([
    client.query(
      `
        select
          id,
          order_number,
          customer_type,
          organization_name,
          contact_name,
          email,
          reference,
          subtotal,
          tax,
          shipping,
          total,
          created_at
        from orders
        where id = $1
          and deleted_at is null
          and is_draft = false
        limit 1
      `,
      [orderId]
    ),
    client.query(
      `
        select sku, name, unit, quantity, line_gross, image_url
        from order_items
        where order_id = $1
        order by id asc
      `,
      [orderId]
    )
  ]);
  const row = orderResult.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  return {
    orderId: Number(row.id),
    orderNumber: String(row.order_number ?? `#${orderId}`),
    createdAt: isoValue(row.created_at),
    customer: {
      customerType: isCustomerType(String(row.customer_type ?? ''))
        ? (String(row.customer_type) as 'individual' | 'company' | 'school')
        : 'individual',
      organizationName: optionalString(row.organization_name),
      contactName: String(row.contact_name ?? ''),
      email: String(row.email ?? ''),
      reference: optionalString(row.reference)
    },
    items: itemsResult.rows.map((item) => ({
      sku: String(item.sku ?? ''),
      name: String(item.name ?? ''),
      unit: optionalString(item.unit),
      quantity: Math.max(1, Math.trunc(numberValue(item.quantity))),
      lineGross: numberValue(item.line_gross),
      imageUrl: optionalString(item.image_url)
    })),
    totals: {
      net: numberValue(row.subtotal),
      tax: numberValue(row.tax),
      shipping: numberValue(row.shipping),
      gross: numberValue(row.total)
    }
  };
}

function toCustomerOrderSnapshot(
  order: OrderEmailOrderSnapshot
): OrderEmailCustomerOrderSnapshot {
  return {
    createdAt: order.createdAt,
    customer: order.customer,
    items: order.items,
    totals: order.totals
  };
}

function buildCustomerPurchaseOrderUploadUrl(
  order: OrderEmailOrderSnapshot,
  input: EnqueueOrderEmailEventInput,
  settings: OrderEmailSettings
): string | null {
  if (
    input.eventType !== 'order_submitted' ||
    order.customer.customerType !== 'school' ||
    !input.customerOrderAccessToken
  ) {
    return null;
  }
  try {
    const relativeUrl = buildPurchaseOrderAccessUrl(
      input.customerOrderAccessToken
    );
    const absoluteUrl = new URL(relativeUrl, settings.siteUrl);
    const settingsOrigin = new URL(settings.siteUrl).origin;
    return absoluteUrl.protocol === 'https:' &&
      absoluteUrl.origin === settingsOrigin
      ? absoluteUrl.toString()
      : null;
  } catch {
    return null;
  }
}

export async function enqueueOrderEmailEvent(
  client: PoolClient,
  input: EnqueueOrderEmailEventInput
): Promise<string[]> {
  if (!Number.isFinite(input.orderId) || !isOrderEmailEventType(input.eventType)) {
    return [];
  }
  const settings = await getOrderEmailSettings(client);
  if (!settings.enabled) return [];
  const eventSettings = settings.events[input.eventType];
  if (!eventSettings?.customer && !eventSettings?.admins) return [];

  const order = await readOrderSnapshot(client, input.orderId);
  if (!order) return [];

  const recipients: Array<{
    audience: 'customer' | 'admin';
    email: string;
    name: string | null;
  }> = [];
  if (eventSettings.customer && EMAIL_PATTERN.test(order.customer.email)) {
    recipients.push({
      audience: 'customer',
      email: order.customer.email.trim().toLowerCase(),
      name: order.customer.contactName.trim() || null
    });
  }
  if (eventSettings.admins) {
    for (const email of settings.adminRecipients) {
      recipients.push({ audience: 'admin', email, name: null });
    }
  }
  if (recipients.length === 0) return [];

  const settingsSnapshot = toStoredOrderEmailSettings(settings);
  const purchaseOrderUploadUrl =
    buildCustomerPurchaseOrderUploadUrl(
      order,
      input,
      settings
    );
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const insertedIds: string[] = [];
  for (const recipient of recipients) {
    const payloadBase = {
      eventType: input.eventType,
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      occurredAt,
      previousStatus: input.previousStatus ?? null,
      settingsSnapshot
    };
    const payload: OrderEmailJobPayload =
      recipient.audience === 'admin'
        ? {
            ...payloadBase,
            audience: 'admin',
            order
          }
        : {
            ...payloadBase,
            audience: 'customer',
            order: toCustomerOrderSnapshot(order),
            purchaseOrderUploadUrl
          };
    const envelope = createOrderEmailDeliveryEnvelope(payload);
    const serializedEnvelope = serializeOrderEmailDeliveryEnvelope(envelope);
    const jobId = randomUUID();
    const encryptedEnvelope = encryptOrderEmailDeliveryEnvelope(
      serializedEnvelope,
      jobId,
      input.orderId
    );
    const result = await client.query(
      `
        insert into order_email_jobs (
          id,
          order_id,
          event_key,
          event_type,
          audience,
          recipient_email,
          recipient_name,
          payload_json
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        on conflict do nothing
        returning id
      `,
      [
        jobId,
        input.orderId,
        input.eventKey,
        envelope.eventType,
        envelope.audience,
        envelope.recipient.email,
        envelope.recipient.name,
        JSON.stringify(encryptedEnvelope)
      ]
    );
    if (result.rows[0]?.id) insertedIds.push(String(result.rows[0].id));
  }
  return insertedIds;
}

async function claimDueOrderEmailJobs(
  pool: Pool,
  options: { orderId?: number; limit?: number } = {}
): Promise<ClaimedOrderEmailJob[]> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await client.query(
      `
        select id, order_id, event_type, audience, recipient_email,
               attempts, payload_json
        from order_email_jobs
        where (
          (status = 'pending' and next_attempt_at <= now())
          or (
            status = 'processing'
            and locked_at <= now() - $2::interval
          )
        )
          and ($1::bigint is null or order_id = $1)
        order by next_attempt_at asc, created_at asc
        for update skip locked
        limit $3
      `,
      [options.orderId ?? null, STALE_CLAIM_INTERVAL, clampClaimSize(options.limit)]
    );
    const claimed: ClaimedOrderEmailJob[] = [];
    for (const row of result.rows) {
      const claimId = randomUUID();
      const claimResult = await client.query(
        `
          update order_email_jobs
          set status = 'processing',
              attempts = attempts + 1,
              claim_id = $2,
              locked_at = now(),
              updated_at = now()
          where id = $1
        `,
        [row.id, claimId]
      );
      if ((claimResult.rowCount ?? 0) !== 1) {
        throw new OrderEmailClaimPersistenceError(
          `Claim update did not affect exactly one email job (${row.id}).`
        );
      }
      claimed.push({
        id: String(row.id),
        claimId,
        orderId: Number(row.order_id),
        attempts: Math.max(1, Math.trunc(numberValue(row.attempts)) + 1),
        payloadJson: row.payload_json,
        eventType: String(row.event_type) as OrderEmailEventType,
        audience: row.audience === 'admin' ? 'admin' : 'customer',
        recipientEmail: String(row.recipient_email),
        payloadEncrypted: isEncryptedDeliveryPayload(row.payload_json)
      });
    }
    await client.query('commit');
    return claimed;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function persistEncryptedClaimedEnvelope(
  pool: Pool,
  job: ClaimedOrderEmailJob,
  envelope: OrderEmailDeliveryEnvelope
): Promise<void> {
  let encryptedPayload: string;
  try {
    encryptedPayload = JSON.stringify(
      encryptOrderEmailDeliveryEnvelope(
        serializeOrderEmailDeliveryEnvelope(envelope),
        job.id,
        job.orderId
      )
    );
  } catch {
    throw new OrderEmailDeliveryEnvelopeValidationError(
      '$.encryptedPayload',
      'could not be encrypted'
    );
  }
  const result = await pool.query(
    `
      update order_email_jobs
      set payload_json = $3::jsonb,
          updated_at = now()
      where id = $1
        and claim_id = $2
    `,
    [job.id, job.claimId, encryptedPayload]
  );
  if ((result.rowCount ?? 0) !== 1) {
    throw new OrderEmailClaimPersistenceError(
      `Legacy payload encryption lost its email job claim (${job.id}).`,
    );
  }
  job.payloadEncrypted = true;
  job.payloadJson = JSON.parse(encryptedPayload) as unknown;
}

async function validatePurchaseOrderTokenBeforeDelivery(
  pool: Pool | PoolClient,
  job: ClaimedOrderEmailJob,
  envelope: OrderEmailDeliveryEnvelope
): Promise<void> {
  const token = purchaseOrderTokenFromEnvelope(envelope);
  if (!token) return;
  const result = await pool.query<{ active: boolean }>(
    `
      select exists (
        select 1
        from order_access_tokens token_record
        join orders email_order
          on email_order.id = token_record.order_id
        where token_record.token_hash = $1
          and token_record.order_id = $2
          and $3 = any(token_record.scopes)
          and token_record.revoked_at is null
          and token_record.expires_at > now()
          and email_order.customer_type = 'school'
          and email_order.deleted_at is null
          and email_order.status <> 'cancelled'
          and email_order.commitment_status = 'pending_confirmation'
          and not exists (
            select 1
            from order_documents purchase_order
            where purchase_order.order_id = email_order.id
              and purchase_order.type = 'purchase_order'
              and purchase_order.deleted_at is null
              and purchase_order.format_marker = any($4::text[])
              and purchase_order.order_pricing_revision = email_order.pricing_revision
          )
      ) as active
    `,
    [
      hashOrderAccessToken(token),
      job.orderId,
      'purchase_order',
      [...SCHOOL_PURCHASE_ORDER_PROOF_FORMAT_MARKERS]
    ]
  );
  if (result.rows[0]?.active !== true) {
    throw new OrderEmailDeliveryEnvelopeValidationError(
      '$.message',
      'contains an expired, revoked, or mismatched purchase-order access token'
    );
  }
}

async function markOrderEmailJobSent(
  pool: Pool,
  job: ClaimedOrderEmailJob,
  providerMessageId: string,
  envelope: OrderEmailDeliveryEnvelope
): Promise<void> {
  const redactedPayload = JSON.stringify(redactOrderEmailDeliveryEnvelope(envelope));
  const result = await pool.query(
    `
      update order_email_jobs
      set status = 'sent',
          recipient_name = null,
          payload_json = $4::jsonb,
          claim_id = null,
          locked_at = null,
          provider_message_id = $3,
          last_error = null,
          sent_at = coalesce(sent_at, now()),
          updated_at = now()
      where id = $1
        and claim_id = $2
    `,
    [job.id, job.claimId, providerMessageId, redactedPayload]
  );
  if ((result.rowCount ?? 0) !== 1) {
    throw new OrderEmailClaimPersistenceError(
      `Sent update lost its email job claim (${job.id}).`
    );
  }
}

async function markOrderEmailJobFailed(
  pool: Pool,
  job: ClaimedOrderEmailJob,
  error: unknown,
  classification: ResendFailureClassification
): Promise<'retried' | 'failed'> {
  const terminal =
    classification.disposition === 'terminal' || job.attempts >= MAX_ATTEMPTS;
  const outcome = terminal ? 'failed' : 'retried';
  const invalidPayload =
    terminal && classification.category === 'invalid_payload'
      ? JSON.stringify(
          job.envelope
            ? redactOrderEmailDeliveryEnvelope(job.envelope)
            : {
                version: 2,
                redacted: true,
                eventType: job.eventType,
                audience: job.audience
              }
        )
      : null;
  const fallbackRetryDelayMs = Math.min(
    6 * 60 * 60 * 1_000,
    30_000 * 2 ** Math.max(0, Math.min(job.attempts, 10) - 1)
  );
  const retryDelayMs = classification.retryAfterMs ?? fallbackRetryDelayMs;
  const result = await pool.query(
    `
      update order_email_jobs
      set status = $3,
          claim_id = null,
          locked_at = null,
          next_attempt_at = case
            when $3 = 'pending' then now() + ($4::bigint * interval '1 millisecond')
            else next_attempt_at
          end,
          last_error = $5,
          payload_json = coalesce($6::jsonb, payload_json),
          updated_at = now()
      where id = $1
        and claim_id = $2
    `,
    [
      job.id,
      job.claimId,
      outcome === 'failed' ? 'failed' : 'pending',
      retryDelayMs,
      `[${classification.category}] ${redactDeliveryError(error)}`,
      invalidPayload
    ]
  );
  if ((result.rowCount ?? 0) !== 1) {
    throw new OrderEmailClaimPersistenceError(
      `Failure update lost its email job claim (${job.id}).`
    );
  }
  return outcome;
}

async function readProviderError(response: Response): Promise<string> {
  const text = (await response.text().catch(() => '')).slice(0, 1500);
  if (!text) return `Resend je vrnil HTTP ${response.status}.`;
  try {
    const parsed = JSON.parse(text) as { message?: unknown; name?: unknown };
    const providerMessage = optionalString(parsed.message);
    const providerName = optionalString(parsed.name);
    return [providerName, providerMessage].filter(Boolean).join(': ') || `Resend je vrnil HTTP ${response.status}.`;
  } catch {
    return `Resend je vrnil HTTP ${response.status}.`;
  }
}

async function sendOrderEmailMessage(
  message: PersistedOrderEmailMessage,
  idempotencyKey: string
): Promise<string> {
  if (isOrderEmailTransportDisabledForE2e()) {
    throw new OrderEmailDeliveryError('Pošiljanje e-pošte je v E2E okolju onemogočeno.', 503);
  }
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new OrderEmailDeliveryError('RESEND_API_KEY ni nastavljen.', 503);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let response: Response;
  try {
    response = await fetch(RESEND_EMAILS_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({
        from: message.from,
        to: [message.to],
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.attachments?.length
          ? { attachments: message.attachments }
          : {})
      }),
      cache: 'no-store',
      signal: controller.signal
    });
  } catch {
    if (controller.signal.aborted) {
      throw new OrderEmailDeliveryError('Čas za povezavo s ponudnikom e-pošte je potekel.', 504);
    }
    throw new OrderEmailDeliveryError(
      'Povezava s ponudnikom e-po\u0161te ni uspela.',
      502,
      { kind: 'network' }
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new OrderEmailDeliveryError(
      await readProviderError(response),
      response.status,
      {
        kind: 'http',
        status: response.status,
        retryAfter: response.headers.get('retry-after')
      }
    );
  }
  const body = (await response.json().catch(() => ({}))) as { id?: unknown };
  const providerMessageId = optionalString(body.id);
  if (!providerMessageId) {
    throw new OrderEmailDeliveryError('Ponudnik e-pošte ni vrnil ID-ja sporočila.');
  }
  return providerMessageId;
}

async function deliverOrderEmailWhileRecipientCurrent(
  pool: Pool,
  job: ClaimedOrderEmailJob,
  envelope: OrderEmailDeliveryEnvelope
): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const orderResult = await client.query(
      `select email, status, contract_status, is_draft, deleted_at
       from orders
       where id = $1
       for share`,
      [job.orderId]
    );
    await client.query(
      `select key
       from order_email_settings
       where key = 'order-email-notifications'
       for share`
    );
    const settings = await getOrderEmailSettings(client);
    const currentOrder = orderResult.rows[0];
    const orderLifecycleIsCurrent =
      currentOrder &&
      currentOrder.is_draft === false &&
      currentOrder.deleted_at === null &&
      typeof currentOrder.status === 'string' &&
      isOrderEmailRetryEventCurrent({
        eventType: job.eventType,
        orderStatus: currentOrder.status,
        contractStatus:
          currentOrder.contract_status === null
            ? null
            : String(currentOrder.contract_status)
      });
    if (!orderLifecycleIsCurrent) {
      throw new OrderEmailDeliveryEnvelopeValidationError(
        '$.eventType',
        '[obsolete_order] no longer matches the current order lifecycle'
      );
    }

    const jobRecipient = normalizedRetryRecipient(job.recipientEmail);
    const envelopeRecipient = normalizedRetryRecipient(envelope.recipient.email);
    const messageRecipient = normalizedRetryRecipient(envelope.message.to);
    const currentRecipient = job.audience === 'customer'
      ? normalizedRetryRecipient(currentOrder.email)
      : jobRecipient;
    const currentAdminRecipients = new Set(
      settings.adminRecipients
        .map(normalizedRetryRecipient)
        .filter((recipient): recipient is string => recipient !== null)
    );
    const envelopeMatchesClaim =
      envelope.eventType === job.eventType &&
      envelope.audience === job.audience &&
      envelopeRecipient !== null &&
      envelopeRecipient === jobRecipient &&
      messageRecipient === jobRecipient;
    const recipientIsCurrent =
      jobRecipient !== null &&
      currentRecipient === jobRecipient &&
      (job.audience === 'customer' || currentAdminRecipients.has(jobRecipient));
    if (!envelopeMatchesClaim || !recipientIsCurrent) {
      throw new OrderEmailDeliveryEnvelopeValidationError(
        '$.recipient.email',
        '[stale_recipient] is no longer an authorized recipient'
      );
    }

    await validatePurchaseOrderTokenBeforeDelivery(client, job, envelope);
    const providerMessageId = await sendOrderEmailMessage(
      envelope.message,
      `atehna-order-email/${job.id}`
    );
    await client.query('commit');
    return providerMessageId;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function classifyOrderEmailJobFailure(
  error: unknown,
  nowMs: number
): ResendFailureClassification {
  const validationFailure =
    classifyOrderEmailDeliveryValidationFailure(error);
  if (validationFailure) return validationFailure;

  if (error instanceof OrderEmailDeliveryError) {
    if (error.resendFailure) {
      return classifyResendFailure(error.resendFailure, nowMs);
    }
    if (error.status === 504) {
      return classifyResendFailure({ kind: 'network' }, nowMs);
    }
  }
  return classifyResendFailure({ kind: 'http', status: 400 }, nowMs);
}

export async function processDueOrderEmailJobs(
  pool: Pool,
  options: {
    orderId?: number;
    maxJobs?: number;
    deadlineMs?: number;
  } = {}
): Promise<OrderEmailProcessingResult> {
  if (isOrderEmailTransportDisabledForE2e()) {
    return { claimed: 0, sent: 0, retried: 0, failed: 0, disabled: true };
  }

  return runOrderEmailWorker<ClaimedOrderEmailJob>(
    {
      maxJobs: options.maxJobs,
      deadlineMs: options.deadlineMs
    },
    {
      readEnabled: async () =>
        (await getOrderEmailSettings(pool)).enabled &&
        isResendApiKeyConfigured(),
      claimJobs: (limit) =>
        claimDueOrderEmailJobs(pool, { orderId: options.orderId, limit }),
      processJob: async (job) => {
        const envelope = parseClaimedOrderEmailEnvelope(job);
        if (!job.payloadEncrypted) {
          await persistEncryptedClaimedEnvelope(pool, job, envelope);
        }
        const providerMessageId = await deliverOrderEmailWhileRecipientCurrent(
          pool,
          job,
          envelope
        );
        try {
          await markOrderEmailJobSent(pool, job, providerMessageId, envelope);
        } catch (error) {
          if (error instanceof OrderEmailClaimPersistenceError) throw error;
          throw new OrderEmailClaimPersistenceError(
            `Unable to persist sent email job ${job.id}: ${redactDeliveryError(error)}`
          );
        }
      },
      handleJobError: async (job, error) => {
        if (error instanceof OrderEmailClaimPersistenceError) throw error;
        const classification = classifyOrderEmailJobFailure(error, Date.now());
        const outcome = await markOrderEmailJobFailed(
          pool,
          job,
          error,
          classification
        );
        console.error('[orders.email-job] delivery failed', {
          jobId: job.id,
          orderId: job.orderId,
          attempt: job.attempts,
          disposition: classification.disposition,
          category: classification.category,
          message: redactDeliveryError(error)
        });
        return outcome;
      }
    }
  );
}

export function scheduleOrderEmailJobs(pool: Pool, orderId?: number): void {
  try {
    after(async () => {
      try {
        await processDueOrderEmailJobs(pool, {
          orderId,
          maxJobs: IMMEDIATE_MAX_JOBS,
          deadlineMs: WORKER_DEADLINE_MS
        });
      } catch (error) {
        console.error('[orders.email-job] background processing failed', {
          orderId: orderId ?? null,
          message: redactDeliveryError(error)
        });
      }
    });
  } catch (error) {
    console.error('[orders.email-job] scheduling failed', {
      orderId: orderId ?? null,
      message: redactDeliveryError(error)
    });
  }
}

export async function pruneSentOrderEmailJobs(
  pool: Pool,
  options: { retentionDays?: number; limit?: number } = {}
): Promise<number> {
  const retentionDays = Math.max(
    1,
    Math.min(
      3_650,
      Math.trunc(options.retentionDays ?? DEFAULT_SENT_RETENTION_DAYS)
    )
  );
  const limit = Math.max(
    1,
    Math.min(5_000, Math.trunc(options.limit ?? DEFAULT_PRUNE_LIMIT))
  );
  const result = await pool.query(
    `
      with expired as (
        select id
        from order_email_jobs
        where status = 'sent'
          and sent_at < now() - ($1::integer * interval '1 day')
        order by sent_at asc, id asc
        for update skip locked
        limit $2
      )
      delete from order_email_jobs jobs
      using expired
      where jobs.id = expired.id
    `,
    [retentionDays, limit]
  );
  return result.rowCount ?? 0;
}

export type FailedOrderEmailRetryDelivery = Readonly<{
  jobId: string;
  jobUpdatedAt: string;
  orderId: number;
  eventType: OrderEmailEventType;
  eventLabel: string;
  recipientEmail: string;
}>;

export type FailedOrderEmailRetryPlan = Readonly<{
  totalFailedCount: number;
  eligibleJobIds: readonly string[];
  customerDeliveries: readonly FailedOrderEmailRetryDelivery[];
  customerBatchAction: string;
  skippedCount: number;
}>;

type FailedOrderEmailRetryRow = {
  id: string;
  order_id: string | number;
  event_type: string;
  audience: string;
  recipient_email: string;
  payload_json: unknown;
  attempts: string | number;
  last_error: string | null;
  provider_message_id: string | null;
  sent_at: string | Date | null;
  updated_at: string | Date;
  order_email: string | null;
  order_status: string | null;
  contract_status: string | null;
  is_draft: boolean | null;
  deleted_at: string | Date | null;
};

const orderEmailEventLabels = new Map<OrderEmailEventType, string>(
  ORDER_EMAIL_EVENT_DEFINITIONS.map((definition) => [
    definition.value,
    definition.label
  ])
);

function normalizedRetryRecipient(value: unknown): string | null {
  const recipient = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return recipient.length <= 320 && EMAIL_PATTERN.test(recipient)
    ? recipient
    : null;
}

export async function planFailedOrderEmailJobRetries(
  client: PoolClient,
  settings: OrderEmailSettings
): Promise<FailedOrderEmailRetryPlan> {
  const result = await client.query<FailedOrderEmailRetryRow>(
    `
      select
        job.id,
        job.order_id,
        job.event_type,
        job.audience,
        job.recipient_email,
        job.payload_json,
        job.attempts,
        job.last_error,
        job.provider_message_id,
        job.sent_at,
        job.updated_at,
        orders.email as order_email,
        orders.status as order_status,
        orders.contract_status,
        orders.is_draft,
        orders.deleted_at
      from order_email_jobs job
      join orders on orders.id = job.order_id
      where job.status = 'failed'
      order by job.updated_at desc, job.created_at desc, job.id desc
      for update of job
      for share of orders
    `
  );

  const eligibleJobIds: string[] = [];
  const customerDeliveries: FailedOrderEmailRetryDelivery[] = [];
  const currentAdminRecipients = new Set(
    settings.adminRecipients.map((recipient) => recipient.trim().toLowerCase())
  );
  const seenDeliveryKeys = new Set<string>();

  for (const row of result.rows) {
    const eventType = String(row.event_type ?? '');
    const audience = row.audience === 'admin'
      ? 'admin'
      : row.audience === 'customer'
        ? 'customer'
        : null;
    const recipientEmail = normalizedRetryRecipient(row.recipient_email);
    const orderId = Number(row.order_id);
    if (
      !isOrderEmailEventType(eventType) ||
      audience === null ||
      recipientEmail === null ||
      !Number.isSafeInteger(orderId) ||
      orderId <= 0
    ) {
      continue;
    }

    const deliveryKey = `${orderId}:${eventType}:${audience}:${recipientEmail}`;
    if (seenDeliveryKeys.has(deliveryKey)) continue;
    seenDeliveryKeys.add(deliveryKey);

    const eventSettings = settings.events[eventType];
    const audienceEnabled = audience === 'customer'
      ? eventSettings.customer
      : eventSettings.admins;
    if (
      !settings.enabled ||
      !audienceEnabled ||
      !isRetryableOrderEmailFailure(row.last_error) ||
      row.provider_message_id !== null ||
      row.sent_at !== null ||
      row.is_draft !== false ||
      row.deleted_at !== null ||
      typeof row.order_status !== 'string' ||
      !isOrderEmailRetryEventCurrent({
        eventType,
        orderStatus: row.order_status,
        contractStatus: row.contract_status
      })
    ) {
      continue;
    }

    const currentRecipient = audience === 'customer'
      ? normalizedRetryRecipient(row.order_email)
      : recipientEmail;
    if (
      currentRecipient !== recipientEmail ||
      (audience === 'admin' && !currentAdminRecipients.has(recipientEmail))
    ) {
      continue;
    }

    const job: ClaimedOrderEmailJob = {
      id: String(row.id),
      claimId: '',
      orderId,
      attempts: Math.max(0, Math.trunc(numberValue(row.attempts))),
      payloadJson: row.payload_json,
      eventType,
      audience,
      recipientEmail,
      payloadEncrypted: isEncryptedDeliveryPayload(row.payload_json)
    };
    try {
      const envelope = parseClaimedOrderEmailEnvelope(job);
      if (
        envelope.eventType !== eventType ||
        envelope.audience !== audience ||
        normalizedRetryRecipient(envelope.recipient.email) !== recipientEmail
      ) {
        continue;
      }
      await validatePurchaseOrderTokenBeforeDelivery(client, job, envelope);
    } catch {
      continue;
    }

    eligibleJobIds.push(job.id);
    if (audience === 'customer') {
      customerDeliveries.push({
        jobId: job.id,
        jobUpdatedAt: isoValue(row.updated_at),
        orderId,
        eventType,
        eventLabel: orderEmailEventLabels.get(eventType) ?? eventType,
        recipientEmail
      });
    }
  }

  const customerBatchDigest = createHash('sha256')
    .update(
      customerDeliveries
        .map((delivery) => `${delivery.jobId}:${delivery.jobUpdatedAt}`)
        .sort()
        .join('\n'),
      'utf8'
    )
    .digest('hex');
  return {
    totalFailedCount: result.rows.length,
    eligibleJobIds,
    customerDeliveries,
    customerBatchAction: `retry_failed_order_emails:${customerBatchDigest}`,
    skippedCount: result.rows.length - eligibleJobIds.length
  };
}

export async function resetFailedOrderEmailJobs(
  client: PoolClient,
  eligibleJobIds: readonly string[]
): Promise<number> {
  if (eligibleJobIds.length === 0) return 0;
  const result = await client.query(
    `
      update order_email_jobs
      set status = 'pending',
          attempts = 0,
          next_attempt_at = now(),
          claim_id = null,
          locked_at = null,
          last_error = null,
          updated_at = now()
      where status = 'failed'
        and id = any($1::uuid[])
    `,
    [eligibleJobIds]
  );
  return result.rowCount ?? 0;
}

export async function sendOrderEmailTest(
  input: unknown,
  recipientInput: unknown
): Promise<{ providerMessageId: string }> {
  const recipient = typeof recipientInput === 'string'
    ? recipientInput.trim().toLowerCase()
    : '';
  if (!EMAIL_PATTERN.test(recipient) || recipient.length > 320) {
    throw new OrderEmailDeliveryError('Vnesite veljaven naslov za testno e-pošto.', 400);
  }
  const rawConfig = input && typeof input === 'object' && !Array.isArray(input)
    ? {
        ...(input as Record<string, unknown>),
        enabled: false,
        adminRecipients: []
      }
    : input;
  const validationErrors = validateOrderEmailSettingsInput(rawConfig);
  if (validationErrors.length > 0) {
    throw new OrderEmailDeliveryError(validationErrors[0], 400);
  }
  const config = normalizeOrderEmailSettings(input);
  if (!config.senderName) {
    throw new OrderEmailDeliveryError('Vnesite ime pošiljatelja.', 400);
  }
  if (!config.fromEmail) {
    throw new OrderEmailDeliveryError('Vnesite e-poštni naslov pošiljatelja.', 400);
  }
  if (isOrderEmailTransportDisabledForE2e()) {
    throw new OrderEmailDeliveryError(
      'Po\u0161iljanje e-po\u0161te je v E2E okolju onemogo\u010deno.',
      503
    );
  }
  if (!isResendApiKeyConfigured()) {
    throw new OrderEmailDeliveryError('RESEND_API_KEY ni nastavljen.', 503);
  }

  const settingsSnapshot = toStoredOrderEmailSettings({
    ...config,
    subjectPrefix: `${config.subjectPrefix || 'Atehna'} · PREIZKUS`
  } satisfies OrderEmailSettings);
  const now = new Date().toISOString();
  const payload: OrderEmailJobPayload = {
    eventType: 'order_submitted',
    audience: 'admin',
    recipientEmail: recipient,
    recipientName: null,
    occurredAt: now,
    previousStatus: null,
    settingsSnapshot,
    order: {
      orderId: 0,
      orderNumber: '#PREIZKUS',
      createdAt: now,
      customer: {
        customerType: 'company',
        organizationName: 'Primer naročnika',
        contactName: 'Testni prejemnik',
        email: recipient,
        reference: 'TEST'
      },
      items: [
        {
          sku: 'TEST-001',
          name: 'Testni izdelek',
          unit: 'kos',
          quantity: 1,
          lineGross: 12.2,
          imageUrl: '/images/categories/materiali.png'
        }
      ],
      totals: {
        net: 10,
        tax: 2.2,
        shipping: 0,
        gross: 12.2
      }
    }
  };
  const envelope = createOrderEmailDeliveryEnvelope(payload);
  const providerMessageId = await sendOrderEmailMessage(
    envelope.message,
    `atehna-order-email-test/${randomUUID()}`
  );
  return { providerMessageId };
}
