import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { lockQuoteWorkflow } from '@/shared/server/quoteAccess';
import { isManuallyEditableQuoteRequestStatus } from '@/shared/domain/quote/quoteRequestStatus';
import {
  appendQuoteEvent,
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
  const status = typeof parsed.body.status === 'string'
    ? parsed.body.status.trim()
    : '';
  const expectedRequestStateVersion = expectedVersion(
    parsed.body.expectedRequestStateVersion
  );
  if (!isManuallyEditableQuoteRequestStatus(status)) {
    return NextResponse.json(
      { message: 'Izbrani status ni dovoljen za ročno urejanje.' },
      { status: 400 }
    );
  }
  if (!expectedRequestStateVersion) {
    return NextResponse.json(
      {
        code: 'QUOTE_REQUEST_STALE',
        message: 'Osvežite stran in znova shranite status.'
      },
      { status: 409 }
    );
  }

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
        for update
      `,
      [quoteRequestId]
    );
    const before = requestResult.rows[0] as Record<string, unknown> | undefined;
    if (!before) {
      await client.query('rollback');
      return NextResponse.json({ message: 'Povpraševanje ne obstaja.' }, { status: 404 });
    }
    if (before.voided_at) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_REQUEST_VOIDED',
          message: 'Povpraševanje je odstranjeno in ga ni več mogoče urejati.'
        },
        { status: 409 }
      );
    }
    if (Number(before.state_version) !== expectedRequestStateVersion) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_REQUEST_STALE',
          message: 'Povpraševanje je bilo medtem spremenjeno. Osvežite stran.'
        },
        { status: 409 }
      );
    }

    const previousStatus = String(before.status);
    if (!isManuallyEditableQuoteRequestStatus(previousStatus)) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_STATUS_LIFECYCLE_OWNED',
          message: 'Ta status je mogoče spremeniti samo z dejanjem poteka ponudbe.'
        },
        { status: 409 }
      );
    }
    if (previousStatus === status) {
      await client.query('commit');
      return NextResponse.json({
        success: true,
        status,
        stateVersion: Number(before.state_version),
        message: 'Ni sprememb za shranjevanje.'
      });
    }

    const issuedHistoryResult = await client.query(
      `
        select id
        from quote_offer_versions
        where quote_request_id = $1
          and status <> 'draft'
        limit 1
        for share
      `,
      [quoteRequestId]
    );
    if (issuedHistoryResult.rowCount) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_STATUS_LIFECYCLE_OWNED',
          message: 'Za ponudbo z zgodovino izdaje uporabite dejanje poteka ponudbe.'
        },
        { status: 409 }
      );
    }

    const updateResult = await client.query(
      `
        update quote_requests
        set status = $2,
            state_version = state_version + 1,
            updated_at = now()
        where id = $1
        returning state_version
      `,
      [quoteRequestId, status]
    );
    const stateVersion = Number(updateResult.rows[0]?.state_version);
    const evidence = await quoteAdminEvidence(request);
    await appendQuoteEvent(client, {
      quoteRequestId,
      eventKey: `quote-request:${quoteRequestId}:status:${stateVersion}`,
      eventType: 'quote_request_details_changed',
      actorType: 'admin',
      actorId: evidence.actorId,
      requestId: evidence.requestId,
      metadata: {
        changedFields: ['status'],
        changedFieldCount: 1,
        detailChangedFields: [],
        previousStatus,
        nextStatus: status,
        statusChanged: true,
        manual: true
      }
    });
    await mirrorQuoteAdminAudit(request, client, {
      quoteRequestId,
      requestNumber: String(before.request_number),
      action: 'status_changed',
      summary: `Povpraševanje ${before.request_number}: status ${previousStatus} → ${status}`,
      beforeStatus: previousStatus,
      afterStatus: status,
      metadata: { manual: true }
    });

    await client.query('commit');
    return NextResponse.json({
      success: true,
      status,
      stateVersion,
      message: 'Status povpraševanja je shranjen.'
    });
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    console.error('[quotes.status] failed', {
      quoteRequestId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { message: 'Statusa povpraševanja ni mogoče shraniti.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
