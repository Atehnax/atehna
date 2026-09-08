import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyPassword } from 'better-auth/crypto';
import { initializeAdminAccount, validateAdminCredentials } from '../../scripts/admin-account-core.mjs';

test('offline administrator validation preserves username case and password whitespace', () => {
  assert.deepEqual(validateAdminCredentials('  Admin User  ', '  valid password  '), {
    username: 'Admin User', password: '  valid password  '
  });
  for (const username of ['', 'a'.repeat(129), 'admin\nname', 'admin\u007fname']) {
    assert.throws(() => validateAdminCredentials(username, 'valid-password-12'));
  }
  for (const password of ['', 'short', 'x'.repeat(129), undefined]) {
    assert.throws(() => validateAdminCredentials('Admin', password));
  }
});

function fakePool(options: { existing?: boolean; rejectAudit?: boolean } = {}) {
  const queries: Array<{ text: string; values: unknown[] }> = [];
  let released = false;
  return {
    queries,
    get released() { return released; },
    async connect() {
      return {
        async query(text: string, values: unknown[] = []) {
          queries.push({ text, values });
          if (options.rejectAudit && text.startsWith('insert into public.audit_events')) throw new Error('Audit unavailable');
          return { rows: text.startsWith('select id') && options.existing ? [{ id: 'existing' }] : [] };
        },
        release() { released = true; }
      };
    }
  };
}

test('offline initialization stores a Better Auth hash and opaque internal email in one audited transaction', async () => {
  const pool = fakePool();
  const password = 'test-only-secure-password';
  await initializeAdminAccount(pool, { username: 'CasePreserved', password });
  const user = pool.queries.find(query => query.text.startsWith('insert into public.admin_auth_user'))!;
  const account = pool.queries.find(query => query.text.startsWith('insert into public.admin_auth_account'))!;
  const audit = pool.queries.find(query => query.text.startsWith('insert into public.audit_events'))!;
  assert.equal(user.values[1], 'CasePreserved');
  assert.match(String(user.values[2]), /^[a-f0-9-]{36}@admin\.invalid$/u);
  assert.equal(account.values[1], user.values[0]);
  assert.notEqual(account.values[2], password);
  assert.equal(await verifyPassword({ hash: String(account.values[2]), password }), true);
  assert.equal(await verifyPassword({ hash: String(account.values[2]), password: 'wrong-password' }), false);
  assert.doesNotMatch(JSON.stringify(pool.queries), /test-only-secure-password/u);
  assert.deepEqual(audit.values, [user.values[0]]);
  assert.equal(pool.queries[0].text, 'begin');
  assert.equal(pool.queries[1].text, 'lock table public.admin_auth_user in exclusive mode');
  assert.equal(pool.queries.at(-1)?.text, 'commit');
  assert.equal(pool.released, true);
});

test('offline initialization refuses existing accounts and releases its transaction', async () => {
  const pool = fakePool({ existing: true });
  await assert.rejects(initializeAdminAccount(pool, { username: 'Admin', password: 'test-only-password' }), /already exists/u);
  assert.equal(pool.queries.some(query => query.text.startsWith('insert')), false);
  assert.equal(pool.queries.at(-1)?.text, 'rollback');
  assert.equal(pool.released, true);
});

test('offline initialization rolls back account creation when its mandatory audit fails', async () => {
  const pool = fakePool({ rejectAudit: true });
  await assert.rejects(initializeAdminAccount(pool, { username: 'Admin', password: 'test-only-password' }), /Audit unavailable/u);
  assert.equal(pool.queries.some(query => query.text === 'commit'), false);
  assert.equal(pool.queries.at(-1)?.text, 'rollback');
  assert.equal(pool.released, true);
});

test('legacy password bounds require an explicit offline import option', () => {
  for (const password of ['x', 'x'.repeat(11)]) {
    assert.throws(() => validateAdminCredentials('Admin', password), /12–128/u);
    assert.throws(() => validateAdminCredentials('Admin', password, { legacyImport: false }), /12–128/u);
    assert.equal(validateAdminCredentials('Admin', password, { legacyImport: true }).password, password);
  }
  for (const password of ['x'.repeat(12), 'x'.repeat(128)]) {
    assert.equal(validateAdminCredentials('Admin', password).password, password);
    assert.equal(validateAdminCredentials('Admin', password, { legacyImport: true }).password, password);
  }
  for (const password of ['', 'x'.repeat(129), undefined, null, 1]) {
    assert.throws(() => validateAdminCredentials('Admin', password));
    assert.throws(() => validateAdminCredentials('Admin', password, { legacyImport: true }));
  }
});

test('explicit offline legacy import hashes a short existing password without relaxing normal creation', async () => {
  const normal = fakePool();
  await assert.rejects(initializeAdminAccount(normal, { username: 'Admin', password: 'legacy' }), /12–128/u);
  assert.equal(normal.queries.length, 0);
  const legacy = fakePool();
  await initializeAdminAccount(legacy, { username: 'Admin', password: 'legacy' }, { legacyImport: true });
  const account = legacy.queries.find(query => query.text.startsWith('insert into public.admin_auth_account'))!;
  assert.equal(await verifyPassword({ hash: String(account.values[2]), password: 'legacy' }), true);
  assert.notEqual(account.values[2], 'legacy');
  assert.equal(legacy.queries.at(-1)?.text, 'commit');
});

test('legacy import still refuses to overwrite an existing account', async () => {
  const pool = fakePool({ existing: true });
  await assert.rejects(initializeAdminAccount(pool, { username: 'Admin', password: 'legacy' }, { legacyImport: true }), /already exists/u);
  assert.equal(pool.queries.some(query => query.text.startsWith('insert')), false);
  assert.equal(pool.queries.at(-1)?.text, 'rollback');
  assert.equal(pool.released, true);
});
