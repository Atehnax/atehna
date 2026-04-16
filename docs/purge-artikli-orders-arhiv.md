# Purge runbook: `admin/artikli`, `admin/orders`, `admin/arhiv`

This runbook and script are designed for **schema-affecting maintenance with strict evidence capture**.

## Scope

Purges only:
- `orders`
- `order_items`
- `order_documents`
- `order_attachments`
- `order_payment_logs`
- `deleted_archive_entries`
- artikel/product entries inside `catalog_categories.items`

Never deletes category definitions/hierarchy/media metadata in `catalog_categories`.

## Phase 1 — preflight audit (mandatory)

```bash
npm run maintenance:purge-audit
```

This creates an artifact folder `artifacts/purge-audit-<timestamp>` with:
- `schema-tables.json`
- `schema-columns.json`
- `schema-foreign-keys.json`
- `table-audit.json`
- `row-counts-before.json`
- `catalog-signature-before.json`

No data is deleted in this phase.

## Phase 2 — execute purge with backup (mandatory backup)

```bash
npm run maintenance:purge-execute
```

Optional sequence reset (safe for fully purged domains only):

```bash
node scripts/purge-artikli-orders-arhiv.mjs --execute --reset-sequences
```

The script exports backups before deletion:
- `backup-orders.json`
- `backup-order_items.json`
- `backup-order_documents.json`
- `backup-order_attachments.json`
- `backup-order_payment_logs.json`
- `backup-deleted_archive_entries.json`

Then executes a single transactional purge and writes:
- `row-counts-after.json`
- `catalog-signature-after.json`
- `post-checks.json`

## Category safety guarantees

The script updates only `catalog_categories.items` and `updated_at`.

After execution it compares a signature of all non-item category fields (`id`, `parent_id`, `slug`, titles/descriptions/media, position, status, timestamps) before vs after.
If any non-item category metadata changed, the run is flagged as unsafe.

## Rollback

Use backup JSON exports from the same artifact directory as rollback source data.

Because rollback policy depends on environment conventions, restore should be executed by an operator with DB access and reviewed SQL import scripts.
