-- Atehna additive deployment artifact: retain the stock-enforcement mode that
-- governed each order's inventory lifecycle.
--
-- REVIEWED EXECUTION ONLY. Do not run this file from application startup.
-- Apply it after 20260901_inventory_policy_settings.sql and verify a database
-- backup first. Existing orders remain stock-enforced by default.

begin;

set local search_path = public, pg_temp;
set local lock_timeout = '10s';
set local statement_timeout = '15min';
select pg_advisory_xact_lock(hashtext('atehna-order-stock-enforcement-marker-v1'));

do $$
begin
  if to_regclass('public.orders') is null then
    raise exception 'Apply and verify the canonical orders schema before this deployment.';
  end if;
end;
$$;

alter table orders
  add column if not exists stock_enforcement_applied boolean;

update orders
set stock_enforcement_applied = true
where stock_enforcement_applied is null;

alter table orders
  alter column stock_enforcement_applied set default true,
  alter column stock_enforcement_applied set not null;

comment on column orders.stock_enforcement_applied is
  'True when stock enforcement applies to the order lifecycle; false for orders created or finalized while global stock enforcement was disabled.';

do $$
declare
  marker_is_required boolean;
  marker_default text;
begin
  select attribute.attnotnull,
         pg_get_expr(default_value.adbin, default_value.adrelid)
    into marker_is_required, marker_default
    from pg_attribute attribute
    left join pg_attrdef default_value
      on default_value.adrelid = attribute.attrelid
     and default_value.adnum = attribute.attnum
   where attribute.attrelid = 'public.orders'::regclass
     and attribute.attname = 'stock_enforcement_applied'
     and not attribute.attisdropped;

  if marker_is_required is not true or lower(coalesce(marker_default, '')) <> 'true' then
    raise exception 'The order stock-enforcement marker was not installed safely.';
  end if;
end;
$$;

commit;
