'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Data, Layout } from 'plotly.js';
import { usePathname, useRouter } from 'next/navigation';
import AnalyticsPlotlySurface from '@/admin/features/analitika/components/analytics/AnalyticsPlotlySurface';
import {
  getBaseChartLayout,
  getChartThemeFromCssVars
} from '@/admin/features/analitika/components/charts/chartTheme';
import { formatEuroWithSuffix, formatSlInteger } from '@/shared/domain/formatting';
import type {
  QuoteAnalyticsRange,
  QuoteAnalyticsResponse
} from '@/shared/domain/quote/quoteAnalytics';
import AdminAnalyticsSummaryCard from '@/shared/ui/admin-analytics-summary-card';
import { Spinner } from '@/shared/ui/loading';
import { SegmentedControl } from '@/shared/ui/segmented';

const rangeOptions: Array<{ value: QuoteAnalyticsRange; label: string }> = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: '180d', label: '6M' },
  { value: '365d', label: '1L' },
  { value: 'ytd', label: 'YTD' },
  { value: 'max', label: 'MAX' }
];

const formatHours = (value: number | null) => value === null
  ? '—'
  : `${Intl.NumberFormat('sl-SI', { maximumFractionDigits: 1 }).format(value)} h`;

const formatPercent = (value: number) =>
  `${Intl.NumberFormat('sl-SI', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)} %`;

const createLayout = (
  yTitle: string,
  theme: ReturnType<typeof getChartThemeFromCssVars>
): Partial<Layout> => ({
  ...getBaseChartLayout(theme),
  height: 300,
  margin: { l: 58, r: 24, t: 16, b: 52 },
  paper_bgcolor: theme.card,
  plot_bgcolor: theme.card,
  hovermode: 'x unified',
  legend: { orientation: 'h', x: 0, y: 1.12 },
  xaxis: {
    type: 'date',
    title: { text: 'Datum prejema povpraševanja' },
    gridcolor: theme.grid,
    zeroline: false
  },
  yaxis: {
    title: { text: yTitle },
    rangemode: 'tozero',
    gridcolor: theme.grid,
    zeroline: false
  }
});

