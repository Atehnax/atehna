import 'server-only';

import { cache } from 'react';
import { headers } from 'next/headers';
import type { PoolClient } from 'pg';
import { getPool } from '@/shared/server/db';
import { getAdminAuth } from '@/shared/auth/adminAuth';
import { ADMIN_SESSION_COOKIE } from '@/shared/auth/adminCookie';

export { ADMIN_SESSION_COOKIE };
export { getAdminSessionSecret } from '@/shared/auth/adminAuth';

export type AdminSession = {
  id: string;
  userId: string;
  username: string;
  credentialVersion: number;
  createdAt: Date;
  lastActivityAt: Date;
  /** Effective deadline: minimum of the absolute and inactivity limits. */
  expiresAt: Date;
};
export type AdminSessionPolicy = { maxLifetimeDays: number; idleTimeoutMinutes: number };

export async function getAdminSessionPolicy(): Promise<AdminSessionPolicy> {
  const { rows } = await (await getPool()).query('select max_lifetime_days, idle_timeout_minutes from admin_session_policy where id = 1');
  if (!rows[0]) throw new Error('Admin session policy is not initialized.');
  return { maxLifetimeDays: Number(rows[0].max_lifetime_days), idleTimeoutMinutes: Number(rows[0].idle_timeout_minutes) };
}

// Shared by verification and mutations. Reads never update activity or extend a session.
export const LIVE_ADMIN_SESSION_SQL = `
  select s.id, s."userId", u.username, s."credentialVersion", s."createdAt", s."lastActivityAt",
    least(s."expiresAt",
      s."createdAt" + p.max_lifetime_days * interval '1 day',
      s."lastActivityAt" + p.idle_timeout_minutes * interval '1 minute') as deadline
  from admin_auth_session s
  join admin_auth_user u on u.id = s."userId" and u."credentialVersion" = s."credentialVersion"
  cross join admin_session_policy p
  where s.id = $1 and p.id = 1 and
    least(s."expiresAt", s."createdAt" + p.max_lifetime_days * interval '1 day',
      s."lastActivityAt" + p.idle_timeout_minutes * interval '1 minute') > clock_timestamp()
`;

export async function findLiveAdminSession(id: string, db?: PoolClient): Promise<AdminSession | null> {
  const { rows } = await (db ?? await getPool()).query(LIVE_ADMIN_SESSION_SQL, [id]);
  const row = rows[0];
  return row ? {
    id: row.id, userId: row.userId, username: row.username,
    credentialVersion: Number(row.credentialVersion),
    createdAt: new Date(row.createdAt), lastActivityAt: new Date(row.lastActivityAt), expiresAt: new Date(row.deadline)
  } : null;
}

async function verifyHeaders(requestHeaders: Headers): Promise<AdminSession | null> {
  if (!requestHeaders.get('cookie')?.split(';').some((part) => part.trim().startsWith(`${ADMIN_SESSION_COOKIE}=`))) return null;
  const auth = await getAdminAuth();
  const result = await auth.api.getSession({
    headers: requestHeaders, query: { disableCookieCache: true, disableRefresh: true }
  });
  if (!result) return null;
  const session = await findLiveAdminSession(result.session.id);
  if (!session) {
    // Make expiry terminal even if policy is subsequently increased.
    await (await getPool()).query('delete from admin_auth_session where id = $1', [result.session.id]);
  }
  return session;
}

const requestSessions = new WeakMap<Request, Promise<AdminSession | null>>();
export function getAdminSession(request: Request): Promise<AdminSession | null> {
  let result = requestSessions.get(request);
  if (!result) {
    result = verifyHeaders(request.headers);
    requestSessions.set(request, result);
  }
  return result;
}
export async function hasValidAdminSession(request: Request): Promise<boolean> {
  return Boolean(await getAdminSession(request));
}
// React cache is request-scoped; nothing survives between incoming requests.
export const getAdminPageSession = cache(async () => verifyHeaders(new Headers(await headers())));
