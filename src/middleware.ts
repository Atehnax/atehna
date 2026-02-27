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

function unauthorizedApi() {
  return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const password = process.env.ADMIN_PASSWORD ?? 'admin';

  const isAdminPage = pathname.startsWith('/admin');
  const isAdminApi = pathname.startsWith('/api/admin');
  const isLoginPage = pathname === '/admin';
  const isLoginApi = pathname === '/api/admin/login';

  const authenticated = hasValidSession(request, username, password);

  if (authenticated && isLoginPage) {
    return NextResponse.redirect(new URL('/admin/orders', request.url));
  }

  if (isLoginPage || isLoginApi) {
    return NextResponse.next();
  }

  if (isAdminPage && !authenticated) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  if (isAdminApi && !authenticated) {
    return unauthorizedApi();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*']
};
