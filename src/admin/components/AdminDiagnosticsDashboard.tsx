import type { ReactNode } from 'react';
import Link from 'next/link';
import { getCatalogDiagnosticsSnapshot } from '@/shared/server/catalogDiagnostics';

type Props = {
  windowHours?: number;
};

type MiniChartPoint = {
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

const CHART_WIDTH = 640;
const CHART_HEIGHT = 180;
const CHART_INNER_HEIGHT = 132;
const DIAGNOSTICS_WINDOW_OPTIONS: DiagnosticsWindowOption[] = [
  { label: '15 min', param: '15m', minutes: 15, windowHours: 0.25, description: '5-min bucketi za kratek admin session.' },
  { label: '1 ura', param: '60m', minutes: 60, windowHours: 1, description: '5-min bucketi za krajše odpravljanje težav.' },
  { label: '6 ur', param: '6h', minutes: 360, windowHours: 6, description: '15-min bucketi za isti delovni blok.' },
  { label: '24 ur', param: '24h', minutes: 1440, windowHours: 24, description: 'Urni bucketi za širši dnevni pregled.' }
];

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

function buildPolyline(points: MiniChartPoint[]) {
  if (points.length === 0) return '';
  const max = Math.max(...points.map((point) => point.value), 1);
  const step = points.length === 1 ? CHART_WIDTH : CHART_WIDTH / (points.length - 1);

  return points
    .map((point, index) => {
      const x = index * step;
      const y = CHART_INNER_HEIGHT - (point.value / max) * CHART_INNER_HEIGHT;
      return `${x},${y}`;
    })
    .join(' ');
}

function MiniLineChart({ title, description, points, stroke, valueFormatter }: { title: string; description: string; points: MiniChartPoint[]; stroke: string; valueFormatter: (value: number) => string }) {
  const lastPoint = points.at(-1);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {lastPoint ? <p className="text-sm font-medium text-slate-700">Zadnja točka: {valueFormatter(lastPoint.value)}</p> : null}
      </div>
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="mt-4 w-full rounded bg-slate-50 p-2">
        <line x1="0" y1={CHART_INNER_HEIGHT} x2={CHART_WIDTH} y2={CHART_INNER_HEIGHT} stroke="#cbd5e1" strokeWidth="1" />
        <polyline fill="none" stroke={stroke} strokeWidth="2.5" points={buildPolyline(points)} />
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {points.slice(-6).map((point) => (
          <span key={point.label}>{point.label}: {valueFormatter(point.value)}</span>
        ))}
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

export default function AdminDiagnosticsDashboard({ windowHours = 24 }: Props) {
  const activeWindow = resolveWindowOption(windowHours);
  const snapshot = getCatalogDiagnosticsSnapshot(activeWindow.windowHours);
  const callSeries = snapshot.series.map((point) => ({ label: formatBucketLabel(point.bucketStart, snapshot.bucketMinutes), value: point.calls }));
  const payloadSeries = snapshot.series.map((point) => ({ label: formatBucketLabel(point.bucketStart, snapshot.bucketMinutes), value: point.totalPayloadBytes }));
  const topSlowLabel = snapshot.slowestLoaders.length >= 10 ? 'Top 10 po p95 za hitrejšo identifikacijo latency hotspotov.' : `Trenutno prikazanih ${snapshot.slowestLoaders.length} loaderjev z zabeleženim p95.`;
  const topPayloadLabel = snapshot.heaviestLoaders.length >= 10 ? 'Top 10 po skupnem payloadu v izbranem oknu.' : `Trenutno prikazanih ${snapshot.heaviestLoaders.length} loaderjev z merjenim payloadom.`;

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

      <div className="grid gap-4 xl:grid-cols-2">
        <MiniLineChart
          title="Klici skozi čas"
          description={`Skupni loader klici po ${snapshot.bucketMinutes}-min bucketih.`}
          points={callSeries}
          stroke="#2563eb"
          valueFormatter={(value) => formatNumber(value)}
        />
        <MiniLineChart
          title="Payload skozi čas"
          description={`Približen promet payloadov po ${snapshot.bucketMinutes}-min bucketih.`}
          points={payloadSeries}
          stroke="#0f766e"
          valueFormatter={(value) => formatBytes(value)}
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
