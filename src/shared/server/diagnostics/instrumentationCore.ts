import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { DiagnosticEvent, DiagnosticKind } from '@/shared/domain/analytics/diagnostics';

type Phase = 'route' | 'db' | 'cache' | 'transform' | 'payload' | 'helper';
type Trace = { id: string; context: string; events: DiagnosticEvent[]; phases: Record<string, number>; helpers: Map<string, number>; payload: number | null; payloadProducer: string | null; dropped: number };
type Sink = (events: DiagnosticEvent[]) => Promise<void>;
export function normalizedDiagnosticContext(context: string) {
  return context.split(/[?#]/, 1)[0].replace(/\/(?:\d+|[0-9a-f]{8}-[0-9a-f-]{27,})(?=\/|$)/gi, '/[id]').slice(0, 180) || 'unknown';
}
function errorCode(error: unknown) {
  const candidate = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'UNHANDLED';
  return /^[A-Z0-9_]{1,48}$/.test(candidate) ? candidate : 'UNHANDLED';
}
function payloadSize(payload: unknown): number | null {
  if (payload == null) return null;
  if (payload instanceof Response) {
    const length = payload.headers.get('content-length');
    return length && /^\d+$/.test(length) ? Number(length) : null;
  }
  try { const json = JSON.stringify(payload); return json === undefined ? null : Buffer.byteLength(json); } catch { return null; }
}
export function createDiagnosticsInstrumentation(sink: Sink, schedule: (task: () => Promise<void>) => void = task => { void task(); }) {
  const storage = new AsyncLocalStorage<Trace>();
  const persist = async (events: DiagnosticEvent[]) => { if (!events.length) return; try { await sink(events); } catch { /* Telemetry failure cannot fail a business operation. */ } };
  const append = (trace: Trace, event: DiagnosticEvent) => {
    if (trace.events.length < 499 || event.kind === 'route') trace.events.push(event);
    else trace.dropped++;
  };
  const measure = async <T>(kind: DiagnosticKind, context: string, operation: string, run: () => Promise<T>): Promise<T> => {
    const existing = storage.getStore();
    const trace: Trace = existing ?? { id: randomUUID(), context: normalizedDiagnosticContext(context), events: [], phases: {}, helpers: new Map(), payload: null, payloadProducer: null, dropped: 0 };
    const execute = async () => {
      const started = performance.now();
      let failure: string | null = null, measuredBytes: number | null = null;
      try {
        const value = await run();
        measuredBytes = payloadSize(value);
        if (value instanceof Response && value.status >= 400) failure = 'HTTP_' + value.status;
        return value;
      } catch (error) { failure = errorCode(error); throw error; }
      finally {
        append(trace, { id: randomUUID(), recordedAt: new Date().toISOString(), traceId: trace.id, context: normalizedDiagnosticContext(context), operation: operation.slice(0, 180), kind, durationMs: Math.max(0, performance.now() - started), payloadBytes: kind === 'route' ? trace.payload ?? measuredBytes : measuredBytes, error: failure !== null, errorCode: failure, phases: kind === 'route' ? { ...trace.phases } : {}, details: kind === 'route' ? { repeatedHelpers: [...trace.helpers.entries()].filter(([, count]) => count > 1).map(([name, count]) => ({ name, count })), largestPayloadProducer: trace.payloadProducer, droppedSpans: trace.dropped } : {} });
        if (!existing) await persist(trace.events);
      }
    };
    return existing ? execute() : storage.run(trace, execute);
  };
  const profileRoutePhase = async <T>(kind: Phase, name: string, run: () => Promise<T>): Promise<T> => {
    const trace = storage.getStore();
    if (!trace) return run();
    const started = performance.now();
    try { return await run(); } finally {
      trace.phases[kind] = (trace.phases[kind] ?? 0) + Math.max(0, performance.now() - started);
      if (kind === 'helper') trace.helpers.set(name.slice(0, 180), (trace.helpers.get(name.slice(0, 180)) ?? 0) + 1);
    }
  };
  const profilePayloadEstimate = (producer: string, payload: unknown) => {
    const bytes = payloadSize(payload), trace = storage.getStore();
    if (trace && bytes != null && bytes >= (trace.payload ?? 0)) { trace.payload = bytes; trace.payloadProducer = producer.slice(0, 180); }
    return bytes;
  };
  return {
    profileRoutePhase, profilePayloadEstimate,
    instrumentAdminRouteRender: <T>(context: string, run: () => Promise<T>) => measure('route', context, 'request', run),
    instrumentCatalogLoader: <T>(operation: string, context: string, run: () => Promise<T>) => measure('loader', context, operation, () => profileRoutePhase('helper', operation, run)),
    instrumentCatalogCacheMiss: <T>(operation: string, context: string, run: () => Promise<T>) => measure('cache_miss', context, operation, () => profileRoutePhase('cache', operation, run)),
    recordCatalogInvalidation: (input: { context: string; tags: string[]; revalidatedPaths?: number; recordedAt?: Date }) => {
      const trace = storage.getStore();
      const event: DiagnosticEvent = { id: randomUUID(), recordedAt: (input.recordedAt ?? new Date()).toISOString(), traceId: trace?.id ?? randomUUID(), context: normalizedDiagnosticContext(input.context), operation: 'invalidate', kind: 'invalidation', durationMs: null, payloadBytes: null, error: false, errorCode: null, phases: {}, details: { tags: [...new Set(input.tags)].map(tag => tag.slice(0, 120)), revalidatedPaths: Math.max(0, input.revalidatedPaths ?? 0) } };
      if (trace) append(trace, event); else schedule(() => persist([event]));
    }
  };
}
