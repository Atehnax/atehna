import { NextResponse } from 'next/server';

export function rejectAdminCrossOrigin(request: Request, options: { requireOrigin?: boolean } = {}): Response | null {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase())) return null;
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  // Derive the accepted origin from the server's request URL, never an arbitrary forwarded header.
  if (site === 'cross-site' || (options.requireOrigin && !origin) || (origin && origin !== new URL(request.url).origin)) {
    return NextResponse.json({ error: 'Zahteva ni dovoljena. Osvežite stran in poskusite znova.' }, { status: 403 });
  }
  return null;
}
