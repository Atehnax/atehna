import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import {
  exchangeQuoteAccessToken,
  isQuoteAccessToken,
  setQuoteAccessSessionCookie,
  type QuoteAccessScope
} from '@/shared/server/quoteAccess';
import {
  consumeQuoteRateLimit,
  requestNetworkSubject
} from '@/shared/server/quoteRateLimit';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { requestOriginMatchesHost } from '@/shared/server/requestSecurity';

export const runtime = 'nodejs';

const privateHeaders = {
  'Cache-Control': 'no-store, private',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive'
};

export async function POST(request: NextRequest) {
  if (!requestOriginMatchesHost(request)) {
    return NextResponse.json(
      { code: 'INVALID_ORIGIN', message: 'Povezave ni mogoče potrditi.' },
      { status: 403, headers: privateHeaders }
    );
  }
  const parsed = await readRequiredJsonRecord(request);
  if (!parsed.ok) return parsed.response;
  const token =
    typeof parsed.body.token === 'string' ? parsed.body.token.trim() : '';
  if (!isQuoteAccessToken(token)) {
    return NextResponse.json(
      { code: 'QUOTE_ACCESS_DENIED', message: 'Povezava je potekla ali ni veljavna.' },
      { status: 401, headers: privateHeaders }
    );
  }
  const requestedPurpose =
    parsed.body.purpose === 'offer' ? 'offer' : 'confirmation';
  const scopes: QuoteAccessScope[] =
    requestedPurpose === 'offer'
      ? ['offer_review']
      : ['request_confirmation'];

  try {
    const pool = await getPool();
    const rate = await consumeQuoteRateLimit(pool, {
      scope: 'access_exchange',
      subjectHash: requestNetworkSubject(request),
      maximumAttempts: 20,
      windowSeconds: 15 * 60,
      blockSeconds: 30 * 60
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { code: 'RATE_LIMITED', message: 'Poskusite znova pozneje.' },
        {
          status: 429,
          headers: { ...privateHeaders, 'Retry-After': String(rate.retryAfterSeconds) }
        }
      );
    }

    const access = await exchangeQuoteAccessToken(pool, token, scopes[0]);
    if (!access) {
      return NextResponse.json(
        { code: 'QUOTE_ACCESS_DENIED', message: 'Povezava je potekla ali ni veljavna.' },
        { status: 401, headers: privateHeaders }
      );
    }
    const response = NextResponse.json(
      {
        accessId: access.tokenId,
        expiresAt: access.expiresAt,
        csrfToken: access.csrfToken,
        purpose: requestedPurpose
      },
      { headers: privateHeaders }
    );
    setQuoteAccessSessionCookie(response, {
      tokenId: access.tokenId,
      token,
      expiresAt: access.expiresAt
    });
    return response;
  } catch (error) {
    console.error('[quote.access-session] failed', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { code: 'QUOTE_ACCESS_SESSION_FAILED', message: 'Dostopa trenutno ni mogoče potrditi.' },
      { status: 500, headers: privateHeaders }
    );
  }
}
