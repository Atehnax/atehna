create table if not exists catalog_item_editor_details (
  item_id bigint primary key references catalog_items(id) on delete cascade,
  product_type text not null default 'simple',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (product_type in ('simple', 'dimensions', 'weight', 'unique_machine'))
);

create index if not exists idx_catalog_item_editor_details_product_type
  on catalog_item_editor_details(product_type);
