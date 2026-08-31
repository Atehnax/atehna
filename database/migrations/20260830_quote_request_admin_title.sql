-- Atehna additive deployment artifact: a separate internal display title for
-- quote requests while preserving the immutable commercial request number.
--
-- REVIEWED EXECUTION ONLY. Do not run this file from application startup.
-- Apply it after 20260829_quote_request_management.sql. Take and verify a
-- database backup first. This migration does not rewrite request numbers or
-- any quote, offer, document, event, acceptance, access, order, or stock data.

begin;

set local search_path = public, pg_temp;
set local lock_timeout = '10s';
set local statement_timeout = '15min';
select pg_advisory_xact_lock(hashtext('atehna-quote-workflow-contract-v1'));

do $$
declare
  guard_definition text;
begin
  if exists (
    select 1
    from (
      values
        ('orders', 'source_quote_offer_version_id'),
        ('quote_requests', 'id'),
        ('quote_requests', 'request_number'),
        ('quote_requests', 'status'),
        ('quote_requests', 'state_version'),
        ('quote_requests', 'admin_notes'),
        ('quote_requests', 'intake_source'),
        ('quote_requests', 'voided_at'),
        ('quote_requests', 'voided_by_actor_id'),
        ('quote_requests', 'void_reason'),
        ('quote_offer_versions', 'id'),
        ('quote_offer_versions', 'quote_request_id'),
        ('quote_offer_versions', 'status'),
        ('quote_offer_acceptances', 'quote_offer_version_id'),
        ('quote_documents', 'quote_offer_version_id'),
        ('quote_document_jobs', 'quote_offer_version_id')
    ) as required_column(table_name, column_name)
    where not exists (
      select 1
      from information_schema.columns installed_column
      where installed_column.table_schema = 'public'
        and installed_column.table_name = required_column.table_name
        and installed_column.column_name = required_column.column_name
    )
  ) then
    raise exception 'Apply and verify the quote-request management deployment before this deployment.';
  end if;

  if not exists (
    select 1
    from pg_trigger installed_trigger
    join pg_class guarded_table
      on guarded_table.oid = installed_trigger.tgrelid
    join pg_namespace guarded_schema
      on guarded_schema.oid = guarded_table.relnamespace
    join pg_proc guard_function
      on guard_function.oid = installed_trigger.tgfoid
    join pg_namespace guard_schema
      on guard_schema.oid = guard_function.pronamespace
    where guarded_schema.nspname = 'public'
      and guarded_table.relname = 'quote_requests'
      and installed_trigger.tgname = 'quote_requests_guard_history'
      and installed_trigger.tgenabled <> 'D'
      and installed_trigger.tgisinternal = false
      and guard_schema.nspname = 'public'
      and guard_function.proname = 'guard_quote_request_history'
  ) then
    raise exception 'The expected quote-request history guard is missing or disabled.';
  end if;

  select pg_get_functiondef(to_regprocedure('public.guard_quote_request_history()'))
  into guard_definition;

  if guard_definition is null
    or position('admin_details_changed' in guard_definition) = 0
    or position('Voided quote requests are immutable.' in guard_definition) = 0
    or position('Non-test quote requests with commercial history cannot be voided.' in guard_definition) = 0
    or position('purchase-order evidence' in guard_definition) = 0
    or position('quote_document_jobs' in guard_definition) = 0
    or position('source_quote_offer_version_id' in guard_definition) = 0
  then
    raise exception 'Apply and verify 20260829_quote_request_management.sql before this deployment.';
  end if;
end;
$$;

lock table
  orders,
  quote_requests,
  quote_offer_versions,
  quote_offer_acceptances,
  quote_documents,
  quote_document_jobs
in share row exclusive mode;

