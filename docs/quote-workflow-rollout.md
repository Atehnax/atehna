# Quote workflow and order-contract rollout

The quote workflow is additive. A quote request, an issued seller offer, and an
order remain separate records. Disabling the feature must never delete or
rewrite any of them.

## Production blockers

Do not enable public quote requests or customer acceptance until Atehna has
approved the fixed Slovenian checkout/acceptance wording, required consumer
information, general terms, offer acceptance method, privacy/retention wording,
and the real customer Reply-To address. This repository intentionally does not
invent that legal text.

The 20260828 base migration was applied to the explicitly approved, configured
Neon `neondb` target on 2026-08-28 at 21:28 UTC. No quote feature flag was
enabled by that database deployment. This record does not state that any later
follow-up artifact has been applied. Do not infer that any artifact is installed
in any environment; verify the schema markers independently for every target.

## Recorded database deployment

- 20260828 migration artifact SHA-256:
  `ACC398B4FF695272BAFCFCB2A966B567BCADB9F144FE1D17929F0C268C73E9AD`
- Final pre-migration custom-format backup:
  `atehna-neondb-pre-quote-final-20260828T212737Z.dump`
- Backup SHA-256:
  `DD2C768B3E9F6F0F60F0B5D44DDC00F91F0089382A9EF377ADEAB844D323B301`
- The backup passed archive validation, a full disposable local restore, and a
  rehearsal of the exact migration before the configured database was changed.
- Post-deployment verification found no inventory change, no invalid constraint
  or index, no binding item without a variant, and no `legacy_unknown` stock
  hold. The 16 quote tables were present and empty.

Applying any artifact to any additional environment still requires explicit
database authority, a verified backup, a maintenance window, and, for the base
deployment, a review of the legacy-stock reconciliation output.

## Database deployment

Fresh databases install the complete database/schema.sql.

An existing database uses these reviewed, one-time additive artifacts in strict
order:

1. `database/migrations/20260828_quote_workflow_and_order_contract.sql`
2. `database/migrations/20260829_quote_request_admin_details.sql`
3. `database/migrations/20260829_quote_request_management.sql`
4. `database/migrations/20260830_quote_manual_documents.sql`
5. `database/migrations/20260830_quote_request_admin_title.sql`
6. `database/migrations/20260830_quote_clarification_email.sql`
7. `database/migrations/20260831_order_item_delivery_plan.sql`
8. `database/migrations/20260901_quote_optional_acceptance_terms.sql`
9. `database/migrations/20260901_inventory_policy_settings.sql`
10. `database/migrations/20260901_order_stock_enforcement_marker.sql`
11. `database/migrations/20260901_quote_outbox_cancellation.sql`
12. `database/migrations/20260903_gurs_address_prefix_search.sql`
13. `database/migrations/20260903_order_document_email_events.sql`
14. `database/migrations/20260903_schema_contract_v1.sql`
15. `database/migrations/20260904_gurs_postal_lookup_indexes.sql`
16. `database/migrations/20260904_public_customer_codes.sql`
17. `database/migrations/20260904_schema_contract_v2.sql`

These 17 files are the schema sequence applied before the public-code
application deployment. The template rewrite is a separate, manually
acknowledged post-deploy data step:
`database/migrations/20260905_public_code_email_templates_postdeploy.sql`.
Do not append it to an automatic schema runner or execute it while the previous
deployed version can still render email.

The 20260828 base artifact takes an advisory transaction lock, verifies the
expected current schema, adds the quote aggregate and order contract fields,
performs a deterministic legacy classification, validates the result, and
commits atomically.

The admin-details follow-up must be applied only after 20260828 has been verified. It
uses the same advisory lock, fixed `public, pg_temp` search path, lock and
statement timeouts, and an atomic transaction. It verifies the required quote
tables, columns, validated event constraint, enabled history trigger, and the
expected pre-upgrade guard before taking table locks. It then permits the
approved pre-issue customer-detail changes and adds their audit event type. It
does not rewrite quote, offer, order, stock, or event rows, and it aborts if it
detects an absent, unexpected, disabled, or already-upgraded installation.

