# Theme tokens (source of truth)

This project uses **CSS variables in `src/app/globals.css`** as the source of truth for colour and surface styling, with Tailwind mappings in `tailwind.config.ts`.

## Where to change colours

- **Primary theme variables:** `src/app/globals.css`
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
- For new status/chart/UI colours, first add a CSS variable token in `globals.css`, then map in `tailwind.config.ts` if Tailwind class usage is needed.
- Prefer semantic tokens (`--semantic-info/success/warning`) for meaning-driven UI (e.g. analytics colours, status-adjacent controls) rather than hardcoded brand shades.

## Layout note

- Public pages are centered by the shared `.container-base` utility in `src/app/globals.css` (`mx-auto` + `max-w-6xl`).
- The public page flow is hosted by `src/app/layout.tsx` (`<main className="flex-1">`) to preserve normal block width behavior for centered containers.
