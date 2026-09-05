# Atehna

# Synopsis
Product catalogue, purchasing flow, admin order management, appearance controls,
archive retention, and analytics dashboards.

# Description
Atehna includes:
- Customer catalogue, product detail, cart, order, and token-protected
  confirmation pages.
- `/admin/artikli` product lifecycle management with variants and configurable
  option axes.
- `/admin/podoba/artikli` catalogue, product-page, and cart presentation
  settings.
- `/admin/orders` with compact analytics previews and order operations.
- `/admin/email` controls automatic customer and administrator order emails.
- `/admin/analitika` with a dark pro-grade dashboard and a DB-persisted custom chart builder.

## Admin analytics extension guide

### Add a new metric or dimension source
1. Extend the analytics payload in `src/shared/server/orderAnalytics.ts` (`OrdersAnalyticsDay`) and compute the field in `fetchOrdersAnalytics`.
2. Ensure `GET /api/admin/analytics/orders` returns the new field (already passes through server payload).
3. Register the metric in builder/UI options inside `src/admin/components/AdminAnalyticsDashboard.tsx` (`metricOptions`) and (optionally) add system chart series in `src/shared/server/analyticsCharts.ts`.

### Define or adjust system charts
1. Open `src/shared/server/analyticsCharts.ts`.
2. Update `buildSystemCharts(dashboardKey)` entries.
3. Configure per chart:
   - `chart_type`
   - `config_json.axes` fields (titles/scales/tick formats)
   - `config_json.series` array (metric, aggregation, transform, per-series type, stack, axis side, color).
4. Default charts are seeded only when the dashboard is empty; every chart can be edited or deleted afterwards.

### Extend builder capabilities
Builder state is persisted via `config_json` in `analytics_charts`.
Key places:
- UI controls and series table: `src/admin/components/AdminAnalyticsDashboard.tsx` (BuilderModal).
- CRUD/reorder APIs:
  - `src/admin/api/analytics/charts/route.ts`
  - `src/admin/api/analytics/charts/[chartId]/route.ts`
  - `src/admin/api/analytics/charts/reorder/route.ts`
- Validation/normalization: `src/shared/server/analyticsCharts.ts` (`parseConfig`).

### Theme tokens (global + per-chart appearance)
Global chart appearance is stored in DB and edited from the `Appearance / Theme` panel on `/admin/analitika` (API: `/api/admin/analytics/charts/appearance`).

Key places:
- CSS defaults: `src/shared/styles/globals.css` (`--chart-*` variables).
- Runtime adapter: `src/admin/components/charts/chartTheme.ts` (`getChartThemeFromCssVars`).
- Per-chart overrides persisted in `config_json.appearance` via `src/shared/server/analyticsCharts.ts`.

# Fresh database schema

A new empty database installs `database/schema.sql` once. This is the single
canonical clean-slate schema. It contains only current definitions, with no
embedded upgrade history. Existing databases normally use a fresh database or
database branch, but preserving existing order and quote history requires the
reviewed quote/contract artifacts below, applied in this exact order:

1. `database/migrations/20260828_quote_workflow_and_order_contract.sql`
2. `database/migrations/20260829_quote_request_admin_details.sql`
3. `database/migrations/20260829_quote_request_management.sql`
4. `database/migrations/20260830_quote_manual_documents.sql`
5. `database/migrations/20260830_quote_request_admin_title.sql`
6. `database/migrations/20260830_quote_clarification_email.sql`
7. `database/migrations/20260831_order_item_delivery_plan.sql`
8. `database/migrations/20260901_quote_optional_acceptance_terms.sql`
9. `database/migrations/20260901_inventory_policy_settings.sql`
10. `database/migrations/20260901_order_stock_enforcement_marker.sql`
11. `database/migrations/20260901_quote_outbox_cancellation.sql`
12. `database/migrations/20260903_gurs_address_prefix_search.sql`
13. `database/migrations/20260903_order_document_email_events.sql`
14. `database/migrations/20260903_schema_contract_v1.sql`
15. `database/migrations/20260904_gurs_postal_lookup_indexes.sql`
16. `database/migrations/20260904_public_customer_codes.sql`
17. `database/migrations/20260904_schema_contract_v2.sql`

