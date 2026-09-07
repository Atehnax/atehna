# Quote workflow and order-contract rollout

A quote request, an issued seller offer, and an order remain separate records. Disabling the feature must never delete or
rewrite any of them.

## Production blockers

Do not enable public quote requests or customer acceptance until Atehna has
approved the fixed Slovenian checkout/acceptance wording, required consumer
information, general terms, offer acceptance method, privacy/retention wording,
and the real customer Reply-To address. This repository intentionally does not
invent that legal text.

## Database installation

The complete current quote/order model is installed by `database/schema.sql`
into a verified empty database in one transaction. Use the
[fresh installation procedure](shipping-rollout.md), then run
`npm run check:schema-contract` and `npm run check:database-schema` against
the same explicitly configured target before enabling the matching application.

There is no incremental SQL deployment chain or template cutover runner.
The read-only checker requires the current contract and exact declared guards
for immutable offer history, acceptance evidence, stock holds, public-code
lineage, idempotency, outboxes and mutable configuration. Existing ledger
entries and archived data are historical evidence; they are not instructions
to execute old installation sources.

Fresh installations use current customer email/PDF templates. Review saved
sender identity, customer wording, administrator recipients and generated PDFs
before enabling delivery. Issued documents and queued envelopes remain
immutable evidence and must not be rewritten merely to change presentation.

Keep order and quote bootstrap encryption keys separate and stable. Provision
`QUOTE_ACCESS_BOOTSTRAP_KEY` with at least 32 random characters, configure
rate-limit/OTP secrets, and verify access-session exchange, OTP, CSRF, replay
protection and private document access on the candidate deployment.

Replacing an occupied shared database is a separate approved operation.
Confirm exact environments, retained accounts/configuration/security records,
records to remove, backup restoration and deployment cache invalidation first.
The source rebaseline does not authorize purging data or changing live jobs.

## Delivery and replacement prerequisites

Verify `PUBLIC_MEDIA_BLOB_STORE_ID` points to the public media store and
`ORDER_DOCUMENT_BLOB_STORE_ID` to the separate private document store, with
the required deployment identity/OIDC access. Test private PDF upload/read and
scoped customer links; never replace private documents with public URLs.
Keep encryption keys stable for existing access tokens and queued envelopes.
Verify the actual Resend sender, `RESEND_API_KEY`, Reply-To and recipients.

For an approved database replacement, pause customer writes, both email
workers and scheduled/manual GURS imports through the controlled cutover.
Inventory pending, processing and retryable failed order/quote messages,
including OTP. Drain safe deliveries or explicitly decide each retained or
cancelled job; never discard or rewrite an encrypted envelope to avoid review.
Existing blob references, issued PDFs, acceptance/access evidence, saved
templates and canonical logo library must have an explicit retain/restore plan.
Keep retained originals and the prior application/database mapping recoverable.

Verify the new target and saved settings, invalidate persisted deployment caches
(a database URL change or ordinary redeploy is insufficient), and inspect
customer and administrator previews, generated PDFs and private links before
re-enabling writes/workers. Record the exact target, backup, restore rehearsal,
application revision and checks for each environment. A database that fails the
current contract is not ready for this application; no automatic upgrade runs.
Production deployment enforcement remains a separate reviewed configuration
change, because the manifest covers selected high-risk objects rather than
every runtime column.

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

1. QUOTE_ADMIN_ENABLED=true: inspect records, prepare drafts, verify
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
Email, and finally disable admin mutations if needed. Keep quote, acceptance,
event, document, email-job and linked-order records intact.
