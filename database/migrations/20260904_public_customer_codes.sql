-- Add opaque, immutable customer-facing code bases to quote and order journeys.
-- Existing quote-to-order conversions retain one shared base; internal serials
-- and statutory document numbers remain unchanged.

begin;

set local search_path = public, pg_temp;
set local lock_timeout = '10s';
set local statement_timeout = '15min';

select pg_advisory_xact_lock(hashtext('atehna:public-customer-codes:v1'));

do $guard$
begin
  if not exists (
    select 1 from pg_extension where extname = 'pgcrypto'
  ) then
    raise exception 'The pgcrypto extension is required.';
  end if;
  if to_regclass('public.orders') is null
     or to_regclass('public.quote_requests') is null
     or to_regclass('public.quote_offer_versions') is null then
    raise exception 'Canonical order and quote tables are required.';
  end if;
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name in ('orders', 'quote_requests')
       and column_name = 'public_code_base'
  ) then
    raise exception 'A public_code_base column already exists; refusing an ambiguous partial installation.';
  end if;
  if to_regprocedure('public.generate_public_code_base()') is not null
     or to_regprocedure('public.guard_public_code_base_immutable()') is not null
     or to_regprocedure('public.guard_order_public_code_lineage()') is not null
     or to_regprocedure('public.guard_quote_public_code_namespace()') is not null then
    raise exception 'A public customer-code function already exists; refusing an ambiguous partial installation.';
  end if;
  if not exists (
    select 1
      from pg_trigger trigger_record
      join pg_class relation on relation.oid = trigger_record.tgrelid
      join pg_namespace namespace on namespace.oid = relation.relnamespace
     where namespace.nspname = 'public'
       and relation.relname = 'quote_requests'
       and trigger_record.tgname = 'quote_requests_guard_history'
       and trigger_record.tgenabled = 'O'
       and not trigger_record.tgisinternal
  ) then
    raise exception 'The enabled quote-request history guard is required.';
  end if;
end;
$guard$;

lock table public.quote_requests,
  public.quote_offer_versions,
  public.orders in share row exclusive mode;

create function public.generate_public_code_base()
returns text
language plpgsql
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  generated text := '';
  random_chunk bytea;
  byte_index integer;
  byte_value integer;
begin
  while char_length(generated) < 16 loop
    random_chunk := public.gen_random_bytes(16);
    for byte_index in 0..length(random_chunk) - 1 loop
      byte_value := get_byte(random_chunk, byte_index);
      if byte_value < 240 then
        generated := generated
          || substr(alphabet, (byte_value % 30) + 1, 1);
        exit when char_length(generated) = 16;
      end if;
    end loop;
  end loop;
  return generated;
end;
$$;

alter table public.orders add column public_code_base text;
alter table public.quote_requests add column public_code_base text;

-- The existing history guard correctly treats all unlisted fields as immutable.
-- It is disabled only while this transaction initializes the new field. The
-- table lock prevents concurrent quote writes, and rollback restores the guard
-- automatically if any later postcondition fails.
alter table public.quote_requests disable trigger quote_requests_guard_history;

do $backfill_quote_codes$
declare
  target_id bigint;
  candidate text;
  attempts integer;
begin
  for target_id in
    select id from public.quote_requests order by id
  loop
    attempts := 0;
    loop
      attempts := attempts + 1;
      if attempts > 100 then
        raise exception 'Could not allocate a unique quote public-code base.';
      end if;
      candidate := public.generate_public_code_base();
      exit when not exists (
        select 1
          from public.quote_requests request
         where request.public_code_base = candidate
      ) and not exists (
        select 1
          from public.orders customer_order
         where customer_order.public_code_base = candidate
      );
    end loop;

    update public.quote_requests
       set public_code_base = candidate
     where id = target_id;
  end loop;
end;
$backfill_quote_codes$;

alter table public.quote_requests enable trigger quote_requests_guard_history;

do $quote_order_lineage_guard$
declare
  invalid_quote_ids text[];
begin
  select array_agg(duplicate.quote_request_id::text order by duplicate.quote_request_id)
    into invalid_quote_ids
    from (
      select offer.quote_request_id
        from public.orders customer_order
        join public.quote_offer_versions offer
          on offer.id = customer_order.source_quote_offer_version_id
       group by offer.quote_request_id
      having count(*) > 1
    ) duplicate;

  if invalid_quote_ids is not null then
    raise exception 'Multiple orders are linked to quote requests: %. Reconcile them before installing public codes.',
      array_to_string(invalid_quote_ids, ', ');
  end if;
