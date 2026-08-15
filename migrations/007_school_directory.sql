begin;

create table if not exists school_directory_meta (
  key text primary key,
  seed_version integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists school_directory_columns (
  id text primary key,
  label text not null,
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists school_directory_rows (
  id text primary key,
  position integer not null,
  cells jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists school_directory_columns_position_idx
  on school_directory_columns (position, id);

create unique index if not exists school_directory_columns_label_unique_idx
  on school_directory_columns (lower(btrim(label)));

create index if not exists school_directory_rows_position_idx
  on school_directory_rows (position, id);

commit;
