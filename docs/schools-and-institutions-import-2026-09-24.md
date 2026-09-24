# Schools and institutions — import and email consolidation, 24 September 2026

## Current state: all-institutions view, grouped tabs and abbreviated names

The page remains `/admin/stranke/sole-in-zavodi`, under the shortened top-level **Stranke** label. Its first and default tab is **Vsi seznami**, displaying all 1,554 institutions once. The two special-needs source lists share the **Posebne potrebe** tab, containing 41 rows. The two kindergarten directories remain consolidated as **Vrtci**. Public/private prefixes have been removed from Dijaški domovi, Glasbene šole and Vrtci.

The shorter **Izobraževanje odraslih** tab displays the full title **Organizacije za izobraževanje odraslih** when selected. Selecting Posebne potrebe displays both full source titles: **Osnovne šole za otroke s posebnimi potrebami** and **Zavodi za otroke in mladostnike s posebnimi potrebami**. The old primary-school route, saved `vrtci-z-enotami` links and either old special-needs tab link continue to resolve to the current page/view.

| Current view | Rows |
| --- | ---: |
| Vsi seznami (first/default) | 1,554 |
| Osnovne šole | 452 |
| Dijaški domovi | 15 |
| Glasbene šole | 67 |
| Vrtci | 684 |
| Srednje šole | 165 |
| Višje strokovne šole | 52 |
| Izobraževanje odraslih | 78 |
| Posebne potrebe | 41 |

Vsi seznami and Posebne potrebe are views over the existing source records. They do not create duplicate copies. Edits are routed back to each original directory using namespaced row/column identities; batch changes spanning sources are atomic. The nine underlying stored directories and their existing IDs remain unchanged.

The current local dataset contains **1,554 rows**, down from **2,549**. **995 duplicate rows** were consolidated in **459 shared-email groups**. All **326 rows without email addresses** remain separate. The original import files and raw seeds remain unchanged.

### Stored directories after consolidation

These are persistence/source counts, distinct from the nine presentation views above. Posebne potrebe combines the final two sources; Vsi seznami combines all nine.

| Stored directory | Rows |
| --- | ---: |
| Osnovne šole | 452 |
| Dijaški domovi | 15 |
| Glasbene šole | 67 |
| Vrtci | 684 |
| Srednje šole | 165 |
| Višje strokovne šole | 52 |
| Organizacije za izobraževanje odraslih | 78 |
| Osnovne šole za otroke s posebnimi potrebami | 28 |
| Zavodi za otroke in mladostnike s posebnimi potrebami | 13 |

Current data: [canonical version-three seed](../src/shared/data/schools-and-institutions-seed.json). Traceability: [email consolidation audit](../data/imports/schools-and-institutions-2026-09-24/email-consolidation.json), including a mapping for every original row, complete merged source snapshots, alternate names and conflicting scalar values.

### Matching and retention rules

Matching is case-insensitive on individual email addresses, splitting multi-address cells by separators. A shared address joins rows into one connected group, including transitive links: A shares an address with B, and B shares another with C. Every distinct email and contact value is retained. Different names, registration identifiers or addresses do not independently trigger a merge. Rows whose email groups are disconnected remain separate, even if their names or legal identifiers match. Empty or syntactically unusable values never match each other.

Existing **Osnovne šole** records take priority when present. Otherwise the actual school/institution category wins over a kindergarten or dormitory entry: in particular, **Srednje šole** retains shared-email secondary-school/dormitory records. The deterministic priority among categories already represented in a group is: Osnovne šole; special-needs primary schools; Srednje šole; Višje strokovne šole; adult-education organisations; special-needs institutes; Glasbene šole; Vrtci; Dijaški domovi. No primary-school classification is invented for a secondary-only group.

Six pairs of existing primary-school records share email addresses, so that tab has **452 instead of 458 rows**. Five pairs are connected through a personal staff address: Prule/Otočec, Janka Ribiča Cezanjevci/Stročja vas, Jakobski Dol/Jožeta Hudalesa Jurovski dol, Košana/Prestranek, and dr. Jožeta Pučnika Črešnjevec/Gustava Šiliha Laporje. Preserje/Preserje pri Radomljah shares an institutional address directly. These follow the requested email rule; the audit preserves both original identities and all contact values for each pair.

