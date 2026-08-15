begin;

-- Product lifecycle: keep deleted products durable for 90 days instead of
-- cascading their catalogue data immediately.
alter table catalog_items
  drop constraint if exists catalog_items_status_check;

alter table catalog_items
  add constraint catalog_items_status_check
  check (status in ('active', 'inactive', 'deleted'));

alter table catalog_items
  add column if not exists default_variant_id bigint,
  add column if not exists tax_rate numeric(5, 4) not null default 0.2200,
  add column if not exists appearance_override_json jsonb,
  add column if not exists deleted_at timestamptz,
  add column if not exists purge_after timestamptz,
  add column if not exists status_before_delete text;

alter table catalog_items
  drop constraint if exists catalog_items_status_before_delete_check;

alter table catalog_items
  add constraint catalog_items_status_before_delete_check
  check (status_before_delete is null or status_before_delete in ('active', 'inactive'));

alter table catalog_items
  drop constraint if exists catalog_items_tax_rate_check;

alter table catalog_items
  add constraint catalog_items_tax_rate_check
  check (tax_rate >= 0 and tax_rate <= 1);

alter table catalog_items
  drop constraint if exists catalog_items_appearance_override_json_check;

alter table catalog_items
  add constraint catalog_items_appearance_override_json_check
  check (appearance_override_json is null or jsonb_typeof(appearance_override_json) = 'object');

alter table catalog_item_variants
  add column if not exists cost_net numeric(12, 2),
  add column if not exists content_override_json jsonb;

alter table catalog_item_variants
  drop constraint if exists catalog_item_variants_cost_net_check;

alter table catalog_item_variants
  add constraint catalog_item_variants_cost_net_check
  check (cost_net is null or cost_net >= 0);

alter table catalog_item_variants
  drop constraint if exists catalog_item_variants_content_override_json_check;

alter table catalog_item_variants
  add constraint catalog_item_variants_content_override_json_check
  check (content_override_json is null or jsonb_typeof(content_override_json) = 'object');

alter table catalog_items
  drop constraint if exists catalog_items_deleted_retention_check;

alter table catalog_items
  add constraint catalog_items_deleted_retention_check
  check (
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
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_items_default_variant_id_fkey'
      and conrelid = 'catalog_items'::regclass
  ) then
    alter table catalog_items
      add constraint catalog_items_default_variant_id_fkey
      foreign key (default_variant_id)
      references catalog_item_variants(id)
      on delete set null
      deferrable initially deferred;
  end if;
end
$$;

create index if not exists idx_catalog_items_default_variant_id
  on catalog_items(default_variant_id);

create index if not exists idx_catalog_items_deleted_purge_after
  on catalog_items(purge_after)
  where status = 'deleted';

create table if not exists catalog_item_slug_aliases (
  id bigserial primary key,
  item_id bigint not null references catalog_items(id) on delete cascade,
  slug text not null unique,
  created_at timestamptz not null default now(),
  unique (item_id, slug)
);

create index if not exists idx_catalog_item_slug_aliases_item_id
  on catalog_item_slug_aliases(item_id);

-- A variant remains the concrete purchasable combination. Axes and values are
-- generic, while this assignment table enforces one value per axis/variant.
create table if not exists catalog_option_axes (
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

create index if not exists idx_catalog_option_axes_item_position
  on catalog_option_axes(item_id, position, id);

create table if not exists catalog_option_values (
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

alter table catalog_option_values
  add column if not exists swatch text;

create index if not exists idx_catalog_option_values_axis_position
  on catalog_option_values(axis_id, position, id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_item_variants_id_item_id_key'
      and conrelid = 'catalog_item_variants'::regclass
  ) then
    alter table catalog_item_variants
      add constraint catalog_item_variants_id_item_id_key unique (id, item_id);
  end if;
end
$$;

-- The scalar foreign key above handles ON DELETE SET NULL. This deferred
-- composite key additionally guarantees that the chosen default belongs to
-- the same parent product.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_items_default_variant_same_item_fkey'
      and conrelid = 'catalog_items'::regclass
  ) then
    alter table catalog_items
      add constraint catalog_items_default_variant_same_item_fkey
      foreign key (default_variant_id, id)
      references catalog_item_variants(id, item_id)
      deferrable initially deferred;
  end if;
end
$$;

create table if not exists catalog_variant_option_values (
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

create unique index if not exists idx_catalog_variant_option_values_variant_value
  on catalog_variant_option_values(variant_id, option_value_id);

create index if not exists idx_catalog_variant_option_values_item
  on catalog_variant_option_values(item_id, variant_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_media_id_item_id_key'
      and conrelid = 'catalog_media'::regclass
  ) then
    alter table catalog_media
      add constraint catalog_media_id_item_id_key unique (id, item_id);
  end if;
end
$$;

-- Gallery images can belong to multiple variants and retain an explicit order
-- per variant. catalog_media.variant_id remains available for legacy video and
-- single-variant records.
create table if not exists catalog_variant_media (
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

create index if not exists idx_catalog_variant_media_item
  on catalog_variant_media(item_id, variant_id, position, media_id);

insert into catalog_variant_media (variant_id, item_id, media_id, position)
select cm.variant_id, cm.item_id, cm.id, cm.position
from catalog_media cm
where cm.variant_id is not null
on conflict (variant_id, media_id) do nothing;

-- Preserve all existing variants and make the first active, ordered variant the
-- default. If no active variant exists, fall back to the first ordered variant.
update catalog_items ci
set default_variant_id = coalesce(
  (
    select civ.id
    from catalog_item_variants civ
    where civ.item_id = ci.id
      and civ.status = 'active'
    order by civ.position asc, civ.id asc
    limit 1
  ),
  (
    select civ.id
    from catalog_item_variants civ
    where civ.item_id = ci.id
    order by civ.position asc, civ.id asc
    limit 1
  )
)
where ci.default_variant_id is null;

commit;
