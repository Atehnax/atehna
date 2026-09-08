import { NextResponse } from 'next/server';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { getPool } from '@/shared/server/db';
import { getAdminAuth, adminLoginContext } from '@/shared/auth/adminAuth';
import { findLiveAdminSession } from '@/shared/auth/adminSession';
import { rejectAdminCrossOrigin } from '@/shared/auth/adminCsrf';
import { loginAttemptKeys, reserveLoginAttempt, releaseSuccessfulLoginAttempt, rateLimitResponse } from '@/shared/auth/adminLoginRateLimit';

const INVALID_LOGIN = 'Napačno uporabniško ime ali geslo.';

export async function POST(request: Request) {
  const forged = rejectAdminCrossOrigin(request, { requireOrigin: true });
  if (forged) return forged;
  const parsed = await readRequiredJsonRecord(request);
  if (!parsed.ok) return parsed.response;
  const { username, password } = parsed.body;
  if (typeof username !== 'string' || !username.trim() || username.length > 128 ||
    typeof password !== 'string' || !password || password.length > 128) {
    return NextResponse.json({ error: INVALID_LOGIN, message: INVALID_LOGIN }, { status: 401 });
  }
  try {
    const keys = loginAttemptKeys(request, username.trim());
    if (!await reserveLoginAttempt(keys)) return rateLimitResponse();
    const pool = await getPool();
    // Captured before password verification. A concurrent password change increments this
    // generation, invalidating even a login whose session is inserted after revocation.
    const { rows } = await pool.query('select "credentialVersion" from admin_auth_user where username = $1', [username.trim()]);
    const auth = await getAdminAuth();
    const result = await adminLoginContext.run({ credentialVersion: Number(rows[0]?.credentialVersion ?? 0) }, () =>
      auth.api.signInUsername({
        body: { username: username.trim(), password, rememberMe: true },
        headers: request.headers, asResponse: true
      }));
    if (!result.ok) {
      return NextResponse.json({ error: INVALID_LOGIN, message: INVALID_LOGIN }, { status: result.status >= 500 ? 503 : 401 });
    }
    const body = await result.json() as { token: string };
    const inserted = await pool.query('select id from admin_auth_session where token = $1', [body.token]);
    const session = inserted.rows[0] && await findLiveAdminSession(inserted.rows[0].id);
    if (!session) {
      await pool.query('delete from admin_auth_session where token = $1', [body.token]);
      return NextResponse.json({ error: INVALID_LOGIN, message: INVALID_LOGIN }, { status: 401 });
    }
    await releaseSuccessfulLoginAttempt(keys);
    const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    for (const cookie of result.headers.getSetCookie()) response.headers.append('Set-Cookie', cookie);
    return response;
  } catch {
    return NextResponse.json({ error: 'Prijava trenutno ni na voljo.', message: 'Prijava trenutno ni na voljo.' }, { status: 503 });
  }
}
