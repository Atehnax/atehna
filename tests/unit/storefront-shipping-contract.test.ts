import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  isOrderQuote,
  type OrderQuote
} from '@/commercial/order/contracts';
import { SHIPPING_CALCULATION_VERSION } from '@/shared/domain/shipping/shipping';
import { STOREFRONT_CART_PENDING_SHIPPING_LABEL } from '@/shared/domain/shipping/storefrontShippingCopy';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

const calculatedQuote: OrderQuote = {
  items: [],
  shippingConfigurationVersion: 4,
  quoteFingerprint: `order-quote-v1:${'a'.repeat(64)}`,
  totals: {
    net: 20,
    tax: 4.4,
    shipping: 3,
    gross: 27.4,
    currency: 'EUR'
  },
  shipping: {
    status: 'calculated',
    source: 'automatic',
    calculationVersion: SHIPPING_CALCULATION_VERSION,
    configurationVersion: 4,
    items: [],
    combinedWeightGrams: 4_999,
    largestDimensionMm: 1_000,
    triggeringItem: null,
    basePriceCents: 300,
    surchargeAmountCents: 0,
    merchandiseSubtotalCents: 2_440,
    parcelCount: 1,
    singleParcelAmountCents: 300,
    parcelCountGrossAmountCents: 300,
    multiPieceDiscountAmountCents: 0,
    afterMultiPieceAmountCents: 300,
    orderValueDiscountAmountCents: 0,
    automaticAmountCents: 300,
    finalAmountCents: 300,
    matchedWeightBand: {
      id: 'light',
      name: 'Do 5 kg',
      minWeightGrams: 1,
      maxWeightGrams: 4_999,
      priceCents: 300,
      enabled: true,
      position: 0
    },
    matchedDimensionalRule: null,
    matchedMultiPieceDiscountRule: null,
    matchedOrderValueDiscountRule: null,
    configurationSnapshot: {
      version: 4,
      manualQuoteFallbackEnabled: true,
      weightBands: [
        {
          id: 'light',
          name: 'Do 5 kg',
          minWeightGrams: 1,
          maxWeightGrams: 4_999,
          priceCents: 300,
          enabled: true,
          position: 0
        }
      ],
      dimensionalRules: [],
      orderValueDiscountRules: [],
      multiPieceDiscountRules: []
    },
    manualOverride: null
  }
};

test('quote contract accepts calculated shipping and rejects a synthetic zero fallback', () => {
  assert.equal(isOrderQuote(calculatedQuote), true);
  assert.equal(
    isOrderQuote({
      ...calculatedQuote,
      quoteFingerprint: undefined
    }),
    false
  );
  assert.equal(
    isOrderQuote({
      ...calculatedQuote,
      quoteFingerprint: 'missing-authoritative-digest'
    }),
    false
  );
  assert.equal(
    isOrderQuote({
      ...calculatedQuote,
      shipping: undefined
    }),
    false
  );
  assert.equal(
    isOrderQuote({
      ...calculatedQuote,
      totals: {
        ...calculatedQuote.totals,
        shipping: null,
        gross: null
      }
    }),
    false
  );
});

test('manual quote requires null shipping and gross totals', () => {
  const manualQuote = {
    ...calculatedQuote,
    totals: {
      ...calculatedQuote.totals,
      shipping: null,
      gross: null
    },
    shipping: {
      status: 'manual_quote',
      calculationVersion: SHIPPING_CALCULATION_VERSION,
      configurationVersion: 4,
      items: [],
      combinedWeightGrams: 30_001,
      largestDimensionMm: 1_200,
      triggeringItem: null,
      reason: 'Za to težo ni nastavljenega veljavnega razpona.',
      issues: [
        {
          code: 'WEIGHT_OUTSIDE_CONFIGURED_BANDS',
          message: 'Nastavite naslednji težnostni razpon.'
        }
      ]
    }
  } satisfies OrderQuote;

  assert.equal(isOrderQuote(manualQuote), true);
  assert.equal(
    isOrderQuote({
      ...manualQuote,
      totals: {
        ...manualQuote.totals,
        shipping: 0,
        gross: calculatedQuote.totals.gross
      }
    }),
    false
  );
});

