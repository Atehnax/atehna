import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { getOrderSubmissionStatusContent } from '../../src/commercial/order/components/OrderSubmissionStatus';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

test('order submission copy distinguishes committed orders from pending confirmations', () => {
  assert.deepEqual(getOrderSubmissionStatusContent('binding'), {
    eyebrow: 'Uspešno oddano',
    heading: 'Naročilo je sprejeto',
    description:
      'Potrditev je shranjena na tej strani. Za nadaljnje usklajevanje bomo uporabili navedeni e-poštni naslov; plačilo uredimo ročno po ponudbi ali predračunu.',
    symbol: '✓',
    tone: 'success'
  });
  assert.deepEqual(getOrderSubmissionStatusContent('pending_confirmation'), {
    eyebrow: 'Potrditev',
    heading: 'Naročilo je prejeto',
    description:
      'Vaše naročilo bomo pregledali in vam poslali ponudbo oziroma navodila za naročilnico. Zaloga do potrditve še ni rezervirana.',
    symbol: '…',
    tone: 'info'
  });
  assert.deepEqual(getOrderSubmissionStatusContent('rejected'), {
    eyebrow: 'Stanje naročila',
    heading: 'Naročilo ni bilo potrjeno',
    description:
      'Za pojasnilo se obrnite na našo ekipo z istega e-poštnega naslova, ki ste ga uporabili pri naročilu.',
    symbol: '!',
    tone: 'danger'
  });
  assert.doesNotMatch(
    getOrderSubmissionStatusContent('rejected').description,
    /številk[ao] naročila/iu
  );
});

