# Supplier directory

The `Dobavitelji` tab at `/admin/artikli?view=suppliers` uses the existing schools table controls and persists its rows in `catalog_supplier_rows`. Each row can reference one catalog article; an article can have multiple suppliers. Removing an article preserves the supplier row and its article label. Empty rows are supported for incremental entry, as in the schools table.

For an existing installation on `20260908.admin-auth-v1`, run `node scripts/migrate-catalog-suppliers.mjs` in a trusted operator environment with the existing `DATABASE_URL`. The script verifies the prior schema, adds only the supplier table and indexes, verifies the new contract, and commits atomically. A repeated run verifies the installed contract without recreating data. It does not change accounts, passwords, session settings, or environment credentials. Fresh installations use `database/schema.sql`.

Deploy application code only after the migration passes. This is an offline operator script, never a web endpoint or a request-time migration.