The ordered list above is the pre-deploy schema sequence. After the
public-code-capable application is live and verified, every existing
environment must run this separate controlled data step (it is idempotent and a
no-op when no stored settings rows exist):
`database/migrations/20260905_public_code_email_templates_postdeploy.sql`.
It is intentionally not part of the pre-deploy sequence and must never run from
build, startup, or an automatic migration runner.

For steps 12 and 15, first stop scheduled and manual GURS synchronization and
confirm that no import is running. Apply both index artifacts to the active
table, then deploy the application version whose GURS synchronizer creates the
same street and postal indexes on every staging table before re-enabling
synchronization. Verify one-character street and postal-place lookups, exact
postal-code completion, and index-backed query plans. This ordering prevents an
older synchronizer from later swapping an unindexed table into service. If the
stored lease has expired, either migration invalidates it and marks lingering
`running` sync-history rows as failed; a live lease aborts the migration.

The admin-details follow-up is only for a database on the verified 20260828
schema. The management follow-up requires that verified admin-details guard and
adds manual-intake provenance plus guarded logical removal. The manual-documents
follow-up adds isolated, append-only administrator PDF attachments without changing
the immutable evidence used to issue or accept an offer. The admin-title follow-up
adds a separate internal display title while preserving the immutable POV number
and commercial history. The clarification-email follow-up adds a dedicated customer
outbox event while preserving the append-only clarification log even when delivery is
declined or fails. The delivery-plan follow-up adds explicit current/later shipment
grouping to order lines and generated delivery documents. The optional-acceptance-terms
follow-up allows an issued quote to omit only its free-text acceptance terms while
retaining the versioned terms identity and integrity hashes. The inventory-policy
follow-up adds the global stock-enforcement switch with enforcement enabled by default,
and the order marker records which policy governed each order's inventory lifecycle.
The quote-outbox follow-up adds durable administrator cancellation evidence so cancelled
messages leave the delivery queue without being deleted. The public-code follow-up
backfills opaque immutable customer references and preserves one base across
quote-to-order conversion; it deliberately does not touch email settings or queued
messages, so it is safe to apply before the compatible application deployment. The
separate post-deploy data step upgrades stored customer templates from internal serial
variables during the controlled cutover. It preserves administrator templates,
never mutates queued envelopes, and aborts while any deliverable pre-cutover customer
envelope remains. The application contains no runtime aliases for the old customer
variables: this guarded database rewrite is the only transition mechanism. Keep
customer writes and both email workers paused from application deployment until this
data step and its verification have completed.
The final v2 schema-contract
artifact verifies the required terminal tables, columns, constraints, functions,
indexes, triggers, and settings before recording the same compatibility contract
that a fresh schema records. It does not recreate or claim historical migration
entries. No artifact is run by application startup. Do not apply one without
production database authority, a verified backup, and the rollout review in
`docs/quote-workflow-rollout.md`.

`npm run check:schema-contract` validates the manifest checksum and its bindings
to the canonical schema and terminal migration without connecting to PostgreSQL.
`npm run check:database-schema` additionally performs a read-only verification of
the configured database against the declared contract. Neither command changes
the schema or data. This Phase-A contract requires every canonical runtime table
and the exact high-risk order/quote workflow objects introduced by the reviewed
migration chain; it is not yet an exhaustive every-column catalog signature and
must not be used as a general deployment gate until Phase B expands that surface.

## Runtime configuration

### Isolated localhost on Windows

This workspace has a gitignored .env.development.local and an isolated
PostgreSQL cluster under the parent workspace runtime directory. Start or
resume both safely with:

    npm run dev:local

The launcher refuses remote or mismatched database URLs, starts the existing
PostgreSQL cluster only when needed, runs the non-destructive canonical-schema
check, and binds Next.js only to 127.0.0.1:3000. It never prepares, resets, or
reseeds the database. Use the explicit guarded E2E preparation command only
when intentionally resetting disposable test data.

