import 'server-only';

import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import type { Pool, PoolClient } from 'pg';
import {
  normalizeQuoteEmailSettings,
  type QuoteEmailEventType
} from '@/shared/domain/quote/quoteEmailSettings';
import {
  buildQuoteEmailMessage,
  type QuoteEmailAudience,
  type QuoteEmailMessage
} from '@/shared/domain/quote/quoteEmailTemplates';
import {
  createPendingQuoteEmailPdfDocumentReference,
  normalizeQuoteEmailPdfDocumentReference,
  quoteEmailPdfReferenceMatchesEvent,
  type EmailProviderPdfAttachment,
  type QuoteEmailPdfDocumentReference
} from '@/shared/domain/emailPdfAttachment';
import {
  classifyResendFailure,
  type ResendFailure
} from '@/shared/domain/order/orderEmailDelivery';
import { getOrderEmailSettings } from '@/shared/server/orderEmailSettings';
import {
  decryptQuoteEmailEnvelope,
  encryptQuoteEmailEnvelope
} from '@/shared/server/quoteEmailDeliveryCipher';
import { lockQuoteWorkflow } from '@/shared/server/quoteAccess';
import {
  EmailPdfDocumentPendingError,
  EmailPdfDocumentValidationError,
  hydrateEmailPdfDocument,
  pinEmailPdfDocument
} from '@/shared/server/emailPdfAttachment';

export type { QuoteEmailEventType } from '@/shared/domain/quote/quoteEmailSettings';

type QuoteEmailEnvelope = {
  version: 1;
  eventType: QuoteEmailEventType;
  audience: QuoteEmailAudience;
  quoteRequestId: number;
  quoteOfferVersionId: number | null;
  message: QuoteEmailMessage;
  pdfDocument?: QuoteEmailPdfDocumentReference;
};

type QuoteEmailProviderAttachment =
  | NonNullable<QuoteEmailMessage['attachments']>[number]
  | EmailProviderPdfAttachment;

