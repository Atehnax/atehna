-- Atehna additive deployment artifact: preserve administrator-cancelled quote
-- email jobs as durable evidence while removing them from the delivery queue.
--
-- REVIEWED EXECUTION ONLY. Do not run this file from application startup.
-- Apply it after 20260901_quote_optional_acceptance_terms.sql. Take and verify
-- a database backup first. This migration does not rewrite existing jobs.

begin;

set local search_path = public, pg_temp;
set local lock_timeout = '10s';
set local statement_timeout = '15min';
select pg_advisory_xact_lock(hashtext('atehna-quote-email-cancellation-v1'));

do $$
declare
  installed_constraint_oid oid;
  installed_constraint_definition text;
  required_status text;
begin
  if to_regclass('public.quote_email_jobs') is null then
    raise exception 'Apply and verify the quote workflow deployment before this deployment.';
  end if;

  select installed_constraint.oid,
         lower(pg_get_constraintdef(installed_constraint.oid, true))
  into installed_constraint_oid, installed_constraint_definition
  from pg_constraint installed_constraint
  join pg_class constrained_table
    on constrained_table.oid = installed_constraint.conrelid
  join pg_namespace constrained_schema
    on constrained_schema.oid = constrained_table.relnamespace
  where constrained_schema.nspname = 'public'
    and constrained_table.relname = 'quote_email_jobs'
    and installed_constraint.conname = 'quote_email_jobs_status_check'
    and installed_constraint.contype = 'c'
    and installed_constraint.convalidated = true;

  if installed_constraint_oid is null then
    raise exception 'The expected quote email job status constraint is missing.';
  end if;

  foreach required_status in array array['pending', 'processing', 'sent', 'failed'] loop
    if position(required_status in installed_constraint_definition) = 0 then
      raise exception 'The quote email job status constraint has schema drift: missing %.', required_status;
    end if;
  end loop;

  if position('cancelled' in installed_constraint_definition) > 0 then
    raise exception 'The quote email job cancellation status is already installed.';
  end if;
end;
$$;

lock table quote_email_jobs in share row exclusive mode;

alter table quote_email_jobs
  add column cancelled_at timestamptz,
  add column cancelled_by_actor_id text,
  drop constraint quote_email_jobs_status_check,
  add constraint quote_email_jobs_status_check check (
    status in ('pending', 'processing', 'sent', 'failed', 'cancelled')
  ),
  add constraint quote_email_jobs_cancellation_check check (
    (
      status = 'cancelled'
      and cancelled_at is not null
      and cancelled_by_actor_id is not null
      and btrim(cancelled_by_actor_id) <> ''
    )
    or (
      status <> 'cancelled'
      and cancelled_at is null
      and cancelled_by_actor_id is null
    )
  );

do $$
declare
  installed_constraint_definition text;
  cancellation_constraint_definition text;
  required_status text;
begin
  select lower(pg_get_constraintdef(installed_constraint.oid, true))
  into installed_constraint_definition
  from pg_constraint installed_constraint
  join pg_class constrained_table
    on constrained_table.oid = installed_constraint.conrelid
  join pg_namespace constrained_schema
    on constrained_schema.oid = constrained_table.relnamespace
  where constrained_schema.nspname = 'public'
    and constrained_table.relname = 'quote_email_jobs'
    and installed_constraint.conname = 'quote_email_jobs_status_check'
    and installed_constraint.contype = 'c'
    and installed_constraint.convalidated = true;

  if installed_constraint_definition is null then
    raise exception 'The quote email job cancellation constraint is missing.';
  end if;

  foreach required_status in array array['pending', 'processing', 'sent', 'failed', 'cancelled'] loop
    if position(required_status in installed_constraint_definition) = 0 then
      raise exception 'The quote email job cancellation constraint is incomplete: missing %.', required_status;
    end if;
  end loop;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'quote_email_jobs'
      and column_name = 'cancelled_at'
      and data_type = 'timestamp with time zone'
  ) then
    raise exception 'The quote email job cancelled_at evidence column is missing.';
  end if;

  if not exists (
    select 1
    from pg_constraint installed_constraint
    join pg_class constrained_table
      on constrained_table.oid = installed_constraint.conrelid
    join pg_namespace constrained_schema
      on constrained_schema.oid = constrained_table.relnamespace
    where constrained_schema.nspname = 'public'
      and constrained_table.relname = 'quote_email_jobs'
      and installed_constraint.conname = 'quote_email_jobs_cancellation_check'
      and installed_constraint.contype = 'c'
      and installed_constraint.convalidated = true
  ) then
    raise exception 'The quote email job cancellation evidence constraint is missing.';
  end if;

  select lower(pg_get_constraintdef(installed_constraint.oid, true))
  into cancellation_constraint_definition
  from pg_constraint installed_constraint
  join pg_class constrained_table
    on constrained_table.oid = installed_constraint.conrelid
  join pg_namespace constrained_schema
    on constrained_schema.oid = constrained_table.relnamespace
  where constrained_schema.nspname = 'public'
    and constrained_table.relname = 'quote_email_jobs'
    and installed_constraint.conname = 'quote_email_jobs_cancellation_check'
    and installed_constraint.contype = 'c'
    and installed_constraint.convalidated = true;

  if position('cancelled_by_actor_id is not null' in cancellation_constraint_definition) = 0
    or position('btrim(cancelled_by_actor_id)' in cancellation_constraint_definition) = 0 then
    raise exception 'The quote email job cancellation actor evidence constraint is incomplete.';
  end if;
end;
$$;

commit;
