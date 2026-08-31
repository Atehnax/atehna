import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import {
  lockQuoteWorkflow,
  revokeQuoteAccessForOffer
} from '@/shared/server/quoteAccess';
import { scheduleQuoteEmailJobs } from '@/shared/server/quoteEmailJobs';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import {
  appendQuoteEvent,
  boundedText,
  enqueueQuoteEmailIsolated,
  expectedVersion,
  hasValidQuoteAdminSession,
  lockPendingQuotePurchaseOrder,
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
  const quoteOfferVersionId = positiveInteger(parsed.body.offerVersionId);
  const expectedStateVersion = expectedVersion(parsed.body.expectedStateVersion);
  const expectedRequestStateVersion = expectedVersion(
    parsed.body.expectedRequestStateVersion
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
  if (!quoteOfferVersionId || !expectedStateVersion || !reason) {
    return NextResponse.json(
      { message: 'Izberite izdano ponudbo in vnesite razlog umika.' },
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
          message: 'Povpraševanje je odstranjeno in ga ni več mogoče spreminjati.'
        },
        { status: 409 }
      );
    }
    if (
      expectedRequestStateVersion &&
      Number(quoteRequest.state_version) !== expectedRequestStateVersion
    ) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_REQUEST_CONFLICT',
          message: 'Povpraševanje je bilo medtem spremenjeno. Osvežite stran.'
        },
        { status: 409 }
      );
    }
    const offerResult = await client.query(
      `
        select id, offer_number, status, is_current, state_version
        from quote_offer_versions
        where id = $1 and quote_request_id = $2
        for update
      `,
      [quoteOfferVersionId, quoteRequestId]
    );
    const offer = offerResult.rows[0];
    if (!offer || offer.status !== 'issued' || offer.is_current !== true) {
      await client.query('rollback');
      return NextResponse.json(
        { message: 'Umakniti je mogoče samo trenutno izdano ponudbo.' },
        { status: 409 }
      );
    }
    if (Number(offer.state_version) !== expectedStateVersion) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_VERSION_CONFLICT',
          message: 'Ponudba je bila medtem spremenjena. Osvežite stran.'
        },
        { status: 409 }
      );
    }
    const pendingPurchaseOrder = await lockPendingQuotePurchaseOrder(
      client,
      quoteRequestId
    );
    if (pendingPurchaseOrder) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'PURCHASE_ORDER_REVIEW_REQUIRED',
          message: `Naročilo ${pendingPurchaseOrder.orderNumber} najprej potrdite ali zavrnite v pregledu naročilnice.`
        },
        { status: 409 }
      );
    }

    const draftResult = await client.query(
      `
        select id
        from quote_offer_versions
        where quote_request_id = $1 and status = 'draft'
        for update
      `,
      [quoteRequestId]
    );
    const nextRequestStatus = draftResult.rowCount ? 'in_preparation' : 'withdrawn';

    await client.query(
      `
        update quote_offer_versions
        set status = 'withdrawn',
            is_current = false,
            withdrawn_at = now(),
            withdrawal_reason = $2,
            state_version = state_version + 1,
            updated_at = now()
        where id = $1
      `,
      [quoteOfferVersionId, reason]
    );
    await revokeQuoteAccessForOffer(client, quoteOfferVersionId);
    const previousRequestStatus = String(quoteRequest.status);
    await client.query(
      `
        update quote_requests
        set status = $2,
            closed_at = case when $2 = 'withdrawn' then now() else null end,
            closed_by_actor_type = case when $2 = 'withdrawn' then 'admin' else null end,
            closed_by_actor_id = case when $2 = 'withdrawn' then $3 else null end,
            closure_reason = case when $2 = 'withdrawn' then $4 else null end,
            state_version = state_version + 1,
            updated_at = now()
        where id = $1
      `,
      [quoteRequestId, nextRequestStatus, evidence.actorId, reason]
    );
    await appendQuoteEvent(client, {
      quoteRequestId,
      quoteOfferVersionId,
      eventKey: `offer-withdrawn:${quoteOfferVersionId}`,
      eventType: 'offer_withdrawn',
      actorId: evidence.actorId,
      requestId: evidence.requestId,
      reason,
      metadata: {
        offerNumber: offer.offer_number,
        accessRevoked: true,
        requestStatus: nextRequestStatus,
        sourceSnapshotMutated: false
      }
    });
    emailQueued = await enqueueQuoteEmailIsolated(client, {
      quoteRequestId,
      quoteOfferVersionId,
      eventKey: `quote-withdrawn:${quoteOfferVersionId}`,
      eventType: 'quote_withdrawn',
      detail: reason,
      suppressAdmin: true,
      requestId: evidence.requestId
    });
    await mirrorQuoteAdminAudit(request, client, {
      quoteRequestId,
      requestNumber: String(quoteRequest.request_number),
      summary: `Ponudba ${offer.offer_number} umaknjena`,
      beforeStatus: previousRequestStatus,
      afterStatus: nextRequestStatus,
      metadata: {
        quote_offer_version_id: quoteOfferVersionId,
        offer_number: offer.offer_number,
        reason
      }
    });
    await client.query('commit');
    if (emailQueued) scheduleQuoteEmailJobs(pool);
    return NextResponse.json({
      quoteRequestId,
      quoteOfferVersionId,
      offerNumber: offer.offer_number,
      status: nextRequestStatus,
      offerStatus: 'withdrawn',
      emailQueued,
      message: 'Ponudba je umaknjena. Izdani posnetek je ostal nespremenjen.'
    });
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    console.error('[quotes.withdraw] failed', {
      quoteRequestId,
      quoteOfferVersionId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { message: 'Ponudbe ni mogoče umakniti.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
