import { randomUUID } from 'node:crypto';

export const RUNTIME_PROBE_TRACE_PREFIX = 'a7e4a001';
export const RUNTIME_TIMING_LIMITS = { traces: 32, spans: 128, probesPerMinute: 60, ttlMs: 120_000 } as const;
export type RuntimePhase = { category: string; operation: string; startMs: number; durationMs: number; errorCode?: string; counts?: Record<string, number> };
export type RuntimeDatabaseMetadata = {
  hostname: string | null; port: number | null; tls: boolean; tlsRejectUnauthorized: boolean | null;
  poolMax: number; connectionTimeoutMillis: number; idleTimeoutMillis: number;
  statementTimeoutMillis: number | null; lockTimeoutMillis: number | null; overrideNames: string[];
};
type Trace = { id: string; started: number; createdAt: number; scheduled: boolean; phases: RuntimePhase[]; dropped: number; route: string | null; rsc: boolean | null; status: number | null };
export type TimingSummary = ReturnType<RuntimeTimingCollector['finish']>;
const safeLabel = (value: string) => /^[a-zA-Z0-9_.:/[\] -]{1,120}$/.test(value) ? value : 'other';
export function safeTimingError(error: unknown): string | undefined {
  if (!error) return undefined;
  const code = typeof error === 'object' && 'code' in error ? String(error.code) : 'UNHANDLED';
  return /^[A-Z0-9_]{1,48}$/.test(code) ? code : 'UNHANDLED';
}
export class RuntimeTimingCollector {
  private traces = new Map<string, Trace>();
  private completed = new Map<string, number>();
  private windowAt = 0;
  private windowCount = 0;
  private firstProbe = true;
  readonly instance = { id: randomUUID(), registeredAt: new Date().toISOString(), registrationMs: null as number | null, region: /^[a-z0-9-]{1,24}$/.test(process.env.VERCEL_REGION ?? '') ? process.env.VERCEL_REGION! : null };
  database: RuntimeDatabaseMetadata | null = null;
  constructor(private clock: () => number = () => performance.now(), private epoch: () => number = Date.now) {}
  begin(id: string): boolean {
    const now = this.epoch();
    for (const [key, value] of this.traces) if (now - value.createdAt > RUNTIME_TIMING_LIMITS.ttlMs) this.traces.delete(key);
    for (const [key, recordedAt] of this.completed) if (now - recordedAt > RUNTIME_TIMING_LIMITS.ttlMs) this.completed.delete(key);
    if (this.completed.has(id)) return false;
    if (this.traces.has(id)) return true;
    if (!new RegExp('^' + RUNTIME_PROBE_TRACE_PREFIX + '[0-9a-f]{24}$').test(id)) return false;
    if (now - this.windowAt >= 60_000) { this.windowAt = now; this.windowCount = 0; }
    if (this.windowCount >= RUNTIME_TIMING_LIMITS.probesPerMinute || this.traces.size >= RUNTIME_TIMING_LIMITS.traces) return false;
    this.windowCount++;
    this.traces.set(id, { id, started: this.clock(), createdAt: now, scheduled: false, phases: [], dropped: 0, route: null, rsc: null, status: null });
    return true;
  }
  has(id: string) { return this.traces.has(id); }
  schedule(id: string, schedule: (task: () => Promise<void>) => boolean, sink: (summary: NonNullable<TimingSummary>) => void) {
    const trace = this.traces.get(id);
    if (!trace || trace.scheduled) return;
    trace.scheduled = true;
    const accepted = schedule(async () => {
      // Allow the server response completion span to close before snapshotting.
      await new Promise<void>(resolve => setImmediate(resolve));
      const summary = this.finish(id);
      if (summary) { try { sink(summary); } catch { /* Optional logging cannot affect a response. */ } }
    });
    if (!accepted) trace.scheduled = false;
  }
  phase(id: string, phase: RuntimePhase) {
    const trace = this.traces.get(id);
    if (!trace) return;
    if (trace.phases.length >= RUNTIME_TIMING_LIMITS.spans) { trace.dropped++; return; }
    trace.phases.push({ ...phase, category: safeLabel(phase.category), operation: safeLabel(phase.operation), startMs: Math.max(0, phase.startMs - trace.started), durationMs: Math.max(0, phase.durationMs) });
  }
  describe(id: string, info: { route?: unknown; rsc?: unknown; status?: unknown }) {
    const trace = this.traces.get(id);
    if (!trace) return;
    // Only framework route patterns, never URL targets, search strings or headers.
    if (typeof info.route === 'string' && info.route.startsWith('/')) trace.route = safeLabel(info.route.split(/[?#]/, 1)[0]);
    if (typeof info.rsc === 'boolean') trace.rsc = info.rsc;
    if (typeof info.status === 'number' && info.status >= 100 && info.status <= 599) trace.status = info.status;
  }
  finish(id: string) {
    const trace = this.traces.get(id);
    if (!trace) return null;
    this.traces.delete(id);
    // Late framework children must not reopen an already emitted request.
    if (this.completed.size >= 128) this.completed.delete(this.completed.keys().next().value!);
    this.completed.set(id, this.epoch());
    const firstProbeOnInstance = this.firstProbe;
    this.firstProbe = false;
    return {
      event: 'atehna.runtime-timing.v1', traceId: id, recordedAt: new Date(this.epoch()).toISOString(),
      instance: { ...this.instance, firstProbeOnInstance }, database: this.database,
      route: trace.route, rsc: trace.rsc, status: trace.status,
      throughAfterMs: Math.max(0, this.clock() - trace.started), phases: trace.phases, droppedSpans: trace.dropped,
      unmeasured: ['platform_provisioning_before_register', 'neon_activation_within_connect', 'database_lock_wait_within_query', 'database_execution_vs_network', 'browser_rendering']
    };
  }
}
