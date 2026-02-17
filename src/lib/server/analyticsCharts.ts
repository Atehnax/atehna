import { randomUUID } from 'crypto';
import { getPool } from '@/lib/server/db';

export type AnalyticsChartType =
  | 'line'
  | 'spline'
  | 'area'
  | 'bar'
  | 'grouped_bar'
  | 'stacked_bar'
  | 'stacked_area'
  | 'scatter'
  | 'bubble'
  | 'histogram'
  | 'box'
  | 'heatmap'
  | 'waterfall'
  | 'combo';

export type AnalyticsMetricField =
  | 'order_count'
  | 'revenue_total'
  | 'aov'
  | 'median_order_value'
  | 'payment_success_rate'
  | 'cancellation_rate'
  | 'lead_time_p50_hours'
  | 'lead_time_p90_hours'
  | 'paid_count'
  | 'cancelled_count';

export type AnalyticsChartAppearance = {
  canvasBg?: string;
  cardBg?: string;
  plotBg?: string;
  gridOpacity?: number;
};

export type AnalyticsGlobalAppearance = {
  canvasBg: string;
  cardBg: string;
  plotBg: string;
  gridOpacity: number;
  updatedAt?: string;
};

export type AnalyticsChartSeries = {
  id: string;
  enabled: boolean;
  field_key: AnalyticsMetricField;
  aggregation: 'sum' | 'count' | 'avg' | 'median' | 'min' | 'max' | 'p90' | 'distinct_count';
  transform: 'none' | 'moving_average_7d' | 'cumulative' | 'pct_change' | 'share_of_total';
  chart_type: AnalyticsChartType;
  stack_group: string;
  axis_side: 'left' | 'right';
  axis_label: string;
  color: string;
  line_width: number;
  opacity: number;
  label_format: string;
};

export type AnalyticsChartConfig = {
  dataset: 'orders_daily';
  xField: 'date';
  xTitle: string;
  xTickFormat: string;
  xDateFormat: string;
  xScale: 'linear' | 'log';
  yLeftTitle: string;
  yLeftScale: 'linear' | 'log';
  yLeftTickFormat: string;
  yRightEnabled: boolean;
  yRightTitle: string;
  yRightScale: 'linear' | 'log';
  yRightTickFormat: string;
  grain: 'day' | 'week' | 'month' | 'quarter';
  quickRange: '7d' | '30d' | '90d' | '180d' | '365d' | 'ytd';
  filters: {
    customerType: 'all' | 'P' | 'Š' | 'F';
    status: string;
    paymentStatus: string;
    includeNulls: boolean;
  };
  appearance?: AnalyticsChartAppearance;
  editedAt?: string;
  series: AnalyticsChartSeries[];
};

