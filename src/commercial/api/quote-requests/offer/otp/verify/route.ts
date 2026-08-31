import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { verifyQuoteAccessSession } from '@/shared/server/quoteAccess';
import { verifyQuoteResponseOtp } from '@/shared/server/quoteOtp';
import {
  consumeQuoteRateLimit,
  quoteRateSubjectHash,
  requestNetworkSubject
} from '@/shared/server/quoteRateLimit';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { requestOriginMatchesHost } from '@/shared/server/requestSecurity';
import { isQuoteOnlineAcceptanceEnabled } from '@/shared/server/quoteFeatureFlags';

export const runtime = 'nodejs';
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
    return NextResponse.json({ message: 'Zahteve ni mogoče potrditi.' }, { status: 403, headers });
  }
  const parsed = await readRequiredJsonRecord(request);
  if (!parsed.ok) return parsed.response;
  let verificationId =
    typeof parsed.body.verificationId === 'string'
      ? parsed.body.verificationId.trim().toLowerCase()
      : '';
  const code =
    typeof parsed.body.code === 'string' ? parsed.body.code.trim() : '';
  if (
    (verificationId && !/^[0-9a-f-]{36}$/u.test(verificationId)) ||
    !/^\d{6}$/u.test(code)
  ) {
    return NextResponse.json(
      { code: 'OTP_INVALID', message: 'Varnostna koda ni veljavna.' },
      { status: 400, headers }
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
      return NextResponse.json({ message: 'Ponudba ni dostopna.' }, { status: 404, headers });
    }
    if (!verificationId) {
      const latest = await client.query(
        `
          select id
          from quote_email_verifications
          where quote_request_id = $1
            and quote_offer_version_id = $2
            and access_session_hash = $3
            and purpose = 'offer_response'
            and status in ('pending', 'verified')
            and consumed_at is null
            and expires_at > now()
          order by created_at desc
          limit 1
          for update
        `,
        [
          access.quoteRequestId,
          access.quoteOfferVersionId,
          access.accessSessionHash
        ]
      );
      verificationId = latest.rows[0]?.id ? String(latest.rows[0].id) : '';
      if (!verificationId) {
        await client.query('rollback');
        return NextResponse.json(
          { code: 'OTP_INVALID', message: 'Najprej zahtevajte novo varnostno kodo.' },
          { status: 400, headers }
        );
      }
    }
    const rate = await consumeQuoteRateLimit(client, {
      scope: 'otp_verify',
      subjectHash: quoteRateSubjectHash(
        requestNetworkSubject(request),
        access.tokenId,
        verificationId
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
    const result = await verifyQuoteResponseOtp(client, {
      verificationId,
      quoteRequestId: access.quoteRequestId,
      quoteOfferVersionId: access.quoteOfferVersionId,
      accessSessionHash: access.accessSessionHash,
      code
    });
    await client.query('commit');
    if (!result.ok) {
      return NextResponse.json(
        {
          code: `OTP_${result.code}`,
          message:
            result.code === 'EXPIRED'
              ? 'Koda je potekla.'
              : result.code === 'LOCKED'
                ? 'Preveč napačnih poskusov. Zahtevajte novo kodo.'
                : 'Koda ni pravilna.',
          attemptsRemaining: result.attemptsRemaining
        },
        { status: 400, headers }
      );
    }
    return NextResponse.json(
      { verified: true, verifiedAt: result.verifiedAt },
      { headers }
    );
  } catch {
    await client.query('rollback').catch(() => undefined);
    return NextResponse.json(
      { code: 'OTP_VERIFY_FAILED', message: 'Kode trenutno ni mogoče preveriti.' },
      { status: 500, headers }
    );
  } finally {
    client.release();
  }
}
