import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { getOrderEmailSettings } from '@/shared/server/orderEmailSettings';
import { decryptQuoteEmailEnvelope } from '@/shared/server/quoteEmailDeliveryCipher';
import { scheduleQuoteEmailJobs } from '@/shared/server/quoteEmailJobs';
import {
  normalizeQuoteEmailSettings,
  QUOTE_EMAIL_EVENT_TYPES,
  type QuoteEmailEventType
} from '@/shared/domain/quote/quoteEmailSettings';
import {
  requireQuoteCustomerEmailConfirmation
} from '@/shared/server/adminCustomerEmailConfirmation';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { quoteEmailRetryStateIsCurrent } from '@/shared/domain/quote/quoteEmailRetryEligibility';
import {
  isQuoteAdminEnabled,
  isQuoteEmailDeliveryEnabled
} from '@/shared/server/quoteFeatureFlags';
import {
  appendQuoteEvent,
  hasValidQuoteAdminSession,
  mirrorQuoteAdminAudit,
  quoteAdminEvidence
} from '@/admin/api/quote-requests/quoteAdminRouteUtils';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function retryStateIsCurrent(job: Record<string, unknown>): boolean {
  return quoteEmailRetryStateIsCurrent({
    eventType: String(job.event_type),
    audience: String(job.audience),
    recipientEmail: String(job.recipient_email),
    requestStatus: String(job.request_status),
    requestVoided: Boolean(job.request_voided_at),
    offerVersionId: job.quote_offer_version_id === null
      ? null
      : Number(job.quote_offer_version_id),
    offerStatus: job.offer_status === null ? null : String(job.offer_status),
    offerIsCurrent: job.offer_is_current === true,
    hasNewerNonDraftOfferVersion:
      job.has_newer_non_draft_offer_version === true,
    validUntil: job.valid_until === null ? null : String(job.valid_until)
  });
}

