# Removal Report

## Scope
This report documents high-confidence bloat removals made in this branch.

## Unused module candidates and proof
The following module files were removed after two checks:
1. Exact alias import-path search returned no references.
2. Symbol-name search returned only self-definition sites and no usage call sites/imports.

Removed files:
- src/components/admin/AdminDateRangePicker.tsx
- src/components/admin/AdminOrderActions.tsx
- src/components/admin/AdminOrderEditForm.tsx
- src/components/admin/AdminOrderOverviewCard.tsx
- src/components/admin/AdminOrderPaymentStatus.tsx
- src/components/admin/AdminOrdersMiniCharts.tsx
- src/components/admin/AdminOrdersRowActions.tsx
- src/components/products/ProductList.tsx

Safety verification:
- npm run lint
- npm run build

Both checks passed after removal.

## Unused dependency candidates and proof
Static analysis command:
- npx depcheck

Result included:
- unused dependencies: plotly.js-dist-min

Runtime-usage confirmation:
- search for direct references to plotly.js-dist-min found no matches in repository source.

Action taken:
- removed plotly.js-dist-min from dependencies in package.json.

Safety verification:
- npm run lint
- npm run build

Both checks passed after dependency removal.

## Not removed (intentional)
- autoprefixer
- postcss

Reason:
- although depcheck listed them, they are part of the tailwind/postcss build toolchain and retained to avoid toolchain regressions.
