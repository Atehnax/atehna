begin;

alter table gurs_addresses add column if not exists official_address_id text;
alter table gurs_addresses add column if not exists municipality_id text;
alter table gurs_addresses add column if not exists region_id text;
alter table gurs_addresses add column if not exists easting numeric;
alter table gurs_addresses add column if not exists northing numeric;

create table if not exists analytics_geography_references (
  version text primary key,
  imported_at timestamptz not null,
  metadata_json jsonb not null,
  full_geometry_json jsonb not null,
  render_geometry_json jsonb not null,
  status text not null constraint analytics_geography_references_status_check check (status in ('staged', 'validated')),
  created_at timestamptz not null default now()
);
create table if not exists analytics_geography_state (
  key text primary key constraint analytics_geography_state_key_check check (key = 'active'),
  reporting_version text constraint analytics_geography_state_reporting_version_fkey references analytics_geography_references(version),
  latest_version text constraint analytics_geography_state_latest_version_fkey references analytics_geography_references(version),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error text
);
insert into analytics_geography_state (key) values ('active') on conflict (key) do nothing;

create table if not exists order_geography_resolutions (
  order_id bigint primary key constraint order_geography_resolutions_order_id_fkey references orders(id) on delete cascade,
  address_basis text not null,
  address_fingerprint text not null,
  address_snapshot_json jsonb not null,
  official_address_id text,
  municipality_id text,
  region_id text,
  resolution_status text not null constraint order_geography_resolutions_resolution_status_check check (resolution_status in ('municipality', 'region_only', 'ambiguous', 'unmatched', 'partial', 'foreign', 'unknown_country')),
  resolution_method text not null,
  source_version text not null,
  resolved_at timestamptz not null default now(),
  manual_override boolean not null default false
);
create index if not exists order_geography_municipality_idx on order_geography_resolutions (source_version, municipality_id, order_id);
create index if not exists order_geography_region_idx on order_geography_resolutions (source_version, region_id, order_id);
create index if not exists order_geography_unresolved_idx on order_geography_resolutions (resolution_status, order_id);

create table if not exists order_geography_audit (
  id bigserial primary key,
  order_id bigint,
  action text not null,
  actor text not null,
  reason text not null,
  previous_json jsonb,
  next_json jsonb,
  created_at timestamptz not null default now()
);
create table if not exists analytics_geography_backfill (
  source_version text primary key,
  after_order_id bigint not null default 0,
  processed_count bigint not null default 0,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
commit;
