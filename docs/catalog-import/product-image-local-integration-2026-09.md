# Product image delivery — September 2026

The reviewed gallery ledger is `data/catalog/reviewed-local-gallery-2026-09.json`. It contains 213 image records backed by 215 public files for 166 variants across 36 families. Original-resolution sources and approved source-specific exceptions are recorded there. Display crops keep native originals available for zoom; thumbnails use Next image optimization.

The admin editor supports actual staged image deletion with an always-visible control labelled and titled **Izbriši sliko**. Save persists removals, cancel discards them, remaining order is preserved, the next image becomes main, and the final image can be removed. Shared uploads and full-original references remain protected by the storage lifecycle.

Product galleries and zoom previews contain no visible image descriptions. Authored image footers were removed from the selected material details. The R20 quantity-group detail is omitted. The RE260 detail was restored after exact masking removed the unrelated 21 mm comparison part without synthesizing product surfaces. Accessibility metadata and measurement diagrams remain available.

## Database boundary

The reviewed ledger was applied and verified only in the existing local development database. Git publication distributes code and assets; it does not apply these catalog associations to production.

`scripts/apply-reviewed-local-gallery.ts` is deliberately local-only. It defaults to a dry run and requires its exact reviewed plan hash for apply. It preserves technical diagrams, aluminium, skipped variants, product state, commerce data and gallery order. Repeat planning against the final local state makes zero changes.

`scripts/stage-reviewed-local-gallery.mjs` is the original preparation workflow and requires the local research packages under ignored `output/product-images/`. The release already contains the selected public assets and ledger; no staging run is required to build or serve the site.

## Verification

The final optimized build and TypeScript check passed. Focused image-quality, catalog import/removal, metadata and storage tests passed (95 tests). Three admin deletion browser cases previously passed, covering saved/unsaved uploads, main/final removal, save/cancel, failed saves, reload and storefront updates. Final local browser checks covered description-free desktop/mobile galleries and zoom. Import receipts confirmed unchanged protected data and idempotency.

## Remaining source gaps

The complete image-quality goal is not achieved. THERMOFORM 400 and the 100 g solder reel still lack qualifying exact-product mains. Geotriangle contrast, existing compass softness, source-limited tiny UHU warning text and unavailable independent views remain unresolved. The ten user-excluded variants remain untouched. The four aluminium variants are considered completed by the user and were preserved.

No photos of a different product or revision were substituted to fill these gaps. Crops, derivatives and same-pose illustrations are not additional independent captures.
