-- Atehna additive deployment artifact: quote workflow and seller contract state.
--
-- REVIEWED EXECUTION ONLY. Do not run this file from application startup.
-- Apply it once, in a maintenance window, before enabling any QUOTE_* flag.
-- Take and verify a database backup first. The stock reconciliation rows marked
-- legacy_unknown require human review; this script never changes inventory.

begin;

set local search_path = public, pg_temp;
set local lock_timeout = '10s';
set local statement_timeout = '15min';
select pg_advisory_xact_lock(hashtext('atehna-quote-workflow-contract-v1'));

do $$
begin
  if to_regclass('public.orders') is null
    or to_regclass('public.order_items') is null
    or to_regclass('public.order_status_logs') is null
    or to_regclass('public.order_payment_logs') is null
    or to_regclass('public.order_documents') is null
    or to_regclass('public.order_email_jobs') is null
    or to_regclass('public.catalog_items') is null
    or to_regclass('public.catalog_item_variants') is null
    or to_regclass('public.shipping_settings') is null
  then
    raise exception 'The expected Atehna commerce schema is not installed.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'pricing_revision'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'shipping_snapshot_json'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'order_items'
      and column_name = 'catalog_variant_id'
  ) then
    raise exception 'Apply and verify the current shipping/snapshot schema before this deployment.';
  end if;

  if to_regclass('public.quote_requests') is not null
    or to_regclass('public.order_stock_holds') is not null
    or exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = 'contract_status'
    )
  then
    raise exception 'Quote/contract deployment already exists or was not rolled back atomically.';
  end if;
end;
$$;

lock table orders, order_items in share row exclusive mode;

alter table orders
  add column contract_status text,
  add column contract_accepted_at timestamptz,
  add column contract_accepted_actor_type text,
  add column contract_accepted_actor_id text,
  add column contract_acceptance_evidence_json jsonb,
  add column contract_rejected_at timestamptz,
  add column contract_rejected_actor_type text,
  add column contract_rejected_actor_id text,
  add column contract_rejection_reason text,
  add column contract_rejection_evidence_json jsonb,
  add column contract_state_version integer,
  add column committed_at timestamptz,
  add column source_quote_offer_version_id bigint;

alter table order_email_jobs
  drop constraint order_email_jobs_event_type_check,
  add constraint order_email_jobs_event_type_check check (
    event_type in (
      'order_submitted',
      'order_accepted',
      'order_rejected',
      'received',
      'in_progress',
      'partially_sent',
      'sent',
      'finished',
      'cancelled'
    )
  );

