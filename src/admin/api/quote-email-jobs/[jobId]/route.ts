import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';
import {
  hasValidQuoteAdminSession,
  mirrorQuoteAdminAudit,
  quoteAdminEvidence
} from '@/admin/api/quote-requests/quoteAdminRouteUtils';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function conflictForStatus(status: string) {
  if (status === 'processing') {
    return {
      code: 'QUOTE_EMAIL_ALREADY_PROCESSING',
      message: 'E-pošta je že v obdelavi in je ni več mogoče varno odstraniti.'
    };
  }
  if (status === 'sent') {
    return {
      code: 'QUOTE_EMAIL_ALREADY_SENT',
      message: 'E-pošta je bila že poslana in je ni mogoče odstraniti.'
    };
  }
  return {
    code: 'QUOTE_EMAIL_NOT_PENDING',
    message: 'Odstraniti je mogoče samo e-pošto, ki še čaka na pošiljanje.'
  };
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ jobId: string }> }
) {
  if (!isQuoteAdminEnabled()) {
    return NextResponse.json({ message: 'Ponudbe niso omogočene.' }, { status: 404 });
  }
  if (!hasValidQuoteAdminSession(request)) {
    return NextResponse.json({ message: 'Za dostop je potrebna prijava.' }, { status: 401 });
  }

  const { jobId: rawJobId } = await props.params;
  const jobId = rawJobId.trim().toLowerCase();
  if (!UUID_PATTERN.test(jobId)) {
    return NextResponse.json({ message: 'E-poštno opravilo ne obstaja.' }, { status: 404 });
  }

  const pool = await getPool();
  const evidence = await quoteAdminEvidence(request);
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await client.query(
      `
        select job.id, job.quote_request_id, job.quote_offer_version_id,
               job.event_type, job.audience, job.recipient_email, job.status,
               job.provider_message_id, job.sent_at,
               request.request_number
        from quote_email_jobs job
        join quote_requests request on request.id = job.quote_request_id
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

    const status = String(job.status);
    if (status === 'cancelled') {
      await client.query('rollback');
      return NextResponse.json({
        jobId,
        status: 'cancelled',
        message: 'E-pošta je že odstranjena iz čakalne vrste.'
      });
    }
    if (status !== 'pending') {
      await client.query('rollback');
      return NextResponse.json(conflictForStatus(status), { status: 409 });
    }
    if (job.provider_message_id !== null || job.sent_at !== null) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_EMAIL_PROVIDER_ACCEPTED',
          message: 'Ponudnik je e-pošto že sprejel in je ni več mogoče odstraniti.'
        },
        { status: 409 }
      );
    }

    const cancelled = await client.query(
      `
        update quote_email_jobs
        set status = 'cancelled',
            claim_id = null,
            locked_at = null,
            last_error = null,
            recipient_name = null,
            payload_json = jsonb_build_object(
              'cancelled', true,
              'cancelled_at', clock_timestamp()
            ),
            cancelled_at = clock_timestamp(),
            cancelled_by_actor_id = $2,
            updated_at = now()
        where id = $1
          and status = 'pending'
          and provider_message_id is null
          and sent_at is null
          and cancelled_at is null
        returning id
      `,
      [jobId, evidence.actorId]
    );
    if (cancelled.rowCount !== 1) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_EMAIL_CANCELLATION_CONFLICT',
          message: 'Stanje čakalne vrste se je medtem spremenilo. Osvežite stran.'
        },
        { status: 409 }
      );
    }

    const quoteRequestId = Number(job.quote_request_id);
    const requestNumber = String(job.request_number);
    await mirrorQuoteAdminAudit(request, client, {
      quoteRequestId,
      requestNumber,
      action: 'updated',
      summary: `Povpraševanje ${requestNumber}: e-pošta odstranjena iz čakalne vrste`,
      metadata: {
        quote_email_job_id: jobId,
        quote_offer_version_id: job.quote_offer_version_id,
        email_event_type: job.event_type,
        audience: job.audience,
        queue_action: 'cancelled'
      }
    });
    await client.query('commit');
    return NextResponse.json({
      jobId,
      status: 'cancelled',
      message: 'E-pošta je odstranjena iz čakalne vrste in ne bo poslana.'
    });
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    console.error('[quotes.email.cancel] failed', {
      jobId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { message: 'E-pošte ni bilo mogoče odstraniti iz čakalne vrste.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
