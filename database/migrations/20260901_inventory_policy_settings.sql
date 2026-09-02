-- Atehna additive deployment artifact: add one authoritative global switch for
-- enforcing stock limits across catalog ordering and quote/order commitments.
--
-- REVIEWED EXECUTION ONLY. Do not run this file from application startup.
-- Take and verify a database backup before applying it. Existing behavior stays
-- enabled unless an administrator explicitly disables the policy afterwards.

begin;

set local search_path = public, pg_temp;
set local lock_timeout = '10s';
set local statement_timeout = '15min';
select pg_advisory_xact_lock(hashtext('atehna-inventory-policy-settings-v1'));

create table inventory_policy_settings (
  key text primary key,
  config_json jsonb not null default '{"stockEnforcementEnabled": true}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint inventory_policy_settings_config_json_check check (
    jsonb_typeof(config_json) = 'object'
    and config_json ? 'stockEnforcementEnabled'
    and jsonb_typeof(config_json -> 'stockEnforcementEnabled') = 'boolean'
  )
);

insert into inventory_policy_settings (key, config_json)
values ('default', '{"stockEnforcementEnabled": true}'::jsonb);

do $$
declare
  installed_value jsonb;
begin
  select config_json
    into installed_value
    from inventory_policy_settings
   where key = 'default';

  if installed_value is null
     or jsonb_typeof(installed_value -> 'stockEnforcementEnabled') <> 'boolean' then
    raise exception 'The default inventory policy setting is missing or invalid.';
  end if;
end;
$$;

commit;