test('cart page keeps the shipping breakdown while drawer, checkout and confirmation use one final customer row', () => {
  const presentationSource = source(
    'src/commercial/order/components/ShippingCalculationRows.tsx'
  );
  const cartPageSource = source(
    'src/commercial/features/cart/CartPageClient.tsx'
  );
  const cartDrawerSource = source(
    'src/commercial/features/cart/CartDrawer.tsx'
  );
  const orderPageSource = source(
    'src/commercial/order/components/OrderPageClient.tsx'
  );
  const confirmationSource = source(
    'src/commercial/order/components/OrderConfirmationSummary.tsx'
  );
  const appearanceSource = source(
    'src/shared/domain/style/productAppearance.ts'
  );

  assert.match(presentationSource, /Osnovna poštnina/u);
  assert.match(presentationSource, /Dodatek za večje dimenzije/u);
  assert.match(presentationSource, /Popust za pošiljanje v več kosih/u);
  assert.match(presentationSource, /Popust glede na vrednost naročila/u);
  assert.match(presentationSource, /Samodejno izračunana poštnina/u);
  assert.match(presentationSource, /Brezplačna dostava/u);
  assert.match(presentationSource, /calculation\.finalAmountCents === 0/u);
  assert.match(presentationSource, /frozenOverride\.amount === 0/u);
  assert.match(presentationSource, /Po dogovoru/u);
  assert.match(presentationSource, /finalAmountCents/u);
  assert.match(cartPageSource, /ShippingCalculationRows/u);
  assert.doesNotMatch(cartPageSource, /free.?Shipping|Brezplačn[a]? dostav/u);
  assert.doesNotMatch(
    cartDrawerSource,
    /ShippingCalculationRows|ShippingManualQuoteNotice/u
  );
  assert.equal((cartDrawerSource.match(/Poštnina/gu) ?? []).length, 1);
  assert.equal(
    STOREFRONT_CART_PENDING_SHIPPING_LABEL,
    'Izračun na strani za naročilo'
  );
  assert.match(
    cartDrawerSource,
    /data-testid="cart-drawer-shipping"[\s\S]*?data-summary-row="shipping"[\s\S]*?<dt>Poštnina<\/dt>[\s\S]*?STOREFRONT_CART_PENDING_SHIPPING_LABEL/u
  );
  assert.doesNotMatch(cartDrawerSource, /formatEuro\(totals\.shipping\)/u);
  assert.match(cartDrawerSource, /<dt>Vmesni seštevek z DDV<\/dt>/u);
  assert.match(
    cartDrawerSource,
    /formatEuro\(totals\.net \+ totals\.tax\)/u
  );
  assert.doesNotMatch(cartDrawerSource, /Po dogovoru/u);
  assert.doesNotMatch(
    cartDrawerSource,
    /Osnovna poštnina|Referenčna cena posameznega paketa|\d+ × S|Po popustu za več kosov|Samodejno izračunana poštnina/u
  );
  assert.doesNotMatch(orderPageSource, /<ShippingCalculationRows/u);
  assert.match(
    orderPageSource,
    /const ORDER_SUMMARY_CALCULATION_ROW_CLASS_NAME =\s*\n\s*'flex justify-between gap-4 text-sm font-normal not-italic text-\[color:var\(--site-color-text\)\]';/u
  );
  assert.equal(
    (
      orderPageSource.match(
        /className=\{ORDER_SUMMARY_CALCULATION_ROW_CLASS_NAME\}/gu
      ) ?? []
    ).length,
    3
  );
  assert.match(
    orderPageSource,
    /data-summary-row="shipping"[\s\S]*?<dt>Poštnina<\/dt>[\s\S]*?totals\?\.shipping !== null[\s\S]*?formatEuro\(totals\.shipping\)[\s\S]*?shipping\.status === 'manual_quote'[\s\S]*?'Po dogovoru'/u
  );
  assert.doesNotMatch(
    orderPageSource,
    /<dt>Osnovna poštnina<\/dt>|<dt>Samodejno izračunana poštnina<\/dt>/u
  );
  assert.doesNotMatch(confirmationSource, /<ShippingCalculationRows/u);
  assert.match(
    confirmationSource,
    /<CalculationRow[\s\S]*?row="shipping"[\s\S]*?label="Poštnina"[\s\S]*?totals\.shipping === null[\s\S]*?formatEuro\(totals\.shipping\)/u
  );
  assert.doesNotMatch(
    confirmationSource,
    /Osnovna poštnina|Samodejno izračunana poštnina|frozenShippingOverride/u
  );
  assert.doesNotMatch(
    appearanceSource,
    /free.?Shipping(?:Message|Label)|showFree.?Shipping|Brezplačn[a]? dostav/u
  );
});
