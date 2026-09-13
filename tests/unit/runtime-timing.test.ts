import assert from 'node:assert/strict';
import test from 'node:test';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Client, type ClientConfig } from 'pg';
import { RuntimeTimingCollector, RUNTIME_PROBE_TRACE_PREFIX, RUNTIME_TIMING_LIMITS, safeTimingError, type RuntimePhase } from '../../src/shared/server/diagnostics/runtimeTimingCore';
import { createTimedPool, runtimeDatabaseMetadata, wrapTimedQuery } from '../../src/shared/server/diagnostics/databaseTiming';

const probe = (index: number) => RUNTIME_PROBE_TRACE_PREFIX + index.toString(16).padStart(24, '0');
test('opt-in traces are bounded, expire, and serialize only after the lifecycle task', async () => {
  let clock = 100, epoch = 1_000_000;
  const collector = new RuntimeTimingCollector(() => clock, () => epoch);
  const tasks: Array<() => Promise<void>> = [], summaries: unknown[] = [];
  assert.equal(collector.begin('f'.repeat(32)), false);
  assert.equal(collector.begin(probe(1)), true);
  collector.schedule(probe(1), task => { tasks.push(task); return true; }, summary => summaries.push(summary));
  collector.schedule(probe(1), task => { tasks.push(task); return true; }, summary => summaries.push(summary));
  for (let i = 0; i < 140; i++) collector.phase(probe(1), { category: 'db.query', operation: 'round-trip', startMs: 101, durationMs: 2 });
  assert.equal(tasks.length, 1); assert.equal(summaries.length, 0);
  clock = 110;
  await tasks[0]();
  const summary = summaries[0] as NonNullable<ReturnType<RuntimeTimingCollector['finish']>>;
  assert.equal(summary.traceId, probe(1)); assert.equal(summary.phases.length, 128); assert.equal(summary.droppedSpans, 12); assert.equal(summary.throughAfterMs, 10);
  assert.equal(collector.has(probe(1)), false);
  assert.equal(collector.begin(probe(1)), false, 'late children must not reopen an emitted trace');
  for (let i = 2; i < 34; i++) assert.equal(collector.begin(probe(i)), true);
  assert.equal(collector.begin(probe(35)), false);
  epoch += RUNTIME_TIMING_LIMITS.ttlMs + 1;
  assert.equal(collector.begin(probe(35)), true);
  assert.equal(collector.has(probe(2)), false);
});
test('sampling budget cannot be bypassed by finishing traces; ordinary and malformed IDs are ignored', () => {
  const collector = new RuntimeTimingCollector(() => 0, () => 1_000_000);
  for (let i = 1; i <= 60; i++) { assert.equal(collector.begin(probe(i)), true); collector.finish(probe(i)); }
  assert.equal(collector.begin(probe(61)), false);
  assert.equal(collector.begin(probe(62) + '?secret=123'), false);
});
test('scheduler absence never falls back to a foreground log and failures preserve request work', async () => {
  const collector = new RuntimeTimingCollector();
  collector.begin(probe(1));
  let logs = 0;
  collector.schedule(probe(1), () => false, () => { logs++; });
  assert.equal(logs, 0);
  let task!: () => Promise<void>;
  collector.schedule(probe(1), pending => { task = pending; return true; }, () => { throw new Error('sink failure'); });
  await task();
  assert.equal(logs, 0);
});
test('phase contexts, query values, exceptions and DB credentials cannot enter the safe metadata projection', () => {
  const client = new Client({ connectionString: 'postgresql://secret-user:secret-password@configured.invalid:5432/secret-db?host=effective.invalid&port=6543&statement_timeout=3210&lock_timeout=2100&sslmode=verify-full', statement_timeout: 999 });
  const metadata = runtimeDatabaseMetadata(client, { max: 3, idleTimeoutMillis: 42, connectionTimeoutMillis: 12 }, { PGHOST: 'unused.invalid', ATEHNA_DB_POOL_MAX: '3' });
  assert.equal(metadata.hostname, 'effective.invalid'); assert.equal(metadata.port, 6543);
  assert.equal(metadata.statementTimeoutMillis, 3210); assert.equal(metadata.lockTimeoutMillis, 2100);
  assert.equal(metadata.poolMax, 3); assert.equal(metadata.tls, true);
  assert.equal(JSON.stringify(metadata).includes('secret'), false);
  assert.equal(JSON.stringify(metadata).includes('unused.invalid'), false);
  assert.equal(safeTimingError(new Error('private customer data')), 'UNHANDLED');
  assert.equal(safeTimingError({ code: 'secret value' }), 'UNHANDLED');
  const collector = new RuntimeTimingCollector();
  collector.begin(probe(1));
  collector.phase(probe(1), { category: 'app.loader', operation: 'read?token=secret', startMs: 0, durationMs: 1 });
  collector.describe(probe(1), { route: '/products/[category]?token=secret' });
  const result = collector.finish(probe(1));
  assert.equal(result?.phases[0].operation, 'other'); assert.equal(result?.route, '/products/[category]');
  assert.equal(JSON.stringify(result).includes('secret'), false);
});
test('query wrappers preserve promise values and original rejection identity without inspecting SQL or rows', async () => {
  const phases: RuntimePhase[] = [];
  const capture = () => ({ id: probe(1), add: (phase: RuntimePhase) => phases.push(phase) });
  const result = { rows: [{ private: 'do not log' }] };
  assert.equal(await wrapTimedQuery(async () => result, capture)('secret sql', ['private parameter']), result);
  const error = Object.assign(new Error('private SQL text'), { code: '42P01' });
  await assert.rejects(wrapTimedQuery(async () => { throw error; }, capture)() as Promise<unknown>, candidate => candidate === error);
  assert.equal(phases[1].errorCode, '42P01'); assert.equal(phases.length, 2);
  assert.equal(JSON.stringify(phases).includes('private'), false); assert.equal(JSON.stringify(phases).includes('secret'), false);
});
test('callback overloads, config callbacks, synchronous exceptions and custom streams retain their contracts', () => {
  const phases: RuntimePhase[] = [];
  const capture = () => ({ id: probe(1), add: (phase: RuntimePhase) => phases.push(phase) });
  const result = { rows: [] }, receiver = {};
  const original = (...args: unknown[]) => { const cb = args.find(value => typeof value === 'function') as (error: unknown, rows: unknown) => void; cb.call(receiver, undefined, result); };
  const query = wrapTimedQuery(original, capture);
  let calls = 0;
  function callback(this: unknown, error: unknown, value: unknown) { assert.equal(this, receiver); assert.equal(error, undefined); assert.equal(value, result); calls++; }
  assert.equal(query('sql', callback), undefined); query('sql', ['value'], callback);
  const config = { text: 'sql', callback };
  wrapTimedQuery((input) => { const value = input as typeof config; value.callback.call(receiver, undefined, result); }, capture)(config);
  assert.equal(config.callback, callback); assert.equal(calls, 3);
  const exception = new TypeError('bad argument');
  assert.throws(() => wrapTimedQuery(() => { throw exception; }, capture)(null), error => error === exception);
  const stream = { submit() {} };
  assert.equal(wrapTimedQuery(value => value, capture)(stream), stream);
  assert.equal(phases.length, 5); assert.equal(phases[4].category, 'db.unmeasured');
});
test('pool timings separate a new handshake from a queued reused client and retain request context', async () => {
  const pending: Array<() => void> = [];
  class FakeClient extends Client {
    constructor(options?: ClientConfig) {
      super(options);
      this.connect = ((callback?: (error?: Error) => void) => { if (callback) { pending.push(() => callback()); return; } return Promise.resolve(); }) as typeof this.connect;
      this.end = ((callback?: () => void) => { this.emit('end'); callback?.(); return callback ? undefined : Promise.resolve(); }) as typeof this.end;
    }
  }
  const storage = new AsyncLocalStorage<string>();
  const phases = new Map<string, RuntimePhase[]>();
  const capture = () => { const id = storage.getStore(); if (!id) return undefined; return { id, add: (phase: RuntimePhase) => { const entries = phases.get(id) ?? []; entries.push(phase); phases.set(id, entries); } }; };
  const pool = createTimedPool({ max: 1, idleTimeoutMillis: 0 }, FakeClient, capture);
  const first = storage.run('first', () => pool.connect());
  pending.shift()!();
  const client = await first;
  const second = storage.run('second', () => new Promise<void>((resolve, reject) => pool.connect((error, nextClient, release) => {
    if (error) { reject(error); return; }
    assert.equal(nextClient, client); assert.equal(storage.getStore(), 'second'); release(); resolve();
  })));
  assert.equal(pool.waitingCount, 1);
  storage.run('releaser', () => client.release());
  await second;
  assert.equal(phases.get('first')?.find(phase => phase.category === 'pool.acquire')?.counts?.newConnection, 1);
  assert.equal(phases.get('second')?.find(phase => phase.category === 'pool.acquire')?.counts?.newConnection, 0);
  assert.equal(phases.get('second')?.find(phase => phase.category === 'pool.acquire')?.counts?.waitAndCheckoutMs! >= 0, true);
  await pool.end();
});

