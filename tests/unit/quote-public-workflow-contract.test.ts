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
  const confirmationContentLayout = source(
    'src/commercial/components/ConfirmationContentLayout.tsx'
  );
  const confirmationCustomerDetails = source(
    'src/commercial/components/ConfirmationCustomerDetails.tsx'
  );
  const confirmationDocumentAction = source(
    'src/commercial/components/confirmationDocumentAction.ts'
  );
  const confirmationApi = source(
    'src/commercial/api/quote-requests/confirmation/route.ts'
  );
  const confirmationPdfApi = source(
    'src/commercial/api/quote-requests/confirmation/pdf/route.ts'
  );
  const confirmationPdfRenderer = source(
    'src/shared/server/quoteRequestConfirmationPdf.ts'
  );
  const quoteAccess = source('src/shared/server/quoteAccess.ts');
  const confirmationPageFrame = source(
    'src/commercial/components/ConfirmationPageFrame.tsx'
  );
  const quoteConfirmationPage = source(
    'src/commercial/pages/quote-request/confirmation/page.tsx'
  );
  const orderConfirmationPage = source(
    'src/commercial/pages/order/confirmation/page.tsx'
  );
  const contracts = source('src/commercial/quote/contracts.ts');
  const quoteSubmission = source(
    'src/commercial/api/quote-requests/route.ts'
  );
  const customerResponse = quoteSubmission.slice(
    quoteSubmission.indexOf('function customerResponse('),
    quoteSubmission.indexOf('function errorResponse(')
  );
  const normalizeQuoteCustomer = quoteSubmission.slice(
    quoteSubmission.indexOf('function normalizeCustomer('),
    quoteSubmission.indexOf('function readReason(')
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
  assert.match(confirmation, /snapshot\.quoteCode/u);
  assert.match(confirmationApi, /formatQuoteCode\(String\(row\.public_code_base\)\)/u);
  assert.match(confirmationContract, /quoteCode: string/u);
  assert.match(submitResponseContract, /quoteCode: string/u);
  assert.match(customerResponse, /\{ accessId: access\.tokenId, quoteCode \}/u);
  assert.match(quoteSubmission, /quote_request\.public_code_base/u);
  assert.doesNotMatch(
    quoteSubmission,
    /response:\s*row\.response_json as StoredQuoteRequestResponse/u
  );
  assert.match(
    confirmationCustomerDetails,
    /Naročnik[\s\S]*?Email[\s\S]*?Naslov/u
  );
  assert.match(
    confirmation,
    /customer\.organizationName\s*\|\|[\s\S]*?customer\.customerName\s*\|\|[\s\S]*?customer\.contactName/u
  );
  assert.doesNotMatch(confirmation, /Vrsta naročnika/u);
  assert.doesNotMatch(confirmation, />\s*Kontakt\s*</u);
  assert.doesNotMatch(confirmation, /customerTypeLabel/u);
  assert.match(confirmationCustomerDetails, /<dl className="[^"]*text-base/u);
  assert.match(
    confirmation,
    /data-testid="quote-request-confirmation-documents-section"[\s\S]*?Dokumenti[\s\S]*?data-testid="quote-request-confirmation-pdf"/u
  );
  assert.match(confirmation, /fetch\('\/api\/quote-requests\/confirmation\/pdf'/u);
  assert.match(confirmation, /buildQuoteAccessHeaders\(session\)/u);
  assert.match(confirmation, /URL\.createObjectURL/u);
  assert.match(confirmation, /confirmationPdfFilename/u);
  assert.match(confirmation, /content-disposition/u);
  assert.match(confirmation, /potrditev-povprasevanja\.pdf/u);
  assert.doesNotMatch(
    confirmation,
    /href=\{?['"]\/api\/quote-requests\/confirmation\/pdf/u
  );
  assert.match(confirmation, /<SubmissionStatusPanel/u);
  assert.match(orderStatus, /<SubmissionStatusPanel/u);
  assert.match(sharedStatus, /data-confirmation-status/u);
  assert.match(confirmation, /testId="quote-request-confirmation-content-grid"/u);
  assert.match(
    confirmation,
    /detailsTestId="quote-request-confirmation-items-section"/u
  );
  assert.match(
    confirmation,
    /summaryTestId="quote-request-confirmation-summary"/u
  );
  assert.match(confirmationContentLayout, /data-confirmation-content-grid/u);
  assert.match(
    confirmationContentLayout,
    /grid[\s\S]*?lg:grid-cols-\[minmax\(0,1\.6fr\)_minmax\(18rem,0\.9fr\)\]/u
  );
  assert.match(
    confirmationContentLayout,
    /data-confirmation-region="details"[\s\S]*?data-confirmation-region="summary"/u
  );
  assert.match(confirmation, /Podrobnosti povpraševanja/u);
  assert.match(
    confirmation,
    /details=\{[\s\S]*?Podrobnosti povpraševanja[\s\S]*?<ConfirmationCustomerDetails[\s\S]*?testId="quote-request-confirmation-customer-section"/u
  );
  assert.match(
    confirmation,
    /summary=\{[\s\S]*?Povzetek povpraševanja[\s\S]*?data-testid="quote-request-confirmation-documents-section"/u
  );
  assert.match(
    confirmationDocumentAction,
    /CONFIRMATION_PRIMARY_DOCUMENT_ACTION_CLASS\s*=[\s\S]*?site-button--primary/u
  );
  assert.doesNotMatch(confirmation, /mx-auto max-w-5xl/u);
  for (const page of [quoteConfirmationPage, orderConfirmationPage]) {
    assert.match(page, /ConfirmationPageFrame/u);
  }
  assert.match(confirmationPageFrame, /data-confirmation-page-frame/u);
  assert.match(confirmationPageFrame, /xl:w-2\/3/u);
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
    confirmationApi,
    /customerName:\s*[\s\S]*?row\.customer_type === 'individual'[\s\S]*?\? row\.contact_name[\s\S]*?: row\.organization_name \?\? row\.contact_name/u
  );
  assert.match(
    normalizeQuoteCustomer,
    /const contactName\s*=\s*customerType === 'individual' \? customerName : submittedContactName;/u
  );
  assert.doesNotMatch(
    normalizeQuoteCustomer,
    /customerType === 'individual' \? submittedContactName/u
  );
  assert.match(
    confirmationContract,
    /'customerType'[\s\S]*?'customerName'[\s\S]*?'organizationName'[\s\S]*?'contactName'[\s\S]*?'email'[\s\S]*?addressLine1: string \| null;[\s\S]*?addressLine2: string \| null;[\s\S]*?city: string \| null;[\s\S]*?postalCode: string \| null;/u
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

  assert.match(confirmationPdfApi, /verifyQuoteAccessSession/u);
  assert.match(confirmationPdfApi, /scope:\s*'request_confirmation'/u);
  for (const route of [confirmationApi, confirmationPdfApi]) {
    assert.match(route, /bindToSelectedAccessId:\s*true/u);
  }
  assert.match(
    quoteAccess,
    /if \(options\.bindToSelectedAccessId && selectedHeader !== null\) \{[\s\S]*?return selectedSession \? \[selectedSession\] : \[\];/u
  );
  assert.match(
    quoteAccess,
    /const sessions = quoteSessions\(request, \{[\s\S]*?bindToSelectedAccessId: input\.bindToSelectedAccessId/u
  );
  assert.match(confirmationPdfApi, /generateQuoteRequestConfirmationPdf/u);
  assert.match(confirmationPdfApi, /application\/pdf/u);
  assert.match(confirmationPdfApi, /Content-Disposition/u);
  assert.match(confirmationPdfApi, /no-store, private/u);
  assert.doesNotMatch(confirmationPdfApi, /quote_documents/u);
  assert.doesNotMatch(confirmationPdfApi, /renderQuoteOfferPdf/u);
  assert.match(
    confirmationPdfRenderer,
    /getOrderDocumentTemplate\('order_summary'\)/u
  );
  assert.match(confirmationPdfRenderer, /generateOrderPdf/u);
  assert.match(confirmationPdfRenderer, /POTRDITEV POVPRAŠEVANJA/u);
  assert.match(confirmationPdfRenderer, /setOrderDocumentFieldRows/u);
  assert.equal(
    confirmationPdfRenderer.match(/database\.query\(/gu)?.length,
    1,
    'the request and its items must come from one database statement'
  );
  assert.match(
    confirmationPdfRenderer,
    /jsonb_agg\([\s\S]*?order by item\.line_number[\s\S]*?group by request\.id/u
  );
  assert.doesNotMatch(
    confirmationPdfRenderer,
    /Promise\.all\(\[[\s\S]*?database\.query/u
  );
  assert.match(
    confirmationPdfRenderer,
    /typeof value !== 'string' \|\| value\.trim\(\) === ''/u
  );
  assert.match(
    confirmationPdfRenderer,
    /requiredNonNegativeNumber\(totals\.net[\s\S]*?requiredNonNegativeNumber\(totals\.tax/u
  );
  assert.match(
    confirmationPdfRenderer,
    /optionalNonNegativeNumber\(totals\.shipping[\s\S]*?optionalNonNegativeNumber\(totals\.gross/u
  );
  assert.match(
    confirmationPdfRenderer,
    /\(shipping === null\) !== \(gross === null\)[\s\S]*?incomplete totals/u
  );
  assert.match(
    confirmationPdfRenderer,
    /Math\.abs\(gross - \(subtotal \+ tax \+ shipping\)\)[\s\S]*?inconsistent totals/u
  );
  assert.match(confirmationPdfRenderer, /total: gross \?\? subtotal \+ tax/u);
  assert.doesNotMatch(confirmationPdfRenderer, /total:[^\n]*shipping \?\? 0/u);
  const confirmationPdfMetadata = confirmationPdfRenderer.slice(
    confirmationPdfRenderer.indexOf('const metadataRows ='),
    confirmationPdfRenderer.indexOf(
      "template = setOrderDocumentFieldRows(\n    template,\n    'document_meta'"
    )
  );
  assert.match(confirmationPdfMetadata, /row\.id === 'order_date'/u);
  assert.doesNotMatch(confirmationPdfMetadata, /row\.id === 'issue_date'/u);
  assert.match(confirmationPdfRenderer, /resolveCachedSiteLogoArtwork/u);
  assert.match(
    confirmationPdfRenderer,
    /Buffer\.from\(logoArtwork\.base64, 'base64'\)/u
  );
  assert.doesNotMatch(confirmationPdfRenderer, /resolveSiteLogoArtwork\(/u);
  assert.match(
    confirmationPdfRenderer,
    /hasCompleteTotals[\s\S]*?section\.id === 'totals'[\s\S]*?enabled: hasCompleteTotals/u
  );
  assert.match(
    confirmationPdfRenderer,
    /shipping !== null && gross !== null/u
  );
  assert.doesNotMatch(confirmationPdfRenderer, /renderQuoteOfferPdf/u);
});

test('offer review uses fragment access and canonical OTP-gated explicit responses', () => {
  const accessClient = source(
    'src/commercial/quote/quoteAccessClient.ts'
  );
  const offerReview = source(
    'src/commercial/quote/components/QuoteOfferReviewPageClient.tsx'
  );
  const offerApi = source('src/commercial/api/quote-requests/offer/route.ts');
  const contracts = source('src/commercial/quote/contracts.ts');
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
  assert.match(offerApi, /request\.public_code_base/u);
  assert.match(offerApi, /quoteCode: formatQuoteCode/u);
  assert.match(offerApi, /offerCode: formatOfferCode/u);
  assert.match(contracts, /quoteCode: string;[\s\S]*?offerCode: string;/u);
  assert.match(offerReview, /\{currentOffer\.offerCode\}/u);
  assert.match(offerReview, /Povpraševanje \{currentOffer\.quoteCode\}/u);
  assert.match(offerReview, /download\.download = `\$\{offer\.offerCode\}\.pdf`/u);
  assert.doesNotMatch(offerReview, /offerNumber: offer\.offerNumber/u);
  assert.doesNotMatch(offerReview, /body\.set\('offerNumber'/u);
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
