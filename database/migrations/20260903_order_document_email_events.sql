-- Atehna additive deployment artifact: explicit customer delivery events for
-- generated pro forma invoices and invoices.
--
-- REVIEWED EXECUTION ONLY. Do not run this file from application startup.
-- Apply it after 20260903_gurs_address_prefix_search.sql. Take and verify a
-- database backup first. This migration changes only the allowed order-email
-- event types; it does not rewrite orders, documents, jobs, or delivery evidence.

begin;

set local search_path = public, pg_temp;
set local lock_timeout = '10s';
set local statement_timeout = '15min';
select pg_advisory_xact_lock(hashtext('atehna-order-document-email-events-v1'));

do $$
declare
  installed_constraint_oid oid;
  installed_event_types text[];
  predecessor_event_types constant text[] := array[
    'cancelled',
    'finished',
    'in_progress',
    'order_accepted',
    'order_rejected',
    'order_submitted',
    'partially_sent',
    'received',
    'sent'
  ];
  target_event_types constant text[] := array[
    'cancelled',
    'finished',
    'in_progress',
    'invoice_issued',
    'order_accepted',
    'order_rejected',
    'order_submitted',
    'partially_sent',
    'predracun_issued',
    'received',
    'sent'
  ];
begin
  if to_regclass('public.order_email_jobs') is null then
    raise exception 'Apply and verify the order email outbox deployment before this deployment.';
  end if;

  select installed_constraint.oid
  into installed_constraint_oid
  from pg_constraint installed_constraint
  join pg_class constrained_table
    on constrained_table.oid = installed_constraint.conrelid
  join pg_namespace constrained_schema
    on constrained_schema.oid = constrained_table.relnamespace
  where constrained_schema.nspname = 'public'
    and constrained_table.relname = 'order_email_jobs'
    and installed_constraint.conname = 'order_email_jobs_event_type_check'
    and installed_constraint.contype = 'c'
    and installed_constraint.convalidated = true;

  if installed_constraint_oid is null then
    raise exception 'The expected order-email event constraint is missing or incompatible.';
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
      'The order-email event constraint has schema drift or future event types: %',
      installed_event_types;
  end if;

  if exists (
    select 1
    from order_email_jobs job
    where job.event_type <> all(target_event_types)
  ) then
    raise exception 'Unexpected order-email event types exist; review them before this deployment.';
  end if;
end;
$$;

lock table order_email_jobs in share row exclusive mode;

alter table order_email_jobs
  drop constraint order_email_jobs_event_type_check,
  add constraint order_email_jobs_event_type_check check (
    event_type in (
      'order_submitted',
      'order_accepted',
      'order_rejected',
      'predracun_issued',
      'invoice_issued',
      'received',
      'in_progress',
      'partially_sent',
      'sent',
      'finished',
      'cancelled'
    )
  );

do $$
declare
  installed_constraint_oid oid;
  installed_event_types text[];
  target_event_types constant text[] := array[
    'cancelled',
    'finished',
    'in_progress',
    'invoice_issued',
    'order_accepted',
    'order_rejected',
    'order_submitted',
    'partially_sent',
    'predracun_issued',
    'received',
    'sent'
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
    and constrained_table.relname = 'order_email_jobs'
    and installed_constraint.conname = 'order_email_jobs_event_type_check'
    and installed_constraint.contype = 'c'
    and installed_constraint.convalidated = true;

  if installed_constraint_oid is null then
    raise exception 'The document order-email event constraint is missing.';
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
      'The document order-email event constraint was not installed as expected: %',
      installed_event_types;
  end if;
end;
$$;

commit;
