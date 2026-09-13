import { AsyncLocalStorage } from 'node:async_hooks';
import { context, trace } from '@opentelemetry/api';
import { RuntimeTimingCollector, safeTimingError, type RuntimeDatabaseMetadata, type RuntimePhase, type TimingSummary } from './runtimeTimingCore';

type RuntimeState = { collector: RuntimeTimingCollector; schedule: (task: () => Promise<void>) => boolean; sink: (summary: NonNullable<TimingSummary>) => void };
const globalState = globalThis as typeof globalThis & { atehnaRuntimeTiming?: RuntimeState };
const suppressed = new AsyncLocalStorage<boolean>();
export function configureRuntimeTiming(state: RuntimeState) { globalState.atehnaRuntimeTiming = state; }
export function getRuntimeTimingCollector() { return globalState.atehnaRuntimeTiming?.collector; }
export function captureRuntimeTiming() {
  const state = globalState.atehnaRuntimeTiming;
  if (!state || suppressed.getStore()) return undefined;
  const id = trace.getSpanContext(context.active())?.traceId;
  if (!id || !state.collector.has(id)) return undefined;
  state.collector.schedule(id, state.schedule, state.sink);
  return { id, add: (phase: RuntimePhase) => state.collector.phase(id, phase) };
}
export async function withRuntimeTiming<T>(category: string, operation: string, run: () => Promise<T>): Promise<T> {
  const timing = captureRuntimeTiming();
  if (!timing) return run();
  const started = performance.now();
  let errorCode: string | undefined;
  try { return await run(); }
  catch (error) { errorCode = safeTimingError(error); throw error; }
  finally { timing.add({ category, operation, startMs: started, durationMs: performance.now() - started, ...(errorCode ? { errorCode } : {}) }); }
}
export function withoutRuntimeTiming<T>(run: () => T): T { return suppressed.run(true, run); }
export function recordRuntimeDatabaseMetadata(metadata: RuntimeDatabaseMetadata) {
  const collector = getRuntimeTimingCollector();
  if (collector) collector.database = metadata;
}
export function getRuntimeTimingMetadata() {
  const collector = getRuntimeTimingCollector();
  const active = captureRuntimeTiming();
  return {
    enabled: Boolean(collector), instance: collector ? { ...collector.instance } : null,
    database: collector?.database ?? null, traceId: active?.id ?? null,
    scope: 'This Node instance only. Hostname is from the instantiated pg Client after URL and environment overrides. No connection is opened for this metadata read.'
  };
}
