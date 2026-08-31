'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import OrderLoadingState from '@/commercial/order/components/OrderLoadingState';
import OrderConfirmationSummary from '@/commercial/order/components/OrderConfirmationSummary';
import OrderSubmissionStatus from '@/commercial/order/components/OrderSubmissionStatus';
import {
  parseOrderApiError,
  type OrderConfirmationSnapshot
} from '@/commercial/order/contracts';
import {
  buildOrderConfirmationFragmentUrl,
  consumeOrderAccessTokenFromLocation,
  exchangeOrderAccessToken,
  readStoredOrderAccessId
} from '@/commercial/order/orderAccessClient';

type ConfirmationState =
  | { status: 'loading' }
  | { status: 'error'; message: string; canUseFragmentFallback?: boolean }
  | { status: 'ready'; snapshot: OrderConfirmationSnapshot };

const DOCUMENT_REFRESH_DELAYS_MS = [750, 1_500, 3_000, 5_000] as const;

const hasOrderSummary = (snapshot: OrderConfirmationSnapshot) =>
  snapshot.documents.some(
    (document) =>
      document.type === 'order_summary' && Boolean(document.url?.trim())
  );

const waitForRefresh = (delay: number, signal: AbortSignal) =>
  new Promise<boolean>((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }

    const finish = (completed: boolean) => {
      window.clearTimeout(timeoutId);
      signal.removeEventListener('abort', handleAbort);
      resolve(completed);
    };
    const handleAbort = () => finish(false);
    const timeoutId = window.setTimeout(() => finish(true), delay);
    signal.addEventListener('abort', handleAbort, { once: true });
  });