No DNS or mailbox-deliverability correction is inferred. Fifteen source entries containing the identical recorded address `info@vrtec.slo-bistrica` consolidate to one Vrtci record, retaining that exact address. A missing suffix is not guessed or appended. Singleton rows retain their original cell formatting except for the separately requested institution-name abbreviation described below.

### Institution-name abbreviations

The complete phrase **Osnovna šola** is now abbreviated to **OŠ**, case-insensitively, in individual institution names across all directories. The rule includes uppercase OSNOVNA ŠOLA and leaves proper names, inflected phrases, contacts, row IDs, categories and ordering intact. **144 stored names** changed locally: 13 ordinary-primary, 105 kindergarten, one adult-education, 24 special-needs-primary and one special-needs-institute name. The combined special-needs view still contains 41 entries, of which 25 required this abbreviation.

The canonical seed uses the same reusable normalization helper. The [separate name-normalization audit](../data/imports/schools-and-institutions-2026-09-24/name-normalization.json) records every before/after name. The raw archives, email-consolidation mappings and merged-source snapshots retain their earlier content; only the canonical-seed metadata now points to the updated names.

The change was applied only to the local database, with a [before backup](../output/institutions/2026-09-24-names/applied/before.json), [plan](../output/institutions/2026-09-24-names/applied/plan.json) and [application receipt](../output/institutions/2026-09-24-names/applied/result.json). It did not change the row count, contacts or email-consolidation outcome.

### Current local verification and backup

The live local database has been consolidated transactionally. The [application receipt](../output/institutions/2026-09-24-email/applied/result.json), [before backup](../output/institutions/2026-09-24-email/applied/before.json), and [full applied plan](../output/institutions/2026-09-24-email/applied/plan.json) are saved locally. A second run reports `changed: false` in the [idempotence receipt](../output/institutions/2026-09-24-email/idempotence/result.json).

[Authenticated API verification of consolidation](../output/institutions/2026-09-24-email/live-verification.json) confirmed all nine source directories matched the then-current canonical seed and all **1,473 distinct recorded email addresses appeared exactly once**. The later name-only update leaves those email and identity results unchanged. The current revision passes TypeScript and **53 focused unit tests**, covering the consolidated datasets, aggregate views, source routing, names and existing directory behavior. The earlier browser-test result below belongs to the initial import and does not attest to this view/name revision.

**Production has not changed.** No release or remote database mutation is included in this local consolidation.

### Rebuild seeds and consolidate an existing database

The source pipeline is: original `.xls` exports → unchanged raw importer output → email consolidation → canonical name normalization. The canonical seed builder performs the latter two steps deterministically, writes their separate audits, and does not contact or write a database:

```powershell
python -X utf8 scripts/import-institution-directories.py --source-dir "C:/Users/wfqfw/Downloads" --check
npx tsx scripts/build-consolidated-institution-seed.ts
npx tsx scripts/build-consolidated-institution-seed.ts --check
```

For an existing database, first install the institution-directories schema and initialize the original directories, then explicitly set `DATABASE_URL` to the intended target. The runner is a dry run unless `--apply` is supplied. Use a **new output directory for each run**; exclusive backup creation prevents overwriting an earlier backup:

```powershell
npx tsx scripts/consolidate-institution-directories.ts --output output/institutions/consolidation-review
npx tsx scripts/consolidate-institution-directories.ts --output output/institutions/consolidation-apply --apply
```

The runner uses a consistent snapshot, writes a complete backup and plan before mutation, locks affected tables for an apply operation, preserves contact information and canonical row IDs, remaps any affected order-to-school references, verifies the saved data, and commits atomically. Failures roll back database changes. It consolidates the database's current edited values; it does not overwrite them from the raw import or seed.

### Production release against existing edited records

