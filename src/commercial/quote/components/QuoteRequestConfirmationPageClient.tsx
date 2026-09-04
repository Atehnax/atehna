'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CONFIRMATION_DOCUMENT_ACTION_CLASS } from '@/commercial/components/confirmationDocumentAction';
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
import { readJsonResponse } from '@/shared/client/readJsonResponse';
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

const DEFAULT_CONFIRMATION_PDF_FILENAME = 'potrditev-povprasevanja.pdf';

const confirmationPdfFilename = (response: Response) => {
  const disposition = response.headers.get('content-disposition') ?? '';
  const candidate = /filename="?([^";]+)"?/iu.exec(disposition)?.[1]?.trim();
  return candidate && /^[a-z0-9][a-z0-9._-]{0,127}\.pdf$/iu.test(candidate)
    ? candidate
    : DEFAULT_CONFIRMATION_PDF_FILENAME;
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
  const [documentLoading, setDocumentLoading] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
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
      const payload: unknown = await readJsonResponse(response, {});
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

  const downloadConfirmationPdf = useCallback(async () => {
    const session = accessSessionRef.current;
    if (!session) {
      setDocumentError('Povezava za prenos dokumenta ni veljavna.');
      return;
    }

    setDocumentLoading(true);
    setDocumentError(null);
    try {
      const response = await fetch('/api/quote-requests/confirmation/pdf', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: {
          ...buildQuoteAccessHeaders(session),
          Accept: 'application/pdf'
        }
      });
      if (!response.ok) {
        const payload: unknown = await readJsonResponse(response, {});
        const message =
          payload && typeof payload === 'object' && 'message' in payload
            ? String((payload as { message?: unknown }).message ?? '').trim()
            : '';
        throw new Error(
          message || 'Dokumenta trenutno ni mogoče pripraviti.'
        );
      }

      const contentType = response.headers
        .get('content-type')
        ?.split(';')[0]
        ?.trim()
        .toLowerCase();
      if (contentType !== 'application/pdf') {
        throw new Error('Strežnik ni vrnil veljavnega PDF dokumenta.');
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error('Prejeti PDF dokument je prazen.');
      }

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = confirmationPdfFilename(response);
      anchor.style.display = 'none';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    } catch (error) {
      setDocumentError(
        error instanceof Error
          ? error.message
          : 'Dokumenta trenutno ni mogoče pripraviti.'
      );
    } finally {
      setDocumentLoading(false);
    }
  }, []);

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
  const customer = snapshot.customer;
  const postalAddressLine = [customer.postalCode, customer.city]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' ');
  const addressLines = [
    customer.addressLine1?.trim(),
    customer.addressLine2?.trim(),
    postalAddressLine
  ].filter((value): value is string => Boolean(value));
  const address = addressLines.join(', ');
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

        <div
          className="grid min-w-0 border-t border-[color:var(--site-divider-color)] lg:col-span-2 lg:row-start-2 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.35fr)]"
          data-testid="quote-request-confirmation-lower-sections"
        >
          <section
            className="min-w-0 p-5 sm:p-6"
            data-testid="quote-request-confirmation-customer-section"
            data-confirmation-region="customer"
            aria-labelledby="quote-confirmation-customer-heading"
          >
            <h2
              id="quote-confirmation-customer-heading"
              className="text-xl font-semibold sm:text-2xl"
            >
              Podatki o povpraševanju
            </h2>
            <dl className="mt-3 grid gap-x-4 gap-y-2 text-base sm:grid-cols-3">
              <div className="min-w-0">
                <dt className="leading-6 text-[color:var(--site-color-text-muted)]">
                  Naročnik
                </dt>
                <dd className="mt-0.5 break-words text-lg font-semibold leading-6">
                  {customer.organizationName || customer.contactName || '—'}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="leading-6 text-[color:var(--site-color-text-muted)]">
                  Email
                </dt>
                <dd className="mt-0.5 break-words text-lg font-semibold leading-6">
                  {customer.email ? (
                    <a
                      href={`mailto:${customer.email}`}
                      className="text-[color:var(--site-color-primary)] underline-offset-2 hover:underline"
                    >
                      {customer.email}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="leading-6 text-[color:var(--site-color-text-muted)]">
                  Naslov
                </dt>
                <dd className="mt-0.5 break-words text-lg font-semibold leading-6">
                  {address || '—'}
                </dd>
              </div>
            </dl>
          </section>

          <section
            className="min-w-0 border-t border-[color:var(--site-divider-color)] p-5 sm:p-6 lg:border-l lg:border-t-0"
            data-testid="quote-request-confirmation-documents-section"
            data-confirmation-region="document"
            aria-labelledby="quote-confirmation-documents-heading"
          >
            <h2
              id="quote-confirmation-documents-heading"
              className="text-xl font-semibold"
            >
              Dokumenti
            </h2>
            <button
              type="button"
              className={`${CONFIRMATION_DOCUMENT_ACTION_CLASS} mt-4`}
              data-testid="quote-request-confirmation-pdf"
              disabled={documentLoading}
              onClick={() => void downloadConfirmationPdf()}
            >
              {documentLoading
                ? 'Pripravljamo PDF …'
                : 'Potrditev povpraševanja (PDF)'}
            </button>
            {documentError ? (
              <p
                className="mt-3 text-sm leading-5 text-[color:var(--site-color-danger)]"
                role="alert"
              >
                {documentError}
              </p>
            ) : null}
          </section>
        </div>
      </article>
    </div>
  );
}
