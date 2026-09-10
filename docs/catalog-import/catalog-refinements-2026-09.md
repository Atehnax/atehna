# Catalog notes, canonical SKUs and image refresh — September 2026

The admin catalog now keeps manual notes separate from inventory. The legacy `na-zalogi` value displays as **Brez opomb**, using a neutral badge. Administrators can create, rename, recolor and hide note choices in `admin/podoba/artikli`; existing custom values remain selectable and stock edits leave notes alone. Supplier notes accept line breaks and preserve blank lines.

Bulk activation opens a choice between activating all variants and activating the first ordered variant of each selected item. Existing active variants remain active. Eligible selections activate even if other variants have zero prices or incomplete publication data. Skipped items and reasons appear below the Zaloga summary and above the article table. Missing shipping mass or dimensions do not block activation or editor saves; checkout shipping calculations remain separate. Malformed requests and ownership/infrastructure failures remain atomic errors. No activation happens until the choice is confirmed.

The optional article thumbnail first uses an image shared by every variant. If none exists, it uses the first variant's first visible assigned image, including inactive variants. Local catalog assets use appropriately sized Next image responses in the table.

## SKU convention

Each category level contributes its first three normalized ASCII letters, followed by the first three letters of the article name: `Materiali / Kovine / Aluminijasta plošča` becomes `MAT-KOV-ALU`. Where that collides, an additional meaningful name segment distinguishes articles (for example `MAT-LEP-UHU-KRA` and `MAT-LEP-UHU-SUP`).

Dimensional variants use thickness, length and width, separated by lowercase `x`, with `P` for decimal points: `MAT-KOV-ALU-0P5x300x200`. Descriptive choices such as color or formulation receive additional readable tokens. The editor offers **Predlagaj po kategoriji** for the base code and uses the same dimension formatter in generated variant codes. Existing manually edited codes are not overwritten merely by opening an article.

`scripts/correct-atehna-catalog-skus.ts` corrects the 43 reviewed imported families. It defaults to a dry run, requires an explicit environment and validates the exact database destination. `--apply` saves and rereads a backup, uses a serializable transaction, checks uniqueness, updates exact internal SKU references and preserves immutable order snapshots. Machine SKU aliases retain matching with historical equipment orders. Unrelated articles, identities, prices, stock, classifications, media and commerce history are checked for preservation. A repeat run must produce zero changes.

## Historical image policy and provenance

The image refresh below is superseded by the real-photo replacement described in `real-photography-2026-09.md`. Generated imagery is no longer preferred or visible; its original records and assets remain available for rollback.

`data/catalog/image-upgrades-2026-09.json` records each reviewed native image, its source or generation prompt, checksum, resolution and variant assignment. The original import manifest carries the final visible media and image-slot mapping, so a future import does not restore blurry photos or older SKU formats.

Galleries combine clear product photographs with workshop, classroom and application views. White is used for isolated product views; it is not imposed on every image. Authentic context is preferred. New illustrative scenes are identified in their Slovenian alternative text and provenance. Props, pictured model projects and packaging variations do not establish included quantities or specifications. Material representations do not replace the selected variant's written dimensions or color specifications.

The shared personal skill `atehna-product-background` has been updated to the same policy. Built-in generation works for new illustrations. Reference-image edits remain unavailable because the Windows sandbox cannot read the source file; no paid image API fallback was used.

`scripts/upgrade-atehna-catalog-images.ts` defaults to a dry run and independently checks the database destination, 43 known product slugs, asset bytes, native dimensions and reviewed image IDs. It matches imported variants using names corroborated by SKU or stored physical dimensions; retained production-only metal formats have explicit dimensional selectors. It saves a rollback snapshot before writes, applies all image changes transactionally and verifies that unrelated catalog and commercial fields are unchanged. Old media are retained; obsolete blurry images are hidden only when their affected variants have reviewed replacements. Only explicitly audited incorrect assignments are removed (the red balance photograph was linked to the gray balance). Reviewed replacements and each variant’s image list use their explicit preferred order, with a sharp product view first. Reapplying an amended image order reconciles existing replacement positions without changing other metadata. Repeating the same manifest must report zero mutations.

## Verification and deployment

The admin implementation passed all 1,652 unit tests, repository lint, the production build and 12 authenticated browser cases covering notes, activation, supplier notes and thumbnail behavior. Additional migration guard tests cover mismatched/reused SKUs and ambiguous retained dimensions. Browser tests use a disposable database.

Deploy compatible code and image assets before the production image update. Apply guarded SKU/image migrations to the confirmed production database, retain their ignored `tmp/catalog-refinements/` snapshots and verification files, then invalidate only the `catalog-public` and `catalog-admin` Vercel cache tags. Recheck the canonical production deployment and sample asset responses.

Final coverage: all 43 families have at least two distinct reviewed quality views. All 182 original variants plus two retained production aluminium formats have reviewed product imagery. The release adds 145 unique native assets (146 catalog media records), including genuine source photographs and explicitly representative illustrations. Local application added 146 records, hid 52 obsolete images and removed one incorrect assignment. Its second application produced zero mutations. Source brand/material ambiguities for the school balances and the historical Trigonir216 name remain documented in the image manifest; this image update does not invent replacements for those specifications.
