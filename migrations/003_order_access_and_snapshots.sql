-- Authoritative order pricing, immutable placement snapshots, idempotency,
-- and opaque customer access tokens.

begin;

alter table orders
  add column if not exists address_line1 text,
  add column if not exists city text,
  add column if not exists currency text not null default 'EUR',
  add column if not exists tax_rate numeric(5, 4) not null default 0.2200,
  add column if not exists pricing_version text not null default 'legacy',
  add column if not exists commitment_status text;

update orders
set commitment_status = case
  when customer_type = 'school' then 'pending_confirmation'
  else 'binding'
end
where commitment_status is null;

alter table orders
  alter column commitment_status set default 'binding',
  alter column commitment_status set not null;

alter table order_items
  add column if not exists catalog_item_id bigint,
  add column if not exists catalog_variant_id bigint,
  add column if not exists product_slug text,
  add column if not exists variant_name text,
  add column if not exists category_id text,
  add column if not exists category_path text,
  add column if not exists selected_attributes jsonb not null default '{}'::jsonb,
  add column if not exists image_url text,
  add column if not exists base_unit_net numeric(12, 2),
  add column if not exists discount_pct numeric(5, 2),
  add column if not exists unit_net numeric(12, 2),
  add column if not exists unit_tax numeric(12, 2),
  add column if not exists unit_gross numeric(12, 2),
  add column if not exists line_net numeric(12, 2),
  add column if not exists line_tax numeric(12, 2),
  add column if not exists line_gross numeric(12, 2),
  add column if not exists tax_rate numeric(5, 4),
  add column if not exists currency text,
  add column if not exists product_snapshot_json jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'order_items_catalog_item_id_fkey'
  ) then
    alter table order_items
      add constraint order_items_catalog_item_id_fkey
      foreign key (catalog_item_id) references catalog_items(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_commitment_status_check'
  ) then
    alter table orders
      add constraint orders_commitment_status_check
      check (commitment_status in ('binding', 'pending_confirmation', 'rejected')) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'order_items_catalog_variant_id_fkey'
  ) then
    alter table order_items
      add constraint order_items_catalog_variant_id_fkey
      foreign key (catalog_variant_id) references catalog_item_variants(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'order_items_category_id_fkey'
  ) then
    alter table order_items
      add constraint order_items_category_id_fkey
      foreign key (category_id) references catalog_categories(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_tax_rate_range_check'
  ) then
    alter table orders
      add constraint orders_tax_rate_range_check
      check (tax_rate >= 0 and tax_rate <= 1) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'order_items_snapshot_amounts_nonnegative_check'
  ) then
    alter table order_items
      add constraint order_items_snapshot_amounts_nonnegative_check
      check (
        (base_unit_net is null or base_unit_net >= 0)
        and (discount_pct is null or (discount_pct >= 0 and discount_pct <= 100))
        and (unit_net is null or unit_net >= 0)
        and (unit_tax is null or unit_tax >= 0)
        and (unit_gross is null or unit_gross >= 0)
        and (line_net is null or line_net >= 0)
        and (line_tax is null or line_tax >= 0)
        and (line_gross is null or line_gross >= 0)
        and (tax_rate is null or (tax_rate >= 0 and tax_rate <= 1))
      ) not valid;
  end if;
end
$$;

alter table orders validate constraint orders_commitment_status_check;
alter table orders validate constraint orders_tax_rate_range_check;
alter table order_items validate constraint order_items_snapshot_amounts_nonnegative_check;

alter table order_documents
  add column if not exists version_number integer,
  add column if not exists document_number text,
  add column if not exists issued_at timestamptz,
  add column if not exists content_sha256 text,
  add column if not exists legal_status text not null default 'operational',
  add column if not exists format_marker text not null default 'legacy';

with ranked_documents as (
  select
    id,
    row_number() over (
      partition by order_id, type
      order by created_at asc, id asc
    )::integer as inferred_version
  from order_documents
  where version_number is null
)
update order_documents documents
set
  version_number = ranked_documents.inferred_version,
  issued_at = coalesce(documents.issued_at, documents.created_at),
  document_number = coalesce(
    documents.document_number,
    upper(replace(documents.type, '_', '-')) || '-' || documents.order_id || '-V' || ranked_documents.inferred_version
  )
from ranked_documents
where documents.id = ranked_documents.id;

alter table order_documents
  alter column version_number set not null,
  alter column document_number set not null,
  alter column issued_at set not null;

create unique index if not exists idx_order_documents_order_type_version
  on order_documents(order_id, type, version_number)
  where version_number is not null;

create index if not exists idx_order_documents_content_sha256
  on order_documents(content_sha256)
  where content_sha256 is not null;

create index if not exists idx_order_items_catalog_item_id
  on order_items(catalog_item_id);
create index if not exists idx_order_items_catalog_variant_id
  on order_items(catalog_variant_id);
create index if not exists idx_order_items_category_id
  on order_items(category_id);

create table if not exists order_line_snapshots (
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

create index if not exists idx_order_line_snapshots_order_id
  on order_line_snapshots(order_id, line_number);
create index if not exists idx_order_line_snapshots_variant_id
  on order_line_snapshots(catalog_variant_id);
create index if not exists idx_order_line_snapshots_category_id
  on order_line_snapshots(category_id);

create table if not exists order_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique,
  request_hash text not null,
  order_id bigint references orders(id) on delete cascade,
  response_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint order_idempotency_key_hash_check check (length(key_hash) = 64),
  constraint order_idempotency_request_hash_check check (length(request_hash) = 64)
);

create index if not exists idx_order_idempotency_keys_order_id
  on order_idempotency_keys(order_id);
create index if not exists idx_order_idempotency_keys_created_at
  on order_idempotency_keys(created_at);

create table if not exists order_access_tokens (
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

create index if not exists idx_order_access_tokens_order_id_created_at
  on order_access_tokens(order_id, created_at desc);
create index if not exists idx_order_access_tokens_active
  on order_access_tokens(order_id, expires_at desc)
  where revoked_at is null;

create unique index if not exists idx_order_access_tokens_one_unrevoked
  on order_access_tokens(order_id)
  where revoked_at is null;

commit;
