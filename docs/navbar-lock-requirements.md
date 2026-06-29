# Navbar Lock Requirements

## Purpose

Protect the landing-page navbar from accidental style drift while allowing only explicitly scoped changes. Codex must read this file before creating, editing, or refactoring the navbar.

## Locked core navbar group

The locked desktop core navbar group is:

- Katalog
- Za šole
- Projekti
- Pomoč

`Za podjetja` is not part of the core navbar anymore and must not appear in the desktop or mobile top-level navbar unless explicitly requested later.

The locked group includes top-level layout, typography, spacing, colors, hover/open states, chevrons, trigger behavior, dropdown behavior, dropdown panel alignment, dropdown geometry, dropdown animation, dropdown item hover behavior, and mega-menu styling.

Do not change the locked group unless the user explicitly says:

> override navbar lock requirements

If there is an override, obey only the exact scope of that override. Do not use it as permission to refactor unrelated navbar code. Requests such as “add search”, “add cart”, “change logo”, “add account button”, or “add CTA” are not permission to modify the locked group.

## Navbar height lock

Preserve the existing navbar height exactly.

- Do not increase or decrease desktop navbar height.
- Do not add vertical padding, margins, borders, line-height changes, or controls that alter rendered header height.
- Treat the current rendered height as the source of truth.
- If no token exists, create or preserve `--navbar-height` equal to the current rendered height.
- New desktop controls should generally use `32px` height.

## Top-level style lock

For Katalog, Za šole, Projekti, and Pomoč, preserve the current top-level values unless the override explicitly permits changing them:

- font family, size, line-height, weight, letter-spacing
- text color, hover color, open/current color
- hover background, open/current background
- item height, padding, border radius, and gap between nav items
- chevron size, spacing, stroke, rotation, and transition
- focus style
- dropdown open/close behavior
- dropdown switch behavior and animations

Do not change locked Tailwind classes, CSS selectors, or component variants unless the override explicitly allows it.

## State names and neutral colors

Use these state names: `default/resting`, `hover`, `open/current`. Do not call a normal non-open link `inactive` or `disabled`.

Use neutral monochrome navbar/dropdown colors. If matching the Vercel-like reference, inspect computed styles first. Fallback values:

```css
--navbar-link-default: #4d4d4d;
--navbar-link-hover: #171717;
--navbar-link-current: #171717;
--navbar-trigger-open-bg: #ebebeb;
--navbar-dropdown-heading: #4d4d4d;
--navbar-dropdown-title: #171717;
--navbar-dropdown-description: #636363;
--navbar-dropdown-icon: #171717;
--navbar-dropdown-border: #e6e6e6;
```

Rules:

- Chevrons use `currentColor`.
- Open/current state becomes darker, not bolder.
- Avoid Tailwind `slate-*` and blue-gray values like `#6b7280` in navbar/dropdown text.
- Do not change global text, button, input, icon, or Tailwind theme colors to fix navbar colors.

## Typography and rendering

Top-level core nav:

- `14px` font size
- `20px` line-height
- `400` default font weight
- open/current state should not use bold/semibold unless explicitly requested

Dropdown typography:

- Use the same navbar font family as the core nav, preferably Geist Sans or the closest configured equivalent.
- Section headings: `400` to `500`, lighter than item titles.
- Item titles: usually `500` to `600`, never `700` unless explicitly requested.
- Descriptions: neutral gray, not cool blue-gray.
- Do not shrink dropdown text just to solve layout problems. If text does not fit, shorten the title/description or adjust approved shared geometry.

Apply font smoothing only inside the navbar/dropdown scope:

```css
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
text-rendering: optimizeLegibility;
```

Avoid text-shadow, parent opacity, filters, backdrop filters, scale, zoom, unnecessary `translateZ(0)`, and unnecessary `will-change` on navbar/dropdown text ancestors.

## Vercel reference rule

Use Vercel only as a visual style, spacing, layout-rhythm, hover-behavior, and animation reference. Do not copy Vercel’s actual labels, product names, routes, or menu content.

Avoid persistent magic-scale rules such as “always make everything 10% smaller” or “always make everything 35% smaller.” Size changes belong in explicit task prompts. This file defines lock boundaries, alignment, rhythm, and behavior.

## Core dropdown behavior

Only these top-level items have dropdowns: Katalog, Za šole, Projekti, Pomoč.

Dropdown hover model:

- Hovering a dropdown trigger opens the shared dropdown panel.
- The dropdown stays open while the pointer is over a dropdown trigger or the dropdown panel.
- The dropdown closes as soon as the pointer leaves both the dropdown trigger area and the dropdown panel.
- The user should not need to click outside to close the dropdown.
- Outside click may still close the dropdown, but it must not be required.
- Escape closes the dropdown.
- Clicking/tapping a dropdown item closes the dropdown.
- A small leave delay is allowed only to prevent flicker, usually `80ms` to `120ms` maximum.

Animation modes:

- Fresh open: when no dropdown is visible, open with subtle scale/enlarge + fade. Contents appear in place. Do not slide contents left/right on fresh open.
- Open-to-open switch: when a dropdown is already visible and the user moves to another dropdown trigger, keep the shared panel mounted and preserve the existing left/right content transition.
- Close: when pointer leaves both triggers and panel, close with reverse fresh-open effect: subtle fade + slight scale/contract.
- After close, clear previous menu, transition direction, and switching state so the next hover is treated as a fresh open, including reopening the same trigger.

## Desktop dropdown anchor and geometry

The desktop dropdown panel uses one fixed horizontal anchor:

- Align the panel left edge with the left edge of the `K` in `Katalog`.
- Do not align to the trigger pill/button edge.
- Do not align to the active/open trigger.
- Do not move the panel horizontally when switching dropdowns.
- Recalculate only on real layout changes such as resize, font loading, or breakpoint changes.

Implementation preference: wrap the `Katalog` label text in a measurable element and derive the shared dropdown anchor from that text-left edge.

Katalog, Za šole, Projekti, and Pomoč must share the same desktop dropdown geometry:

- panel left/top position
- panel width/height
- column x-coordinates
- row y-coordinates
- divider lane position
- icon tile coordinates

Column m / row n icon placement must be static across dropdowns. Do not let dropdown content length, number of items, group names, or active trigger determine icon coordinates.

## Desktop dropdown panel spacing

Dropdown content-to-border spacing must match the Vercel-like reference and be shared across all dropdowns.

- Do not hard-code cramped `10px` padding unless actually measured from the reference.
- Katalog, Za šole, Projekti, and Pomoč share the same panel padding tokens.
- If exact measured values are unavailable, use a spacious fallback near `24px` to `28px` block padding and `28px` to `32px` inline padding.
- If content needs more room, adjust the shared panel size or shorten text. Do not shrink padding differently per dropdown.
- Preserve white surface, light neutral border, rounded corners, and restrained shadow.

## Desktop dropdown grid and rhythm

Desktop dropdowns use exactly `3` columns and `5` item row slots.

- Section headings are not item slots.
- Fill columns first: column 1 top-to-bottom, then column 2, then column 3.
- Every column reserves exactly 5 item row slots.
- Empty slots remain empty and must not stretch existing rows.
- Use shared column width tokens across all dropdowns.
- Do not use per-dropdown content-based column widths if that shifts icon coordinates.
- Do not use `space-between`, `justify-between`, `align-content: space-between`, or other distribution rules that create variable gaps.
- If text does not fit shared geometry, shorten the label or description instead of changing one dropdown’s geometry.

Vertical rhythm uses the icon tile as the unit:

- icon tile size is the source of truth
- each item slot height equals icon tile height
- empty vertical gap between adjacent item slots equals icon tile height
- title-to-title spacing is consistent across every column in every desktop dropdown
- no normal list gaps such as `8px`, `12px`, `16px`, or `24px`
- no per-item margins or variable spacing

## Desktop dropdown item layout

Every desktop dropdown item must have icon tile, title, and short description.

Item alignment:

- title top aligns with icon tile top
- description bottom aligns with icon tile bottom
- text stack height equals icon tile height
- title and description have no default top/bottom margins
- use intentional line-height; do not let paragraph margins or inherited styles affect alignment

Implementation preference:

```css
.dropdownItem {
  display: grid;
  grid-template-columns: var(--navbar-dropdown-icon-tile-size) 1fr;
  column-gap: var(--navbar-dropdown-item-gap);
  align-items: stretch;
  min-height: var(--navbar-dropdown-icon-tile-size);
}
.dropdownItemText {
  height: var(--navbar-dropdown-icon-tile-size);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
}
.dropdownItemTitle,
.dropdownItemDescription {
  margin: 0;
  white-space: nowrap;
}
```

## Strict one-line rule

Every desktop dropdown title and description must be a strict one-liner.

- Titles must not wrap.
- Descriptions must not wrap.
- Do not truncate, ellipsize, clip, or hide overflow.
- Use `white-space: nowrap` for desktop dropdown titles and descriptions if needed.
- If text does not fit, shorten this site’s Slovenian title or description.
- Do not copy Vercel labels to solve text length.
- Do not resize one dropdown differently just to fit one long label.

## Dropdown item hover behavior

Dropdown item hover must not use a gray background on the full item row.

Only the icon tile visibly changes on hover/focus of the whole dropdown item.

Default icon tile:

- white background
- light neutral border
- black or near-black glyph/image

Hover/focus icon tile:

- black background
- black border
- white glyph/image

Rules:

- Hover/focus must trigger from the whole dropdown item, not only the icon.
- Use `currentColor` for SVG icons where possible.
- If icons are images, use inline SVG or masking if needed so color can switch cleanly.
- Do not use blur, glow, gradients, colored icon backgrounds, or full-row hover backgrounds.
- Transition should be subtle, around `120ms` to `160ms`.
- Apply the same behavior on `focus-visible`.

