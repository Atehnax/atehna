# Name
### atehna

# Synopsis
Admin order management and analytics dashboard.

# Description
Atehna includes an admin orders interface and a Plotly-based analytics dashboard with system and custom charts.

## Admin analytics extension guide

### Add a new metric source
1. Extend server aggregation in `src/lib/server/orderAnalytics.ts` by adding fields to `OrdersAnalyticsDay` and populating values in `fetchOrdersAnalytics`.
2. Expose new fields via `GET /api/admin/analytics/orders` (`src/app/api/admin/analytics/orders/route.ts`).
3. Add metric option labels and rendering logic in `src/components/admin/AdminAnalyticsDashboard.tsx` (map metric key to trace + axis/hover unit).

### Define a system chart
1. Add chart definition inside `ensureSystemCharts` in `src/lib/server/analyticsCharts.ts`.
2. Set `is_system: true`, `position`, and `config_json` (`dataset`, `xField`, `yFields`, `filters`, `transforms`).
3. System charts are upserted automatically when the dashboard is loaded.

### Tune theme tokens globally
Use `chartTheme`, `axisBase`, and `layoutBase` in `src/components/admin/AdminAnalyticsDashboard.tsx`.
These control dark-panel background, text contrast, grid opacity, legend, and hover styling for all analytics charts.

# Example
- `/admin/orders` shows a minimal preview chart with drilldown to `/admin/analitika?view=narocila`.
- `/admin/analitika` provides editable chart metadata and a Dune-like custom chart builder.

# Install
`npm install atehna`

# Test
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

# License
Internal / project-specific.
