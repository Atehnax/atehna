'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import PlotlyClient from '@/components/admin/charts/PlotlyClient';
import { getBaseChartLayout, getChartThemeFromCssVars, type ChartTheme } from '@/components/admin/charts/chartTheme';
import type { Data, Layout } from 'plotly.js';
import type { OrdersAnalyticsResponse } from '@/lib/server/orderAnalytics';
import type {
  AnalyticsChartConfig,
  AnalyticsChartRow,
  AnalyticsChartSeries,
  AnalyticsChartType,
  AnalyticsMetricField,
  AnalyticsGlobalAppearance
} from '@/lib/server/analyticsCharts';

type RangeOption = '30d' | '90d' | '180d' | '365d';

type Props = {
  initialData: OrdersAnalyticsResponse;
  initialCharts: AnalyticsChartRow[];
  initialFocusKey?: string;
  initialAppearance: AnalyticsGlobalAppearance;
};

const metricOptions: Array<{ value: AnalyticsMetricField; label: string; unit: 'count' | 'eur' | 'percent' | 'hours' }> = [
  { value: 'order_count', label: 'Orders', unit: 'count' },
  { value: 'revenue_total', label: 'Revenue', unit: 'eur' },
  { value: 'aov', label: 'AOV', unit: 'eur' },
  { value: 'median_order_value', label: 'Median order value', unit: 'eur' },
  { value: 'payment_success_rate', label: 'Payment success rate', unit: 'percent' },
  { value: 'cancellation_rate', label: 'Cancellation rate', unit: 'percent' },
  { value: 'lead_time_p50_hours', label: 'Lead time p50', unit: 'hours' },
  { value: 'lead_time_p90_hours', label: 'Lead time p90', unit: 'hours' },
  { value: 'paid_count', label: 'Paid count', unit: 'count' },
  { value: 'cancelled_count', label: 'Cancelled count', unit: 'count' }
];

const chartTypeOptions: AnalyticsChartType[] = [
  'line',
  'spline',
  'area',
  'bar',
  'grouped_bar',
  'stacked_bar',
  'stacked_area',
  'scatter',
  'bubble',
  'histogram',
  'box',
  'heatmap',
  'waterfall',
  'combo'
];

const transformOptions = ['none', 'moving_average_7d', 'cumulative', 'pct_change', 'share_of_total'] as const;

const movingAverage = (values: number[], window = 7) =>
  values.map((_, index) => {
    const start = Math.max(0, index - (window - 1));
    const slice = values.slice(start, index + 1);
    return slice.reduce((sum, value) => sum + value, 0) / Math.max(slice.length, 1);
  });

const cumulative = (values: number[]) => {
  let sum = 0;
  return values.map((value) => {
    sum += value;
    return sum;
  });
};

const pctChange = (values: number[]) =>
  values.map((value, index) => {
    if (index === 0) return 0;
    const previous = values[index - 1] ?? 0;
    if (previous === 0) return 0;
    return ((value - previous) / previous) * 100;
  });

const toSafeNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

const layoutBase = (theme: ChartTheme): Partial<Layout> => ({
  ...getBaseChartLayout(theme),
  margin: { l: 56, r: 24, t: 28, b: 52 },
  hoverlabel: { namelength: -1 }
});