Use `scripts/release-institution-directories.ts` for the combined release. It reads the current saved primary schools and any existing institution documents. It imports archived rows only for missing source documents, then performs the authorized email consolidation and name abbreviation together. It must run before the new application can lazily initialize institution documents from the canonical development seed. This avoids suppressing raw import candidates whose email differs from a production-edited primary school.

The additive schema migration is a separate prerequisite and leaves schools, customers and orders unchanged:

```powershell
node scripts/migrate-institution-directories.mjs
node scripts/check-database-schema.mjs --require-database
```

Set `DATABASE_URL` explicitly to the intended database, with the existing verified TLS configuration. Supply the expected hostname and database name as separate arguments; both must match the connection URL. Do not substitute a local database URL or a canonical seed for the live data. Review a dry run first:

```powershell
npx tsx scripts/release-institution-directories.ts --expected-host <host> --expected-database <database> --output output/institutions/release-review
```

The dry run performs no database writes. It saves the complete live snapshot, raw-source fingerprint, proposed directories, row mappings, conflicts, name changes and order-link changes. Its receipt supplies `planSha256`. Applying requires that exact reviewed fingerprint and a new backup directory:

```powershell
npx tsx scripts/release-institution-directories.ts --expected-host <host> --expected-database <database> --output output/institutions/release-apply --apply --plan-sha256 <reviewed-plan-sha256>
```

The apply transaction locks the affected tables, rereads the live snapshot and recomputes the complete plan. Any intervening edit, changed source archive or different plan aborts before data writes. Backups use exclusive creation so earlier backups cannot be overwritten. The transaction preserves current user edits as inputs, remaps existing order links to surviving primary-school IDs, verifies saved rows and links, and rolls back on failure. Customer records are not modified.

Existing empty documents are retained; an existing version-three Vrtci document also prevents the retired `vrtci-z-enotami` archive from being reintroduced. A subsequent plan is a no-op. Production counts may differ from the local counts above if its saved data differs, so compare the reviewed live plan rather than forcing development totals.

### Normalize names in the isolated local database

The separate name-maintenance runner changes only `naziv` values and requires an explicitly selected localhost database on port 55434 with an `atehna_e2e_` database name. It refuses production targets. It defaults to a read-only database plan, creates a complete backup in a new directory, and applies transactional updates only with `--apply`:

```powershell
npx tsx scripts/normalize-institution-names.ts --output output/institutions/names-review
npx tsx scripts/normalize-institution-names.ts --output output/institutions/names-apply --apply
```

Set the intended local `DATABASE_URL` explicitly before these commands. Existing-directory names are normalized from current saved values, without reseeding or replacing user edits.

## Historical initial import (before email consolidation)

The remaining sections document the original ten-tab import and its verification. Their overlap counts describe the archived source data, not the current consolidated table.

Audit files: [source provenance](../data/imports/schools-and-institutions-2026-09-24/source-provenance.json), [all overlap groups](../data/imports/schools-and-institutions-2026-09-24/overlaps.json), and [primary comparison snapshot](../data/imports/schools-and-institutions-2026-09-24/primary-comparison-snapshot.json).

The initial import added **2,091 rows in nine directories**. At that stage, the existing primary-school rows were unchanged, and all cross-tab overlaps were retained for review. This is the historical source archive; the current nine-tab result is described above.

| Directory | Imported rows |
| --- | ---: |
| Javni in zasebni dijaški domovi | 35 |
| Javne in zasebne glasbene šole | 67 |
| Javni in zasebni vrtci z enotami | 1188 |
| Javni in zasebni vrtci | 415 |
| Srednje šole | 190 |
| Višje strokovne šole | 59 |
| Organizacije za izobraževanje odraslih | 94 |
| Osnovne šole za otroke s posebnimi potrebami | 28 |
| Zavodi za otroke in mladostnike s posebnimi potrebami | 15 |

### Historical source handling

The `.xls` attachments are HTML table exports, not binary Excel workbooks. Seven contain ASCII plus HTML entities; the two kindergarten files also use literal Windows-1250 characters. Identifiers, postcodes, phone numbers and bank accounts stay strings. The 14 columns and their order exactly match `schools-seed.json`.

