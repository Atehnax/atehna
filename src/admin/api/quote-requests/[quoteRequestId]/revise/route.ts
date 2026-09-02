import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { lockQuoteWorkflow } from '@/shared/server/quoteAccess';
import {
  createQuoteOfferDraftRevision,
  type QuoteOfferRevisionSource
} from '@/shared/server/quoteOfferRevision';
import {
  appendQuoteEvent,
  expectedVersion,
  hasValidQuoteAdminSession,
  lockPendingQuotePurchaseOrder,
  mirrorQuoteAdminAudit,
  positiveInteger,
  quoteAdminEvidence
} from '@/admin/api/quote-requests/quoteAdminRouteUtils';

const REVISABLE_OFFER_STATUSES = new Set(['issued', 'withdrawn', 'expired']);

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
  const sourceOfferVersionId = positiveInteger(parsed.body.offerVersionId);
  const expectedStateVersion = expectedVersion(parsed.body.expectedStateVersion);
  const expectedRequestStateVersion = expectedVersion(
    parsed.body.expectedRequestStateVersion
  );
  if (!sourceOfferVersionId || !expectedStateVersion) {
    return NextResponse.json(
      { message: 'Manjka veljavna izvorna različica ponudbe.' },
      { status: 400 }
    );
  }

  const evidence = await quoteAdminEvidence(request);
  const pool = await getPool();
  const client = await pool.connect();
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
    if (
      ['accepted', 'declined', 'converted_to_order', 'closed_without_offer'].includes(
        String(quoteRequest.status)
      )
    ) {
      await client.query('rollback');
      return NextResponse.json(
        { message: 'Iz zaključenega povpraševanja ni mogoče pripraviti nove ponudbe.' },
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
    const existingDraft = await client.query(
      `
        select id, version_number
        from quote_offer_versions
        where quote_request_id = $1 and status = 'draft'
        for update
      `,
      [quoteRequestId]
    );
    if (existingDraft.rowCount) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_DRAFT_EXISTS',
          message: 'Za povpraševanje že obstaja osnutek nove različice.',
          quoteOfferVersionId: Number(existingDraft.rows[0].id)
        },
        { status: 409 }
      );
    }
    const sourceResult = await client.query(
      `
        select *
        from quote_offer_versions
        where id = $1 and quote_request_id = $2
        for update
      `,
      [sourceOfferVersionId, quoteRequestId]
    );
    const source = sourceResult.rows[0];
    if (!source || !REVISABLE_OFFER_STATUSES.has(String(source.status))) {
      await client.query('rollback');
      return NextResponse.json(
        { message: 'Novo različico je mogoče pripraviti iz izdane, umaknjene ali potekle ponudbe.' },
        { status: 409 }
      );
    }
    if (Number(source.state_version) !== expectedStateVersion) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_VERSION_CONFLICT',
          message: 'Ponudba je bila medtem spremenjena. Osvežite stran.'
        },
        { status: 409 }
      );
    }

    const created = await createQuoteOfferDraftRevision(client, {
      quoteRequestId,
      source: source as QuoteOfferRevisionSource,
      actorId: evidence.actorId
    });
    const nextVersion = created.versionNumber;
    const newOfferVersionId = created.id;
    const previousRequestStatus = String(quoteRequest.status);
    await client.query(
      `
        update quote_requests
        set status = 'in_preparation',
            closed_at = null,
            closed_by_actor_type = null,
            closed_by_actor_id = null,
            closure_reason = null,
            state_version = state_version + 1,
            updated_at = now()
        where id = $1
      `,
      [quoteRequestId]
    );
    await appendQuoteEvent(client, {
      quoteRequestId,
      quoteOfferVersionId: newOfferVersionId,
      eventKey: `draft-created:${newOfferVersionId}`,
      eventType: 'draft_created',
      actorId: evidence.actorId,
      requestId: evidence.requestId,
      metadata: {
        versionNumber: nextVersion,
        revisedFromOfferVersionId: sourceOfferVersionId,
        revisedFromOfferNumber: source.offer_number,
        sourceStatus: source.status,
        sourceRemainsImmutable: true,
        sourceRemainsCurrentUntilIssue: source.status === 'issued'
      }
    });
    await mirrorQuoteAdminAudit(request, client, {
      quoteRequestId,
      requestNumber: String(quoteRequest.request_number),
      action: 'updated',
      summary: `Povpraševanje ${quoteRequest.request_number}: pripravljen osnutek V${nextVersion}`,
      beforeStatus: previousRequestStatus,
      afterStatus: 'in_preparation',
      metadata: {
        quote_offer_version_id: newOfferVersionId,
        source_quote_offer_version_id: sourceOfferVersionId,
        version_number: nextVersion
      }
    });
    await client.query('commit');
    return NextResponse.json(
      {
        quoteOfferVersionId: newOfferVersionId,
        versionNumber: nextVersion,
        stateVersion: created.stateVersion,
        validUntil: new Date(String(created.validUntil)).toISOString(),
        status: 'draft',
        sourceOfferVersionId,
        sourceStatus: source.status
      },
      { status: 201 }
    );
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    console.error('[quotes.revise] failed', {
      quoteRequestId,
      sourceOfferVersionId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { message: 'Nove različice ponudbe ni mogoče pripraviti.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
