import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import type { CartItem } from '../../src/commercial/cart/cartTypes';
import {
  buildOrderEstimateRequestKey,
  normalizeOrderEstimateCustomerLabels,
  normalizeOrderEstimateCustomerName
} from '../../src/commercial/order/useOrderEstimate';

const source = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

const requestKeyItem = {
  lineId: 'line-1',
  quantity: 30,
  variant: { id: 41001 }
} as CartItem;

test('customer-aware estimate keys normalize and distinguish discount targets', () => {
  assert.equal(normalizeOrderEstimateCustomerName(), '');
  assert.equal(normalizeOrderEstimateCustomerName('  Primer d.o.o.  '), 'Primer d.o.o.');
  assert.equal(
    buildOrderEstimateRequestKey([requestKeyItem], '  Primer d.o.o.  '),
    buildOrderEstimateRequestKey([requestKeyItem], 'Primer d.o.o.')
  );
  assert.notEqual(
    buildOrderEstimateRequestKey([requestKeyItem], 'Primer d.o.o.'),
    buildOrderEstimateRequestKey([requestKeyItem], 'Drugi kupec')
  );
  assert.equal(buildOrderEstimateRequestKey([], 'Primer d.o.o.'), '');
  assert.deepEqual(
    normalizeOrderEstimateCustomerLabels(' Primer d.o.o. ', [
      'ANA NOVAK',
      'primer d.o.o.'
    ]),
    ['ana novak', 'primer d.o.o.']
  );
  assert.notEqual(
    buildOrderEstimateRequestKey(
      [requestKeyItem],
      'Primer d.o.o.',
      ['Ana Novak']
    ),
    buildOrderEstimateRequestKey(
      [requestKeyItem],
      'Primer d.o.o.',
      ['Boris Novak']
    )
  );
});

test('checkout sends normalized customer labels and invalidates stale estimates', () => {
  const hookSource = source('src/commercial/order/useOrderEstimate.ts');
  const pageSource = source('src/commercial/order/components/OrderPageClient.tsx');
  const cartPageSource = source('src/commercial/features/cart/CartPageClient.tsx');
  const cartDrawerSource = source('src/commercial/features/cart/CartDrawer.tsx');

  assert.match(
    hookSource,
    /body: JSON\.stringify\(\{\s*customerName: normalizedCustomerName,\s*customerLabels: normalizedCustomerLabels,/u
  );
  const clearQuoteIndex = hookSource.indexOf('setState({ estimate: null, isLoading: true, error: null });');
  const debounceIndex = hookSource.indexOf('const timeout = window.setTimeout(async () => {');
  assert.ok(
    clearQuoteIndex >= 0 && clearQuoteIndex < debounceIndex,
    'a previous customer quote must be cleared before the refreshed quote is debounced'
  );
  assert.match(
    hookSource,
    /controller\.signal\.aborted \|\| latestRequestKeyRef\.current !== requestKey/u,
    'a superseded response must not update cart reconciliation or quote state'
  );

  assert.match(
    pageSource,
    /formData\.customerType === 'individual'[\s\S]*?formData\.firstName\.trim\(\)[\s\S]*?formData\.lastName\.trim\(\)/u
  );
  assert.match(
    pageSource,
    /formData\.customerType === 'company'[\s\S]*?formData\.customerType === 'school'[\s\S]*?formData\.organizationName\.trim\(\)/u
  );
  assert.match(
    pageSource,
    /useOrderEstimate\(\s*items,\s*items\.length > 0,\s*estimateCustomerName,\s*estimateCustomerLabels\s*\)/u
  );
  assert.match(cartPageSource, /useOrderEstimate\(items, items\.length > 0\)/u);
  assert.match(cartDrawerSource, /useOrderEstimate\(items, isOpen && items\.length > 0\)/u);
  assert.match(
    pageSource,
    /const currentShipping = estimateState\.estimate\.shipping;[\s\S]*?shippingConfigurationVersion:\s*currentShipping\.configurationVersion,[\s\S]*?quoteFingerprint:\s*estimateState\.estimate\.quoteFingerprint/u
  );
  assert.match(
    pageSource,
    /error\.code === 'SHIPPING_QUOTE_CHANGED'[\s\S]*?error\.code === 'ESTIMATE_CHANGED'[\s\S]*?idempotencyKeyRefs\.current\[intent\] = null;[\s\S]*?estimateState\.refresh\(\);[\s\S]*?return;/u,
    'a stale estimate must be refreshed without accepting or clearing the cart'
  );
  assert.match(
    pageSource,
    /intent === 'order' && currentShipping\.status === 'manual_quote'/u,
    'manual shipping must block only the direct-order intent'
  );
  assert.match(
    pageSource,
    /quoteRequestsEnabled && checkoutIntent === 'quote_request'[\s\S]*?value=\{activeCheckoutIntent\}/u
  );
  assert.match(
    pageSource,
    /quoteReason: STOREFRONT_QUOTE_REASON,[\s\S]*?quoteMessage: formData\.quoteMessage\.trim\(\)/u
  );
});
