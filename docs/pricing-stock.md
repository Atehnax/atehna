# Cene in zaloga

`/admin/artikli?view=pricing-stock` opens the per-SKU workspace. The existing article list remains available through the other tab. Search, header filters, optional columns, selection, and the unsaved-changes bar operate on actual `catalog_item_variants` IDs. SKU is a display/audit value, not the persistence key: it can change and is not a database primary key.

## Source of truth

The workspace reuses the catalogue's existing `price` (selling price without VAT), nullable `cost_net` (current acquisition cost without VAT), and integer `inventory`. It does not create another stock or purchase-price source. Existing discounts, order prices, and submitted order-cost snapshots are not recalculated when the model or current acquisition cost changes.

The additive variant fields are `work_minutes numeric(12,4)`, `other_costs numeric(12,2)`, `purchase_updated_at timestamptz`, and separate bigint `stock_revision` / `pricing_revision` counters. Existing acquisition timestamps stay NULL because the installation date is not evidence of when a historical purchase cost was entered. A new acquisition cost or a later actual change sets its timestamp; changing only the selling price does not.

Unknown purchase cost, time, or other costs stay NULL. Explicit zero remains zero. Clearing the canonical selling price is rejected because `price` is required; calculator inputs can still represent missing imported prices. Negative editable prices, costs, time, and stock are rejected. Selling below acquisition cost is valid and produces negative RVC.

`inventory` already represents stock available to a new order: committing a durable order hold subtracts it, and releasing that hold adds it back once. Both the editable **Zaloga** value and optional **Razpoložljivo** value use this number directly. Never subtract held quantities again. Optional **Rezervirano** counts durable holds on active, unfulfilled orders; fulfilled/cancelled holds are excluded. Partly shipped, legacy-unknown, or identifiable untracked reservations return unknown with an explanation instead of a fabricated zero. This feature does not reinterpret old weight-group JSON as an independent warehouse ledger.

## TDABC model

The default capacity rate is:

```text
(headcount × employeeCost + fixedCosts + targetProfit)
÷ (headcount × availableHours × utilizationFraction)
```

The default target RVC per unit is:

```text
otherCosts + (workMinutes ÷ 60) × capacityRate
```

Initial parameters are 5 employees, €2,650 monthly cost per employee, 128 available hours per employee, 75% utilization, €2,400 fixed monthly costs, €2,000 target monthly profit, and a 120% adequacy threshold. Target profit is a managerial extension of TDABC, rather than a claim that RVC itself is profit. The model never automatically changes selling prices; applying recommended prices is an explicit, previewed edit that still requires saving.

Allowed variables are:

| Variable | Value |
| --- | --- |
| `število_zaposlenih` | Headcount |
| `mesečni_strošek_zaposlenega` | Monthly employee cost |
| `razpoložljive_ure_na_zaposlenega` | Available hours per employee |
| `izkoriščenost` | Fraction: 75% is **0.75**, not 75 |
| `fiksni_stroški` | Fixed monthly costs |
| `ciljni_dobiček` | Target monthly profit |
| `čas_artikla_v_minutah` | Work minutes per unit |
| `drugi_spremenljivi_stroški_artikla` | Other variable costs per unit |
| `nabavna_cena` | Current acquisition cost without VAT |
| `prodajna_cena` | Catalogue selling price without VAT |

The parser accepts decimal literals, unary signs, `+ - * /`, parentheses, and `abs`, `min`, `max`, `round`. Function arguments use semicolons so Slovenian decimal commas remain unambiguous, for example `max(1,5; 2)`. `round` accepts 0–6 decimal places. There is no JavaScript, `eval`, dynamic function construction, or expression interpolation into SQL. Unknown variables, invalid syntax, constant/known-input division by zero, invalid capacity/percentages, and bounded-complexity violations are rejected. Missing row inputs are allowed, but they do not mask a known error elsewhere in the expression.

The shared pure domain implementation uses exact rational arithmetic from decimal strings, with no binary floating-point calculation or intermediate rounding. Persisted/API money is normalized to two places; work time to four places; capacity-rate output to six places. Rounding is half away from zero. Money is bounded by `numeric(12,2)`, work by `numeric(12,4)`, and inventory by nonnegative PostgreSQL integer capacity. Additional expression magnitude/size limits prevent unbounded calculations.

Derived values are calculated, never stored:

- RVC = selling price − acquisition cost.
- RVC % = RVC ÷ selling price × 100, only for a positive denominator.
- Difference = RVC − target RVC.
- Coverage = RVC ÷ target RVC × 100, only for a positive target.
- Recommended price = acquisition cost + target RVC.

Coverage below 100% is **Pod pragom**, 100% through below the configurable adequacy threshold is **Na meji**, and coverage at or above that threshold is **Ustrezno**. Missing required inputs or a nonpositive target give **Ni podatkov** for coverage. Status classification uses exact values before display rounding.

## Save, concurrency, and audit

