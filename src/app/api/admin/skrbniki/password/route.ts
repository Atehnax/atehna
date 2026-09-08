import { withAdminRoute } from '@/shared/auth/adminRoute';
import { rejectAdminCrossOrigin } from '@/shared/auth/adminCsrf';
import { changeAdminPassword } from '@/shared/auth/adminSettings';
import { ADMIN_SESSION_COOKIE } from '@/shared/auth/adminSession';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { NextResponse } from 'next/server';

export const POST = withAdminRoute(async (request: Request) => {
  const forged = rejectAdminCrossOrigin(request, { requireOrigin: true });
  if (forged) return forged;
  const parsed = await readRequiredJsonRecord(request);
  if (!parsed.ok) return parsed.response;
  try {
    const result = await changeAdminPassword(request, parsed.body);
    if (result.ok) {
      const response = new NextResponse(result.body, { status: result.status, headers: result.headers });
      response.cookies.set(ADMIN_SESSION_COOKIE, '', {
        maxAge: 0, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/'
      });
      return response;
    }
    return result;
  } catch {
    return NextResponse.json({ error: 'Gesla ni bilo mogoče spremeniti. Poskusite znova.' }, { status: 503 });
  }
});
