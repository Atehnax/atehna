import { NextResponse } from 'next/server';

const ADMIN_SESSION_COOKIE = 'atehna_admin_session';

export async function POST(request: Request) {
  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const password = process.env.ADMIN_PASSWORD ?? 'admin';

  const body = (await request.json().catch(() => ({}))) as { username?: string; password?: string };
  if (body.username !== username || body.password !== password) {
    return NextResponse.json({ message: 'Napačno uporabniško ime ali geslo.' }, { status: 401 });
  }

  const token = Buffer.from(`${username}:${password}`).toString('base64');
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  });
  return response;
}