-- A binding order may hold stock before its seller contract is accepted. This
-- ledger is the single exactly-once release authority for rejection or
-- cancellation; quote requests and unaccepted offers never create rows here.
create table order_stock_holds (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete restrict,
  catalog_variant_id bigint not null references catalog_item_variants(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  state text not null default 'held' check (
    state in ('held', 'released', 'legacy_unknown')
  ),
  committed_at timestamptz,
  committed_by_actor_type text,
  committed_by_actor_id text,
  released_at timestamptz,
  released_by_actor_type text,
  released_by_actor_id text,
  release_reason text,
  evidence_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_stock_holds_evidence_json_check check (
    jsonb_typeof(evidence_json) = 'object'
  ),
  constraint order_stock_holds_actor_type_check check (
    (
      committed_by_actor_type is null
      or committed_by_actor_type in (
        'admin',
        'customer',
        'school_purchase_order',
        'system',
        'legacy_backfill'
      )
    )
    and (
      released_by_actor_type is null
      or released_by_actor_type in ('admin', 'system', 'legacy_backfill')
    )
  ),
  constraint order_stock_holds_state_evidence_check check (
    (
      state = 'held'
      and committed_at is not null
      and committed_by_actor_type is not null
      and released_at is null
      and released_by_actor_type is null
      and released_by_actor_id is null
      and release_reason is null
    )
    or (
      state = 'released'
      and committed_at is not null
      and committed_by_actor_type is not null
      and released_at is not null
      and released_by_actor_type is not null
      and nullif(btrim(release_reason), '') is not null
    )
    or (
      state = 'legacy_unknown'
      and released_at is null
      and released_by_actor_type is null
      and released_by_actor_id is null
      and release_reason is null
    )
  ),
  unique (order_id, catalog_variant_id)
);

create index idx_order_stock_holds_order_state
  on order_stock_holds(order_id, state);
create index idx_order_stock_holds_variant_state
  on order_stock_holds(catalog_variant_id, state);

create function guard_order_stock_hold_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Order stock-hold rows are durable and cannot be deleted.';
  end if;

  if
    new.order_id is distinct from old.order_id
    or new.catalog_variant_id is distinct from old.catalog_variant_id
    or new.quantity is distinct from old.quantity
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Order stock-hold identity and quantity are immutable.';
  end if;

  if old.state = 'released' and new is distinct from old then
    raise exception 'A released order stock hold is immutable.';
  end if;

  if old.state = 'held' and new.state not in ('held', 'released') then
    raise exception 'A held order stock hold can only be released.';
  end if;

  if old.state = 'held' and new.committed_at is distinct from old.committed_at then
    raise exception 'The stock commitment timestamp is immutable.';
  end if;

  if old.state = 'legacy_unknown' and new.state not in ('legacy_unknown', 'held', 'released') then
    raise exception 'An unreconciled stock hold has an invalid transition.';
  end if;

  return new;
end;
$$;

create trigger order_stock_holds_guard_transition
before update or delete on order_stock_holds
for each row execute function guard_order_stock_hold_transition();

create table quote_number_counters (
  year integer primary key check (year between 2020 and 9999),
  last_request_sequence integer not null default 0 check (
    last_request_sequence between 0 and 999999
  ),
  updated_at timestamptz not null default now()
);

create table quote_requests (
  id bigserial primary key,
  request_number text not null unique,
  status text not null default 'received' check (
    status in (
      'received',
      'in_preparation',
      'offer_issued',
      'awaiting_purchase_order_review',
      'accepted',
      'declined',
      'expired',
      'withdrawn',
      'converted_to_order',
      'closed_without_offer'
    )
  ),
  customer_type text not null check (
    customer_type in ('individual', 'company', 'school')
  ),
  organization_name text,
  contact_name text not null,
  email text not null,
  address_line1 text,
  address_line2 text,
  city text,
  postal_code text,
  country_code text not null default 'SI',
  gurs_house_number_id text,
  reference text,
  quote_reason text not null default 'formal_offer' check (
    quote_reason in (
      'formal_offer',
      'stock_or_delivery',
      'quantity_discount_or_custom_quantity',
      'other'
    )
  ),
  customer_message text,
  customer_visible_notes text,
  admin_notes text,
  billing_snapshot_json jsonb not null default '{}'::jsonb,
  shipping_snapshot_json jsonb not null default '{}'::jsonb,
  estimate_fingerprint text not null,
  estimate_json jsonb not null,
  state_version integer not null default 1,
  closed_at timestamptz,
  closed_by_actor_type text,
  closed_by_actor_id text,
  closure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_requests_number_check check (
    request_number ~ '^POV-[0-9]{4}-[0-9]{6}$'
  ),
  constraint quote_requests_email_check check (
    nullif(btrim(email), '') is not null
  ),
  constraint quote_requests_estimate_fingerprint_check check (
    length(estimate_fingerprint) = 64
  ),
  constraint quote_requests_json_check check (
    jsonb_typeof(billing_snapshot_json) = 'object'
    and jsonb_typeof(shipping_snapshot_json) = 'object'
    and jsonb_typeof(estimate_json) = 'object'
  ),
  constraint quote_requests_state_version_positive_check check (state_version > 0),
  constraint quote_requests_closed_actor_type_check check (
    closed_by_actor_type is null
    or closed_by_actor_type in ('admin', 'customer', 'system')
  )
);

create index idx_quote_requests_status_created_at
  on quote_requests(status, created_at desc, id desc);
create index idx_quote_requests_email_created_at
  on quote_requests(lower(email), created_at desc);
create index idx_quote_requests_updated_at
  on quote_requests(updated_at desc, id desc);

create table quote_request_items (
  id bigserial primary key,
  quote_request_id bigint not null references quote_requests(id) on delete restrict,
  line_number integer not null check (line_number >= 1),
  catalog_item_id bigint,
  catalog_variant_id bigint,
  product_slug text not null,
  product_name text not null,
  variant_name text not null,
  sku text not null,
  unit text,
  quantity integer not null check (quantity > 0),
  min_order integer not null default 1 check (min_order > 0),
  available_stock_at_request integer not null check (
    available_stock_at_request >= 0
  ),
  category_id text,
  category_path text,
  selected_attributes jsonb not null default '{}'::jsonb,
  image_url text,
  base_unit_net numeric(12, 2) not null check (base_unit_net >= 0),
  discount_pct numeric(5, 2) not null default 0 check (
    discount_pct >= 0 and discount_pct <= 100
  ),
  unit_net numeric(12, 2) not null check (unit_net >= 0),
  unit_tax numeric(12, 2) not null check (unit_tax >= 0),
  unit_gross numeric(12, 2) not null check (unit_gross >= 0),
  line_net numeric(12, 2) not null check (line_net >= 0),
  line_tax numeric(12, 2) not null check (line_tax >= 0),
  line_gross numeric(12, 2) not null check (line_gross >= 0),
  tax_rate numeric(5, 4) not null check (tax_rate >= 0 and tax_rate <= 1),
  currency text not null default 'EUR',
  snapshot_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint quote_request_items_selected_attributes_check check (
    jsonb_typeof(selected_attributes) = 'object'
  ),
  constraint quote_request_items_snapshot_json_check check (
    jsonb_typeof(snapshot_json) = 'object'
  ),
  unique (quote_request_id, line_number)
);

create index idx_quote_request_items_request
  on quote_request_items(quote_request_id, line_number);
create index idx_quote_request_items_variant
  on quote_request_items(catalog_variant_id);

create table quote_offer_versions (
  id bigserial primary key,
  quote_request_id bigint not null references quote_requests(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  offer_number text unique,
  status text not null default 'draft' check (
    status in (
      'draft',
      'issued',
      'accepted',
      'declined',
      'withdrawn',
      'expired',
      'superseded'
    )
  ),
  is_current boolean not null default false,
  customer_snapshot_json jsonb not null default '{}'::jsonb,
  billing_snapshot_json jsonb not null default '{}'::jsonb,
  seller_message text,
  customer_visible_notes text,
  admin_notes text,
  delivery_terms text,
  payment_terms text,
  acceptance_method text not null default 'online' check (
    acceptance_method in ('online', 'purchase_order', 'online_or_purchase_order')
  ),
  subtotal numeric(12, 2) not null default 0,
  tax numeric(12, 2) not null default 0,
  shipping numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  currency text not null default 'EUR',
  tax_rate numeric(5, 4) not null default 0.2200,
  shipping_snapshot_json jsonb not null default '{}'::jsonb,
  shipping_confirmation_json jsonb,
  terms_text text,
  terms_version text,
  terms_hash text,
  content_snapshot_json jsonb not null default '{}'::jsonb,
  content_hash text,
  document_sha256 text,
  document_bound_at timestamptz,
  issued_at timestamptz,
  valid_until timestamptz,
  issued_by_actor_type text,
  issued_by_actor_id text,
  accepted_at timestamptz,
  declined_at timestamptz,
  decline_reason text,
  withdrawn_at timestamptz,
  withdrawal_reason text,
  expired_at timestamptz,
  superseded_at timestamptz,
  state_version integer not null default 1,
  created_by_actor_type text not null,
  created_by_actor_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_offer_versions_request_version_unique unique (
    quote_request_id,
    version_number
  ),
  constraint quote_offer_versions_id_request_unique unique (
    id,
    quote_request_id
  ),
  constraint quote_offer_versions_number_check check (
    offer_number is null
    or offer_number ~ '^PON-[0-9]{4}-[0-9]{6}-V[1-9][0-9]*$'
  ),
  constraint quote_offer_versions_amounts_check check (
    subtotal >= 0
    and tax >= 0
    and shipping >= 0
    and total = subtotal + tax + shipping
    and tax_rate >= 0
    and tax_rate <= 1
  ),
  constraint quote_offer_versions_json_check check (
    jsonb_typeof(customer_snapshot_json) = 'object'
    and jsonb_typeof(billing_snapshot_json) = 'object'
    and jsonb_typeof(shipping_snapshot_json) = 'object'
    and (
      shipping_confirmation_json is null
      or jsonb_typeof(shipping_confirmation_json) = 'object'
    )
    and jsonb_typeof(content_snapshot_json) = 'object'
  ),
  constraint quote_offer_versions_hash_check check (
    (terms_hash is null or length(terms_hash) = 64)
    and (content_hash is null or length(content_hash) = 64)
    and (document_sha256 is null or length(document_sha256) = 64)
  ),
  constraint quote_offer_versions_actor_type_check check (
    created_by_actor_type in ('admin', 'system')
    and (
      issued_by_actor_type is null
      or issued_by_actor_type in ('admin', 'system')
    )
  ),
  constraint quote_offer_versions_issue_identity_check check (
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
      and nullif(btrim(terms_text), '') is not null
      and nullif(btrim(terms_version), '') is not null
      and terms_hash is not null
      and content_hash is not null
    )
  ),
  constraint quote_offer_versions_current_check check (
    is_current = (status = 'issued')
  ),
  constraint quote_offer_versions_free_shipping_check check (
    status = 'draft'
    or shipping > 0
    or (
      shipping = 0
      and shipping_confirmation_json is not null
      and shipping_confirmation_json ->> 'decision' = 'free_shipping'
      and nullif(btrim(shipping_confirmation_json ->> 'confirmed_at'), '') is not null
      and nullif(btrim(shipping_confirmation_json ->> 'confirmed_by_actor_type'), '') is not null
    )
  ),
  constraint quote_offer_versions_lifecycle_check check (
    (
      status in ('draft', 'issued')
      and accepted_at is null
      and declined_at is null
      and decline_reason is null
      and withdrawn_at is null
      and withdrawal_reason is null
      and expired_at is null
      and superseded_at is null
    )
    or (
      status = 'accepted'
      and accepted_at is not null
      and document_sha256 is not null
      and declined_at is null
      and withdrawn_at is null
      and expired_at is null
      and superseded_at is null
    )
    or (
      status = 'declined'
      and accepted_at is null
      and declined_at is not null
      and withdrawn_at is null
      and expired_at is null
      and superseded_at is null
    )
    or (
      status = 'withdrawn'
      and accepted_at is null
      and declined_at is null
      and withdrawn_at is not null
      and expired_at is null
      and superseded_at is null
    )
    or (
      status = 'expired'
      and accepted_at is null
      and declined_at is null
      and withdrawn_at is null
      and expired_at is not null
      and superseded_at is null
    )
    or (
      status = 'superseded'
      and accepted_at is null
      and declined_at is null
      and withdrawn_at is null
      and expired_at is null
      and superseded_at is not null
    )
  ),
  constraint quote_offer_versions_document_binding_check check (
    (document_sha256 is null and document_bound_at is null)
    or (document_sha256 is not null and document_bound_at is not null)
  ),
  constraint quote_offer_versions_state_version_positive_check check (
    state_version > 0
  )
);

create unique index idx_quote_offer_versions_one_current
  on quote_offer_versions(quote_request_id)
  where is_current;
create unique index idx_quote_offer_versions_one_draft
  on quote_offer_versions(quote_request_id)
  where status = 'draft';
create index idx_quote_offer_versions_request_created_at
  on quote_offer_versions(quote_request_id, version_number desc);
create index idx_quote_offer_versions_status_valid_until
  on quote_offer_versions(status, valid_until)
  where status = 'issued';

create table quote_offer_version_items (
  id bigserial primary key,
  quote_offer_version_id bigint not null references quote_offer_versions(id) on delete restrict,
  line_number integer not null check (line_number >= 1),
  catalog_item_id bigint,
  catalog_variant_id bigint,
  product_slug text not null,
  product_name text not null,
  variant_name text not null,
  sku text not null,
  unit text,
  quantity integer not null check (quantity > 0),
  min_order integer not null default 1 check (min_order > 0),
  available_stock_at_request integer not null check (
    available_stock_at_request >= 0
  ),
  category_id text,
  category_path text,
  selected_attributes jsonb not null default '{}'::jsonb,
  image_url text,
  base_unit_net numeric(12, 2) not null check (base_unit_net >= 0),
  discount_pct numeric(5, 2) not null default 0 check (
    discount_pct >= 0 and discount_pct <= 100
  ),
  unit_net numeric(12, 2) not null check (unit_net >= 0),
  unit_tax numeric(12, 2) not null check (unit_tax >= 0),
  unit_gross numeric(12, 2) not null check (unit_gross >= 0),
  line_net numeric(12, 2) not null check (line_net >= 0),
  line_tax numeric(12, 2) not null check (line_tax >= 0),
  line_gross numeric(12, 2) not null check (line_gross >= 0),
  tax_rate numeric(5, 4) not null check (tax_rate >= 0 and tax_rate <= 1),
  currency text not null default 'EUR',
  snapshot_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint quote_offer_version_items_selected_attributes_check check (
    jsonb_typeof(selected_attributes) = 'object'
  ),
  constraint quote_offer_version_items_snapshot_json_check check (
    jsonb_typeof(snapshot_json) = 'object'
  ),
  unique (quote_offer_version_id, line_number)
);

create index idx_quote_offer_version_items_offer
  on quote_offer_version_items(quote_offer_version_id, line_number);
create index idx_quote_offer_version_items_variant
  on quote_offer_version_items(catalog_variant_id);
create table quote_offer_acceptances (
  id uuid primary key default gen_random_uuid(),
  quote_offer_version_id bigint not null unique references quote_offer_versions(id) on delete restrict,
  accepted_at timestamptz not null,
  channel text not null check (
    channel in ('online', 'purchase_order_validation', 'admin_recorded')
  ),
  actor_type text not null check (
    actor_type in ('customer', 'school_purchase_order', 'admin')
  ),
  actor_id text,
  verified_identity text not null,
  verification_evidence_json jsonb not null,
  acceptance_wording text not null,
  terms_version text not null,
  terms_hash text not null,
  content_hash text not null,
  document_sha256 text not null,
  request_id text,
  correlation_id text,
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz not null default now(),
  constraint quote_offer_acceptances_evidence_json_check check (
    jsonb_typeof(verification_evidence_json) = 'object'
  ),
  constraint quote_offer_acceptances_hash_check check (
    length(terms_hash) = 64
    and length(content_hash) = 64
    and length(document_sha256) = 64
    and (ip_hash is null or length(ip_hash) = 64)
    and (user_agent_hash is null or length(user_agent_hash) = 64)
  )
);

create index idx_quote_offer_acceptances_created_at
  on quote_offer_acceptances(accepted_at desc);

create table quote_documents (
  id bigserial primary key,
  quote_offer_version_id bigint not null references quote_offer_versions(id) on delete restrict,
  customer_access_id uuid not null default gen_random_uuid(),
  document_type text not null check (
    document_type in ('offer', 'purchase_order')
  ),
  filename text not null,
  blob_pathname text not null,
  version_number integer not null check (version_number > 0),
  document_number text not null,
  issued_at timestamptz not null,
  content_sha256 text not null,
  offer_content_hash text not null,
  terms_hash text not null,
  created_by_actor_type text not null check (
    created_by_actor_type in ('admin', 'customer', 'system')
  ),
  created_by_actor_id text,
  created_at timestamptz not null default now(),
  constraint quote_documents_hash_check check (
    length(content_sha256) = 64
    and length(offer_content_hash) = 64
    and length(terms_hash) = 64
  ),
  unique (quote_offer_version_id, document_type, version_number)
);

create unique index idx_quote_documents_customer_access_id
  on quote_documents(customer_access_id);
create index idx_quote_documents_offer_created_at
  on quote_documents(quote_offer_version_id, created_at desc);

create table quote_document_jobs (
  id bigserial primary key,
  quote_offer_version_id bigint not null references quote_offer_versions(id) on delete restrict,
  document_type text not null check (document_type = 'offer'),
  payload_json jsonb not null,
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'completed')
  ),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  claim_id uuid,
  locked_at timestamptz,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_document_jobs_payload_json_check check (
    jsonb_typeof(payload_json) = 'object'
  ),
  constraint quote_document_jobs_claim_check check (
    (status = 'processing' and claim_id is not null and locked_at is not null)
    or (status <> 'processing' and claim_id is null and locked_at is null)
  ),
  unique (quote_offer_version_id, document_type)
);