The management follow-up must be applied after the admin-details guard is
verified. It adds the manual-intake source and durable void evidence, replaces
the request-history guard with a logical-void transition that rejects any
commercial history, and adds `request_voided` to the event constraint. It is
transactional and rerunnable, never physically deletes a quote aggregate, and
does not create customer access or email delivery side effects.

The manual-documents follow-up must be applied after request management. It adds
append-only administrator PDF attachments for offers and purchase orders, keeps
them separate from immutable issued-offer evidence, enforces the offer/request
association, and adds the `admin_document_uploaded` event type.

The admin-title follow-up is next in the ordered sequence. It adds a constrained,
nullable internal display title without changing the immutable request number
or commercial history, and updates the existing request-history guard without
weakening its admin-details or logical-void protections.

The clarification-email follow-up adds only the
`quote_clarification_requested` email-job event type after checking the exact
predecessor constraint and existing rows; it does not rewrite quote, offer,
document, event, order, customer, payment, inventory, or delivery evidence.

The delivery-plan follow-up then adds explicit current/later shipment grouping
and revision guards for order lines and delivery documents. The optional
acceptance-terms follow-up relaxes only the non-draft offer identity
constraint so free-text acceptance terms may be empty, while still requiring
their version, hash, validity, delivery terms, payment terms, and all other
issued-offer integrity evidence. The inventory-policy follow-up installs the
single global stock-enforcement switch with the existing enforced behavior as
its default. The order-stock marker must follow it and records whether stock
enforcement governed each order's lifecycle without changing existing holds.
The quote-outbox cancellation artifact is the final application-data follow-up.
It adds a durable cancelled state plus actor/timestamp evidence without rewriting
existing email jobs.

The GURS prefix-index artifact requires a coordinated application rollout.
Stop scheduled and manual GURS synchronization and confirm no import is active,
apply the artifact to the current address table, then deploy the synchronizer
version that builds the identical ordered prefix index on every staging table.
Before re-enabling synchronization, verify that a one-character lookup returns
at most eight results and that PostgreSQL uses the prefix index. This prevents
an older synchronizer from replacing the indexed table after the migration.
The artifact invalidates an expired stored lease and marks lingering `running`
sync-history rows failed; it aborts without changing a live lease.

The order-document email-event artifact follows the GURS index. It adds only
the explicit `predracun_issued` and `invoice_issued` event types to the order
email outbox constraint after verifying the exact predecessor state and all
existing rows; it does not rewrite orders, documents, jobs, or delivery
evidence.

The public-customer-code artifact follows the postal lookup indexes. It takes
write-blocking locks for the affected order and quote tables,
backfills a cryptographically random 16-character base, preserves that base for
every existing quote-to-order conversion, and aborts if one quote has produced
multiple linked orders. It then installs format, uniqueness, immutability, and
lineage guards. The order and quote insert guards share a transaction advisory
lock namespace, so concurrent direct-order and quote allocation cannot reuse a
base across tables. A random cross-table collision suppresses that attempted
row without aborting the transaction, allowing the bounded application allocator
to retry. Quote-to-order insertion is the sole reuse path: its lineage guard
atomically replaces any generated order base with the source quote base before
constraints run, which keeps migration-first rollout compatible with older
conversion SQL. It does not read or change email settings or queued message
envelopes.

The v2 terminal schema-contract artifact follows all application migrations. It
first verifies the required end state, including current columns, validated
constraints, guard functions, enabled triggers, indexes, and the typed
inventory-policy `default` row. Only then does it record contract
`20260904.prelaunch-v2` with
`installed_via='existing_database'`. A database created directly from
`database/schema.sql` records the same contract with
`installed_via='fresh_schema'`. This is a terminal compatibility assertion, not
a backfill of migration history: it deliberately makes no claim about which
historical artifact or checksum produced an already-compatible object. The
recorded 20260828 deployment SHA-256 above remains the historical source of
truth for that deployment.

None of these files is an application migration runner. Never call any artifact
from a request, build, or startup hook, and never copy individual statements out
of its transaction.

Before execution:

1. Keep every QUOTE_* flag disabled and stop deployments that can write orders
   during the maintenance window.
2. Provision a stable QUOTE_ACCESS_BOOTSTRAP_KEY of at least 32 random
   characters, separate from ORDER_ACCESS_BOOTSTRAP_KEY.
