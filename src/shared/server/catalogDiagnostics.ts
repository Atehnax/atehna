import 'server-only';

type LoaderMetricBucket = {
  bucketStart: string;
  loader: string;
  context: string;
  calls: number;
  cacheMisses: number;
  errorCount: number;
  totalDurationMs: number;
  totalPayloadBytes: number;
  lastSeenAt: string;
  durationsMs: number[];
};

type DiagnosticsStore = {
  buckets: Map<string, LoaderMetricBucket>;
};

type RecordLoaderMetricInput = {
  loader: string;
  context: string;
  durationMs: number;
  payloadBytes?: number;
  cacheMiss?: boolean;
  error?: boolean;
  recordedAt?: Date;
};

type AggregatedLoaderStats = {
  loader: string;
  context: string;
  calls: number;
  cacheHits: number;
  cacheMisses: number;
  errorCount: number;
  avgDurationMs: number;
  p95DurationMs: number;
  totalPayloadBytes: number;
  lastSeenAt: string;
};

type AggregatedRouteStats = {
  context: string;
  calls: number;
  avgDurationMs: number;
  totalPayloadBytes: number;
  lastSeenAt: string;
  hottestLoader: string;
};

type DiagnosticsSnapshot = {
  generatedAt: string;
  windowHours: number;
  summary: {
    totalLoaderCalls: number;
    avgLoaderDurationMs: number;
    cacheHitRate: number | null;
    totalPayloadBytes: number;
    totalErrorCount: number;
    uniqueLoaders: number;
    activeContexts: number;
  };
  loaders: AggregatedLoaderStats[];
  routes: AggregatedRouteStats[];
};

declare global {
  // eslint-disable-next-line no-var
  var __catalogDiagnosticsStore: DiagnosticsStore | undefined;
}

const MAX_BUCKETS = 600;
const MAX_SAMPLES_PER_BUCKET = 256;
const DEFAULT_WINDOW_HOURS = 24;

function getStore(): DiagnosticsStore {
  if (!globalThis.__catalogDiagnosticsStore) {
    globalThis.__catalogDiagnosticsStore = { buckets: new Map() };
  }

  return globalThis.__catalogDiagnosticsStore;
}

function floorToHour(date: Date): Date {
  const bucket = new Date(date);
  bucket.setUTCMinutes(0, 0, 0);
  return bucket;
}

function bucketKey(loader: string, context: string, bucketStart: string): string {
  return `${bucketStart}::${loader}::${context}`;
}

function clampNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function pushDurationSample(samples: number[], durationMs: number) {
  if (samples.length < MAX_SAMPLES_PER_BUCKET) {
    samples.push(durationMs);
    return;
  }

  const replaceIndex = Math.floor(Math.random() * MAX_SAMPLES_PER_BUCKET);
  samples[replaceIndex] = durationMs;
}

function pruneStore(now: Date) {
  const cutoff = now.getTime() - DEFAULT_WINDOW_HOURS * 60 * 60 * 1000;
  const store = getStore();

  for (const [key, bucket] of store.buckets.entries()) {
    if (new Date(bucket.bucketStart).getTime() < cutoff) {
      store.buckets.delete(key);
    }
  }

  if (store.buckets.size <= MAX_BUCKETS) return;

  const ordered = [...store.buckets.entries()].sort((left, right) =>
    new Date(left[1].bucketStart).getTime() - new Date(right[1].bucketStart).getTime()
  );

  for (const [key] of ordered.slice(0, Math.max(0, ordered.length - MAX_BUCKETS))) {
    store.buckets.delete(key);
  }
}

export function recordCatalogLoaderMetric(input: RecordLoaderMetricInput) {
  const recordedAt = input.recordedAt ?? new Date();
  const bucketStart = floorToHour(recordedAt).toISOString();
  const key = bucketKey(input.loader, input.context, bucketStart);
  const store = getStore();
  const existing = store.buckets.get(key) ?? {
    bucketStart,
    loader: input.loader,
    context: input.context,
    calls: 0,
    cacheMisses: 0,
    errorCount: 0,
    totalDurationMs: 0,
    totalPayloadBytes: 0,
    lastSeenAt: recordedAt.toISOString(),
    durationsMs: []
  } satisfies LoaderMetricBucket;

  existing.calls += 1;
  existing.cacheMisses += input.cacheMiss ? 1 : 0;
  existing.errorCount += input.error ? 1 : 0;
  existing.totalDurationMs += clampNonNegative(input.durationMs);
  existing.totalPayloadBytes += clampNonNegative(input.payloadBytes ?? 0);
  existing.lastSeenAt = recordedAt.toISOString();
  pushDurationSample(existing.durationsMs, clampNonNegative(input.durationMs));

  store.buckets.set(key, existing);
  pruneStore(recordedAt);
}

function estimatePayloadBytes(payload: unknown): number {
  if (payload == null) return 0;

  try {
    return Buffer.byteLength(JSON.stringify(payload), 'utf8');
  } catch {
    return 0;
  }
}

export async function instrumentCatalogLoader<T>(
  loader: string,
  context: string,
  run: () => Promise<T>
): Promise<T> {
  const startedAt = performance.now();

  try {
    const payload = await run();
    recordCatalogLoaderMetric({
      loader,
      context,
      durationMs: performance.now() - startedAt,
      payloadBytes: estimatePayloadBytes(payload)
    });
    return payload;
  } catch (error) {
    recordCatalogLoaderMetric({
      loader,
      context,
      durationMs: performance.now() - startedAt,
      error: true
    });
    throw error;
  }
}

