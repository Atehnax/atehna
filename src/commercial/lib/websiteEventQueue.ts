type SendEvent = (input: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'json'>>;
export function productIdFromPath(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  return parts.length === 4 && parts[0] === 'products' && parts[2] === 'items' ? parts[3] : null;
}

/** Serialize navigation events so the first response establishes browser cookies
 * before a product event or the next navigation uses the same visitor/session. */
export function createWebsiteEventQueue(send: SendEvent = (input, init) => fetch(input, init)) {
  let pending: Promise<void> = Promise.resolve();
  const emit = async (body: { eventType: string; path: string; productId?: string }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await send('/api/analytics/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body), signal: controller.signal });
      if (!response.ok) return false;
      const result = await response.json() as { ok?: boolean };
      return result.ok === true;
    } finally { clearTimeout(timeout); }
  };
  return (pathname: string): Promise<void> => {
    if (!pathname || pathname.startsWith('/api/') || pathname.startsWith('/admin')) return pending;
    pending = pending.then(async () => {
      const recorded = await emit({ eventType: 'page_view', path: pathname });
      const productId = productIdFromPath(pathname);
      if (recorded && productId) await emit({ eventType: 'product_view', path: pathname, productId });
    }).catch(() => undefined);
    return pending;
  };
}
