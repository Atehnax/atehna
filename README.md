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
numbered schema history or ledger. Existing databases are not transformed; the
deployment process instead rebuilds disposable test data and installs this
complete schema before exposing a new deployment.

## Runtime configuration

Copy `.env.example` to `.env.local` for local development and provide the
corresponding environment variables in production.

- A PostgreSQL URL is required through `DATABASE_URL`, `POSTGRES_URL`,
  `POSTGRES_PRISMA_URL`, or `SUPABASE_DB_URL`.
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` are required
  in production. Missing production admin credentials fail closed.
- `CRON_SECRET` secures the scheduled maintenance and address-sync routes in
  `vercel.json`.
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
- `ORDER_DEFAULT_TAX_RATE` is optional and defaults to `0.22`.

Initial order-summary generation is recorded as a durable database job in the
same transaction as the order. The post-response callback is only a low-latency
processing trigger: an exact idempotent submission replay or an authenticated
confirmation request can safely retrigger a pending or stale job. Failed jobs
remain pending with bounded exponential backoff. This avoids an unauthenticated
repair endpoint and another worker credential; the tradeoff is that, after a
persistent storage failure, processing resumes when a guarded request arrives
after the backoff window.

The Slovenian checkout address index is refreshed from the official GURS
Register naslovov once per month. The canonical schema includes its search
tables and order-address fields. Immediately after installing a fresh database,
run `npm run addresses:sync` before exposing checkout; the schema intentionally
starts with an empty address index. Keep `CRON_SECRET` configured for the monthly
refresh. Source, capacity, validation, recovery, and privacy
details are documented in [docs/gurs-address-register.md](docs/gurs-address-register.md).

Catalogue prices are stored as net amounts. Customer pages and order documents
show the net amount, DDV rate/amount, and gross amount. Delivery is currently
free, and delivery/payment processing remains manual.

Deleted products, orders, and order documents are retained for 90 days before
eligible database and blob cleanup. Active and inactive products have no
automatic expiry.

# Example
- `/admin/orders` shows 4 compact preview charts and click-through to `/admin/analitika`.
- `/admin/analitika` contains default charts plus custom builder-created charts.

# Install

`npm install`

# Test

- Static and unit gates: `npm run lint`, `npm run typecheck`,
  `npm run test:unit`, then `npm run build`.
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
- Run `npm run build`, `npm run e2e:db:prepare`, then
  `npm run test:e2e -- --workers=1 --retries=0`. Preparation applies
  `database/schema.sql`, installs deterministic catalog/media fixtures, verifies the
  sentinel data, and clears Next's generated runtime cache before the run.
  Playwright clears that same generated cache again during teardown so E2E
  database values cannot leak into the normal application.
- A local system Chromium can be selected with
  `ATEHNA_PLAYWRIGHT_EXECUTABLE=/absolute/path/to/chrome`; CI installs the
  Playwright-managed Chromium build.

## CI safety gates
The pull request CI workflow runs:
- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run build`
- four isolated PostgreSQL-backed Playwright shards with one worker and zero
  retries
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


# License
Internal / project-specific.