3. Take a fresh restorable database backup immediately before the first
   unapplied artifact and test its restore. Take another backup before any
   follow-up that is deployed in a later maintenance window.
4. Review each exact artifact against the target schema and rehearse the ordered
   sequence on a recent production clone.
5. Record row counts and inventory totals before execution.
6. Execute each required file once with an approved PostgreSQL deployment
   client: 20260828 first, verify it, then admin details, request management,
   manual documents, admin title, clarification email, order-item delivery
   planning, optional quote acceptance terms, inventory policy, the per-order
   stock-enforcement marker, quote-outbox cancellation, the GURS prefix index,
   the order-document email events, GURS postal indexes, public customer codes,
   and finally the terminal v2 schema contract. Do not include the post-deploy
   template data migration in this pre-deploy sequence.
   If an earlier artifact is already installed, do not rerun it; verify its
   markers and continue in order with only the unapplied follow-ups.
7. After 20260828, record the post-deploy counts, constraint validation, and all
   `order_stock_holds` rows whose state is `legacy_unknown`.
8. After the admin-details artifact, confirm row counts and inventory totals are
   unchanged, the `quote_requests_guard_history` trigger remains enabled, its
   function contains the `admin_details_changed` guard, and the validated
   `quote_events_event_type_check` constraint includes
   `quote_request_details_changed`.
9. After request management, confirm row counts and inventory totals remain
   unchanged, the request-history function contains the logical-void guards,
   and the validated event constraint includes `request_voided`.
10. After manual documents, confirm `quote_manual_documents` has all required
    columns, shares `quote_documents_id_seq`, enforces its offer/request foreign
    key, has an enabled append-only trigger, and the validated event constraint
    includes `admin_document_uploaded`.
11. After admin title, confirm `quote_requests.admin_title` is nullable text with
    the validated trim/length constraint and the enabled request-history guard
    still contains the admin-details and logical-void protections.
12. After clarification email, confirm the validated
    `quote_email_jobs_event_type_check` constraint contains exactly the expected
    event types, including `quote_clarification_requested`, and that no
    unexpected existing email-job event type was accepted.
13. After delivery planning, confirm existing order lines and documents are at
    revision 1 and the new grouping/revision constraints and guards are enabled.
14. After optional acceptance terms, confirm issued offers may store an empty
    free-text acceptance-terms value while version, hash, validity, delivery,
    payment, and immutable offer identity evidence remain required.
15. After inventory policy, confirm the single `default` row exists in
    `inventory_policy_settings` and `stockEnforcementEnabled` is `true`.
16. After the order marker, confirm every existing order has
    `stock_enforcement_applied = true` and the column is non-null with a true
    default for new orders.
17. After quote-outbox cancellation, confirm the validated status constraint
    includes `cancelled`, the cancellation evidence constraint is validated,
    and every pre-existing job remains unchanged and non-cancelled.
18. After the GURS prefix index, verify that no sync lease is active and that a
    one-character lookup uses the ordered active-table index.
19. After the order-document email events, confirm the validated order-email
    event constraint includes `predracun_issued` and `invoice_issued` and no
    unexpected event type was accepted.
20. After the GURS postal lookup artifact, verify exact postal-code and normalized
    postal-place prefix lookups use the active-table covering indexes.
21. After the public-code artifact, confirm every order and quote request has a
    valid unique base, converted orders share their originating quote base, all
    public-code guards are enabled, and the order/quote email-settings rows and
    queued email jobs are byte-for-byte unchanged.
22. Apply the v2 terminal schema-contract artifact only after all prior postconditions
    pass, then run `npm run check:database-schema` against that exact target. The
    checker uses a read-only transaction and must report contract
    `20260904.prelaunch-v2`.

## Public-code post-deploy template migration

This is a second application rollout phase, not schema installation. Deploy and
verify the application version that renders the new customer variables
`{{order_code}}`, `{{quote_code}}`, and `{{offer_code}}`.
The customer-facing template contract exposes only these new identifiers and has
no runtime alias for sequential customer variables. The guarded database rewrite
below is the sole transition mechanism. Keep customer order/quote creation and
both email workers paused from deployment until the rewrite and verification
finish. Pause PDF-template editing and new PDF generation for the same window.
Saved PDF layouts also use this one-time rewrite; application reads do not
perform a version-dependent public-code layout conversion.

