begin;

create table if not exists product_appearance_settings (
  key text primary key,
  config_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

commit;