test('OpenTelemetry correlates remote and platform-local probe parents and ignores ordinary requests', async () => {
  const { context, trace, TraceFlags, ROOT_CONTEXT } = await import('@opentelemetry/api');
  const { registerRuntimeTiming } = await import('../../src/shared/server/diagnostics/runtimeTimingNode');
  const { configureRuntimeTiming, getRuntimeTimingCollector, captureRuntimeTiming, withRuntimeTiming } = await import('../../src/shared/server/diagnostics/runtimeTiming');
  registerRuntimeTiming();
  const collector = getRuntimeTimingCollector()!;
  const tasks: Array<() => Promise<void>> = [], summaries: Array<NonNullable<ReturnType<RuntimeTimingCollector['finish']>>> = [];
  configureRuntimeTiming({ collector, schedule: task => { tasks.push(task); return true; }, sink: summary => summaries.push(summary) });
  const tracer = trace.getTracer('runtime-timing-unit-test');
  await tracer.startActiveSpan('ordinary', async span => { assert.equal(captureRuntimeTiming(), undefined); span.end(); });
  assert.equal(tasks.length, 0);
  await Promise.all([1, 2].map(index => {
    const parent = trace.setSpanContext(ROOT_CONTEXT, { traceId: probe(index), spanId: '1234567890123456', traceFlags: TraceFlags.SAMPLED, isRemote: index === 1 });
    return context.with(parent, () => tracer.startActiveSpan('probe', async span => {
      await withRuntimeTiming('app.dependency', 'concurrent-' + index, async () => {
        await new Promise<void>(resolve => setImmediate(resolve));
        assert.equal(captureRuntimeTiming()?.id, probe(index));
      });
      span.end();
    }));
  }));
  assert.equal(summaries.length, 0); assert.equal(tasks.length, 2);
  await Promise.all(tasks.map(task => task()));
  assert.equal(summaries.length, 2);
  for (const summary of summaries) assert.equal(summary.phases[0].operation, 'concurrent-' + (summary.traceId === probe(1) ? 1 : 2));
});
