# Product type corrections, September 2026

Every product has one or more sellable variant rows. The product type chooses editing and management tools; it does not decide whether variants are allowed. Internal type identifiers remain unchanged for compatibility.

- **Standardni** (`simple`): sold by piece or package, with arbitrary variant attributes. A package's net contents, a hammer's head mass, colour, model and fixed tool size are attributes.
- **Po dimenzijah** (`dimensions`): materials using dedicated length, width and thickness selection or calculation.
- **Po masi** (`weight`): actual ordering/pricing by weight. None of these imported families requires this preset. A 500 g bottle of glue remains sold by the piece.
- **Stroj / oprema** (`unique_machine`): equipment with optional warranty, service and individual serial tracking. A machine model may have multiple stock units and variants.

## Reviewed classification

The 43 imported families have 182 requested variants. Existing extra variants are retained in the database. The reviewed result is 12 dimension families, 29 standard families and two machine families; 15 families change type.

| Type | Products | Reason |
| --- | --- | --- |
| Po dimenzijah | Aluminijasta plošča; Bakrena plošča; Pocinkana pločevina; Medeninasta plošča | Purchased sheet formats and thickness |
| Po dimenzijah | Penjeni PVC (komateks); Pleksi steklo; Stiropor | Material sheet formats and thickness |
| Po dimenzijah | Šeleshamer; Grafopak; Lepenka; Risalni list | Material sheet formats, with additional grade/colour where relevant |
| Po dimenzijah | Vezana plošča | Wood sheet dimensions and species |
| Standardni | Barvni papir; Fotokarton | Existing variants differ by colour; fixed format is a specification |
| Standardni | Motorček; Ploščata baterija 4,5 V; Vgradno stikalo; Objemka za motorček RE260 | Component model or fixed specification |
| Standardni | Geotrikotnik za tablo; Trikotniki za tablo; Ravnila za tablo; Trigonir 216; Magnetni trinog; Tračni meter; Šestilo za tablo | Finished tools selected by size/model/features, without cutting calculations |
| Standardni | Kladivo; Električarske klešče za snemanje izolacije; Zlatarske škarje za pločevino | Tool attributes and piece/set packaging; head mass does not make a hammer a bulk product |
| Standardni | Digitalno pomično merilo; Šolska tehtnica; Aluminijasto ravnilo z ročajem | Finished measuring tools; measuring capacity is a specification |
| Standardni | Spiralne žagice za les in mehke kovine; Žagice za rezanje kovin | Tooth grade distinguishes variants |
| Standardni | Otroški zaščitni predpasnik; Otroška očala za zaščito oči; Očala za zaščito oči | Finished protective products |
| Standardni | Podlaga za rezanje | Finished cutting mat selected by size |
| Standardni | Žica za lotanje; UHU Kraft; UHU Super glue; Mekol | Packaged units sold by piece; contents are descriptive/variant attributes |
| Stroj / oprema | Krivilnik za plastične mase THERMOFORM 400; Vibracijska žaga Proxxon DSH | Machines with optional equipment management |

## Applying to an existing catalog

`data/catalog/atehna-2026-09.json` is the corrected repeatable import source. Do not rerun the full importer just to correct existing types. Use `scripts/reclassify-atehna-catalog.ts`, which updates only the 43 reviewed slugs and defaults to a read-only preview:

```powershell
node --env-file=.env.development.local --import tsx scripts/reclassify-atehna-catalog.ts --target local
```

For production, the caller must set `DATABASE_URL` to the confirmed production database before invoking the same script with `--target production`. The script never loads environment files or rewrites the connection destination. It validates the exact configured host/database, rejects query-string target overrides and checks `current_database()` after connection. An explicit `--apply` is required to write.

Deploy the shared variant editor before applying production reclassification: the former Standardni editor only retained one variant on save.

The migration:

1. Requires all 43 products and their editor-detail records to exist; rejects archived products or classifications changed independently since import.
2. Previews 15 classifier changes, including `item_type` only where necessary. Standard and machine items use `unit`; dimension materials use `sheet`. Actual sale units remain unchanged.
3. Preserves existing type-specific metadata. For machines it copies reviewed basic/technical specifications to the corresponding machine fields so they remain visible. It does not infer serial numbers, warranty, shipping weight or shipping dimensions.
4. Copies an inherited nonempty default delivery time into a missing target delivery field if needed. It verifies effective delivery for every variant and refuses to proceed if an unexpected per-variant inherited value would be lost. Existing production values on all 15 affected families were blank at preparation time.
5. Writes and rereads a snapshot under ignored `tmp/catalog-import/type-correction-<environment>-<timestamp>/before-and-plan.json` before updating any row. Applies changes in one repeatable-read transaction with advisory and product-row locks.
6. Checks all other product fields and hashes all variants, category records, option definitions/assignments, media/assignments, quantity discounts, slug aliases, supplier rows, pricing/stock model and full pricing/stock history before committing. The supplier directory is optional only for older local schemas; its absence is recorded and compared.
7. Produces `verification.json` with preservation hashes and a zero-change repeat plan. Existing IDs, SKUs, categories, publication states, prices, stock, stock/pricing revisions and the catalog's retained extra variants survive.

Classification migration deliberately leaves existing option definitions/values and their IDs unchanged. Values such as “200 g, 10 kosov v stojalu” or “Mekol Ekspres 0,5 kg” remain available directly in the shared variant rows and can be refined through the editor without recreating their SKUs.

Focused regression coverage: `tests/unit/catalog-type-correction.test.ts` checks the reviewed assignments, preserved variant count, idempotency, unexpected-state guards, machine specification transfer, delivery preservation and exact database targeting. Existing importer tests continue to cover repeated imports and commercial preservation.

## Editor behavior and validation

All presets keep sellable rows, including a single row without customer choices. `Prodaja / Različice` owns names, arbitrary attributes, SKU, sale unit, price and stock. The dimension preset adds the material generator and dimension calculations. Standard products and machines expose separate delivery measurements. Optional swatches remain available in the compact attribute toolbar. Type changes retain variant identity and compatible specifications, and never invent delivery estimates.

New weight presets price by kilogram. Existing saved package-based weight configurations retain their previous calculation basis. Quantity discounts continue to follow the existing machine policy; equipment serials remain optional.

The reviewed implementation passed all 1,631 unit/contract tests, repository ESLint, the production build with full TypeScript checking, and six authenticated browser tests covering inline attributes, same-mass formulations, single-variant saves, type changes, weight rows, and standard-product shipping measurements/publication. Browser tests used a disposable localhost database. Production classification changes must follow deployment of this editor so reclassified variants cannot be hidden or truncated by the old editor.
