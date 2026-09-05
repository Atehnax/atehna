'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { createWebsiteEventQueue } from '@/commercial/lib/websiteEventQueue';

const recordNavigation = createWebsiteEventQueue();
export default function WebsiteAnalyticsTracker() {
  const pathname = usePathname();
  const lastRecordedPath = useRef<string | null>(null);
  useEffect(() => {
    if (!pathname || lastRecordedPath.current === pathname) return;
    lastRecordedPath.current = pathname;
    void recordNavigation(pathname);
  }, [pathname]);
  return null;
}
