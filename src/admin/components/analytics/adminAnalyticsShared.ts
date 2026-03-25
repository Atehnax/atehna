import { getBaseChartLayout, type ChartTheme } from '@/admin/components/charts/chartTheme';
import type { Data, Layout } from 'plotly.js';
import type { OrdersAnalyticsResponse } from '@/shared/server/orderAnalytics';
import type {
  AnalyticsChartConfig,
  AnalyticsChartRow,
  AnalyticsChartSeries,
  AnalyticsChartType,
  AnalyticsMetricField,
  AnalyticsGlobalAppearance
} from '@/shared/server/analyticsCharts';

export type RangeOption = '7d' | '30d' | '90d' | '180d' | '365d' | 'ytd';

export const rangeOptions: RangeOption[] = ['7d', '30d', '90d', '180d', '365d', 'ytd'];

export const metricOptions: Array<{ value: AnalyticsMetricField; label: string; unit: 'count' | 'eur' | 'percent' | 'hours' }> = [
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

export const chartTypeOptions: AnalyticsChartType[] = [
  'line', 'spline', 'area', 'bar', 'grouped_bar', 'stacked_bar', 'stacked_area', 'scatter', 'bubble', 'histogram', 'box', 'heatmap', 'waterfall', 'combo'
];

export const transformOptions = ['none', 'moving_average_7d', 'cumulative', 'pct_change', 'share_of_total'] as const;

const legacyPalette = new Set(['#22d3ee', '#f59e0b', '#34d399', '#60a5fa', '#38bdf8', '#f87171', '#5d3ed6']);

const movingAverage = (values: number[], window = 7) => values.map((_, index) => {
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

const pctChange = (values: number[]) => values.map((value, index) => {
  if (index === 0) return 0;
  const previous = values[index - 1] ?? 0;
  if (previous === 0) return 0;
  return ((value - previous) / previous) * 100;
});

const toSafeNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

const hexToRgba = (hexColor: string, alpha: number) => {
  const hex = hexColor.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return `rgba(148, 163, 184, ${alpha})`;
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const layoutBase = (theme: ChartTheme): Partial<Layout> => ({ ...getBaseChartLayout(theme), margin: { l: 56, r: 24, t: 28, b: 52 }, hoverlabel: { namelength: -1 } });

export function buildChartModel(chart: AnalyticsChartRow, data: OrdersAnalyticsResponse, theme: ChartTheme, globalAppearance: AnalyticsGlobalAppearance) {
  const days = applyChartFiltersAndGrain(data, chart.config_json);
  const x = days.map((day) => day.date);
  const enabledSeries = chart.config_json.series.filter((series) => series.enabled);
  const traces: Data[] = [];
  const exportRows: Array<Record<string, string | number>> = [];
  const palette = chart.config_json.appearance?.seriesPalette ?? globalAppearance.seriesPalette;

  enabledSeries.forEach((series, index) => {
    const metricValues = extractSeriesValues(days, series);
    const effectiveColor = legacyPalette.has(series.color) ? (palette[index % palette.length] ?? series.color) : series.color;
    const trace = seriesToTrace({ ...series, color: effectiveColor }, x, metricValues, chart.chart_type);
    traces.push(trace);

    x.forEach((date, valueIndex) => {
      if (!exportRows[valueIndex]) exportRows[valueIndex] = { date };
      exportRows[valueIndex][series.axis_label || series.field_key] = Number(metricValues[valueIndex] ?? 0);
    });
  });

  const chartAppearance = chart.config_json.appearance ?? {};
  const resolvedCanvasBg = chartAppearance.canvasBg || globalAppearance.canvasBg || theme.card;
  const resolvedCardBg = chartAppearance.cardBg || globalAppearance.cardBg || resolvedCanvasBg;
  const resolvedPlotBg = chartAppearance.plotBg || globalAppearance.plotBg || resolvedCanvasBg;
  const resolvedGridColor = chartAppearance.gridColor || globalAppearance.gridColor;
  const resolvedGrid = hexToRgba(resolvedGridColor, chartAppearance.gridOpacity ?? globalAppearance.gridOpacity ?? 0.2);
  const resolvedAxisText = chartAppearance.axisTextColor || globalAppearance.axisTextColor;

  const layout: Partial<Layout> = {
    ...layoutBase(theme),
    paper_bgcolor: resolvedCanvasBg,
    plot_bgcolor: resolvedPlotBg,
    xaxis: {
      title: { text: chart.config_json.xTitle || 'Datum', font: { size: chart.config_json.xTitleFontSize ?? 12, color: resolvedAxisText } },
      tickformat: chart.config_json.xTickFormat || undefined,
      type: chart.config_json.xScale === 'log' ? 'log' : 'date',
      gridcolor: resolvedGrid,
      tickfont: { color: resolvedAxisText, size: chart.config_json.yTickFontSize ?? 10 }
    },
    yaxis: {
      title: { text: chart.config_json.yLeftTitle || 'Value', font: { size: chart.config_json.yTitleFontSize ?? 12, color: resolvedAxisText } },
      tickformat: chart.config_json.yLeftTickFormat || undefined,
      type: chart.config_json.yLeftScale === 'log' ? 'log' : 'linear',
      gridcolor: resolvedGrid,
      tickfont: { color: resolvedAxisText, size: chart.config_json.yTickFontSize ?? 10 }
    },
    barmode: chart.chart_type === 'stacked_bar' || chart.chart_type === 'stacked_area' ? 'stack' : chart.chart_type === 'grouped_bar' ? 'group' : 'overlay'
  };

  if (chart.config_json.yRightEnabled) {
    layout.yaxis2 = {
      title: { text: chart.config_json.yRightTitle || 'Right axis', font: { size: chart.config_json.yTitleFontSize ?? 12, color: resolvedAxisText } },
      overlaying: 'y', side: 'right', type: chart.config_json.yRightScale === 'log' ? 'log' : 'linear',
      tickformat: chart.config_json.yRightTickFormat || undefined,
      tickfont: { color: resolvedAxisText, size: chart.config_json.yTickFontSize ?? 10 }
    };
  }

  return { chart, x, traces, layout, exportRows, resolvedCardBg };
}

function applyChartFiltersAndGrain(data: OrdersAnalyticsResponse, config: AnalyticsChartConfig) {
  const filtered = data.days.filter((day) => {
    const customerPass = config.filters.customerType === 'all' ? true : (day.customer_type_buckets[config.filters.customerType] ?? 0) > 0;
    const statusPass = config.filters.status === 'all' ? true : (day.status_buckets[config.filters.status] ?? 0) > 0;
    const paymentPass = config.filters.paymentStatus === 'all' ? true : (day.payment_status_buckets[config.filters.paymentStatus] ?? 0) > 0;
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
    } else if (config.grain === 'month') key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
    else if (config.grain === 'quarter') key = `${date.getUTCFullYear()}-${String(Math.floor(date.getUTCMonth() / 3) * 3 + 1).padStart(2, '0')}-01`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(day);
    grouped.set(key, bucket);
  });

  return Array.from(grouped.entries()).map(([date, rows]) => {
    const orderCount = rows.reduce((sum, row) => sum + row.order_count, 0);
    const revenue = rows.reduce((sum, row) => sum + row.revenue_total, 0);
    const aov = orderCount > 0 ? revenue / orderCount : 0;
    const median = rows.reduce((sum, row) => sum + row.median_order_value, 0) / Math.max(rows.length, 1);
    const paymentSuccess = rows.reduce((sum, row) => sum + row.payment_success_rate, 0) / Math.max(rows.length, 1);
    const cancelRate = rows.reduce((sum, row) => sum + row.cancellation_rate, 0) / Math.max(rows.length, 1);
    const p50 = rows.reduce((sum, row) => sum + (row.lead_time_p50_hours ?? 0), 0) / Math.max(rows.length, 1);
    const p90 = rows.reduce((sum, row) => sum + (row.lead_time_p90_hours ?? 0), 0) / Math.max(rows.length, 1);
    return { ...rows[0], date, order_count: orderCount, revenue_total: Number(revenue.toFixed(2)), aov: Number(aov.toFixed(2)), median_order_value: Number(median.toFixed(2)), payment_success_rate: Number(paymentSuccess.toFixed(2)), cancellation_rate: Number(cancelRate.toFixed(2)), lead_time_p50_hours: Number(p50.toFixed(2)), lead_time_p90_hours: Number(p90.toFixed(2)) };
  }).sort((left, right) => left.date.localeCompare(right.date));
}

function extractSeriesValues(days: OrdersAnalyticsResponse['days'], series: AnalyticsChartSeries) {
  const baseValues = days.map((day) => toSafeNumber(day[series.field_key]));
  switch (series.transform) {
    case 'moving_average_7d': return movingAverage(baseValues, 7);
    case 'cumulative': return cumulative(baseValues);
    case 'pct_change': return pctChange(baseValues);
    case 'share_of_total': {
      const total = baseValues.reduce((sum, value) => sum + value, 0);
      if (total === 0) return baseValues.map(() => 0);
      return baseValues.map((value) => (value / total) * 100);
    }
    default: return baseValues;
  }
}

const metricHoverRow = (label: string, valueToken: string) =>
  `%{x|%Y-%m-%d}<br><span style="display:flex;justify-content:space-between;align-items:center;gap:12px;min-width:190px;"><span>${label}</span><span style="font-variant-numeric:tabular-nums;">${valueToken}</span></span><extra></extra>`;

function seriesToTrace(series: AnalyticsChartSeries, x: string[], y: number[], chartType: AnalyticsChartType): Data {
  const resolvedType = chartType === 'combo' ? series.chart_type : chartType;
  const yaxis = series.axis_side === 'right' ? 'y2' : 'y';
  const name = series.axis_label || series.field_key;

  if (resolvedType === 'bar' || resolvedType === 'grouped_bar' || resolvedType === 'stacked_bar') return { type: 'bar', name, x, y, yaxis, marker: { color: series.color, opacity: series.opacity }, hovertemplate: metricHoverRow(name, '%{y:,.2f}') };
  if (resolvedType === 'bubble') return { type: 'scatter', mode: 'markers', name, x, y, yaxis, marker: { color: series.color, opacity: series.opacity, size: y.map((value) => Math.max(8, Math.sqrt(Math.abs(value)))), sizemode: 'diameter' }, hovertemplate: metricHoverRow(name, '%{y:,.2f}') };
  if (resolvedType === 'histogram') return { type: 'histogram', name, x: y, marker: { color: series.color, opacity: series.opacity }, hovertemplate: metricHoverRow(name, '%{x:,.2f}') };
  if (resolvedType === 'box') return { type: 'box', name, y, marker: { color: series.color }, boxpoints: 'all', jitter: 0.3, pointpos: -1.8 };
  if (resolvedType === 'heatmap') return { type: 'heatmap', z: [y], x, y: [name], colorscale: 'Viridis', hovertemplate: metricHoverRow(name, '%{z:,.2f}') };
  if (resolvedType === 'waterfall') return { type: 'waterfall', x, y, name, yaxis };

  return {
    type: 'scatter',
    mode: resolvedType === 'scatter' ? 'markers' : 'lines+markers',
    name,
    x,
    y,
    yaxis,
    line: { color: series.color, width: series.line_width, shape: resolvedType === 'spline' ? 'spline' : 'linear' },
    fill: resolvedType === 'area' || resolvedType === 'stacked_area' ? 'tozeroy' : undefined,
    opacity: series.opacity,
    hovertemplate: metricHoverRow(name, '%{y:,.2f}')
  };
}

export function newSeries(metric: AnalyticsMetricField, color: string): AnalyticsChartSeries {
  return { id: crypto.randomUUID(), enabled: true, field_key: metric, aggregation: 'sum', transform: 'none', chart_type: 'line', stack_group: 'none', axis_side: 'left', axis_label: '', color, line_width: 2, opacity: 1, label_format: '' };
}

export function updateSeries(config: AnalyticsChartConfig, seriesIndex: number, patch: Partial<AnalyticsChartSeries>) {
  return { ...config, series: config.series.map((series, index) => (index === seriesIndex ? { ...series, ...patch } : series)) };
}
