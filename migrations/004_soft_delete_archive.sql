alter table if exists orders
  add column if not exists deleted_at timestamptz;

alter table if exists order_documents
  add column if not exists deleted_at timestamptz;

create table if not exists deleted_archive_entries (
  id bigserial primary key,
  item_type text not null check (item_type in ('order', 'pdf')),
  order_id bigint,
  document_id bigint,
  label text not null,
  deleted_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '60 days'),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_orders_deleted_at on orders(deleted_at);
create index if not exists idx_order_documents_deleted_at on order_documents(deleted_at);
create index if not exists idx_deleted_archive_expires_at on deleted_archive_entries(expires_at);
create index if not exists idx_deleted_archive_item_type on deleted_archive_entries(item_type);
create index if not exists idx_deleted_archive_order_id on deleted_archive_entries(order_id);
