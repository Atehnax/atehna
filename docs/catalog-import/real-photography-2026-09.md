# Real catalog photography and image-table refinements — September 2026

The activation result now appears below the Zaloga summary and above the article table. The editor's media table shows only Glavna slika / Slika N, omits SKU from assignment tags, contains tags inside their cell, and keeps pixel dimensions on one line. Image previews and assignment editing remain available.

## Photograph policy

Use original, visually reviewed photographs from manufacturers and suppliers. Preserve natural texture, lighting, context, and supplier marks. Do not generate replacement products or scenes, recolor materials, invent packaging, or enlarge tiny sources to claim higher quality. Contextual photographs supplement a clear material/product view. A material-family photograph does not certify the dimensions of every available cut; catalog dimensions remain authoritative.

The three `data/catalog/real-photo-*-2026-09.json` manifests record source pages and image URLs, native dimensions, SHA-256 checksums, review notes, explicit variant assignments, and the superseded URLs. They are the authoritative image refresh. The older `image-upgrades-2026-09.json` remains historical provenance; its executable upgrade refuses to run after supersession.

## Applying the photo refresh

Run `node --import tsx scripts/replace-atehna-generated-images.ts --target local|production` with DATABASE_URL already naming the exact guarded target. Dry-run is the default; add `--apply` for the reviewed plan. Production is restricted to the existing atehna_production database on the known Neon host; local is restricted to atehna_e2e_localhost_quote on port 55434. Deploy the new static assets before applying production data.

The script validates every manifest, native image checksum, and image dimension before connecting. It matches variants by verified identity, not row order alone. A serializable apply writes and rereads a rollback snapshot before mutations, then hides only explicitly superseded image records and removes their variant links. It preserves underlying files/rows for rollback. It verifies all variants have a clear reviewed photograph, checks all item/variant/pricing/stock/supplier/commerce data against the pre-change state, and requires a second planning pass to produce zero changes. Existing real photos are reused by URL.

The canonical import JSON is synchronized only for future imports; do not rerun the full catalog importer against the current production catalog. This image migration preserves prices, activation states, stock, physical specifications, categories, and customer data.

After applying, invalidate catalog-public and catalog-admin caches and verify the canonical production deployment, representative static assets, and a no-op repeat dry-run.

## Reviewed coverage and remaining source limitations

The refresh selects 95 original-photo entries across 30 product families (51 materials, 36 tools, 8 metals) and explicitly supersedes 106 distinct image URLs. Every affected variant has a clear reviewed product or material-family photograph. General lepenka imagery does not assert the unknown colors of three existing variants. Existing retained aluminium formats receive general material photography without changing their measurements.

All refreshed families have two distinct photographs except the 40 cm handled aluminium ruler and the original UHU Super glue 3 ml; only one matching real view was verified for those products. Mismatched lengths, newer packaging and other models were rejected. Some exact legacy supplier photos remain modest native resolution. No artificial upscaling, generated second views or duplicate shots are used to claim completeness. Context views of a single tool do not claim to show a supplied stand or full kit.

Local apply verified all non-image data unchanged and a repeated run made zero changes. Validation includes the production build, unit tests, targeted browser checks for activation notice placement, previews, visible tag containment, one-line pixels and same-size variant choices.
