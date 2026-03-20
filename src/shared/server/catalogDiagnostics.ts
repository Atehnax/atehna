import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import { appendFileSync, closeSync, existsSync, openSync, readSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type TriggerType = 'page_render' | 'api_call' | 'save_revalidation' | 'search' | 'other';
type DiagnosticsBucketGranularityMinutes = 1 | 5 | 15 | 60;
type RoutePhaseKind = 'route' | 'diagnostics' | 'db' | 'cache' | 'transform' | 'payload' | 'helper';

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

type RouteProfileBucket = {
  bucketStart: string;
  context: string;
  trigger: TriggerType;
  calls: number;
  totalServerMs: number;
  totalRouteMs: number;
  totalDiagnosticsMs: number;
  totalDbMs: number;
  totalCacheMs: number;
  totalTransformMs: number;
  totalPayloadMs: number;
  totalPayloadBytes: number;
  duplicateCalls: number;
  largestPayloadBytes: number;
  largestPayloadProducer: string;
  topOpportunity: string;
  lastSeenAt: string;
  repeatedHelpers: string[];
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

type RouteProfilerStore = {
  context: string;
  startedAtMs: number;
  phaseTotals: Record<RoutePhaseKind, number>;
  helperCalls: Map<string, number>;
  largestPayloadBytes: number;
  largestPayloadProducer: string;
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

type RouteProfileSummary = {
  context: string;
  trigger: TriggerType;
  calls: number;
  avgTotalServerMs: number;
  avgRouteRenderMs: number;
  avgDiagnosticsMs: number;
  avgDbMs: number;
  avgCacheMs: number;
  avgTransformMs: number;
  avgPayloadConstructionMs: number;
  avgPayloadBytes: number;
  duplicateCalls: number;
  repeatedHelpers: string[];
  largestPayloadBytes: number;
  largestPayloadProducer: string;
  topOpportunity: string;
  lastSeenAt: string;
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
  routeProfiles: RouteProfileSummary[];
  series: TimeSeriesPoint[];
  slowestLoaders: AggregatedLoaderStats[];
  heaviestLoaders: AggregatedLoaderStats[];
  invalidations: InvalidationSummary[];
  warnings: RouteBudgetWarning[];
};

type LoaderMetricEvent = {
  kind: 'loader';
  recordedAt: string;
  loader: string;
  context: string;
  trigger: TriggerType;
  durationMs: number;
  payloadBytes: number;
  cacheMiss: boolean;
  error: boolean;
};

type InvalidationEvent = {
  kind: 'invalidation';
  recordedAt: string;
  context: string;
  trigger: TriggerType;
  tagFamily: string;
  revalidatedPaths: number;
};

type RouteProfileEvent = {
  kind: 'route-profile';
  recordedAt: string;
  context: string;
  trigger: TriggerType;
  totalServerMs: number;
  routeRenderMs: number;
  diagnosticsMs: number;
  dbMs: number;
  cacheMs: number;
  transformMs: number;
  payloadConstructionMs: number;
  payloadBytes: number;
  duplicateCalls: number;
  repeatedHelpers: string[];
  largestPayloadBytes: number;
  largestPayloadProducer: string;
  topOpportunity: string;
};

type DiagnosticsEvent = LoaderMetricEvent | InvalidationEvent | RouteProfileEvent;

const routeProfilerStorage = new AsyncLocalStorage<RouteProfilerStore>();
const MAX_EVENTS = 4000;
const MAX_SAMPLES_PER_BUCKET = 256;
const MAX_LOG_BYTES = 256 * 1024;
const READ_TAIL_BYTES = 192 * 1024;
const DEFAULT_WINDOW_HOURS = 0.25;
const DEFAULT_WINDOW_MINUTES = 15;
const DIAGNOSTICS_LOG_PATH = join(tmpdir(), 'atehna-catalog-diagnostics.ndjson');

function normalizeDiagnosticsContext(context: string): string {
  const normalized = context.trim();
  if (!normalized) return 'unknown';
  if (!normalized.startsWith('/admin')) return normalized;
  if (normalized.startsWith('/admin/orders/')) return '/admin/orders/[orderId]';
  if (normalized.startsWith('/admin/kategorije/miller-view')) return '/admin/kategorije/miller-view';
  if (normalized.startsWith('/admin/kategorije/')) return '/admin/kategorije';
  if (normalized.startsWith('/admin/analitika/splet')) return '/admin/analitika/splet';
  if (normalized.startsWith('/admin/analitika/diagnostika')) return '/admin/analitika/diagnostika';
  if (normalized.startsWith('/admin/analitika/')) return '/admin/analitika';
  return normalized;
}

function getBucketGranularityMinutes(windowMinutes: number): DiagnosticsBucketGranularityMinutes {
  if (windowMinutes <= 5) return 1;
  if (windowMinutes <= 60) return 5;
  if (windowMinutes <= 6 * 60) return 15;
  return 60;
}

function floorToBucket(date: Date, bucketMinutes: DiagnosticsBucketGranularityMinutes): Date {
  const bucket = new Date(date);
  bucket.setUTCMinutes(Math.floor(bucket.getUTCMinutes() / bucketMinutes) * bucketMinutes, 0, 0);
  return bucket;
}

function addBucketMinutes(date: Date, bucketMinutes: DiagnosticsBucketGranularityMinutes, count: number): Date {
  return new Date(date.getTime() + count * bucketMinutes * 60 * 1000);
}

function bucketKey(loader: string, context: string, bucketStart: string) {
  return `${bucketStart}::${loader}::${context}`;
}

function invalidationKey(context: string, tagFamily: string, bucketStart: string) {
  return `${bucketStart}::${context}::${tagFamily}`;
}

function routeProfileKey(context: string, bucketStart: string) {
  return `${bucketStart}::${context}`;
}

function clampNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function pushDurationSample(samples: number[], durationMs: number) {
  if (samples.length < MAX_SAMPLES_PER_BUCKET) {
    samples.push(durationMs);
    return;
  }
  samples[Math.floor(Math.random() * MAX_SAMPLES_PER_BUCKET)] = durationMs;
}

function inferTrigger(context: string, loader = ''): TriggerType {
  const normalized = `${context} ${loader}`.toLowerCase();
  if (normalized.includes('search')) return 'search';
  if (normalized.includes('save') || normalized.includes('revalid') || normalized.includes('invalidate')) return 'save_revalidation';
  if (context.startsWith('/api/')) return 'api_call';
  if (context.startsWith('/')) return 'page_render';
  return 'other';
}

function measureDiagnosticsOverhead<T>(run: () => T): T {
  const store = routeProfilerStorage.getStore();
  const startedAt = performance.now();
  try {
    return run();
  } finally {
    if (store) store.phaseTotals.diagnostics += performance.now() - startedAt;
  }
}

function appendDiagnosticsEvent(event: DiagnosticsEvent) {
  measureDiagnosticsOverhead(() => appendFileSync(DIAGNOSTICS_LOG_PATH, `${JSON.stringify(event)}\n`, 'utf8'));
  compactDiagnosticsLogIfNeeded();
}

function parseDiagnosticsEvent(rawLine: string): DiagnosticsEvent | null {
  try {
    const parsed = JSON.parse(rawLine) as Partial<DiagnosticsEvent>;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.kind !== 'string' || typeof parsed.recordedAt !== 'string') return null;
    return parsed as DiagnosticsEvent;
  } catch {
    return null;
  }
}

function readRecentLogTail() {
  const fileSize = statSync(DIAGNOSTICS_LOG_PATH).size;
  const start = Math.max(0, fileSize - READ_TAIL_BYTES);
  const fd = openSync(DIAGNOSTICS_LOG_PATH, 'r');
  try {
    const length = fileSize - start;
    const buffer = Buffer.alloc(length);
    readSync(fd, buffer, 0, length, start);
    const text = buffer.toString('utf8');
    return start > 0 ? text.slice(text.indexOf('\n') + 1) : text;
  } finally {
    closeSync(fd);
  }
}

function compactDiagnosticsLog(events: DiagnosticsEvent[]) {
  const nextBody = events.map((event) => JSON.stringify(event)).join('\n');
  const tempPath = `${DIAGNOSTICS_LOG_PATH}.tmp`;
  measureDiagnosticsOverhead(() => {
    writeFileSync(tempPath, nextBody.length > 0 ? `${nextBody}\n` : '', 'utf8');
    renameSync(tempPath, DIAGNOSTICS_LOG_PATH);
  });
}

function compactDiagnosticsLogIfNeeded() {
  if (!existsSync(DIAGNOSTICS_LOG_PATH)) return;
  const fileSize = statSync(DIAGNOSTICS_LOG_PATH).size;
  if (fileSize <= MAX_LOG_BYTES) return;
  const now = new Date();
  const { events } = readDiagnosticsEvents(now);
  compactDiagnosticsLog(events.slice(-MAX_EVENTS));
}

function readDiagnosticsEvents(now: Date): { events: DiagnosticsEvent[]; metricsStartedAt: string } {
  if (!existsSync(DIAGNOSTICS_LOG_PATH)) return { events: [], metricsStartedAt: now.toISOString() };

  const parsedEvents = measureDiagnosticsOverhead(() =>
    readRecentLogTail()
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => parseDiagnosticsEvent(line))
      .filter((event): event is DiagnosticsEvent => Boolean(event))
      .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt))
  );

  if (parsedEvents.length === 0) return { events: [], metricsStartedAt: now.toISOString() };

  const cutoff = now.getTime() - DEFAULT_WINDOW_MINUTES * 60 * 1000;
  const recentEvents = parsedEvents.filter((event) => new Date(event.recordedAt).getTime() >= cutoff).slice(-MAX_EVENTS);
  if (recentEvents.length !== parsedEvents.length || statSync(DIAGNOSTICS_LOG_PATH).size > MAX_LOG_BYTES) {
    compactDiagnosticsLog(recentEvents);
  }

  return { events: recentEvents, metricsStartedAt: recentEvents[0]?.recordedAt ?? now.toISOString() };
}

