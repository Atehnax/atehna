import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('/admin/orders keeps quote records in a URL-backed sibling table', () => {
  const page = source('src/admin/pages/orders/page.tsx');
  const ordersTabs = source('src/admin/features/orders/components/AdminOrdersTabs.tsx');
  const quoteTable = source('src/admin/features/quotes/components/AdminQuotesTable.tsx');
  const quoteStatus = source('src/shared/domain/quote/quoteRequestStatus.ts');

  assert.match(page, /Naročila/u);
  assert.match(page, /fetchNewQuoteRequestCount/u);
  assert.match(page, /AdminOrdersTabs/u);
  assert.match(page, /AdminQuotesTable/u);
  assert.match(page, /role="tabpanel"/u);
  assert.doesNotMatch(page, />Navodila<\/summary>/u);
  assert.doesNotMatch(page, /<nav aria-label="Naročila in ponudbe"/u);
  assert.match(ordersTabs, /EuiTabs/u);
  assert.match(ordersTabs, /view=quotes/u);
  assert.match(ordersTabs, /Povpraševanja in ponudbe/u);
  assert.match(ordersTabs, /newQuoteCount/u);
  assert.match(ordersTabs, /router\.push/u);
  assert.doesNotMatch(quoteTable, /api\/admin\/orders\//u);
  assert.match(quoteStatus, /accepted:[\s\S]*?converted_to_order:/u);
  assert.match(
    quoteTable,
    /href=\{`\/admin\/orders\/\$\{row\.resultingOrderId\}`\}/u
  );
  assert.match(quoteTable, /quote-linked-order-/u);
  assert.match(quoteTable, /Odpri povezano naročilo/u);
  assert.doesNotMatch(quoteTable, />Rezultat</u);
});

test('quote list follows the standardized orders table presentation and interactions', () => {
  const quoteTable = source('src/admin/features/quotes/components/AdminQuotesTable.tsx');
  const quoteServer = source('src/shared/server/quotes.ts');
  const quoteTypes = source('src/shared/domain/quote/quoteAdminTypes.ts');

  assert.match(quoteTable, /AdminTableLayout/u);
  assert.match(quoteTable, /AdminSearchInput/u);
  assert.match(quoteTable, /EuiTablePagination/u);
  assert.match(quoteTable, /HeaderFilterPortal/u);
  assert.match(quoteTable, /RowActionsDropdown/u);
  assert.match(quoteTable, /adminTableHeaderCellCenterClassName/u);
  assert.match(quoteTable, /adminTableBodyCellCenterClassName/u);
  assert.match(quoteTable, /h-12 border-t border-slate-200\/90/u);
  assert.doesNotMatch(quoteTable, /font-\['Inter',system-ui,sans-serif\]/u);
  assert.match(quoteTable, /router\.replace/u);
  assert.doesNotMatch(quoteTable, /rounded-full px-3 py-1\.5 text-xs font-semibold transition/u);
  assert.doesNotMatch(quoteTable, /<form action="\/admin\/orders"/u);
  assert.match(quoteTypes, /shippingRequiresManualEntry: boolean/u);
  assert.match(quoteServer, /shipping_snapshot_json ->> 'status'[\s\S]*?manual_quote/u);
  assert.match(quoteServer, /shippingRequiresManualEntry: row\.shipping_requires_manual_entry === true/u);
  assert.match(
    quoteTable,
    /row\.quotedTotal === null && row\.shippingRequiresManualEntry[\s\S]*?<AdminManualShippingPendingValue/u
  );
});

test('quote detail exposes lifecycle controls without order payment or fulfilment endpoints', () => {
  const detail = source('src/admin/features/quotes/components/AdminQuoteDetailClient.tsx');
  const activityAdapter = source(
    'src/admin/features/quotes/components/AdminQuoteActivityTimeline.tsx'
  );
  const activityPresenter = source(
    'src/shared/ui/admin-detail/AdminActivityTimeline.tsx'
  );

  assert.match(detail, /quote-requests\/\$\{detail\.id\}\/draft/u);
  assert.match(detail, /quote-requests\/\$\{detail\.id\}\/preview/u);
  assert.match(detail, /quote-requests\/\$\{detail\.id\}\/\$\{action\}/u);
  for (const action of ['issue', 'revise', 'withdraw', 'close']) {
    assert.match(detail, new RegExp(`'${action}'`, 'u'));
  }
  assert.match(detail, /Shrani osnutek/u);
  assert.match(detail, />\s*\{busyAction === 'preview' \? 'Pripravljam …' : 'Predogled'\}\s*<\/Button>/u);
  assert.doesNotMatch(detail, /Ustvari predogled|window\.open/u);
  assert.match(detail, /<PdfPreviewDialog/u);
  assert.match(detail, /Izdaj ponudbo/u);
  assert.match(detail, /confirmFreeShipping/u);
  assert.match(detail, /catalogVariantId/u);
  assert.match(detail, /toNewDraftState/u);
  assert.match(detail, /import AdminQuoteActivityTimeline/u);
  assert.match(detail, /<AdminQuoteActivityTimeline events=\{detail\.events\} \/>/u);
  assert.match(activityAdapter, /import \{ AdminActivityTimeline \}/u);
  assert.match(activityAdapter, /const items = selectQuoteProgressEvents\(events\)\.reverse\(\)\.map/u);
  assert.match(activityAdapter, /testId="quote-activity-timeline"/u);
  assert.match(activityAdapter, /<AdminActivityTimeline/u);
  assert.match(activityPresenter, /data-testid=\{testId\}/u);
  assert.match(activityPresenter, /aria-live="polite"/u);
  assert.doesNotMatch(detail, /Avtoritativna časovnica/u);
  assert.doesNotMatch(detail, /payment-status|generate-order-summary/u);
  assert.match(detail, /quote-requests\/\$\{detail\.id\}\/status/u);
});

test('quote customer actions open the matching Stranke profile beside request details', () => {
  const detail = source('src/admin/features/quotes/components/AdminQuoteDetailClient.tsx');

  assert.match(detail, /import AdminOrderCustomerActions from '@\/admin\/features\/orders\/components\/AdminOrderCustomerCard';/u);
  assert.doesNotMatch(detail, /data-testid="quote-customer-card"|Naročnik in dostava/u);
  assert.match(
    detail,
    /<div className="flex min-w-0 items-center gap-2">\s*<h2 className="text-base font-semibold text-slate-900">Podatki povpraševanja<\/h2>\s*<AdminOrderCustomerActions/u
  );
  const customerActionsStart = detail.indexOf('<AdminOrderCustomerActions');
  const customerActions = detail.slice(
    customerActionsStart,
    detail.indexOf('/>', customerActionsStart)
  );
  assert.match(customerActions, /orderId=\{detail\.id\}/u);
  assert.match(
    customerActions,
    /customerEndpoint=\{`\/api\/admin\/quote-requests\/\$\{detail\.id\}\/customer`\}/u
  );
  for (const prop of [
    'organizationName',
    'contactName',
    'email',
    'addressLine1',
    'addressLine2',
    'postalCode',
    'city',
    'countryCode'
  ]) {
    assert.match(
      customerActions,
      new RegExp(prop + '=\\{persistedRequestDetails\\.' + prop + '\\}', 'u')
    );
  }
  assert.doesNotMatch(customerActions, /customerType/u);
  assert.doesNotMatch(detail, /function QuoteCustomerSummaryCard/u);
});

test('clarification uses a standardized two-step dialog and one retry-stable action id', () => {
  const detail = source('src/admin/features/quotes/components/AdminQuoteDetailClient.tsx');
  const dialog = source(
    'src/admin/features/quotes/components/AdminQuoteClarificationDialog.tsx'
  );
  const sharedDialog = source('src/shared/ui/dialog/dialog.tsx');

  assert.match(detail, /<AdminQuoteClarificationDialog/u);
  assert.match(dialog, /<Dialog/u);
  assert.match(dialog, /AdminQuoteClarificationDialogStep = 'compose' \| 'confirm-email'/u);
  assert.match(dialog, /data-testid="quote-clarification-dialog"/u);
  assert.match(dialog, /data-testid="quote-clarification-textarea"/u);
  assert.match(dialog, /MAX_CLARIFICATION_LENGTH = 2_000/u);
  assert.match(dialog, /adminPlaceholderTokenClasses/u);
  assert.equal(dialog.match(/adminPlaceholderTokenClasses/gu)?.length, 2);
  assert.match(
    dialog,
    /placeholder="Prosimo, potrdite želene dimenzije in količino artikla[.]"/u
  );
  assert.doesNotMatch(dialog, /Na primer:|placeholder:text-slate-400/u);
  assert.match(dialog, /maxLength=\{MAX_CLARIFICATION_LENGTH\}/u);
  assert.match(dialog, /data-testid="quote-clarification-cancel"[\s\S]*?Prekliči/u);
  assert.match(dialog, /data-testid="quote-clarification-advance"[\s\S]*?Nadaljuj/u);
  assert.match(dialog, /data-testid="quote-clarification-back"[\s\S]*?Nazaj/u);
  assert.match(dialog, /data-testid="quote-clarification-record-only"[\s\S]*?Samo zabeleži/u);
  assert.match(dialog, /data-testid="quote-clarification-record-and-send"[\s\S]*?Zabeleži z e-pošto/u);
  const clarificationFlow = detail.slice(
    detail.indexOf('const openClarificationDialog'),
    detail.indexOf('const retryEmail')
  );
  assert.match(clarificationFlow, /crypto\.randomUUID\(\)/u);
  assert.equal(clarificationFlow.match(/crypto\.randomUUID\(\)/gu)?.length, 1);
  assert.match(
    clarificationFlow,
    /body: JSON\.stringify\(\{[\s\S]*?clarification,[\s\S]*?sendEmail,[\s\S]*?actionId: clarificationActionId[\s\S]*?\}\)/u
  );
  assert.match(detail, /onRecordOnly=\{\(\) => void requestClarification\(false\)\}/u);
  assert.match(
    detail,
    /onRecordAndSend=\{\(\) => void requestClarification\(true\)\}/u
  );
  assert.match(
    clarificationFlow,
    /emailStatus\?:[\s\S]*?'not_queued'[\s\S]*?'failed'/u
  );
  assert.match(
    clarificationFlow,
    /payload\.emailStatus === 'failed'\) toast\.error\(message\);[\s\S]*?else toast\.success\(message\)/u
  );
  assert.doesNotMatch(
    clarificationFlow,
    /payload\.emailStatus === 'not_queued'[\s\S]*?toast\.error\(message\)/u
  );
  assert.match(dialog, /href="\/admin\/email"/u);
  assert.doesNotMatch(
    clarificationFlow,
    /window\.prompt|window\.confirm|mailto:|window\.location\.assign/u
  );
  assert.doesNotMatch(dialog, /window\.prompt|window\.confirm|mailto:|window\.location\.assign/u);
  assert.match(dialog, /isDismissable=\{step === 'compose' && !busy\}/u);
  assert.match(sharedDialog, /const titleId = useId\(\)/u);
  assert.match(sharedDialog, /aria-labelledby=\{title \? titleId : undefined\}/u);
  assert.match(sharedDialog, /id=\{titleId\}/u);
  assert.match(sharedDialog, /const panelRef = useRef/u);
  assert.match(sharedDialog, /event\.key === 'Escape'/u);
  assert.match(sharedDialog, /event\.key !== 'Tab'/u);
  assert.match(sharedDialog, /querySelectorAll<HTMLElement>/u);
  assert.match(sharedDialog, /event\.shiftKey/u);
  assert.match(sharedDialog, /window\.addEventListener\('keydown'/u);
  assert.match(sharedDialog, /window\.removeEventListener\('keydown'/u);
  assert.match(sharedDialog, /document\.body\.style\.overflow = 'hidden'/u);
  assert.match(sharedDialog, /document\.body\.style\.overflow = bodyOverflowBeforeLock/u);
  assert.match(sharedDialog, /document\.activeElement/u);
  assert.match(sharedDialog, /previousActiveElement\?\.isConnected/u);
  assert.match(sharedDialog, /previousActiveElement\.focus\(\)/u);
});

test('issuing an offer requires one explicit standardized confirmation without a native prompt', () => {
  const detail = source('src/admin/features/quotes/components/AdminQuoteDetailClient.tsx');
  const issueDialog = source(
    'src/admin/features/quotes/components/AdminQuoteIssueDialog.tsx'
  );
  const sharedDialog = source('src/shared/ui/dialog/dialog.tsx');

  const openIssueStart = detail.indexOf('const openIssueDialog');
  const closeIssueStart = detail.indexOf('const closeIssueDialog', openIssueStart);
  const confirmIssueStart = detail.indexOf('const confirmIssue', closeIssueStart);
  const confirmIssueEnd = detail.indexOf('\n  const ', confirmIssueStart + 6);
  const callActionStart = detail.indexOf('const callAction = async');
  const callActionEnd = detail.indexOf(
    'const handleRequestStatusSelection',
    callActionStart
  );
  const openIssueFlow = detail.slice(openIssueStart, closeIssueStart);
  const closeIssueFlow = detail.slice(closeIssueStart, confirmIssueStart);
  const confirmIssueFlow = detail.slice(confirmIssueStart, confirmIssueEnd);
  const callActionFlow = detail.slice(callActionStart, callActionEnd);
  const issueDialogStart = detail.indexOf('<AdminQuoteIssueDialog');
  const issueDialogEnd = detail.indexOf('/>', issueDialogStart);
  const issueDialogIntegration = detail.slice(issueDialogStart, issueDialogEnd);

  assert.ok(openIssueStart >= 0 && closeIssueStart > openIssueStart);
  assert.ok(confirmIssueStart > closeIssueStart && confirmIssueEnd > confirmIssueStart);
  assert.ok(callActionStart >= 0 && callActionEnd > callActionStart);
  assert.ok(issueDialogStart >= 0 && issueDialogEnd > issueDialogStart);
  assert.match(detail, /onClick=\{openIssueDialog\}[\s\S]*?Izdaj ponudbo/u);
  assert.doesNotMatch(openIssueFlow, /callAction\('issue'|fetch\(/u);
  assert.doesNotMatch(closeIssueFlow, /callAction\('issue'|fetch\(/u);
  assert.match(confirmIssueFlow, /if \(busyAction \|\| !isIssueDialogOpen\) return/u);
  assert.match(
    confirmIssueFlow,
    /await callAction\('issue'\)/u
  );
  assert.equal(detail.match(/callAction\('issue'/gu)?.length, 1);
  assert.match(
    openIssueFlow,
    /setIssueActionId\(window\.crypto\.randomUUID\(\)\)/u
  );
  assert.equal(openIssueFlow.match(/randomUUID\(\)/gu)?.length, 1);
  assert.match(closeIssueFlow, /setIssueActionId\(null\)/u);
  assert.match(callActionFlow, /!isIssueDialogOpen \|\| !issueActionId/u);
  assert.match(callActionFlow, /actionId: issueActionId/u);
  assert.doesNotMatch(confirmIssueFlow, /randomUUID\(\)/u);
  assert.doesNotMatch(callActionFlow, /randomUUID\(\)/u);
  assert.match(
    confirmIssueFlow,
    /if \(succeeded\) \{[\s\S]*?setIssueActionId\(null\)/u
  );
  assert.equal(confirmIssueFlow.match(/setIssueActionId\(null\)/gu)?.length, 1);
  const inFlightLock = confirmIssueFlow.indexOf(
    'issueInFlightRef.current = true'
  );
  const issueDispatch = confirmIssueFlow.indexOf("await callAction('issue')");
  const inFlightUnlock = confirmIssueFlow.lastIndexOf(
    'issueInFlightRef.current = false'
  );
  assert.match(confirmIssueFlow, /if \(issueInFlightRef\.current\) return/u);
  assert.ok(inFlightLock >= 0 && inFlightLock < issueDispatch);
  assert.ok(issueDispatch < inFlightUnlock);
  assert.match(
    callActionFlow,
    /payload\?\.emailQueued === true[\s\S]*?toast\.success[\s\S]*?else \{[\s\S]*?toast\.success/u
  );

  assert.match(issueDialogIntegration, /open=\{isIssueDialogOpen\}/u);
  assert.match(
    issueDialogIntegration,
    /recipientEmail=\{persistedRequestDetails\.email\}/u
  );
  assert.match(issueDialogIntegration, /offerReference=\{/u);
  assert.match(issueDialogIntegration, /total=\{formatCurrency\(/u);
  assert.match(issueDialogIntegration, /busy=\{busyAction === 'issue'\}/u);
  assert.match(issueDialogIntegration, /onCancel=\{closeIssueDialog\}/u);
  assert.match(issueDialogIntegration, /onConfirm=\{/u);

  assert.match(issueDialog, /<Dialog/u);
  assert.match(issueDialog, /isDismissable=\{!busy\}/u);
  assert.match(issueDialog, /initialFocusRef=\{cancelButtonRef\}/u);
  assert.match(issueDialog, /data-testid="quote-issue-dialog"/u);
  assert.match(issueDialog, /data-testid="quote-issue-reference"/u);
  assert.match(issueDialog, /data-testid="quote-issue-total"/u);
  assert.match(issueDialog, /data-testid="quote-issue-recipient"/u);
  assert.match(issueDialog, /data-testid="quote-issue-cancel"/u);
  assert.match(issueDialog, /data-testid="quote-issue-confirm"/u);
  assert.match(issueDialog, /shranjena in zamrznjena/u);
  assert.match(issueDialog, /novo različico/u);
  assert.match(
    issueDialog,
    /E-pošta stranki[\s\S]*?uvrščena v čakalno vrsto/u
  );
  assert.match(issueDialog, /href="\/admin\/email"/u);
  assert.match(
    issueDialog,
    /onOpenChange=\{\(nextOpen\) => \{[\s\S]*?!nextOpen && !busy[\s\S]*?onCancel\(\)/u
  );
  assert.match(issueDialog, /onClick=\{onCancel\}[\s\S]*?disabled=\{busy\}/u);
  assert.match(issueDialog, /onClick=\{onConfirm\}[\s\S]*?disabled=\{busy\}/u);
  assert.doesNotMatch(issueDialog, /fetch\(|window\.confirm|window\.prompt/u);
  assert.match(sharedDialog, /onClick=\{handleOverlayClick\}/u);
  assert.match(sharedDialog, /event\.key === 'Escape'/u);
  assert.match(sharedDialog, /previousActiveElement\.focus\(\)/u);
  assert.doesNotMatch(
    detail,
    /action === 'issue' && !window\.confirm|Izdaja shrani in zamrzne[\s\S]*?window\.confirm/u
  );
});
test('quote detail exposes the shared table status vocabulary with lifecycle prerequisite explanations', () => {
  const detail = source('src/admin/features/quotes/components/AdminQuoteDetailClient.tsx');
  const quoteTable = source('src/admin/features/quotes/components/AdminQuotesTable.tsx');

  assert.match(detail, /data-testid="quote-workflow-status"/u);
  assert.match(detail, /<AdminChipDropdown/u);
  assert.match(detail, /value=\{activeVisibleRequestStatus\}/u);
  assert.match(detail, /options=\{requestStatusSelectionOptions\}/u);
  assert.match(detail, /showArrow=\{isEditingRequestHeader\}/u);
  assert.match(detail, /interactive=\{isEditingRequestHeader\}/u);
  assert.match(detail, /onChange=\{handleRequestStatusSelection\}/u);
  assert.match(detail, /data-testid="quote-header-status-edit"/u);
  assert.match(detail, /data-testid="quote-request-title-input"/u);
  assert.match(detail, /value=\{draftRequestTitle\}/u);
  assert.match(detail, /aria-pressed=\{isMasterEditing\}/u);
  assert.match(detail, /disabled=\{!isClientReady \|\| Boolean\(busyAction\) \|\| isPreparingOfferEdit\}/u);
  assert.doesNotMatch(detail, /disabled=\{!isClientReady \|\| Boolean\(busyAction\) \|\| !canAdjustWorkflowStatus\}/u);
  assert.match(detail, /getQuoteRequestVisibleStatusValue\(activeRequestStatus\)/u);
  assert.match(detail, /buildQuoteRequestStatusSelectionOptions/u);
  assert.match(detail, /QUOTE_REQUEST_VISIBLE_STATUS_OPTIONS\.find/u);
  assert.match(detail, /menuClassName="w-\[min\(22rem,calc\(100vw-2rem\)\)\]"/u);
  assert.match(
    detail,
    /const handleRequestStatusSelection[\s\S]*?selectedOption\.disabled[\s\S]*?getManualQuoteRequestStatusTarget[\s\S]*?updateDraftRequestDetails/u
  );
  assert.match(detail, /ariaLabel="Status povpraševanja"/u);
  assert.doesNotMatch(detail, /ariaLabel="Dejanja stanja povpraševanja"/u);
  assert.doesNotMatch(detail, /workflowStatusActionOptions|handleWorkflowStatusAction/u);
  assert.doesNotMatch(detail, />Status<\/span>/u);
  assert.doesNotMatch(detail, /Status se spremeni samodejno glede na potek ponudbe/u);
  assert.doesNotMatch(detail, /<StateBadge status=\{(?:currentVersion|draftVersion|currentIssuedVersion)\.status\}/u);
  assert.match(detail, /getQuoteRequestStatusPresentation/u);
  assert.match(quoteTable, /getQuoteRequestStatusLabel/u);
  assert.match(quoteTable, /QUOTE_REQUEST_VISIBLE_STATUS_OPTIONS/u);

  assert.match(detail, /const canWithdrawIssuedOffer = Boolean\(currentIssuedVersion\)/u);
  assert.match(detail, /const canCloseWithoutIssuing =[\s\S]*?detail\.offerVersions\.every\(\(version\) => version\.status === 'draft'\)/u);
  assert.match(detail, /canWithdrawIssuedOffer \? <Button[^>]*data-testid="quote-action-withdraw-offer"/u);
  assert.match(detail, /canCloseWithoutIssuing \? <Button[^>]*data-testid="quote-action-close-without-offer"/u);
  assert.match(detail, /Umakni izdano ponudbo/u);
  assert.match(detail, /Zaključi brez izdaje ponudbe/u);
  assert.match(detail, /onemogoči povezavo stranke/u);
  assert.match(detail, /Na voljo le pred prvo izdajo/u);
});

test('quote and order documents share presentation chrome while retaining feature actions', () => {
  const detail = source('src/admin/features/quotes/components/AdminQuoteDetailClient.tsx');
  const documents = source(
    'src/admin/features/quotes/components/AdminQuoteDocumentsManager.tsx'
  );
  const orderDocuments = source(
    'src/admin/features/orders/components/AdminOrderPdfManager.tsx'
  );
  const sharedDocuments = source(
    'src/shared/ui/admin-detail/AdminDetailDocuments.tsx'
  );

  assert.match(detail, /AdminQuoteDocumentsManager/u);
  assert.match(documents, /testId="quote-documents-card"/u);
  assert.match(
    documents,
    /testId=\{`quote-document-type-\$\{documentType\.key\}`\}/u
  );
  assert.match(
    documents,
    /api\/admin\/quote-requests\/\$\{quoteRequestId\}\/documents/u
  );
  assert.match(documents, /purchase_order/u);
  assert.match(
    documents,
    /Naročilnico lahko naloži administrator ali stranka/u
  );
  assert.match(detail, /offerVersions=\{detail\.offerVersions\}/u);
  assert.doesNotMatch(detail, /<h2[^>]*>Zgodovina različic<\/h2>/u);
  assert.match(
    documents,
    /testId="quote-offer-version-history"/u
  );
  assert.match(documents, /offerDocumentByVersionId\.get\(version\.id\)/u);

  for (const manager of [orderDocuments, documents]) {
    assert.match(manager, /from '@\/shared\/ui\/admin-detail'/u);
    assert.match(manager, /<AdminDetailDocumentsCard/u);
    assert.match(manager, /<AdminDetailDocumentTypeRow/u);
    assert.match(manager, /<AdminDetailDocumentSummary/u);
    assert.match(manager, /<AdminDetailDocumentCurrent/u);
    assert.match(manager, /<AdminDetailDocumentActions/u);
    assert.match(manager, /<AdminDetailDocumentOpenLink/u);
    assert.match(manager, /<AdminDetailDocumentPrimaryAction/u);
    assert.match(manager, /<AdminDetailDocumentHistory/u);
    assert.match(manager, /<AdminDetailDocumentHistoryItem/u);
    assert.match(manager, /<RowActionsDropdown/u);
    assert.match(manager, /triggerClassName="!h-7 !w-7 !text-slate-500"/u);
    assert.match(manager, /menuWidth=\{174\}/u);
    assert.match(manager, /menuClassName="!w-full"/u);
    assert.match(manager, /label: 'Prenesi'/u);
  }

  const sharedChromePatterns = [
    /flex w-full min-w-0 flex-col p-4/u,
    /<h2 className="text-base font-semibold text-slate-900">PDF dokumenti<\/h2>/u,
    /mt-2\.5 overflow-hidden rounded-xl border border-slate-200 bg-white/u,
    /className="border-b border-slate-200 last:border-b-0"/u,
    /grid min-h-11 grid-cols-\[minmax\(0,1fr\)_auto\] items-center gap-3 px-3 py-1\.5/u,
    /text-\[12px\] font-semibold leading-4 text-slate-900/u,
    /min-w-0 flex-1 truncate text-\[11px\] font-medium leading-4 text-\[color:var\(--blue-500\)\]/u,
    /shrink-0 whitespace-nowrap text-\[10px\] leading-4 text-slate-500/u
  ];
  for (const pattern of sharedChromePatterns) {
    assert.match(sharedDocuments, pattern);
  }
  assert.doesNotMatch(
    sharedDocuments,
    /fetch\(|quoteRequestId|orderId|handleUpload|handleGenerate/u
  );

  assert.match(
    documents,
    /<AdminDetailDocumentCurrent[\s\S]*?href=\{documentUrl\([\s\S]*?quoteRequestId,[\s\S]*?displayedDocument\.id[\s\S]*?\)\}[\s\S]*?filename=\{displayedDocument\.filename\}[\s\S]*?timestamp=\{formatTimestamp\(displayedDocument\.createdAt\)\}/u
  );
  assert.match(
    documents,
    /documentType\.key === 'offer'[\s\S]*?<AdminDetailDocumentPrimaryAction[\s\S]*?data-testid="quote-document-generate-offer"[\s\S]*?isGenerating[\s\S]*?:[\s\S]*?'Ustvari'[\s\S]*?<\/AdminDetailDocumentPrimaryAction>/u
  );
  assert.match(documents, /label=\{`Dejanja za \$\{documentType\.label\}`\}/u);
  assert.match(
    documents,
    /key: 'generate'[\s\S]*?label: generatedIssuedOfferDocument[\s\S]*?'Uradni PDF je ustvarjen'[\s\S]*?'Ustvari uradni PDF'/u
  );
  assert.match(
    documents,
    /key: 'upload'[\s\S]*?displayedDocument[\s\S]*?'Naloži novo različico'[\s\S]*?'Naloži PDF'/u
  );
  assert.match(documents, /key: 'download'[\s\S]*?label: 'Prenesi'/u);
  assert.match(documents, /PdfFileIcon/u);
  assert.match(documents, /DownloadIcon/u);
  assert.match(documents, /UploadIcon/u);
  assert.match(
    documents,
    /data-testid=\{`quote-document-upload-input-\$\{documentType\.key\}`\}/u
  );
  assert.match(documents, /Spinner/u);
  assert.doesNotMatch(
    documents,
    /expandedByType|Pokaži (?:vse )?različice|Skrij (?:starejše|različice)/u
  );
  assert.match(
    documents,
    /OFFER_VERSION_STATUS_LABELS\[[\s\S]*?String\(version\.status\)[\s\S]*?\] \?\? String\(version\.status\)/u
  );
  assert.match(documents, /formatCurrency\(version\.total, version\.currency\)/u);
  assert.doesNotMatch(
    documents,
    /TrashCanIcon|method: 'DELETE'|key: 'delete'|generate-order-summary/u
  );
});
test('quote administrator notes use the shared compact card and precede PDF documents', () => {
  const detail = source('src/admin/features/quotes/components/AdminQuoteDetailClient.tsx');
  const notesPresenter = source('src/shared/ui/admin-detail/AdminNotesCard.tsx');
  const notes = detail.indexOf('<AdminNotesCard');
  const documents = detail.indexOf('<AdminQuoteDocumentsManager');
  const notesIntegration = detail.slice(notes, documents);

  assert.ok(notes >= 0 && documents > notes);
  assert.doesNotMatch(detail, /data-testid="quote-customer-card"/u);
  assert.match(detail, /import \{ AdminNotesCard \}/u);
  assert.match(notesIntegration, /headingId="quote-admin-notes-title"/u);
  assert.match(notesIntegration, /testId="quote-admin-notes-card"/u);
  assert.match(notesIntegration, /editActionId="quote-admin-notes"/u);
  assert.match(notesIntegration, /isEditing=\{isEditingAdminNotes\}/u);
  assert.match(notesIntegration, /value=\{activeAdminNotes\}/u);
  assert.match(notesIntegration, /persistedValue=\{persistedAdminNotes\}/u);
  assert.match(notesIntegration, /onChange=\{setDraftAdminNotes\}/u);
  assert.match(notesIntegration, /onToggle=\{toggleAdminNotesEdit\}/u);
  assert.match(notesIntegration, /disabled=\{Boolean\(busyAction\)\}/u);
  assert.match(notesIntegration, /autoFocus=\{isEditingAdminNotes && !isMasterEditing\}/u);

  assert.match(notesPresenter, /adminWindowCardClassName/u);
  assert.match(notesPresenter, /aria-labelledby=\{headingId\}/u);
  assert.match(notesPresenter, /className="flex min-h-7 items-center justify-between gap-4"/u);
  assert.match(notesPresenter, />\s*Opombe administratorja\s*</u);
  assert.match(notesPresenter, /aria-label="Dodaj interno opombo"/u);
  assert.match(notesPresenter, /border border-dashed border-slate-300/u);
  assert.match(notesPresenter, /<PlusIcon className="h-3 w-3" \/>/u);
  assert.match(notesPresenter, /\{isEditing \? \(/u);
  assert.match(notesPresenter, /block h-10 min-h-10 w-full resize-none/u);
  assert.match(notesPresenter, /data-admin-card-edit-action=\{editActionId\}/u);
  assert.match(notesPresenter, /aria-pressed=\{isEditing\}/u);
  assert.match(notesPresenter, /className="flex h-10 w-full items-center rounded-lg border border-slate-200 bg-white px-3"/u);
  assert.match(notesPresenter, /min-w-0 flex-1 truncate text-\[13px\]/u);
  assert.match(notesPresenter, /title=\{persistedValue\}/u);
});
test('quote access and email evidence share one compact order-style customer card', () => {
  const detail = source('src/admin/features/quotes/components/AdminQuoteDetailClient.tsx');
  const orderAccess = source(
    'src/admin/features/orders/components/AdminOrderCustomerAccess.tsx'
  );
  const cardStart = detail.indexOf('data-testid="quote-customer-access-card"');
  const cardSectionStart = detail.lastIndexOf('<section', cardStart);
  const cardEnd = detail.indexOf('</aside>', cardStart);
  const accessCard = detail.slice(cardSectionStart, cardEnd);
  const stateBadgeStart = detail.indexOf('function StateBadge');
  const stateBadgeEnd = detail.indexOf(
    'function QuoteWorkflowStatusBadge',
    stateBadgeStart
  );
  const stateBadge = detail.slice(stateBadgeStart, stateBadgeEnd);

  assert.ok(cardStart >= 0);
  assert.ok(cardSectionStart >= 0);
  assert.ok(cardEnd > cardStart);
  assert.equal(
    detail.match(/data-testid="quote-customer-access-card"/gu)?.length,
    1
  );
  assert.equal(detail.match(/data-testid="quote-email-evidence"/gu)?.length, 1);
  assert.doesNotMatch(detail, /data-testid="quote-email-card"/u);
  assert.doesNotMatch(
    detail,
    /<h2[^>]*>\s*E-pošta\s*<\/h2>/u
  );

  const sharedCompactCardPatterns = [
    /rounded-xl border border-slate-200 bg-white p-5 shadow-\[0_14px_34px_rgba\(15,23,42,0\.06\),0_2px_6px_rgba\(15,23,42,0\.04\)\]/u,
    /<h2 className="text-base font-semibold text-slate-900">Stranka in dostop<\/h2>/u,
    /<dl className="mt-4 divide-y divide-slate-200 text-xs">/u,
    /className="flex items-center justify-between gap-4 py-2 first:pt-0"/u,
    /className="flex items-center justify-between gap-4 py-2"/u
  ];
  for (const pattern of sharedCompactCardPatterns) {
    assert.match(orderAccess, pattern);
    assert.match(accessCard, pattern);
  }

  assert.match(accessCard, />Dostop stranke<\/dt>/u);
  assert.match(accessCard, />Aktivne povezave<\/dt>/u);
  assert.match(accessCard, />Velja do<\/dt>/u);
  assert.match(accessCard, />Zadnja uporaba<\/dt>/u);
  assert.match(
    accessCard,
    /className="mt-4 border-t border-slate-200 pt-4"[\s\S]*?data-testid="quote-email-evidence"/u
  );
  assert.match(
    accessCard,
    /<h3 id="quote-email-evidence-title" className="text-sm font-semibold text-slate-900">\s*E-pošta\s*<\/h3>/u
  );
  assert.match(accessCard, /detail\.emailJobs\.map\(\(job\) =>/u);
  assert.match(
    accessCard,
    /const eventLabel = EMAIL_JOB_EVENT_LABELS\[job\.eventType\] \?\? job\.eventType/u
  );
  assert.match(
    accessCard,
    /const audienceLabel = EMAIL_JOB_AUDIENCE_LABELS\[job\.audience\] \?\? job\.audience/u
  );
  assert.match(accessCard, /title=\{`\$\{job\.eventType\} · \$\{job\.audience\}`\}/u);
  assert.match(accessCard, /title=\{job\.recipientEmail\}/u);
  assert.match(accessCard, /\{job\.recipientEmail\} · poskusi \{job\.attempts\}/u);
  assert.match(accessCard, /<StateBadge status=\{job\.status\} \/>/u);
  assert.match(accessCard, /job\.lastError[\s\S]*?title=\{job\.lastError\}/u);
  assert.match(accessCard, /data-testid="quote-email-last-error"/u);
  assert.match(accessCard, /job\.status === 'failed'/u);
  assert.match(accessCard, /retryEmail\(job\.id\)/u);
  assert.match(accessCard, /Ponovi pošiljanje/u);
  assert.match(accessCard, /E-poštnih opravil še ni\./u);
  assert.match(
    detail,
    /fetch\(`\/api\/admin\/quote-email-jobs\/\$\{jobId\}\/retry`/u
  );

  assert.match(stateBadge, /<span/u);
  assert.match(
    stateBadge,
    /shrink-0 whitespace-nowrap text-\[11px\] font-semibold/u
  );
  assert.match(stateBadge, /data-testid="quote-email-status"/u);
  assert.match(
    stateBadge,
    /EMAIL_JOB_STATUS_LABELS\[status\] \?\? status/u
  );
  assert.doesNotMatch(stateBadge, /AdminInfoChip/u);
});

test('quote detail section titles share the order-detail reference class', () => {
  const detail = source('src/admin/features/quotes/components/AdminQuoteDetailClient.tsx');
  const notesCard = source('src/shared/ui/admin-detail/AdminNotesCard.tsx');
  const documentsCard = source('src/shared/ui/admin-detail/AdminDetailDocuments.tsx');
  const headingClass = 'text-base font-semibold text-slate-900';
  const headingPattern = (title: string) =>
    new RegExp(`<h2 className="${headingClass}">${title}<\\/h2>`, 'u');

  assert.match(detail, headingPattern('Podatki povpraševanja'));
  assert.match(detail, headingPattern('Ponudba'));
  assert.match(detail, headingPattern('Stranka in dostop'));
  assert.match(
    notesCard,
    new RegExp(`className="${headingClass}"[\\s\\S]*?Opombe administratorja`, 'u')
  );
  assert.match(documentsCard, headingPattern('PDF dokumenti'));
});

test('order detail omits redundant seller acceptance while preserving school commitment and quote origin', () => {
  const detail = source('src/admin/features/orders/components/AdminOrderDetailClient.tsx');
  const school = source('src/admin/features/orders/components/AdminOrderCustomerAccess.tsx');

  assert.doesNotMatch(detail, /AdminOrderContractCard/u);
  assert.match(detail, /AdminOrderCustomerAccess/u);
  assert.doesNotMatch(detail, /const contractAccepted = order\.contract_status === 'accepted'/u);
  assert.doesNotMatch(detail, /\? 'Sprejeto'/u);
  assert.match(detail, /<RowActionsDropdown[\s\S]*?label: 'Zavrni naročilo'/u);
  assert.match(detail, /AdminOrderCustomerAccess[\s\S]*?compact/u);
  assert.match(
    detail,
    /Iz ponudbe \{order\.source_quote_offer_code \?\? order\.source_quote_offer_number\}/u
  );
  assert.match(
    detail,
    /Povpraševanje \{order\.source_quote_code \?\? order\.source_quote_request_number\}/u
  );
  assert.match(detail, /interno \$\{order\.source_quote_offer_number\}/u);
  assert.match(detail, /interno \$\{order\.source_quote_request_number\}/u);
  assert.match(detail, /admin\/orders\/quotes\/' \+ order\.source_quote_request_id/u);
  assert.doesNotMatch(school, /Šolsko povpraševanje|To povpraševanje|Zavrnjeno povpraševanje/u);
});

test('financial and customer read models require accepted contracts and committed dates', () => {
  const analytics = source('src/shared/server/orderAnalytics.ts');
  const orders = source('src/shared/server/orders.ts');
  const customers = source('src/shared/server/customerDirectory.ts');
  const preview = source('src/admin/features/orders/components/AdminOrdersPreviewChart.tsx');

  assert.match(analytics, /order\.contract_status === 'accepted'/u);
  assert.match(analytics, /order\.committed_at \?\? order\.contract_accepted_at/u);
  assert.match(orders, /orders\.committed_at/u);
  assert.match(customers, /contract_status = 'accepted'/u);
  assert.match(customers, /coalesce\(committed_at, contract_accepted_at, created_at\) as purchase_at/u);
  assert.match(preview, /VREDNOST NAROČIL/u);
});

test('legacy order offer documents are quarantined instead of becoming order confirmations', () => {
  const pdfCell = source('src/admin/features/orders/components/adminOrdersPdfCellUtils.ts');
  assert.match(pdfCell, /if \(type === 'offer'\) return null/u);
  assert.doesNotMatch(pdfCell, /type === 'offer' \|\| type === 'order_summary'/u);
});
