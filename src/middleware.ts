import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const isAuthorized = (request: NextRequest) => {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    return false;
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  const base64 = authHeader.replace('Basic ', '');
  const decoded = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('utf8');
  const [user, pass] = decoded.split(':');

  return user === username && pass === password;
};

export function middleware(request: NextRequest) {
  if (isAuthorized(request)) {
    return NextResponse.next();
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Admin"'
    }
  });
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*']
};