function buildDiagnosticsBuckets(now: Date) {
  const { events, metricsStartedAt } = readDiagnosticsEvents(now);
  const loaderBuckets = new Map<string, LoaderMetricBucket>();
  const invalidationBuckets = new Map<string, InvalidationBucket>();
  const routeProfileBuckets = new Map<string, RouteProfileBucket>();

  for (const event of events) {
    const bucketStart = floorToBucket(new Date(event.recordedAt), 1).toISOString();

    if (event.kind === 'loader') {
      const key = bucketKey(event.loader, event.context, bucketStart);
      const existing = loaderBuckets.get(key) ?? {
        bucketStart,
        loader: event.loader,
        context: event.context,
        trigger: event.trigger,
        calls: 0,
        cacheMisses: 0,
        errorCount: 0,
        totalDurationMs: 0,
        totalPayloadBytes: 0,
        lastSeenAt: event.recordedAt,
        durationsMs: []
      } satisfies LoaderMetricBucket;
      existing.calls += 1;
      existing.cacheMisses += event.cacheMiss ? 1 : 0;
      existing.errorCount += event.error ? 1 : 0;
      existing.totalDurationMs += clampNonNegative(event.durationMs);
      existing.totalPayloadBytes += clampNonNegative(event.payloadBytes);
      existing.lastSeenAt = existing.lastSeenAt > event.recordedAt ? existing.lastSeenAt : event.recordedAt;
      existing.trigger = event.trigger;
      pushDurationSample(existing.durationsMs, clampNonNegative(event.durationMs));
      loaderBuckets.set(key, existing);
      continue;
    }

    if (event.kind === 'route-profile') {
      const key = routeProfileKey(event.context, bucketStart);
      const existing = routeProfileBuckets.get(key) ?? {
        bucketStart,
        context: event.context,
        trigger: event.trigger,
        calls: 0,
        totalServerMs: 0,
        totalRouteMs: 0,
        totalDiagnosticsMs: 0,
        totalDbMs: 0,
        totalCacheMs: 0,
        totalTransformMs: 0,
        totalPayloadMs: 0,
        totalPayloadBytes: 0,
        duplicateCalls: 0,
        largestPayloadBytes: 0,
        largestPayloadProducer: '-',
        topOpportunity: '-',
        lastSeenAt: event.recordedAt,
        repeatedHelpers: []
      } satisfies RouteProfileBucket;
      existing.calls += 1;
      existing.totalServerMs += clampNonNegative(event.totalServerMs);
      existing.totalRouteMs += clampNonNegative(event.routeRenderMs);
      existing.totalDiagnosticsMs += clampNonNegative(event.diagnosticsMs);
      existing.totalDbMs += clampNonNegative(event.dbMs);
      existing.totalCacheMs += clampNonNegative(event.cacheMs);
      existing.totalTransformMs += clampNonNegative(event.transformMs);
      existing.totalPayloadMs += clampNonNegative(event.payloadConstructionMs);
      existing.totalPayloadBytes += clampNonNegative(event.payloadBytes);
      existing.duplicateCalls += clampNonNegative(event.duplicateCalls);
      if (event.largestPayloadBytes >= existing.largestPayloadBytes) {
        existing.largestPayloadBytes = clampNonNegative(event.largestPayloadBytes);
        existing.largestPayloadProducer = event.largestPayloadProducer || '-';
      }
      existing.topOpportunity = event.topOpportunity || existing.topOpportunity;
      existing.lastSeenAt = existing.lastSeenAt > event.recordedAt ? existing.lastSeenAt : event.recordedAt;
      existing.trigger = event.trigger;
      if (event.repeatedHelpers.length > existing.repeatedHelpers.length) existing.repeatedHelpers = event.repeatedHelpers;
      routeProfileBuckets.set(key, existing);
      continue;
    }

    const key = invalidationKey(event.context, event.tagFamily, bucketStart);
    const existing = invalidationBuckets.get(key) ?? {
      bucketStart,
      context: event.context,
      trigger: event.trigger,
      tagFamily: event.tagFamily,
      invalidations: 0,
      revalidatedPaths: 0,
      lastSeenAt: event.recordedAt
    } satisfies InvalidationBucket;
    existing.invalidations += 1;
    existing.revalidatedPaths += clampNonNegative(event.revalidatedPaths);
    existing.lastSeenAt = existing.lastSeenAt > event.recordedAt ? existing.lastSeenAt : event.recordedAt;
    existing.trigger = event.trigger;
    invalidationBuckets.set(key, existing);
  }

  return {
    metricsStartedAt,
    buckets: [...loaderBuckets.values()],
    invalidations: [...invalidationBuckets.values()],
    routeProfiles: [...routeProfileBuckets.values()]
  };
}

