begin;
set local lock_timeout = '10s';
set local statement_timeout = '5min';
select pg_advisory_xact_lock(hashtext('atehna:historical-orders-v6'));
alter table orders
  add column if not exists entry_source text,
  add column if not exists is_historical boolean not null default false,
  add column if not exists original_reference_system text,
  add column if not exists original_reference text,
  add column if not exists recorded_at timestamptz,
  add column if not exists historical_fulfilled_at timestamptz,
  add column if not exists historical_payment_at timestamptz,
  add column if not exists historical_revision bigint not null default 0,
  add column if not exists archived_at timestamptz;
-- Legacy insertion time cannot be reconstructed; preserve the earliest stored order date.
update orders set recorded_at = created_at where recorded_at is null;
alter table orders alter column recorded_at set default clock_timestamp(), alter column recorded_at set not null;
-- Only unfinished admin placeholders are unambiguous; all other old provenance stays unknown.
update orders set entry_source = 'manual' where entry_source is null and is_draft;
alter table deleted_archive_entries alter column expires_at drop not null;
alter table deleted_archive_entries alter column expires_at drop default;
update deleted_archive_entries set expires_at = null where item_type in ('order','pdf');
alter table orders drop constraint if exists orders_contract_state_evidence_check;
alter table orders add constraint orders_contract_state_evidence_check check (
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
      and (is_historical or contract_accepted_at is not null)
      and contract_accepted_actor_type is not null
      and contract_acceptance_evidence_json is not null
      and contract_rejected_at is null
      and contract_rejected_actor_type is null
      and contract_rejected_actor_id is null
      and contract_rejection_reason is null
      and contract_rejection_evidence_json is null
      and (is_historical or committed_at is not null)
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
  );

do $ddl$ begin if not exists(select 1 from pg_constraint where conrelid='public.orders'::regclass and conname='orders_entry_source_check') then alter table orders add constraint orders_entry_source_check check (entry_source is null or entry_source in ('website', 'manual')); end if; end $ddl$;
do $ddl$ begin if not exists(select 1 from pg_constraint where conrelid='public.orders'::regclass and conname='orders_original_reference_check') then alter table orders add constraint orders_original_reference_check check (
  (original_reference_system is null) = (original_reference is null)
  and (original_reference_system is null or length(btrim(original_reference_system)) between 1 and 80)
  and (original_reference is null or length(btrim(original_reference)) between 1 and 200)
  and (not is_historical or is_draft or original_reference is not null)
); end if; end $ddl$;
do $ddl$ begin if not exists(select 1 from pg_constraint where conrelid='public.orders'::regclass and conname='orders_historical_guard_check') then alter table orders add constraint orders_historical_guard_check check (
  historical_revision >= 0 and (not is_historical or (entry_source is not distinct from 'manual' and not stock_enforcement_applied))
); end if; end $ddl$;
create unique index if not exists orders_original_reference_unique on orders (lower(btrim(original_reference_system)), lower(btrim(original_reference)))
  where original_reference is not null;
create index if not exists orders_entry_source_created_idx on orders (entry_source, created_at);
create index if not exists orders_archived_at_idx on orders (archived_at) where archived_at is not null;
create table if not exists order_historical_changes (
  id bigserial constraint order_historical_changes_pkey primary key,
  order_id bigint not null constraint order_historical_changes_order_id_fkey references orders(id),
  revision bigint not null constraint order_historical_changes_revision_check check (revision > 0),
  changed_at timestamptz not null default clock_timestamp(),
  actor_id text not null,
  before_json jsonb not null,
  after_json jsonb not null,
  constraint order_historical_changes_order_id_revision_key unique (order_id, revision),
  constraint order_historical_changes_check check (jsonb_typeof(before_json) = 'object' and jsonb_typeof(after_json) = 'object')
);
create table if not exists business_analytics_settings (
  key text constraint business_analytics_settings_pkey primary key constraint business_analytics_settings_key_check check (key = 'default'),
  quote_go_live_date date,
  revision bigint not null default 0 constraint business_analytics_settings_revision_check check (revision >= 0),
  updated_at timestamptz not null default now()
);
insert into business_analytics_settings (key) values ('default') on conflict do nothing;
create or replace function protect_order_entry_evidence()
returns trigger language plpgsql as $function$
begin
  if tg_op = 'INSERT' then
    new.recorded_at := clock_timestamp();
  elsif new.recorded_at is distinct from old.recorded_at
    or new.is_historical is distinct from old.is_historical
    or new.entry_source is distinct from old.entry_source then
    raise exception 'Order entry provenance is immutable.';
  end if;
  return new;
end;
$function$;
drop trigger if exists orders_protect_entry_evidence on orders;
create trigger orders_protect_entry_evidence before insert or update on orders
for each row execute function protect_order_entry_evidence();
create or replace function reject_historical_order_stock_hold()
returns trigger language plpgsql as $function$
begin
  if exists (select 1 from orders where id = new.order_id and is_historical) then
    raise exception 'Historical orders cannot change stock.';
  end if;
  return new;
