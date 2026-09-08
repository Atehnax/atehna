import 'server-only';

import { hashPassword, verifyPassword } from 'better-auth/crypto';
import type { PoolClient } from 'pg';
import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { getAdminSession, findLiveAdminSession, type AdminSession } from '@/shared/auth/adminSession';
import { getAuditRequestContext, insertAuditEvent } from '@/shared/server/audit';
import { loginAttemptKeys, reserveLoginAttempt, releaseSuccessfulLoginAttempt, rateLimitResponse } from '@/shared/auth/adminLoginRateLimit';

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
export const expiredAdminResponse = () => error('Seja je potekla. Ponovno se prijavite.', 401);

async function withCurrentPassword(
  request: Request, currentPassword: unknown,
  mutate: (client: PoolClient, session: AdminSession) => Promise<Response>
): Promise<Response> {
  const session = await getAdminSession(request);
  if (!session) return expiredAdminResponse();
  if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 128) {
    return error('Vnesite trenutno geslo.');
  }
  const keys = loginAttemptKeys(request, `reauth:${session.username}`);
  if (!await reserveLoginAttempt(keys)) return rateLimitResponse();
  const pool = await getPool();
  const { rows } = await pool.query(
    'select password from admin_auth_account where "userId" = $1 and "providerId" = $2',
    [session.userId, 'credential']);
  if (!rows[0]?.password || !await verifyPassword({ hash: rows[0].password, password: currentPassword })) {
    return error('Trenutno geslo ni pravilno.');
  }
  const client = await pool.connect();
  try {
    await client.query('begin');
    // Serialize policy changes, credentials and session revocation in one transaction.
    await client.query('select id from admin_session_policy where id = 1 for update');
    await client.query('select id from admin_auth_user where id = $1 for update', [session.userId]);
    await client.query('select id from admin_auth_session where id = $1 for update', [session.id]);
    const fresh = await findLiveAdminSession(session.id, client);
    if (!fresh || fresh.credentialVersion !== session.credentialVersion) {
      await client.query('rollback');
      return expiredAdminResponse();
    }
    const response = await mutate(client, fresh);
    await releaseSuccessfulLoginAttempt(keys, client);
    await client.query('commit');
    return response;
  } catch (cause) {
    await client.query('rollback');
    throw cause;
  } finally { client.release(); }
}

async function auditAuthChange(
  request: Request, client: PoolClient, session: AdminSession,
  summary: string, diff: Parameters<typeof insertAuditEvent>[0]['diff']
) {
  await insertAuditEvent({
    ...getAuditRequestContext(request),
    actor: { actor_id: `admin:${session.userId}`, actor_name: session.username, actor_email: null },
    entityType: 'system', entityId: 'admin-auth', entityLabel: 'Skrbniki',
    action: 'updated', summary, diff
  }, client, { force: true });
}

export async function changeAdminPassword(request: Request, body: Record<string, unknown>): Promise<Response> {
  const { newPassword, confirmPassword } = body;
  if (typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 128) {
    return error('Novo geslo mora vsebovati od 12 do 128 znakov.');
  }
  if (newPassword !== confirmPassword) return error('Novi gesli se ne ujemata.');
  return withCurrentPassword(request, body.currentPassword, async (client, session) => {
    const passwordHash = await hashPassword(newPassword);
    // The KDF can take time: recheck expiry immediately before the credential mutation.
    if (!await findLiveAdminSession(session.id, client)) return expiredAdminResponse();
    await client.query('update admin_auth_account set password = $1, "updatedAt" = clock_timestamp() where "userId" = $2 and "providerId" = $3',
      [passwordHash, session.userId, 'credential']);
    await client.query('update admin_auth_user set "credentialVersion" = "credentialVersion" + 1, "updatedAt" = clock_timestamp() where id = $1',
      [session.userId]);
    await client.query('delete from admin_auth_session');
    await auditAuthChange(request, client, session, 'Spremenjeno geslo skrbnika', {
      password: { label: 'Geslo', changed: true, redacted: true, message: 'Geslo je bilo spremenjeno.' }
    });
    return NextResponse.json({ message: 'Geslo je spremenjeno. Ponovno se prijavite z novim geslom.' });
  });
}

