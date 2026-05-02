import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getPool } from '@/shared/server/db';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';

const analyticsEventTypes = new Set(['page_view', 'product_view']);

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function POST(request: Request) {
  try {
    const parsedBody = await readRequiredJsonRecord(request);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body;
    const eventType = typeof body.eventType === 'string' && analyticsEventTypes.has(body.eventType)
      ? body.eventType
      : null;
    const path = typeof body.path === 'string' ? body.path.trim() : '';
    const productId = typeof body.productId === 'string' && body.productId.trim()
      ? body.productId.trim()
      : null;

    if (!eventType || !path) {
      return NextResponse.json({ message: 'Manjkajo podatki dogodka.' }, { status: 400 });
    }

    const cookieStore = await cookies();
    let visitorId = cookieStore.get('ath_vid')?.value;
    let sessionId = cookieStore.get('ath_sid')?.value;

    if (!visitorId) visitorId = randomUUID();
    if (!sessionId) sessionId = randomUUID();

    const headerStore = await headers();
    const userAgent = headerStore.get('user-agent');
    const referer = headerStore.get('referer');

    const pool = await getPool();
    await pool.query(
      `
      insert into website_events (
        event_type,
        path,
        product_id,
        session_id,
        visitor_id,
        user_agent,
        referrer
      )
      values ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        eventType,
        path,
        productId,
        sessionId,
        visitorId,
        userAgent,
        referer
      ]
    );

    const response = NextResponse.json({ ok: true });
    response.cookies.set('ath_vid', visitorId, {
      maxAge: ONE_YEAR_SECONDS,
      sameSite: 'lax',
      path: '/'
    });
    response.cookies.set('ath_sid', sessionId, {
      maxAge: 60 * 60 * 4,
      sameSite: 'lax',
      path: '/'
    });

    return response;
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
