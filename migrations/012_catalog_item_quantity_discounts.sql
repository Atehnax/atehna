create table if not exists catalog_item_quantity_discounts (
  id bigserial primary key,
  item_id bigint not null references catalog_items(id) on delete cascade,
  min_quantity integer not null default 1,
  discount_percent numeric(5,2) not null default 0,
  applies_to text not null default 'allVariants',
  note text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_quantity >= 1),
  check (discount_percent >= 0 and discount_percent <= 100)
);

create index if not exists idx_catalog_item_quantity_discounts_item_id
  on catalog_item_quantity_discounts(item_id);

create index if not exists idx_catalog_item_quantity_discounts_position
  on catalog_item_quantity_discounts(item_id, position);
