import { unstable_noStore as noStore } from 'next/cache';

/**
 * Preserve existing dynamic/CLI fallbacks, but never publish them as cached HTML.
 * Homepage dynamic='error' turns this into a regeneration failure, retaining the
 * last successful page. Keep this OUTSIDE unstable_cache callbacks.
 *
 * noStore is intentional here: unlike connection(), it is safe without a Next
 * request (CLI callers). Revisit this guard if Cache Components is enabled;
 * this project currently uses the supported legacy caching model.
 */
export function preventCachingPublicFallback() {
  noStore();
}