Dijaški domovi, Srednje šole and Organizacije za izobraževanje odraslih supply regions as section headings; these are copied into the region field. Missing municipality, tax/account and contact-person details are left blank. FAX, private/legal status, kindergarten-at-primary-school and secondary-program flags are preserved in `source-provenance.json`, alongside every source row and source link. No missing fields were guessed.

Source files were not modified. SHA-256 hashes, source row numbers and decoding details are recorded in `source-provenance.json`.

### Historical overlaps before consolidation

Comparison uses the supplied files and a preserved snapshot of the existing local primary-school table captured before this import. Its 458 row IDs match the seed, but 438 rows have different current display values (mostly shortened school names); those current values are used here. Counts below are row pairs across different tabs, not counts to delete. Several branches can correctly share registration roots, tax IDs or accounts.

| Tab A | Tab B | Same ZAVSIF | Same full PRSMSS | Same normalized name | Name-only candidates | Related-entity pairs only |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Javni in zasebni dijaški domovi | Javne in zasebne glasbene šole | 0 | 0 | 0 | 0 | 1 |
| Javni in zasebni dijaški domovi | Osnovne šole | 0 | 0 | 0 | 0 | 1 |
| Javni in zasebni dijaški domovi | Srednje šole | 20 | 20 | 20 | 0 | 25 |
| Javni in zasebni dijaški domovi | Višje strokovne šole | 0 | 0 | 0 | 0 | 8 |
| Javni in zasebni dijaški domovi | Javni in zasebni vrtci | 0 | 0 | 0 | 0 | 1 |
| Javni in zasebni dijaški domovi | Javni in zasebni vrtci z enotami | 0 | 0 | 0 | 0 | 1 |
| Javne in zasebne glasbene šole | Osnovne šole | 0 | 0 | 0 | 0 | 1 |
| Javne in zasebne glasbene šole | Srednje šole | 0 | 1 | 0 | 0 | 1 |
| Javne in zasebne glasbene šole | Javni in zasebni vrtci | 0 | 0 | 0 | 0 | 1 |
| Javne in zasebne glasbene šole | Javni in zasebni vrtci z enotami | 0 | 0 | 0 | 0 | 1 |
| Organizacije za izobraževanje odraslih | Osnovne šole | 0 | 0 | 0 | 0 | 1 |
| Organizacije za izobraževanje odraslih | Srednje šole | 0 | 0 | 0 | 0 | 16 |
| Organizacije za izobraževanje odraslih | Višje strokovne šole | 0 | 0 | 0 | 0 | 28 |
| Organizacije za izobraževanje odraslih | Javni in zasebni vrtci z enotami | 0 | 0 | 0 | 0 | 2 |
| Osnovne šole | Srednje šole | 0 | 0 | 0 | 0 | 2 |
| Osnovne šole | Javni in zasebni vrtci | 207 | 207 | 4 | 0 | 2 |
| Osnovne šole | Javni in zasebni vrtci z enotami | 0 | 0 | 0 | 0 | 340 |
| Osnovne šole | Zavodi za otroke in mladostnike s posebnimi potrebami | 0 | 0 | 0 | 0 | 1 |
| Osnovne šole za otroke s posebnimi potrebami | Javni in zasebni vrtci | 5 | 5 | 5 | 0 | 0 |
| Osnovne šole za otroke s posebnimi potrebami | Javni in zasebni vrtci z enotami | 0 | 0 | 0 | 0 | 8 |
| Srednje šole | Višje strokovne šole | 0 | 0 | 0 | 0 | 90 |
| Srednje šole | Javni in zasebni vrtci | 0 | 0 | 0 | 0 | 2 |
| Srednje šole | Javni in zasebni vrtci z enotami | 0 | 0 | 0 | 0 | 2 |
| Srednje šole | Zavodi za otroke in mladostnike s posebnimi potrebami | 0 | 0 | 0 | 0 | 2 |
| Višje strokovne šole | Javni in zasebni vrtci z enotami | 0 | 0 | 0 | 0 | 6 |
| Javni in zasebni vrtci | Javni in zasebni vrtci z enotami | 203 | 203 | 204 | 1 | 981 |
| Javni in zasebni vrtci | Zavodi za otroke in mladostnike s posebnimi potrebami | 0 | 0 | 0 | 0 | 1 |
| Javni in zasebni vrtci z enotami | Zavodi za otroke in mladostnike s posebnimi potrebami | 0 | 0 | 0 | 0 | 2 |

