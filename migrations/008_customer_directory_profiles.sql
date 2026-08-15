begin;

create table if not exists customer_directory_profiles (
  id text primary key,
  source_customer_key text,
  name text not null default '',
  address text not null default '',
  postal_code text not null default '',
  city text not null default '',
  contacts text[] not null default array[]::text[],
  emails text[] not null default array[]::text[],
  overridden_fields text[] not null default array[]::text[],
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table customer_directory_profiles
  add column if not exists overridden_fields text[];

update customer_directory_profiles
set overridden_fields = array['name', 'address', 'postalCode', 'city', 'contacts', 'emails']::text[]
where overridden_fields is null;

alter table customer_directory_profiles
  alter column overridden_fields set default array[]::text[],
  alter column overridden_fields set not null;

create unique index if not exists customer_directory_profiles_source_key_unique_idx
  on customer_directory_profiles (source_customer_key)
  where source_customer_key is not null;

create index if not exists customer_directory_profiles_active_idx
  on customer_directory_profiles (archived_at, created_at, id);

commit;
