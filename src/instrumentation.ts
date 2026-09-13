import type { Instrumentation } from 'next';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.ATEHNA_PERFORMANCE_DIAGNOSTICS === '1') {
    try {
      const started = performance.now();
      const { registerRuntimeTiming } = await import('./shared/server/diagnostics/runtimeTimingNode');
      registerRuntimeTiming();
      const { getRuntimeTimingCollector } = await import('./shared/server/diagnostics/runtimeTiming');
      const collector = getRuntimeTimingCollector();
      if (collector) collector.instance.registrationMs = performance.now() - started;
    } catch {
      console.error('Optional runtime timing initialization unavailable.');
    }
  }
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { reportRenderStreamError } = await import('./shared/server/diagnostics/renderStreamError');
      reportRenderStreamError(...args);
    } catch {
      // Optional diagnostics must never change the error response or its normal logging.
    }
  }
};
