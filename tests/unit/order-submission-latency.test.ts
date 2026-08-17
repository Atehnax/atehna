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
    heading: 'Zahteva je prejeta',
    description:
      'Vašo zahtevo bomo pregledali in vam poslali ponudbo oziroma navodila za naročilnico. Zaloga do potrditve še ni rezervirana.',
    symbol: '…',
    tone: 'warning'
  });
});

test('order creation responds after commit without awaiting fallible post-commit work', () => {
  const routeSource = source('src/commercial/api/orders/route.ts');
  const postHandlerIndex = routeSource.indexOf(
    'export async function POST(request: Request)'
  );
  const storedResponseIndex = routeSource.indexOf(
    'const storedResponse: StoredOrderResponse',
    postHandlerIndex
  );
  const commitIndex = routeSource.indexOf(
    "await client.query('commit');",
    storedResponseIndex
  );
  const scheduleIndex = routeSource.indexOf(
    'scheduleInitialOrderSummary(pool, storedResponse, keyHash);',
    commitIndex
  );
  const immediateRevalidationIndex = routeSource.indexOf(
    'safelyRevalidateAdminOrderPaths(inserted.orderId);',
    scheduleIndex
  );
  const responseIndex = routeSource.indexOf(
    'return NextResponse.json(',
    immediateRevalidationIndex
  );

  assert.ok(
    commitIndex >= 0 &&
      commitIndex < scheduleIndex &&
      scheduleIndex < immediateRevalidationIndex &&
      immediateRevalidationIndex < responseIndex,
    'tracked summary work must be registered before guarded cache invalidation and the response'
  );
  assert.doesNotMatch(
    routeSource.slice(commitIndex, responseIndex),
    /createInitialOrderSummary/u,
    'document generation must not be awaited in the response critical path'
  );
  assert.match(
    routeSource.slice(responseIndex, responseIndex + 220),
    /\.\.\.storedResponse/u
  );
  assert.match(
    routeSource,
    /function safelyRevalidateAdminOrderPaths[\s\S]*?try \{[\s\S]*?revalidateAdminOrderPaths\(orderId\);[\s\S]*?catch/u
  );
  assert.match(
    routeSource,
    /function scheduleInitialOrderSummary[\s\S]*?after\(async \(\) => \{[\s\S]*?await createInitialOrderSummary/u
  );
});

test('idempotent replay repairs a missing summary without delaying its response', () => {
  const routeSource = source('src/commercial/api/orders/route.ts');
  const replayIndex = routeSource.indexOf("if (reservation.kind === 'replay')");
  const replayResponseIndex = routeSource.indexOf(
    'return NextResponse.json(',
    replayIndex
  );
  const replaySource = routeSource.slice(replayIndex, replayResponseIndex);

  assert.match(
    replaySource,
    /if \(!reservation\.response\.documentUrl\) \{[\s\S]*?scheduleInitialOrderSummary\(pool, reservation\.response, keyHash\);/u
  );
  assert.doesNotMatch(replaySource, /await createInitialOrderSummary/u);
  assert.match(
    routeSource,
    /select blob_url[\s\S]*?type = 'order_summary'[\s\S]*?limit 1/u,
    'concurrent repairs should reuse an already-persisted summary'
  );
});

test('checkout commits its transition before isolated cleanup and navigation', () => {
  const pageSource = source(
    'src/commercial/order/components/OrderPageClient.tsx'
  );
  const submittedIndex = pageSource.indexOf('setSubmittedOrder({');
  const submitCatchIndex = pageSource.indexOf('} catch (error) {', submittedIndex);
  const submitSuccessSource = pageSource.slice(submittedIndex, submitCatchIndex);
  const transitionEffectIndex = pageSource.indexOf(
    'if (!submittedOrder || submittedTransitionHandledRef.current) return;'
  );
  const clearCartIndex = pageSource.indexOf('clearCart();', transitionEffectIndex);
  const navigationIndex = pageSource.indexOf(
    'router.push(submittedOrder.confirmationUrl);',
    clearCartIndex
  );
  const transitionBranchIndex = pageSource.indexOf('if (submittedOrder) {');
  const emptyCartBranchIndex = pageSource.indexOf('if (items.length === 0) {');

  assert.ok(
    submittedIndex >= 0 && transitionEffectIndex >= 0,
    'the committed transition and its follow-up effect must exist'
  );
  assert.doesNotMatch(
    submitSuccessSource,
    /clearCart\(\)|sessionStorage\.removeItem|router\.push/u,
    'cleanup and navigation must wait for the committed transition effect'
  );
  assert.ok(
    transitionEffectIndex < clearCartIndex && clearCartIndex < navigationIndex,
    'cleanup and navigation should run only inside the guarded transition effect'
  );
  assert.ok(
    transitionBranchIndex >= 0 && transitionBranchIndex < emptyCartBranchIndex,
    'the committed transition must win over the empty-cart fallback'
  );
  assert.match(pageSource, /<OrderSubmissionStatus/u);
  assert.match(pageSource, /data-testid="order-submission-transition"/u);
  assert.match(pageSource, /confirmationUrl,/u);
  assert.match(pageSource, /href=\{submittedOrder\.confirmationUrl\}/u);
  assert.match(pageSource, /Odpri potrditev naročila/u);
});
