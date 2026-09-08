# Administrator account setup

The application uses one database-backed administrator account. Better Auth hashes
its password; usernames preserve case after surrounding whitespace is trimmed.
There is no public sign-up, account-creation API, email login, or automatic account
creation at startup. The database singleton index also prevents a second account.

## Runtime configuration

Retain the existing database connection and session secret when configured. No new
database or replacement credentials are needed. The deployment uses these server-only values:

- `DATABASE_URL`: the intended PostgreSQL database.
- `ADMIN_SESSION_SECRET`: a stable secret of at least 32 characters.
- `ADMIN_AUTH_URL`: the canonical application origin, for example
  `https://www.atehna-test.site`. Set this explicitly; a configured Vercel domain
  may be used as the deployment fallback.

Do not prefix any of these names with `NEXT_PUBLIC_`. Session lifetime and idle
expiry live in `admin_session_policy`; the initial values are 30 days and 30
minutes. The supported ranges are 1–90 days and 1–1440 minutes.

`ADMIN_USERNAME`, `ADMIN_PASSWORD` and `ADMIN_SESSION_TTL_SECONDS` are no longer runtime
configuration. Remove them after the one-time import below. Old stateless sessions
do not initialize or replace the database account.

## Database installation

For a verified empty database, install the canonical `database/schema.sql` using
the existing [fresh setup process](shipping-rollout.md). Do not apply that full
schema to an occupied database.

For an existing database on the exact `20260907.historical-orders-v6` contract,
this release includes one explicit additive upgrade:

```text
node scripts/migrate-admin-auth.mjs
```

Select the target by supplying `DATABASE_URL` to that process through your secure
operator environment. The command deliberately does not load `.env`, `.env.local`,
or deployment credentials automatically, and it never prints the connection URL.
Follow the environment's normal backup/recovery and deployment procedure before
running a write operation against it.

The runner validates the complete prior contract inside one transaction, creates
only the six auth tables/indexes and the initial session-policy row, records the
new contract, and verifies the complete new contract before committing. A mismatch
rolls everything back. A repeat run verifies the installed contract and preserves
existing accounts and settings. The SQL file under `database/migrations` is an
implementation input to this runner, not a standalone setup command. No build,
startup, request, or scheduled task runs migrations.

Run the read-only check with the same explicit target after installation:

```text
npm run check:database-schema
```

## Create the first account

With the intended `DATABASE_URL` explicitly set, run:

```text
node scripts/init-admin-account.mjs
```

The command checks the installed schema, prompts for a username, and prompts twice
for the password with terminal echo disabled. Usernames must contain 1–128
characters and no control characters; passwords must contain 12–128 characters.
Credentials are never accepted as command-line arguments or supplied by defaults.
An interactive terminal is required for prompts.

To preserve credentials that are already securely supplied as `ADMIN_USERNAME` and
`ADMIN_PASSWORD` in the operator's process, choose the explicit one-time import:

```text
node scripts/init-admin-account.mjs --import-legacy-env
```

The explicit legacy import preserves an existing nonempty password of 1–128
characters, including one shorter than the current new-password minimum. This
exception applies only to this offline import flag. Interactive initialization and
subsequent password changes continue to require 12–128 characters.

Do not put plaintext passwords into shell history. Both modes refuse to overwrite
an existing administrator. The initializer locks the account table, inserts the
user and Better Auth credential hash atomically, and records a security audit
event without credentials. Its opaque internal email is generated automatically
and is not an account sign-in or recovery address.

After successful setup, remove legacy credential/TTL variables from runtime
configuration and deploy with the database account available. Sign in using the
chosen username and password. Later account changes use the authenticated admin
settings flow; rerunning initialization is not a password-reset mechanism.

## Isolated browser tests

The disposable database preparation command requires explicit `E2E_ADMIN_USERNAME`
and `E2E_ADMIN_PASSWORD` values in addition to its existing isolation settings.
It creates the hashed test account only after verifying that the selected loopback
database is owned by that E2E namespace. There is no test-only login bypass or
public account-creation endpoint. The test server removes plaintext E2E and legacy
credential variables from its child process; tests authenticate against the same
database-backed login path as the application.