create index idx_quote_document_jobs_pending
  on quote_document_jobs(next_attempt_at, id)
  where status = 'pending';

create table quote_events (
  id bigserial primary key,
  quote_request_id bigint not null references quote_requests(id) on delete restrict,
  quote_offer_version_id bigint,
  event_key text,
  event_type text not null check (
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
  ),
  actor_type text not null check (
    actor_type in ('customer', 'admin', 'system', 'email_provider')
  ),
  actor_id text,
  occurred_at timestamptz not null default now(),
  request_id text,
  correlation_id text not null default gen_random_uuid()::text,
  reason text,
  metadata_json jsonb not null default '{}'::jsonb,
  constraint quote_events_offer_request_fkey
    foreign key (quote_offer_version_id, quote_request_id)
    references quote_offer_versions(id, quote_request_id)
    on delete restrict,
  constraint quote_events_metadata_json_check check (
    jsonb_typeof(metadata_json) = 'object'
  )
);

create unique index idx_quote_events_event_key
  on quote_events(event_key)
  where event_key is not null;
create index idx_quote_events_request_timeline
  on quote_events(quote_request_id, occurred_at, id);
create index idx_quote_events_offer_timeline
  on quote_events(quote_offer_version_id, occurred_at, id)
  where quote_offer_version_id is not null;
