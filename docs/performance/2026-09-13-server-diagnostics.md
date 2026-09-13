# Server diagnostics investigation — 2026-09-13

## Confirmed foreground work

The previous createDiagnosticsInstrumentation implementation awaited persist(trace.events) when an outer loader or route finished. The persistence duration was excluded from that span's recorded duration. This ran for cached catalog reads too. The production adapter already used Next after() for standalone invalidations, but did not schedule loader/route batches that way.

The fix sends all completed outer traces through that existing host lifecycle scheduler. It preserves spans, errors, bounded traces, payload estimates and invalidations. Next 16.3.1's installed after documentation and implementation support server components and retain callbacks through waitUntil after the response closes. No sampling or additional cache was introduced. Database writes still occur; their cost moves after the response rather than disappearing.

The commercial and admin shared shells also now start published logo and independent configuration reads together. Their data sources, returned JSX and freshness rules are unchanged. This scheduling change has not been independently assigned a measured route-level improvement.

## Reproducible isolated persistence experiment

Method: transpile the HEAD version and changed version of instrumentationCore.ts with the installed TypeScript compiler; create a one-connection pg Pool for each condition; use the same diagnostics INSERT statement with JSON input [] (zero inserted rows); wrap an immediately resolved {cached:true} loader; record result time; then drain the injected lifecycle scheduler. Five sequential runs per condition, on the same machine/network. This probes foreground persistence overhead, not full-page navigation. First runs include connection setup and possibly module/JIT work; later runs reuse a connection only when the query succeeds.

The local development database has the diagnostics table. The .env.local Neon database does not (42P01); its destination is not asserted to be the deployed environment. Erroring pg Pool.query calls release their clients with an error, so the next telemetry call has to establish another connection. The identical zero-row query cannot create diagnostic records even when the table exists.

All values below are milliseconds, listed in run order.

| Database / condition | Foreground result, runs 1–5 | Persistence, runs 1–5 |
| --- | --- | --- |
| Local development, before | 24.374, 0.392, 0.200, 0.342, 0.235 | 15.406, 0.342, 0.171, 0.298, 0.189 |
| Local development, after | 0.173, 0.048, 0.038, 0.024, 0.023 | 12.575, 0.242, 0.191, 0.221, 0.221 |
| .env.local Neon, before | 300.969, 209.792, 201.745, 204.106, 228.257 | 300.929, 209.732, 201.660, 203.990, 228.103 |
| .env.local Neon, after | 0.058, 0.133, 0.066, 0.171, 0.150 | 211.359, 214.381, 219.193, 211.672, 209.147 |

Warm result medians (runs 2–5): local 0.288 → 0.031 ms; .env.local Neon 206.949 → 0.142 ms. Background query count and database work remain equivalent. These numbers must not be presented as a measured deployed page improvement.

A separate read-only SELECT 1 probe on .env.local Neon measured 315 ms initially, then 44, 25, 27, 25 ms. Its pooled hostname indicates AWS eu-central-1. Non-secret schema counts: 1 catalog item, 10 categories, 2 orders. diagnostics_events, admin_auth_session and inventory_policy_settings are absent. The local development database has 44 items, 14 categories, 2 orders and diagnostics_events. Neither is a substitute for verified production measurements.

## Validation

- Ten diagnostics unit tests pass, including queued persistence after the result, unfinished sink handling, request trace isolation, bounded nested spans, original business errors and invalidation details.
- ESLint passes for both changed layouts, diagnostics modules and diagnostics tests; git diff --check passes.
- Existing tag invalidation, stock policy and logo publication checks are run separately and recorded in the main investigation report.
- The rebuilt production HTTP server retained both nested catalog loader spans after a successful /products response; details below.

No cache lifetime, price/stock query, permission check, login/session logic, rendered markup or navbar styling changed in this server patch.

## Optional server logo renderer: cold module baseline

The shared layouts import getPublishedSiteLogos from logoLibrary.ts. Previously that module statically imported logoLibraryRender, logoLibraryStorage and logoLibraryDefaults. Merely initializing the built commercial layout loaded native Sharp, although the request only needed stored published-logo metadata.

Method: five new Node processes; initialize next/dist/server/node-environment-baseline; require the existing production-build homepage entry; invoke the root layout loader and then the commercial layout loader through routeModule.userland.loaderTree. Do not invoke the exported React layout function, so no database queries run. Measure the commercial loader with performance.now and RSS deltas. Check require.cache for the native sharp-win32-x64 module. These are local Windows build initialization measurements, not Vercel cold-start timings.

| Run | Entry import (ms) | Commercial layout initialization (ms) | Commercial layout RSS increase (bytes) | Sharp initialized |
| --- | --- | --- | --- | --- |
| 1 | 111.544 | 150.167 | 32,636,928 | yes |
| 2 | 111.833 | 146.163 | 32,661,504 | yes |
| 3 | 110.929 | 154.652 | 32,989,184 | yes |
| 4 | 111.642 | 145.994 | 32,698,368 | yes |
| 5 | 111.788 | 150.790 | 32,653,312 | yes |

Median commercial module initialization: 150.167 ms; median RSS increase: 32,661,504 bytes. The fix imports defaults only inside the existing initialization transaction's factory, imports publication storage after publish validation, and imports render/storage dependencies inside upload or preview/export operations. Existing-logo reads therefore avoid initializing the renderer. This does not alter initialization locks, revision checks, images, exports or data sources.

