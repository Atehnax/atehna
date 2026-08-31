'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import SubmissionStatusPanel from '@/commercial/components/SubmissionStatusPanel';
import OrderLoadingState from '@/commercial/order/components/OrderLoadingState';
import {
  parseQuotePublicApiError,
  type QuoteRequestConfirmationSnapshot
} from '@/commercial/quote/contracts';
import {
  buildQuoteAccessHeaders,
  consumeQuoteAccessTokenFromLocation,
  exchangeQuoteAccessToken,
  readStoredQuoteAccessSession,
  type QuoteAccessSession
} from '@/commercial/quote/quoteAccessClient';
import { formatEuro } from '@/shared/domain/formatting';

type ConfirmationState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; snapshot: QuoteRequestConfirmationSnapshot };

const formatDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? null
    : new Intl.DateTimeFormat('sl-SI', {
        dateStyle: 'long',
        timeStyle: 'short'
      }).format(parsed);
};

const buildConfirmationItemTitle = (
  productName: string,
  variantName?: string
) => {
  const product = productName.trim();
  const variant = variantName?.trim();
  if (!variant) return product;

  const normalizedProduct = product.toLocaleLowerCase('sl-SI');
  const normalizedVariant = variant.toLocaleLowerCase('sl-SI');
  if (
    normalizedProduct === normalizedVariant ||
    normalizedProduct.endsWith(` ${normalizedVariant}`)
  ) {
    return product;
  }
  if (normalizedVariant.startsWith(`${normalizedProduct} `)) return variant;

  return `${product} ${variant}`;
};

