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

# Database migrations

Apply the numbered migrations in order:

1. `migrations/001_current_baseline.sql`
2. `migrations/002_catalog_commerce_foundation.sql`
3. `migrations/003_order_access_and_snapshots.sql`
4. `migrations/004_product_appearance.sql`
5. `migrations/005_archive_retention.sql`
6. `migrations/006_product_reference_design.sql`
7. `migrations/007_school_directory.sql`
8. `migrations/008_customer_directory_profiles.sql`
9. `migrations/009_gurs_address_register.sql`

The migrations are additive/idempotent where practical, but should still be
run once in sequence. Do not expose a deployment until every migration has
completed: the application reads the new variant, pricing, access-token,
appearance, and retention columns at runtime.

## Runtime configuration

Copy `.env.example` to `.env.local` for local development and provide the
corresponding environment variables in production.

- A PostgreSQL URL is required through `DATABASE_URL`, `POSTGRES_URL`,
  `POSTGRES_PRISMA_URL`, or `SUPABASE_DB_URL`.
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` are required
  in production. Missing production admin credentials fail closed.
- `CRON_SECRET` secures the scheduled maintenance and address-sync routes in
  `vercel.json`.
- `BLOB_READ_WRITE_TOKEN` is required for catalogue media and order documents.
- `ORDER_DEFAULT_TAX_RATE` is optional and defaults to `0.22`.

The Slovenian checkout address index is refreshed from the official GURS
Register naslovov once per month. Apply migration 009 before enabling the cron,
and keep `CRON_SECRET` configured. Run an on-demand refresh with
`npm run addresses:sync`. Source, capacity, validation, recovery, and privacy
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

- Run all local safety gates: `npm run lint && npm run typecheck && npm run build && npm run test:e2e`

## CI safety gates
The pull request CI workflow runs:
- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test:e2e`

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
