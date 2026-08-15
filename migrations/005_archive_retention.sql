begin;

alter table deleted_archive_entries
  alter column expires_at set default (now() + interval '90 days');

-- The retention decision applies to every existing archive row, including
-- rows created under the former 60-day default.
update deleted_archive_entries
set expires_at = deleted_at + interval '90 days'
where expires_at <> deleted_at + interval '90 days';

-- Older delete routes updated the source row and registered its archive entry
-- in separate statements. Recover any soft-deleted rows left without a
-- corresponding retention record.
insert into deleted_archive_entries (
  item_type,
  order_id,
  label,
  deleted_at,
  expires_at,
  payload
)
select
  'order',
  o.id,
  coalesce(nullif(o.order_number, ''), '#' || o.id::text)
    || ' · '
    || coalesce(nullif(o.contact_name, ''), 'Naročilo'),
  o.deleted_at,
  o.deleted_at + interval '90 days',
  jsonb_build_object(
    'orderNumber', coalesce(nullif(o.order_number, ''), '#' || o.id::text),
    'orderCreatedAt', o.created_at,
    'customerName', o.contact_name,
    'address', o.delivery_address,
    'customerType', o.customer_type
  )
from orders o
where o.deleted_at is not null
  and not exists (
    select 1
    from deleted_archive_entries e
    where e.item_type = 'order'
      and e.order_id = o.id
  );

insert into deleted_archive_entries (
  item_type,
  order_id,
  document_id,
  label,
  deleted_at,
  expires_at,
  payload
)
select
  'pdf',
  d.order_id,
  d.id,
  d.filename,
  d.deleted_at,
  d.deleted_at + interval '90 days',
  jsonb_build_object(
    'type', d.type,
    'blobUrl', d.blob_url,
    'blobPathname', d.blob_pathname,
    'orderCreatedAt', o.created_at,
    'customerName', o.contact_name,
    'address', o.delivery_address,
    'customerType', o.customer_type
  )
from order_documents d
left join orders o on o.id = d.order_id
where d.deleted_at is not null
  and not exists (
    select 1
    from deleted_archive_entries e
    where e.item_type = 'pdf'
      and e.document_id = d.id
  );

-- A document that belongs to a subsequently deleted order remains protected
-- for at least the full retention period of that parent order.
update deleted_archive_entries e
set expires_at = greatest(e.expires_at, o.deleted_at + interval '90 days')
from orders o
where e.item_type = 'pdf'
  and e.order_id = o.id
  and o.deleted_at is not null;

-- Blob deletion is an external side effect and cannot be atomic with the
-- database transaction. Queue every target before deleting its database row;
-- failures remain here for the next cleanup run.
create table if not exists archive_blob_deletion_outbox (
  id bigserial primary key,
  blob_target text not null unique,
  source_item_type text not null check (source_item_type in ('order', 'pdf', 'product_media')),
  source_order_id bigint,
  source_document_id bigint,
  source_product_id bigint,
  queued_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  last_error text
);

alter table archive_blob_deletion_outbox
  add column if not exists source_product_id bigint;

alter table archive_blob_deletion_outbox
  drop constraint if exists archive_blob_deletion_outbox_source_item_type_check;

alter table archive_blob_deletion_outbox
  add constraint archive_blob_deletion_outbox_source_item_type_check
  check (source_item_type in ('order', 'pdf', 'product_media'));

create index if not exists idx_archive_blob_deletion_outbox_queued_at
  on archive_blob_deletion_outbox(queued_at, id);

commit;
