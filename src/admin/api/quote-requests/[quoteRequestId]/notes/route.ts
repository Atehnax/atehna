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

  let adminNotes: string | null;
  try {
    adminNotes = boundedText(parsed.body.adminNotes, 8_000) || null;
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Opomba je predolga.' },
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
        message: 'Osvežite stran in znova shranite opombo.'
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
        select request_number, admin_notes, state_version, voided_at
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

    const previousAdminNotes = typeof before.admin_notes === 'string'
      ? before.admin_notes.trim()
      : '';
    if (previousAdminNotes === (adminNotes ?? '')) {
      await client.query('commit');
      return NextResponse.json({
        success: true,
        adminNotes: previousAdminNotes,
        stateVersion: Number(before.state_version),
        message: 'Ni sprememb za shranjevanje.'
      });
    }

    const updateResult = await client.query(
      `
        update quote_requests
        set admin_notes = $2,
            state_version = state_version + 1,
            updated_at = now()
        where id = $1
        returning state_version
      `,
      [quoteRequestId, adminNotes]
    );
    const stateVersion = Number(updateResult.rows[0]?.state_version);
    const evidence = await quoteAdminEvidence(request);
    await appendQuoteEvent(client, {
      quoteRequestId,
      eventKey: `quote-request:${quoteRequestId}:notes:${stateVersion}`,
      eventType: 'quote_request_details_changed',
      actorType: 'admin',
      actorId: evidence.actorId,
      requestId: evidence.requestId,
      metadata: {
        changedFields: ['adminNotes'],
        changedFieldCount: 1,
        detailChangedFields: [],
        adminNotesChanged: true,
        statusChanged: false
      }
    });
    await mirrorQuoteAdminAudit(request, client, {
      quoteRequestId,
      requestNumber: String(before.request_number),
      action: 'updated',
      summary: `Povpraševanje ${before.request_number}: opomba administratorja spremenjena`,
      metadata: { changed_fields: ['adminNotes'] }
    });

    await client.query('commit');
    return NextResponse.json({
      success: true,
      adminNotes: adminNotes ?? '',
      stateVersion,
      message: 'Opomba administratorja je shranjena.'
    });
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    console.error('[quotes.notes] failed', {
      quoteRequestId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { message: 'Opombe administratorja ni mogoče shraniti.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