const formatDate = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('sl-SI', {
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(parsed);
};

const customerTypeLabel = (value?: string) => {
  if (value === 'company') return 'Podjetje';
  if (value === 'school') return 'Šola ali javni zavod';
  return 'Zasebni naročnik';
};

const CUSTOMER_DOCUMENT_LABELS: Record<string, string> = {
  order_summary: 'Potrditev naročila (PDF)',
  purchase_order: 'Naročilnica',
  dobavnica: 'Dobavnica',
  predracun: 'Predračun',
  invoice: 'Račun'
};

const customerDocumentLabel = (type: string | undefined, index: number) =>
  CUSTOMER_DOCUMENT_LABELS[type ?? ''] ?? `Dokument ${index + 1}`;

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

export default function OrderConfirmationPageClient() {
  const [state, setState] = useState<ConfirmationState>({ status: 'loading' });
  const accessIdRef = useRef<string | null>(null);
  const bootstrapTokenRef = useRef<string | null>(null);
  const locationTokenConsumedRef = useRef(false);

  const fetchConfirmation = useCallback(
    async (accessId: string, signal?: AbortSignal) => {
      const response = await fetch('/api/orders/confirmation', {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'X-Order-Access-Id': accessId
        },
        signal
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          parseOrderApiError(
            payload,
            'Potrditve trenutno ni mogoče prikazati.'
          ).message
        );
      }
      return payload as OrderConfirmationSnapshot;
    },
    []
  );

  const loadConfirmation = useCallback(async () => {
    setState({ status: 'loading' });

    try {
      if (!locationTokenConsumedRef.current) {
        bootstrapTokenRef.current = consumeOrderAccessTokenFromLocation();
        locationTokenConsumedRef.current = true;
      }

      let accessId = accessIdRef.current ?? readStoredOrderAccessId();
      if (bootstrapTokenRef.current) {
        const session = await exchangeOrderAccessToken(bootstrapTokenRef.current);
        accessId = session.accessId;
        bootstrapTokenRef.current = null;
      }
      if (!accessId) {
        throw new Error('Povezava za prikaz potrditve ni veljavna.');
      }

      accessIdRef.current = accessId;
      const snapshot = await fetchConfirmation(accessId);
      setState({ status: 'ready', snapshot });
    } catch (error) {
      setState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Potrditve trenutno ni mogoče prikazati.',
        canUseFragmentFallback: Boolean(bootstrapTokenRef.current)
      });
    }
  }, [fetchConfirmation]);

  useEffect(() => {
    void loadConfirmation();
  }, [loadConfirmation]);

  const shouldRefreshDocuments =
    state.status === 'ready' && !hasOrderSummary(state.snapshot);

  useEffect(() => {
    if (!shouldRefreshDocuments) return;

    const controller = new AbortController();
    const refreshDocuments = async () => {
      for (const delay of DOCUMENT_REFRESH_DELAYS_MS) {
        const shouldContinue = await waitForRefresh(delay, controller.signal);
        if (!shouldContinue) return;

        try {
          const accessId = accessIdRef.current;
          if (!accessId) return;
          const snapshot = await fetchConfirmation(accessId, controller.signal);
          if (controller.signal.aborted) return;
          setState((current) =>
            current.status === 'ready'
              ? { status: 'ready', snapshot }
              : current
          );
          if (hasOrderSummary(snapshot)) {
            return;
          }
        } catch {
          if (controller.signal.aborted) return;
        }
      }
    };

    void refreshDocuments();
    return () => controller.abort();
  }, [fetchConfirmation, shouldRefreshDocuments]);

  if (state.status === 'loading') {
    return (
      <OrderLoadingState
        heading="Nalagamo potrditev naročila"
        description="Prosimo, počakajte, da pripravimo varen prikaz potrditve."
        ariaLabel="Nalaganje potrditve naročila"
        testId="order-confirmation-loading"
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
        {accessIdRef.current || bootstrapTokenRef.current ? (
          <button
            type="button"
            onClick={() => void loadConfirmation()}
            className="site-button site-button--primary mt-6"
          >
            Poskusi znova
          </button>
        ) : null}
        {state.canUseFragmentFallback ? (
          <button
            type="button"
            className="site-button site-button--secondary mt-3 inline-flex items-center justify-center"
            onClick={() => {
              const accessToken = bootstrapTokenRef.current;
              if (!accessToken) return;
              window.history.replaceState(
                window.history.state,
                '',
                buildOrderConfirmationFragmentUrl(accessToken)
              );
              window.location.reload();
            }}
          >
            Ponovno odpri varno povezavo
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
  const submittedAt = formatDate(snapshot.createdAt);
  const customer = snapshot.customer;
  const purchaseOrderHref = '/order/narocilnica';
  const availableDocuments = snapshot.documents.flatMap((document, index) => {
    const url = document.url?.trim();
    return url ? [{ document, index, url }] : [];
  });

  return (
    <div>
      <OrderSubmissionStatus
        commitmentStatus={snapshot.commitmentStatus}
        contractStatus={snapshot.contractStatus}
      />

      <article
        className="site-card mt-6 grid overflow-hidden !p-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]"
        data-testid="order-confirmation-content-card"
        aria-labelledby="confirmation-items"
      >
        <section
          className="min-w-0 lg:col-start-1 lg:row-start-1"
          data-testid="confirmation-order-section"
        >
          <h2 id="confirmation-items" className="sr-only">Postavke naročila</h2>
          {submittedAt ? (
            <p className="px-5 pt-5 text-right text-sm text-[color:var(--site-color-text-muted)] sm:px-6 sm:pt-6">
              {submittedAt}
            </p>
          ) : null}

            <ul className="min-w-0 divide-y divide-[color:var(--site-divider-color)] p-5 sm:p-6">
              {snapshot.items.map((item) => (
                <li
                  key={`${item.variantId}-${item.sku}`}
                  className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 py-4 first:pt-0 last:pb-0"
                  data-testid="confirmation-item-row"
                >
                  <div
                    className="site-radius-sm relative aspect-square overflow-hidden bg-[color:var(--site-color-surface-muted)]"
                    data-testid="confirmation-item-media"
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
                      data-testid="confirmation-item-title"
                    >
                      {buildConfirmationItemTitle(
                        item.productName,
                        item.variantName
                      )}
                    </h3>
                    <p className="mt-0.5 break-all font-mono text-xs text-[color:var(--site-color-text-muted)]">
                      SKU: {item.sku}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
        </section>

        <OrderConfirmationSummary
          className="border-t border-[color:var(--site-divider-color)] p-5 sm:p-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-l lg:border-t-0"
          items={snapshot.items}
          totals={snapshot.totals}
        />

        <div
          className="grid min-w-0 border-t border-[color:var(--site-divider-color)] lg:col-start-1 lg:row-start-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]"
          data-testid="confirmation-lower-sections"
        >
          <section
            className="p-5 sm:p-6"
            data-testid="confirmation-customer-section"
            aria-labelledby="delivery-heading"
          >
            <h2 id="delivery-heading" className="text-xl font-semibold">
              Naročnik in dostava
            </h2>
            <dl className="mt-4 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[color:var(--site-color-text-muted)]">
                  Vrsta naročnika
                </dt>
                <dd className="mt-1 font-semibold">
                  {customerTypeLabel(customer?.customerType)}
                </dd>
              </div>
              <div>
                <dt className="text-[color:var(--site-color-text-muted)]">
                  Naročnik
                </dt>
                <dd className="mt-1 font-semibold">
                  {customer?.organizationName ||
                    customer?.customerName ||
                    customer?.contactName ||
                    '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[color:var(--site-color-text-muted)]">
                  Kontakt
                </dt>
                <dd className="mt-1 break-words">
                  {customer?.contactName ? (
                    <span className="block font-semibold">
                      {customer.contactName}
                    </span>
                  ) : null}
                  <span>{customer?.email || '—'}</span>
                </dd>
              </div>
              <div>
                <dt className="text-[color:var(--site-color-text-muted)]">
                  Naslov za dostavo
                </dt>
                <dd className="mt-1 font-semibold">
                  {customer?.addressLine1 || '—'}
                  {customer?.addressLine1 ? (
                    <>
                      {customer.addressLine2 ? (
                        <span className="block">{customer.addressLine2}</span>
                      ) : null}
                      <span className="block">
                        {customer.postalCode} {customer.city}
                      </span>
                    </>
                  ) : null}
                </dd>
              </div>
              {customer?.reference ? (
                <div className="sm:col-span-2">
                  <dt className="text-[color:var(--site-color-text-muted)]">
                    Referenca
                  </dt>
                  <dd className="mt-1 font-semibold">{customer.reference}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section
            className="min-w-0 border-t border-[color:var(--site-divider-color)] p-5 sm:p-6 lg:border-l lg:border-t-0"
            data-testid="confirmation-documents-section"
            aria-labelledby="documents-heading"
          >
            <h2 id="documents-heading" className="text-xl font-semibold">
              Dokumenti
            </h2>
            {availableDocuments.length > 0 ? (
              <ul className="mt-4 grid gap-3">
                {availableDocuments.map(({ document, index, url }) => (
                  <li key={`${document.type}-${url}-${index}`}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="site-button site-button--secondary inline-flex min-h-11 w-full min-w-0 items-center justify-center break-words px-3 text-center"
                    >
                      {customerDocumentLabel(document.type, index)}
                      <span className="sr-only">
                        {' '}
                        (odpre se v novem zavihku)
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}

            {snapshot.commitmentStatus === 'pending_confirmation' ? (
              <Link
                href={purchaseOrderHref}
                className="site-button site-button--primary mt-4 inline-flex w-full items-center justify-center"
              >
                Naloži naročilnico
              </Link>
            ) : null}
            <Link
              href="/products"
              className="site-button site-button--secondary mt-3 inline-flex w-full items-center justify-center"
            >
              Nazaj v katalog
            </Link>
          </section>
        </div>
      </article>
    </div>
  );
}
