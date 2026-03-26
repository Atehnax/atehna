'use client';

import { useEffect } from 'react';
import { markRouteEvent, measureRouteDuration, observeInitialLongTasks } from '@/shared/client/routePerformance';

export default function PublicRoutePerformanceBeacon({ routeId }: { routeId: string }) {
  useEffect(() => {
    markRouteEvent(routeId, 'page-shell-visible');
    const cleanupLongTasks = observeInitialLongTasks(routeId);
    return () => cleanupLongTasks();
  }, [routeId]);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      markRouteEvent(routeId, 'primary-content-visible');
      measureRouteDuration(routeId, 'shell-to-primary-content', 'page-shell-visible', 'primary-content-visible');
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [routeId]);

  return null;
}
