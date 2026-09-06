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

## Preserving existing logos

On the first read without a library, initialization takes an advisory transaction lock. It converts each effective legacy composition/presentation to an immutable preserved variant, preserving explicitly hidden placements and original/brand fallbacks. Identical artwork may share a variant. Original uploaded sources are also retained.

Legacy logo display-height settings are moved into navigation-owned logo constraints. Existing expanded slots and their anchors are preserved. The navbar height and locked core navigation styling do not change.

Only after all preserved outputs exist are the new library and navigation settings committed together. The original raw logo/navigation settings are retained in `website-logo-library-migration-receipt-v1`, and the original logo row remains as a recovery record. No DDL or order-data migration is involved. If initialization fails, its transaction rolls back and the source records remain intact.

The old editor, old shared controls, settings reader, render facade, and public upload scope are removed. `/api/admin/site-logo` returns 410. The old artwork model and rendering core remain solely as the one-time preservation converter; normal editing and rendering never use them.

## Consumers

The storefront header, responsive mobile navigation, footer, icon/manifest/social routes, navigation/footer editors, document template editor and preview, order/quote PDF generation, and PDF email attachments use published assets. Existing email HTML does not use a shared logo and was not expanded with new unrelated features. Already-generated PDFs retain their original bytes.

## Boundaries

- Uploads: PNG, JPEG, WebP, or SVG up to 3 MB; decoded sources up to 8192 px per axis and 16 million pixels. SVG parsing rejects scripts, external references, entities, and unsafe markup. Safe unsupported SVG features remain a flattened image with a warning.
- Canvas: up to 4 million pixels, allowing 2× export within the 16-million-pixel rendering budget. At most 200 layers and 8 group levels; bounded aggregate source and text sizes.
- Fonts: bundled Inter, Barlow, Bitter (400/500/600/700, normal/italic), and Noto Sans (400/700 normal). SVG exports use glyph paths, so consumers do not need these fonts.
- Groups with rotated descendants require proportional scaling because the project model does not represent shear. Ungrouping a group with compositing opacity/effects is refused rather than changing its appearance.
- JSON project export/import preserves editable state within the same source library. PNG and self-contained SVG are portable rendered outputs. PSD import and automatic layer separation are outside scope.
