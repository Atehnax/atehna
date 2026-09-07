# Cene in zaloga

`/admin/artikli?view=pricing-stock` opens the per-SKU pricing and TDABC workspace. Inventory maintenance belongs in **Seznam artiklov**, the other tab. **Zaloga** is absent from the pricing table, its column chooser, filters, column actions, and CSV export. Optional **Rezervirano** and **Razpoložljivo** remain available as read-only information. Search, header filters, optional columns, selection, and the top save/undo controls operate on actual `catalog_item_variants` IDs. SKU is a display/audit value, not the persistence key: it can change and is not a database primary key.

In **Seznam artiklov**, each article row shows the combined stock of its listed variants; expanding the article exposes each SKU's stock. Parent and variant rows share the same table grid, so stock, delivery, price, status, and notes align; variant **Mesto** occupies the parent's **Uredi** column. Variant groups expand and collapse using the same shared 240 ms height and 180 ms opacity transition as the pricing definitions and source-action row. Closed groups leave no table gap and cannot receive focus; reduced-motion preferences disable the transition. Stock inputs appear during explicit quick editing and save through the existing revision-checked workflow; a single-variant article can also edit its stock in the main row. **Dobavni rok** formats saved day quantities as numbers with `d` (for example `2–4 d`), with **Različno** when variants differ and an em dash for missing or non-day estimates. The original estimate remains available in the tooltip. Article and variant names sit above their smaller SKU text, with separate name/SKU inputs only during quick editing. Display and input slots share dimensions and typography to keep row heights and value positions stable between modes. Stock, delivery, and selling-price values use the variant's 12 px type size in both parent and variant rows. Both price headings right-align **Prodajna cena** above the smaller **brez DDV**.

Purchase price, selling price, RVC, work minutes, and target RVC have shared numeric `Od` / `Do` header filters. The RVC filter has a shared **€ / %** selector: euro bounds use RVC, while percentage bounds use the calculated RVC share of the net selling price. Both ranges can be active together, retain their own applied bounds, and have independently removable unit-labelled tags. Switching units does not reinterpret a euro amount as a percentage. Bounds are inclusive, accept Slovenian decimal commas, and are compared exactly; an empty edge is unbounded. Missing values do not match an active range, including a zero bound. Invalid or reversed drafts cannot be applied. Each range can be reset independently and combines with search, category, and coverage filters. Active search, category, numeric-range, and coverage filters appear as the shared removable tags at the left of the top pagination row (for example **Nabavna cena: ≥ 2 €**). Removing a tag clears only that filter. These filters also constrain source-based column actions across pagination and never create data edits.

The TDABC model stays visible. The separate variable definitions open and close with an icon-only eye control, labeled **Prikaži razlago** / **Skrij razlago** for assistive technology; their existing expansion transition remains in place. Model parameters and editable numeric table cells reuse the shared segmented unit input. The model and table reuse the same compact saved/unsaved status, before every button in their action groups; the footer contains pagination only, with synchronized pagination repeated above the table. Both article tabs default to 25 rows per page and offer 25, 50, and 100; the article list also retains its existing All choice and saved valid page-size preferences. The table grows with the visible rows and scrolls internally only when its available height is exhausted. Headers reuse shared typography, adjacent right-hand filters, and an ascending/descending/original-order sorting cycle without arrows. Filter menus flip upward and scroll within the viewport when the model and other content leave too little room below the table header. Missing target inputs are named in the preview and row tooltips; the read-only target cell shows an em dash until its inputs are complete. No blank cost or time is silently replaced with zero.

## Row quick editing

Pricing cells display values by default. In a row's **Uredi** menu (**Možnosti za {sku}**), choose **Hitro urejanje** to open that row's price, cost, and time inputs. Only one row is in quick edit at a time; selection checkboxes and column actions remain separate from edit mode. Read-only rows still show any staged values and their recalculated results. **Delo / kos** displays whole minutes, including untouched quick-edit fields: `3.0000` displays as `3 min`, `3.6000` as `4 min`, and missing time as an em dash. This is presentation rounding only; calculations and saved values retain four decimal places, with the exact fractional value explained in the tooltip. Typed fractions remain visible while typing and round on blur; opening or canceling quick edit does not replace the underlying value with the rounded display.