create function guard_quote_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only; % is not allowed.', tg_table_name, tg_op;
end;
$$;

create trigger quote_request_items_append_only
before update or delete on quote_request_items
for each row execute function guard_quote_append_only();

create trigger quote_offer_acceptances_append_only
before update or delete on quote_offer_acceptances
for each row execute function guard_quote_append_only();

create trigger quote_documents_append_only
before update or delete on quote_documents
for each row execute function guard_quote_append_only();

create trigger quote_events_append_only
before update or delete on quote_events
for each row execute function guard_quote_append_only();

create function guard_quote_request_history()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Quote requests are durable records and cannot be deleted.';
  end if;

  if (
    to_jsonb(new)
      - array[
          'status',
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

create trigger quote_requests_guard_history
before update or delete on quote_requests
for each row execute function guard_quote_request_history();

create function guard_quote_offer_version()
returns trigger
language plpgsql
as $$
declare
  allowed_transition boolean;
  expected_offer_number text;
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Issued offer versions are immutable and cannot be deleted.';
    end if;
    return old;
  end if;

  if new.status <> 'draft' then
    select
      'PON-' || substring(request_number from 5) || '-V' || new.version_number::text
    into expected_offer_number
    from quote_requests
    where id = new.quote_request_id;

    if new.offer_number is distinct from expected_offer_number then
      raise exception 'Offer number must match its POV request serial and version.';
    end if;
  end if;

  if tg_op = 'INSERT' then
    return new;
  end if;

  if
    new.id is distinct from old.id
    or new.quote_request_id is distinct from old.quote_request_id
    or new.version_number is distinct from old.version_number
    or new.created_by_actor_type is distinct from old.created_by_actor_type
    or new.created_by_actor_id is distinct from old.created_by_actor_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Offer-version identity and creation evidence are immutable.';
  end if;

  allowed_transition :=
    (old.status = 'draft' and new.status in ('draft', 'issued'))
    or (
      old.status = 'issued'
      and new.status in (
        'issued',
        'accepted',
        'declined',
        'withdrawn',
        'expired',
        'superseded'
      )
    )
    or (
      old.status in ('accepted', 'declined', 'withdrawn', 'expired', 'superseded')
      and new.status = old.status
    );

  if not allowed_transition then
    raise exception 'Invalid offer-version transition from % to %.', old.status, new.status;
  end if;

  if old.status <> 'draft' and (
    to_jsonb(new)
      - array[
          'status',
          'is_current',
          'document_sha256',
          'document_bound_at',
          'accepted_at',
          'declined_at',
          'decline_reason',
          'withdrawn_at',
          'withdrawal_reason',
          'expired_at',
          'superseded_at',
          'state_version',
          'updated_at'
        ]::text[]
  ) is distinct from (
    to_jsonb(old)
      - array[
          'status',
          'is_current',
          'document_sha256',
          'document_bound_at',
          'accepted_at',
          'declined_at',
          'decline_reason',
          'withdrawn_at',
          'withdrawal_reason',
          'expired_at',
          'superseded_at',
          'state_version',
          'updated_at'
        ]::text[]
  ) then
    raise exception 'Issued offer identity, items, pricing, terms, and content are immutable.';
  end if;

  if old.document_sha256 is not null and (
    new.document_sha256 is distinct from old.document_sha256
    or new.document_bound_at is distinct from old.document_bound_at
  ) then
    raise exception 'An offer document hash can only be bound once.';
  end if;

  if old.document_sha256 is null
    and new.document_sha256 is not null
    and new.status = 'draft'
  then
    raise exception 'A draft preview cannot be bound as the issued offer document.';
  end if;

  if old.status in ('accepted', 'declined', 'withdrawn', 'expired', 'superseded')
    and (
      new.accepted_at is distinct from old.accepted_at
      or new.declined_at is distinct from old.declined_at
      or new.decline_reason is distinct from old.decline_reason
      or new.withdrawn_at is distinct from old.withdrawn_at
      or new.withdrawal_reason is distinct from old.withdrawal_reason
      or new.expired_at is distinct from old.expired_at
      or new.superseded_at is distinct from old.superseded_at
    )
  then
    raise exception 'Terminal offer lifecycle evidence is immutable.';
  end if;

  if new.state_version <= old.state_version then
    raise exception 'Offer-version state_version must increase.';
  end if;

  return new;
end;
$$;

create trigger quote_offer_versions_guard
before insert or update or delete on quote_offer_versions
for each row execute function guard_quote_offer_version();

create function guard_quote_offer_version_item()
returns trigger
language plpgsql
as $$
declare
  old_offer_status text;
  new_offer_status text;
begin
  if tg_op = 'UPDATE'
    and new.quote_offer_version_id is distinct from old.quote_offer_version_id
  then
    raise exception 'An offer item cannot be moved between offer versions.';
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    select status
    into old_offer_status
    from quote_offer_versions
    where id = old.quote_offer_version_id
    for update;

    if old_offer_status <> 'draft' then
      raise exception 'Items on an issued offer version are immutable.';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select status
    into new_offer_status
    from quote_offer_versions
    where id = new.quote_offer_version_id
    for update;

    if new_offer_status <> 'draft' then
      raise exception 'Items can only be changed on a draft offer version.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger quote_offer_version_items_guard
before insert or update or delete on quote_offer_version_items
for each row execute function guard_quote_offer_version_item();
-- Quote customer access is isolated from order access. Raw bearer and OTP
-- values are never persisted; only one-way hashes and encrypted replay
-- bootstrap material are stored.
create table quote_access_tokens (
  id uuid primary key default gen_random_uuid(),
  quote_request_id bigint not null references quote_requests(id) on delete restrict,
  quote_offer_version_id bigint,
  token_hash text not null unique,
  token_prefix text not null,
  csrf_token_hash text,
  scopes text[] not null default array['request_confirmation']::text[],
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  constraint quote_access_tokens_offer_request_fkey
    foreign key (quote_offer_version_id, quote_request_id)
    references quote_offer_versions(id, quote_request_id)
    on delete restrict,
  constraint quote_access_tokens_hash_check check (length(token_hash) = 64),
  constraint quote_access_tokens_csrf_hash_check check (
    csrf_token_hash is null or length(csrf_token_hash) = 64
  ),
  constraint quote_access_tokens_prefix_check check (
    length(token_prefix) between 6 and 20
  ),
  constraint quote_access_tokens_scopes_check check (
    scopes <@ array[
      'request_confirmation',
      'offer_review',
      'offer_response',
      'purchase_order'
    ]::text[]
    and cardinality(scopes) > 0
  ),
  constraint quote_access_tokens_expiry_check check (expires_at > created_at)
);

create index idx_quote_access_tokens_request_created_at
  on quote_access_tokens(quote_request_id, created_at desc);
create index idx_quote_access_tokens_offer_created_at
  on quote_access_tokens(quote_offer_version_id, created_at desc)
  where quote_offer_version_id is not null;
create unique index idx_quote_access_tokens_one_request_unrevoked
  on quote_access_tokens(quote_request_id)
  where quote_offer_version_id is null and revoked_at is null;
create unique index idx_quote_access_tokens_one_offer_unrevoked
  on quote_access_tokens(quote_offer_version_id)
  where quote_offer_version_id is not null and revoked_at is null;

create table quote_request_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique,
  request_hash text not null,
  intent text not null default 'quote_request' check (intent = 'quote_request'),
  quote_request_id bigint references quote_requests(id) on delete restrict,
  response_json jsonb not null default '{}'::jsonb,
  bootstrap_token_ciphertext text,
  bootstrap_token_iv text,
  bootstrap_token_tag text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint quote_request_idempotency_key_hash_check check (
    length(key_hash) = 64
  ),
  constraint quote_request_idempotency_request_hash_check check (
    length(request_hash) = 64
  ),
  constraint quote_request_idempotency_response_json_check check (
    jsonb_typeof(response_json) = 'object'
  ),
  constraint quote_request_idempotency_completion_check check (
    (
      completed_at is null
      and quote_request_id is null
      and bootstrap_token_ciphertext is null
      and bootstrap_token_iv is null
      and bootstrap_token_tag is null
    )
    or (
      completed_at is not null
      and quote_request_id is not null
      and bootstrap_token_ciphertext is not null
      and bootstrap_token_iv is not null
      and bootstrap_token_tag is not null
    )
  )
);

create index idx_quote_request_idempotency_request
  on quote_request_idempotency_keys(quote_request_id);
create index idx_quote_request_idempotency_created_at
  on quote_request_idempotency_keys(created_at);

create table quote_response_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique,
  request_hash text not null,
  quote_offer_version_id bigint not null references quote_offer_versions(id) on delete restrict,
  response_action text not null check (
    response_action in ('accept', 'decline', 'purchase_order')
  ),
  response_json jsonb not null default '{}'::jsonb,
  bootstrap_token_ciphertext text,
  bootstrap_token_iv text,
  bootstrap_token_tag text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint quote_response_idempotency_key_hash_check check (
    length(key_hash) = 64
  ),
  constraint quote_response_idempotency_request_hash_check check (
    length(request_hash) = 64
  ),
  constraint quote_response_idempotency_response_json_check check (
    jsonb_typeof(response_json) = 'object'
  ),
  constraint quote_response_idempotency_cipher_check check (
    (
      bootstrap_token_ciphertext is null
      and bootstrap_token_iv is null
      and bootstrap_token_tag is null
    )
    or (
      bootstrap_token_ciphertext is not null
      and bootstrap_token_iv is not null
      and bootstrap_token_tag is not null
    )
  ),
  constraint quote_response_idempotency_completion_check check (
    completed_at is not null
    or (
      bootstrap_token_ciphertext is null
      and bootstrap_token_iv is null
      and bootstrap_token_tag is null
      and response_json = '{}'::jsonb
    )
  )
);

