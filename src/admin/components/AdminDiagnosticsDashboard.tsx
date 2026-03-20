import type { ReactNode } from 'react';
import Link from 'next/link';
import AdminDiagnosticsChart from '@/admin/components/AdminDiagnosticsChart';
import {
  getCatalogDiagnosticsCoverageSnapshot,
  getCatalogDiagnosticsSnapshot,
  type CatalogDiagnosticsMetricEvent
} from '@/shared/server/catalogDiagnostics';

type Props = {
  windowHours?: number;
};

type MiniChartPoint = {
  timestamp: string;
  label: string;
  value: number;
};

type DiagnosticsWindowOption = {
  label: string;
  param: string;
  minutes: number;
  windowHours: number;
  description: string;
};

type CoverageCardRegistryEntry = {
  id: string;
  label: string;
  route: string;
  acceptedContexts: string[];
  acceptedEventKinds?: string[];
  description: string;
};

type CoverageStatus = 'active' | 'recent' | 'historical' | 'missing';

type CoverageDebugBucket = 'selected window' | 'recent' | 'historical' | 'none';

type CoverageCardEvidence = {
  card: CoverageCardRegistryEntry;
  selectedWindowEntries: CatalogDiagnosticsMetricEvent[];
  recentEntries: CatalogDiagnosticsMetricEvent[];
  allTimeEntries: CatalogDiagnosticsMetricEvent[];
  latestKnownEntry: CatalogDiagnosticsMetricEvent | null;
  lastSeenAt: string | null;
  matchedContext: string | null;
  matchedEventType: string | null;
  status: CoverageStatus;
  sourceBucket: CoverageDebugBucket;
};

const DIAGNOSTICS_WINDOW_OPTIONS: DiagnosticsWindowOption[] = [
  { label: '5 min', param: '5m', minutes: 5, windowHours: 5 / 60, description: '1-min prikaz za live admin session in hiter debugging.' },
  { label: '15 min', param: '15m', minutes: 15, windowHours: 0.25, description: '5-min bucketi za kratek admin session.' },
  { label: '1 ura', param: '60m', minutes: 60, windowHours: 1, description: '5-min bucketi za krajše odpravljanje težav.' },
  { label: '6 ur', param: '6h', minutes: 360, windowHours: 6, description: '15-min bucketi za isti delovni blok.' },
  { label: '24 ur', param: '24h', minutes: 1440, windowHours: 24, description: 'Urni bucketi za širši dnevni pregled.' }
];

const ADMIN_DIAGNOSTICS_COVERAGE_REGISTRY: CoverageCardRegistryEntry[] = [
  {
    id: 'orders-list',
    label: 'Naročila seznam',
    route: '/admin/orders',
    acceptedContexts: ['/admin/orders'],
    acceptedEventKinds: ['adminRouteEntry'],
    description: 'Route-level vstopni signal za glavni seznam naročil.'
  },
  {
    id: 'orders-detail',
    label: 'Naročila podrobnosti',
    route: '/admin/orders/[orderId]',
    acceptedContexts: ['/admin/orders/[orderId]'],
    acceptedEventKinds: ['adminRouteEntry'],
    description: 'Deterministični route-level vstopni signal za podrobnosti naročila.'
  },
  {
    id: 'archive',
    label: 'Arhiv',
    route: '/admin/arhiv',
    acceptedContexts: ['/admin/arhiv'],
    acceptedEventKinds: ['adminRouteEntry'],
    description: 'Route-level vstopni signal za arhiv izbrisanih zapisov.'
  },
  {
    id: 'analytics-orders',
    label: 'Analitika naročil',
    route: '/admin/analitika',
    acceptedContexts: ['/admin/analitika'],
    acceptedEventKinds: ['adminRouteEntry'],
    description: 'Route-level vstopni signal za dashboard analitike naročil.'
  },
  {
    id: 'analytics-web',
    label: 'Analitika splet',
    route: '/admin/analitika/splet',
    acceptedContexts: ['/admin/analitika/splet'],
    acceptedEventKinds: ['adminRouteEntry'],
    description: 'Route-level vstopni signal za dashboard spletne analitike.'
  },
  {
    id: 'items',
    label: 'Artikli',
    route: '/admin/artikli',
    acceptedContexts: ['/admin/artikli'],
    acceptedEventKinds: ['adminRouteEntry'],
    description: 'Route-level vstopni signal za upravljanje artiklov.'
  },
  {
    id: 'categories-table',
    label: 'Kategorije',
    route: '/admin/kategorije',
    acceptedContexts: ['/admin/kategorije'],
    acceptedEventKinds: ['adminRouteEntry'],
    description: 'Route-level vstopni signal za tabelarični pogled kategorij.'
  },
  {
    id: 'categories-miller',
    label: 'Kategorije Miller view',
    route: '/admin/kategorije/miller-view',
    acceptedContexts: ['/admin/kategorije/miller-view'],
    acceptedEventKinds: ['adminRouteEntry'],
    description: 'Route-level vstopni signal za Miller view kategorij.'
  }
] as const;

