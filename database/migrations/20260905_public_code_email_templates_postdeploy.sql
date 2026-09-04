-- POST-DEPLOY DATA MIGRATION.
--
-- Apply only after the public-code-capable application has been deployed and
-- verified against schema contract 20260904.prelaunch-v2. Before execution,
-- pause order/quote creation and every email worker, then drain or explicitly
-- cancel/reconcile every deliverable customer job reported by the read-only
-- inventory in docs/quote-workflow-rollout.md.
--
-- The migration never changes a queued envelope. Order and quote jobs contain
-- already-rendered encrypted content, so rewriting settings cannot make a
-- legacy envelope safe.

begin;

set local search_path = public, pg_temp;
set local lock_timeout = '10s';
set local statement_timeout = '15min';

select pg_advisory_xact_lock(
  hashtext('atehna:public-code-email-templates:postdeploy:v1')
);

do $preconditions$
begin
  if current_setting(
    'atehna.public_code_email_templates_app_ready',
    true
  ) is distinct from 'v1' then
    raise exception using
      message = 'The public-code application deployment has not been acknowledged.',
      hint = 'In this same PostgreSQL session, set atehna.public_code_email_templates_app_ready = ''v1'' only after the new application is deployed and verified.';
  end if;

  if to_regclass('public.app_schema_contracts') is null
     or to_regclass('public.order_email_settings') is null
     or to_regclass('public.quote_email_settings') is null
     or to_regclass('public.order_email_jobs') is null
     or to_regclass('public.quote_email_jobs') is null then
    raise exception 'Canonical schema-contract, email-settings, and email-job tables are required.';
  end if;

  if not exists (
    select 1
      from public.app_schema_contracts
     where contract_id = '20260904.prelaunch-v2'
       and contract_sha256 =
         'afc67bcb1962a62a362fb10b5c5aaa3fe2407295bdd9d2408abd8ade57eb508c'
  ) then
    raise exception 'Schema contract 20260904.prelaunch-v2 is required before the post-deploy template migration.';
  end if;

  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'orders'
       and column_name = 'public_code_base'
       and data_type = 'text'
       and is_nullable = 'NO'
  ) or not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'quote_requests'
       and column_name = 'public_code_base'
       and data_type = 'text'
       and is_nullable = 'NO'
  ) then
    raise exception 'Order and quote public-code columns must be installed first.';
  end if;
end;
$preconditions$;

lock table public.order_email_settings,
  public.quote_email_settings,
  public.order_email_jobs,
  public.quote_email_jobs in share row exclusive mode;

-- A pending, processing, or failed customer job may still contain a rendered
-- sequential reference and may be sent automatically or by manual retry. Stop
-- before settings change so an operator can drain, cancel, or explicitly
-- reconcile it. Sent jobs and durably cancelled quote jobs cannot re-enter the
-- delivery path.
do $legacy_customer_envelope_gate$
declare
  order_job_count bigint;
  quote_job_count bigint;
  order_jobs_by_status jsonb;
  quote_jobs_by_status jsonb;
begin
  select coalesce(sum(status_count), 0),
         coalesce(jsonb_object_agg(status, status_count), '{}'::jsonb)
    into order_job_count, order_jobs_by_status
    from (
      select status, count(*)::bigint as status_count
        from public.order_email_jobs
       where audience = 'customer'
         and status in ('pending', 'processing', 'failed')
       group by status
    ) inventory;

  select coalesce(sum(status_count), 0),
         coalesce(jsonb_object_agg(status, status_count), '{}'::jsonb)
    into quote_job_count, quote_jobs_by_status
    from (
      select status, count(*)::bigint as status_count
        from public.quote_email_jobs
       where audience = 'customer'
         and status in ('pending', 'processing', 'failed')
       group by status
    ) inventory;

  if order_job_count > 0 or quote_job_count > 0 then
    raise exception using
      message = format(
        'Unsafe rendered customer email envelopes remain (orders: %s, quotes: %s).',
        order_job_count,
        quote_job_count
      ),
      detail = format(
        'order_statuses=%s; quote_statuses=%s',
        order_jobs_by_status,
        quote_jobs_by_status
      ),
      hint = 'Keep delivery and customer writes paused. Use the documented read-only inventory, then drain or explicitly cancel/reconcile every listed legacy job before retrying.';
  end if;
