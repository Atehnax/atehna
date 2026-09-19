# Product-image continuation, 14 September 2026 (v7)

**Three more exact variants now have qualifying real photographs.** They are saved in the canonical import catalog, local development catalog and production database. Missing-photo variants decreased from 135 to **132 of 185**; **15 entire families still have no suitable photograph**. The overall request remains incomplete, including the requested 4–6 different useful views where matching sources can be obtained.

## Saved changes

| Exact variant | Original saved | Gallery |
|---|---|---|
| Medeninasta plošča, 200 × 200 × 0.5 mm | 1600 × 1600 | Complete unbranded brass-sheet main; existing schematic retained. Product remains inactive. |
| Risalni list, A3 (420 × 297 mm) | 1024 × 1024 | Complete white drawing-paper main; existing schematic follows. |
| Risalni list, A2 (594 × 420 mm) | 2400 × 2400 | Separate complete white drawing-paper main; existing schematic follows. |

Both paper captions state that the product is sold by the sheet and that extra pictured sheets are not included. Source bytes were copied unchanged and checked by SHA-256 after upload and after saving. No upscaling, padding, recolouring, generated objects or invented views were used. No candidate containing a hand or other human part was published.

The [brass source](https://www.ebay.com.au/itm/287578979275) explicitly specifies brass, 200 × 200 mm and 0.5 mm. Its package-content/dimension graphic incorrectly says copper; this supplier copy conflict is documented. Its brass title, material specification, description and natural golden main were corroborated, and the conflicting graphic was excluded.

The A3 original is supplied by Creativ Company and matches the [Crea drawing-paper listing](https://creaknutselen.nl/tekenpapier-a3-wit-120-gr-250-vellen/) byte-for-byte. Its current manufacturer/reseller 130 g/m² versus 120 g/m² discrepancy is recorded. ATEHNA's original white drawing-paper listing specifies format but no maker or grammage; no source-only weight, brand or pack size was added. The [A2 source](https://www.heutinkvoorthuis.nl/nl/tekenpapier-wit-offsetkwaliteit-120-grams-500-vel-a2/product/9161/) supplies a distinct original for 42 × 59.4 cm white drawing paper. Only the exact A2 and A3 variants receive these photographs.

## Verification

- Production now has **58 visible photo records and 151 retained schematics**, zero hidden photographs, zero visible photos below 1024 pixels on either axis, and zero unreadable visible images.
- Transactions checked that retained image order/associations, schematics, product publication states, prices, variant data and the deletion queue stayed unchanged. Repeated addition plans returned zero mutations. Public and admin catalog caches were refreshed.
- Live gallery checks passed all four drawing-paper variants. Separate reload/reselection checks confirm that A2/A3 keep their respective photos and A4/A5 do not inherit them. Main-first order, both captions, two zoom dialogs and original-image links passed. The product listing shows a new paper photograph; inactive brass remains absent from public listings. Desktop and mobile screenshots were visually reviewed without layout changes or broken images. Smaller views use optimized images while originals remain available for zoom.
- All 38 focused image-addition, actual-deletion and catalog-import tests passed. The existing admin deletion implementation and its earlier save/cancel, shared-file and permission checks are unchanged; this pass made image/data changes.

Evidence: [image manifest](../../data/catalog/product-image-additions-v7-2026-09.json), [full variant audit](../../data/catalog/product-image-audit-v7-2026-09.json), [live gallery results](../../tmp/product-image-audit/production-browser-v7/report.json), [reload and listing results](../../tmp/product-image-audit/production-browser-v7/reload-listing-report.json), [persisted originals](../../tmp/product-image-audit/production-browser-v7/persistence-report.json), [independent source review](../../tmp/product-image-audit/wood-plastics-v7/accepted-batch-independent-scope-review.json).

## Source checks that did not yield replacements

- Wood/PVC/acrylic: 20 new source groups and 18 downloaded files. Exact-cut originals were too small, showed incompatible thickness/colour, had poor detail, or lacked a complete main. Poplar edge candidates remain held until an appropriate whole-sheet main is found.
- Tools: 12 families and 19 scoped variants; 14 new downloaded candidates rejected. Sharper motor photos had different caps/terminals/ventilation; hammer photos had different historical markings or colour. Exact old revisions remain unresolved.
- White paper/board: 2 accepted originals; 13 of 15 scoped variants still lack suitable sources. 20 measured rejected records and one potential 200 g/m² A3 detail remain documented. The detail is not presented as a whole main.
- Coloured paper: new black 130 g/m² B2 sources measured 2048 × 2048 but lacked useful texture detail, or were only 640 × 640. Newly checked red-cardstock gallery files did not establish the matching plain-sheet view/colour and useful extra views.
- Metals and EPS: further exact-size listings were checked; originals were undersized, inaccessible, or shared across incompatible cuts/thicknesses. No substitute products were assigned.

Source ledgers: [metals](../../data/catalog/replacement-sources-metals-v7-2026-09.json), [white paper/board](../../data/catalog/replacement-sources-paper-v7-2026-09.json), [wood/PVC/acrylic](../../data/catalog/replacement-sources-wood-plastics-v7-2026-09.json), [tools](../../data/catalog/replacement-sources-tools-v7-2026-09.json), [EPS](../../data/catalog/replacement-sources-eps-v7-2026-09.json), [coloured paper](../../data/catalog/replacement-sources-colour-paper-v7-2026-09.json).

## Products still needing suitable sources

These families have no qualifying photograph. They need a complete main view plus genuinely distinct useful views where available; schematics remain in place.

| Family | Variants missing photos |
|---|---:|
| Pocinkana pločevina | 4 |
| Stiropor | 4 |
| Šeleshamer | 4 |
| Barvni papir | 27 |
| Grafopak | 2 |
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

These partially covered families still have missing variants:

| Family | Variants missing photos |
|---|---:|
| Aluminijasta plošča | 4 |
| Bakrena plošča | 1 |
| Medeninasta plošča | 2 |
| Penjeni PVC (komateks) | 3 |
| Pleksi steklo | 6 |
| Fotokarton | 18 |
| Lepenka | 5 |
| Risalni list | 2 |
| Motorček | 2 |
| Ravnila za tablo | 2 |
| Spiralne žagice za les in mehke kovine | 1 |

The full audit lists each affected SKU and every variant's photo count. The remaining sources have not been replaced with similar products, guessed colours or fabricated views.