export default function AdminQuoteAnalyticsDashboard({
  initialData,
  initialFocusKey = ''
}: {
  initialData: QuoteAnalyticsResponse;
  initialFocusKey?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const chartTheme = useMemo(() => getChartThemeFromCssVars(), []);
  const [data, setData] = useState(initialData);
  const [focusedKey, setFocusedKey] = useState(initialFocusKey);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const summary = data.summary;

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    setFocusedKey(initialFocusKey);
  }, [initialFocusKey]);

  const loadRange = async (nextRange: QuoteAnalyticsRange) => {
    if (nextRange === data.range) return;
    setLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch(`/api/admin/analytics/quotes?range=${nextRange}`);
      if (!response.ok) throw new Error('quote analytics request failed');
      const payload = (await response.json()) as QuoteAnalyticsResponse;
      setData(payload);
      const params = new URLSearchParams({ range: nextRange });
      if (focusedKey) params.set('focus', focusedKey);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    } catch {
      setErrorMessage('Podatkov za izbrano obdobje trenutno ni mogoče naložiti.');
    } finally {
      setLoading(false);
    }
  };

  const cards = [
    {
      title: 'Povpraševanja',
      metric: formatSlInteger(summary.requests),
      helper: 'Prejeta v izbranem obdobju',
      focusKey: 'ponudbe-requests'
    },
    {
      title: 'Izdane ponudbe',
      metric: formatSlInteger(summary.offersIssued),
      helper: `Povpraševanje → izdaja: ${formatHours(summary.averageRequestToIssueHours)}`,
      focusKey: 'ponudbe-offers-issued'
    },
    {
      title: 'Sprejeto / pretvorjeno',
      metric: formatSlInteger(summary.acceptedOrConverted),
      helper: `Izdaja → sprejem: ${formatHours(summary.averageIssueToAcceptHours)}`,
      focusKey: 'ponudbe-accepted-converted'
    },
    {
      title: 'Konverzija',
      metric: formatPercent(summary.conversionRate),
      helper: `${formatSlInteger(summary.acceptedOrConverted)} od ${formatSlInteger(summary.requests)} povpraševanj`,
      focusKey: 'ponudbe-conversion'
    },
    {
      title: 'Ponujena vrednost',
      metric: formatEuroWithSuffix(summary.quotedValue),
      helper: 'Aktualne izdane ponudbe; ni prihodek',
      focusKey: 'ponudbe-quoted-value'
    },
    {
      title: 'Vrednost povezanih naročil',
      metric: formatEuroWithSuffix(summary.convertedOrderValue),
      helper: 'Sprejeta, zavezujoča naročila',
      focusKey: 'ponudbe-converted-order-value'
    }
  ];

  const x = data.days.map((day) => day.date);
  const volumeTraces = useMemo<Data[]>(() => [
    {
      type: 'bar',
      name: 'Povpraševanja',
      x,
      y: data.days.map((day) => day.requests),
      marker: { color: '#3e67d6' },
      hovertemplate: '%{x|%d. %m. %Y}<br>Povpraševanja: %{y}<extra></extra>'
    },
    {
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Izdane ponudbe',
      x,
      y: data.days.map((day) => day.offersIssued),
      line: { color: '#0891b2', width: 2 },
      hovertemplate: '%{x|%d. %m. %Y}<br>Izdane ponudbe: %{y}<extra></extra>'
    },
    {
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Sprejeto / pretvorjeno',
      x,
      y: data.days.map((day) => day.acceptedOrConverted),
      line: { color: '#409762', width: 2 },
      hovertemplate: '%{x|%d. %m. %Y}<br>Sprejeto / pretvorjeno: %{y}<extra></extra>'
    }
  ], [data.days, x]);
  const valueTraces = useMemo<Data[]>(() => [
    {
      type: 'bar',
      name: 'Ponujena vrednost',
      x,
      y: data.days.map((day) => day.quotedValue),
      marker: { color: '#60a5fa' },
      hovertemplate: '%{x|%d. %m. %Y}<br>Ponujena vrednost: %{y:,.2f} €<extra></extra>'
    },
    {
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Vrednost povezanih naročil',
      x,
      y: data.days.map((day) => day.convertedOrderValue),
      line: { color: '#409762', width: 2 },
      hovertemplate: '%{x|%d. %m. %Y}<br>Povezana naročila: %{y:,.2f} €<extra></extra>'
    }
  ], [data.days, x]);
  const volumeLayout = useMemo(() => createLayout('Število', chartTheme), [chartTheme]);
  const valueLayout = useMemo(() => createLayout('Vrednost (EUR)', chartTheme), [chartTheme]);
  const focusIsVolume = ['ponudbe-requests', 'ponudbe-offers-issued', 'ponudbe-accepted-converted', 'ponudbe-conversion'].includes(focusedKey);
  const focusIsValue = ['ponudbe-quoted-value', 'ponudbe-converted-order-value'].includes(focusedKey);

  return (
    <div
      className="w-full rounded-2xl border border-slate-200 bg-[#f3f4f6] p-3 text-slate-900"
      data-testid="admin-quote-analytics-dashboard"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-semibold">Povpraševanja in ponudbe</h1>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Kohorta po datumu prejema · {data.from}–{data.to} · časovni pas UTC
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading ? <Spinner size="sm" className="text-slate-500" /> : null}
          <SegmentedControl
            size="sm"
            value={data.range}
            onChange={(next) => void loadRange(next as QuoteAnalyticsRange)}
            options={rangeOptions}
            className="rounded-lg border-slate-300 bg-slate-100 p-0.5"
          />
        </div>
      </div>

      {errorMessage ? (
        <p role="alert" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {errorMessage}
        </p>
      ) : null}

      <section aria-label="Povzetek analitike ponudb" className="grid gap-[14px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => {
          const params = new URLSearchParams({ range: data.range, focus: card.focusKey });
          return (
            <AdminAnalyticsSummaryCard
              key={card.focusKey}
              id={card.focusKey}
              focusKey={card.focusKey}
              isFocused={focusedKey === card.focusKey}
              href={`${pathname}?${params.toString()}`}
              title={card.title}
              metric={card.metric}
            >
              <p className="mt-3 truncate text-[11px] font-semibold leading-none text-[#707986]" title={card.helper}>
                {card.helper}
              </p>
            </AdminAnalyticsSummaryCard>
          );
        })}
      </section>

      <p className="mt-3 text-[11px] text-slate-500">
        Konverzija je izračunana za povpraševanja, prejeta v izbranem obdobju. Ponujena vrednost ni prihodek.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section
          data-chart-key="ponudbe-lijak"
          data-focused={focusIsVolume ? 'true' : 'false'}
          className={`rounded-xl border bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ${focusIsVolume ? 'border-[color:var(--blue-500)] ring-2 ring-blue-100' : 'border-slate-200'}`}
        >
          <h2 className="text-sm font-semibold text-slate-900">Lijak po datumu prejema</h2>
          <p className="text-xs text-slate-500">Vsako povpraševanje je v posamezni stopnji šteto največ enkrat.</p>
          <AnalyticsPlotlySurface data={volumeTraces} layout={volumeLayout} onClick={() => setFocusedKey('ponudbe-requests')} />
        </section>
        <section
          data-chart-key="ponudbe-vrednosti"
          data-focused={focusIsValue ? 'true' : 'false'}
          className={`rounded-xl border bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ${focusIsValue ? 'border-[color:var(--blue-500)] ring-2 ring-blue-100' : 'border-slate-200'}`}
        >
          <h2 className="text-sm font-semibold text-slate-900">Vrednost ponudb in povezanih naročil</h2>
          <p className="text-xs text-slate-500">Po datumu prejema izvornega povpraševanja.</p>
          <AnalyticsPlotlySurface data={valueTraces} layout={valueLayout} onClick={() => setFocusedKey('ponudbe-quoted-value')} />
        </section>
      </div>

      <section className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Izidi in odzivni čas">
        {[
          ['Zavrnjeno', formatSlInteger(summary.declined)],
          ['Umaknjeno', formatSlInteger(summary.withdrawn)],
          ['Poteklo', formatSlInteger(summary.expired)],
          ['Povpraševanje → izdaja', formatHours(summary.averageRequestToIssueHours)],
          ['Izdaja → sprejem', formatHours(summary.averageIssueToAcceptHours)]
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-lg bg-slate-50 px-3 py-2">
            <p className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-500" title={label}>{label}</p>
            <p className="mt-1 text-base font-semibold text-slate-800">{value}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