end;
$legacy_customer_envelope_gate$;

do $migrate_order_customer_templates$
declare
  settings jsonb;
  stored_version numeric;
  event_name text;
  audience_name text;
  field_name text;
  current_value text;
  admin_templates_before jsonb;
  admin_templates_after jsonb;
begin
  select config_json
    into settings
    from public.order_email_settings
   where key = 'order-email-notifications'
   for update;

  if found then
    if jsonb_typeof(settings) is distinct from 'object' then
      raise exception 'Order email settings must be a JSON object.';
    end if;

    if settings ? 'version'
       and jsonb_typeof(settings -> 'version') is distinct from 'number' then
      raise exception 'Order email-settings version must be numeric when present.';
    end if;

    if settings ? 'templates'
       and jsonb_typeof(settings -> 'templates') is distinct from 'object' then
      raise exception 'Order email-settings templates must be a JSON object when present.';
    end if;
    if exists (
      select 1
        from jsonb_each(coalesce(settings -> 'templates', '{}'::jsonb))
       where jsonb_typeof(value) is distinct from 'object'
    ) then
      raise exception 'Every order email template event must be a JSON object.';
    end if;

    stored_version := case
      when jsonb_typeof(settings -> 'version') = 'number'
        then (settings ->> 'version')::numeric
      else null
    end;

    if stored_version > 8 then
      raise exception 'Unsupported future order email-settings version: %.',
        stored_version;
    end if;

    if stored_version is distinct from 8 then
      select coalesce(
               jsonb_object_agg(
                 template_event.key,
                 coalesce(template_event.value -> 'admin', 'null'::jsonb)
               ),
               '{}'::jsonb
             )
        into admin_templates_before
        from jsonb_each(
          case
            when jsonb_typeof(settings -> 'templates') = 'object'
              then settings -> 'templates'
            else '{}'::jsonb
          end
        ) template_event;

      if jsonb_typeof(settings -> 'templates') = 'object' then
        for event_name in select jsonb_object_keys(settings -> 'templates') loop
          foreach audience_name in array array[
            'customer',
            'companyCustomer',
            'schoolCustomer'
          ] loop
            foreach field_name in array array[
              'subject',
              'contentHtml',
              'greeting',
              'heading',
              'body'
            ] loop
              if jsonb_typeof(
                settings #> array[
                  'templates',
                  event_name,
                  audience_name,
                  field_name
                ]
              ) = 'string' then
                current_value := settings #>> array[
                  'templates',
                  event_name,
                  audience_name,
                  field_name
                ];
                settings := jsonb_set(
                  settings,
                  array[
                    'templates',
                    event_name,
                    audience_name,
                    field_name
                  ],
                  to_jsonb(
                    regexp_replace(
                      current_value,
                      '\{\{[[:space:]]*order_number[[:space:]]*\}\}',
                      '{{order_code}}',
                      'g'
                    )
                  ),
                  false
                );
              end if;
            end loop;
          end loop;
        end loop;
      end if;

      settings := jsonb_set(settings, '{version}', '8'::jsonb, true);

      select coalesce(
               jsonb_object_agg(
                 template_event.key,
                 coalesce(template_event.value -> 'admin', 'null'::jsonb)
               ),
               '{}'::jsonb
             )
        into admin_templates_after
        from jsonb_each(
          case
            when jsonb_typeof(settings -> 'templates') = 'object'
              then settings -> 'templates'
            else '{}'::jsonb
          end
        ) template_event;

      if admin_templates_after is distinct from admin_templates_before then
        raise exception 'Order administrator templates changed unexpectedly.';
      end if;

      update public.order_email_settings
         set config_json = settings,
             updated_at = now()
       where key = 'order-email-notifications';
    end if;
  end if;
end;
$migrate_order_customer_templates$;

