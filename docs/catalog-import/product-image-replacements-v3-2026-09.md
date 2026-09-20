# Product image replacement correction — 13 September 2026

> Update: see [14 September follow-up](product-image-replacements-v4-2026-09.md) for eleven applied photographs, five improved families and corrected identity matches. Counts below are the historical 13 September snapshot.

**Status: production, local and canonical changes applied; fresh inventory and storefront verification passed. Source-photography gaps remain unresolved.** Counts below are observed after the committed production transaction. This report supersedes the earlier audit's decision to keep undersized photographs or hide rejected records.

The catalog has **43 product families and 185 variants**. This pass supplies **seven genuine replacement assets across five families**, separately from **268 photograph-record deletions (195 hidden, 73 visible)**. **All 151 technical schematics are preserved.** The refreshed production inventory contains **31 photographs**, with **27 families completely without photographs**. 153 of the 185 variants have no photograph. Most products have not received replacement photography; the remaining source gaps are unresolved.

## Actual source replacements

| Product / variant | New native source | Improvement and provenance |
|---|---|---|
| Mekol 1001, 1 kg | 3024 × 3024 | Authentic older packaging of the same 1001 / 1 kg product from [Trgopromet](https://www.trgopromet.si/products/lepilo-za-les-mekol-1001-1kg); replaces padded small original. |
| Mekol D3, 500 g | 2582 × 2965 | Unscaled supplier original from [Sijalka](https://sijalka.com/artikli/disperzijsko-enokomponentno-vodoodporno-lepilo-za-les-mitol-mekol-d3-500-g/); improves detail of the same front. |
| Decimal board ruler, 100 cm | 2400 × 1600 | Exact [Wissner 010300.000](https://wissner-aktiv-lernen.com/Lineal-100-cm/010300.000) native original. |
| Board triangle, 45° / 50 cm | 2400 × 1600 | Exact [Wissner 010700.000](https://www.wissner-aktiv-lernen.com/Rechter-Winkel-450-50-cm/010700.000) native original. |
| Board triangle, 60° / 60 cm | 2400 × 1600 | Exact [Wissner 010810.000](https://www.wissner-aktiv-lernen.com/Spitzer-Winkel-600-60-cm/010810.000) native original. |
| Proxxon DSH 28092 | 2560 × 2192 | Complete machine, controls and standard blade guard from [OPITEC 309975](https://www.opitec.com/de-de/proxxon-dekupiersaege-dsh/309975). |
| UHU Kraft FlexTube, 42 g | 2000 × 2000 | Sharp complete exact tube from [TOOM](https://toom.de/p/alleskleber-kraft-flex-tube-42-g/8150308); its manufacturer SDS identifies 45040. |

These are unchanged real source bytes, visually checked for identity, framing, sharpness and absence of people. No AI views, padding, enlargement, recolouring or geometry changes were used. Improved versions of an existing capture count as one view. The two previously installed native Mekol Ekspres 1600 × 1200 photographs are retained and are **not** part of the seven new assets.

## Deletion and integration

The correction deletes rejected photograph records and variant links, including hidden generated/surrogate images, undersized originals, human-containing scenes and visibly poor captures. This is separate from supplying replacements. It preserves every schematic's ID, metadata, position and links, as well as the remaining photograph order. No source files were physically deleted by these transactions. Source assets and before/after snapshots remain for audit and recovery; two previously hosted entries were queued for reference-aware cleanup, which retains files referenced elsewhere. Product descriptions, variants, prices, stock and commerce data are protected by transaction comparisons.

The existing editor deletion controls retain “Izbriši sliko” labels/tooltips, staged save/cancel behaviour, unsaved-upload removal, main-image promotion, final-image empty states, permission checks and clear persistence errors. Full-resolution originals remain available alongside optimized display sizes. Local and canonical import synchronization are complete. Cache/storefront checks for this correction are recorded below.

## Remaining product sources and views

Counts are **family photographs**, including variant-specific views; they are not the number of independent angles available for every variant. Schematics do not count as photographs. Every family still needs suitable additional source views toward the requested 4–6 where informative. No-photo rows require new actual-product originals before a photograph can be displayed. The [fresh audit JSON](../../data/catalog/product-image-audit-v3-2026-09.json) lists all 185 variant names/SKUs, exact image URLs and associations, dimensions/hashes, and every variant without photographs.

| Product | Variants | Photos | Variants without photos | Missing source evidence or useful views |
|---|---:|---:|---:|---|
| Aluminijasta plošča | 7 | 0 | 7 | Actual seven cut/thickness variants; whole sheet, reverse, edge and finish. Primary original only 333 × 333; supplier grade/finish not identified. |
| Bakrena plošča | 4 | 0 | 4 | Four actual cuts, reverse and edge/finish. Source original 581 × 581; third-party 200 × 400 and 495 × 195 sheets differ. |
| Pocinkana pločevina | 4 | 0 | 4 | Four supplied cuts and actual galvanized finish; whole sheet and edge. Generic DX51 detail does not establish delivered stock. |
| Medeninasta plošča | 4 | 0 | 4 | Four actual cuts, finish, reverse and edge. Generic brass detail and 500 × 500 source cannot fill the gap. |
| Penjeni PVC (komateks) | 4 | 0 | 4 | All four 3 mm cuts, whole panel and edge. Exact Komatex brand alone does not establish the photographed cut; primary fan only 312 × 312. |
| Pleksi steklo | 7 | 0 | 7 | Seven exact cuts/colours; front, edge and surface. Clear 800 × 600 stock image and rounded coloured samples are unsuitable. |
| Stiropor | 4 | 0 | 4 | Actual four cut/thickness variants; whole panel and edge. Primary 625 × 625 texture and other-sized EPS stack rejected. |
| Šeleshamer | 4 | 0 | 4 | Actual A4/A3/A2/B1 200 g stock, front, reverse, edge and texture. Primary listing has no product original; Muflon substitution unproven. |
| Barvni papir | 27 | 0 | 27 | All 27 exact supplier colours need native originals and useful sheet/edge detail. Current full colour sources are only about 465–500 px. |
| Grafopak | 2 | 0 | 2 | Exact 350 g A3/A4 stock, whole front/reverse and edge. Velpapir generic GD detail does not prove the delivered grade; GD2/GT4 differ. |
| Fotokarton | 20 | 0 | 20 | All 20 exact 300 g B2 colours. Larger Folia packs/assortments do not establish ATEHNA colour codes or selected stock. |
| Lepenka | 6 | 0 | 6 | Six white/grey cut/thickness variants; front, reverse and edge. Generic PankaDisc 1.15/1.25 mm stock is not an exact substitute. |
| Risalni list | 4 | 0 | 4 | Actual A2/A3/A4/A5 stock, whole sheet and texture/edge. Native original only 670 × 670; Artway 170 g is a different product. |
| Vezana plošča | 31 | 0 | 31 | All 31 cut/thickness variants; wood species/grade and front/back/ply edges. Original only 800 × 800; 24 variants lack species. |
| Motorček | 3 | 1 | 2 | R23/RE280 and R21/RE260 need new sharp originals; current OPITEC files are byte-identical noisy captures. All three need shaft/rear-terminal/marking views. |
| Geotrikotnik za tablo | 4 | 3 | 0 | 60/80 cm and magnetic/nonmagnetic backing; exact reverse, attachment and scale/handle details. Fronts do not verify rear magnets. |
| Trikotniki za tablo | 4 | 4 | 0 | Each of four size/angle variants needs reverse and handle/scale detail. Four different variants are not four views of one product. |
| Ravnila za tablo | 4 | 1 | 2 | Plain-scale variants need native whole-product photos; decimal source needs reverse magnetic/nonmagnetic backing and scale/handle detail. |
| Trigonir 216 | 1 | 0 | 1 | Exact delivered Trigonir 216 model needs identification and new whole-instrument, reverse, pivot and scale-detail photographs. TRISO 12496 packaging identity is unproven, so both package photographs were deleted. The unit-circle technical diagram remains. |
| Magnetni trinog | 1 | 1 | 0 | Isolated complete accessory, underside magnets and mounting interface. Retained installed view excludes the pictured compass. |
| Tračni meter | 1 | 1 | 0 | Exact geo-Fennel Rubber Tape 5 m label, rear/clip, lock and tape/hook details. Fresh supplier originals only 600–800 px; 8 m photos unsuitable. |
| Šestilo za tablo | 2 | 2 | 0 | Each magnetic/vacuum-foot variant needs underside/feet, hinge and chalk-clamp details. One front per variant remains. |
| Krivilnik za plastične mase THERMOFORM 400 | 1 | 0 | 1 | Exact THERMOFORM 400 full machine, rear power/fuse connections, heating wire and controls. Native source 1200 × 489 fails. |
| Vibracijska žaga Proxxon DSH | 1 | 1 | 0 | New complete exact DSH 28092 front; rear connections, table tilt, blade holder and top detail still missing. |
| Kladivo | 4 | 1 | 2 | Exact 200 g tool and both 10-piece stands; 300 g tool needs an informative reverse/head/handle detail. Generic BGS substitutions rejected. |
| Električarske klešče za snemanje izolacije (10 kosov v stojalu) | 1 | 1 | 0 | Exact blue/black Tooltech 10-piece kit from rear/side plus matching jaw/adjuster detail. Near-duplicate stand arrangements are not new views. |
| Zlatarske škarje za pločevino (10 kosov v stojalu) | 1 | 0 | 1 | Exact 10-piece stand, kit reverse/side and matching snip blade/pivot detail. LUX individual snips do not establish the kit. |
| Digitalno pomično merilo | 1 | 1 | 0 | Isolated complete exact 150 mm caliper, display/buttons, jaws, rear and depth rod. Remaining scene explicitly excludes other tools. |
| Žica za lotanje | 1 | 0 | 1 | Exact 100 g blue spool, manufacturer/alloy label, winding and diameter detail. Different OPITEC alloy/spool rejected. |
| Šolska tehtnica | 3 | 0 | 3 | Confirm delivered model/material for all three variants, then front/rear and contents/scale detail. Conflicting plastic/metal and brand representations rejected. |
| Spiralne žagice za les in mehke kovine | 3 | 0 | 3 | Three exact grades: labelled packs, full blades/end fastening and sharp tooth macro. Existing 600 px grade-neutral sources fail. |
| Žagice za rezanje kovin | 3 | 0 | 3 | Three exact grades: labelled packs, whole blades and native tooth detail. Existing 600 px pack does not establish grade. |
| Aluminijasto ravnilo z ročajem (40 cm) | 1 | 0 | 1 | Exact 40 cm ruler, scale, handle/fastening and edge profile. Primary full source only 342 × 342. |
| Otroški zaščitni predpasnik | 1 | 0 | 1 | Exact navy garment laid flat, back/ties and fabric/seams without wearer. Primary original only 500 × 500. |
| Otroška očala za zaščito oči | 1 | 0 | 1 | Confirm delivered historical 45002 model; exact front/side/rear, hinges and markings. 900 px original and different TTS frames rejected. |
| Očala za zaščito oči | 1 | 0 | 1 | Confirm delivered historical 45001 model; exact front/side, strap/vent and frame details. Koestier originals only 790 px. |
| Podlaga za rezanje | 4 | 5 | 0 | Each of four sizes needs reverse, grid/surface and thickness-edge detail. Different sizes are variants; accessories in scene explicitly excluded. |
| UHU Kraft | 1 | 1 | 0 | New exact 42 g FlexTube front; reverse label and cap/nozzle photographs still missing. Smaller rearrangements are not new useful views. |
| UHU Super glue | 1 | 0 | 1 | Exact older red 3 ml Instant Bond tube/pack front, reverse and nozzle. Modern Control/Ultra Fast 3 g products differ; original 1200 × 675 fails. |
| Mekol | 5 | 6 | 0 | Each of five formula/size variants needs its own reverse/label/nozzle views. New 1001 1 kg and D3 500 g originals improve existing views; Ekspres native pair retained. |
| Ploščata baterija 4,5 V | 1 | 1 | 0 | Exact OPITEC 4.5 V 3R12 reverse label, terminals, side and base. One complete native photograph remains. |
| Vgradno stikalo | 1 | 0 | 1 | Exact white-plunger/ribbed-nut housing with central snap-tab and narrow-end terminal. Matching photos only 800 px; larger OPITEC/Jimdo switches differ. |
| Objemka za motorček RE260 | 1 | 1 | 0 | Exact RE260 24 mm mounting clamp reverse/underside, slotted feet and ribs. Its technical drawing is preserved separately. |

## Evidence and verification

- Final deletion/replacement policy: [v3 manifest](../../data/catalog/product-image-remediation-v3-2026-09.json). Source URLs, hashes, dimensions, model/variant mapping and review decisions: [replacement ledger](../../data/catalog/product-image-replacements-v3-2026-09.json), [tools](../../data/catalog/replacement-sources-tools-2026-09.json), [materials and paper](../../data/catalog/replacement-sources-materials-2026-09.json), [supplemental sources](../../data/catalog/replacement-sources-supplemental-2026-09.json).
- Fresh materials research covered all 950 primary ATEHNA media records and 14 families / 128 variants; no exact qualifying replacement was found. All 18 hidden native-size photographs outside the known generated set were visually reviewed; none was eligible for restoration.
- Current OPITEC R23/RE280 and R21/RE260 galleries each provide only the existing byte-identical photograph. Their native pixel dimensions do not cure visible noise or poor detail.
- Current checks: **65 unit tests, one database test and three browser E2E tests passed**; the final 39 focused canonical/import/deletion tests also passed (overlapping suites, not an additional aggregate total). The committed production transaction preserved unrelated catalog/commerce data and every schematic/link; its immediate repeat plan has zero mutations. The final identity correction also removed two TRISO 12496 packaging photographs because the sold Trigonir 216 identity was unproven. Fresh inventory confirms 182 image rows: 31 visible photographs, zero hidden photographs, zero below-minimum photographs, zero unreadable visible photographs, and 151 schematics.
- Transaction proofs: `tmp/product-image-audit/root-v3/production-applied.json` and `tmp/product-image-audit/root-v3/production-trigonir-applied.json`. Both guarded commits have before/after rollback snapshots and zero repeat mutations; paths and exact observed coverage are in [the v3 audit JSON](../../data/catalog/product-image-audit-v3-2026-09.json).
- Upload/save validation checks decoded bytes and pixel dimensions; the editor checks crop bounds and exports at source pixel scale. Human presence, sharpness, original capture provenance, external padding/upscaling and exact variant identity still require visual/source review.

The [Linux production deployment](https://atehna-czqmqn3g5-atehnaxs-projects.vercel.app) succeeded and serves [the canonical storefront](https://www.atehna-test.site). Browser checks covered 42 affected families, 195 variant states and 40 listing products with zero errors; a separate final Trigonir check confirmed its photographs are absent and its schematic remains. Existing cart images refreshed correctly and survived reload, without order writes. Full-resolution viewing of the new Mekol 1001, Mekol D3 and UHU Kraft images passed and linked to the exact verified originals. All **182 final original asset URLs** were fetched and matched their SHA-256 hashes after the last removal.


Final visual checks confirmed the sharp, complete Mekol 1001 original; the new Proxxon main photo beside its preserved schematic; the correctly selected 60° / 60 cm triangle and its schematic; and the clean final-image empty state for Vgradno stikalo. Schematics remain separate from photographic view counts.
