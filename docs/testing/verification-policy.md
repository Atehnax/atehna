# Verification policy

This is the current verification policy. The older [E2E coverage audit](e2e-audit.md) records a historical migration of browserless tests and is not a current test-count inventory.

## Development and change impact

| Change | Verification before review |
| --- | --- |
| Focused business rule, formatter, validator, or transformation | Lint and typecheck; focused unit tests at its canonical implementation; affected consumer integration cases |
| Shared UI or behavior | Shared tests plus affected public/admin consumers and their variants; desktop/mobile screenshots and keyboard/focus behavior where affected |
| API, database access, authentication, authorization, external integrations | Unit and boundary integration tests, including rejection/failure paths; critical public/admin E2E outcomes |
| Routing, global layout/styles, schema, dependencies, build/test/CI configuration, or uncertain impact | Complete verification below; compare affected desktop/mobile views |
| Documentation only | Review links, commands, and documented contracts locally; PR CI remains complete until a safe narrower policy is justified |

Use `npm run typecheck` and relevant `npx tsx --test tests/unit/<name>.test.ts` cases during development. For affected browser cases, run `npm run test:e2e -- tests/e2e/<name>.spec.ts --workers=1 --retries=0` only against a prepared isolated database. Do not repeat the complete suite after every small edit when its inputs are unchanged. Shared tests do not replace consumer integration coverage, and anonymous contexts remain separate from authenticated admin contexts.

## Complete verification and exact candidates

The `CI` workflow runs once per pull-request update against GitHub's checkout of the proposed merge result. It uses Node24, matching production and the installed dependency engine requirements, and installs Poppler so PDF rasterization cases execute. It runs schema file validation, lint, all unit/contract cases, one production build including full-project typechecking, all four PostgreSQL-backed Chromium shards, and complete report validation. There are no path skips, dependency selectors, reduced matrices, allowed failures, or automatic retries. All scopes default to the complete suite.

Next 16.3.1's default build invokes the project-local TypeScript CLI against the same complete `tsconfig.json`, including tests and scripts, and generates route types. The separate CI `typecheck` step has been removed because it repeated that check. This was verified by an intentional unimported error in `tests/unit/ci-build-typecheck-probe.ts`: the real production build rejected it with TS2322, and the temporary file was removed. Keep build-time checking enabled and recheck this equivalence when changing Next, TypeScript, or their configuration; `npm run typecheck` remains the fast local command. Lint is separate because build does not provide its equivalent.
The Actions **Run workflow** control (`workflow_dispatch`) is the explicit manual full-suite trigger. Use it for a deliberate full check of a selected ref, investigating environment drift, or validating a candidate that has no matching successful result. A manual branch run does not establish integration with a changed target branch; update/revalidate the merge candidate when either input changes.

Successful checks apply only to their exact source/merge result, lockfile, configuration, and relevant environment. Do not reuse a previous result after those inputs change. A release can reuse compatible source verification, but its deployment-specific configuration, database contract, and smoke checks still need validation. Vercel's environment-specific build is retained because it is not proven equivalent to the isolated CI build. There is no routine duplicate full-suite push, main, release, or scheduled workflow.

The workflow cannot enforce merging or releasing by itself. Repository rules must require successful checks for the exact candidate if enforcement is desired. The audit's read-only GitHub metadata on 2026-09-07 reported no protection/required checks on `main`; this work does not change those remote settings or deploy anything.

## Isolation, artifacts, caching, and cancellation

- Each E2E shard owns a unique loopback PostgreSQL database and storage namespace. Preparation validates its exact disposable target before applying the fresh canonical `database/schema.sql` and deterministic fixtures. The fresh-schema contract is checked before browser work. Shared databases, external Blob writes, live email, and concurrent workers on the same mutable fixture state remain disabled.
- The production build is created once and its `.next` artifact is downloaded only within the same workflow run. It is never reused as evidence for another candidate or deployment environment. Retention stays one day for this artifact, seven days for shard diagnostics, and fourteen days for the merged HTML report.
- The npm cache retains downloaded lockfile packages; every job still installs with `npm ci`. The additional `.next/cache` cache is scoped by operating system/architecture, Node major, package manifest/lockfile, build/CI configuration, and source inputs. A fallback is allowed only within the same lockfile/configuration scope. The framework validates and rebuilds changed inputs; a cache hit never skips lint, tests, typechecking, or build. E2E runtime caches are excluded from the build artifact and never uploaded into this compiler cache.
- A newer update cancels superseded verification for the same pull request. Manual full runs have unique concurrency groups and are never superseded. No production release, shared migration, or operational job is placed in this cancellation group.

## Report gate and failure attribution

The final report job uses `always()` with a ten-minute bound: GitHub accepts condition-skipped required checks, so `!cancelled()` would be unsafe here. An initial gate rejects failed or missing prerequisites before any installation, a final always-evaluated gate requires successful report verification, and explicit cancellation guards fail before setup and after reporting. A cancellation before or during report generation therefore cannot turn an absent report into a passing gate.

Individual static/build and E2E shard job names and logs remain visible. The reporter merges each blob once into HTML and JSON, independently collects the full expected inventory, and checks exact test identities. It rejects empty/failed collection, missing or unexpected tests, duplicates, skipped/failed/flaky outcomes, retries, and missing results. It also explicitly requires both static/build and E2E prerequisite jobs to report `success`; failure, cancellation, skipping, and missing status cannot become success through a passing report.

The report-validator unit tests cover these failure modes without a browser/database. The workflow and its shell status gate are additionally validated when changing CI configuration. If inventory collection or any prerequisite fails, investigate that failure and run the necessary checks; never convert a failed selector, missing report, or infrastructure defect into a passing skip.

## Evidence and retained trade-offs

The successful pre-change [CI run 34138874190](https://github.com/Atehnax/atehna/actions/runs/34138874190) took 12 minutes 10 seconds wall time and 1,381 seconds summed job duration (about 23 runner minutes, not billed minutes). It performed six dependency installs totaling 83 seconds, a redundant standalone typecheck taking 37 seconds, one build taking 96 seconds, and four browser-install steps totaling 124 seconds. Its report job took 40 seconds and invoked report merging twice.

The new pipeline invokes report merging once while retaining both outputs and exact inventory validation. A two-blob local fixture verified both old and new paths; its small timing is not a production or CI savings estimate. Historical run metadata also showed overlapping superseded PR verification, establishing an opportunity for cancellation. A post-change GitHub run is still required to measure actual runner savings and compiler-cache hit/miss behavior.

Dependency installs and browser setup remain separate across isolated jobs: transferring a large `node_modules` or browser artifact has not been shown cheaper or equivalently portable. Four shards and one worker each are retained for database/cache isolation. Source-text contracts are retained unless a replacement protects the same behavior; no test-count reduction is inferred from a shared filename or static search. Preview deployment settings, billed CI minutes, and Vercel/Neon usage were not available through the public metadata audit, so no preview or billing savings are claimed.
