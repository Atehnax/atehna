# Product image replacements — continuation v5, 14 September 2026

**Twelve new original photographs are saved for twelve exact variants across seven families. The request remains incomplete: 16 families have no qualifying photograph, and 137 of 185 variants have none. Most products also still need additional informative views.**

This continues the previous 22-family/147-variant gap. Seven families gained photographs. A separate accuracy correction removed an earlier wrong hammer photograph from two variants, so the net gap is 16 families/137 variants. There are now 53 visible photographs and 151 unchanged schematics: 204 image rows, no hidden photographs, no visible photos below 1024 pixels on either axis, and no unreadable visible images.

## Applied originals

| Family / exact variants | New photographs and native resolution | Remaining views |
|---|---|---|
| Spiral blades, fine PEBARO 134-1 and medium 134-3 | One original pack per grade; 2836 × 3274 and 3024 × 3668 | Unpackaged blade/tooth details; coarse grade still lacks a source |
| Aluminium, 300 × 300 × 0.5 mm and 200 × 100 × 0.5 mm | One complete view per cut; 1600 × 1600 each | Reverse and thin-edge detail; five other variants lack photos |
| Copper, 300 × 200 × 0.5 mm; 100 × 100 and 200 × 200 × 0.5 mm | Rectangular main plus supplier's shared square main; 1600 × 1600 | 300 × 300 cut and further views |
| Brass, 100 × 100 × 0.5 mm | Complete main; 2000 × 2000 | Other three cuts and further views |
| White acrylic, 300 × 200 × 3 mm | Complete main with partly peeled protective film; 1600 × 1600 | Reverse/edge; six other variants lack photos |
| Fotokarton, ordinary white and black B2/300 g/m² | One separately photographed complete sheet per colour; 3000 × 3000 each | Surface/edge views; 18 other colours lack photos |
| Greyboard, A4/0.8 mm | Complete sheet and separate surface/edge view; 1500 × 1500 each | Other five variants lack photos |

Each published file retains its source bytes, dimensions and SHA-256 hash. No enlargement, padding, recolouring, generated views, people or substituted numbered models were accepted. The square copper photograph is counted once despite its supplier explicitly assigning it to two square sizes. Photographs of multiple sheets visibly state that additional sheets are not included. A repetitive greyboard photograph was excluded.

Matching unbranded materials uses the original ATEHNA material, colour, finish, thickness and cut descriptions; no new alloy, optical-property or supplier-brand claims were added. B2 cardstock is matched to the original named format. The current 707 × 500 mm value was introduced by an import formula; the original listing states B2 only, while the supplier calls it DIN B2, approximately 50 × 70 cm. The photographed sheet is not claimed to have a measured 707 mm edge. Existing specifications remain unchanged.

Copper and brass were already inactive and remain excluded from public listings. Their saved image associations and originals were verified in production. The 200 × 100 aluminium SKU exists only in production: its photograph was applied there without creating a new local/canonical variant. The other 11 photographs are saved in production, local development and the canonical import catalog.

## Source trace and accuracy corrections

