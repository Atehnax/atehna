# Navbar Lock Requirements

## Purpose

Protect the current landing-page navbar from accidental style drift while still allowing new controls to be added to the left or right of the locked nav group.

Codex must read this file before creating, editing, or refactoring the landing-page navbar.

## Locked navbar group

The following desktop navbar items are style-locked:

- Products
- Resources
- Solutions
- Enterprise
- Pricing

This includes their container, typography, spacing, active state, hover state, chevrons, dropdown trigger behavior, dropdown panel alignment, and mega-menu styling.

## Hard rule

Do not change the visual style, dimensions, behavior, or layout of the locked navbar group unless the user explicitly says:

> override navbar lock requirements

A normal request such as “add a search bar”, “add cart”, “change logo”, “add login button”, “add CTA”, or “add left-side content” is not permission to modify the locked group.

## Navbar height lock

Preserve the existing navbar height exactly.

- Do not increase or decrease the desktop navbar height.
- Do not add vertical padding, margins, borders, line-height changes, or controls that alter the rendered header height.
- Treat the current code as the source of truth for the exact height.
- If no token exists, create or preserve a token such as `--navbar-height` equal to the current rendered content height.
- If the current implementation is 64px plus a 1px border, preserve that total rendered height.
- New controls must fit inside the existing height.
- New controls should generally use a 32px height on desktop.

## Locked style details

For Products, Resources, Solutions, Enterprise, and Pricing, preserve the current values for:

- font family
- font size
- line height
- font weight
- letter spacing
- text color
- hover color
- active/open color
- hover background
- active/open background
- border radius
- item height
- horizontal padding
- gap between nav items
- chevron size
- chevron spacing
- chevron rotation/open state
- transition timing
- focus style
- dropdown open/close behavior
- dropdown panel position
- dropdown panel width
- dropdown panel border
- dropdown panel border radius
- dropdown panel shadow
- dropdown panel padding
- dropdown grid/column layout
- dropdown item typography
- dropdown item hover states

If these are currently implemented with Tailwind classes, do not change those classes for the locked group.
If these are currently implemented with CSS selectors, do not change those selectors for the locked group.
If these are currently implemented with component props or variants, do not change those variants for the locked group.

## Navbar state names and color standard

Use these state names for navbar links and triggers:

- `default/resting`
- `hover`
- `open/current`

Do not describe normal non-open navbar links as `inactive` or `disabled`. A normal navbar link is not disabled; it is simply in its default/resting state.

### Color correction rule

Navbar and dropdown color corrections are allowed only when the user explicitly says:

> override navbar lock requirements

If the override is scoped to color correction, Codex may only change navbar/dropdown color values, color tokens, or color classes. It must not change:

- font size
- font family
- font weight
- line height
- letter spacing
- spacing
- padding
- layout
- navbar height
- dropdown behavior
- menu content
- icon size
- animations
- right-side controls
- mobile behavior

Color correction must be treated as a color-only task unless the user explicitly expands the override scope.

### Color source of truth

When matching the Vercel-like reference, first inspect the current Vercel navbar/dropdown with DevTools or browser automation if available.

Use computed styles for:

- default/resting top nav link
- hover top nav link
- open/current top nav link
- open trigger background
- dropdown section heading
- dropdown item title
- dropdown item description
- dropdown icon glyph
- dropdown panel border

If computed values are unavailable, use these screenshot-derived neutral monochrome targets.

### Top-level navbar colors

- default/resting link text: `#4d4d4d` or `#4c4c4d`
- hover link text: `#171717`
- open/current link text: `#171717`
- open trigger background: approximately `#ebebeb`
- chevrons: `currentColor`
- default/resting chevron opacity: `0.7` to `0.8`
- open/current chevron opacity: `1`

Do not make open/current state bolder to indicate selection. Use color, background, and chevron state instead.

### Dropdown colors

- section heading: `#4d4d4d` to `#5f5f5f`
- item title: `#171717`
- item description: `#636363`
- icon glyph: `#4c4c4d` to `#5f5f5f`
- icon tile border: light neutral gray, around `#e6e6e6` to `#ebebeb`
- panel border: light neutral gray, around `#e6e6e6` to `#ebebeb`