export function profileRoutePhase<T>(kind: Exclude<RoutePhaseKind, 'diagnostics'>, name: string, run: () => Promise<T>): Promise<T> {
  const store = routeProfilerStorage.getStore();
  if (!store) return run();
  const startedAt = performance.now();
  return run().finally(() => {
    const durationMs = performance.now() - startedAt;
    store.phaseTotals[kind] += durationMs;
    if (kind === 'helper') store.helperCalls.set(name, (store.helperCalls.get(name) ?? 0) + 1);
  });
}

export function profilePayloadEstimate(producer: string, payload: unknown) {
  const payloadBytes = estimatePayloadBytes(payload);
  const store = routeProfilerStorage.getStore();
  if (store && payloadBytes >= store.largestPayloadBytes) {
    store.largestPayloadBytes = payloadBytes;
    store.largestPayloadProducer = producer;
  }
  return payloadBytes;
}

function recordRouteProfile(context: string, totalServerMs: number) {
  const store = routeProfilerStorage.getStore();
  if (!store) return;
  const repeatedHelpers = [...store.helperCalls.entries()]
    .filter(([, calls]) => calls > 1)
    .sort((left, right) => right[1] - left[1])
    .map(([name, calls]) => `${name}×${calls}`)
    .slice(0, 5);
  const duplicateCalls = repeatedHelpers.reduce((sum, entry) => {
    const calls = Number(entry.split('×')[1] ?? 1);
    return sum + Math.max(0, calls - 1);
  }, 0);
  const dbMs = store.phaseTotals.db;
  const diagnosticsMs = store.phaseTotals.diagnostics;
  const transformMs = store.phaseTotals.transform;
  const cacheMs = store.phaseTotals.cache;
  const payloadMs = store.phaseTotals.payload;
  const topOpportunity =
    store.largestPayloadBytes > 50_000
      ? `Reduce initial payload from ${store.largestPayloadProducer}`
      : dbMs > cacheMs && dbMs > transformMs
        ? 'Cut or parallelize DB work'
        : cacheMs > 20
          ? 'Reduce cache wrapper/read overhead'
          : transformMs > 20
            ? 'Trim server transforms/serialization'
            : diagnosticsMs > 5
              ? 'Diagnostics overhead still visible'
              : 'No dominant hotspot captured';

  appendDiagnosticsEvent({
    kind: 'route-profile',
    recordedAt: new Date().toISOString(),
    context,
    trigger: inferTrigger(context, 'adminRouteRender'),
    totalServerMs: clampNonNegative(totalServerMs),
    routeRenderMs: clampNonNegative(store.phaseTotals.route),
    diagnosticsMs: clampNonNegative(diagnosticsMs),
    dbMs: clampNonNegative(dbMs),
    cacheMs: clampNonNegative(cacheMs),
    transformMs: clampNonNegative(transformMs),
    payloadConstructionMs: clampNonNegative(payloadMs),
    payloadBytes: clampNonNegative(store.largestPayloadBytes),
    duplicateCalls,
    repeatedHelpers,
    largestPayloadBytes: clampNonNegative(store.largestPayloadBytes),
    largestPayloadProducer: store.largestPayloadProducer || '-',
    topOpportunity
  });
}