const RECENT_WINDOW_MINUTES = 30;
const formatNumber = (value: number) => new Intl.NumberFormat('sl-SI').format(Math.round(value));
const formatDuration = (value: number) => `${formatNumber(value)} ms`;
const formatPercent = (value: number | null) => (value === null ? '—' : `${(value * 100).toFixed(1)} %`);

const formatBytes = (value: number) => {
  if (value <= 0) return '0 B';
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${formatNumber(value)} B`;
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('sl-SI', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'UTC'
  }).format(new Date(value));

const formatBucketLabel = (value: string, bucketMinutes: number) =>
  new Intl.DateTimeFormat('sl-SI', {
    hour: '2-digit',
    minute: bucketMinutes < 60 ? '2-digit' : undefined,
    month: bucketMinutes >= 60 ? '2-digit' : undefined,
    day: bucketMinutes >= 60 ? '2-digit' : undefined,
    timeZone: 'UTC'
  }).format(new Date(value));

function normalizeDiagnosticContext(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  const withoutQuery = trimmed.split('?')[0] ?? trimmed;
  const normalized = withoutQuery.replace(/\/+$/, '');
  return normalized || '/';
}

function matchesCoverageCard(entry: CatalogDiagnosticsMetricEvent, card: CoverageCardRegistryEntry) {
  const normalizedContext = normalizeDiagnosticContext(entry.context);
  const acceptedContexts = card.acceptedContexts.map(normalizeDiagnosticContext);
  if (!acceptedContexts.includes(normalizedContext)) return false;
  if (card.acceptedEventKinds?.length && !card.acceptedEventKinds.includes(entry.loader)) return false;
  return true;
}

function sortEntriesByLatest(entries: CatalogDiagnosticsMetricEvent[]) {
  return [...entries].sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt));
}

export function buildCoverageCardEvidence(
  registry: CoverageCardRegistryEntry[],
  metricEvents: CatalogDiagnosticsMetricEvent[],
  selectedWindowMinutes: number,
  recentWindowMinutes = RECENT_WINDOW_MINUTES,
  now = new Date()
): CoverageCardEvidence[] {
  const selectedCutoff = now.getTime() - selectedWindowMinutes * 60 * 1000;
  const recentCutoff = now.getTime() - recentWindowMinutes * 60 * 1000;

  return registry.map((card) => {
    const matchedEntries = sortEntriesByLatest(metricEvents.filter((entry) => matchesCoverageCard(entry, card)));
    const selectedWindowEntries = matchedEntries.filter((entry) => new Date(entry.lastSeenAt).getTime() >= selectedCutoff);
    const recentEntries = matchedEntries.filter((entry) => new Date(entry.lastSeenAt).getTime() >= recentCutoff);
    const latestKnownEntry = matchedEntries[0] ?? null;
    const status: CoverageStatus = selectedWindowEntries.length > 0
      ? 'active'
      : recentEntries.length > 0
        ? 'recent'
        : matchedEntries.length > 0
          ? 'historical'
          : 'missing';
    const sourceBucket: CoverageDebugBucket = selectedWindowEntries.length > 0
      ? 'selected window'
      : recentEntries.length > 0
        ? 'recent'
        : matchedEntries.length > 0
          ? 'historical'
          : 'none';

    return {
      card,
      selectedWindowEntries,
      recentEntries,
      allTimeEntries: matchedEntries,
      latestKnownEntry,
      lastSeenAt: latestKnownEntry?.lastSeenAt ?? null,
      matchedContext: latestKnownEntry ? normalizeDiagnosticContext(latestKnownEntry.context) : null,
      matchedEventType: latestKnownEntry?.loader ?? null,
      status,
      sourceBucket
    } satisfies CoverageCardEvidence;
  });
}

export function assertAdminCoverageCards(evidence: CoverageCardEvidence[]) {
  const offenders = evidence.filter((entry) => entry.status !== 'active' && entry.status !== 'recent');
  if (offenders.length === 0) return;

  const details = offenders.map((entry) => `${entry.card.route} -> ${entry.status} (${entry.matchedContext ?? 'no-context'})`).join(', ');
  throw new Error(`Admin diagnostics coverage assertion failed: ${details}`);
}

const triggerLabel = (trigger: string) => {
  switch (trigger) {
    case 'page_render':
      return 'Prikaz strani';
    case 'api_call':
      return 'API klic';
    case 'save_revalidation':
      return 'Shrani / revalidacija';
    case 'search':
      return 'Iskanje';
    default:
      return 'Drugo';
  }
};

const triggerTone = (trigger: string) => {
  switch (trigger) {
    case 'page_render':
      return 'bg-sky-100 text-sky-800';
    case 'api_call':
      return 'bg-violet-100 text-violet-800';
    case 'save_revalidation':
      return 'bg-amber-100 text-amber-800';
    case 'search':
      return 'bg-emerald-100 text-emerald-800';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

const classifyLoaderLayer = (loader: string) => {
  if (loader.startsWith('getCached') || loader.startsWith('load')) {
    return { label: 'Cache izvedba', tone: 'bg-amber-100 text-amber-800' };
  }

  return { label: 'Vhodni loader', tone: 'bg-sky-100 text-sky-800' };
};

function SummaryCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </article>
  );
}

function DataTable({ title, description, columns, rows }: { title: string; description: string; columns: string[]; rows: ReactNode[][] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length > 0 ? (
              rows.map((row, index) => (
                <tr key={index} className="align-top">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-3 text-slate-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-sm text-slate-500">
                  Za izbrano okno še ni zabeleženih diagnostičnih klicev.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RankedList({ title, description, rows, valueFormatter }: { title: string; description: string; rows: Array<{ label: string; context: string; value: number }>; valueFormatter: (value: number) => string }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="space-y-2">
        {rows.length > 0 ? rows.map((row) => (
          <div key={`${row.label}-${row.context}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
            <div>
              <p className="font-medium text-slate-900">{row.label}</p>
              <p className="text-xs text-slate-500">{row.context}</p>
            </div>
            <span className="text-sm font-semibold text-slate-900">{valueFormatter(row.value)}</span>
          </div>
        )) : <p className="text-sm text-slate-500">Ni dovolj podatkov.</p>}
      </div>
    </section>
  );
}