Copy `.env.example` to `.env.local` for local development and provide the
corresponding environment variables in production.

- `DATABASE_URL` is the application's only PostgreSQL connection setting. Set
  it explicitly for each environment; no alternate connection variable is used
  when it is missing or blank. Isolated tests additionally require
  `E2E_DATABASE_URL`, which must match `DATABASE_URL` when both are configured.
- PostgreSQL runtime limits can be set with `ATEHNA_DB_POOL_MAX`,
  `ATEHNA_DB_CONNECTION_TIMEOUT_MS`, `ATEHNA_DB_IDLE_TIMEOUT_MS`,
  `ATEHNA_DB_STATEMENT_TIMEOUT_MS`, and `ATEHNA_DB_LOCK_TIMEOUT_MS`. Unset
  values retain the previous node-postgres defaults in every environment:
  a pool of 10 connections, a 10-second idle timeout, and no pool-acquisition,
  statement, or lock timeout. Enable tighter limits only after measuring
  production-like workloads such as the monthly address index rebuild. Use
  `0` to disable an individual timeout; invalid values fail before a connection
  pool is created. Timeout parameters embedded in the database URL take
  precedence over these separate settings.
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` are required
  in production. Missing production admin credentials fail closed.
- `CRON_SECRET` secures the scheduled maintenance and address-sync routes in
  `vercel.json`.
- `RESEND_API_KEY` is required whenever Resend-backed order or quote email
  delivery is enabled, including quote access-code delivery. Keep it as a
  Sensitive Vercel environment variable; it is never persisted in the
  application database or returned to the browser.
- `PUBLIC_MEDIA_BLOB_STORE_ID` selects the public Vercel Blob store used for
  catalogue and site media. Connect it through Vercel OIDC. Admin file uploads
  use short-lived, path/type/size-scoped tokens and send bytes directly from the
  browser to Blob, avoiding a duplicate transfer through the application.
- `ORDER_DOCUMENT_BLOB_STORE_ID` selects the separate Vercel Blob store used
  for order documents. That store must use Private access and be connected to
  the project through Vercel OIDC. Do not reuse the public media store; missing
  private-store configuration fails order-document uploads and downloads closed.
- `ORDER_ACCESS_BOOTSTRAP_KEY` is required before accepting orders. Set it to at
  least 32 random characters and save it as a Sensitive Vercel environment
  variable. It encrypts the original confirmation bootstrap token stored with an
  idempotency receipt, so concurrent retries return the same still-active token
  without keeping that credential as plaintext. Rotating this key intentionally
  makes earlier idempotent submissions non-replayable; their already-issued
  confirmation links remain governed by the hashed access-token record.
- `QUOTE_ACCESS_BOOTSTRAP_KEY` is required before accepting quote requests or
  online offer responses. Use a separate stable secret of at least 32 random
  characters; quote replay encryption uses a quote-specific KDF/AAD domain and
  must not reuse the order bootstrap key.
- `ORDER_DEFAULT_TAX_RATE` is optional and defaults to `0.22`.
- `QUOTE_ADMIN_ENABLED`, `QUOTE_PUBLIC_REQUESTS_ENABLED`, and
  `QUOTE_ONLINE_ACCEPTANCE_ENABLED` are independent server-side rollout gates.
  They default off. Enable admin review first, public request submission second,
  and online acceptance last. Quote business-email delivery is controlled by
  the persisted **Pošiljanje ponudb** toggle under `/admin/email`, which also
  defaults off. This master toggle also controls OTP security messages and must
  be enabled before online acceptance can work.

Initial order-summary generation is recorded as a durable database job in the
same transaction as the order. The post-response callback is only a low-latency
processing trigger: an exact idempotent submission replay or an authenticated
confirmation request can safely retrigger a pending or stale job. Failed jobs
remain pending with bounded exponential backoff. This avoids an unauthenticated
repair endpoint and another worker credential; the tradeoff is that, after a
persistent storage failure, processing resumes when a guarded request arrives
after the backoff window.

## Automatic order email

Order email uses Resend and a per-recipient database outbox. New-order and
status-change jobs are inserted in the same transaction as the order mutation,
then attempted after the HTTP response so checkout and admin saves do not wait
for the provider. A CRON_SECRET-protected daily Vercel job recovers pending or
stale work, while failed jobs and a manual retry action are visible at
`/admin/email`. The daily schedule remains compatible with Vercel Hobby;
normal successful delivery is still attempted immediately.

To activate delivery for `www.atehna-test.site`:

1. Connect Resend to the Vercel project (the Vercel Marketplace integration or
   Resend's Vercel Auto Configure flow can add the API key and DNS records).
   Prefer a sending subdomain such as `updates.atehna-test.site` so transactional
   reputation is isolated from the root domain.
2. Verify Resend's SPF and DKIM records. Configure `RESEND_API_KEY` for the
   Vercel Production environment as Sensitive, keep `CRON_SECRET` configured,
   and redeploy because environment changes do not affect existing deployments.
3. Install the current canonical `database/schema.sql` before exposing the new
   code. This repository intentionally does not migrate an existing database;
   use the documented fresh-database deployment flow or coordinate an explicit
   external schema rollout before activation.
4. Open `/admin/email` on the `Nastavitve` tab. Set a verified From address, for
   example `narocila@updates.atehna-test.site`; set a real Reply-To inbox; add
   one or more administrator recipient inboxes; and review the customer/admin
   event matrix. Set the canonical website URL to
   `https://www.atehna-test.site`, not to the mail subdomain, because it is used
   for links to the administration and site-relative product images. Save while
   the master switch is still off.