export async function changeAdminSessionPolicy(request: Request, body: Record<string, unknown>): Promise<Response> {
  const { maxLifetimeDays, idleTimeoutMinutes } = body;
  if (typeof maxLifetimeDays !== 'number' || !Number.isInteger(maxLifetimeDays) || maxLifetimeDays < 1 || maxLifetimeDays > 90) {
    return error('Najdaljše trajanje seje mora biti celo število od 1 do 90 dni.');
  }
  if (typeof idleTimeoutMinutes !== 'number' || !Number.isInteger(idleTimeoutMinutes) || idleTimeoutMinutes < 1 || idleTimeoutMinutes > 1440) {
    return error('Odjava zaradi neaktivnosti mora biti celo število od 1 do 1440 minut.');
  }
  return withCurrentPassword(request, body.currentPassword, async (client, session) => {
    const { rows } = await client.query('select max_lifetime_days, idle_timeout_minutes from admin_session_policy where id = 1');
    const previous = rows[0];
    // Retire ALL already expired sessions using the OLD policy before any increase.
    // This also catches sessions never requested since expiry, so they cannot revive.
    await client.query(`delete from admin_auth_session s using admin_session_policy p
      where p.id = 1 and least(s."expiresAt", s."createdAt" + p.max_lifetime_days * interval '1 day',
        s."lastActivityAt" + p.idle_timeout_minutes * interval '1 minute') <= clock_timestamp()`);
    if (!await findLiveAdminSession(session.id, client)) return expiredAdminResponse();
    await client.query('update admin_session_policy set max_lifetime_days = $1, idle_timeout_minutes = $2, updated_at = clock_timestamp() where id = 1',
      [maxLifetimeDays, idleTimeoutMinutes]);
    // Absolute lifetime remains anchored to login, including when limits are changed.
    await client.query(`update admin_auth_session set "expiresAt" = case
      when least("expiresAt", "createdAt" + $2 * interval '1 day',
        "lastActivityAt" + $3 * interval '1 minute') > statement_timestamp()
      then "createdAt" + $1 * interval '1 day'
      else least("expiresAt", "createdAt" + $2 * interval '1 day',
        "lastActivityAt" + $3 * interval '1 minute') end`,
      [maxLifetimeDays, previous.max_lifetime_days, previous.idle_timeout_minutes]);
    await client.query(`delete from admin_auth_session where least("expiresAt",
      "lastActivityAt" + $1 * interval '1 minute') <= clock_timestamp()`, [idleTimeoutMinutes]);
    await auditAuthChange(request, client, session, 'Spremenjene nastavitve sej skrbnika', {
      maxLifetimeDays: { label: 'Najdaljše trajanje seje (dni)', before: String(previous.max_lifetime_days), after: String(maxLifetimeDays) },
      idleTimeoutMinutes: { label: 'Odjava zaradi neaktivnosti (minute)', before: String(previous.idle_timeout_minutes), after: String(idleTimeoutMinutes) }
    });
    const stillValid = await findLiveAdminSession(session.id, client);
    return NextResponse.json({ message: 'Nastavitve sej so shranjene.', requiresLogin: !stillValid });
  });
}

export async function recordAdminActivity(request: Request): Promise<Response> {
  const session = await getAdminSession(request);
  if (!session) return expiredAdminResponse();
  const client = await (await getPool()).connect();
  try {
    await client.query('begin');
    // Wait for any policy change before the activity statement takes its snapshot.
    // Keep this lock through verification so a shortened idle limit cannot be
    // bypassed by an UPDATE that waited with the previous policy's snapshot.
    await client.query('select id from admin_session_policy where id = 1 for share');
    // A single conditional write at most once per 30 seconds; ordinary requests never write.
    await client.query(`
      update admin_auth_session s set "lastActivityAt" = clock_timestamp()
      from admin_session_policy p, admin_auth_user u
      where s.id = $1 and p.id = 1 and u.id = s."userId" and u."credentialVersion" = s."credentialVersion"
        and s."lastActivityAt" <= clock_timestamp() - interval '30 seconds'
        and least(s."expiresAt", s."createdAt" + p.max_lifetime_days * interval '1 day',
          s."lastActivityAt" + p.idle_timeout_minutes * interval '1 minute') > clock_timestamp()
    `, [session.id]);
    const fresh = await findLiveAdminSession(session.id, client);
    await client.query('commit');
    return fresh ? NextResponse.json({ expiresAt: fresh.expiresAt.toISOString() }) : expiredAdminResponse();
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { client.release(); }
}
