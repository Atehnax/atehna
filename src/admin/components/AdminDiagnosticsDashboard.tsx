import type { ReactNode } from 'react';
import { getCatalogDiagnosticsSnapshot } from '@/shared/server/catalogDiagnostics';

type Props = {
  windowHours?: number;
};

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

export default function AdminDiagnosticsDashboard({ windowHours = 24 }: Props) {
  const snapshot = getCatalogDiagnosticsSnapshot(windowHours);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Diagnostika</h1>
        <p className="mt-1 text-sm text-slate-600">
          Lahek operativni pregled katalogskih loaderjev, trajanj, cache obnašanja in približnega payload prometa.
        </p>
      </div>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">Okno: zadnjih {windowHours} ur</p>
        <p className="mt-1 text-amber-800">
          Podatki so agregirani v pomnilniku trenutne aplikacijske instance. Ne zapisujemo surovih dogodkov v bazo, zato je pogled namenjen hitremu
          operativnemu vpogledu in ne dolgoročni infrastrukturi.
        </p>
        <p className="mt-1 text-xs text-amber-700">Posodobljeno: {formatDateTime(snapshot.generatedAt)} UTC.</p>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Klici loaderjev" value={formatNumber(snapshot.summary.totalLoaderCalls)} hint={`${snapshot.summary.uniqueLoaders} loaderjev`} />
        <SummaryCard label="Povpr. trajanje" value={formatDuration(snapshot.summary.avgLoaderDurationMs)} hint="Agregirano čez vse klice" />
        <SummaryCard label="Cache hit rate" value={formatPercent(snapshot.summary.cacheHitRate)} hint="Iz razlike med klici in izvršitvami miss" />
        <SummaryCard label="Približen payload" value={formatBytes(snapshot.summary.totalPayloadBytes)} hint={`${snapshot.summary.activeContexts} kontekstov`} />
        <SummaryCard label="Napake" value={formatNumber(snapshot.summary.totalErrorCount)} hint="Samo instrumentirani loaderji" />
      </div>

      <DataTable
        title="Statistika loaderjev"
        description="Najbolj uporabljeni katalogski/server loaderji v zadnjem oknu."
        columns={['Loader', 'Kontekst', 'Klici', 'Povpr. ms', 'p95 ms', 'Cache hit %', 'Payload', 'Napake', 'Nazadnje']} 
        rows={snapshot.loaders.slice(0, 12).map((row) => [
          <div key="loader">
            <p className="font-medium text-slate-900">{row.loader}</p>
          </div>,
          <code key="context" className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{row.context}</code>,
          formatNumber(row.calls),
          formatDuration(row.avgDurationMs),
          formatDuration(row.p95DurationMs),
          formatPercent(row.calls > 0 ? row.cacheHits / row.calls : null),
          formatBytes(row.totalPayloadBytes),
          formatNumber(row.errorCount),
          formatDateTime(row.lastSeenAt)
        ])}
      />

      <DataTable
        title="Statistika poti / kontekstov"
        description="Kateri route-i oziroma konteksti trenutno največ uporabljajo katalogske loaderje."
        columns={['Pot / kontekst', 'Klici', 'Povpr. ms', 'Najbolj vroč loader', 'Payload', 'Nazadnje']}
        rows={snapshot.routes.slice(0, 12).map((row) => [
          <code key="context" className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{row.context}</code>,
          formatNumber(row.calls),
          formatDuration(row.avgDurationMs),
          <span key="loader" className="font-medium text-slate-900">{row.hottestLoader}</span>,
          formatBytes(row.totalPayloadBytes),
          formatDateTime(row.lastSeenAt)
        ])}
      />
    </div>
  );
}
