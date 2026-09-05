/** One statement gives summary, tables and cohorts the same database snapshot.
 * Historical reads establish first observed visits and mature D7 returns only;
 * selected activity always uses the shared half-open Ljubljana period. */
export const WEBSITE_TRAFFIC_SQL = `with scoped as (
  select event_type, nullif(btrim(path), '') as path, nullif(btrim(product_id), '') as product_id,
    nullif(btrim(session_id), '') as session_id, nullif(btrim(visitor_id), '') as visitor_id,
    created_at, (created_at at time zone 'Europe/Ljubljana')::date as day
  from website_events
  where created_at >= $1::timestamptz and created_at < $2::timestamptz
    and event_type in ('page_view', 'product_view')
), page_events as (
  select * from scoped where event_type = 'page_view'
), selected_visitors as (
  select distinct visitor_id from page_events where visitor_id is not null
), first_seen as (
  select btrim(history.visitor_id) as visitor_id, min(history.created_at) as first_at,
    (min(history.created_at) at time zone 'Europe/Ljubljana')::date as first_day
  from website_events history join selected_visitors selected on btrim(history.visitor_id) = selected.visitor_id
  where history.event_type = 'page_view' and history.created_at < $3::timestamptz
  group by btrim(history.visitor_id)
), returning_visitors as (
  select distinct page.visitor_id from page_events page join first_seen first using (visitor_id)
  where first.first_day < page.day
), cohort_members as (
  select * from first_seen where first_at >= $1::timestamptz and first_at < $2::timestamptz
), daily as (
  select page.day::text as date, count(*)::int as "pageViews", count(distinct page.session_id)::int as visits,
    count(distinct page.visitor_id)::int as visitors,
    count(distinct page.visitor_id) filter (where first.first_day < page.day)::int as "returningVisitors"
  from page_events page left join first_seen first using (visitor_id) group by page.day
), page_breakdown as (
  select path as key, count(*)::int as views, count(distinct session_id)::int as visits,
    count(distinct visitor_id)::int as visitors from page_events group by path
), product_breakdown as (
  select product_id as key, count(*)::int as views, count(distinct session_id)::int as visits,
    count(distinct visitor_id)::int as visitors from scoped where event_type = 'product_view' group by product_id
), cohort_breakdown as (
  select first_day::text as date, count(*)::int as visitors, first_day + 7 < $4::date as eligible,
    case when first_day + 7 < $4::date then count(*) filter (where exists (
      select 1 from website_events revisit
      where revisit.event_type = 'page_view' and btrim(revisit.visitor_id) = cohort.visitor_id
        and revisit.created_at >= (cohort.first_day + 7)::timestamp at time zone 'Europe/Ljubljana'
        and revisit.created_at < (cohort.first_day + 8)::timestamp at time zone 'Europe/Ljubljana'
        and revisit.created_at < $3::timestamptz
    ))::int else null end as "returnedD7"
  from cohort_members cohort group by first_day
)
select jsonb_build_object(
  'summary', jsonb_build_object(
    'pageViews', (select count(*) from page_events),
    'productViews', (select count(*) from scoped where event_type = 'product_view'),
    'visits', (select count(distinct session_id) from page_events),
    'visitors', (select count(distinct visitor_id) from page_events),
    'returningVisitors', (select count(*) from returning_visitors),
    'firstObservedVisitors', (select count(*) from cohort_members)
  ),
  'days', coalesce((select jsonb_agg(to_jsonb(daily) order by date) from daily), '[]'::jsonb),
  'pages', coalesce((select jsonb_agg(to_jsonb(page_breakdown) order by views desc, key nulls last) from page_breakdown), '[]'::jsonb),
  'products', coalesce((select jsonb_agg(to_jsonb(product_breakdown) order by views desc, key nulls last) from product_breakdown), '[]'::jsonb),
  'cohorts', coalesce((select jsonb_agg(to_jsonb(cohort_breakdown) order by date) from cohort_breakdown), '[]'::jsonb),
  'coverage', jsonb_build_object(
    'historyFrom', (select min(created_at) from website_events where event_type = 'page_view' and created_at < $3::timestamptz),
    'latestEventAt', (select max(created_at) from website_events where event_type in ('page_view', 'product_view') and created_at < $3::timestamptz),
    'missingVisitorPageViews', (select count(*) from page_events where visitor_id is null),
    'missingSessionPageViews', (select count(*) from page_events where session_id is null),
    'missingProductViews', (select count(*) from scoped where event_type = 'product_view' and product_id is null),
    'missingPathPageViews', (select count(*) from page_events where path is null)
  )
) as result`;