create index idx_quote_response_idempotency_offer
  on quote_response_idempotency_keys(quote_offer_version_id);
create index idx_quote_response_idempotency_created_at
  on quote_response_idempotency_keys(created_at);

create table quote_email_verifications (
  id uuid primary key default gen_random_uuid(),
  quote_request_id bigint not null references quote_requests(id) on delete restrict,
  quote_offer_version_id bigint not null,
  purpose text not null check (
    purpose in ('offer_response', 'purchase_order')
  ),
  target_email_hash text not null,
  code_hash text not null,
  access_session_hash text not null,
  status text not null default 'pending' check (
    status in ('pending', 'verified', 'consumed', 'expired', 'locked')
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 6 check (max_attempts between 1 and 20),
  last_attempt_at timestamptz,
  verified_at timestamptz,
  consumed_at timestamptz,
  expires_at timestamptz not null,
  request_id text,
  correlation_id text,
  ip_hash text,
  created_at timestamptz not null default now(),
  constraint quote_email_verifications_offer_request_fkey
    foreign key (quote_offer_version_id, quote_request_id)
    references quote_offer_versions(id, quote_request_id)
    on delete restrict,
  constraint quote_email_verifications_hash_check check (
    length(target_email_hash) = 64
    and length(code_hash) = 64
    and length(access_session_hash) = 64
    and (ip_hash is null or length(ip_hash) = 64)
  ),
  constraint quote_email_verifications_expiry_check check (
    expires_at > created_at
  ),
  constraint quote_email_verifications_state_check check (
    (status = 'pending' and verified_at is null and consumed_at is null)
    or (status = 'verified' and verified_at is not null and consumed_at is null)
    or (status = 'consumed' and verified_at is not null and consumed_at is not null)
    or (status in ('expired', 'locked') and consumed_at is null)
  )
);

create index idx_quote_email_verifications_offer_created_at
  on quote_email_verifications(
    quote_offer_version_id,
    access_session_hash,
    created_at desc
  );
create index idx_quote_email_verifications_pending
  on quote_email_verifications(expires_at, id)
  where status = 'pending';

create table quote_rate_limits (
  scope text not null check (
    scope in (
      'quote_request',
      'access_exchange',
      'otp_issue',
      'otp_verify',
      'offer_response',
      'purchase_order'
    )
  ),
  subject_hash text not null,
  window_started_at timestamptz not null,
  window_seconds integer not null check (window_seconds between 1 and 86400),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  blocked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope, subject_hash, window_started_at),
  constraint quote_rate_limits_subject_hash_check check (
    length(subject_hash) = 64
  )
);

