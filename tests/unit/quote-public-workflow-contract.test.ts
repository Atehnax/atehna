import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

test('live pricing uses canonical estimate names while preserving the historical API route', () => {
  const contracts = source('src/commercial/order/contracts.ts');
  const estimateHook = source('src/commercial/order/useOrderEstimate.ts');
  const estimateRoute = source('src/commercial/api/orders/estimate/route.ts');
  const quoteRoute = source('src/commercial/api/orders/quote/route.ts');
  const appEstimateRoute = source('src/app/api/orders/estimate/route.ts');

  assert.match(contracts, /export type OrderEstimate =/u);
  assert.match(contracts, /export type OrderQuote = OrderEstimate/u);
  assert.match(contracts, /export function isOrderEstimate/u);
  assert.match(contracts, /export const isOrderQuote = isOrderEstimate/u);
  assert.match(estimateHook, /export function useOrderEstimate/u);
  assert.match(estimateHook, /fetch\('\/api\/orders\/estimate'/u);
  assert.match(estimateRoute, /buildAuthoritativeOrderEstimate/u);
  assert.match(quoteRoute, /orders\/estimate\/route/u);
  assert.match(appEstimateRoute, /commercial\/api\/orders\/estimate\/route/u);
});

test('checkout keeps binding order and non-binding quote-request intents separate', () => {
  const checkout = source(
    'src/commercial/order/components/OrderPageClient.tsx'
  );
  const ordersRoute = source('src/commercial/api/orders/route.ts');

  assert.match(checkout, /type CheckoutIntent = 'order' \| 'quote_request'/u);
  assert.match(checkout, /submitting-order/u);
  assert.match(checkout, /submitting-quote-request/u);
  assert.match(checkout, /opening-order-confirmation/u);
  assert.match(checkout, /opening-quote-confirmation/u);
  assert.match(
    checkout,
    /useRef<Record<CheckoutIntent, string \| null>>\(\{[\s\S]*?order: null,[\s\S]*?quote_request: null/u
  );
  assert.match(checkout, /intent: 'order'/u);
  assert.match(checkout, /intent: 'quote_request'/u);
  assert.match(checkout, /fetch\([\s\S]*?'\/api\/orders'[\s\S]*?'\/api\/quote-requests'/u);
  assert.match(checkout, /Oddaj naročilo/u);
  assert.match(checkout, /Oddajte naročilo za izbrane artikle\./u);
  assert.match(checkout, /Izberite naročilo ali povpraševanje\./u);
  assert.match(checkout, /Pošljite povpraševanje za ponudbo/u);
  assert.doesNotMatch(checkout, /neobvezujoče/u);
  assert.match(
    ordersRoute,
    /buttonWording:[\s\S]*?'Pošlji naročilo v potrditev'[\s\S]*?'Oddaj naročilo'/u
  );
  assert.match(checkout, /Pošlji naročilo v potrditev/u);
  assert.match(checkout, /Zahtevaj ponudbo/u);
  assert.match(
    checkout,
    /Povpraševanje ni naročilo in ne povzroči obveznosti plačila\.[\s\S]*?Ponudbo boste lahko sprejeli ali zavrnili\./u
  );
  assert.match(
    checkout,
    /const STOREFRONT_QUOTE_REASON: QuoteRequestReason = 'formal_offer'/u
  );
  assert.match(
    checkout,
    /quoteReason: STOREFRONT_QUOTE_REASON,[\s\S]*?quoteMessage: formData\.quoteMessage\.trim\(\)/u
  );
  assert.doesNotMatch(checkout, /QUOTE_REQUEST_REASON_OPTIONS/u);
  assert.doesNotMatch(checkout, /id="quoteReason"/u);
  assert.match(
    checkout,
    /data-testid="quote-request-details-section"[\s\S]*?id="quoteMessage"[\s\S]*?label="Opombe"[\s\S]*?value=\{formData\.quoteMessage\}[\s\S]*?updateField\('quoteMessage', event\.target\.value\)/u
  );
  const commonPayload = checkout.slice(
    checkout.indexOf('const commonPayload ='),
    checkout.indexOf('const payload:')
  );
  assert.doesNotMatch(commonPayload, /\breference:/u);
  assert.doesNotMatch(commonPayload, /\bnotes:/u);
  assert.doesNotMatch(checkout, /Vrsta povpraševanja/u);
  assert.doesNotMatch(checkout, /Formalno ponudbo za izbrane artikle/u);
  assert.doesNotMatch(checkout, /Dodatne želje ali vprašanja/u);
  assert.match(
    checkout,
    /intent === 'order' && currentShipping\.status === 'manual_quote'/u
  );
  assert.match(
    checkout,
    /\(!isQuoteRequest && shippingRequiresManualQuote\)/u,
    'manual shipping must disable only the direct-order action'
  );
});

test('quote request confirmation is non-binding and does not reuse order semantics', () => {
  const confirmation = source(
    'src/commercial/quote/components/QuoteRequestConfirmationPageClient.tsx'
  );
  const orderStatus = source(
    'src/commercial/order/components/OrderSubmissionStatus.tsx'
  );
  const sharedStatus = source(
    'src/commercial/components/SubmissionStatusPanel.tsx'
  );
  const confirmationApi = source(
    'src/commercial/api/quote-requests/confirmation/route.ts'
  );
  const contracts = source('src/commercial/quote/contracts.ts');
  const quoteSubmission = source(
    'src/commercial/api/quote-requests/route.ts'
  );
  const customerResponse = quoteSubmission.slice(
    quoteSubmission.indexOf('function customerResponse('),
    quoteSubmission.indexOf('function errorResponse(')
  );
  const submitResponseContract = contracts.slice(
    contracts.indexOf('export type SubmitQuoteRequestResponse ='),
    contracts.indexOf('export type QuoteRequestState =')
  );
  const confirmationContract = contracts.slice(
    contracts.indexOf('export type QuoteRequestConfirmationSnapshot ='),
    contracts.indexOf('export type QuoteOfferState =')
  );

  assert.match(confirmation, /Povpraševanje je poslano/u);
  assert.match(confirmation, /Okvirni izračun/u);
  assert.match(confirmation, /Zaloga ni rezervirana/u);
  assert.match(confirmation, /Podatki o povpraševanju/u);
  assert.match(
    confirmation,
    /Vrsta naročnika[\s\S]*?Kontakt[\s\S]*?Naročnik[\s\S]*?Naslov/u
  );
  assert.match(confirmation, /<SubmissionStatusPanel/u);
  assert.match(orderStatus, /<SubmissionStatusPanel/u);
  assert.match(sharedStatus, /data-confirmation-status/u);
  assert.match(sharedStatus, /site-heading-1 mt-1 !text-2xl sm:!text-3xl/u);
  assert.match(
    confirmation,
    /site-card mt-6 grid overflow-hidden !p-0 lg:grid-cols-\[minmax\(0,1\.4fr\)_minmax\(18rem,0\.6fr\)\]/u
  );
  assert.match(confirmation, /data-confirmation-region="primary"/u);
  assert.match(confirmation, /data-confirmation-region="secondary"/u);
  assert.doesNotMatch(confirmation, /mx-auto max-w-5xl/u);
  assert.match(
    confirmation,
    /Atehna bo preverila cene, dobavljivost, stroške dostave in rok dobave/u
  );
  assert.doesNotMatch(
    confirmation,
    /Skupaj za plačilo|Potrditev naročila|paymentStatus|commitmentStatus|fulfilment/iu
  );
  assert.match(confirmation, /import Image from 'next\/image'/u);
  assert.match(confirmation, /item\.imageUrl[\s\S]*?<Image/u);
  assert.match(confirmation, /Brez slike/u);
  assert.match(confirmationApi, /'imageUrl', item\.image_url/u);
  assert.match(confirmationContract, /imageUrl: string \| null/u);
  assert.match(
    confirmationApi,
    /request\.address_line1,[\s\S]*?request\.address_line2,[\s\S]*?request\.city,[\s\S]*?request\.postal_code/u
  );
  assert.match(
    confirmationApi,
    /addressLine1: row\.address_line1,[\s\S]*?addressLine2: row\.address_line2,[\s\S]*?city: row\.city,[\s\S]*?postalCode: row\.postal_code/u
  );
  assert.match(
    confirmationContract,
    /addressLine1: string \| null;[\s\S]*?addressLine2: string \| null;[\s\S]*?city: string \| null;[\s\S]*?postalCode: string \| null;/u
  );
  assert.doesNotMatch(confirmation, /ShippingCalculationRows/u);
  assert.match(
    confirmation,
    /data-summary-row="shipping"[\s\S]*?<dt[^>]*>Poštnina<\/dt>[\s\S]*?estimate\.totals\.shipping === null[\s\S]*?'Po dogovoru'[\s\S]*?formatEuro\(snapshot\.estimate\.totals\.shipping\)/u
  );
  assert.doesNotMatch(confirmation, /snapshot\.requestNumber|POV-/u);
  assert.doesNotMatch(confirmationApi, /request\.request_number|requestNumber/u);
  assert.doesNotMatch(submitResponseContract, /requestNumber/u);
  assert.doesNotMatch(confirmationContract, /requestNumber/u);
  assert.doesNotMatch(customerResponse, /requestNumber/u);
});

test('offer review uses fragment access and canonical OTP-gated explicit responses', () => {
  const accessClient = source(
    'src/commercial/quote/quoteAccessClient.ts'
  );
  const offerReview = source(
    'src/commercial/quote/components/QuoteOfferReviewPageClient.tsx'
  );
  const serverAccess = source('src/shared/server/quoteAccess.ts');
  const canonicalPage = source('src/app/(commercial)/quote/offer/page.tsx');

  assert.match(accessClient, /fragmentParams\.get\('token'\)/u);
  assert.doesNotMatch(
    accessClient,
    /searchParams\.get\(['"](?:token|access)['"]\)/u
  );
  assert.match(accessClient, /purpose: 'confirmation' \| 'offer'/u);
  assert.match(accessClient, /`\/quote\/offer#token=/u);
  assert.match(serverAccess, /`\/quote\/offer#token=/u);
  assert.match(canonicalPage, /commercial\/pages\/quote\/offer\/page/u);
  assert.match(offerReview, /exchangeQuoteAccessToken\([^,]+, 'offer'\)/u);
  assert.match(offerReview, /\/api\/quote-requests\/offer\/otp\/request/u);
  assert.match(offerReview, /\/api\/quote-requests\/offer\/otp\/verify/u);
  assert.match(offerReview, /verificationId: otpVerificationId/u);
  assert.match(offerReview, /QUOTE_OTP_PATTERN = \/\^\\d\{6\}\$\/u/u);
  assert.match(offerReview, /\/api\/quote-requests\/accept/u);
  assert.match(offerReview, /\/api\/quote-requests\/decline/u);
  assert.match(offerReview, /error\.code === 'STOCK_CHANGED'/u);
  assert.match(offerReview, /result\.status !== 'accepted'/u);
  assert.match(offerReview, /result\.status !== 'declined'/u);
  assert.match(offerReview, /\/api\/quote-requests\/purchase-order/u);
  assert.match(
    offerReview,
    /fetch\(offer\.documentUrl,[\s\S]*?buildQuoteAccessHeaders\(accessSessionRef\.current\)/u
  );
  assert.match(offerReview, /URL\.createObjectURL\(blob\)/u);
  assert.doesNotMatch(offerReview, /href=\{currentOffer\.documentUrl\}/u);
  assert.match(offerReview, /application\/pdf,image\/jpeg,\.pdf,\.jpg,\.jpeg/u);
  assert.doesNotMatch(offerReview, /image\/png/u);
  assert.match(offerReview, /storeOrderAccessId\(orderAccessId\)/u);
  assert.match(offerReview, /Naročilnica je prejeta/u);
  assert.match(offerReview, /Ponudba je zavrnjena/u);
  assert.match(offerReview, /Ponudba je potekla/u);
  assert.match(offerReview, /offerNumber: offer\.offerNumber/u);
  assert.match(offerReview, /versionNumber: offer\.versionNumber/u);
  assert.match(offerReview, /Sprejmi ponudbo z obveznostjo plačila/u);
  assert.match(offerReview, /Zavrni ponudbo/u);
  assert.match(offerReview, /Imam vprašanje/u);
  assert.match(offerReview, /Naloži naročilnico/u);
});

test('public offer client shapes track the canonical API responses', () => {
  const contracts = source('src/commercial/quote/contracts.ts');
  const otpRequest = source(
    'src/commercial/api/quote-requests/offer/otp/request/route.ts'
  );
  const otpVerify = source(
    'src/commercial/api/quote-requests/offer/otp/verify/route.ts'
  );
  const purchaseOrder = source(
    'src/commercial/api/quote-requests/purchase-order/route.ts'
  );
  const documentRoute = source(
    'src/commercial/api/quote-requests/documents/[documentAccessId]/route.ts'
  );

  assert.match(contracts, /export type QuoteOtpRequestResponse/u);
  assert.match(contracts, /verificationId: string/u);
  assert.match(contracts, /export type QuotePurchaseOrderResponse/u);
  assert.match(contracts, /status: 'awaiting_purchase_order_review'/u);
  assert.match(otpRequest, /verificationId: otp\.verificationId/u);
  assert.match(otpVerify, /parsed\.body\.verificationId/u);
  assert.match(otpVerify, /\^\\d\{6\}\$/u);
  assert.match(purchaseOrder, /const MAX_FILE_SIZE = 10 \* 1024 \* 1024/u);
  assert.match(purchaseOrder, /from quote_email_verifications/u);
  assert.match(purchaseOrder, /and consumed_at is null/u);
  assert.match(purchaseOrder, /consumeVerifiedQuoteOtp\(client/u);
  assert.match(
    purchaseOrder,
    /new QuoteResponseIdempotencyError\(\s*'OTP_REQUIRED'/u
  );
  assert.match(purchaseOrder, /status: 'awaiting_purchase_order_review'/u);
  assert.match(purchaseOrder, /orderAccessId: access\.tokenId/u);
  assert.match(documentRoute, /scope: 'offer_review'/u);
  assert.match(documentRoute, /document\.customer_access_id = \$1/u);
  assert.match(documentRoute, /'Content-Type': 'application\/pdf'/u);
});

test('variant locking is deterministic before row locks are acquired', () => {
  const commerce = source('src/shared/server/orderCommerce.ts');
  assert.match(
    commerce,
    /order by civ\.id asc\s*\$\{lockClause\}/u,
    'concurrent stock paths must lock variants in the same order'
  );
});
