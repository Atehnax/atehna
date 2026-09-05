-- Record the first terminal application/schema compatibility contract.
--
-- This is intentionally not a migration-history backfill. It proves that the
-- database reached the postconditions required by the application, then records
-- one deterministic contract identity shared with database/schema.sql.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '15min';
set local search_path = public, pg_temp;

select pg_advisory_xact_lock(
  hashtext('atehna:database-schema-contract:20260903.prelaunch-v1')
);

do $contract_verification$
declare
  invalid_objects text[];
begin
  select array_agg(required.extension_name order by required.extension_name)
    into invalid_objects
    from (
      values
        ('pg_trgm'),
        ('pgcrypto')
    ) as required(extension_name)
   where not exists (
     select 1
       from pg_extension installed
      where installed.extname = required.extension_name
   );

  if invalid_objects is not null then
    raise exception 'Schema contract is missing extensions: %',
      array_to_string(invalid_objects, ', ');
  end if;

  select array_agg(required.table_name order by required.table_name)
    into invalid_objects
    from (
      values
        ('analytics_chart_settings'),
        ('analytics_charts'),
        ('archive_blob_deletion_outbox'),
        ('audit_events'),
        ('audit_settings'),
        ('catalog_categories'),
        ('catalog_item_editor_details'),
        ('catalog_item_quantity_discounts'),
        ('catalog_item_slug_aliases'),
        ('catalog_item_variants'),
        ('catalog_items'),
        ('catalog_media'),
        ('catalog_option_axes'),
        ('catalog_option_values'),
        ('catalog_variant_media'),
        ('catalog_variant_option_values'),
        ('customer_directory_profiles'),
        ('deleted_archive_entries'),
        ('global_style_settings'),
        ('gurs_address_sync_runs'),
        ('gurs_address_sync_state'),
        ('gurs_addresses'),
        ('inventory_policy_settings'),
        ('landing_page_settings'),
        ('order_access_tokens'),
        ('order_document_jobs'),
        ('order_documents'),
        ('order_email_jobs'),
        ('order_email_settings'),
        ('order_idempotency_keys'),
        ('order_items'),
        ('order_line_snapshots'),
        ('order_payment_logs'),
        ('order_status_logs'),
        ('order_stock_holds'),
        ('orders'),
        ('product_appearance_settings'),
        ('quote_access_tokens'),
        ('quote_document_jobs'),
        ('quote_documents'),
        ('quote_email_jobs'),
        ('quote_email_settings'),
        ('quote_email_verifications'),
        ('quote_events'),
        ('quote_manual_documents'),
        ('quote_number_counters'),
        ('quote_offer_acceptances'),
        ('quote_offer_version_items'),
        ('quote_offer_versions'),
        ('quote_rate_limits'),
        ('quote_request_idempotency_keys'),
        ('quote_request_items'),
        ('quote_requests'),
        ('quote_response_idempotency_keys'),
        ('school_directory_columns'),
        ('school_directory_meta'),
        ('school_directory_rows'),
        ('shipping_settings'),
        ('site_logo_settings'),
        ('site_navigation_settings'),
        ('website_events')
    ) as required(table_name)
   where not exists (
     select 1
       from pg_class relation
       join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = required.table_name
        and relation.relkind in ('r', 'p')
   );

  if invalid_objects is not null then
    raise exception 'Schema contract is missing tables: %',
      array_to_string(invalid_objects, ', ');
  end if;

  select array_agg(
           required.table_name || '.' || required.column_name
           order by required.table_name, required.column_name
         )
    into invalid_objects
    from (
      values
        (
          'order_documents',
          'order_delivery_plan_revision',
          'integer',
          false,
          '1'
        ),
        (
          'order_items',
          'ship_later',
          'boolean',
          false,
          'false'
        ),
        (
          'orders',
          'contract_status',
          'text',
          false,
          $default$'pending_seller_acceptance'::text$default$
        ),
        (
          'orders',
          'delivery_plan_revision',
          'integer',
          false,
          '1'
        ),
        (
          'orders',
          'source_quote_offer_version_id',
          'bigint',
          true,
          null::text
        ),
        (
          'orders',
          'stock_enforcement_applied',
          'boolean',
          false,
          'true'
        ),
        (
          'quote_email_jobs',
          'cancelled_at',
          'timestamp with time zone',
          true,
          null::text
        ),
        (
          'quote_email_jobs',
          'cancelled_by_actor_id',
          'text',
          true,
          null::text
        ),
        (
          'quote_requests',
          'admin_title',
          'text',
          true,
          null::text
        ),
        (
          'quote_requests',
          'intake_source',
          'text',
          false,
          $default$'customer_web'::text$default$
        ),
        (
          'quote_requests',
          'void_reason',
          'text',
          true,
          null::text
        ),
        (
          'quote_requests',
          'voided_at',
          'timestamp with time zone',
          true,
          null::text
        ),
        (
          'quote_requests',
          'voided_by_actor_id',
          'text',
          true,
          null::text
        )
    ) as required(
      table_name,
      column_name,
      data_type,
      nullable,
      default_equals
    )
   where not exists (
     select 1
       from information_schema.columns installed
      where installed.table_schema = 'public'
        and installed.table_name = required.table_name
        and installed.column_name = required.column_name
        and installed.data_type = required.data_type
        and installed.is_nullable = case
          when required.nullable then 'YES'
          else 'NO'
        end
        and case
          when required.default_equals is null then true
          when installed.column_default is null then false
          else regexp_replace(
            btrim(installed.column_default),
            '[[:space:]]+',
            ' ',
            'g'
          ) = regexp_replace(
            btrim(required.default_equals),
            '[[:space:]]+',
            ' ',
            'g'
          )
        end
   );

  if invalid_objects is not null then
    raise exception 'Schema contract has missing or incompatible columns: %',
      array_to_string(invalid_objects, ', ');
  end if;

  select array_agg(
           required.table_name || '.' || required.constraint_name
           order by required.table_name, required.constraint_name
         )
    into invalid_objects
    from (
      values
        (
          'inventory_policy_settings',
          'inventory_policy_settings_config_json_check',
          'c'::"char",
          $constraint$CHECK (jsonb_typeof(config_json) = 'object'::text AND config_json ? 'stockEnforcementEnabled'::text AND jsonb_typeof(config_json -> 'stockEnforcementEnabled'::text) = 'boolean'::text)$constraint$,
          array['stockEnforcementEnabled', 'jsonb_typeof', 'boolean']::text[],
          array[]::text[]
        ),
        (
          'orders',
          'orders_contract_status_check',
          'c'::"char",
          $constraint$CHECK (contract_status = ANY (ARRAY['pending_seller_acceptance'::text, 'accepted'::text, 'rejected'::text]))$constraint$,
          array['pending_seller_acceptance', 'accepted', 'rejected']::text[],
          array[]::text[]
        ),
        (
          'orders',
          'orders_delivery_plan_revision_positive_check',
          'c'::"char",
          $constraint$CHECK (delivery_plan_revision > 0)$constraint$,
          array['delivery_plan_revision']::text[],
          array[]::text[]
        ),
        (
          'order_documents',
          'order_documents_delivery_plan_revision_positive_check',
          'c'::"char",
          $constraint$CHECK (order_delivery_plan_revision > 0)$constraint$,
          array['order_delivery_plan_revision']::text[],
          array[]::text[]
        ),
        (
          'quote_email_jobs',
          'quote_email_jobs_cancellation_check',
          'c'::"char",
          $constraint$CHECK (status = 'cancelled'::text AND cancelled_at IS NOT NULL AND cancelled_by_actor_id IS NOT NULL AND btrim(cancelled_by_actor_id) <> ''::text OR status <> 'cancelled'::text AND cancelled_at IS NULL AND cancelled_by_actor_id IS NULL)$constraint$,
          array['cancelled_at', 'cancelled_by_actor_id']::text[],
          array[]::text[]
        ),
        (
          'quote_email_jobs',
          'quote_email_jobs_event_type_check',
          'c'::"char",
          $constraint$CHECK (event_type = ANY (ARRAY['quote_request_submitted'::text, 'quote_clarification_requested'::text, 'quote_issued'::text, 'quote_access_otp'::text, 'quote_accepted'::text, 'quote_declined'::text, 'quote_withdrawn'::text, 'quote_expired'::text, 'quote_request_closed'::text, 'quote_acceptance_blocked_stock'::text, 'quote_delivery_failed'::text]))$constraint$,
          array['quote_clarification_requested']::text[],
          array[]::text[]
        ),
        (
          'quote_email_jobs',
          'quote_email_jobs_status_check',
          'c'::"char",
          $constraint$CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'cancelled'::text]))$constraint$,
          array['cancelled']::text[],
          array[]::text[]
        ),
        (
          'quote_events',
          'quote_events_event_type_check',
          'c'::"char",
          $constraint$CHECK (event_type = ANY (ARRAY['request_received'::text, 'quote_request_details_changed'::text, 'draft_created'::text, 'draft_changed'::text, 'clarification_requested'::text, 'preview_generated'::text, 'offer_issued'::text, 'quote_email_queued'::text, 'quote_email_provider_accepted'::text, 'quote_email_provider_failed'::text, 'offer_viewed'::text, 'customer_acceptance_attempted'::text, 'acceptance_blocked_stock'::text, 'customer_accepted'::text, 'customer_declined'::text, 'customer_purchase_order_uploaded'::text, 'admin_document_uploaded'::text, 'admin_purchase_order_validated'::text, 'admin_purchase_order_rejected'::text, 'offer_withdrawn'::text, 'offer_expired'::text, 'offer_superseded'::text, 'new_version_issued'::text, 'request_closed_without_offer'::text, 'request_voided'::text, 'order_created'::text]))$constraint$,
          array[
            'admin_document_uploaded',
            'quote_request_details_changed',
            'request_voided'
          ]::text[],
          array[]::text[]
        ),
        (
          'quote_manual_documents',
          'quote_manual_documents_offer_request_fkey',
          'f'::"char",
          $constraint$FOREIGN KEY (quote_offer_version_id, quote_request_id) REFERENCES quote_offer_versions(id, quote_request_id) ON DELETE RESTRICT$constraint$,
          array['quote_offer_versions']::text[],
          array[]::text[]
        ),
        (
          'quote_offer_versions',
          'quote_offer_versions_issue_identity_check',
          'c'::"char",
          $constraint$CHECK (status = 'draft'::text AND offer_number IS NULL AND issued_at IS NULL AND issued_by_actor_type IS NULL AND issued_by_actor_id IS NULL AND is_current = false OR status <> 'draft'::text AND offer_number IS NOT NULL AND issued_at IS NOT NULL AND issued_by_actor_type IS NOT NULL AND valid_until IS NOT NULL AND valid_until > issued_at AND customer_snapshot_json <> '{}'::jsonb AND content_snapshot_json <> '{}'::jsonb AND NULLIF(btrim(delivery_terms), ''::text) IS NOT NULL AND NULLIF(btrim(payment_terms), ''::text) IS NOT NULL AND NULLIF(btrim(terms_version), ''::text) IS NOT NULL AND terms_hash IS NOT NULL AND content_hash IS NOT NULL)$constraint$,
          array['terms_version', 'terms_hash']::text[],
          array['terms_text']::text[]
        ),
        (
          'quote_requests',
          'quote_requests_admin_title_check',
          'c'::"char",
          $constraint$CHECK (admin_title IS NULL OR NULLIF(btrim(admin_title), ''::text) IS NOT NULL AND char_length(admin_title) <= 240)$constraint$,
          array['admin_title']::text[],
          array[]::text[]
        ),
        (
          'quote_requests',
          'quote_requests_intake_source_check',
          'c'::"char",
          $constraint$CHECK (intake_source = ANY (ARRAY['customer_web'::text, 'admin_email'::text, 'admin_testing'::text]))$constraint$,
          array['admin_email', 'admin_testing', 'customer_web']::text[],
          array[]::text[]
        ),
        (
          'quote_requests',
          'quote_requests_void_state_check',
          'c'::"char",
          $constraint$CHECK (voided_at IS NULL AND voided_by_actor_id IS NULL AND void_reason IS NULL OR voided_at IS NOT NULL AND NULLIF(btrim(voided_by_actor_id), ''::text) IS NOT NULL AND NULLIF(btrim(void_reason), ''::text) IS NOT NULL)$constraint$,
          array['void_reason', 'voided_at', 'voided_by_actor_id']::text[],
          array[]::text[]
        )
    ) as required(
      table_name,
      constraint_name,
      constraint_type,
      definition_equals,
      include_fragments,
      exclude_fragments
    )
   where not exists (
     select 1
       from pg_constraint installed
       join pg_class relation on relation.oid = installed.conrelid
       join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = required.table_name
        and installed.conname = required.constraint_name
        and installed.contype = required.constraint_type
        and installed.convalidated
        and regexp_replace(
          btrim(pg_get_constraintdef(installed.oid, true)),
          '[[:space:]]+',
          ' ',
          'g'
        ) = regexp_replace(
          btrim(required.definition_equals),
          '[[:space:]]+',
          ' ',
          'g'
        )
        and not exists (
          select 1
            from unnest(required.include_fragments) as fragment(value)
           where strpos(
             lower(pg_get_constraintdef(installed.oid, true)),
             lower(fragment.value)
           ) = 0
        )
        and not exists (
          select 1
            from unnest(required.exclude_fragments) as fragment(value)
           where strpos(
             lower(pg_get_constraintdef(installed.oid, true)),
             lower(fragment.value)
           ) > 0
        )
   );

  if invalid_objects is not null then
    raise exception 'Schema contract has missing or incompatible constraints: %',
      array_to_string(invalid_objects, ', ');
  end if;

  select array_agg(required.function_name order by required.function_name)
    into invalid_objects
    from (
      values
        (
          'guard_order_stock_hold_transition',
          '0b5106bd02a92cff965ec273b100899099f0ab746055921dd6188b38b83656d9',
          'plpgsql', false, false, false, null::text[],
          'v'::"char", 'u'::"char", 'trigger',
          array['legacy_unknown', 'released']::text[]
        ),
        (
          'guard_quote_append_only',
          '0306b06eee942dc6ac79d98902f35971187e6cdbcc9edc250844bc3630736672',
          'plpgsql', false, false, false, null::text[],
          'v'::"char", 'u'::"char", 'trigger',
          array['append-only', 'tg_op']::text[]
        ),
        (
          'guard_quote_offer_version',
          '943f71a7d3124575d72604faf233b751e454f89d986b1c3b75bf241f34831b0f',
          'plpgsql', false, false, false, null::text[],
          'v'::"char", 'u'::"char", 'trigger',
          array[
            'allowed_transition',
            'document_sha256',
            'expected_offer_number',
            'state_version must increase'
          ]::text[]
        ),
        (
          'guard_quote_offer_version_item',
          'c10fdddfbeae8732fd74c6d480e87e1fccace09db5f26c505abe1772408bb1b0',
          'plpgsql', false, false, false, null::text[],
          'v'::"char", 'u'::"char", 'trigger',
          array[
            'new_offer_status',
            'old_offer_status',
            'quote_offer_version_id',
            'draft'
          ]::text[]
        ),
        (
          'guard_quote_request_history',
          'b2fb9ad2b43582dc3f7ac3d89b16a43087f53772806a6d71405065ef9a44ede6',
          'plpgsql', false, false, false, null::text[],
          'v'::"char", 'u'::"char", 'trigger',
          array[
            'admin_details_changed',
            'admin_title',
            'testing_cleanup',
            'voiding'
          ]::text[]
        )
    ) as required(
      function_name,
      body_sha256,
      language_name,
      security_definer,
      leakproof,
      strict,
      configuration,
      volatility,
      parallel_safety,
      result_type,
      include_fragments
    )
   where not exists (
     select 1
       from pg_proc installed
       join pg_namespace namespace on namespace.oid = installed.pronamespace
       join pg_language language on language.oid = installed.prolang
      where namespace.nspname = 'public'
        and installed.proname = required.function_name
        and pg_get_function_identity_arguments(installed.oid) = ''
        and installed.prokind = 'f'
        and language.lanname = required.language_name
        and installed.prosecdef = required.security_definer
        and installed.proleakproof = required.leakproof
        and installed.proisstrict = required.strict
        and installed.proconfig is not distinct from required.configuration
        and installed.provolatile = required.volatility
        and installed.proparallel = required.parallel_safety
        and pg_get_function_result(installed.oid) = required.result_type
        and encode(
          public.digest(convert_to(installed.prosrc, 'UTF8'), 'sha256'),
          'hex'
        ) = required.body_sha256
        and not exists (
          select 1
            from unnest(required.include_fragments) as fragment(value)
           where strpos(
             lower(pg_get_functiondef(installed.oid)),
             lower(fragment.value)
           ) = 0
        )
   );

  if invalid_objects is not null then
    raise exception 'Schema contract has missing or incompatible functions: %',
      array_to_string(invalid_objects, ', ');
  end if;

  select array_agg(
           required.table_name || '.' || required.index_name
           order by required.table_name, required.index_name
         )
    into invalid_objects
    from (
      values
        (
          'order_items',
          'idx_order_items_order_id_ship_later',
          $index$CREATE INDEX idx_order_items_order_id_ship_later ON public.order_items USING btree (order_id, ship_later, id)$index$,
          array['order_items', '(order_id, ship_later, id)']::text[]
        ),
        (
          'quote_email_jobs',
          'idx_quote_email_jobs_pending',
          $index$CREATE INDEX idx_quote_email_jobs_pending ON public.quote_email_jobs USING btree (next_attempt_at, created_at, id) WHERE (status = 'pending'::text)$index$,
          array[
            'quote_email_jobs',
            '(next_attempt_at, created_at, id)',
            'status = ''pending'''
          ]::text[]
        ),
        (
          'quote_manual_documents',
          'idx_quote_manual_documents_offer_created_at',
          $index$CREATE INDEX idx_quote_manual_documents_offer_created_at ON public.quote_manual_documents USING btree (quote_offer_version_id, created_at DESC)$index$,
          array[
            'quote_manual_documents',
            '(quote_offer_version_id, created_at desc)'
          ]::text[]
        ),
        (
          'quote_manual_documents',
          'idx_quote_manual_documents_request_created_at',
          $index$CREATE INDEX idx_quote_manual_documents_request_created_at ON public.quote_manual_documents USING btree (quote_request_id, created_at DESC)$index$,
          array[
            'quote_manual_documents',
            '(quote_request_id, created_at desc)'
          ]::text[]
        ),
        (
          'quote_requests',
          'idx_quote_requests_voided_at',
          $index$CREATE INDEX idx_quote_requests_voided_at ON public.quote_requests USING btree (voided_at) WHERE (voided_at IS NOT NULL)$index$,
          array[
            'quote_requests',
            '(voided_at)',
            'voided_at is not null'
          ]::text[]
        )
    ) as required(
      table_name,
      index_name,
      definition_equals,
      include_fragments
    )
   where not exists (
     select 1
       from pg_index installed
       join pg_class index_relation on index_relation.oid = installed.indexrelid
       join pg_class table_relation on table_relation.oid = installed.indrelid
       join pg_namespace namespace on namespace.oid = index_relation.relnamespace
      where namespace.nspname = 'public'
        and table_relation.relname = required.table_name
        and index_relation.relname = required.index_name
        and installed.indisvalid
        and installed.indisready
        and regexp_replace(
          btrim(pg_get_indexdef(installed.indexrelid)),
          '[[:space:]]+',
          ' ',
          'g'
        ) = regexp_replace(
          btrim(required.definition_equals),
          '[[:space:]]+',
          ' ',
          'g'
        )
        and not exists (
          select 1
            from unnest(required.include_fragments) as fragment(value)
           where strpos(
             lower(pg_get_indexdef(installed.indexrelid)),
             lower(fragment.value)
           ) = 0
        )
   );

  if invalid_objects is not null then
    raise exception 'Schema contract has missing or invalid indexes: %',
      array_to_string(invalid_objects, ', ');
  end if;

  select array_agg(
           required.table_name || '.' || required.trigger_name
           order by required.table_name, required.trigger_name
         )
    into invalid_objects
    from (
      values
        (
          'order_stock_holds',
          'order_stock_holds_guard_transition',
          'guard_order_stock_hold_transition',
          $trigger$CREATE TRIGGER order_stock_holds_guard_transition BEFORE DELETE OR UPDATE ON order_stock_holds FOR EACH ROW EXECUTE FUNCTION guard_order_stock_hold_transition()$trigger$,
          array['before', 'update', 'delete', 'for each row']::text[]
        ),
        (
          'quote_events',
          'quote_events_append_only',
          'guard_quote_append_only',
          $trigger$CREATE TRIGGER quote_events_append_only BEFORE DELETE OR UPDATE ON quote_events FOR EACH ROW EXECUTE FUNCTION guard_quote_append_only()$trigger$,
          array['before', 'update', 'delete', 'for each row']::text[]
        ),
        (
          'quote_manual_documents',
          'quote_manual_documents_append_only',
          'guard_quote_append_only',
          $trigger$CREATE TRIGGER quote_manual_documents_append_only BEFORE DELETE OR UPDATE ON quote_manual_documents FOR EACH ROW EXECUTE FUNCTION guard_quote_append_only()$trigger$,
          array['before', 'update', 'delete', 'for each row']::text[]
        ),
        (
          'quote_offer_version_items',
          'quote_offer_version_items_guard',
          'guard_quote_offer_version_item',
          $trigger$CREATE TRIGGER quote_offer_version_items_guard BEFORE INSERT OR DELETE OR UPDATE ON quote_offer_version_items FOR EACH ROW EXECUTE FUNCTION guard_quote_offer_version_item()$trigger$,
          array[
            'before',
            'insert',
            'update',
            'delete',
            'for each row'
          ]::text[]
        ),
        (
          'quote_offer_versions',
          'quote_offer_versions_guard',
          'guard_quote_offer_version',
          $trigger$CREATE TRIGGER quote_offer_versions_guard BEFORE INSERT OR DELETE OR UPDATE ON quote_offer_versions FOR EACH ROW EXECUTE FUNCTION guard_quote_offer_version()$trigger$,
          array[
            'before',
            'insert',
            'update',
            'delete',
            'for each row'
          ]::text[]
        ),
        (
          'quote_requests',
          'quote_requests_guard_history',
          'guard_quote_request_history',
          $trigger$CREATE TRIGGER quote_requests_guard_history BEFORE DELETE OR UPDATE ON quote_requests FOR EACH ROW EXECUTE FUNCTION guard_quote_request_history()$trigger$,
          array['before', 'update', 'delete', 'for each row']::text[]
        )
    ) as required(
      table_name,
      trigger_name,
      function_name,
      definition_equals,
      include_fragments
    )
   where not exists (
     select 1
       from pg_trigger installed
       join pg_class relation on relation.oid = installed.tgrelid
       join pg_namespace namespace on namespace.oid = relation.relnamespace
       join pg_proc routine on routine.oid = installed.tgfoid
       join pg_namespace routine_namespace
         on routine_namespace.oid = routine.pronamespace
      where namespace.nspname = 'public'
        and routine_namespace.nspname = 'public'
        and relation.relname = required.table_name
        and installed.tgname = required.trigger_name
        and not installed.tgisinternal
        and installed.tgenabled = 'O'
        and routine.proname = required.function_name
        and regexp_replace(
          btrim(pg_get_triggerdef(installed.oid, true)),
          '[[:space:]]+',
          ' ',
          'g'
        ) = regexp_replace(
          btrim(required.definition_equals),
          '[[:space:]]+',
          ' ',
          'g'
        )
        and not exists (
          select 1
            from unnest(required.include_fragments) as fragment(value)
           where strpos(
             lower(pg_get_triggerdef(installed.oid, true)),
             lower(fragment.value)
           ) = 0
        )
   );

  if invalid_objects is not null then
    raise exception 'Schema contract has missing or disabled triggers: %',
      array_to_string(invalid_objects, ', ');
  end if;

  if not exists (
    select 1
     from inventory_policy_settings
     where key = 'default'
       and jsonb_typeof(config_json -> 'stockEnforcementEnabled') = 'boolean'
  ) then
    raise exception
      'Schema contract requires a boolean inventory_policy_settings.default.stockEnforcementEnabled';
  end if;
