import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { lockQuoteWorkflow } from '@/shared/server/quoteAccess';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';
import { revalidateAdminQuotePaths } from '@/shared/server/revalidateAdminQuotes';
import {
  appendQuoteEvent,
  boundedText,
  hasValidQuoteAdminSession,
  positiveInteger,
  quoteAdminEvidence
} from '@/admin/api/quote-requests/quoteAdminRouteUtils';

async function optionalDeleteBody(request: Request): Promise<Record<string, unknown>> {
  const source = await request.text();
  if (!source.trim()) return {};
  const parsed = JSON.parse(source) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Telo zahteve mora biti JSON objekt.');
  }
  return parsed as Record<string, unknown>;
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ quoteRequestId: string }> }
) {
  if (!isQuoteAdminEnabled()) {
    return NextResponse.json({ message: 'Ponudbe niso omogočene.' }, { status: 404 });
  }
  if (!hasValidQuoteAdminSession(request)) {
    return NextResponse.json({ message: 'Za dostop je potrebna prijava.' }, { status: 401 });
  }
  const { quoteRequestId: rawId } = await props.params;
  const quoteRequestId = positiveInteger(rawId);
  if (!quoteRequestId) {
    return NextResponse.json({ message: 'Neveljaven ID povpraševanja.' }, { status: 400 });
  }

  let expectedStateVersion: number | null = null;
  let reason = 'Ročno odstranjeno iz aktivnega pregleda.';
  try {
    const body = await optionalDeleteBody(request);
    if (body.expectedStateVersion !== undefined) {
      expectedStateVersion = positiveInteger(body.expectedStateVersion);
      if (!expectedStateVersion) throw new Error('Različica povpraševanja ni veljavna.');
    }
    reason = boundedText(body.reason, 2_000, reason) || reason;
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Zahteva ni veljavna.' },
      { status: 400 }
    );
  }

  const evidence = await quoteAdminEvidence(request);
  const actorId = evidence.actorId ?? 'admin';
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    await lockQuoteWorkflow(client, quoteRequestId);
    const requestResult = await client.query(
      `
        select id, request_number, status, intake_source, state_version, voided_at
        from quote_requests
        where id = $1
        for update
      `,
      [quoteRequestId]
    );
    const current = requestResult.rows[0] as Record<string, unknown> | undefined;
    if (!current) {
      await client.query('rollback');
      return NextResponse.json({ message: 'Povpraševanje ne obstaja.' }, { status: 404 });
    }
    if (current.voided_at) {
      await client.query('commit');
      revalidateAdminQuotePaths(quoteRequestId);
      return NextResponse.json({
        success: true,
        quoteRequestId,
        requestNumber: String(current.request_number),
        voided: true,
        unchanged: true
      });
    }
    if (
      expectedStateVersion !== null
      && Number(current.state_version) !== expectedStateVersion
    ) {
      await client.query('rollback');
      return NextResponse.json({
        code: 'QUOTE_REQUEST_STALE',
        message: 'Povpraševanje je bilo medtem spremenjeno. Osvežite stran.'
      }, { status: 409 });
    }
    const isTestingRequest = current.intake_source === 'admin_testing';
    if (
      !isTestingRequest
      && !['received', 'in_preparation'].includes(String(current.status))
    ) {
      await client.query('rollback');
      return NextResponse.json({
        code: 'QUOTE_REQUEST_VOID_BLOCKED',
        message: 'Odstraniti je mogoče samo neizdano povpraševanje.'
      }, { status: 409 });
    }

    const guardResult = await client.query(
      `
        select
          exists (
            select 1 from quote_offer_versions offer
            where offer.quote_request_id = $1 and offer.status <> 'draft'
          ) as has_non_draft_offer,
          exists (
            select 1 from quote_documents document
            join quote_offer_versions offer on offer.id = document.quote_offer_version_id
            where offer.quote_request_id = $1
          ) as has_document,
          exists (
            select 1 from quote_documents document
            join quote_offer_versions offer on offer.id = document.quote_offer_version_id
            where offer.quote_request_id = $1
              and document.document_type = 'purchase_order'
          ) as has_purchase_order_document,
          exists (
            select 1 from quote_document_jobs job
            join quote_offer_versions offer on offer.id = job.quote_offer_version_id
            where offer.quote_request_id = $1
          ) as has_document_job,
          exists (
            select 1 from quote_offer_acceptances acceptance
            join quote_offer_versions offer on offer.id = acceptance.quote_offer_version_id
            where offer.quote_request_id = $1
          ) as has_acceptance,
          exists (
            select 1 from orders linked_order
            join quote_offer_versions offer
              on offer.id = linked_order.source_quote_offer_version_id
            where offer.quote_request_id = $1
          ) as has_linked_order
      `,
      [quoteRequestId]
    );
    const guard = guardResult.rows[0] as Record<string, unknown> | undefined;
    const hasCustomerCommitment =
      guard?.has_acceptance
      || guard?.has_purchase_order_document
      || guard?.has_linked_order
      || ['awaiting_purchase_order_review', 'accepted', 'converted_to_order']
        .includes(String(current.status));
    const hasProtectedCommercialHistory =
      !isTestingRequest
      && (
        guard?.has_non_draft_offer
        || guard?.has_document
        || guard?.has_document_job
      );
    if (hasCustomerCommitment || hasProtectedCommercialHistory) {
      await client.query('rollback');
      return NextResponse.json({
        code: 'QUOTE_REQUEST_VOID_BLOCKED',
        message: 'Povpraševanje že ima poslovno zgodovino in ga ni mogoče odstraniti.'
      }, { status: 409 });
    }

    const voidedResult = await client.query(
      `
        update quote_requests
        set voided_at = now(),
            voided_by_actor_id = $2,
            void_reason = $3,
            state_version = state_version + 1,
            updated_at = now()
        where id = $1
        returning voided_at, state_version
      `,
      [quoteRequestId, actorId, reason]
    );
    const revoked = await client.query(
      `
        update quote_access_tokens
        set revoked_at = now()
        where quote_request_id = $1 and revoked_at is null
      `,
      [quoteRequestId]
    );
    const expiredVerifications = await client.query(
      `
        update quote_email_verifications
        set status = 'expired'
        where quote_request_id = $1
          and status in ('pending', 'verified')
          and consumed_at is null
      `,
      [quoteRequestId]
    );
    const suppressedEmailJobs = await client.query(
      `
        update quote_email_jobs
        set status = 'failed',
            claim_id = null,
            locked_at = null,
            recipient_name = null,
            payload_json = jsonb_build_object(
              'version', 1,
              'redacted', true,
              'eventType', event_type,
              'audience', audience,
              'failureKind', 'voided_request'
            ),
            last_error = '[voided_request] Povpraševanje je bilo odstranjeno.',
            updated_at = now()
        where quote_request_id = $1
          and status = 'pending'
      `,
      [quoteRequestId]
    );
    const suppressedDocumentJobs = await client.query(
      `
        update quote_document_jobs job
        set status = 'completed',
            claim_id = null,
            locked_at = null,
            last_error = '[voided_request] Povpraševanje je bilo odstranjeno.',
            completed_at = coalesce(job.completed_at, now()),
            updated_at = now()
        from quote_offer_versions offer
        where job.quote_offer_version_id = offer.id
          and offer.quote_request_id = $1
          and job.status = 'pending'
      `,
      [quoteRequestId]
    );
    await appendQuoteEvent(client, {
      quoteRequestId,
      eventKey: `request-voided:${quoteRequestId}`,
      eventType: 'request_voided',
      actorType: 'admin',
      actorId,
      requestId: evidence.requestId,
      reason,
      metadata: {
        previousStatus: String(current.status),
        intakeSource: String(current.intake_source),
        accessTokensRevoked: revoked.rowCount ?? 0,
        otpVerificationsExpired: expiredVerifications.rowCount ?? 0,
        emailJobsSuppressed: suppressedEmailJobs.rowCount ?? 0,
        documentJobsSuppressed: suppressedDocumentJobs.rowCount ?? 0,
        logicalDelete: true
      }
    });
    const requestNumber = String(current.request_number);
    await insertAuditEventForRequest(request, {
      entityType: 'system',
      entityId: `quote:${quoteRequestId}`,
      entityLabel: `Povpraševanje ${requestNumber}`,
      action: 'deleted',
      summary: `Povpraševanje ${requestNumber}: odstranjeno iz aktivnega pregleda`,
      diff: {
        voided_at: {
          label: 'Logično odstranjeno',
          before: null,
          after: 'nastavljeno'
        }
      },
      metadata: {
        quote_request_id: quoteRequestId,
        request_number: requestNumber,
        reason,
        logical_delete: true,
        access_tokens_revoked: revoked.rowCount ?? 0,
        otp_verifications_expired: expiredVerifications.rowCount ?? 0,
        email_jobs_suppressed: suppressedEmailJobs.rowCount ?? 0,
        document_jobs_suppressed: suppressedDocumentJobs.rowCount ?? 0
      }
    }, client);
    await client.query('commit');
    revalidateAdminQuotePaths(quoteRequestId);
    return NextResponse.json({
      success: true,
      quoteRequestId,
      requestNumber,
      voided: true,
      voidedAt: voidedResult.rows[0]?.voided_at,
      stateVersion: Number(voidedResult.rows[0]?.state_version)
    });
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    console.error('[quotes.admin-void] failed', {
      quoteRequestId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { message: 'Povpraševanja trenutno ni mogoče odstraniti.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
