import type { CatalogImageDimensions } from './catalogAdminTypes';

/** Optional original links stay within the same public image library or allowed blob CDN. */
export function normalizeCatalogImageOriginal(metadata: unknown): Pick<
  CatalogImageDimensions, 'originalUrl' | 'originalWidth' | 'originalHeight'
> {
  if (!metadata || typeof metadata !== 'object') return {};
  const source = metadata as Record<string, unknown>;
  if (typeof source.originalUrl !== 'string') return {};
  const originalUrl = source.originalUrl.trim();
  try {
    const decoded = decodeURIComponent(originalUrl);
    if (/[\\\u0000-\u0020]/u.test(decoded)) return {};
    const url = new URL(originalUrl, 'https://catalog.invalid');
    if (url.username || url.password || url.search || url.hash || url.port) return {};
    if (!/\.(?:png|jpe?g|webp|avif|gif)$/iu.test(url.pathname)) return {};
    const local = originalUrl.startsWith('/images/')
      && url.origin === 'https://catalog.invalid'
      && url.pathname.startsWith('/images/')
      && !decoded.split('/').some((part) => part === '.' || part === '..');
    const blob = originalUrl.startsWith('https://')
      && url.protocol === 'https:'
      && /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/iu.test(url.hostname);
    if (!local && !blob) return {};
  } catch {
    return {};
  }
  const positiveInteger = (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value > 0;
  return {
    originalUrl,
    ...(positiveInteger(source.originalWidth) && positiveInteger(source.originalHeight)
      ? { originalWidth: source.originalWidth, originalHeight: source.originalHeight }
      : {})
  };
}