create index idx_quote_rate_limits_cleanup
  on quote_rate_limits(window_started_at, scope);
create index idx_quote_rate_limits_blocked
  on quote_rate_limits(blocked_until)
  where blocked_until is not null;
create table quote_email_settings (
  key text primary key,
  config_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint quote_email_settings_config_json_check check (
    jsonb_typeof(config_json) = 'object'
  )
);

create table quote_email_jobs (
  id uuid primary key default gen_random_uuid(),
  quote_request_id bigint not null references quote_requests(id) on delete restrict,
  quote_offer_version_id bigint,
  event_key text not null,
  event_type text not null check (
    event_type in (
      'quote_request_submitted',
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
  ),
  audience text not null check (audience in ('customer', 'admin')),
  recipient_email text not null,
  recipient_name text,
  payload_json jsonb not null,
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'sent', 'failed')
  ),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  claim_id uuid,
  locked_at timestamptz,
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_email_jobs_offer_request_fkey
    foreign key (quote_offer_version_id, quote_request_id)
    references quote_offer_versions(id, quote_request_id)
    on delete restrict,
  constraint quote_email_jobs_payload_json_check check (
    jsonb_typeof(payload_json) = 'object'
  ),
  constraint quote_email_jobs_claim_check check (
    (status = 'processing' and claim_id is not null and locked_at is not null)
    or (status <> 'processing' and claim_id is null and locked_at is null)
  )
);

create unique index idx_quote_email_jobs_event_audience_recipient
  on quote_email_jobs(event_key, audience, lower(recipient_email));
create index idx_quote_email_jobs_request
  on quote_email_jobs(quote_request_id, created_at desc);
create index idx_quote_email_jobs_offer
  on quote_email_jobs(quote_offer_version_id, created_at desc)
  where quote_offer_version_id is not null;
create index idx_quote_email_jobs_pending
  on quote_email_jobs(next_attempt_at, created_at, id)
  where status = 'pending';
create index idx_quote_email_jobs_stale_processing
  on quote_email_jobs(locked_at, id)
  where status = 'processing';
