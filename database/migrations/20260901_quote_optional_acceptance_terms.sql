-- Atehna additive deployment artifact: allow issued quote offers to omit the
-- optional free-text acceptance terms while preserving their versioned content
-- and integrity evidence.
--
-- REVIEWED EXECUTION ONLY. Do not run this file from application startup.
-- Apply it after 20260831_order_item_delivery_plan.sql. Take and verify a
-- database backup first. This migration only relaxes the issued-offer identity
-- check; it does not rewrite quote, offer, document, event, order, customer,
-- payment, inventory, or delivery evidence.

begin;

set local search_path = public, pg_temp;
set local lock_timeout = '10s';
set local statement_timeout = '15min';
select pg_advisory_xact_lock(hashtext('atehna-quote-workflow-contract-v1'));

do $$
declare
  installed_constraint_oid oid;
  installed_constraint_definition text;
  required_fragment text;
begin
  if to_regclass('public.quote_offer_versions') is null then
    raise exception 'Apply and verify the quote workflow deployment before this deployment.';
  end if;

  select installed_constraint.oid,
         lower(regexp_replace(
           pg_get_constraintdef(installed_constraint.oid, true),
           '\s+',
           ' ',
           'g'
         ))
  into installed_constraint_oid, installed_constraint_definition
  from pg_constraint installed_constraint
  join pg_class constrained_table
    on constrained_table.oid = installed_constraint.conrelid
  join pg_namespace constrained_schema
    on constrained_schema.oid = constrained_table.relnamespace
  where constrained_schema.nspname = 'public'
    and constrained_table.relname = 'quote_offer_versions'
    and installed_constraint.conname = 'quote_offer_versions_issue_identity_check'
    and installed_constraint.contype = 'c'
    and installed_constraint.convalidated = true;

  if installed_constraint_oid is null then
    raise exception 'The expected quote-offer issue identity constraint is missing or incompatible.';
  end if;

  foreach required_fragment in array array[
    'offer_number',
    'issued_at',
    'issued_by_actor_type',
    'valid_until',
    'customer_snapshot_json',
    'content_snapshot_json',
    'btrim(delivery_terms)',
    'btrim(payment_terms)',
    'btrim(terms_version)',
    'terms_hash',
    'content_hash'
  ] loop
    if position(required_fragment in installed_constraint_definition) = 0 then
      raise exception
        'The quote-offer issue identity constraint has schema drift: missing %.',
        required_fragment;
    end if;
  end loop;

  if position('terms_text' in installed_constraint_definition) > 0
     and position('btrim(terms_text)' in installed_constraint_definition) = 0
  then
    raise exception
      'The quote-offer issue identity constraint has an unexpected terms_text rule.';
  end if;
end;
$$;

lock table quote_offer_versions in share row exclusive mode;

alter table quote_offer_versions
  drop constraint quote_offer_versions_issue_identity_check,
  add constraint quote_offer_versions_issue_identity_check check (
    (
      status = 'draft'
      and offer_number is null
      and issued_at is null
      and issued_by_actor_type is null
      and issued_by_actor_id is null
      and is_current = false
    )
    or (
      status <> 'draft'
      and offer_number is not null
      and issued_at is not null
      and issued_by_actor_type is not null
      and valid_until is not null
      and valid_until > issued_at
      and customer_snapshot_json <> '{}'::jsonb
      and content_snapshot_json <> '{}'::jsonb
      and nullif(btrim(delivery_terms), '') is not null
      and nullif(btrim(payment_terms), '') is not null
      and nullif(btrim(terms_version), '') is not null
      and terms_hash is not null
      and content_hash is not null
    )
  );

do $$
declare
  installed_constraint_oid oid;
  installed_constraint_definition text;
  required_fragment text;
begin
  select installed_constraint.oid,
         lower(regexp_replace(
           pg_get_constraintdef(installed_constraint.oid, true),
           '\s+',
           ' ',
           'g'
         ))
  into installed_constraint_oid, installed_constraint_definition
  from pg_constraint installed_constraint
  join pg_class constrained_table
    on constrained_table.oid = installed_constraint.conrelid
  join pg_namespace constrained_schema
    on constrained_schema.oid = constrained_table.relnamespace
  where constrained_schema.nspname = 'public'
    and constrained_table.relname = 'quote_offer_versions'
    and installed_constraint.conname = 'quote_offer_versions_issue_identity_check'
    and installed_constraint.contype = 'c'
    and installed_constraint.convalidated = true;

  if installed_constraint_oid is null then
    raise exception 'The optional quote acceptance-terms constraint is missing.';
  end if;

  if position('terms_text' in installed_constraint_definition) > 0 then
    raise exception 'The quote-offer issue identity constraint still requires terms_text.';
  end if;

  foreach required_fragment in array array[
    'offer_number',
    'issued_at',
    'issued_by_actor_type',
    'valid_until',
    'customer_snapshot_json',
    'content_snapshot_json',
    'btrim(delivery_terms)',
    'btrim(payment_terms)',
    'btrim(terms_version)',
    'terms_hash',
    'content_hash'
  ] loop
    if position(required_fragment in installed_constraint_definition) = 0 then
      raise exception
        'The optional quote acceptance-terms constraint is incomplete: missing %.',
        required_fragment;
    end if;
  end loop;
end;
$$;

commit;
