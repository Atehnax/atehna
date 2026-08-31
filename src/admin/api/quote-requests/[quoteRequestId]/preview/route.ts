import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';
import { renderQuoteOfferPdf } from '@/shared/server/quoteDocumentJobs';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { lockQuoteWorkflow } from '@/shared/server/quoteAccess';
import {
  appendQuoteEvent,
  expectedVersion,
  hasValidQuoteAdminSession,
  mirrorQuoteAdminAudit,
  positiveInteger,
  quoteAdminEvidence
} from '@/admin/api/quote-requests/quoteAdminRouteUtils';

const PRIVATE_HEADERS = {
  'Cache-Control': 'no-store, private',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff'
};

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
  if (!quoteOfferVersionId || !expectedStateVersion) {
    return NextResponse.json(
      { message: 'Manjka veljavna različica osnutka.' },
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
      `select request_number, status, voided_at from quote_requests where id = $1 for update`,
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
          message: 'Povpraševanje je odstranjeno in predogled ni več dovoljen.'
        },
        { status: 409 }
      );
    }
    if (!['received', 'in_preparation'].includes(String(quoteRequest.status))) {
      await client.query('rollback');
      return NextResponse.json(
        { message: 'Predogled je dovoljen samo za odprto povpraševanje.' },
        { status: 409 }
      );
    }
    const offerResult = await client.query(
      `
        select id, status, state_version
        from quote_offer_versions
        where id = $1 and quote_request_id = $2
        for update
      `,
      [quoteOfferVersionId, quoteRequestId]
    );
    const offer = offerResult.rows[0];
    if (!offer || offer.status !== 'draft') {
      await client.query('rollback');
      return NextResponse.json(
        { message: 'Predogled je dovoljen samo za shranjen osnutek.' },
        { status: 409 }
      );
    }
    if (Number(offer.state_version) !== expectedStateVersion) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_VERSION_CONFLICT',
          message: 'Osnutek je bil medtem spremenjen. Osvežite stran.'
        },
        { status: 409 }
      );
    }

    const rendered = await renderQuoteOfferPdf(client, quoteOfferVersionId, {
      mode: 'preview'
    });
    await appendQuoteEvent(client, {
      quoteRequestId,
      quoteOfferVersionId,
      eventKey: `preview-generated:${quoteOfferVersionId}:${expectedStateVersion}:${evidence.requestId}`,
      eventType: 'preview_generated',
      actorId: evidence.actorId,
      requestId: evidence.requestId,
      metadata: {
        versionNumber: rendered.versionNumber,
        stateVersion: expectedStateVersion,
        storedDocument: false,
        issued: false
      }
    });
    await mirrorQuoteAdminAudit(request, client, {
      quoteRequestId,
      requestNumber: String(quoteRequest.request_number),
      action: 'updated',
      summary: `Povpraševanje ${quoteRequest.request_number}: ustvarjen predogled ponudbe`,
      metadata: {
        quote_offer_version_id: quoteOfferVersionId,
        preview_only: true
      }
    });
    await client.query('commit');

    const filename = `predogled-${rendered.requestNumber}-V${rendered.versionNumber}.pdf`
      .replace(/["\r\n]/gu, '_');
    return new NextResponse(Buffer.from(rendered.bytes), {
      status: 200,
      headers: {
        ...PRIVATE_HEADERS,
        'Content-Type': 'application/pdf',
        'Content-Length': String(rendered.bytes.byteLength),
        'Content-Disposition': `inline; filename="${filename}"`
      }
    });
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    console.error('[quotes.preview] failed', {
      quoteRequestId,
      quoteOfferVersionId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { message: 'Predogleda ponudbe trenutno ni mogoče ustvariti.' },
      { status: 500, headers: PRIVATE_HEADERS }
    );
  } finally {
    client.release();
  }
}
