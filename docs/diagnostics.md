# Diagnostika

Diagnostika is an operational view of measured application work. It uses one new collector and PostgreSQL read model. It is not an HTTP access log: only instrumented routes, data loaders and cache actions are included.

## Collection

`src/shared/server/diagnostics/instrumentationCore.ts` uses AsyncLocalStorage to keep concurrent requests in independent traces. Enclosing routes and child loaders carry the same UUID. At most 499 child events plus the enclosing request are retained per trace; the trace discloses omitted spans. Standalone cache invalidations use Next's `after` lifecycle so the runtime keeps the database write alive after the response.

The collector records operation name, normalized context, kind, completion time, duration, measured output size, sanitized error code, timed phases and bounded trace details. Numeric/UUID path identifiers and query strings are removed from route contexts. It does not store request bodies, headers, credentials, customer data or exception messages. HTTP responses with status 400 or higher and thrown exceptions are recorded as errors. Telemetry write failure does not change the operation's result.

Payloads are estimates of serialized outputs; a response without a known content length is unmeasured. A route's payload estimate uses its largest explicitly profiled producer. Adding route and loader sizes is not a measure of unique network traffic. Nested/concurrent phase sums can overlap and are not a partition of elapsed request time. Cache execution events mean the underlying cached function executed; the dashboard does not infer cache hits.

## Reading and controls

`GET /api/admin/analytics/diagnostics` requires the existing administrator session and responds with `private, no-store`. Query errors are visible 503 failures, never zero measurements.

Controls select 5 minutes, 15 minutes, 1 hour, 6 hours, 24 hours or 7 days, event kind, exact context and errors only. Every aggregate, chart, table and CSV uses the same filter population and server `asOf`. PostgreSQL computes averages and continuous p95 from all matching stored observations; the recent-event table is limited to 50 rows and does not determine totals. Opening a trace reads up to 500 spans at the same snapshot time. The table and CSV contain all grouped operations in that window.

History before the first retained observation is unavailable. Empty buckets after collection begins mean no recorded measurements, not proof that every application operation was observed. Error rate is the share of selected observations with an error; nested route/loader failures can be separate observations. Request-only selection gives a request denominator.

Optional refresh runs every 15 seconds while the page is visible. Export freezes the displayed `asOf`. Times are displayed in Europe/Ljubljana; duration windows are elapsed time.

## Storage and cleanup

Install the analytics retirement and v4 migrations before running the new application. Fresh databases use the current `database/schema.sql`. The `diagnostics_events` table is indexed by time, context/time and errors.

The daily 04:50 UTC Vercel job calls `GET /api/admin/analytics/diagnostics/prune` with `Authorization: Bearer <CRON_SECRET>`. The same header is required on any host. It removes observations older than seven days; physical retention can extend until the next successful daily cleanup. Self-hosted deployments must schedule that authenticated endpoint. Reads never resurrect the retired file collector or use compatibility fallbacks.

## Verification

- `tests/unit/diagnostics.test.ts`: trace isolation, measured phases, handled/thrown failures, privacy, sink failure isolation, bounded traces, input validation, CSV safety and standalone-invalidation scheduling.
- `tests/e2e/diagnostics.spec.ts`: authenticated real route-to-database capture, aggregate/trace/CSV parity, dashboard controls, mobile layout, explicit read failures and retired routes returning 404.
- `scripts/check-analytics-retirement.mjs`: current database contract, absence of retired tables/functions and protected archive behavior on isolated databases.
