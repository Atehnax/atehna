# Authenticated infrastructure follow-up — 2026-09-13

This follow-up supersedes the earlier Neon authentication limitation in `infrastructure-2026-09-13.md`. The user authorized the supported `neon auth --profile DEFAULT` flow. It completed through the existing browser login with no further user action. No database credentials or tokens were displayed or placed in evidence artifacts. No database setting, endpoint state, compute size, plan, or deployment was changed during this inspection.

## Verified metadata

The authenticated Neon CLI inspected project `morning-rice-20554700` (`atehna-admin`), its only branch `main` (`br-small-wave-agmo0vfe`), and its read/write endpoint. Selected metadata was saved in `artifacts/perf-infrastructure-followup-20260913.json` at 13:21:49 UTC.

| Field | Observed value |
| --- | --- |
| Project and endpoint region | `aws-eu-central-1` (Frankfurt) |
| Endpoint | `ep-patient-surf-agpt9lqx` |
| Direct hostname | `ep-patient-surf-agpt9lqx.c-2.eu-central-1.aws.neon.tech` |
| Pooled hostname | `ep-patient-surf-agpt9lqx-pooler.c-2.eu-central-1.aws.neon.tech` |
| Compute minimum / maximum | 0.25 / 0.25 CU |
| PostgreSQL version | 17 |
| Provisioner | `k8s-neonvm` |
| Suspension configuration | `suspend_timeout_seconds: 0` |
| Current state at metadata capture | `active`, started 13:21:13 UTC |
| Subscription metadata | `launch_v3` |

