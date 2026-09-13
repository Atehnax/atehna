# Catalog dimension audit — local only

This is the initial catalog-data audit, before the machine and triangle manufacturer follow-up. For the final 22-product coverage and subsequently verified measurements, see [dimension sketches](dimension-sketches-2026-09.md).

Checked 2026-09-11T14:14:59.228Z. The local loopback database was accessed in a repeatable-read, read-only transaction and rolled back. No catalog records were changed. This is not a production inventory or a new supplier verification.

## Inventory and coverage

- Actual local data: **44 nondeleted families, 184 variants, 291 media records**. Only **3 families / 4 variants** are active: aluminium (200 × 200 × 0.5 and 100 × 100 × 0.5 mm), copper (100 × 100 × 0.5 mm), steel measuring strip (300 mm).
- Repeatable import: **43 families / 182 variants**. Local extras are the retained inactive aluminium 300 × 200 × 1 mm variant and the existing steel measuring strip. All 182 imported SKUs are present locally; product length/width/thickness match the import for every one.
- **130 local variants have positive product length + width; 66 also have positive thickness**. These cover 15 families of plates, paper/card and cutting mats. Seven families have complete plate dimensions for every variant; two have partial thickness coverage; six are suitable for a flat format diagram.
- 130 variants have shipping dimension fields; every populated shipping triplet exactly mirrors product L/W/T. They are not independent packaging measurements and cannot fill missing product dimensions.
- Neither local option values nor imported option values contain calibrated colour swatches. There are 27 named coloured-paper variants and 20 named card variants.

## Safe drawing inputs

1. **Selectable product size:** use positive variant length/width/thickness only when corroborated by the selected format/size and variant specifications. Sheet numerical fields and labels are consistent as unordered planar dimensions; source label ordering sometimes reverses numeric length/width. Draw and label edges consistently without changing the SKU identity.
2. **Variant options:** use actual optionLabels and the variant name/specifications for wood species, finish, colour, model and package contents. productType is a sale model, not proof that length/width are missing or meaningful: coloured paper and cutting mats are simple products with useful dimensions; motor dimensions exist in specifications rather than numeric fields.
3. **Shipping fields:** shippingLengthMm/shippingWidthMm/shippingHeightMm, and uniqueMachine.packageDimensions are packaging/transport fields. Never label them as outside product dimensions. Image imageDimensions fields are pixels, never millimetres.
4. **Nominal dimensions:** measuring range, tape length, working table size, maximum stock thickness and tool body measurements must retain their exact meaning. They cannot stand in for overall product dimensions. Mass, capacity, voltage, contents and paper grammage do not establish physical size.
5. **Overview coverage:** build the public overview from current active variants, or explicitly label an intentionally broader range; the import manifest is not current availability. Preserve distinct variants sharing dimensions but differing in material/colour/model. An overview for 31 plywood options or 27 paper colours needs enough space to remain readable.
6. **Visual truthfulness:** use deterministic technical drawings or real photos with factual annotations. Missing dimensions remain unknown. Technical sketches may say dimensions in mm and not to scale; a schematic colour chip is not a calibrated finish sample.

## Family-by-family audit

Counts are local variants / active local variants. plate-3d = complete plate dimensions; plate-partial-3d = some thickness gaps; flat-2d = use planar formats only; component-dimensions = named component/profile measurements, with outside-envelope caveats; working-area = machine operational diagram only; nominal-size = labelled nominal dimension, not outside shape; overview-only = option overview possible but no trustworthy dimensional outline yet.