type EnqueueQuoteEmailInput = {
  quoteRequestId: number;
  quoteOfferVersionId?: number | null;
  eventKey: string;
  eventType: QuoteEmailEventType;
  offerUrl?: string | null;
  otpCode?: string | null;
  detail?: string | null;
  pdfDocument?: QuoteEmailPdfDocumentReference | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const MAX_ATTEMPTS = 8;
const PDF_DOCUMENT_DEFER_MS = 5_000;
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

class QuoteEmailDeliveryError extends Error {
  readonly resendFailure: ResendFailure;

  constructor(message: string, resendFailure: ResendFailure) {
    super(message);
    this.name = 'QuoteEmailDeliveryError';
    this.resendFailure = resendFailure;
  }
}

function normalizedRecipientEmail(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized.length <= 320 && EMAIL_PATTERN.test(normalized)
    ? normalized
    : null;
}

function fromHeader(name: string, email: string): string {
  const safeName = name.replace(/[\r\n<>]/gu, ' ').trim();
  return safeName ? `"${safeName}" <${email}>` : email;
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
  const explicitPdfDocument = input.pdfDocument == null
    ? null
    : normalizeQuoteEmailPdfDocumentReference(input.pdfDocument);
  if (input.pdfDocument != null && !explicitPdfDocument) {
    throw new EmailPdfDocumentValidationError(
      'The quote email PDF reference is malformed.'
    );
  }
  if (
    explicitPdfDocument &&
    (
      !quoteEmailPdfReferenceMatchesEvent(input.eventType, explicitPdfDocument) ||
      explicitPdfDocument.quoteRequestId !== input.quoteRequestId ||
      explicitPdfDocument.quoteOfferVersionId !== input.quoteOfferVersionId
    )
  ) {
    throw new EmailPdfDocumentValidationError(
      'The quote email PDF document does not match its event.'
    );
  }
  if (
    input.eventType === 'quote_issued' &&
    (!Number.isSafeInteger(input.quoteOfferVersionId) ||
      Number(input.quoteOfferVersionId) <= 0)
  ) {
    throw new EmailPdfDocumentValidationError(
      'An issued quote email requires an exact offer version.'
    );
  }
  const [shared, settings, identity] = await Promise.all([
    getOrderEmailSettings(client),
    quoteSettings(client),
    quoteIdentity(client, input)
  ]);
  if (!settings.enabled) {
    return [];
  }
  if (!identity) {
    throw new Error('Quote email identity does not exist.');
  }
  const configuredEvent = settings.events[input.eventType];
  const customerEnabled = configuredEvent.customer;
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
  const inserted: string[] = [];
  for (const recipient of recipients) {
    const message = buildQuoteEmailMessage({
      eventType: input.eventType,
      audience: recipient.audience,
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      requestNumber: identity.request_number,
      offerNumber: identity.offer_number,
      offerUrl: input.offerUrl,
      otpCode: input.otpCode,
      detail: input.detail,
      sharedSettings: shared,
      quoteSettings: settings
    });
    const pdfDocument =
      recipient.audience === 'customer' &&
      input.eventType === 'quote_issued' &&
      input.quoteOfferVersionId
        ? explicitPdfDocument ??
          createPendingQuoteEmailPdfDocumentReference({
            quoteRequestId: input.quoteRequestId,
            quoteOfferVersionId: input.quoteOfferVersionId
          })
        : null;
    const envelope: QuoteEmailEnvelope = {
      version: 1,
      eventType: input.eventType,
      audience: recipient.audience,
      quoteRequestId: input.quoteRequestId,
      quoteOfferVersionId: input.quoteOfferVersionId ?? null,
      message,
      ...(pdfDocument ? { pdfDocument } : {})
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

function parseClaimedQuoteEmailEnvelope(
  job: ClaimedJob
): QuoteEmailEnvelope {
  const decoded = JSON.parse(
    decryptQuoteEmailEnvelope(job.payload, {
      jobId: job.id,
      requestId: job.requestId,
      offerVersionId: job.offerVersionId
    })
  ) as unknown;
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
    throw new EmailPdfDocumentValidationError(
      'The quote email delivery envelope is malformed.'
    );
  }
  const envelope = decoded as QuoteEmailEnvelope;
  if (!Object.prototype.hasOwnProperty.call(decoded, 'pdfDocument')) {
    return envelope;
  }
  const pdfDocument = normalizeQuoteEmailPdfDocumentReference(
    (decoded as Record<string, unknown>).pdfDocument
  );
  if (
    !pdfDocument ||
    envelope.version !== 1 ||
    envelope.audience !== 'customer' ||
    job.audience !== 'customer' ||
    envelope.eventType !== job.eventType ||
    !quoteEmailPdfReferenceMatchesEvent(envelope.eventType, pdfDocument) ||
    pdfDocument.quoteRequestId !== job.requestId ||
    pdfDocument.quoteOfferVersionId !== job.offerVersionId
  ) {
    throw new EmailPdfDocumentValidationError(
      'The quote email PDF reference does not match its claimed customer event.'
    );
  }
  return {
    ...envelope,
    pdfDocument
  };
}

async function pinClaimedQuoteEmailPdfDocument(
  pool: Pool,
  job: ClaimedJob,
  envelope: QuoteEmailEnvelope
): Promise<QuoteEmailEnvelope> {
  const reference =
    envelope.pdfDocument ??
    (job.audience === 'customer' &&
    job.eventType === 'quote_issued' &&
    job.offerVersionId
      ? createPendingQuoteEmailPdfDocumentReference({
          quoteRequestId: job.requestId,
          quoteOfferVersionId: job.offerVersionId
        })
      : undefined);
  if (!reference) return envelope;
  if (
    envelope.version !== 1 ||
    envelope.audience !== 'customer' ||
    job.audience !== 'customer' ||
    envelope.eventType !== job.eventType ||
    envelope.quoteRequestId !== job.requestId ||
    envelope.quoteOfferVersionId !== job.offerVersionId ||
    !quoteEmailPdfReferenceMatchesEvent(job.eventType, reference) ||
    reference.quoteRequestId !== job.requestId ||
    reference.quoteOfferVersionId !== job.offerVersionId
  ) {
    throw new EmailPdfDocumentValidationError(
      'The quote email PDF reference does not match its claimed customer event.'
    );
  }
  const pinned = await pinEmailPdfDocument(pool, reference);
  if (pinned.source !== 'quote_document') {
    throw new EmailPdfDocumentValidationError(
      'The quote email PDF reference has the wrong source.'
    );
  }
  return { ...envelope, pdfDocument: pinned };
}

function quotePdfDocumentPinChanged(
  before: QuoteEmailEnvelope,
  after: QuoteEmailEnvelope
): boolean {
  return (
    before.pdfDocument?.documentId !== after.pdfDocument?.documentId ||
    before.pdfDocument?.contentSha256 !== after.pdfDocument?.contentSha256 ||
    before.pdfDocument?.filename !== after.pdfDocument?.filename
  );
}

async function persistPinnedQuoteEmailEnvelope(
  pool: Pool,
  job: ClaimedJob,
  envelope: QuoteEmailEnvelope
): Promise<void> {
  const encrypted = encryptQuoteEmailEnvelope(JSON.stringify(envelope), {
    jobId: job.id,
    requestId: job.requestId,
    offerVersionId: job.offerVersionId
  });
  const result = await pool.query(
    `
      update quote_email_jobs
      set payload_json = $3::jsonb,
          updated_at = now()
      where id = $1
        and claim_id = $2
    `,
    [job.id, job.claimId, JSON.stringify(encrypted)]
  );
  if (result.rowCount !== 1) {
    throw new Error(`Quote email claim was lost for job ${job.id}.`);
  }
  job.payload = encrypted;
}

async function claim(
  pool: Pool,
  limit: number
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
        order by next_attempt_at, created_at
        for update skip locked
        limit $1
      `,
      [Math.max(1, Math.min(25, Math.floor(limit)))]
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
    let pdfAttachment: EmailProviderPdfAttachment | null = null;
    if (envelope.pdfDocument) {
      if (
        job.audience !== 'customer' ||
        !quoteEmailPdfReferenceMatchesEvent(job.eventType, envelope.pdfDocument) ||
        envelope.pdfDocument.quoteRequestId !== job.requestId ||
        envelope.pdfDocument.quoteOfferVersionId !== job.offerVersionId
      ) {
        throw new EmailPdfDocumentValidationError(
          'The email PDF reference is not scoped to this customer quote.'
        );
      }
      pdfAttachment = (
        await hydrateEmailPdfDocument(client, envelope.pdfDocument)
      ).attachment;
    }
    if (!EMAIL_PATTERN.test(deliveryProfile.fromEmail)) {
      throw new QuoteEmailDeliveryError(
        'Quote sender email is not configured.',
        { kind: 'http', status: 400 }
      );
    }
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      throw new QuoteEmailDeliveryError(
        'RESEND_API_KEY ni nastavljen.',
        { kind: 'http', status: 400 }
      );
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const attachments: readonly QuoteEmailProviderAttachment[] = [
      ...(envelope.message.attachments ?? []),
      ...(pdfAttachment ? [pdfAttachment] : [])
    ];
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
          ...(attachments.length
            ? { attachments }
            : {})
        }),
        cache: 'no-store',
        signal: controller.signal
      });
    } catch {
      throw new QuoteEmailDeliveryError(
        controller.signal.aborted
          ? 'Čas za povezavo s ponudnikom e-pošte je potekel.'
          : 'Povezava s ponudnikom e-pošte ni uspela.',
        { kind: 'network' }
      );
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      throw new QuoteEmailDeliveryError(
        `Resend HTTP ${response.status}`,
        {
          kind: 'http',
          status: response.status,
          retryAfter: response.headers.get('retry-after')
        }
      );
    }
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

async function deferQuoteEmailJobForPdf(
  pool: Pool,
  job: ClaimedJob,
  error: EmailPdfDocumentPendingError
): Promise<'retried' | 'failed'> {
  const safeError = String(error.message)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, '[email]')
    .replace(/ath_quote_[A-Za-z0-9_-]{43}/gu, '[quote-token]')
    .slice(0, 2_000);
  if (job.attempts >= MAX_ATTEMPTS) {
    await persistTerminalQuoteEmailOutcome(pool, job, {
      status: 'failed',
      lastError: `[document_unavailable] ${safeError}`,
      redactedPayload: {
        version: 1,
        redacted: true,
        eventType: job.eventType,
        audience: job.audience,
        failureKind: 'document_unavailable'
      },
      failureKind: 'document_unavailable'
    });
    return 'failed';
  }
  const update = await pool.query(
    `
      update quote_email_jobs
      set status = 'pending',
          claim_id = null,
          locked_at = null,
          next_attempt_at = now() + ($3::bigint * interval '1 millisecond'),
          last_error = $4,
          updated_at = now()
      where id = $1
        and claim_id = $2
    `,
    [
      job.id,
      job.claimId,
      PDF_DOCUMENT_DEFER_MS,
      `[document_pending] ${safeError}`
    ]
  );
  if (update.rowCount !== 1) {
    throw new Error(`Quote email claim was lost for job ${job.id}.`);
  }
  return 'retried';
}

export async function processQuoteEmailJobs(
  pool: Pool,
  options: { limit?: number } = {}
): Promise<{ claimed: number; sent: number; retried: number; failed: number }> {
  const settingsResult = await pool.query(
    `select config_json from quote_email_settings where key = 'default'`
  );
  const quoteEmailEnabled = normalizeQuoteEmailSettings(
    settingsResult.rows[0]?.config_json
  ).enabled;
  if (!quoteEmailEnabled) {
    return { claimed: 0, sent: 0, retried: 0, failed: 0 };
  }
  const jobs = await claim(pool, options.limit ?? 10);
  const result = { claimed: jobs.length, sent: 0, retried: 0, failed: 0 };
  for (const job of jobs) {
    try {
      const originalEnvelope = parseClaimedQuoteEmailEnvelope(job);
      const envelope = await pinClaimedQuoteEmailPdfDocument(
        pool,
        job,
        originalEnvelope
      );
      if (quotePdfDocumentPinChanged(originalEnvelope, envelope)) {
        await persistPinnedQuoteEmailEnvelope(pool, job, envelope);
      }
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
      const safeError = String(
        error instanceof Error ? error.message : 'Delivery failed'
      )
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, '[email]')
        .replace(/ath_quote_[A-Za-z0-9_-]{43}/gu, '[quote-token]')
        .slice(0, 2_000);
      if (error instanceof EmailPdfDocumentPendingError) {
        const outcome = await deferQuoteEmailJobForPdf(pool, job, error);
        if (outcome === 'failed') result.failed += 1;
        else result.retried += 1;
        continue;
      }
      if (error instanceof EmailPdfDocumentValidationError) {
        await persistTerminalQuoteEmailOutcome(pool, job, {
          status: 'failed',
          lastError: `[invalid_pdf_document] ${safeError}`,
          redactedPayload: {
            version: 1,
            redacted: true,
            eventType: job.eventType,
            audience: job.audience,
            failureKind: 'invalid_pdf_document'
          },
          failureKind: 'invalid_pdf_document'
        });
        result.failed += 1;
        continue;
      }
      const providerFailure =
        error instanceof QuoteEmailDeliveryError
          ? classifyResendFailure(error.resendFailure, Date.now())
          : null;
      const terminal =
        providerFailure?.disposition === 'terminal' ||
        job.attempts >= MAX_ATTEMPTS;
      const delayMs =
        providerFailure?.retryAfterMs ??
        Math.min(
          6 * 60 * 60 * 1_000,
          30_000 * 2 ** Math.max(0, job.attempts - 1)
        );
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
  after(async () => {
    await processQuoteEmailJobs(pool, { limit: 10 }).catch((error) => {
      console.error('[quote-email] background processing failed', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    });
  });
}
