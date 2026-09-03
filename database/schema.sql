-- Atehna canonical database schema.
-- Apply this complete schema only to a newly created, empty PostgreSQL database.

begin;

-- ============================================================================
-- Core application schema
-- ============================================================================

create extension if not exists pgcrypto;

-- Terminal schema compatibility contracts are deliberately separate from
-- deployment history. Fresh installs record only the application contract they
-- satisfy; they do not pretend that incremental deployments were applied.
create table app_schema_contracts (
  contract_id text primary key,
  contract_sha256 text not null,
  installed_via text not null,
  recorded_at timestamptz not null default now(),
  constraint app_schema_contracts_checksum_check check (
    contract_sha256 ~ '^[a-f0-9]{64}$'
  ),
  constraint app_schema_contracts_installation_check check (
    installed_via in ('fresh_schema', 'existing_database')
  )
);

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
  automatic_shipping numeric(12, 2),
  shipping_snapshot_json jsonb not null default '{}'::jsonb,
  shipping_override_json jsonb,
  shipping_override_stale boolean not null default false,
  parcel_count integer not null default 1,
  total numeric(12, 2) not null default 0,
  currency text not null default 'EUR',
  tax_rate numeric(5, 4) not null default 0.2200,
  pricing_version text not null default 'unpriced-draft-v1',
  pricing_revision integer not null default 1,
  delivery_plan_revision integer not null default 1,
  commitment_status text not null default 'binding',
  contract_status text not null default 'pending_seller_acceptance',
  contract_accepted_at timestamptz,
  contract_accepted_actor_type text,
  contract_accepted_actor_id text,
  contract_acceptance_evidence_json jsonb,
  contract_rejected_at timestamptz,
  contract_rejected_actor_type text,
  contract_rejected_actor_id text,
  contract_rejection_reason text,
  contract_rejection_evidence_json jsonb,
  contract_state_version integer not null default 1,
  committed_at timestamptz,
  stock_enforcement_applied boolean not null default true,
  source_quote_offer_version_id bigint,
  is_draft boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint orders_commitment_status_check check (
    commitment_status in ('binding', 'pending_confirmation', 'rejected')
  ),
  constraint orders_contract_status_check check (
    contract_status in ('pending_seller_acceptance', 'accepted', 'rejected')
  ),
  constraint orders_contract_actor_type_check check (
    (
      contract_accepted_actor_type is null
      or contract_accepted_actor_type in (
        'admin',
        'customer',
        'school_purchase_order',
        'system',
        'legacy_backfill'
      )
    )
    and (
      contract_rejected_actor_type is null
      or contract_rejected_actor_type in ('admin', 'system', 'legacy_backfill')
    )
  ),
  constraint orders_contract_evidence_json_check check (
    (
      contract_acceptance_evidence_json is null
      or jsonb_typeof(contract_acceptance_evidence_json) = 'object'
    )
    and (
      contract_rejection_evidence_json is null
      or jsonb_typeof(contract_rejection_evidence_json) = 'object'
    )
  ),
  constraint orders_contract_state_evidence_check check (
    (
      contract_status = 'pending_seller_acceptance'
      and contract_accepted_at is null
      and contract_accepted_actor_type is null
      and contract_accepted_actor_id is null
      and contract_acceptance_evidence_json is null
      and contract_rejected_at is null
      and contract_rejected_actor_type is null
      and contract_rejected_actor_id is null
      and contract_rejection_reason is null
      and contract_rejection_evidence_json is null
      and committed_at is null
    )
    or (
      contract_status = 'accepted'
      and contract_accepted_at is not null
      and contract_accepted_actor_type is not null
      and contract_acceptance_evidence_json is not null
      and contract_rejected_at is null
      and contract_rejected_actor_type is null
      and contract_rejected_actor_id is null
      and contract_rejection_reason is null
      and contract_rejection_evidence_json is null
      and committed_at is not null
    )
    or (
      contract_status = 'rejected'
      and contract_accepted_at is null
      and contract_accepted_actor_type is null
      and contract_accepted_actor_id is null
      and contract_acceptance_evidence_json is null
      and contract_rejected_at is not null
      and contract_rejected_actor_type is not null
      and contract_rejection_evidence_json is not null
      and committed_at is null
    )
  ),
  constraint orders_contract_state_version_positive_check check (contract_state_version > 0),
  constraint orders_tax_rate_range_check check (tax_rate >= 0 and tax_rate <= 1),
  constraint orders_pricing_revision_positive_check check (pricing_revision > 0),
  constraint orders_delivery_plan_revision_positive_check check (delivery_plan_revision > 0),
  constraint orders_shipping_non_negative_check check (shipping >= 0),
  constraint orders_automatic_shipping_non_negative_check check (
    automatic_shipping is null or automatic_shipping >= 0
  ),
  constraint orders_shipping_snapshot_json_check check (
    jsonb_typeof(shipping_snapshot_json) = 'object'
  ),
  constraint orders_shipping_override_json_check check (
    shipping_override_json is null or jsonb_typeof(shipping_override_json) = 'object'
  ),
  constraint orders_parcel_count_positive_check check (
    parcel_count >= 1
  )
);

create index idx_orders_created_at on orders(created_at desc);
create index idx_orders_deleted_at on orders(deleted_at);
create index idx_orders_is_draft on orders(is_draft);
create index idx_orders_status_created_at on orders(status, created_at desc);
create index idx_orders_payment_status_created_at on orders(payment_status, created_at desc);
create index idx_orders_contract_status_created_at
  on orders(contract_status, committed_at desc, created_at desc);
create unique index idx_orders_source_quote_offer_version
  on orders(source_quote_offer_version_id)
  where source_quote_offer_version_id is not null;

create table order_documents (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  customer_access_id uuid not null default gen_random_uuid(),
  type text not null,
  filename text not null,
  blob_pathname text not null,
  version_number integer not null,
  order_pricing_revision integer not null default 1,
  order_delivery_plan_revision integer not null default 1,
  document_number text not null,
  issued_at timestamptz not null,
  content_sha256 text not null,
  legal_status text not null,
  format_marker text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint order_documents_pricing_revision_positive_check check (order_pricing_revision > 0),
  constraint order_documents_delivery_plan_revision_positive_check check (order_delivery_plan_revision > 0)
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

create table inventory_policy_settings (
  key text primary key,
  config_json jsonb not null default '{"stockEnforcementEnabled": true}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint inventory_policy_settings_config_json_check check (
    jsonb_typeof(config_json) = 'object'
    and config_json ? 'stockEnforcementEnabled'
    and jsonb_typeof(config_json -> 'stockEnforcementEnabled') = 'boolean'
  )
);

insert into inventory_policy_settings (key, config_json)
values ('default', '{"stockEnforcementEnabled": true}'::jsonb);

