import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { lockQuoteWorkflow } from '@/shared/server/quoteAccess';
import {
  appendQuoteEvent,
  boundedText,
  expectedVersion,
  hasValidQuoteAdminSession,
  mirrorQuoteAdminAudit,
  positiveInteger,
  quoteAdminEvidence
} from '@/admin/api/quote-requests/quoteAdminRouteUtils';

export async function PUT(
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
  if (typeof parsed.body.title !== 'string') {
    return NextResponse.json(
      { message: 'Naslov povpraševanja mora biti besedilo.' },
      { status: 400 }
    );
  }

  let adminTitle: string | null;
  try {
    adminTitle = boundedText(parsed.body.title, 240) || null;
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Naslov je predolg.' },
      { status: 400 }
    );
  }
  const expectedRequestStateVersion = expectedVersion(
    parsed.body.expectedRequestStateVersion
  );
  if (!expectedRequestStateVersion) {
    return NextResponse.json(
      {
        code: 'QUOTE_REQUEST_STALE',
        message: 'Osvežite stran in znova shranite naslov.'
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
        select request_number, admin_title, state_version, voided_at
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

    const requestNumber = String(before.request_number);
    const fallbackTitle = `Povpraševanje ${requestNumber}`;
    const previousAdminTitle =
      typeof before.admin_title === 'string'
        ? before.admin_title.trim() || null
        : null;
    if (previousAdminTitle === adminTitle) {
      await client.query('commit');
      return NextResponse.json({
        success: true,
        title: previousAdminTitle ?? fallbackTitle,
        adminTitle: previousAdminTitle,
        stateVersion: Number(before.state_version),
        message: 'Ni sprememb za shranjevanje.'
      });
    }

    const updateResult = await client.query(
      `
        update quote_requests
        set admin_title = $2,
            state_version = state_version + 1,
            updated_at = now()
        where id = $1
        returning state_version
      `,
      [quoteRequestId, adminTitle]
    );
    const stateVersion = Number(updateResult.rows[0]?.state_version);
    const evidence = await quoteAdminEvidence(request);
    await appendQuoteEvent(client, {
      quoteRequestId,
      eventKey: `quote-request:${quoteRequestId}:title:${stateVersion}`,
      eventType: 'quote_request_details_changed',
      actorType: 'admin',
      actorId: evidence.actorId,
      requestId: evidence.requestId,
      metadata: {
        changedFields: ['adminTitle'],
        changedFieldCount: 1,
        detailChangedFields: [],
        adminTitleChanged: true,
        statusChanged: false
      }
    });
    await mirrorQuoteAdminAudit(request, client, {
      quoteRequestId,
      requestNumber,
      action: 'updated',
      summary: `Povpraševanje ${requestNumber}: naslov spremenjen`,
      metadata: { changed_fields: ['adminTitle'] }
    });

    await client.query('commit');
    return NextResponse.json({
      success: true,
      title: adminTitle ?? fallbackTitle,
      adminTitle,
      stateVersion,
      message: 'Naslov povpraševanja je shranjen.'
    });
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    console.error('[quotes.title] failed', {
      quoteRequestId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { message: 'Naslova povpraševanja ni mogoče shraniti.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