export function recordCatalogLoaderMetric(input: RecordLoaderMetricInput) {
  const recordedAt = input.recordedAt ?? new Date();
  const normalizedContext = normalizeDiagnosticsContext(input.context);
  const trigger = inferTrigger(normalizedContext, input.loader);
  appendDiagnosticsEvent({
    kind: 'loader',
    recordedAt: recordedAt.toISOString(),
    loader: input.loader,
    context: normalizedContext,
    trigger,
    durationMs: clampNonNegative(input.durationMs),
    payloadBytes: clampNonNegative(input.payloadBytes ?? 0),
    cacheMiss: Boolean(input.cacheMiss),
    error: Boolean(input.error)
  });
}

export function recordCatalogInvalidation(input: RecordInvalidationInput) {
  const recordedAt = input.recordedAt ?? new Date();
  const normalizedContext = normalizeDiagnosticsContext(input.context);
  appendDiagnosticsEvent({
    kind: 'invalidation',
    recordedAt: recordedAt.toISOString(),
    context: normalizedContext,
    trigger: inferTrigger(normalizedContext, 'save revalidation'),
    tagFamily: [...new Set(input.tags)].sort().join(' + '),
    revalidatedPaths: clampNonNegative(input.revalidatedPaths ?? 0)
  });
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
    const payload = await profileRoutePhase('helper', loader, run);
    recordCatalogLoaderMetric({
      loader,
      context,
      durationMs: performance.now() - startedAt,
      payloadBytes: profilePayloadEstimate(loader, payload)
    });
    return payload;
  } catch (error) {
    recordCatalogLoaderMetric({ loader, context, durationMs: performance.now() - startedAt, error: true });
    throw error;
  }
}

