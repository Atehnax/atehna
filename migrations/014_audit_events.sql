create extension if not exists pgcrypto;

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_id text,
  actor_name text,
  actor_email text,
  entity_type text not null,
  entity_id text not null,
  entity_label text,
  action text not null,
  summary text not null,
  diff_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  request_id text,
  source text not null default 'admin',
  ip_hash text,
  user_agent_hash text,
  retention_until timestamptz,
  created_at timestamptz not null default now(),
  constraint audit_events_entity_type_check check (
    entity_type in ('item', 'order', 'category', 'media', 'system')
  ),
  constraint audit_events_action_check check (
    action in (
      'created',
      'updated',
      'deleted',
      'archived',
      'restored',
      'uploaded',
      'removed',
      'status_changed',
      'reordered',
      'price_changed',
      'stock_changed'
    )
  )
);

create index if not exists audit_events_entity_idx
on audit_events (entity_type, entity_id, occurred_at desc);

create index if not exists audit_events_occurred_at_idx
on audit_events (occurred_at desc);

create index if not exists audit_events_actor_idx
on audit_events (actor_id, occurred_at desc);

create index if not exists audit_events_action_idx
on audit_events (action, occurred_at desc);

create index if not exists audit_events_retention_idx
on audit_events (retention_until)
where retention_until is not null;
