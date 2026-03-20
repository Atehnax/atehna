import 'server-only';

type TriggerType = 'page_render' | 'api_call' | 'save_revalidation' | 'search' | 'other';

type DiagnosticsBucketGranularityMinutes = 1 | 5 | 15 | 60;

type LoaderMetricBucket = {
  bucketStart: string;
  loader: string;
  context: string;
  trigger: TriggerType;
  calls: number;
  cacheMisses: number;
  errorCount: number;
  totalDurationMs: number;
  totalPayloadBytes: number;
  lastSeenAt: string;
  durationsMs: number[];
};

type InvalidationBucket = {
  bucketStart: string;
  context: string;
  trigger: TriggerType;
  tagFamily: string;
  invalidations: number;
  revalidatedPaths: number;
  lastSeenAt: string;
};

type DiagnosticsStore = {
  startedAt: string;
  buckets: Map<string, LoaderMetricBucket>;
  invalidations: Map<string, InvalidationBucket>;
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

type RecordInvalidationInput = {
  context: string;
  tags: string[];
  revalidatedPaths?: number;
  recordedAt?: Date;
};

type AggregatedLoaderStats = {
  loader: string;
  context: string;
  trigger: TriggerType;
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
  trigger: TriggerType;
  calls: number;
  cacheHits: number;
  cacheMisses: number;
  avgDurationMs: number;
  totalPayloadBytes: number;
  lastSeenAt: string;
  hottestLoader: string;
};

type TriggerSummary = {
  trigger: TriggerType;
  calls: number;
  cacheMisses: number;
  totalPayloadBytes: number;
};

type TimeSeriesPoint = {
  bucketStart: string;
  bucketMinutes: DiagnosticsBucketGranularityMinutes;
  calls: number;
  cacheMisses: number;
  totalPayloadBytes: number;
  avgDurationMs: number;
};

type InvalidationSummary = {
  context: string;
  trigger: TriggerType;
  tagFamily: string;
  invalidations: number;
  revalidatedPaths: number;
  lastSeenAt: string;
};

type RouteBudgetWarning = {
  severity: 'info' | 'warning';
  context: string;
  message: string;
};

type DiagnosticsSnapshot = {
  generatedAt: string;
  metricsStartedAt: string;
  windowHours: number;
  bucketMinutes: DiagnosticsBucketGranularityMinutes;
  summary: {
    totalLoaderCalls: number;
    totalCacheMisses: number;
    inferredCacheHits: number;
    avgLoaderDurationMs: number;
    cacheHitRate: number | null;
    totalPayloadBytes: number;
    totalErrorCount: number;
    uniqueLoaders: number;
    activeContexts: number;
    invalidationCount: number;
  };
  triggers: TriggerSummary[];
  loaders: AggregatedLoaderStats[];
  routes: AggregatedRouteStats[];
  series: TimeSeriesPoint[];
  slowestLoaders: AggregatedLoaderStats[];
  heaviestLoaders: AggregatedLoaderStats[];
  invalidations: InvalidationSummary[];
  warnings: RouteBudgetWarning[];
};

declare global {
  // eslint-disable-next-line no-var
  var __catalogDiagnosticsStore: DiagnosticsStore | undefined;
}

const MAX_BUCKETS = 2400;
const MAX_INVALIDATION_BUCKETS = 720;
const MAX_SAMPLES_PER_BUCKET = 256;
const DEFAULT_WINDOW_HOURS = 24;
const DEFAULT_WINDOW_MINUTES = DEFAULT_WINDOW_HOURS * 60;

function getStore(): DiagnosticsStore {
  if (!globalThis.__catalogDiagnosticsStore) {
    globalThis.__catalogDiagnosticsStore = {
      startedAt: new Date().toISOString(),
      buckets: new Map(),
      invalidations: new Map()
    };
  }

  return globalThis.__catalogDiagnosticsStore;
}

function getBucketGranularityMinutes(windowMinutes: number): DiagnosticsBucketGranularityMinutes {
  if (windowMinutes <= 5) return 1;
  if (windowMinutes <= 60) return 5;
  if (windowMinutes <= 6 * 60) return 15;
  return 60;
}

function floorToBucket(date: Date, bucketMinutes: DiagnosticsBucketGranularityMinutes): Date {
  const bucket = new Date(date);
  const utcMinutes = bucket.getUTCMinutes();
  bucket.setUTCMinutes(Math.floor(utcMinutes / bucketMinutes) * bucketMinutes, 0, 0);
  return bucket;
}

function addBucketMinutes(date: Date, bucketMinutes: DiagnosticsBucketGranularityMinutes, count: number): Date {
  return new Date(date.getTime() + count * bucketMinutes * 60 * 1000);
}

function bucketKey(loader: string, context: string, bucketStart: string): string {
  return `${bucketStart}::${loader}::${context}`;
}

function invalidationKey(context: string, tagFamily: string, bucketStart: string): string {
  return `${bucketStart}::${context}::${tagFamily}`;
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

function inferTrigger(context: string, loader = ''): TriggerType {
  const normalized = `${context} ${loader}`.toLowerCase();

  if (normalized.includes('search')) return 'search';
  if (normalized.includes('save') || normalized.includes('revalid') || normalized.includes('invalidate')) return 'save_revalidation';
  if (context.startsWith('/api/')) return 'api_call';
  if (context.startsWith('/')) return 'page_render';
  return 'other';
}

function pruneStore(now: Date) {
  const cutoff = now.getTime() - DEFAULT_WINDOW_MINUTES * 60 * 1000;
  const store = getStore();

  for (const [key, bucket] of store.buckets.entries()) {
    if (new Date(bucket.bucketStart).getTime() < cutoff) {
      store.buckets.delete(key);
    }
  }

  for (const [key, bucket] of store.invalidations.entries()) {
    if (new Date(bucket.bucketStart).getTime() < cutoff) {
      store.invalidations.delete(key);
    }
  }

  if (store.buckets.size > MAX_BUCKETS) {
    const ordered = [...store.buckets.entries()].sort((left, right) =>
      new Date(left[1].bucketStart).getTime() - new Date(right[1].bucketStart).getTime()
    );

    for (const [key] of ordered.slice(0, Math.max(0, ordered.length - MAX_BUCKETS))) {
      store.buckets.delete(key);
    }
  }

  if (store.invalidations.size > MAX_INVALIDATION_BUCKETS) {
    const ordered = [...store.invalidations.entries()].sort((left, right) =>
      new Date(left[1].bucketStart).getTime() - new Date(right[1].bucketStart).getTime()
    );

    for (const [key] of ordered.slice(0, Math.max(0, ordered.length - MAX_INVALIDATION_BUCKETS))) {
      store.invalidations.delete(key);
    }
  }
}

export function recordCatalogLoaderMetric(input: RecordLoaderMetricInput) {
  const recordedAt = input.recordedAt ?? new Date();
  const bucketStart = floorToBucket(recordedAt, 1).toISOString();
  const key = bucketKey(input.loader, input.context, bucketStart);
  const trigger = inferTrigger(input.context, input.loader);
  const store = getStore();
  const existing = store.buckets.get(key) ?? {
    bucketStart,
    loader: input.loader,
    context: input.context,
    trigger,
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
  existing.trigger = trigger;
  pushDurationSample(existing.durationsMs, clampNonNegative(input.durationMs));

  store.buckets.set(key, existing);
  pruneStore(recordedAt);
}

export function recordCatalogInvalidation(input: RecordInvalidationInput) {
  const recordedAt = input.recordedAt ?? new Date();
  const bucketStart = floorToBucket(recordedAt, 1).toISOString();
  const tagFamily = [...new Set(input.tags)].sort().join(' + ');
  const key = invalidationKey(input.context, tagFamily, bucketStart);
  const trigger = inferTrigger(input.context, 'save revalidation');
  const store = getStore();
  const existing = store.invalidations.get(key) ?? {
    bucketStart,
    context: input.context,
    trigger,
    tagFamily,
    invalidations: 0,
    revalidatedPaths: 0,
    lastSeenAt: recordedAt.toISOString()
  } satisfies InvalidationBucket;

  existing.invalidations += 1;
  existing.revalidatedPaths += clampNonNegative(input.revalidatedPaths ?? 0);
  existing.lastSeenAt = recordedAt.toISOString();
  existing.trigger = trigger;

  store.invalidations.set(key, existing);
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

export async function instrumentCatalogLoader<T>(loader: string, context: string, run: () => Promise<T>): Promise<T> {
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

function buildWarnings(loaders: AggregatedLoaderStats[]): RouteBudgetWarning[] {
  const warnings: RouteBudgetWarning[] = [];
  const broadLoaders = new Set(['loadFullCatalogServer', 'getCatalogCategoriesServer', 'getCatalogDataFromDatabase']);

  for (const loader of loaders) {
    if ((loader.context === '/products' || loader.context === '/') && broadLoaders.has(loader.loader)) {
      warnings.push({
        severity: 'warning',
        context: loader.context,
        message: 'Javni katalog uporablja široki full-catalog loader, kjer bi moral ostati na ožjih loaderjih.'
      });
    }

    if ((loader.context === '/admin/artikli' || loader.context === '/api/admin/catalog-items') && broadLoaders.has(loader.loader)) {
      warnings.push({
        severity: 'warning',
        context: loader.context,
        message: 'Admin side-data pot uporablja široki full-catalog loader namesto ožjega items-index loaderja.'
      });
    }
  }

  if (!warnings.some((warning) => warning.context === '/admin/kategorije')) {
    warnings.push({
      severity: 'info',
      context: '/admin/kategorije',
      message: 'Začetni admin tree load lahko upravičeno uporabi široki full-catalog payload.'
    });
  }

  return warnings.slice(0, 6);
}

export function getCatalogDiagnosticsSnapshot(windowHours = DEFAULT_WINDOW_HOURS): DiagnosticsSnapshot {
  const now = new Date();
  const store = getStore();
  pruneStore(now);
  const windowMinutes = Math.max(5, Math.round(windowHours * 60));
  const bucketMinutes = getBucketGranularityMinutes(windowMinutes);
  const cutoff = now.getTime() - windowMinutes * 60 * 1000;
  const relevantBuckets = [...store.buckets.values()].filter((bucket) => new Date(bucket.bucketStart).getTime() >= cutoff);
  const relevantInvalidations = [...store.invalidations.values()].filter((bucket) => new Date(bucket.bucketStart).getTime() >= cutoff);

  const byLoader = new Map<string, AggregatedLoaderStats & { durationsMs: number[]; durationTotalMs: number }>();
  const byRoute = new Map<string, AggregatedRouteStats & { durationTotalMs: number; loaderCalls: Map<string, number> }>();
  const byTrigger = new Map<TriggerType, TriggerSummary>();
  const bySeries = new Map<string, TimeSeriesPoint & { durationTotalMs: number }>();

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
      trigger: bucket.trigger,
      calls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errorCount: 0,
      avgDurationMs: 0,
      p95DurationMs: 0,
      totalPayloadBytes: 0,
      lastSeenAt: bucket.lastSeenAt,
      durationsMs: [],
      durationTotalMs: 0
    };

    loaderEntry.calls += bucket.calls;
    loaderEntry.cacheMisses += bucket.cacheMisses;
    loaderEntry.errorCount += bucket.errorCount;
    loaderEntry.totalPayloadBytes += bucket.totalPayloadBytes;
    loaderEntry.durationTotalMs += bucket.totalDurationMs;
    loaderEntry.lastSeenAt = loaderEntry.lastSeenAt > bucket.lastSeenAt ? loaderEntry.lastSeenAt : bucket.lastSeenAt;
    loaderEntry.durationsMs.push(...bucket.durationsMs);
    loaderEntry.trigger = bucket.trigger;
    byLoader.set(loaderKey, loaderEntry);

    const routeEntry = byRoute.get(bucket.context) ?? {
      context: bucket.context,
      trigger: bucket.trigger,
      calls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgDurationMs: 0,
      totalPayloadBytes: 0,
      lastSeenAt: bucket.lastSeenAt,
      hottestLoader: '-',
      durationTotalMs: 0,
      loaderCalls: new Map<string, number>()
    };

    routeEntry.calls += bucket.calls;
    routeEntry.cacheMisses += bucket.cacheMisses;
    routeEntry.totalPayloadBytes += bucket.totalPayloadBytes;
    routeEntry.durationTotalMs += bucket.totalDurationMs;
    routeEntry.lastSeenAt = routeEntry.lastSeenAt > bucket.lastSeenAt ? routeEntry.lastSeenAt : bucket.lastSeenAt;
    routeEntry.trigger = bucket.trigger;
    routeEntry.loaderCalls.set(bucket.loader, (routeEntry.loaderCalls.get(bucket.loader) ?? 0) + bucket.calls);
    byRoute.set(bucket.context, routeEntry);

    const triggerEntry = byTrigger.get(bucket.trigger) ?? {
      trigger: bucket.trigger,
      calls: 0,
      cacheMisses: 0,
      totalPayloadBytes: 0
    };
    triggerEntry.calls += bucket.calls;
    triggerEntry.cacheMisses += bucket.cacheMisses;
    triggerEntry.totalPayloadBytes += bucket.totalPayloadBytes;
    byTrigger.set(bucket.trigger, triggerEntry);

    const bucketDate = new Date(bucket.bucketStart);
    const seriesBucketStart = floorToBucket(bucketDate, bucketMinutes).toISOString();
    const seriesEntry = bySeries.get(seriesBucketStart) ?? {
      bucketStart: seriesBucketStart,
      bucketMinutes,
      calls: 0,
      cacheMisses: 0,
      totalPayloadBytes: 0,
      avgDurationMs: 0,
      durationTotalMs: 0
    };
    seriesEntry.calls += bucket.calls;
    seriesEntry.cacheMisses += bucket.cacheMisses;
    seriesEntry.totalPayloadBytes += bucket.totalPayloadBytes;
    seriesEntry.durationTotalMs += bucket.totalDurationMs;
    bySeries.set(seriesBucketStart, seriesEntry);
  }

  const loaders = [...byLoader.values()]
    .map((entry) => {
      const avgDurationMs = entry.calls > 0 ? entry.durationTotalMs / entry.calls : 0;
      const cacheHits = Math.max(0, entry.calls - entry.cacheMisses);
      return {
        loader: entry.loader,
        context: entry.context,
        trigger: entry.trigger,
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
      const cacheHits = Math.max(0, entry.calls - entry.cacheMisses);
      return {
        context: entry.context,
        trigger: entry.trigger,
        calls: entry.calls,
        cacheHits,
        cacheMisses: entry.cacheMisses,
        avgDurationMs: entry.calls > 0 ? entry.durationTotalMs / entry.calls : 0,
        totalPayloadBytes: entry.totalPayloadBytes,
        lastSeenAt: entry.lastSeenAt,
        hottestLoader
      } satisfies AggregatedRouteStats;
    })
    .sort((left, right) => right.calls - left.calls || right.avgDurationMs - left.avgDurationMs);

  const lastSeriesBucket = floorToBucket(now, bucketMinutes);
  const bucketCount = Math.max(1, Math.floor(windowMinutes / bucketMinutes) + 1);
  const firstSeriesBucket = addBucketMinutes(lastSeriesBucket, bucketMinutes, -(bucketCount - 1));
  const series = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = addBucketMinutes(firstSeriesBucket, bucketMinutes, index).toISOString();
    const entry = bySeries.get(bucketStart);

    return {
      bucketStart,
      bucketMinutes,
      calls: entry?.calls ?? 0,
      cacheMisses: entry?.cacheMisses ?? 0,
      totalPayloadBytes: entry?.totalPayloadBytes ?? 0,
      avgDurationMs: entry && entry.calls > 0 ? entry.durationTotalMs / entry.calls : 0
    };
  });

  const invalidations = relevantInvalidations
    .map((entry) => ({
      context: entry.context,
      trigger: entry.trigger,
      tagFamily: entry.tagFamily,
      invalidations: entry.invalidations,
      revalidatedPaths: entry.revalidatedPaths,
      lastSeenAt: entry.lastSeenAt
    } satisfies InvalidationSummary))
    .sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt));

  const inferredCacheHits = Math.max(0, totalLoaderCalls - totalCacheMisses);

  return {
    generatedAt: now.toISOString(),
    metricsStartedAt: store.startedAt,
    windowHours,
    bucketMinutes,
    summary: {
      totalLoaderCalls,
      totalCacheMisses,
      inferredCacheHits,
      avgLoaderDurationMs: totalLoaderCalls > 0 ? totalDurationMs / totalLoaderCalls : 0,
      cacheHitRate: totalLoaderCalls > 0 ? inferredCacheHits / totalLoaderCalls : null,
      totalPayloadBytes,
      totalErrorCount,
      uniqueLoaders: new Set(loaders.map((entry) => entry.loader)).size,
      activeContexts: routes.length,
      invalidationCount: invalidations.reduce((sum, entry) => sum + entry.invalidations, 0)
    },
    triggers: [...byTrigger.values()].sort((left, right) => right.calls - left.calls),
    loaders,
    routes,
    series,
    slowestLoaders: [...loaders].sort((left, right) => right.p95DurationMs - left.p95DurationMs).slice(0, 10),
    heaviestLoaders: [...loaders].sort((left, right) => right.totalPayloadBytes - left.totalPayloadBytes).slice(0, 10),
    invalidations: invalidations.slice(0, 10),
    warnings: buildWarnings(loaders)
  };
}
