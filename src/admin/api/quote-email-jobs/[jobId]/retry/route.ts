import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { decryptQuoteEmailEnvelope } from '@/shared/server/quoteEmailDeliveryCipher';
import { scheduleQuoteEmailJobs } from '@/shared/server/quoteEmailJobs';
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

function retryStateIsCurrent(job: Record<string, unknown>): boolean {
  const eventType = String(job.event_type);
  const offerStatus = job.offer_status === null ? null : String(job.offer_status);
  if (eventType === 'quote_access_otp') return false;
  if (eventType === 'quote_issued' || eventType === 'quote_acceptance_blocked_stock') {
    return (
      offerStatus === 'issued' &&
      job.offer_is_current === true &&
      new Date(String(job.valid_until)).getTime() > Date.now()
    );
  }
  if (eventType === 'quote_accepted') return offerStatus === 'accepted';
  if (eventType === 'quote_declined') return offerStatus === 'declined';
  if (eventType === 'quote_withdrawn') return offerStatus === 'withdrawn';
  if (eventType === 'quote_expired') return offerStatus === 'expired';
  if (eventType === 'quote_request_closed') {
    return String(job.request_status) === 'closed_without_offer';
  }
  if (eventType === 'quote_clarification_requested') {
    const requestIsOpen = [
      'received',
      'in_preparation',
      'offer_issued',
      'awaiting_purchase_order_review'
    ].includes(String(job.request_status));
    if (!requestIsOpen) return false;
    if (job.quote_offer_version_id === null) return true;
    return offerStatus === 'draft' || (
      offerStatus === 'issued' && job.offer_is_current === true
    );
  }
  return eventType === 'quote_request_submitted' &&
    ['received', 'in_preparation', 'offer_issued'].includes(String(job.request_status));
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
          request.status as request_status,
          request.voided_at as request_voided_at,
          offer.offer_number,
          offer.status as offer_status,
          offer.is_current as offer_is_current,
          offer.valid_until
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
    try {
      decryptQuoteEmailEnvelope(job.payload_json, {
        jobId,
        requestId: Number(job.quote_request_id),
        offerVersionId:
          job.quote_offer_version_id === null
            ? null
            : Number(job.quote_offer_version_id)
      });
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