**Shrani urejanje za {sku}** persists that row through the existing pricing endpoint and revision checks, while preserving drafts on other rows. The top **Shrani spremembe** button remains the explicit save for the combined draft. If the model has unsaved changes, row save is unavailable; save the model first or use the top button to persist the model and affected rows together. **Prekliči urejanje za {sku}** restores the row's draft as it was when quick edit opened, including changes previously staged by a column action or paste. It does not reset the row to an older saved value or discard another row's edits. Switching away from a dirty quick-edit row requires resolving its pending changes. Global **Razveljavi** retains its separate meaning: discard the combined row/model draft.

An Excel paste starts in an active input and can stage values for subsequent filtered rows; it does not open those rows for editing or save them. Likewise, column actions update displayed draft values immediately without changing which row is in quick edit. The table keeps the same column widths and numeric alignment in display and input modes.

## Source of truth

The pricing workspace reuses the catalogue's existing `price` (selling price without VAT) and nullable `cost_net` (current acquisition cost without VAT). The shared service and **Seznam artiklov** reuse the existing integer `inventory`; the pricing API retains that field for stock-aware workflows and optional availability information. There is no second stock or purchase-price source. Existing discounts, order prices, and submitted order-cost snapshots are not recalculated when the model or current acquisition cost changes.

The additive variant fields are `work_minutes numeric(12,4)`, `other_costs numeric(12,2)`, `purchase_updated_at timestamptz`, and separate bigint `stock_revision` / `pricing_revision` counters. Existing acquisition timestamps stay NULL because the installation date is not evidence of when a historical purchase cost was entered. A new acquisition cost or a later actual change sets its timestamp; changing only the selling price does not.

Unknown purchase cost, time, or other costs stay NULL. Explicit zero remains zero. Clearing the canonical selling price is rejected because `price` is required; calculator inputs can still represent missing imported prices. Negative editable prices, costs, time, and stock are rejected. Selling below acquisition cost is valid and produces negative RVC.

`inventory` already represents stock available to a new order: committing a durable order hold subtracts it, and releasing that hold adds it back once. The **Zaloga** value maintained in **Seznam artiklov** and the pricing table's optional read-only **Razpoložljivo** value use this number directly. Never subtract held quantities again. Optional **Rezervirano** counts durable holds on active, unfulfilled orders; fulfilled/cancelled holds are excluded. Partly shipped, legacy-unknown, or identifiable untracked reservations return unknown with an explanation instead of a fabricated zero. This feature does not reinterpret old weight-group JSON as an independent warehouse ledger.

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

Initial parameters are 5 employees, €2,650 monthly cost per employee, 128 available hours per employee, 75% utilization, €2,400 fixed monthly costs, €2,000 target monthly profit, and a 120% adequacy threshold. Target profit is a managerial extension of TDABC, rather than a claim that RVC itself is profit. The model never automatically changes selling prices. The optional recommended-price column is read-only; administrators open row quick edit to enter the chosen selling price and save explicitly.

The monthly inputs describe the team that handles these SKUs. They determine a shared cost per employee-hour; each SKU receives only the cost of its own work time per unit, plus its own other variable costs. For example, 96 hours spent handling items out of 128 available hours gives utilization `96 / 128 * 100 = 75%`; the formula uses the fraction `0.75`. This percentage covers the team's work across all SKUs, not a percentage of one item. Six labor-minutes per unit uses `6 / 60 = 0.1` of the hourly rate. Two employees working three minutes each means six labor-minutes; a batch taking 30 labor-minutes for ten units means three minutes per unit.

The interface presents the current compiled formula as MathML with stacked fractions. Its short editing symbols are `n` (headcount), `c` (employee cost), `h` (available hours), `u` (utilization fraction), `f` (fixed costs), `p` (target profit), `t` (labor-minutes per unit), `v` (other costs per unit), `b` (net purchase price), and `s` (net selling price). Symbols are translated to the existing canonical variable names before validation and persistence; custom formulas render from the same AST used by the calculator. No second formula engine or stored derived value is introduced.

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

Ciljna RVC is read-only because the active formula calculates it. The default formula needs work time and other costs; a missing input leaves the target unknown rather than inventing zero. Explicit zero other costs is valid when that is the actual value. Custom formulas may require different row inputs.

Derived values are calculated, never stored:

