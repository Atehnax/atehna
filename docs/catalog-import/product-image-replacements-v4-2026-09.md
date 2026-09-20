> Continued in [the v5 report](product-image-replacements-v5-2026-09.md):12 new originals;16 families/137 variants still without photos.

# Product image replacements — 14 September 2026

**Eleven reviewed photographs are now saved in production, local development and the canonical import catalog. The full request remains incomplete: 22 families still have no qualifying photograph, and 147 of 185 variants have none. Additional informative views are also missing.**

This pass reduces families without photos from 27 to 22 and increases visible photographs from 31 to 42. All 151 production schematics remain unchanged, including their IDs, metadata, order and variant links. The fresh inventory contains no hidden photographs, photographs below 1024 × 1024, or unreadable visible photographs.

## Applied photographs

| Product / exact variant | Applied views | Native dimensions | Still needed |
|---|---|---|---|
| Trigonir 216 | Front and reverse packaging/instructions | 1026 × 1026 each | Unpackaged side and pivot/scale detail |
| Goldsmith snips, 10 pieces in wooden stand | Complete set | 1024 × 1024 | Stand rear/side and blade/pivot close-up |
| Wissner 070110 scale | Complete front/three-quarter | 2400 × 1600 | Rear, pan and adjustment details |
| School scale 65108 with metal weights | Complete scale and open weight drawer | 1800 × 1800 | Rear, pointer and weight detail; 070112 still lacks a photo |
| White foamed PVC, 300 × 200 × 3 mm | Whole panel, angled edge, foam structure | 4240 × 2303; 3717 × 2454; 4608 × 3456 | Reverse; separate photos for the other three cuts |
| White panel switch with 12 mm neck | Whole switch, mounting thread/nut, case/terminals | 1565 × 1562; 1706 × 1708; 1374 × 1375 | Underside; the fourth source was only 1015 × 1015 |

Seven photographs are newly sourced assets. Four previously rejected native photographs—the two Trigonir views and two scales—were readmitted after matching the original ATEHNA physical photographs or model codes. The source ledger records these corrections individually. Generated, upscaled, poor-quality and wrong-variant sources remain blocked.

All eleven files are unchanged real photographs. No views were generated, enlarged, padded, recoloured or reconstructed. Native bytes were hashed and matched against the immutable hosted originals. The red scale retains moderate photographic grain, with useful drawer, pointer and construction detail. Each photograph is assigned only to its matching variant; six variants were improved.

The original PVC listing uses both “komateks” and “foreks” as generic material names. Its white colour, 3 mm thickness, 300 × 200 mm cut and original appearance match the selected source. No Excel brand or density claim was added.

Both scale galleries visibly state that the coloured cubes are not included. Metal weights are represented as included only for 65108. Existing catalog text calls 070110 metal despite the original description identifying plastic, and calls 65108 Wissner despite the exact original photograph appearing as Learning Resources. These text discrepancies are documented; product specifications were not changed during this image update.

## Source evidence

