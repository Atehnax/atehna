# Product dimension sketches — 11 September 2026

Current revision: **149 individual SVG sketches for 149 variants across 23 products**. Each sketch is assigned exclusively to its variant and appears only when that variant is selected. Earlier combined overviews are hidden and retained for rollback. Existing photographs remain first in the galleries.

The illustrations use 1800 × 1800 white canvases, dark slate outlines, light neutral fills, arrow dimension lines and large horizontal labels. Measured sheets have a top view and a separate thickness profile when thickness is known; the profile explicitly states when thickness is exaggerated for legibility. Unknown measurements stay unspecified. Colour variants remain individually named and use schematic, uncalibrated colours. Gallery and thumbnail fit is contain; full-resolution SVG previews remain available.

## Coverage and measurement sources

- All four metals, PVC, acrylic, polystyrene, plywood, drawing paper, coloured paper, photo card, other card/board and cutting mats: selected product formats, explicit per-variant specifications and audited sheet dimensions. The local aluminium product retains its fifth, inactive 300 × 200 × 1 mm variant; it was preserved and included.
- Paper standard formats are rendered in millimetres. Paper grammage never supplies a thickness. Unknown A5 polystyrene and white board thicknesses remain unspecified.
- Motors: body length/diameter and shaft diameter only; shaft protrusion is unspecified.
- Board rulers and 40 cm aluminium ruler: recorded length and, where present, base profile. Handle height is unspecified.
- Geotrikotnik and board triangles: nominal edge verified against exact models and supplier scale photographs. See [triangle evidence](../../data/catalog/dimension-triangle-sources-2026-09.json). Geotrikotnik and 45° triangle sizes refer to the hypotenuse; 60° sizes refer to the longer leg. Other side lengths were not calculated into supposed measured specifications.
- PROXXON DSH: overall **530 × 270 × 330 mm** from the manufacturer's manual, revision 4/2015-06, page 14; table **360 × 180 mm** also confirmed by the current manufacturer page. The image identifies the manual revision. A reseller's conflicting 300 mm height was not substituted. [Manual](https://s3-eu-west-1.amazonaws.com/plentymarkets-public-94/rzc8p33vcg85/propertyItems/10335/Bedienungsanleitung_28092-Dekupiers%C3%A4ge_aktuell.pdf#page=14), [manufacturer](https://www.proxxon.com/en/micromot/28092.php).
- THERMOFORM 400: **440 × 165 mm work surface**, **400 mm heating line**, **5 mm maximum material thickness**. These are explicitly working dimensions, not the machine's outer size. Reliable overall dimensions were unavailable. [Atehna](https://atehna.si/product/krivilnik-za-plasticne-mase-thermoform-400/), [Alton](https://alton.nl/thermoform-400.html).

Every configured variant of the supported products has its own asset, including inactive variants. Only the selected variant’s sketch is passed to the storefront gallery; inactive variants remain unavailable until separately activated. Equal sizes with different colours, wood species or construction keep distinct images and assignments. If a shopper is viewing a sketch while switching variants, the corresponding new sketch remains selected.

- Jeklena merilna letvica: the current variant explicitly specifies **300 mm**. Its sketch labels only this length and leaves width/thickness unspecified.

## Remaining measurements

The remaining 21 local products lack verified product geometry or have only quantities, packaging information, an ambiguous dimension triplet, or a measuring range. No dimensions were invented. Higher-priority gaps include the school balance and tool-stand envelopes, compass dimensions, the THERMOFORM outer envelope, and the switch's dimension orientation/mounting cut-out. A caliper's 150 mm measuring range and a tape's 5 m length are not their body lengths.

Full per-family audit: [dimension audit](dimension-audit-2026-09.md). The generated manifest's skipped list records the omitted families. The importer and product statuses were not changed.

## Refresh workflow

Run from the repository root with the existing local development environment:

~~~powershell
node --import tsx scripts/catalog-dimensions/export-local.mjs
node --import tsx scripts/catalog-dimensions/generate.ts
~~~

Review the SVGs and the generated manifest before applying. The exporter reads only the exact guarded loopback database. The generator uses no network, no AI image API and no database writes. Its manifest includes all variant identities, source measurements, option labels, source URLs, dimensions and file hashes.

With DATABASE_URL supplied by the caller, preview then apply:

~~~powershell
node --import tsx scripts/catalog-dimensions/sync.ts --target local
node --import tsx scripts/catalog-dimensions/sync.ts --target local --apply
~~~

The synchronizer is local-only. It refuses stale variant sets, names/SKUs, dimension/specification changes or changed option labels; validates asset hashes; appends media; and preserves every existing photograph and assignment. A repeat produces no changes. Only obsolete SVGs carrying this workflow's managed dimension marker/path may be hidden. Rollback snapshots and inserted IDs are recorded under tmp/catalog-refinements/dimension-sketches-local-*/. Restore only those recorded managed media changes, not unrelated catalog edits.

This does **not** automatically regenerate drawings on arbitrary admin edits. After changing dimensions/options, rerun the export/generation/review/sync workflow. Production requires a fresh read of its actual variants and an explicitly reviewed deployment plan; local row IDs must not be copied to production.

## Validation

- All 148 variants represented; a separate audit found no dimension/unit/thickness mismatches.
- All 22 SVGs rendered; text bounds checked. Representative sheet, motor, triangle, machine and ruler drawings visually inspected.
- Focused parser/overview tests, TypeScript and scoped lint passed.
- Local transaction inserted 22 media rows and 3 single-variant assignments; protected product, price, stock, category, supplier and order data unchanged. Repeat changes: zero.
- Browser check confirmed a photograph remains first, the dimension image is present, labels are not cropped, the full-size link serves successfully, and mobile has no horizontal overflow or page errors.
- Backup: tmp/catalog-refinements/dimension-sketches-local-2026-09-11T14-29-22-098Z/before.json.


## Square-layout revision

On 11 September 2026, all 22 images were replaced with square layouts and larger, exclusively horizontal labels. Existing dimensions and all 148 variants were retained. Checks found no rotated labels, overlapping text or canvas overflow. The media-only transaction hid the 22 earlier diagrams, retained them for rollback, and preserved all other data. Backup: tmp/catalog-refinements/dimension-sketches-local-2026-09-11T14-49-27-264Z/before.json.

## Individual-variant revision

The latest request replaces combined overviews with one sketch per variant, using the supplied clean top/side-view reference. All labels remain horizontal, preserving the earlier readability requirement. The `per-variant` manifest validator refuses missing variants, shared sketches, duplicate coverage and mismatched IDs/SKUs. The media-only synchronizer retains old images and hides only obsolete managed sketches. No product dimensions, prices, stock, categories or statuses are changed.

Applied locally: 149 images and 149 exclusive variant assignments; 22 earlier managed diagrams hidden. Protected product, price, stock, category, supplier and order data remained unchanged; repeat synchronization produces zero changes. Backup: `tmp/catalog-refinements/dimension-sketches-local-2026-09-11T15-38-20-705Z/before.json`.

Validation: all 149 assets are square 1800 × 1800 SVGs; generic and machinery renderers passed text-bound/overlap inspection. Five geometry/manifest tests and five gallery-filter/selection tests passed, as did scoped ESLint and TypeScript. Local browser checks at 1049 px and 390 px confirmed exclusive sketch visibility, switching directly between sketches, an open preview following the new variant, full-size SVG access, and no sketch when variant selection is incomplete. The single 300 mm steel-rule variant was also checked.

## Production publication

The separate [production publication plan](dimension-production-2026-09.md) reconciles 149 sketches against the reviewed production catalog without changing the local manifest or copying local record identities.
