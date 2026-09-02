'use client';

import Link from 'next/link';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import OrderLoadingState from '@/commercial/order/components/OrderLoadingState';
import { storeOrderAccessId } from '@/commercial/order/orderAccessClient';
import {
  parseQuotePublicApiError,
  type QuoteAcceptResponse,
  type QuoteDeclineResponse,
  type QuoteOfferReviewSnapshot,
  type QuoteOfferReviewWireSnapshot,
  type QuoteOtpRequestResponse,
  type QuotePurchaseOrderResponse
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
import { COMPANY_INFO } from '@/shared/domain/order/constants';
import { getQuoteCustomerMessage } from '@/shared/domain/quote/quoteCustomerMessage';

type ReviewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; offer: QuoteOfferReviewSnapshot };
type ResponseIntent = 'accept' | 'decline' | 'upload';

const MAX_PURCHASE_ORDER_SIZE = 10 * 1024 * 1024;
const QUOTE_OTP_PATTERN = /^\d{6}$/u;
const QUOTE_VERIFICATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const DECLINE_REASONS = [
  { value: '', label: 'Brez razloga' },
  { value: 'price', label: 'Cena' },
  { value: 'delivery_time', label: 'Dobavni rok' },
  { value: 'needs_changed', label: 'Potrebe so se spremenile' },
  { value: 'another_offer', label: 'Izbrana je bila druga ponudba' },
  { value: 'other', label: 'Drugo' }
] as const;

