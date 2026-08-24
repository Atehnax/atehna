# GURS Register naslovov

Checkout address suggestions are served from the application's existing
PostgreSQL database. Customer keystrokes never query GURS directly.

## Official source

- Dataset: <https://podatki.gov.si/dataset/register-naslovov>
- Bulk-download application: <https://ipi.eprostor.gov.si/jgp/data>
- Data structure: <https://www.e-prostor.gov.si/fileadmin/struktura/RN/Struktura_RN.xlsx>
- WFS endpoint: <https://ipi.eprostor.gov.si/wfs-si-gurs-rn/wfs>
- Collection: `SI.GURS.RN:REGISTER_NASLOVOV`

The official catalogue does not currently document a stable unattended bulk
CSV URL. The synchroniser therefore uses the official WFS 2.0 service and CSV
responses. It requests 20,000 building addresses per page, excludes apartment
records with `ST_STANOVANJA IS NULL`, sorts by `EID_HISNA_STEVILKA`, and uses
that string identifier as the keyset cursor.

Only checkout fields are retained. Geometry, coordinates, apartment records,
and unrelated register attributes are not stored.

## Database schema

Fresh database setup includes the GURS section in the canonical
`database/schema.sql`. It adds:

- the active `gurs_addresses` search table and PostgreSQL `pg_trgm` index;
- synchronisation state and run-history tables;
- address provenance and optional delivery-detail fields on `orders`.

The schema does not embed a stale copy of the national register. After creating
a fresh database, run `npm run addresses:sync` and wait for the validated staging
dataset to publish before exposing checkout. The monthly protected job then keeps
that active dataset current.

GURS identifiers are stored as PostgreSQL `text` and remain JavaScript strings.
They must never be converted to numbers.

A safe refresh temporarily needs enough database capacity for the active and
staging datasets and their indexes. Monitor PostgreSQL/Neon storage headroom.

## Monthly schedule and manual refresh

Vercel Cron calls the protected route on the first day of every month at 02:00
UTC:

```text
0 2 1 * *
```

The route requires the production `CRON_SECRET` bearer token. To run the same
synchroniser manually from a checkout with database environment variables:

```bash
npm run addresses:sync
```

The manual command loads the normal Next.js environment files. It does not
require a running web server.

## Publication and recovery

Each run:

1. acquires an expiring database lease so concurrent imports cannot run;
2. downloads and inserts one WFS page at a time into a generated staging table;
3. retries temporary source failures a limited number of times;
4. validates a plausible total of 400,000–800,000 records, required values,
   and unique GURS identifiers;
5. creates and analyses the search indexes;
6. replaces the active table in one short database transaction;
7. records the result, count, source timestamp, and completion time.

The active table is never emptied before validation. A download, parse,
database-capacity, or validation failure drops only that run's staging table,
records the error, and leaves the previous active data available to checkout.

Recovery is normally just:

1. inspect the latest `gurs_address_sync_runs.error_message` and platform logs;
2. resolve source, database, secret, duration, or storage issues;
3. run `npm run addresses:sync` again.

Do not truncate `gurs_addresses` as a recovery step. A later successful run
publishes a complete replacement. Expired leases and abandoned generated
staging tables are cleaned by the next run.

## Search and checkout behaviour

`GET /api/addresses/search?query=<text>` requires at least three normalised
characters and returns at most eight compact results. Successful responses are
cached at the CDN. The search is diacritic-insensitive and ranks exact and
prefix matches ahead of fuzzy matches.

Checkout remains usable with manual address entry when the search endpoint or
the local reference table is unavailable. An official match records provenance
but is not treated as proof that a courier can deliver to the address. On order
submission, the server resolves a supplied GURS identifier again and stores a
canonical text snapshot; manual addresses continue through the existing
validation flow.

The UI displays the attribution with the active dataset timestamp:

```text
Vir: Geodetska uprava Republike Slovenije, Register naslovov, stanje [datum podatkov].
```
