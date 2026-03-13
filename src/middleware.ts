import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// TEMPORARY: Admin auth is bypassed while building admin pages in staging/dev.
// Re-enable the previous gate logic here when ADMIN_USERNAME/ADMIN_PASSWORD login is restored.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*']
};
