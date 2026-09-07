import { AUDIT_GROUP_WINDOW_MS } from '@/shared/audit/auditTypes';
import { isAllPageSize, type PageSizeValue } from '@/shared/domain/pagination';

/** whereSql is built only from the server's fixed filter clauses; every value remains a parameter. */
export function buildAuditEventsPageQuery(whereSql: string, filterParams: readonly unknown[], page: number, pageSize: PageSizeValue) {
  const params: unknown[] = [...filterParams];
  const bind = (value: unknown) => { params.push(value); return `$${params.length}`; };
  const window = bind(AUDIT_GROUP_WINDOW_MS);
  const requestedPage = bind(page);
  const size = isAllPageSize(pageSize) ? null : bind(pageSize);
  const pageCount = size ? `greatest(1, ceil(total::numeric / ${size}::numeric))::int` : '1';
  const selectedGroups = size
    ? `where group_number > (paging.page - 1)::bigint * ${size}::int
         and group_number <= paging.page::bigint * ${size}::int`
    : '';

  // Match groupAuditEvents: adjacent filtered events, one actor/type, within ten
  // seconds, sharing an entity/request (or a category reorder). Never LIMIT raw
  // events: that would split the details and selected IDs of a displayed row.
  return {
    params,
    sql: `
      with matching as (
        select id, occurred_at, created_at, actor_id, actor_name,
               entity_type, entity_id, request_id, action
        from audit_events
        ${whereSql}
      ), adjacent as (
        select matching.*,
          lag(id) over event_order as previous_id,
          lag(occurred_at) over event_order as previous_time,
          lag(coalesce(actor_id, actor_name, '')) over event_order as previous_actor,
          lag(entity_type) over event_order as previous_type,
          lag(entity_id) over event_order as previous_entity,
          lag(request_id) over event_order as previous_request,
          lag(action) over event_order as previous_action
        from matching
        window event_order as (order by occurred_at desc, created_at desc, id desc)
      ), boundaries as (
        select id, occurred_at, created_at,
          case when previous_id is not null
            and coalesce(actor_id, actor_name, '') = previous_actor
            and entity_type = previous_type
            and date_trunc('milliseconds', previous_time) - date_trunc('milliseconds', occurred_at)
                <= ${window}::double precision * interval '1 millisecond'
            and (
              entity_id = previous_entity
              or (request_id is not null and request_id <> '' and request_id = previous_request)
              or (entity_type = 'category' and action = 'reordered' and previous_action = 'reordered')
            )
          then 0 else 1 end as starts_group
        from adjacent
      ), grouped as (
        select id, sum(starts_group) over (
          order by occurred_at desc, created_at desc, id desc rows unbounded preceding
        ) as group_number
        from boundaries
      ), totals as (
        select coalesce(max(group_number), 0)::int as total from grouped
      ), page_counts as (
        select total, ${pageCount} as page_count from totals
      ), paging as (
        select total, page_count, least(${requestedPage}::numeric, page_count)::int as page
        from page_counts
      ), selected_events as (
        select grouped.id from grouped cross join paging ${selectedGroups}
      ), events as (
        select audit_events.* from audit_events join selected_events on selected_events.id = audit_events.id
      )
      select paging.total as audit_total, paging.page as audit_page,
             paging.page_count as audit_page_count, events.*
      from paging left join events on true
      order by events.occurred_at desc, events.created_at desc, events.id desc
    `
  };
}