First inventory every customer envelope that could still be delivered or
retried. This query is read-only:

```sql
select 'order' as queue,
       status,
       count(*) as jobs,
       min(created_at) as oldest_created_at,
       max(created_at) as newest_created_at
  from public.order_email_jobs
 where audience = 'customer'
   and status in ('pending', 'processing', 'failed')
 group by status
union all
select 'quote' as queue,
       status,
       count(*) as jobs,
       min(created_at) as oldest_created_at,
       max(created_at) as newest_created_at
  from public.quote_email_jobs
 where audience = 'customer'
   and status in ('pending', 'processing', 'failed')
 group by status
order by queue, status;
```

Drain safe messages before the cutover. Explicitly review failed or stuck
messages; cancel a quote message only through the existing durable cancellation
workflow when that is the correct business decision. Order jobs have no
equivalent cancelled state, so every listed order job must be delivered or
otherwise reconciled under an approved operational procedure. Never delete or
rewrite an encrypted queued envelope. The migration independently repeats this
inventory under table locks and aborts unless both counts are zero.

Run the data migration with stop-on-error behavior in one PostgreSQL session.
The session setting is an explicit operator assertion that the compatible app
has already been deployed:

```sql
\set ON_ERROR_STOP on
set atehna.public_code_email_templates_app_ready = 'v1';
\i database/migrations/20260905_public_code_email_templates_postdeploy.sql
```

The migration requires exact schema contract `20260904.prelaunch-v2`,
upgrades the stored order settings row keyed
`order-email-notifications` to version 8 and the quote settings row keyed
`default` to version 2, and checks that the old sequential variables are gone
from customer/company/school fields. It rejects unknown future settings
versions, malformed settings, any administrator-template change, and any
remaining deliverable legacy customer envelope. It does not create missing
settings rows or mutate jobs.

The same transaction upgrades the `global_style_settings` row keyed
`order-document-templates` to `schemaVersion: 2`. For saved offer, pre-invoice,
and invoice metadata row arrays without a public-code row, it inserts the new
row immediately after the issue date (or first if that date is absent). It
preserves custom row order, labels, positioning, styling, all existing hidden
rows, and every other template field. An existing public-code row is never
duplicated or made visible. Missing layouts continue to use current defaults;
already-v2 layouts are not changed. No issued document record or PDF blob is
rewritten or renumbered. Rehearse this block with customized, hidden-code,
empty-row, missing-layout, already-v2, malformed, and future-version fixtures.

After commit, invalidate the `order-document-templates-config` Data Cache tag
through approved deployment cache controls before opening a PDF editor or
generating a new PDF. This raw-settings cache persists across deployments;
browser refresh and an ordinary redeploy are not sufficient. If tag invalidation
is unavailable, deploy a reviewed cache-key version change in
`ORDER_DOCUMENT_TEMPLATES_CACHE_VERSION` after the SQL has committed. Do not save
a stale pre-cutover editor form to refresh the cache. Read the admin PDF-settings
API after invalidation and compare its metadata rows with the committed database
settings before releasing the maintenance window.

Then verify all three settings versions, inspect representative
customer templates for every event class, send one new order and one new quote
test email, and confirm only the opaque public codes appear. Preview new PDFs
and compare the saved row order/hidden choices before resuming PDF editing and
generation. Then re-enable customer writes and workers. Runtime code must not normalize, translate, or
otherwise accept sequential customer template variables; retain only the
administrator-only internal variables and this auditable migration artifact.

## Schema-contract deployment gates

Roll out schema enforcement in two distinct phases so a code deployment cannot
strand an environment whose database has not yet received the contract marker.

Phase A - establish and verify the contract:

1. Run `npm run check:schema-contract` in review and CI. This checks the manifest
   checksum and its bindings to the fresh schema and terminal migration without
   connecting to a database.
2. For each Development, Preview, and Production database, take and restore-test
   a current backup, rehearse the exact unapplied migration sequence on a recent
   clone, and compare row counts and inventory totals before and after.
