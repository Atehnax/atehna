# App Router Shell

`src/app` is intentionally kept as a thin Next.js app-router shell.

## What belongs here
- Route entrypoints required by Next.js (`page.tsx`, `layout.tsx`, `route.ts`, `robots.ts`, `sitemap.ts`).
- Minimal glue code needed by framework constraints (for example global stylesheet import in root layout).

## What does **not** belong here
- Admin feature implementation (lives in `src/admin`).
- Commercial/customer-facing feature implementation (lives in `src/commercial`).
- Shared cross-surface code (lives in `src/shared`).

Each route file in this folder should stay as a thin wrapper that re-exports and/or renders implementation from those target folders.