create table site_logo_settings (
  key text primary key,
  config_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table shipping_settings (
  key text primary key,
  version integer not null default 1,
  revision integer not null default 1,
  config_json jsonb not null,
  updated_at timestamptz not null default now(),
  constraint shipping_settings_version_check check (version > 0),
  constraint shipping_settings_revision_check check (revision > 0),
  constraint shipping_settings_config_json_check check (
    jsonb_typeof(config_json) = 'object'
  )
);

insert into shipping_settings (key, version, config_json)
values (
  'default',
  1,
  '{
    "version": 1,
    "manualQuoteFallbackEnabled": true,
    "weightBands": [
      {
        "id": "under-5kg",
        "name": "Do 5 kg",
        "minWeightGrams": 1,
        "maxWeightGrams": 4999,
        "priceCents": 300,
        "enabled": true,
        "position": 0
      },
      {
        "id": "5kg-to-30kg",
        "name": "Od 5 kg do 30 kg",
        "minWeightGrams": 5000,
        "maxWeightGrams": 30000,
        "priceCents": 1000,
        "enabled": true,
        "position": 1
      }
    ],
    "dimensionalRules": [
      {
        "id": "larger-than-1000mm",
        "name": "Večji artikel",
        "comparisonOperator": ">",
        "thresholdMm": 1000,
        "adjustmentType": "fixed",
        "adjustmentValue": null,
        "enabled": false,
        "position": 0
      }
    ],
    "orderValueDiscountRules": [],
    "multiPieceDiscountRules": [
      {
        "id": "multi-piece-2",
        "name": "Od 2 paketov",
        "minParcelCount": 2,
        "adjustmentType": "percentage",
        "adjustmentValue": 50,
        "enabled": true,
        "position": 0
      }
    ],
    "draftRules": []
  }'::jsonb
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
  shipping_weight_grams numeric(12, 3),
  shipping_length_mm numeric(12, 3),
  shipping_width_mm numeric(12, 3),
  shipping_height_mm numeric(12, 3),
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
  constraint catalog_items_shipping_weight_check check (
    shipping_weight_grams is null
    or (shipping_weight_grams > 0 and shipping_weight_grams = trunc(shipping_weight_grams))
  ),
  constraint catalog_items_shipping_length_check check (
    shipping_length_mm is null or shipping_length_mm > 0
  ),
  constraint catalog_items_shipping_width_check check (
    shipping_width_mm is null or shipping_width_mm > 0
  ),
  constraint catalog_items_shipping_height_check check (
    shipping_height_mm is null or shipping_height_mm > 0
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
  shipping_weight_grams numeric(12, 3),
  shipping_length_mm numeric(12, 3),
  shipping_width_mm numeric(12, 3),
  shipping_height_mm numeric(12, 3),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_item_variants_id_item_id_key unique (id, item_id),
  constraint catalog_item_variants_cost_net_check check (cost_net is null or cost_net >= 0),
  constraint catalog_item_variants_content_override_json_check check (
    content_override_json is null or jsonb_typeof(content_override_json) = 'object'
  ),
  constraint catalog_item_variants_shipping_weight_check check (
    shipping_weight_grams is null
    or (shipping_weight_grams > 0 and shipping_weight_grams = trunc(shipping_weight_grams))
  ),
  constraint catalog_item_variants_shipping_length_check check (
    shipping_length_mm is null or shipping_length_mm > 0
  ),
  constraint catalog_item_variants_shipping_width_check check (
    shipping_width_mm is null or shipping_width_mm > 0
  ),
  constraint catalog_item_variants_shipping_height_check check (
    shipping_height_mm is null or shipping_height_mm > 0
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
  ship_later boolean not null default false,
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
create index idx_order_items_order_id_ship_later
  on order_items(order_id, ship_later, id);
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

-- A binding order may hold stock before its seller contract is accepted. This
-- ledger is the single exactly-once release authority for rejection or
-- cancellation; quote requests and unaccepted offers never create rows here.
create table order_stock_holds (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete restrict,
  catalog_variant_id bigint not null references catalog_item_variants(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  state text not null default 'held' check (
    state in ('held', 'released', 'legacy_unknown')
  ),
  committed_at timestamptz,
  committed_by_actor_type text,
  committed_by_actor_id text,
  released_at timestamptz,
  released_by_actor_type text,
  released_by_actor_id text,
  release_reason text,
  evidence_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_stock_holds_evidence_json_check check (
    jsonb_typeof(evidence_json) = 'object'
  ),
  constraint order_stock_holds_actor_type_check check (
    (
      committed_by_actor_type is null
      or committed_by_actor_type in (
        'admin',
        'customer',
        'school_purchase_order',
        'system',
        'legacy_backfill'
      )
    )
    and (
      released_by_actor_type is null
      or released_by_actor_type in ('admin', 'system', 'legacy_backfill')
    )
  ),
  constraint order_stock_holds_state_evidence_check check (
    (
      state = 'held'
      and committed_at is not null
      and committed_by_actor_type is not null
      and released_at is null
      and released_by_actor_type is null
      and released_by_actor_id is null
      and release_reason is null
    )
    or (
      state = 'released'
      and committed_at is not null
      and committed_by_actor_type is not null
      and released_at is not null
      and released_by_actor_type is not null
      and nullif(btrim(release_reason), '') is not null
    )
    or (
      state = 'legacy_unknown'
      and released_at is null
      and released_by_actor_type is null
      and released_by_actor_id is null
      and release_reason is null
    )
  ),
  unique (order_id, catalog_variant_id)
);

create index idx_order_stock_holds_order_state
  on order_stock_holds(order_id, state);
create index idx_order_stock_holds_variant_state
  on order_stock_holds(catalog_variant_id, state);

create function guard_order_stock_hold_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Order stock-hold rows are durable and cannot be deleted.';
  end if;

  if
    new.order_id is distinct from old.order_id
    or new.catalog_variant_id is distinct from old.catalog_variant_id
    or new.quantity is distinct from old.quantity
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Order stock-hold identity and quantity are immutable.';
  end if;

  if old.state = 'released' and new is distinct from old then
    raise exception 'A released order stock hold is immutable.';
  end if;

  if old.state = 'held' and new.state not in ('held', 'released') then
    raise exception 'A held order stock hold can only be released.';
  end if;

  if old.state = 'held' and new.committed_at is distinct from old.committed_at then
    raise exception 'The stock commitment timestamp is immutable.';
  end if;

  if old.state = 'legacy_unknown' and new.state not in ('legacy_unknown', 'held', 'released') then
    raise exception 'An unreconciled stock hold has an invalid transition.';
  end if;

  return new;
end;
$$;

create trigger order_stock_holds_guard_transition
before update or delete on order_stock_holds
for each row execute function guard_order_stock_hold_transition();

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
-- Quote requests, immutable seller offers, and acceptance evidence
-- ============================================================================

create table quote_number_counters (
  year integer primary key check (year between 2020 and 9999),
  last_request_sequence integer not null default 0 check (
    last_request_sequence between 0 and 999999
  ),
  updated_at timestamptz not null default now()
);

create table quote_requests (
  id bigserial primary key,
  request_number text not null unique,
  status text not null default 'received' check (
    status in (
      'received',
      'in_preparation',
      'offer_issued',
      'awaiting_purchase_order_review',
      'accepted',
      'declined',
      'expired',
      'withdrawn',
      'converted_to_order',
      'closed_without_offer'
    )
  ),
  customer_type text not null check (
    customer_type in ('individual', 'company', 'school')
  ),
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
  quote_reason text not null default 'formal_offer' check (
    quote_reason in (
      'formal_offer',
      'stock_or_delivery',
      'quantity_discount_or_custom_quantity',
      'other'
    )
  ),
  customer_message text,
  customer_visible_notes text,
  admin_notes text,
  admin_title text,
  billing_snapshot_json jsonb not null default '{}'::jsonb,
  shipping_snapshot_json jsonb not null default '{}'::jsonb,
  estimate_fingerprint text not null,
  estimate_json jsonb not null,
  intake_source text not null default 'customer_web',
  state_version integer not null default 1,
  voided_at timestamptz,
  voided_by_actor_id text,
  void_reason text,
  closed_at timestamptz,
  closed_by_actor_type text,
  closed_by_actor_id text,
  closure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_requests_number_check check (
    request_number ~ '^POV-[0-9]{4}-[0-9]{6}$'
  ),
  constraint quote_requests_email_check check (
    nullif(btrim(email), '') is not null
  ),
  constraint quote_requests_admin_title_check check (
    admin_title is null
    or (
      nullif(btrim(admin_title), '') is not null
      and char_length(admin_title) <= 240
    )
  ),
  constraint quote_requests_estimate_fingerprint_check check (
    length(estimate_fingerprint) = 64
  ),
  constraint quote_requests_json_check check (
    jsonb_typeof(billing_snapshot_json) = 'object'
    and jsonb_typeof(shipping_snapshot_json) = 'object'
    and jsonb_typeof(estimate_json) = 'object'
  ),
  constraint quote_requests_state_version_positive_check check (state_version > 0),
  constraint quote_requests_intake_source_check check (
    intake_source in ('customer_web', 'admin_email', 'admin_testing')
  ),
  constraint quote_requests_void_state_check check (
    (
      voided_at is null
      and voided_by_actor_id is null
      and void_reason is null
    )
    or (
      voided_at is not null
      and nullif(btrim(voided_by_actor_id), '') is not null
      and nullif(btrim(void_reason), '') is not null
    )
  ),
  constraint quote_requests_closed_actor_type_check check (
    closed_by_actor_type is null
    or closed_by_actor_type in ('admin', 'customer', 'system')
  )
);

create index idx_quote_requests_status_created_at
  on quote_requests(status, created_at desc, id desc);
create index idx_quote_requests_email_created_at
  on quote_requests(lower(email), created_at desc);
create index idx_quote_requests_updated_at
  on quote_requests(updated_at desc, id desc);
create index idx_quote_requests_voided_at
  on quote_requests(voided_at)
  where voided_at is not null;

create table quote_request_items (
  id bigserial primary key,
  quote_request_id bigint not null references quote_requests(id) on delete restrict,
  line_number integer not null check (line_number >= 1),
  catalog_item_id bigint,
  catalog_variant_id bigint,
  product_slug text not null,
  product_name text not null,
  variant_name text not null,
  sku text not null,
  unit text,
  quantity integer not null check (quantity > 0),
  min_order integer not null default 1 check (min_order > 0),
  available_stock_at_request integer not null check (
    available_stock_at_request >= 0
  ),
  category_id text,
  category_path text,
  selected_attributes jsonb not null default '{}'::jsonb,
  image_url text,
  base_unit_net numeric(12, 2) not null check (base_unit_net >= 0),
  discount_pct numeric(5, 2) not null default 0 check (
    discount_pct >= 0 and discount_pct <= 100
  ),
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
  constraint quote_request_items_selected_attributes_check check (
    jsonb_typeof(selected_attributes) = 'object'
  ),
  constraint quote_request_items_snapshot_json_check check (
    jsonb_typeof(snapshot_json) = 'object'
  ),
  unique (quote_request_id, line_number)
);

create index idx_quote_request_items_request
  on quote_request_items(quote_request_id, line_number);
create index idx_quote_request_items_variant
  on quote_request_items(catalog_variant_id);

create table quote_offer_versions (
  id bigserial primary key,
  quote_request_id bigint not null references quote_requests(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  offer_number text unique,
  status text not null default 'draft' check (
    status in (
      'draft',
      'issued',
      'accepted',
      'declined',
      'withdrawn',
      'expired',
      'superseded'
    )
  ),
  is_current boolean not null default false,
  customer_snapshot_json jsonb not null default '{}'::jsonb,
  billing_snapshot_json jsonb not null default '{}'::jsonb,
  seller_message text,
  customer_visible_notes text,
  admin_notes text,
  delivery_terms text,
  payment_terms text,
  acceptance_method text not null default 'online' check (
    acceptance_method in ('online', 'purchase_order', 'online_or_purchase_order')
  ),
  subtotal numeric(12, 2) not null default 0,
  tax numeric(12, 2) not null default 0,
  shipping numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  currency text not null default 'EUR',
  tax_rate numeric(5, 4) not null default 0.2200,
  shipping_snapshot_json jsonb not null default '{}'::jsonb,
  shipping_confirmation_json jsonb,
  terms_text text,
  terms_version text,
  terms_hash text,
  content_snapshot_json jsonb not null default '{}'::jsonb,
  content_hash text,
  document_sha256 text,
  document_bound_at timestamptz,
  issued_at timestamptz,
  valid_until timestamptz,
  issued_by_actor_type text,
  issued_by_actor_id text,
  accepted_at timestamptz,
  declined_at timestamptz,
  decline_reason text,
  withdrawn_at timestamptz,
  withdrawal_reason text,
  expired_at timestamptz,
  superseded_at timestamptz,
  state_version integer not null default 1,
  created_by_actor_type text not null,
  created_by_actor_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_offer_versions_request_version_unique unique (
    quote_request_id,
    version_number
  ),
  constraint quote_offer_versions_id_request_unique unique (
    id,
    quote_request_id
  ),
  constraint quote_offer_versions_number_check check (
    offer_number is null
    or offer_number ~ '^PON-[0-9]{4}-[0-9]{6}-V[1-9][0-9]*$'
  ),
  constraint quote_offer_versions_amounts_check check (
    subtotal >= 0
    and tax >= 0
    and shipping >= 0
    and total = subtotal + tax + shipping
    and tax_rate >= 0
    and tax_rate <= 1
  ),
  constraint quote_offer_versions_json_check check (
    jsonb_typeof(customer_snapshot_json) = 'object'
    and jsonb_typeof(billing_snapshot_json) = 'object'
    and jsonb_typeof(shipping_snapshot_json) = 'object'
    and (
      shipping_confirmation_json is null
      or jsonb_typeof(shipping_confirmation_json) = 'object'
    )
    and jsonb_typeof(content_snapshot_json) = 'object'
  ),
  constraint quote_offer_versions_hash_check check (
    (terms_hash is null or length(terms_hash) = 64)
    and (content_hash is null or length(content_hash) = 64)
    and (document_sha256 is null or length(document_sha256) = 64)
  ),
  constraint quote_offer_versions_actor_type_check check (
    created_by_actor_type in ('admin', 'system')
    and (
      issued_by_actor_type is null
      or issued_by_actor_type in ('admin', 'system')
    )
  ),
  constraint quote_offer_versions_issue_identity_check check (
    (
      status = 'draft'
      and offer_number is null
      and issued_at is null
      and issued_by_actor_type is null
      and issued_by_actor_id is null
      and is_current = false
    )
    or (
      status <> 'draft'
      and offer_number is not null
      and issued_at is not null
      and issued_by_actor_type is not null
      and valid_until is not null
      and valid_until > issued_at
      and customer_snapshot_json <> '{}'::jsonb
      and content_snapshot_json <> '{}'::jsonb
      and nullif(btrim(delivery_terms), '') is not null
      and nullif(btrim(payment_terms), '') is not null
      and nullif(btrim(terms_version), '') is not null
      and terms_hash is not null
      and content_hash is not null
    )
  ),
  constraint quote_offer_versions_current_check check (
    is_current = (status = 'issued')
  ),
  constraint quote_offer_versions_free_shipping_check check (
    status = 'draft'
    or shipping > 0
    or (
      shipping = 0
      and shipping_confirmation_json is not null
      and shipping_confirmation_json ->> 'decision' = 'free_shipping'
      and nullif(btrim(shipping_confirmation_json ->> 'confirmed_at'), '') is not null
      and nullif(btrim(shipping_confirmation_json ->> 'confirmed_by_actor_type'), '') is not null
    )
  ),
  constraint quote_offer_versions_lifecycle_check check (
    (
      status in ('draft', 'issued')
      and accepted_at is null
      and declined_at is null
      and decline_reason is null
      and withdrawn_at is null
      and withdrawal_reason is null
      and expired_at is null
      and superseded_at is null
    )
    or (
      status = 'accepted'
      and accepted_at is not null
      and document_sha256 is not null
      and declined_at is null
      and withdrawn_at is null
      and expired_at is null
      and superseded_at is null
    )
    or (
      status = 'declined'
      and accepted_at is null
      and declined_at is not null
      and withdrawn_at is null
      and expired_at is null
      and superseded_at is null
    )
    or (
      status = 'withdrawn'
      and accepted_at is null
      and declined_at is null
      and withdrawn_at is not null
      and expired_at is null
      and superseded_at is null
    )
    or (
      status = 'expired'
      and accepted_at is null
      and declined_at is null
      and withdrawn_at is null
      and expired_at is not null
      and superseded_at is null
    )
    or (
      status = 'superseded'
      and accepted_at is null
      and declined_at is null
      and withdrawn_at is null
      and expired_at is null
      and superseded_at is not null
    )
  ),
  constraint quote_offer_versions_document_binding_check check (
    (document_sha256 is null and document_bound_at is null)
    or (document_sha256 is not null and document_bound_at is not null)
  ),
  constraint quote_offer_versions_state_version_positive_check check (
    state_version > 0
  )
);

create unique index idx_quote_offer_versions_one_current
  on quote_offer_versions(quote_request_id)
  where is_current;
create unique index idx_quote_offer_versions_one_draft
  on quote_offer_versions(quote_request_id)
  where status = 'draft';
create index idx_quote_offer_versions_request_created_at
  on quote_offer_versions(quote_request_id, version_number desc);
create index idx_quote_offer_versions_status_valid_until
  on quote_offer_versions(status, valid_until)
  where status = 'issued';

create table quote_offer_version_items (
  id bigserial primary key,
  quote_offer_version_id bigint not null references quote_offer_versions(id) on delete restrict,
  line_number integer not null check (line_number >= 1),
  catalog_item_id bigint,
  catalog_variant_id bigint,
  product_slug text not null,
  product_name text not null,
  variant_name text not null,
  sku text not null,
  unit text,
  quantity integer not null check (quantity > 0),
  min_order integer not null default 1 check (min_order > 0),
  available_stock_at_request integer not null check (
    available_stock_at_request >= 0
  ),
  category_id text,
  category_path text,
  selected_attributes jsonb not null default '{}'::jsonb,
  image_url text,
  base_unit_net numeric(12, 2) not null check (base_unit_net >= 0),
  discount_pct numeric(5, 2) not null default 0 check (
    discount_pct >= 0 and discount_pct <= 100
  ),
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
  constraint quote_offer_version_items_selected_attributes_check check (
    jsonb_typeof(selected_attributes) = 'object'
  ),
  constraint quote_offer_version_items_snapshot_json_check check (
    jsonb_typeof(snapshot_json) = 'object'
  ),
  unique (quote_offer_version_id, line_number)
);

create index idx_quote_offer_version_items_offer
  on quote_offer_version_items(quote_offer_version_id, line_number);
create index idx_quote_offer_version_items_variant
  on quote_offer_version_items(catalog_variant_id);

create table quote_offer_acceptances (
  id uuid primary key default gen_random_uuid(),
  quote_offer_version_id bigint not null unique references quote_offer_versions(id) on delete restrict,
  accepted_at timestamptz not null,
  channel text not null check (
    channel in ('online', 'purchase_order_validation', 'admin_recorded')
  ),
  actor_type text not null check (
    actor_type in ('customer', 'school_purchase_order', 'admin')
  ),
  actor_id text,
  verified_identity text not null,
  verification_evidence_json jsonb not null,
  acceptance_wording text not null,
  terms_version text not null,
  terms_hash text not null,
  content_hash text not null,
  document_sha256 text not null,
  request_id text,
  correlation_id text,
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz not null default now(),
  constraint quote_offer_acceptances_evidence_json_check check (
    jsonb_typeof(verification_evidence_json) = 'object'
  ),
  constraint quote_offer_acceptances_hash_check check (
    length(terms_hash) = 64
    and length(content_hash) = 64
    and length(document_sha256) = 64
    and (ip_hash is null or length(ip_hash) = 64)
    and (user_agent_hash is null or length(user_agent_hash) = 64)
  )
);

create index idx_quote_offer_acceptances_created_at
  on quote_offer_acceptances(accepted_at desc);

create table quote_documents (
  id bigserial primary key,
  quote_offer_version_id bigint not null references quote_offer_versions(id) on delete restrict,
  customer_access_id uuid not null default gen_random_uuid(),
  document_type text not null check (
    document_type in ('offer', 'purchase_order')
  ),
  filename text not null,
  blob_pathname text not null,
  version_number integer not null check (version_number > 0),
  document_number text not null,
  issued_at timestamptz not null,
  content_sha256 text not null,
  offer_content_hash text not null,
  terms_hash text not null,
  created_by_actor_type text not null check (
    created_by_actor_type in ('admin', 'customer', 'system')
  ),
  created_by_actor_id text,
  created_at timestamptz not null default now(),
  constraint quote_documents_hash_check check (
    length(content_sha256) = 64
    and length(offer_content_hash) = 64
    and length(terms_hash) = 64
  ),
  unique (quote_offer_version_id, document_type, version_number)
);

create unique index idx_quote_documents_customer_access_id
  on quote_documents(customer_access_id);
create index idx_quote_documents_offer_created_at
  on quote_documents(quote_offer_version_id, created_at desc);

-- Administrator uploads are deliberately staged outside quote_documents.
-- quote_documents remains reserved for immutable, hash-bound public evidence.
-- Reusing its sequence keeps numeric document ids collision-free in the
-- unified administrator download route without weakening either model.
create table quote_manual_documents (
  id bigint primary key default nextval('quote_documents_id_seq'::regclass),
  quote_request_id bigint not null references quote_requests(id) on delete restrict,
  quote_offer_version_id bigint not null,
  document_type text not null check (
    document_type in ('offer', 'purchase_order')
  ),
  storage_id uuid not null default gen_random_uuid(),
  filename text not null,
  blob_pathname text not null,
  version_number integer not null check (version_number > 0),
  document_number text not null,
  uploaded_at timestamptz not null default now(),
  content_sha256 text not null,
  mime_type text not null default 'application/pdf' check (
    mime_type = 'application/pdf'
  ),
  byte_size bigint not null check (
    byte_size > 0 and byte_size <= 10485760
  ),
  created_by_actor_type text not null default 'admin' check (
    created_by_actor_type = 'admin'
  ),
  created_by_actor_id text,
  created_at timestamptz not null default now(),
  constraint quote_manual_documents_offer_request_fkey
    foreign key (quote_offer_version_id, quote_request_id)
    references quote_offer_versions(id, quote_request_id)
    on delete restrict,
  constraint quote_manual_documents_hash_check check (
    length(content_sha256) = 64
  ),
  unique (storage_id),
  unique (quote_request_id, document_type, version_number)
);

create index idx_quote_manual_documents_request_created_at
  on quote_manual_documents(quote_request_id, created_at desc);
create index idx_quote_manual_documents_offer_created_at
  on quote_manual_documents(quote_offer_version_id, created_at desc);

create table quote_document_jobs (
  id bigserial primary key,
  quote_offer_version_id bigint not null references quote_offer_versions(id) on delete restrict,
  document_type text not null check (document_type = 'offer'),
  payload_json jsonb not null,
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'completed')
  ),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  claim_id uuid,
  locked_at timestamptz,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_document_jobs_payload_json_check check (
    jsonb_typeof(payload_json) = 'object'
  ),
  constraint quote_document_jobs_claim_check check (
    (status = 'processing' and claim_id is not null and locked_at is not null)
    or (status <> 'processing' and claim_id is null and locked_at is null)
  ),
  unique (quote_offer_version_id, document_type)
);

create index idx_quote_document_jobs_pending
  on quote_document_jobs(next_attempt_at, id)
  where status = 'pending';

create table quote_events (
  id bigserial primary key,
  quote_request_id bigint not null references quote_requests(id) on delete restrict,
  quote_offer_version_id bigint,
  event_key text,
  event_type text not null constraint quote_events_event_type_check check (
    event_type in (
      'request_received',
      'quote_request_details_changed',
      'draft_created',
      'draft_changed',
      'clarification_requested',
      'preview_generated',
      'offer_issued',
      'quote_email_queued',
      'quote_email_provider_accepted',
      'quote_email_provider_failed',
      'offer_viewed',
      'customer_acceptance_attempted',
      'acceptance_blocked_stock',
      'customer_accepted',
      'customer_declined',
      'customer_purchase_order_uploaded',
      'admin_document_uploaded',
      'admin_purchase_order_validated',
      'admin_purchase_order_rejected',
      'offer_withdrawn',
      'offer_expired',
      'offer_superseded',
      'new_version_issued',
      'request_closed_without_offer',
      'request_voided',
      'order_created'
    )
  ),
  actor_type text not null check (
    actor_type in ('customer', 'admin', 'system', 'email_provider')
  ),
  actor_id text,
  occurred_at timestamptz not null default now(),
  request_id text,
  correlation_id text not null default gen_random_uuid()::text,
  reason text,
  metadata_json jsonb not null default '{}'::jsonb,
  constraint quote_events_offer_request_fkey
    foreign key (quote_offer_version_id, quote_request_id)
    references quote_offer_versions(id, quote_request_id)
    on delete restrict,
  constraint quote_events_metadata_json_check check (
    jsonb_typeof(metadata_json) = 'object'
  )
);

create unique index idx_quote_events_event_key
  on quote_events(event_key)
  where event_key is not null;
create index idx_quote_events_request_timeline
  on quote_events(quote_request_id, occurred_at, id);
create index idx_quote_events_offer_timeline
  on quote_events(quote_offer_version_id, occurred_at, id)
  where quote_offer_version_id is not null;

create function guard_quote_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only; % is not allowed.', tg_table_name, tg_op;
end;
$$;

create trigger quote_request_items_append_only
before update or delete on quote_request_items
for each row execute function guard_quote_append_only();

create trigger quote_offer_acceptances_append_only
before update or delete on quote_offer_acceptances
for each row execute function guard_quote_append_only();

create trigger quote_documents_append_only
before update or delete on quote_documents
for each row execute function guard_quote_append_only();

create trigger quote_manual_documents_append_only
before update or delete on quote_manual_documents
for each row execute function guard_quote_append_only();

create trigger quote_events_append_only
before update or delete on quote_events
for each row execute function guard_quote_append_only();

create function guard_quote_request_history()
returns trigger
language plpgsql
as $$
declare
  admin_details_changed boolean;
  voiding boolean;
  testing_cleanup boolean;
begin
  if tg_op = 'DELETE' then
    raise exception 'Quote requests are durable records and cannot be deleted.';
  end if;

  if old.voided_at is not null then
    raise exception 'Voided quote requests are immutable.';
  end if;

  voiding := old.voided_at is null and new.voided_at is not null;
  if voiding then
    testing_cleanup := old.intake_source = 'admin_testing';
    if (
      old.status not in ('received', 'in_preparation')
      and not testing_cleanup
    )
       or new.status is distinct from old.status then
      raise exception 'Only an unissued quote request or an explicitly tagged test request can be voided.';
    end if;
    if new.voided_by_actor_id is null or nullif(btrim(new.void_reason), '') is null then
      raise exception 'Voiding a quote request requires actor and reason evidence.';
    end if;
    if exists (
      select 1
      from quote_offer_acceptances acceptance
      join quote_offer_versions offer on offer.id = acceptance.quote_offer_version_id
      where offer.quote_request_id = old.id
    ) or exists (
      select 1
      from quote_documents document
      join quote_offer_versions offer on offer.id = document.quote_offer_version_id
      where offer.quote_request_id = old.id
        and document.document_type = 'purchase_order'
    ) or exists (
      select 1
      from orders linked_order
      join quote_offer_versions offer
        on offer.id = linked_order.source_quote_offer_version_id
      where offer.quote_request_id = old.id
    ) or old.status in (
      'awaiting_purchase_order_review',
      'accepted',
      'converted_to_order'
    ) then
      raise exception 'Quote requests with customer acceptance, purchase-order evidence, or linked orders cannot be voided.';
    end if;
    if not testing_cleanup and (
      exists (
      select 1
      from quote_offer_versions offer
      where offer.quote_request_id = old.id
        and offer.status <> 'draft'
      ) or exists (
      select 1
      from quote_documents document
      join quote_offer_versions offer on offer.id = document.quote_offer_version_id
      where offer.quote_request_id = old.id
      ) or exists (
      select 1
      from quote_document_jobs job
      join quote_offer_versions offer on offer.id = job.quote_offer_version_id
      where offer.quote_request_id = old.id
      )
    ) then
      raise exception 'Non-test quote requests with commercial history cannot be voided.';
    end if;
  elsif new.voided_at is distinct from old.voided_at
     or new.voided_by_actor_id is distinct from old.voided_by_actor_id
     or new.void_reason is distinct from old.void_reason then
    raise exception 'Quote-request void evidence cannot be changed.';
  end if;

  admin_details_changed :=
    new.customer_type is distinct from old.customer_type
    or new.organization_name is distinct from old.organization_name
    or new.contact_name is distinct from old.contact_name
    or new.email is distinct from old.email
    or new.address_line1 is distinct from old.address_line1
    or new.address_line2 is distinct from old.address_line2
    or new.city is distinct from old.city
    or new.postal_code is distinct from old.postal_code
    or new.country_code is distinct from old.country_code
    or new.gurs_house_number_id is distinct from old.gurs_house_number_id
    or new.reference is distinct from old.reference
    or new.quote_reason is distinct from old.quote_reason
    or new.customer_message is distinct from old.customer_message
    or new.billing_snapshot_json is distinct from old.billing_snapshot_json;

  if admin_details_changed then
    if old.status not in ('received', 'in_preparation')
       or new.status not in ('received', 'in_preparation') then
      raise exception 'Quote-request customer details can only change before offer issue.';
    end if;
    if exists (
      select 1
      from quote_offer_versions offer
      where offer.quote_request_id = old.id
        and offer.status = 'issued'
        and offer.is_current = true
    ) then
      raise exception 'Customer details on a current issued offer are immutable.';
    end if;
  end if;

  if (
    to_jsonb(new)
      - array[
          'status',
          'customer_type',
          'organization_name',
          'contact_name',
          'email',
          'address_line1',
          'address_line2',
          'city',
          'postal_code',
          'country_code',
          'gurs_house_number_id',
          'reference',
          'quote_reason',
          'customer_message',
          'billing_snapshot_json',
          'customer_visible_notes',
          'admin_notes',
          'admin_title',
          'state_version',
          'voided_at',
          'voided_by_actor_id',
          'void_reason',
          'closed_at',
          'closed_by_actor_type',
          'closed_by_actor_id',
          'closure_reason',
          'updated_at'
        ]::text[]
  ) is distinct from (
    to_jsonb(old)
      - array[
          'status',
          'customer_type',
          'organization_name',
          'contact_name',
          'email',
          'address_line1',
          'address_line2',
          'city',
          'postal_code',
          'country_code',
          'gurs_house_number_id',
          'reference',
          'quote_reason',
          'customer_message',
          'billing_snapshot_json',
          'customer_visible_notes',
          'admin_notes',
          'admin_title',
          'state_version',
          'voided_at',
          'voided_by_actor_id',
          'void_reason',
          'closed_at',
          'closed_by_actor_type',
          'closed_by_actor_id',
          'closure_reason',
          'updated_at'
        ]::text[]
  ) then
    raise exception 'The submitted quote-request snapshot is immutable.';
  end if;

  if new.state_version <= old.state_version then
    raise exception 'Quote-request state_version must increase.';
  end if;

  return new;
end;
$$;

create trigger quote_requests_guard_history
before update or delete on quote_requests
for each row execute function guard_quote_request_history();

create function guard_quote_offer_version()
returns trigger
language plpgsql
as $$
declare
  allowed_transition boolean;
  expected_offer_number text;
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Issued offer versions are immutable and cannot be deleted.';
    end if;
    return old;
  end if;

  if new.status <> 'draft' then
    select
      'PON-' || substring(request_number from 5) || '-V' || new.version_number::text
    into expected_offer_number
    from quote_requests
    where id = new.quote_request_id;

    if new.offer_number is distinct from expected_offer_number then
      raise exception 'Offer number must match its POV request serial and version.';
    end if;
  end if;

  if tg_op = 'INSERT' then
    return new;
  end if;

  if
    new.id is distinct from old.id
    or new.quote_request_id is distinct from old.quote_request_id
    or new.version_number is distinct from old.version_number
    or new.created_by_actor_type is distinct from old.created_by_actor_type
    or new.created_by_actor_id is distinct from old.created_by_actor_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Offer-version identity and creation evidence are immutable.';
  end if;

  allowed_transition :=
    (old.status = 'draft' and new.status in ('draft', 'issued'))
    or (
      old.status = 'issued'
      and new.status in (
        'issued',
        'accepted',
        'declined',
        'withdrawn',
        'expired',
        'superseded'
      )
    )
    or (
      old.status in ('accepted', 'declined', 'withdrawn', 'expired', 'superseded')
      and new.status = old.status
    );

  if not allowed_transition then
    raise exception 'Invalid offer-version transition from % to %.', old.status, new.status;
  end if;

  if old.status <> 'draft' and (
    to_jsonb(new)
      - array[
          'status',
          'is_current',
          'document_sha256',
          'document_bound_at',
          'accepted_at',
          'declined_at',
          'decline_reason',
          'withdrawn_at',
          'withdrawal_reason',
          'expired_at',
          'superseded_at',
          'state_version',
          'updated_at'
        ]::text[]
  ) is distinct from (
    to_jsonb(old)
      - array[
          'status',
          'is_current',
          'document_sha256',
          'document_bound_at',
          'accepted_at',
          'declined_at',
          'decline_reason',
          'withdrawn_at',
          'withdrawal_reason',
          'expired_at',
          'superseded_at',
          'state_version',
          'updated_at'
        ]::text[]
  ) then
    raise exception 'Issued offer identity, items, pricing, terms, and content are immutable.';
  end if;

  if old.document_sha256 is not null and (
    new.document_sha256 is distinct from old.document_sha256
    or new.document_bound_at is distinct from old.document_bound_at
  ) then
    raise exception 'An offer document hash can only be bound once.';
  end if;

  if old.document_sha256 is null
    and new.document_sha256 is not null
    and new.status = 'draft'
  then
    raise exception 'A draft preview cannot be bound as the issued offer document.';
  end if;

  if old.status in ('accepted', 'declined', 'withdrawn', 'expired', 'superseded')
    and (
      new.accepted_at is distinct from old.accepted_at
      or new.declined_at is distinct from old.declined_at
      or new.decline_reason is distinct from old.decline_reason
      or new.withdrawn_at is distinct from old.withdrawn_at
      or new.withdrawal_reason is distinct from old.withdrawal_reason
      or new.expired_at is distinct from old.expired_at
      or new.superseded_at is distinct from old.superseded_at
    )
  then
    raise exception 'Terminal offer lifecycle evidence is immutable.';
  end if;

  if new.state_version <= old.state_version then
    raise exception 'Offer-version state_version must increase.';
  end if;

  return new;
end;
$$;

create trigger quote_offer_versions_guard
before insert or update or delete on quote_offer_versions
for each row execute function guard_quote_offer_version();

create function guard_quote_offer_version_item()
returns trigger
language plpgsql
as $$
declare
  old_offer_status text;
  new_offer_status text;
begin
  if tg_op = 'UPDATE'
    and new.quote_offer_version_id is distinct from old.quote_offer_version_id
  then
    raise exception 'An offer item cannot be moved between offer versions.';
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    select status
    into old_offer_status
    from quote_offer_versions
    where id = old.quote_offer_version_id
    for update;

    if old_offer_status <> 'draft' then
      raise exception 'Items on an issued offer version are immutable.';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select status
    into new_offer_status
    from quote_offer_versions
    where id = new.quote_offer_version_id
    for update;

    if new_offer_status <> 'draft' then
      raise exception 'Items can only be changed on a draft offer version.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger quote_offer_version_items_guard
before insert or update or delete on quote_offer_version_items
for each row execute function guard_quote_offer_version_item();

-- Quote customer access is isolated from order access. Raw bearer and OTP
-- values are never persisted; only one-way hashes and encrypted replay
-- bootstrap material are stored.
create table quote_access_tokens (
  id uuid primary key default gen_random_uuid(),
  quote_request_id bigint not null references quote_requests(id) on delete restrict,
  quote_offer_version_id bigint,
  token_hash text not null unique,
  token_prefix text not null,
  csrf_token_hash text,
  scopes text[] not null default array['request_confirmation']::text[],
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  constraint quote_access_tokens_offer_request_fkey
    foreign key (quote_offer_version_id, quote_request_id)
    references quote_offer_versions(id, quote_request_id)
    on delete restrict,
  constraint quote_access_tokens_hash_check check (length(token_hash) = 64),
  constraint quote_access_tokens_csrf_hash_check check (
    csrf_token_hash is null or length(csrf_token_hash) = 64
  ),
  constraint quote_access_tokens_prefix_check check (
    length(token_prefix) between 6 and 20
  ),
  constraint quote_access_tokens_scopes_check check (
    scopes <@ array[
      'request_confirmation',
      'offer_review',
      'offer_response',
      'purchase_order'
    ]::text[]
    and cardinality(scopes) > 0
  ),
  constraint quote_access_tokens_expiry_check check (expires_at > created_at)
);

create index idx_quote_access_tokens_request_created_at
  on quote_access_tokens(quote_request_id, created_at desc);
create index idx_quote_access_tokens_offer_created_at
  on quote_access_tokens(quote_offer_version_id, created_at desc)
  where quote_offer_version_id is not null;
create unique index idx_quote_access_tokens_one_request_unrevoked
  on quote_access_tokens(quote_request_id)
  where quote_offer_version_id is null and revoked_at is null;
create unique index idx_quote_access_tokens_one_offer_unrevoked
  on quote_access_tokens(quote_offer_version_id)
  where quote_offer_version_id is not null and revoked_at is null;

create table quote_request_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique,
  request_hash text not null,
  intent text not null default 'quote_request' check (intent = 'quote_request'),
  quote_request_id bigint references quote_requests(id) on delete restrict,
  response_json jsonb not null default '{}'::jsonb,
  bootstrap_token_ciphertext text,
  bootstrap_token_iv text,
  bootstrap_token_tag text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint quote_request_idempotency_key_hash_check check (
    length(key_hash) = 64
  ),
  constraint quote_request_idempotency_request_hash_check check (
    length(request_hash) = 64
  ),
  constraint quote_request_idempotency_response_json_check check (
    jsonb_typeof(response_json) = 'object'
  ),
  constraint quote_request_idempotency_completion_check check (
    (
      completed_at is null
      and quote_request_id is null
      and bootstrap_token_ciphertext is null
      and bootstrap_token_iv is null
      and bootstrap_token_tag is null
    )
    or (
      completed_at is not null
      and quote_request_id is not null
      and bootstrap_token_ciphertext is not null
      and bootstrap_token_iv is not null
      and bootstrap_token_tag is not null
    )
  )
);

create index idx_quote_request_idempotency_request
  on quote_request_idempotency_keys(quote_request_id);
create index idx_quote_request_idempotency_created_at
  on quote_request_idempotency_keys(created_at);

create table quote_response_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique,
  request_hash text not null,
  quote_offer_version_id bigint not null references quote_offer_versions(id) on delete restrict,
  response_action text not null check (
    response_action in ('accept', 'decline', 'purchase_order')
  ),
  response_json jsonb not null default '{}'::jsonb,
  bootstrap_token_ciphertext text,
  bootstrap_token_iv text,
  bootstrap_token_tag text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint quote_response_idempotency_key_hash_check check (
    length(key_hash) = 64
  ),
  constraint quote_response_idempotency_request_hash_check check (
    length(request_hash) = 64
  ),
  constraint quote_response_idempotency_response_json_check check (
    jsonb_typeof(response_json) = 'object'
  ),
  constraint quote_response_idempotency_cipher_check check (
    (
      bootstrap_token_ciphertext is null
      and bootstrap_token_iv is null
      and bootstrap_token_tag is null
    )
    or (
      bootstrap_token_ciphertext is not null
      and bootstrap_token_iv is not null
      and bootstrap_token_tag is not null
    )
  ),
  constraint quote_response_idempotency_completion_check check (
    completed_at is not null
    or (
      bootstrap_token_ciphertext is null
      and bootstrap_token_iv is null
      and bootstrap_token_tag is null
      and response_json = '{}'::jsonb
    )
  )
);

create index idx_quote_response_idempotency_offer
  on quote_response_idempotency_keys(quote_offer_version_id);
create index idx_quote_response_idempotency_created_at
  on quote_response_idempotency_keys(created_at);

create table quote_email_verifications (
  id uuid primary key default gen_random_uuid(),
  quote_request_id bigint not null references quote_requests(id) on delete restrict,
  quote_offer_version_id bigint not null,
  purpose text not null check (
    purpose in ('offer_response', 'purchase_order')
  ),
  target_email_hash text not null,
  code_hash text not null,
  access_session_hash text not null,
  status text not null default 'pending' check (
    status in ('pending', 'verified', 'consumed', 'expired', 'locked')
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 6 check (max_attempts between 1 and 20),
  last_attempt_at timestamptz,
  verified_at timestamptz,
  consumed_at timestamptz,
  expires_at timestamptz not null,
  request_id text,
  correlation_id text,
  ip_hash text,
  created_at timestamptz not null default now(),
  constraint quote_email_verifications_offer_request_fkey
    foreign key (quote_offer_version_id, quote_request_id)
    references quote_offer_versions(id, quote_request_id)
    on delete restrict,
  constraint quote_email_verifications_hash_check check (
    length(target_email_hash) = 64
    and length(code_hash) = 64
    and length(access_session_hash) = 64
    and (ip_hash is null or length(ip_hash) = 64)
  ),
  constraint quote_email_verifications_expiry_check check (
    expires_at > created_at
  ),
  constraint quote_email_verifications_state_check check (
    (status = 'pending' and verified_at is null and consumed_at is null)
    or (status = 'verified' and verified_at is not null and consumed_at is null)
    or (status = 'consumed' and verified_at is not null and consumed_at is not null)
    or (status in ('expired', 'locked') and consumed_at is null)
  )
);

create index idx_quote_email_verifications_offer_created_at
  on quote_email_verifications(
    quote_offer_version_id,
    access_session_hash,
    created_at desc
  );
create index idx_quote_email_verifications_pending
  on quote_email_verifications(expires_at, id)
  where status = 'pending';

create table quote_rate_limits (
  scope text not null check (
    scope in (
      'quote_request',
      'access_exchange',
      'otp_issue',
      'otp_verify',
      'offer_response',
      'purchase_order'
    )
  ),
  subject_hash text not null,
  window_started_at timestamptz not null,
  window_seconds integer not null check (window_seconds between 1 and 86400),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  blocked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope, subject_hash, window_started_at),
  constraint quote_rate_limits_subject_hash_check check (
    length(subject_hash) = 64
  )
);

create index idx_quote_rate_limits_cleanup
  on quote_rate_limits(window_started_at, scope);
create index idx_quote_rate_limits_blocked
  on quote_rate_limits(blocked_until)
  where blocked_until is not null;

create table quote_email_settings (
  key text primary key,
  config_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint quote_email_settings_config_json_check check (
    jsonb_typeof(config_json) = 'object'
  )
);

create table quote_email_jobs (
  id uuid primary key default gen_random_uuid(),
  quote_request_id bigint not null references quote_requests(id) on delete restrict,
  quote_offer_version_id bigint,
  event_key text not null,
  event_type text not null constraint quote_email_jobs_event_type_check check (
    event_type in (
      'quote_request_submitted',
      'quote_clarification_requested',
      'quote_issued',
      'quote_access_otp',
      'quote_accepted',
      'quote_declined',
      'quote_withdrawn',
      'quote_expired',
      'quote_request_closed',
      'quote_acceptance_blocked_stock',
      'quote_delivery_failed'
    )
  ),
  audience text not null check (audience in ('customer', 'admin')),
  recipient_email text not null,
  recipient_name text,
  payload_json jsonb not null,
  status text not null default 'pending'
    constraint quote_email_jobs_status_check check (
    status in ('pending', 'processing', 'sent', 'failed', 'cancelled')
  ),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  claim_id uuid,
  locked_at timestamptz,
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by_actor_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_email_jobs_offer_request_fkey
    foreign key (quote_offer_version_id, quote_request_id)
    references quote_offer_versions(id, quote_request_id)
    on delete restrict,
  constraint quote_email_jobs_payload_json_check check (
    jsonb_typeof(payload_json) = 'object'
  ),
  constraint quote_email_jobs_claim_check check (
    (status = 'processing' and claim_id is not null and locked_at is not null)
    or (status <> 'processing' and claim_id is null and locked_at is null)
  ),
  constraint quote_email_jobs_cancellation_check check (
    (
      status = 'cancelled'
      and cancelled_at is not null
      and cancelled_by_actor_id is not null
      and btrim(cancelled_by_actor_id) <> ''
    )
    or (
      status <> 'cancelled'
      and cancelled_at is null
      and cancelled_by_actor_id is null
    )
  )
);

create unique index idx_quote_email_jobs_event_audience_recipient
  on quote_email_jobs(event_key, audience, lower(recipient_email));
create index idx_quote_email_jobs_request
  on quote_email_jobs(quote_request_id, created_at desc);
create index idx_quote_email_jobs_offer
  on quote_email_jobs(quote_offer_version_id, created_at desc)
  where quote_offer_version_id is not null;
create index idx_quote_email_jobs_pending
  on quote_email_jobs(next_attempt_at, created_at, id)
  where status = 'pending';
create index idx_quote_email_jobs_stale_processing
  on quote_email_jobs(locked_at, id)
  where status = 'processing';
create index idx_quote_email_jobs_sent_retention
  on quote_email_jobs(sent_at, id)
  where status = 'sent';

alter table orders
  add constraint orders_source_quote_offer_version_id_fkey
    foreign key (source_quote_offer_version_id)
    references quote_offer_versions(id)
    on delete restrict;

-- ============================================================================
-- Order email settings and durable delivery jobs
-- ============================================================================

create table order_email_settings (
  key text primary key,
  config_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint order_email_settings_config_check check (
    jsonb_typeof(config_json) = 'object'
  )
);

create table order_email_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id bigint not null references orders(id) on delete cascade,
  event_key text not null,
  event_type text not null,
  audience text not null,
  recipient_email text not null,
  recipient_name text,
  payload_json jsonb not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  claim_id uuid,
  locked_at timestamptz,
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_email_jobs_event_type_check check (
    event_type in (
      'order_submitted',
      'order_accepted',
      'order_rejected',
      'received',
      'in_progress',
      'partially_sent',
      'sent',
      'finished',
      'cancelled'
    )
  ),
  constraint order_email_jobs_audience_check check (
    audience in ('customer', 'admin')
  ),
  constraint order_email_jobs_payload_check check (
    jsonb_typeof(payload_json) = 'object'
  ),
  constraint order_email_jobs_status_check check (
    status in ('pending', 'processing', 'sent', 'failed')
  ),
  constraint order_email_jobs_attempts_check check (attempts >= 0),
  constraint order_email_jobs_claim_check check (
    (status = 'processing' and claim_id is not null and locked_at is not null)
    or (status <> 'processing' and claim_id is null and locked_at is null)
  )
);

create unique index idx_order_email_jobs_event_audience_recipient
  on order_email_jobs(event_key, audience, lower(recipient_email));

create index idx_order_email_jobs_order
  on order_email_jobs(order_id);

create index idx_order_email_jobs_pending
  on order_email_jobs(next_attempt_at, created_at, id)
  where status = 'pending';

create index idx_order_email_jobs_stale_processing
  on order_email_jobs(locked_at, id)
  where status = 'processing';

create index idx_order_email_jobs_sent_retention
  on order_email_jobs(sent_at, id)
  where status = 'sent';

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

create index gurs_addresses_search_text_prefix_idx
  on gurs_addresses (
    search_text collate "C",
    address_line_1 collate "C",
    postal_code,
    gurs_house_number_id
  );

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

insert into app_schema_contracts (
  contract_id,
  contract_sha256,
  installed_via
)
values (
  '20260903.prelaunch-v1',
  '6aab79cb9019d38332d67e359a2b27c5ac3058fe8eae9c4400c735fca913c3d5',
  'fresh_schema'
);

commit;
