'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useCartStore } from '@/commercial/cart/store';
import {
  cartHasBlockingIssue,
  getCartSubtotal
} from '@/commercial/cart/cartTypes';
import CartLine from '@/commercial/components/storefront/CartLine';
import { useProductAppearance } from '@/commercial/components/ProductAppearanceProvider';
import { useOrderQuote } from '@/commercial/order/useOrderQuote';
import { formatEuro } from '@/shared/domain/formatting';

export default function CartPageClient() {
  const appearance = useProductAppearance();
  const items = useCartStore((state) => state.items);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const quoteState = useOrderQuote(items, items.length > 0);
  const quoteByVariant = useMemo(
    () =>
      new Map(
        (quoteState.quote?.items ?? []).map((item) => [item.variantId, item])
      ),
    [quoteState.quote]
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
  const totals = quoteState.quote?.totals ?? {
    net: fallbackNet,
    tax: Math.max(0, fallbackGross - fallbackNet),
    shipping: 0,
    gross: fallbackGross,
    currency: 'EUR' as const
  };
  const totalsKnown = Boolean(quoteState.quote) || hasCompleteFallbackPricing;
  const checkoutBlocked =
    quoteState.isLoading ||
    Boolean(quoteState.error) ||
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
                quoteItem={
                  typeof item.variant?.id === 'number'
                    ? quoteByVariant.get(item.variant.id)
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
                  {totalsKnown ? formatEuro(totals.net) : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-4 text-[color:var(--site-color-text-muted)]">
                <dt>DDV</dt>
                <dd className="font-semibold tabular-nums text-[color:var(--site-color-text)]">
                  {totalsKnown ? formatEuro(totals.tax) : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-4 text-[color:var(--site-color-text-muted)]">
                <dt>Dostava</dt>
                <dd className="font-semibold text-[color:var(--site-color-success)]">
                  {appearance.pricing.freeShippingLabel}
                </dd>
              </div>
              <div className="mt-3 flex justify-between gap-4 border-t border-[color:var(--site-divider-color)] pt-3 text-base font-semibold">
                <dt>Skupaj z DDV</dt>
                <dd className="tabular-nums text-[color:var(--site-color-primary)]">
                  {totalsKnown ? formatEuro(totals.gross) : '—'}
                </dd>
              </div>
            </dl>

            {quoteState.isLoading ? (
              <p className="mt-3 text-xs text-[color:var(--site-color-text-muted)]">
                Preverjamo veljavne cene in zalogo …
              </p>
            ) : quoteState.error ? (
              <div
                role="alert"
                className="site-radius-sm mt-3 bg-[color:var(--site-color-surface-muted)] p-3 text-xs text-[color:var(--site-color-danger)]"
              >
                {quoteState.error.message}
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