test('order creation durably enqueues its summary before commit without awaiting generation', () => {
  const routeSource = source('src/commercial/api/orders/route.ts');
  const jobSource = source('src/shared/server/orderSummaryJobs.ts');
  const schemaSource = source('database/schema.sql');
  const postHandlerIndex = routeSource.indexOf(
    'export async function POST(request: Request)'
  );
  const storedResponseIndex = routeSource.indexOf(
    'const storedResponse: StoredOrderResponse',
    postHandlerIndex
  );
  const enqueueIndex = routeSource.indexOf(
    'await enqueueInitialOrderSummaryJob(client, storedResponse);',
    storedResponseIndex
  );
  const commitIndex = routeSource.indexOf(
    "await client.query('commit');",
    enqueueIndex
  );
  const scheduleIndex = routeSource.indexOf(
    'scheduleInitialOrderSummaryJob(pool, inserted.orderId);',
    commitIndex
  );
  const immediateRevalidationIndex = routeSource.indexOf(
    'safelyRevalidateAdminOrderPaths(inserted.orderId);',
    scheduleIndex
  );
  const responseIndex = routeSource.indexOf(
    'return createCustomerOrderResponse(',
    immediateRevalidationIndex
  );

  assert.ok(
    enqueueIndex >= 0 &&
      enqueueIndex < commitIndex &&
      commitIndex < scheduleIndex &&
      scheduleIndex < immediateRevalidationIndex &&
      immediateRevalidationIndex < responseIndex,
    'the durable job must commit before best-effort processing is scheduled and the response is returned'
  );
  assert.doesNotMatch(
    routeSource.slice(commitIndex, responseIndex),
    /await processInitialOrderSummaryJob/u,
    'document generation must not be awaited in the response critical path'
  );
  assert.match(
    schemaSource,
    /create table order_document_jobs[\s\S]*?unique \(order_id, document_type\)/u
  );
  assert.match(
    jobSource,
    /function scheduleInitialOrderSummaryJob[\s\S]*?after\(async \(\) => \{[\s\S]*?processInitialOrderSummaryJob/u,
    'after() is only a low-latency trigger for work already persisted in the order transaction'
  );
  assert.match(jobSource, /status = 'pending'[\s\S]*?next_attempt_at/u);
  assert.match(jobSource, /status = 'processing'[\s\S]*?locked_at/u);
  assert.match(jobSource, /status = 'completed'/u);
  assert.match(jobSource, /power\(2, least\(attempts, 6\)\)/u);
});

test('idempotent replay and authenticated confirmation retrigger the durable summary job', () => {
  const routeSource = source('src/commercial/api/orders/route.ts');
  const jobSource = source('src/shared/server/orderSummaryJobs.ts');
  const confirmationSource = source(
    'src/commercial/api/orders/confirmation/route.ts'
  );
  const replayIndex = routeSource.indexOf("if (reservation.kind === 'replay')");
  const replayResponseIndex = routeSource.indexOf(
    'return createCustomerOrderResponse(',
    replayIndex
  );
  const replaySource = routeSource.slice(replayIndex, replayResponseIndex);

  assert.match(
    replaySource,
    /scheduleInitialOrderSummaryJob\(pool, reservation\.orderId\);/u
  );
  assert.doesNotMatch(replaySource, /await processInitialOrderSummaryJob/u);
  assert.match(
    confirmationSource,
    /verifyConfirmationRequest[\s\S]*?scheduleConfirmationDocumentRepairSafely\([\s\S]*?scheduleInitialOrderSummaryJob\(pool, access\.orderId\)[\s\S]*?reportDocumentSubsystemFailure\('scheduling', access\.orderId, error\)/u,
    'only a verified customer confirmation request may trigger customer-side repair'
  );
  assert.match(
    jobSource,
    /status = 'processing'[\s\S]*?locked_at <= now\(\) - \$2::interval/u,
    'a crashed worker claim must become retryable'
  );
  assert.match(
    jobSource,
    /select 1[\s\S]*?from order_documents[\s\S]*?type = 'order_summary'[\s\S]*?deleted_at is null[\s\S]*?limit 1/u,
    'concurrent repairs should deduplicate against an already-persisted summary'
  );
  assert.match(
    jobSource,
    /where id = \$1[\s\S]*?and claim_id = \$2/u,
    'a stale worker must not overwrite the retry state of a newer claim'
  );
  assert.doesNotMatch(
    jobSource,
    /select blob_url/u,
    'summary repair needs only an existence sentinel, never a raw Blob location'
  );
  assert.doesNotMatch(
    routeSource,
    /createInitialOrderSummary/u,
    'the request route must not retain the superseded one-shot generator'
  );
});

test('checkout keeps an accessible loading handoff visible through cleanup and navigation', () => {
  const pageSource = source(
    'src/commercial/order/components/OrderPageClient.tsx'
  );
  const loadingSource = source(
    'src/commercial/order/components/OrderLoadingState.tsx'
  );
  const submittingIndex = pageSource.indexOf(
    "setSubmissionPhase('submitting');"
  );
  const selectorIndex = pageSource.indexOf(
    'storeOrderAccessId(accessId);'
  );
  const openingIndex = pageSource.indexOf(
    "setSubmissionPhase('opening-confirmation');",
    selectorIndex
  );
  const clearCartIndex = pageSource.indexOf('clearCart();', openingIndex);
  const clearFormIndex = pageSource.indexOf(
    'sessionStorage.removeItem(FORM_STORAGE_KEY);',
    clearCartIndex
  );
  const navigationIndex = pageSource.indexOf(
    "window.location.replace('/order/confirmation');",
    clearFormIndex
  );
  const errorResetIndex = pageSource.indexOf(
    "setSubmissionPhase('idle');",
    navigationIndex
  );
  const handoffBranchIndex = pageSource.indexOf(
    "if (submissionPhase !== 'idle') {"
  );
  const emptyCartBranchIndex = pageSource.indexOf(
    'if (items.length === 0) {'
  );

  assert.ok(
    submittingIndex >= 0 &&
      submittingIndex < selectorIndex &&
      selectorIndex < openingIndex &&
      openingIndex < clearCartIndex &&
      clearCartIndex < clearFormIndex &&
      clearFormIndex < navigationIndex,
    'submission must visibly advance to confirmation handoff before cart cleanup and navigation'
  );
  assert.ok(
    errorResetIndex > navigationIndex,
    'a failed request must restore the checkout instead of leaving it in a loading state'
  );
  assert.ok(
    handoffBranchIndex >= 0 && handoffBranchIndex < emptyCartBranchIndex,
    'the loading handoff must win over the empty-cart fallback after successful cleanup'
  );
  assert.match(
    pageSource,
    /flushSync\(\(\) => \{\s*setSubmissionPhase\('opening-confirmation'\);\s*\}\);/u,
    'the success handoff must commit before synchronous cart cleanup and navigation'
  );
  assert.match(pageSource, /testId="order-submission-handoff"/u);
  assert.match(pageSource, /spinnerTestId="order-submission-spinner"/u);
  assert.match(loadingSource, /role="status"/u);
  assert.match(loadingSource, /aria-live="polite"/u);
  assert.match(loadingSource, /aria-atomic="true"/u);
  assert.match(loadingSource, /aria-busy="true"/u);
  assert.match(loadingSource, /animate-spin/u);
  assert.match(loadingSource, /motion-reduce:animate-none/u);
  assert.match(loadingSource, /var\(--site-color-primary\)/u);
  assert.match(pageSource, /Oddajamo naročilo/u);
  assert.match(pageSource, /Odpiramo potrditev naročila/u);
  assert.match(pageSource, /ne zapirajte strani/u);
  assert.match(
    pageSource,
    /window\.location\.replace\('\/order\/confirmation'\);/u,
    'confirmation navigation must remain a bare URL without a customer credential'
  );
  assert.doesNotMatch(
    pageSource.slice(navigationIndex, navigationIndex + 90),
    /[?#]|access|token/iu,
    'confirmation navigation must not leak an access selector or token in the URL'
  );
});

test('the confirmation destination immediately renders the shared accessible loader', () => {
  const pageSource = source(
    'src/commercial/order/components/OrderConfirmationPageClient.tsx'
  );
  const loadingSource = source(
    'src/commercial/order/components/OrderLoadingState.tsx'
  );

  assert.match(
    pageSource,
    /if \(state\.status === 'loading'\) \{[\s\S]*?<OrderLoadingState/u
  );
  assert.match(pageSource, /heading="Nalagamo potrditev naročila"/u);
  assert.match(pageSource, /Prosimo, počakajte/u);
  assert.match(pageSource, /ariaLabel="Nalaganje potrditve naročila"/u);
  assert.match(pageSource, /testId="order-confirmation-loading"/u);
  assert.match(loadingSource, /role="status"/u);
  assert.match(loadingSource, /aria-live="polite"/u);
  assert.match(loadingSource, /aria-atomic="true"/u);
  assert.match(loadingSource, /aria-busy="true"/u);
  assert.match(loadingSource, /animate-spin/u);
});