export async function instrumentAdminRouteRender<T>(context: string, run: () => Promise<T>): Promise<T> {
  const normalizedContext = normalizeDiagnosticsContext(context);
  const store: RouteProfilerStore = {
    context: normalizedContext,
    startedAtMs: performance.now(),
    phaseTotals: { route: 0, diagnostics: 0, db: 0, cache: 0, transform: 0, payload: 0, helper: 0 },
    helperCalls: new Map(),
    largestPayloadBytes: 0,
    largestPayloadProducer: '-'
  };

  return routeProfilerStorage.run(store, async () => {
    try {
      const result = await profileRoutePhase('route', 'adminRouteRender', run);
      const totalServerMs = performance.now() - store.startedAtMs;
      recordCatalogLoaderMetric({ loader: 'adminRouteRender', context: normalizedContext, durationMs: totalServerMs });
      recordRouteProfile(normalizedContext, totalServerMs);
      return result;
    } catch (error) {
      const totalServerMs = performance.now() - store.startedAtMs;
      recordCatalogLoaderMetric({ loader: 'adminRouteRender', context: normalizedContext, durationMs: totalServerMs, error: true });
      recordRouteProfile(normalizedContext, totalServerMs);
      throw error;
    }
  });
}

export async function instrumentCatalogCacheMiss<T>(loader: string, context: string, run: () => Promise<T>): Promise<T> {
  const startedAt = performance.now();
  try {
    const payload = await profileRoutePhase('cache', loader, run);
    recordCatalogLoaderMetric({
      loader,
      context,
      durationMs: performance.now() - startedAt,
      payloadBytes: profilePayloadEstimate(loader, payload),
      cacheMiss: true
    });
    return payload;
  } catch (error) {
    recordCatalogLoaderMetric({ loader, context, durationMs: performance.now() - startedAt, cacheMiss: true, error: true });
    throw error;
  }
}