export type AnalyticsChartRow = {
  id: number;
  dashboard_key: string;
  key: string;
  title: string;
  description: string | null;
  comment: string | null;
  chart_type: AnalyticsChartType;
  config_json: AnalyticsChartConfig;
  position: number;
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

let ensured = false;

const toIso = (value: unknown) => (value instanceof Date ? value.toISOString() : String(value));

const isMetric = (value: unknown): value is AnalyticsMetricField =>
  [
    'order_count',
    'revenue_total',
    'aov',
    'median_order_value',
    'payment_success_rate',
    'cancellation_rate',
    'lead_time_p50_hours',
    'lead_time_p90_hours',
    'paid_count',
    'cancelled_count'
  ].includes(String(value));

const parseChartType = (value: unknown): AnalyticsChartType => {
  const allowed: AnalyticsChartType[] = [
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
  return allowed.includes(value as AnalyticsChartType) ? (value as AnalyticsChartType) : 'line';
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const defaultSeries = (field: AnalyticsMetricField, overrides?: Partial<AnalyticsChartSeries>): AnalyticsChartSeries => ({
  id: randomUUID(),
  enabled: true,
  field_key: field,
  aggregation: 'sum',
  transform: 'none',
  chart_type: 'line',
  stack_group: 'none',
  axis_side: 'left',
  axis_label: '',
  color: '#22d3ee',
  line_width: 2,
  opacity: 1,
  label_format: '',
  ...overrides
});

const defaultConfig = (): AnalyticsChartConfig => ({
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
  quickRange: '90d',
  filters: {
    customerType: 'all',
    status: 'all',
    paymentStatus: 'all',
    includeNulls: true
  },
  appearance: {},
  series: [defaultSeries('order_count')]
});

const defaultAppearance = (): AnalyticsGlobalAppearance => ({
  canvasBg: '#0f172a',
  cardBg: '#1e293b',
  plotBg: '#1e293b',
  gridOpacity: 0.2
});

const parseAppearance = (value: unknown): AnalyticsChartAppearance => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  return {
    canvasBg: typeof raw.canvasBg === 'string' ? raw.canvasBg : undefined,
    cardBg: typeof raw.cardBg === 'string' ? raw.cardBg : undefined,
    plotBg: typeof raw.plotBg === 'string' ? raw.plotBg : undefined,
    gridOpacity: Number.isFinite(Number(raw.gridOpacity)) ? clamp(Number(raw.gridOpacity), 0, 1) : undefined
  };
};

const parseConfig = (value: unknown): AnalyticsChartConfig => {
  const fallback = defaultConfig();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const raw = value as Record<string, unknown>;

  const parsedSeries = (Array.isArray(raw.series) ? raw.series : [])
    .map((seriesRaw): AnalyticsChartSeries | null => {
      if (!seriesRaw || typeof seriesRaw !== 'object' || Array.isArray(seriesRaw)) return null;
      const source = seriesRaw as Record<string, unknown>;
      if (!isMetric(source.field_key)) return null;
      return {
        id: typeof source.id === 'string' ? source.id : randomUUID(),
        enabled: source.enabled !== false,
        field_key: source.field_key,
        aggregation: ['sum', 'count', 'avg', 'median', 'min', 'max', 'p90', 'distinct_count'].includes(String(source.aggregation))
          ? (source.aggregation as AnalyticsChartSeries['aggregation'])
          : 'sum',
        transform: ['none', 'moving_average_7d', 'cumulative', 'pct_change', 'share_of_total'].includes(String(source.transform))
          ? (source.transform as AnalyticsChartSeries['transform'])
          : 'none',
        chart_type: parseChartType(source.chart_type),
        stack_group: typeof source.stack_group === 'string' ? source.stack_group : 'none',
        axis_side: source.axis_side === 'right' ? 'right' : 'left',
        axis_label: typeof source.axis_label === 'string' ? source.axis_label : '',
        color: typeof source.color === 'string' ? source.color : '#22d3ee',
        line_width: Number.isFinite(Number(source.line_width)) ? Number(source.line_width) : 2,
        opacity: Number.isFinite(Number(source.opacity)) ? Number(source.opacity) : 1,
        label_format: typeof source.label_format === 'string' ? source.label_format : ''
      };
    })
    .filter((series): series is AnalyticsChartSeries => series !== null);

  return {
    dataset: 'orders_daily',
    xField: 'date',
    xTitle: typeof raw.xTitle === 'string' ? raw.xTitle : fallback.xTitle,
    xTickFormat: typeof raw.xTickFormat === 'string' ? raw.xTickFormat : '',
    xDateFormat: typeof raw.xDateFormat === 'string' ? raw.xDateFormat : fallback.xDateFormat,
    xScale: raw.xScale === 'log' ? 'log' : 'linear',
    yLeftTitle: typeof raw.yLeftTitle === 'string' ? raw.yLeftTitle : fallback.yLeftTitle,
    yLeftScale: raw.yLeftScale === 'log' ? 'log' : 'linear',
    yLeftTickFormat: typeof raw.yLeftTickFormat === 'string' ? raw.yLeftTickFormat : '',
    yRightEnabled: Boolean(raw.yRightEnabled),
    yRightTitle: typeof raw.yRightTitle === 'string' ? raw.yRightTitle : fallback.yRightTitle,
    yRightScale: raw.yRightScale === 'log' ? 'log' : 'linear',
    yRightTickFormat: typeof raw.yRightTickFormat === 'string' ? raw.yRightTickFormat : '',
    grain: raw.grain === 'week' || raw.grain === 'month' || raw.grain === 'quarter' ? raw.grain : 'day',
    quickRange:
      raw.quickRange === '7d' || raw.quickRange === '30d' || raw.quickRange === '180d' || raw.quickRange === '365d' || raw.quickRange === 'ytd'
        ? raw.quickRange
        : '90d',
    filters: {
      customerType: raw.filters && typeof raw.filters === 'object' && ['P', 'Š', 'F'].includes(String((raw.filters as Record<string, unknown>).customerType))
        ? ((raw.filters as Record<string, unknown>).customerType as 'P' | 'Š' | 'F')
        : 'all',
      status: raw.filters && typeof raw.filters === 'object' && typeof (raw.filters as Record<string, unknown>).status === 'string'
        ? String((raw.filters as Record<string, unknown>).status)
        : 'all',
      paymentStatus: raw.filters && typeof raw.filters === 'object' && typeof (raw.filters as Record<string, unknown>).paymentStatus === 'string'
        ? String((raw.filters as Record<string, unknown>).paymentStatus)
        : 'all',
      includeNulls:
        !(raw.filters && typeof raw.filters === 'object' && (raw.filters as Record<string, unknown>).includeNulls === false)
    },
    appearance: parseAppearance(raw.appearance),
    editedAt: typeof raw.editedAt === 'string' ? raw.editedAt : undefined,
    series: parsedSeries.length > 0 ? parsedSeries : fallback.series
  };
};

function mapRow(raw: Record<string, unknown>): AnalyticsChartRow {
  return {
    id: Number(raw.id),
    dashboard_key: String(raw.dashboard_key),
    key: String(raw.key),
    title: String(raw.title),
    description: typeof raw.description === 'string' ? raw.description : null,
    comment: typeof raw.comment === 'string' ? raw.comment : null,
    chart_type: parseChartType(raw.chart_type),
    config_json: parseConfig(raw.config_json),
    position: Number(raw.position ?? 0),
    is_system: Boolean(raw.is_system),
    created_at: toIso(raw.created_at),
    updated_at: toIso(raw.updated_at)
  };
}

async function ensureAnalyticsTables() {
  if (ensured) return;
  const pool = await getPool();
  await pool.query(`
    create table if not exists analytics_charts (
      id bigserial primary key,
      dashboard_key text not null default 'narocila',
      key text not null unique,
      title text not null,
      description text null,
      comment text null,
      chart_type text not null,
      config_json jsonb not null default '{}'::jsonb,
      position integer not null default 0,
      is_system boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await pool.query(`
    create table if not exists analytics_chart_settings (
      dashboard_key text primary key,
      settings_json jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `);
  ensured = true;
}

const buildSystemCharts = (dashboardKey: string) => [
  {
    key: `${dashboardKey}-orders-ma`,
    title: 'Orders/day + 7d MA',
    description: 'Daily orders with moving average.',
    comment: null,
    chart_type: 'combo' as AnalyticsChartType,
    position: 0,
    config_json: {
      ...defaultConfig(),
      yLeftTitle: 'Orders',
      series: [
        defaultSeries('order_count', { chart_type: 'bar', color: '#22d3ee' }),
        defaultSeries('order_count', { transform: 'moving_average_7d', chart_type: 'line', color: '#f59e0b', axis_label: 'Orders 7d MA' })
      ]
    }
  },
  {
    key: `${dashboardKey}-revenue-ma`,
    title: 'Revenue/day + 7d MA',
    description: 'Revenue in EUR with moving average.',
    comment: null,
    chart_type: 'combo' as AnalyticsChartType,
    position: 1,
    config_json: {
      ...defaultConfig(),
      yLeftTitle: 'Revenue (EUR)',
      yLeftTickFormat: ',.2f',
      series: [
        defaultSeries('revenue_total', { chart_type: 'bar', color: '#38bdf8', axis_label: 'Revenue' }),
        defaultSeries('revenue_total', { transform: 'moving_average_7d', chart_type: 'line', color: '#f59e0b', axis_label: 'Revenue 7d MA' })
      ]
    }
  },
  {
    key: `${dashboardKey}-aov-median`,
    title: 'AOV vs median order value',
    description: 'Compare average and median order value.',
    comment: null,
    chart_type: 'line' as AnalyticsChartType,
    position: 2,
    config_json: {
      ...defaultConfig(),
      yLeftTitle: 'EUR',
      yLeftTickFormat: ',.2f',
      series: [
        defaultSeries('aov', { chart_type: 'line', color: '#a78bfa', axis_label: 'AOV' }),
        defaultSeries('median_order_value', { chart_type: 'line', color: '#34d399', axis_label: 'Median value' })
      ]
    }
  },
  {
    key: `${dashboardKey}-cumulative-dual`,
    title: 'Cumulative revenue vs cumulative orders',
    description: 'Dual axis cumulative trends.',
    comment: null,
    chart_type: 'combo' as AnalyticsChartType,
    position: 3,
    config_json: {
      ...defaultConfig(),
      yLeftTitle: 'Cumulative revenue (EUR)',
      yLeftTickFormat: ',.0f',
      yRightEnabled: true,
      yRightTitle: 'Cumulative orders',
      series: [
        defaultSeries('revenue_total', { transform: 'cumulative', chart_type: 'line', color: '#22d3ee', axis_side: 'left', axis_label: 'Cumulative revenue' }),
        defaultSeries('order_count', { transform: 'cumulative', chart_type: 'line', color: '#f59e0b', axis_side: 'right', axis_label: 'Cumulative orders' })
      ]
    }
  },
  {
    key: `${dashboardKey}-customer-mix`,
    title: 'Customer type mix over time',
    description: 'P / Š / F stacked mix.',
    comment: null,
    chart_type: 'stacked_area' as AnalyticsChartType,
    position: 4,
    config_json: {
      ...defaultConfig(),
      yLeftTitle: 'Share (%)',
      yLeftTickFormat: ',.1f',
      series: [
        defaultSeries('order_count', { chart_type: 'stacked_area', color: '#22d3ee', axis_label: 'P', stack_group: 'customer_P', transform: 'share_of_total' }),
        defaultSeries('order_count', { chart_type: 'stacked_area', color: '#818cf8', axis_label: 'Š', stack_group: 'customer_Š', transform: 'share_of_total' }),
        defaultSeries('order_count', { chart_type: 'stacked_area', color: '#f59e0b', axis_label: 'F', stack_group: 'customer_F', transform: 'share_of_total' })
      ]
    }
  },
  {
    key: `${dashboardKey}-status-mix`,
    title: 'Status mix over time',
    description: 'Stacked status trend.',
    comment: null,
    chart_type: 'stacked_bar' as AnalyticsChartType,
    position: 5,
    config_json: {
      ...defaultConfig(),
      yLeftTitle: 'Orders',
      series: [
        defaultSeries('order_count', { chart_type: 'stacked_bar', color: '#22d3ee', axis_label: 'received', stack_group: 'status', transform: 'none' }),
        defaultSeries('order_count', { chart_type: 'stacked_bar', color: '#34d399', axis_label: 'in_progress', stack_group: 'status', transform: 'none' }),
        defaultSeries('order_count', { chart_type: 'stacked_bar', color: '#f59e0b', axis_label: 'cancelled', stack_group: 'status', transform: 'none' })
      ]
    }
  },
  {
    key: `${dashboardKey}-rates`,
    title: 'Cancellation rate + payment success rate',
    description: 'Daily operational rates.',
    comment: null,
    chart_type: 'line' as AnalyticsChartType,
    position: 6,
    config_json: {
      ...defaultConfig(),
      yLeftTitle: 'Rate (%)',
      yLeftTickFormat: ',.2f',
      series: [
        defaultSeries('cancellation_rate', { chart_type: 'line', color: '#f87171', axis_label: 'Cancellation %' }),
        defaultSeries('payment_success_rate', { chart_type: 'line', color: '#22d3ee', axis_label: 'Payment success %' })
      ]
    }
  },
  {
    key: `${dashboardKey}-lead-time`,
    title: 'Fulfilment lead-time p50 + p90',
    description: 'Lead times in hours.',
    comment: null,
    chart_type: 'line' as AnalyticsChartType,
    position: 7,
    config_json: {
      ...defaultConfig(),
      yLeftTitle: 'Hours',
      yLeftTickFormat: ',.2f',
      series: [
        defaultSeries('lead_time_p50_hours', { chart_type: 'line', color: '#22d3ee', axis_label: 'p50 hours' }),
        defaultSeries('lead_time_p90_hours', { chart_type: 'line', color: '#f59e0b', axis_label: 'p90 hours' })
      ]
    }
  }
];

async function ensureDefaultChartsIfEmpty(dashboardKey = 'narocila') {
  const pool = await getPool();
  const existing = await pool.query('select count(*)::int as count from analytics_charts where dashboard_key = $1', [dashboardKey]);
  if (Number(existing.rows[0]?.count ?? 0) > 0) return;

  const defaults = buildSystemCharts(dashboardKey);
  for (const chart of defaults) {
    await pool.query(
      `insert into analytics_charts (dashboard_key, key, title, description, comment, chart_type, config_json, position, is_system)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,false)`,
      [dashboardKey, chart.key, chart.title, chart.description, chart.comment, chart.chart_type, JSON.stringify(chart.config_json), chart.position]
    );
  }
}

export async function fetchAnalyticsCharts(dashboardKey = 'narocila') {
  await ensureAnalyticsTables();
  await ensureDefaultChartsIfEmpty(dashboardKey);

  const pool = await getPool();
  const result = await pool.query(`select * from analytics_charts where dashboard_key = $1 order by position asc, id asc`, [dashboardKey]);
  return result.rows.map((row) => mapRow(row as Record<string, unknown>));
}

export async function createAnalyticsChart(input: {
  dashboardKey?: string;
  title: string;
  description?: string | null;
  comment?: string | null;
  chartType: AnalyticsChartType;
  config: AnalyticsChartConfig;
}) {
  await ensureAnalyticsTables();

  const pool = await getPool();
  const dashboardKey = input.dashboardKey ?? 'narocila';
  const positionResult = await pool.query('select coalesce(max(position), -1) + 1 as next_position from analytics_charts where dashboard_key = $1', [dashboardKey]);
  const position = Number(positionResult.rows[0]?.next_position ?? 0);
  const nextConfig = parseConfig({ ...input.config, editedAt: new Date().toISOString() });

  const result = await pool.query(
    `insert into analytics_charts (dashboard_key, key, title, description, comment, chart_type, config_json, position, is_system)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,false)
     returning *`,
    [dashboardKey, `${dashboardKey}-${randomUUID()}`, input.title, input.description ?? null, input.comment ?? null, input.chartType, JSON.stringify(nextConfig), position]
  );

  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function updateAnalyticsChart(
  chartId: number,
  input: Partial<{
    title: string;
    description: string | null;
    comment: string | null;
    chartType: AnalyticsChartType;
    config: AnalyticsChartConfig;
  }>
) {
  await ensureAnalyticsTables();
  const pool = await getPool();

  const existing = await pool.query('select * from analytics_charts where id = $1 limit 1', [chartId]);
  if (!existing.rows[0]) return null;

  const row = existing.rows[0] as Record<string, unknown>;
  const nextTitle = input.title ?? String(row.title);
  const nextDescription = input.description === undefined ? (typeof row.description === 'string' ? row.description : null) : input.description;
  const nextComment = input.comment === undefined ? (typeof row.comment === 'string' ? row.comment : null) : input.comment;
  const nextChartType = input.chartType ?? parseChartType(row.chart_type);
  const nextConfig = parseConfig({ ...(input.config ? input.config : parseConfig(row.config_json)), editedAt: new Date().toISOString() });

  const result = await pool.query(
    `update analytics_charts
     set title = $2, description = $3, comment = $4, chart_type = $5, config_json = $6::jsonb
     where id = $1
     returning *`,
    [chartId, nextTitle, nextDescription, nextComment, nextChartType, JSON.stringify(nextConfig)]
  );

  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function deleteAnalyticsChart(chartId: number) {
  await ensureAnalyticsTables();
  const pool = await getPool();
  const result = await pool.query('delete from analytics_charts where id = $1 returning id', [chartId]);
  return Number(result.rowCount ?? 0) > 0;
}

export async function reorderAnalyticsCharts(chartIdsInOrder: number[], dashboardKey = 'narocila') {
  await ensureAnalyticsTables();
  const pool = await getPool();

  await pool.query('begin');
  try {
    for (let index = 0; index < chartIdsInOrder.length; index += 1) {
      await pool.query('update analytics_charts set position = $1 where id = $2 and dashboard_key = $3', [index, chartIdsInOrder[index], dashboardKey]);
    }
    await pool.query('commit');
  } catch (error) {
    await pool.query('rollback');
    throw error;
  }
}

export async function fetchGlobalAnalyticsAppearance(dashboardKey = 'narocila'): Promise<AnalyticsGlobalAppearance> {
  await ensureAnalyticsTables();
  const pool = await getPool();
  const result = await pool.query('select settings_json, updated_at from analytics_chart_settings where dashboard_key = $1 limit 1', [dashboardKey]);
  if (!result.rows[0]) return defaultAppearance();
  const row = result.rows[0] as Record<string, unknown>;
  const raw = (row.settings_json && typeof row.settings_json === 'object' ? row.settings_json : {}) as Record<string, unknown>;
  return {
    canvasBg: typeof raw.canvasBg === 'string' ? raw.canvasBg : defaultAppearance().canvasBg,
    cardBg: typeof raw.cardBg === 'string' ? raw.cardBg : defaultAppearance().cardBg,
    plotBg: typeof raw.plotBg === 'string' ? raw.plotBg : defaultAppearance().plotBg,
    gridOpacity: Number.isFinite(Number(raw.gridOpacity)) ? clamp(Number(raw.gridOpacity), 0, 1) : defaultAppearance().gridOpacity,
    updatedAt: toIso(row.updated_at)
  };
}

export async function updateGlobalAnalyticsAppearance(input: Partial<AnalyticsGlobalAppearance>, dashboardKey = 'narocila') {
  await ensureAnalyticsTables();
  const current = await fetchGlobalAnalyticsAppearance(dashboardKey);
  const next: AnalyticsGlobalAppearance = {
    canvasBg: input.canvasBg ?? current.canvasBg,
    cardBg: input.cardBg ?? current.cardBg,
    plotBg: input.plotBg ?? current.plotBg,
    gridOpacity: input.gridOpacity === undefined ? current.gridOpacity : clamp(input.gridOpacity, 0, 1)
  };

  const pool = await getPool();
  await pool.query(
    `insert into analytics_chart_settings (dashboard_key, settings_json, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (dashboard_key)
     do update set settings_json = excluded.settings_json, updated_at = now()`,
    [dashboardKey, JSON.stringify(next)]
  );

  return fetchGlobalAnalyticsAppearance(dashboardKey);
}