- RVC = selling price − acquisition cost.
- RVC % = RVC ÷ selling price × 100, only for a positive denominator.
- Difference = RVC − target RVC.
- Coverage = RVC ÷ target RVC × 100, only for a positive target.
- Recommended price = acquisition cost + target RVC.

Coverage below 100% is **Pod pragom**, 100% through below the configurable adequacy threshold is **Na meji**, and coverage at or above that threshold is **Ustrezno**. Missing required inputs or a nonpositive target give **Ni podatkov** for coverage. Status classification uses exact values before display rounding.

## Column actions from a selected SKU

Exactly one checked row reveals a column-action row directly beneath the table headings. The row stays mounted and expands or collapses smoothly, with the same transition timing as the variable definitions; zero or multiple checked rows leave it hidden and inert. The identity cell names the source; unchecking its checkbox closes the action row without discarding staged edits. Acquisition price, selling price, and labor-minutes have compact 27 × 27 px copy and proportional (∏) buttons with 13.5 px icons. Both actions use the source's current valid draft value, leave the source unchanged, and target all other rows matching the current search, category, numeric ranges, and coverage filters, across pagination. A checked source outside the filters leaves the row visible with disabled actions and an explanatory tooltip.

A single click immediately stages the corresponding column values and recalculates the affected rows. There is no action dialog, field dropdown, or confirmation step. Null and invalid source values disable that column's actions; explicit zero is valid. Proportional estimates require variants of the same article with compatible product type and unit. They use the ratio of complete positive dimensions (length × width × thickness), or net mass for compatible per-piece weight products. Already mass-normalized units such as kg and g are excluded from mass scaling. Unrelated or incomplete rows stay unchanged; column actions do not add a skipped-row dropdown. Work time is a proportional estimate, not a claim that measured labor scales exactly with size.

Calculations use the same bounded exact-decimal primitives as the TDABC service. Money rounds to two places and work time to four, with halves away from zero. Clicking an action does not save: it preserves unrelated drafts and uses the existing explicit Save transaction, permissions, revision checks, and history. The combined draft stays limited to 500 rows; a rejected action preserves the previous draft. Undo discards staged changes. These actions add no database fields or stock system.

## Save, concurrency, and audit

The model is stored separately in `pricing_stock_model`, with formula language version 1 and a monotonically increasing model revision. Formula/parameter saves require that exact model revision. Row saves require the model revision used to review the result and the relevant SKU revision: stock edits check `stock_revision`; price, purchase, time, and other-cost edits check `pricing_revision`. A checkout stock change therefore does not invalidate an unrelated price-only edit, and that price edit never writes inventory.

The batch endpoint accepts at most 500 distinct rows and a 256 KiB body. It validates the whole request and proposed calculations, locks the model, then locks parent articles and variants in stable ID order. All rows commit together. If both the model and rows have unsaved changes, one PATCH includes the optional proposed model and validates it against the final patched values plus every other SKU. The model revision, model audit, row changes, and row audits commit together; row audits reference the new model revision. A conflict or invalid result leaves both the model and rows unchanged. A global model save briefly locks catalogue writes while checking all SKUs; ordinary row-only saves keep their narrower row locks. A stale row rejects the whole batch with HTTP 409 and current affected rows; the UI retains unsaved edits so the administrator can review and rebase them explicitly. Inventory maintenance in **Seznam artiklov** remains available to authorized administrators even when global order stock limiting is disabled. Pricing edits do not change that policy or inventory. Stock-capable APIs and other stock workflows still require the current SKU stock revision and create mandatory audit history.

Database triggers advance revisions for every writer, including existing checkout/hold code, so changing a value away and back still invalidates an old revision. The existing full article editor and quick editor also check revisions. Their hydration reads canonical prices and stock over stale presentation JSON, including distinct weight-SKU stock; explicit weight-group edits still apply deliberately.

`pricing_stock_history` is mandatory and independent of the optional general audit toggle. It stores old/new values, revision, SKU, entity identity, time, source, actor/request context, and model revision where applicable. New workspace and article API mutations set administrator context inside the same transaction. Other database writers are marked `database`; existing durable stock holds retain their own actor and order evidence. History identifiers are snapshots rather than cascading foreign keys, so later article deletion does not erase evidence. General article audit behavior remains available separately.