-- QUOTE TEMPLATE MIGRATION FOLLOWS.

do $migrate_quote_customer_templates$
declare
  settings jsonb;
  stored_version numeric;
  event_name text;
  audience_name text;
  field_name text;
  current_value text;
  request_replacement text;
  offer_replacement text;
  admin_templates_before jsonb;
  admin_templates_after jsonb;
begin
  select config_json
    into settings
    from public.quote_email_settings
   where key = 'default'
   for update;

  if found then
    if jsonb_typeof(settings) is distinct from 'object' then
      raise exception 'Quote email settings must be a JSON object.';
    end if;

    if settings ? 'version'
       and jsonb_typeof(settings -> 'version') is distinct from 'number' then
      raise exception 'Quote email-settings version must be numeric when present.';
    end if;

    if settings ? 'templates'
       and jsonb_typeof(settings -> 'templates') is distinct from 'object' then
      raise exception 'Quote email-settings templates must be a JSON object when present.';
    end if;
    if exists (
      select 1
        from jsonb_each(coalesce(settings -> 'templates', '{}'::jsonb))
       where jsonb_typeof(value) is distinct from 'object'
    ) then
      raise exception 'Every quote email template event must be a JSON object.';
    end if;

    stored_version := case
      when jsonb_typeof(settings -> 'version') = 'number'
        then (settings ->> 'version')::numeric
      else null
    end;

    if stored_version > 2 then
      raise exception 'Unsupported future quote email-settings version: %.',
        stored_version;
    end if;

    if stored_version is distinct from 2 then
      select coalesce(
               jsonb_object_agg(
                 template_event.key,
                 coalesce(template_event.value -> 'admin', 'null'::jsonb)
               ),
               '{}'::jsonb
             )
        into admin_templates_before
        from jsonb_each(coalesce(settings -> 'templates', '{}'::jsonb))
        template_event;

      if jsonb_typeof(settings -> 'templates') = 'object' then
        for event_name in select jsonb_object_keys(settings -> 'templates') loop
          request_replacement := case
            when event_name in (
              'quote_request_submitted',
              'quote_clarification_requested',
              'quote_request_closed'
            ) then 'quote_code'
            when event_name = 'quote_delivery_failed' then 'quote_code'
            when event_name in (
              'quote_issued',
              'quote_access_otp',
              'quote_accepted',
              'quote_declined',
              'quote_withdrawn',
              'quote_expired',
              'quote_acceptance_blocked_stock'
            ) then 'offer_code'
            else null
          end;
          offer_replacement := case
            when event_name in (
              'quote_request_submitted',
              'quote_clarification_requested',
              'quote_request_closed'
            ) then 'quote_code'
            when event_name = 'quote_delivery_failed' then 'offer_code'
            when event_name in (
              'quote_issued',
              'quote_access_otp',
              'quote_accepted',
              'quote_declined',
              'quote_withdrawn',
              'quote_expired',
              'quote_acceptance_blocked_stock'
            ) then 'offer_code'
            else null
          end;

          foreach audience_name in array array[
            'customer',
            'companyCustomer',
            'schoolCustomer'
          ] loop
            foreach field_name in array array[
              'subject',
              'contentHtml',
              'greeting',
              'heading',
              'body'
            ] loop
              if jsonb_typeof(
                settings #> array[
                  'templates',
                  event_name,
                  audience_name,
                  field_name
                ]
              ) = 'string' then
                current_value := settings #>> array[
                  'templates',
                  event_name,
                  audience_name,
                  field_name
                ];

                if request_replacement is not null then
                  current_value := regexp_replace(
                    current_value,
                    '\{\{[[:space:]]*request_number[[:space:]]*\}\}',
                    '{{' || request_replacement || '}}',
                    'g'
                  );
                end if;
                if offer_replacement is not null then
                  current_value := regexp_replace(
                    current_value,
                    '\{\{[[:space:]]*offer_number[[:space:]]*\}\}',
                    '{{' || offer_replacement || '}}',
                    'g'
                  );
                end if;

                settings := jsonb_set(
                  settings,
                  array[
                    'templates',
                    event_name,
                    audience_name,
                    field_name
                  ],
                  to_jsonb(current_value),
                  false
                );
              end if;
            end loop;
          end loop;
        end loop;
      end if;

      settings := jsonb_set(settings, '{version}', '2'::jsonb, true);

      select coalesce(
               jsonb_object_agg(
                 template_event.key,
                 coalesce(template_event.value -> 'admin', 'null'::jsonb)
               ),
               '{}'::jsonb
             )
        into admin_templates_after
        from jsonb_each(coalesce(settings -> 'templates', '{}'::jsonb))
        template_event;

      if admin_templates_after is distinct from admin_templates_before then
        raise exception 'Quote administrator templates changed unexpectedly.';
      end if;

      update public.quote_email_settings
         set config_json = settings,
             updated_at = now()
       where key = 'default';
    end if;
  end if;
