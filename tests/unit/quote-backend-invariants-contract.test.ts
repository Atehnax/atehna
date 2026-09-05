import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

function assertBefore(
  contents: string,
  earlier: string,
  later: string,
  message: string
): void {
  const earlierIndex = contents.indexOf(earlier);
  const laterIndex = contents.indexOf(later);
  assert.ok(earlierIndex >= 0, `missing earlier marker: ${earlier}`);
  assert.ok(laterIndex >= 0, `missing later marker: ${later}`);
  assert.ok(earlierIndex < laterIndex, message);
}

test('quote submission uses isolated idempotency and cannot create order or stock side effects', () => {
  const quoteRequest = source('src/commercial/api/quote-requests/route.ts');
  const directOrder = source('src/commercial/api/orders/route.ts');

  assert.match(
    quoteRequest,
    /insert into quote_request_idempotency_keys \([\s\S]*?intent[\s\S]*?values \(\$1, \$2, 'quote_request'\)/u
  );
  assert.match(directOrder, /intent: 'direct_order'/u);
  assert.match(directOrder, /insert into order_idempotency_keys/u);
  assert.doesNotMatch(directOrder, /quote_request_idempotency_keys/u);
  assert.doesNotMatch(quoteRequest, /order_idempotency_keys/u);

  assert.match(quoteRequest, /insert into quote_requests/u);
  assert.match(quoteRequest, /insert into quote_request_items/u);
  assert.match(quoteRequest, /snapshot_json/u);
  assert.match(
    quoteRequest,
    /insert into quote_offer_versions \([\s\S]*?values \([\s\S]*?'draft'/u
  );
  assert.match(
    quoteRequest,
    /billing_snapshot_json,[\s\S]*?delivery_terms,[\s\S]*?payment_terms,[\s\S]*?acceptance_method/u
  );
  assert.match(
    quoteRequest,
    /shipping_snapshot_json,[\s\S]*?valid_until[\s\S]*?\$12::timestamptz \+ interval '1 month'/u
  );
  assert.match(quoteRequest, /row\.created_at/u);
  assert.doesNotMatch(quoteRequest, /interval '15 days'/u);
  assert.match(
    quoteRequest,
    /\[\s*quoteRequestId,\s*JSON\.stringify\(customerSnapshot\),\s*DEFAULT_QUOTE_DELIVERY_TERMS,\s*DEFAULT_QUOTE_PAYMENT_TERMS,\s*customer\.customerType/u
  );
  assert.match(quoteRequest, /insert into quote_offer_version_items/u);
  for (const forbiddenSideEffect of [
    /insert into\s+orders\b/iu,
    /update\s+catalog_item_variants\b/iu,
    /\border_stock_holds\b/iu,
    /\border_email_jobs\b/iu,
    /\border_summary_jobs\b/iu
  ]) {
    assert.doesNotMatch(quoteRequest, forbiddenSideEffect);
  }
});

test('new and blank quote drafts use one calendar month without replacing stored validity', () => {
  const detail = source(
    'src/admin/features/quotes/components/AdminQuoteDetailClient.tsx'
  );
  const revision = source(
    'src/admin/api/quote-requests/[quoteRequestId]/revise/route.ts'
  );
  const revisionHelper = source('src/shared/server/quoteOfferRevision.ts');

  assert.match(
    detail,
    /toDateInput\(version\.validUntil\) \|\|[\s\S]*?populateDefaultValidity[\s\S]*?defaultQuoteValidityDateInput\(version\.createdAt\)/u
  );
  assert.match(
    detail,
    /toPersistedDraftState[\s\S]*?populateDefaultValidity: false/u
  );
  assert.match(
    detail,
    /const toNewDraftState[\s\S]*?validUntil: defaultQuoteValidityDateInput\(detail\.createdAt\)/u
  );
  assert.match(revision, /createQuoteOfferDraftRevision\(client/u);
  assert.match(revisionHelper, /now\(\) \+ interval '1 month'/u);
  assert.doesNotMatch(revisionHelper, /interval '15 days'/u);
});
test('draft writes are optimistic, server-calculated, and commercially complete before issue', () => {
  const draft = source(
    'src/admin/api/quote-requests/[quoteRequestId]/draft/route.ts'
  );
  const issue = source(
    'src/admin/api/quote-requests/[quoteRequestId]/issue/route.ts'
  );

  assert.match(draft, /quote_requests where id = \$1 for update/u);
  assert.match(draft, /expectedStateVersion/u);
  assert.match(draft, /requestedOfferVersionId !== Number\(existing\.id\)/u);
  assert.match(
    draft,
    /expectedStateVersion !== Number\(existing\.state_version\)/u
  );
  assert.match(draft, /code: 'QUOTE_DRAFT_STALE'/u);
  assert.match(
    draft,
    /EDITABLE_REQUEST_STATUSES = new Set\(\['received', 'in_preparation'\]\)[\s\S]*?!EDITABLE_REQUEST_STATUSES\.has\(String\(quoteRequest\.status\)\)/u
  );
  assert.match(
    draft,
    /normalizedSubmittedDiscountPct[\s\S]*?submittedDiscountUnitNetCents === unitNetCents[\s\S]*?derivedDiscountPct/u
  );
  assert.match(draft, /existingDraftId[\s\S]*?readOfferItems/u);
  assert.match(draft, /const requestedItems = await readRequestItems/u);
  assert.match(draft, /if \(value\.length > 100\)/u);
  assert.doesNotMatch(draft, /value\.length !== source\.length/u);
  assert.match(
    draft,
    /knownLineNumbers[\s\S]*?requestedByLineNumber\.keys\(\)[\s\S]*?nextLineNumber/u
  );
  assert.match(
    draft,
    /const lineNumber = isKnownLine \? submittedLineNumber : nextLineNumber\+\+/u
  );  assert.match(draft, /const totalCents = subtotalCents \+ taxCents \+ shippingCents/u);
  assert.match(draft, /const validUntil = futureValidity\(parsed\.body\.validUntil\)/u);
  assert.match(draft, /shippingCents === 0 && !confirmFreeShipping/u);
  assert.match(draft, /code: 'FREE_SHIPPING_CONFIRMATION_REQUIRED'/u);
  assert.match(draft, /shipping_confirmation_json = \$15::jsonb/u);
  assert.match(
    draft,
    /const acceptanceMethod =[\s\S]*?effectiveCustomerType === 'school' \? 'purchase_order' : 'online'/u
  );
  assert.match(
    draft,
    /acceptanceMethodValue !== acceptanceMethod[\s\S]*?code: 'QUOTE_ACCEPTANCE_METHOD_INVALID'/u
  );
  for (const persistedTerm of [
    /delivery_terms = \$7/u,
    /payment_terms = \$8/u,
    /valid_until = \$16/u,
    /terms_text = \$17/u,
    /terms_version = \$18/u
  ]) {
    assert.match(draft, persistedTerm);
  }

  assert.match(issue, /where quote_request_id = \$1 and status = 'draft'[\s\S]*?for update/u);
  assert.match(issue, /Number\(parsed\.body\.expectedStateVersion\)[\s\S]*?draft\.state_version/u);
  assert.match(issue, /code: 'QUOTE_DRAFT_STALE'/u);
  assert.match(issue, /!deliveryTerms \|\| !paymentTerms \|\| !termsVersion/u);
  assert.doesNotMatch(issue, /!termsText/u);
  assert.match(issue, /shipping === 0 && !freeShippingConfirmed/u);
  assert.match(
    issue,
    /const termsHash = quoteContentSha256\(\{[\s\S]*?version: termsVersion,[\s\S]*?text: termsText/u
  );
  assert.match(issue, /const contentHash = quoteContentSha256\(contentSnapshot\)/u);
  assert.match(issue, /renderQuoteOfferPdf[\s\S]*?mode: 'issued'/u);
  assert.match(issue, /renderedDocumentSha256/u);
  assert.match(issue, /renderedPdfBase64/u);
  assert.match(
    issue,
    /const acceptanceMethod =[\s\S]*?draft\.acceptance_method !== acceptanceMethod[\s\S]*?code: 'QUOTE_ACCEPTANCE_METHOD_INVALID'/u
  );
  assert.match(
    issue,
    /acceptanceMethod === 'purchase_order'[\s\S]*?\['purchase_order'\]/u
  );
  assert.match(
    issue,
    /set status = 'superseded',[\s\S]*?where id = \$1[\s\S]*?set offer_number = \$2,[\s\S]*?status = 'issued',[\s\S]*?is_current = true/u
  );
});

test('offer issue is replay-safe under the workflow lock without repeating side effects', () => {
  const issue = source(
    'src/admin/api/quote-requests/[quoteRequestId]/issue/route.ts'
  );

  assert.match(issue, /parsed\.body\.actionId[\s\S]*?UUID_PATTERN\.test\(actionId\)/u);
  assert.match(issue, /function issuePayloadFingerprint[\s\S]*?createHash\('sha256'\)/u);
  assertBefore(
    issue,
    'await lockQuoteWorkflow(client, quoteRequestId)',
    'const existingIssueResult = await client.query',
    'the workflow lock must protect the replay lookup'
  );
  assertBefore(
    issue,
    'const existingIssueResult = await client.query',
    'if (quoteRequest.voided_at)',
    'matching retries must be handled before mutable request-state checks'
  );

  const replayBranch = issue.slice(
    issue.indexOf('if (existingIssue)'),
    issue.indexOf('if (quoteRequest.voided_at)')
  );
  assert.match(replayBranch, /metadata\.issuePayloadFingerprint !== payloadFingerprint/u);
  assert.match(replayBranch, /QUOTE_ISSUE_IDEMPOTENCY_CONFLICT/u);
  assert.match(replayBranch, /client\.query\('commit'\)/u);
  assert.match(replayBranch, /replayed: true/u);
  assert.match(replayBranch, /documentStatus/u);
  assert.match(replayBranch, /emailQueued/u);
  assert.doesNotMatch(
    replayBranch,
    /renderQuoteOfferPdf|issueQuoteAccessToken|enqueueQuoteEmailEvent|scheduleQuote/u
  );

  assert.match(issue, /event\.metadata_json ->> 'actionId' = \$2/u);
  assert.match(issue, /actionId,[\s\S]*?issuePayloadFingerprint: payloadFingerprint/u);
  assert.match(issue, /correlation_id,[\s\S]*?metadata_json/u);
  assert.match(issue, /`offer-issued:\$\{draft\.id\}`/u);
  assert.match(issue, /`quote-issued:\$\{draft\.id\}`/u);
  assert.match(issue, /replayed: false/u);
});
test('online acceptance is one frozen-snapshot conversion transaction and never emits order_submitted', () => {
  const acceptance = source(
    'src/commercial/api/quote-requests/accept/route.ts'
  );
  const placement = source('src/shared/server/orderPlacement.ts');
  const orderabilityLocks = source(
    'src/shared/server/catalogOrderabilityLocks.ts'
  );

  assert.match(acceptance, /for update of offer, request/u);
  assert.match(
    acceptance,
    /offer\.status !== 'issued'[\s\S]*?offer\.is_current !== true[\s\S]*?offer\.valid_until[\s\S]*?!offer\.document_sha256/u
  );
  assert.match(acceptance, /savepoint quote_accept_conversion/u);
  assert.match(acceptance, /lockCatalogOrderability\(client, variantIds\)/u);
  assert.match(
    orderabilityLocks,
    /from catalog_items[\s\S]*?order by id[\s\S]*?from catalog_item_variants[\s\S]*?order by id[\s\S]*?for update/u
  );
  assert.match(orderabilityLocks, /categoryId: string \| null/u);
  assert.match(orderabilityLocks, /catalogCategoryId\(row\.category_id\)/u);
  assert.match(orderabilityLocks, /indexCatalogCategoryActivity\(categoryResult\.rows\)/u);
  assert.doesNotMatch(orderabilityLocks, /lock table catalog_items|lock table catalog_item_variants/u);
  assert.match(acceptance, /begin isolation level serializable/u);
  assert.match(
    acceptance,
    /isCatalogSerializationFailure\(error\)[\s\S]*?QUOTE_CONCURRENT_CATALOG_CHANGE/u
  );
  assert.match(
    acceptance,
    /let conversionSavepointActive = true[\s\S]*?release savepoint quote_accept_conversion[\s\S]*?conversionSavepointActive = false[\s\S]*?client\.query\('commit'\)[\s\S]*?if \(conversionSavepointActive\)/u
  );
  assert.match(acceptance, /placeOrderFromFrozenSnapshot\(client/u);
  assert.match(acceptance, /contractStatus: 'accepted'/u);
  assert.match(acceptance, /sourceQuoteOfferVersionId: access\.quoteOfferVersionId/u);
  assert.match(acceptance, /commitStock: true/u);
  assert.match(acceptance, /insert into quote_offer_acceptances/u);
  assert.match(acceptance, /update quote_offer_versions[\s\S]*?status = 'accepted'/u);
  assert.match(acceptance, /update quote_requests[\s\S]*?status = 'converted_to_order'/u);
  assert.match(acceptance, /completeQuoteResponseIdempotency/u);
  assert.match(
    acceptance,
    /rollback to savepoint quote_accept_conversion[\s\S]*?acceptance_blocked_stock/u
  );
  assert.match(acceptance, /acceptance_blocked_by_stock/u);
  assert.match(
    acceptance,
    /for update of offer, request[\s\S]*?getQuoteStockAcceptanceMode\(client\)[\s\S]*?stockAcceptanceMode === 'automatic'[\s\S]*?acceptance_blocked_by_stock/u
  );
  assert.match(acceptance, /STOCK_REVIEW_REQUIRED/u);
  assert.doesNotMatch(acceptance, /enqueueOrderEmailEvent|order_submitted/u);
  assert.match(acceptance, /eventType: 'quote_accepted'/u);
  assert.match(acceptance, /event_type, actor_type[\s\S]*?'quote_email_queued'/u);
  assert.match(
    acceptance,
    /release savepoint quote_accept_conversion[\s\S]*?client\.query\('commit'\)[\s\S]*?scheduleInitialOrderSummaryJob[\s\S]*?scheduleQuoteEmailJobs/u
  );

  assert.match(placement, /insert into orders/u);
  assert.match(placement, /insert into order_items/u);
  assert.match(placement, /insert into order_line_snapshots/u);
});

test('quote email enqueue and provider outcomes cannot roll back business state', () => {
  const requestRoute = source('src/commercial/api/quote-requests/route.ts');
  const issueRoute = source(
    'src/admin/api/quote-requests/[quoteRequestId]/issue/route.ts'
  );
  const acceptRoute = source(
    'src/commercial/api/quote-requests/accept/route.ts'
  );
  const declineRoute = source(
    'src/commercial/api/quote-requests/decline/route.ts'
  );
  const schoolBridge = source(
    'src/shared/server/schoolOrderSellerAcceptance.ts'
  );
  const adminHelpers = source(
    'src/admin/api/quote-requests/quoteAdminRouteUtils.ts'
  );
  const worker = source('src/shared/server/quoteEmailJobs.ts');

  for (const [contents, savepoint] of [
    [requestRoute, 'quote_request_email'],
    [issueRoute, 'quote_issue_email'],
    [acceptRoute, 'quote_acceptance_email'],
    [declineRoute, 'quote_decline_email'],
    [schoolBridge, 'quote_acceptance_email'],
    [adminHelpers, 'quote_admin_email']
  ]) {
    assert.match(contents, new RegExp(`savepoint ${savepoint}`, 'u'));
    assert.match(contents, new RegExp(`rollback to savepoint ${savepoint}`, 'u'));
    assert.match(contents, new RegExp(`release savepoint ${savepoint}`, 'u'));
    assert.match(contents, /quote_email_queued/u);
    assert.match(contents, /quote_email_provider_failed/u);
  }

  assert.match(worker, /async function persistTerminalQuoteEmailOutcome/u);
  assert.match(
    worker,
    /client\.query\('begin'\)[\s\S]*?update quote_email_jobs[\s\S]*?recordDeliveryEvent[\s\S]*?client\.query\('commit'\)/u
  );
  assert.match(worker, /quote_email_provider_accepted/u);
  assert.match(worker, /quote_email_provider_failed/u);
  assert.match(
    worker,
    /status = 'issued'[\s\S]*?is_current = true[\s\S]*?valid_until > now\(\)/u
  );
  assert.match(
    worker,
    /job\.eventType !== 'quote_issued'[\s\S]*?job\.eventType !== 'quote_acceptance_blocked_stock'[\s\S]*?status = 'issued'[\s\S]*?is_current = true[\s\S]*?valid_until > now\(\)/u
  );
  assert.match(
    worker,
    /job\.eventType === 'quote_withdrawn'[\s\S]*?job\.eventType === 'quote_expired'[\s\S]*?request\.status in \(\$3, 'in_preparation'\)[\s\S]*?offer\.status = \$3[\s\S]*?not exists[\s\S]*?newer_offer\.version_number > offer\.version_number[\s\S]*?newer_offer\.status <> 'draft'/u
  );
  assert.match(
    worker,
    /failureKind:\s*\| 'voided_request'\s*\| 'expired_otp'\s*\| 'obsolete_offer'\s*\| 'obsolete_clarification'\s*\| 'stale_recipient'/u
  );
  assert.match(worker, /lockQuoteWorkflow\(client, job\.requestId\)/u);
  assert.match(
    worker,
    /select id, quote_request_id, quote_offer_version_id, event_key, event_type,[\s\S]*?audience, recipient_email[\s\S]*?recipientEmail: String\(row\.recipient_email\)/u
  );
  assert.match(
    worker,
    /select voided_at, email from quote_requests where id = \$1 for share/u
  );
  assert.match(
    worker,
    /from order_email_settings[\s\S]*?for share[\s\S]*?currentAdminRecipients[\s\S]*?envelopeMatchesClaim[\s\S]*?recipientIsCurrent[\s\S]*?failureKind: 'stale_recipient'/u
  );
  assert.match(
    worker,
    /input\.failureKind !== 'stale_recipient'/u
  );
  assert.match(worker, /eventType: 'quote_delivery_failed'/u);
  assert.match(worker, /job\.eventType !== 'quote_delivery_failed'/u);
  assert.match(
    worker,
    /set status = case[\s\S]*?request_record\.voided_at is null then 'pending'[\s\S]*?else 'failed'[\s\S]*?next_attempt_at = now\(\) \+ \(\$3::bigint \* interval '1 millisecond'\)/u
  );
});

test('clarification email remains durable while delivery and retry fail closed outside open requests', () => {
  const clarification = source(
    'src/admin/api/quote-requests/[quoteRequestId]/clarification/route.ts'
  );
  const helpers = source(
    'src/admin/api/quote-requests/quoteAdminRouteUtils.ts'
  );
  const worker = source('src/shared/server/quoteEmailJobs.ts');
  const retry = source(
    'src/admin/api/quote-email-jobs/[jobId]/retry/route.ts'
  );
  const retryEligibility = source(
    'src/shared/domain/quote/quoteEmailRetryEligibility.ts'
  );

  assert.match(clarification, /lockQuoteWorkflow\(client, quoteRequestId\)/u);
  assert.match(clarification, /clarification-requested:\$\{quoteRequestId\}:\$\{actionId\}/u);
  assert.match(clarification, /quote-clarification-requested:\$\{quoteRequestId\}:\$\{actionId\}/u);
  assert.match(
    clarification,
    /eventType: 'clarification_requested'[\s\S]*?enqueueQuoteEmailIsolated[\s\S]*?mirrorQuoteAdminAudit/u
  );
  assert.match(clarification, /eventType: 'quote_clarification_requested'/u);
  assert.match(helpers, /savepoint quote_admin_email/u);
  assert.match(helpers, /rollback to savepoint quote_admin_email/u);
  assert.match(helpers, /quote_email_provider_failed/u);
  assert.match(
    clarification,
    /client\.query\('commit'\)[\s\S]*?scheduleQuoteEmailJobs\(pool\)/u
  );

  for (const contents of [worker, retryEligibility]) {
    assert.match(contents, /quote_clarification_requested/u);
    assert.match(
      contents,
      /quote_clarification_requested[\s\S]*?received[\s\S]*?in_preparation[\s\S]*?offer_issued[\s\S]*?awaiting_purchase_order_review/u
    );
  }
  const workerClarificationBranch = worker.slice(
    worker.indexOf("if (job.eventType === 'quote_clarification_requested')"),
    worker.indexOf("if (job.eventType !== 'quote_issued'")
  );
  assert.match(workerClarificationBranch, /left join quote_offer_versions offer/u);
  assert.match(workerClarificationBranch, /offer\.id = \$2/u);
  assert.match(workerClarificationBranch, /\$2::bigint is null/u);
  assert.match(workerClarificationBranch, /offer\.status = 'draft'/u);
  assert.match(
    workerClarificationBranch,
    /offer\.status = 'issued'[\s\S]*?offer\.is_current = true/u
  );
  assert.match(
    workerClarificationBranch,
    /\[job\.requestId, job\.offerVersionId\]/u
  );
  assert.match(
    retry,
    /quoteEmailRetryStateIsCurrent[\s\S]*?return quoteEmailRetryStateIsCurrent\(\{/u
  );
  const retryClarificationBranch = retryEligibility.slice(
    retryEligibility.indexOf("if (eventType === 'quote_clarification_requested')"),
    retryEligibility.indexOf("return eventType === 'quote_request_submitted'")
  );
  assert.match(retryClarificationBranch, /job\.offerVersionId === null/u);
  assert.match(retryClarificationBranch, /job\.offerStatus === 'draft'/u);
  assert.match(retryClarificationBranch, /job\.offerStatus === 'issued'/u);
  assert.match(retryClarificationBranch, /job\.offerIsCurrent/u);
  assert.match(
    worker,
    /quote_clarification_requested[\s\S]*?(?:obsolete_clarification|closed_request|stale_clarification)/u
  );
  assert.match(
    retryEligibility,
    /eventType === 'quote_clarification_requested'[\s\S]*?job\.requestStatus/u
  );
  assert.doesNotMatch(
    clarification,
    /update\s+quote_requests|update\s+quote_offer_versions/iu
  );
});test('expiry is lock-safe, auditable, scope-revoking, and wired to protected cron', () => {
  const lifecycle = source('src/shared/server/quoteLifecycleJobs.ts');
  const processRoute = source(
    'src/admin/api/quote-workflow/process/route.ts'
  );
  const vercel = source('vercel.json');

  assert.match(
    lifecycle,
    /offer\.status = 'issued'[\s\S]*?offer\.is_current = true[\s\S]*?offer\.valid_until <= now\(\)[\s\S]*?for update of offer, request skip locked/u
  );
  assert.match(
    lifecycle,
    /const quoteRequestIds = Array\.from[\s\S]*?\.sort\(\(left, right\) => left - right\)[\s\S]*?lockQuoteWorkflow\(client, quoteRequestId\)/u
  );
  assertBefore(
    lifecycle,
    'await lockQuoteWorkflow(client, quoteRequestId)',
    'for update of offer, request skip locked',
    'expiry must acquire the quote workflow lock before row locks'
  );
  assert.match(lifecycle, /request\.status <> 'awaiting_purchase_order_review'/u);
  assert.match(
    lifecycle,
    /set status = 'expired',[\s\S]*?is_current = false[\s\S]*?state_version = state_version \+ 1/u
  );
  assert.match(lifecycle, /set status = 'expired'[\s\S]*?and status = 'offer_issued'/u);
  assert.match(
    lifecycle,
    /array_remove\(array_remove\(scopes, 'offer_response'\), 'purchase_order'\)/u
  );
  assert.match(lifecycle, /'offer_expired'/u);
  assert.match(lifecycle, /savepoint quote_expiry_email/u);
  assert.match(lifecycle, /'quote_email_queued'/u);
  assert.match(lifecycle, /'quote_email_provider_failed'/u);
  assert.match(
    lifecycle,
    /client\.query\('commit'\)[\s\S]*?scheduleQuoteEmailJobs/u
  );

  assert.match(processRoute, /process\.env\.CRON_SECRET/u);
  assert.match(processRoute, /authorization[^\n]+Bearer/u);
  assert.match(processRoute, /expireDueQuoteOffers/u);
  assert.match(processRoute, /processQuoteDocumentJobs/u);
  assert.match(processRoute, /processQuoteEmailJobs/u);
  assert.match(vercel, /\/api\/admin\/quote-workflow\/process/u);
  assert.match(vercel, /0 4 \* \* \*/u);
});

test('school purchase order requires consumed OTP and stays non-binding until admin validation', () => {
  const upload = source(
    'src/commercial/api/quote-requests/purchase-order/route.ts'
  );
  const bridge = source(
    'src/shared/server/schoolOrderSellerAcceptance.ts'
  );
  const statusBridge = source(
    'src/admin/api/orders/[orderId]/status/route.ts'
  );
  const rejectionBridge = source(
    'src/admin/api/orders/[orderId]/commitment-status/route.ts'
  );
  const genericUpload = source(
    'src/commercial/api/orders/purchase-order/route.ts'
  );
  const genericAdminUpload = source(
    'src/admin/api/orders/[orderId]/documents/route.ts'
  );
  const accessRenewal = source(
    'src/admin/api/orders/[orderId]/access-token/route.ts'
  );
  const documentDelete = source(
    'src/admin/api/orders/[orderId]/documents/[documentId]/route.ts'
  );
  const wholeOrderDelete = source('src/admin/api/orders/[orderId]/route.ts');
  const archive = source('src/shared/server/deletedArchive.ts');

  assert.match(
    upload,
    /offer\.status !== 'issued'[\s\S]*?offer\.is_current !== true[\s\S]*?offer\.valid_until[\s\S]*?!offer\.document_sha256/u
  );
  assert.match(upload, /from quote_email_verifications/u);
  assert.match(upload, /status = 'verified'/u);
  assert.match(upload, /and consumed_at is null/u);
  assert.match(upload, /consumeVerifiedQuoteOtp\(client/u);
  assert.match(upload, /'OTP_REQUIRED'/u);
  assertBefore(
    upload,
    'consumeVerifiedQuoteOtp(client',
    'placeOrderFromFrozenSnapshot(client',
    'OTP must be consumed before a school order can be created'
  );
  assert.match(upload, /commitmentStatus: 'pending_confirmation'/u);
  assert.match(upload, /contractStatus: 'pending_seller_acceptance'/u);
  assert.match(upload, /commitStock: false/u);
  assert.match(upload, /status = 'awaiting_purchase_order_review'/u);
  assert.match(upload, /'customer_purchase_order_uploaded'/u);
  assert.match(
    upload,
    /`customer-purchase-order:\$\{access\.quoteOfferVersionId\}:\$\{contentHash\}`/u
  );
  assert.match(
    upload,
    /let commitAttempted = false[\s\S]*?commitAttempted = true[\s\S]*?client\.query\('commit'\)/u
  );
  assert.match(
    upload,
    /const rollbackConfirmed[\s\S]*?client\.release[\s\S]*?const referenceResult = await pool\.query[\s\S]*?from quote_documents[\s\S]*?where blob_pathname = \$1[\s\S]*?from order_documents[\s\S]*?where blob_pathname = \$1/u
  );
  assert.match(
    upload,
    /safeToDelete = rollbackConfirmed && referenced === false[\s\S]*?if \(safeToDelete\)[\s\S]*?deletePrivateOrderDocumentBlob\(uploadedPath\)/u
  );
  assert.doesNotMatch(upload, /enqueueOrderEmailEvent|order_submitted/u);

  assert.match(bridge, /for update of offer, quote_request/u);
  assert.match(
    bridge,
    /sourceQuote\.status !== 'issued'[\s\S]*?!sourceQuote\.isCurrent[\s\S]*?sourceQuote\.requestStatus !== 'awaiting_purchase_order_review'/u
  );
  assert.match(bridge, /await commitOrderStockHolds/u);
  assert.match(statusBridge, /begin isolation level serializable/u);
  assert.match(
    bridge,
    /catalog_item_id,[\s\S]*?group by catalog_item_id, catalog_variant_id[\s\S]*?requireLockedCatalogVariantOrderable\([\s\S]*?productId: Number\(item\.catalog_item_id\)/u
  );
  assert.match(bridge, /contract_status = 'accepted'/u);
  assert.match(bridge, /channel,[\s\S]*?'purchase_order_validation'/u);
  assert.match(bridge, /insert into quote_offer_acceptances/u);
  assert.match(bridge, /status = 'converted_to_order'/u);
  assert.match(
    bridge,
    /update quote_access_tokens[\s\S]*?where quote_request_id = \$1[\s\S]*?and revoked_at is null[\s\S]*?returning id/u
  );
  assert.match(statusBridge, /quote_access_tokens_revoked:/u);
  for (const eventType of [
    'admin_purchase_order_validated',
    'customer_accepted',
    'order_created'
  ]) {
    assert.match(bridge, new RegExp(`'${eventType}'`, 'u'));
  }
  assert.match(rejectionBridge, /'admin_purchase_order_rejected'/u);
  assert.match(genericUpload, /QUOTE_PURCHASE_ORDER_WORKFLOW_REQUIRED/u);
  assert.match(genericUpload, /source_quote_offer_version_id/u);
  assert.match(genericAdminUpload, /QUOTE_PURCHASE_ORDER_EVIDENCE_IMMUTABLE/u);
  assert.match(
    accessRenewal,
    /order\.customer_type === 'school'[\s\S]*?order\.source_quote_offer_version_id === null/u
  );
  assert.match(documentDelete, /QUOTE_PURCHASE_ORDER_EVIDENCE_IMMUTABLE/u);
  assert.match(
    wholeOrderDelete,
    /select[\s\S]*?source_quote_offer_version_id[\s\S]*?for update/u
  );
  assert.match(
    wholeOrderDelete,
    /source_quote_offer_version_id !== null[\s\S]*?QUOTE_DERIVED_ORDER_DELETE_BLOCKED/u
  );
  assert.match(
    archive,
    /from quote_documents[\s\S]*?where blob_pathname = \$1/u
  );
  assert.match(
    archive,
    /document\.type = 'purchase_order'[\s\S]*?source_quote_offer_version_id is not null[\s\S]*?ARCHIVE_QUOTE_PURCHASE_ORDER_IMMUTABLE/u
  );
});

test('ordinary direct orders are accepted automatically while school orders retain review', () => {
  const directOrder = source('src/commercial/api/orders/route.ts');
  const contractRoute = source(
    'src/admin/api/orders/[orderId]/contract-status/route.ts'
  );
  const statusRoute = source('src/admin/api/orders/[orderId]/status/route.ts');
  const paymentRoute = source(
    'src/admin/api/orders/[orderId]/payment-status/route.ts'
  );
  const documentRoute = source(
    'src/admin/api/orders/generateOrderDocumentRoute.ts'
  );
  const stockHolds = source('src/shared/server/orderStockHolds.ts');
  const emailSettings = source(
    'src/shared/domain/order/orderEmailSettings.ts'
  );

  assert.match(
    directOrder,
    /const contractStatus: OrderContractStatus = stockNotCommitted[\s\S]*?\? 'pending_seller_acceptance'[\s\S]*?: 'accepted'/u
  );
  assert.match(
    directOrder,
    /contractActor:[\s\S]*?contractStatus === 'accepted' \? \{ type: 'system' \} : undefined/u
  );
  assert.match(directOrder, /'automatic_direct_order_acceptance'/u);
  assert.match(directOrder, /'await_school_purchase_order_review'/u);
  assert.match(
    directOrder,
    /inserted\.contractStatus === 'accepted'[\s\S]*?eventType: 'order_accepted'[\s\S]*?eventType: 'order_submitted'/u
  );
  assert.match(
    contractRoute,
    /current\.contract_status !== 'pending_seller_acceptance'/u
  );
  assert.match(
    contractRoute,
    /contractStatus === 'accepted'[\s\S]*?ORDER_STATUS_SELLER_ACCEPTANCE_REQUIRED/u
  );
  assert.match(statusRoute, /set commitment_status = 'binding'/u);
  assert.match(statusRoute, /contract_status = 'accepted'/u);
  assert.match(contractRoute, /set contract_status = 'rejected'/u);
  assert.match(contractRoute, /releaseOrderStockHolds/u);
  assert.match(contractRoute, /savepoint order_contract_email/u);
  assert.match(contractRoute, /eventType: 'order_rejected'/u);
  assert.match(
    contractRoute,
    /client\.query\('commit'\)[\s\S]*?scheduleOrderEmailJobs/u
  );

  assert.match(
    stockHolds,
    /where order_id = \$1[\s\S]*?and state in \('held', 'legacy_unknown'\)[\s\S]*?for update/u
  );
  assert.match(stockHolds, /OrderStockReconciliationRequiredError/u);
  assert.match(stockHolds, /readonly code = 'STOCK_RECONCILIATION_REQUIRED'/u);
  assert.match(stockHolds, /row\.state === 'legacy_unknown'/u);
  assert.match(stockHolds, /set inventory = inventory \+ \$1/u);
  assert.match(
    stockHolds,
    /set state = 'released',[\s\S]*?where id = \$4[\s\S]*?and state = 'held'/u
  );
  assert.doesNotMatch(stockHolds, /where order_id = \$1[\s\S]*?state = 'released'[\s\S]*?inventory = inventory \+/u);

  assert.match(statusRoute, /status !== 'cancelled'[\s\S]*?!effectiveContractAccepted/u);
  assert.match(paymentRoute, /\['paid', 'refunded'\][\s\S]*?contract_status[\s\S]*?!== 'accepted'/u);
  assert.match(documentRoute, /type !== 'order_summary'[\s\S]*?contract_status[\s\S]*?!== 'accepted'/u);

  for (const eventType of ['order_submitted', 'order_accepted', 'order_rejected']) {
    assert.match(emailSettings, new RegExp(`value: '${eventType}'`, 'u'));
  }
  assert.match(
    emailSettings,
    /Prejeli smo va\\u0161e naro\\u010dilo\. Naro\\u010dilo \\u0161e ni potrjeno/u
  );
  assert.match(emailSettings, /Va\\u0161e naro\\u010dilo je potrjeno/u);
  assert.match(emailSettings, /Va\\u0161e naro\\u010dilo ni bilo sprejeto/u);
});

test('accepted quote traceability is bidirectional and analytics count only committed contracts', () => {
  const quotes = source('src/shared/server/quotes.ts');
  const orders = source('src/shared/server/orders.ts');
  const analytics = source('src/shared/server/businessAnalytics.ts');
  const customers = source('src/shared/server/customerDirectory.ts');

  assert.match(quotes, /if \(filter === 'ordered'\) return `qr\.status in \('accepted','converted_to_order'\)`/u);
  assert.match(
    quotes,
    /qr\.request_number ilike[\s\S]*?searchable_offer\.offer_number ilike[\s\S]*?searchable_order\.order_number::text ilike/u
  );
  assert.match(
    quotes,
    /linked_order\.source_quote_offer_version_id[\s\S]*?resulting_order_number/u
  );
  assert.match(
    orders,
    /related_offer\.id = orders\.source_quote_offer_version_id[\s\S]*?source_quote_request_number[\s\S]*?source_quote_offer_number/u
  );
  assert.match(
    orders,
    /related_offer\.offer_number ilike[\s\S]*?related_request\.request_number ilike/u
  );

  assert.match(
    analytics,
    /row\.contract_status === 'accepted'[\s\S]*?row\.commitment_status === 'binding'/u
  );
  assert.match(
    analytics,
    /fulfilledAt: contractEligible \? iso\(row\.analytics_fulfilled_at\)/u
  );
  assert.match(
    customers,
    /contract_status = 'accepted'[\s\S]*?commitment_status = 'binding'[\s\S]*?status <> 'cancelled'/u
  );
  assert.match(analytics, /first_issue[\s\S]*?order by quote_request_id, issued_at, version_number, id/u);
  assert.match(analytics, /acceptance_facts[\s\S]*?quote_offer_acceptances[\s\S]*?union all[\s\S]*?first_acceptance[\s\S]*?group by quote_request_id/u);
  assert.match(analytics, /order_record\.deleted_at is null[\s\S]*?order_record\.is_draft = false/u);
  assert.match(analytics, /candidate\.opportunity_order_rank = 1/u);
});

test('offer verification status is scoped to the current CSRF-bound access session', () => {
  const offer = source('src/commercial/api/quote-requests/offer/route.ts');
  const client = source(
    'src/commercial/quote/components/QuoteOfferReviewPageClient.tsx'
  );

  assert.match(offer, /scope: 'offer_review',[\s\S]*?requireCsrf: true/u);
  assert.match(offer, /!access\.accessSessionHash/u);
  assert.match(
    offer,
    /from quote_email_verifications[\s\S]*?and access_session_hash = \$3[\s\S]*?access\.accessSessionHash/u
  );
  assert.match(
    client,
    /fetch\('\/api\/quote-requests\/offer'[\s\S]*?headers: buildQuoteAccessHeaders\(session, true\)/u
  );
});

test('offer-template admin surfaces fail closed with quote admin disabled', () => {
  const api = source('src/admin/api/order-document-templates/route.ts');
  const preview = source(
    'src/admin/api/order-document-templates/preview/route.ts'
  );
  const storage = source('src/shared/server/orderDocumentTemplates.ts');
  const page = source('src/admin/pages/urejevalnik/page.tsx');
  const editor = source(
    'src/admin/features/urejevalnik/components/AdminOrderDocumentTemplateEditor.tsx'
  );

  assert.match(api, /isQuoteAdminEnabled/u);
  assert.match(api, /withoutQuoteOfferTemplate/u);
  assert.match(api, /preserveQuoteOfferTemplate: !quoteAdminEnabled/u);
  assert.match(
    storage,
    /preserveQuoteOfferTemplate[\s\S]*?offer: previousConfig\.templates\.offer/u
  );
  assert.match(
    preview,
    /type === 'offer' && !isQuoteAdminEnabled\(\)[\s\S]*?status: 404/u
  );
  assert.match(page, /withoutQuoteOfferTemplate/u);
  assert.match(page, /quoteOfferTemplateEnabled=\{quoteAdminEnabled\}/u);
  assert.match(editor, /quoteOfferTemplateEnabled \|\| type !== 'offer'/u);
});
