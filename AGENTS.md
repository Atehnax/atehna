## Landing navbar lock

Before creating, editing, or refactoring the landing-page navbar, read `docs/navbar-lock-requirements.md`.

The Products, Resources, Solutions, Enterprise, and Pricing navbar group is style-locked. Do not change its typography, spacing, hover state, active state, chevrons, dropdown behavior, dropdown panel styling, or layout unless the user explicitly says: `override navbar lock requirements`.

The navbar height is also locked. New controls such as logo changes, search, cart, account controls, or CTAs must be added only in the left or right extension areas and must not change the rendered navbar height.

Admin-managed top-bar positioning is allowed only through `SiteNavigationConfig.topBarLayout` and `admin/podoba/navigacija`. It may move the logo, navigation, search, `Vprašaj AI`, and cart pieces left or right with horizontal offsets, but it must not change navbar height, core typography, dropdown anchor behavior, dropdown geometry, or responsive breakpoints.

The `admin/podoba/navigacija` top-bar preview checkbox must feed the unsaved admin configuration into the existing root `SiteHeader` and render it through the same commercial scale used on the landing page. Do not create a second fixed or card-contained navbar preview for this checkbox, and do not let the preview wrapper add document height or push admin page content down.

Admin-managed dropdown overflow is locked too. If a top-level navbar item has more dropdown groups than fit in the fixed three-column desktop panel, the public dropdown must paginate those groups instead of hiding them or changing panel geometry. The desktop panel height is the shared five-row content height from the dropdown tokens, not a taller hardcoded blank area. The admin `admin/podoba/navigacija` editor must clearly indicate which groups belong to public dropdown page 2+.

Public dropdown item hover/focus/active effects must stay aligned with `admin/podoba/navigacija`: the whole item may use the shared neutral hover background, and the icon tile/glyph uses the shared blue interaction color. Do not restore the older black-icon-tile-only hover behavior unless explicitly requested.

Public dropdown item vertical spacing must also stay visually aligned with `admin/podoba/navigacija`: the admin editor keeps its compact raw grid gap from `SITE_NAVIGATION_ADMIN_SELECTION_ROW_GAP_PX`, while the public desktop dropdown uses `SITE_NAVIGATION_DESKTOP_DROPDOWN_ROW_GAP_PX` to match the admin title-to-title rhythm despite different row heights. Do not collapse the public dropdown back to the tiny admin raw gap unless explicitly requested.

Public desktop dropdown text alignment is locked to the admin editor row model: the title/description stack is exactly the icon tile height, with title top aligned to the icon tile top and description bottom aligned to the icon tile bottom.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