The current [Neon OpenAPI specification](https://neon.com/api_spec/release/v2.json), schema `SuspendTimeoutSeconds`, defines zero as the default 300-second idle timeout. Minus one disables suspension. Thus the observed endpoint uses scale to zero; zero does not mean always on. The same specification deprecates `pooler_enabled` and says pooling is selected by the `-pooler` hostname. Its returned `pooler_enabled: false` is therefore not evidence that the runtime uses an unpooled connection. Actual production runtime hostname matching remains pending deployed instrumentation; neither the integration attachment nor local `.env.local` establishes that mapping.

`vercel inspect atehna.vercel.app` independently confirmed current production deployment `dpl_2BrjfBpMwhyVWz9jwrzZv4btHFxg` (`atehna-6eyvch5g1-atehnaxs-projects.vercel.app`) with functions in `fra1`. The attached Neon endpoint and the deployed functions are both in Frankfurt, subject to the unresolved effective runtime hostname mapping above.

## Natural endpoint operations

Read-only operation history showed the following finished operations. No suspend, start, restart, or update API was invoked by this inspection.

| UTC time | Action | Neon operation duration |
| --- | --- | ---: |
| 12:52:31 | Suspend | 432 ms |
| 13:02:38 | Start | 428 ms |
| 13:11:46 | Suspend | 753 ms |
| 13:14:18 | Start | 336 ms |
| 13:20:31 | Suspend | 1,170 ms |
| 13:21:12 | Start | 494 ms |

These are Neon control-plane operation durations. They establish real suspension/resume activity but do not directly measure PostgreSQL connection acquisition, SQL execution, Vercel cold starts, browser TTFB, or user-visible route transition delay. Linking a particular browser request to a resume requires a matching UTC request window and effective runtime endpoint identity.

No authenticated production admin session was known to this infrastructure investigation. The local E2E admin account is limited to the isolated disposable test database and does not establish production admin access.

There is no measured resource-pressure or saturation evidence yet. Increasing compute, disabling suspension, changing pools, or upgrading paid observability is not justified by the metadata alone and was not performed.

## Coordinated natural-suspension homepage sample

After the public browser baseline completed and its browser closed, only read-only Neon metadata was observed. The endpoint naturally suspended at 13:28:31 UTC. Its `idle` state was confirmed before exactly one anonymous request to `https://atehna.vercel.app/` was issued; no endpoint action or artificial cold-state preparation occurred.

The request started at `2026-09-13T13:29:25.3722321Z` and completed at `2026-09-13T13:29:27.0266554Z`, returning HTTP 200 and 187,252 bytes. Curl measured DNS lookup at 66.972 ms, TCP connection at 100.829 ms, TLS completion at 164.095 ms, first byte at 1,601.133 ms, and total transfer at 1,635.850 ms. These phase values are cumulative from curl request start.

Neon operation `bf99bd8a-8aae-4deb-9312-16b6a01d590e` started compute at 13:29:26 UTC and finished at 13:29:27 UTC, reporting a 597 ms operation duration. Endpoint metadata changed from `idle` before the request to `active` afterward. The temporal overlap strongly supports a resume contribution to this particular homepage load. It does not assign the entire remaining TTFB to SQL or Vercel cold start, and exact runtime hostname matching is still pending. A single sample does not establish a latency distribution or the likely frequency of user encounters.

Selected timing and operation evidence is preserved in `artifacts/perf-natural-suspension-homepage-20260913.json`. No second homepage request or repeated wake was made as part of this experiment.

## Active-endpoint transport baseline

A follow-up group of three ordinary homepage requests ran on the unchanged public production deployment from `2026-09-13T13:38:44.194Z` through `13:38:45.117Z`. Neon was active before and after, with no new resume operation in that interval. All three returned HTTP 200 with `x-vercel-cache: MISS` and `x-vercel-id` identifying `fra1::fra1`. Each curl process established its own HTTP/1.1 TCP/TLS connection; no cache-bypass or URL query parameter was added.

| Sample | DNS | TCP phase | TLS phase | Wait after pretransfer | TTFB | Body transfer | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2.675 ms | 15.723 ms | 63.648 ms | 152.570 ms | 234.657 ms | 34.757 ms | 269.414 ms |
| 2 | 3.033 ms | 22.956 ms | 90.613 ms | 122.480 ms | 239.122 ms | 46.065 ms | 285.187 ms |
| 3 | 2.669 ms | 24.773 ms | 99.584 ms | 119.672 ms | 246.763 ms | 51.713 ms | 298.476 ms |

Median TTFB was 239.122 ms. These phases separate client transport from response waiting, but the latter still includes edge routing and server work; it is not a database-only measurement. Active Neon compute does not establish Vercel instance or application-cache state. The earlier natural-suspension sample and this active-endpoint sample have different transport and cache histories, so their difference must not be presented as an isolated measurement of Neon resume overhead.

`artifacts/perf-homepage-warm-transport-three-20260913.json` preserves every cumulative curl field, selected cache/region headers, request UTC interval and probe trace ID. A preceding two-request sample requested before the three-request group is preserved separately in `artifacts/perf-homepage-warm-transport-20260913.json` (TTFB 495.591 and 228.546 ms); it was not merged into this three-request group.

## Verified instrumentation deployment runtime

The instrumentation-only production-settings deployment `atehna-5peihvomr-atehnaxs-projects.vercel.app` emitted a matching timing event for trace `a7e4a001f8d2da9ef251da7592b7ccf8`, recorded at `2026-09-13T13:40:02.682Z`. This supersedes the pending runtime-endpoint mapping for that deployment: the actual `pg.Pool` hostname is `ep-patient-surf-agpt9lqx-pooler.c-2.eu-central-1.aws.neon.tech`, matching the authenticated Neon endpoint `ep-patient-surf-agpt9lqx` in `aws-eu-central-1`, on main branch `br-small-wave-agmo0vfe`. The process reported Vercel region `fra1`.

The runtime uses verified TLS, pool maximum 10, idle timeout 10,000 ms, and zero connection, statement and lock timeouts, with no named overrides. This is observed configuration, not a recommendation to change it. The instance ID was `1213e8a8-b9bc-4ec2-9998-174a655bf449`, its measured registration took 29.870 ms, and this was its first opted-in probe. First probe is not a general Vercel cold-start label: platform provisioning before registration is unmeasured.

The event contains 50 phases with zero dropped spans. `BaseServer.handleRequest` took 738.797 ms, `AppRender.getBodyResult` 706.132 ms, and the through-after snapshot 740.965 ms. `shell.inventory-policy` took 386.762 ms. Seven new PostgreSQL connections took 164.409–362.757 ms; the first pool acquisition took 373.185 ms, of which 362.757 ms was combined connection establishment and 10.428 ms wait/checkout overhead. All nine pool acquisition snapshots reported zero waiting clients. Nine SQL round trips took 3.259–80.793 ms. Seven cache lookups took 138.384–220.043 ms. These phases overlap and must not be added to produce a wall-clock total.

Read-only Neon operation history showed a start at 13:35:04 UTC, followed by suspension at 13:45:16 UTC, with no start during the 13:40 probe. The observed connection-establishment cost in this sample therefore did not overlap a Neon resume. It includes DNS/TCP/TLS/authentication and cannot be subdivided further from these spans. SQL spans include client/network waiting and do not independently measure database execution or locks.

The ordinary live log stream did not deliver the matching event to the initial parser. The installed Vercel CLI 50.9.6 also provides `logsv2`, whose authenticated request-log history supports an exact event-name search. Its result wraps the JSON event in `logs[].message`; the allowlist parser recovered it without saving arbitrary log messages or URLs. The preserved safe event is `artifacts/perf-instrumentation-stage-history-20260913.json`. The reusable bounded collector is `artifacts/read-runtime-timing-history.mjs`; it reads only matching timing records and writes selected fields. No paid aggregate query or observability upgrade was needed.

## Promoted baseline: natural resume, immediate repeats, and later refresh

The instrumentation-only deployment was promoted to the public aliases before this group. At `2026-09-13T13:48:34.7643350Z`, authenticated Neon metadata confirmed the endpoint was still `idle` after its natural suspension at 13:45:16 UTC. No artificial suspension or cache reset was used. The first sampled homepage request began at 13:49:43.648 UTC. Neon operation `3ae3a02c-81d7-4dfa-a1f7-484734a6300e` started compute at 13:49:45 UTC and completed at 13:49:46 UTC, reporting 489 ms.

All five subsequent selected homepage events match their supplied W3C trace IDs, report the same pooled Frankfurt hostname and `fra1`, and have zero dropped spans. They share process instance `3c58d231-2936-49e8-a13c-4e96ca9e910c`; only the first has `firstProbeOnInstance: true`. Its measured registration took 9.871 ms. Thus the first sample includes both a first probed process instance and a naturally resumed database. Their individual contributions cannot be isolated by subtracting a warm sample.

| Condition | UTC request start | TTFB | Handler | App render | Inventory policy | Observed new DB connections |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Confirmed natural suspension; first instance probe | 13:49:43.648 | 2,512.778 ms | 1,211.873 ms | 1,200.374 ms | 1,025.776 ms | 2; 862.713 / 948.193 ms |
| Immediate repeat 1 | 13:49:46.231 | 373.833 ms | 79.347 ms | 62.921 ms | 24.631 ms | 0 |
| Immediate repeat 2 | 13:49:46.666 | 403.587 ms | 43.365 ms | 38.696 ms | 14.827 ms | 0 |
| Immediate repeat 3 | 13:49:47.147 | 325.989 ms | 42.703 ms | 38.215 ms | 11.953 ms | 0 |
| Later homepage request, over 237 seconds later | 13:53:44.963 | 300.947 ms | 87.226 ms | 82.694 ms | 17.919 ms | 0 |

The first sample's observed pool connection establishment dominated the inventory-policy dependency; the observed checkout overhead apart from connection establishment was below 1 ms, and all pool snapshots reported zero waiting clients. Three SQL round trips were 32.797–96.396 ms. The immediate repeats reused connections, with SQL round trips of 2.882–10.571 ms. This evidence supports a foreground connection/resume dependency in the public shell, not a pool-capacity bottleneck. It does not establish CPU saturation, slow SQL execution, or database lock contention.

The later request retained the same instance and reused two pool connections. It performed four observed SQL round trips of 3.131–9.967 ms, seven cache lookups of 22.970–30.835 ms, and an observed category-showcase cache refresh of 10.606 ms. An authenticated admin measurement began at 13:53:33 UTC and could keep shared database connections and dependencies warm. This later sample therefore demonstrates behavior after the elapsed homepage interval and an observed refresh; it is not an isolated test of all cache entries expiring, PostgreSQL pool idleness, or Neon suspension.

These phases are nested/concurrent, so sums would double-count time. Connection spans combine DNS, TCP, TLS and authentication; SQL spans combine client queueing, network and execution. Application spans do not separately measure platform provisioning before registration; the later provider recovery below supplies an aggregate cold-start duration for the first baseline request. Client and service UTC clocks are not a calibrated common monotonic clock; use trace IDs and the broad UTC operation window for correlation, and same-process monotonic spans for durations. HTTP cache `MISS` does not by itself establish a Next Data Cache miss.

The first four HTTP records are in `artifacts/second-runtime-before-cold-and-warm.json`; the later record is in `artifacts/second-runtime-before-expired.json`. All five selected safe events are preserved in `artifacts/perf-instrumentation-baseline-five-history-20260913.json`, with zero unparsed event messages. The idle-state observation and Neon operation correlation are preserved in `artifacts/perf-instrumentation-baseline-before-20260913.json` and `artifacts/perf-instrumentation-baseline-neon-operations-20260913.json`. The first-four phase summary is `artifacts/perf-instrumentation-baseline-summary-20260913.json`. These small samples are controlled diagnostic evidence, not real-user percentile estimates or a proven steady-state latency distribution.

## Unpromoted candidate metadata and first measured response

Candidate deployment `dpl_AM6HDt1ECsUFtgCUU5b2JqptrqHH` (`atehna-huufjkzau-atehnaxs-projects.vercel.app`) reached Ready at 13:58:34.951 UTC. Read-only authenticated CLI/API metadata confirmed deployment region and origin-cache region `fra1`; the CLI function summary also reported `fra1`. The index bundle is 35,207,127 bytes (CLI display: 33.58 MB). Structured build output contains 396 function output items, with several shared bundle sizes; multiplying the index size by that output count would overstate unique deployed code. All eight deployed cron paths and schedules exactly match `vercel.json`. Selected metadata is preserved in `artifacts/perf-candidate-deployment-metadata-20260913.json`.

Exactly one marked request was made with the official authenticated `vercel curl` command, which handles deployment protection. Trace `a7e4a00142e8ea01a63d326e0c60217b` was sent within the CLI invocation interval 14:03:03.015–14:03:05.624 UTC. This is the first agent HTTP request to that candidate, about 4 minutes 30 seconds after Ready; it must not be described as an instantaneous deployment-completion sample or proof that the platform made no other requests.

Curl measured DNS completion at 99.083 ms, TCP at 111.618 ms, TLS at 184.558 ms, pretransfer at 184.607 ms, TTFB at 658.870 ms and total transfer at 680.755 ms. The invocation interval also includes CLI setup, so it is not the curl transfer duration. The response was HTTP 200, `x-vercel-cache: PRERENDER`, `age: 0`, with a single `fra1` edge segment in `x-vercel-id`.

The saved public HTML is 187,516 bytes. Static HTML parsing, without executing JavaScript, found one hero section, one hero image, one heading, and all eight category tiles. The heading is “Oprema in materiali za tehnično izobraževanje.” This confirms useful complete server-rendered content in the prerendered response. An exact scoped timing-history lookup at 14:04:04.843 UTC returned no matching runtime timing event. That absence is consistent with prerender delivery; it is not evidence of a failed request or an independently measured zero-duration server invocation.

The public HTML and selected transport/SSR evidence are `artifacts/perf-candidate-first-request-20260913.html` and `.json`; the safe history result is `artifacts/perf-candidate-first-request-history-20260913.json`. The candidate remained unpromoted during this investigation, and a separate final invalidation correction was still pending in source. These measurements belong to this immutable candidate snapshot, not a later final deployment.

## Promoted candidate: cached responses and provider regeneration evidence

The measured candidate was then promoted. Four marked ordinary homepage requests ran at 14:08:24.304–14:08:25.730 UTC. The response `x-vercel-id` suffixes exactly match the provider request IDs below. Vercel's provider request records omit the supplied trace IDs on these cached requests and contain no `atehna.runtime-timing.v1` event; matching uses the exact response request ID, not only the time window.

| Request ID prefix | TTFB | Response cache | Body bytes | Provider delivery | Attached function event |
| --- | ---: | --- | ---: | --- | --- |
| `8rx4w-1789308505067` | 285.419 ms | PRERENDER | 187,516 | `prerender`, request 165 ms | `background_func`, 848 ms, `prewarmed` |
| `wgl5n-1789308505417` | 264.926 ms | HIT | 187,516 | `prerender`, request 140 ms | None |
| `649bv-1789308505740` | 256.997 ms | HIT | 187,516 | `prerender`, request 135 ms | None |
| `njn7s-1789308506056` | 401.721 ms | HIT | 191,211 | `prerender`, request 239 ms | None |

The first request's background function began at 14:08:25.252 UTC in `fra1`; the provider labels it `prewarmed`. Its cold-start-duration field is -1, not a positive measured duration. All four proxy records report cache age zero and TTL 60 seconds. The final response's larger body and doubled `fra1::fra1` header segment do not establish foreground rendering: that exact provider record has no function event and is classified as prerender delivery. Consuming a regenerated cache representation is a plausible explanation for the changed byte count, but these records alone do not prove which bytes changed or attribute its additional latency. The 848 ms function is attached to the first request as background work, not a foreground duration to add to its 285 ms TTFB.

At 14:09:31 UTC, Neon was active with its latest start still at 13:49:45 UTC. There was no resume during this after-promotion group. These are cached/warm-compute samples; they are not a cold-provider comparison. Authenticated admin measurements around 14:08:45 UTC could keep the shared database active.

A later homepage request at 14:09:46.517 UTC, more than 80 seconds after the preceding group, returned HTTP 200, PRERENDER, age zero, 187,516 bytes, and TTFB 148.037 ms. Its exact request ID `qpzwn-1789308587270-2727ca8349b9` matches a provider prerender record with request duration 35 ms, age zero and TTL 60 seconds. That record attaches a `background_func` beginning at 14:09:47.336 UTC, lasting 282 ms, with start type `hot`, concurrency 1, and maximum function memory 296 MB of 2,048 MB. No matching opted-in application timing event was present. This is direct provider evidence of background regeneration associated with a prerendered response; it is not an observed STALE response, proof that every shared cache expired, or a foreground database-wait measurement. The absent trace event prevents SQL/connection-phase attribution for the regeneration itself.

HTTP evidence is preserved in `artifacts/second-runtime-after-promotion.json` and `artifacts/second-runtime-after-expired.json`. Selected provider evidence is in `artifacts/perf-candidate-promoted-four-request-metadata-20260913.json` and `artifacts/perf-candidate-promoted-expiry-request-metadata-20260913.json`; corresponding timing-event searches and the selected Neon history are retained alongside them. Provider request/function durations use different boundaries from curl transport durations and must not be treated as interchangeable or added together.


## Recovered provider cold-start classification for the baseline

A later read-only provider-history query recovered the exact four baseline request IDs, including `qwvsv-1789307384481-bd8295516421`, which matches trace `a7e4a0016b6e3f939acb13c0130819e7`. That first provider record explicitly classifies its function start as `cold` and reports `functionColdStartDurationMs: 378`, function duration 1,749 ms, and provider request duration 2,301 ms. Its delivery type is `streaming_func`, cache MISS, and function region `fra1`. Therefore this sample has direct provider cold-start evidence in addition to the application first-probe marker and the overlapping 489 ms Neon resume.

The immediate follow-ups are classified `hot`, with provider function durations 149, 58 and 59 ms and provider request durations 261, 212 and 206 ms. Their cold-start-duration field is -1, not a positive duration. All four use the same provider instance ID. The aggregate platform cold-start metric narrows the previous evidence gap; it does not expose provisioning/module-loading substeps, and it must not be added to nested application spans as if those were independent phases. The application handler's 1,211.873 ms is measured within the broader first function execution.

Exact selected provider records are preserved in `artifacts/perf-instrumentation-baseline-provider-request-metadata-20260913.json`. This recovery used the installed authenticated CLI request-history API and created no new application or database traffic.

## Candidate validation status

The `dpl_AM6HDt1ECsUFtgCUU5b2JqptrqHH` candidate measurements above are provisional and are not final release validation. Subsequent browser checks reported an intermittent catalog transition delay and a homepage React hydration warning. The root task rolled the public aliases back to the instrumentation baseline `dpl_A4wSCLYMHmU6W5Q52UN3xuFrKw2H` around 14:14 UTC while those issues were investigated. All candidate measurements remain preserved with their immutable deployment identity. The proposed after-change natural-cold comparison was paused; no forced suspension or further cold probe was performed by this infrastructure investigation. A later corrected release requires its own verification before claiming the candidate improvement as a validated final result.

## Corrected staging snapshot: confirmed TTL expiry and regeneration

Read-only inspection at 14:28:45 UTC confirmed corrected deployment `dpl_GcqGcngPZH6V8EhBjiAXCwb6P3QX` (`atehna-95qswrhnm-atehnaxs-projects.vercel.app`) was Ready with function/deployment region and origin-cache region `fra1`. The index bundle is 35,205,224 bytes, and all eight deployed cron paths/schedules exactly match `vercel.json`. It was still a staging candidate during this inspection; production promotion and release verification are separate actions.

Two already-completed public functional requests were matched by exact Vercel request ID:

| Request ID | Provider response | Cache age / TTL | Provider request duration | Function event |
| --- | --- | --- | ---: | --- |
| `746c6-1789309613105-7bdd8203b64d` | STALE; reason `stale_time` | 62 / 60 seconds | 40 ms | `background_func`, 534 ms, `hot`, concurrency 1, `fra1` |
| `gb7kb-1789309614222-c57623e098be` | HIT | 0 / 60 seconds | 33 ms | None |

The STALE proxy record is timestamped 14:26:53.105 UTC; its attached background function began at 14:26:53.184 UTC. The subsequent HIT is timestamped 14:26:54.222 UTC. These provider records directly confirm time-based cache expiry, background regeneration and a subsequent fresh cached response. Neither record contains the optional runtime timing marker, so the provider durations cannot be subdivided into application/database phases. The background function's 534 ms is not a foreground delay to add to the 40 ms stale-response request duration.

The associated public functional artifact, `artifacts/second-fixed-stage-public.json`, was supplied by the root task and records canonical `['', 'index']` RSC routing, one footer, complete hero/eight category tiles, no reported React 418 warning, and a working cart after the HIT. This infrastructure inspection added no HTTP requests and did not query or change Neon state. Full release verification was still running separately at this point.

Selected proof is retained in `artifacts/perf-fixed-stage-deployment-metadata-20260913.json` and `artifacts/perf-fixed-stage-stale-hit-provider-20260913.json`. These records belong to the corrected immutable staging snapshot, rather than the earlier rolled-back candidate.

## Fixed production code: dynamic product trace and tracing-off release metadata

After promotion of the corrected `95qswrhnm` snapshot, product trace `a7e4a0017ab33d348cdf678eaa51cecf` matched provider request `vd4rd-1789310004803-16765bb3902b`. Its application event reports route `/products`, status 200, `rsc: false`, region `fra1`, the same actual pooled Neon Frankfurt hostname, verified TLS, pool maximum 10, 10-second idle timeout, zero connection/statement/lock timeouts, and no named database-setting overrides.

The event contains 32 phases and zero dropped spans: request handler 315.106 ms, app render 207.751 ms, through-after snapshot 325.740 ms, inventory-policy dependency 131.426 ms, two new database connections 73.533 and 124.048 ms, four SQL round trips 2.360–82.526 ms, and catalog-cache refresh 187.407 ms. Every observed pool waiting count was zero. These overlapping measurements do not establish pool saturation or isolate database execution from network/client time.

The process had registered at 14:25:52.055 UTC, before the 14:33 product request. Although the application event calls this its first opted-in probe, the exact provider record classifies the function start as `hot`, with function duration 349 ms, provider request duration 437 ms, concurrency 1, and cold-start-duration field -1. This is a concrete example of why the first-probe flag must not be treated as a cold-start classification. The provider classified the request as a streaming function and cache MISS. Evidence: `artifacts/perf-fixed-product-runtime-history-20260913.json` and `artifacts/perf-fixed-product-provider-metadata-20260913.json`.

The same-code tracing-off staging deployment `dpl_C57hkCNoK8YgK5XMKHUr3zVpxCyd` (`atehna-j01nhvxe9-atehnaxs-projects.vercel.app`) was Ready when inspected at 14:37:57 UTC. Deployment region, origin-cache region and the index function's `deployedTo` are all `fra1`; runtime is `nodejs24.x`, index bundle 35,205,222 bytes, with all eight cron paths/schedules matching `vercel.json`. This inspection used provider metadata only and issued no application request to that stage.

Source gates the optional SDK on `ATEHNA_PERFORMANCE_DIAGNOSTICS === '1'`. Final deployment metadata lists that variable name, but does not return its value. The root task created the stage with flag zero; the independent metadata read confirms its presence, not the effective value. No environment-value decryption endpoint was requested. The selected metadata and this limitation are preserved in `artifacts/perf-final-tracing-off-stage-metadata-20260913.json`.

The root task retained earlier authenticated production admin before/after checks with nine-row count verification. That session later closed, so a new final admin measurement round was unavailable. This report makes no admin performance-improvement claim. Natural-idle verification after the final public measurement window remained pending; this infrastructure inspection did not query or alter Neon state during browser measurements.

## Promoted tracing-off release: retained first-response outlier

The root task promoted final deployment `dpl_C57hkCNoK8YgK5XMKHUr3zVpxCyd` around 14:39:25 UTC. Four marked homepage requests at 14:39:29.818–14:39:31.880 UTC were matched to exact provider IDs. All returned HTTP 200 with 187,516-byte HTML bodies.

| Condition / request ID prefix | Curl TTFB | Curl total | Curl pretransfer | Provider request | Cache | Function event |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| First measured post-promotion / `p7q9b-1789310370642` | 809.638 ms | 844.228 ms | 135.154 ms | 638 ms | PRERENDER | Background regeneration; see below |
| Immediate repeat / `77mtk-1789310371507` | 312.752 ms | 362.210 ms | 128.290 ms | 142 ms | HIT | None |
| Immediate repeat / `gsqrp-1789310371943` | 356.651 ms | 405.195 ms | 175.629 ms | 136 ms | HIT | None |
| Immediate repeat / `sz86l-1789310372320` | 305.415 ms | 355.977 ms | 130.116 ms | 135 ms | HIT | None |

The first 809.638 ms sample is retained; it is not replaced with the faster corrected-candidate or warmed samples. Its provider proxy record is `prerender`, age zero, TTL 60 seconds. An attached `background_func` in `fra1` is classified `cold`, with provider cold-start duration 321 ms and function duration 1,683 ms. The provider records the regeneration separately from prerender delivery. Its cold-start/function durations must not be added to foreground TTFB or treated as proof that the 321 ms cold start caused the first-response outlier. The remaining three records have no attached function event and cache ages zero, zero and one second. Provider records contain no optional runtime timing marker, as expected for cached responses and the release configured with tracing disabled.

Retrospective Neon metadata at 14:41:40 UTC showed the endpoint active, with its most recent start still at 13:49:45–46 UTC and no intervening start/suspend operations. There was no Neon resume overlapping the 14:39 final group, including the first-response outlier. These results therefore do not yet supply the requested after-change natural-suspension comparison. That comparison was reserved for a later quiet window after browser measurements and CPU-intensive local release verification, without forcing a cold state.

Source HTTP records are `artifacts/second-runtime-final-promotion.json`. Exact selected provider and Neon evidence is preserved in `artifacts/perf-final-promoted-four-provider-20260913.json` and `artifacts/perf-final-promoted-four-neon-20260913.json`. This small group describes observed first/post-promotion and immediate-repeat behavior, not a real-user percentile distribution. Final public functional/expiry checks and the isolated full test suite were tracked separately by the root task.

## Final release expiry and fresh-hit provider verification

The final tracing-off release's public functional check supplied two exact request IDs. At provider time 14:41:36.148 UTC, `6kwnk-1789310496148-ce610f5d4454` was HTTP 200, delivery type `prerender`, cache STALE with reason `stale_time`, cache age 60 seconds and TTL 60 seconds. Provider foreground request duration was 15 ms. Its attached background function began at 14:41:36.228 UTC in `fra1`, ran 256 ms, and was classified `hot`, with concurrency 1 and no positive cold-start-duration metric.

The follow-up `czw4t-1789310497224-568f7fd2f0ac`, recorded at provider time 14:41:37.224 UTC, was HTTP 200, prerender delivery, cache HIT with age zero and TTL 60 seconds. Its provider request duration was 45 ms and it had no function event. Neither record contained an optional application timing event.

These exact provider records confirm expired cached delivery, background regeneration and a subsequent fresh hit on the promoted final deployment. The 256 ms regeneration is background work, not latency to add to the 15 ms foreground request. Root's `artifacts/second-final-public-verification.json` records canonical index routing, one footer, full hero/category content and no reported errors across this final expiry/HIT sequence. The selected provider evidence is preserved in `artifacts/perf-final-expiry-hit-provider-20260913.json`.

Public browser/root HTTP traffic ended at 14:41:37.684 UTC according to the root task. Local isolated release verification then continued. This metadata-only correlation made no new application requests and did not check or alter Neon state; the natural-suspension check remained held until an explicit quiet-window go-ahead after the full suite.

## Final release after confirmed natural Neon suspension

After the root reported the full local suite finished and all browsers stopped, read-only Neon metadata at `2026-09-13T14:51:06.9931377Z` confirmed endpoint `ep-patient-surf-agpt9lqx` was `idle`, with no start timestamp. The preceding real suspend operation `51286d95-35c9-4975-899e-a724d03ddde3` ran at 14:47:01–02 UTC and lasted 892 ms. Public application traffic had stopped at 14:41:37.684 UTC. No forced suspension, database mutation, cache reset, keepalive traffic or application request was used to obtain that idle state.

The root then sent four ordinary homepage requests to the final release at 14:51:31.338–14:51:32.336 UTC. Exact response/provider request IDs matched all four:

| Request ID prefix | Curl TTFB | Provider foreground request | Cache age / TTL | Response | Attached function |
| --- | ---: | ---: | --- | --- | --- |
| `6nxjf-1789311092183` | 202.629 ms | 21 ms | 595 / 60 seconds | STALE, `stale_time` | Background regeneration, 1,582 ms, `hot` |
| `45s65-1789311092406` | 169.223 ms | 38 ms | 595 / 60 seconds | STALE, `stale_time` | None |
| `g9t6m-1789311092674` | 181.129 ms | 12 ms | 596 / 60 seconds | STALE, `stale_time` | None |
| `l7mk5-1789311092915` | 179.857 ms | 14 ms | 596 / 60 seconds | STALE, `stale_time` | None |

Neon operation `eef05435-d2dd-44fd-a594-111b43a8c912` started compute at 14:51:32 UTC and finished in the same second, reporting 392 ms. The metadata observation at 14:52:22.866 UTC confirmed the endpoint active, started at 14:51:32 UTC. The first provider request attaches a `background_func` starting at 14:51:32.277 UTC in `fra1`, lasting 1,582 ms, classified `hot` with concurrency 1 and no positive cold-start-duration metric. No optional application timing event was expected on the release configured with tracing disabled.

This is direct evidence that, with Neon naturally suspended, the final homepage served existing stale HTML while database resume and regeneration occurred in the background. The later three requests were also stale cache responses; they must not be described as fresh regenerated HIT samples. A separate final STALE-to-HIT functional/provider sequence is recorded above. The background database work still occurs, but it is no longer required before this cached homepage response can be delivered.

For comparison, the earlier instrumented baseline's first request after confirmed natural Neon suspension had TTFB 2,512.778 ms and a foreground streaming function with an observed 1,025.776 ms inventory-policy dependency. It also had a provider-classified 378 ms cold start, whereas the final sample's background function was hot. Consequently the 2,512.778-to-202.629 ms observation demonstrates the changed request path in these two diagnostic samples; it is not an isolated estimate of Neon resume cost, a matched function-start experiment, a p95 result, or a guarantee for an empty/deleted full-route cache. The final initial post-promotion 809.638 ms outlier remains recorded above.

The before-state proof is `artifacts/perf-final-natural-idle-before-20260913.json`; the HTTP records are `artifacts/second-runtime-final-cold.json`; post-state/resume evidence is `artifacts/perf-final-natural-idle-after-20260913.json`; exact foreground/background provider records are `artifacts/perf-final-natural-idle-four-provider-20260913.json`. This infrastructure capture added no HTTP requests to the root's four-request group and made no infrastructure changes.
