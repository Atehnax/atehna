import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import {
  isOrderAccessToken,
  setOrderAccessSessionCookie,
  verifyOrderAccessToken
} from '@/shared/server/orderAccess';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';

export const runtime = 'nodejs';

const privateHeaders = {
  'Cache-Control': 'no-store, private',
  'Referrer-Policy': 'no-referrer'
};

export async function POST(request: NextRequest) {
  const parsedBody = await readRequiredJsonRecord(request);
  if (!parsedBody.ok) return parsedBody.response;

  const token =
    typeof parsedBody.body.token === 'string'
      ? parsedBody.body.token.trim()
      : '';
  if (!isOrderAccessToken(token)) {
    return NextResponse.json(
      {
        code: 'ORDER_ACCESS_DENIED',
        message: 'Povezava je potekla ali je bila preklicana.'
      },
      { status: 401, headers: privateHeaders }
    );
  }

  try {
    const pool = await getPool();
    const access = await verifyOrderAccessToken(pool, token, 'confirmation');
    if (!access) {
      return NextResponse.json(
        {
          code: 'ORDER_ACCESS_DENIED',
          message: 'Povezava je potekla ali je bila preklicana.'
        },
        { status: 401, headers: privateHeaders }
      );
    }

    const response = NextResponse.json(
      {
        accessId: access.tokenId,
        expiresAt: access.expiresAt
      },
      { headers: privateHeaders }
    );
    setOrderAccessSessionCookie(response, {
      tokenId: access.tokenId,
      token,
      expiresAt: access.expiresAt
    });
    return response;
  } catch (error) {
    console.error('[orders.access-session] failed', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      {
        code: 'ORDER_ACCESS_SESSION_FAILED',
        message: 'Dostopa do naročila trenutno ni mogoče potrditi.'
      },
      { status: 500, headers: privateHeaders }
    );
  }
}
