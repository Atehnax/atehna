import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/shared/auth/adminAuth';
import { ADMIN_SESSION_COOKIE } from '@/shared/auth/adminSession';
import { rejectAdminCrossOrigin } from '@/shared/auth/adminCsrf';

export async function POST(request: Request) {
  const forged = rejectAdminCrossOrigin(request, { requireOrigin: true });
  if (forged) return forged;
  try {
    // Better Auth deletes the database session identified by the signed cookie.
    const result = await (await getAdminAuth()).api.signOut({ headers: request.headers, asResponse: true });
    if (!result.ok) return NextResponse.json({ error: 'Odjava ni uspela. Poskusite znova.' }, { status: 503 });
    const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    for (const cookie of result.headers.getSetCookie()) response.headers.append('Set-Cookie', cookie);
    response.cookies.set(ADMIN_SESSION_COOKIE, '', {
      maxAge: 0, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/'
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Odjava ni uspela. Poskusite znova.' }, { status: 503 });
  }
}
