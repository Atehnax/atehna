# Storage lifecycle

Storage review, recovery preparation and approved apply use the existing Blob stores and `archive_blob_deletion_outbox`. They do not run automatically from a cron or request handler. Catalog purge still queues media before deleting its catalog row; the queue is an intent, not proof that an object can be removed. Orders, quotes, deleted documents, snapshots, logo drafts/publications/history and other retained rows remain references.

Failed upload compensation can leave an object without an outbox entry. Inventory review finds these objects too. Objects must be at least 24 hours old, inside an explicitly owned prefix, below the supported 100 MiB recovery limit and have no matched database reference. Backups and JSON/SQL configuration exports stay protected. A candidate still requires external review and exact approval.

## Declare the complete scope

Keep scope files and private artifacts outside Git; `artifacts/` is already ignored. Supply credentials through environment variables. The scope contains names, never inline credentials:

```json
{
  "version": 1,
  "connectionEnv": "STORAGE_REVIEW_DATABASE_URL",
  "expectedHost": "your-database-host.example",
  "expectedPort": 5432,
  "databases": ["production", "preview", "neondb", "postgres"],
  "minimumAgeHours": 24,
  "stores": [
    {
      "id": "store_YourPublicStore",
      "access": "public",
      "oidcTokenEnv": "VERCEL_OIDC_TOKEN",
      "ownedPrefixes": ["catalog-items/", "catalog-categories/", "landing-page/", "site-logo/", "logo-library/published/"]
    },
    {
      "id": "store_YourPrivateStore",
      "access": "private",
      "tokenEnv": "STORAGE_PRIVATE_BLOB_TOKEN",
      "ownedPrefixes": ["order-documents/", "quote-documents/", "site-logo/", "logo-library/sources/"]
    }
  ]
}
```

Use the real database names and exact endpoint. The connection URL's database must be included. Every declared database is scanned, even if it appears inactive. Every connectable, non-template database in the same cluster must be declared, including maintenance databases if connectable; undeclared databases block a complete review. No other database is implicitly opened. Remote PostgreSQL uses verified TLS regardless of a weaker URL `sslmode`; loopback connections support disposable local tests. Stores may use exactly one token environment variable or OIDC environment variable each.

One configuration covers one database cluster. Shared stores used by other clusters, projects, historical deployments, backups, exported documents, email recipients or other external consumers require separate inspection and an explicit attestation. The tool cannot discover or prove arbitrary external non-use. Do not attest completion merely because the databases returned zero matches.

## Review without writes

```sh
npm run storage:review -- --config artifacts/storage-scope.json --output artifacts/storage-review-20260908
```

Use a new output directory. `review.json` contains hashes, sizes, classifications, reference counts and blockers. `review.private.json` contains object paths/URLs and complete outbox rows for subsequent preparation. Protect the private file as application data. Raw business rows and connection credentials are never included.

Review scans every row regardless of archive/deletion status, nested JSON strings and keys, common URL encodings and possible UUID composition. Views, materialized views, defaults, constraints, triggers, rules, policies and function definitions are inspected as text without executing them. A matching outbox target is recorded separately and cannot override retained references. Ambiguous targets are left unresolved, with possible matches blocking the corresponding object.

Foreign tables, binary/unsupported fields, inaccessible/RLS-filtered scopes and query timeouts prevent complete coverage. Official GURS address tables are recognized by exact source schema and omitted because their maintained import contains only official address/reference fields. Geography coordinate arrays are omitted only when all coordinate leaves are numeric; other metadata and malformed geometry remain in the scan. Review output states this boundary. Arbitrary encryption, compression and assembled references remain part of the operator's external review.

## Prepare an exact recovery manifest

Create `selected-ids.json` containing an array of candidate IDs from the safe review. At most 100 objects may be selected. Also create the reviewed external-scope attestation:

```json
{
  "reviewedBy": "responsible operator",
  "reviewedAt": "2026-09-08T12:00:00Z",
  "backupsAndExternalConsumersChecked": true,
  "note": "Record which shared stores, other clusters/projects, preserved backups and external document consumers were checked, and the retention decision."
}
```

