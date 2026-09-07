# Logo library and layered editor

`/admin/podoba/logotip` owns reusable artwork. Navigation owns header geometry. Every public consumer reads the same published projection; editing code is imported only by the admin editor.

## Working with logos

- Create a named variant from a blank canvas, a wordmark with separate company/legal/tagline text, or an editable symbol example. Import images with the image tool. Raster uploads remain a single image layer.
- Save stores a private editable draft. Publish renders and uploads PNG at 1×/2× and self-contained SVG, then switches the published revision in one database transaction. Its confirmation lists all direct and default-inherited usages.
- Placements select published variants or explicit default/original/brand/hidden fallbacks. Different desktop/tablet/mobile header and footer assignments remain independent. Removing an assignment does not delete the variant. Used variants cannot be deleted.
- Duplicate creates an independent draft. Hide its separate tagline or legal-name layer to create a genuinely different design. Rename using the name field and save.
- The real header/footer preview runs inside an isolated same-origin iframe so responsive CSS sees the selected viewport. Bounds, safe margins, source-resolution warnings, and fit actions use the current navigation constraints. Preview backgrounds never enter exports.
- Cropping/masking and transparent-margin trimming retain the private source. Undo reverses them. Previous published revisions can be restored.

Shortcuts outside text fields: Ctrl/Cmd+S saves, Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redoes, Ctrl/Cmd+D duplicates selected layers, Ctrl/Cmd+G groups, Ctrl/Cmd+Shift+G ungroups, Delete removes unlocked selections, arrows nudge by 1 px (Shift: 10 px), and Space pans. Ctrl/Cmd-click extends selection. Alignment explicitly targets the canvas or selection.

## Persistence and storage

Versioned `LogoProject` data stores nested image/text/shape/group layers, dimensions, transforms, visibility/locks, crop/mask, typography, and effects. Variant IDs are stable; source assets and publication outputs are immutable.

The existing `site_logo_settings` table stores `website-logo-library`. Library and draft revision checks reject stale writes without overwriting changes. A failed render/upload/transaction retains the previous publication. History keeps the last 20 publications. Audit events record committed mutations.

Source uploads use the existing private Vercel Blob store (`ORDER_DOCUMENT_BLOB_STORE_ID`). Published outputs use `PUBLIC_MEDIA_BLOB_STORE_ID`. Credentials remain in Vercel; no production environment download is needed. Existing explicit local E2E storage is available only outside Vercel with both `E2E_MODE=1` and `E2E_LOCAL_PRIVATE_BLOB=1` and a valid storage namespace.

Admin routes:

- `GET /api/admin/logo-library`: private library and public projection.
- `POST /api/admin/logo-library`: create/save/duplicate/rename/delete/assign/publish/restore; preview and export do not save.
- `POST /api/admin/logo-library/assets`: authenticated, same-origin multipart upload.
- `GET /api/admin/logo-library/assets/[assetId]`: authenticated private source bytes.

Public logo/icon routes resolve immutable published outputs. Public components receive only dimensions, bounds, URLs, revision, name, and fallback information; no projects, source assets, or publication history.

## Fresh installation and preserved settings

An existing `website-logo-library` record is read unchanged, including its saved projects, placements, sources, publication history and revision. Preserved legacy rows and receipts are not rewritten or deleted.

A fresh settings store initializes the two established default variants under the existing advisory transaction lock. The server seed PNGs in `src/shared/server/logo-defaults` retain the original artwork and intentional PDF crop exactly. They enter the same private source upload, project validation, rendering and immutable publication pipeline as other library images. The library is inserted only after both publications succeed. A failed database transaction leaves no library pointer; as with ordinary publication, already-uploaded immutable files can remain unreferenced after a later failure and are not automatically deleted.

The initial assignments remain distinct: standalone and PDF use their respective variants, header and metadata/icon placements use the brand fallback, and footer placements use the original fallback. Fresh navigation defaults already contain the existing 18/16.5/15 px logo heights; initialization does not rewrite navigation settings or navbar geometry. The historical `migratedAt` JSON field remains populated for API compatibility, but initialization does not convert an older configuration.

If the library is absent and a `website-site-logo` row exists, initialization fails before uploading or writing anything. This source supports a fresh database or a restored current library, not runtime conversion of older settings. Before connecting an environment with only old logo settings, preserve its exact logo/navigation records, private originals, public outputs and recovery backup, then restore a prepared current library through the approved operational procedure. Do not delete that row to force default artwork over an existing configuration.

The old editor and public upload scope remain retired. `/api/admin/site-logo` continues to return 410. Public consumers use only the published projection and existing immutable asset URLs remain valid.

## Consumers

The storefront header, responsive mobile navigation, footer, icon/manifest/social routes, navigation/footer editors, document template editor and preview, order/quote PDF generation, and PDF email attachments use published assets. Existing email HTML does not use a shared logo and was not expanded with new unrelated features. Already-generated PDFs retain their original bytes.

## Boundaries

- Uploads: PNG, JPEG, WebP, or SVG up to 3 MB; decoded sources up to 8192 px per axis and 16 million pixels. SVG parsing rejects scripts, external references, entities, and unsafe markup. Safe unsupported SVG features remain a flattened image with a warning.
- Canvas: up to 4 million pixels, allowing 2× export within the 16-million-pixel rendering budget. At most 200 layers and 8 group levels; bounded aggregate source and text sizes.
- Fonts: bundled Inter, Barlow, Bitter (400/500/600/700, normal/italic), and Noto Sans (400/700 normal). SVG exports use glyph paths, so consumers do not need these fonts.
- Groups with rotated descendants require proportional scaling because the project model does not represent shear. Ungrouping a group with compositing opacity/effects is refused rather than changing its appearance.
- JSON project export/import preserves editable state within the same source library. PNG and self-contained SVG are portable rendered outputs. PSD import and automatic layer separation are outside scope.
