import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  getAdminAuthConfig,
  verifyAdminSessionToken
} from '@/shared/auth/adminSession';
import { normalizeAdminReturnPath } from '@/shared/auth/adminReturnPath';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authConfig = getAdminAuthConfig();
  const isLoginPage = pathname === '/admin';
  const isAdminApi = pathname === '/api/admin' || pathname.startsWith('/api/admin/');
  const isPublicAdminApi = pathname === '/api/admin/login' || pathname === '/api/admin/logout';
  const cronSecret = process.env.CRON_SECRET;
  const isConfiguredCronPath =
    pathname === '/api/admin/archive/cleanup' ||
    pathname === '/api/admin/audit-events/prune';
  const isAuthorizedCron =
    isConfiguredCronPath &&
    request.method === 'GET' &&
    Boolean(cronSecret) &&
    request.headers.get('authorization') === `Bearer ${cronSecret}`;
  const authenticated = verifyAdminSessionToken(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    authConfig
  );

  if (authenticated && isLoginPage) {
    return NextResponse.redirect(
      new URL(
        normalizeAdminReturnPath(request.nextUrl.searchParams.get('next')),
        request.url
      )
    );
  }

  if (
    isLoginPage ||
    isPublicAdminApi ||
    authenticated ||
    isAuthorizedCron
  ) {
    return NextResponse.next();
  }

  if (isAdminApi) {
    return NextResponse.json(
      { message: 'Za dostop je potrebna prijava.' },
      { status: 401 }
    );
  }

  const loginUrl = new URL('/admin', request.url);
  loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*']
};
