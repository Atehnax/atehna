-- Atehna additive deployment artifact: a first-class clarification email event
-- for administrator quote-request workflows.
--
-- REVIEWED EXECUTION ONLY. Do not run this file from application startup.
-- Apply it after 20260830_quote_request_admin_title.sql. Take and verify a
-- database backup first. This migration changes only the allowed quote-email
-- job event types; it does not rewrite quote, offer, document, event, order,
-- customer, payment, inventory, or delivery evidence.

begin;

set local search_path = public, pg_temp;
set local lock_timeout = '10s';
set local statement_timeout = '15min';
select pg_advisory_xact_lock(hashtext('atehna-quote-workflow-contract-v1'));

do $$
declare
  installed_constraint_oid oid;
  installed_event_types text[];
  predecessor_event_types constant text[] := array[
    'quote_acceptance_blocked_stock',
    'quote_accepted',
    'quote_access_otp',
    'quote_declined',
    'quote_delivery_failed',
    'quote_expired',
    'quote_issued',
    'quote_request_closed',
    'quote_request_submitted',
    'quote_withdrawn'
  ];
  target_event_types constant text[] := array[
    'quote_acceptance_blocked_stock',
    'quote_accepted',
    'quote_access_otp',
    'quote_clarification_requested',
    'quote_declined',
    'quote_delivery_failed',
    'quote_expired',
    'quote_issued',
    'quote_request_closed',
    'quote_request_submitted',
    'quote_withdrawn'
  ];
begin
  if to_regclass('public.quote_requests') is null
    or to_regclass('public.quote_email_settings') is null
    or to_regclass('public.quote_email_jobs') is null
    or to_regclass('public.quote_events') is null
  then
    raise exception 'Apply and verify the quote workflow deployment before this deployment.';
  end if;

  select installed_constraint.oid
  into installed_constraint_oid
  from pg_constraint installed_constraint
  join pg_class constrained_table
    on constrained_table.oid = installed_constraint.conrelid
  join pg_namespace constrained_schema
    on constrained_schema.oid = constrained_table.relnamespace
  where constrained_schema.nspname = 'public'
    and constrained_table.relname = 'quote_email_jobs'
    and installed_constraint.conname = 'quote_email_jobs_event_type_check'
    and installed_constraint.contype = 'c'
    and installed_constraint.convalidated = true;

  if installed_constraint_oid is null then
    raise exception 'The expected quote-email event constraint is missing or incompatible.';
  end if;

  select coalesce(
    array_agg(distinct (captured.matches)[1] order by (captured.matches)[1]),
    array[]::text[]
  )
  into installed_event_types
  from regexp_matches(
    pg_get_constraintdef(installed_constraint_oid, true),
    $pattern$'([^']+)'$pattern$,
    'g'
  ) as captured(matches);

  if installed_event_types is distinct from predecessor_event_types
    and installed_event_types is distinct from target_event_types
  then
    raise exception
      'The quote-email event constraint has schema drift or future event types: %',
      installed_event_types;
  end if;

  if exists (
    select 1
    from quote_email_jobs job
    where job.event_type <> all(target_event_types)
  ) then
    raise exception 'Unexpected quote-email event types exist; review them before this deployment.';
  end if;
end;
$$;

lock table quote_email_jobs in share row exclusive mode;

alter table quote_email_jobs
  drop constraint quote_email_jobs_event_type_check,
  add constraint quote_email_jobs_event_type_check check (
    event_type in (
      'quote_request_submitted',
      'quote_clarification_requested',
      'quote_issued',
      'quote_access_otp',
      'quote_accepted',
      'quote_declined',
      'quote_withdrawn',
      'quote_expired',
      'quote_request_closed',
      'quote_acceptance_blocked_stock',
      'quote_delivery_failed'
    )
  );

do $$
declare
  installed_constraint_oid oid;
  installed_event_types text[];
  target_event_types constant text[] := array[
    'quote_acceptance_blocked_stock',
    'quote_accepted',
    'quote_access_otp',
    'quote_clarification_requested',
    'quote_declined',
    'quote_delivery_failed',
    'quote_expired',
    'quote_issued',
    'quote_request_closed',
    'quote_request_submitted',
    'quote_withdrawn'
  ];
begin
  select installed_constraint.oid
  into installed_constraint_oid
  from pg_constraint installed_constraint
  join pg_class constrained_table
    on constrained_table.oid = installed_constraint.conrelid
  join pg_namespace constrained_schema
    on constrained_schema.oid = constrained_table.relnamespace
  where constrained_schema.nspname = 'public'
    and constrained_table.relname = 'quote_email_jobs'
    and installed_constraint.conname = 'quote_email_jobs_event_type_check'
    and installed_constraint.contype = 'c'
    and installed_constraint.convalidated = true;

  if installed_constraint_oid is null then
    raise exception 'The clarification quote-email event constraint is missing.';
  end if;

  select coalesce(
    array_agg(distinct (captured.matches)[1] order by (captured.matches)[1]),
    array[]::text[]
  )
  into installed_event_types
  from regexp_matches(
    pg_get_constraintdef(installed_constraint_oid, true),
    $pattern$'([^']+)'$pattern$,
    'g'
  ) as captured(matches);

  if installed_event_types is distinct from target_event_types then
    raise exception
      'The clarification quote-email event constraint was not installed as expected: %',
      installed_event_types;
  end if;
end;
$$;

commit;