5. Send a test message from the same page. After it is accepted by Resend and
   arrives in the expected inbox, enable the master switch and save again.

`/admin/email` separates delivery controls under `Nastavitve` from per-event
customer and administrator subjects and introductory text under `Predloge`.
Submitted orders from a customer of type `Šola / javni zavod` use a dedicated,
editable customer subject and body variant. The renderer automatically appends
the organization, contact person, optional customer reference, and a
`Naloži naročilnico` call to action, so these operational details do not have
to be repeated in editable prose.

The purchase-order call to action is a same-origin URL with its
bootstrap bearer in the fragment (`#token=...`). The browser exchanges that
fragment for the protected order session; it must not be converted into a query
parameter or logged. Leave Resend click tracking disabled for the sending domain
or message stream used by these emails. A tracking redirect would rewrite the
fragment-bearing security URL and can expose or break the credential flow.

The internal sequential order number is intentionally unavailable to customer
templates and is not disclosed in customer messages. Administrator templates
may use `{{order_number}}`. The order summary, line items, and product images
are appended automatically rather than authored in the templates.

Schools and public institutions upload a signed or approved PDF/JPG of at most
10 MB at `/order/narocilnica`. The verified session associates the document
with the order automatically; the customer never enters an internal order ID.
The admin API refuses to make such an order binding without an active,
non-deleted `purchase_order` document. It also refuses `V obdelavi`,
`Delno poslano`, `Poslano`, and `Zaključeno` unless the document remains
active and the order is binding. Confirming the binding state is the point at
which stock is reserved.

Product images use public URLs captured in the order snapshot. These URLs must
remain anonymously reachable over HTTPS because inbox clients cannot access
private order-document blobs or an authenticated application session. The item
name, SKU, quantity, and amount remain in both HTML and plain text when an image
is missing or blocked.

Registering a domain in Vercel does not create a receiving mailbox. The From
address may be send-only, but Reply-To and administrator recipients must be real
inboxes. End-to-end test mode hard-disables provider requests even if a developer
has a Resend key in the parent environment.

