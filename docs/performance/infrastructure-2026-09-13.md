# Infrastructure evidence — 2026-09-13

Initial inspection used the existing authenticated Vercel CLI/API and the local Neon CLI. The subsequent performance deployment changes the function region to Frankfurt, as recorded below. No database setting, compute size, billing plan, or suspension policy was changed. Secret values are deliberately omitted.

## Effective deployment and attached resources

`vercel inspect atehna.vercel.app` resolved production deployment `dpl_3HyfsPYHWQKWhazK9i1cXFvqeXtU` (`atehna-9qve22486-atehnaxs-projects.vercel.app`), built from commit `156addf` on 2026-09-13. Public aliases include `atehna.vercel.app` and `www.atehna-test.site`.

`GET /v9/projects/prj_V2wlPzeXTXFJxViauQUvxkxndN6H?teamId=team_Nn6QtSWgse0zNV2dEm42c5T2` returned these selected non-secret fields:

```json
{
  "name": "atehna",
  "framework": "nextjs",
  "serverlessFunctionRegion": "iad1",
  "resourceConfig": {
    "fluid": true,
    "functionDefaultRegions": ["iad1"],
    "buildMachineType": "basic",
    "buildMachineSelection": "fixed"
  },
  "speedInsights": { "hasData": false }
}
```

`GET /v1/storage/stores?projectId=prj_V2wlPzeXTXFJxViauQUvxkxndN6H&teamId=team_Nn6QtSWgse0zNV2dEm42c5T2` returned the following selected metadata. Its response reports secret names and lengths; secret values were not accessed or retained.

| Resource | Vercel ID | Region | Project attachment |
| --- | --- | --- | --- |
| Neon `atehna-admin` | `store_hGk5V2ttvvmut4xb` | `metadata.region = fra1` | `atehna`; production, preview, development; injects `DATABASE_URL`, `NEON_PROJECT_ID` |
| Private Blob `atehna-order-documents` | `store_tSvIWb9boEaV9Dny` | `fra1` | `atehna`; production, preview, development |
| Public Blob `atehna-blob` | `store_CrIncEoWa5EmvIN9` | `fra1` | `atehna`; production, preview, development |

The Neon resource has `externalResourceId = morning-rice-20554700`, `externalResourceStatus = ready`, and `usageQuotaExceeded = false`. Its attachment identifies the current production deployment above. This establishes a mismatch between the production project's functions in Washington (`iad1`) and its linked database/storage in Frankfurt (`fra1`). It does not reveal the effective PostgreSQL branch or connection URL; production environment metadata shows `DATABASE_URL` was updated separately on September 2.

Build logs report Next.js 16.3.1, Node.js 24.x, and dynamic server rendering for the homepage, product listing/detail and admin pages. The independent project and function-region evidence, not the build location alone, establishes runtime placement.

## Configuration and verified deployment

`vercel.json` now sets `"regions": ["fra1"]`. The final production-settings deployment `dpl_2BrjfBpMwhyVWz9jwrzZv4btHFxg` confirms runtime functions in `fra1`. Public-domain promotion and final smoke results are recorded in the [consolidated report](2026-09-13-loading.md). [Vercel documents the regions property](https://vercel.com/docs/project-configuration/vercel-json#regions) as the deployment-level function-region control; single-region selection is supported on Hobby. The installed Next.js 16.3.1 guide marks route-level `preferredRegion` deprecated, so no route exports were added.

Colocation is expected to reduce network waiting for database queries and Blob requests. Its contribution in milliseconds has not been isolated from the concurrent code changes. The [consolidated report](2026-09-13-loading.md) records matched public data, verified effective function regions and repeat route/navigation measurements from the same client location.

The change retains one function region and does not enable replicas, background keepalive traffic, a larger database, or always-on compute. No infrastructure purchase was made. Regional execution/data-transfer unit prices can differ; compare the next deployment's usage and bill before claiming cost savings. The linked Neon installation currently reports Launch billing, but exact compute size and suspension policy were inaccessible. No proposal to disable suspension is justified by the available measurements.

## Diagnostics and access limits

- Speed Insights is enabled but reports `hasData: false`; no real-user performance sample was available.
- A five-minute live runtime log tail during public browsing captured a PostgreSQL SSL-mode warning on `/products/tehnika-in-tehnologija`. It did not expose database phase timing, cold-start duration, or other useful duration traces.
- A correctly scoped query to `POST /v2/observability/query` for `vercel.function_invocation.ttfb_ms`, grouped by route, function region and start type, returned HTTP 402 `payment_required`: Observability Plus requires a plan upgrade. No paid upgrade was made. Browser timings and application instrumentation remain available without that upgrade.
- Neon API metadata calls returned HTTP 401. The installed CLI attempted to refresh its existing login and received `token_inactive` / `invalid_grant`. Exact access repair: run `neon auth --profile DEFAULT`. Then inspect project `morning-rice-20554700` and its production branch endpoint for compute min/max, suspension timeout, state, and metrics. No cold-start or resource-pressure conclusion can be drawn until those settings/metrics are available.
- Automatic approval review rejected both extracting production environment credentials to a file and an in-memory redacted hostname inspection because both requested decrypted environment values. Neither action ran. These rejected secret reads are no longer needed to establish the linked resource's region: the metadata-only storage API above provided that evidence. The user subsequently authorized an in-memory read of only production DATABASE_URL for hostname/region identification. The bounded single-variable API then returned HTTP 200 with type = sensitive, decrypted = false, and no value (both v1 and v10). [Vercel documents sensitive variables as non-readable after creation](https://vercel.com/docs/environment-variables/sensitive-environment-variables). No credential was returned, displayed or persisted. The remaining blocker is provider write-only storage, not missing user approval. Confirming the exact effective hostname requires an existing runtime diagnostic that reports only hostname/region or access to the original connection source; the linked-resource region evidence above remains valid.

The existing `.env.local` points to a stale Neon database/branch and must not stand in for deployed production data: inspection found one catalog item and no `diagnostics_events` table. A local-client probe against that stale branch measured connection establishment of 196 ms and seven warm `SELECT 1` round trips of 30.2, 24.8, 23.5, 25.7, 26.0, 25.0 and 29.9 ms (median 25.7 ms). These are neither production function-to-database timings nor proof of the region change's benefit, and are excluded from production before/after comparisons.
