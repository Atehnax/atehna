-- Run only with scripts/migrate-admin-auth.mjs, which verifies the existing contract
-- before this additive DDL and verifies the new contract before committing.

-- Single-administrator Better Auth storage; no public registration or setup endpoint.
create table if not exists admin_auth_user (
  id text constraint admin_auth_user_pkey primary key,
  name text not null,
  email text not null constraint admin_auth_user_email_key unique,
  "emailVerified" boolean not null default true,
  image text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  username text not null constraint admin_auth_user_username_key unique,
  "credentialVersion" integer not null default 1
);
create unique index if not exists admin_auth_user_singleton on admin_auth_user ((true));

create table if not exists admin_auth_account (
  id text constraint admin_auth_account_pkey primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null constraint admin_auth_account_user_fk references admin_auth_user(id) on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  scope text,
  password text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  constraint admin_auth_account_provider_account_key unique ("providerId", "accountId")
);

create table if not exists admin_auth_session (
  id text constraint admin_auth_session_pkey primary key,
  token text not null constraint admin_auth_session_token_key unique,
  "userId" text not null constraint admin_auth_session_user_fk references admin_auth_user(id) on delete cascade,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "ipAddress" text,
  "userAgent" text,
  "lastActivityAt" timestamptz not null default now(),
  "credentialVersion" integer not null
);
create index if not exists admin_auth_session_user_idx on admin_auth_session ("userId");
create index if not exists admin_auth_session_expiry_idx on admin_auth_session ("expiresAt");

create table if not exists admin_auth_verification (
  id text constraint admin_auth_verification_pkey primary key,
  identifier text not null,
  value text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null
);

create table if not exists admin_session_policy (
  id integer constraint admin_session_policy_pkey primary key constraint admin_session_policy_singleton_check check (id = 1),
  max_lifetime_days integer not null default 30 constraint admin_session_policy_lifetime_check check (max_lifetime_days between 1 and 90),
  idle_timeout_minutes integer not null default 30 constraint admin_session_policy_idle_check check (idle_timeout_minutes between 1 and 1440),
  updated_at timestamptz not null default now()
);
insert into admin_session_policy (id, max_lifetime_days, idle_timeout_minutes) values (1, 30, 30) on conflict (id) do nothing;

create table if not exists admin_login_attempt (
  key text constraint admin_login_attempt_pkey primary key,
  attempts integer not null,
  window_start timestamptz not null
);
create index if not exists admin_login_attempt_window_idx on admin_login_attempt (window_start);
