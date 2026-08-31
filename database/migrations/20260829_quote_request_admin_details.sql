-- Atehna additive deployment artifact: editable pre-issue quote-request details.
--
-- REVIEWED EXECUTION ONLY. Do not run this file from application startup.
-- Apply it once, in a maintenance window, only after the reviewed
-- 20260828_quote_workflow_and_order_contract.sql deployment has completed.
-- Take and verify a database backup first. This script changes guards and an
-- event-type constraint; it does not rewrite quote, offer, order, or stock data.

begin;

set local search_path = public, pg_temp;
set local lock_timeout = '10s';
set local statement_timeout = '15min';
select pg_advisory_xact_lock(hashtext('atehna-quote-workflow-contract-v1'));

do $$
declare
  guard_definition text;
begin
  if to_regclass('public.quote_requests') is null
    or to_regclass('public.quote_offer_versions') is null
    or to_regclass('public.quote_events') is null
  then
    raise exception 'Apply and verify 20260828_quote_workflow_and_order_contract.sql before this deployment.';
  end if;

  if exists (
    select 1
    from (
      values
        ('quote_requests', 'id'),
        ('quote_requests', 'status'),
        ('quote_requests', 'customer_type'),
        ('quote_requests', 'organization_name'),
        ('quote_requests', 'contact_name'),
        ('quote_requests', 'email'),
        ('quote_requests', 'address_line1'),
        ('quote_requests', 'address_line2'),
        ('quote_requests', 'city'),
        ('quote_requests', 'postal_code'),
        ('quote_requests', 'country_code'),
        ('quote_requests', 'gurs_house_number_id'),
        ('quote_requests', 'reference'),
        ('quote_requests', 'quote_reason'),
        ('quote_requests', 'customer_message'),
        ('quote_requests', 'billing_snapshot_json'),
        ('quote_requests', 'state_version'),
        ('quote_offer_versions', 'quote_request_id'),
        ('quote_offer_versions', 'status'),
        ('quote_offer_versions', 'is_current'),
        ('quote_events', 'event_type')
    ) as required_column(table_name, column_name)
    where not exists (
      select 1
      from information_schema.columns installed_column
      where installed_column.table_schema = 'public'
        and installed_column.table_name = required_column.table_name
        and installed_column.column_name = required_column.column_name
    )
  ) then
    raise exception 'The installed quote workflow does not match the expected 20260828 schema.';
  end if;

  if not exists (
    select 1
    from pg_constraint installed_constraint
    join pg_class constrained_table
      on constrained_table.oid = installed_constraint.conrelid
    join pg_namespace constrained_schema
      on constrained_schema.oid = constrained_table.relnamespace
    where constrained_schema.nspname = 'public'
      and constrained_table.relname = 'quote_events'
      and installed_constraint.conname = 'quote_events_event_type_check'
      and installed_constraint.contype = 'c'
      and installed_constraint.convalidated = true
  ) then
    raise exception 'The expected validated quote-events constraint is missing.';
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
    or position('The submitted quote-request snapshot is immutable.' in guard_definition) = 0
  then
    raise exception 'The installed quote-request guard is not the expected 20260828 version.';
  end if;

  if position('admin_details_changed' in guard_definition) > 0 then
    raise exception 'The 20260829 quote-request admin-details deployment is already installed.';
  end if;
end;
$$;

lock table quote_requests, quote_offer_versions, quote_events
  in share row exclusive mode;

create or replace function guard_quote_request_history()
returns trigger
language plpgsql
as $$
declare
  admin_details_changed boolean;
begin
  if tg_op = 'DELETE' then
    raise exception 'Quote requests are durable records and cannot be deleted.';
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
          'state_version',
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
          'state_version',
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

alter table quote_events
  drop constraint quote_events_event_type_check;

alter table quote_events
  add constraint quote_events_event_type_check check (
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
      'admin_purchase_order_validated',
      'admin_purchase_order_rejected',
      'offer_withdrawn',
      'offer_expired',
      'offer_superseded',
      'new_version_issued',
      'request_closed_without_offer',
      'order_created'
    )
  );

do $$
declare
  event_constraint_definition text;
  guard_definition text;
begin
  select pg_get_functiondef(to_regprocedure('public.guard_quote_request_history()'))
  into guard_definition;

  if guard_definition is null
    or position('admin_details_changed' in guard_definition) = 0
    or position('Customer details on a current issued offer are immutable.' in guard_definition) = 0
  then
    raise exception 'The quote-request admin-details guard was not installed as expected.';
  end if;

  select pg_get_constraintdef(installed_constraint.oid, true)
  into event_constraint_definition
  from pg_constraint installed_constraint
  join pg_class constrained_table
    on constrained_table.oid = installed_constraint.conrelid
  join pg_namespace constrained_schema
    on constrained_schema.oid = constrained_table.relnamespace
  where constrained_schema.nspname = 'public'
    and constrained_table.relname = 'quote_events'
    and installed_constraint.conname = 'quote_events_event_type_check'
    and installed_constraint.contype = 'c'
    and installed_constraint.convalidated = true;

  if event_constraint_definition is null
    or position('quote_request_details_changed' in event_constraint_definition) = 0
  then
    raise exception 'The quote-request details event constraint was not installed as expected.';
  end if;
end;
$$;

commit;
