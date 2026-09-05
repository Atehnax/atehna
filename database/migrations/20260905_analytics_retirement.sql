-- Retire the removed analytics builder and introduce persistent diagnostics.
-- Apply during the analytics cutover; never from build, startup or a request.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '5min';
set local search_path = public, pg_temp;
select pg_advisory_xact_lock(hashtext('atehna:analytics-retirement:20260905'));

create table if not exists retired_configuration_archive (
  source_table text not null,
  source_key text not null,
  captured_at timestamptz not null default now(),
  payload jsonb not null,
  constraint retired_configuration_archive_pkey primary key (source_table, source_key),
  constraint retired_configuration_archive_source_check check (source_table in ('analytics_charts', 'analytics_chart_settings')),
  constraint retired_configuration_archive_payload_check check (jsonb_typeof(payload) = 'object')
);

-- Preserve each configuration exactly once as inert evidence. No application
-- route reads this archive, and the old tables/functions are removed below.
do $archive_retired_configuration$
declare
  source_relation text;
  source_key_column text;
  changed_archive boolean;
begin
  foreach source_relation in array array['analytics_charts', 'analytics_chart_settings'] loop
    if to_regclass('public.' || source_relation) is not null then
      source_key_column := case when source_relation = 'analytics_charts' then 'id' else 'dashboard_key' end;
      execute format('lock table public.%I in access exclusive mode', source_relation);
      execute format(
        'insert into retired_configuration_archive (source_table, source_key, payload) select %L, source.%I::text, to_jsonb(source) from public.%I as source on conflict (source_table, source_key) do nothing',
        source_relation, source_key_column, source_relation
      );
      execute format(
        'select exists (select 1 from public.%I as source left join retired_configuration_archive as archive on archive.source_table = %L and archive.source_key = source.%I::text where archive.payload is distinct from to_jsonb(source))',
        source_relation, source_relation, source_key_column
      ) into changed_archive;
      if changed_archive then
        raise exception 'Retired configuration archive does not exactly preserve %', source_relation;
      end if;
    end if;
  end loop;
end;
$archive_retired_configuration$;

drop table if exists analytics_charts;
drop table if exists analytics_chart_settings;
drop function if exists set_analytics_charts_updated_at();

create table if not exists diagnostics_events (
  id uuid constraint diagnostics_events_pkey primary key,
  recorded_at timestamptz not null,
  trace_id uuid not null,
  context text not null,
  operation text not null,
  kind text not null,
  duration_ms double precision,
  payload_bytes bigint,
  error boolean not null default false,
  error_code text,
  phases_json jsonb not null default '{}'::jsonb,
  details_json jsonb not null default '{}'::jsonb,
  constraint diagnostics_events_kind_check check (kind in ('route', 'loader', 'cache_miss', 'invalidation')),
  constraint diagnostics_events_duration_check check (duration_ms is null or duration_ms >= 0),
  constraint diagnostics_events_payload_bytes_check check (payload_bytes is null or payload_bytes >= 0),
  constraint diagnostics_events_phases_json_check check (jsonb_typeof(phases_json) = 'object'),
  constraint diagnostics_events_details_json_check check (jsonb_typeof(details_json) = 'object')
);
create index if not exists diagnostics_events_recorded_at_idx on diagnostics_events (recorded_at);
create index if not exists diagnostics_events_context_recorded_at_idx on diagnostics_events (context, recorded_at);
create index if not exists diagnostics_events_error_recorded_at_idx on diagnostics_events (recorded_at) where error;

commit;
