# Production dimension-sketch publication — 13 September 2026

The separate reviewed production manifest is `data/catalog/dimension-sketches-production-2026-09.json`.
It covers **149 variants across 22 production products**, using a read-only snapshot
of the guarded production database taken on 13 September 2026. The original local
manifest and local catalog remain unchanged.

147 existing images were verified against the production geometry, colour and material.
Two additional square 1800 × 1800 SVGs were rendered for the production aluminum
200 × 100 × 0.5 mm and 300 × 100 × 0.5 mm variants. All numeric labels remain horizontal.
The local-only 1 mm aluminum variant and local-only steel rule product are excluded;
they are not created in production.

Four copper names put thickness first in production. Two aluminum variants and one
copper variant contain additional local presentation attributes absent in production.
The actual dimensions, colour and material match the reused drawings. The production
manifest records the existing production names, option labels and specifications;
the publisher does not copy local product metadata.

## Publication

1. Deploy the code, both manifests and SVG assets through the normal verified PR.
2. Supply DATABASE_URL explicitly for the existing guarded production host and
   atehna_production database. The script never reads an environment file itself,
   never accepts an arbitrary host and never changes the database target.
3. Preview the exact plan:
   `node --import tsx scripts/catalog-dimensions/publish-production.ts --target production`.
4. Publish after reviewing that plan:
   `node --import tsx scripts/catalog-dimensions/publish-production.ts --target production --apply`.
5. Invalidate `catalog-public,catalog-admin` using the project's authenticated
   Vercel CLI; inspect representative product galleries and a selected variant's
   SVG on the canonical production site.
6. Repeat the dry run; it must report zero changes.

Every item and variant is resolved afresh by **product slug plus SKU**. Stored IDs are
snapshot evidence, never cross-environment bindings. The exact product title, full
variant set, variant names, geometry, option labels and specifications must still
match the reviewed production snapshot. Drift stops publication for review.

Before a production write, all 149 SVG responses from https://atehna.vercel.app must
have the expected MIME type and SHA-256 bytes. The same local assets are verified
again within the write transaction. The publisher appends gallery media and exclusive
variant links; it may only hide obsolete sketches belonging to this managed workflow.
It does not alter photographs, product records, prices, stock, activation, suppliers,
orders or order snapshots.

An explicit dry run uses a read-only repeatable-read transaction. Application uses a
serializable transaction, advisory lock, parent-first record locking, saved and reread
rollback snapshot, protected-table hashes, reread validation and an idempotence check
before commit. Audit plans and rollback files are retained under
`tmp/catalog-refinements/dimension-sketches-production-*/`.
Customer/order bodies are not copied into backups; only protected-table hashes are saved.

Rollback must target only the inserted media and links in the saved applied plan, and
restore only any managed sketch visibility changes recorded there. Do not restore a
whole catalog snapshot over subsequent administration or order activity.
