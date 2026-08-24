-- Atehna canonical database schema.
-- Apply this complete schema only to a newly created, empty PostgreSQL database.

begin;

-- ============================================================================
-- Core application schema
-- ============================================================================

create extension if not exists pgcrypto;

create table orders (
  id bigserial primary key,
  order_number text not null unique,
  customer_type text not null check (customer_type in ('individual', 'company', 'school')),
  organization_name text,
  contact_name text not null,
  email text not null,
  address_line1 text,
  address_line2 text,
  city text,
  postal_code text,
  country_code text not null default 'SI',
  gurs_house_number_id text,
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
  currency text not null default 'EUR',
  tax_rate numeric(5, 4) not null default 0.2200,
  pricing_version text not null default 'unpriced-draft-v1',
  commitment_status text not null default 'binding',
  is_draft boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint orders_commitment_status_check check (
    commitment_status in ('binding', 'pending_confirmation', 'rejected')
  ),
  constraint orders_tax_rate_range_check check (tax_rate >= 0 and tax_rate <= 1)
);

create index idx_orders_created_at on orders(created_at desc);
create index idx_orders_deleted_at on orders(deleted_at);
create index idx_orders_is_draft on orders(is_draft);
create index idx_orders_status_created_at on orders(status, created_at desc);
create index idx_orders_payment_status_created_at on orders(payment_status, created_at desc);

