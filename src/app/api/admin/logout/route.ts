import { NextResponse } from 'next/server';

const ADMIN_SESSION_COOKIE = 'atehna_admin_session';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: '',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  });
  return response;
}
