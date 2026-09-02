import 'server-only';

import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import type { Pool, PoolClient } from 'pg';
import {
  QUOTE_EMAIL_EVENT_DEFAULTS,
  normalizeQuoteEmailSettings,
  type QuoteEmailEventType
} from '@/shared/domain/quote/quoteEmailSettings';
import {
  normalizeEmailMessageAttachment,
  type EmailMessageAttachment
} from '@/shared/domain/order/orderEmailTemplates';
import { getOrderEmailSettings } from '@/shared/server/orderEmailSettings';
import { isQuoteEmailDeliveryEnabled } from '@/shared/server/quoteFeatureFlags';
import {
  decryptQuoteEmailEnvelope,
  encryptQuoteEmailEnvelope
} from '@/shared/server/quoteEmailDeliveryCipher';
import { lockQuoteWorkflow } from '@/shared/server/quoteAccess';

export type { QuoteEmailEventType } from '@/shared/domain/quote/quoteEmailSettings';

type QuoteEmailAudience = 'customer' | 'admin';

type QuoteEmailMessage = {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  attachments?: readonly EmailMessageAttachment[];
};

type QuoteEmailEnvelope = {
  version: 1;
  eventType: QuoteEmailEventType;
  audience: QuoteEmailAudience;
  quoteRequestId: number;
  quoteOfferVersionId: number | null;
  message: QuoteEmailMessage;
};