create table order_documents (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  customer_access_id uuid not null default gen_random_uuid(),
  type text not null,
  filename text not null,
  blob_pathname text not null,
  version_number integer not null,
  document_number text not null,
  issued_at timestamptz not null,
  content_sha256 text not null,
  legal_status text not null,
  format_marker text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_order_documents_order_id_created_at on order_documents(order_id, created_at desc);
create unique index idx_order_documents_customer_access_id
  on order_documents(customer_access_id);
create index idx_order_documents_deleted_at on order_documents(deleted_at);
create index idx_order_documents_order_type_active
  on order_documents(order_id, type)
  where deleted_at is null;
create unique index idx_order_documents_order_type_version
  on order_documents(order_id, type, version_number);
create index idx_order_documents_content_sha256
  on order_documents(content_sha256);

create table order_status_logs (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  previous_status text,
  new_status text not null check (
    new_status in ('received', 'in_progress', 'partially_sent', 'sent', 'finished', 'cancelled')
  ),
  created_at timestamptz not null default now()
);

create index idx_order_status_logs_order_id_created_at
  on order_status_logs(order_id, created_at desc);
create index idx_order_status_logs_new_status_created_at
  on order_status_logs(new_status, created_at desc);

create table order_payment_logs (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  previous_status text,
  new_status text not null check (new_status in ('unpaid', 'paid', 'refunded')),
  note text,
  created_at timestamptz not null default now()
);

create index idx_order_payment_logs_order_id_created_at
  on order_payment_logs(order_id, created_at desc);

create table website_events (
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

create index idx_website_events_created_at on website_events(created_at);
create index idx_website_events_type on website_events(event_type);
create index idx_website_events_path on website_events(path);
create index idx_website_events_product on website_events(product_id);
create index idx_website_events_visitor on website_events(visitor_id);

create table deleted_archive_entries (
  id bigserial primary key,
  item_type text not null check (item_type in ('order', 'pdf')),
  order_id bigint,
  document_id bigint,
  label text not null,
  deleted_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  payload jsonb not null default '{}'::jsonb
);

create index idx_deleted_archive_expires_at on deleted_archive_entries(expires_at);
create index idx_deleted_archive_item_type on deleted_archive_entries(item_type);
create index idx_deleted_archive_order_id on deleted_archive_entries(order_id);

create table analytics_charts (
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

create index analytics_charts_dashboard_position_idx
  on analytics_charts(dashboard_key, position);

create function set_analytics_charts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger analytics_charts_set_updated_at
before update on analytics_charts
for each row execute function set_analytics_charts_updated_at();

create table analytics_chart_settings (
  dashboard_key text primary key,
  settings_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table site_navigation_settings (
  key text primary key,
  config_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table landing_page_settings (
  key text primary key,
  config_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table global_style_settings (
  key text primary key,
  config_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table product_appearance_settings (
  key text primary key,
  config_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table site_logo_settings (
  key text primary key,
  config_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table catalog_categories (
  id text primary key,
  parent_id text references catalog_categories(id) on delete cascade,
  slug text not null,
  title text not null,
  summary text not null default '',
  description text not null default '',
  image text not null default '',
  presentation_json jsonb not null default '{}'::jsonb,
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

create index idx_catalog_categories_parent_position
  on catalog_categories(parent_id, position);
create index idx_catalog_categories_parent
  on catalog_categories(parent_id);
create unique index idx_catalog_categories_root_slug_unique
  on catalog_categories(slug)
  where parent_id is null;

-- Seed the catalogue so every catalogue consumer reads the same category records.
insert into catalog_categories
  (id, parent_id, slug, title, summary, description, image, presentation_json, items, position, status)
values
  (
    'ddb7068a-22e6-42f4-aa91-a5750ceb1cde',
    null,
    'tehnika-in-tehnologija',
    'Tehnika in tehnologija',
    'Tehnika in tehnologija',
    '',
    '/images/categories/cutouts/tehnika-in-tehnologija.png',
    '{"crop":{"x":0,"y":0,"width":1,"height":1},"focalPoint":{"x":0.5,"y":0.5},"scale":1,"offsetOriginX":-17,"offsetOriginY":2.7261,"offsetX":0,"offsetY":0,"fit":"contain","titleColor":"#111827","titleHoverColor":"#111827","backgroundColor":"#F5F3EF","backgroundHoverColor":"#F6F1EA","ordinalFontSizePx":11,"ordinalColor":"#354052","ordinalHoverColor":"#354052"}'::jsonb,
    '[]'::jsonb,
    0,
    'active'
  ),
  (
    '49f023be-9fac-4a75-8d8f-8cfe7ff79c6e',
    null,
    'materiali',
    'Materiali',
    'Materiali',
    '',
    '/images/categories/cutouts/materiali.png',
    '{"crop":{"x":0,"y":0,"width":1,"height":1},"focalPoint":{"x":0.5,"y":0.5},"scale":1,"offsetOriginX":0,"offsetOriginY":0,"offsetX":-10.4977,"offsetY":2.7261,"fit":"contain","titleColor":"#111827","titleHoverColor":"#111827","backgroundColor":"#F5F3EF","backgroundHoverColor":"#F6F1EA","ordinalFontSizePx":11,"ordinalColor":"#354052","ordinalHoverColor":"#354052"}'::jsonb,
    '[]'::jsonb,
    1,
    'active'
  ),
  (
    'a3ffc3c9-b54d-49aa-aba7-9d1aab761217',
    null,
    'stroji-in-naprave',
    'Stroji in naprave',
    'Stroji in naprave',
    '',
    '/images/categories/cutouts/stroji-in-naprave.png',
    '{"crop":{"x":0,"y":0,"width":1,"height":1},"focalPoint":{"x":0.5,"y":0.5},"scale":1,"offsetOriginX":0,"offsetOriginY":0,"offsetX":-16.7962,"offsetY":2.2718,"fit":"contain","titleColor":"#111827","titleHoverColor":"#111827","backgroundColor":"#F5F3EF","backgroundHoverColor":"#F6F1EA","ordinalFontSizePx":11,"ordinalColor":"#354052","ordinalHoverColor":"#354052"}'::jsonb,
    '[]'::jsonb,
    2,
    'active'
  ),
  (
    'bdd46c8e-d4b0-4996-ab7d-e67837e66032',
    null,
    'merilno-orodje-in-geometrija',
    'Merilno orodje in geometrija',
    'Merilno orodje in geometrija',
    '',
    '/images/categories/cutouts/merilno-orodje-in-geometrija.png',
    '{"crop":{"x":0,"y":0,"width":1,"height":1},"focalPoint":{"x":0.5,"y":0.5},"scale":1,"offsetOriginX":0,"offsetOriginY":0,"offsetX":-22.675,"offsetY":-1.3631,"fit":"contain","titleColor":"#111827","titleHoverColor":"#111827","backgroundColor":"#F5F3EF","backgroundHoverColor":"#F6F1EA","ordinalFontSizePx":11,"ordinalColor":"#354052","ordinalHoverColor":"#354052"}'::jsonb,
    '[]'::jsonb,
    3,
    'active'
  ),
  (
    '0ed1aaf2-497c-4522-97dd-2476a28b4029',
    null,
    'elektricni-in-mehanicni-elementi',
    'Električni in mehanični elementi',
    'Električni in mehanični elementi',
    '',
    '/images/categories/cutouts/elektricni-in-mehanicni-elementi.png',
    '{"crop":{"x":0,"y":0,"width":1,"height":1},"focalPoint":{"x":0.5,"y":0.5},"scale":1,"offsetOriginX":0,"offsetOriginY":0,"offsetX":-24.3546,"offsetY":1.8174,"fit":"contain","titleColor":"#111827","titleHoverColor":"#111827","backgroundColor":"#F5F3EF","backgroundHoverColor":"#F6F1EA","ordinalFontSizePx":11,"ordinalColor":"#354052","ordinalHoverColor":"#354052"}'::jsonb,
    '[]'::jsonb,
    4,
    'active'
  ),
  (
    '979abbb8-3dbb-45f4-9872-444cf63921b2',
    null,
    'rocno-orodje-in-delavniski-pribor',
    'Ročno orodje in delavniški pribor',
    'Ročno orodje in delavniški pribor',
    '',
    '/images/categories/cutouts/rocno-orodje-in-delavniski-pribor.png',
    '{"crop":{"x":0,"y":0,"width":1,"height":1},"focalPoint":{"x":0.5,"y":0.5},"scale":1,"offsetOriginX":-21.4153,"offsetOriginY":1.8174,"offsetX":0,"offsetY":0,"fit":"contain","titleColor":"#111827","titleHoverColor":"#111827","backgroundColor":"#F5F3EF","backgroundHoverColor":"#F6F1EA","ordinalFontSizePx":11,"ordinalColor":"#354052","ordinalHoverColor":"#354052"}'::jsonb,
    '[]'::jsonb,
    5,
    'active'
  ),
  (
    '2e789ad2-acea-4138-9114-311a88979610',
    null,
    'zascita-pri-delu',
    'Zaščita pri delu',
    'Zaščita pri delu',
    '',
    '/images/categories/cutouts/zascita-pri-delu.png',
    '{"crop":{"x":0,"y":0,"width":1,"height":1},"focalPoint":{"x":0.5,"y":0.5},"scale":1,"offsetOriginX":0,"offsetOriginY":0,"offsetX":-27.294,"offsetY":2.7262,"fit":"contain","titleColor":"#111827","titleHoverColor":"#111827","backgroundColor":"#F5F3EF","backgroundHoverColor":"#F6F1EA","ordinalFontSizePx":11,"ordinalColor":"#354052","ordinalHoverColor":"#354052"}'::jsonb,
    '[]'::jsonb,
    6,
    'active'
  ),
  (
    '627ff18f-81ac-45a2-b7f3-08b4d1fc331e',
    null,
    'dodatki-in-nadomestni-deli',
    'Dodatki in nadomestni deli',
    'Dodatki in nadomestni deli',
    '',
    '/images/categories/cutouts/dodatki-in-nadomestni-deli.png',
    '{"crop":{"x":0,"y":0,"width":1,"height":1},"focalPoint":{"x":0.5,"y":0.5},"scale":1,"offsetOriginX":0,"offsetOriginY":0,"offsetX":-23.5149,"offsetY":3.6349,"fit":"contain","titleColor":"#111827","titleHoverColor":"#111827","backgroundColor":"#F5F3EF","backgroundHoverColor":"#F6F1EA","ordinalFontSizePx":11,"ordinalColor":"#354052","ordinalHoverColor":"#354052"}'::jsonb,
    '[]'::jsonb,
    7,
    'active'
  ),
  (
    '2d876cd4-f0ff-4007-86b4-c99f89c060c8',
    null,
    'testna-kategorija',
    'testna kategorija',
    'testna kategorija',
    '',
    '',
    '{"crop":{"x":0,"y":0,"width":1,"height":1},"focalPoint":{"x":0.5,"y":0.5},"scale":1,"offsetOriginX":0,"offsetOriginY":0,"offsetX":0,"offsetY":0,"fit":"contain","titleColor":"#111827","titleHoverColor":"#111827","backgroundColor":"#F5F3EF","backgroundHoverColor":"#F6F1EA","ordinalFontSizePx":11,"ordinalColor":"#354052","ordinalHoverColor":"#354052"}'::jsonb,
    '[]'::jsonb,
    8,
    'active'
  );

insert into catalog_categories
  (id, parent_id, slug, title, summary, description, image, presentation_json, items, position, status)
select
    '424579b4-afc9-49d0-890b-850f2e96b9fc',
    parent.id,
    'kovine',
    'Kovine',
    '',
    '',
    '',
    '{}'::jsonb,
    '[]'::jsonb,
    0,
    'active'
from catalog_categories parent
where parent.parent_id is null
  and parent.slug = 'materiali';

create table catalog_items (
  id bigserial primary key,
  item_name text not null,
  item_type text not null check (item_type in ('unit', 'sheet', 'linear', 'bulk')),
  badge text,
  status text not null default 'active',
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
  default_variant_id bigint,
  tax_rate numeric(5, 4) not null default 0.2200,
  appearance_override_json jsonb,
  status_before_delete text,
  deleted_at timestamptz,
  purge_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_items_status_check check (
    status in ('active', 'inactive', 'deleted')
  ),
  constraint catalog_items_status_before_delete_check check (
    status_before_delete is null or status_before_delete in ('active', 'inactive')
  ),
  constraint catalog_items_tax_rate_check check (tax_rate >= 0 and tax_rate <= 1),
  constraint catalog_items_appearance_override_json_check check (
    appearance_override_json is null or jsonb_typeof(appearance_override_json) = 'object'
  ),
  constraint catalog_items_deleted_retention_check check (
    (
      status = 'deleted'
      and status_before_delete is not null
      and deleted_at is not null
      and purge_after is not null
      and purge_after >= deleted_at
    )
    or
    (
      status <> 'deleted'
      and status_before_delete is null
      and deleted_at is null
      and purge_after is null
    )
  )
);

create index idx_catalog_items_category_id on catalog_items(category_id);
create index idx_catalog_items_status on catalog_items(status);
create index idx_catalog_items_position on catalog_items(position);
create index idx_catalog_items_sku on catalog_items(lower(trim(sku)));

create table catalog_item_variants (
  id bigserial primary key,
  item_id bigint not null references catalog_items(id) on delete cascade,
  variant_name text not null,
  length numeric(12, 3),
  width numeric(12, 3),
  thickness numeric(12, 3),
  weight numeric(12, 3),
  error_tolerance text,
  price numeric(12, 2) not null default 0,
  cost_net numeric(12, 2),
  discount_pct numeric(5, 2) not null default 0,
  inventory integer not null default 0,
  min_order integer not null default 1,
  variant_sku text,
  unit text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  badge text,
  content_override_json jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_item_variants_id_item_id_key unique (id, item_id),
  constraint catalog_item_variants_cost_net_check check (cost_net is null or cost_net >= 0),
  constraint catalog_item_variants_content_override_json_check check (
    content_override_json is null or jsonb_typeof(content_override_json) = 'object'
  ),
  check (discount_pct >= 0 and discount_pct <= 100),
  check (inventory >= 0),
  check (min_order >= 1)
);

create index idx_catalog_item_variants_item_id on catalog_item_variants(item_id);
create index idx_catalog_item_variants_status on catalog_item_variants(status);
create index idx_catalog_item_variants_position on catalog_item_variants(item_id, position);
create index idx_catalog_item_variants_sku on catalog_item_variants(lower(trim(variant_sku)));

create table catalog_media (
  id bigserial primary key,
  item_id bigint not null references catalog_items(id) on delete cascade,
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
  constraint catalog_media_id_item_id_key unique (id, item_id),
  check ((source_kind = 'youtube' and external_url is not null) or source_kind <> 'youtube')
);

create index idx_catalog_media_item_id on catalog_media(item_id);
create index idx_catalog_media_role on catalog_media(role);
create index idx_catalog_media_kind on catalog_media(media_kind);
create index idx_catalog_media_position on catalog_media(item_id, position);

create table catalog_item_quantity_discounts (
  id bigserial primary key,
  item_id bigint not null references catalog_items(id) on delete cascade,
  min_quantity integer not null default 1,
  discount_percent numeric(5, 2) not null default 0,
  applies_to text not null default '{"variants":["Vse"],"customers":["Vse"]}',
  note text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_quantity >= 1),
  check (discount_percent >= 0 and discount_percent <= 100)
);

create index idx_catalog_item_quantity_discounts_item_id
  on catalog_item_quantity_discounts(item_id);
create index idx_catalog_item_quantity_discounts_position
  on catalog_item_quantity_discounts(item_id, position);

create table catalog_item_editor_details (
  item_id bigint primary key references catalog_items(id) on delete cascade,
  product_type text not null default 'simple',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (product_type in ('simple', 'dimensions', 'weight', 'unique_machine'))
);

create index idx_catalog_item_editor_details_product_type
  on catalog_item_editor_details(product_type);

create table audit_events (
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

create index audit_events_entity_idx
  on audit_events(entity_type, entity_id, occurred_at desc);
create index audit_events_occurred_at_idx
  on audit_events(occurred_at desc);
create index audit_events_actor_idx
  on audit_events(actor_id, occurred_at desc);
create index audit_events_action_idx
  on audit_events(action, occurred_at desc);
create index audit_events_retention_idx
  on audit_events(retention_until)
  where retention_until is not null;

create table audit_settings (
  key text primary key,
  is_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into audit_settings (key, is_enabled, updated_at)
values ('global', true, now());

-- ============================================================================
-- Catalogue commerce
-- ============================================================================

-- These deferred foreign keys close the catalog item/variant cycle after both
-- tables exist. The composite key guarantees that the default variant belongs
-- to its parent item; the scalar key clears the default when that variant is deleted.
alter table catalog_items
  add constraint catalog_items_default_variant_id_fkey
    foreign key (default_variant_id)
    references catalog_item_variants(id)
    on delete set null
    deferrable initially deferred,
  add constraint catalog_items_default_variant_same_item_fkey
    foreign key (default_variant_id, id)
    references catalog_item_variants(id, item_id)
    deferrable initially deferred;

create index idx_catalog_items_default_variant_id
  on catalog_items(default_variant_id);

create index idx_catalog_items_deleted_purge_after
  on catalog_items(purge_after)
  where status = 'deleted';

create table catalog_item_slug_aliases (
  id bigserial primary key,
  item_id bigint not null references catalog_items(id) on delete cascade,
  slug text not null unique,
  created_at timestamptz not null default now(),
  unique (item_id, slug)
);

create index idx_catalog_item_slug_aliases_item_id
  on catalog_item_slug_aliases(item_id);

-- A variant remains the concrete purchasable combination. Axes and values are
-- generic, while this assignment table enforces one value per axis/variant.
create table catalog_option_axes (
  id bigserial primary key,
  item_id bigint not null references catalog_items(id) on delete cascade,
  name text not null,
  slug text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, slug),
  unique (id, item_id)
);

create index idx_catalog_option_axes_item_position
  on catalog_option_axes(item_id, position, id);

create table catalog_option_values (
  id bigserial primary key,
  axis_id bigint not null references catalog_option_axes(id) on delete cascade,
  value text not null,
  slug text not null,
  swatch text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (axis_id, slug),
  unique (id, axis_id)
);

create index idx_catalog_option_values_axis_position
  on catalog_option_values(axis_id, position, id);

create table catalog_variant_option_values (
  variant_id bigint not null,
  item_id bigint not null,
  axis_id bigint not null,
  option_value_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (variant_id, axis_id),
  foreign key (variant_id, item_id)
    references catalog_item_variants(id, item_id)
    on delete cascade,
  foreign key (axis_id, item_id)
    references catalog_option_axes(id, item_id)
    on delete cascade,
  foreign key (option_value_id, axis_id)
    references catalog_option_values(id, axis_id)
    on delete cascade
);

create unique index idx_catalog_variant_option_values_variant_value
  on catalog_variant_option_values(variant_id, option_value_id);

create index idx_catalog_variant_option_values_item
  on catalog_variant_option_values(item_id, variant_id);

-- Media can belong to multiple variants and retains an explicit order per variant.
create table catalog_variant_media (
  variant_id bigint not null,
  item_id bigint not null,
  media_id bigint not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (variant_id, media_id),
  foreign key (variant_id, item_id)
    references catalog_item_variants(id, item_id)
    on delete cascade,
  foreign key (media_id, item_id)
    references catalog_media(id, item_id)
    on delete cascade
);

create index idx_catalog_variant_media_item
  on catalog_variant_media(item_id, variant_id, position, media_id);

-- ============================================================================
-- Order access and immutable pricing snapshots
-- ============================================================================

-- Authoritative order pricing, immutable placement snapshots, idempotency,
-- and opaque customer access tokens.

create table order_items (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  catalog_item_id bigint,
  catalog_variant_id bigint,
  sku text not null,
  name text not null,
  product_slug text,
  variant_name text,
  unit text,
  quantity integer not null check (quantity > 0),
  category_id text,
  category_path text,
  selected_attributes jsonb not null default '{}'::jsonb,
  image_url text,
  base_unit_net numeric(12, 2) not null,
  discount_pct numeric(5, 2) not null default 0,
  unit_net numeric(12, 2) not null,
  unit_tax numeric(12, 2) not null,
  unit_gross numeric(12, 2) not null,
  line_net numeric(12, 2) not null,
  line_tax numeric(12, 2) not null,
  line_gross numeric(12, 2) not null,
  tax_rate numeric(5, 4) not null,
  currency text not null default 'EUR',
  product_snapshot_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint order_items_catalog_item_id_fkey
    foreign key (catalog_item_id) references catalog_items(id) on delete set null,
  constraint order_items_catalog_variant_id_fkey
    foreign key (catalog_variant_id) references catalog_item_variants(id) on delete set null,
  constraint order_items_category_id_fkey
    foreign key (category_id) references catalog_categories(id) on delete set null,
  constraint order_items_snapshot_amounts_nonnegative_check check (
    base_unit_net >= 0
    and discount_pct >= 0 and discount_pct <= 100
    and unit_net >= 0
    and unit_tax >= 0
    and unit_gross >= 0
    and line_net >= 0
    and line_tax >= 0
    and line_gross >= 0
    and tax_rate >= 0 and tax_rate <= 1
  )
);

create index idx_order_items_order_id on order_items(order_id);
create index idx_order_items_sku on order_items(lower(trim(sku)));
create index idx_order_items_catalog_item_id
  on order_items(catalog_item_id);
create index idx_order_items_catalog_variant_id
  on order_items(catalog_variant_id);
create index idx_order_items_category_id
  on order_items(category_id);

create table order_line_snapshots (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  order_item_id bigint references order_items(id) on delete set null,
  line_number integer not null check (line_number >= 1),
  catalog_item_id bigint references catalog_items(id) on delete set null,
  catalog_variant_id bigint references catalog_item_variants(id) on delete set null,
  product_slug text not null,
  product_name text not null,
  variant_name text not null,
  sku text not null,
  unit text,
  quantity integer not null check (quantity > 0),
  category_id text references catalog_categories(id) on delete set null,
  category_path text,
  selected_attributes jsonb not null default '{}'::jsonb,
  image_url text,
  base_unit_net numeric(12, 2) not null check (base_unit_net >= 0),
  discount_pct numeric(5, 2) not null default 0 check (discount_pct >= 0 and discount_pct <= 100),
  unit_net numeric(12, 2) not null check (unit_net >= 0),
  unit_tax numeric(12, 2) not null check (unit_tax >= 0),
  unit_gross numeric(12, 2) not null check (unit_gross >= 0),
  line_net numeric(12, 2) not null check (line_net >= 0),
  line_tax numeric(12, 2) not null check (line_tax >= 0),
  line_gross numeric(12, 2) not null check (line_gross >= 0),
  tax_rate numeric(5, 4) not null check (tax_rate >= 0 and tax_rate <= 1),
  currency text not null default 'EUR',
  snapshot_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (order_id, line_number)
);

create index idx_order_line_snapshots_order_id
  on order_line_snapshots(order_id, line_number);
create index idx_order_line_snapshots_variant_id
  on order_line_snapshots(catalog_variant_id);
create index idx_order_line_snapshots_category_id
  on order_line_snapshots(category_id);

create table order_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique,
  request_hash text not null,
  order_id bigint references orders(id) on delete cascade,
  response_json jsonb not null default '{}'::jsonb,
  bootstrap_token_ciphertext text,
  bootstrap_token_iv text,
  bootstrap_token_tag text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint order_idempotency_key_hash_check check (length(key_hash) = 64),
  constraint order_idempotency_request_hash_check check (length(request_hash) = 64),
  constraint order_idempotency_bootstrap_cipher_check check (
    (
      completed_at is null
      and bootstrap_token_ciphertext is null
      and bootstrap_token_iv is null
      and bootstrap_token_tag is null
    )
    or (
      completed_at is not null
      and bootstrap_token_ciphertext is not null
      and bootstrap_token_iv is not null
      and bootstrap_token_tag is not null
    )
  )
);

create index idx_order_idempotency_keys_order_id
  on order_idempotency_keys(order_id);
create index idx_order_idempotency_keys_created_at
  on order_idempotency_keys(created_at);

create table order_access_tokens (
  id uuid primary key default gen_random_uuid(),
  order_id bigint not null references orders(id) on delete cascade,
  token_hash text not null unique,
  token_prefix text not null,
  scopes text[] not null default array['confirmation', 'purchase_order']::text[],
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  constraint order_access_token_hash_check check (length(token_hash) = 64),
  constraint order_access_token_prefix_check check (length(token_prefix) between 6 and 16),
  constraint order_access_token_scopes_check check (
    scopes <@ array['confirmation', 'purchase_order']::text[]
    and cardinality(scopes) > 0
  )
);

create index idx_order_access_tokens_order_id_created_at
  on order_access_tokens(order_id, created_at desc);
create index idx_order_access_tokens_active
  on order_access_tokens(order_id, expires_at desc)
  where revoked_at is null;

create unique index idx_order_access_tokens_one_unrevoked
  on order_access_tokens(order_id)
  where revoked_at is null;

create table order_document_jobs (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  document_type text not null,
  payload_json jsonb not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  claim_id uuid,
  locked_at timestamptz,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_document_jobs_type_check check (
    document_type = 'order_summary'
  ),
  constraint order_document_jobs_status_check check (
    status in ('pending', 'processing', 'completed')
  ),
  constraint order_document_jobs_attempts_check check (attempts >= 0),
  constraint order_document_jobs_claim_check check (
    (status = 'processing' and claim_id is not null and locked_at is not null)
    or (status <> 'processing' and claim_id is null and locked_at is null)
  ),
  unique (order_id, document_type)
);

create index idx_order_document_jobs_pending
  on order_document_jobs(next_attempt_at, id)
  where status = 'pending';

-- ============================================================================
-- Archive retention outbox
-- ============================================================================

-- Blob deletion is an external side effect and cannot be atomic with the
-- database transaction. Queue every target before deleting its database row;
-- failures remain here for the next cleanup run.
create table archive_blob_deletion_outbox (
  id bigserial primary key,
  blob_target text not null unique,
  source_item_type text not null check (source_item_type in ('order', 'pdf', 'product_media')),
  source_order_id bigint,
  source_document_id bigint,
  source_product_id bigint,
  queued_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  last_error text
);

create index idx_archive_blob_deletion_outbox_queued_at
  on archive_blob_deletion_outbox(queued_at, id);

-- ============================================================================
-- School directory
-- ============================================================================

create table school_directory_meta (
  key text primary key,
  seed_version integer not null default 0,
  updated_at timestamptz not null default now()
);

create table school_directory_columns (
  id text primary key,
  label text not null,
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table school_directory_rows (
  id text primary key,
  position integer not null,
  cells jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index school_directory_columns_position_idx
  on school_directory_columns (position, id);

create unique index school_directory_columns_label_unique_idx
  on school_directory_columns (lower(btrim(label)));

create index school_directory_rows_position_idx
  on school_directory_rows (position, id);

-- ============================================================================
-- Customer directory profiles
-- ============================================================================

create table customer_directory_profiles (
  id text primary key,
  source_customer_key text,
  name text not null default '',
  address text not null default '',
  postal_code text not null default '',
  city text not null default '',
  contacts text[] not null default array[]::text[],
  emails text[] not null default array[]::text[],
  overridden_fields text[] not null default array[]::text[],
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index customer_directory_profiles_source_key_unique_idx
  on customer_directory_profiles (source_customer_key)
  where source_customer_key is not null;

create index customer_directory_profiles_active_idx
  on customer_directory_profiles (archived_at, created_at, id);

-- ============================================================================
-- GURS address register
-- ============================================================================

-- Local GURS Register naslovov search index and canonical order-address provenance.

create extension if not exists pg_trgm;

create table gurs_addresses (
  gurs_house_number_id text not null,
  street_name text,
  settlement_name text not null,
  house_number text not null,
  house_suffix text,
  postal_code text not null,
  postal_name text not null,
  municipality_name text not null,
  address_line_1 text not null,
  search_text text not null,
  source_updated_at timestamptz,
  imported_at timestamptz not null default now()
);

create unique index gurs_addresses_house_number_id_uidx
  on gurs_addresses (gurs_house_number_id);

create index gurs_addresses_search_text_trgm_idx
  on gurs_addresses using gin (search_text gin_trgm_ops);

create table gurs_address_sync_state (
  key text primary key,
  active_source_updated_at timestamptz,
  active_imported_at timestamptz,
  active_record_count integer not null default 0,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  lock_token text,
  lock_expires_at timestamptz,
  check (active_record_count >= 0)
);

insert into gurs_address_sync_state (key)
values ('active');

create table gurs_address_sync_runs (
  id bigserial primary key,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  record_count integer,
  source_updated_at timestamptz,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text,
  check (record_count is null or record_count >= 0)
);

create index gurs_address_sync_runs_started_at_idx
  on gurs_address_sync_runs (started_at desc);

create index orders_gurs_house_number_id_idx
  on orders (gurs_house_number_id)
  where gurs_house_number_id is not null;

commit;
