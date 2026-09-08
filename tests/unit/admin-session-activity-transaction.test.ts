import assert from 'node:assert/strict';
import test from 'node:test';
import { loadBoundServerModule } from './support/loadBoundServerModule';

function activityHarness(options: {
  policyAvailable?: Promise<void>;
  updateFailure?: Error;
  authenticated?: boolean;
} = {}) {
  const operations: string[] = [];
  const state = { expired: false, writes: 0, transaction: false, policyLocked: false };
  const session = { id: 'activity-session', expiresAt: new Date('2030-01-01T00:00:00Z') };
  const client = {
    async query(sql: string) {
      const command = sql.trim().replace(/\s+/g, ' ');
      if (command === 'begin') {
        operations.push('begin');
        state.transaction = true;
      } else if (command === 'select id from admin_session_policy where id = 1 for share') {
        operations.push('policy lock');
        assert.equal(state.transaction, true);
        await options.policyAvailable;
        state.policyLocked = true;
      } else if (command.startsWith('update admin_auth_session ')) {
        operations.push('activity update');
        assert.equal(state.policyLocked, true, 'the activity statement must start after acquiring the current policy');
        if (options.updateFailure) throw options.updateFailure;
        if (!state.expired) state.writes++;
      } else if (command === 'commit' || command === 'rollback') {
        operations.push(command);
        state.transaction = false;
        state.policyLocked = false;
      } else throw new Error('Unexpected database operation: ' + command);
      return { rows: [] };
    },
    release() {
      operations.push('release');
      assert.equal(state.transaction, false, 'release must not leave a transaction open');
    }
  };
  const pool = { connect: async () => client, query: client.query };
  const { recordAdminActivity } = loadBoundServerModule<{
    recordAdminActivity: (request: Request) => Promise<Response>
  }>('src/shared/auth/adminSettings.ts', {
    NextResponse: Response,
    getAdminSession: async () => options.authenticated === false ? null : session,
    getPool: async () => pool,
    findLiveAdminSession: async (id: string, db: unknown) => {
      operations.push('fresh session');
      assert.equal(id, session.id);
      assert.equal(db, client, 'expiry verification must use the locked transaction');
      assert.equal(state.policyLocked, true, 'policy lock must survive through expiry verification');
      return state.expired ? null : session;
    }
  });
  const request = new Request('https://atehna.test/api/admin/session/activity', { method: 'POST' });
  return { run: () => recordAdminActivity(request), operations, state, session };
}

test('activity waits for a policy change and cannot renew a session expired by the shortened policy', async () => {
  let releasePolicy!: () => void;
  const policyAvailable = new Promise<void>(resolve => { releasePolicy = resolve; });
  const harness = activityHarness({ policyAvailable });
  const result = harness.run();
  try {
    // Flush ordinary async steps while the policy writer still owns its lock.
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.deepEqual(harness.operations, ['begin', 'policy lock']);
    assert.equal(harness.state.writes, 0);
    harness.state.expired = true;
  } finally { releasePolicy(); }
  const response = await result;
  assert.equal(response.status, 401);
  assert.equal(harness.state.writes, 0);
  assert.deepEqual(harness.operations, ['begin', 'policy lock', 'activity update', 'fresh session', 'commit', 'release']);
});

test('activity commits its conditional update only after verification under the shared policy lock', async () => {
  const harness = activityHarness();
  const response = await harness.run();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).expiresAt, harness.session.expiresAt.toISOString());
  assert.equal(harness.state.writes, 1);
  assert.deepEqual(harness.operations, ['begin', 'policy lock', 'activity update', 'fresh session', 'commit', 'release']);
});

test('activity rolls back and releases its transaction if the conditional update fails', async () => {
  const failure = new Error('write unavailable');
  const harness = activityHarness({ updateFailure: failure });
  await assert.rejects(harness.run(), error => error === failure);
  assert.deepEqual(harness.operations, ['begin', 'policy lock', 'activity update', 'rollback', 'release']);
});

test('an already invalid activity session never opens a database transaction', async () => {
  const harness = activityHarness({ authenticated: false });
  assert.equal((await harness.run()).status, 401);
  assert.deepEqual(harness.operations, []);
});
