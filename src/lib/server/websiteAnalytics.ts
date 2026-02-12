import { getPool } from '@/lib/server/db';

export type WebsiteAnalyticsSummary = {
  visitsByDay: Array<{ day: string; visits: number }>;
  topPages: Array<{ path: string; views: number }>;
  topProducts: Array<{ product_id: string; views: number }>;
  returningVisitors7d: number;
};

const buildWhere = (fromDate?: string | null, toDate?: string | null) => {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (fromDate) {
    params.push(fromDate);
    conditions.push(`created_at >= $${params.length}`);
  }

  if (toDate) {
    params.push(toDate);
    conditions.push(`created_at <= $${params.length}`);
  }

  return { where: conditions.length ? `where ${conditions.join(' and ')}` : '', params };
};

const appendCondition = (whereClause: string, condition: string) =>
  whereClause ? `${whereClause} and ${condition}` : `where ${condition}`;

export async function fetchWebsiteAnalytics(options?: {
  fromDate?: string | null;
  toDate?: string | null;
}): Promise<WebsiteAnalyticsSummary> {
  const pool = await getPool();
  const { where, params } = buildWhere(options?.fromDate, options?.toDate);

  const [visitsByDayResult, topPagesResult, topProductsResult, retentionResult] = await Promise.all([
    pool.query(
      `
      select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
             count(*)::int as visits
      from website_events
      ${appendCondition(where, "event_type = 'page_view'")}
      group by 1
      order by 1 asc
      `,
      params
    ),
    pool.query(
      `
      select path, count(*)::int as views
      from website_events
      ${appendCondition(where, "event_type = 'page_view'")}
      group by path
      order by views desc
      limit 10
      `,
      params
    ),
    pool.query(
      `
      select product_id, count(*)::int as views
      from website_events
      ${appendCondition(where, "event_type = 'product_view' and product_id is not null")}
      group by product_id
      order by views desc
      limit 10
      `,
      params
    ),
    pool.query(
      `
      select count(*)::int as returning_visitors
      from (
        select visitor_id
        from website_events
        where event_type = 'page_view'
          and created_at >= now() - interval '7 days'
        group by visitor_id
        having count(*) > 1
      ) as visitors
      `
    )
  ]);

  return {
    visitsByDay: visitsByDayResult.rows as Array<{ day: string; visits: number }>,
    topPages: topPagesResult.rows as Array<{ path: string; views: number }>,
    topProducts: topProductsResult.rows as Array<{ product_id: string; views: number }>,
    returningVisitors7d: Number(retentionResult.rows[0]?.returning_visitors ?? 0)
  };
}