end;
$quote_order_lineage_guard$;

update public.orders customer_order
   set public_code_base = request.public_code_base
  from public.quote_offer_versions offer
  join public.quote_requests request on request.id = offer.quote_request_id
 where customer_order.source_quote_offer_version_id = offer.id;

do $backfill_direct_order_codes$
declare
  target_id bigint;
  candidate text;
  attempts integer;
begin
  for target_id in
    select id
      from public.orders
     where public_code_base is null
     order by id
  loop
    attempts := 0;
    loop
      attempts := attempts + 1;
      if attempts > 100 then
        raise exception 'Could not allocate a unique order public-code base.';
      end if;
      candidate := public.generate_public_code_base();
      exit when not exists (
        select 1
          from public.orders customer_order
         where customer_order.public_code_base = candidate
      ) and not exists (
        select 1
          from public.quote_requests request
         where request.public_code_base = candidate
      );
    end loop;

    update public.orders
       set public_code_base = candidate
     where id = target_id;
  end loop;
end;
$backfill_direct_order_codes$;

do $backfill_verification$
begin
  if exists (
    select 1
      from public.orders
     where public_code_base is null
        or public_code_base !~ '^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{16}$'
  ) or exists (
    select 1
      from public.quote_requests
     where public_code_base is null
        or public_code_base !~ '^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{16}$'
  ) then
    raise exception 'Public customer-code backfill produced a missing or invalid base.';
  end if;
  if exists (
    select public_code_base
      from public.orders
     group by public_code_base
    having count(*) > 1
  ) or exists (
    select public_code_base
      from public.quote_requests
     group by public_code_base
    having count(*) > 1
  ) then
    raise exception 'Public customer-code backfill produced a duplicate base.';
  end if;
  if exists (
    select 1
      from public.orders customer_order
      join public.quote_offer_versions offer
        on offer.id = customer_order.source_quote_offer_version_id
      join public.quote_requests request on request.id = offer.quote_request_id
     where customer_order.public_code_base is distinct from request.public_code_base
  ) then
    raise exception 'A converted order did not retain its quote public-code base.';
  end if;
end;
$backfill_verification$;

alter table public.orders
  alter column public_code_base set default public.generate_public_code_base(),
  alter column public_code_base set not null,
  add constraint orders_public_code_base_check check (
    public_code_base ~ '^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{16}$'
  );

alter table public.quote_requests
  alter column public_code_base set default public.generate_public_code_base(),
  alter column public_code_base set not null,
  add constraint quote_requests_public_code_base_check check (
    public_code_base ~ '^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{16}$'
  );

create unique index idx_orders_public_code_base
  on public.orders(public_code_base);
create unique index idx_quote_requests_public_code_base
  on public.quote_requests(public_code_base);

create function public.guard_public_code_base_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.public_code_base is distinct from old.public_code_base then
    raise exception 'Public customer-code bases are immutable.';
  end if;
  return new;
end;
$$;

create function public.guard_order_public_code_lineage()
returns trigger
language plpgsql
as $$
declare
  quote_public_code_base text;
begin
  if tg_op = 'UPDATE'
     and new.source_quote_offer_version_id is distinct from old.source_quote_offer_version_id then
    raise exception 'An order quote-source link is immutable.';
  end if;

  if new.source_quote_offer_version_id is not null then
    select request.public_code_base
      into quote_public_code_base
      from public.quote_offer_versions offer
      join public.quote_requests request on request.id = offer.quote_request_id
     where offer.id = new.source_quote_offer_version_id;

    if not found then
      raise exception 'The source quote offer does not exist.';
    end if;

    if tg_op = 'INSERT' then
      new.public_code_base := quote_public_code_base;
    elsif new.public_code_base is distinct from quote_public_code_base then
      raise exception 'A converted order must retain its quote public-code base.';
    end if;

    perform pg_advisory_xact_lock(
      hashtextextended(
        'atehna:public-customer-code:' || quote_public_code_base,
        0
      )
    );

    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('atehna:public-customer-code:' || new.public_code_base, 0)
  );

  if exists (
    select 1
      from public.quote_requests request
     where request.public_code_base = new.public_code_base
  ) then
    return null;
  end if;

  return new;