The main repeated registry-code pairs are **207** between Osnovne šole and Javni in zasebni vrtci; **203** between the two kindergarten tabs; **20** between dijaški domovi and Srednje šole; and **5** between special-needs primary schools and Javni in zasebni vrtci. There is additionally **one full-PRSMSS match** between a music school and a secondary school, and **one name-only candidate** between the kindergarten tabs with different registry identifiers. These were historical review candidates. The current consolidation uses shared email addresses, not registry-code or name matching.

All individual matches and within-tab repetitions are listed in `overlaps.json`. Exact ZAVSIF/full PRSMSS/name matches are separated from weaker shared-entity evidence; no merging or removal was performed during that initial import. The separate consolidation audit now records the authorized merges.

### Reproduce / verify the raw import

```powershell
python -X utf8 scripts/import-institution-directories.py --source-dir "C:/Users/wfqfw/Downloads"
python -X utf8 scripts/import-institution-directories.py --source-dir "C:/Users/wfqfw/Downloads" --check
```

The importer uses the Python standard library only, rejects unexpected schemas or changed snapshot counts, checks globally unique row IDs (maximum 80 characters), and supports a deterministic read-only `--check` run.

### Historical website implementation and initial local verification

The new admin page is /admin/stranke/sole-in-zavodi. The previous /admin/stranke/sole URL redirects there. Osnovne šole keeps the existing 458 records and primary-school persistence unchanged; the nine new lists have isolated editable storage. Every tab reuses the standard school table and 14-column schema. Active tabs are addressable through the tab query parameter. Unsaved row edits are protected when switching tabs.

The initial, pre-consolidation release verified all ten datasets, edit/reload persistence, cross-directory isolation, navigation, mobile layout, authorization and invalid-directory handling. All 4 browser tests and 42 focused unit checks passed, along with TypeScript, targeted ESLint and schema-contract verification. Development-server compilation caused early test delays; the final complete browser run passed unchanged assertions. Temporary test records were removed.

The additive institution_directories migration was applied only to the isolated local database. Production remains unchanged. Before deploying this release, apply scripts/migrate-institution-directories.mjs against the explicitly selected deployment database. Imported records initialize once per directory and are not recreated after deletion.

## Consolidation browser and code verification

All 37 focused directory, email-consolidation and source/seed tests passed. TypeScript, targeted ESLint and deterministic seed rebuild checks passed. The four browser checks passed: all nine tabs and old URLs, edit/reload persistence and isolated records, unsaved draft protection, mobile keyboard navigation, authorization and invalid IDs. The first development-server navigation exceeded the initial timeout; rerunning that unchanged check after compilation passed in 4.8 seconds. Temporary test records were removed. Desktop and mobile screenshots were reviewed with no page errors or horizontal document overflow. Production remains unchanged.

## Combined-view verification

The current revision passes 53 focused unit checks, TypeScript and targeted ESLint. All five browser scenarios passed, covering the nine views and titles, source-specific editing and unsaved drafts, combined-view edit/add/reload persistence, mobile keyboard navigation, old links and permissions. The first cold-development run exhausted its 120-second budget on initial authentication/API/page compilation; the unchanged navigation test then passed in 7.4 seconds. Desktop and mobile screenshots were visually reviewed without page errors.

An additional live local check added, edited and duplicated temporary records across primary-school and institution storage in Vsi seznami, rejected a stale cross-source deletion atomically, and successfully deleted both sources together. Every original row was restored and the final count remains 1,554. Its receipt is output/institutions/2026-09-24-views/cross-source-verification.json. No production changes were made.