3. In a controlled maintenance window, apply only the reviewed, still-unapplied
   artifacts in order. The historical v1 marker precedes the GURS postal and
   public-code migrations; the active compatibility marker is established last by
   `database/migrations/20260904_schema_contract_v2.sql`.
4. Point `DATABASE_URL` explicitly at that target and run
   `npm run check:database-schema`. Record the target, contract ID, backup,
   rehearsal, application, and verification result. Repeat for every target.

Phase B - enable deployment enforcement later:

1. First expand the contract to every runtime-required canonical column,
   default, constraint, index, function, and trigger (or replace it with an
   equivalently reviewed full-catalog signature). The Phase-A contract covers
   every runtime table plus the high-risk order/quote workflow objects, but is
   deliberately not represented as an exhaustive application compatibility gate.
2. Continue only when every database reachable by Development, Preview, and
   Production deployments has independently passed the configured-database
   check for the same contract.
3. Add the Vercel build/startup compatibility gate in a separate reviewed
   change, verify each environment mapping, and redeploy deliberately.

This Phase-A change adds repository, fresh-schema, and isolated terminal-artifact
CI verification only. The artifact runs twice only after the E2E target's
loopback identity and per-run ownership marker have been verified. It is never
run from application build/startup and does not yet block a Vercel deployment on
a live database check. This CI rehearsal does not prove the historical upgrade
chain against production-shaped data; the recent-clone sequence and before/after
checks in Phase A step 2 remain a mandatory release gate.

The 20260828 migration never increases or decreases inventory. It classifies an active,
non-draft, non-cancelled legacy binding-order item quantity as held only when a
completed direct-checkout idempotency receipt, or a binding school order with
an active purchase order, proves the stock-committing application path.
Everything else becomes legacy_unknown, because the previous deployed version did not
keep enough evidence to know whether stock was decremented or a human already
reconciled inventory. Each unknown row must be investigated; any later
transition to held or released requires recorded reconciliation evidence.
The migration also reports binding legacy item rows whose catalogue variant
link is already null. Those rows cannot be represented by a variant-level hold
and need separate order/inventory investigation.

Legacy contract classification is deliberately conservative:

- school orders still awaiting buyer confirmation remain
  pending_seller_acceptance;
- explicitly rejected buyer commitments become rejected;
- binding school orders become accepted;
- individual/company orders become accepted only when fulfilment, payment, or
  invoice/delivery-document evidence exists;
- every other legacy direct order remains pending_seller_acceptance.

Fallback timestamps are labelled in the JSON evidence. They are migration
provenance, not fabricated customer acceptance records.

## Feature gates

All deployment gates default to false:

    QUOTE_ADMIN_ENABLED=false
    QUOTE_PUBLIC_REQUESTS_ENABLED=false
    QUOTE_ONLINE_ACCEPTANCE_ENABLED=false

Business email delivery is not an environment gate. It is controlled by the
persisted **Pošiljanje ponudb** toggle under Admin > Email, which defaults to
off. This master toggle also controls OTP security messages and must be enabled
before `QUOTE_ONLINE_ACCEPTANCE_ENABLED=true` can provide online acceptance.

Roll out in this order:

1. QUOTE_ADMIN_ENABLED=true: inspect imported history, prepare drafts, verify
   immutable versioning, PDF generation, events, and reverse order links.
2. QUOTE_PUBLIC_REQUESTS_ENABLED=true: accept non-binding quote requests only
   after confirmation copy, rate limiting, secure fragment exchange, and
   acknowledgement delivery have been tested.
3. Leave **Pošiljanje ponudb** off while testing durable jobs and previews.
   Enable it in Admin > Email only after Resend sender/profile verification and
   recipient/template review.
4. QUOTE_ONLINE_ACCEPTANCE_ENABLED=true: enable last, after OTP, CSRF,
   idempotency, deterministic stock locking, exact snapshot conversion, and
   duplicate-email suppression have passed concurrency and browser tests.

Rollback uses the matching control: turn off online acceptance and public
requests with their deployment flags, turn off **Pošiljanje ponudb** in Admin >
Email, and finally disable admin mutations if needed. Do not run a destructive
down migration and do not delete quote, acceptance, event, document, email-job,
or linked-order records.