The initial defaults notify both the customer and configured administrators for
a submitted order, `V obdelavi`, `Delno poslano`, and `Poslano`. `Prejeto` as a
later manual transition, `Zaključeno`, and `Preklicano` remain available as
separate opt-in events. The customer email always comes from the immutable order
snapshot, while every administrator receives a separate message so addresses
are not exposed through CC/BCC. Each rendered provider request is snapshotted in
the outbox. Changes to settings or templates therefore affect only jobs queued
after the change; already queued jobs retain their rendered sender, content,
links, and image snapshot URLs when retried. The master switch pauses both new
and queued delivery.

The rendered delivery envelope is versioned independently of the database
schema. Workers accept only the current v2 envelope. Any unsent legacy v1
outbox row is rejected as terminal `invalid_payload`, marked failed, and is
never submitted to Resend or automatically retried. A manual retry leaves its
payload unchanged and is rejected by the same version gate. Production was
verified to have no such pending legacy rows before this rollout, so no queue
or schema migration is included. A sent job means Resend accepted the message,
not that it was ultimately delivered to or opened by the recipient; final delivery and
bounce status remain visible in Resend. Accepted jobs have their message content
redacted and are pruned after 30 days.


The Slovenian checkout address index is refreshed from the official GURS
Register naslovov once per month. The canonical schema includes its search
tables and order-address fields. Immediately after installing a fresh database,
run `npm run addresses:sync` before exposing checkout; the schema intentionally
starts with an empty address index. Keep `CRON_SECRET` configured for the monthly
refresh. Source, capacity, validation, recovery, and privacy
details are documented in [docs/gurs-address-register.md](docs/gurs-address-register.md).

Catalogue prices are stored as net amounts. Customer pages and order documents
show the net amount, DDV rate/amount, gross amount, and the authoritative
configured shipping calculation. Delivery and payment fulfilment remain
manual operational processes.

Deleted products, orders, and order documents are retained for 90 days before
eligible database and blob cleanup. Active and inactive products have no
automatic expiry.

# Example
- `/admin/orders` shows 4 compact preview charts and click-through to `/admin/analitika`.
- `/admin/analitika` contains default charts plus custom builder-created charts.

# Install

`npm install`

# Test

- Static and unit gates: `npm run check:schema-contract`, `npm run lint`,
  `npm run typecheck`, `npm run test:unit`, then `npm run build`.
- E2E requires a newly provisioned disposable PostgreSQL database on loopback.
  Its name must be `atehna_e2e_` plus the lower-case
  `E2E_STORAGE_NAMESPACE`, with hyphens replaced by underscores. For
  example, namespace `local-a1b2c3d4` requires database
  `atehna_e2e_local_a1b2c3d4`. The server must provide `pgcrypto` and
  `pg_trgm`. Never point the suite at a reused, shared, or production database:
  preparation drops and recreates its `public` schema.
- Before running Playwright, set `E2E_MODE=1`, set both `E2E_DATABASE_URL` and
  `DATABASE_URL` to the same loopback database URL, and set isolated
  unique 12–52 character `E2E_STORAGE_NAMESPACE` made from lower-case letters,
  digits and hyphens, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and an
  `ADMIN_SESSION_SECRET` of at least 32 characters.
- Run `npm run build`, `npm run e2e:db:prepare`,
  `npm run e2e:db:rehearse-contract`, `npm run check:database-schema`, then
  `npm run test:e2e -- --workers=1 --retries=0`. Preparation applies
  `database/schema.sql`, installs deterministic catalog/media fixtures, verifies the
  sentinel data, and clears Next's generated runtime cache before the run. The
  guarded rehearsal removes only the disposable database's contract ledger,
  temporarily flips its inventory-policy fixture to the other valid boolean
  state, executes the explicit terminal artifact twice to prove installation,
  idempotence, and value-independent compatibility, then restores the fixture
  and verifies the resulting database contract.
  Playwright clears that same generated cache again during teardown so E2E
  database values cannot leak into the normal application.
- A local system Chromium can be selected with
  `ATEHNA_PLAYWRIGHT_EXECUTABLE=/absolute/path/to/chrome`; CI installs the
  Playwright-managed Chromium build.

