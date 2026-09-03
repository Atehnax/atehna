-- Install the ordered short-prefix index on the currently active GURS table.
--
-- The address synchronizer swaps the active table by relation, so index names
-- are intentionally relation-specific and this artifact detects equivalence by
-- the active table OID and indexed expressions instead of by a fixed name.
-- Keep scheduled/manual GURS synchronization stopped while applying this file,
-- then deploy the synchronizer version that creates the same staging-table
-- index before synchronization is enabled again.
-- If the stored lease is already expired, the migration invalidates its token
-- and marks lingering running sync-history rows failed before continuing.

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

lock table public.gurs_address_sync_state in share row exclusive mode;
lock table public.gurs_address_sync_runs in share row exclusive mode;
lock table public.gurs_addresses in share mode;

do $index$
declare
  active_table regclass := 'public.gurs_addresses'::regclass;
  index_name text := format(
    'gurs_addresses_search_prefix_%s_idx',
    ('public.gurs_addresses'::regclass)::oid::text
  );
  equivalent_exists boolean;
begin
  if not exists (
    select 1
    from public.gurs_address_sync_state
    where key = 'active'
  ) then
    raise exception 'Active GURS sync state is missing.';
  end if;

  -- Invalidate an expired worker while holding the state-table lock. A worker
  -- that resumes later then fails its token-checked refresh/publish instead of
  -- swapping an unindexed table into service.
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
        last_error = 'Expired GURS sync lease cleared by prefix-index migration.'
    where key = 'active';

    update public.gurs_address_sync_runs
    set status = 'failed',
        finished_at = now(),
        error_message = coalesce(
          error_message,
          'Expired GURS sync lease cleared by prefix-index migration.'
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
      and installed.indnkeyatts = 4
      and installed.indnatts = 4
      and installed.indpred is null
      and installed.indexprs is null
      and pg_get_indexdef(installed.indexrelid, 1, true)
        = 'search_text'
      and pg_get_indexdef(installed.indexrelid, 2, true)
        = 'address_line_1'
      and installed.indcollation[0]
        = to_regcollation('pg_catalog."C"')
      and installed.indcollation[1]
        = to_regcollation('pg_catalog."C"')
      and pg_get_indexdef(installed.indexrelid, 3, true) = 'postal_code'
      and pg_get_indexdef(installed.indexrelid, 4, true)
        = 'gurs_house_number_id'
  ) into equivalent_exists;

  if not equivalent_exists then
    if to_regclass(format('public.%I', index_name)) is not null then
      raise exception 'Index-name collision: %', index_name;
    end if;

    execute format(
      'create index %I on public.gurs_addresses '
      || '(search_text collate "C", address_line_1 collate "C", '
      || 'postal_code, gurs_house_number_id)',
      index_name
    );
  end if;
end;
$index$;

do $verify$
declare
  active_table regclass := 'public.gurs_addresses'::regclass;
  equivalent_exists boolean;
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
      and installed.indnkeyatts = 4
      and installed.indnatts = 4
      and installed.indpred is null
      and installed.indexprs is null
      and pg_get_indexdef(installed.indexrelid, 1, true)
        = 'search_text'
      and pg_get_indexdef(installed.indexrelid, 2, true)
        = 'address_line_1'
      and installed.indcollation[0]
        = to_regcollation('pg_catalog."C"')
      and installed.indcollation[1]
        = to_regcollation('pg_catalog."C"')
      and pg_get_indexdef(installed.indexrelid, 3, true) = 'postal_code'
      and pg_get_indexdef(installed.indexrelid, 4, true)
        = 'gurs_house_number_id'
  ) into equivalent_exists;

  if not equivalent_exists then
    raise exception 'The active GURS prefix index was not installed.';
  end if;
end;
$verify$;

commit;
