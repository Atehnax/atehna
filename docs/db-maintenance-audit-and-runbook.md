# DB maintenance audit + local runbook (artikli + orders + arhiv)

## Scope

This runbook is intentionally limited to:

- `admin/artikli`
- `admin/orders`
- `admin/arhiv`

with strict protection of categories/hierarchy/media/metadata.

## Phase 1 — static schema + code audit summary

### Canonical storage model

1. **Artikli (products) canonical storage**
   - Table: `catalog_categories`
   - Product payload column: `items jsonb`
   - Category hierarchy/metadata columns are same table (`id`, `parent_id`, `slug`, `title`, `summary`, `description`, `image`, `admin_notes`, `banner_image`, `position`, `status`, `created_at`, `updated_at`).

2. **Orders canonical storage**
   - Base: `orders`
   - Dependents: `order_items`, `order_documents`, `order_attachments`, `order_payment_logs`

3. **Arhiv canonical storage**
   - Base: `deleted_archive_entries`
   - Additional archive behavior depends on soft-delete markers in `orders.deleted_at` and `order_documents.deleted_at`.

### Table-by-table domain audit

| table | purpose | domain ownership | FK notes | classification |
|---|---|---|---|---|
| `catalog_categories` | category tree + embedded product payload (`items`) | categories + artikli payload | self-FK `parent_id -> catalog_categories.id` | **preserve table**; purge only `items` |
| `orders` | main order header rows | orders | parent for `order_items`, `order_documents`, `order_attachments`, `order_payment_logs` | purge rows |
| `order_items` | order lines | orders | `order_id -> orders.id` | purge rows |
| `order_documents` | generated/uploaded order docs | orders + archive | `order_id -> orders.id`; soft delete column used by archive | purge rows |
| `order_attachments` | uploaded PO/doc attachments | orders | `order_id -> orders.id` | purge rows |
| `order_payment_logs` | payment status change log | orders | `order_id -> orders.id` | purge rows |
| `deleted_archive_entries` | archive index (soft-deleted order/pdf records) | arhiv | no declared FK to orders/docs in migration | purge rows |
| `website_events` | website analytics | analytics | none in migrations | unrelated, keep |
| `analytics_charts` | admin analytics chart configs | analytics | none in migrations | unrelated, keep |
| `analytics_chart_settings` | analytics appearance settings | analytics | none in migrations | unrelated, keep |

### Category protection decision

- Untouchable category-owned data:
  - `catalog_categories.id`, `parent_id`, `slug`, `title`, `summary`, `description`, `image`, `admin_notes`, `banner_image`, `position`, `status`, `created_at`, `updated_at`
- Product-owned payload that may be purged:
  - `catalog_categories.items`

### Read/write audit highlights

- Artikli read model is loaded through catalog server/data loaders that read category rows and expose `items` per category/subcategory.
- Artikli create/edit/admin categories mutations persist through category APIs and patch/replace methods over `catalog_categories`.
- Orders create/edit/list/detail + analytics read/write directly from `orders` and dependent order tables.
- Archive pages/API read/write `deleted_archive_entries` and soft-delete/restore columns on orders/documents.

## Phase 2 — local script set

Scripts added in `scripts/db-maintenance`:

1. `01-read-only-db-audit.mjs`
   - read-only DB inventory
   - lists tables, columns, row counts, FKs, serial sequences
   - writes JSON report

2. `02-build-purge-plan-read-only.mjs`
   - read-only purge planning
   - resolves canonical tables for artikli/orders/arhiv
   - computes in-scope FK relationships and delete ordering
   - writes JSON report

3. `03-execute-purge.mjs`
   - dry-run by default
   - destructive only with `--execute`
   - artikli purge = zero out `catalog_categories.items`
   - orders/arhiv purge = delete in deterministic order
   - optional sequence reset via `--reset-sequences`
   - writes before/after summaries JSON

4. `04-post-purge-legacy-audit.mjs`
   - static code/schema usage scanner for legacy cleanup
   - table/column reference inventory in `src/` and `migrations/`
   - classifies `provenRemovable`, `likelyRemovableNotProven`, `mustRemain`
   - writes JSON + markdown report

## Phase 3 — exact purge design

### Deterministic purge behavior

- **Artikli purge:**
  - `UPDATE catalog_categories SET items='[]'::jsonb ...`
  - leaves all category hierarchy and metadata intact.

- **Orders + arhiv purge order:**
  1. `order_payment_logs`
  2. `order_items`
  3. `order_attachments`
  4. `order_documents`
  5. `orders`
  6. `deleted_archive_entries`

### Sequence reset policy

- Off by default.
- Optional for purged tables only via `--reset-sequences`.
- Uses `pg_get_serial_sequence` + `setval(..., 1, false)`.

## Phase 4 — post-purge cleanup methodology

Use `04-post-purge-legacy-audit.mjs` output and only remove code that is proven unnecessary after smoke tests.

Conservative likely-removable areas after purge (must re-verify locally):

- missing-column compatibility fallbacks in order queries/mutations
- legacy archive fallback behavior for missing `deleted_archive_entries`
- legacy dual-path inserts for old schemas in order creation/doc routes

## Local execution commands

```bash
# 0) ensure env is set locally
export DIRECT_URL='postgres://...'
# or export DATABASE_URL='postgres://...'

# 1) read-only DB inventory
node scripts/db-maintenance/01-read-only-db-audit.mjs

# 2) read-only purge planning
node scripts/db-maintenance/02-build-purge-plan-read-only.mjs

# 3) destructive script dry-run (default)
node scripts/db-maintenance/03-execute-purge.mjs

# 4) destructive execution
node scripts/db-maintenance/03-execute-purge.mjs --execute

# 5) optional sequence reset while executing
node scripts/db-maintenance/03-execute-purge.mjs --execute --reset-sequences

# 6) post-purge static legacy audit
node scripts/db-maintenance/04-post-purge-legacy-audit.mjs
```

## What to verify in script outputs

1. `01` report includes expected tables and FK graph.
2. `02` report canonical tables:
   - artikli: `catalog_categories`
   - orders: `orders` + dependents
   - arhiv: `deleted_archive_entries`
3. `03` dry-run report shows planned operations only.
4. `03 --execute` report shows near-zero `afterCounts` for order/archive tables and reduced non-empty `catalog_categories.items` rows.
5. `04` report lists legacy candidates and must-remain areas with reference matches.

## Functional validation checklist (manual app smoke)

After purge, validate:

1. `/admin/artikli` has no leftover artikli rows
2. create artikel works
3. edit newly created artikel works
4. article slug/url flow works
5. `/admin/orders` has no leftover orders
6. create order works
7. edit/view newly created order works
8. `/admin/orders/[orderId]` works for new order
9. `/admin/arhiv` has no leftover archive rows
10. archive create/edit flow works
11. `/admin/arhiv/artikli` works
12. `/admin/kategorije` unchanged
13. `/admin/kategorije/predogled` unchanged
14. `/admin/kategorije/miller-view` unchanged
15. `/products` and subpages work
16. `/order` works
17. `/order/narocilnica` works
18. `/admin/analitika` does not crash on purged/empty data
19. `/admin/analitika/diagnostika` does not crash
20. `/admin/analitika/splet` does not crash

And run project checks:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- relevant tests/smokes in your environment
