'use client';

import { useMemo, useState, type ReactNode } from 'react';
import PlotlyClient from '@/components/admin/charts/PlotlyClient';
import type { OrdersAnalyticsResponse } from '@/lib/server/orderAnalytics';
import type { AnalyticsChartConfig, AnalyticsChartRow, AnalyticsChartType } from '@/lib/server/analyticsCharts';

type RangeOption = '30d' | '90d' | '180d';

type Props = {
  initialData: OrdersAnalyticsResponse;
  initialCharts: AnalyticsChartRow[];
};

type BuilderState = {
  title: string;
  description: string;
  comment: string;
  chartType: AnalyticsChartType;
  yFields: Array<'order_count' | 'revenue_total' | 'aov'>;
  customerType: 'all' | 'P' | 'Š' | 'F';
  status: string;
  movingAverage7d: boolean;
};

const movingAverage = (values: number[], window = 7) =>
  values.map((_, index) => {
    const start = Math.max(0, index - (window - 1));
    const series = values.slice(start, index + 1);
    return series.reduce((sum, value) => sum + value, 0) / Math.max(series.length, 1);
  });

const chartTheme = {
  pageBg: '#0f172a',
  panelBg: '#1e293b',
  panelBorder: '#334155',
  textPrimary: '#e2e8f0',
  textSecondary: '#94a3b8',
  grid: 'rgba(148,163,184,0.22)',
  primarySeries: '#22d3ee',
  secondarySeries: '#f59e0b',
  tertiarySeries: '#a78bfa',
  quaternarySeries: '#34d399'
} as const;

const axisBase = {
  titlefont: { color: chartTheme.textPrimary },
  tickfont: { color: chartTheme.textSecondary },
  showgrid: true,
  gridcolor: chartTheme.grid,
  zeroline: false
};

const layoutBase = {
  autosize: true,
  paper_bgcolor: chartTheme.panelBg,
  plot_bgcolor: chartTheme.panelBg,
  margin: { l: 64, r: 24, t: 24, b: 56 },
  hovermode: 'x unified' as const,
  font: { family: 'Inter, ui-sans-serif, system-ui, sans-serif', size: 12, color: chartTheme.textPrimary },
  legend: { orientation: 'h' as const, x: 0, y: 1.15, font: { color: chartTheme.textSecondary } },
  xaxis: {
    ...axisBase,
    title: { text: 'Datum' },
    tickangle: -25
  },
  hoverlabel: { bgcolor: '#0b1220', font: { color: '#e2e8f0' }, bordercolor: '#334155' }
};

const metricLabels: Record<'order_count' | 'revenue_total' | 'aov', string> = {
  order_count: 'Naročila',
  revenue_total: 'Prihodki (EUR)',
  aov: 'AOV (EUR)'
};

