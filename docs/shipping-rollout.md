# Shipping rollout

The application uses one canonical clean-slate schema. A fresh deployment
installs the complete current `database/schema.sql` once into a verified empty
database before the matching application build receives traffic. It does not
partially replace tables in an existing database or load demonstration data.

## Fresh database installation

1. Provision a new database and verify its host, database name, and database
   user against the explicitly approved target. Confirm that it contains no
   application tables, functions, or data. Stop if the target is not empty;
   never clear a database to make this procedure fit.
2. Configure the PostgreSQL client with that exact target through protected
   connection settings. Do not put credentials in command output or rely on a
   previously configured default database. From the repository root, install
   the complete schema with stop-on-error behavior:

   ```powershell
   psql --no-psqlrc --set=ON_ERROR_STOP=1 --command="set search_path = public, pg_temp;" --file=database/schema.sql
   ```

   The file owns its `BEGIN`/`COMMIT` transaction. Do not extract individual
   statements, execute historical upgrade artifacts on this new schema, or
   invoke setup from application requests, builds, or startup.
3. Run `npm run check:schema-contract`. Then explicitly set `DATABASE_URL` to
   the same verified new target and run `npm run check:database-schema`.
   The checker reads the process environment, does not load a local `.env`
   file, and verifies the database in a read-only transaction. Confirm contract
   `20260905.analytics-v4` and `installed_via='fresh_schema'`.
4. Confirm that products, customers, orders, quotes, documents, and delivery
   queues are empty. The schema installs only the real category taxonomy and
   operational defaults. Never run `tests/fixtures/e2e-seed.sql` or the
   disposable E2E preparation commands against this database.
5. Populate the address index with `npm run addresses:sync`, explicitly
   targeting the new database, and verify street/postal suggestions before
   exposing checkout. The schema starts with an empty GURS index; see
   `docs/gurs-address-register.md`.
6. Review shipping prices, sender configuration, administrator recipients,
   and the visible email controls. Email settings start from current
   application defaults with delivery off. No saved templates or queued
   messages exist, so the post-deploy template rewrite is unnecessary.
7. Invalidate the deployment's persisted catalogue, appearance, and PDF-template
   caches before routing traffic to the new database. A database URL change or
   ordinary redeploy alone does not guarantee cached data from the previous
   target is gone. Verify the empty catalogue and current settings through the
   deployed application before releasing traffic.

The fresh-database choice does not authorize deleting another database, its
backups, or document/media blobs. Keep any required rollback material outside
the active application; do not leave two deployments writing competing copies.

## Safe data sequence

The canonical schema deliberately keeps article- and variant-level shipping
measurements nullable. This avoids inventing values or turning an unresolved
measurement into zero. The application then applies the rollout in this
order:

1. Install the schema with nullable canonical measurements, versioned
   `shipping_settings`, and frozen order shipping snapshots. The settings row
   has a calculation `version` plus a separate admin `revision`, so changing an
   inert draft never invalidates an in-progress checkout.
2. Add actual products through the current catalogue tools. Save only values
   that can be normalized unambiguously to whole grams and positive
   millimetres. A variant value overrides its item value.
3. Review the visible shipping-readiness state in `/admin/artikli` and complete
   unresolved records in their article editor.
4. Publication and purchasing are blocked for newly invalid records. Existing
   unresolved records produce `Poštnina po dogovoru`; they never receive a zero
   shipping fallback.
5. Only after an operational audit shows no unresolved physical articles may a
   separately coordinated deployment tighten database nullability. That is not
   part of the initial fresh installation.

The normalization code is unit-based, not SKU-based: kilograms are multiplied
by 1,000, centimetres by 10, and metres by 1,000 when the source field and unit
are structured and unambiguous. Conflicting representations are reported for
review instead of choosing one silently.

## Shipping configuration activation

The seeded settings contain two active weight bands: 1–4,999 g at €3.00 and
5,000–30,000 g at €10.00. Higher or uncovered weights require a manual quote.
The suggested `> 1000 mm` dimensional rule is present but disabled and has no
amount. It cannot be enabled until an administrator chooses a fixed or
percentage surcharge.
The default multi-package rule discounts shipping by 50% from two packages.
Review these operational defaults before accepting actual orders; they are not
a substitute for Atehna's approved shipping prices.

Submitted orders retain their stored configuration version, measurements,
automatic calculation, optional override, and final amount. Configuration or
catalogue edits affect draft carts and reorders only.

Every server quote also carries an opaque fingerprint of the selected variants,
quantities, canonical measurements and prices, customer pricing context,
shipping configuration, calculation, and totals. Submission recomputes and
compares that fingerprint before inserting an order, so a catalogue edit made
after the customer saw the quote returns the updated quote for confirmation.

Operational item or shipping changes advance the order's pricing revision.
Generated documents capture that revision and only matching documents are
treated as active in lists, downloads, confirmation, archive restore, and
school purchase-order evidence. Financial PDFs are generated from the locked
order snapshot; opaque administrator uploads are accepted only as external
purchase-order evidence.
