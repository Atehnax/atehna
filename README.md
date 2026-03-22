# Name
### atehna

# Synopsis
Admin order management and analytics dashboards.

# Description
Atehna includes:
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

# DB migration
Run SQL migrations in `migrations/`, including:
- `006_admin_analytics_charts.sql` for persisted chart metadata/config and ordering.
- `007_admin_analytics_appearance.sql` for global chart appearance settings.

# Example
- `/admin/orders` shows 4 compact preview charts and click-through to `/admin/analitika`.
- `/admin/analitika` contains default charts plus custom builder-created charts.

# Install
`npm install atehna`

# Test
- Run all local safety gates: `npm run lint && npm run typecheck && npm run build`

## CI safety gates
The pull request CI workflow runs:
- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

Playwright smoke tests are not yet present in this repository.
A commented placeholder is included in `.github/workflows/ci.yml`; enable it after adding `test:e2e` and Playwright specs.

## Deployed network measurement harness

Run the Playwright-based deployed measurement harness from **your own machine** against the real deployed site:

1. Install dependencies: `npm install`
2. Install Chromium for Playwright: `npx playwright install chromium`
3. Run the default deployed measurement: `npm run measure:deployed-network`

Useful options:
- Override the base URL: `npm run measure:deployed-network -- --base-url https://atehna.vercel.app/`
- Provide explicit dynamic params: `npm run measure:deployed-network -- --category <slug> --order-id <id>`
- Reuse an authenticated Playwright storage state for admin pages: `npm run measure:deployed-network -- --storage-state ./playwright/.auth/admin.json`
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

If `--category` or `--order-id` are not supplied, the script will try to auto-resolve them from the deployed site by finding the first matching category/order link.


# License
Internal / project-specific.
