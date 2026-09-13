import { trace, TraceFlags, type Context } from '@opentelemetry/api';
import { NodeTracerProvider, SamplingDecision, type ReadableSpan, type Sampler, type Span, type SpanProcessor } from '@opentelemetry/sdk-trace-node';
import { after } from 'next/server';
import { RuntimeTimingCollector } from './runtimeTimingCore';
import { configureRuntimeTiming, getRuntimeTimingCollector } from './runtimeTiming';

const allowedNextPhases = new Set(['BaseServer.handleRequest', 'AppRender.getBodyResult', 'AppRender.fetch', 'AppRouteRouteHandlers.runHandler', 'NextNodeServer.findPageComponents', 'NextNodeServer.getLayoutOrPageModule', 'ResolveMetadata.generateMetadata', 'NextNodeServer.startResponse']);
export function registerRuntimeTiming() {
  if (getRuntimeTimingCollector()) return;
  const collector = new RuntimeTimingCollector();
  const sampler: Sampler = {
    shouldSample(parentContext, id) {
      const parent = trace.getSpanContext(parentContext);
      // A platform HTTP span may already be the local parent of Next's span.
      // The sampled probe ID, rather than parent remoteness, controls admission.
      const admitted = Boolean(parent && (parent.traceFlags & TraceFlags.SAMPLED) && collector.begin(id));
      return { decision: admitted ? SamplingDecision.RECORD_AND_SAMPLED : SamplingDecision.NOT_RECORD };
    },
    toString: () => 'AtehnaBoundedProbeSampler'
  };
  const processor: SpanProcessor = {
    onStart(_span: Span, _parentContext: Context) {},
    onEnd(span: ReadableSpan) {
      const id = span.spanContext().traceId;
      if (!collector.has(id)) return;
      const type = span.attributes['next.span_type'];
      collector.describe(id, { route: span.attributes['next.route'] ?? span.attributes['http.route'], rsc: span.attributes['next.rsc'], status: span.attributes['http.status_code'] });
      if (typeof type !== 'string' || !allowedNextPhases.has(type)) return;
      const durationMs = span.duration[0] * 1_000 + span.duration[1] / 1_000_000;
      collector.phase(id, { category: 'next', operation: type, startMs: performance.now() - durationMs, durationMs, ...(span.status.code === 2 ? { errorCode: 'FRAMEWORK_ERROR' } : {}) });
    },
    async forceFlush() {},
    async shutdown() {}
  };
  configureRuntimeTiming({ collector, schedule(task) {
    try { after(task); return true; }
    catch { return false; } // No request lifecycle in a standalone script: never write inline.
  }, sink: summary => console.info(JSON.stringify(summary)) });
  const provider = new NodeTracerProvider({ sampler, spanProcessors: [processor], spanLimits: { attributeCountLimit: 24, eventCountLimit: 0, linkCountLimit: 0, attributeValueLengthLimit: 180 } });
  provider.register();
}
