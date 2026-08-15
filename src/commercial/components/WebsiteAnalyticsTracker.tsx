'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function inferProductId(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  if (
    parts.length !== 4 ||
    parts[0] !== 'products' ||
    parts[2] !== 'items'
  ) {
    return null;
  }
  return parts[3] || null;
}

export default function WebsiteAnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith('/api/')) return;

    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: 'page_view', path: pathname })
    }).catch(() => undefined);

    const productId = inferProductId(pathname);
    if (productId) {
      fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'product_view',
          path: pathname,
          productId
        })
      }).catch(() => undefined);
    }
  }, [pathname]);

  return null;
}