end;
$migrate_quote_customer_templates$;

-- POSTCONDITIONS FOLLOW.

do $postconditions$
declare
  legacy_order_tokens bigint;
  legacy_quote_tokens bigint;
begin
  if exists (
    select 1
      from public.order_email_settings
     where key = 'order-email-notifications'
       and (
         jsonb_typeof(config_json -> 'version') is distinct from 'number'
         or (config_json ->> 'version')::numeric <> 8
       )
  ) then
    raise exception 'Order email settings did not reach version 8.';
  end if;

  if exists (
    select 1
      from public.quote_email_settings
     where key = 'default'
       and (
         jsonb_typeof(config_json -> 'version') is distinct from 'number'
         or (config_json ->> 'version')::numeric <> 2
       )
  ) then
    raise exception 'Quote email settings did not reach version 2.';
  end if;

  select count(*)
    into legacy_order_tokens
    from public.order_email_settings settings_row
    cross join lateral jsonb_each(
      case
        when jsonb_typeof(settings_row.config_json -> 'templates') = 'object'
          then settings_row.config_json -> 'templates'
        else '{}'::jsonb
      end
    ) template_event
    cross join lateral jsonb_each(template_event.value) template_audience
    cross join lateral jsonb_each_text(
      case
        when jsonb_typeof(template_audience.value) = 'object'
          then template_audience.value
        else '{}'::jsonb
      end
    ) template_field
   where settings_row.key = 'order-email-notifications'
     and template_audience.key in (
       'customer',
       'companyCustomer',
       'schoolCustomer'
     )
     and template_field.key in (
       'subject',
       'contentHtml',
       'greeting',
       'heading',
       'body'
     )
     and template_field.value ~
       '\{\{[[:space:]]*order_number[[:space:]]*\}\}';

  select count(*)
    into legacy_quote_tokens
    from public.quote_email_settings settings_row
    cross join lateral jsonb_each(
      case
        when jsonb_typeof(settings_row.config_json -> 'templates') = 'object'
          then settings_row.config_json -> 'templates'
        else '{}'::jsonb
      end
    ) template_event
    cross join lateral jsonb_each(template_event.value) template_audience
    cross join lateral jsonb_each_text(
      case
        when jsonb_typeof(template_audience.value) = 'object'
          then template_audience.value
        else '{}'::jsonb
      end
    ) template_field
   where settings_row.key = 'default'
     and template_audience.key in (
       'customer',
       'companyCustomer',
       'schoolCustomer'
     )
     and template_field.key in (
       'subject',
       'contentHtml',
       'greeting',
       'heading',
       'body'
     )
     and template_field.value ~
       '\{\{[[:space:]]*(request_number|offer_number)[[:space:]]*\}\}';

  if legacy_order_tokens > 0 or legacy_quote_tokens > 0 then
    raise exception using
      message = 'Legacy sequential customer-template variables remain.',
      detail = format(
        'order_fields=%s; quote_fields=%s',
        legacy_order_tokens,
        legacy_quote_tokens
      ),
      hint = 'Review unknown event keys and template structure; do not bypass this postcondition.';
  end if;
end;
$postconditions$;

commit;