## CI safety gates
The pull request CI workflow runs:
- `npm ci`
- `npm run check:schema-contract`
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run build`
- four isolated PostgreSQL-backed Playwright shards with one worker and zero
  retries; each shard executes the terminal contract twice and runs
  `npm run check:database-schema` after installing the fresh schema and before
  starting Playwright
- merged-report verification proving every expected test ran and passed once

## Deployed network measurement harness

Run the Playwright-based deployed measurement harness from **your own machine** against the real deployed site:

1. Install dependencies: `npm install`
2. Install Chromium for Playwright: `npx playwright install chromium`
3. Run the default deployed measurement: `npm run measure:deployed-network`

Useful options:
- Override the base URL: `npm run measure:deployed-network -- --base-url https://atehna.vercel.app/`
- Provide explicit dynamic params: `npm run measure:deployed-network -- --category <slug> --order-id <id>`
- Reuse an authenticated Playwright storage state for admin pages: `npm run measure:deployed-network -- --storage-state ./playwright/.auth/admin.json`
- Save full HTML document responses for later analysis: `npm run measure:deployed-network -- --save-html true`
- Write to a custom output directory: `npm run measure:deployed-network -- --output-dir artifacts/measurements/manual-run`
- Use a custom route list file: `npm run measure:deployed-network -- --routes-file ./routes.txt`

For authenticated admin routes, create a Playwright storage-state file first if needed, for example by using Playwright codegen or a one-off login helper, then pass it with `--storage-state`. Without auth, protected routes will measure whatever the deployed site actually returns (for example a login redirect/page).

The script measures three passes for each route using a real Chromium session:
- first visit with an empty browser context/cache (`cold`)
- normal reload with cache enabled (`reload`)
- hard-reload equivalent with cache disabled for the reload (`hard-reload`)

Outputs:
- JSON report: `artifacts/measurements/network-report-<timestamp>.json`
- Markdown summary: `artifacts/measurements/network-report-<timestamp>.md`
- Saved HTML responses (when `--save-html` is enabled): `artifacts/measurements/html/<route>-<mode>.html`

Default target routes:
- `/`
- `/products`
- `/products/[category]`
- `/index`
- `/admin/kategorije`
- `/admin/kategorije/predogled`
- `/admin/kategorije/miller-view`
- `/admin/orders`
- `/admin/orders/[orderId]`

If `--category` or `--order-id` are not supplied, the script will try to auto-resolve them from the deployed site by finding the first matching category/order link. In a reset state with no categories or orders, matching dynamic route templates are skipped and listed in the report instead of failing the whole run.


## Post-build asset report and budget guard

After a production build, inspect deterministic aggregate sizes for emitted
client JavaScript, font files, and static media:

    npm run build
    npm run check:build-assets

The default command is report-only. It does not fail because no project budget
has been chosen yet. To capture a trusted main-branch report:

    npm run check:build-assets -- --output artifacts/build-assets-main.json

A later build can be compared explicitly against that report:

    npm run check:build-assets -- --baseline artifacts/build-assets-main.json

Optional byte or percentage tolerances are additive:

    npm run check:build-assets -- --baseline artifacts/build-assets-main.json --baseline-allow-bytes 1024 --baseline-allow-percent 0.25

Independent absolute ceilings are also supported. The values below illustrate
the command syntax only; replace them with reviewed project limits:

    npm run check:build-assets -- --max-client-js-gzip-bytes 5000000 --max-font-bytes 20000000 --max-static-media-bytes 50000000

Run `npm run check:build-assets -- --help` for all options. The JSON report is
stable: it contains no timestamp, machine-specific absolute path, or build ID.
Client-JS gzip sizes are calculated per emitted chunk using level-9 gzip as a
local comparison proxy. The report records the zlib version and rejects a
baseline created with different input directories, compression settings, or
zlib version.

No asset budget runs in CI until a reviewed baseline or explicit ceilings have
been committed. The deployed Chromium network harness remains the source of
truth for actual route-level transfer and cache behavior.

# License
Internal / project-specific.
