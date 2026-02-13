import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getPool } from '@/lib/server/db';

type Body = {
  eventType?: 'page_view' | 'product_view';
  path?: string;
  productId?: string | null;
};

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const eventType = body.eventType;
    const path = body.path?.trim();

    if (!eventType || !path) {
      return NextResponse.json({ message: 'Manjkajo podatki dogodka.' }, { status: 400 });
    }

    const cookieStore = cookies();
    let visitorId = cookieStore.get('ath_vid')?.value;
    let sessionId = cookieStore.get('ath_sid')?.value;

    if (!visitorId) visitorId = randomUUID();
    if (!sessionId) sessionId = randomUUID();

    const headerStore = headers();
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
        body.productId || null,
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
