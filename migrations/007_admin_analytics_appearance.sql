create table if not exists analytics_chart_settings (
  dashboard_key text primary key,
  settings_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
