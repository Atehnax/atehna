create table if not exists catalog_items (
  id bigserial primary key,
  item_name text not null,
  item_type text not null check (item_type in ('unit', 'sheet', 'linear', 'bulk')),
  badge text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  category_id text references catalog_categories(id) on delete set null,
  sku text,
  slug text not null unique,
  unit text,
  brand text,
  material text,
  colour text,
  shape text,
  description text not null default '',
  admin_notes text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_catalog_items_category_id on catalog_items(category_id);
create index if not exists idx_catalog_items_status on catalog_items(status);
create index if not exists idx_catalog_items_position on catalog_items(position);

create table if not exists catalog_item_variants (
  id bigserial primary key,
  item_id bigint not null references catalog_items(id) on delete cascade,
  variant_name text not null,
  length numeric(12,3),
  width numeric(12,3),
  thickness numeric(12,3),
  weight numeric(12,3),
  error_tolerance text,
  price numeric(12,2) not null default 0,
  discount_pct numeric(5,2) not null default 0,
  inventory integer not null default 0,
  min_order integer not null default 1,
  variant_sku text,
  unit text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  badge text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_catalog_item_variants_item_id on catalog_item_variants(item_id);
create index if not exists idx_catalog_item_variants_status on catalog_item_variants(status);
create index if not exists idx_catalog_item_variants_position on catalog_item_variants(item_id, position);

create table if not exists catalog_media (
  id bigserial primary key,
  item_id bigint not null references catalog_items(id) on delete cascade,
  variant_id bigint references catalog_item_variants(id) on delete cascade,
  media_kind text not null check (media_kind in ('image', 'video', 'document')),
  role text not null check (role in ('gallery', 'technical_sheet')),
  source_kind text not null check (source_kind in ('upload', 'youtube')),
  filename text,
  blob_url text,
  blob_pathname text,
  external_url text,
  mime_type text,
  alt_text text,
  image_type text,
  image_dimensions jsonb,
  video_type text,
  hidden boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((source_kind = 'youtube' and external_url is not null) or source_kind <> 'youtube')
);

create index if not exists idx_catalog_media_item_id on catalog_media(item_id);
create index if not exists idx_catalog_media_variant_id on catalog_media(variant_id);
create index if not exists idx_catalog_media_role on catalog_media(role);
create index if not exists idx_catalog_media_kind on catalog_media(media_kind);
create index if not exists idx_catalog_media_position on catalog_media(item_id, position);
