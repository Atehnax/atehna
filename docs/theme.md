# Theme tokens (source of truth)

This project uses **CSS variables in `src/shared/styles/globals.css`** as the source of truth for colour and surface styling, with Tailwind mappings in `tailwind.config.ts`.

## Where to change colours

- **Primary theme variables:** `src/shared/styles/globals.css`
- **Tailwind token mapping:** `tailwind.config.ts`
- **Component-level UI tokens/classes:** `src/shared/ui/theme/tokens.ts`

## Minimal palette

### Blue family
- `--blue-50`
- `--blue-100`
- `--blue-500`
- `--blue-700`

### Semantic colours
- `--semantic-info`, `--semantic-info-soft`, `--semantic-info-border`
- `--semantic-success`, `--semantic-success-soft`, `--semantic-success-border`
- `--semantic-warning`, `--semantic-warning-soft`, `--semantic-warning-border`

### Surface/border
- `--surface`
- `--surface-muted`
- `--surface-subtle`
- `--border`

## Guidance

- **Do not introduce new blue hex values in components.** Use the existing blue/semantic tokens.
- For selectable icon tiles/badges, use `--blue-500` through `currentColor`: the active/hover frame should be a 1px current-color outline and the SVG stroke should inherit the same color.
- For new status/chart/UI colours, first add a CSS variable token in `globals.css`, then map in `tailwind.config.ts` if Tailwind class usage is needed.
- Prefer semantic tokens (`--semantic-info/success/warning`) for meaning-driven UI (e.g. analytics colours, status-adjacent controls) rather than hardcoded brand shades.

## Page content width

- Admin, landing, catalog, and product pages share `SiteNavigationConfig.siteLayout.siteContentMaxWidthPx` through `--site-content-max-width` (default 1500 rendered pixels). Do not add page-specific maximum widths or use the legacy homepage/product appearance width settings to override it.
- Admin's `.site-page-content` fills the space inside its existing sidebar padding. Public `.container-base` and `.site-container` center the same available width: the smaller of the configured maximum and the viewport minus the admin's horizontal space reservation.
- `--site-page-inset-start` / `--site-page-inset-end` define that reservation: 80/16 px below 768 px, 96/24 px from 768 px, and 96/28 px from 1024 px. These variables also supply the admin shell padding. `src/shared/domain/layout/pageContent.ts` supplies the equivalent measurements for device previews and hero guides.
- Public content compensates for the existing 0.75 storefront scale through `--site-page-content-scale`. Preview content supplies its own logical scale and viewport insets. Width comparisons must use rendered bounding boxes, including the browser's scrollbar reservation.
- Full-width backgrounds, internal text measures, galleries, forms, and document canvases may keep their own sizing. The outer page content container must follow this standard.
- Navbar geometry remains independently locked by `docs/navbar-lock-requirements.md`; do not apply page width overrides to `.topbar-inner`.
- Run `npm run check:page-width` to check actual CSS in Chromium across responsive sizes, custom maximum widths, and previews without requiring an application database.
