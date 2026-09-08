import 'server-only';

import type { PoolClient } from 'pg';
import { createHmac } from 'node:crypto';
import { getPool } from '@/shared/server/db';
import { getAdminSessionSecret } from '@/shared/auth/adminSecret';

const WINDOW_SECONDS = 15 * 60;
const LIMIT = 10;

export function loginAttemptKeys(request: Request, username: string): string[] {
  // On Vercel this header is replaced by the trusted edge. On local deployments a shared
  // fallback bucket is safer than trusting client-supplied X-Forwarded-For.
  const ip = process.env.VERCEL
    ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    : 'local';
  return [`ip:${ip}`, `username:${username.toLowerCase()}`].map((value) =>
    createHmac('sha256', getAdminSessionSecret()).update(value).digest('hex')).sort();
}

/** Reserve before checking a password so concurrent Vercel instances cannot exceed the limit. */
export async function reserveLoginAttempt(keys: string[]): Promise<boolean> {
  const client = await (await getPool()).connect();
  try {
    await client.query('begin');
    for (const key of keys) {
      const { rows } = await client.query(`
        insert into admin_login_attempt (key, attempts, window_start) values ($1, 1, clock_timestamp())
        on conflict (key) do update set
          attempts = case when admin_login_attempt.window_start <= clock_timestamp() - $2 * interval '1 second'
            then 1 else admin_login_attempt.attempts + 1 end,
          window_start = case when admin_login_attempt.window_start <= clock_timestamp() - $2 * interval '1 second'
            then clock_timestamp() else admin_login_attempt.window_start end
        where admin_login_attempt.window_start <= clock_timestamp() - $2 * interval '1 second'
          or admin_login_attempt.attempts < $3 returning key
      `, [key, WINDOW_SECONDS, LIMIT]);
      if (!rows.length) {
        await client.query('rollback');
        return false;
      }
    }
    await client.query('commit');
    return true;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { client.release(); }
}

export async function releaseSuccessfulLoginAttempt(keys: string[], client?: PoolClient) {
  // Only release this successful attempt, preserving concurrent failures.
  await (client ?? await getPool()).query(
    'update admin_login_attempt set attempts = greatest(0, attempts - 1) where key = any($1::text[])', [keys]);
}

export function rateLimitResponse() {
  return Response.json({ error: 'Napačno uporabniško ime ali geslo.', message: 'Napačno uporabniško ime ali geslo.' },
    { status: 429, headers: { 'Retry-After': String(WINDOW_SECONDS), 'Cache-Control': 'no-store' } });
}