const createIdempotencyKey = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `atehna-quote-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const formatDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('sl-SI', { dateStyle: 'long' }).format(parsed);
};

const isSupportedPurchaseOrderFile = (file: File) =>
  file.type === 'application/pdf' ||
  file.type === 'image/jpeg' ||
  /\.(?:pdf|jpe?g)$/iu.test(file.name);

export default function QuoteOfferReviewPageClient() {
  const [state, setState] = useState<ReviewState>({ status: 'loading' });
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<ResponseIntent | null>(null);
  const [pendingIntent, setPendingIntent] = useState<ResponseIntent | null>(null);
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpVerificationId, setOtpVerificationId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [purchaseOrder, setPurchaseOrder] = useState<File | null>(null);
  const accessSessionRef = useRef<QuoteAccessSession | null>(null);
  const bootstrapTokenRef = useRef<string | null>(null);
  const locationTokenConsumedRef = useRef(false);
  const idempotencyKeysRef = useRef<Record<ResponseIntent, string | null>>({
    accept: null,
    decline: null,
    upload: null
  });

  const loadOffer = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      if (!locationTokenConsumedRef.current) {
        bootstrapTokenRef.current = consumeQuoteAccessTokenFromLocation();
        locationTokenConsumedRef.current = true;
      }
      let session = accessSessionRef.current ?? readStoredQuoteAccessSession();
      if (bootstrapTokenRef.current) {
        session = await exchangeQuoteAccessToken(bootstrapTokenRef.current, 'offer');
        bootstrapTokenRef.current = null;
      }
      if (!session) throw new Error('Povezava za prikaz ponudbe ni veljavna.');
      accessSessionRef.current = session;

      const response = await fetch('/api/quote-requests/offer', {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: buildQuoteAccessHeaders(session, true)
      });
      const payload: unknown = await readJsonResponse(response, {});
      if (!response.ok) {
        throw new Error(
          parseQuotePublicApiError(
            payload,
            'Ponudbe trenutno ni mogoče prikazati.'
          ).message
        );
      }
      const wire = payload as QuoteOfferReviewWireSnapshot;
      const isSchool = wire.customer?.customerType === 'school';
      const firstDocument = wire.documents?.[0];
      const resultingOrderAccessId = wire.resultingOrderAccessId ?? null;
      const hasResultingOrder = Boolean(resultingOrderAccessId);
      setState({
        status: 'ready',
        offer: {
          requestNumber: wire.requestNumber,
          offerNumber: wire.offerNumber,
          versionNumber: wire.versionNumber,
          state: wire.status,
          issuedAt: wire.issuedAt,
          validUntil: wire.validUntil,
          customer: wire.customer,
          items: wire.items ?? [],
          totals: wire.totals,
          deliveryTerms: wire.deliveryTerms,
          paymentTerms: wire.paymentTerms,
          acceptanceMethod: wire.acceptanceMethod,
          sellerMessage: wire.sellerMessage,
          customerVisibleNotes: wire.customerVisibleNotes,
          termsText: wire.termsText,
          termsVersion: wire.termsVersion,
          customerReference: wire.customer?.reference ?? null,
          documentUrl: firstDocument?.accessId
            ? `/api/quote-requests/documents/${encodeURIComponent(firstDocument.accessId)}`
            : null,
          emailVerificationRequired:
            wire.emailVerificationRequired !== false,
          emailVerified: wire.emailVerified === true,
          canAccept:
            !hasResultingOrder &&
            (wire.canAccept ?? (wire.responseEnabled && !isSchool)),
          canDecline:
            !hasResultingOrder && (wire.canDecline ?? wire.responseEnabled),
          canUploadPurchaseOrder:
            !hasResultingOrder &&
            (wire.canUploadPurchaseOrder ?? (wire.responseEnabled && isSchool)),
          resultingOrderAccessId
        }
      });
    } catch (error) {
      setState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Ponudbe trenutno ni mogoče prikazati.'
      });
    }
  }, []);

  useEffect(() => {
    void loadOffer();
  }, [loadOffer]);

  const offer = state.status === 'ready' ? state.offer : null;
  const responseFingerprint = offer
    ? `${offer.offerNumber}:${offer.versionNumber}:${offer.state}`
    : '';
  useEffect(() => {
    idempotencyKeysRef.current = { accept: null, decline: null, upload: null };
  }, [responseFingerprint]);

  const questionHref = useMemo(() => {
    const subject = offer
      ? `Vprašanje glede ponudbe ${offer.offerNumber}`
      : 'Vprašanje glede ponudbe';
    return `mailto:${COMPANY_INFO.orderEmail}?subject=${encodeURIComponent(subject)}`;
  }, [offer]);

  const openOfferDocument = async () => {
    if (!offer?.documentUrl || !accessSessionRef.current) return;
    setActionError(null);
    setDocumentLoading(true);
    const previewWindow = window.open('about:blank', '_blank');
    if (previewWindow) previewWindow.opener = null;
    try {
      const response = await fetch(offer.documentUrl, {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: buildQuoteAccessHeaders(accessSessionRef.current)
      });
      if (!response.ok) {
        const payload: unknown = await readJsonResponse(response, {});
        throw new Error(
          parseQuotePublicApiError(
            payload,
            'Dokumenta trenutno ni mogoče odpreti.'
          ).message
        );
      }
      const contentType =
        response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? '';
      const blob = await response.blob();
      if (contentType !== 'application/pdf' || blob.size < 1) {
        throw new Error('Dokument ponudbe ni veljaven PDF.');
      }
      const objectUrl = URL.createObjectURL(blob);
      if (previewWindow && !previewWindow.closed) {
        previewWindow.location.replace(objectUrl);
      } else {
        const download = document.createElement('a');
        download.href = objectUrl;
        download.download = `${offer.offerNumber}.pdf`;
        download.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      previewWindow?.close();
      setActionError(
        error instanceof Error
          ? error.message
          : 'Dokumenta trenutno ni mogoče odpreti.'
      );
    } finally {
      setDocumentLoading(false);
    }
  };

  const requestOtp = async (intent: ResponseIntent) => {
    if (!offer || !accessSessionRef.current) return false;
    if (!offer.emailVerificationRequired || offer.emailVerified) return true;
    setActionError(null);
    setActiveAction(intent);
    setOtpVerificationId(null);
    try {
      const response = await fetch('/api/quote-requests/offer/otp/request', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          ...buildQuoteAccessHeaders(accessSessionRef.current, true),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      const payload: unknown = await readJsonResponse(response, {});
      if (!response.ok) {
        throw new Error(
          parseQuotePublicApiError(
            payload,
            'Kode za preverjanje ni bilo mogoče poslati.'
          ).message
        );
      }
      const otpResponse = payload as Partial<QuoteOtpRequestResponse>;
      if (
        typeof otpResponse.verificationId !== 'string' ||
        !QUOTE_VERIFICATION_ID_PATTERN.test(otpResponse.verificationId)
      ) {
        throw new Error('Kode za preverjanje ni bilo mogoče pripraviti.');
      }
      setOtpVerificationId(otpResponse.verificationId.toLowerCase());
      setPendingIntent(intent);
      setOtpRequested(true);
      setOtpCode('');
      setActionMessage('Na e-poštni naslov ponudbe smo poslali enkratno kodo.');
      return false;
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Kode za preverjanje ni bilo mogoče poslati.'
      );
      return false;
    } finally {
      setActiveAction(null);
    }
  };

  const performResponse = async (intent: 'accept' | 'decline') => {
    if (!offer || !accessSessionRef.current) return;
    setActionError(null);
    setActionMessage(null);
    setActiveAction(intent);
    idempotencyKeysRef.current[intent] ??= createIdempotencyKey();
    try {
      const response = await fetch(
        intent === 'accept'
          ? '/api/quote-requests/accept'
          : '/api/quote-requests/decline',
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            ...buildQuoteAccessHeaders(accessSessionRef.current, true),
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKeysRef.current[intent] as string
          },
          body: JSON.stringify({
            offerNumber: offer.offerNumber,
            versionNumber: offer.versionNumber,
            ...(intent === 'decline' && declineReason
              ? { reason: declineReason }
              : {})
          })
        }
      );
      const payload: unknown = await readJsonResponse(response, {});
      if (!response.ok) {
        const error = parseQuotePublicApiError(
          payload,
          intent === 'accept'
            ? 'Ponudbe ni bilo mogoče sprejeti.'
            : 'Ponudbe ni bilo mogoče zavrniti.'
        );
        if (error.code === 'STOCK_CHANGED' || error.code === 'STOCK_CONFLICT') {
          idempotencyKeysRef.current.accept = null;
        }
        throw new Error(error.message);
      }

      const record =
        payload && typeof payload === 'object'
          ? (payload as Record<string, unknown>)
          : {};
      let resultingOrderAccessId = offer.resultingOrderAccessId;
      if (intent === 'accept') {
        const result = record as Partial<QuoteAcceptResponse>;
        if (
          result.status !== 'accepted' ||
          typeof result.orderAccessId !== 'string' ||
          !result.orderAccessId.trim()
        ) {
          throw new Error('Dostopa do ustvarjenega naročila ni bilo mogoče ustvariti.');
        }
        resultingOrderAccessId = result.orderAccessId.trim();
        storeOrderAccessId(resultingOrderAccessId);
      } else {
        const result = record as Partial<QuoteDeclineResponse>;
        if (result.status !== 'declined') {
          throw new Error('Potrdila o zavrnitvi ponudbe ni bilo mogoče prebrati.');
        }
      }
      setState({
        status: 'ready',
        offer: {
          ...offer,
          state: intent === 'accept' ? 'accepted' : 'declined',
          canAccept: false,
          canDecline: false,
          resultingOrderAccessId
        }
      });
      setActionMessage(
        intent === 'accept'
          ? 'Ponudbo ste sprejeli. Naročilo je bilo ustvarjeno.'
          : 'Ponudbo ste zavrnili.'
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : intent === 'accept'
            ? 'Ponudbe ni bilo mogoče sprejeti.'
            : 'Ponudbe ni bilo mogoče zavrniti.'
      );
    } finally {
      setActiveAction(null);
    }
  };

  const performPurchaseOrderUpload = async () => {
    if (!offer || !accessSessionRef.current || !purchaseOrder) {
      setActionError('Izberite datoteko naročilnice.');
      return;
    }
    setActionError(null);
    setActiveAction('upload');
    idempotencyKeysRef.current.upload ??= createIdempotencyKey();
    const body = new FormData();
    body.set('file', purchaseOrder);
    body.set('offerNumber', offer.offerNumber);
    body.set('versionNumber', String(offer.versionNumber));
    try {
      const response = await fetch('/api/quote-requests/purchase-order', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          ...buildQuoteAccessHeaders(accessSessionRef.current, true),
          'Idempotency-Key': idempotencyKeysRef.current.upload as string
        },
        body
      });
      const payload: unknown = await readJsonResponse(response, {});
      if (!response.ok) {
        throw new Error(
          parseQuotePublicApiError(
            payload,
            'Naročilnice ni bilo mogoče naložiti.'
          ).message
        );
      }
      const result = payload as Partial<QuotePurchaseOrderResponse>;
      if (
        result.status !== 'awaiting_purchase_order_review' ||
        typeof result.orderAccessId !== 'string' ||
        !result.orderAccessId.trim()
      ) {
        throw new Error('Dostopa do prejetega naročila ni bilo mogoče ustvariti.');
      }
      const orderAccessId = result.orderAccessId.trim();
      storeOrderAccessId(orderAccessId);
      setState({
        status: 'ready',
        offer: {
          ...offer,
          emailVerified: true,
          canAccept: false,
          canDecline: false,
          canUploadPurchaseOrder: false,
          resultingOrderAccessId: orderAccessId
        }
      });
      setActionMessage(
        'Naročilnica je poslana v pregled. Ponudba še ni sprejeta, dokler Atehna ne potrdi ujemanja.'
      );
      setPurchaseOrder(null);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Naročilnice ni bilo mogoče naložiti.'
      );
    } finally {
      setActiveAction(null);
    }
  };

  const beginResponse = async (intent: ResponseIntent) => {
    const verified = await requestOtp(intent);
    if (!verified) return;
    if (intent === 'upload') await performPurchaseOrderUpload();
    else await performResponse(intent);
  };

  const verifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!offer || !accessSessionRef.current || !pendingIntent) return;
    if (!otpVerificationId) {
      setActionError('Najprej zahtevajte novo varnostno kodo.');
      return;
    }
    const normalizedCode = otpCode.trim();
    if (!QUOTE_OTP_PATTERN.test(normalizedCode)) {
      setActionError('Vnesite šestmestno varnostno kodo.');
      return;
    }
    setActionError(null);
    setActiveAction(pendingIntent);
    try {
      const response = await fetch('/api/quote-requests/offer/otp/verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          ...buildQuoteAccessHeaders(accessSessionRef.current, true),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          verificationId: otpVerificationId,
          code: normalizedCode
        })
      });
      const payload: unknown = await readJsonResponse(response, {});
      if (!response.ok) {
        throw new Error(
          parseQuotePublicApiError(payload, 'Koda ni veljavna.').message
        );
      }
      const verifiedIntent = pendingIntent;
      setState({ status: 'ready', offer: { ...offer, emailVerified: true } });
      setPendingIntent(null);
      setOtpRequested(false);
      setOtpVerificationId(null);
      setOtpCode('');
      setActionMessage('E-poštni naslov je potrjen.');
      setActiveAction(null);
      if (verifiedIntent === 'upload') await performPurchaseOrderUpload();
      else await performResponse(verifiedIntent);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Kode ni bilo mogoče preveriti.'
      );
      setActiveAction(null);
    }
  };

  if (state.status === 'loading') {
    return (
      <OrderLoadingState
        heading="Nalagamo ponudbo"
        description="Prosimo, počakajte, da pripravimo varen prikaz ponudbe."
        ariaLabel="Nalaganje ponudbe"
        testId="quote-offer-loading"
      />
    );
  }

  if (state.status === 'error') {
    return (
      <div className="site-panel mx-auto max-w-2xl p-8 text-center" role="alert">
        <h1 className="site-heading-2">Ponudbe ni mogoče prikazati</h1>
        <p className="site-paragraph mt-3">{state.message}</p>
        {accessSessionRef.current || bootstrapTokenRef.current ? (
          <button
            type="button"
            onClick={() => void loadOffer()}
            className="site-button site-button--primary mt-6"
          >
            Poskusi znova
          </button>
        ) : null}
      </div>
    );
  }

  const { offer: currentOffer } = state;
  const customerMessage = getQuoteCustomerMessage(
    currentOffer.sellerMessage,
    currentOffer.customerVisibleNotes
  );
  const requiresPurchaseOrder =
    currentOffer.canUploadPurchaseOrder && !currentOffer.canAccept;
  const responseUnavailable =
    !currentOffer.canAccept && !currentOffer.canDecline && currentOffer.state !== 'accepted';

  return (
    <div className="mx-auto max-w-6xl">
      <header className="site-panel p-6 sm:p-8">
        <p className="site-eyebrow">Ponudba Atehna</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="site-heading-1 !text-2xl sm:!text-3xl">
              {currentOffer.offerNumber}
            </h1>
            <p className="mt-2 text-sm text-[color:var(--site-color-text-muted)]">
              Izdana {formatDate(currentOffer.issuedAt)} · Veljavna do{' '}
              {formatDate(currentOffer.validUntil)}
            </p>
          </div>
          {currentOffer.documentUrl ? (
            <button
              type="button"
              onClick={() => void openOfferDocument()}
              disabled={documentLoading}
              className="site-button site-button--secondary inline-flex items-center justify-center"
            >
              {documentLoading ? 'Odpiramo ponudbo …' : 'Odpri ponudbo (PDF)'}
            </button>
          ) : null}
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]">
        <section className="site-card">
          <h2 className="text-xl font-semibold">Postavke ponudbe</h2>
          <ul className="mt-4 divide-y divide-[color:var(--site-divider-color)]">
            {currentOffer.items.map((item) => (
              <li
                key={`${item.lineNumber}-${item.sku}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-4"
              >
                <div>
                  <p className="font-semibold">{item.productName}</p>
                  <p className="mt-1 text-xs text-[color:var(--site-color-text-muted)]">
                    {item.variantName} · SKU {item.sku} · {item.quantity}{' '}
                    {item.unit ?? 'kos'}
                  </p>
                </div>
                <p className="font-semibold tabular-nums">
                  {formatEuro(item.lineGross)}
                </p>
              </li>
            ))}
          </ul>
          <dl className="mt-5 grid gap-4 border-t border-[color:var(--site-divider-color)] pt-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[color:var(--site-color-text-muted)]">Dobavni pogoji</dt>
              <dd className="mt-1 font-semibold">{currentOffer.deliveryTerms}</dd>
            </div>
            <div>
              <dt className="text-[color:var(--site-color-text-muted)]">Plačilni pogoji</dt>
              <dd className="mt-1 font-semibold">{currentOffer.paymentTerms}</dd>
            </div>
            {currentOffer.customerReference ? (
              <div className="sm:col-span-2">
                <dt className="text-[color:var(--site-color-text-muted)]">Referenca</dt>
                <dd className="mt-1 font-semibold">{currentOffer.customerReference}</dd>
              </div>
            ) : null}
          </dl>
          {customerMessage ? (
            <section className="mt-5 border-t border-[color:var(--site-divider-color)] pt-5">
              <h2 className="text-lg font-semibold">Sporočilo ob ponudbi</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                {customerMessage}
              </p>
            </section>
          ) : null}
          {currentOffer.termsText ? (
            <section className="mt-5 border-t border-[color:var(--site-divider-color)] pt-5">
              <h2 className="text-lg font-semibold">Pogoji ponudbe</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[color:var(--site-color-text-muted)]">
                {currentOffer.termsText}
              </p>
            </section>
          ) : null}
        </section>

        <aside className="site-card h-fit lg:sticky lg:top-8">
          <h2 className="text-xl font-semibold">Povzetek ponudbe</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt>Cena brez DDV</dt>
              <dd className="font-semibold tabular-nums">{formatEuro(currentOffer.totals.net)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>DDV</dt>
              <dd className="font-semibold tabular-nums">{formatEuro(currentOffer.totals.tax)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Dostava</dt>
              <dd className="font-semibold tabular-nums">
                {currentOffer.totals.shipping === null
                  ? 'Po dogovoru'
                  : formatEuro(currentOffer.totals.shipping)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-[color:var(--site-divider-color)] pt-3 text-base">
              <dt className="font-semibold">Skupaj z DDV</dt>
              <dd className="font-semibold tabular-nums">
                {currentOffer.totals.gross === null
                  ? 'Po dogovoru'
                  : formatEuro(currentOffer.totals.gross)}
              </dd>
            </div>
          </dl>

          {actionError ? (
            <p className="site-radius-sm mt-5 border border-[color:var(--site-color-danger)] p-3 text-sm text-[color:var(--site-color-danger)]" role="alert">
              {actionError}
            </p>
          ) : null}
          {actionMessage ? (
            <p className="site-radius-sm mt-5 border border-[color:var(--site-color-success)] p-3 text-sm" role="status">
              {actionMessage}
            </p>
          ) : null}

          {otpRequested ? (
            <form onSubmit={verifyOtp} className="mt-5 border-t border-[color:var(--site-divider-color)] pt-5">
              <label htmlFor="quoteOtp" className="block text-sm font-semibold">
                Enkratna koda iz e-pošte
              </label>
              <input
                id="quoteOtp"
                value={otpCode}
                onChange={(event) =>
                  setOtpCode(event.target.value.replace(/\D/gu, '').slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                className="site-radius-sm mt-2 min-h-12 w-full border border-[color:var(--site-border-color)] px-4"
              />
              <button
                type="submit"
                disabled={!QUOTE_OTP_PATTERN.test(otpCode) || activeAction !== null}
                className="site-button site-button--primary mt-3 w-full"
              >
                Potrdi e-poštni naslov
              </button>
            </form>
          ) : null}

          {currentOffer.state === 'accepted' ? (
            <div className="mt-5">
              <p className="font-semibold text-[color:var(--site-color-success)]">
                Ponudba je sprejeta
              </p>
              {currentOffer.resultingOrderAccessId ? (
                <Link
                  href="/order/confirmation"
                  className="site-button site-button--primary mt-3 inline-flex w-full items-center justify-center"
                >
                  Odpri naročilo
                </Link>
              ) : null}
            </div>
          ) : currentOffer.resultingOrderAccessId ? (
            <div className="mt-5">
              <p className="font-semibold text-[color:var(--site-color-success)]">
                Naročilnica je prejeta
              </p>
              <p className="mt-2 text-sm text-[color:var(--site-color-text-muted)]">
                Naročilo čaka na pregled in potrditev Atehne.
              </p>
              <Link
                href="/order/confirmation"
                className="site-button site-button--primary mt-3 inline-flex w-full items-center justify-center"
              >
                Odpri prejeto naročilo
              </Link>
            </div>
          ) : currentOffer.state === 'declined' ? (
            <div className="mt-5">
              <p className="font-semibold">Ponudba je zavrnjena</p>
              <p className="mt-2 text-sm text-[color:var(--site-color-text-muted)]">
                Vaš odgovor smo zabeležili.
              </p>
            </div>
          ) : currentOffer.state === 'expired' ? (
            <p className="mt-5 text-sm text-[color:var(--site-color-text-muted)]">
              Ponudba je potekla in je ni več mogoče sprejeti.
            </p>
          ) : currentOffer.state === 'withdrawn' ? (
            <p className="mt-5 text-sm text-[color:var(--site-color-text-muted)]">
              Atehna je to različico ponudbe umaknila.
            </p>
          ) : currentOffer.state === 'superseded' ? (
            <p className="mt-5 text-sm text-[color:var(--site-color-text-muted)]">
              Ta različica je bila nadomeščena z novejšo ponudbo.
            </p>
          ) : responseUnavailable ? (
            <p className="mt-5 text-sm text-[color:var(--site-color-text-muted)]">
              Ta različica ponudbe ni več na voljo za odgovor.
            </p>
          ) : requiresPurchaseOrder ? (
            <div className="mt-5 border-t border-[color:var(--site-divider-color)] pt-5">
              <label htmlFor="quotePurchaseOrder" className="block text-sm font-semibold">
                Naročilnica za to ponudbo
              </label>
              <input
                id="quotePurchaseOrder"
                type="file"
                accept="application/pdf,image/jpeg,.pdf,.jpg,.jpeg"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (!file) {
                    setPurchaseOrder(null);
                    return;
                  }
                  if (
                    file.size < 1 ||
                    file.size > MAX_PURCHASE_ORDER_SIZE ||
                    !isSupportedPurchaseOrderFile(file)
                  ) {
                    setPurchaseOrder(null);
                    event.currentTarget.value = '';
                    setActionError('Naročilnica mora biti PDF ali JPG do 10 MB.');
                    return;
                  }
                  setActionError(null);
                  setPurchaseOrder(file);
                }}
                className="mt-2 block w-full text-sm"
              />
              <button
                type="button"
                onClick={() => void beginResponse('upload')}
                disabled={!purchaseOrder || activeAction !== null}
                className="site-button site-button--primary mt-4 w-full"
              >
                Naloži naročilnico
              </button>
              <label
                htmlFor="schoolDeclineReason"
                className="mt-5 block text-sm font-semibold"
              >
                Razlog za zavrnitev (neobvezno)
              </label>
              <select
                id="schoolDeclineReason"
                value={declineReason}
                onChange={(event) => setDeclineReason(event.target.value)}
                className="site-radius-sm mt-2 min-h-11 w-full border border-[color:var(--site-border-color)] px-3 text-sm"
              >
                {DECLINE_REASONS.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void beginResponse('decline')}
                disabled={!currentOffer.canDecline || activeAction !== null}
                className="site-button site-button--secondary mt-3 w-full"
              >
                Zavrni ponudbo
              </button>
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={() => void beginResponse('accept')}
                disabled={!currentOffer.canAccept || activeAction !== null}
                className="site-button site-button--primary w-full"
              >
                Sprejmi ponudbo z obveznostjo plačila
              </button>
              <label htmlFor="declineReason" className="text-sm font-semibold">
                Razlog za zavrnitev (neobvezno)
              </label>
              <select
                id="declineReason"
                value={declineReason}
                onChange={(event) => setDeclineReason(event.target.value)}
                className="site-radius-sm min-h-11 w-full border border-[color:var(--site-border-color)] px-3 text-sm"
              >
                {DECLINE_REASONS.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void beginResponse('decline')}
                disabled={!currentOffer.canDecline || activeAction !== null}
                className="site-button site-button--secondary w-full"
              >
                Zavrni ponudbo
              </button>
            </div>
          )}

          <a
            href={questionHref}
            className="site-button site-button--secondary mt-3 inline-flex w-full items-center justify-center"
          >
            Imam vprašanje
          </a>
        </aside>
      </div>
    </div>
  );
}