function percentile95(samples: number[]) {
  if (samples.length === 0) return 0;
  const ordered = [...samples].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * 0.95) - 1))] ?? 0;
}

function buildWarnings(loaders: AggregatedLoaderStats[]): RouteBudgetWarning[] {
  const warnings: RouteBudgetWarning[] = [];
  const broadLoaders = new Set(['loadFullCatalogServer', 'getCatalogCategoriesServer', 'getCatalogDataFromDatabase']);
  for (const loader of loaders) {
    if ((loader.context === '/products' || loader.context === '/') && broadLoaders.has(loader.loader)) {
      warnings.push({ severity: 'warning', context: loader.context, message: 'Javni katalog uporablja široki full-catalog loader, kjer bi moral ostati na ožjih loaderjih.' });
    }
    if ((loader.context === '/admin/artikli' || loader.context === '/api/admin/catalog-items') && broadLoaders.has(loader.loader)) {
      warnings.push({ severity: 'warning', context: loader.context, message: 'Admin side-data pot uporablja široki full-catalog loader namesto ožjega items-index loaderja.' });
    }
  }
  if (!warnings.some((warning) => warning.context === '/admin/kategorije')) {
    warnings.push({ severity: 'info', context: '/admin/kategorije', message: 'Začetni admin tree load lahko upravičeno uporabi široki full-catalog payload.' });
  }
  return warnings.slice(0, 6);
}

