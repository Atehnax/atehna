import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { scheduleQuoteEmailJobs } from '@/shared/server/quoteEmailJobs';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';
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
  const expectedRequestStateVersion = expectedVersion(
    parsed.body.expectedRequestStateVersion ?? parsed.body.expectedStateVersion
  );
  let reason: string;
  try {
    reason = boundedText(parsed.body.reason, 2_000);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Razlog ni veljaven.' },
      { status: 400 }
    );
  }
  if (!expectedRequestStateVersion || !reason) {
    return NextResponse.json(
      { message: 'Vnesite razlog zaključka in osvežite stanje povpraševanja.' },
      { status: 400 }
    );
  }

  const evidence = await quoteAdminEvidence(request);
  const pool = await getPool();
  const client = await pool.connect();
  let emailQueued = false;
  try {
    await client.query('begin');
    await lockQuoteWorkflow(client, quoteRequestId);
    const requestResult = await client.query(
      `select request_number, status, state_version, voided_at from quote_requests where id = $1 for update`,
      [quoteRequestId]
    );
    const quoteRequest = requestResult.rows[0];
    if (!quoteRequest) {
      await client.query('rollback');
      return NextResponse.json({ message: 'Povpraševanje ne obstaja.' }, { status: 404 });
    }
    if (quoteRequest.voided_at) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_REQUEST_VOIDED',
          message: 'Povpraševanje je odstranjeno in ga ni več mogoče zaključiti.'
        },
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
    if (!['received', 'in_preparation'].includes(String(quoteRequest.status))) {
      await client.query('rollback');
      return NextResponse.json(
        {
          message:
            'Brez ponudbe je mogoče zaključiti samo prejeto povpraševanje ali povpraševanje v pripravi.'
        },
        { status: 409 }
      );
    }
    const offerHistory = await client.query(
      `
        select
          count(*) filter (where status <> 'draft')::int as issued_count,
          count(*) filter (where status = 'draft')::int as draft_count
        from quote_offer_versions
        where quote_request_id = $1
      `,
      [quoteRequestId]
    );
    if (Number(offerHistory.rows[0]?.issued_count ?? 0) > 0) {
      await client.query('rollback');
      return NextResponse.json(
        {
          message:
            'Povpraševanje že ima izdano ponudbo. Ponudbo umaknite namesto zaključka brez ponudbe.'
        },
        { status: 409 }
      );
    }

    await client.query(
      `
        update quote_requests
        set status = 'closed_without_offer',
            closed_at = now(),
            closed_by_actor_type = 'admin',
            closed_by_actor_id = $2,
            closure_reason = $3,
            state_version = state_version + 1,
            updated_at = now()
        where id = $1
      `,
      [quoteRequestId, evidence.actorId, reason]
    );
    const revokedResult = await client.query(
      `
        update quote_access_tokens
        set revoked_at = now()
        where quote_request_id = $1 and revoked_at is null
      `,
      [quoteRequestId]
    );
    await appendQuoteEvent(client, {
      quoteRequestId,
      eventKey: `request-closed-without-offer:${quoteRequestId}`,
      eventType: 'request_closed_without_offer',
      actorId: evidence.actorId,
      requestId: evidence.requestId,
      reason,
      metadata: {
        draftCount: Number(offerHistory.rows[0]?.draft_count ?? 0),
        accessTokensRevoked: revokedResult.rowCount ?? 0
      }
    });
    emailQueued = await enqueueQuoteEmailIsolated(client, {
      quoteRequestId,
      eventKey: `quote-request-closed:${quoteRequestId}`,
      eventType: 'quote_request_closed',
      detail: reason,
      suppressAdmin: true,
      requestId: evidence.requestId
    });
    await mirrorQuoteAdminAudit(request, client, {
      quoteRequestId,
      requestNumber: String(quoteRequest.request_number),
      summary: `Povpraševanje ${quoteRequest.request_number} zaključeno brez ponudbe`,
      beforeStatus: String(quoteRequest.status),
      afterStatus: 'closed_without_offer',
      metadata: { reason }
    });
    await client.query('commit');
    if (emailQueued) scheduleQuoteEmailJobs(pool);
    return NextResponse.json({
      quoteRequestId,
      requestNumber: quoteRequest.request_number,
      status: 'closed_without_offer',
      emailQueued,
      message: 'Povpraševanje je zaključeno brez izdaje ponudbe.'
    });
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    console.error('[quotes.close] failed', {
      quoteRequestId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { message: 'Povpraševanja ni mogoče zaključiti.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
