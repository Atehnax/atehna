import { randomUUID } from 'crypto';
import { getPool } from '@/lib/server/db';

export type AnalyticsChartType = 'line' | 'bar' | 'area';

export type AnalyticsChartConfig = {
  dataset: 'orders_daily';
  xField: 'date';
  yFields: Array<'order_count' | 'revenue_total' | 'aov'>;
  filters?: {
    customerType?: 'P' | 'Š' | 'F' | 'all';
    status?: string | 'all';
  };
  transforms?: {
    movingAverage7d?: boolean;
  };
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

const parseChartType = (value: unknown): AnalyticsChartType =>
  value === 'bar' || value === 'area' ? value : 'line';

const parseConfig = (value: unknown): AnalyticsChartConfig => {
  const fallback: AnalyticsChartConfig = {
    dataset: 'orders_daily',
    xField: 'date',
    yFields: ['order_count'],
    filters: { customerType: 'all', status: 'all' },
    transforms: { movingAverage7d: false }
  };

  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const raw = value as Record<string, unknown>;
  const rawYFields = Array.isArray(raw.yFields) ? raw.yFields : [];
  const yFields = rawYFields
    .filter((yField): yField is 'order_count' | 'revenue_total' | 'aov' =>
      yField === 'order_count' || yField === 'revenue_total' || yField === 'aov'
    )
    .slice(0, 3);

  return {
    dataset: 'orders_daily',
    xField: 'date',
    yFields: yFields.length > 0 ? yFields : ['order_count'],
    filters: {
      customerType:
        raw.filters &&
        typeof raw.filters === 'object' &&
        ((raw.filters as Record<string, unknown>).customerType === 'P' ||
          (raw.filters as Record<string, unknown>).customerType === 'Š' ||
          (raw.filters as Record<string, unknown>).customerType === 'F')
          ? ((raw.filters as Record<string, unknown>).customerType as 'P' | 'Š' | 'F')
          : 'all',
      status:
        raw.filters &&
        typeof raw.filters === 'object' &&
        typeof (raw.filters as Record<string, unknown>).status === 'string'
          ? ((raw.filters as Record<string, unknown>).status as string)
          : 'all'
    },
    transforms: {
      movingAverage7d:
        Boolean(
          raw.transforms &&
            typeof raw.transforms === 'object' &&
            (raw.transforms as Record<string, unknown>).movingAverage7d
        )
    }
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
  ensured = true;
}

async function ensureSystemCharts(dashboardKey = 'narocila') {
  const pool = await getPool();
  const systemCharts = [
    {
      key: `${dashboardKey}-orders-system`,
      title: 'Naročila / dan + 7d MA',
      description: 'Dnevno število naročil in 7-dnevno drseče povprečje.',
      comment: null,
      chart_type: 'line',
      position: 0,
      config_json: {
        dataset: 'orders_daily',
        xField: 'date',
        yFields: ['order_count'],
        filters: { customerType: 'all', status: 'all' },
        transforms: { movingAverage7d: true }
      }
    },
    {
      key: `${dashboardKey}-revenue-system`,
      title: 'Prihodki / dan + 7d MA',
      description: 'Dnevni prihodki v EUR in 7-dnevno drseče povprečje.',
      comment: null,
      chart_type: 'line',
      position: 1,
      config_json: {
        dataset: 'orders_daily',
        xField: 'date',
        yFields: ['revenue_total'],
        filters: { customerType: 'all', status: 'all' },
        transforms: { movingAverage7d: true }
      }
    }
  ] as const;

  for (const chart of systemCharts) {
    await pool.query(
      `
      insert into analytics_charts (dashboard_key, key, title, description, comment, chart_type, config_json, position, is_system)
      values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,true)
      on conflict (key)
      do update set
        dashboard_key = excluded.dashboard_key,
        title = excluded.title,
        description = excluded.description,
        chart_type = excluded.chart_type,
        config_json = excluded.config_json,
        position = excluded.position,
        is_system = true
      `,
      [
        dashboardKey,
        chart.key,
        chart.title,
        chart.description,
        chart.comment,
        chart.chart_type,
        JSON.stringify(chart.config_json),
        chart.position
      ]
    );
  }
}

export async function fetchAnalyticsCharts(dashboardKey = 'narocila') {
  await ensureAnalyticsTables();
  await ensureSystemCharts(dashboardKey);

  const pool = await getPool();
  const result = await pool.query(
    `select * from analytics_charts where dashboard_key = $1 order by position asc, id asc`,
    [dashboardKey]
  );

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
  const positionResult = await pool.query(
    'select coalesce(max(position), -1) + 1 as next_position from analytics_charts where dashboard_key = $1',
    [dashboardKey]
  );
  const position = Number(positionResult.rows[0]?.next_position ?? 0);

  const result = await pool.query(
    `
    insert into analytics_charts (dashboard_key, key, title, description, comment, chart_type, config_json, position, is_system)
    values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,false)
    returning *
    `,
    [
      dashboardKey,
      `${dashboardKey}-${randomUUID()}`,
      input.title,
      input.description ?? null,
      input.comment ?? null,
      input.chartType,
      JSON.stringify(parseConfig(input.config)),
      position
    ]
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
  const nextConfig = input.config ? parseConfig(input.config) : parseConfig(row.config_json);

  const result = await pool.query(
    `
    update analytics_charts
    set title = $2,
        description = $3,
        comment = $4,
        chart_type = $5,
        config_json = $6::jsonb
    where id = $1
    returning *
    `,
    [chartId, nextTitle, nextDescription, nextComment, nextChartType, JSON.stringify(nextConfig)]
  );

  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function deleteAnalyticsChart(chartId: number) {
  await ensureAnalyticsTables();
  const pool = await getPool();
  const result = await pool.query(
    'delete from analytics_charts where id = $1 and is_system = false returning id',
    [chartId]
  );
  return Number(result.rowCount ?? 0) > 0;
}

export async function reorderAnalyticsCharts(chartIdsInOrder: number[], dashboardKey = 'narocila') {
  await ensureAnalyticsTables();
  const pool = await getPool();

  await pool.query('begin');
  try {
    for (let index = 0; index < chartIdsInOrder.length; index += 1) {
      await pool.query(
        'update analytics_charts set position = $1 where id = $2 and dashboard_key = $3',
        [index, chartIdsInOrder[index], dashboardKey]
      );
    }
    await pool.query('commit');
  } catch (error) {
    await pool.query('rollback');
    throw error;
  }
}
