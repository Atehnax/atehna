-- Additive supplier directory. Article labels survive removal from the catalog.
create table catalog_supplier_rows (
  id text constraint catalog_supplier_rows_pkey primary key,
  position integer not null,
  catalog_item_id bigint constraint catalog_supplier_rows_catalog_item_fk references catalog_items(id) on delete set null,
  article_label text not null default '',
  cells jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_supplier_rows_cells_check check (jsonb_typeof(cells) = 'object')
);
create index catalog_supplier_rows_position_idx on catalog_supplier_rows(position, id);
create index catalog_supplier_rows_catalog_item_idx on catalog_supplier_rows(catalog_item_id);