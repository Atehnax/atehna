# Catalog category organization

The September 2026 import uses practical product groups with at most one subcategory level. It avoids separate categories for individual materials, brands, sizes, or products.

| Category | Imported products | Count |
| --- | --- | ---: |
| Materiali / Kovine | Aluminum, copper, galvanized steel, brass sheets | 4 |
| Materiali / Umetne mase | Penjeni PVC (komateks), Pleksi steklo, Stiropor | 3 |
| Materiali / Papir in karton | Šeleshamer, Barvni papir, Grafopak, Fotokarton, Lepenka, Risalni list | 6 |
| Materiali / Les | Vezana plošča | 1 |
| Materiali / Lepila | UHU Kraft, UHU Super glue, Mekol | 3 |

The existing groups for electrical components, measuring and geometry equipment, machines, hand tools, replacement parts, and protective equipment remain suitable at their current size. They do not need more subdivisions yet.

`data/catalog/atehna-2026-09.json` is the repeatable source of product category paths. This revision changes 13 paths and leaves all other product fields unchanged. `Umetne mase`, `Papir in karton`, `Les`, and `Lepila` belong beneath the existing `Materiali` category; `Kovine` already exists. Before importing into any database, create missing category rows or reuse matching existing rows. The importer validates the full parent/title path and refuses a path that does not exist.

For an already imported catalog, apply a narrow category-only update to the 13 products by their existing Slovenian slugs. Save the previous category IDs, verify all 43 assignments afterward, and preserve product publication status, prices, inventory, variants, and media. Source websites are references for product content; the site's category tree is managed here and must not be replaced with a supplier's taxonomy.