export async function POST(
  request: Request,
  props: { params: Promise<{ jobId: string }> }
) {
  if (!isQuoteAdminEnabled()) {
    return NextResponse.json({ message: 'Ponudbe niso omogočene.' }, { status: 404 });
  }
  if (!hasValidQuoteAdminSession(request)) {
    return NextResponse.json({ message: 'Za dostop je potrebna prijava.' }, { status: 401 });
  }
  if (!isQuoteEmailDeliveryEnabled()) {
    return NextResponse.json(
      { message: 'Pošiljanje e-pošte za ponudbe je trenutno izključeno.' },
      { status: 409 }
    );
  }
  const { jobId: rawJobId } = await props.params;
  const jobId = rawJobId.trim().toLowerCase();
  if (!UUID_PATTERN.test(jobId)) {
    return NextResponse.json({ message: 'E-poštno opravilo ne obstaja.' }, { status: 404 });
  }
  const parsed = await readRequiredJsonRecord(request);
  if (!parsed.ok) return parsed.response;

  const evidence = await quoteAdminEvidence(request);
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await client.query(
      `
        select
          job.*,
          request.request_number,
          request.email as request_email,
          request.status as request_status,
          request.voided_at as request_voided_at,
          offer.offer_number,
          offer.status as offer_status,
          offer.is_current as offer_is_current,
          offer.valid_until,
          exists (
            select 1
            from quote_offer_versions newer_offer
            where newer_offer.quote_request_id = job.quote_request_id
              and newer_offer.version_number > offer.version_number
              and newer_offer.status <> 'draft'
          ) as has_newer_non_draft_offer_version
        from quote_email_jobs job
        join quote_requests request on request.id = job.quote_request_id
        left join quote_offer_versions offer
          on offer.id = job.quote_offer_version_id
         and offer.quote_request_id = job.quote_request_id
        where job.id = $1
        for update of job
      `,
      [jobId]
    );
    const job = result.rows[0] as Record<string, unknown> | undefined;
    if (!job) {
      await client.query('rollback');
      return NextResponse.json({ message: 'E-poštno opravilo ne obstaja.' }, { status: 404 });
    }
    if (job.request_voided_at) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_REQUEST_VOIDED',
          message: 'Povpraševanje je odstranjeno in e-pošte ni več mogoče poslati.'
        },
        { status: 409 }
      );
    }
    if (job.status !== 'failed') {
      await client.query('rollback');
      return NextResponse.json(
        { message: 'Ponoviti je mogoče samo neuspešno e-poštno opravilo.' },
        { status: 409 }
      );
    }
    if (!retryStateIsCurrent(job)) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'OBSOLETE_QUOTE_EMAIL',
          message: 'Sporočilo je zastarelo ali vsebuje povezavo, ki ni več veljavna.'
        },
        { status: 409 }
      );
    }
    let immutableRecipientEmail = '';
    try {
      const envelope = JSON.parse(decryptQuoteEmailEnvelope(job.payload_json, {
        jobId,
        requestId: Number(job.quote_request_id),
        offerVersionId:
          job.quote_offer_version_id === null
            ? null
            : Number(job.quote_offer_version_id)
      })) as { message?: { to?: unknown } };
      immutableRecipientEmail =
        typeof envelope.message?.to === 'string'
          ? envelope.message.to.trim().toLowerCase()
          : '';
      if (
        !EMAIL_PATTERN.test(immutableRecipientEmail) ||
        immutableRecipientEmail !==
          String(job.recipient_email ?? '').trim().toLowerCase()
      ) {
        throw new Error('Quote email recipient integrity mismatch.');
      }
    } catch {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_EMAIL_PAYLOAD_UNAVAILABLE',
          message: 'Varnega sporočila ni več mogoče obnoviti. Ustvarite novo poslovno obvestilo.'
        },
        { status: 409 }
      );
    }

    const eventType = String(job.event_type) as QuoteEmailEventType;
    const audience = String(job.audience);
    if (!QUOTE_EMAIL_EVENT_TYPES.includes(eventType)) {
      await client.query('rollback');
      return NextResponse.json(
        { code: 'QUOTE_EMAIL_POLICY_INVALID', message: 'Vrsta e-poštnega opravila ni več podprta.' },
        { status: 409 }
      );
    }
    if (
      audience === 'customer' &&
      immutableRecipientEmail !==
        String(job.request_email ?? '').trim().toLowerCase()
    ) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_EMAIL_RECIPIENT_STALE',
          message:
            'Prejemnik neuspelega sporočila se ne ujema več s trenutnim e-poštnim naslovom stranke. Ustvarite novo poslovno obvestilo.'
        },
        { status: 409 }
      );
    }
    if (audience === 'admin') {
      const orderEmailSettings = await getOrderEmailSettings(client);
      const currentAdminRecipients = new Set(
        orderEmailSettings.adminRecipients.map((recipient) =>
          recipient.trim().toLowerCase()
        )
      );
      if (!currentAdminRecipients.has(immutableRecipientEmail)) {
        await client.query('rollback');
        return NextResponse.json(
          {
            code: 'QUOTE_EMAIL_RECIPIENT_STALE',
            message:
              'Prejemnik neuspelega sporočila ni več med trenutnimi administratorskimi prejemniki. Ustvarite novo poslovno obvestilo.'
          },
          { status: 409 }
        );
      }
    }
    const settingsResult = await client.query(
      `select config_json from quote_email_settings where key = 'default'`
    );
    const settings = normalizeQuoteEmailSettings(
      settingsResult.rows[0]?.config_json
    );
    const audienceEnabled = audience === 'customer'
      ? settings.events[eventType].customer
      : audience === 'admin'
        ? settings.events[eventType].admins
        : false;
    if (!settings.enabled || !audienceEnabled) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_EMAIL_POLICY_DISABLED',
          message: 'To obvestilo je v trenutnih nastavitvah e-pošte izključeno.'
        },
        { status: 409 }
      );
    }
    if (audience === 'customer') {
      const confirmationChallenge =
        await requireQuoteCustomerEmailConfirmation({
          client,
          quoteRequestId: Number(job.quote_request_id),
          eventType,
          action: `retry_quote_email:${jobId}`,
          actionLabel: 'Ponovno pošiljanje e-pošte ponudbe',
          customerEmailConfirmationToken:
            parsed.body.customerEmailConfirmationToken,
          recipientEmail: immutableRecipientEmail
        });
      if (confirmationChallenge) {
        await client.query('rollback');
        return NextResponse.json(confirmationChallenge, { status: 428 });
      }
    }

    await client.query(
      `
        update quote_email_jobs
        set status = 'pending',
            attempts = 0,
            next_attempt_at = now(),
            claim_id = null,
            locked_at = null,
            last_error = null,
            updated_at = now()
        where id = $1
      `,
      [jobId]
    );
    const quoteRequestId = Number(job.quote_request_id);
    const quoteOfferVersionId =
      job.quote_offer_version_id === null
        ? null
        : Number(job.quote_offer_version_id);
    await appendQuoteEvent(client, {
      quoteRequestId,
      quoteOfferVersionId,
      eventKey: `quote-email-manual-retry:${jobId}:${evidence.requestId}`,
      eventType: 'quote_email_queued',
      actorId: evidence.actorId,
      requestId: evidence.requestId,
      metadata: {
        jobId,
        eventType: job.event_type,
        audience: job.audience,
        manualRetry: true,
        attemptsReset: true
      }
    });
    await mirrorQuoteAdminAudit(request, client, {
      quoteRequestId,
      requestNumber: String(job.request_number),
      action: 'updated',
      summary: `Povpraševanje ${job.request_number}: ponovljeno pošiljanje e-pošte`,
      metadata: {
        quote_email_job_id: jobId,
        quote_offer_version_id: quoteOfferVersionId,
        email_event_type: job.event_type,
        audience: job.audience
      }
    });
    await client.query('commit');
    scheduleQuoteEmailJobs(pool);
    return NextResponse.json({
      jobId,
      status: 'pending',
      message: 'E-poštno opravilo je znova uvrščeno v čakalno vrsto.'
    });
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    console.error('[quotes.email.retry] failed', {
      jobId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { message: 'Ponovnega pošiljanja ni mogoče pripraviti.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