alter table quote_requests
  add column if not exists admin_title text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint installed_constraint
    join pg_class constrained_table
      on constrained_table.oid = installed_constraint.conrelid
    join pg_namespace constrained_schema
      on constrained_schema.oid = constrained_table.relnamespace
    where constrained_schema.nspname = 'public'
      and constrained_table.relname = 'quote_requests'
      and installed_constraint.conname = 'quote_requests_admin_title_check'
  ) then
    alter table quote_requests
      add constraint quote_requests_admin_title_check check (
        admin_title is null
        or (
          nullif(btrim(admin_title), '') is not null
          and char_length(admin_title) <= 240
        )
      );
  elsif not exists (
    select 1
    from pg_constraint installed_constraint
    join pg_class constrained_table
      on constrained_table.oid = installed_constraint.conrelid
    join pg_namespace constrained_schema
      on constrained_schema.oid = constrained_table.relnamespace
    where constrained_schema.nspname = 'public'
      and constrained_table.relname = 'quote_requests'
      and installed_constraint.conname = 'quote_requests_admin_title_check'
      and installed_constraint.contype = 'c'
      and installed_constraint.convalidated = true
      and position('admin_title' in pg_get_constraintdef(installed_constraint.oid, true)) > 0
      and position('btrim' in pg_get_constraintdef(installed_constraint.oid, true)) > 0
      and position('240' in pg_get_constraintdef(installed_constraint.oid, true)) > 0
  ) then
    raise exception 'The existing quote_requests_admin_title_check constraint is incompatible.';
  end if;
end;
$$;

create or replace function guard_quote_request_history()
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
do $$
declare
  admin_title_definition text;
  guard_definition text;
begin
  select
    installed_column.data_type || ':' || installed_column.is_nullable
  into admin_title_definition
  from information_schema.columns installed_column
  where installed_column.table_schema = 'public'
    and installed_column.table_name = 'quote_requests'
    and installed_column.column_name = 'admin_title';

  if admin_title_definition is distinct from 'text:YES' then
    raise exception 'The quote-request admin title column was not installed as nullable text.';
  end if;

  if not exists (
    select 1
    from pg_constraint installed_constraint
    join pg_class constrained_table
      on constrained_table.oid = installed_constraint.conrelid
    join pg_namespace constrained_schema
      on constrained_schema.oid = constrained_table.relnamespace
    where constrained_schema.nspname = 'public'
      and constrained_table.relname = 'quote_requests'
      and installed_constraint.conname = 'quote_requests_admin_title_check'
      and installed_constraint.contype = 'c'
      and installed_constraint.convalidated = true
      and position('admin_title' in pg_get_constraintdef(installed_constraint.oid, true)) > 0
      and position('btrim' in pg_get_constraintdef(installed_constraint.oid, true)) > 0
      and position('240' in pg_get_constraintdef(installed_constraint.oid, true)) > 0
  ) then
    raise exception 'The quote-request admin title constraint was not installed as expected.';
  end if;

  select pg_get_functiondef(to_regprocedure('public.guard_quote_request_history()'))
  into guard_definition;

  if guard_definition is null
    or (
      length(guard_definition)
      - length(replace(guard_definition, '''admin_title''', ''))
    ) / length('''admin_title''') < 2
    or position('new.admin_title is distinct from old.admin_title' in guard_definition) > 0
    or position('''request_number''' in guard_definition) > 0
    or position('Voided quote requests are immutable.' in guard_definition) = 0
    or position('Non-test quote requests with commercial history cannot be voided.' in guard_definition) = 0
    or position('quote_document_jobs' in guard_definition) = 0
    or position('source_quote_offer_version_id' in guard_definition) = 0
  then
    raise exception 'The quote-request history guard was not installed as expected.';
  end if;

  if not exists (
    select 1
    from pg_trigger installed_trigger
    join pg_class guarded_table
      on guarded_table.oid = installed_trigger.tgrelid
    join pg_namespace guarded_schema
      on guarded_schema.oid = guarded_table.relnamespace
    join pg_proc guard_function
      on guard_function.oid = installed_trigger.tgfoid
    join pg_namespace guard_schema
      on guard_schema.oid = guard_function.pronamespace
    where guarded_schema.nspname = 'public'
      and guarded_table.relname = 'quote_requests'
      and installed_trigger.tgname = 'quote_requests_guard_history'
      and installed_trigger.tgenabled <> 'D'
      and installed_trigger.tgisinternal = false
      and guard_schema.nspname = 'public'
      and guard_function.proname = 'guard_quote_request_history'
  ) then
    raise exception 'The quote-request history guard is missing or disabled.';
  end if;
end;
$$;

commit;
