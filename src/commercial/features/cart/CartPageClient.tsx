'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useCartStore } from '@/commercial/cart/store';
import {
  cartHasBlockingIssue,
  getCartSubtotal
} from '@/commercial/cart/cartTypes';
import CartLine from '@/commercial/components/storefront/CartLine';
import ShippingCalculationRows, {
  ShippingManualQuoteNotice
} from '@/commercial/order/components/ShippingCalculationRows';
import { useOrderEstimate } from '@/commercial/order/useOrderEstimate';
import { formatEuro } from '@/shared/domain/formatting';

export default function CartPageClient() {
  const items = useCartStore((state) => state.items);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const estimateState = useOrderEstimate(items, items.length > 0);
  const estimateByVariant = useMemo(
    () =>
      new Map(
        (estimateState.estimate?.items ?? []).map((item) => [item.variantId, item])
      ),
    [estimateState.estimate]
  );
  const fallbackGross = getCartSubtotal(items);
  const fallbackNet = items.reduce(
    (sum, item) =>
      sum + (item.pricing?.unitNet ?? 0) * item.quantity,
    0
  );
  const hasCompleteFallbackPricing = items.every(
    (item) =>
      typeof item.pricing?.unitNet === 'number' &&
      typeof item.pricing?.estimatedUnitGross === 'number'
  );
  const totals = estimateState.estimate?.totals;
  const totalsKnown = Boolean(estimateState.estimate) || hasCompleteFallbackPricing;
  const checkoutBlocked =
    !estimateState.estimate ||
    estimateState.isLoading ||
    Boolean(estimateState.error) ||
    cartHasBlockingIssue(items);

  if (items.length === 0) {
    return (
      <div className="site-panel mx-auto max-w-2xl border-dashed p-8 text-center">
        <h1 className="site-heading-2">Košarica je prazna</h1>
        <p className="site-paragraph mt-3">
          V katalogu izberite artikel in razpoložljivo različico.
        </p>
        <Link
          href="/products"
          className="site-button site-button--primary mt-6 inline-flex items-center justify-center"
        >
          Poglej izdelke
        </Link>
      </div>
    );
  }

  return (
    <>
      <header className="mb-8">
        <p className="site-eyebrow">Nakup</p>
        <h1 className="site-heading-1 mt-2">Vaša košarica</h1>
        <p className="site-paragraph mt-3 max-w-2xl">
          Preglejte različice in količine. Cene ter zalogo pred oddajo vedno
          ponovno preverimo.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="cart-lines-heading">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2
              id="cart-lines-heading"
              className="text-lg font-semibold text-[color:var(--site-color-text)]"
            >
              Artikli ({items.reduce((sum, item) => sum + item.quantity, 0)})
            </h2>
            <button
              type="button"
              onClick={clearCart}
              className="site-link text-sm"
            >
              Izprazni košarico
            </button>
          </div>
          <div className="space-y-4">
            {items.map((item) => (
              <CartLine
                key={item.lineId}
                item={item}
                estimateItem={
                  typeof item.variant?.id === 'number'
                    ? estimateByVariant.get(item.variant.id)
                    : undefined
                }
                onQuantityChange={(quantity) =>
                  setQuantity(item.lineId, quantity)
                }
                onRemove={() => removeItem(item.lineId)}
              />
            ))}
          </div>
        </section>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="site-card">
            <h2 className="text-lg font-semibold text-[color:var(--site-color-text)]">
              Povzetek
            </h2>
            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between gap-4 text-[color:var(--site-color-text-muted)]">
                <dt>Cena brez DDV</dt>
                <dd className="font-semibold tabular-nums text-[color:var(--site-color-text)]">
                  {totals
                    ? formatEuro(totals.net)
                    : totalsKnown
                      ? formatEuro(fallbackNet)
                      : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-4 text-[color:var(--site-color-text-muted)]">
                <dt>DDV</dt>
                <dd className="font-semibold tabular-nums text-[color:var(--site-color-text)]">
                  {totals
                    ? formatEuro(totals.tax)
                    : totalsKnown
                      ? formatEuro(Math.max(0, fallbackGross - fallbackNet))
                      : '—'}
                </dd>
              </div>
              <ShippingCalculationRows calculation={estimateState.estimate?.shipping ?? null} />
              <div className="mt-3 flex justify-between gap-4 border-t border-[color:var(--site-divider-color)] pt-3 text-base font-semibold">
                <dt>Skupaj z DDV</dt>
                <dd className="tabular-nums text-[color:var(--site-color-primary)]">
                  {totals?.gross !== null && totals?.gross !== undefined
                    ? formatEuro(totals.gross)
                    : '—'}
                </dd>
              </div>
            </dl>

            <ShippingManualQuoteNotice
              calculation={estimateState.estimate?.shipping ?? null}
              className="site-radius-sm mt-3 bg-[color:var(--site-color-surface-muted)] p-3 text-xs text-[color:var(--site-color-danger)]"
            />

            {estimateState.isLoading ? (
              <p className="mt-3 text-xs text-[color:var(--site-color-text-muted)]">
                Preverjamo veljavne cene in zalogo …
              </p>
            ) : estimateState.error ? (
              <div
                role="alert"
                className="site-radius-sm mt-3 bg-[color:var(--site-color-surface-muted)] p-3 text-xs text-[color:var(--site-color-danger)]"
              >
                {estimateState.error.message}
              </div>
            ) : (
              <p className="mt-3 text-xs text-[color:var(--site-color-text-muted)]">
                Plačilo uredimo ročno po ponudbi ali predračunu.
              </p>
            )}

            <Link
              href="/order"
              aria-disabled={checkoutBlocked}
              onClick={(event) => {
                if (checkoutBlocked) event.preventDefault();
              }}
              className={`site-button site-button--primary mt-5 inline-flex w-full items-center justify-center ${
                checkoutBlocked ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              Nadaljuj na naročilo
            </Link>
            <Link
              href="/products"
              className="site-button site-button--secondary mt-2 inline-flex w-full items-center justify-center"
            >
              Nadaljuj z nakupom
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
