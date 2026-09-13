# Square catalog photos — September 2026

Catalog cards, catalog table thumbnails, related products, and product galleries use square white photo viewports. Photos use `contain` so an item is not cropped merely to fill its frame. Gallery thumbnails follow the same rule. An authored fixed-height gallery keeps its saved outer size and fits the square photo inside it. The zoom dialog retains the photograph's original proportions. Appearance previews match these rules; controls that offered an unsupported aspect ratio or crop mode have been removed.

The photo audit covered all 40 active production products: 131 visible photograph records, 129 distinct native photographs, and 137 excluded dimension-diagram records. Of the native photographs, 81 are rectangular and 40 have a short edge under 600 pixels. Square display does not alter their source pixels, crop useful context, or upscale files to claim higher quality.

## Reviewed lead photographs

`data/catalog/photo-framing-2026-09.json` records the current six-product refresh, source URLs, checksums, native dimensions, image-only assignments and review notes. It takes precedence over the historical real-photo manifests for these six products.

| Product | Change |
| --- | --- |
| Penjeni PVC | Lead with the original ATEHNA angled sheet stack; retain the corner detail as a secondary image. |
| Šeleshamer | Replace the flat format collage with a real white 200 g paper photograph showing separated sheets and edge shadows. |
| Barvni papir | Lead catalog cards with the authentic multicolour overview. This new general media record is unassigned; exact colour photographs still lead their selected variant galleries. |
| Grafopak | Show both faces of white/grey GD2 card in the lead photograph. Retain the original Grafopak-specific detail as a secondary gallery photograph. |
| Lepenka | Promote the existing white-board edge photograph so its core and surface are visible. |
| Risalni list | Replace the nearly featureless sheet image with a native 1500 px drawing-paper photograph showing edges and surface texture. |

Pleksi steklo and Stiropor already have useful native square photographs with angled sheets and visible edges; those photos remain. Other product identities, colour references, dimension diagrams and application photography remain intact.

The choices follow [Amazon's product-photography guidance](https://sell.amazon.com/blog/product-photos): give the product most of the frame, use informative front or three-quarter angles, and make edges and texture legible. These are original supplier photos, not copied Amazon listings or newly generated objects. Material-family views do not establish an exact delivered brand, cut, weight or pack quantity. The Grafopak source shows the same GD2 material class at a different supplier weight; the catalog's 350 g specification and its original specific photograph are preserved. PVC and the colour overview remain native 312 px and 300 px respectively; larger reviewed candidates were less useful or showed mismatched branded props.

## Applying and verifying

`scripts/refresh-atehna-catalog-photos.ts` runs a narrow media-only plan. Set `DATABASE_URL` to the already configured, guarded local or production database, then run:

```sh
node --import tsx scripts/refresh-atehna-catalog-photos.ts --target local
node --import tsx scripts/refresh-atehna-catalog-photos.ts --target local --apply --expected-plan-sha256 <reviewed-plan-hash>
```

For production, deploy the code and static assets first and use `--target production`. Read and review that environment's new dry-run plan; a local plan hash is not a production plan. The script rejects a changed plan, saves and rereads a rollback snapshot, inherits each replacement's current variant links, preserves unrelated data, and requires a repeated plan to make zero changes. Original files, media rows and historical assignments remain available for rollback. Only the explicitly superseded pale photographs become hidden; Grafopak's original stays visible.

Invalidate only the catalog-public and catalog-admin cache tags after production application, then verify the canonical public product cards, selected-colour gallery, image responses and mobile/desktop square framing. Do not rerun historical photo migrations or the full catalog importer to perform this refresh. The canonical import JSON has been synchronized solely for future imports; all non-image fields are checked unchanged.