- Blade grades were resolved from the [original ATEHNA pack photographs](https://atehna.si/product/spiralne-zagice-za-les-in-mehke-kovine/) and exact old package numbers, then matched to [fine 134-1](https://www.coolbox.ua/ru/product/spiralnye-pilki-dlya-ruchnogo-lobzika-1-pebaro) and [medium 134-3](https://www.coolbox.ua/ru/product/spiralnye-pilki-dlya-ruchnogo-lobzika-3-pebaro). Modern grade numbering was not substituted.
- Materials came from exact-cut supplier listings: [square aluminium](https://www.ebay.com.au/itm/306015737506), [copper](https://www.harfington.com/en-ca/products/p-1457778), [brass](https://www.harfington.com/products/p-1065462?variant=45528554176761) and [white acrylic](https://www.harfington.com/products/p-1680316). Every additional source and SKU is in the manifest.
- Paper sources: [A4/0.8 mm greyboard](https://www.mailshack.co.uk/a4-800-microns-08mm-greyboard), [white 300 gsm B2](https://jetzt-kommt-kurth.de/fotokarton-weiss-300-g-m2-50-x-70-cm/013000) and [black 300 gsm B2](https://jetzt-kommt-kurth.de/fotokarton-schwarz-300-g-m2-50-x-70-cm/013090).
- Corrected my earlier Unior 300 g hammer assignment. Original variation-specific records show a different red-handled GS hammer for the 300 g variants. One media row and its two associations were actually deleted from production/local/canonical; the empty state was verified live after reload. No wrong replacement was supplied. The repository source remains as audit evidence, without a catalog association.
- Two provisional black 130 gsm paper sources were withdrawn before any catalog association was saved. Cross-checking another colour revealed identical fan/stack geometry with flat colour fills. These supplier templates are not counted as real source photographs. The 27-colour paper family still needs suitable images. Their two unused hosted test uploads have no product associations and are retained under the existing 24-hour storage cleanup age gate; they are excluded from both import manifests and image counts. Local public copies were removed, while source evidence remains in the audit folder. The [cleanup receipt](../../data/catalog/rejected-image-upload-cleanup-v5-2026-09.json) records ownership/hash verification and zero references across 25 configured databases; no blob deletion was attempted.

## Remaining source gaps

These families need a complete main photograph and genuinely useful additional views:

| Family without any qualifying photo | Variants |
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

Additional variants without photographs in partially covered families:

| Family | Variants still without photos |
|---|---:|
| Aluminijasta plošča | 5 |
| Bakrena plošča | 1 |
| Medeninasta plošča | 3 |
| Penjeni PVC (komateks) | 3 |
| Pleksi steklo | 6 |
| Fotokarton | 18 |
| Lepenka | 5 |
| Motorček | 2 |
| Ravnila za tablo | 2 |
| Šolska tehtnica | 1 |
| Spiralne žagice za les in mehke kovine | 1 |

The [variant audit](../../data/catalog/product-image-audit-v5-2026-09.json) identifies every missing SKU. Further views should show useful edges, backs, controls, connectors, construction or included components; crops and rotated/mirrored versions do not count. Large native files were rejected when soft, padded, cropped, human-containing or inconsistent with the sold colour/model/cut. An EPS source that advertises two sizes remains unresolved; photos of only a similar hammer, motor winding, plywood cut, UHU package or paper hue were not substituted.

## Verification and saved evidence

- All 12 originals and 13 variant associations passed fresh production checks for hashes, dimensions, visibility, text and exact SKU scope. All 151 schematics and their associations are unchanged. Transactional apply checks confirmed retained images/order, commercial data and deletion queue unchanged; immediate repeat plans produced zero mutations.
- Public/admin caches were invalidated. Live browser verification passed 5 public families, 40 variant states and 8 public photographs; the production-only aluminium photograph passed an additional independent exact-SKU, caption, zoom, reload and wrong-variant exclusion check. Copper/brass publication status was preserved and checked separately.
- Native originals remain available through zoom links. Smaller gallery displays serve optimized images: observed 604 native pixels at 300 CSS pixels. Desktop/mobile screenshots and related-product displays were visually reviewed; layout and styling were unchanged. Browser checks reported no errors.
- The earlier deletion implementation remains in place with accessible “Izbriši sliko” controls. Saved/unsaved/main/final deletion, save/cancel, permissions, persistence errors and shared-file protection were tested in the earlier pass. This continuation made data/source changes, not deletion-runtime changes. The 38 focused addition/deletion/import tests passed during this continuation; diff whitespace checks passed.

[Production manifest](../../data/catalog/product-image-additions-v5-2026-09.json), [local/canonical scope](../../data/catalog/product-image-additions-v5-development-2026-09.json), [hammer removal](../../data/catalog/product-image-removals-v5-2026-09.json), and source ledgers: [materials](../../data/catalog/replacement-sources-materials-v5-2026-09.json), [paper](../../data/catalog/replacement-sources-paper-v5-2026-09.json), [tools](../../data/catalog/replacement-sources-tools-v5-2026-09.json), [EPS](../../data/catalog/replacement-sources-eps-v5-2026-09.json), [other sources](../../data/catalog/replacement-sources-root-v5-2026-09.json).

Browser evidence: tmp/product-image-audit/production-browser-v5/report.json, persistence-report.json, aluminium-200 x 100-independent-verification.json and hammer-removal-report.json. Production transaction snapshots are listed in the variant audit. No commit or runtime deployment was made in this continuation.