```sh
npm run storage:prepare -- --config artifacts/storage-scope.json --review artifacts/storage-review-20260908/review.private.json --selection artifacts/selected-ids.json --external-review artifacts/external-review.json --directory artifacts/storage-recovery-20260908
```

Prepare downloads only the selected objects, verifies their ETags/metadata before and after reading, writes exact bytes, reopens and hashes each local copy, and creates `manifest.private.json`. The manifest includes the complete matching outbox rows, including decimal bigint IDs, so an acknowledged intent remains independently recoverable. The command prints the manifest SHA-256 for approval. It does not delete anything or authorize apply.

Store the recovery directory on an appropriately protected/encrypted volume. A mode-0600 file request alone is not an encryption or Windows ACL guarantee. Retain the manifest and recovery files together, and use a second independently verified location when required by the recovery policy.

## Apply only the approved scope

Before apply, obtain approval for the exact manifest, object count/bytes, outbox effects, recovery location and external-retention decision. Establish a controlled write/drain window across **all** database/store consumers. Pause new uploads and writes that could introduce references, finish or pause relevant workers, and check active jobs. The tool cannot pause other applications or atomically freeze multiple databases/stores. `--confirm-drained` is the operator's explicit assertion that this prerequisite is currently satisfied.

```sh
npm run storage:apply -- --config artifacts/storage-scope.json --manifest artifacts/storage-recovery-20260908/manifest.private.json --approve-sha EXACT_APPROVED_SHA256 --confirm-drained
```

Apply verifies the manifest hash and every local recovery copy before authentication. It performs a fresh inventory and reference review, checks every selected object's version before the first deletion, then rechecks each object and deletes it individually with `ifMatch` using the approved ETag. SDK retries are disabled. A successful delete response alone is insufficient: the object must be confirmed absent before the exact captured outbox row can be acknowledged. Changed or new queue rows remain untouched. No other application data, database, environment, deployment or cron configuration is modified.

A durable journal records deletion intent before the external action. If an operation fails or its response is uncertain, stop and inspect the journal and remote state. The tool does not automatically roll back or retry. After resolving the failure and re-establishing the drain window, the same approved manifest may be resumed explicitly with `--resume`. Recovery copies and all references are checked again. A previously journaled object that is now absent is not deleted again; outbox acknowledgment can finish independently. A reappeared object, changed ETag, changed row, new reference or incomplete scope stops the run. A stale `apply.lock` after a process crash must be reviewed and removed only after verifying no apply process is running.

## Recovery and limits

Blob deletion is not an undelete operation. Recovery re-uploads the saved bytes to the same surviving store and exact original pathname with the saved access, MIME type and cache duration, `addRandomSuffix: false` and `allowOverwrite: false`. Verify the returned URL and content SHA-256. Stop if the pathname already exists. Service-generated ETags and timestamps are not caller-preservable or guaranteed, and cache/request history is not restored. Do not remove the local recovery copy after an upload merely returned success.

Outbox rows can be restored from `objects[].intents[].row` in the private manifest using an explicitly reviewed transaction and typed `jsonb_populate_record(null::archive_blob_deletion_outbox, ...)`. Confirm the original ID and target are absent; never overwrite an existing or edited row. Restore source IDs as their saved decimal strings. Do not replay a destructive apply operation as a recovery mechanism. Recovery uploads or row restoration require their own concrete authorization when it is not already provided.

## Verification

`npm run test:unit` includes pure lifecycle tests covering shared/historical references, ownership/retention, approval/recovery checks and interrupted apply. `npm run test:storage-db` is a separate integration check. Set `STORAGE_LIFECYCLE_TEST_ADMIN_URL` to an owned `127.0.0.1` PostgreSQL `/postgres` connection. It creates an absent, randomly named test database, checks real JSON/reference queries and exact outbox acknowledgment, then drops only that database after verifying its owner, marker, OID and absence of other sessions. It never uses Blob storage or a remote database.