All 33 existing logo tests pass, including original/PDF pixel preservation, initialization rollback, exact export pixels, image cropping, typography, publication atomicity and private-source security. Logo module ESLint passes. Rebuilt artifact measurements and an actual HTTP persistence check are recorded below.

## Optional server logo renderer: rebuilt result

The identical five-process probe against the rebuilt production artifacts produced:

| Run | Entry import (ms) | Commercial layout initialization (ms) | Commercial layout RSS increase (bytes) | Sharp initialized |
| --- | --- | --- | --- | --- |
| 1 | 85.486 | 48.661 | 8,982,528 | no |
| 2 | 84.423 | 48.788 | 8,388,608 | no |
| 3 | 84.000 | 48.665 | 9,265,152 | no |
| 4 | 84.350 | 48.875 | 9,285,632 | no |
| 5 | 84.153 | 48.223 | 8,941,568 | no |

Commercial layout module initialization median: 150.167 → 48.665 ms, a 67.6% reduction. Median incremental RSS: 32,661,504 → 8,982,528 bytes, a 72.5% reduction (23,678,976 bytes). These isolate local cold module initialization. They do not claim identical Vercel cold-start savings or reductions on already warm requests. The shared rebuild also contains the other performance fixes described in the main report; removal of initialized Sharp is directly verified in all five probes.

## Actual HTTP lifecycle verification

After the production rebuild/restart, a real GET to localhost:3100/products?performance=server-after-retention returned status 200, the expected catalog title, 212,596 HTML bytes, a 29.492 ms first response and a 32.644 ms complete body. This single verification request is not the before/after route benchmark.

After consuming the full body, a read-only query for catalog:browser events recorded since the request began returned getCategoryShowcaseItemsFromDatabase (0.911 ms) and getCatalogDataFromDatabase (1.025 ms). Both were successful and shared one trace ID. No polling delay was needed: both were already persisted when checked after the response. This confirms the actual Next after lifecycle retains nested diagnostic events in the rebuilt server.

Thirty-one additional existing cache lifetime/invalidation, inventory policy, logo publication and admin authorization boundary tests passed. No schema migration or production data mutation was performed for these measurements. The normal public verification request generated its normal diagnostic events.

## Investigation of earlier listing-to-detail readings

The earlier approximately 870 ms listing-to-detail readings used Playwright locator.waitFor() completion as if it were the moment content became visible. Additional browser instrumentation showed that this can overstate the actual visibility delay. These figures must not support a claimed navigation improvement such as 130 → 75 ms.

The target product link was already inside the viewport (top 520 px, height 49 px at a 1440 × 1000 viewport; scrollY was 0). Actual click dispatch took tens of milliseconds. Explicit scrollIntoViewIfNeeded plus settling did not consistently remove the outlier. The RSC response completed in roughly 5–10 ms in the instrumented local trials, and no browser long tasks were observed during the transitions.

A MutationObserver recorded when the matching product h1 first existed with nonzero visible bounds; two requestAnimationFrame callbacks recorded its next paint opportunity. This is a browser paint opportunity, not a compositor paint measurement or a claim that every product interaction had completed hydration. The resulting three-run medians were:

| Exploratory cohort | Actual click dispatch from automation start | RSC completion | Heading DOM visibility from automation start | Next paint opportunity from automation start | Original Playwright wait completion |
| --- | --- | --- | --- | --- | --- |
| Fresh browser | 21.1 ms | 9.6 ms | 66.4 ms | 83.4 ms | 123.8 ms |
| Explicit scroll and settle | 35.3 ms | 7.7 ms | 361.9 ms | 366.9 ms | 855.3 ms |
| Reused browser context | 12.8 ms | 4.9 ms | 57.1 ms | 75.7 ms | 123.0 ms |

The slow trace explains the gap directly: React scheduled an approximately 281 ms timeout about 38 ms after the click; it fired around 320 ms after the click; the heading appeared around 327 ms after the click and reached a paint opportunity around 332 ms after the click. The installed compiled React stack contained the 300 ms Suspense commit throttle and a commit labelled Throttled. Playwright's installed selector wait uses retry intervals [0, 20, 50, 100, 100, 500], so it did not report the already-visible heading until about 855 ms after automation began—approximately 488 ms after the recorded paint opportunity.

The outlier therefore combined an occasional real approximately 300 ms React commit delay with approximately 500 ms of test polling overhead. It was not a demonstrated slow database/RSC request or below-fold scrolling delay. The source artifact listing-detail-dom-investigation.json records the exact click, DOM, timer, request and paint-opportunity observations; listing-detail-delay-investigation.json contains the initial request/actionability investigation.

These exploratory cohorts ran before the subsequent catalog layout adjustment. The local performance and E2E servers were also found to share .next/cache while using different databases, so their values are diagnostic evidence only, not a controlled final before/after performance claim. The local performance server was stopped; final comparisons must run sequentially or use isolated caches.

The artifact perf-navigation.mjs now accepts BASE_URL and LABEL (plus optional DETAIL_PATH and HEADING_TEXT) and records three transitions using the actual DOM click event as time zero. Its metrics come from MutationObserver and requestAnimationFrame timestamps; Playwright waits only deliver the observations and do not enter the visibility durations. RSC request timing and request failures are retained separately. It starts one fresh Chromium context and reuses its HTTP cache for runs 2–3, matching the same before/after method. It reads and writes no host credentials. No remote or local measurements were started when this runner was prepared; current and final production measurements remain separate evidence.
