-- Install covering postal-code and normalized postal-name prefix indexes on the
-- currently active GURS table. Future staging tables receive equivalent indexes
-- in GursAddressPgStore.indexStage before they are published.

begin;

set local search_path = public, pg_temp;
set local lock_timeout = '10s';
set local statement_timeout = '15min';

select pg_advisory_xact_lock(hashtext('gurs-address-sync-publish'));

do $guard$
begin
  if to_regclass('public.gurs_addresses') is null
     or to_regclass('public.gurs_address_sync_state') is null
     or to_regclass('public.gurs_address_sync_runs') is null then
    raise exception 'Canonical GURS tables are required.';
  end if;
end;
$guard$;

-- Compare expression indexes against a reference produced by this PostgreSQL
-- server instead of accepting a textual prefix. The deparser canonicalizes
-- casts and parentheses consistently for both relations, while still rejecting
-- lookalike indexes with different translate/regexp arguments.
create temporary table gurs_postal_lookup_index_reference (
  postal_name text not null,
  postal_code text not null
) on commit drop;

create index gurs_postal_lookup_index_reference_name_idx
  on gurs_postal_lookup_index_reference (
    (
      regexp_replace(
        translate(lower(postal_name), 'čšž', 'csz'),
        '[^a-z0-9]+',
        ' ',
        'g'
      )
    ) collate "C",
    postal_code collate "C",
    postal_name collate "C"
  );

lock table public.gurs_address_sync_state in share row exclusive mode;
lock table public.gurs_address_sync_runs in share row exclusive mode;
lock table public.gurs_addresses in share mode;

do $indexes$
declare
  active_table regclass := 'public.gurs_addresses'::regclass;
  code_index_name text := format(
    'gurs_addresses_postal_code_%s_idx',
    ('public.gurs_addresses'::regclass)::oid::text
  );
  name_index_name text := format(
    'gurs_addresses_postal_name_%s_idx',
    ('public.gurs_addresses'::regclass)::oid::text
  );
  code_index_exists boolean;
  name_index_exists boolean;
  expected_name_expression text := pg_get_indexdef(
    to_regclass('pg_temp.gurs_postal_lookup_index_reference_name_idx'),
    1,
    false
  );
