import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { verifyQuoteAccessSession } from '@/shared/server/quoteAccess';
import {
  enqueueQuoteEmailEvent,
  scheduleQuoteEmailJobs
} from '@/shared/server/quoteEmailJobs';
import {
  isQuoteEmailDeliveryEnabled,
  isQuoteOnlineAcceptanceEnabled
} from '@/shared/server/quoteFeatureFlags';
import { issueQuoteResponseOtp } from '@/shared/server/quoteOtp';
import {
  consumeQuoteRateLimit,
  quoteRateSubjectHash,
  requestNetworkSubject
} from '@/shared/server/quoteRateLimit';
import { requestOriginMatchesHost } from '@/shared/server/requestSecurity';

export const runtime = 'nodejs';

const headers = {
  'Cache-Control': 'no-store, private',
  'Referrer-Policy': 'no-referrer'
};

export async function POST(request: NextRequest) {
  if (
    !isQuoteOnlineAcceptanceEnabled() ||
    !isQuoteEmailDeliveryEnabled()
  ) {
    return NextResponse.json(
      {
        code: 'QUOTE_RESPONSE_DISABLED',
        message: 'Spletni sprejem trenutno ni na voljo.'
      },
      { status: 503, headers }
    );
  }
  if (!requestOriginMatchesHost(request)) {
    return NextResponse.json(
      { code: 'INVALID_ORIGIN', message: 'Zahteve ni mogoče potrditi.' },
      { status: 403, headers }
    );
  }
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
      return NextResponse.json(
        { code: 'QUOTE_ACCESS_DENIED', message: 'Ponudba ni dostopna.' },
        { status: 404, headers }
      );
    }
    const rate = await consumeQuoteRateLimit(client, {
      scope: 'otp_issue',
      subjectHash: quoteRateSubjectHash(
        requestNetworkSubject(request),
        access.tokenId,
        access.quoteOfferVersionId
      ),
      maximumAttempts: 3,
      windowSeconds: 15 * 60,
      blockSeconds: 60 * 60
    });
    if (!rate.allowed) {
      await client.query('rollback');
      return NextResponse.json(
        { code: 'RATE_LIMITED', message: 'Novo kodo lahko zahtevate pozneje.' },
        {
          status: 429,
          headers: { ...headers, 'Retry-After': String(rate.retryAfterSeconds) }
        }
      );
    }
    const offerResult = await client.query(
      `
        select
          offer.status,
          offer.is_current,
          offer.valid_until,
          request.email
        from quote_offer_versions offer
        join quote_requests request on request.id = offer.quote_request_id
        where offer.id = $1 and offer.quote_request_id = $2
        for update of offer
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
      await client.query('rollback');
      return NextResponse.json(
        { code: 'OFFER_NOT_RESPONDABLE', message: 'Ponudba ni več veljavna.' },
        { status: 409, headers }
      );
    }
    const otp = await issueQuoteResponseOtp(client, {
      quoteRequestId: access.quoteRequestId,
      quoteOfferVersionId: access.quoteOfferVersionId,
      email: String(offer.email),
      accessSessionHash: access.accessSessionHash,
      requestId: request.headers.get('x-request-id'),
      correlationId: request.headers.get('x-correlation-id'),
      ipHash: requestNetworkSubject(request)
    });
    const jobs = await enqueueQuoteEmailEvent(client, {
      quoteRequestId: access.quoteRequestId,
      quoteOfferVersionId: access.quoteOfferVersionId,
      eventKey: `quote-access-otp:${otp.verificationId}`,
      eventType: 'quote_access_otp',
      otpCode: otp.code
    });
    if (jobs.length === 0) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_VERIFICATION_UNAVAILABLE',
          message: 'Varnostne kode trenutno ni mogoče poslati.'
        },
        { status: 503, headers }
      );
    }
    await client.query('commit');
    if (jobs.length > 0) scheduleQuoteEmailJobs(pool);
    return NextResponse.json(
      {
        verificationId: otp.verificationId,
        expiresAt: otp.expiresAt
      },
      { headers }
    );
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    return NextResponse.json(
      { code: 'OTP_REQUEST_FAILED', message: 'Kode trenutno ni mogoče poslati.' },
      { status: 500, headers }
    );
  } finally {
    client.release();
  }
}