export default function QuoteRequestConfirmationPageClient() {
  const [state, setState] = useState<ConfirmationState>({ status: 'loading' });
  const accessSessionRef = useRef<QuoteAccessSession | null>(null);
  const bootstrapTokenRef = useRef<string | null>(null);
  const locationTokenConsumedRef = useRef(false);

  const loadConfirmation = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      if (!locationTokenConsumedRef.current) {
        bootstrapTokenRef.current = consumeQuoteAccessTokenFromLocation();
        locationTokenConsumedRef.current = true;
      }
      let session = accessSessionRef.current ?? readStoredQuoteAccessSession();
      if (bootstrapTokenRef.current) {
        session = await exchangeQuoteAccessToken(bootstrapTokenRef.current);
        bootstrapTokenRef.current = null;
      }
      if (!session) {
        throw new Error('Povezava za prikaz povpraševanja ni veljavna.');
      }
      accessSessionRef.current = session;

      const response = await fetch('/api/quote-requests/confirmation', {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: buildQuoteAccessHeaders(session)
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          parseQuotePublicApiError(
            payload,
            'Potrditve povpraševanja trenutno ni mogoče prikazati.'
          ).message
        );
      }
      setState({
        status: 'ready',
        snapshot: payload as QuoteRequestConfirmationSnapshot
      });
    } catch (error) {
      setState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Potrditve povpraševanja trenutno ni mogoče prikazati.'
      });
    }
  }, []);

  useEffect(() => {
    void loadConfirmation();
  }, [loadConfirmation]);

  if (state.status === 'loading') {
    return (
      <OrderLoadingState
        heading="Nalagamo potrditev povpraševanja"
        description="Prosimo, počakajte, da pripravimo varen prikaz."
        ariaLabel="Nalaganje potrditve povpraševanja"
        testId="quote-request-confirmation-loading"
      />
    );
  }

  if (state.status === 'error') {
    return (
      <div
        className="site-panel mx-auto max-w-2xl border-[color:var(--site-color-danger)] p-8 text-center"
        role="alert"
      >
        <h1 className="site-heading-2">Potrditve ni mogoče prikazati</h1>
        <p className="site-paragraph mt-3">{state.message}</p>
        {accessSessionRef.current || bootstrapTokenRef.current ? (
          <button
            type="button"
            onClick={() => void loadConfirmation()}
            className="site-button site-button--primary mt-6"
          >
            Poskusi znova
          </button>
        ) : null}
        <Link
          href="/products"
          className="site-button site-button--secondary mt-3 inline-flex items-center justify-center"
        >
          Nazaj v katalog
        </Link>
      </div>
    );
  }

  const { snapshot } = state;
  const submittedAt = formatDate(snapshot.requestedAt);
  return (
    <div data-confirmation-shell>
      <SubmissionStatusPanel
        eyebrow="Uspešno poslano"
        heading="Povpraševanje je poslano"
        description="Atehna bo preverila cene, dobavljivost, stroške dostave in rok dobave ter vam poslala ponudbo."
        symbol="✓"
        tone="success"
        testId="quote-request-submission-status"
        headingTestId="quote-request-confirmation-heading"
      />

      <article
        className="site-card mt-6 grid overflow-hidden !p-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]"
        data-testid="quote-request-confirmation-content-card"
        data-confirmation-card
        aria-labelledby="quote-confirmation-items"
      >
        <section
          className="min-w-0 lg:col-start-1 lg:row-start-1"
          data-testid="quote-request-confirmation-items-section"
          data-confirmation-region="primary"
        >
          <h2 id="quote-confirmation-items" className="sr-only">
            Postavke povpraševanja
          </h2>
          {submittedAt ? (
            <p className="px-5 pt-5 text-right text-sm text-[color:var(--site-color-text-muted)] sm:px-6 sm:pt-6">
              {submittedAt}
            </p>
          ) : null}
          <ul className="min-w-0 divide-y divide-[color:var(--site-divider-color)] p-5 sm:p-6">
            {snapshot.items.map((item) => (
              <li
                key={`${item.lineNumber}-${item.sku}`}
                className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 py-4 first:pt-0 last:pb-0"
                data-testid="quote-request-confirmation-item"
              >
                <div
                  className="site-radius-sm relative aspect-square overflow-hidden bg-[color:var(--site-color-surface-muted)]"
                  data-testid="quote-request-confirmation-item-media"
                >
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center px-2 text-center text-[10px] text-[color:var(--site-color-text-muted)]">
                      Brez slike
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <h3
                    className="font-semibold text-[color:var(--site-color-text)]"
                    data-testid="quote-request-confirmation-item-title"
                  >
                    {buildConfirmationItemTitle(
                      item.productName,
                      item.variantName
                    )}
                  </h3>
                  <p className="mt-0.5 break-all font-mono text-xs text-[color:var(--site-color-text-muted)]">
                    SKU: {item.sku}
                  </p>
                  <p className="mt-2 text-sm font-semibold tabular-nums text-[color:var(--site-color-text)]">
                    {item.quantity} {item.unit ?? 'kos'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <aside
          className="min-w-0 border-t border-[color:var(--site-divider-color)] p-5 sm:p-6 lg:col-start-2 lg:row-start-1 lg:border-l lg:border-t-0"
          data-testid="quote-request-confirmation-summary"
          data-confirmation-region="secondary"
          aria-labelledby="quote-confirmation-summary-heading"
        >
          <h2
            id="quote-confirmation-summary-heading"
            className="text-lg font-semibold"
          >
            Povzetek povpraševanja
          </h2>
          <section className="mt-4" data-summary-section="calculation">
            <h3 className="text-sm font-semibold leading-5 text-[color:var(--site-color-text)]">
              Okvirni izračun
            </h3>
            <dl className="mt-2 border-t border-[color:var(--site-divider-color)] pt-2">
              <div className="flex min-w-0 items-start justify-between gap-4 py-1 text-sm leading-5">
                <dt className="min-w-0 font-semibold">Cena brez DDV</dt>
                <dd className="shrink-0 text-right font-semibold tabular-nums">
                  {formatEuro(snapshot.estimate.totals.net)}
                </dd>
              </div>
              <div className="flex min-w-0 items-start justify-between gap-4 py-1 text-sm leading-5">
                <dt className="min-w-0 font-semibold">DDV</dt>
                <dd className="shrink-0 text-right font-semibold tabular-nums">
                  {formatEuro(snapshot.estimate.totals.tax)}
                </dd>
              </div>
              <div
                className="flex min-w-0 items-start justify-between gap-4 py-1 text-sm leading-5"
                data-testid="quote-request-confirmation-shipping"
                data-summary-row="shipping"
                data-shipping-status={snapshot.estimate.shipping.status}
              >
                <dt className="min-w-0 font-semibold">Poštnina</dt>
                <dd className="shrink-0 text-right font-semibold tabular-nums">
                  {snapshot.estimate.totals.shipping === null
                    ? 'Po dogovoru'
                    : formatEuro(snapshot.estimate.totals.shipping)}
                </dd>
              </div>
              <div
                className="mt-3 flex min-w-0 items-center justify-between gap-4 border-t border-[color:var(--site-divider-color)] pt-3 text-[color:var(--site-color-primary)]"
                data-summary-row="gross"
              >
                <dt className="min-w-0 text-base font-semibold leading-6">
                  Okvirno skupaj z DDV
                </dt>
                <dd className="shrink-0 text-right text-xl font-semibold leading-7 tabular-nums">
                  {snapshot.estimate.totals.gross === null
                    ? 'Po dogovoru'
                    : formatEuro(snapshot.estimate.totals.gross)}
                </dd>
              </div>
            </dl>
          </section>
          <div className="site-radius-sm mt-5 border border-[color:var(--site-color-warning)] p-4">
            <p className="font-semibold">Zaloga ni rezervirana</p>
            <p className="mt-1 text-xs leading-5 text-[color:var(--site-color-text-muted)]">
              Količine, cene in dostava so do izdaje ponudbe informativne.
            </p>
          </div>
          <Link
            href="/products"
            className="site-button site-button--secondary mt-5 inline-flex w-full items-center justify-center"
          >
            Nazaj v katalog
          </Link>
        </aside>
      </article>
    </div>
  );
}
