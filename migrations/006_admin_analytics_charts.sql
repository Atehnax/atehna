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
);

create index if not exists analytics_charts_dashboard_position_idx
  on analytics_charts (dashboard_key, position);

create or replace function set_analytics_charts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists analytics_charts_set_updated_at on analytics_charts;

create trigger analytics_charts_set_updated_at
before update on analytics_charts
for each row execute function set_analytics_charts_updated_at();