end;
$contract_verification$;

create table if not exists app_schema_contracts (
  contract_id text primary key,
  contract_sha256 text not null,
  installed_via text not null,
  recorded_at timestamptz not null default now(),
  constraint app_schema_contracts_checksum_check check (
    contract_sha256 ~ '^[a-f0-9]{64}$'
  ),
  constraint app_schema_contracts_installation_check check (
    installed_via in ('fresh_schema', 'existing_database')
  )
);

do $contract_ledger_shape$
declare
  invalid_objects text[];
begin
  select array_agg(required.column_name order by required.column_name)
    into invalid_objects
    from (
      values
        ('contract_id', 'text', false),
        ('contract_sha256', 'text', false),
        ('installed_via', 'text', false),
        ('recorded_at', 'timestamp with time zone', false)
    ) as required(column_name, data_type, nullable)
   where not exists (
     select 1
       from information_schema.columns installed
      where installed.table_schema = 'public'
        and installed.table_name = 'app_schema_contracts'
        and installed.column_name = required.column_name
        and installed.data_type = required.data_type
        and installed.is_nullable = case
          when required.nullable then 'YES'
          else 'NO'
        end
   );

  if invalid_objects is not null then
    raise exception 'Schema contract ledger has incompatible columns: %',
      array_to_string(invalid_objects, ', ');
  end if;

  select array_agg(required.constraint_name order by required.constraint_name)
    into invalid_objects
    from (
      values
        (
          'app_schema_contracts_pkey',
          'p'::"char",
          $constraint$PRIMARY KEY (contract_id)$constraint$,
          array['primary key', 'contract_id']::text[]
        ),
        (
          'app_schema_contracts_checksum_check',
          'c'::"char",
          $constraint$CHECK (contract_sha256 ~ '^[a-f0-9]{64}$'::text)$constraint$,
          array['contract_sha256', 'a-f0-9', '64']::text[]
        ),
        (
          'app_schema_contracts_installation_check',
          'c'::"char",
          $constraint$CHECK (installed_via = ANY (ARRAY['fresh_schema'::text, 'existing_database'::text]))$constraint$,
          array['installed_via', 'fresh_schema', 'existing_database']::text[]
        )
    ) as required(
      constraint_name,
      constraint_type,
      definition_equals,
      include_fragments
    )
   where not exists (
     select 1
       from pg_constraint installed
       join pg_class relation on relation.oid = installed.conrelid
       join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = 'app_schema_contracts'
        and installed.conname = required.constraint_name
        and installed.contype = required.constraint_type
        and installed.convalidated
        and regexp_replace(
          btrim(pg_get_constraintdef(installed.oid, true)),
          '[[:space:]]+',
          ' ',
          'g'
        ) = regexp_replace(
          btrim(required.definition_equals),
          '[[:space:]]+',
          ' ',
          'g'
        )
        and not exists (
          select 1
            from unnest(required.include_fragments) as fragment(value)
           where strpos(
             lower(pg_get_constraintdef(installed.oid, true)),
             lower(fragment.value)
           ) = 0
        )
   );

  if invalid_objects is not null then
    raise exception 'Schema contract ledger has incompatible constraints: %',
      array_to_string(invalid_objects, ', ');
  end if;
end;
$contract_ledger_shape$;

do $contract_identity$
begin
  if exists (
    select 1
      from app_schema_contracts
     where contract_id = '20260903.prelaunch-v1'
       and contract_sha256 <>
         '6aab79cb9019d38332d67e359a2b27c5ac3058fe8eae9c4400c735fca913c3d5'
  ) then
    raise exception
      'Schema contract 20260903.prelaunch-v1 already exists with another checksum';
  end if;
end;
$contract_identity$;

insert into app_schema_contracts (
  contract_id,
  contract_sha256,
  installed_via
)
values (
  '20260903.prelaunch-v1',
  '6aab79cb9019d38332d67e359a2b27c5ac3058fe8eae9c4400c735fca913c3d5',
  'existing_database'
)
on conflict (contract_id) do nothing;

commit;
