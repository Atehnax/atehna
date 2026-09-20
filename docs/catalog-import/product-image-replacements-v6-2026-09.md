# Product-image continuation, 14 September 2026 (v6)

Two new native aluminium photographs are saved, and the existing genuine scale photograph now also covers the confirmed unweighted plastic variant. **Two more variants have qualifying photos. The overall request remains incomplete: 135 of 185 variants still lack qualifying photographs, including 16 entire families.** Many photographed products also still need further informative views.

## Saved changes

| Exact variant | Saved change |
|---|---|
| Aluminium, 100 × 100 × 0.5 mm, SKU MAT-KOV-ALU-0P5x100x100 | Two independently photographed 1600 × 1600 originals: complete main view, then a useful surface/edge close-up. The existing schematic follows them. Visible captions state that the sales unit is one sheet and extra pictured sheets are not included. |
| School scale, plastic without weights, original SKU 070112 | Added one exact-variant association to the existing 1800 × 1800 photograph. No duplicate image row or file. Retained the weighted variant association and image order. Shared caption clearly limits metal-weight inclusion to the plastic-with-weights version and excludes coloured cubes. |

The [aluminium source listing](https://www.ebay.com/itm/356659158673) specifies the exact cut and thickness, corroborated by its dimension photo and [second retailer listing](https://www.walmart.com/ip/5161202143). Fine natural silver grain and thin edges match the original unbranded ATEHNA material. No source alloy/temper claim was added to product specifications. The dimension composite, promotional repeat and human-containing application collage were excluded.

The [original ATEHNA scale listing](https://atehna.si/product/solska-tehtnica/) contains variation-specific descriptions: weights are excluded for 070112 and included for 65108. Three reviewers confirmed the same red body mouldings, hinged compartment, pan platforms, grey pans and pointer. Only the photographed compartment position and demonstration loads differ. The source's conflicting family-brand copy remains a separate catalog-data issue; this pass changes no specifications or brands.

All new original bytes and hashes are preserved. Changes are saved in production, local development and the canonical import catalog. The current production inventory contains **55 visible photographs and 151 preserved schematics**, with zero hidden photographs, zero visible photos below 1024 pixels on either axis and zero unreadable visible images. Existing publication statuses, prices, variants and other commerce data remain unchanged.

## Sources that still did not qualify

- Plywood: all 31 exact variants reviewed against 27 new source pages and 41 unique downloaded files. Whole-sheet sources were too small, cropped, too thick, or shared across incompatible wood/cut variants. The previously approved poplar edge detail still awaits a matching complete main photograph.
- Coloured paper/card: 19 new pages and 21 measured candidates for 45 remaining colour variants. Most were undersized, swatches or repeated templates. A real high-resolution Folia dark-green fan passes quality, but differs visibly from ATEHNA's colour reference; it remains held rather than recoloured or assigned by a similar shade name.
- Tools/electrical products: 13 families and 20 scoped variants checked. Sixteen downloaded candidates were rejected; one hammer remains pending. All 17 candidate files and the existing scale original passed the evidence-integrity check.
- Red 300 g hammer: a high-resolution historical BGS1852 source was found, but its triangular certification mark differs from ATEHNA's octagonal mark. The exact historical revision remains unresolved; it was not substituted.
- Metals/PVC/acrylic: new matching listings frequently supplied only 500–1000 pixel originals, shared images across thicknesses, or featureless/cropped graphics. Native dimensions alone were not treated as proof of useful quality.

Detailed sources, checksums, dimensions and per-candidate decisions: [materials](../../data/catalog/replacement-sources-materials-v6-2026-09.json), [paper](../../data/catalog/replacement-sources-paper-v6-2026-09.json), [wood](../../data/catalog/replacement-sources-wood-v6-2026-09.json), [tools and scale association](../../data/catalog/replacement-sources-tools-v6-2026-09.json).

## Remaining source gaps

Families with no qualifying photo:

| Family | Variants without a qualifying photo |
|---|---:|
| Pocinkana pločevina | 4 |
| Stiropor | 4 |
| Šeleshamer | 4 |
| Barvni papir | 27 |
| Grafopak | 2 |
| Risalni list | 4 |
| Vezana plošča | 31 |
| Krivilnik za plastične mase THERMOFORM 400 | 1 |
| Kladivo | 4 |
| Žica za lotanje | 1 |
| Žagice za rezanje kovin | 3 |
| Aluminijasto ravnilo z ročajem (40 cm) | 1 |
| Otroški zaščitni predpasnik | 1 |
| Otroška očala za zaščito oči | 1 |
| Očala za zaščito oči | 1 |
| UHU Super glue | 1 |

Additional missing variants in partially covered families:

| Family | Variants without a qualifying photo |
|---|---:|
| Aluminijasta plošča | 4 |
| Bakrena plošča | 1 |
| Medeninasta plošča | 3 |
| Penjeni PVC (komateks) | 3 |
| Pleksi steklo | 6 |
| Fotokarton | 18 |
| Lepenka | 5 |
| Motorček | 2 |
| Ravnila za tablo | 2 |
| Spiralne žagice za les in mehke kovine | 1 |

The [complete variant audit](../../data/catalog/product-image-audit-v6-2026-09.json) lists every affected SKU. These products need a clear whole-product main and any genuinely different useful views available; existing schematics remain in place.

## Verification

- Fresh production downloads verify all three affected originals, four final variant associations, hashes, dimensions and captions. The scale extension was also independently queried after commit.
- Transactional apply checks preserve all pre-existing image rows/order and links, technical schematics, variant/commerce data and the file-deletion queue. Repeated plans produce zero mutations. Snapshot directories are recorded in the audit.
- Public/admin catalog caches were invalidated. Live checks passed all seven production aluminium variants and all three school-scale variants, plus four explicit reload/reselection states. Main/detail order, variant isolation, accessory captions and three decoded zoom dialogs passed with no browser errors. Desktop/mobile screenshots show correct framing and captions without layout changes. Optimized gallery images were served at 604 pixels for 300 CSS pixels; zoom links retain the 1600/1800 pixel originals.
- The 38 focused image-addition, actual-deletion and catalog-import tests passed. The previously implemented admin deletion controls and save/cancel/shared-file protections remain unchanged; this pass made source/data changes, not deletion-runtime changes.

Manifests: [production additions](../../data/catalog/product-image-additions-v6-2026-09.json), [local/canonical additions](../../data/catalog/product-image-additions-v6-development-2026-09.json). Live evidence: tmp/product-image-audit/production-browser-v6/report.json, all-production-variants-report.json and persistence-report.json; independent scale evidence: tmp/product-image-audit/tools-v6-scale-independent-review.json. No commit or runtime deployment was made in this pass.
