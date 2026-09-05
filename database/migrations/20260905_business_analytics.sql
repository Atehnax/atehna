-- Additive business analytics measurements and immutable submission evidence.
-- Apply to an existing compatible database; never runs from checkout or startup.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '5min';
set local search_path = public, pg_temp;

alter table orders
  add column if not exists analytics_submitted_at timestamptz,
  add column if not exists analytics_snapshot_json jsonb,
  add column if not exists analytics_fulfilled_at timestamptz,
  add column if not exists analytics_fulfilled_lines_json jsonb,
  add column if not exists analytics_fulfilled_merchandise_net numeric(12, 2),
  add column if not exists analytics_fulfilment_origin text,
  add column if not exists analytics_is_test boolean not null default false,
  add column if not exists customer_directory_profile_id text,
  add column if not exists school_directory_row_id text,
  add column if not exists actual_packed_weight_grams bigint,
  add column if not exists actual_carrier_cost_net numeric(12, 2),
  add column if not exists actual_parcel_count integer,
  add column if not exists preparation_minutes numeric(10, 2),
  add column if not exists actual_oversize boolean,
  add column if not exists actual_length_mm integer,
  add column if not exists actual_width_mm integer,
  add column if not exists actual_height_mm integer,
  add column if not exists merchandise_refund_net numeric(12, 2),
  add column if not exists refund_history_complete boolean not null default false,
  add column if not exists shipping_tax_rate numeric(5, 4),
  add column if not exists analytics_measurement_revision integer not null default 0,
  add column if not exists analytics_measured_at timestamptz,
  add column if not exists analytics_measured_by text;

alter table order_items add column if not exists historical_unit_cost_net numeric(12, 2);
alter table order_line_snapshots add column if not exists historical_unit_cost_net numeric(12, 2);

do $analytics_constraints$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_analytics_measurements_check' and conrelid = 'orders'::regclass) then
    alter table orders add constraint orders_analytics_measurements_check check (
      (actual_packed_weight_grams is null or actual_packed_weight_grams > 0)
      and (actual_carrier_cost_net is null or actual_carrier_cost_net >= 0)
      and (actual_parcel_count is null or actual_parcel_count > 0)
      and (preparation_minutes is null or preparation_minutes >= 0)
      and (actual_length_mm is null or actual_length_mm > 0)
      and (actual_width_mm is null or actual_width_mm > 0)
      and (actual_height_mm is null or actual_height_mm > 0)
      and (merchandise_refund_net is null or merchandise_refund_net >= 0)
      and (not refund_history_complete or merchandise_refund_net is not null)
      and (shipping_tax_rate is null or shipping_tax_rate between 0 and 1)
      and (analytics_fulfilled_merchandise_net is null or analytics_fulfilled_merchandise_net >= 0)
      and (analytics_fulfilment_origin is null or analytics_fulfilment_origin in ('captured', 'legacy'))
      and analytics_measurement_revision >= 0
      and (analytics_snapshot_json is null or jsonb_typeof(analytics_snapshot_json) = 'object')
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'order_items_historical_cost_check' and conrelid = 'order_items'::regclass) then
    alter table order_items add constraint order_items_historical_cost_check check (historical_unit_cost_net is null or historical_unit_cost_net >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'order_line_snapshots_historical_cost_check' and conrelid = 'order_line_snapshots'::regclass) then
    alter table order_line_snapshots add constraint order_line_snapshots_historical_cost_check check (historical_unit_cost_net is null or historical_unit_cost_net >= 0);
  end if;
end;
$analytics_constraints$;

create table if not exists order_analytics_change_log (
  id bigserial primary key,
  order_id bigint not null,
  revision integer not null,
  changed_at timestamptz not null default now(),
  actor_id text not null,
  reason text not null,
  before_json jsonb not null,
  after_json jsonb not null,
  unique (order_id, revision),
  constraint order_analytics_change_log_revision_check check (revision > 0),
  constraint order_analytics_change_log_reason_check check (length(btrim(reason)) between 3 and 2000),
  constraint order_analytics_change_log_json_check check (
    jsonb_typeof(before_json) = 'object' and jsonb_typeof(after_json) = 'object'
  )
);

create index if not exists orders_analytics_activity_idx
  on orders (analytics_submitted_at, customer_type, status) where not is_draft and not analytics_is_test;
create index if not exists orders_analytics_customer_idx
  on orders (customer_directory_profile_id, analytics_submitted_at) where customer_directory_profile_id is not null;
create index if not exists orders_analytics_school_idx
  on orders (school_directory_row_id, analytics_submitted_at) where school_directory_row_id is not null;

create or replace function capture_order_analytics_snapshot()
returns trigger
language plpgsql
as $function$
declare
  should_capture boolean := false;
  captured_time timestamptz;