| Product family | Variants / active | Suitable diagram | Known product/option measurements | Missing data / constraints |
|---|---:|---|---|---|
| Pocinkana pločevina | 4 / 0 | plate-3d | Four formats: 300 × 200, 300 × 300, 200 × 200, 100 × 100 mm; thickness 0.5 mm. | All variants inactive locally. |
| Medeninasta plošča | 4 / 0 | plate-3d | Four formats: 300 × 200, 300 × 300, 200 × 200, 100 × 100 mm; thickness 0.5 mm. | All variants inactive locally. |
| Penjeni PVC (komateks) | 4 / 0 | plate-3d | 300 × 200, 150 × 200, 400 × 300 and 500 × 500 mm, all 3 mm thick. | Colour unspecified. Source planar ordering and numeric L/W ordering differ; label the actual drawn edge consistently. |
| Pleksi steklo | 7 / 0 | plate-3d | Seven selectable variants; 150 × 200, 200 × 300 and 400 × 300 / 300 × 400 mm, all 3 mm thick. | White and clear are named; generic barvno has no specific colour; two variants have no finish. Rotated 400 × 300 and 300 × 400 records retain distinct variant identities. |
| Stiropor | 4 / 0 | plate-partial-3d | 200 × 300 × 10, 300 × 400 × 10, 160 × 330 × 20 mm; A5 148 × 210 mm. | A5 thickness missing; show a 2D format only for that variant. |
| Šeleshamer | 4 / 0 | flat-2d | A4 210 × 297, A3 297 × 420, A2 420 × 594, B1 707 × 1000 mm; 200 g/m². | No physical thickness. Grammage cannot supply it. |
| Barvni papir | 27 / 0 | flat-2d | 27 named colours; B2 500 × 707 mm; 130 g/m². | No calibrated colour swatches or thickness. Use labelled schematic chips; never infer exact RGB from a colour name. |
| Grafopak | 2 / 0 | flat-2d | A3 297 × 420 and A4 210 × 297 mm; 350 g/m². | No physical thickness. |
| Fotokarton | 20 / 0 | flat-2d | 20 named colours; B2 500 × 707 mm; 300 g/m². | No calibrated colour swatches or thickness. Gold/silver labels alone do not establish a specific metallic finish. |
| Lepenka | 6 / 0 | plate-partial-3d | White A3 297 × 420 and A4 210 × 297; grey A2 420 × 594 × 0.7; paperboard A4 210 × 297 × 0.8 and A3 297 × 420 × 0.8; B1 707 × 1000 × 1.2 mm. | White A3/A4 thickness missing; some colours unspecified. |
| Risalni list | 4 / 0 | flat-2d | A5 148 × 210, A4 210 × 297, A3 297 × 420, A2 420 × 594 mm. | No physical thickness. |
| Vezana plošča | 31 / 0 | plate-3d | 31 variants with complete planar dimensions and thickness (3, 4, 5, 6, 8 or 10 mm); largest 2520 × 1720 mm. | 3 beech, 4 poplar, 24 without named wood species. Do not label unspecified rows as birch/poplar. An overview must show all 31 identities or explicitly identify a selection. |
| Motorček | 3 / 0 | component-dimensions | R23: body diameter 24 / body length 30 mm; R20: 21 / 25 mm; R21: 24 / 27 mm; shaft diameter 2 mm. | No shaft protrusion, mounting-hole pattern, terminal clearance or confirmed total envelope. Body length is not total assembled length. |
| Geotrikotnik za tablo | 4 / 0 | nominal-size | 60 cm and 80 cm nominal sizes, each standard or magnetic. | Source calls this Velikost; which edge is measured is unspecified. Do not derive triangular height/hypotenuse. |
| Trikotniki za tablo | 4 / 0 | nominal-size | 45° and 60° styles, each nominal 50 cm or 60 cm. | Measured edge unspecified. Avoid trigonometric derivation until size convention confirmed. |
| Ravnila za tablo | 4 / 0 | nominal-size | All 100 cm; standard, magnetic, decimetre scale, magnetic + decimetre scale. | No width, thickness, handle height. Clarify nominal scale length vs outside length if annotating physical endpoints. |
| Trigonir 216 | 1 / 0 | overview-only | Model 216. | No length/width/thickness, angle convention or usable-size specifications. |
| Magnetni trinog | 1 / 0 | overview-only | Magnetic three-foot compass base. | No footprint diameter, leg span or height. |
| Tračni meter | 1 / 0 | nominal-size | Measuring tape length 5 m. | No housing envelope, tape width or thickness. 5 m is not case size. |
| Šestilo za tablo | 2 / 0 | overview-only | Magnetic feet or vacuum cups; 2 variants. | No arm length, closed length, maximum radius or footprint. |
| Krivilnik za plastične mase THERMOFORM 400 | 1 / 0 | working-area | THERMOFORM 400: working surface 440 × 165 mm, heated wire 400 mm, maximum material thickness 5 mm. | Outside machine L/W/H and transformer/lead footprint missing. 5 mm is capacity, not machine thickness. |
| Vibracijska žaga Proxxon DSH | 1 / 0 | working-area | Proxxon DSH: source work table 360 × 180 mm, throat 400 mm, cut capacity 50 mm (25 mm at 45°), stroke 19 mm. | Overall L/W/H and mounting-hole pitch absent. Table/capacity is not outside machine size. Confirm manufacturer table figure before publishing a precise technical diagram. |
| Kladivo | 4 / 0 | overview-only | 200 g or 300 g head, each sold singly or 10 in a stand. | No handle length/head dimensions/stand size. Head mass is not a geometric dimension or complete tool mass. |
| Električarske klešče za snemanje izolacije (10 kosov v stojalu) | 1 / 0 | overview-only | 10 tools in stand. | Tool overall length, stripping range, stand width/depth/height absent. |
| Zlatarske škarje za pločevino (10 kosov v stojalu) | 1 / 0 | overview-only | 10 tools in stand. | Tool length, cutting length, stand width/depth/height absent. |
| Digitalno pomično merilo | 1 / 0 | nominal-size | Measuring range up to 150 mm. | Overall length, jaw depth, body width absent. Never draw 150 mm across the complete tool. |
| Žica za lotanje | 1 / 0 | overview-only | Net contents 100 g. | Wire diameter, wire length and reel dimensions absent. |
| Šolska tehtnica | 3 / 0 | overview-only | Wissner metal, plastic, plastic with weights; capacity 2 kg. | Body envelope, pan size, exact model identifiers absent; 2 kg is capacity, not scale weight. |
| Spiralne žagice za les in mehke kovine | 3 / 0 | overview-only | Fine, medium and coarse cutting variants. | Blade length/diameter, tooth pitch and exact model identifiers absent. |
| Žagice za rezanje kovin | 3 / 0 | overview-only | Fine, medium and coarse cutting variants. | Blade length/width/thickness, tooth pitch and exact model identifiers absent. |
| Aluminijasto ravnilo z ročajem (40 cm) | 1 / 0 | component-dimensions | Length 400 mm; aluminium profile 60 × 4.4 mm. | Handle height/projection absent. Profile thickness cannot be annotated as total height including handle. |
| Otroški zaščitni predpasnik | 1 / 0 | overview-only | Child size; blue. | No apron panel length/width, strap length or fit-height range. |
| Otroška očala za zaščito oči | 1 / 0 | overview-only | Child eye protection; source TTS. | Frame width, lens size and temple length absent. |
| Očala za zaščito oči | 1 / 0 | overview-only | Adult eye protection; source Koestier. | Frame width, lens size and temple length absent. |
| Podlaga za rezanje | 4 / 0 | flat-2d | 220 × 300, 300 × 450, 450 × 600, 600 × 900 mm. | No mat thickness. Do not infer 3 mm from generic product appearance. |
| UHU Kraft | 1 / 0 | overview-only | 42 g net contents. | Tube length/width/diameter absent. Contents mass is not a physical dimension. |
| UHU Super glue | 1 / 0 | overview-only | 3 ml net contents. | Bottle/tube dimensions absent. Contents volume does not establish outer dimensions. |
| Mekol | 5 / 0 | overview-only | 5 distinct variants: Ekspres 0.5 kg, 1001 1 kg, wood glue 500 g, Special 0.5 kg, 130 g. | No container dimensions. Keep equal-mass different formulations separate. |
| Ploščata baterija 4,5 V | 1 / 0 | overview-only | 4.5 V; 2000 mAh. | No outside dimensions; no confirmed standard size code to safely source exact dimensions. |
| Vgradno stikalo | 1 / 0 | component-dimensions | Source gives 21 × 12 × 30 mm. | Axis orientation and included contacts unclear; mounting cut-out and panel-thickness limit absent. Do not turn these into hole dimensions. |
| Objemka za motorček RE260 | 1 / 0 | overview-only | Compatible with RE260 / R21 motor. | Clamp envelope, mounting-hole size and hole spacing absent. |
| Aluminijasta plošča | 5 / 2 | plate-3d | Four requested formats: 300 × 200, 300 × 300, 200 × 200, 100 × 100 mm; thickness 0.5 mm. Local retains a fifth 300 × 200 × 1 mm variant. | Only 200 × 200 × 0.5 and 100 × 100 × 0.5 are active locally. Do not include inactive formats in an active-only overview. |
| Bakrena plošča | 4 / 1 | plate-3d | Four formats: 300 × 200, 300 × 300, 200 × 200, 100 × 100 mm; thickness 0.5 mm. | Only 100 × 100 × 0.5 active locally. |
| Jeklena merilna letvica | 1 / 1 | nominal-size | Local existing steel measuring strip, variant named 300 mm. | No numeric product L/W/T, selectable dimension axis or explicit nominal-vs-overall length semantics. Annotate only listed nominal 300 mm. |

