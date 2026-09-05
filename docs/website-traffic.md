# Splet: website traffic reporting

The Splet tab at `/admin/analitika/splet` is a new read model over the existing `website_events` table. The old website analytics dashboard and reporting service have been removed. Historical events and the public `/api/analytics/event` JSON collection contract remain intact; no website schema migration is needed.

## Read model and periods

`src/shared/server/websiteTraffic.ts` runs the canonical statement from `websiteTrafficQuery.ts` as one PostgreSQL statement for the summary, daily series, complete page/product tables, coverage and D7 cohorts. Every selected activity count uses the same half-open period from `src/shared/domain/analytics/period.ts`, with calendar days in Europe/Ljubljana. Presets are 30D, 90D, 180D, 1Y, 2Y and YTD; custom dates include the selected final day and respect DST. The current day ends at the response's `asOf` timestamp. Query errors return HTTP 503 and a visible error state; they never turn into an empty successful report.

The protected `/api/admin/analytics/website` API supports `range`, `from`, `to`, optional `asOf`, and `export=days|pages|products|cohorts`. CSV links pin the displayed `asOf` and export every row, not just a top-N subset. CSV strings are quoted and formula-like strings neutralized. The proxy and API require an admin session; cron authorization does not grant this API access. Responses are private and not cached. The new diagnostics instrumentation measures successful requests and handled HTTP error responses.

## What each number means

- Page views and product views count their respective existing events. Product events never increase page-view visitors or sessions. The existing tracker stores the product URL slug in `product_id`; the product table shows that recorded identifier, not a fabricated catalogue name.
- Visits are distinct nonblank `session_id` values among selected page views. The existing `ath_sid` cookie has a rolling four-hour lifetime refreshed on collection. This is not a reconstructed 30-minute session model.
- Visitors are distinct nonblank browser `visitor_id` values among selected page views. They are not authenticated users or deduplicated people across devices. The existing `ath_vid` cookie has a one-year lifetime. Cookie resets/blocking and automated traffic affect this measurement.
- Returning visitors have a selected page view on a local date later than their first recorded page-view date. Multiple page views on the same day alone do not qualify. First-observed visitors and returning visitors may overlap within a period.
- D7 cohorts group visitors by their first recorded page-view date within the selected period. D7 return means at least one page view on the seventh local calendar day after that date. Only cohorts whose entire seventh day ended before the current local date are mature; immature rates remain null. Historical follow-up may extend beyond the selected activity period, up to the displayed `asOf`.
- Every breakdown retains unknown keys, and explicit coverage counts record page views missing visitor/session/path and product views missing product ID. Visitor/session totals are deduplicated over the whole period, so they need not equal sums across days or breakdown groups.

Days before the earliest recorded page view remain unavailable. Later zeroes mean no recorded events, not proof of uninterrupted collection. Historical first observation is not the visitor's known first visit in their life. Duration, bounce rate, authenticated users and conversion funnels are absent because the existing collector does not record sufficient evidence for them.

## Collection fix and validation

The existing tracker sent its first page and product events concurrently, allowing both requests to create different cookies. `src/commercial/lib/websiteEventQueue.ts` now serializes page responses, corresponding product events and later navigation. A failed page event does not create an orphan product event, and a failed request does not prevent later navigation from being recorded. Each request has a ten-second timeout so a stalled connection cannot block the queue indefinitely. The tracker avoids duplicate effects for the same pathname and does not collect admin/API routes.

`tests/unit/website-traffic.test.ts` verifies period/DST semantics, missing history, cohort maturity, complete safe CSV, event sequencing, admin authorization and explicit query failures. `tests/e2e/website-traffic.spec.ts` verifies the actual PostgreSQL query with inline read-only fixtures, then fresh browser collection through the unchanged ingestion endpoint, stored IDs, report counts, CSV, responsive tables and UI failures. The SQL fixture shadows `website_events` within its statement and never mutates historical application records. The browser test requires the project's isolated E2E database preflight and adds only ordinary test browsing events there.

## Verification result for this change

The six focused unit tests and targeted ESLint checks pass. The complete PostgreSQL fixture also passed independently inside `BEGIN READ ONLY` against the verified disposable UI database: 6 page views, 2 product views, 4 sessions, 4 visitors, 1 returning visitor, 3 first-observed visitors; D7 has 2 eligible visitors, 1 return, 1 immature visitor and a 50% mature rate. All four missing-field counters equal 1. All three browser cases passed together on the rebuilt isolated application: SELECT-only cohort/count fixtures; a real fresh product navigation through collection, shared stored cookies/IDs, report counts and CSV; desktop/mobile period controls, accessible tables and explicit error handling. Screenshot inspection found and corrected an invisible single-day line series by adding markers; the mobile test waits for and asserts the actual Plotly SVG fits its card. The active period has a visible check independent of the global button theme. Final desktop/mobile captures are in the task work/website-browser-results directory.

Actual diagnostics storage was verified after browsing: successful Splet requests include database and transformation phase timings and payload byte estimates, and an authorized invalid-period request returned HTTP 400 with a persisted HTTP_400 error record. Request/response bodies and visitor identifiers are not stored in these diagnostics measurements.