end;
$function$;
drop trigger if exists order_stock_holds_reject_historical on order_stock_holds;
create trigger order_stock_holds_reject_historical before insert or update on order_stock_holds
for each row execute function reject_historical_order_stock_hold();

create or replace function capture_order_analytics_snapshot()
returns trigger
language plpgsql
as $function$
declare
  should_capture boolean := false;
  captured_time timestamptz;
begin

  if new.is_historical then
    if lower(tg_op) = 'update' and old.is_draft and not new.is_draft
      and current_setting('atehna.historical_order_write', true) is distinct from 'allowed' then
      raise exception 'Historical entry must be completed explicitly.';
    end if;
    if lower(tg_op) = 'update' and not old.is_draft
      and current_setting('atehna.historical_order_write', true) is distinct from 'allowed'
      and (new.status is distinct from old.status or new.payment_status is distinct from old.payment_status
        or new.subtotal is distinct from old.subtotal or new.tax is distinct from old.tax or new.shipping is distinct from old.shipping
        or new.created_at is distinct from old.created_at
        or new.historical_fulfilled_at is distinct from old.historical_fulfilled_at
        or new.historical_payment_at is distinct from old.historical_payment_at
        or new.analytics_snapshot_json is distinct from old.analytics_snapshot_json
        or new.analytics_submitted_at is distinct from old.analytics_submitted_at
        or new.analytics_fulfilled_at is distinct from old.analytics_fulfilled_at
        or new.analytics_fulfilled_merchandise_net is distinct from old.analytics_fulfilled_merchandise_net
        or new.analytics_fulfilled_lines_json is distinct from old.analytics_fulfilled_lines_json) then
      raise exception 'Historical facts require the audited historical entry workflow.';
    end if;
    if not new.is_draft and (lower(tg_op) = 'insert'
      or current_setting('atehna.historical_order_write', true) = 'allowed') then
      new.analytics_submitted_at := new.created_at;
      new.analytics_snapshot_json := jsonb_build_object(
        'version', 1, 'origin', 'legacy', 'dateBasis', 'original-order-date',
        'customerType', new.customer_type, 'customerName', coalesce(nullif(new.organization_name, ''), new.contact_name),
        'address', jsonb_build_object('addressLine1', new.address_line1, 'addressLine2', new.address_line2,
          'city', new.city, 'postalCode', new.postal_code, 'countryCode', new.country_code, 'gursHouseNumberId', new.gurs_house_number_id),
        'subtotalNetCents', (new.subtotal * 100)::bigint, 'shippingGrossCents', (new.shipping * 100)::bigint,
        'taxCents', (new.tax * 100)::bigint, 'shippingSnapshot', new.shipping_snapshot_json,
        'shippingTaxRate', new.shipping_tax_rate, 'capturedAt', new.recorded_at, 'source', 'direct'
      );
      new.analytics_fulfilled_at := case when new.status in ('sent', 'finished')
        and new.contract_status = 'accepted' and new.commitment_status = 'binding' then new.historical_fulfilled_at else null end;
      new.analytics_fulfilled_merchandise_net := case when new.status in ('sent', 'finished') and new.contract_status = 'accepted' and new.commitment_status = 'binding' then new.subtotal else null end;
      new.analytics_fulfilment_origin := case when new.status in ('sent', 'finished') and new.contract_status = 'accepted' and new.commitment_status = 'binding' then 'legacy' else null end;
      select case when new.status in ('sent', 'finished') and new.contract_status = 'accepted' and new.commitment_status = 'binding' then jsonb_agg(jsonb_build_object(
        'id', oi.id::text, 'key', coalesce('variant:' || oi.catalog_variant_id::text, 'product:' || oi.catalog_item_id::text, 'sku:' || oi.sku),
        'name', oi.name, 'category', oi.category_id, 'quantity', oi.quantity,
        'lineNetCents', (oi.line_net * 100)::bigint, 'unitCostCents', (oi.historical_unit_cost_net * 100)::bigint
      ) order by oi.id) else null end into new.analytics_fulfilled_lines_json from order_items oi where oi.order_id = new.id;
    end if;
    return new;
  end if;
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
update audit_events set retention_until=null where entity_type='order' or (entity_type='media' and coalesce(metadata_json->>'item_type','')='pdf');
create or replace function protect_order_audit_history()
returns trigger language plpgsql as $function$
begin
  if old.entity_type = 'order' or (old.entity_type = 'media' and coalesce(old.metadata_json->>'item_type','') = 'pdf') then
    raise exception 'Order audit history cannot be deleted.';
  end if;
  return old;
end;
$function$;
drop trigger if exists audit_events_protect_order_history on audit_events;
create trigger audit_events_protect_order_history before delete on audit_events
for each row execute function protect_order_audit_history();
create or replace function protect_historical_change_log()
returns trigger language plpgsql as $function$
begin
  raise exception 'Historical order change evidence is immutable.';
end;
$function$;
drop trigger if exists order_historical_changes_immutable on order_historical_changes;
create trigger order_historical_changes_immutable before update or delete on order_historical_changes
for each row execute function protect_historical_change_log();
commit;
