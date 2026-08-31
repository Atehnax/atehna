import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { verifyQuoteAccessSession } from '@/shared/server/quoteAccess';
import {
  enqueueQuoteEmailEvent,
  scheduleQuoteEmailJobs
} from '@/shared/server/quoteEmailJobs';
import { isQuoteOnlineAcceptanceEnabled } from '@/shared/server/quoteFeatureFlags';
import { consumeVerifiedQuoteOtp } from '@/shared/server/quoteOtp';
import {
  consumeQuoteRateLimit,
  quoteRateSubjectHash,
  requestNetworkSubject
} from '@/shared/server/quoteRateLimit';
import {
  completeQuoteResponseIdempotency,
  QuoteResponseIdempotencyError,
  quoteResponseSha256,
  readQuoteResponseIdempotencyKey,
  reserveQuoteResponseIdempotency,
  type StoredQuoteResponse
} from '@/shared/server/quoteResponseIdempotency';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { requestOriginMatchesHost } from '@/shared/server/requestSecurity';

export const runtime = 'nodejs';

const REASONS = new Set([
  'price',
  'delivery_time',
  'needs_changed',
  'another_offer',
  'other'
]);
const headers = {
  'Cache-Control': 'no-store, private',
  'Referrer-Policy': 'no-referrer'
};

