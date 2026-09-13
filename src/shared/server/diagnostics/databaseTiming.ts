import { AsyncResource } from 'node:async_hooks';
import { Client, Pool, type ClientConfig, type PoolClient, type PoolConfig } from 'pg';
import { captureRuntimeTiming, recordRuntimeDatabaseMetadata } from './runtimeTiming';
import { safeTimingError, type RuntimeDatabaseMetadata } from './runtimeTimingCore';

type Capture = typeof captureRuntimeTiming;
type DriverMethod = (...args: unknown[]) => unknown;
const overrideKeys = ['ATEHNA_DB_POOL_MAX', 'ATEHNA_DB_CONNECTION_TIMEOUT_MS', 'ATEHNA_DB_IDLE_TIMEOUT_MS', 'ATEHNA_DB_STATEMENT_TIMEOUT_MS', 'ATEHNA_DB_LOCK_TIMEOUT_MS', 'PGHOST', 'PGPORT', 'PGSSLMODE'] as const;
const numberOrNull = (value: unknown) => (typeof value === 'number' || typeof value === 'string') && Number.isFinite(Number(value)) ? Number(value) : null;
export function runtimeDatabaseMetadata(client: Client, options: PoolConfig, environment: Readonly<Record<string, string | undefined>> = process.env): RuntimeDatabaseMetadata {
  // pg parses connectionString over explicit config and applies PG* fallbacks.
  // Inspect its resolved client, never return connectionString or spread config.
  const parameters = (client as Client & { connectionParameters: { ssl?: boolean | { rejectUnauthorized?: boolean }; statement_timeout?: unknown; lock_timeout?: unknown } }).connectionParameters;
  const ssl = parameters.ssl;
  return {
    hostname: /^[a-zA-Z0-9.:-]{1,253}$/.test(client.host) ? client.host : null,
    port: numberOrNull(client.port), tls: Boolean(ssl), tlsRejectUnauthorized: ssl ? typeof ssl === 'object' ? ssl.rejectUnauthorized !== false : true : null,
    poolMax: options.max ?? 10, connectionTimeoutMillis: options.connectionTimeoutMillis ?? 0, idleTimeoutMillis: options.idleTimeoutMillis ?? 10_000,
    statementTimeoutMillis: numberOrNull(parameters.statement_timeout) ?? 0, lockTimeoutMillis: numberOrNull(parameters.lock_timeout) ?? 0,
    overrideNames: overrideKeys.filter(key => typeof environment[key] === 'string' && environment[key]!.trim() !== '')
  };
}
export function wrapTimedQuery(original: DriverMethod, capture: Capture = captureRuntimeTiming): DriverMethod {
  return function (...args: unknown[]) {
    const timing = capture();
    if (!timing) return original(...args);
    const first = args[0];
    // Custom pg Submittable objects/streams keep their original event contract.
    if (first && typeof first === 'object' && 'submit' in first && typeof first.submit === 'function') {
      timing.add({ category: 'db.unmeasured', operation: 'custom-query-stream', startMs: performance.now(), durationMs: 0 });
      return original(...args);
    }
    const started = performance.now();
    let finished = false;
    const finish = (error?: unknown) => {
      if (finished) return;
      finished = true;
      const errorCode = safeTimingError(error);
      timing.add({ category: 'db.query', operation: 'round-trip-including-client-queue', startMs: started, durationMs: performance.now() - started, ...(errorCode ? { errorCode } : {}) });
    };
    const callbackIndex = typeof args[2] === 'function' ? 2 : typeof args[1] === 'function' ? 1 : -1;
    const configCallback = first && typeof first === 'object' && 'callback' in first && typeof first.callback === 'function' ? first.callback : null;
    const callback = callbackIndex >= 0 ? args[callbackIndex] as (...values: unknown[]) => unknown : configCallback;
    if (callback) {
      const wrapped = function (this: unknown, ...values: unknown[]) { finish(values[0]); return callback.apply(this, values); };
      if (callbackIndex >= 0) args[callbackIndex] = wrapped;
      else args[0] = { ...first as object, callback: wrapped };
    }
    try {
      const result = original(...args);
      if (!callback && result && typeof (result as Promise<unknown>).then === 'function') return (result as Promise<unknown>).then(value => { finish(); return value; }, error => { finish(error); throw error; });
      return result;
    } catch (error) { finish(error); throw error; }
  };
}
type ConnectionTiming = { started: number; ended: number; claimed: boolean };
export function createTimedPool(options: PoolConfig, ClientConstructor: typeof Client = Client, capture: Capture = captureRuntimeTiming): Pool {
  const connections = new WeakMap<object, ConnectionTiming>();
  const failedConnections = new WeakMap<object, ConnectionTiming>();
  class TimingClient extends ClientConstructor {
    constructor(config?: ClientConfig) {
      super(config);
      recordRuntimeDatabaseMetadata(runtimeDatabaseMetadata(this, options));
      const connect = this.connect.bind(this);
      this.connect = ((callback?: (error: Error) => void) => {
        const measurement = { started: performance.now(), ended: 0, claimed: false };
        connections.set(this, measurement);
        const finished = (error?: unknown) => { measurement.ended = performance.now(); if (error && typeof error === 'object') failedConnections.set(error, measurement); };
        if (callback) return connect(error => { finished(error); callback(error); });
        return connect().then(() => { finished(); }, error => { finished(error); throw error; });
      }) as typeof this.connect;
      this.query = wrapTimedQuery(this.query.bind(this) as DriverMethod, capture) as typeof this.query;
    }
  }
  const pool = new Pool({ ...options, Client: TimingClient });
  // A connection previously used by ordinary traffic is reused, not a new
  // handshake attributable to a later opted-in request.
  pool.on('release', (_error, client) => { const connection = connections.get(client); if (connection) connection.claimed = true; });
  const connect = pool.connect.bind(pool);
  pool.connect = ((callback?: (error: Error | undefined, client: PoolClient | undefined, done: (release?: unknown) => void) => void) => {
    const timing = capture();
    // pg can dispatch a queued checkout while another request releases its
    // client. Retain the caller's context even for non-probe requests.
    if (!timing) return callback ? connect(AsyncResource.bind(callback)) : connect();
    const started = performance.now();
    const counts = { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount };
    const finish = (error: unknown, client?: PoolClient) => {
      const ended = performance.now();
      const failed = error && typeof error === 'object' ? failedConnections.get(error) ?? ('cause' in error && error.cause && typeof error.cause === 'object' ? failedConnections.get(error.cause) : undefined) : undefined;
      const connection = client ? connections.get(client) : failed;
      const newConnection = connection && !connection.claimed;
      const connectMs = newConnection ? Math.max(0, connection.ended - Math.max(started, connection.started)) : 0;
      if (connection) connection.claimed = true;
      const errorCode = safeTimingError(error);
      timing.add({ category: 'pool.acquire', operation: 'wait-and-checkout', startMs: started, durationMs: ended - started, counts: { ...counts, connectMs, ...(!error || connection ? { waitAndCheckoutMs: Math.max(0, ended - started - connectMs) } : {}), newConnection: newConnection ? 1 : 0, connectObserved: connection ? 1 : 0 }, ...(errorCode ? { errorCode } : {}) });
      if (newConnection) timing.add({ category: 'db.connect', operation: 'dns-tcp-tls-auth-combined', startMs: Math.max(started, connection.started), durationMs: connectMs, ...(errorCode ? { errorCode } : {}) });
    };
    if (callback) return connect(AsyncResource.bind(function (error, client, done) { finish(error, client); callback(error, client, done); }));
    return connect().then(client => { finish(undefined, client); return client; }, error => { finish(error); throw error; });
  }) as typeof pool.connect;
  return pool;
}