The model is stored separately in `pricing_stock_model`, with formula language version 1 and a monotonically increasing model revision. Formula/parameter saves require that exact model revision. Row saves require the model revision used to review the result and the relevant SKU revision: stock edits check `stock_revision`; price, purchase, time, and other-cost edits check `pricing_revision`. A checkout stock change therefore does not invalidate an unrelated price-only edit, and that price edit never writes inventory.

The batch endpoint accepts at most 500 distinct rows and a 256 KiB body. It validates the whole request and proposed calculations, locks the model and relevant policy row, then locks parent articles and variants in stable ID order. All rows commit together. If both the model and rows have unsaved changes, one PATCH includes the optional proposed model and validates it against the final patched values plus every other SKU. The model revision, model audit, row changes, and row audits commit together; row audits reference the new model revision. A conflict or invalid result leaves both the model and rows unchanged. A global model save briefly locks catalogue writes while checking all SKUs; ordinary row-only saves keep their narrower row locks. A stale row rejects the whole batch with HTTP 409 and current affected rows; the UI retains unsaved edits so the administrator can review and rebase them explicitly. The stock-policy toggle disables stock editing on this workspace and is also enforced under a database lock.

Database triggers advance revisions for every writer, including existing checkout/hold code, so changing a value away and back still invalidates an old revision. The existing full article editor and quick editor also check revisions. Their hydration reads canonical prices and stock over stale presentation JSON, including distinct weight-SKU stock; explicit weight-group edits still apply deliberately.

`pricing_stock_history` is mandatory and independent of the optional general audit toggle. It stores old/new values, revision, SKU, entity identity, time, source, actor/request context, and model revision where applicable. New workspace and article API mutations set administrator context inside the same transaction. Other database writers are marked `database`; existing durable stock holds retain their own actor and order evidence. History identifiers are snapshots rather than cascading foreign keys, so later article deletion does not erase evidence. General article audit behavior remains available separately.

## Access and API

The application currently has one authenticated administrator identity, with no separate role hierarchy. The feature declares `viewCosts`, `editCosts`, `editPrices`, `editStock`, and `editModel` capability boundaries without inventing roles. Stock-policy state is separate from permission so an authorized administrator can turn it back on.

Both route-level session checks and mutation origin checks run before database access. Responses use private `no-store` caching. Unauthorized requests cannot retrieve acquisition costs or calculated rows.

- `GET /api/admin/pricing-stock`: rows, saved model, stock-policy state, and capabilities.
- `PATCH /api/admin/pricing-stock`: explicit per-row patches, expected model revision, relevant row revisions, and optional proposed `model`; atomic result or current-row conflict response.
- `PUT /api/admin/pricing-stock/model`: validated model and expected revision.

## Installation and rollback

For an existing v4 database, apply these files explicitly and in order before deploying code that reads the new fields:

1. `database/migrations/20260906_pricing_stock.sql`
2. `database/migrations/20260906_schema_contract_v5.sql`
3. Run `node scripts/check-database-schema.mjs --require-database` against the intended database.

The additive migration is transactional and repeatable. It preserves existing catalogue/order data and never resets an existing saved model. There is no automatic DDL during builds, requests, or startup. `database/schema.sql` is only for a new, empty database.

Rollback normally means restoring the previous application deployment while leaving the additive columns, model, revisions, and history intact. Existing price/cost/inventory columns retain their original meaning, and the earlier v4 ledger entry remains. Do not drop history or restore an old database snapshot merely to undo the UI deployment. Reversing actual financial/stock edits requires reviewed compensating changes that account for intervening orders; a blanket stock restoration can overwrite sales. If the migration transaction fails, its DDL is rolled back and must be diagnosed before deploying dependent code.

## Verification

The focused unit suites cover exact calculations, four statuses, decimal input and rounding, blank versus zero, formula attacks/invalid inputs, batch editing/paste, private authorization, and canonical editor handoff.

`node --conditions=react-server --import tsx scripts/check-pricing-stock-database.ts` uses the repository's explicit, guarded loopback E2E environment. It verifies actual competing stock/price transactions, stale and ABA conflicts, atomic rollback, mandatory history with general audit disabled, timestamps, model CAS/row-dependent errors, stock policy, historical order costs, and hold replay/release.

`node --import tsx scripts/check-pricing-stock-upgrade.ts` uses the same in-memory E2E configuration only to locate the reviewed local PostgreSQL service. It creates a unique sibling upgrade database, installs the pre-feature HEAD schema and deterministic fixtures, applies the additive migration twice and the v5 terminal verifier, compares original row fingerprints/counts, checks purchase timestamps and order history, and runs the live schema contract. It drops only the exact database OID created by that run. It never connects to or changes the existing E2E application database, never reads `.env` files, and refuses remote databases. By default HEAD must still be the pre-feature schema baseline. After committing, pass `--baseline <reviewed-full-pre-feature-commit-SHA>`; the script still refuses a baseline that already contains this feature.