begin
  if lower(tg_op) = 'update' then
    if old.analytics_snapshot_json is not null and (
      new.analytics_snapshot_json is distinct from old.analytics_snapshot_json
      or new.analytics_submitted_at is distinct from old.analytics_submitted_at
    ) then
      raise exception 'The analytics submission snapshot is immutable.';
    end if;
    if old.analytics_fulfilled_at is not null and (
      new.analytics_fulfilled_at is distinct from old.analytics_fulfilled_at
      or new.analytics_fulfilled_merchandise_net is distinct from old.analytics_fulfilled_merchandise_net
      or new.analytics_fulfilment_origin is distinct from old.analytics_fulfilment_origin
      or new.analytics_fulfilled_lines_json is distinct from old.analytics_fulfilled_lines_json
    ) then
      raise exception 'The analytics fulfilment snapshot is immutable.';
    end if;
    should_capture := old.is_draft and not new.is_draft;
    if old.payment_status is distinct from new.payment_status and new.payment_status = 'refunded' then
      new.refund_history_complete := false;
    end if;
  else
    should_capture := not new.is_draft;
  end if;
  if should_capture and new.analytics_snapshot_json is null then
    captured_time := case when lower(tg_op) = 'insert' then new.created_at else clock_timestamp() end;
    new.analytics_submitted_at := captured_time;
    new.analytics_snapshot_json := jsonb_build_object(
      'version', 1,
      'origin', 'captured',
      'customerType', new.customer_type,
      'customerName', coalesce(nullif(new.organization_name, ''), new.contact_name),
      'address', jsonb_build_object(
        'addressLine1', new.address_line1,
        'addressLine2', new.address_line2,
        'city', new.city,
        'postalCode', new.postal_code,
        'countryCode', new.country_code,
        'gursHouseNumberId', new.gurs_house_number_id
      ),
      'subtotalNetCents', (new.subtotal * 100)::bigint,
      'shippingGrossCents', (new.shipping * 100)::bigint,
      'taxCents', (new.tax * 100)::bigint,
      'shippingSnapshot', new.shipping_snapshot_json,
      'shippingTaxRate', new.shipping_tax_rate,
      'capturedAt', captured_time,
      'source', case when new.source_quote_offer_version_id is null then 'direct' else 'quote' end
    );
    new.merchandise_refund_net := 0;
    new.refund_history_complete := new.payment_status <> 'refunded';
    if lower(tg_op) = 'update' then
      update order_items set historical_unit_cost_net = catalog_item_variants.cost_net
      from catalog_item_variants
      where order_items.order_id = new.id
        and order_items.catalog_variant_id = catalog_item_variants.id
        and order_items.historical_unit_cost_net is null;
      update order_line_snapshots set historical_unit_cost_net = catalog_item_variants.cost_net
      from catalog_item_variants
      where order_line_snapshots.order_id = new.id
        and order_line_snapshots.catalog_variant_id = catalog_item_variants.id
        and order_line_snapshots.historical_unit_cost_net is null;
    end if;
    if new.source_quote_offer_version_id is not null then
      select quote_requests.intake_source = 'admin_testing'
      into new.analytics_is_test
      from quote_offer_versions
      join quote_requests on quote_requests.id = quote_offer_versions.quote_request_id
      where quote_offer_versions.id = new.source_quote_offer_version_id;
      new.analytics_is_test := coalesce(new.analytics_is_test, false);
    end if;
  end if;
  if new.analytics_fulfilled_at is null
    and not new.is_draft
    and new.status in ('sent', 'finished')
    and new.contract_status = 'accepted'
    and new.commitment_status = 'binding'
    and (lower(tg_op) = 'insert' or should_capture or old.status not in ('sent', 'finished') or old.contract_status <> 'accepted' or old.commitment_status <> 'binding') then
    new.analytics_fulfilled_at := clock_timestamp();
    new.analytics_fulfilled_merchandise_net := new.subtotal;
    new.analytics_fulfilment_origin := 'captured';
    select jsonb_agg(jsonb_build_object(
      'id', order_items.id::text,
      'key', case
        when order_items.catalog_variant_id is not null then 'variant:' || order_items.catalog_variant_id::text
        when order_items.catalog_item_id is not null then 'product:' || order_items.catalog_item_id::text
        else 'sku:' || order_items.sku end,
      'name', order_items.name,
      'category', order_items.category_id,
      'quantity', order_items.quantity,
      'lineNetCents', (order_items.line_net * 100)::bigint,
      'unitCostCents', (order_items.historical_unit_cost_net * 100)::bigint
    ) order by order_items.id) into new.analytics_fulfilled_lines_json
    from order_items where order_items.order_id = new.id;
  end if;
  return new;
end;
$function$;

drop trigger if exists orders_capture_analytics_snapshot on orders;
create trigger orders_capture_analytics_snapshot
before insert or update on orders
for each row execute function capture_order_analytics_snapshot();

create or replace function capture_order_historical_cost()
returns trigger
language plpgsql
as $function$
declare
  snapshot_origin text;
begin
  select analytics_snapshot_json ->> 'origin' into snapshot_origin from orders where id = new.order_id;
  if snapshot_origin = 'captured' and new.historical_unit_cost_net is null then
    select cost_net into new.historical_unit_cost_net
    from catalog_item_variants where id = new.catalog_variant_id;
  end if;
  return new;
end;
$function$;

drop trigger if exists order_items_capture_historical_cost on order_items;
create trigger order_items_capture_historical_cost
before insert on order_items
for each row execute function capture_order_historical_cost();

drop trigger if exists order_line_snapshots_capture_historical_cost on order_line_snapshots;
create trigger order_line_snapshots_capture_historical_cost
before insert on order_line_snapshots
for each row execute function capture_order_historical_cost();

commit;