create index idx_quote_email_jobs_sent_retention
  on quote_email_jobs(sent_at, id)
  where status = 'sent';

with legacy_evidence as (
  select
    existing_order.id as order_id,
    (
      select min(status_log.created_at)
      from order_status_logs status_log
      where status_log.order_id = existing_order.id
        and status_log.new_status in (
          'in_progress',
          'partially_sent',
          'sent',
          'finished'
        )
    ) as fulfillment_evidence_at,
    (
      select min(payment_log.created_at)
      from order_payment_logs payment_log
      where payment_log.order_id = existing_order.id
        and payment_log.new_status in ('paid', 'refunded')
    ) as payment_evidence_at,
    (
      select min(document.issued_at)
      from order_documents document
      where document.order_id = existing_order.id
        and document.deleted_at is null
        and document.type in ('dobavnica', 'invoice')
    ) as document_evidence_at
  from orders existing_order
),
classified as (
  select
    existing_order.id,
    case
      when existing_order.commitment_status = 'rejected' then 'rejected'
      when existing_order.is_draft then 'pending_seller_acceptance'
      when existing_order.customer_type = 'school'
        and existing_order.commitment_status = 'pending_confirmation'
        then 'pending_seller_acceptance'
      when existing_order.customer_type = 'school'
        and existing_order.commitment_status = 'binding'
        then 'accepted'
      when existing_order.customer_type <> 'school'
        and (
          existing_order.status in (
            'in_progress',
            'partially_sent',
            'sent',
            'finished'
          )
          or existing_order.payment_status in ('paid', 'refunded')
          or evidence.fulfillment_evidence_at is not null
          or evidence.payment_evidence_at is not null
          or evidence.document_evidence_at is not null
        )
        then 'accepted'
      else 'pending_seller_acceptance'
    end as contract_status,
    case
      when not existing_order.is_draft
        and existing_order.customer_type = 'school'
        and existing_order.commitment_status = 'binding'
        then coalesce(
          least(
            evidence.fulfillment_evidence_at,
            evidence.payment_evidence_at,
            evidence.document_evidence_at
          ),
          existing_order.created_at
        )
      when not existing_order.is_draft
        and existing_order.customer_type <> 'school'
        and (
          existing_order.status in (
            'in_progress',
            'partially_sent',
            'sent',
            'finished'
          )
          or existing_order.payment_status in ('paid', 'refunded')
          or evidence.fulfillment_evidence_at is not null
          or evidence.payment_evidence_at is not null
          or evidence.document_evidence_at is not null
        )
        then coalesce(
          least(
            evidence.fulfillment_evidence_at,
            evidence.payment_evidence_at,
            evidence.document_evidence_at
          ),
          existing_order.created_at
        )
      else null
    end as accepted_at,
    case
      when existing_order.commitment_status = 'rejected'
        then existing_order.created_at
      else null
    end as rejected_at,
    case
      when not existing_order.is_draft
        and existing_order.customer_type = 'school'
        and existing_order.commitment_status = 'binding'
        then 'school_binding_commitment'
      when not existing_order.is_draft
        and existing_order.customer_type <> 'school'
        and (
          existing_order.status in (
            'in_progress',
            'partially_sent',
            'sent',
            'finished'
          )
          or evidence.fulfillment_evidence_at is not null
        )
        then 'operational_fulfillment'
      when not existing_order.is_draft
        and existing_order.customer_type <> 'school'
        and (
          existing_order.payment_status in ('paid', 'refunded')
          or evidence.payment_evidence_at is not null
        )
        then 'payment_activity'
      when not existing_order.is_draft
        and existing_order.customer_type <> 'school'
        and evidence.document_evidence_at is not null
        then 'issued_fulfillment_or_invoice_document'
      else null
    end as accepted_basis,
    case
      when evidence.fulfillment_evidence_at is not null
        and evidence.fulfillment_evidence_at <= coalesce(
          evidence.payment_evidence_at,
          'infinity'::timestamptz
        )
        and evidence.fulfillment_evidence_at <= coalesce(
          evidence.document_evidence_at,
          'infinity'::timestamptz
        )
        then 'order_status_log'
      when evidence.payment_evidence_at is not null
        and evidence.payment_evidence_at <= coalesce(
          evidence.document_evidence_at,
          'infinity'::timestamptz
        )
        then 'order_payment_log'
      when evidence.document_evidence_at is not null then 'order_document'
      else 'order_created_at_fallback'
    end as accepted_timestamp_source
  from orders existing_order
  join legacy_evidence evidence on evidence.order_id = existing_order.id
)
update orders existing_order
set
  contract_status = classified.contract_status,
  contract_accepted_at = classified.accepted_at,
  contract_accepted_actor_type = case
    when classified.contract_status = 'accepted' then 'legacy_backfill'
    else null
  end,
  contract_acceptance_evidence_json = case
    when classified.contract_status = 'accepted' then jsonb_build_object(
      'backfillVersion', '2026-08-28-v1',
      'basis', classified.accepted_basis,
      'timestampSource', classified.accepted_timestamp_source,
      'classification', 'conservative_operational_evidence'
    )
    else null
  end,
  contract_rejected_at = classified.rejected_at,
  contract_rejected_actor_type = case
    when classified.contract_status = 'rejected' then 'legacy_backfill'
    else null
  end,
  contract_rejection_reason = case
    when classified.contract_status = 'rejected' then 'legacy_commitment_rejected'
    else null
  end,
  contract_rejection_evidence_json = case
    when classified.contract_status = 'rejected' then jsonb_build_object(
      'backfillVersion', '2026-08-28-v1',
      'basis', 'commitment_status_rejected',
      'timestampSource', 'order_created_at_fallback',
      'classification', 'explicit_legacy_rejection_state'
    )
    else null
  end,
  contract_state_version = 1,
  committed_at = classified.accepted_at
from classified
where existing_order.id = classified.id;

