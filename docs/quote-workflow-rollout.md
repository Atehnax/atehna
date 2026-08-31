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
enabled by that database deployment. This record does not state that the five
follow-up artifacts from 20260829 and 20260830 have been applied. Do not infer
that any artifact is installed in any environment; verify the schema markers
independently for every target.

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

The clarification-email follow-up must be applied last. It adds only the
`quote_clarification_requested` email-job event type after checking the exact
predecessor constraint and existing rows; it does not rewrite quote, offer,
document, event, order, customer, payment, inventory, or delivery evidence.

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
   manual documents, admin title, and clarification email. If an earlier
   artifact is already installed, do not rerun it; verify its markers and
   continue in order with only the unapplied follow-ups.
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

The 20260828 migration never increases or decreases inventory. It classifies an active,
non-draft, non-cancelled legacy binding-order item quantity as held only when a
completed direct-checkout idempotency receipt, or a binding school order with
an active purchase order, proves the stock-committing application path.
Everything else becomes legacy_unknown, because the old application did not
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

All gates default to false:

    QUOTE_ADMIN_ENABLED=false
    QUOTE_PUBLIC_REQUESTS_ENABLED=false
    QUOTE_ONLINE_ACCEPTANCE_ENABLED=false
    QUOTE_EMAIL_DELIVERY_ENABLED=false

Roll out in this order:

1. QUOTE_ADMIN_ENABLED=true: inspect imported history, prepare drafts, verify
   immutable versioning, PDF generation, events, and reverse order links.
2. QUOTE_PUBLIC_REQUESTS_ENABLED=true: accept non-binding quote requests only
   after confirmation copy, rate limiting, secure fragment exchange, and
   acknowledgement delivery have been tested.
3. Leave QUOTE_EMAIL_DELIVERY_ENABLED=false while testing durable jobs and
   previews. Enable it only after Resend sender/profile verification and
   recipient/template review.
4. QUOTE_ONLINE_ACCEPTANCE_ENABLED=true: enable last, after OTP, CSRF,
   idempotency, deterministic stock locking, exact snapshot conversion, and
   duplicate-email suppression have passed concurrency and browser tests.

Rollback is flag-only: turn off online acceptance, public requests, quote email
delivery, and finally admin mutations as needed. Do not run a destructive down
migration and do not delete quote, acceptance, event, document, email-job, or
linked-order records.