Avoid blue-gray/slate colors in the navbar and dropdown. In particular, avoid Tailwind-style `slate-*` colors and values like `#6b7280`, `#6b727f`, or Material-style `#5f6368` if they make descriptions or icons look cool/blue compared with the Vercel reference.

Use neutral grays where red, green, and blue channels are equal or nearly equal.

### Navbar-scoped color variables

Prefer navbar-scoped CSS variables/classes such as:

````css
--navbar-link-default: #4d4d4d;
--navbar-link-hover: #171717;
--navbar-link-current: #171717;
--navbar-trigger-open-bg: #ebebeb;

--navbar-dropdown-heading: #4d4d4d;
--navbar-dropdown-title: #171717;
--navbar-dropdown-description: #636363;
--navbar-dropdown-icon: #4c4c4d;
--navbar-dropdown-border: #e6e6e6;

## Core nav typography/rendering standard

The locked core nav text should visually match the Vercel-like navbar reference.

Core nav typography:

- font-size: 14px
- line-height: 20px
- font-weight: 400 by default
- active/open state should not use bold/semibold unless explicitly requested
- use color/background/chevron state for active indication instead of heavier font weight

Core nav rendering:

- use Geist Sans or the closest configured equivalent
- apply navbar-scoped font smoothing:
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
- avoid text-shadow, filter, backdrop-filter, opacity-on-parent, scale, zoom, translateZ(0), unnecessary will-change, or transform-based positioning on nav text ancestors
- prefer flex/grid layout over transform centering when positioning the nav group
- chevrons should be subtle, around 12px with light stroke weight

## Dropdown typography and icon rendering

Dropdown typography must visually match the Vercel-like navbar reference.

Rules:

- Use the same navbar font family as the core nav, preferably Geist Sans.
- Do not let dropdown text inherit unrelated global/body typography if it creates a mismatch.
- Section headings should be lighter than item titles: 400-500 weight, neutral muted gray.
- Item titles should be strong but not chunky: usually 500-600 weight, never 700 unless explicitly requested.
- Descriptions should use neutral gray, not cool blue-gray.
- Apply font smoothing only inside the navbar/dropdown scope:
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
- Avoid text-shadow, opacity on parent containers, filters, scale, zoom, translateZ(0), and unnecessary will-change on dropdown text ancestors.
- Dropdown icon tiles should stay compact, but SVG glyphs should be large enough to match the Vercel reference.
- Target dropdown SVG icon size: 22px-24px, with stroke width around 1.75-2 for lucide-style icons.

## Allowed extension areas

New navbar elements may be added only in extension areas outside the locked group:

1. Left extension area
   - Logo/brand area
   - Optional controls near the logo
   - Optional compact search trigger

2. Right extension area
   - Search bar or search trigger
   - Cart button
   - Account controls
   - Login/signup/dashboard buttons
   - Other compact utility controls

Do not insert new utility controls between Products, Resources, Solutions, Enterprise, and Pricing unless the user explicitly requests that exact placement.

## Extension layout rules

Any new left/right navbar control must obey these constraints:

- Must not change navbar height.
- Must not cause the locked nav group to wrap.
- Must not change locked nav group spacing.
- Must be vertically centered in the existing navbar.
- Desktop control height should be 32px unless an existing token says otherwise.
- Icon-only controls should be approximately 32px by 32px.
- Search input height should be approximately 32px.
- Search input width may change responsively, but height must not.
- Use `min-width: 0` where needed to avoid overflow.
- At narrower widths, collapse or hide extension controls before changing the navbar height.
- If horizontal space is limited, prefer this order:
  1. keep logo visible
  2. keep locked nav group unchanged on desktop
  3. collapse search to icon-only
  4. hide optional utility labels
  5. move optional controls into mobile menu

## Right and left extension controls

Search, AI, cart, account, and similar left- and right-side navbar controls must use navbar-local styling. Do not let these controls inherit generic/global input or button sizing if that makes them visually inconsistent with the locked navbar.

Left-side and right-side controls must match the locked core nav links in visual rhythm:

- 32px control height
- 14px text
- 20px line-height
- 500 font-weight
- default/resting color matching core nav links
- dark hover color matching core nav links
- subtle hover background matching core nav links
- same border radius as navbar controls
- visible focus rings
- no navbar height changes

Search must be icon-only by default. The collapsed search control should be a 32px by 32px magnifying-glass button. It may expand into a 220px-260px input on click/focus, but the expanded input must stay 32px high and must use navbar-local styling.

Cart must be a compact navbar icon button with an icon size around 18px-19px. If a badge is shown, it must be absolutely positioned and must not affect navbar height. Hide the badge when cart count is zero or unavailable.

`Vprašaj AI` must visually harmonize with the core nav links. It should not look like a mismatched standalone form button unless the locked navbar style itself uses that treatment.

## Preferred component structure

Use a layout with explicit slots so future changes do not disturb the locked group:

```tsx
<header>
  <nav aria-label="Main">
    <div data-navbar-left>brand/logo and optional left accessories</div>

    <div data-navbar-core>
      Products, Resources, Solutions, Enterprise, Pricing
    </div>

    <div data-navbar-right>
      search, cart, account, CTAs, and other utilities
    </div>
  </nav>
</header>
````

The `data-navbar-core` area is locked.
The left and right areas are extension zones.

## Allowed changes without override

Codex may do the following without violating this file:

- Add or replace the logo in the left extension area.
- Add a search trigger or search input in the left or right extension area.
- Add a cart button in the right extension area.
- Add account, login, signup, or dashboard controls in the right extension area.
- Add accessibility labels to new controls.
- Add responsive collapse behavior for new controls.
- Add tests or comments documenting the lock.
- Add CSS variables for extension controls, as long as the locked group remains unchanged.

## Not allowed without override

Codex must not do the following unless the user explicitly overrides this file:

- Change the navbar height.
- Change the Products/Resources/Solutions/Enterprise/Pricing font size.
- Change the Products/Resources/Solutions/Enterprise/Pricing padding.
- Change the gap between locked nav items.
- Change any active/open trigger pill style.
- Change chevron appearance or behavior.
- Change dropdown panel size, border, radius, shadow, padding, or alignment.
- Change hover styles for the locked group.
- Move locked nav items to a different visual region.
- Add a new item inside the locked group.
- Use larger controls that force the navbar taller.
- Add top/bottom margin to navbar children.
- Add vertical padding to the header or nav wrapper.
- Introduce wrapping in the desktop navbar.
- Refactor locked navbar styles “for cleanup” unless directly requested.

## Search/cart examples

Acceptable search additions:

- A 32px-tall search input in the right extension area.
- A 32px by 32px search icon button that opens search.
- A responsive search input that collapses to an icon below a chosen width.

Acceptable cart additions:

- A 32px by 32px cart icon button in the right extension area.
- A small badge positioned inside the button without changing button size.

Unacceptable additions:

- A 40px or 44px search input that makes the navbar taller.
- A search bar inserted between Resources and Solutions.
- A cart button that changes the locked nav group gap.
- A logo change that increases header height.

## Mobile rules

Mobile behavior may be adjusted only as needed for new controls, but the existing mobile navbar height and locked menu styling should remain stable.

- Do not make the closed mobile header taller.
- New controls should move into the mobile menu when there is not enough horizontal space.
- Keep Products, Resources, and Solutions as accordion/dropdown sections if that is the existing mobile pattern.
- Keep Enterprise and Pricing as direct links if that is the existing mobile pattern.

## Required self-check before finishing

Before finalizing a change, Codex must inspect the diff and confirm:

- The rendered navbar height is unchanged.
- Products, Resources, Solutions, Enterprise, and Pricing still look unchanged.
- Locked nav item typography is unchanged.
- Locked nav item spacing is unchanged.
- Dropdown behavior is unchanged.
- New elements are only in left/right extension areas.
- No locked Tailwind classes, CSS rules, or component variants were changed accidentally.

If a requested change cannot be implemented without changing the locked group or navbar height, Codex must stop and explain the conflict instead of editing the locked styles.
