create extension if not exists pgcrypto;

create table if not exists orders (
  id bigserial primary key,
  order_number text not null unique,
  customer_type text not null check (customer_type in ('individual', 'company', 'school')),
  organization_name text,
  contact_name text not null,
  email text not null,
  delivery_address text,
  postal_code text,
  reference text,
  notes text,
  status text not null default 'received' check (
    status in ('received', 'in_progress', 'partially_sent', 'sent', 'finished', 'cancelled')
  ),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded')),
  admin_order_notes text,
  subtotal numeric(12, 2) not null default 0,
  tax numeric(12, 2) not null default 0,
  shipping numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  is_draft boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_created_at on orders(created_at desc);
create index if not exists idx_orders_deleted_at on orders(deleted_at);
create index if not exists idx_orders_is_draft on orders(is_draft);
create index if not exists idx_orders_status_created_at on orders(status, created_at desc);
create index if not exists idx_orders_payment_status_created_at on orders(payment_status, created_at desc);

create table if not exists order_items (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  sku text not null,
  name text not null,
  unit text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2),
  total_price numeric(12, 2)
);

create index if not exists idx_order_items_order_id on order_items(order_id);
create index if not exists idx_order_items_sku on order_items(lower(trim(sku)));

create table if not exists order_documents (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  type text not null,
  filename text not null,
  blob_url text not null,
  blob_pathname text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_documents_order_id_created_at on order_documents(order_id, created_at desc);
create index if not exists idx_order_documents_deleted_at on order_documents(deleted_at);
create index if not exists idx_order_documents_order_type_active
  on order_documents(order_id, type)
  where deleted_at is null;

create table if not exists order_status_logs (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  previous_status text,
  new_status text not null check (
    new_status in ('received', 'in_progress', 'partially_sent', 'sent', 'finished', 'cancelled')
  ),
  created_at timestamptz not null default now()
);

create index if not exists idx_order_status_logs_order_id_created_at
  on order_status_logs(order_id, created_at desc);
create index if not exists idx_order_status_logs_new_status_created_at
  on order_status_logs(new_status, created_at desc);

create table if not exists order_payment_logs (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  previous_status text,
  new_status text not null check (new_status in ('unpaid', 'paid', 'refunded')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_payment_logs_order_id_created_at
  on order_payment_logs(order_id, created_at desc);

create table if not exists website_events (
  id bigserial primary key,
  event_type text not null,
  path text not null,
  product_id text,
  session_id text not null,
  visitor_id text not null,
  user_id text,
  user_agent text,
  referrer text,
  created_at timestamptz not null default now()
);

create index if not exists idx_website_events_created_at on website_events(created_at);
create index if not exists idx_website_events_type on website_events(event_type);
create index if not exists idx_website_events_path on website_events(path);
create index if not exists idx_website_events_product on website_events(product_id);
create index if not exists idx_website_events_visitor on website_events(visitor_id);

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

create index if not exists idx_deleted_archive_expires_at on deleted_archive_entries(expires_at);
create index if not exists idx_deleted_archive_item_type on deleted_archive_entries(item_type);
create index if not exists idx_deleted_archive_order_id on deleted_archive_entries(order_id);

create table if not exists analytics_charts (
  id bigserial primary key,
  dashboard_key text not null default 'narocila',
  key text not null unique,
  title text not null,
  description text,
  comment text,
  chart_type text not null,
  config_json jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists analytics_charts_dashboard_position_idx
  on analytics_charts(dashboard_key, position);

create or replace function set_analytics_charts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists analytics_charts_set_updated_at on analytics_charts;

create trigger analytics_charts_set_updated_at
before update on analytics_charts
for each row execute function set_analytics_charts_updated_at();

create table if not exists analytics_chart_settings (
  dashboard_key text primary key,
  settings_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists catalog_categories (
  id text primary key,
  parent_id text references catalog_categories(id) on delete cascade,
  slug text not null,
  title text not null,
  summary text not null default '',
  description text not null default '',
  image text not null default '',
  admin_notes text,
  banner_image text,
  items jsonb not null default '[]'::jsonb,
  position integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_categories_status_check check (status in ('active', 'inactive')),
  constraint catalog_categories_parent_slug_unique unique (parent_id, slug)
);

create index if not exists idx_catalog_categories_parent_position
  on catalog_categories(parent_id, position);
create index if not exists idx_catalog_categories_parent
  on catalog_categories(parent_id);

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
create index if not exists idx_catalog_items_sku on catalog_items(lower(trim(sku)));

create table if not exists catalog_item_variants (
  id bigserial primary key,
  item_id bigint not null references catalog_items(id) on delete cascade,
  variant_name text not null,
  length numeric(12, 3),
  width numeric(12, 3),
  thickness numeric(12, 3),
  weight numeric(12, 3),
  error_tolerance text,
  price numeric(12, 2) not null default 0,
  discount_pct numeric(5, 2) not null default 0,
  inventory integer not null default 0,
  min_order integer not null default 1,
  variant_sku text,
  unit text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  badge text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_pct >= 0 and discount_pct <= 100),
  check (inventory >= 0),
  check (min_order >= 1)
);

create index if not exists idx_catalog_item_variants_item_id on catalog_item_variants(item_id);
create index if not exists idx_catalog_item_variants_status on catalog_item_variants(status);
create index if not exists idx_catalog_item_variants_position on catalog_item_variants(item_id, position);
create index if not exists idx_catalog_item_variants_sku on catalog_item_variants(lower(trim(variant_sku)));

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

create table if not exists catalog_item_quantity_discounts (
  id bigserial primary key,
  item_id bigint not null references catalog_items(id) on delete cascade,
  min_quantity integer not null default 1,
  discount_percent numeric(5, 2) not null default 0,
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
  on audit_events(entity_type, entity_id, occurred_at desc);
create index if not exists audit_events_occurred_at_idx
  on audit_events(occurred_at desc);
create index if not exists audit_events_actor_idx
  on audit_events(actor_id, occurred_at desc);
create index if not exists audit_events_action_idx
  on audit_events(action, occurred_at desc);
create index if not exists audit_events_retention_idx
  on audit_events(retention_until)
  where retention_until is not null;

create table if not exists audit_settings (
  key text primary key,
  is_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into audit_settings (key, is_enabled, updated_at)
values ('global', true, now())
on conflict (key) do nothing;
