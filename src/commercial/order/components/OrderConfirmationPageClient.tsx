'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import OrderSubmissionStatus from '@/commercial/order/components/OrderSubmissionStatus';
import {
  parseOrderApiError,
  type OrderConfirmationSnapshot
} from '@/commercial/order/contracts';
import {
  buildOrderConfirmationAccessUrl,
  buildOrderConfirmationFragmentUrl,
  consumeOrderAccessTokenFromLocation,
  exchangeOrderAccessToken,
  readOrderAccessIdFromLocation,
  storeOrderAccessId,
  readStoredOrderAccessId
} from '@/commercial/order/orderAccessClient';
import { formatEuro } from '@/shared/domain/formatting';

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

const ATTRIBUTE_LABELS: Record<string, string> = {
  length: 'Dolžina',
  width: 'Širina',
  thickness: 'Debelina',
  weight: 'Teža',
  errorTolerance: 'Toleranca',
  brand: 'Znamka',
  material: 'Material',
  colour: 'Barva',
  color: 'Barva',
  shape: 'Oblika',
  badge: 'Oznaka'
};

const CUSTOMER_DOCUMENT_LABELS: Record<string, string> = {
  order_summary: 'Potrditev naročila',
  purchase_order: 'Naročilnica',
  dobavnica: 'Dobavnica',
  predracun: 'Predračun',
  invoice: 'Račun'
};

const customerDocumentLabel = (type: string | undefined, index: number) =>
  CUSTOMER_DOCUMENT_LABELS[type ?? ''] ?? `Dokument ${index + 1}`;

const formatAttribute = ([key, rawValue]: [string, string | number]) => {
  const value = String(rawValue);
  const unit =
    key === 'length' || key === 'width' || key === 'thickness'
      ? ' mm'
      : key === 'weight'
        ? ' kg'
        : '';
  const prefix =
    key === 'errorTolerance' && !value.startsWith('±') ? '±' : '';
  const toleranceUnit =
    key === 'errorTolerance' &&
    !value.toLocaleLowerCase('sl').includes('mm')
      ? ' mm'
      : '';
  return `${ATTRIBUTE_LABELS[key] ?? key}: ${prefix}${value}${unit}${toleranceUnit}`;
};