export default function AdminAnalyticsDashboard({ initialData, initialCharts, initialFocusKey = '', initialAppearance }: Props) {
  const chartTheme = useMemo(() => getChartThemeFromCssVars(), []);
  const [range, setRange] = useState<RangeOption>(initialData.range);
  const [data, setData] = useState(initialData);
  const [charts, setCharts] = useState(initialCharts);
  const [focusedKey, setFocusedKey] = useState(initialFocusKey);
  const [loading, setLoading] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingChartId, setEditingChartId] = useState<number | null>(null);
  const [appearance, setAppearance] = useState<AnalyticsGlobalAppearance>(initialAppearance);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [builderConfig, setBuilderConfig] = useState<AnalyticsChartConfig>(() => ({
    dataset: 'orders_daily',
    xField: 'date',
    xTitle: 'Datum',
    xTickFormat: '',
    xDateFormat: '%Y-%m-%d',
    xScale: 'linear',
    yLeftTitle: 'Vrednost',
    yLeftScale: 'linear',
    yLeftTickFormat: '',
    yRightEnabled: false,
    yRightTitle: 'Vrednost (desno)',
    yRightScale: 'linear',
    yRightTickFormat: '',
    grain: 'day',
    quickRange: '365d',
    filters: {
      customerType: 'all',
      status: 'all',
      paymentStatus: 'all',
      includeNulls: true
    },
    series: [newSeries('order_count', chartTheme.series.primary)]
  }));
  const [builderTitle, setBuilderTitle] = useState('New chart');
  const [builderDescription, setBuilderDescription] = useState('');
  const [builderComment, setBuilderComment] = useState('');
  const [builderChartType, setBuilderChartType] = useState<AnalyticsChartType>('combo');

  const reloadCharts = async () => {
    const response = await fetch('/api/admin/analytics/charts');
    if (!response.ok) return;
    const payload = (await response.json()) as { charts: AnalyticsChartRow[]; appearance?: AnalyticsGlobalAppearance };
    setCharts(payload.charts);
    if (payload.appearance) setAppearance(payload.appearance);
  };

  const loadRange = async (nextRange: RangeOption) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/analytics/orders?range=${nextRange}&grouping=day`);
      if (!response.ok) return;
      const payload = (await response.json()) as OrdersAnalyticsResponse;
      setData(payload);
      setRange(nextRange);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = window.localStorage.getItem('admin-analytics-range');
    if (saved === '30d' || saved === '90d' || saved === '180d' || saved === '365d') {
      void loadRange(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.localStorage.setItem('admin-analytics-range', range);
  }, [range]);

  const saveMetadata = async (
    chartId: number,
    fields: Partial<Pick<AnalyticsChartRow, 'title' | 'description' | 'comment' | 'chart_type' | 'config_json'>>
  ) => {
    const response = await fetch(`/api/admin/analytics/charts/${chartId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: fields.title,
        description: fields.description,
        comment: fields.comment,
        chartType: fields.chart_type,
        config: fields.config_json
      })
    });

    if (response.ok) {
      await reloadCharts();
      setEditingChartId(null);
    }
  };

  const deleteChart = async (chartId: number) => {
    const confirmed = window.confirm('Ali res želite izbrisati ta graf?');
    if (!confirmed) return;

    const previous = charts;
    setCharts((current) => current.filter((chart) => chart.id !== chartId));
    const response = await fetch(`/api/admin/analytics/charts/${chartId}`, { method: 'DELETE' });
    if (!response.ok) {
      setCharts(previous);
      return;
    }

    if (editingChartId === chartId) {
      setBuilderOpen(false);
      setEditingChartId(null);
    }

    await reloadCharts();
  };

  const persistOrder = async (updated: AnalyticsChartRow[], fallback?: AnalyticsChartRow[]) => {
    const response = await fetch('/api/admin/analytics/charts/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: updated.map((chart) => chart.id) })
    });

    if (!response.ok && fallback) {
      setCharts(fallback);
      return;
    }

    await reloadCharts();
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = charts.findIndex((chart) => chart.id === Number(active.id));
    const newIndex = charts.findIndex((chart) => chart.id === Number(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const previous = charts;
    const updated = arrayMove(charts, oldIndex, newIndex);
    setCharts(updated);
    await persistOrder(updated, previous);
  };

  const createOrUpdateChart = async () => {
    const url = editingChartId ? `/api/admin/analytics/charts/${editingChartId}` : '/api/admin/analytics/charts';
    const method = editingChartId ? 'PATCH' : 'POST';
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: builderTitle,
        description: builderDescription,
        comment: builderComment,
        chartType: builderChartType,
        config: builderConfig
      })
    });

    if (response.ok) {
      setBuilderOpen(false);
      setEditingChartId(null);
      await reloadCharts();
    }
  };

  const chartRenderModels = useMemo(() => {
    return charts.map((chart) => buildChartModel(chart, data, chartTheme, appearance));
  }, [charts, data, chartTheme, appearance]);

  return (
    <div className="min-h-full rounded-2xl border border-[var(--chart-border)] bg-[var(--chart-canvas)] p-4 text-[var(--chart-text)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Analytics (Orders)</h1>
          <p className="text-xs text-slate-400">Timezone bucketing: UTC. Dark non-black pro mode enabled.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-0.5">
            {(['30d', '90d', '180d', '365d'] as RangeOption[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => void loadRange(option)}
                className={`rounded-md px-2 py-1 text-xs font-semibold ${
                  range === option ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { setEditingChartId(null); setBuilderTitle('New chart'); setBuilderDescription(''); setBuilderComment(''); setBuilderChartType('combo'); setBuilderOpen(true); }}
            className="rounded-md border border-cyan-500 bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500"
          >
            New Chart
          </button>
        </div>
      </div>

      <AppearancePanel
        appearance={appearance}
        onSave={async (nextAppearance) => {
          setAppearance(nextAppearance);
          await fetch('/api/admin/analytics/charts/appearance', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nextAppearance)
          });
        }}
      />

      {loading ? <p className="mb-2 text-xs text-slate-400">Loading analytics…</p> : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void onDragEnd(event)}>
        <SortableContext items={chartRenderModels.map((model) => model.chart.id)} strategy={rectSortingStrategy}>
          <div className="grid gap-4 md:grid-cols-2">
            {chartRenderModels.map((model) => (
          <ChartCard
            key={model.chart.id}
            chart={model.chart}
            isFocused={focusedKey === model.chart.key}
            onFocus={() => setFocusedKey(model.chart.key)}
            onEdit={() => {
              setEditingChartId(model.chart.id);
              setBuilderTitle(model.chart.title);
              setBuilderDescription(model.chart.description ?? '');
              setBuilderComment(model.chart.comment ?? '');
              setBuilderChartType(model.chart.chart_type);
              setBuilderConfig(model.chart.config_json);
              setBuilderOpen(true);
            }}
            onDelete={() => void deleteChart(model.chart.id)}
            onExportCsv={() => exportCsv(model.chart.title, model.x, model.exportRows)}
          >
            <PlotlyClient
              data={model.traces}
              layout={model.layout}
              config={{ responsive: true, displayModeBar: true }}
              useResizeHandler
              style={{ width: '100%', height: 300 }}
              onClick={() => setFocusedKey(model.chart.key)}
            />
          </ChartCard>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {builderOpen ? (
        <BuilderModal
          title={builderTitle}
          description={builderDescription}
          comment={builderComment}
          chartType={builderChartType}
          config={builderConfig}
          data={data}
          onChangeTitle={setBuilderTitle}
          onChangeDescription={setBuilderDescription}
          onChangeComment={setBuilderComment}
          onChangeChartType={setBuilderChartType}
          onChangeConfig={setBuilderConfig}
          onClose={() => { setBuilderOpen(false); setEditingChartId(null); }}
          onSave={() => void createOrUpdateChart()}
          chartTheme={chartTheme}
          mode={editingChartId ? 'edit' : 'create'}
          onDelete={editingChartId ? () => void deleteChart(editingChartId) : undefined}
          appearance={appearance}
        />
      ) : null}
    </div>
  );
}

function buildChartModel(chart: AnalyticsChartRow, data: OrdersAnalyticsResponse, theme: ChartTheme, globalAppearance: AnalyticsGlobalAppearance) {
  const days = applyChartFiltersAndGrain(data, chart.config_json);
  const x = days.map((day) => day.date);

  const enabledSeries = chart.config_json.series.filter((series) => series.enabled);
  const traces: Data[] = [];
  const exportRows: Array<Record<string, string | number>> = [];

  enabledSeries.forEach((series, index) => {
    const metricValues = extractSeriesValues(days, series);
    const trace = seriesToTrace(series, x, metricValues, index, chart.chart_type);
    traces.push(trace);

    x.forEach((date, valueIndex) => {
      if (!exportRows[valueIndex]) exportRows[valueIndex] = { date };
      exportRows[valueIndex][series.axis_label || series.field_key] = Number(metricValues[valueIndex] ?? 0);
    });
  });

  const chartAppearance = chart.config_json.appearance ?? {};
  const resolvedCardBg = chartAppearance.cardBg || globalAppearance.cardBg || theme.card;
  const resolvedPlotBg = chartAppearance.plotBg || globalAppearance.plotBg || resolvedCardBg;
  const resolvedGrid = `rgba(148, 163, 184, ${chartAppearance.gridOpacity ?? globalAppearance.gridOpacity ?? 0.2})`;

  const layout: Partial<Layout> = {
    ...layoutBase(theme),
    paper_bgcolor: resolvedCardBg,
    plot_bgcolor: resolvedPlotBg,
    xaxis: {
      title: { text: chart.config_json.xTitle || 'Datum' },
      tickformat: chart.config_json.xTickFormat || undefined,
      type: chart.config_json.xScale === 'log' ? 'log' : 'date',
      gridcolor: resolvedGrid,
      tickfont: { color: theme.mutedText },
    },
    yaxis: {
      title: { text: chart.config_json.yLeftTitle || 'Value' },
      tickformat: chart.config_json.yLeftTickFormat || undefined,
      type: chart.config_json.yLeftScale === 'log' ? 'log' : 'linear',
      gridcolor: resolvedGrid,
      tickfont: { color: theme.mutedText },
      hoverformat: '%Y-%m-%d'
    },
    barmode:
      chart.chart_type === 'stacked_bar' || chart.chart_type === 'stacked_area'
        ? 'stack'
        : chart.chart_type === 'grouped_bar'
          ? 'group'
          : 'overlay'
  };

  if (chart.config_json.yRightEnabled) {
    layout.yaxis2 = {
      title: { text: chart.config_json.yRightTitle || 'Right axis' },
      overlaying: 'y',
      side: 'right',
      type: chart.config_json.yRightScale === 'log' ? 'log' : 'linear',
      tickformat: chart.config_json.yRightTickFormat || undefined,
      tickfont: { color: theme.mutedText },
    };
  }

  return {
    chart,
    x,
    traces,
    layout,
    exportRows
  };
}

function applyChartFiltersAndGrain(data: OrdersAnalyticsResponse, config: AnalyticsChartConfig) {
  const filtered = data.days.filter((day) => {
    const customerPass =
      config.filters.customerType === 'all'
        ? true
        : (day.customer_type_buckets[config.filters.customerType] ?? 0) > 0;

    const statusPass = config.filters.status === 'all' ? true : (day.status_buckets[config.filters.status] ?? 0) > 0;
    const paymentPass =
      config.filters.paymentStatus === 'all'
        ? true
        : (day.payment_status_buckets[config.filters.paymentStatus] ?? 0) > 0;

    return customerPass && statusPass && paymentPass;
  });

  if (config.grain === 'day') return filtered;

  const grouped = new Map<string, typeof filtered[number][]>();
  filtered.forEach((day) => {
    const date = new Date(`${day.date}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return;

    let key = day.date;
    if (config.grain === 'week') {
      const weekStart = new Date(date);
      const dow = weekStart.getUTCDay();
      const delta = (dow + 6) % 7;
      weekStart.setUTCDate(weekStart.getUTCDate() - delta);
      key = weekStart.toISOString().slice(0, 10);
    } else if (config.grain === 'month') {
      key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
    } else if (config.grain === 'quarter') {
      const quarter = Math.floor(date.getUTCMonth() / 3) * 3 + 1;
      key = `${date.getUTCFullYear()}-${String(quarter).padStart(2, '0')}-01`;
    }

    const bucket = grouped.get(key) ?? [];
    bucket.push(day);
    grouped.set(key, bucket);
  });

  return Array.from(grouped.entries())
    .map(([date, rows]) => {
      const orderCount = rows.reduce((sum, row) => sum + row.order_count, 0);
      const revenue = rows.reduce((sum, row) => sum + row.revenue_total, 0);
      const aov = orderCount > 0 ? revenue / orderCount : 0;
      const median = rows.reduce((sum, row) => sum + row.median_order_value, 0) / Math.max(rows.length, 1);
      const paymentSuccess = rows.reduce((sum, row) => sum + row.payment_success_rate, 0) / Math.max(rows.length, 1);
      const cancelRate = rows.reduce((sum, row) => sum + row.cancellation_rate, 0) / Math.max(rows.length, 1);
      const p50 = rows.reduce((sum, row) => sum + (row.lead_time_p50_hours ?? 0), 0) / Math.max(rows.length, 1);
      const p90 = rows.reduce((sum, row) => sum + (row.lead_time_p90_hours ?? 0), 0) / Math.max(rows.length, 1);

      return {
        ...rows[0],
        date,
        order_count: orderCount,
        revenue_total: Number(revenue.toFixed(2)),
        aov: Number(aov.toFixed(2)),
        median_order_value: Number(median.toFixed(2)),
        payment_success_rate: Number(paymentSuccess.toFixed(2)),
        cancellation_rate: Number(cancelRate.toFixed(2)),
        lead_time_p50_hours: Number(p50.toFixed(2)),
        lead_time_p90_hours: Number(p90.toFixed(2))
      };
    })
    .sort((left, right) => left.date.localeCompare(right.date));
}

function extractSeriesValues(days: OrdersAnalyticsResponse['days'], series: AnalyticsChartSeries) {
  const baseValues = days.map((day) => toSafeNumber(day[series.field_key]));

  switch (series.transform) {
    case 'moving_average_7d':
      return movingAverage(baseValues, 7);
    case 'cumulative':
      return cumulative(baseValues);
    case 'pct_change':
      return pctChange(baseValues);
    case 'share_of_total': {
      const total = baseValues.reduce((sum, value) => sum + value, 0);
      if (total === 0) return baseValues.map(() => 0);
      return baseValues.map((value) => (value / total) * 100);
    }
    default:
      return baseValues;
  }
}

function seriesToTrace(
  series: AnalyticsChartSeries,
  x: string[],
  y: number[],
  index: number,
  chartType: AnalyticsChartType
): Data {
  const resolvedType = chartType === 'combo' ? series.chart_type : chartType;
  const yaxis = series.axis_side === 'right' ? 'y2' : 'y';
  const name = series.axis_label || series.field_key;

  if (resolvedType === 'bar' || resolvedType === 'grouped_bar' || resolvedType === 'stacked_bar') {
    return {
      type: 'bar',
      name,
      x,
      y,
      yaxis,
      marker: { color: series.color, opacity: series.opacity },
      hovertemplate: `${name}: %{y:,.2f}<extra></extra>`
    };
  }

  if (resolvedType === 'bubble') {
    return {
      type: 'scatter',
      mode: 'markers',
      name,
      x,
      y,
      yaxis,
      marker: {
        color: series.color,
        opacity: series.opacity,
        size: y.map((value) => Math.max(8, Math.sqrt(Math.abs(value)))),
        sizemode: 'diameter'
      },
      hovertemplate: `${name}: %{y:,.2f}<extra></extra>`
    };
  }

  if (resolvedType === 'histogram') {
    return {
      type: 'histogram',
      name,
      x: y,
      marker: { color: series.color, opacity: series.opacity },
      hovertemplate: `${name}: %{x:,.2f}<extra></extra>`
    };
  }

  if (resolvedType === 'box') {
    return {
      type: 'box',
      name,
      y,
      marker: { color: series.color },
      boxpoints: 'all',
      jitter: 0.3,
      pointpos: -1.8
    };
  }

  if (resolvedType === 'heatmap') {
    return {
      type: 'heatmap',
      z: [y],
      x,
      y: [name],
      colorscale: 'Viridis',
      hovertemplate: `${name}: %{z:,.2f}<extra></extra>`
    };
  }

  if (resolvedType === 'waterfall') {
    return {
      type: 'waterfall',
      x,
      y,
      name,
      yaxis,
    };
  }

  const mode = resolvedType === 'scatter' ? 'markers' : resolvedType === 'spline' ? 'lines+markers' : 'lines+markers';
  return {
    type: 'scatter',
    mode,
    name,
    x,
    y,
    yaxis,
    line: {
      color: series.color,
      width: series.line_width,
      shape: resolvedType === 'spline' ? 'spline' : 'linear'
    },
    fill: resolvedType === 'area' || resolvedType === 'stacked_area' ? 'tozeroy' : undefined,
    opacity: series.opacity,
    hovertemplate: `${name}: %{y:,.2f}<extra></extra>`
  };
}

function ChartCard({
  chart,
  children,
  onEdit,
  onDelete,
  onExportCsv,
  isFocused,
  onFocus
}: {
  chart: AnalyticsChartRow;
  children: ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  onExportCsv: () => void;
  isFocused: boolean;
  onFocus: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: chart.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border p-3 shadow-lg transition ${
        isDragging ? 'opacity-80 ring-2 ring-cyan-500' : ''
      } ${isFocused ? 'border-cyan-500 bg-[var(--chart-card)]' : 'border-[var(--chart-border)] bg-[var(--chart-card)]'}`}
      onClick={onFocus}
      {...attributes}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-100">{chart.title}</h2>
          {chart.description ? <p className="text-xs text-slate-400">{chart.description}</p> : null}
          {chart.comment ? <p className="mt-1 rounded bg-slate-900/70 px-2 py-1 text-xs text-slate-300">{chart.comment}</p> : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button className="cursor-grab rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 active:cursor-grabbing" {...listeners} aria-label="Drag chart">↕</button>
          <button className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300" onClick={onEdit}>Edit</button>
          <button className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300" onClick={onExportCsv}>CSV</button>
          <button className="rounded border border-rose-500 px-2 py-1 text-xs text-rose-300" onClick={onDelete}>Delete</button>
        </div>
      </div>
      {children}
    </section>
  );
}

function BuilderModal({
  title,
  description,
  comment,
  chartType,
  config,
  data,
  onChangeTitle,
  onChangeDescription,
  onChangeComment,
  onChangeChartType,
  onChangeConfig,
  onClose,
  onSave,
  chartTheme,
  appearance,
  mode,
  onDelete
}: {
  title: string;
  description: string;
  comment: string;
  chartType: AnalyticsChartType;
  config: AnalyticsChartConfig;
  data: OrdersAnalyticsResponse;
  onChangeTitle: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onChangeComment: (value: string) => void;
  onChangeChartType: (value: AnalyticsChartType) => void;
  onChangeConfig: (value: AnalyticsChartConfig) => void;
  onClose: () => void;
  onSave: () => void;
  chartTheme: ChartTheme;
  appearance: AnalyticsGlobalAppearance;
  mode: 'create' | 'edit';
  onDelete?: () => void;
}) {
  const previewChart: AnalyticsChartRow = {
    id: -1,
    dashboard_key: 'narocila',
    key: 'preview',
    title,
    description,
    comment,
    chart_type: chartType,
    config_json: config,
    position: 0,
    is_system: false,
    created_at: '',
    updated_at: ''
  };

  const preview = buildChartModel(previewChart, data, chartTheme, appearance);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 p-4">
      <div className="max-h-[92vh] w-[1180px] overflow-auto rounded-xl border border-slate-700 bg-slate-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">{mode === 'edit' ? 'Edit chart' : 'New chart'}</h3>
          <div className="flex items-center gap-2">
            {onDelete ? <button className="rounded border border-rose-500 px-2 py-1 text-xs text-rose-300" onClick={onDelete}>Delete</button> : null}
            <button className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <LabeledInput label="Title" value={title} onChange={onChangeTitle} />
          <label className="text-xs text-slate-300">Chart type
            <select value={chartType} onChange={(event) => onChangeChartType(event.target.value as AnalyticsChartType)} className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1">
              {chartTypeOptions.map((typeOption) => (
                <option key={typeOption} value={typeOption}>{typeOption}</option>
              ))}
            </select>
          </label>
          <LabeledInput label="Description" value={description} onChange={onChangeDescription} />
          <LabeledInput label="Comment" value={comment} onChange={onChangeComment} />
          <LabeledInput label="X axis title" value={config.xTitle} onChange={(value) => onChangeConfig({ ...config, xTitle: value })} />
          <LabeledInput label="Y left title" value={config.yLeftTitle} onChange={(value) => onChangeConfig({ ...config, yLeftTitle: value })} />
          <LabeledInput label="Y right title" value={config.yRightTitle} onChange={(value) => onChangeConfig({ ...config, yRightTitle: value })} />
          <label className="mt-6 inline-flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={config.yRightEnabled} onChange={(event) => onChangeConfig({ ...config, yRightEnabled: event.target.checked })} />
            Enable right axis
          </label>

          <label className="text-xs text-slate-300">Grouping grain
            <select className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1" value={config.grain} onChange={(event) => onChangeConfig({ ...config, grain: event.target.value as AnalyticsChartConfig['grain'] })}>
              <option value="day">day</option>
              <option value="week">week</option>
              <option value="month">month</option>
              <option value="quarter">quarter</option>
            </select>
          </label>

          <label className="text-xs text-slate-300">Left axis scale
            <select className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1" value={config.yLeftScale} onChange={(event) => onChangeConfig({ ...config, yLeftScale: event.target.value as 'linear' | 'log' })}>
              <option value="linear">linear</option>
              <option value="log">log</option>
            </select>
          </label>
          <label className="text-xs text-slate-300">Right axis scale
            <select className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1" value={config.yRightScale} onChange={(event) => onChangeConfig({ ...config, yRightScale: event.target.value as 'linear' | 'log' })}>
              <option value="linear">linear</option>
              <option value="log">log</option>
            </select>
          </label>

          <label className="text-xs text-slate-300">Customer type filter
            <select className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1" value={config.filters.customerType} onChange={(event) => onChangeConfig({ ...config, filters: { ...config.filters, customerType: event.target.value as AnalyticsChartConfig['filters']['customerType'] } })}>
              <option value="all">all</option>
              <option value="P">P</option>
              <option value="Š">Š</option>
              <option value="F">F</option>
            </select>
          </label>
          <LabeledInput label="Status filter" value={config.filters.status} onChange={(value) => onChangeConfig({ ...config, filters: { ...config.filters, status: value || 'all' } })} />
        </div>

        <div className="mt-4 overflow-x-auto rounded border border-slate-700">
          <table className="min-w-full text-xs text-slate-300">
            <thead className="bg-slate-800 text-slate-400">
              <tr>
                <th className="px-2 py-1 text-left">enabled</th>
                <th className="px-2 py-1 text-left">metric</th>
                <th className="px-2 py-1 text-left">aggregation</th>
                <th className="px-2 py-1 text-left">transform</th>
                <th className="px-2 py-1 text-left">chart type</th>
                <th className="px-2 py-1 text-left">stack group</th>
                <th className="px-2 py-1 text-left">axis side</th>
                <th className="px-2 py-1 text-left">axis label</th>
                <th className="px-2 py-1 text-left">color</th>
                <th className="px-2 py-1 text-left">line width</th>
                <th className="px-2 py-1 text-left">opacity</th>
                <th className="px-2 py-1 text-left">label format</th>
                <th className="px-2 py-1 text-left">action</th>
              </tr>
            </thead>
            <tbody>
              {config.series.map((series, index) => (
                <tr key={series.id} className="border-t border-slate-800">
                  <td className="px-2 py-1"><input type="checkbox" checked={series.enabled} onChange={(event) => onChangeConfig(updateSeries(config, index, { enabled: event.target.checked }))} /></td>
                  <td className="px-2 py-1">
                    <select value={series.field_key} className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5" onChange={(event) => onChangeConfig(updateSeries(config, index, { field_key: event.target.value as AnalyticsMetricField }))}>
                      {metricOptions.map((metricOption) => (
                        <option key={metricOption.value} value={metricOption.value}>{metricOption.value}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <select value={series.aggregation} className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5" onChange={(event) => onChangeConfig(updateSeries(config, index, { aggregation: event.target.value as AnalyticsChartSeries['aggregation'] }))}>
                      <option value="sum">sum</option><option value="count">count</option><option value="avg">avg</option><option value="median">median</option><option value="min">min</option><option value="max">max</option><option value="p90">p90</option><option value="distinct_count">distinct_count</option>
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <select value={series.transform} className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5" onChange={(event) => onChangeConfig(updateSeries(config, index, { transform: event.target.value as AnalyticsChartSeries['transform'] }))}>
                      {transformOptions.map((transformOption) => <option key={transformOption} value={transformOption}>{transformOption}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <select value={series.chart_type} className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5" onChange={(event) => onChangeConfig(updateSeries(config, index, { chart_type: event.target.value as AnalyticsChartType }))}>
                      {chartTypeOptions.map((typeOption) => <option key={typeOption} value={typeOption}>{typeOption}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1"><input value={series.stack_group} className="w-20 rounded border border-slate-700 bg-slate-950 px-1 py-0.5" onChange={(event) => onChangeConfig(updateSeries(config, index, { stack_group: event.target.value }))} /></td>
                  <td className="px-2 py-1">
                    <select value={series.axis_side} className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5" onChange={(event) => onChangeConfig(updateSeries(config, index, { axis_side: event.target.value as 'left' | 'right' }))}>
                      <option value="left">left</option>
                      <option value="right">right</option>
                    </select>
                  </td>
                  <td className="px-2 py-1"><input value={series.axis_label} className="w-24 rounded border border-slate-700 bg-slate-950 px-1 py-0.5" onChange={(event) => onChangeConfig(updateSeries(config, index, { axis_label: event.target.value }))} /></td>
                  <td className="px-2 py-1"><input type="color" value={series.color} onChange={(event) => onChangeConfig(updateSeries(config, index, { color: event.target.value }))} /></td>
                  <td className="px-2 py-1"><input type="number" min={1} max={8} value={series.line_width} className="w-14 rounded border border-slate-700 bg-slate-950 px-1 py-0.5" onChange={(event) => onChangeConfig(updateSeries(config, index, { line_width: Number(event.target.value) }))} /></td>
                  <td className="px-2 py-1"><input type="number" min={0.1} max={1} step={0.1} value={series.opacity} className="w-14 rounded border border-slate-700 bg-slate-950 px-1 py-0.5" onChange={(event) => onChangeConfig(updateSeries(config, index, { opacity: Number(event.target.value) }))} /></td>
                  <td className="px-2 py-1"><input value={series.label_format} className="w-16 rounded border border-slate-700 bg-slate-950 px-1 py-0.5" onChange={(event) => onChangeConfig(updateSeries(config, index, { label_format: event.target.value }))} /></td>
                  <td className="px-2 py-1">
                    <button className="rounded border border-rose-500 px-2 py-0.5 text-[11px] text-rose-300" onClick={() => onChangeConfig({ ...config, series: config.series.filter((_, seriesIndex) => seriesIndex !== index) })}>x</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-2">
          <button className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300" onClick={() => onChangeConfig({ ...config, series: [...config.series, newSeries('order_count', chartTheme.series.tertiary)] })}>+ Add series</button>
        </div>


        <div className="mt-3 grid gap-3 rounded border border-slate-700 bg-slate-950/60 p-3 md:grid-cols-4">
          <label className="text-xs text-slate-300">Chart card bg
            <input type="color" className="mt-1 h-8 w-full rounded border border-slate-700 bg-slate-950" value={config.appearance?.cardBg ?? appearance.cardBg} onChange={(event) => onChangeConfig({ ...config, appearance: { ...(config.appearance ?? {}), cardBg: event.target.value } })} />
          </label>
          <label className="text-xs text-slate-300">Plot area bg
            <input type="color" className="mt-1 h-8 w-full rounded border border-slate-700 bg-slate-950" value={config.appearance?.plotBg ?? appearance.plotBg} onChange={(event) => onChangeConfig({ ...config, appearance: { ...(config.appearance ?? {}), plotBg: event.target.value } })} />
          </label>
          <label className="text-xs text-slate-300">Canvas bg
            <input type="color" className="mt-1 h-8 w-full rounded border border-slate-700 bg-slate-950" value={config.appearance?.canvasBg ?? appearance.canvasBg} onChange={(event) => onChangeConfig({ ...config, appearance: { ...(config.appearance ?? {}), canvasBg: event.target.value } })} />
          </label>
          <label className="text-xs text-slate-300">Grid intensity
            <input type="range" min={0} max={1} step={0.05} className="mt-2 w-full" value={config.appearance?.gridOpacity ?? appearance.gridOpacity} onChange={(event) => onChangeConfig({ ...config, appearance: { ...(config.appearance ?? {}), gridOpacity: Number(event.target.value) } })} />
          </label>
        </div>

        <div className="mt-4 rounded border border-slate-700 bg-slate-950 p-3">
          <p className="mb-2 text-xs text-slate-400">Live preview</p>
          <PlotlyClient data={preview.traces} layout={preview.layout} config={{ responsive: true, displayModeBar: false }} useResizeHandler style={{ width: '100%', height: 320 }} />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-300" onClick={onClose}>Cancel</button>
          <button className="rounded border border-cyan-500 bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white" onClick={onSave}>{mode === 'edit' ? 'Save changes' : 'Save chart'}</button>
        </div>
      </div>
    </div>
  );
}


function AppearancePanel({
  appearance,
  onSave
}: {
  appearance: AnalyticsGlobalAppearance;
  onSave: (appearance: AnalyticsGlobalAppearance) => Promise<void>;
}) {
  const [local, setLocal] = useState(appearance);

  useEffect(() => {
    setLocal(appearance);
  }, [appearance]);

  return (
    <details className="mb-3 rounded-lg border border-slate-700 bg-slate-900/70 p-3" open>
      <summary className="cursor-pointer text-xs font-semibold text-slate-200">Appearance / Theme</summary>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <label className="text-xs text-slate-300">Canvas background
          <input type="color" className="mt-1 h-8 w-full rounded border border-slate-700 bg-slate-950" value={local.canvasBg} onChange={(event) => setLocal({ ...local, canvasBg: event.target.value })} />
        </label>
        <label className="text-xs text-slate-300">Card background
          <input type="color" className="mt-1 h-8 w-full rounded border border-slate-700 bg-slate-950" value={local.cardBg} onChange={(event) => setLocal({ ...local, cardBg: event.target.value })} />
        </label>
        <label className="text-xs text-slate-300">Plot background
          <input type="color" className="mt-1 h-8 w-full rounded border border-slate-700 bg-slate-950" value={local.plotBg} onChange={(event) => setLocal({ ...local, plotBg: event.target.value })} />
        </label>
        <label className="text-xs text-slate-300">Grid intensity
          <input type="range" min={0} max={1} step={0.05} className="mt-2 w-full" value={local.gridOpacity} onChange={(event) => setLocal({ ...local, gridOpacity: Number(event.target.value) })} />
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <button className="rounded border border-cyan-500 bg-cyan-600 px-3 py-1 text-xs text-white" onClick={() => void onSave(local)}>Save appearance</button>
      </div>
    </details>
  );
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-xs text-slate-300">
      {label}
      <input className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function newSeries(metric: AnalyticsMetricField, color: string): AnalyticsChartSeries {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    field_key: metric,
    aggregation: 'sum',
    transform: 'none',
    chart_type: 'line',
    stack_group: 'none',
    axis_side: 'left',
    axis_label: '',
    color,
    line_width: 2,
    opacity: 1,
    label_format: ''
  };
}

function updateSeries(config: AnalyticsChartConfig, seriesIndex: number, patch: Partial<AnalyticsChartSeries>) {
  return {
    ...config,
    series: config.series.map((series, index) => (index === seriesIndex ? { ...series, ...patch } : series))
  };
}

function exportCsv(chartTitle: string, x: string[], rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return;
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const csvLines = [headers.join(',')];

  rows.forEach((row) => {
    csvLines.push(
      headers
        .map((header) => {
          const value = row[header] ?? '';
          const safe = String(value).replace(/"/g, '""');
          return `"${safe}"`;
        })
        .join(',')
    );
  });

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = `${chartTitle.toLowerCase().replace(/\s+/g, '-') || 'chart'}-${x.length}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}
