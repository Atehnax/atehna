-- Record the second terminal application/schema compatibility contract.
--
-- This is intentionally not a migration-history backfill. It proves that the
-- database reached the postconditions required by the application, then records
-- one deterministic contract identity shared with database/schema.sql.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '15min';
set local search_path = public, pg_temp;

select pg_advisory_xact_lock(
  hashtext('atehna:database-schema-contract:20260905.business-analytics-v3')
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
          'public_code_base',
          'text',
          false,
          'generate_public_code_base()'
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
          'public_code_base',
          'text',
          false,
          'generate_public_code_base()'
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
          'orders',
          'orders_public_code_base_check',
          'c'::"char",
          $constraint$CHECK (public_code_base ~ '^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{16}$'::text)$constraint$,
          array[
            'public_code_base',
            '23456789ABCDEFGHJKMNPQRSTVWXYZ',
            '{16}'
          ]::text[],
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
          'quote_requests_public_code_base_check',
          'c'::"char",
          $constraint$CHECK (public_code_base ~ '^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{16}$'::text)$constraint$,
          array[
            'public_code_base',
            '23456789ABCDEFGHJKMNPQRSTVWXYZ',
            '{16}'
          ]::text[],
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
          'generate_public_code_base',
          '2f0ce4ce20a2885783126ce3fd861003fd8d52fdccd27a70a675a13531ba5d44',
          'plpgsql', false, false, false, null::text[],
          'v'::"char", 'u'::"char", 'text',
          array[
            '23456789ABCDEFGHJKMNPQRSTVWXYZ',
            'gen_random_bytes',
            'byte_value < 240'
          ]::text[]
        ),
        (
          'guard_order_stock_hold_transition',
          '0b5106bd02a92cff965ec273b100899099f0ab746055921dd6188b38b83656d9',
          'plpgsql', false, false, false, null::text[],
          'v'::"char", 'u'::"char", 'trigger',
          array['legacy_unknown', 'released']::text[]
        ),
        (
          'guard_order_public_code_lineage',
          'd138d6268fa92deedab09c09f3eea333e54bc23887094119f140a71a1e219ee7',
          'plpgsql', false, false, false, null::text[],
          'v'::"char", 'u'::"char", 'trigger',
          array[
            'source_quote_offer_version_id',
            'quote_public_code_base',
            'new.public_code_base := quote_public_code_base',
            'pg_advisory_xact_lock',
            'return null'
          ]::text[]
        ),
        (
          'guard_quote_public_code_namespace',
          'f250bdf9d4860adf5fccd122619dc30b6a5d0be9453a4832bd1ef17901eee63b',
          'plpgsql', false, false, false, null::text[],
          'v'::"char", 'u'::"char", 'trigger',
          array[
            'pg_advisory_xact_lock',
            'public.orders',
            'return null'
          ]::text[]
        ),
        (
          'guard_public_code_base_immutable',
          '0af69f1d97e57789dd907d87d4d5a1e23ea493650a0a2bef6bc0d97b5f422e24',
          'plpgsql', false, false, false, null::text[],
          'v'::"char", 'u'::"char", 'trigger',
          array['public_code_base', 'immutable']::text[]
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
          public.digest(
            convert_to(
              replace(
                replace(installed.prosrc, chr(13) || chr(10), chr(10)),
                chr(13),
                chr(10)
              ),
              'UTF8'
            ),
            'sha256'
          ),
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
          'orders',
          'idx_orders_public_code_base',
          $index$CREATE UNIQUE INDEX idx_orders_public_code_base ON public.orders USING btree (public_code_base)$index$,
          array['orders', 'unique', '(public_code_base)']::text[]
        ),
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
        ),
        (
          'quote_requests',
          'idx_quote_requests_public_code_base',
          $index$CREATE UNIQUE INDEX idx_quote_requests_public_code_base ON public.quote_requests USING btree (public_code_base)$index$,
          array['quote_requests', 'unique', '(public_code_base)']::text[]
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
          'orders',
          'orders_guard_public_code_immutable',
          'guard_public_code_base_immutable',
          $trigger$CREATE TRIGGER orders_guard_public_code_immutable BEFORE UPDATE OF public_code_base ON orders FOR EACH ROW EXECUTE FUNCTION guard_public_code_base_immutable()$trigger$,
          array['before', 'update of public_code_base', 'for each row']::text[]
        ),
        (
          'orders',
          'orders_guard_public_code_lineage',
          'guard_order_public_code_lineage',
          $trigger$CREATE TRIGGER orders_guard_public_code_lineage BEFORE INSERT OR UPDATE OF public_code_base, source_quote_offer_version_id ON orders FOR EACH ROW EXECUTE FUNCTION guard_order_public_code_lineage()$trigger$,
          array[
            'before',
            'insert',
            'update of public_code_base',
            'source_quote_offer_version_id',
            'for each row'
          ]::text[]
        ),
        (
          'quote_requests',
          'quote_requests_guard_public_code_namespace',
          'guard_quote_public_code_namespace',
          $trigger$CREATE TRIGGER quote_requests_guard_public_code_namespace BEFORE INSERT ON quote_requests FOR EACH ROW EXECUTE FUNCTION guard_quote_public_code_namespace()$trigger$,
          array['before', 'insert', 'for each row']::text[]
        ),
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
        ),
        (
          'quote_requests',
          'quote_requests_guard_public_code_immutable',
          'guard_public_code_base_immutable',
          $trigger$CREATE TRIGGER quote_requests_guard_public_code_immutable BEFORE UPDATE OF public_code_base ON quote_requests FOR EACH ROW EXECUTE FUNCTION guard_public_code_base_immutable()$trigger$,
          array['before', 'update of public_code_base', 'for each row']::text[]
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

  -- Additional business analytics postconditions.
  if to_regclass('public.analytics_geography_backfill') is null then raise exception 'Missing analytics table: analytics_geography_backfill'; end if;
  if to_regclass('public.analytics_geography_references') is null then raise exception 'Missing analytics table: analytics_geography_references'; end if;
  if to_regclass('public.analytics_geography_state') is null then raise exception 'Missing analytics table: analytics_geography_state'; end if;
  if to_regclass('public.order_analytics_change_log') is null then raise exception 'Missing analytics table: order_analytics_change_log'; end if;
  if to_regclass('public.order_geography_audit') is null then raise exception 'Missing analytics table: order_geography_audit'; end if;
  if to_regclass('public.order_geography_resolutions') is null then raise exception 'Missing analytics table: order_geography_resolutions'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'analytics_geography_backfill' and column_name = 'source_version' and data_type = 'text' and is_nullable = 'NO') then raise exception 'Missing or incompatible analytics column: analytics_geography_backfill.source_version'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'analytics_geography_backfill' and column_name = 'after_order_id' and data_type = 'bigint' and is_nullable = 'NO' and column_default = '0') then raise exception 'Missing or incompatible analytics column: analytics_geography_backfill.after_order_id'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'analytics_geography_backfill' and column_name = 'processed_count' and data_type = 'bigint' and is_nullable = 'NO' and column_default = '0') then raise exception 'Missing or incompatible analytics column: analytics_geography_backfill.processed_count'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'analytics_geography_backfill' and column_name = 'completed_at' and data_type = 'timestamp with time zone' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: analytics_geography_backfill.completed_at'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'analytics_geography_backfill' and column_name = 'updated_at' and data_type = 'timestamp with time zone' and is_nullable = 'NO' and column_default = 'now()') then raise exception 'Missing or incompatible analytics column: analytics_geography_backfill.updated_at'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'analytics_geography_references' and column_name = 'version' and data_type = 'text' and is_nullable = 'NO') then raise exception 'Missing or incompatible analytics column: analytics_geography_references.version'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'analytics_geography_references' and column_name = 'imported_at' and data_type = 'timestamp with time zone' and is_nullable = 'NO') then raise exception 'Missing or incompatible analytics column: analytics_geography_references.imported_at'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'analytics_geography_references' and column_name = 'metadata_json' and data_type = 'jsonb' and is_nullable = 'NO') then raise exception 'Missing or incompatible analytics column: analytics_geography_references.metadata_json'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'analytics_geography_references' and column_name = 'full_geometry_json' and data_type = 'jsonb' and is_nullable = 'NO') then raise exception 'Missing or incompatible analytics column: analytics_geography_references.full_geometry_json'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'analytics_geography_references' and column_name = 'render_geometry_json' and data_type = 'jsonb' and is_nullable = 'NO') then raise exception 'Missing or incompatible analytics column: analytics_geography_references.render_geometry_json'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'analytics_geography_references' and column_name = 'status' and data_type = 'text' and is_nullable = 'NO') then raise exception 'Missing or incompatible analytics column: analytics_geography_references.status'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'analytics_geography_references' and column_name = 'created_at' and data_type = 'timestamp with time zone' and is_nullable = 'NO' and column_default = 'now()') then raise exception 'Missing or incompatible analytics column: analytics_geography_references.created_at'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'analytics_geography_state' and column_name = 'key' and data_type = 'text' and is_nullable = 'NO') then raise exception 'Missing or incompatible analytics column: analytics_geography_state.key'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'analytics_geography_state' and column_name = 'reporting_version' and data_type = 'text' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: analytics_geography_state.reporting_version'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'analytics_geography_state' and column_name = 'latest_version' and data_type = 'text' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: analytics_geography_state.latest_version'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'analytics_geography_state' and column_name = 'last_attempt_at' and data_type = 'timestamp with time zone' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: analytics_geography_state.last_attempt_at'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'analytics_geography_state' and column_name = 'last_success_at' and data_type = 'timestamp with time zone' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: analytics_geography_state.last_success_at'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'analytics_geography_state' and column_name = 'last_error' and data_type = 'text' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: analytics_geography_state.last_error'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gurs_addresses' and column_name = 'official_address_id' and data_type = 'text' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: gurs_addresses.official_address_id'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gurs_addresses' and column_name = 'municipality_id' and data_type = 'text' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: gurs_addresses.municipality_id'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gurs_addresses' and column_name = 'region_id' and data_type = 'text' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: gurs_addresses.region_id'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gurs_addresses' and column_name = 'easting' and data_type = 'numeric' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: gurs_addresses.easting'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gurs_addresses' and column_name = 'northing' and data_type = 'numeric' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: gurs_addresses.northing'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_analytics_change_log' and column_name = 'id' and data_type = 'bigint' and is_nullable = 'NO' and column_default = 'nextval(''order_analytics_change_log_id_seq''::regclass)') then raise exception 'Missing or incompatible analytics column: order_analytics_change_log.id'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_analytics_change_log' and column_name = 'order_id' and data_type = 'bigint' and is_nullable = 'NO') then raise exception 'Missing or incompatible analytics column: order_analytics_change_log.order_id'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_analytics_change_log' and column_name = 'revision' and data_type = 'integer' and is_nullable = 'NO') then raise exception 'Missing or incompatible analytics column: order_analytics_change_log.revision'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_analytics_change_log' and column_name = 'changed_at' and data_type = 'timestamp with time zone' and is_nullable = 'NO' and column_default = 'now()') then raise exception 'Missing or incompatible analytics column: order_analytics_change_log.changed_at'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_analytics_change_log' and column_name = 'actor_id' and data_type = 'text' and is_nullable = 'NO') then raise exception 'Missing or incompatible analytics column: order_analytics_change_log.actor_id'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_analytics_change_log' and column_name = 'reason' and data_type = 'text' and is_nullable = 'NO') then raise exception 'Missing or incompatible analytics column: order_analytics_change_log.reason'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_analytics_change_log' and column_name = 'before_json' and data_type = 'jsonb' and is_nullable = 'NO') then raise exception 'Missing or incompatible analytics column: order_analytics_change_log.before_json'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_analytics_change_log' and column_name = 'after_json' and data_type = 'jsonb' and is_nullable = 'NO') then raise exception 'Missing or incompatible analytics column: order_analytics_change_log.after_json'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_geography_audit' and column_name = 'id' and data_type = 'bigint' and is_nullable = 'NO' and column_default = 'nextval(''order_geography_audit_id_seq''::regclass)') then raise exception 'Missing or incompatible analytics column: order_geography_audit.id'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_geography_audit' and column_name = 'order_id' and data_type = 'bigint' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: order_geography_audit.order_id'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_geography_audit' and column_name = 'action' and data_type = 'text' and is_nullable = 'NO') then raise exception 'Missing or incompatible analytics column: order_geography_audit.action'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_geography_audit' and column_name = 'actor' and data_type = 'text' and is_nullable = 'NO') then raise exception 'Missing or incompatible analytics column: order_geography_audit.actor'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_geography_audit' and column_name = 'reason' and data_type = 'text' and is_nullable = 'NO') then raise exception 'Missing or incompatible analytics column: order_geography_audit.reason'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_geography_audit' and column_name = 'previous_json' and data_type = 'jsonb' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: order_geography_audit.previous_json'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_geography_audit' and column_name = 'next_json' and data_type = 'jsonb' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: order_geography_audit.next_json'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_geography_audit' and column_name = 'created_at' and data_type = 'timestamp with time zone' and is_nullable = 'NO' and column_default = 'now()') then raise exception 'Missing or incompatible analytics column: order_geography_audit.created_at'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_geography_resolutions' and column_name = 'order_id' and data_type = 'bigint' and is_nullable = 'NO') then raise exception 'Missing or incompatible analytics column: order_geography_resolutions.order_id'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_geography_resolutions' and column_name = 'address_basis' and data_type = 'text' and is_nullable = 'NO') then raise exception 'Missing or incompatible analytics column: order_geography_resolutions.address_basis'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_geography_resolutions' and column_name = 'address_fingerprint' and data_type = 'text' and is_nullable = 'NO') then raise exception 'Missing or incompatible analytics column: order_geography_resolutions.address_fingerprint'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_geography_resolutions' and column_name = 'address_snapshot_json' and data_type = 'jsonb' and is_nullable = 'NO') then raise exception 'Missing or incompatible analytics column: order_geography_resolutions.address_snapshot_json'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_geography_resolutions' and column_name = 'official_address_id' and data_type = 'text' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: order_geography_resolutions.official_address_id'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_geography_resolutions' and column_name = 'municipality_id' and data_type = 'text' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: order_geography_resolutions.municipality_id'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_geography_resolutions' and column_name = 'region_id' and data_type = 'text' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: order_geography_resolutions.region_id'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_geography_resolutions' and column_name = 'resolution_status' and data_type = 'text' and is_nullable = 'NO') then raise exception 'Missing or incompatible analytics column: order_geography_resolutions.resolution_status'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_geography_resolutions' and column_name = 'resolution_method' and data_type = 'text' and is_nullable = 'NO') then raise exception 'Missing or incompatible analytics column: order_geography_resolutions.resolution_method'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_geography_resolutions' and column_name = 'source_version' and data_type = 'text' and is_nullable = 'NO') then raise exception 'Missing or incompatible analytics column: order_geography_resolutions.source_version'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_geography_resolutions' and column_name = 'resolved_at' and data_type = 'timestamp with time zone' and is_nullable = 'NO' and column_default = 'now()') then raise exception 'Missing or incompatible analytics column: order_geography_resolutions.resolved_at'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_geography_resolutions' and column_name = 'manual_override' and data_type = 'boolean' and is_nullable = 'NO' and column_default = 'false') then raise exception 'Missing or incompatible analytics column: order_geography_resolutions.manual_override'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_items' and column_name = 'historical_unit_cost_net' and data_type = 'numeric' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: order_items.historical_unit_cost_net'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_line_snapshots' and column_name = 'historical_unit_cost_net' and data_type = 'numeric' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: order_line_snapshots.historical_unit_cost_net'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'analytics_submitted_at' and data_type = 'timestamp with time zone' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: orders.analytics_submitted_at'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'analytics_snapshot_json' and data_type = 'jsonb' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: orders.analytics_snapshot_json'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'analytics_fulfilled_at' and data_type = 'timestamp with time zone' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: orders.analytics_fulfilled_at'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'analytics_fulfilled_lines_json' and data_type = 'jsonb' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: orders.analytics_fulfilled_lines_json'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'analytics_fulfilled_merchandise_net' and data_type = 'numeric' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: orders.analytics_fulfilled_merchandise_net'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'analytics_fulfilment_origin' and data_type = 'text' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: orders.analytics_fulfilment_origin'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'analytics_is_test' and data_type = 'boolean' and is_nullable = 'NO' and column_default = 'false') then raise exception 'Missing or incompatible analytics column: orders.analytics_is_test'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'customer_directory_profile_id' and data_type = 'text' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: orders.customer_directory_profile_id'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'school_directory_row_id' and data_type = 'text' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: orders.school_directory_row_id'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'actual_packed_weight_grams' and data_type = 'bigint' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: orders.actual_packed_weight_grams'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'actual_carrier_cost_net' and data_type = 'numeric' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: orders.actual_carrier_cost_net'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'actual_parcel_count' and data_type = 'integer' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: orders.actual_parcel_count'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'preparation_minutes' and data_type = 'numeric' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: orders.preparation_minutes'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'actual_oversize' and data_type = 'boolean' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: orders.actual_oversize'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'actual_length_mm' and data_type = 'integer' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: orders.actual_length_mm'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'actual_width_mm' and data_type = 'integer' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: orders.actual_width_mm'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'actual_height_mm' and data_type = 'integer' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: orders.actual_height_mm'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'merchandise_refund_net' and data_type = 'numeric' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: orders.merchandise_refund_net'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'refund_history_complete' and data_type = 'boolean' and is_nullable = 'NO' and column_default = 'false') then raise exception 'Missing or incompatible analytics column: orders.refund_history_complete'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'shipping_tax_rate' and data_type = 'numeric' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: orders.shipping_tax_rate'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'analytics_measurement_revision' and data_type = 'integer' and is_nullable = 'NO' and column_default = '0') then raise exception 'Missing or incompatible analytics column: orders.analytics_measurement_revision'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'analytics_measured_at' and data_type = 'timestamp with time zone' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: orders.analytics_measured_at'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'analytics_measured_by' and data_type = 'text' and is_nullable = 'YES') then raise exception 'Missing or incompatible analytics column: orders.analytics_measured_by'; end if;
  if not exists (select 1 from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace where pg_namespace.nspname = 'public' and proname = 'capture_order_analytics_snapshot' and encode(public.digest(convert_to(replace(replace(prosrc, chr(13) || chr(10), chr(10)), chr(13), chr(10)), 'UTF8'), 'sha256'), 'hex') = '47edc41a9a2dc390a73f375af91f13e3d7885f9f4bae764219b0fdd987473cfe') then raise exception 'Analytics function mismatch: capture_order_analytics_snapshot'; end if;
  if not exists (select 1 from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace where pg_namespace.nspname = 'public' and proname = 'capture_order_historical_cost' and encode(public.digest(convert_to(replace(replace(prosrc, chr(13) || chr(10), chr(10)), chr(13), chr(10)), 'UTF8'), 'sha256'), 'hex') = '3a581cff5127f62325dd5c584edfa5af8e30f5b80ae2139d52a4863ca635f53d') then raise exception 'Analytics function mismatch: capture_order_historical_cost'; end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.order_items'::regclass and tgname = 'order_items_capture_historical_cost' and tgenabled = 'O' and pg_get_triggerdef(oid, true) = 'CREATE TRIGGER order_items_capture_historical_cost BEFORE INSERT ON order_items FOR EACH ROW EXECUTE FUNCTION capture_order_historical_cost()') then raise exception 'Analytics trigger mismatch: order_items_capture_historical_cost'; end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.order_line_snapshots'::regclass and tgname = 'order_line_snapshots_capture_historical_cost' and tgenabled = 'O' and pg_get_triggerdef(oid, true) = 'CREATE TRIGGER order_line_snapshots_capture_historical_cost BEFORE INSERT ON order_line_snapshots FOR EACH ROW EXECUTE FUNCTION capture_order_historical_cost()') then raise exception 'Analytics trigger mismatch: order_line_snapshots_capture_historical_cost'; end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.orders'::regclass and tgname = 'orders_capture_analytics_snapshot' and tgenabled = 'O' and pg_get_triggerdef(oid, true) = 'CREATE TRIGGER orders_capture_analytics_snapshot BEFORE INSERT OR UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION capture_order_analytics_snapshot()') then raise exception 'Analytics trigger mismatch: orders_capture_analytics_snapshot'; end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.analytics_geography_references'::regclass and conname = 'analytics_geography_references_status_check' and convalidated and pg_get_constraintdef(oid, true) = 'CHECK (status = ANY (ARRAY[''staged''::text, ''validated''::text]))') then raise exception 'Analytics constraint mismatch: analytics_geography_references_status_check'; end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.analytics_geography_state'::regclass and conname = 'analytics_geography_state_key_check' and convalidated and pg_get_constraintdef(oid, true) = 'CHECK (key = ''active''::text)') then raise exception 'Analytics constraint mismatch: analytics_geography_state_key_check'; end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.analytics_geography_state'::regclass and conname = 'analytics_geography_state_latest_version_fkey' and convalidated and pg_get_constraintdef(oid, true) = 'FOREIGN KEY (latest_version) REFERENCES analytics_geography_references(version)') then raise exception 'Analytics constraint mismatch: analytics_geography_state_latest_version_fkey'; end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.analytics_geography_state'::regclass and conname = 'analytics_geography_state_reporting_version_fkey' and convalidated and pg_get_constraintdef(oid, true) = 'FOREIGN KEY (reporting_version) REFERENCES analytics_geography_references(version)') then raise exception 'Analytics constraint mismatch: analytics_geography_state_reporting_version_fkey'; end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.order_analytics_change_log'::regclass and conname = 'order_analytics_change_log_json_check' and convalidated and pg_get_constraintdef(oid, true) = 'CHECK (jsonb_typeof(before_json) = ''object''::text AND jsonb_typeof(after_json) = ''object''::text)') then raise exception 'Analytics constraint mismatch: order_analytics_change_log_json_check'; end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.order_analytics_change_log'::regclass and conname = 'order_analytics_change_log_reason_check' and convalidated and pg_get_constraintdef(oid, true) = 'CHECK (length(btrim(reason)) >= 3 AND length(btrim(reason)) <= 2000)') then raise exception 'Analytics constraint mismatch: order_analytics_change_log_reason_check'; end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.order_analytics_change_log'::regclass and conname = 'order_analytics_change_log_revision_check' and convalidated and pg_get_constraintdef(oid, true) = 'CHECK (revision > 0)') then raise exception 'Analytics constraint mismatch: order_analytics_change_log_revision_check'; end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.order_geography_resolutions'::regclass and conname = 'order_geography_resolutions_order_id_fkey' and convalidated and pg_get_constraintdef(oid, true) = 'FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE') then raise exception 'Analytics constraint mismatch: order_geography_resolutions_order_id_fkey'; end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.order_geography_resolutions'::regclass and conname = 'order_geography_resolutions_resolution_status_check' and convalidated and pg_get_constraintdef(oid, true) = 'CHECK (resolution_status = ANY (ARRAY[''municipality''::text, ''region_only''::text, ''ambiguous''::text, ''unmatched''::text, ''partial''::text, ''foreign''::text, ''unknown_country''::text]))') then raise exception 'Analytics constraint mismatch: order_geography_resolutions_resolution_status_check'; end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.order_items'::regclass and conname = 'order_items_historical_cost_check' and convalidated and pg_get_constraintdef(oid, true) = 'CHECK (historical_unit_cost_net IS NULL OR historical_unit_cost_net >= 0::numeric)') then raise exception 'Analytics constraint mismatch: order_items_historical_cost_check'; end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.order_line_snapshots'::regclass and conname = 'order_line_snapshots_historical_cost_check' and convalidated and pg_get_constraintdef(oid, true) = 'CHECK (historical_unit_cost_net IS NULL OR historical_unit_cost_net >= 0::numeric)') then raise exception 'Analytics constraint mismatch: order_line_snapshots_historical_cost_check'; end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.orders'::regclass and conname = 'orders_analytics_measurements_check' and convalidated and pg_get_constraintdef(oid, true) = 'CHECK ((actual_packed_weight_grams IS NULL OR actual_packed_weight_grams > 0) AND (actual_carrier_cost_net IS NULL OR actual_carrier_cost_net >= 0::numeric) AND (actual_parcel_count IS NULL OR actual_parcel_count > 0) AND (preparation_minutes IS NULL OR preparation_minutes >= 0::numeric) AND (actual_length_mm IS NULL OR actual_length_mm > 0) AND (actual_width_mm IS NULL OR actual_width_mm > 0) AND (actual_height_mm IS NULL OR actual_height_mm > 0) AND (merchandise_refund_net IS NULL OR merchandise_refund_net >= 0::numeric) AND (NOT refund_history_complete OR merchandise_refund_net IS NOT NULL) AND (shipping_tax_rate IS NULL OR shipping_tax_rate >= 0::numeric AND shipping_tax_rate <= 1::numeric) AND (analytics_fulfilled_merchandise_net IS NULL OR analytics_fulfilled_merchandise_net >= 0::numeric) AND (analytics_fulfilment_origin IS NULL OR (analytics_fulfilment_origin = ANY (ARRAY[''captured''::text, ''legacy''::text]))) AND analytics_measurement_revision >= 0 AND (analytics_snapshot_json IS NULL OR jsonb_typeof(analytics_snapshot_json) = ''object''::text))') then raise exception 'Analytics constraint mismatch: orders_analytics_measurements_check'; end if;
  if not exists (select 1 from pg_index join pg_class on pg_class.oid = pg_index.indexrelid where relname = 'order_geography_audit_pkey' and indisvalid and indisready and pg_get_indexdef(pg_index.indexrelid) = 'CREATE UNIQUE INDEX order_geography_audit_pkey ON public.order_geography_audit USING btree (id)') then raise exception 'Analytics index mismatch: order_geography_audit_pkey'; end if;
  if not exists (select 1 from pg_index join pg_class on pg_class.oid = pg_index.indexrelid where relname = 'order_geography_municipality_idx' and indisvalid and indisready and pg_get_indexdef(pg_index.indexrelid) = 'CREATE INDEX order_geography_municipality_idx ON public.order_geography_resolutions USING btree (source_version, municipality_id, order_id)') then raise exception 'Analytics index mismatch: order_geography_municipality_idx'; end if;
  if not exists (select 1 from pg_index join pg_class on pg_class.oid = pg_index.indexrelid where relname = 'order_geography_region_idx' and indisvalid and indisready and pg_get_indexdef(pg_index.indexrelid) = 'CREATE INDEX order_geography_region_idx ON public.order_geography_resolutions USING btree (source_version, region_id, order_id)') then raise exception 'Analytics index mismatch: order_geography_region_idx'; end if;
  if not exists (select 1 from pg_index join pg_class on pg_class.oid = pg_index.indexrelid where relname = 'order_geography_resolutions_pkey' and indisvalid and indisready and pg_get_indexdef(pg_index.indexrelid) = 'CREATE UNIQUE INDEX order_geography_resolutions_pkey ON public.order_geography_resolutions USING btree (order_id)') then raise exception 'Analytics index mismatch: order_geography_resolutions_pkey'; end if;
  if not exists (select 1 from pg_index join pg_class on pg_class.oid = pg_index.indexrelid where relname = 'order_geography_unresolved_idx' and indisvalid and indisready and pg_get_indexdef(pg_index.indexrelid) = 'CREATE INDEX order_geography_unresolved_idx ON public.order_geography_resolutions USING btree (resolution_status, order_id)') then raise exception 'Analytics index mismatch: order_geography_unresolved_idx'; end if;
  if not exists (select 1 from pg_index join pg_class on pg_class.oid = pg_index.indexrelid where relname = 'orders_analytics_activity_idx' and indisvalid and indisready and pg_get_indexdef(pg_index.indexrelid) = 'CREATE INDEX orders_analytics_activity_idx ON public.orders USING btree (analytics_submitted_at, customer_type, status) WHERE ((NOT is_draft) AND (NOT analytics_is_test))') then raise exception 'Analytics index mismatch: orders_analytics_activity_idx'; end if;
  if not exists (select 1 from pg_index join pg_class on pg_class.oid = pg_index.indexrelid where relname = 'orders_analytics_customer_idx' and indisvalid and indisready and pg_get_indexdef(pg_index.indexrelid) = 'CREATE INDEX orders_analytics_customer_idx ON public.orders USING btree (customer_directory_profile_id, analytics_submitted_at) WHERE (customer_directory_profile_id IS NOT NULL)') then raise exception 'Analytics index mismatch: orders_analytics_customer_idx'; end if;
  if not exists (select 1 from pg_index join pg_class on pg_class.oid = pg_index.indexrelid where relname = 'orders_analytics_school_idx' and indisvalid and indisready and pg_get_indexdef(pg_index.indexrelid) = 'CREATE INDEX orders_analytics_school_idx ON public.orders USING btree (school_directory_row_id, analytics_submitted_at) WHERE (school_directory_row_id IS NOT NULL)') then raise exception 'Analytics index mismatch: orders_analytics_school_idx'; end if;
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
     where contract_id = '20260905.business-analytics-v3'
       and contract_sha256 <>
          '78e564076da773ea1323dbf9b3befe40e2dc9374bf7d8b0cb818024559d09fdf'
  ) then
    raise exception
      'Schema contract 20260905.business-analytics-v3 already exists with another checksum';
  end if;
end;
$contract_identity$;

insert into app_schema_contracts (
  contract_id,
  contract_sha256,
  installed_via
)
values (
  '20260905.business-analytics-v3',
  '78e564076da773ea1323dbf9b3befe40e2dc9374bf7d8b0cb818024559d09fdf',
  'existing_database'
)
on conflict (contract_id) do nothing;

commit;