export async function POST(request: NextRequest) {
  if (!isQuoteOnlineAcceptanceEnabled()) {
    return NextResponse.json(
      { code: 'QUOTE_RESPONSE_DISABLED', message: 'Spletni odgovor trenutno ni na voljo.' },
      { status: 503, headers }
    );
  }
  if (!requestOriginMatchesHost(request)) {
    return NextResponse.json(
      { code: 'INVALID_ORIGIN', message: 'Zahteve ni mogoče potrditi.' },
      { status: 403, headers }
    );
  }
  const parsed = await readRequiredJsonRecord(request);
  if (!parsed.ok) return parsed.response;
  const reasonValue =
    typeof parsed.body.reason === 'string' ? parsed.body.reason.trim() : '';
  const reason = REASONS.has(reasonValue) ? reasonValue : null;
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    const access = await verifyQuoteAccessSession(client, request, {
      scope: 'offer_response',
      requireCsrf: true
    });
    if (!access || !access.quoteOfferVersionId || !access.accessSessionHash) {
      await client.query('rollback');
      return NextResponse.json({ message: 'Ponudba ni dostopna.' }, { status: 404, headers });
    }
    const rate = await consumeQuoteRateLimit(client, {
      scope: 'offer_response',
      subjectHash: quoteRateSubjectHash(
        requestNetworkSubject(request),
        access.tokenId,
        access.quoteOfferVersionId,
        'decline'
      ),
      maximumAttempts: 8,
      windowSeconds: 15 * 60,
      blockSeconds: 60 * 60
    });
    if (!rate.allowed) {
      await client.query('rollback');
      return NextResponse.json(
        { code: 'RATE_LIMITED', message: 'Preveč poskusov. Poskusite pozneje.' },
        { status: 429, headers: { ...headers, 'Retry-After': String(rate.retryAfterSeconds) } }
      );
    }
    const idempotencyKey = readQuoteResponseIdempotencyKey(request, parsed.body);
    const keyHash = quoteResponseSha256(idempotencyKey);
    const requestHash = quoteResponseSha256(
      JSON.stringify({
        intent: 'quote_response',
        action: 'decline',
        quoteOfferVersionId: access.quoteOfferVersionId,
        offerNumber: parsed.body.offerNumber ?? null,
        versionNumber: parsed.body.versionNumber ?? null,
        reason
      })
    );
    const reservation = await reserveQuoteResponseIdempotency(client, {
      keyHash,
      requestHash,
      quoteOfferVersionId: access.quoteOfferVersionId,
      action: 'decline'
    });
    if (reservation.kind === 'replay') {
      await client.query('commit');
      return NextResponse.json(reservation.response, {
        status: reservation.response.httpStatus,
        headers
      });
    }
    const offerResult = await client.query(
      `
        select *
        from quote_offer_versions
        where id = $1 and quote_request_id = $2
        for update
      `,
      [access.quoteOfferVersionId, access.quoteRequestId]
    );
    const offer = offerResult.rows[0];
    if (
      !offer ||
      offer.status !== 'issued' ||
      offer.is_current !== true ||
      new Date(String(offer.valid_until)).getTime() <= Date.now()
    ) {
      throw new QuoteResponseIdempotencyError(
        'OFFER_NOT_RESPONDABLE',
        'Ponudba ni več veljavna.'
      );
    }
    if (
      parsed.body.offerNumber !== offer.offer_number ||
      Number(parsed.body.versionNumber) !== Number(offer.version_number)
    ) {
      throw new QuoteResponseIdempotencyError(
        'OFFER_VERSION_MISMATCH',
        'Odgovor se ne nanaša na prikazano različico ponudbe.'
      );
    }
    const verificationResult = await client.query(
      `
        select id
        from quote_email_verifications
        where quote_request_id = $1
          and quote_offer_version_id = $2
          and access_session_hash = $3
          and purpose = 'offer_response'
          and status = 'verified'
          and consumed_at is null
          and expires_at > now()
        order by verified_at desc, created_at desc
        limit 1
        for update
      `,
      [
        access.quoteRequestId,
        access.quoteOfferVersionId,
        access.accessSessionHash
      ]
    );
    const verificationId = verificationResult.rows[0]?.id
      ? String(verificationResult.rows[0].id)
      : null;
    if (!verificationId) {
      throw new QuoteResponseIdempotencyError(
        'OTP_REQUIRED',
        'Pred zavrnitvijo potrdite email z varnostno kodo.'
      );
    }
    const consumed = await consumeVerifiedQuoteOtp(client, {
      verificationId,
      quoteRequestId: access.quoteRequestId,
      quoteOfferVersionId: access.quoteOfferVersionId,
      accessSessionHash: access.accessSessionHash
    });
    if (!consumed) {
      throw new QuoteResponseIdempotencyError(
        'OTP_REQUIRED',
        'Varnostna potrditev je potekla.'
      );
    }
    const declinedAt = new Date().toISOString();
    await client.query(
      `
        update quote_offer_versions
        set status = 'declined',
            is_current = false,
            declined_at = $2,
            decline_reason = $3,
            state_version = state_version + 1,
            updated_at = now()
        where id = $1
      `,
      [access.quoteOfferVersionId, declinedAt, reason]
    );
    await client.query(
      `
        update quote_requests
        set status = 'declined',
            state_version = state_version + 1,
            updated_at = now()
        where id = $1
      `,
      [access.quoteRequestId]
    );
    await client.query(
      `
        insert into quote_events (
          quote_request_id, quote_offer_version_id, event_key, event_type,
          actor_type, actor_id, occurred_at, request_id, correlation_id,
          reason, metadata_json
        )
        values (
          $1, $2, $3, 'customer_declined', 'customer', $4, $5, $6,
          coalesce($7, $6, gen_random_uuid()::text), $8, $9::jsonb
        )
      `,
      [
        access.quoteRequestId,
        access.quoteOfferVersionId,
        `customer-declined:${access.quoteOfferVersionId}`,
        verificationId,
        declinedAt,
        request.headers.get('x-request-id'),
        request.headers.get('x-correlation-id'),
        reason,
        JSON.stringify({
          verificationId,
          verifiedIdentity: `email-sha256:${consumed.targetEmailHash}`
        })
      ]
    );
    await client.query('savepoint quote_decline_email');
    try {
      const jobs = await enqueueQuoteEmailEvent(client, {
        quoteRequestId: access.quoteRequestId,
        quoteOfferVersionId: access.quoteOfferVersionId,
        eventKey: `quote-declined:${access.quoteOfferVersionId}`,
        eventType: 'quote_declined',
        detail: reason ? `Razlog: ${reason}` : null
      });
      if (jobs.length > 0) {
        await client.query(
          `
            insert into quote_events (
              quote_request_id, quote_offer_version_id, event_key,
              event_type, actor_type, occurred_at, metadata_json
            )
            values ($1, $2, $3, 'quote_email_queued', 'system', now(), $4::jsonb)
            on conflict (event_key) where event_key is not null do nothing
          `,
          [
            access.quoteRequestId,
            access.quoteOfferVersionId,
            `quote-email-queued:declined:${access.quoteOfferVersionId}`,
            JSON.stringify({ eventType: 'quote_declined', jobCount: jobs.length })
          ]
        );
      }
      await client.query('release savepoint quote_decline_email');
    } catch (emailError) {
      await client.query('rollback to savepoint quote_decline_email');
      await client.query('release savepoint quote_decline_email');
      await client.query(
        `
          insert into quote_events (
            quote_request_id, quote_offer_version_id, event_key,
            event_type, actor_type, occurred_at, metadata_json
          )
          values ($1, $2, $3, 'quote_email_provider_failed', 'system', now(), $4::jsonb)
          on conflict (event_key) where event_key is not null do nothing
        `,
        [
          access.quoteRequestId,
          access.quoteOfferVersionId,
          `quote-email-enqueue-failed:declined:${access.quoteOfferVersionId}`,
          JSON.stringify({ stage: 'enqueue', eventType: 'quote_declined' })
        ]
      );
      console.error('[quote.decline] email enqueue failed', {
        quoteRequestId: access.quoteRequestId,
        offerVersionId: access.quoteOfferVersionId,
        message:
          emailError instanceof Error ? emailError.message : 'Unknown error'
      });
    }
    const stored: StoredQuoteResponse = {
      httpStatus: 200,
      status: 'declined'
    };
    await completeQuoteResponseIdempotency(client, {
      keyHash,
      response: stored
    });
    await client.query('commit');
    scheduleQuoteEmailJobs(pool);
    return NextResponse.json(stored, { headers });
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    if (error instanceof QuoteResponseIdempotencyError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: 409, headers }
      );
    }
    return NextResponse.json(
      { code: 'QUOTE_DECLINE_FAILED', message: 'Odgovora trenutno ni mogoče shraniti.' },
      { status: 500, headers }
    );
  } finally {
    client.release();
  }
}
