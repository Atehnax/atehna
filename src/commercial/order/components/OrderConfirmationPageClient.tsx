'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ConfirmationContentLayout from '@/commercial/components/ConfirmationContentLayout';
import ConfirmationCustomerDetails from '@/commercial/components/ConfirmationCustomerDetails';
import {
  CONFIRMATION_DOCUMENT_ACTION_CLASS,
  CONFIRMATION_PRIMARY_DOCUMENT_ACTION_CLASS
} from '@/commercial/components/confirmationDocumentAction';
import OrderLoadingState from '@/commercial/order/components/OrderLoadingState';
import OrderConfirmationSummary, {
  OrderConfirmationItemPricing
} from '@/commercial/order/components/OrderConfirmationSummary';
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
import { readJsonResponse } from '@/shared/client/readJsonResponse';

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
      const payload: unknown = await readJsonResponse(response, {});
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
  const postalAddressLine = [customer?.postalCode, customer?.city]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  const address = [
    customer?.addressLine1,
    customer?.addressLine2,
    postalAddressLine
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
  const purchaseOrderHref = '/order/narocilnica';
  const availableDocuments = snapshot.documents.flatMap((document, index) => {
    const url = document.url?.trim();
    return url ? [{ document, index, url }] : [];
  });
  const orderSummaryDocument = availableDocuments.find(
    ({ document }) => document.type === 'order_summary'
  );
  const otherDocuments = availableDocuments.filter(
    ({ document }) => document.type !== 'order_summary'
  );
  const customerName =
    customer?.organizationName ||
    customer?.customerName ||
    customer?.contactName ||
    '';
  const customerEmail = customer?.email?.trim() ?? '';

  return (
    <div>
      <OrderSubmissionStatus
        commitmentStatus={snapshot.commitmentStatus}
        contractStatus={snapshot.contractStatus}
        submittedAt={submittedAt}
        submittedAtDateTime={snapshot.createdAt}
      />

      <ConfirmationContentLayout
        testId="confirmation-content-grid"
        detailsTestId="confirmation-order-section"
        summaryTestId="confirmation-summary"
        detailsLabelledBy="confirmation-details-heading"
        summaryLabelledBy="confirmation-summary-heading"
        details={
          <>
            <h2
              id="confirmation-details-heading"
              className="text-2xl font-semibold"
            >
              Podrobnosti naročila
            </h2>
            <section className="mt-6" aria-labelledby="confirmation-items">
              <h3 id="confirmation-items" className="text-base font-semibold">
                Izdelki
              </h3>
              <ul className="mt-4 min-w-0 divide-y divide-[color:var(--site-divider-color)]">
                {snapshot.items.map((item) => (
                  <li
                    key={`${item.variantId}-${item.sku}`}
                    className="grid min-w-0 grid-cols-[5rem_minmax(0,1fr)] gap-4 py-5 first:pt-0 last:pb-0"
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
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center px-2 text-center text-[10px] text-[color:var(--site-color-text-muted)]">
                          Brez slike
                        </span>
                      )}
                    </div>
                    <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="min-w-0">
                        <h4
                          className="font-semibold text-[color:var(--site-color-text)]"
                          data-testid="confirmation-item-title"
                        >
                          {buildConfirmationItemTitle(
                            item.productName,
                            item.variantName
                          )}
                        </h4>
                        {item.sku ? (
                          <p className="mt-1 break-all text-xs text-[color:var(--site-color-text-muted)]">
                            SKU: {item.sku}
                          </p>
                        ) : null}
                      </div>
                      <OrderConfirmationItemPricing item={item} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
            <ConfirmationCustomerDetails
              heading="Podatki o naročilu"
              headingId="delivery-heading"
              name={customerName}
              email={customerEmail}
              address={address}
              testId="confirmation-customer-section"
            />
          </>
        }
        summary={
          <>
            <OrderConfirmationSummary
              items={snapshot.items}
              totals={snapshot.totals}
            />
            <section
              className="mt-6 border-t border-[color:var(--site-divider-color)] pt-6"
              data-testid="confirmation-documents-section"
              data-confirmation-region="document"
              aria-labelledby="documents-heading"
            >
              <h2 id="documents-heading" className="sr-only">
                Dokumenti
              </h2>
              <ul className="grid gap-3">
                <li>
                  {orderSummaryDocument ? (
                    <a
                      href={orderSummaryDocument.url}
                      download
                      className={CONFIRMATION_PRIMARY_DOCUMENT_ACTION_CLASS}
                      data-testid="order-confirmation-pdf"
                    >
                      <Download aria-hidden="true" className="h-5 w-5" />
                      Prenesi potrditev (PDF)
                    </a>
                  ) : (
                    <button
                      type="button"
                      className={`${CONFIRMATION_PRIMARY_DOCUMENT_ACTION_CLASS} cursor-wait opacity-70`}
                      data-testid="order-confirmation-pdf"
                      disabled
                    >
                      <Download aria-hidden="true" className="h-5 w-5" />
                      Prenesi potrditev (PDF)
                      <span className="sr-only"> – pripravlja se</span>
                    </button>
                  )}
                  <p
                    className={`mt-1 min-h-5 text-center text-xs leading-5 text-[color:var(--site-color-text-muted)]${
                      orderSummaryDocument ? ' invisible' : ''
                    }`}
                    aria-hidden={orderSummaryDocument ? true : undefined}
                  >
                    Pripravljamo …
                  </p>
                </li>
                {otherDocuments.map(({ document, index, url }) => (
                  <li key={`${document.type}-${url}-${index}`}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className={CONFIRMATION_DOCUMENT_ACTION_CLASS}
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
          </>
        }
      />
    </div>
  );
}