## Two-column group divider

For Katalog and Projekti:

- Main group uses columns 1 and 2.
- Secondary group uses column 3.
- Reserve the divider lane between column 2 and column 3 in all dropdowns.
- Show a subtle divider only between column 2 and column 3 where needed.
- Do not add a divider between column 1 and column 2.
- Divider color: `#eaeaea` or `rgba(0,0,0,0.08)`.

## Current dropdown content constraints

- `Komplet za posamezen projekt` must be named `Kompleti za projekte`.
- Katalog → Po uporabi must not include `Varnost pri delu`.
- Katalog → Po uporabi must not include `Nadomestni deli`.
- `Varnost pri delu` and `Dodatki in nadomestni deli` may remain catalog categories under Katalog → Kategorije if they are real catalog categories.
- Every dropdown item must keep a concise one-line description.

## Extension areas and controls

New navbar elements may be added only outside the locked group.

Left extension area:

- logo/brand area
- optional controls near logo
- optional compact search trigger

Right extension area:

- search
- cart
- account controls
- login/signup/dashboard controls
- compact utility controls

Do not insert new utility controls between Katalog, Za šole, Projekti, and Pomoč unless explicitly requested.

Left/right controls must not change navbar height or locked core nav spacing. Use navbar-local styling:

- control height: `32px`
- text: `14px / 20px`, weight `500`
- icon-only controls: about `32px` by `32px`
- search input height: about `32px`
- visible focus rings
- vertically centered

Search is icon-only by default. Expanded search should be `220px` to `260px` wide and `32px` high. Cart icon size should be around `18px` to `19px`; badge appears only when count is greater than zero and must not affect navbar height. `Vprašaj AI` must visually harmonize with the core nav links.

## Preferred component structure

```tsx
<header>
  <nav aria-label="Main">
    <div data-navbar-left>brand/logo and optional left accessories</div>
    <div data-navbar-core>Katalog, Za šole, Projekti, Pomoč</div>
    <div data-navbar-right>search, cart, account, CTAs, utilities</div>
  </nav>
</header>
```

`data-navbar-core` is locked. Left and right areas are extension zones.

## Allowed changes without override

Codex may do the following without override:

- Add or replace logo in the left extension area.
- Add search in the left or right extension area.
- Add cart in the right extension area.
- Add account, login, signup, or dashboard controls in the right extension area.
- Add accessibility labels to new controls.
- Add responsive collapse behavior for new controls.
- Add tests or comments documenting the lock.

## Not allowed without override

Codex must not do the following unless explicitly overridden:

- Change navbar height.
- Change locked top-level nav typography, padding, gap, hover/open states, or chevrons.
- Change dropdown behavior or animation.
- Change dropdown panel anchor, size, padding, grid, item alignment, icon placement, or icon hover behavior unless the override explicitly allows dropdown geometry/icon changes.
- Move locked nav items to another visual region.
- Add a new item inside the locked group.
- Add `Za podjetja` back into the top-level navbar.
- Add vertical padding/margins to header or nav children.
- Introduce wrapping in the desktop navbar.
- Refactor locked navbar styles “for cleanup”.

## Mobile rules

Mobile behavior may be adjusted only as needed for new controls.

- Do not make the closed mobile header taller.
- New controls should move into the mobile menu when horizontal space is limited.
- Keep Katalog, Za šole, Projekti, and Pomoč as accordion/dropdown sections if that is the existing mobile pattern.
- Do not show `Za podjetja` in the mobile top-level navbar unless explicitly requested later.
- Strict desktop dropdown geometry applies only to desktop dropdowns unless explicitly requested for mobile.

## Required self-check

Before finishing, Codex must confirm:

- navbar height is unchanged
- `Za podjetja` is not present in desktop or mobile top-level navbar
- top-level core nav styling and spacing are unchanged unless explicitly overridden
- new elements are only in left/right extension areas
- dropdown panel padding matches the Vercel-like reference and is shared across all dropdowns
- dropdown panel left edge aligns with the left edge of the `K` in `Katalog`
- switching dropdowns does not move the panel horizontally
- every desktop dropdown uses the same 3-column x 5-slot geometry
- every column/row icon coordinate is static across dropdowns
- row gap equals icon tile height
- title top aligns with icon tile top
- description bottom aligns with icon tile bottom
- every title and description is one line and fully visible
- no title/description wraps, truncates, ellipsizes, clips, or hides
- dropdown closes on pointer leave without requiring an outside click
- fresh open uses scale/fade only, with no directional content slide
- close uses fade/scale-out
- open-to-open switching preserves the existing left/right transition
- after close, reopening any trigger is treated as a fresh open
- dropdown item hover changes only the icon tile, not the full row background
- icon tiles are white by default and become black on item hover/focus
- icon glyphs are black by default and become white on item hover/focus
- Katalog/Projekti divider appears only between columns 2 and 3

If a requested change conflicts with the lock or navbar height, Codex must stop and explain the conflict instead of editing outside scope.
