import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import type { CartItem } from '../../src/commercial/cart/cartTypes';
import { buildOrderQuoteRequestKey, normalizeOrderQuoteCustomerName } from '../../src/commercial/order/useOrderQuote';

const source = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

const requestKeyItem = {
  lineId: 'line-1',
  quantity: 30,
  variant: { id: 41001 }
} as CartItem;

test('customer-aware quote keys normalize and distinguish discount targets', () => {
  assert.equal(normalizeOrderQuoteCustomerName(), '');
  assert.equal(normalizeOrderQuoteCustomerName('  Primer d.o.o.  '), 'Primer d.o.o.');
  assert.equal(
    buildOrderQuoteRequestKey([requestKeyItem], '  Primer d.o.o.  '),
    buildOrderQuoteRequestKey([requestKeyItem], 'Primer d.o.o.')
  );
  assert.notEqual(
    buildOrderQuoteRequestKey([requestKeyItem], 'Primer d.o.o.'),
    buildOrderQuoteRequestKey([requestKeyItem], 'Drugi kupec')
  );
  assert.equal(buildOrderQuoteRequestKey([], 'Primer d.o.o.'), '');
});

test('checkout sends the normalized customer label and invalidates stale quotes', () => {
  const hookSource = source('src/commercial/order/useOrderQuote.ts');
  const pageSource = source('src/commercial/order/components/OrderPageClient.tsx');
  const cartPageSource = source('src/commercial/features/cart/CartPageClient.tsx');
  const cartDrawerSource = source('src/commercial/features/cart/CartDrawer.tsx');

  assert.match(hookSource, /body: JSON\.stringify\(\{\s*customerName: normalizedCustomerName,/u);
  const clearQuoteIndex = hookSource.indexOf('setState({ quote: null, isLoading: true, error: null });');
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
  assert.match(pageSource, /useOrderQuote\(\s*items,\s*items\.length > 0,\s*quoteCustomerName\s*\)/u);
  assert.match(cartPageSource, /useOrderQuote\(items, items\.length > 0\)/u);
  assert.match(cartDrawerSource, /useOrderQuote\(items, isOpen && items\.length > 0\)/u);
});