- [Original ATEHNA Trigonir](https://atehna.si/product/trigonir-216/) matched to [Hartis TRISO front/reverse](https://www.hartis.si/sl/p/5351/trigonir-samostojni-z-navodili-triso-12496.html).
- [Wiemann ten-piece snips set](https://www.wiemann-lehrmittel.de/holzblock-mit-10-goldschmiedescheren/w-91431).
- [Original ATEHNA scale variants](https://atehna.si/product/solska-tehtnica/) and [Wissner 070110 manufacturer original](https://www.wissner-aktiv-lernen.com/en/Balance/070110.000). The tools ledger records the exact 65108 source and hash.
- [Original ATEHNA foamed PVC](https://atehna.si/product/penjeni-pvc-komateks-300-x-200-x-3-mm/) matched to [Wolff’s real photographs](https://kunststoff-store.com/products/pvc-hartschaumplatte-3mm-zuschnitt-weiss-300-x-200-mm-excel-kunststoff-platte).
- [Original ATEHNA switch](https://atehna.si/product/vgradno-stikalo/) matched to [Textilkabel Fachhandel’s native gallery](https://www.textilkabel-fachhandel.de/leuchtenteile/einbauschalter/) and [Radio Kölsch’s 12 mm listing](https://www.radiokoelsch.de/Lampen-Einbauschalter-Einbau-Druckschalter-weiss-250V-2A-12-mm-Achse-1-polig).

The [applied manifest](../../data/catalog/product-image-additions-v4-2026-09.json) records every source URL, native dimension, hash, exact variant assignment and visual review. Detailed research: [materials](../../data/catalog/replacement-sources-materials-v4-2026-09.json), [tools](../../data/catalog/replacement-sources-tools-v4-2026-09.json), [switch](../../data/catalog/replacement-sources-switch-v4-2026-09.json), [Trigonir](../../data/catalog/replacement-sources-root-v4-2026-09.json) and [UHU](../../data/catalog/replacement-sources-uhu-v4-2026-09.json).

## Products still without photographs

Each row still needs a suitable complete main photograph and useful reverse, edge, construction or feature details. The [fresh audit](../../data/catalog/product-image-audit-v4-2026-09.json) lists every affected variant and SKU. Names, original photographs and published specifications were used for matching as requested; an internal supplier or EAN record was not mandatory.

| Product | Variants without photos |
|---|---:|
| Aluminijasta plošča | 7 |
| Bakrena plošča | 4 |
| Pocinkana pločevina | 4 |
| Medeninasta plošča | 4 |
| Pleksi steklo | 7 |
| Stiropor | 4 |
| Šeleshamer | 4 |
| Barvni papir | 27 |
| Grafopak | 2 |
| Fotokarton | 20 |
| Lepenka | 6 |
| Risalni list | 4 |
| Vezana plošča | 31 |
| Krivilnik za plastične mase THERMOFORM 400 | 1 |
| Žica za lotanje | 1 |
| Spiralne žagice za les in mehke kovine | 3 |
| Žagice za rezanje kovin | 3 |
| Aluminijasto ravnilo z ročajem (40 cm) | 1 |
| Otroški zaščitni predpasnik | 1 |
| Otroška očala za zaščito oči | 1 |
| Očala za zaščito oči | 1 |
| UHU Super glue | 1 |

Specific promising sources remain withheld:

- A sharp 2000 × 2000 poplar plywood detail matches the 3 × 250 × 500 mm variant, but it clips the sheet and cannot serve as its complete main view.
- Large, sharp PEBARO 134-1 and 134-4 pack photographs were found. ATEHNA’s fine/medium descriptions cover several numbered grades, so the exact grade assignment remains unresolved.
- URSUS/Bähr colour naming matches were found for paper, but native swatches and pack photographs remain below the resolution requirement.
- Two historical aluminium uploads and several newly found Komatex images carry explicit AI-generation provenance and were excluded.
- Modern UHU 3 g Control/Gel/Ultra Fast packages differ from the original red 3 ml Instant Bond product. THERMOFORM 400 sources failed resolution, detail or framing requirements.

Products with some photos still need more angles toward the requested 4–6 where informative. Other missing variants include motor RE260/RE280, plain board rulers, hammer variants, three PVC cuts and scale 070112. The [previous report](product-image-replacements-v3-2026-09.md) records required views for the other retained-photo families; this report supersedes its five improved family rows.

## Integration and verification

- Production, local and canonical updates passed before/after comparisons. Retained images, their order, schematics, variant links and all commercial data were preserved. Every immediate repeat plan produced zero mutations.
- Published originals matched their reviewed SHA-256 hashes. Fresh inventory: 193 image rows, comprising 42 visible photographs and 151 schematics; no hidden, undersized or unreadable visible photographs.
- Public and admin catalog caches were invalidated. The additions are live on [the storefront](https://www.atehna-test.site); these data changes did not require a runtime deployment.
- Live browser checks passed all 11 images across five families and ten variant states: gallery order, exact variant exclusions, accessory captions, original-image links, loaded zoom and reload. Desktop/mobile screenshots were captured, with no browser errors. The galleries served optimized 604-pixel images at a rendered width of 300 pixels while retaining full-resolution originals.
- Visual review confirmed the updated galleries, retained schematics and related-product presentation. Site layout and styling were unchanged.
- 38 focused addition, deletion and import tests passed after the first batch. The additive transaction path also passed disposable-PostgreSQL rollback and idempotence checks.
- Actual deletion remains implemented with “Izbriši sliko” controls. Saved/unsaved/main/final removal, staged save/cancel, permissions, persistence errors and shared-file protection were verified in the prior pass. The earlier 268 photo-row deletions were not replaced by hiding. This continuation changed source data, not the deletion runtime.

Browser evidence is saved in tmp/product-image-audit/production-browser-v4/report.json and adjacent gallery, zoom and mobile screenshots. Production transaction snapshots are recorded in the fresh audit.
