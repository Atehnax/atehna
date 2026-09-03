import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  cloneDefaultQuoteEmailSettings,
  normalizeQuoteEmailSettings,
  QUOTE_EMAIL_EDITABLE_EVENT_DEFINITIONS,
  validateQuoteEmailSettings
} from '../../src/shared/domain/quote/quoteEmailSettings';
import { getQuoteCustomerMessage } from '../../src/shared/domain/quote/quoteCustomerMessage';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const lifecycleRoutes = ['preview', 'revise', 'withdraw', 'close', 'clarification', 'status', 'notes', 'title'] as const;

test('legacy quote messages are combined once without losing distinct text', () => {
  assert.equal(getQuoteCustomerMessage('Pozdrav', 'Opomba'), 'Pozdrav\n\nOpomba');
  assert.equal(getQuoteCustomerMessage('Enako', 'Enako'), 'Enako');
  assert.equal(getQuoteCustomerMessage(null, '  Samo opomba  '), 'Samo opomba');
});

test('every quote admin lifecycle endpoint has feature and signed-session guards plus an app wrapper', () => {
  for (const route of lifecycleRoutes) {
    const implementation = source(
      `src/admin/api/quote-requests/[quoteRequestId]/${route}/route.ts`
    );
    const wrapper = source(
      `src/app/api/admin/quote-requests/[quoteRequestId]/${route}/route.ts`
    );
    assert.match(implementation, /isQuoteAdminEnabled/u);
    assert.match(implementation, /hasValidQuoteAdminSession\(request\)/u);
    assert.match(implementation, /status: 401/u);
    assert.match(wrapper, new RegExp(`quote-requests/\\[quoteRequestId\\]/${route}/route`, 'u'));
  }
});

test('preview renders the saved draft without storing or binding a document', () => {
  const route = source('src/admin/api/quote-requests/[quoteRequestId]/preview/route.ts');
  const renderer = source('src/shared/server/quoteDocumentJobs.ts');
  assert.match(route, /expectedStateVersion/u);
  assert.match(route, /status !== 'draft'/u);
  assert.match(route, /mode: 'preview'/u);
  assert.match(route, /preview_generated/u);
  assert.match(route, /storedDocument: false/u);
  assert.doesNotMatch(route, /insert into quote_documents|document_sha256/u);
  assert.match(renderer, /PREDOGLED – ponudba še ni izdana/u);
  assert.match(renderer, /Pogoji sprejema:/u);
});

