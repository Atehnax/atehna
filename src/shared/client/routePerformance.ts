'use client';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

const toMetricName = (route: string, event: string) => `route:${route}:${event}`;

const canUsePerformanceApi = () => typeof window !== 'undefined' && typeof window.performance !== 'undefined';

const shouldConsoleLog = () => {
  if (typeof window === 'undefined') return false;
  if (process.env.NODE_ENV !== 'production') return true;
  return LOCAL_HOSTNAMES.has(window.location.hostname);
};

export function markRouteEvent(route: string, event: string, detail?: Record<string, unknown>) {
  if (!canUsePerformanceApi()) return;

  const metricName = toMetricName(route, event);
  performance.mark(metricName);

  if (shouldConsoleLog()) {
    const now = Math.round(performance.now());
    console.info(`[route-profiler] ${route} :: ${event} @ ${now}ms`, detail ?? {});
  }
}

export function measureRouteDuration(route: string, name: string, startEvent: string, endEvent: string) {
  if (!canUsePerformanceApi()) return;

  const measureName = toMetricName(route, name);
  const startMark = toMetricName(route, startEvent);
  const endMark = toMetricName(route, endEvent);

  try {
    performance.measure(measureName, startMark, endMark);
    if (shouldConsoleLog()) {
      const entries = performance.getEntriesByName(measureName, 'measure');
      const latest = entries[entries.length - 1];
      if (latest) {
        console.info(`[route-profiler] ${route} :: ${name} duration=${Math.round(latest.duration)}ms`);
      }
    }
  } catch {
    // Start/end marks may not exist yet; skip silently.
  }
}

export function observeInitialLongTasks(route: string, windowMs = 15000) {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return () => undefined;
  }

  let stopped = false;
  const observer = new PerformanceObserver((list) => {
    if (stopped) return;
    list.getEntries().forEach((entry) => {
      if (entry.entryType !== 'longtask') return;
      if (shouldConsoleLog()) {
        console.info(
          `[route-profiler] ${route} :: long-task duration=${Math.round(entry.duration)}ms start=${Math.round(entry.startTime)}ms`
        );
      }
    });
  });

  try {
    observer.observe({ type: 'longtask', buffered: true });
  } catch {
    return () => undefined;
  }

  const timeoutId = window.setTimeout(() => {
    stopped = true;
    observer.disconnect();
  }, windowMs);

  return () => {
    stopped = true;
    window.clearTimeout(timeoutId);
    observer.disconnect();
  };
}
