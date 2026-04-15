create table if not exists order_payment_logs (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  previous_status text,
  new_status text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_payment_logs_order_created_at
  on order_payment_logs(order_id, created_at desc);
