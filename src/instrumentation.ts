import type { Instrumentation } from 'next';

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