end;
$$;

create function public.guard_quote_public_code_namespace()
returns trigger
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended('atehna:public-customer-code:' || new.public_code_base, 0)
  );

  if exists (
    select 1
      from public.orders customer_order
     where customer_order.public_code_base = new.public_code_base
  ) then
    return null;
  end if;

  return new;
end;
$$;

create trigger orders_guard_public_code_immutable
before update of public_code_base on public.orders
for each row execute function public.guard_public_code_base_immutable();

create trigger orders_guard_public_code_lineage
before insert or update of public_code_base, source_quote_offer_version_id
on public.orders
for each row execute function public.guard_order_public_code_lineage();

create trigger quote_requests_guard_public_code_immutable
before update of public_code_base on public.quote_requests
for each row execute function public.guard_public_code_base_immutable();

create trigger quote_requests_guard_public_code_namespace
before insert on public.quote_requests
for each row execute function public.guard_quote_public_code_namespace();

do $verify$
declare
  invalid_objects text[];
begin
  select array_agg(required.object_name order by required.object_name)
    into invalid_objects
    from (
      values
        ('orders.public_code_base'),
        ('quote_requests.public_code_base')
    ) required(object_name)
   where not exists (
     select 1
       from information_schema.columns installed
      where installed.table_schema = 'public'
        and installed.table_name = split_part(required.object_name, '.', 1)
        and installed.column_name = split_part(required.object_name, '.', 2)
        and installed.data_type = 'text'
        and installed.is_nullable = 'NO'
        and installed.column_default = 'generate_public_code_base()'
   );
  if invalid_objects is not null then
    raise exception 'Missing or incompatible public-code columns: %',
      array_to_string(invalid_objects, ', ');
  end if;

  select array_agg(required.object_name order by required.object_name)
    into invalid_objects
    from (
      values
        ('orders.orders_public_code_base_check'),
        ('quote_requests.quote_requests_public_code_base_check')
    ) required(object_name)
   where not exists (
     select 1
       from pg_constraint installed
       join pg_class relation on relation.oid = installed.conrelid
       join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = split_part(required.object_name, '.', 1)
        and installed.conname = split_part(required.object_name, '.', 2)
        and installed.contype = 'c'
        and installed.convalidated
   );
  if invalid_objects is not null then
    raise exception 'Missing or invalid public-code constraints: %',
      array_to_string(invalid_objects, ', ');
  end if;

  select array_agg(required.object_name order by required.object_name)
    into invalid_objects
    from (
      values
        ('orders.idx_orders_public_code_base'),
        ('quote_requests.idx_quote_requests_public_code_base')
    ) required(object_name)
   where not exists (
     select 1
       from pg_index installed
       join pg_class index_relation on index_relation.oid = installed.indexrelid
       join pg_class table_relation on table_relation.oid = installed.indrelid
       join pg_namespace namespace on namespace.oid = table_relation.relnamespace
      where namespace.nspname = 'public'
        and table_relation.relname = split_part(required.object_name, '.', 1)
        and index_relation.relname = split_part(required.object_name, '.', 2)
        and installed.indisunique
        and installed.indisvalid
        and installed.indisready
   );
  if invalid_objects is not null then
    raise exception 'Missing or invalid public-code indexes: %',
      array_to_string(invalid_objects, ', ');
  end if;

  select array_agg(required.object_name order by required.object_name)
    into invalid_objects
    from (
      values
        ('orders.orders_guard_public_code_immutable'),
        ('orders.orders_guard_public_code_lineage'),
        ('quote_requests.quote_requests_guard_history'),
        ('quote_requests.quote_requests_guard_public_code_immutable'),
        ('quote_requests.quote_requests_guard_public_code_namespace')
    ) required(object_name)
   where not exists (
     select 1
       from pg_trigger installed
       join pg_class relation on relation.oid = installed.tgrelid
       join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = split_part(required.object_name, '.', 1)
        and installed.tgname = split_part(required.object_name, '.', 2)
        and installed.tgenabled = 'O'
        and not installed.tgisinternal
   );
  if invalid_objects is not null then
    raise exception 'Missing or disabled public-code guards: %',
      array_to_string(invalid_objects, ', ');
  end if;
end;
$verify$;

commit;
