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
1. Extend the analytics payload in `src/lib/server/orderAnalytics.ts` (`OrdersAnalyticsDay`) and compute the field in `fetchOrdersAnalytics`.
2. Ensure `GET /api/admin/analytics/orders` returns the new field (already passes through server payload).
3. Register the metric in builder/UI options inside `src/components/admin/AdminAnalyticsDashboard.tsx` (`metricOptions`) and (optionally) add system chart series in `src/lib/server/analyticsCharts.ts`.

### Define or adjust system charts
1. Open `src/lib/server/analyticsCharts.ts`.
2. Update `buildSystemCharts(dashboardKey)` entries.
3. Configure per chart:
   - `chart_type`
   - `config_json.axes` fields (titles/scales/tick formats)
   - `config_json.series` array (metric, aggregation, transform, per-series type, stack, axis side, color).
4. System charts are upserted automatically when charts are fetched.

### Extend builder capabilities
Builder state is persisted via `config_json` in `analytics_charts`.
Key places:
- UI controls and series table: `src/components/admin/AdminAnalyticsDashboard.tsx` (BuilderModal).
- CRUD/reorder APIs:
  - `src/app/api/admin/analytics/charts/route.ts`
  - `src/app/api/admin/analytics/charts/[chartId]/route.ts`
  - `src/app/api/admin/analytics/charts/reorder/route.ts`
- Validation/normalization: `src/lib/server/analyticsCharts.ts` (`parseConfig`).

### Theme tokens (global chart styling)
Use these constants in `src/components/admin/AdminAnalyticsDashboard.tsx`:
- `theme`
- `layoutBase`

These control dark backgrounds, grid, axis/label/legend/tooltip contrast, and series palette consistency.

# DB migration
Run SQL migrations in `migrations/`, including:
- `006_admin_analytics_charts.sql` for persisted chart metadata/config and ordering.

# Example
- `/admin/orders` shows 4 compact preview charts and click-through to `/admin/analitika`.
- `/admin/analitika` contains default charts plus custom builder-created charts.

# Install
`npm install atehna`

# Test
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

# License
Internal / project-specific.
