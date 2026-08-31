-- Atehna additive deployment artifact: explicit per-line delivery planning and revision guards.
--
-- REVIEWED EXECUTION ONLY. Do not run this file from application startup.
-- Apply after the current production schema has been backed up and verified.
-- Existing order lines and documents start at revision 1.

begin;

set local search_path = public, pg_temp;
set local lock_timeout = '10s';
set local statement_timeout = '15min';
select pg_advisory_xact_lock(hashtext('atehna-order-item-delivery-plan-v2'));

do $$
begin
  if to_regclass('public.orders') is null
     or to_regclass('public.order_items') is null
     or to_regclass('public.order_documents') is null then
    raise exception 'The canonical orders, order_items, and order_documents tables are required.';
  end if;
end;
$$;

lock table orders, order_items, order_documents in share row exclusive mode;

alter table orders
  add column if not exists delivery_plan_revision integer not null default 1;

alter table order_items
  add column if not exists ship_later boolean not null default false;

alter table order_documents
  add column if not exists order_delivery_plan_revision integer not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_delivery_plan_revision_positive_check'
  ) then
    alter table orders
      add constraint orders_delivery_plan_revision_positive_check
      check (delivery_plan_revision > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.order_documents'::regclass
      and conname = 'order_documents_delivery_plan_revision_positive_check'
  ) then
    alter table order_documents
      add constraint order_documents_delivery_plan_revision_positive_check
      check (order_delivery_plan_revision > 0);
  end if;
end;
$$;

create index if not exists idx_order_items_order_id_ship_later
  on order_items(order_id, ship_later, id);

do $$
declare
  order_revision_definition text;
  item_definition text;
  item_default text;
  document_revision_definition text;
begin
  select data_type || ':' || is_nullable
  into order_revision_definition
  from information_schema.columns
  where table_schema = 'public' and table_name = 'orders'
    and column_name = 'delivery_plan_revision';

  select data_type || ':' || is_nullable, column_default
  into item_definition, item_default
  from information_schema.columns
  where table_schema = 'public' and table_name = 'order_items'
    and column_name = 'ship_later';

  select data_type || ':' || is_nullable
  into document_revision_definition
  from information_schema.columns
  where table_schema = 'public' and table_name = 'order_documents'
    and column_name = 'order_delivery_plan_revision';

  if order_revision_definition is distinct from 'integer:NO' then
    raise exception 'orders.delivery_plan_revision was not installed as non-nullable integer.';
  end if;
  if item_definition is distinct from 'boolean:NO'
     or item_default is null
     or position('false' in lower(item_default)) = 0 then
    raise exception 'order_items.ship_later was not installed with the required definition.';
  end if;
  if document_revision_definition is distinct from 'integer:NO' then
    raise exception 'order_documents.order_delivery_plan_revision was not installed as non-nullable integer.';
  end if;
  if exists (select 1 from orders where delivery_plan_revision < 1)
     or exists (select 1 from order_documents where order_delivery_plan_revision < 1)
     or exists (select 1 from order_items where ship_later is null) then
    raise exception 'Delivery-plan migration verification failed.';
  end if;
end;
$$;

commit;
