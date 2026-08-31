-- Atehna additive deployment artifact: administrator-only manual quote PDFs.
--
-- REVIEWED EXECUTION ONLY. Do not run this file from application startup.
-- Apply it after 20260829_quote_request_management.sql. Take and verify a
-- database backup first. The new rows are append-only administrative
-- attachments and never replace immutable quote_documents evidence.

begin;

set local search_path = public, pg_temp;
set local lock_timeout = '10s';
set local statement_timeout = '15min';
select pg_advisory_xact_lock(hashtext('atehna-quote-manual-documents-v1'));

do $$
begin
  if to_regclass('public.quote_requests') is null
    or to_regclass('public.quote_offer_versions') is null
    or to_regclass('public.quote_documents') is null
    or to_regclass('public.quote_events') is null
    or to_regclass('public.quote_documents_id_seq') is null
    or to_regprocedure('public.guard_quote_append_only()') is null
  then
    raise exception 'Apply and verify the quote workflow deployments before this deployment.';
  end if;
end;
$$;

create table if not exists quote_manual_documents (
  id bigint primary key default nextval('quote_documents_id_seq'::regclass),
  quote_request_id bigint not null references quote_requests(id) on delete restrict,
  quote_offer_version_id bigint not null,
  document_type text not null check (
    document_type in ('offer', 'purchase_order')
  ),
  storage_id uuid not null default gen_random_uuid(),
  filename text not null,
  blob_pathname text not null,
  version_number integer not null check (version_number > 0),
  document_number text not null,
  uploaded_at timestamptz not null default now(),
  content_sha256 text not null,
  mime_type text not null default 'application/pdf' check (
    mime_type = 'application/pdf'
  ),
  byte_size bigint not null check (
    byte_size > 0 and byte_size <= 10485760
  ),
  created_by_actor_type text not null default 'admin' check (
    created_by_actor_type = 'admin'
  ),
  created_by_actor_id text,
  created_at timestamptz not null default now(),
  constraint quote_manual_documents_offer_request_fkey
    foreign key (quote_offer_version_id, quote_request_id)
    references quote_offer_versions(id, quote_request_id)
    on delete restrict,
  constraint quote_manual_documents_hash_check check (
    length(content_sha256) = 64
  ),
  unique (storage_id),
  unique (quote_request_id, document_type, version_number)
);

create index if not exists idx_quote_manual_documents_request_created_at
  on quote_manual_documents(quote_request_id, created_at desc);
create index if not exists idx_quote_manual_documents_offer_created_at
  on quote_manual_documents(quote_offer_version_id, created_at desc);

alter table quote_events
  drop constraint if exists quote_events_event_type_check;

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
      'admin_document_uploaded',
      'admin_purchase_order_validated',
      'admin_purchase_order_rejected',
      'offer_withdrawn',
      'offer_expired',
      'offer_superseded',
      'new_version_issued',
      'request_closed_without_offer',
      'request_voided',
      'order_created'
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_trigger installed_trigger
    where installed_trigger.tgrelid = 'public.quote_manual_documents'::regclass
      and installed_trigger.tgname = 'quote_manual_documents_append_only'
      and installed_trigger.tgenabled <> 'D'
      and installed_trigger.tgisinternal = false
  ) then
    create trigger quote_manual_documents_append_only
    before update or delete on quote_manual_documents
    for each row execute function guard_quote_append_only();
  end if;
end;
$$;

do $$
declare
  id_default text;
  event_constraint_definition text;
begin
  if exists (
    select 1
    from (
      values
        ('id'),
        ('quote_request_id'),
        ('quote_offer_version_id'),
        ('document_type'),
        ('storage_id'),
        ('filename'),
        ('blob_pathname'),
        ('version_number'),
        ('document_number'),
        ('uploaded_at'),
        ('content_sha256'),
        ('mime_type'),
        ('byte_size'),
        ('created_by_actor_type'),
        ('created_by_actor_id'),
        ('created_at')
    ) as required_column(column_name)
    where not exists (
      select 1
      from information_schema.columns installed_column
      where installed_column.table_schema = 'public'
        and installed_column.table_name = 'quote_manual_documents'
        and installed_column.column_name = required_column.column_name
    )
  ) then
    raise exception 'quote_manual_documents is missing required columns.';
  end if;

  select pg_get_expr(column_default.adbin, column_default.adrelid)
  into id_default
  from pg_attribute installed_column
  join pg_attrdef column_default
    on column_default.adrelid = installed_column.attrelid
   and column_default.adnum = installed_column.attnum
  where installed_column.attrelid = 'public.quote_manual_documents'::regclass
    and installed_column.attname = 'id';

  if id_default is null
    or position('quote_documents_id_seq' in id_default) = 0
  then
    raise exception 'quote_manual_documents must share quote_documents_id_seq.';
  end if;

  if not exists (
    select 1
    from pg_constraint installed_constraint
    where installed_constraint.conrelid = 'public.quote_manual_documents'::regclass
      and installed_constraint.conname = 'quote_manual_documents_offer_request_fkey'
      and installed_constraint.contype = 'f'
      and installed_constraint.convalidated = true
  ) then
    raise exception 'quote_manual_documents must enforce its offer/request association.';
  end if;

  select pg_get_constraintdef(installed_constraint.oid)
  into event_constraint_definition
  from pg_constraint installed_constraint
  where installed_constraint.conrelid = 'public.quote_events'::regclass
    and installed_constraint.conname = 'quote_events_event_type_check'
    and installed_constraint.contype = 'c'
    and installed_constraint.convalidated = true;

  if event_constraint_definition is null
    or position('admin_document_uploaded' in event_constraint_definition) = 0
  then
    raise exception 'The admin document upload event type was not installed.';
  end if;
end;
$$;

commit;