# Shipping rollout

The application uses one canonical clean-slate schema. It does not run schema
upgrades against an existing database. A deployment that introduces shipping
calculation must therefore install the current `database/schema.sql` into the
new database before the new application build receives traffic, following the
fresh-database process in `README.md`.

## Safe data sequence

The canonical schema deliberately keeps article- and variant-level shipping
measurements nullable. This avoids inventing values or turning an unresolved
legacy measurement into zero. The application then applies the rollout in this
order:

1. Install the schema with nullable canonical measurements, versioned
   `shipping_settings`, and frozen order shipping snapshots. The settings row
   has a calculation `version` plus a separate admin `revision`, so changing an
   inert draft never invalidates an in-progress checkout.
2. Import or save only values that can be normalized unambiguously to whole
   grams and positive millimetres. A variant value overrides its item value.
3. Review the visible shipping-readiness state in `/admin/artikli` and complete
   unresolved records in their article editor.
4. Publication and purchasing are blocked for newly invalid records. Existing
   unresolved records produce `Poštnina po dogovoru`; they never receive a zero
   shipping fallback.
5. Only after an operational audit shows no unresolved physical articles may a
   separately coordinated deployment tighten database nullability. That is not
   part of version one because the current catalogue still has unresolved data.

This repository does not ship an in-place shipping migration. For a disposable
development database whose commerce data may be erased, first run the guarded
dry run:

```powershell
node --env-file=.env.local scripts/reset-commerce-database.mjs
```

The script reports the exact target and row counts without changing data. Its
`--verify-build` mode installs the canonical schema in an isolated temporary
schema, validates every replacement table, and rolls the transaction back. Its
`--execute` mode requires both `ATEHNA_ALLOW_COMMERCE_RESET=1` and an exact
`ATEHNA_COMMERCE_RESET_TARGET=<host>/<database>` confirmation. It atomically
replaces only catalogue, order, shipping, archive, analytics, and website-event
tables from the canonical schema. Site and appearance settings, order-email
configuration, audit history/settings, school/customer directories, GURS
addresses, document-scene revisions, and the archive Blob cleanup outbox remain
in place. Existing sequence high-water marks and shipping version/revision
numbers move forward so preserved audit history and stale quotes cannot collide
with newly created records. PostgreSQL's default restricted drop behavior makes
an unexpected cross-scope dependency abort the transaction instead of
cascading into preserved data.

For a production database that must retain commerce data, provision a new
database or database branch, install `database/schema.sql`, import only audited
canonical records, verify readiness, and cut over atomically. Do not run the
destructive reset or point the new build at an old schema.

## Audited seed conversions

The fixture's plate masses are stored by the older editor in kilograms. Their
structured dimensions make the following conversions unambiguous, and the E2E
fixture now stores canonical shipping values without changing the legacy source
fields:

| Variant SKU | Weight | Length × width × height |
| --- | ---: | --- |
| `MAT-KOV-ALU-100` | 14 g | 100 × 100 × 0.5 mm |
| `MAT-KOV-ALU-200` | 54 g | 200 × 200 × 0.5 mm |
| `MAT-KOV-ALU-300` | 162 g | 300 × 200 × 1 mm |
| `MAT-KOV-BAK-100` | 45 g | 100 × 100 × 0.5 mm |

`MAT-LET-JEK-300` has an unambiguous 75 g weight but no trustworthy length,
width, or height. Those dimensions remain null. The article must remain visibly
unresolved and use the manual-quote path until an administrator supplies real
measurements.

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
