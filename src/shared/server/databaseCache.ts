import 'server-only';
import { unstable_cache } from 'next/cache';

export const DATABASE_CACHE_REVALIDATE_SECONDS = 60;
const DATABASE_CACHE_POLICY_KEY = 'database-cache-60s-v1';

/**
 * Production and Preview invalidate their own caches even when sharing a database.
 * Refresh active reads after 60 seconds; Next may serve stale data while refreshing.
 * The policy key prevents reuse of entries created with an indefinite lifetime.
 */
export function cacheDatabaseRead<T extends Parameters<typeof unstable_cache>[0]>(
  read: T,
  keyParts: string[],
  options: { tags: string[] }
): T {
  return unstable_cache(read, [...keyParts, DATABASE_CACHE_POLICY_KEY], {
    ...options,
    revalidate: DATABASE_CACHE_REVALIDATE_SECONDS
  });
}
