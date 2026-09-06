-- Per-SKU pricing and TDABC inputs. Additive, preserves all existing stock/costs.
-- Run explicitly before the application release; never from a request/build.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '5min';
set local search_path = public, pg_temp;
select pg_advisory_xact_lock(hashtext('atehna:pricing-stock:20260906'));

alter table catalog_item_variants
  add column if not exists work_minutes numeric(12, 4),
  add column if not exists other_costs numeric(12, 2),
  add column if not exists purchase_updated_at timestamptz,
  add column if not exists stock_revision bigint not null default 0,
  add column if not exists pricing_revision bigint not null default 0;

do $constraints$
begin
  if not exists (select 1 from pg_constraint where conrelid='catalog_item_variants'::regclass and conname='catalog_variant_tdabc_inputs_check') then
    alter table catalog_item_variants add constraint catalog_variant_tdabc_inputs_check check (
      (work_minutes is null or (work_minutes >= 0 and work_minutes <= 99999999.9999))
      and (other_costs is null or (other_costs >= 0 and other_costs <= 9999999999.99))
      and stock_revision >= 0 and pricing_revision >= 0
    );
  end if;
end;
$constraints$;

create table if not exists pricing_stock_model (
  key text constraint pricing_stock_model_pkey primary key constraint pricing_stock_model_key_check check (key = 'default'),
  revision bigint not null default 0 constraint pricing_stock_model_revision_check check (revision >= 0),
  config_json jsonb not null constraint pricing_stock_model_config_json_check check (jsonb_typeof(config_json) = 'object'),
  updated_at timestamptz not null default now()
);
insert into pricing_stock_model (key, config_json) values ('default', '{"formulaVersion":1,"formula":"drugi_spremenljivi_stroški_artikla + (čas_artikla_v_minutah / 60) * ((število_zaposlenih * mesečni_strošek_zaposlenega + fiksni_stroški + ciljni_dobiček) / (število_zaposlenih * razpoložljive_ure_na_zaposlenega * izkoriščenost))","parameters":{"headcount":"5","employeeCost":"2650","availableHours":"128","utilizationPercent":"75","fixedCosts":"2400","targetProfit":"2000","adequacyThresholdPercent":"120"}}'::jsonb)
  on conflict (key) do nothing;

-- This history is mandatory, independent of the optional general admin audit.
-- Identifiers are snapshots rather than cascading FKs so deletion cannot erase it.
create table if not exists pricing_stock_history (
  id bigserial constraint pricing_stock_history_pkey primary key,
  occurred_at timestamptz not null default clock_timestamp(),
  entity_type text not null constraint pricing_stock_history_entity_type_check check (entity_type in ('variant', 'model')),
  entity_id text not null,
  item_id bigint,
  sku text,
  actor_id text,
  actor_name text,
  source text not null,
  request_id text,
  model_revision bigint,
  before_json jsonb not null constraint pricing_stock_history_before_json_check check (jsonb_typeof(before_json) = 'object'),
  after_json jsonb not null constraint pricing_stock_history_after_json_check check (jsonb_typeof(after_json) = 'object')
);
create index if not exists idx_pricing_stock_history_entity on pricing_stock_history(entity_type, entity_id, occurred_at desc);

create or replace function track_catalog_variant_pricing_stock()
returns trigger language plpgsql as $function$
begin
  if tg_op = 'INSERT' then
    new.stock_revision := 0;
    new.pricing_revision := 0;
    new.purchase_updated_at := case when new.cost_net is null then null else clock_timestamp() end;
    return new;
  end if;
  new.stock_revision := old.stock_revision + case when new.inventory is distinct from old.inventory then 1 else 0 end;
  new.pricing_revision := old.pricing_revision + case when
    new.price is distinct from old.price or new.cost_net is distinct from old.cost_net
    or new.work_minutes is distinct from old.work_minutes or new.other_costs is distinct from old.other_costs
    then 1 else 0 end;
  new.purchase_updated_at := case when new.cost_net is distinct from old.cost_net then clock_timestamp() else old.purchase_updated_at end;
  if new.stock_revision <> old.stock_revision or new.pricing_revision <> old.pricing_revision then new.updated_at := clock_timestamp(); end if;
  return new;
end;
$function$;
drop trigger if exists catalog_variant_pricing_stock_revision on catalog_item_variants;
create trigger catalog_variant_pricing_stock_revision before insert or update on catalog_item_variants
  for each row execute function track_catalog_variant_pricing_stock();

create or replace function record_catalog_variant_pricing_stock()
returns trigger language plpgsql as $function$
declare context jsonb;
begin
  if new.stock_revision = old.stock_revision and new.pricing_revision = old.pricing_revision then return new; end if;
  context := coalesce(nullif(current_setting('atehna.pricing_stock_audit', true), '')::jsonb, '{}'::jsonb);
  insert into pricing_stock_history (entity_type, entity_id, item_id, sku, actor_id, actor_name, source, request_id, model_revision, before_json, after_json)
  values ('variant', new.id::text, new.item_id, new.variant_sku,
    context->>'actorId', context->>'actorName', coalesce(context->>'source','database'), context->>'requestId',
    nullif(context->>'modelRevision','')::bigint,
    jsonb_build_object('saleNet',old.price::text,'purchaseNet',old.cost_net::text,'inventory',old.inventory,'workMinutes',old.work_minutes::text,'otherCosts',old.other_costs::text,'stockRevision',old.stock_revision::text,'pricingRevision',old.pricing_revision::text),
    jsonb_build_object('saleNet',new.price::text,'purchaseNet',new.cost_net::text,'inventory',new.inventory,'workMinutes',new.work_minutes::text,'otherCosts',new.other_costs::text,'stockRevision',new.stock_revision::text,'pricingRevision',new.pricing_revision::text));
  return new;
end;
$function$;
drop trigger if exists catalog_variant_pricing_stock_history on catalog_item_variants;
create trigger catalog_variant_pricing_stock_history after update on catalog_item_variants
  for each row execute function record_catalog_variant_pricing_stock();

commit;