const resolveWindowOption = (windowHours: number) =>
  DIAGNOSTICS_WINDOW_OPTIONS.find((option) => Math.abs(option.windowHours - windowHours) < 0.001) ?? DIAGNOSTICS_WINDOW_OPTIONS.at(-1)!;

function coverageStatusPresentation(status: CoverageStatus) {
  switch (status) {
    case 'active':
      return { label: 'Aktivno v oknu', tone: 'border-emerald-200 bg-emerald-50 text-emerald-900' };
    case 'recent':
      return { label: 'Nedavno zaznano', tone: 'border-sky-200 bg-sky-50 text-sky-900' };
    case 'historical':
      return { label: 'Pokrito, brez aktivnosti v oknu', tone: 'border-amber-200 bg-amber-50 text-amber-900' };
    default:
      return { label: 'Ni dokazov o beleženju', tone: 'border-rose-200 bg-rose-50 text-rose-900' };
  }
}

export default function AdminDiagnosticsDashboard({ windowHours = 24 }: Props) {
  const activeWindow = resolveWindowOption(windowHours);
  const snapshot = getCatalogDiagnosticsSnapshot(activeWindow.windowHours);
  const coverageSnapshot = getCatalogDiagnosticsCoverageSnapshot();
  const callSeries = snapshot.series.map((point) => ({ timestamp: point.bucketStart, label: formatBucketLabel(point.bucketStart, snapshot.bucketMinutes), value: point.calls }));
  const payloadSeries = snapshot.series.map((point) => ({ timestamp: point.bucketStart, label: formatBucketLabel(point.bucketStart, snapshot.bucketMinutes), value: point.totalPayloadBytes }));
  const topSlowLabel = snapshot.slowestLoaders.length >= 10 ? 'Top 10 po p95 za hitrejšo identifikacijo latency hotspotov.' : `Trenutno prikazanih ${snapshot.slowestLoaders.length} loaderjev z zabeleženim p95.`;
  const topPayloadLabel = snapshot.heaviestLoaders.length >= 10 ? 'Top 10 po skupnem payloadu v izbranem oknu.' : `Trenutno prikazanih ${snapshot.heaviestLoaders.length} loaderjev z merjenim payloadom.`;
  const coverageEvidence = buildCoverageCardEvidence(ADMIN_DIAGNOSTICS_COVERAGE_REGISTRY, coverageSnapshot.metricEvents, activeWindow.minutes);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Diagnostika</h1>
        <p className="mt-1 text-sm text-slate-600">
          Operativni pregled admin loaderjev, cache obnašanja, payloadov, invalidacij in route budget opozoril.
        </p>
      </div>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">Okno: zadnjih {activeWindow.minutes < 60 ? `${activeWindow.minutes} min` : `${windowHours} ur`}</p>
        <p className="mt-1 text-amber-800">
          Podatki so agregirani v pomnilniku trenutne aplikacijske instance. To ni globalna infrastruktura in se ob restartu oziroma deployu ponastavi.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DIAGNOSTICS_WINDOW_OPTIONS.map((option) => {
            const active = option.minutes === activeWindow.minutes;
            return (
              <Link
                key={option.minutes}
                href={`/admin/analitika/diagnostika?window=${option.param}`}
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium transition ${active ? 'border-amber-400 bg-amber-100 text-amber-900' : 'border-amber-300 bg-white/70 text-amber-900 hover:bg-white'}`}
                title={option.description}
              >
                {option.label}
              </Link>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-amber-800">
          <span>Granularnost: {snapshot.bucketMinutes} min</span>
          <span>Zagon meritev: {formatDateTime(snapshot.metricsStartedAt)} UTC</span>
          <span>Posodobljeno: {formatDateTime(snapshot.generatedAt)} UTC</span>
          <span>Coverage recent: {RECENT_WINDOW_MINUTES} min</span>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard label="Skupni klici" value={formatNumber(snapshot.summary.totalLoaderCalls)} hint={`${snapshot.summary.uniqueLoaders} loaderjev`} />
        <SummaryCard label="Cache missi" value={formatNumber(snapshot.summary.totalCacheMisses)} hint="Dejanske izvedbe ob miss" />
        <SummaryCard label="Inferred hiti" value={formatNumber(snapshot.summary.inferredCacheHits)} hint="Klici minus missi" />
        <SummaryCard label="Hit rate" value={formatPercent(snapshot.summary.cacheHitRate)} hint="Ocena za izbrano okno" />
        <SummaryCard label="Payload" value={formatBytes(snapshot.summary.totalPayloadBytes)} hint={`${snapshot.summary.activeContexts} kontekstov`} />
        <SummaryCard label="Invalidacije" value={formatNumber(snapshot.summary.invalidationCount)} hint="Shrani / revalidacija" />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Viri klicev</h2>
        <p className="mt-1 text-sm text-slate-500">Best-effort razvrstitev po izvoru. Natančne ločitve med route switch in hard refresh na strežniku ne fabriciramo.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {snapshot.triggers.map((entry) => (
            <span key={entry.trigger} className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${triggerTone(entry.trigger)}`}>
              {triggerLabel(entry.trigger)} · {formatNumber(entry.calls)} klicev · {formatNumber(entry.cacheMisses)} missov
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Pokritost glavnih admin kontekstov</h2>
            <p className="mt-1 text-sm text-slate-500">Kartice so vodene prek statičnega coverage registra in determinističnega route-scoped matcherja. “Brez aktivnosti v oknu” ne pomeni več “ni pokrito”.</p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {coverageEvidence.map((entry) => {
            const status = coverageStatusPresentation(entry.status);
            return (
              <details key={entry.card.id} className={`rounded-lg border px-3 py-3 ${status.tone}`}>
                <summary className="cursor-pointer list-none">
                  <p className="font-medium">{entry.card.label}</p>
                  <p className="mt-1 text-xs"><code>{entry.card.route}</code></p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide">{status.label}</p>
                  {entry.lastSeenAt ? (
                    <p className="mt-1 text-xs">Zadnji zaznan dogodek: {formatDateTime(entry.lastSeenAt)} UTC</p>
                  ) : (
                    <p className="mt-1 text-xs">Zadnji zaznan dogodek: —</p>
                  )}
                  <p className="mt-2 text-xs">{entry.card.description}</p>
                </summary>
                <div className="mt-3 space-y-2 border-t border-current/15 pt-3 text-xs">
                  <p><span className="font-semibold">V izbranem oknu:</span> {formatNumber(entry.selectedWindowEntries.length)}</p>
                  <p><span className="font-semibold">Nedavno ({RECENT_WINDOW_MINUTES} min):</span> {formatNumber(entry.recentEntries.length)}</p>
                  <p><span className="font-semibold">Zgodovinski dokazi:</span> {formatNumber(entry.allTimeEntries.length)}</p>
                  <p><span className="font-semibold">Ujemajoči kontekst:</span> {entry.matchedContext ?? '—'}</p>
                  <p><span className="font-semibold">Ujemajoči event:</span> {entry.matchedEventType ?? '—'}</p>
                  <p><span className="font-semibold">Vir bucket:</span> {entry.sourceBucket}</p>
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <AdminDiagnosticsChart
          title="Klici skozi čas"
          description={`Skupni loader klici po ${snapshot.bucketMinutes}-min bucketih.`}
          points={callSeries}
          color="#2563eb"
          valueKind="count"
          valueLabel="Klici"
          windowMinutes={activeWindow.minutes}
          footer={`Točke: ${callSeries.length} · granularnost: ${snapshot.bucketMinutes} min`}
        />
        <AdminDiagnosticsChart
          title="Payload skozi čas"
          description={`Približen promet payloadov po ${snapshot.bucketMinutes}-min bucketih.`}
          points={payloadSeries}
          color="#0f766e"
          valueKind="bytes"
          valueLabel="Payload"
          windowMinutes={activeWindow.minutes}
          footer={`Točke: ${payloadSeries.length} · granularnost: ${snapshot.bucketMinutes} min`}
        />
      </div>

      <DataTable
        title="Statistika loaderjev"
        description="Tabela združuje vhodne loaderje in notranje cache izvedbe, zato so missi/hiti prikazani eksplicitno."
        columns={['Loader', 'Sloj', 'Vir', 'Kontekst', 'Klici', 'Missi', 'Hiti', 'Hit %', 'Povpr. ms', 'p95 ms', 'Payload', 'Nazadnje']}
        rows={snapshot.loaders.slice(0, 12).map((row) => {
          const layer = classifyLoaderLayer(row.loader);
          return [
            <div key="loader"><p className="font-medium text-slate-900">{row.loader}</p></div>,
            <span key="layer" className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${layer.tone}`}>{layer.label}</span>,
            <span key="trigger" className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${triggerTone(row.trigger)}`}>{triggerLabel(row.trigger)}</span>,
            <code key="context" className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{row.context}</code>,
            formatNumber(row.calls),
            formatNumber(row.cacheMisses),
            formatNumber(row.cacheHits),
            formatPercent(row.calls > 0 ? row.cacheHits / row.calls : null),
            formatDuration(row.avgDurationMs),
            formatDuration(row.p95DurationMs),
            formatBytes(row.totalPayloadBytes),
            formatDateTime(row.lastSeenAt)
          ];
        })}
      />

      <DataTable
        title="Statistika poti / kontekstov"
        description="Kontekst pove, ali gre za prikaz strani, API klic ali save/revalidation tok."
        columns={['Pot / kontekst', 'Vir', 'Klici', 'Missi', 'Hiti', 'Povpr. ms', 'Najbolj vroč loader', 'Payload', 'Nazadnje']}
        rows={snapshot.routes.slice(0, 12).map((row) => [
          <code key="context" className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{row.context}</code>,
          <span key="trigger" className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${triggerTone(row.trigger)}`}>{triggerLabel(row.trigger)}</span>,
          formatNumber(row.calls),
          formatNumber(row.cacheMisses),
          formatNumber(row.cacheHits),
          formatDuration(row.avgDurationMs),
          <span key="loader" className="font-medium text-slate-900">{row.hottestLoader}</span>,
          formatBytes(row.totalPayloadBytes),
          formatDateTime(row.lastSeenAt)
        ])}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <RankedList
          title="Najpočasnejši loaderji"
          description={topSlowLabel}
          rows={snapshot.slowestLoaders.map((row) => ({ label: row.loader, context: row.context, value: row.p95DurationMs }))}
          valueFormatter={(value) => formatDuration(value)}
        />
        <RankedList
          title="Najtežji payloadi"
          description={topPayloadLabel}
          rows={snapshot.heaviestLoaders.map((row) => ({ label: row.loader, context: row.context, value: row.totalPayloadBytes }))}
          valueFormatter={(value) => formatBytes(value)}
        />
      </div>

      <DataTable
        title="Nedavne invalidacije"
        description="Rolling summary tag invalidacij in route revalidacij; brez surovega event streama."
        columns={['Vir', 'Tag družina', 'Dogodki', 'Revalidirane poti', 'Nazadnje']}
        rows={snapshot.invalidations.map((row) => [
          <div key="trigger"><p className="font-medium text-slate-900">{row.context}</p><p className="text-xs text-slate-500">{triggerLabel(row.trigger)}</p></div>,
          <code key="family" className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{row.tagFamily}</code>,
          formatNumber(row.invalidations),
          formatNumber(row.revalidatedPaths),
          formatDateTime(row.lastSeenAt)
        ])}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Opozorila in pričakovanja</h2>
        <div className="mt-3 space-y-2 text-sm">
          {snapshot.warnings.map((warning, index) => (
            <div key={`${warning.context}-${index}`} className={`rounded-lg border px-3 py-2 ${warning.severity === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-sky-200 bg-sky-50 text-sky-900'}`}>
              <p className="font-medium">{warning.context}</p>
              <p className="mt-1">{warning.message}</p>
            </div>
          ))}
          {snapshot.warnings.length === 0 ? <p className="text-slate-500">Ni zaznanih očitnih odstopanj od trenutnih route budget pravil.</p> : null}
        </div>
      </section>
    </div>
  );
}
