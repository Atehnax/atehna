-- Local GURS Register naslovov search index and canonical order-address provenance.

begin;

create extension if not exists pg_trgm;

create table if not exists gurs_addresses (
  gurs_house_number_id text not null,
  street_name text,
  settlement_name text not null,
  house_number text not null,
  house_suffix text,
  postal_code text not null,
  postal_name text not null,
  municipality_name text not null,
  address_line_1 text not null,
  search_text text not null,
  source_updated_at timestamptz,
  imported_at timestamptz not null default now()
);

create unique index if not exists gurs_addresses_house_number_id_uidx
  on gurs_addresses (gurs_house_number_id);

create index if not exists gurs_addresses_search_text_trgm_idx
  on gurs_addresses using gin (search_text gin_trgm_ops);

create table if not exists gurs_address_sync_state (
  key text primary key,
  active_source_updated_at timestamptz,
  active_imported_at timestamptz,
  active_record_count integer not null default 0,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  lock_token text,
  lock_expires_at timestamptz,
  check (active_record_count >= 0)
);

insert into gurs_address_sync_state (key)
values ('active')
on conflict (key) do nothing;

create table if not exists gurs_address_sync_runs (
  id bigserial primary key,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  record_count integer,
  source_updated_at timestamptz,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text,
  check (record_count is null or record_count >= 0)
);

create index if not exists gurs_address_sync_runs_started_at_idx
  on gurs_address_sync_runs (started_at desc);

alter table orders
  add column if not exists gurs_house_number_id text,
  add column if not exists address_line2 text,
  add column if not exists country_code text not null default 'SI';

create index if not exists orders_gurs_house_number_id_idx
  on orders (gurs_house_number_id)
  where gurs_house_number_id is not null;

commit;