## Files and provenance

- Generator input: tmp/catalog-refinements/dimension-products-local.json. Full sanitized actual-local products, variants, specifications/options and media identities/positions/variant assignments.
- Audit inventory: tmp/catalog-dimension-audit/dimension-inventory.json. Per-family readiness and gaps, source URLs, per-variant dimensions and specifications.
- Read-only extraction: tmp/catalog-dimension-audit/read-local.mjs; detailed extract tmp/catalog-dimension-audit/local-inventory.json.
- Import manifest: data/catalog/atehna-2026-09.json. Supplier snapshot: data/catalog/atehna-2026-09-sources.json (2026-09-09).
- Import/measurement semantics: docs/catalog-import/2026-09-09.md; docs/catalog-import/product-type-corrections.md; docs/catalog-import/catalog-refinements-2026-09.md; src/shared/server/catalogItems.ts.
- Real photo source manifests: data/catalog/real-photo-tools-2026-09.json; data/catalog/real-photo-metals-2026-09.json; data/catalog/real-photo-materials-2026-09.json. Existing image-upgrades manifest includes older generated imagery and is not physical-measurement evidence.

## Highest-value missing measurements

For large products, obtain the manufacturers overall L × W × H and mounting clearances for THERMOFORM 400 and Proxxon DSH, the body/stand envelope of the school balance, compass/board geometry edge convention, and plywood wood species for the 24 unnamed variants. For completion of otherwise usable sheet diagrams, obtain A5 styrofoam thickness, white A3/A4 board thickness, actual acrylic finish/colour for ambiguous variants, and calibrated supplier colour references. None of these should be estimated from photographs.