## Access and API

The application currently has one authenticated administrator identity, with no separate role hierarchy. The feature declares `viewCosts`, `editCosts`, `editPrices`, `editStock`, and `editModel` capability boundaries without inventing roles. Stock-policy state is separate from permission: it controls order limiting, while `editStock` controls maintaining the inventory value.

Both route-level session checks and mutation origin checks run before database access. Responses use private `no-store` caching. Unauthorized requests cannot retrieve acquisition costs or calculated rows.

- `GET /api/admin/pricing-stock`: rows, saved model, stock-policy state, and capabilities.
- `PATCH /api/admin/pricing-stock`: explicit per-row patches, expected model revision, relevant row revisions, and optional proposed `model`; atomic result or current-row conflict response.
- `PUT /api/admin/pricing-stock/model`: validated model and expected revision.

## Installation and rollback

For an existing v4 database, apply these files explicitly and in order before deploying code that reads the new fields:

1. `database/migrations/20260906_pricing_stock.sql`
2. `database/migrations/20260906_schema_contract_v5.sql`
3. `database/migrations/20260907_historical_orders.sql`
4. `database/migrations/20260907_schema_contract_v6.sql`
5. Run `node scripts/check-database-schema.mjs --require-database` against the intended database.

For an existing v5 database, start at step 3. The current application requires the v6 contract, including the historical-order fields.

The additive migration is transactional and repeatable. It preserves existing catalogue/order data and never resets an existing saved model. There is no automatic DDL during builds, requests, or startup. `database/schema.sql` is only for a new, empty database.

Rollback normally means restoring the previous application deployment while leaving the additive columns, model, revisions, and history intact. Existing price/cost/inventory columns retain their original meaning, and the earlier v4 ledger entry remains. Do not drop history or restore an old database snapshot merely to undo the UI deployment. Reversing actual financial/stock edits requires reviewed compensating changes that account for intervening orders; a blanket stock restoration can overwrite sales. If the migration transaction fails, its DDL is rolled back and must be diagnosed before deploying dependent code.

## Verification

The focused unit suites cover exact calculations, four statuses, decimal input and rounding, blank versus zero, formula attacks/invalid inputs, batch editing/paste, private authorization, and canonical editor handoff. Pricing E2E coverage checks that stock controls and the stock CSV column are absent, that price/time column actions preserve inventory and filtered-out rows, and that stock concurrency remains enforced through direct API requests. A real order's stock movement rejects a stale stock batch without blocking an unrelated price-only draft; concurrent price changes retain browser drafts for explicit review.

The dedicated `admin-pricing-stock-quick-edit.spec.ts` mocks all pricing reads and mutations without database fixture hooks. It covers the always-visible model and accessible icon-only explanation toggle, display-first cells, explicit edit entry, one active row, entry-snapshot cancellation, guarded row switching, isolated row saves that preserve other drafts, the combined-save requirement for a dirty model, independent filter-tag removal with actual row filtering, top-pagination tag alignment, and whole-minute display without changing exact work values. Existing persistent-workflow tests enter quick edit explicitly and inspect read-only values after save or reload.

`node --conditions=react-server --import tsx scripts/check-pricing-stock-database.ts` uses the repository's explicit, guarded loopback E2E environment. It verifies actual competing stock/price transactions, stale and ABA conflicts, atomic rollback, mandatory history with general audit disabled, timestamps, model CAS/row-dependent errors, inventory edits with order limiting disabled (including CAS/audit and unchanged policy), historical order costs, and hold replay/release.

`node --import tsx scripts/check-pricing-stock-upgrade.ts` uses the same in-memory E2E configuration only to locate the reviewed local PostgreSQL service. It creates a unique sibling upgrade database, installs the pre-feature HEAD schema and deterministic fixtures, applies the additive migration twice and the v5 terminal verifier, compares original row fingerprints/counts, checks purchase timestamps and order history, then applies the subsequent historical-order migration and verifies the current v6 schema contract. It drops only the exact database OID created by that run. It never connects to or changes the existing E2E application database, never reads `.env` files, and refuses remote databases. By default HEAD must still be the pre-feature schema baseline. After committing, pass `--baseline <reviewed-full-pre-feature-commit-SHA>`; the script still refuses a baseline that already contains this feature.
