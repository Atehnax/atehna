import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';

export class AdminAccountSetupError extends Error {}

export function validateAdminCredentials(username, password) {
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';
  if (!normalizedUsername || normalizedUsername.length > 128 || /[\u0000-\u001f\u007f-\u009f]/u.test(normalizedUsername)) {
    throw new AdminAccountSetupError('Username must contain 1–128 characters without control characters.');
  }
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw new AdminAccountSetupError('Password must contain 12–128 characters.');
  }
  return { username: normalizedUsername, password };
}

/** Offline only. The runtime never imports this initializer or creates accounts. */
export async function initializeAdminAccount(pool, input) {
  const { username, password } = validateAdminCredentials(input.username, input.password);
  const passwordHash = await hashPassword(password);
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query('begin');
    transactionStarted = true;
    await client.query('lock table public.admin_auth_user in exclusive mode');
    const existing = await client.query('select id from public.admin_auth_user limit 1');
    if (existing.rows.length !== 0) {
      throw new AdminAccountSetupError('An administrator already exists. Initialization never overwrites an account.');
    }
    const userId = randomUUID();
    await client.query(
      'insert into public.admin_auth_user (id, name, email, "emailVerified", username, "credentialVersion") values ($1, $2, $3, true, $2, 1)',
      [userId, username, randomUUID() + '@admin.invalid']
    );
    await client.query(
      `insert into public.admin_auth_account (id, "accountId", "providerId", "userId", password) values ($1, $2, 'credential', $2, $3)`,
      [randomUUID(), userId, passwordHash]
    );
    // Security administration is recorded even when optional business audit is off.
    await client.query(
      `insert into public.audit_events (actor_name, entity_type, entity_id, entity_label, action, summary, metadata_json, source) values ('Offline setup', 'system', $1, 'Administrator account', 'created', 'Administrator account initialized', '{"event":"admin_account_initialized"}'::jsonb, 'offline-admin-setup')`,
      [userId]
    );
    await client.query('commit');
    transactionStarted = false;
  } finally {
    if (transactionStarted) await client.query('rollback').catch(() => undefined);
    client.release();
  }
}