export function getCatalogDiagnosticsSnapshot(windowHours = DEFAULT_WINDOW_HOURS): DiagnosticsSnapshot {
  const now = new Date();
  const persisted = buildDiagnosticsBuckets(now);
  const windowMinutes = Math.max(5, Math.round(windowHours * 60));
  const bucketMinutes = getBucketGranularityMinutes(windowMinutes);
  const cutoff = now.getTime() - windowMinutes * 60 * 1000;
  const relevantBuckets = persisted.buckets.filter((bucket) => new Date(bucket.bucketStart).getTime() >= cutoff);
  const relevantInvalidations = persisted.invalidations.filter((bucket) => new Date(bucket.bucketStart).getTime() >= cutoff);
  const relevantRouteProfiles = persisted.routeProfiles.filter((bucket) => new Date(bucket.bucketStart).getTime() >= cutoff);

  const byLoader = new Map<string, AggregatedLoaderStats & { durationsMs: number[]; durationTotalMs: number }>();
  const byRoute = new Map<string, AggregatedRouteStats & { durationTotalMs: number; loaderCalls: Map<string, number> }>();
  const byTrigger = new Map<TriggerType, TriggerSummary>();
  const bySeries = new Map<string, TimeSeriesPoint & { durationTotalMs: number }>();
  const byRouteProfile = new Map<string, RouteProfileBucket>();

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

    const triggerEntry = byTrigger.get(bucket.trigger) ?? { trigger: bucket.trigger, calls: 0, cacheMisses: 0, totalPayloadBytes: 0 };
    triggerEntry.calls += bucket.calls;
    triggerEntry.cacheMisses += bucket.cacheMisses;
    triggerEntry.totalPayloadBytes += bucket.totalPayloadBytes;
    byTrigger.set(bucket.trigger, triggerEntry);

    const seriesBucketStart = floorToBucket(new Date(bucket.bucketStart), bucketMinutes).toISOString();
    const seriesEntry = bySeries.get(seriesBucketStart) ?? { bucketStart: seriesBucketStart, bucketMinutes, calls: 0, cacheMisses: 0, totalPayloadBytes: 0, avgDurationMs: 0, durationTotalMs: 0 };
    seriesEntry.calls += bucket.calls;
    seriesEntry.cacheMisses += bucket.cacheMisses;
    seriesEntry.totalPayloadBytes += bucket.totalPayloadBytes;
    seriesEntry.durationTotalMs += bucket.totalDurationMs;
    bySeries.set(seriesBucketStart, seriesEntry);
  }

  for (const bucket of relevantRouteProfiles) {
    const existing = byRouteProfile.get(bucket.context) ?? { ...bucket };
    if (existing !== bucket) {
      existing.calls += bucket.calls;
      existing.totalServerMs += bucket.totalServerMs;
      existing.totalRouteMs += bucket.totalRouteMs;
      existing.totalDiagnosticsMs += bucket.totalDiagnosticsMs;
      existing.totalDbMs += bucket.totalDbMs;
      existing.totalCacheMs += bucket.totalCacheMs;
      existing.totalTransformMs += bucket.totalTransformMs;
      existing.totalPayloadMs += bucket.totalPayloadMs;
      existing.totalPayloadBytes += bucket.totalPayloadBytes;
      existing.duplicateCalls += bucket.duplicateCalls;
      if (bucket.largestPayloadBytes >= existing.largestPayloadBytes) {
        existing.largestPayloadBytes = bucket.largestPayloadBytes;
        existing.largestPayloadProducer = bucket.largestPayloadProducer;
      }
      existing.topOpportunity = bucket.topOpportunity || existing.topOpportunity;
      existing.lastSeenAt = existing.lastSeenAt > bucket.lastSeenAt ? existing.lastSeenAt : bucket.lastSeenAt;
      if (bucket.repeatedHelpers.length > existing.repeatedHelpers.length) existing.repeatedHelpers = bucket.repeatedHelpers;
    }
    byRouteProfile.set(bucket.context, existing);
  }

  const loaders = [...byLoader.values()].map((entry) => ({
    loader: entry.loader,
    context: entry.context,
    trigger: entry.trigger,
    calls: entry.calls,
    cacheHits: Math.max(0, entry.calls - entry.cacheMisses),
    cacheMisses: entry.cacheMisses,
    errorCount: entry.errorCount,
    avgDurationMs: entry.calls > 0 ? entry.durationTotalMs / entry.calls : 0,
    p95DurationMs: percentile95(entry.durationsMs),
    totalPayloadBytes: entry.totalPayloadBytes,
    lastSeenAt: entry.lastSeenAt
  } satisfies AggregatedLoaderStats)).sort((left, right) => right.calls - left.calls || right.avgDurationMs - left.avgDurationMs);

  const routes = [...byRoute.values()].map((entry) => ({
    context: entry.context,
    trigger: entry.trigger,
    calls: entry.calls,
    cacheHits: Math.max(0, entry.calls - entry.cacheMisses),
    cacheMisses: entry.cacheMisses,
    avgDurationMs: entry.calls > 0 ? entry.durationTotalMs / entry.calls : 0,
    totalPayloadBytes: entry.totalPayloadBytes,
    lastSeenAt: entry.lastSeenAt,
    hottestLoader: [...entry.loaderCalls.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? '-'
  } satisfies AggregatedRouteStats)).sort((left, right) => right.calls - left.calls || right.avgDurationMs - left.avgDurationMs);

  const routeProfiles = [...byRouteProfile.values()].map((entry) => ({
    context: entry.context,
    trigger: entry.trigger,
    calls: entry.calls,
    avgTotalServerMs: entry.calls > 0 ? entry.totalServerMs / entry.calls : 0,
    avgRouteRenderMs: entry.calls > 0 ? entry.totalRouteMs / entry.calls : 0,
    avgDiagnosticsMs: entry.calls > 0 ? entry.totalDiagnosticsMs / entry.calls : 0,
    avgDbMs: entry.calls > 0 ? entry.totalDbMs / entry.calls : 0,
    avgCacheMs: entry.calls > 0 ? entry.totalCacheMs / entry.calls : 0,
    avgTransformMs: entry.calls > 0 ? entry.totalTransformMs / entry.calls : 0,
    avgPayloadConstructionMs: entry.calls > 0 ? entry.totalPayloadMs / entry.calls : 0,
    avgPayloadBytes: entry.calls > 0 ? entry.totalPayloadBytes / entry.calls : 0,
    duplicateCalls: entry.duplicateCalls,
    repeatedHelpers: entry.repeatedHelpers,
    largestPayloadBytes: entry.largestPayloadBytes,
    largestPayloadProducer: entry.largestPayloadProducer,
    topOpportunity: entry.topOpportunity,
    lastSeenAt: entry.lastSeenAt
  } satisfies RouteProfileSummary)).sort((left, right) => right.avgTotalServerMs - left.avgTotalServerMs || right.avgDbMs - left.avgDbMs);

  const lastSeriesBucket = floorToBucket(now, bucketMinutes);
  const bucketCount = Math.max(1, Math.floor(windowMinutes / bucketMinutes) + 1);
  const firstSeriesBucket = addBucketMinutes(lastSeriesBucket, bucketMinutes, -(bucketCount - 1));
  const series = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = addBucketMinutes(firstSeriesBucket, bucketMinutes, index).toISOString();
    const entry = bySeries.get(bucketStart);
    return { bucketStart, bucketMinutes, calls: entry?.calls ?? 0, cacheMisses: entry?.cacheMisses ?? 0, totalPayloadBytes: entry?.totalPayloadBytes ?? 0, avgDurationMs: entry && entry.calls > 0 ? entry.durationTotalMs / entry.calls : 0 };
  });

  const invalidations = relevantInvalidations.map((entry) => ({ context: entry.context, trigger: entry.trigger, tagFamily: entry.tagFamily, invalidations: entry.invalidations, revalidatedPaths: entry.revalidatedPaths, lastSeenAt: entry.lastSeenAt } satisfies InvalidationSummary)).sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt));
  const inferredCacheHits = Math.max(0, totalLoaderCalls - totalCacheMisses);

  return {
    generatedAt: now.toISOString(),
    metricsStartedAt: persisted.metricsStartedAt,
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
    routeProfiles,
    series,
    slowestLoaders: [...loaders].sort((left, right) => right.p95DurationMs - left.p95DurationMs).slice(0, 10),
    heaviestLoaders: [...loaders].sort((left, right) => right.totalPayloadBytes - left.totalPayloadBytes).slice(0, 10),
    invalidations: invalidations.slice(0, 10),
    warnings: buildWarnings(loaders)
  };
}
