# Selected catalog photo refresh

`scripts/refresh-atehna-catalog-photos.ts` reads only the selected products in `data/catalog/photo-framing-2026-09.json`. It does not replay the historical catalog import or require old variant names, counts, SKUs, or measurements to remain unchanged.

Each product supports:

- `additions`: reviewed native photographs added as general, unassigned media. An existing URL may be reused only if it has no variant assignments.
- `replacements`: `{ fromBlobUrl, photo }`. The new photograph inherits exactly the current source media's variant links, including variants added after the original import. The old media row is hidden by default; its file and assignments remain available. Set `keepOriginalVisible: true` to preserve its current visibility as a secondary view.
- `leadBlobUrls`: ordered leading photographs. Global image order and existing matching variant assignments are updated without introducing new variant associations.

Each photograph records `id`, `blobUrl`, `sourceUrl`, `sourcePage`, `kind`, `dimensions`, `sha256`, `altText`, `visuallyVerified: true`, and review `notes`. `contextOnly` is optional. The asset must already exist under `public/images/catalog/YYYY-MM/`, and its actual bytes and dimensions must match the review. Known synthetic assets from the historical manifest cannot be relabeled as native photographs or promoted. Existing leading photos require matching `promotedExistingPhotos` review metadata in the manifest; their bytes and dimensions are also verified.

## Dry-run and apply

Provide a private `DATABASE_URL` for the exact existing target accepted by `resolveCatalogTypeTarget`, then run:

```powershell
node --import tsx scripts/refresh-atehna-catalog-photos.ts --target production
```

The default transaction is read-only. Its ignored `tmp/catalog-refinements/photo-framing-*/plan.json` records the manifest, exact proposed changes, and `planSha256`. Apply only after reviewing that plan and deploying any new static assets:

```powershell
node --import tsx scripts/refresh-atehna-catalog-photos.ts --target production --apply --expected-plan-sha256 <reviewed-hash>
```

`--target local` uses the separately guarded local catalog database. Neither mode creates, resets, imports, or drops a database. The script does not load environment files automatically.

Apply takes a serializable transaction, a catalog photo advisory lock, and locks only the selected products and their dependent rows. Before writing, it saves and rereads a rollback snapshot. It verifies all variant rows, unrelated media, product fields, and protected catalog/commerce hashes, and requires a second plan to contain zero changes before committing. No price, stock, options, specifications, status, or customer data is intentionally rewritten. Customer/commerce values are represented only by hashes in the snapshot.

## Rollback and publication

`before.json` contains the original catalog rows, image links, manifest, and plan. `verification.json` records newly inserted media IDs. Existing image files, rows, and assignments are retained. Roll back only the selected media fields and assignment positions from the saved before/plan, and hide newly inserted media rather than deleting history. Verify the current affected rows still match the applied plan before a compensating update; do not restore the whole catalog snapshot over subsequent edits.

Static assets must be available before assigning them in production. After an authorized apply, invalidate the `catalog-public` and `catalog-admin` cache tags using the application's established refresh path. The updater does not publish a deployment or invalidate caches itself.