export async function instrumentCatalogCacheMiss<T>(loader: string, context: string, run: () => Promise<T>): Promise<T> {
  const startedAt = performance.now();

  try {
    const payload = await run();
    recordCatalogLoaderMetric({
      loader,
      context,
      durationMs: performance.now() - startedAt,
      payloadBytes: estimatePayloadBytes(payload),
      cacheMiss: true
    });
    return payload;
  } catch (error) {
    recordCatalogLoaderMetric({
      loader,
      context,
      durationMs: performance.now() - startedAt,
      cacheMiss: true,
      error: true
    });
    throw error;
  }
}

function percentile95(samples: number[]): number {
  if (samples.length === 0) return 0;
  const ordered = [...samples].sort((left, right) => left - right);
  const index = Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * 0.95) - 1));
  return ordered[index] ?? 0;
}

export function getCatalogDiagnosticsSnapshot(windowHours = DEFAULT_WINDOW_HOURS): DiagnosticsSnapshot {
  const now = new Date();
  pruneStore(now);
  const cutoff = now.getTime() - windowHours * 60 * 60 * 1000;
  const relevantBuckets = [...getStore().buckets.values()].filter((bucket) => new Date(bucket.bucketStart).getTime() >= cutoff);

  const byLoader = new Map<string, AggregatedLoaderStats & { durationsMs: number[] }>();
  const byRoute = new Map<string, AggregatedRouteStats & { loaderCalls: Map<string, number> }>();

  let totalLoaderCalls = 0;
  let totalDurationMs = 0;
  let totalCacheMisses = 0;
  let totalPayloadBytes = 0;
  let totalErrorCount = 0;

  for (const bucket of relevantBuckets) {
    totalLoaderCalls += bucket.calls;
    totalDurationMs += bucket.totalDurationMs;
    totalCacheMisses += bucket.cacheMisses;
    totalPayloadBytes += bucket.totalPayloadBytes;
    totalErrorCount += bucket.errorCount;

    const loaderKey = `${bucket.loader}::${bucket.context}`;
    const loaderEntry = byLoader.get(loaderKey) ?? {
      loader: bucket.loader,
      context: bucket.context,
      calls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errorCount: 0,
      avgDurationMs: 0,
      p95DurationMs: 0,
      totalPayloadBytes: 0,
      lastSeenAt: bucket.lastSeenAt,
      durationsMs: []
    };

    loaderEntry.calls += bucket.calls;
    loaderEntry.cacheMisses += bucket.cacheMisses;
    loaderEntry.errorCount += bucket.errorCount;
    loaderEntry.totalPayloadBytes += bucket.totalPayloadBytes;
    loaderEntry.avgDurationMs += bucket.totalDurationMs;
    loaderEntry.lastSeenAt = loaderEntry.lastSeenAt > bucket.lastSeenAt ? loaderEntry.lastSeenAt : bucket.lastSeenAt;
    loaderEntry.durationsMs.push(...bucket.durationsMs);
    byLoader.set(loaderKey, loaderEntry);

    const routeEntry = byRoute.get(bucket.context) ?? {
      context: bucket.context,
      calls: 0,
      avgDurationMs: 0,
      totalPayloadBytes: 0,
      lastSeenAt: bucket.lastSeenAt,
      hottestLoader: '-',
      loaderCalls: new Map<string, number>()
    };

    routeEntry.calls += bucket.calls;
    routeEntry.avgDurationMs += bucket.totalDurationMs;
    routeEntry.totalPayloadBytes += bucket.totalPayloadBytes;
    routeEntry.lastSeenAt = routeEntry.lastSeenAt > bucket.lastSeenAt ? routeEntry.lastSeenAt : bucket.lastSeenAt;
    routeEntry.loaderCalls.set(bucket.loader, (routeEntry.loaderCalls.get(bucket.loader) ?? 0) + bucket.calls);
    byRoute.set(bucket.context, routeEntry);
  }

  const loaders = [...byLoader.values()]
    .map((entry) => {
      const avgDurationMs = entry.calls > 0 ? entry.avgDurationMs / entry.calls : 0;
      const cacheHits = Math.max(0, entry.calls - entry.cacheMisses);
      return {
        loader: entry.loader,
        context: entry.context,
        calls: entry.calls,
        cacheHits,
        cacheMisses: entry.cacheMisses,
        errorCount: entry.errorCount,
        avgDurationMs,
        p95DurationMs: percentile95(entry.durationsMs),
        totalPayloadBytes: entry.totalPayloadBytes,
        lastSeenAt: entry.lastSeenAt
      } satisfies AggregatedLoaderStats;
    })
    .sort((left, right) => right.calls - left.calls || right.avgDurationMs - left.avgDurationMs);

  const routes = [...byRoute.values()]
    .map((entry) => {
      const hottestLoader = [...entry.loaderCalls.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? '-';
      return {
        context: entry.context,
        calls: entry.calls,
        avgDurationMs: entry.calls > 0 ? entry.avgDurationMs / entry.calls : 0,
        totalPayloadBytes: entry.totalPayloadBytes,
        lastSeenAt: entry.lastSeenAt,
        hottestLoader
      } satisfies AggregatedRouteStats;
    })
    .sort((left, right) => right.calls - left.calls || right.avgDurationMs - left.avgDurationMs);

  return {
    generatedAt: now.toISOString(),
    windowHours,
    summary: {
      totalLoaderCalls,
      avgLoaderDurationMs: totalLoaderCalls > 0 ? totalDurationMs / totalLoaderCalls : 0,
      cacheHitRate: totalLoaderCalls > 0 ? Math.max(0, (totalLoaderCalls - totalCacheMisses) / totalLoaderCalls) : null,
      totalPayloadBytes,
      totalErrorCount,
      uniqueLoaders: new Set(loaders.map((entry) => entry.loader)).size,
      activeContexts: routes.length
    },
    loaders,
    routes
  };
}
