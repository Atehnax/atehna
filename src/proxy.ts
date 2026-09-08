import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_SESSION_COOKIE } from '@/shared/auth/adminCookie';
import { isAuthorizedAdminCron } from '@/shared/auth/adminCron';

const sensitiveOrderPages = new Set([
  '/order/confirmation',
  '/order/narocilnica',
  '/quote-request/confirmation',
  '/quote/offer',
  '/offer/review'
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

  // This is only an optimistic redirect. Each page and API handler performs
  // database-backed verification before loading private data or mutating it.
  const isLoginPage = pathname === '/admin';
  const isAdminApi = pathname === '/api/admin' || pathname.startsWith('/api/admin/');
  const isPublicAdminApi = pathname === '/api/admin/login' || pathname === '/api/admin/logout';
  const hasSessionCookie = Boolean(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);

  if (isLoginPage || isPublicAdminApi || hasSessionCookie || isAuthorizedAdminCron(request)) {
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
    '/order/narocilnica',
    '/quote-request/confirmation',
    '/quote/offer',
    '/offer/review'
  ]
};
