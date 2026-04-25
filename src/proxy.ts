import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_SESSION_COOKIE = 'atehna_admin_session';

function expectedToken(username: string, password: string) {
  return btoa(`${username}:${password}`);
}

function hasValidSession(request: NextRequest, username: string, password: string) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return false;
  return token === expectedToken(username, password);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const password = process.env.ADMIN_PASSWORD ?? 'admin';

  const isLoginPage = pathname === '/admin';
  const authenticated = hasValidSession(request, username, password);

  if (authenticated && isLoginPage) {
    return NextResponse.redirect(new URL('/admin/orders', request.url));
  }

  // Temporary admin-auth bypass:
  // allow all matched /admin/* and /api/admin/* requests through without
  // requiring the atehna_admin_session cookie.
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*']
};
