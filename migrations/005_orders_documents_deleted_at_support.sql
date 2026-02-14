alter table if exists orders
  add column if not exists deleted_at timestamptz;

alter table if exists order_documents
  add column if not exists deleted_at timestamptz;

create index if not exists idx_orders_deleted_at on orders(deleted_at);
create index if not exists idx_order_documents_deleted_at on order_documents(deleted_at);