type EnqueueQuoteEmailInput = {
  quoteRequestId: number;
  quoteOfferVersionId?: number | null;
  eventKey: string;
  eventType: QuoteEmailEventType;
  offerUrl?: string | null;
  otpCode?: string | null;
  detail?: string | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const MAX_ATTEMPTS = 8;
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function normalizedRecipientEmail(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized.length <= 320 && EMAIL_PATTERN.test(normalized)
    ? normalized
    : null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

function fromHeader(name: string, email: string): string {
  const safeName = name.replace(/[\r\n<>]/gu, ' ').trim();
  return safeName ? `"${safeName}" <${email}>` : email;
}

function render(value: string, variables: Record<string, string>): string {
  return value.replace(/\{\{\s*([a-z_]+)\s*\}\}/gu, (_match, key: string) =>
    variables[key] ?? ''
  );
}

async function quoteSettings(client: PoolClient) {
  const result = await client.query(
    `select config_json from quote_email_settings where key = 'default'`
  );
  return normalizeQuoteEmailSettings(result.rows[0]?.config_json);
}

async function quoteIdentity(client: PoolClient, input: EnqueueQuoteEmailInput) {
  const result = await client.query(
    `
      select
        request.request_number,
        request.email,
        request.contact_name,
        offer.offer_number
      from quote_requests request
      left join quote_offer_versions offer
        on offer.id = $2
       and offer.quote_request_id = request.id
      where request.id = $1
        and request.voided_at is null
    `,
    [input.quoteRequestId, input.quoteOfferVersionId ?? null]
  );
  return result.rows[0] as
    | {
        request_number: string;
        email: string;
        contact_name: string;
        offer_number: string | null;
      }
    | undefined;
}

export async function enqueueQuoteEmailEvent(
  client: PoolClient,
  input: EnqueueQuoteEmailInput
): Promise<string[]> {
  const [shared, settings, identity] = await Promise.all([
    getOrderEmailSettings(client),
    quoteSettings(client),
    quoteIdentity(client, input)
  ]);
  if (!settings.enabled && input.eventType !== 'quote_access_otp') {
    return [];
  }
  if (!identity) {
    throw new Error('Quote email identity does not exist.');
  }
  const envelopeSenderEmail = EMAIL_PATTERN.test(shared.fromEmail)
    ? shared.fromEmail
    : 'delivery-profile-pending@invalid.local';
  const defaults = QUOTE_EMAIL_EVENT_DEFAULTS[input.eventType];
  const configuredEvent = settings.events[input.eventType];
  const customerEnabled =
    input.eventType === 'quote_access_otp' || configuredEvent.customer;
  const adminEnabled = configuredEvent.admins;
  const recipients: Array<{
    audience: QuoteEmailAudience;
    email: string;
    name: string | null;
  }> = [];
  if (customerEnabled && EMAIL_PATTERN.test(identity.email)) {
    recipients.push({
      audience: 'customer',
      email: identity.email.toLowerCase(),
      name: identity.contact_name || null
    });
  }
  if (adminEnabled) {
    for (const email of shared.adminRecipients) {
      if (EMAIL_PATTERN.test(email)) {
        recipients.push({ audience: 'admin', email: email.toLowerCase(), name: null });
      }
    }
  }
  if (recipients.length === 0) {
    return [];
  }
  const variables = {
    request_number: identity.request_number,
    offer_number: identity.offer_number ?? identity.request_number,
    otp_code: input.otpCode ?? ''
  };
  const headerText = shared.headerText.trim();
  const footerText = shared.footerText.trim();
  const attachment = normalizeEmailMessageAttachment(shared.imageAttachment);
  const configuredTemplate = settings.templates[
    input.eventType
  ] as unknown as Record<string, unknown>;
  const inserted: string[] = [];
  for (const recipient of recipients) {
    const audienceTemplate =
      configuredTemplate[recipient.audience] &&
      typeof configuredTemplate[recipient.audience] === 'object'
        ? (configuredTemplate[recipient.audience] as Record<string, unknown>)
        : {};
    const subject = render(
      typeof audienceTemplate.subject === 'string'
        ? audienceTemplate.subject
        : defaults.subject,
      variables
    );
    const baseBody = render(
      typeof audienceTemplate.body === 'string'
        ? audienceTemplate.body
        : defaults.body,
      variables
    );
    const detail = input.detail?.trim() || '';
    const action =
      input.offerUrl && recipient.audience === 'customer'
        ? `Preglej ponudbo: ${input.offerUrl}`
        : '';
    const eventBody = `${baseBody}${detail ? `\n\n${detail}` : ''}`;
    const body = [headerText, eventBody, action, footerText]
      .filter(Boolean)
      .join('\n\n');
    const actionHtml =
      input.offerUrl && recipient.audience === 'customer'
        ? `<p><a href="${escapeHtml(input.offerUrl)}">Preglej ponudbo</a></p>`
        : '';
    const htmlBody = eventBody;
    const message: QuoteEmailMessage = {
      from: fromHeader(shared.senderName, envelopeSenderEmail),
      to: recipient.email,
      ...(shared.replyToEmail ? { replyTo: shared.replyToEmail } : {}),
      subject: `[${shared.subjectPrefix || 'Atehna'}] ${subject}`,
      text: body,
      html: `<!doctype html><html lang="sl"><body><div style="max-width:680px;margin:auto;font-family:Arial,sans-serif">${headerText ? `<p style="white-space:pre-line">${escapeHtml(headerText)}</p>` : ''}<h1>${escapeHtml(subject)}</h1><p style="white-space:pre-line">${escapeHtml(htmlBody)}</p>${actionHtml}${footerText ? `<p style="white-space:pre-line;border-top:1px solid #e2e8f0;padding-top:18px;color:#64748b">${escapeHtml(footerText)}</p>` : ''}</div></body></html>`,
      ...(attachment ? { attachments: [attachment] } : {})
    };
    const envelope: QuoteEmailEnvelope = {
      version: 1,
      eventType: input.eventType,
      audience: recipient.audience,
      quoteRequestId: input.quoteRequestId,
      quoteOfferVersionId: input.quoteOfferVersionId ?? null,
      message
    };
    const jobId = randomUUID();
    const encrypted = encryptQuoteEmailEnvelope(JSON.stringify(envelope), {
      jobId,
      requestId: input.quoteRequestId,
      offerVersionId: input.quoteOfferVersionId ?? null
    });
    const result = await client.query(
      `
        insert into quote_email_jobs (
          id,
          quote_request_id,
          quote_offer_version_id,
          event_key,
          event_type,
          audience,
          recipient_email,
          recipient_name,
          payload_json
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
        on conflict do nothing
        returning id
      `,
      [
        jobId,
        input.quoteRequestId,
        input.quoteOfferVersionId ?? null,
        input.eventKey,
        input.eventType,
        recipient.audience,
        recipient.email,
        recipient.name,
        JSON.stringify(encrypted)
      ]
    );
    if (result.rows[0]?.id) inserted.push(String(result.rows[0].id));
  }
  return inserted;
}

type ClaimedJob = {
  id: string;
  claimId: string;
  requestId: number;
  offerVersionId: number | null;
  eventKey: string;
  eventType: QuoteEmailEventType;
  audience: QuoteEmailAudience;
  recipientEmail: string;
  attempts: number;
  payload: unknown;
};

async function claim(
  pool: Pool,
  limit: number,
  options: { otpOnly?: boolean } = {}
): Promise<ClaimedJob[]> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await client.query(
      `
        select id, quote_request_id, quote_offer_version_id, event_key, event_type,
               audience, recipient_email, attempts, payload_json
        from quote_email_jobs
        where (
          (
            status = 'pending' and next_attempt_at <= now()
          ) or (
            status = 'processing' and locked_at < now() - interval '5 minutes'
          )
        )
          and ($2::boolean = false or event_type = 'quote_access_otp')
        order by next_attempt_at, created_at
        for update skip locked
        limit $1
      `,
      [
        Math.max(1, Math.min(25, Math.floor(limit))),
        options.otpOnly === true
      ]
    );
    const jobs: ClaimedJob[] = [];
    for (const row of result.rows) {
      const claimId = randomUUID();
      await client.query(
        `
          update quote_email_jobs
          set status = 'processing',
              attempts = attempts + 1,
              claim_id = $2,
              locked_at = now(),
              updated_at = now()
          where id = $1
        `,
        [row.id, claimId]
      );
      jobs.push({
        id: String(row.id),
        claimId,
        requestId: Number(row.quote_request_id),
        offerVersionId:
          row.quote_offer_version_id === null
            ? null
            : Number(row.quote_offer_version_id),
        eventKey: String(row.event_key),
        eventType: String(row.event_type) as QuoteEmailEventType,
        audience: String(row.audience) as QuoteEmailAudience,
        recipientEmail: String(row.recipient_email),
        attempts: Number(row.attempts) + 1,
        payload: row.payload_json
      });
    }
    await client.query('commit');
    return jobs;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

type Queryable = Pick<Pool | PoolClient, 'query'>;

async function offerLinkIsCurrent(database: Queryable, job: ClaimedJob): Promise<boolean> {
  if (job.eventType === 'quote_access_otp') {
    const verificationId = job.eventKey.startsWith('quote-access-otp:')
      ? job.eventKey.slice('quote-access-otp:'.length)
      : '';
    if (!/^[0-9a-f-]{36}$/u.test(verificationId)) return false;
    const verification = await database.query(
      `
        select 1
        from quote_email_verifications
        where id = $1
          and quote_request_id = $2
          and quote_offer_version_id = $3
          and status = 'pending'
          and consumed_at is null
          and expires_at > now()
      `,
      [verificationId, job.requestId, job.offerVersionId]
    );
    return verification.rowCount === 1;
  }
  if (job.eventType === 'quote_clarification_requested') {
    const request = await database.query(
      `
        select 1
        from quote_requests request
        left join quote_offer_versions offer
          on offer.id = $2
         and offer.quote_request_id = request.id
        where request.id = $1
          and request.voided_at is null
          and request.status in (
            'received',
            'in_preparation',
            'offer_issued',
            'awaiting_purchase_order_review'
          )
          and (
            $2::bigint is null
            or offer.status = 'draft'
            or (offer.status = 'issued' and offer.is_current = true)
          )
      `,
      [job.requestId, job.offerVersionId]
    );
    return request.rowCount === 1;
  }
  if (job.eventType === 'quote_withdrawn' || job.eventType === 'quote_expired') {
    if (!job.offerVersionId) return false;
    const terminalStatus = job.eventType === 'quote_withdrawn'
      ? 'withdrawn'
      : 'expired';
    const terminalState = await database.query(
      `
        select 1
        from quote_requests request
        join quote_offer_versions offer
          on offer.id = $2
         and offer.quote_request_id = request.id
        where request.id = $1
          and request.voided_at is null
          and request.status in ($3, 'in_preparation')
          and offer.status = $3
          and not exists (
            select 1
            from quote_offer_versions newer_offer
            where newer_offer.quote_request_id = request.id
              and newer_offer.version_number > offer.version_number
              and newer_offer.status <> 'draft'
          )
      `,
      [job.requestId, job.offerVersionId, terminalStatus]
    );
    return terminalState.rowCount === 1;
  }
  if (
    (job.eventType !== 'quote_issued' &&
      job.eventType !== 'quote_acceptance_blocked_stock') ||
    !job.offerVersionId
  ) {
    return true;
  }
  const result = await database.query(
    `
      select 1
      from quote_offer_versions
      where id = $1
        and quote_request_id = $2
        and status = 'issued'
        and is_current = true
        and valid_until > now()
    `,
    [job.offerVersionId, job.requestId]
  );
  return result.rowCount === 1;
}

type QuoteEmailDeliveryAttempt =
  | { status: 'sent'; providerId: string }
  | {
      status: 'suppressed';
      failureKind:
        | 'voided_request'
        | 'expired_otp'
        | 'obsolete_offer'
        | 'obsolete_clarification'
        | 'stale_recipient';
    };

async function deliverQuoteEmailWhileActive(
  pool: Pool,
  job: ClaimedJob,
  envelope: QuoteEmailEnvelope
): Promise<QuoteEmailDeliveryAttempt> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await lockQuoteWorkflow(client, job.requestId);
    const requestResult = await client.query(
      'select voided_at, email from quote_requests where id = $1 for share',
      [job.requestId]
    );
    if (!requestResult.rows[0] || requestResult.rows[0].voided_at) {
      await client.query('commit');
      return { status: 'suppressed', failureKind: 'voided_request' };
    }
    if (!(await offerLinkIsCurrent(client, job))) {
      await client.query('commit');
      return {
        status: 'suppressed',
        failureKind:
          job.eventType === 'quote_access_otp'
            ? 'expired_otp'
            : job.eventType === 'quote_clarification_requested'
              ? 'obsolete_clarification'
              : 'obsolete_offer'
      };
    }

    await client.query(
      `select key
       from order_email_settings
       where key = 'order-email-notifications'
       for share`
    );
    const deliveryProfile = await getOrderEmailSettings(client);
    const immutableRecipient = normalizedRecipientEmail(envelope?.message?.to);
    const jobRecipient = normalizedRecipientEmail(job.recipientEmail);
    const currentRecipient = job.audience === 'customer'
      ? normalizedRecipientEmail(requestResult.rows[0]?.email)
      : jobRecipient;
    const currentAdminRecipients = new Set(
      deliveryProfile.adminRecipients
        .map(normalizedRecipientEmail)
        .filter((recipient): recipient is string => recipient !== null)
    );
    const envelopeMatchesClaim =
      envelope?.version === 1 &&
      envelope.eventType === job.eventType &&
      envelope.audience === job.audience &&
      envelope.quoteRequestId === job.requestId &&
      envelope.quoteOfferVersionId === job.offerVersionId &&
      immutableRecipient !== null &&
      immutableRecipient === jobRecipient;
    const recipientIsCurrent =
      jobRecipient !== null &&
      currentRecipient === jobRecipient &&
      (job.audience === 'customer' || currentAdminRecipients.has(jobRecipient));
    if (!envelopeMatchesClaim || !recipientIsCurrent) {
      await client.query('commit');
      return { status: 'suppressed', failureKind: 'stale_recipient' };
    }
    if (!EMAIL_PATTERN.test(deliveryProfile.fromEmail)) {
      throw new Error('Quote sender email is not configured.');
    }
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) throw new Error('RESEND_API_KEY ni nastavljen.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try {
      response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `atehna-quote-email-${job.id}`
        },
        body: JSON.stringify({
          from: fromHeader(
            deliveryProfile.senderName,
            deliveryProfile.fromEmail
          ),
          to: [envelope.message.to],
          ...(deliveryProfile.replyToEmail
            ? { reply_to: deliveryProfile.replyToEmail }
            : {}),
          subject: envelope.message.subject,
          html: envelope.message.html,
          text: envelope.message.text,
          ...(envelope.message.attachments?.length
            ? { attachments: envelope.message.attachments }
            : {})
        }),
        cache: 'no-store',
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new Error(`Resend HTTP ${response.status}`);
    const provider = (await response.json().catch(() => ({}))) as {
      id?: unknown;
    };
    const providerId = String(provider.id ?? '');
    if (!providerId) {
      throw new Error('Ponudnik e-pošte ni vrnil ID-ja sporočila.');
    }
    await client.query('commit');
    return { status: 'sent', providerId };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function recordDeliveryEvent(
  client: PoolClient,
  job: ClaimedJob,
  type:
    | 'quote_email_provider_accepted'
    | 'quote_email_provider_failed',
  metadata: Record<string, unknown>
) {
  await client.query(
    `
      insert into quote_events (
        quote_request_id,
        quote_offer_version_id,
        event_key,
        event_type,
        actor_type,
        occurred_at,
        metadata_json
      )
      values ($1, $2, $3, $4, 'email_provider', now(), $5::jsonb)
      on conflict (event_key) where event_key is not null do nothing
    `,
    [
      job.requestId,
      job.offerVersionId,
      `quote-email-provider:${type}:${job.id}`,
      type,
      JSON.stringify(metadata)
    ]
  );
}

async function persistTerminalQuoteEmailOutcome(
  pool: Pool,
  job: ClaimedJob,
  input:
    | {
        status: 'sent';
        providerMessageId: string | null;
        redactedPayload: Record<string, unknown>;
      }
    | {
        status: 'failed';
        lastError: string;
        redactedPayload?: Record<string, unknown>;
        failureKind: string;
      }
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const update =
      input.status === 'sent'
        ? await client.query(
            `
              update quote_email_jobs
              set status = 'sent',
                  claim_id = null,
                  locked_at = null,
                  provider_message_id = $3,
                  recipient_name = null,
                  payload_json = $4::jsonb,
                  last_error = null,
                  sent_at = coalesce(sent_at, now()),
                  updated_at = now()
              where id = $1 and claim_id = $2
            `,
            [
              job.id,
              job.claimId,
              input.providerMessageId,
              JSON.stringify(input.redactedPayload)
            ]
          )
        : await client.query(
            `
              update quote_email_jobs
              set status = 'failed',
                  claim_id = null,
                  locked_at = null,
                  last_error = $3,
                  payload_json = coalesce($4::jsonb, payload_json),
                  updated_at = now()
              where id = $1 and claim_id = $2
            `,
            [
              job.id,
              job.claimId,
              input.lastError,
              input.redactedPayload
                ? JSON.stringify(input.redactedPayload)
                : null
            ]
          );
    if (update.rowCount !== 1) {
      throw new Error(`Quote email claim was lost for job ${job.id}.`);
    }
    if (input.status === 'sent') {
      await recordDeliveryEvent(
        client,
        job,
        'quote_email_provider_accepted',
        {
          jobId: job.id,
          providerMessageId: input.providerMessageId
        }
      );
    } else {
      await recordDeliveryEvent(client, job, 'quote_email_provider_failed', {
        jobId: job.id,
        attempts: job.attempts,
        failureKind: input.failureKind
      });
      if (
        job.eventType !== 'quote_delivery_failed' &&
        input.failureKind !== 'obsolete_offer' &&
        input.failureKind !== 'expired_otp' &&
        input.failureKind !== 'obsolete_clarification' &&
        input.failureKind !== 'stale_recipient'
      ) {
        await client.query('savepoint quote_delivery_failure_alert');
        try {
          await enqueueQuoteEmailEvent(client, {
            quoteRequestId: job.requestId,
            quoteOfferVersionId: job.offerVersionId,
            eventKey: `quote-delivery-failed:${job.id}`,
            eventType: 'quote_delivery_failed',
            detail: `Izvorni dogodek: ${job.eventType}; poskusi: ${job.attempts}.`
          });
          await client.query('release savepoint quote_delivery_failure_alert');
        } catch (alertError) {
          await client.query('rollback to savepoint quote_delivery_failure_alert');
          await client.query('release savepoint quote_delivery_failure_alert');
          console.error('[quote-email] delivery failure alert enqueue failed', {
            jobId: job.id,
            message:
              alertError instanceof Error ? alertError.message : 'Unknown error'
          });
        }
      }
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function processQuoteEmailJobs(
  pool: Pool,
  options: { limit?: number } = {}
): Promise<{ claimed: number; sent: number; retried: number; failed: number }> {
  if (!isQuoteEmailDeliveryEnabled()) {
    return { claimed: 0, sent: 0, retried: 0, failed: 0 };
  }
  const settingsResult = await pool.query(
    `select config_json from quote_email_settings where key = 'default'`
  );
  const businessEmailEnabled = normalizeQuoteEmailSettings(
    settingsResult.rows[0]?.config_json
  ).enabled;
  const jobs = await claim(pool, options.limit ?? 10, {
    otpOnly: !businessEmailEnabled
  });
  const result = { claimed: jobs.length, sent: 0, retried: 0, failed: 0 };
  for (const job of jobs) {
    try {
      const envelope = JSON.parse(
        decryptQuoteEmailEnvelope(job.payload, {
          jobId: job.id,
          requestId: job.requestId,
          offerVersionId: job.offerVersionId
        })
      ) as QuoteEmailEnvelope;
      const delivery = await deliverQuoteEmailWhileActive(pool, job, envelope);
      if (delivery.status === 'suppressed') {
        const lastError =
          delivery.failureKind === 'voided_request'
            ? '[voided_request] Povpraševanje je bilo odstranjeno.'
            : delivery.failureKind === 'expired_otp'
              ? '[expired_otp] Varnostna koda ni več veljavna.'
              : delivery.failureKind === 'obsolete_clarification'
                ? '[obsolete_clarification] Povpraševanje ni več odprto za pojasnilo.'
                : delivery.failureKind === 'stale_recipient'
                  ? '[stale_recipient] Prejemnik ni več aktualen.'
                : '[obsolete_offer] Povezava ni več veljavna.';
        await persistTerminalQuoteEmailOutcome(pool, job, {
          status: 'failed',
          lastError,
          redactedPayload: {
            version: 1,
            redacted: true,
            eventType: job.eventType,
            failureKind: delivery.failureKind
          },
          failureKind: delivery.failureKind
        });
        result.failed += 1;
        continue;
      }
      await persistTerminalQuoteEmailOutcome(pool, job, {
        status: 'sent',
        providerMessageId: delivery.providerId,
        redactedPayload: {
          version: 1,
          redacted: true,
          eventType: job.eventType,
          audience: envelope.audience
        }
      });
      result.sent += 1;
    } catch (error) {
      const terminal = job.attempts >= MAX_ATTEMPTS;
      const delayMs = Math.min(
        6 * 60 * 60 * 1_000,
        30_000 * 2 ** Math.max(0, job.attempts - 1)
      );
      const safeError = String(
        error instanceof Error ? error.message : 'Delivery failed'
      )
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, '[email]')
        .replace(/ath_quote_[A-Za-z0-9_-]{43}/gu, '[quote-token]')
        .slice(0, 2_000);
      if (terminal) {
        await persistTerminalQuoteEmailOutcome(pool, job, {
          status: 'failed',
          lastError: safeError,
          failureKind: 'delivery_failed'
        });
        result.failed += 1;
      } else {
        const retryUpdate = await pool.query(
          `
            update quote_email_jobs job
            set status = case
                  when request_record.voided_at is null then 'pending'
                  else 'failed'
                end,
                claim_id = null,
                locked_at = null,
                next_attempt_at = now() + ($3::bigint * interval '1 millisecond'),
                recipient_name = case
                  when request_record.voided_at is null then job.recipient_name
                  else null
                end,
                payload_json = case
                  when request_record.voided_at is null then job.payload_json
                  else jsonb_build_object(
                    'version', 1,
                    'redacted', true,
                    'eventType', job.event_type,
                    'audience', job.audience,
                    'failureKind', 'voided_request'
                  )
                end,
                last_error = case
                  when request_record.voided_at is null then $4
                  else '[voided_request] Povpraševanje je bilo odstranjeno.'
                end,
                updated_at = now()
            from quote_requests request_record
            where job.id = $1
              and job.claim_id = $2
              and request_record.id = job.quote_request_id
            returning job.status
          `,
          [job.id, job.claimId, delayMs, safeError]
        );
        if (retryUpdate.rowCount !== 1) {
          throw new Error(`Quote email claim was lost for job ${job.id}.`);
        }
        if (retryUpdate.rows[0]?.status === 'failed') result.failed += 1;
        else result.retried += 1;
      }
    }
  }
  return result;
}

export function scheduleQuoteEmailJobs(pool: Pool): void {
  if (!isQuoteEmailDeliveryEnabled()) return;
  after(async () => {
    await processQuoteEmailJobs(pool, { limit: 10 }).catch((error) => {
      console.error('[quote-email] background processing failed', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    });
  });
}
