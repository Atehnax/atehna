import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  getAdminAuthConfig,
  verifyAdminSessionToken
} from '@/shared/auth/adminSession';
import { normalizeAdminReturnPath } from '@/shared/auth/adminReturnPath';

const sensitiveOrderPages = new Set([
  '/order/confirmation',
  '/order/narocilnica'
]);

function applySensitiveOrderPageHeaders(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (sensitiveOrderPages.has(pathname)) {
    if (
      request.nextUrl.searchParams.has('token') ||
      request.nextUrl.searchParams.has('access')
    ) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.searchParams.delete('token');
      redirectUrl.searchParams.delete('access');
      return applySensitiveOrderPageHeaders(
        NextResponse.redirect(redirectUrl)
      );
    }

    return applySensitiveOrderPageHeaders(NextResponse.next());
  }

  const authConfig = getAdminAuthConfig();
  const isLoginPage = pathname === '/admin';
  const isAdminApi = pathname === '/api/admin' || pathname.startsWith('/api/admin/');
  const isPublicAdminApi = pathname === '/api/admin/login' || pathname === '/api/admin/logout';
  const cronSecret = process.env.CRON_SECRET;
  const isConfiguredCronPath =
    pathname === '/api/admin/archive/cleanup' ||
    pathname === '/api/admin/audit-events/prune' ||
    pathname === '/api/admin/order-email-settings/process' ||
    pathname === '/api/admin/addresses/sync';
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
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/order/confirmation',
    '/order/narocilnica'
  ]
};