export default function OrderConfirmationPageClient() {
  const [state, setState] = useState<ConfirmationState>({ status: 'loading' });
  const [isRefreshingDocuments, setIsRefreshingDocuments] = useState(false);
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

      const locationAccessId = readOrderAccessIdFromLocation();
      let accessId =
        accessIdRef.current ?? locationAccessId ?? readStoredOrderAccessId();
      if (bootstrapTokenRef.current) {
        const session = await exchangeOrderAccessToken(bootstrapTokenRef.current);
        accessId = session.accessId;
        bootstrapTokenRef.current = null;
      } else if (locationAccessId) {
        storeOrderAccessId(locationAccessId);
      }
      if (!accessId) {
        throw new Error('Povezava za prikaz potrditve ni veljavna.');
      }

      accessIdRef.current = accessId;
      window.history.replaceState(
        window.history.state,
        '',
        buildOrderConfirmationAccessUrl(accessId)
      );
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

  const refreshDocumentsNow = useCallback(async () => {
    const accessId = accessIdRef.current;
    if (!accessId) return;
    setIsRefreshingDocuments(true);
    try {
      const snapshot = await fetchConfirmation(accessId);
      setState((current) =>
        current.status === 'ready'
          ? { status: 'ready', snapshot }
          : current
      );
    } catch {
      // Preserve the accepted-order state; the action remains available to retry.
    } finally {
      setIsRefreshingDocuments(false);
    }
  }, [fetchConfirmation]);

  if (state.status === 'loading') {
    return (
      <div className="site-panel mx-auto max-w-2xl p-8 text-center" role="status">
        <span
          aria-hidden="true"
          className="mx-auto block h-9 w-9 animate-spin rounded-full border-2 border-[color:var(--site-border-color)] border-t-[color:var(--site-color-primary)]"
        />
        <h1 className="site-heading-2 mt-5">Pripravljamo potrditev</h1>
        <p className="site-paragraph mt-2">Preverjamo podatke naročila …</p>
      </div>
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
  const purchaseOrderHref = `/order/narocilnica?orderId=${encodeURIComponent(
    String(snapshot.orderId)
  )}&orderNumber=${encodeURIComponent(
    snapshot.orderNumber
  )}&access=${encodeURIComponent(accessIdRef.current ?? '')}`;
  const availableDocuments = snapshot.documents.flatMap((document, index) => {
    const url = document.url?.trim();
    return url ? [{ document, index, url }] : [];
  });
  const orderSummaryAvailable = hasOrderSummary(snapshot);

  return (
    <div>
      <OrderSubmissionStatus commitmentStatus={snapshot.commitmentStatus} />

      <article
        className="site-card mt-6 overflow-hidden !p-0"
        data-testid="order-confirmation-content-card"
        aria-labelledby="confirmation-items"
      >
        <section
          className="p-5 sm:p-6"
          data-testid="confirmation-order-section"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="site-eyebrow">Številka naročila</p>
              <h2 id="confirmation-items" className="site-heading-2 mt-1">
                {snapshot.orderNumber}
              </h2>
            </div>
            {submittedAt ? (
              <p className="text-sm text-[color:var(--site-color-text-muted)]">
                {submittedAt}
              </p>
            ) : null}
          </div>

          <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
            <ul className="min-w-0 divide-y divide-[color:var(--site-divider-color)]">
              {snapshot.items.map((item) => (
                <li
                  key={`${item.variantId}-${item.sku}`}
                  className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 py-4 first:pt-0 last:pb-0"
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
                        className="object-contain p-2"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center px-2 text-center text-[10px] text-[color:var(--site-color-text-muted)]">
                        Brez slike
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-[color:var(--site-color-text)]">
                          {item.productName}
                        </h3>
                        {item.variantName ? (
                          <p className="mt-0.5 text-sm text-[color:var(--site-color-text-muted)]">
                            {item.variantName}
                          </p>
                        ) : null}
                        <p className="mt-0.5 break-all font-mono text-xs text-[color:var(--site-color-text-muted)]">
                          SKU: {item.sku}
                        </p>
                      </div>
                      <p className="font-semibold tabular-nums text-[color:var(--site-color-text)]">
                        {formatEuro(item.lineGross)}
                      </p>
                    </div>
                    {Object.keys(item.attributes).length > 0 ? (
                      <p className="mt-1.5 text-xs text-[color:var(--site-color-text-muted)]">
                        {Object.entries(item.attributes)
                          .map(formatAttribute)
                          .join(' · ')}
                      </p>
                    ) : null}
                    <p className="mt-1.5 text-xs text-[color:var(--site-color-text-muted)]">
                      {item.quantity} {item.unit || 'kos'} ·{' '}
                      {formatEuro(item.lineNet)} brez DDV · DDV{' '}
                      {Math.round(item.taxRate * 100)} %:{' '}
                      {formatEuro(item.lineTax)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <aside
              className="border-t border-[color:var(--site-divider-color)] pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0"
              data-testid="confirmation-summary"
              aria-labelledby="confirmation-summary-heading"
            >
              <h3 id="confirmation-summary-heading" className="text-lg font-semibold">
                Povzetek
              </h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-[color:var(--site-color-text-muted)]">
                    Cena brez DDV
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {formatEuro(snapshot.totals.net)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[color:var(--site-color-text-muted)]">
                    DDV
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {formatEuro(snapshot.totals.tax)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[color:var(--site-color-text-muted)]">
                    Dostava
                  </dt>
                  <dd className="font-semibold text-[color:var(--site-color-success)]">
                    Brezplačno
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-[color:var(--site-divider-color)] pt-2.5 text-base font-semibold">
                  <dt>Skupaj z DDV</dt>
                  <dd className="tabular-nums text-[color:var(--site-color-primary)]">
                    {formatEuro(snapshot.totals.gross)}
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
        </section>

        <div className="grid border-t border-[color:var(--site-divider-color)] lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
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
                  {customer?.addressLine1 || customer?.deliveryAddress || '—'}
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
                  <li key={String(document.id ?? `${url}-${index}`)}>
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

            {!orderSummaryAvailable ? (
              <div className={availableDocuments.length > 0 ? 'mt-4' : 'mt-3'}>
                <p
                  className="text-sm text-[color:var(--site-color-text-muted)]"
                  role="status"
                >
                  Potrditev naročila pripravljamo …
                </p>
                <button
                  type="button"
                  className="mt-2 text-sm font-semibold text-[color:var(--site-color-primary)] underline-offset-4 hover:underline disabled:cursor-wait disabled:opacity-60"
                  onClick={() => void refreshDocumentsNow()}
                  disabled={isRefreshingDocuments}
                >
                  {isRefreshingDocuments ? 'Preverjamo …' : 'Preveri zdaj'}
                </button>
              </div>
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
