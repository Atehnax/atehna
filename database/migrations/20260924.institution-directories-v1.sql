-- Add isolated editable directories without modifying primary-school or customer records.
-- Apply with scripts/migrate-institution-directories.mjs.
create table institution_directories (
  id text constraint institution_directories_pkey primary key,
  seed_version integer not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institution_directories_content_check check (jsonb_typeof(content) = 'object')
);
