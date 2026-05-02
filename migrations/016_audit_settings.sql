create table if not exists audit_settings (
  key text primary key,
  is_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into audit_settings (key, is_enabled, updated_at)
values ('global', true, now())
on conflict (key) do nothing;