alter table orders
  alter column contract_status set default 'pending_seller_acceptance',
  alter column contract_status set not null,
  alter column contract_state_version set default 1,
  alter column contract_state_version set not null,
  add constraint orders_contract_status_check check (
    contract_status in ('pending_seller_acceptance', 'accepted', 'rejected')
  ),
  add constraint orders_contract_actor_type_check check (
    (
      contract_accepted_actor_type is null
      or contract_accepted_actor_type in (
        'admin',
        'customer',
        'school_purchase_order',
        'system',
        'legacy_backfill'
      )
    )
    and (
      contract_rejected_actor_type is null
      or contract_rejected_actor_type in ('admin', 'system', 'legacy_backfill')
    )
  ),
  add constraint orders_contract_evidence_json_check check (
    (
      contract_acceptance_evidence_json is null
      or jsonb_typeof(contract_acceptance_evidence_json) = 'object'
    )
    and (
      contract_rejection_evidence_json is null
      or jsonb_typeof(contract_rejection_evidence_json) = 'object'
    )
  ),
  add constraint orders_contract_state_evidence_check check (
    (
      contract_status = 'pending_seller_acceptance'
      and contract_accepted_at is null
      and contract_accepted_actor_type is null
      and contract_accepted_actor_id is null
      and contract_acceptance_evidence_json is null
      and contract_rejected_at is null
      and contract_rejected_actor_type is null
      and contract_rejected_actor_id is null
      and contract_rejection_reason is null
      and contract_rejection_evidence_json is null
      and committed_at is null
    )
    or (
      contract_status = 'accepted'
      and contract_accepted_at is not null
      and contract_accepted_actor_type is not null
      and contract_acceptance_evidence_json is not null
      and contract_rejected_at is null
      and contract_rejected_actor_type is null
      and contract_rejected_actor_id is null
      and contract_rejection_reason is null
      and contract_rejection_evidence_json is null
      and committed_at is not null
    )
    or (
      contract_status = 'rejected'
      and contract_accepted_at is null
      and contract_accepted_actor_type is null
      and contract_accepted_actor_id is null
      and contract_acceptance_evidence_json is null
      and contract_rejected_at is not null
      and contract_rejected_actor_type is not null
      and contract_rejection_evidence_json is not null
      and committed_at is null
    )
  ),
  add constraint orders_contract_state_version_positive_check check (
    contract_state_version > 0
  ),
  add constraint orders_source_quote_offer_version_id_fkey
    foreign key (source_quote_offer_version_id)
    references quote_offer_versions(id)
    on delete restrict;

create index idx_orders_contract_status_created_at
  on orders(contract_status, committed_at desc, created_at desc);
create unique index idx_orders_source_quote_offer_version
  on orders(source_quote_offer_version_id)
  where source_quote_offer_version_id is not null;

with stock_candidates as (
  select
    existing_order.id as order_id,
    existing_order.customer_type,
    existing_order.deleted_at,
    existing_order.is_draft,
    existing_order.status,
    existing_order.created_at,
    item.catalog_variant_id,
    item.quantity,
    (
      (
        existing_order.customer_type <> 'school'
        and exists (
          select 1
          from order_idempotency_keys placement_receipt
          where placement_receipt.order_id = existing_order.id
            and placement_receipt.completed_at is not null
        )
      )
      or (
        existing_order.customer_type = 'school'
        and exists (
          select 1
          from order_documents purchase_order
          where purchase_order.order_id = existing_order.id
            and purchase_order.type = 'purchase_order'
            and purchase_order.deleted_at is null
        )
      )
    ) as stock_commitment_proven
  from orders existing_order
  join order_items item on item.order_id = existing_order.id
  where existing_order.commitment_status = 'binding'
    and item.catalog_variant_id is not null
)
insert into order_stock_holds (
  order_id,
  catalog_variant_id,
  quantity,
  state,
  committed_at,
  committed_by_actor_type,
  evidence_json
)
select
  candidate.order_id,
  candidate.catalog_variant_id,
  sum(candidate.quantity)::integer,
  case
    when candidate.deleted_at is null
      and candidate.is_draft = false
      and candidate.status <> 'cancelled'
      and candidate.stock_commitment_proven
      then 'held'
    else 'legacy_unknown'
  end,
  case
    when candidate.deleted_at is null
      and candidate.is_draft = false
      and candidate.status <> 'cancelled'
      and candidate.stock_commitment_proven
      then candidate.created_at
    else null
  end,
  case
    when candidate.deleted_at is null
      and candidate.is_draft = false
      and candidate.status <> 'cancelled'
      and candidate.stock_commitment_proven
      then 'legacy_backfill'
    else null
  end,
  jsonb_build_object(
    'backfillVersion', '2026-08-28-v1',
    'basis', case
      when candidate.customer_type = 'school'
        and candidate.stock_commitment_proven
        then 'binding_school_order_with_purchase_order'
      when candidate.customer_type <> 'school'
        and candidate.stock_commitment_proven
        then 'completed_direct_checkout_receipt'
      else 'unproven_binding_order_items'
    end,
    'inventoryChangedByMigration', false,
    'requiresManualReconciliation',
      not (
        candidate.deleted_at is null
        and candidate.is_draft = false
        and candidate.status <> 'cancelled'
        and candidate.stock_commitment_proven
      )
  )
from stock_candidates candidate
group by
  candidate.order_id,
  candidate.customer_type,
  candidate.catalog_variant_id,
  candidate.deleted_at,
  candidate.is_draft,
  candidate.status,
  candidate.created_at,
  candidate.stock_commitment_proven;

do $$
declare
  unlinked_binding_item_count bigint;
begin
  if exists (
    select 1
    from orders
    where contract_status is null or contract_state_version is null
  ) then
    raise exception 'Order contract-state backfill is incomplete.';
  end if;

  if exists (
    select 1
    from order_stock_holds
    where state = 'legacy_unknown'
  ) then
    raise notice 'Legacy stock rows require reconciliation; inventory was not changed.';
  end if;

  select count(*)
  into unlinked_binding_item_count
  from orders existing_order
  join order_items item on item.order_id = existing_order.id
  where existing_order.commitment_status = 'binding'
    and item.catalog_variant_id is null;

  if unlinked_binding_item_count > 0 then
    raise notice '% binding legacy order-item rows have no variant link and require separate inventory review.',
      unlinked_binding_item_count;
  end if;
end;
$$;

commit;
