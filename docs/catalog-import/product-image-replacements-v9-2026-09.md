# Product image replacements — v9

Continued source research across 20 families, including 100 variants without photos at the start of this pass. Saved four untouched original photographs across five variants in two families. Three variants gained their first qualifying photograph; two received an additional useful detail. The overall task is incomplete.

## Saved changes

| Product / variants | Change | Native resolution |
|---|---|---|
| Barvni papir — black, red, light brown; B2, 130 g/m² | One complete main photograph for each exact named colour | 3000 × 3000 each |
| Aluminijasta plošča — 100 × 100 and 300 × 300 mm, 0.5 mm | One independent surface/corner/edge photograph added after existing complete mains | 1920 × 1440 |

Paper sources: [black](https://jetzt-kommt-kurth.de/tonpapier-130-g-schwarz-50-x-70-cm/011390), with red and light-brown exact product URLs in the source manifest. The source identifies DIN B2 approximately 50 × 70 cm; imported ATEHNA dimensions remain unchanged at nominal B2 500 × 707 mm. These are matched unbranded commodity photographs by material, paper weight, named colour, format and comparison with the original ATEHNA images. The original catalog does not identify a manufacturer; no manufacturer or special shade code is asserted. Other visible sheets are explicitly excluded by the Slovenian captions.

The [aluminium source](https://www.modulor.de/aluminiumblech-tafeln-0-5-x-250-x-250-mm-st.html) identifies the 0.5 mm stock and offers custom cuts. The detail shows the surface and cut edge without claiming a full sheet extent. It is assigned only to two already-covered 0.5 mm variants, never 0.3 mm or a variant without a main. The generic mixed-thickness stack was rejected as a main because the top sheet thickness could not be established. No alloy, temper or manufacturer claim was added.

## Verification

- Four immutable uploads verified against original SHA-256 hashes and native dimensions. Canonical, local and production saves succeeded; repeat plans produce zero changes.
- Five exact variant associations read back from production. Prices, stock, product status, specifications, existing images and all 151 schematics preserved.
- Product and admin cache tags refreshed. Paper listing now uses a new whole-sheet main; aluminium listing retains its existing complete main.
- All 27 paper and four canonical aluminium variant selections checked live; five changed variant/image combinations passed gallery, caption, original zoom and reload checks. Full production association verification also excludes every other variant.
- Desktop, zoom and mobile screenshots visually reviewed. Optimized smaller sources remain in normal displays and unchanged originals remain available for detailed viewing.
- 38 focused import, association and actual-deletion regression checks passed. The previously completed admin deletion implementation remains unchanged in this source-only batch. No new admin end-to-end deletion run was needed or claimed.

## Remaining sources

| Family reviewed in this pass | Variants still without qualifying photos |
|---|---:|
| Vezana plošča | 30 |
| Pocinkana pločevina | 1 |
| Stiropor | 4 |
| Šeleshamer | 4 |
| Grafopak | 2 |
| Barvni papir | 24 |
| Krivilnik za plastične mase THERMOFORM 400 | 1 |
| Kladivo | 4 |
| Aluminijasto ravnilo z ročajem (40 cm) | 1 |
| Žica za lotanje | 1 |
| Žagice za rezanje kovin | 3 |
| UHU Super glue | 1 |
| Motorček | 2 |
| Ravnila za tablo | 2 |
| Spiralne žagice za les in mehke kovine | 1 |
| Aluminijasta plošča | 4 |
| Bakrena plošča | 1 |
| Medeninasta plošča | 2 |
| Penjeni PVC (komateks) | 3 |
| Pleksi steklo | 6 |

Across the complete catalog: 60 of 185 variants have qualifying photos; 125 remain without them. 12 families have no qualifying photograph at all: Stiropor; Šeleshamer; Grafopak; Krivilnik za plastične mase THERMOFORM 400; Kladivo; Žica za lotanje; Žagice za rezanje kovin; Aluminijasto ravnilo z ročajem (40 cm); Otroški zaščitni predpasnik; Otroška očala za zaščito oči; Očala za zaščito oči; UHU Super glue. Many photographed products also still need additional genuinely distinct useful views. Four-to-six images per product has not been achieved.

The source ledgers record exact SKU gaps and candidate decisions. Examples: native 1000-pixel aluminium images fail the stated resolution threshold; paper shades that visibly differ were rejected; a sharp galvanized sheet remains held because the supplier calls it a representative series image without establishing the photographed cut; cropped copper stacks fail as complete mains; exact medium Pebaro blade packaging has poor native label detail despite large pixel dimensions. No images were enlarged, padded, recoloured, generated or substituted to inflate completion.

## Evidence

- `data/catalog/product-image-additions-v9-2026-09.json`: original source URLs, hashes, hosted originals and exact SKU associations.
- `data/catalog/product-image-audit-v9-2026-09.json`: full catalog coverage and save receipts.
- `data/catalog/product-image-batch-v9-2026-09.json`: all researched families and remaining counts.
- `data/catalog/replacement-sources-{materials,paper,tools,root}-v9-2026-09.json`: source evidence and explicit accept/reject decisions.
- `tmp/product-image-audit/production-browser-v9/`: live-gallery, listing, mobile, zoom and persistence evidence.
