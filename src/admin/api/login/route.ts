import { NextResponse } from 'next/server';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  getAdminAuthConfig,
  verifyAdminCredentials
} from '@/shared/auth/adminSession';

export async function POST(request: Request) {
  const parsedBody = await readRequiredJsonRecord(request);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;
  const authConfig = getAdminAuthConfig();
  if (!authConfig) {
    return NextResponse.json(
      { message: 'Administratorska prijava ni konfigurirana.' },
      { status: 503 }
    );
  }
  if (!verifyAdminCredentials(body.username, body.password, authConfig)) {
    return NextResponse.json({ message: 'Napačno uporabniško ime ali geslo.' }, { status: 401 });
  }

  const session = createAdminSessionToken(authConfig);
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: session.token,
    maxAge: session.maxAge,
    expires: session.expiresAt,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  });
  return response;
}