test('revision copies an immutable source into a new draft and never supersedes it early', () => {
  const route = source('src/admin/api/quote-requests/[quoteRequestId]/revise/route.ts');
  const revision = source('src/shared/server/quoteOfferRevision.ts');
  assert.match(route, /'issued', 'withdrawn', 'expired'/u);
  assert.match(route, /createQuoteOfferDraftRevision\(client/u);
  assert.doesNotMatch(route, /insert into quote_offer_versions/u);
  assert.doesNotMatch(route, /insert into quote_offer_version_items/u);
  assert.match(revision, /insert into quote_offer_versions/u);
  assert.match(revision, /insert into quote_offer_version_items/u);
  assert.match(revision, /input\.source\.terms_text/u);
  assert.match(route, /sourceRemainsCurrentUntilIssue/u);
  assert.match(route, /status = 'in_preparation'/u);
  assert.doesNotMatch(route, /update quote_offer_versions/u);
  assert.doesNotMatch(revision, /update quote_offer_versions/u);
  assert.doesNotMatch(route, /status = 'superseded'/u);
});

test('withdrawal and close use distinct legal transitions and revoke access', () => {
  const withdraw = source('src/admin/api/quote-requests/[quoteRequestId]/withdraw/route.ts');
  const close = source('src/admin/api/quote-requests/[quoteRequestId]/close/route.ts');
  const helpers = source('src/admin/api/quote-requests/quoteAdminRouteUtils.ts');

  assert.match(withdraw, /offer\.status !== 'issued' \|\| offer\.is_current !== true/u);
  assert.match(withdraw, /status = 'withdrawn'/u);
  assert.match(withdraw, /withdrawal_reason/u);
  assert.match(withdraw, /revokeQuoteAccessForOffer/u);
  assert.match(withdraw, /eventType: 'offer_withdrawn'/u);
  assert.match(withdraw, /enqueueQuoteEmailIsolated/u);

  assert.match(close, /count\(\*\) filter \(where status <> 'draft'\)/u);
  assert.match(close, /status = 'closed_without_offer'/u);
  assert.match(close, /request_closed_without_offer/u);
  assert.match(close, /update quote_access_tokens/u);
  assert.doesNotMatch(close, /update quote_offer_versions/u);

  assert.match(helpers, /savepoint quote_admin_email/u);
  assert.match(helpers, /rollback to savepoint quote_admin_email/u);
  assert.match(helpers, /quote_email_provider_failed/u);
});

test('manual quote-email retry validates encrypted payload and suppresses obsolete links and OTP', () => {
  const route = source('src/admin/api/quote-email-jobs/[jobId]/retry/route.ts');
  const retryEligibility = source(
    'src/shared/domain/quote/quoteEmailRetryEligibility.ts'
  );
  const wrapper = source('src/app/api/admin/quote-email-jobs/[jobId]/retry/route.ts');
  assert.match(route, /hasValidQuoteAdminSession\(request\)/u);
  assert.doesNotMatch(route, /isQuoteEmailDeliveryEnabled/u);
  assert.match(route, /quoteEmailRetryStateIsCurrent/u);
  assert.match(route, /return quoteEmailRetryStateIsCurrent\(\{/u);
  assert.match(retryEligibility, /eventType === 'quote_access_otp'/u);
  assert.match(retryEligibility, /job\.offerStatus === 'issued'/u);
  assert.match(retryEligibility, /job\.offerIsCurrent/u);
  assert.match(route, /decryptQuoteEmailEnvelope/u);
  assert.match(route, /status = 'pending'/u);
  assert.match(route, /scheduleQuoteEmailJobs\(pool\)/u);
  assert.match(wrapper, /quote-email-jobs\/\[jobId\]\/retry\/route/u);
});

test('admin quote document download is authenticated, private, and request-scoped', () => {
  const route = source(
    'src/admin/api/quote-requests/[quoteRequestId]/documents/[documentId]/route.ts'
  );
  const wrapper = source(
    'src/app/api/admin/quote-requests/[quoteRequestId]/documents/[documentId]/route.ts'
  );
  assert.match(route, /hasValidQuoteAdminSession\(request\)/u);
  assert.match(route, /from quote_manual_documents manual/u);
  assert.match(route, /located\.id = \$1/u);
  assert.match(route, /located\.quote_request_id = \$2/u);
  assert.match(route, /readPrivateOrderDocumentBlob/u);
  assert.match(route, /no-store, private/u);
  assert.match(route, /application\/pdf/u);
  assert.match(route, /image\/jpeg/u);
  assert.match(wrapper, /documents\/\[documentId\]\/route/u);
});

test('admin quote document generation is authenticated, request-scoped, targeted, and immutable', () => {
  const route = source(
    'src/admin/api/quote-requests/[quoteRequestId]/documents/route.ts'
  );
  const wrapper = source(
    'src/app/api/admin/quote-requests/[quoteRequestId]/documents/route.ts'
  );
  const worker = source('src/shared/server/quoteDocumentJobs.ts');

  assert.match(route, /isQuoteAdminEnabled/u);
  assert.match(route, /hasValidQuoteAdminSession\(request\)/u);
  assert.match(route, /status: 401/u);
  assert.match(route, /offer\.quote_request_id = \$2/u);
  assert.match(route, /ISSUED_LIFECYCLE_STATUSES/u);
  assert.match(route, /quote_document_jobs/u);
  assert.match(route, /processQuoteDocumentJobs\(pool, \{[\s\S]*?offerVersionId/u);
  assert.match(route, /created: false/u);
  assert.doesNotMatch(route, /renderQuoteOfferPdf|insert into quote_documents/u);
  assert.match(wrapper, /quote-requests\/\[quoteRequestId\]\/documents\/route/u);

  assert.match(worker, /offerVersionId: number \| null/u);
  assert.match(worker, /claim\(pool, offerVersionId\)/u);
  assert.match(worker, /lockQuoteWorkflow\(client, quoteRequestId\)/u);
  assert.match(worker, /request\.voided_at/u);
  assert.match(worker, /frozenIssuedPdf\(job\.payload, current\)/u);
  assert.match(worker, /on conflict \(quote_offer_version_id, document_type, version_number\)/u);
  assert.match(worker, /processQuoteEmailJobs/u);
  assert.match(worker, /last_error like '\[document_pending\]%'/u);
  assert.match(
    worker,
    /result\.completed === 0[\s\S]*?processQuoteEmailJobs\(pool, \{ limit: 10 \}\)/u
  );
});

test('clarification is idempotently recorded before an optional isolated customer email', () => {
  const route = source(
    'src/admin/api/quote-requests/[quoteRequestId]/clarification/route.ts'
  );
  const ui = source(
    'src/admin/features/quotes/components/AdminQuoteDetailClient.tsx'
  );
  const helpers = source(
    'src/admin/api/quote-requests/quoteAdminRouteUtils.ts'
  );

  assert.match(route, /typeof parsed\.body\.sendEmail !== 'boolean'/u);
  assert.match(route, /const sendEmail = parsed\.body\.sendEmail/u);
  assert.match(route, /parsed\.body\.actionId/u);
  assert.match(route, /UUID_PATTERN/u);
  assert.match(route, /expectedRequestStateVersion/u);
  assert.match(route, /code: 'QUOTE_REQUEST_CONFLICT'/u);
  assert.match(route, /CLARIFICATION_IDEMPOTENCY_CONFLICT/u);
  assert.match(
    route,
    /clarification-requested:\$\{quoteRequestId\}:\$\{actionId\}/u
  );
  assert.match(
    route,
    /quote-clarification-requested:\$\{quoteRequestId\}:\$\{actionId\}/u
  );
  assert.match(route, /eventType: 'clarification_requested'/u);
  assert.match(route, /eventType: 'quote_clarification_requested'/u);
  assert.doesNotMatch(helpers, /forceCustomer: input\.forceCustomer|suppressAdmin: input\.suppressAdmin/u);
  assert.match(route, /commercialStateChanged: false/u);
  assert.match(route, /mirrorQuoteAdminAudit/u);
  assert.match(route, /enqueueQuoteEmailIsolated/u);
  assert.match(helpers, /savepoint quote_admin_email/u);
  assert.match(helpers, /rollback to savepoint quote_admin_email/u);
  assert.match(route, /recorded: true/u);
  assert.match(route, /replayed/u);
  assert.match(route, /emailRequested/u);
  assert.match(route, /emailQueued/u);
  assert.match(route, /emailStatus/u);
  assert.match(route, /stateChanged: false/u);
  const replayBranch = route.slice(
    route.indexOf('if (existingEvent)'),
    route.indexOf('if (quoteRequest.voided_at)')
  );
  assert.match(replayBranch, /let replayEmailQueued = false/u);
  assert.match(
    replayBranch,
    /sendEmail[\s\S]*?!existingEmailJob[\s\S]*?OPEN_REQUEST_STATUSES/u
  );
  assert.match(
    replayBranch,
    /enqueueQuoteEmailIsolated[\s\S]*?eventKey: emailEventKey[\s\S]*?eventType: 'quote_clarification_requested'/u
  );
  assert.match(
    replayBranch,
    /client\.query\('commit'\)[\s\S]*?replayEmailQueued[\s\S]*?scheduleQuoteEmailJobs\(pool\)/u
  );
  assert.match(
    replayBranch,
    /emailQueued: Boolean\(existingEmailJob\) \|\| replayEmailQueued/u
  );
  assert.doesNotMatch(replayBranch, /appendQuoteEvent|mirrorQuoteAdminAudit/u);
  assert.match(
    route,
    /client\.query\('commit'\)[\s\S]*?scheduleQuoteEmailJobs\(pool\)/u
  );
  assert.doesNotMatch(route, /update quote_requests|update quote_offer_versions/u);
  assert.doesNotMatch(route, /mailto:|encodeURIComponent\(subject\)|encodeURIComponent\(body\)/u);
  assert.match(ui, /Prosi za pojasnilo/u);
  assert.match(ui, /\/clarification/u);
  assert.doesNotMatch(ui, /mailto:|window\.location\.assign/u);
});test('quote email settings have independent defaults, validation, API, and a separate admin section', () => {
  const first = cloneDefaultQuoteEmailSettings();
  const second = cloneDefaultQuoteEmailSettings();
  assert.equal(second.enabled, false);
  first.events.quote_issued.customer = false;
  assert.equal(second.events.quote_issued.customer, true);
  assert.equal(QUOTE_EMAIL_EDITABLE_EVENT_DEFINITIONS.length, 10);
  assert.deepEqual(second.events.quote_clarification_requested, {
    customer: true,
    admins: false
  });
  const fixedClarificationRecipients = normalizeQuoteEmailSettings({
    events: {
      quote_clarification_requested: {
        customer: false,
        admins: true
      }
    }
  });
  assert.deepEqual(fixedClarificationRecipients.events.quote_clarification_requested, {
    customer: false,
    admins: true
  });
  fixedClarificationRecipients.templates.quote_clarification_requested.admin.subject = '';
  fixedClarificationRecipients.templates.quote_clarification_requested.admin.body = '';
  assert.equal(
    validateQuoteEmailSettings(fixedClarificationRecipients).some((error) =>
      error.includes('quote_clarification_requested/admin')
    ),
    true
  );
  assert.deepEqual(second.events.quote_delivery_failed, {
    customer: false,
    admins: true
  });

  const normalized = normalizeQuoteEmailSettings({
    enabled: false,
    events: { quote_withdrawn: { customer: false, admins: true } }
  });
  assert.equal(normalized.enabled, false);
  assert.deepEqual(normalized.events.quote_withdrawn, {
    customer: false,
    admins: true
  });
  normalized.templates.quote_issued.customer.subject = '';
  assert.ok(validateQuoteEmailSettings(normalized).some((error) => error.includes('zadeva')));

  const api = source('src/admin/api/quote-email-settings/route.ts');
  const page = source('src/admin/pages/email/page.tsx');
  const orderUi = source(
    'src/admin/features/email/components/AdminOrderEmailSettingsPageClient.tsx'
  );
  const quoteUi = source(
    'src/admin/features/email/components/AdminQuoteEmailSettingsSection.tsx'
  );
  const worker = source('src/shared/server/quoteEmailJobs.ts');
  const featureFlags = source('src/shared/server/quoteFeatureFlags.ts');
  const otpRequest = source(
    'src/commercial/api/quote-requests/offer/otp/request/route.ts'
  );
  const templates = source(
    'src/shared/domain/quote/quoteEmailTemplates.ts'
  );
  assert.match(api, /hasValidQuoteAdminSession/u);
  assert.match(api, /updateQuoteEmailSettings/u);
  assert.match(page, /getQuoteEmailAdminState/u);
  assert.match(orderUi, /label: "Naročila"/u);
  assert.match(orderUi, /label: "Ponudbe"/u);
  assert.match(orderUi, /AdminQuoteEmailSettingsSection/u);
  assert.match(
    orderUi,
    /data-testid="quote-email-delivery-settings"[\s\S]*?Pošiljanje ponudb/u
  );
  assert.match(orderUi, /isti profil\s+pošiljatelja/u);
  assert.doesNotMatch(quoteUi, /Pošiljanje ponudb/u);
  assert.match(quoteUi, /sharedSettings: OrderEmailSettings/u);
  assert.match(orderUi, /sharedSettings=\{draft\}/u);
  assert.match(
    quoteUi,
    /sharedSettings:\s*\{[\s\S]*?\.\.\.sharedSettings/u
  );
  assert.match(quoteUi, /JSON\.stringify\(\{ config: submittedConfig \}\)/u);
  assert.doesNotMatch(
    quoteUi,
    /id=['"]quote-email-(?:sender|from|reply)/u
  );
  assert.doesNotMatch(quoteUi, /quoteEmailEventSupportsAdminAudience/u);
  assert.match(
    quoteUi,
    /checked=\{event\.customer\}[\s\S]*?disabled=\{mutationsDisabled\}/u
  );
  assert.match(
    quoteUi,
    /checked=\{event\.admins\}[\s\S]*?disabled=\{mutationsDisabled\}/u
  );
  assert.doesNotMatch(quoteUi, /Samo stranka|!supportsAdmin/u);
  assert.match(quoteUi, />Administratorji<\/TH>/u);
  assert.match(quoteUi, /forwardRef<[\s\S]*?AdminQuoteEmailSettingsHandle/u);
  assert.match(quoteUi, /onSaveStateChange\?\.\(\{/u);
  assert.match(orderUi, /data-testid="quote-email-save-status"/u);
  assert.match(orderUi, /data-testid="quote-email-settings-save"/u);
  assert.match(orderUi, /ref=\{quoteEmailSettingsRef\}/u);
  assert.match(orderUi, /onSaveStateChange=\{setQuoteEmailSaveState\}/u);
  assert.match(orderUi, /quoteEmailSettingsRef\.current\?\.setEnabled\(enabled\)/u);
  assert.match(
    quoteUi,
    /\(\['customer', 'admin'\] as const\)\.map\(\(audience\)/u
  );
  assert.match(templates, /QUOTE_EMAIL_EVENT_DEFAULTS/u);
  assert.doesNotMatch(worker, /forceCustomer|suppressAdmin/u);
  assert.match(worker, /if \(!settings\.enabled\) \{[\s\S]*?return \[\];/u);
  assert.doesNotMatch(worker, /settings\.enabled && input\.eventType/u);
  assert.doesNotMatch(worker, /isQuoteEmailDeliveryEnabled/u);
  assert.doesNotMatch(featureFlags, /isQuoteEmailDeliveryEnabled/u);
  assert.doesNotMatch(otpRequest, /isQuoteEmailDeliveryEnabled/u);
  assert.match(otpRequest, /if \(!isQuoteOnlineAcceptanceEnabled\(\)\)/u);
  assert.match(worker, /customerEnabled && EMAIL_PATTERN\.test\(identity\.email\)/u);
  assert.match(worker, /if \(adminEnabled\)/u);
  assert.match(worker, /if \(recipients\.length === 0\)/u);
  assert.match(templates, /Preglej ponudbo/u);
});