begin
  if not exists (
    select 1
    from public.gurs_address_sync_state
    where key = 'active'
  ) then
    raise exception 'Active GURS sync state is missing.';
  end if;

  if exists (
    select 1
    from public.gurs_address_sync_state
    where key = 'active'
      and lock_token is not null
      and (lock_expires_at is null or lock_expires_at <= now())
  ) then
    update public.gurs_address_sync_state
    set lock_token = null,
        lock_expires_at = null,
        last_failure_at = now(),
        last_error = 'Expired GURS sync lease cleared by postal-index migration.'
    where key = 'active';

    update public.gurs_address_sync_runs
    set status = 'failed',
        finished_at = now(),
        error_message = coalesce(
          error_message,
          'Expired GURS sync lease cleared by postal-index migration.'
        )
    where status = 'running';
  end if;

  if exists (
    select 1
    from public.gurs_address_sync_state
    where key = 'active'
      and lock_token is not null
  ) then
    raise exception 'A GURS synchronization is active; retry after it finishes.';
  end if;

  select exists (
    select 1
    from pg_index installed
    join pg_class installed_index
      on installed_index.oid = installed.indexrelid
    join pg_am access_method
      on access_method.oid = installed_index.relam
    where installed.indrelid = active_table
      and installed.indisvalid
      and installed.indisready
      and not installed.indisunique
      and access_method.amname = 'btree'
      and installed.indnkeyatts = 2
      and installed.indnatts = 2
      and installed.indpred is null
      and installed.indexprs is null
      and pg_get_indexdef(installed.indexrelid, 1, true) = 'postal_code'
      and pg_get_indexdef(installed.indexrelid, 2, true) = 'postal_name'
      and installed.indcollation[0] = to_regcollation('pg_catalog."C"')
      and installed.indcollation[1] = to_regcollation('pg_catalog."C"')
  ) into code_index_exists;

  select exists (
    select 1
    from pg_index installed
    join pg_class installed_index
      on installed_index.oid = installed.indexrelid
    join pg_am access_method
      on access_method.oid = installed_index.relam
    where installed.indrelid = active_table
      and installed.indisvalid
      and installed.indisready
      and not installed.indisunique
      and access_method.amname = 'btree'
      and installed.indnkeyatts = 3
      and installed.indnatts = 3
      and installed.indpred is null
      and installed.indexprs is not null
      and pg_get_indexdef(installed.indexrelid, 1, false)
        = expected_name_expression
      and pg_get_indexdef(installed.indexrelid, 2, true) = 'postal_code'
      and pg_get_indexdef(installed.indexrelid, 3, true) = 'postal_name'
      and installed.indcollation[0] = to_regcollation('pg_catalog."C"')
      and installed.indcollation[1] = to_regcollation('pg_catalog."C"')
      and installed.indcollation[2] = to_regcollation('pg_catalog."C"')
  ) into name_index_exists;

  if not code_index_exists then
    if to_regclass(format('public.%I', code_index_name)) is not null then
      raise exception 'Index-name collision: %', code_index_name;
    end if;
    execute format(
      'create index %I on public.gurs_addresses '
      || '(postal_code collate "C", postal_name collate "C")',
      code_index_name
    );
  end if;

  if not name_index_exists then
    if to_regclass(format('public.%I', name_index_name)) is not null then
      raise exception 'Index-name collision: %', name_index_name;
    end if;
    execute format(
      'create index %I on public.gurs_addresses '
      || '((regexp_replace(translate(lower(postal_name), ''čšž'', ''csz''), '
      || '''[^a-z0-9]+'', '' '', ''g'')) collate "C", '
      || 'postal_code collate "C", postal_name collate "C")',
      name_index_name
    );
  end if;
end;
$indexes$;

do $verify$
declare
  active_table regclass := 'public.gurs_addresses'::regclass;
  code_index_exists boolean;
  name_index_exists boolean;
  expected_name_expression text := pg_get_indexdef(
    to_regclass('pg_temp.gurs_postal_lookup_index_reference_name_idx'),
    1,
    false
  );
begin
  select exists (
    select 1
    from pg_index installed
    join pg_class installed_index
      on installed_index.oid = installed.indexrelid
    join pg_am access_method
      on access_method.oid = installed_index.relam
    where installed.indrelid = active_table
      and installed.indisvalid
      and installed.indisready
      and not installed.indisunique
      and access_method.amname = 'btree'
      and installed.indnkeyatts = 2
      and installed.indnatts = 2
      and installed.indpred is null
      and installed.indexprs is null
      and pg_get_indexdef(installed.indexrelid, 1, true) = 'postal_code'
      and pg_get_indexdef(installed.indexrelid, 2, true) = 'postal_name'
      and installed.indcollation[0] = to_regcollation('pg_catalog."C"')
      and installed.indcollation[1] = to_regcollation('pg_catalog."C"')
  ) into code_index_exists;

  select exists (
    select 1
    from pg_index installed
    join pg_class installed_index
      on installed_index.oid = installed.indexrelid
    join pg_am access_method
      on access_method.oid = installed_index.relam
    where installed.indrelid = active_table
      and installed.indisvalid
      and installed.indisready
      and not installed.indisunique
      and access_method.amname = 'btree'
      and installed.indnkeyatts = 3
      and installed.indnatts = 3
      and installed.indpred is null
      and installed.indexprs is not null
      and pg_get_indexdef(installed.indexrelid, 1, false)
        = expected_name_expression
      and pg_get_indexdef(installed.indexrelid, 2, true) = 'postal_code'
      and pg_get_indexdef(installed.indexrelid, 3, true) = 'postal_name'
      and installed.indcollation[0] = to_regcollation('pg_catalog."C"')
      and installed.indcollation[1] = to_regcollation('pg_catalog."C"')
      and installed.indcollation[2] = to_regcollation('pg_catalog."C"')
  ) into name_index_exists;

  if not code_index_exists or not name_index_exists then
    raise exception 'The active GURS postal lookup indexes were not installed.';
  end if;
end;
$verify$;

commit;
