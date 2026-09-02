import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';
import { scheduleQuoteEmailJobs } from '@/shared/server/quoteEmailJobs';
import { requireQuoteCustomerEmailConfirmation } from '@/shared/server/adminCustomerEmailConfirmation';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { lockQuoteWorkflow } from '@/shared/server/quoteAccess';
import {
  appendQuoteEvent,
  boundedText,
  enqueueQuoteEmailIsolated,
  expectedVersion,
  hasValidQuoteAdminSession,
  mirrorQuoteAdminAudit,
  positiveInteger,
  quoteAdminEvidence
} from '@/admin/api/quote-requests/quoteAdminRouteUtils';

const OPEN_REQUEST_STATUSES = new Set([
  'received',
  'in_preparation',
  'offer_issued',
  'awaiting_purchase_order_review'
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type EmailStatus =
  | 'not_requested'
  | 'not_queued'
  | 'pending'
  | 'processing'
  | 'sent'
  | 'failed';

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function clarificationMessage(input: {
  replayed: boolean;
  emailRequested: boolean;
  emailStatus: EmailStatus;
}): string {
  const prefix = input.replayed
    ? 'Zahteva za pojasnilo je že zabeležena.'
    : 'Zahteva za pojasnilo je zabeležena.';
  if (!input.emailRequested) return prefix;
  if (input.emailStatus === 'pending' || input.emailStatus === 'processing') {
    return `${prefix} E-pošta je v čakalni vrsti.`;
  }
  if (input.emailStatus === 'sent') return `${prefix} E-pošta je poslana.`;
  if (input.emailStatus === 'failed') {
    return `${prefix} E-poštno opravilo ni uspelo; po potrebi ga lahko ponovite.`;
  }
  return `${prefix} E-pošta ni bila uvrščena v čakalno vrsto. Preverite, ali je pošiljanje stranki za ta dogodek omogočeno v nastavitvah E-pošta.`;
}

export async function POST(
  request: Request,
  props: { params: Promise<{ quoteRequestId: string }> }
) {
  if (!isQuoteAdminEnabled()) {
    return NextResponse.json({ message: 'Ponudbe niso omogočene.' }, { status: 404 });
  }
  if (!hasValidQuoteAdminSession(request)) {
    return NextResponse.json({ message: 'Za dostop je potrebna prijava.' }, { status: 401 });
  }
  const { quoteRequestId: rawQuoteRequestId } = await props.params;
  const quoteRequestId = positiveInteger(rawQuoteRequestId);
  if (!quoteRequestId) {
    return NextResponse.json({ message: 'Neveljaven ID povpraševanja.' }, { status: 400 });
  }
  const parsed = await readRequiredJsonRecord(request);
  if (!parsed.ok) return parsed.response;

  const quoteOfferVersionId = positiveInteger(parsed.body.offerVersionId);
  if (parsed.body.offerVersionId !== null && parsed.body.offerVersionId !== undefined && !quoteOfferVersionId) {
    return NextResponse.json({ message: 'Neveljavna različica ponudbe.' }, { status: 400 });
  }
  const expectedRequestStateVersion = expectedVersion(
    parsed.body.expectedRequestStateVersion
  );
  if (typeof parsed.body.sendEmail !== 'boolean') {
    return NextResponse.json(
      { message: 'Izrecno izberite, ali naj se zahteva pošlje po e-pošti.' },
      { status: 400 }
    );
  }
  const sendEmail = parsed.body.sendEmail;
  const actionId = typeof parsed.body.actionId === 'string'
    ? parsed.body.actionId.trim().toLowerCase()
    : '';
  if (!UUID_PATTERN.test(actionId)) {
    return NextResponse.json(
      { message: 'Neveljaven identifikator zahteve za pojasnilo.' },
      { status: 400 }
    );
  }

  let clarification: string;
  try {
    clarification = boundedText(parsed.body.clarification, 2_000);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Pojasnilo ni veljavno.' },
      { status: 400 }
    );
  }
  if (!clarification || !expectedRequestStateVersion) {
    return NextResponse.json(
      { message: 'Vnesite, katero pojasnilo potrebujete.' },
      { status: 400 }
    );
  }

  const clarificationEventKey = `clarification-requested:${quoteRequestId}:${actionId}`;
  const emailEventKey = `quote-clarification-requested:${quoteRequestId}:${actionId}`;
  const evidence = await quoteAdminEvidence(request);
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    await lockQuoteWorkflow(client, quoteRequestId);
    const requestResult = await client.query(
      `
        select request_number, status, state_version, voided_at
        from quote_requests
        where id = $1
        for share
      `,
      [quoteRequestId]
    );
    const quoteRequest = requestResult.rows[0];
    if (!quoteRequest) {
      await client.query('rollback');
      return NextResponse.json({ message: 'Povpraševanje ne obstaja.' }, { status: 404 });
    }

    const existingEventResult = await client.query(
      `
        select quote_offer_version_id, reason, metadata_json
        from quote_events
        where quote_request_id = $1
          and event_key = $2
          and event_type = 'clarification_requested'
        limit 1
      `,
      [quoteRequestId, clarificationEventKey]
    );
    const existingEvent = existingEventResult.rows[0];
    if (existingEvent) {
      const metadata = jsonRecord(existingEvent.metadata_json);
      const existingOfferVersionId = existingEvent.quote_offer_version_id === null
        ? null
        : Number(existingEvent.quote_offer_version_id);
      const payloadMatches =
        String(existingEvent.reason ?? '') === clarification &&
        existingOfferVersionId === quoteOfferVersionId &&
        metadata.emailRequested === sendEmail &&
        metadata.actionId === actionId;
      if (!payloadMatches) {
        await client.query('rollback');
        return NextResponse.json(
          {
            code: 'CLARIFICATION_IDEMPOTENCY_CONFLICT',
            message: 'Ta zahteva je bila že uporabljena z drugačno vsebino.'
          },
          { status: 409 }
        );
      }

      const existingEmailJob = sendEmail
        ? (await client.query(
            `
              select status
              from quote_email_jobs
              where quote_request_id = $1
                and event_key = $2
                and audience = 'customer'
              order by created_at desc, id desc
              limit 1
            `,
            [quoteRequestId, emailEventKey]
          )).rows[0]
        : undefined;
      let replayEmailQueued = false;
      if (
        sendEmail &&
        !existingEmailJob &&
        !quoteRequest.voided_at &&
        OPEN_REQUEST_STATUSES.has(String(quoteRequest.status))
      ) {
        const confirmationChallenge =
          await requireQuoteCustomerEmailConfirmation({
            client,
            quoteRequestId,
            eventType: 'quote_clarification_requested',
            action: 'request_quote_clarification',
            actionLabel: 'Zahteva za pojasnilo',
            customerEmailConfirmationToken:
              parsed.body.customerEmailConfirmationToken
          });
        if (confirmationChallenge) {
          await client.query('rollback');
          return NextResponse.json(confirmationChallenge, { status: 428 });
        }
        replayEmailQueued = await enqueueQuoteEmailIsolated(client, {
          quoteRequestId,
          quoteOfferVersionId,
          eventKey: emailEventKey,
          eventType: 'quote_clarification_requested',
          detail: clarification,
          requestId: evidence.requestId
        });
      }
      const emailStatus = !sendEmail
        ? 'not_requested'
        : existingEmailJob
          ? String(existingEmailJob.status) as EmailStatus
          : replayEmailQueued
            ? 'pending'
            : 'not_queued';
      const reference = typeof metadata.reference === 'string' && metadata.reference.trim()
        ? metadata.reference
        : String(quoteRequest.request_number);
      await client.query('commit');
      if (replayEmailQueued) scheduleQuoteEmailJobs(pool);
      return NextResponse.json({
        quoteRequestId,
        quoteOfferVersionId,
        reference,
        recorded: true,
        replayed: true,
        emailRequested: sendEmail,
        emailQueued: Boolean(existingEmailJob) || replayEmailQueued,
        emailStatus,
        stateChanged: false,
        message: clarificationMessage({
          replayed: true,
          emailRequested: sendEmail,
          emailStatus
        })
      });
    }

    if (quoteRequest.voided_at) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_REQUEST_VOIDED',
          message: 'Povpraševanje je odstranjeno in pojasnila ni več mogoče zahtevati.'
        },
        { status: 409 }
      );
    }
    if (!OPEN_REQUEST_STATUSES.has(String(quoteRequest.status))) {
      await client.query('rollback');
      return NextResponse.json(
        { message: 'Za zaključeno povpraševanje ni mogoče zahtevati pojasnila.' },
        { status: 409 }
      );
    }
    if (Number(quoteRequest.state_version) !== expectedRequestStateVersion) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_REQUEST_CONFLICT',
          message: 'Povpraševanje je bilo medtem spremenjeno. Osvežite stran.'
        },
        { status: 409 }
      );
    }

    let offerNumber: string | null = null;
    if (quoteOfferVersionId) {
      const offerResult = await client.query(
        `
          select offer_number
          from quote_offer_versions
          where id = $1 and quote_request_id = $2
        `,
        [quoteOfferVersionId, quoteRequestId]
      );
      if (!offerResult.rows[0]) {
        await client.query('rollback');
        return NextResponse.json({ message: 'Različica ponudbe ne obstaja.' }, { status: 404 });
      }
      offerNumber = offerResult.rows[0].offer_number === null
        ? null
        : String(offerResult.rows[0].offer_number);
    }
    const reference = offerNumber ?? String(quoteRequest.request_number);
    if (sendEmail) {
      const confirmationChallenge =
        await requireQuoteCustomerEmailConfirmation({
          client,
          quoteRequestId,
          eventType: 'quote_clarification_requested',
          action: 'request_quote_clarification',
          actionLabel: 'Zahteva za pojasnilo',
          customerEmailConfirmationToken:
            parsed.body.customerEmailConfirmationToken
        });
      if (confirmationChallenge) {
        await client.query('rollback');
        return NextResponse.json(confirmationChallenge, { status: 428 });
      }
    }
    await appendQuoteEvent(client, {
      quoteRequestId,
      quoteOfferVersionId,
      eventKey: clarificationEventKey,
      eventType: 'clarification_requested',
      actorId: evidence.actorId,
      requestId: evidence.requestId,
      correlationId: actionId,
      reason: clarification,
      metadata: {
        actionId,
        channel: sendEmail ? 'email_queue' : 'timeline_only',
        emailRequested: sendEmail,
        reference,
        commercialStateChanged: false
      }
    });

    let emailQueued = false;
    if (sendEmail) {
      emailQueued = await enqueueQuoteEmailIsolated(client, {
        quoteRequestId,
        quoteOfferVersionId,
        eventKey: emailEventKey,
        eventType: 'quote_clarification_requested',
        detail: clarification,
        requestId: evidence.requestId
      });
    }
    await mirrorQuoteAdminAudit(request, client, {
      quoteRequestId,
      requestNumber: String(quoteRequest.request_number),
      action: 'updated',
      summary: `Povpraševanje ${quoteRequest.request_number}: zahtevano pojasnilo`,
      metadata: {
        action_id: actionId,
        quote_offer_version_id: quoteOfferVersionId,
        reference,
        email_requested: sendEmail,
        email_queued: emailQueued
      }
    });
    await client.query('commit');
    if (emailQueued) scheduleQuoteEmailJobs(pool);

    const emailStatus: EmailStatus = sendEmail
      ? emailQueued
        ? 'pending'
        : 'not_queued'
      : 'not_requested';
    return NextResponse.json({
      quoteRequestId,
      quoteOfferVersionId,
      reference,
      recorded: true,
      replayed: false,
      emailRequested: sendEmail,
      emailQueued,
      emailStatus,
      stateChanged: false,
      message: clarificationMessage({
        replayed: false,
        emailRequested: sendEmail,
        emailStatus
      })
    });
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    console.error('[quotes.clarification] failed', {
      quoteRequestId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { message: 'Zahteve za pojasnilo ni mogoče zabeležiti.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