export default function AdminAnalyticsDashboard({ initialData, initialCharts }: Props) {
  const [range, setRange] = useState<RangeOption>(initialData.range);
  const [data, setData] = useState(initialData);
  const [charts, setCharts] = useState(initialCharts);
  const [isLoading, setIsLoading] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builder, setBuilder] = useState<BuilderState>({
    title: 'Novi graf',
    description: '',
    comment: '',
    chartType: 'line',
    yFields: ['order_count'],
    customerType: 'all',
    status: 'all',
    movingAverage7d: false
  });
  const [editingId, setEditingId] = useState<number | null>(null);

  const reloadCharts = async () => {
    const response = await fetch('/api/admin/analytics/charts');
    if (!response.ok) return;
    const payload = (await response.json()) as { charts: AnalyticsChartRow[] };
    setCharts(payload.charts);
  };

  const fetchRange = async (nextRange: RangeOption) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/analytics/orders?range=${nextRange}&grouping=day`);
      if (!response.ok) return;
      const payload = (await response.json()) as OrdersAnalyticsResponse;
      setData(payload);
      setRange(nextRange);
    } finally {
      setIsLoading(false);
    }
  };

  const saveMetadata = async (chartId: number, fields: Partial<Pick<AnalyticsChartRow, 'title' | 'description' | 'comment'>>) => {
    const response = await fetch(`/api/admin/analytics/charts/${chartId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    });
    if (response.ok) {
      await reloadCharts();
      setEditingId(null);
    }
  };

  const deleteChart = async (chartId: number) => {
    const response = await fetch(`/api/admin/analytics/charts/${chartId}`, { method: 'DELETE' });
    if (response.ok) {
      await reloadCharts();
    }
  };

  const reorderChart = async (chartId: number, direction: 'up' | 'down') => {
    const currentIndex = charts.findIndex((chart) => chart.id === chartId);
    if (currentIndex < 0) return;
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= charts.length) return;

    const reordered = [...charts];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, moved);
    setCharts(reordered);

    await fetch('/api/admin/analytics/charts/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: reordered.map((chart) => chart.id) })
    });
    await reloadCharts();
  };

  const createChart = async () => {
    const config: AnalyticsChartConfig = {
      dataset: 'orders_daily',
      xField: 'date',
      yFields: builder.yFields,
      filters: {
        customerType: builder.customerType,
        status: builder.status
      },
      transforms: {
        movingAverage7d: builder.movingAverage7d
      }
    };

    const response = await fetch('/api/admin/analytics/charts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: builder.title,
        description: builder.description,
        comment: builder.comment,
        chartType: builder.chartType,
        config
      })
    });

    if (response.ok) {
      setBuilderOpen(false);
      await reloadCharts();
    }
  };

  const renderedCharts = useMemo(() => {
    return charts.map((chart) => {
      const filteredDays = data.days.filter((day) => {
        const customerType = chart.config_json.filters?.customerType ?? 'all';
        const status = chart.config_json.filters?.status ?? 'all';

        const customerAllowed =
          customerType === 'all' ? true : (day.customer_type_buckets[customerType] ?? 0) > 0;
        const statusAllowed = status === 'all' ? true : (day.status_buckets[status] ?? 0) > 0;

        return customerAllowed && statusAllowed;
      });

      const dates = filteredDays.map((day) => day.date);
      const traces: Array<Record<string, unknown>> = [];

      chart.config_json.yFields.forEach((metric, index) => {
        const rawValues = filteredDays.map((day) => day[metric]);
        const values = rawValues.map((value) => (typeof value === 'number' ? value : 0));
        const color =
          index === 0
            ? chartTheme.primarySeries
            : index === 1
              ? chartTheme.tertiarySeries
              : chartTheme.quaternarySeries;

        const baseTrace: Record<string, unknown> =
          chart.chart_type === 'bar'
            ? {
                type: 'bar',
                x: dates,
                y: values,
                marker: { color, opacity: 0.78 }
              }
            : {
                type: 'scatter',
                mode: 'lines+markers',
                x: dates,
                y: values,
                line: { color, width: 2, shape: 'linear' },
                marker: { color, size: 4 },
                fill: chart.chart_type === 'area' ? 'tozeroy' : undefined
              };

        traces.push({
          ...baseTrace,
          name: metricLabels[metric],
          hovertemplate:
            metric === 'order_count'
              ? 'Datum: %{x}<br>Naročila: %{y:d}<extra></extra>'
              : `Datum: %{x}<br>${metricLabels[metric]}: %{y:.2f} EUR<extra></extra>`
        });

        if (chart.config_json.transforms?.movingAverage7d) {
          const ma7 = movingAverage(values, 7);
          traces.push({
            type: 'scatter',
            mode: 'lines',
            x: dates,
            y: ma7,
            name: `${metricLabels[metric]} 7d MA`,
            line: {
              color: chartTheme.secondarySeries,
              width: 2,
              dash: 'dot'
            },
            hovertemplate:
              metric === 'order_count'
                ? 'Datum: %{x}<br>7d MA: %{y:.2f}<extra></extra>'
                : `Datum: %{x}<br>7d MA: %{y:.2f} EUR<extra></extra>`
          });
        }
      });

      return {
        chart,
        dates,
        traces
      };
    });
  }, [charts, data.days]);

  const builderPreviewChart: AnalyticsChartRow = {
    id: -1,
    dashboard_key: 'narocila',
    key: 'preview',
    title: builder.title,
    description: builder.description,
    comment: builder.comment,
    chart_type: builder.chartType,
    config_json: {
      dataset: 'orders_daily',
      xField: 'date',
      yFields: builder.yFields,
      filters: { customerType: builder.customerType, status: builder.status },
      transforms: { movingAverage7d: builder.movingAverage7d }
    },
    position: 0,
    is_system: false,
    created_at: '',
    updated_at: ''
  };

  return (
    <div className="min-h-full rounded-2xl border border-slate-800 bg-slate-950 p-4 text-slate-100">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Analitika naročil</h1>
          <p className="text-xs text-slate-400">Temni kontrastni prikaz, agregacija po dnevih (UTC).</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-0.5">
            {(['30d', '90d', '180d'] as RangeOption[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => void fetchRange(option)}
                className={`rounded-md px-2 py-1 text-xs font-semibold ${
                  option === range ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setBuilderOpen(true)}
            className="rounded-md border border-cyan-500 bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500"
          >
            Create chart
          </button>
        </div>
      </div>

      {isLoading ? <p className="mb-2 text-xs text-slate-400">Nalagam podatke…</p> : null}

      <div className="space-y-4">
        {renderedCharts.map(({ chart, traces }) => (
          <ChartCard
            key={chart.id}
            chart={chart}
            editing={editingId === chart.id}
            onStartEdit={() => setEditingId(chart.id)}
            onCancelEdit={() => setEditingId(null)}
            onSaveMetadata={saveMetadata}
            onDelete={deleteChart}
            onMoveUp={() => void reorderChart(chart.id, 'up')}
            onMoveDown={() => void reorderChart(chart.id, 'down')}
          >
            <PlotlyClient
              data={traces}
              layout={{
                ...layoutBase,
                yaxis: {
                  ...axisBase,
                  title: {
                    text:
                      chart.config_json.yFields.length === 1 && chart.config_json.yFields[0] === 'order_count'
                        ? 'Število naročil'
                        : 'Vrednost'
                  },
                  rangemode: 'tozero'
                }
              }}
              config={{ responsive: true, displayModeBar: false }}
              useResizeHandler
              style={{ width: '100%', height: 360 }}
            />
          </ChartCard>
        ))}
      </div>

      {builderOpen ? (
        <BuilderModal
          builder={builder}
          onChange={setBuilder}
          onClose={() => setBuilderOpen(false)}
          onSave={() => void createChart()}
          previewChart={builderPreviewChart}
          data={data}
        />
      ) : null}
    </div>
  );
}

function ChartCard({
  chart,
  children,
  editing,
  onStartEdit,
  onCancelEdit,
  onSaveMetadata,
  onDelete,
  onMoveUp,
  onMoveDown
}: {
  chart: AnalyticsChartRow;
  children: ReactNode;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveMetadata: (
    chartId: number,
    fields: Partial<Pick<AnalyticsChartRow, 'title' | 'description' | 'comment'>>
  ) => Promise<void>;
  onDelete: (chartId: number) => Promise<void>;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [title, setTitle] = useState(chart.title);
  const [description, setDescription] = useState(chart.description ?? '');
  const [comment, setComment] = useState(chart.comment ?? '');

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-lg">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-2">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-sm text-slate-100"
              />
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-300"
                placeholder="Opis"
              />
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-300"
                placeholder="Komentar"
                rows={2}
              />
            </div>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-slate-100">{chart.title}</h2>
              {chart.description ? <p className="text-xs text-slate-400">{chart.description}</p> : null}
              {chart.comment ? <p className="mt-1 rounded bg-slate-800/60 px-2 py-1 text-xs text-slate-300">{chart.comment}</p> : null}
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => void onSaveMetadata(chart.id, { title, description, comment })}
                className="rounded border border-emerald-500 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-950"
              >
                Save
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onStartEdit}
              className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              Edit
            </button>
          )}

          <button type="button" onClick={onMoveUp} className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800">↑</button>
          <button type="button" onClick={onMoveDown} className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800">↓</button>

          {!chart.is_system ? (
            <button
              type="button"
              onClick={() => void onDelete(chart.id)}
              className="rounded border border-rose-500 px-2 py-1 text-xs text-rose-300 hover:bg-rose-950"
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function BuilderModal({
  builder,
  onChange,
  onClose,
  onSave,
  previewChart,
  data
}: {
  builder: BuilderState;
  onChange: (next: BuilderState) => void;
  onClose: () => void;
  onSave: () => void;
  previewChart: AnalyticsChartRow;
  data: OrdersAnalyticsResponse;
}) {
  const previewTraceValues = data.days.map((day) => day[builder.yFields[0]] as number);
  const previewMA = movingAverage(previewTraceValues, 7);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="max-h-[90vh] w-[980px] overflow-auto rounded-xl border border-slate-700 bg-slate-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">Create chart</h3>
          <button type="button" onClick={onClose} className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300">Close</button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs text-slate-300">Title
            <input className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1" value={builder.title} onChange={(event) => onChange({ ...builder, title: event.target.value })} />
          </label>
          <label className="text-xs text-slate-300">Chart type
            <select className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1" value={builder.chartType} onChange={(event) => onChange({ ...builder, chartType: event.target.value as AnalyticsChartType })}>
              <option value="line">Line</option>
              <option value="bar">Bar</option>
              <option value="area">Area</option>
            </select>
          </label>
          <label className="text-xs text-slate-300">Description
            <input className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1" value={builder.description} onChange={(event) => onChange({ ...builder, description: event.target.value })} />
          </label>
          <label className="text-xs text-slate-300">Comment
            <input className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1" value={builder.comment} onChange={(event) => onChange({ ...builder, comment: event.target.value })} />
          </label>
          <label className="text-xs text-slate-300">Y field(s)
            <select
              multiple
              className="mt-1 h-24 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1"
              value={builder.yFields}
              onChange={(event) => {
                const values = Array.from(event.target.selectedOptions).map((option) => option.value) as Array<'order_count' | 'revenue_total' | 'aov'>;
                onChange({ ...builder, yFields: values.length > 0 ? values : ['order_count'] });
              }}
            >
              <option value="order_count">Naročila</option>
              <option value="revenue_total">Prihodki</option>
              <option value="aov">AOV</option>
            </select>
          </label>
          <label className="text-xs text-slate-300">Customer type filter
            <select className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1" value={builder.customerType} onChange={(event) => onChange({ ...builder, customerType: event.target.value as BuilderState['customerType'] })}>
              <option value="all">All</option>
              <option value="P">P</option>
              <option value="Š">Š</option>
              <option value="F">F</option>
            </select>
          </label>
          <label className="text-xs text-slate-300">Status filter
            <input className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1" value={builder.status} onChange={(event) => onChange({ ...builder, status: event.target.value || 'all' })} placeholder="all / status code" />
          </label>
          <label className="mt-6 inline-flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={builder.movingAverage7d} onChange={(event) => onChange({ ...builder, movingAverage7d: event.target.checked })} />
            Add 7d moving average
          </label>
        </div>

        <div className="mt-4 rounded border border-slate-700 bg-slate-950 p-3">
          <p className="mb-2 text-xs text-slate-400">Preview: {previewChart.title}</p>
          <PlotlyClient
            data={[
              {
                type: builder.chartType === 'bar' ? 'bar' : 'scatter',
                mode: builder.chartType === 'bar' ? undefined : 'lines+markers',
                fill: builder.chartType === 'area' ? 'tozeroy' : undefined,
                name: metricLabels[builder.yFields[0]],
                x: data.days.map((day) => day.date),
                y: previewTraceValues,
                marker: { color: chartTheme.primarySeries },
                line: { color: chartTheme.primarySeries, width: 2 },
                hovertemplate: 'Datum: %{x}<br>Vrednost: %{y}<extra></extra>'
              },
              ...(builder.movingAverage7d
                ? [
                    {
                      type: 'scatter' as const,
                      mode: 'lines' as const,
                      name: '7d MA',
                      x: data.days.map((day) => day.date),
                      y: previewMA,
                      line: { color: chartTheme.secondarySeries, width: 2, dash: 'dot' as const },
                      hovertemplate: 'Datum: %{x}<br>7d MA: %{y:.2f}<extra></extra>'
                    }
                  ]
                : [])
            ]}
            layout={{
              ...layoutBase,
              yaxis: { ...axisBase, title: { text: 'Vrednost' }, rangemode: 'tozero' }
            }}
            config={{ responsive: true, displayModeBar: false }}
            style={{ width: '100%', height: 300 }}
            useResizeHandler
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-300">Cancel</button>
          <button type="button" onClick={onSave} className="rounded border border-cyan-500 bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white">Save chart</button>
        </div>
      </div>
    </div>
  );
}
