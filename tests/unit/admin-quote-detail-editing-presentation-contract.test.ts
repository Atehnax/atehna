import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const quoteDetailPath = 'src/admin/features/quotes/components/AdminQuoteDetailClient.tsx';
const orderDetailPath = 'src/admin/features/orders/components/AdminOrderDetailClient.tsx';
const adminDetailsRoutePath = 'src/admin/api/quote-requests/[quoteRequestId]/details/route.ts';
const appDetailsRoutePath = 'src/app/api/admin/quote-requests/[quoteRequestId]/details/route.ts';
const adminStatusRoutePath = 'src/admin/api/quote-requests/[quoteRequestId]/status/route.ts';
const appStatusRoutePath = 'src/app/api/admin/quote-requests/[quoteRequestId]/status/route.ts';
const adminTitleRoutePath = 'src/admin/api/quote-requests/[quoteRequestId]/title/route.ts';
const appTitleRoutePath = 'src/app/api/admin/quote-requests/[quoteRequestId]/title/route.ts';
const adminNotesRoutePath = 'src/admin/api/quote-requests/[quoteRequestId]/notes/route.ts';
const appNotesRoutePath = 'src/app/api/admin/quote-requests/[quoteRequestId]/notes/route.ts';
const adminDraftRoutePath = 'src/admin/api/quote-requests/[quoteRequestId]/draft/route.ts';
const adminChipDropdownPath = 'src/shared/ui/admin-controls/AdminChipDropdown.tsx';
const adminDetailTitleSlotPath = 'src/shared/ui/admin-detail/AdminDetailTitleSlot.tsx';
const adminNotesCardPath = 'src/shared/ui/admin-detail/AdminNotesCard.tsx';
const adminActivityTimelinePath = 'src/shared/ui/admin-detail/AdminActivityTimeline.tsx';
const adminDetailDocumentsPath = 'src/shared/ui/admin-detail/AdminDetailDocuments.tsx';
const quoteActivityTimelinePath = 'src/admin/features/quotes/components/AdminQuoteActivityTimeline.tsx';
const quoteDocumentsManagerPath = 'src/admin/features/quotes/components/AdminQuoteDocumentsManager.tsx';
const quoteCustomerMessagePath = 'src/shared/domain/quote/quoteCustomerMessage.ts';
const quoteTypesPath = 'src/shared/domain/quote/quoteTypes.ts';
const commercialQuoteContractsPath = 'src/commercial/quote/contracts.ts';
const pdfPreviewDialogPath = 'src/shared/ui/pdf-preview-dialog/PdfPreviewDialog.tsx';
const schemaPath = 'database/schema.sql';
const detailsMigrationPath = 'database/migrations/20260829_quote_request_admin_details.sql';
const adminTitleMigrationPath = 'database/migrations/20260830_quote_request_admin_title.sql';
const quoteAdminTypesPath = 'src/shared/domain/quote/quoteAdminTypes.ts';
const quoteServerPath = 'src/shared/server/quotes.ts';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const detailTitleSlot = source(adminDetailTitleSlotPath);
const adminNotesCard = source(adminNotesCardPath);
const adminActivityTimeline = source(adminActivityTimelinePath);
const adminDetailDocuments = source(adminDetailDocumentsPath);
const quoteActivityTimeline = source(quoteActivityTimelinePath);
const quoteDocumentsManager = source(quoteDocumentsManagerPath);

const sliceBetween = (value: string, startMarker: string, endMarker: string) => {
  const start = value.indexOf(startMarker);
  assert.notEqual(start, -1, `Expected to find start marker: ${startMarker}`);
  const end = value.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Expected to find end marker after ${startMarker}: ${endMarker}`);
  return value.slice(start, end);
};

test('quote admin title and customer details are editable while request and offer numbers stay immutable', () => {
  const detail = source(quoteDetailPath);
  const stateShape = sliceBetween(detail, 'type QuoteRequestDetailsState = {', '\n};');
  const requestSection = sliceBetween(
    detail,
    'data-testid="quote-request-details-card"',
    'data-testid="quote-offer-card"'
  );
  const detailRow = sliceBetween(
    detail,
    'function QuoteDetailRow',
    'function StateBadge'
  );
  const addressEditor = sliceBetween(
    detail,
    'function QuoteAddressEditor',
    'function QuoteDetailRow'
  );
  const directlyEditableFields = [
    'customerType',
    'organizationName',
    'contactName',
    'email',
    'reference',
    'quoteReason',
    'customerMessage'
  ] as const;
  const structuredAddressFields = [
    'addressLine1',
    'addressLine2',
    'postalCode',
    'city',
    'countryCode'
  ] as const;

  assert.match(detail, /data-testid="quote-request-details-card"/u);
  assert.match(requestSection, /<dl\b/u);
  assert.match(requestSection, /<QuoteDetailRow\b/u);
  assert.match(requestSection, /<input\b/u);
  assert.match(requestSection, /<textarea\b/u);
  assert.match(requestSection, /<CustomSelect\b/u);
  assert.match(detailRow, /\{isEditing \? children : \(/u);
  assert.match(detailRow, /<span className=\{quoteDetailReadValueClassName\}>/u);
  assert.doesNotMatch(requestSection, /disabled=\{!isEditingRequestDetails/u);
  assert.doesNotMatch(requestSection, /readOnly=\{!isEditingRequestDetails/u);

  for (const field of [...directlyEditableFields, ...structuredAddressFields]) {
    assert.match(stateShape, new RegExp(`\\b${field}: string`, 'u'));
  }
  for (const field of directlyEditableFields) {
    assert.match(requestSection, new RegExp(`activeRequestDetails\\.${field}\\b`, 'u'));
    assert.match(
      requestSection,
      new RegExp(`updateDraftRequestDetails\\(\\{\\s*${field}:`, 'u')
    );
  }
  for (const field of structuredAddressFields) {
    assert.match(addressEditor, new RegExp(`details\\.${field}\\b`, 'u'));
    assert.match(addressEditor, new RegExp(`onChange\\(\\{\\s*${field}:`, 'u'));
  }
  assert.match(requestSection, /<QuoteAddressEditor[\s\S]*?details=\{activeRequestDetails\}/u);

  assert.match(detail, /quoteRequestDefaultTitle\(detail\.requestNumber\)/u);
  assert.match(detail, /detail\.adminTitle\?\.trim\(\)/u);
  assert.match(detail, /data-testid="quote-request-title-input"/u);
  assert.match(detail, /value=\{draftRequestTitle\}/u);
  assert.match(detail, /onChange=\{\(event\) => setDraftRequestTitle\(event\.target\.value\)\}/u);
  assert.match(detail, /<AdminDetailTitleSlot[\s\S]*?title=\{persistedRequestTitle\}/u);
  assert.match(detailTitleSlot, /<h1[\s\S]*?\{title\}[\s\S]*?<\/h1>/u);
  assert.match(detail, /currentVersion\.offerNumber/u);
  assert.doesNotMatch(
    detail,
    /updateDraftRequestDetails\(\{[^}\n\r]*\b(?:requestNumber|offerNumber)\b/u
  );
  assert.doesNotMatch(
    detail,
    /(?:onChange=[^\n\r]*(?:requestNumber|offerNumber)|(?:requestNumber|offerNumber)[^\n\r]*onChange=)/u
  );
});

test('quote request detail edits persist through the admin route and app-router re-export', () => {
  const detail = source(quoteDetailPath);
  const saveRequestDetailsSource = sliceBetween(
    detail,
    'const saveRequestDetails',
    'const callAction'
  );

  assert.match(saveRequestDetailsSource, /fetch\(`\/api\/admin\/quote-requests\/\$\{detail\.id\}\/details`/u);
  assert.match(saveRequestDetailsSource, /method: 'PUT'/u);
  assert.match(saveRequestDetailsSource, /expectedRequestStateVersion/u);
  assert.match(saveRequestDetailsSource, /\.\.\.draftRequestDetails/u);

  const routePaths = [adminDetailsRoutePath, appDetailsRoutePath];
  const missingRoutes = routePaths.filter((path) => !existsSync(resolve(process.cwd(), path)));
  assert.deepEqual(missingRoutes, [], `Missing quote-detail persistence route(s): ${missingRoutes.join(', ')}`);

  const adminRoute = source(adminDetailsRoutePath);
  const appRoute = source(appDetailsRoutePath);
  assert.match(adminRoute, /export async function PUT/u);
  assert.match(adminRoute, /expectedRequestStateVersion/u);
  assert.match(
    appRoute,
    /export (?:\*|\{\s*PUT\s*\}) from '@\/admin\/api\/quote-requests\/\[quoteRequestId\]\/details\/route';/u
  );
});

test('quote header master pencil edits title and status without bypassing lifecycle actions', () => {
  const quoteDetail = source(quoteDetailPath);
  const orderDetail = source(orderDetailPath);
  const detailsRoute = source(adminDetailsRoutePath);
  const statusRoute = source(adminStatusRoutePath);
  const appStatusRoute = source(appStatusRoutePath);
  const dropdown = source(adminChipDropdownPath);
  const stateShape = sliceBetween(
    quoteDetail,
    'type QuoteRequestDetailsState = {',
    '\n};'
  );
  const statusSaveSource = sliceBetween(
    quoteDetail,
    'const saveRequestStatus',
    'const saveRequestTitle'
  );
  const statusSelectionSource = sliceBetween(
    quoteDetail,
    'const handleRequestStatusSelection',
    'const saveQuoteChanges'
  );

  assert.match(stateShape, /\bstatus: string/u);
  assert.match(quoteDetail, /status: detail\.status/u);
  assert.match(quoteDetail, /const \[isEditingRequestHeader, setIsEditingRequestHeader\] = useState\(false\)/u);
  assert.match(quoteDetail, /const \[isMasterEditing, setIsMasterEditing\] = useState\(false\)/u);
  assert.match(quoteDetail, /const activeRequestStatus = isEditingRequestHeader/u);
  assert.match(quoteDetail, /data-testid="quote-header-status-edit"/u);
  assert.match(quoteDetail, /<AdminDetailTitleSlot[\s\S]*?title=\{persistedRequestTitle\}/u);
  assert.match(
    detailTitleSlot,
    /<span className="truncate leading-tight">\{title\}<\/span>/u
  );
  assert.match(quoteDetail, /onClick=\{toggleMasterEdit\}/u);
  assert.match(quoteDetail, /aria-pressed=\{isMasterEditing\}/u);
  assert.match(quoteDetail, /disabled=\{!hasActiveQuoteEditor \|\| Boolean\(busyAction\) \|\| isPreparingOfferEdit\}/u);
  assert.match(statusSaveSource, /fetch\(`\/api\/admin\/quote-requests\/\$\{detail\.id\}\/status`/u);
  assert.match(statusSaveSource, /method: 'POST'/u);
  assert.match(statusSaveSource, /expectedRequestStateVersion/u);
  assert.match(statusSaveSource, /status: draftRequestDetails\.status/u);
  assert.doesNotMatch(statusSaveSource, /customerType|billingSnapshot|\.\.\.draftRequestDetails|draftRequestTitle|adminTitle/u);
  assert.doesNotMatch(statusSaveSource, /setIsEditingRequestHeader\(false\)/u);
  assert.match(quoteDetail, /buildQuoteRequestStatusSelectionOptions/u);
  assert.match(quoteDetail, /getQuoteRequestVisibleStatusValue/u);
  assert.match(statusSelectionSource, /selectedOption\.disabled/u);
  assert.match(statusSelectionSource, /getManualQuoteRequestStatusTarget/u);
  assert.match(statusSelectionSource, /updateDraftRequestDetails\(\{ status: targetStatus \}\)/u);
  assert.doesNotMatch(statusSelectionSource, /callAction/u);

  for (const consumer of [orderDetail, quoteDetail]) {
    assert.match(
      consumer,
      /import \{ AdminChipDropdown \} from '@\/shared\/ui\/admin-controls\/AdminChipDropdown';/u
    );
    assert.match(consumer, /<AdminChipDropdown/u);
  }
  assert.match(dropdown, /showArrow \? \(/u);
  assert.match(dropdown, /if \(disabled \|\| !interactive\) return/u);
  assert.match(dropdown, /createPortal/u);
  assert.match(dropdown, /aria-label=\{ariaLabel\}/u);

  assert.equal(existsSync(resolve(process.cwd(), adminStatusRoutePath)), true);
  assert.equal(existsSync(resolve(process.cwd(), appStatusRoutePath)), true);
  assert.match(appStatusRoute, /export \{ POST \} from '@\/admin\/api\/quote-requests\/\[quoteRequestId\]\/status\/route';/u);
  assert.match(statusRoute, /export async function POST/u);
  assert.match(statusRoute, /isQuoteAdminEnabled\(\)/u);
  assert.match(statusRoute, /hasValidQuoteAdminSession\(request\)/u);
  assert.match(statusRoute, /expectedRequestStateVersion/u);
  assert.match(statusRoute, /lockQuoteWorkflow\(client, quoteRequestId\)/u);
  assert.match(statusRoute, /from quote_requests[\s\S]*?for update/u);
  assert.match(statusRoute, /QUOTE_REQUEST_VOIDED/u);
  assert.match(statusRoute, /QUOTE_REQUEST_STALE/u);
  assert.match(statusRoute, /isManuallyEditableQuoteRequestStatus\(previousStatus\)/u);
  assert.match(statusRoute, /status <> 'draft'/u);
  assert.match(statusRoute, /QUOTE_STATUS_LIFECYCLE_OWNED/u);
  assert.match(statusRoute, /state_version = state_version \+ 1/u);
  assert.match(statusRoute, /appendQuoteEvent/u);
  assert.match(statusRoute, /action: 'status_changed'/u);
  assert.match(statusRoute, /beforeStatus: previousStatus/u);
  assert.match(statusRoute, /afterStatus: status/u);
  assert.doesNotMatch(statusRoute, /customer_type|billing_snapshot_json|customer_snapshot_json/u);
  assert.match(detailsRoute, /QUOTE_CUSTOMER_SNAPSHOT_LOCKED/u);
});
test('quote header pencil activates every eligible editor and master Save persists every scope', () => {
  const detail = source(quoteDetailPath);
  const masterEditSource = sliceBetween(
    detail,
    'const resetQuoteEditorsToPersisted',
    '\n  return ('
  );
  const saveSource = sliceBetween(
    detail,
    'const saveQuoteChanges',
    'const saveDraft'
  );

  assert.match(detail, /const \[isMasterEditing, setIsMasterEditing\] = useState\(false\)/u);
  assert.match(detail, /const \[persistedOfferDraft, setPersistedOfferDraft\] = useState<DraftState \| null>/u);
  assert.match(detail, /const hasActiveQuoteEditor =[\s\S]*?isMasterEditing[\s\S]*?isEditingRequestDetails[\s\S]*?isEditingRequestHeader[\s\S]*?isEditingAdminNotes[\s\S]*?isEditingOffer/u);
  assert.match(detail, /onClick=\{toggleMasterEdit\}/u);
  assert.match(detail, /aria-label=\{isMasterEditing \? 'Končaj urejanje povpraševanja' : 'Uredi celotno povpraševanje'\}/u);
  assert.match(detail, /aria-pressed=\{isMasterEditing\}/u);
  assert.match(detail, /disabled=\{!isClientReady \|\| Boolean\(busyAction\) \|\| isPreparingOfferEdit\}/u);
  assert.match(detail, /aria-busy=\{isPreparingOfferEdit\}/u);
  assert.match(masterEditSource, /setIsMasterEditing\(true\)/u);
  assert.match(masterEditSource, /setIsEditingRequestHeader\(true\)/u);
  assert.match(masterEditSource, /setIsEditingRequestDetails\(canEditRequestDetails\)/u);
  assert.doesNotMatch(masterEditSource, /setIsEditingRequestDetails\(true\)/u);
  assert.match(masterEditSource, /setIsEditingAdminNotes\(true\)/u);
  assert.match(masterEditSource, /if \(draft\)[\s\S]*?setIsEditingOffer\(true\)/u);
  assert.match(masterEditSource, /if \(!canReviseOffer\) return/u);
  assert.match(masterEditSource, /enterOfferEditAfterRevisionRef\.current = true[\s\S]*?enterMasterEditAfterRevisionRef\.current = true[\s\S]*?callAction\('revise'\)/u);
  assert.match(masterEditSource, /setDraftRequestDetails\(persistedRequestDetails\)/u);
  assert.match(masterEditSource, /setDraftRequestTitle\(persistedRequestTitle\)/u);
  assert.match(masterEditSource, /setDraftAdminNotes\(persistedAdminNotes\)/u);
  assert.match(masterEditSource, /setDraft\(persistedOfferDraft\)/u);
  assert.match(masterEditSource, /setIsEditingOffer\(false\)[\s\S]*?setIsMasterEditing\(false\)/u);
  assert.match(masterEditSource, /window\.confirm\('Neshranjene spremembe bodo zavržene\./u);

  assert.match(detail, /canCreateDraft[\s\S]*?\? toNewDraftState\(detail\)[\s\S]*?: null[\s\S]*?savedDraftFingerprint/u);
  assert.match(saveSource, /if \(isEditingOffer && draftHasUnsavedChanges\)/u);
  assert.match(saveSource, /const saved = await persistDraft\(draft\)/u);
  assert.match(saveSource, /nextRequestStateVersion = saved\.requestStateVersion/u);
  assert.match(detail, /setPersistedOfferDraft\(savedDraft\)/u);
  assert.match(detail, /setPersistedOfferDraft\(reconcileDraftStateVersion\)/u);
  assert.ok(
    saveSource.indexOf('getRequestDetailsValidationMessage()') < saveSource.indexOf('persistDraft(draft)'),
    'Request details must be validated before the first master-save write.'
  );
  assert.ok(
    saveSource.indexOf('getRequestStatusValidationMessage()') < saveSource.indexOf('persistDraft(draft)'),
    'Request status must be validated before the first master-save write.'
  );
  assert.ok(
    saveSource.indexOf('persistDraft(draft)') < saveSource.indexOf('saveRequestDetails('),
    'The offer must be saved before request metadata so the returned request version remains current.'
  );
  assert.match(saveSource, /setIsEditingRequestDetails\(false\)[\s\S]*?setIsEditingRequestHeader\(false\)[\s\S]*?setIsEditingAdminNotes\(false\)[\s\S]*?setIsEditingOffer\(false\)[\s\S]*?setIsMasterEditing\(false\)/u);
});

test('quote admin display title persists independently from the immutable request number', () => {
  const detail = source(quoteDetailPath);
  const types = source(quoteAdminTypesPath);
  const server = source(quoteServerPath);
  const schema = source(schemaPath);
  const migration = source(adminTitleMigrationPath);
  const titleRoute = source(adminTitleRoutePath);
  const appTitleRoute = source(appTitleRoutePath);
  const masterEditSource = sliceBetween(
    detail,
    'const resetQuoteEditorsToPersisted',
    '\n  return ('
  );
  const titleSaveSource = sliceBetween(
    detail,
    'const saveRequestTitle',
    'const saveRequestDetails'
  );
  const combinedSaveSource = sliceBetween(
    detail,
    'const saveQuoteChanges',
    'const saveDraft'
  );
  const schemaGuard = sliceBetween(
    schema,
    'create function guard_quote_request_history()',
    'create trigger quote_requests_guard_history'
  );
  const migrationGuard = sliceBetween(
    migration,
    'create or replace function guard_quote_request_history()',
    'do $$'
  );

  for (const path of [adminTitleRoutePath, appTitleRoutePath, adminTitleMigrationPath]) {
    assert.equal(existsSync(resolve(process.cwd(), path)), true, `Missing ${path}`);
  }

  assert.match(types, /adminTitle: string \| null/u);
  assert.match(server, /adminTitle: toNullableText\(request\.admin_title\)/u);
  assert.match(detail, /detail\.adminTitle\?\.trim\(\) \|\| quoteRequestDefaultTitle\(detail\.requestNumber\)/u);
  assert.match(detail, /data-testid="quote-request-title-input"/u);
  assert.match(detail, /maxLength=\{240\}/u);
  assert.match(masterEditSource, /setDraftRequestTitle\(persistedRequestTitle\)/u);
  assert.match(masterEditSource, /setDraftRequestDetails\(persistedRequestDetails\)/u);
  assert.match(masterEditSource, /setIsEditingRequestHeader\(false\)/u);
  assert.match(masterEditSource, /setIsEditingRequestHeader\(true\)/u);

  assert.match(titleSaveSource, /fetch\(`\/api\/admin\/quote-requests\/\$\{detail\.id\}\/title`/u);
  assert.match(titleSaveSource, /method: 'PUT'/u);
  assert.match(titleSaveSource, /expectedRequestStateVersion/u);
  assert.match(titleSaveSource, /title: draftRequestTitle/u);
  assert.match(titleSaveSource, /setPersistedRequestTitle\(nextTitle\)/u);
  assert.match(titleSaveSource, /setDraftRequestTitle\(nextTitle\)/u);
  assert.doesNotMatch(titleSaveSource, /setIsEditingRequestHeader\(false\)/u);

  assert.match(combinedSaveSource, /if \(isEditingRequestHeader && requestTitleDirty\)/u);
  assert.match(combinedSaveSource, /saveRequestTitle\(\s*nextRequestStateVersion/u);
  assert.match(combinedSaveSource, /if \(isEditingRequestHeader && requestStatusDirty\)/u);
  assert.match(combinedSaveSource, /saveRequestStatus\(\s*nextRequestStateVersion/u);
  assert.doesNotMatch(combinedSaveSource, /else if \(isEditingRequestHeader/u);
  assert.match(combinedSaveSource, /setIsEditingRequestHeader\(false\)/u);

  assert.match(titleRoute, /typeof parsed\.body\.title !== 'string'/u);
  assert.match(titleRoute, /boundedText\(parsed\.body\.title, 240\) \|\| null/u);
  assert.match(titleRoute, /expectedVersion\(\s*parsed\.body\.expectedRequestStateVersion/u);
  assert.match(titleRoute, /const fallbackTitle = `Povpraševanje \$\{requestNumber\}`/u);
  assert.match(titleRoute, /title: adminTitle \?\? fallbackTitle,[\s\S]*?adminTitle,[\s\S]*?stateVersion/u);
  assert.doesNotMatch(titleRoute, /QUOTE_CUSTOMER_SNAPSHOT_LOCKED|current issued offer|billing_snapshot_json|customer_snapshot_json/iu);
  assert.match(titleRoute, /lockQuoteWorkflow\(client, quoteRequestId\)/u);
  assert.match(titleRoute, /from quote_requests[\s\S]*?for update/u);
  assert.match(titleRoute, /QUOTE_REQUEST_VOIDED/u);
  assert.match(titleRoute, /QUOTE_REQUEST_STALE/u);
  assert.match(titleRoute, /set admin_title = \$2,[\s\S]*?state_version = state_version \+ 1/u);
  assert.match(titleRoute, /changedFields: \['adminTitle'\]/u);
  assert.match(titleRoute, /eventType: 'quote_request_details_changed'/u);
  assert.doesNotMatch(titleRoute, /set request_number =/u);
  assert.match(
    appTitleRoute,
    /export \{ PUT \} from '@\/admin\/api\/quote-requests\/\[quoteRequestId\]\/title\/route';/u
  );

  assert.match(schema, /admin_title text/u);
  assert.match(schema, /constraint quote_requests_admin_title_check/u);
  assert.equal([...schemaGuard.matchAll(/'admin_title'/gu)].length, 2);
  assert.doesNotMatch(schemaGuard, /new\.admin_title is distinct from old\.admin_title/u);
  assert.doesNotMatch(schemaGuard, /'request_number'/u);
  assert.match(migration, /add column if not exists admin_title text/u);
  assert.equal([...migrationGuard.matchAll(/'admin_title'/gu)].length, 2);
  assert.doesNotMatch(migrationGuard, /'request_number'/u);
});

test('quote detail uses the live draft version and permits partial address data before issuance', () => {
  const detail = source(quoteDetailPath);
  const requestDetailsValidationSource = sliceBetween(
    detail,
    'const getRequestDetailsValidationMessage',
    'const getRequestStatusValidationMessage'
  );
  const actionSource = sliceBetween(detail, 'const callAction', 'const saveDraft');
  const previewSource = sliceBetween(detail, 'const createPreview', 'const requestClarification');

  assert.match(
    detail,
    /editableVersion && draft\?\.offerVersionId === editableVersion\.id[\s\S]*?draft\.expectedStateVersion/u
  );
  assert.match(actionSource, /action === 'issue' && editableExpectedStateVersion !== null/u);
  assert.match(previewSource, /expectedStateVersion: editableExpectedStateVersion \?\? editableVersion\.stateVersion/u);
  assert.match(requestDetailsValidationSource, /customerType !== 'individual'/u);
  assert.doesNotMatch(requestDetailsValidationSource, /Naslov in kraj sta obvezna/u);
  assert.match(requestDetailsValidationSource, /\^\\d\{4\}\$/u);
  assert.match(requestDetailsValidationSource, /countryCode\.trim\(\)\.toUpperCase\(\) !== 'SI'/u);
});

test('issuing automatically saves the complete live draft and uses returned concurrency tokens', () => {
  const detail = source(quoteDetailPath);
  const draftRoute = source(adminDraftRoutePath);
  const persistSource = sliceBetween(detail, 'const persistDraft', 'const callAction');
  const actionSource = sliceBetween(detail, 'const callAction', 'const saveDraft');

  assert.match(persistSource, /\/api\/admin\/quote-requests\/\$\{detail\.id\}\/draft/u);
  assert.match(persistSource, /body: JSON\.stringify\(draftToPersist\)/u);
  assert.match(persistSource, /quoteOfferVersionId[\s\S]*?stateVersion[\s\S]*?requestStateVersion/u);
  assert.match(actionSource, /draftHasUnsavedChanges[\s\S]*?await persistDraft\(draft\)/u);
  assert.match(actionSource, /offerVersionId: actionOfferVersionId/u);
  assert.match(actionSource, /expectedStateVersion: actionOfferStateVersion/u);
  assert.match(actionSource, /expectedRequestStateVersion: actionRequestStateVersion/u);
  assert.match(draftRoute, /update quote_requests[\s\S]*?returning state_version/u);
  assert.match(draftRoute, /requestStateVersion,/u);
});

test('offer fields use one stable compact surface and expose one customer message', () => {
  const detail = source(quoteDetailPath);
  const messageHelper = source(quoteCustomerMessagePath);
  const offerSection = sliceBetween(
    detail,
    'data-testid="quote-offer-card"',
    'data-testid="quote-items-card"'
  );

  assert.match(offerSection, /data-testid="quote-offer-details"/u);
  assert.match(offerSection, /data-testid="quote-offer-action-bar"/u);
  assert.match(offerSection, /field="shipping"[\s\S]*?label="Poštnina"[\s\S]*?<AdminUnitInput[\s\S]*?unit="€"/u);
  assert.match(offerSection, /field="shipping"[\s\S]*?<AdminUnitInput[\s\S]*?aria-label="Poštnina"/u);
  assert.match(offerSection, /<dt>Poštnina<\/dt>/u);
  assert.doesNotMatch(offerSection, /Strošek dostave|<dt>Dostava<\/dt>/u);
  assert.doesNotMatch(offerSection, /Dostava brez DDV/u);
  assert.match(offerSection, /field="deliveryTerms"[\s\S]*?label="Dobavni pogoji"/u);
  assert.match(offerSection, /field="paymentTerms"[\s\S]*?label="Plačilni pogoji"/u);
  assert.match(offerSection, /field="customerMessage"[\s\S]*?label="Sporočilo stranki"/u);
  assert.match(offerSection, /aria-label="Sporočilo stranki"/u);
  assert.match(offerSection, /field="acceptanceTerms"[\s\S]*?label="Pogoji sprejema"/u);
  assert.doesNotMatch(offerSection, /Sporočilo prodajalca|Opombe, vidne stranki/u);
  assert.match(offerSection, /Izrecno potrjujem brezplačno dostavo/u);
  assert.match(messageHelper, /new Set\(messages\)/u);
});
test('quote shipping exposes its frozen calculation and can revert a manual amount', () => {
  const detail = source(quoteDetailPath);
  const adminTypes = source(quoteAdminTypesPath);
  const quoteServer = source(quoteServerPath);
  const draftRoute = source(adminDraftRoutePath);
  const offerSection = sliceBetween(
    detail,
    'data-testid="quote-offer-card"',
    'data-testid="quote-items-card"'
  );
  const explanation = sliceBetween(
    detail,
    'function QuoteShippingExplanationDialog',
    'const toNewDraftState'
  );
  const resetAction = sliceBetween(
    detail,
    'const resetQuoteShippingToAutomatic',
    'const toggleOfferEdit'
  );

  assert.match(adminTypes, /shippingSnapshot: Record<string, unknown> \| null/u);
  assert.match(quoteServer, /shippingSnapshot: toRecord\(row\.shipping_snapshot_json\)/u);
  assert.match(detail, /normalizeQuoteShippingSnapshot\([\s\S]*?currentVersion\?\.shippingSnapshot/u);
  assert.match(detail, /automaticShippingCents !== displayedShippingCents/u);
  assert.match(offerSection, /data-testid="quote-shipping-info-button"/u);
  assert.match(offerSection, /aria-label="Prikaži izračun poštnine"/u);
  assert.match(offerSection, /data-testid="quote-shipping-reset-button"/u);
  assert.match(offerSection, /aria-label="Uporabi samodejno poštnino"/u);
  assert.match(explanation, /basePriceCents/u);
  assert.match(explanation, /surchargeAmountCents/u);
  assert.match(explanation, /multiPieceDiscountAmountCents/u);
  assert.match(explanation, /orderValueDiscountAmountCents/u);
  assert.match(explanation, /Samodejni znesek/u);
  assert.match(explanation, /Masa:/u);
  assert.match(resetAction, /shipping: automaticShipping/u);
  assert.match(resetAction, /confirmFreeShipping: true/u);
  assert.match(resetAction, /setIsEditingOffer\(true\)/u);
  assert.match(resetAction, /Shrani osnutek za potrditev/u);
  assert.match(draftRoute, /JSON\.stringify\(quoteRequest\.shipping_snapshot_json\)/u);
});
test('quote reason uses the exact Slovenian storefront selection and terms identifiers stay internal', () => {
  const detail = source(quoteDetailPath);
  const quoteTypes = source(quoteTypesPath);
  const commercialContracts = source(commercialQuoteContractsPath);
  const requestSection = sliceBetween(
    detail,
    'data-testid="quote-request-details-card"',
    'data-testid="quote-offer-card"'
  );
  const offerSection = sliceBetween(
    detail,
    'data-testid="quote-offer-card"',
    'data-testid="quote-items-card"'
  );

  for (const label of [
    'Formalno ponudbo za izbrane artikle',
    'Potrditev zaloge ali dobavnega roka',
    'Količinski popust ali prilagojeno količino',
    'Drugo'
  ]) {
    assert.match(quoteTypes, new RegExp(label, 'u'));
  }
  assert.match(commercialContracts, /QUOTE_REQUEST_REASON_OPTIONS = SHARED_QUOTE_REASON_OPTIONS/u);
  assert.match(detail, /import \{[\s\S]*?DEFAULT_QUOTE_DELIVERY_TERMS[\s\S]*?getQuoteReasonLabel,[\s\S]*?QUOTE_REASON_OPTIONS[\s\S]*?\} from '@\/shared\/domain\/quote\/quoteTypes';/u);
  assert.match(requestSection, /label="Kaj potrebuje\?"/u);
  assert.match(requestSection, /getQuoteReasonLabel\(activeRequestDetails\.quoteReason\)/u);
  assert.match(offerSection, /label="Pogoji sprejema"/u);
  assert.doesNotMatch(offerSection, /Različica pogojev|atehna-quote-terms-v1/u);
});
test('customer details use compact fixed-height rows with full-width address and message fields', () => {
  const detail = source(quoteDetailPath);
  const requestSection = sliceBetween(
    detail,
    'data-testid="quote-request-details-card"',
    'data-testid="quote-offer-card"'
  );
  const detailRow = sliceBetween(
    detail,
    'function QuoteDetailRow',
    'function StateBadge'
  );
  const labels = [
    'Tip naročnika',
    'Email',
    'Naziv organizacije',
    'Referenca',
    'Kontaktna oseba',
    'Kaj potrebuje?',
    'Naslov',
    'Sporočilo stranke'
  ] as const;

  assert.equal(requestSection.match(/<dl\b/gu)?.length ?? 0, 1);
  assert.equal(requestSection.match(/<QuoteDetailRow\b/gu)?.length ?? 0, labels.length);
  assert.match(requestSection, /<dl className="mt-2 grid min-w-0 gap-x-8 md:grid-cols-2">/u);
  assert.match(detailRow, /className=\{`grid h-\[35px\]/u);
  assert.match(detailRow, /items-center gap-3/u);
  assert.doesNotMatch(
    detailRow,
    /border-b border-slate-200|last:border-b-0/u
  );
  assert.match(detailRow, /grid-cols-\[minmax\(120px,0\.42fr\)_minmax\(0,1fr\)\]/u);
  assert.match(detailRow, /grid-cols-\[120px_minmax\(0,1fr\)\] md:col-span-2/u);
  assert.match(
    detailRow,
    /<dt className="flex min-w-0 items-center gap-1\.5[^"]*">[\s\S]*?<QuoteDetailFieldIcon icon=\{icon\} \/>[\s\S]*?\{label\}/u
  );
  assert.match(detailRow, /<QuoteDetailFieldShell isEditing=\{false\}>/u);
  assert.doesNotMatch(requestSection, /<QuoteDetailFieldShell icon=/u);
  assert.match(detailRow, /data-quote-detail-row=\{label\}/u);
  assert.match(detailRow, /data-quote-detail-span=\{fullWidth \? 'full' : undefined\}/u);
  assert.equal(requestSection.match(/\bfullWidth\b/gu)?.length ?? 0, 2);
  assert.match(requestSection, /label="Naslov"[\s\S]*?formatQuoteRequestAddress\(activeRequestDetails\)[\s\S]*?fullWidth/u);
  assert.match(requestSection, /label="Sporočilo stranke"[\s\S]*?fullWidth/u);

  const addressEditor = sliceBetween(
    detail,
    'function QuoteAddressEditor',
    'function QuoteDetailRow'
  );
  assert.match(addressEditor, /role="group"/u);
  assert.match(addressEditor, /aria-label="Naslovni podatki"/u);
  assert.match(addressEditor, /data-testid="quote-request-address-fields"/u);
  assert.match(addressEditor, /grid-cols-\[minmax\(0,1\.5fr\)_minmax\(0,1fr\)_3\.5rem_minmax\(0,1fr\)_2\.25rem\]/u);
  for (const label of ['Naslov', 'Dodatni naslov', 'Poštna številka', 'Kraj', 'Država']) {
    assert.match(addressEditor, new RegExp(`aria-label="${label}"`, 'u'));
  }

  for (const label of labels) {
    assert.match(requestSection, new RegExp(`label="${label.replace('?', '[?]')}"`, 'u'));
  }
  for (const oldRowLabel of ['Poštna številka', 'Dodatni naslov', 'Kraj', 'Država']) {
    assert.doesNotMatch(
      requestSection,
      new RegExp(`<QuoteDetailRow label="${oldRowLabel}"`, 'u')
    );
  }
});

test('quote PDF preview stays in an accessible in-page dialog and cleans up resources', () => {
  const detail = source(quoteDetailPath);
  const previewDialog = source(pdfPreviewDialogPath);
  const previewSource = sliceBetween(detail, 'const createPreview', 'const requestClarification');

  assert.match(previewSource, /draftHasUnsavedChanges/u);
  assert.match(previewSource, /new AbortController\(\)/u);
  assert.match(previewSource, /replacePreviewUrl\(URL\.createObjectURL\(pdfBlob\)\)/u);
  assert.doesNotMatch(previewSource, /window\.open/u);
  assert.match(detail, /URL\.revokeObjectURL/u);
  assert.match(detail, /<PdfPreviewDialog[\s\S]*?title="Predogled ponudbe"/u);
  assert.match(previewDialog, /role="dialog"/u);
  assert.match(previewDialog, /aria-modal="true"/u);
  assert.match(previewDialog, /data-testid="quote-offer-preview-frame"/u);
  assert.match(previewDialog, /<iframe/u);
  assert.match(previewDialog, /event\.key === 'Escape'/u);
  assert.match(previewDialog, /document\.body\.style\.overflow = 'hidden'/u);
});

test('customer detail edits preserve identity and Slovenian address data when supplied', () => {
  const route = source(adminDetailsRoutePath);

  assert.match(route, /customerType !== 'individual' && !organizationName/u);
  assert.doesNotMatch(route, /!addressLine1 \|\| !city/u);
  assert.match(route, /const POSTAL_CODE_PATTERN = \/\^\\d\{4\}\$\//u);
  assert.match(route, /postalCode !== null && !POSTAL_CODE_PATTERN\.test\(postalCode\)/u);
  assert.match(route, /countryCode !== 'SI'/u);
  assert.match(
    route,
    /const gursHouseNumberId = addressChanged[\s\S]*?before\.gurs_house_number_id[\s\S]*?const customerSnapshot = \{[\s\S]*?gursHouseNumberId,/u
  );
  assert.doesNotMatch(route, /gursHouseNumberId:\s*null/u);
});

test('quote detail composes shared title, activity, notes, documents, field, action, and grid primitives', () => {
  const quoteDetail = source(quoteDetailPath);
  const orderDetail = source(orderDetailPath);
  const sharedPrimitives = [
    'AdminDetailTitleSlot',
    'adminWindowCardClassName',
    'adminWindowCardStyle',
    'adminCompactIconFieldShellClassName',
    'adminCompactIconFieldInputClassName',
    'adminCardSectionEditIconButtonClassName',
    'adminTableNeutralIconButtonClassName'
  ] as const;

  for (const primitive of sharedPrimitives) {
    assert.match(orderDetail, new RegExp(`\\b${primitive}\\b`, 'u'));
    assert.match(quoteDetail, new RegExp(`\\b${primitive}\\b`, 'u'));
  }

  for (const detail of [orderDetail, quoteDetail]) {
    assert.match(detail, /import \{ Button \} from '@\/shared\/ui\/button';/u);
    assert.match(detail, /<Button\b/u);
    assert.match(
      detail,
      /lg:grid-cols-\[minmax\(0,1\.23fr\)_minmax\(340px,0\.77fr\)\]/u
    );
  }

  const requestSection = sliceBetween(
    quoteDetail,
    'data-testid="quote-request-details-card"',
    'data-testid="quote-offer-card"'
  );
  const detailRow = sliceBetween(
    quoteDetail,
    'function QuoteDetailRow',
    'function StateBadge'
  );
  const detailFieldShell = sliceBetween(
    quoteDetail,
    'function QuoteDetailFieldShell',
    'function QuoteDetailRow'
  );

  assert.match(quoteDetail, /<AdminDetailTitleSlot[\s\S]*?width="wide"/u);
  assert.doesNotMatch(quoteDetail, /quoteHeaderTitleSlotClassName/u);
  assert.match(detailTitleSlot, /wide: 'sm:w-\[390px\]'/u);
  assert.match(detailTitleSlot, /data-testid=\{testId\}/u);
  assert.match(detailTitleSlot, /<span className="truncate leading-tight">\{title\}<\/span>/u);

  assert.match(
    quoteDetail,
    /import AdminQuoteActivityTimeline from '@\/admin\/features\/quotes\/components\/AdminQuoteActivityTimeline';/u
  );
  assert.match(
    quoteDetail,
    /<AdminQuoteActivityTimeline events=\{detail\.events\} \/>/u
  );
  assert.match(quoteActivityTimeline, /<AdminActivityTimeline/u);
  assert.match(quoteActivityTimeline, /testId="quote-activity-timeline"/u);

  assert.match(quoteDetail, /<AdminNotesCard/u);
  assert.match(quoteDetail, /testId="quote-admin-notes-card"/u);
  assert.match(quoteDetail, /editActionId="quote-admin-notes"/u);
  assert.match(adminNotesCard, /data-testid=\{testId\}/u);
  assert.match(adminNotesCard, /data-admin-card-edit-action=\{editActionId\}/u);

  assert.match(quoteDetail, /<AdminQuoteDocumentsManager/u);
  assert.match(quoteDocumentsManager, /from '@\/shared\/ui\/admin-detail'/u);
  assert.match(quoteDocumentsManager, /<AdminDetailDocumentsCard/u);
  assert.match(quoteDocumentsManager, /<AdminDetailDocumentTypeRow/u);
  assert.match(adminDetailDocuments, /data-testid=\{testId\}/u);
  assert.match(
    adminDetailDocuments,
    /<h2 className="text-base font-semibold text-slate-900">PDF dokumenti<\/h2>/u
  );

  assert.match(
    quoteDetail,
    /adminWindowCardClassName \+ ' p-4'[^]*?data-testid="quote-request-details-card"/u
  );
  assert.match(requestSection, /<h2 className="text-base/u);
  assert.match(requestSection, /adminCardSectionEditIconButtonClassName/u);
  assert.match(detailRow, /h-\[35px\]/u);
  assert.match(detailFieldShell, /isEditing \? '' : detailFieldLockedShellClassName/u);
  assert.match(detailRow, /quoteDetailReadValueClassName/u);
  assert.match(detailRow, /\{isEditing \? children : \(/u);
  assert.doesNotMatch(requestSection, /disabled=\{!isEditingRequestDetails/u);
  assert.doesNotMatch(requestSection, /readOnly=\{!isEditingRequestDetails/u);
});

test('quote activity stays in the header through the shared bounded horizontal timeline', () => {
  const quoteDetail = source(quoteDetailPath);
  const header = sliceBetween(
    quoteDetail,
    'data-testid="quote-detail-header"',
    '<div className="grid items-start gap-5'
  );
  const sidebar = sliceBetween(
    quoteDetail,
    '<aside className="flex w-full min-w-0 flex-col gap-5">',
    '<PdfPreviewDialog'
  );

  assert.equal(quoteDetail.match(/<AdminQuoteActivityTimeline/g)?.length, 1);
  assert.match(
    header,
    /<AdminQuoteActivityTimeline events=\{detail\.events\} \/>/u
  );
  assert.match(
    header,
    /mt-3 grid min-w-0 gap-4 lg:grid-cols-\[max-content_minmax\(0,1fr\)\] lg:items-end/u
  );

  assert.match(
    quoteActivityTimeline,
    /const items = \[\.\.\.events\]\.slice\(0, 5\)\.reverse\(\)\.map/u
  );
  assert.match(
    quoteActivityTimeline,
    /COMPACT_EVENT_LABELS\[event\.eventType\] \?\? label/u
  );
  assert.match(quoteActivityTimeline, /draft_created: 'Osnutek'/u);
  assert.match(quoteActivityTimeline, /draft_changed: 'Osnutek'/u);
  assert.match(quoteActivityTimeline, /offer_draft_created: 'Osnutek'/u);
  assert.match(quoteActivityTimeline, /offer_draft_changed: 'Osnutek'/u);
  assert.match(quoteActivityTimeline, /quote_email_provider_failed: 'E-pošta'/u);
  assert.match(quoteActivityTimeline, /new_version_issued: 'Različica'/u);
  assert.match(quoteActivityTimeline, /request_voided: 'Razveljavljeno'/u);
  assert.match(quoteActivityTimeline, /<AdminActivityTimeline/u);
  assert.match(quoteActivityTimeline, /testId="quote-activity-timeline"/u);
  assert.match(quoteActivityTimeline, /items=\{items\}/u);

  assert.match(adminActivityTimeline, /data-testid=\{testId\}/u);
  assert.match(adminActivityTimeline, /aria-live="polite"/u);
  assert.match(
    adminActivityTimeline,
    /className="-mx-1 overflow-x-auto px-1 pb-1"/u
  );
  assert.match(
    adminActivityTimeline,
    /className="flex min-w-max lg:min-w-full"/u
  );
  assert.match(
    adminActivityTimeline,
    /className="min-w-\[112px\] flex-1 text-center"/u
  );
  assert.match(adminActivityTimeline, /data-activity-compact-label/u);
  assert.match(adminActivityTimeline, /title=\{item\.fullLabel\}/u);
  assert.match(adminActivityTimeline, /aria-label=\{item\.fullLabel\}/u);
  assert.doesNotMatch(
    sidebar,
    /AdminQuoteActivityTimeline|Avtoritativna časovnica/u
  );
});

test('every writable quote window keeps one persistent blue icon-only pencil in its top-right header', () => {
  const detail = source(quoteDetailPath);
  const requestSection = sliceBetween(
    detail,
    'data-testid="quote-request-details-card"',
    'data-testid="quote-offer-card"'
  );
  const offerSection = sliceBetween(
    detail,
    'data-testid="quote-offer-card"',
    'data-testid="quote-items-card"'
  );
  const featureEditActions = new Set(
    [...detail.matchAll(/data-admin-card-edit-action="([^"]+)"/gu)].map(
      (match) => match[1]
    )
  );
  const notesIndex = detail.indexOf('<AdminNotesCard');
  const documentsIndex = detail.indexOf('<AdminQuoteDocumentsManager');

  assert.deepEqual(
    featureEditActions,
    new Set(['quote-request-details', 'quote-offer'])
  );
  assert.match(detail, /<AdminNotesCard/u);
  assert.match(detail, /testId="quote-admin-notes-card"/u);
  assert.match(detail, /editActionId="quote-admin-notes"/u);
  assert.match(adminNotesCard, /data-admin-card-edit-action=\{editActionId\}/u);
  assert.ok(notesIndex >= 0 && documentsIndex > notesIndex);

  for (const section of [requestSection, offerSection]) {
    assert.match(section, /justify-between/u);
    assert.match(section, /adminCardSectionEditIconButtonClassName/u);
    assert.match(section, /aria-pressed=/u);
    assert.match(section, /<PencilIcon className="h-4 w-4" \/>/u);
    assert.doesNotMatch(section, /<span>Uredi/u);
  }

  assert.match(adminNotesCard, /justify-between/u);
  assert.match(adminNotesCard, /adminCardSectionEditIconButtonClassName/u);
  assert.match(adminNotesCard, /aria-pressed=\{isEditing\}/u);
  assert.match(adminNotesCard, /<PencilIcon className="h-4 w-4" \/>/u);
  assert.doesNotMatch(adminNotesCard, /<span>Uredi/u);
  assert.match(
    adminNotesCard,
    /aria-label=\{isEditing \? 'Končaj urejanje opombe' : 'Uredi interno opombo'\}/u
  );
  assert.match(adminNotesCard, /\{isEditing \? \(/u);
  assert.match(adminNotesCard, /\) : persistedValue\.trim\(\) \? \(/u);

  assert.match(
    requestSection,
    /aria-label=\{isEditingRequestDetails \? 'Končaj urejanje povpraševanja' : 'Uredi podatke povpraševanja'\}/u
  );
  assert.match(requestSection, /aria-disabled=\{!canEditRequestDetails\}/u);
  assert.match(
    requestSection,
    /disabled=\{!isClientReady \|\| Boolean\(busyAction\)\}/u
  );
  assert.match(detail, /if \(!canEditRequestDetails\)[\s\S]*?toast\.error/u);
  assert.match(
    offerSection,
    /aria-label=\{isEditingOffer \? 'Končaj urejanje ponudbe' : 'Uredi ponudbo'\}/u
  );
  assert.match(detail, /isEditing=\{isEditingAdminNotes\}/u);
  assert.match(detail, /value=\{activeAdminNotes\}/u);
  assert.match(detail, /persistedValue=\{persistedAdminNotes\}/u);
  assert.match(detail, /onToggle=\{toggleAdminNotesEdit\}/u);
  assert.match(
    detail,
    /autoFocus=\{isEditingAdminNotes && !isMasterEditing\}/u
  );
  assert.match(
    detail,
    /className=\{adminTableEditIconButtonClassName\}[\s\S]*?data-testid="quote-header-status-edit"/u
  );
  assert.match(
    detail,
    /const \[isEditingOffer, setIsEditingOffer\] = useState\(canCreateDraft\)/u
  );
  assert.match(
    detail,
    /enterOfferEditAfterRevisionRef\.current = true[\s\S]*?callAction\('revise'\)/u
  );
  assert.match(detail, /displayedOfferDetails \? \(/u);
  assert.match(
    detail,
    /draftItems=\{isEditingOffer \? draft\?\.items \?\? null : null\}/u
  );
  assert.doesNotMatch(offerSection, />Ustvari novo različico<\/Button>/u);
});

test('quote administrator notes hydrate and persist independently across every non-void lifecycle state', () => {
  const detail = source(quoteDetailPath);
  const quoteTypes = source(quoteAdminTypesPath);
  const quoteServer = source(quoteServerPath);
  const route = source(adminNotesRoutePath);
  const appRoute = source(appNotesRoutePath);
  const saveNotesSource = sliceBetween(
    detail,
    'const saveAdminNotes',
    'const persistDraft'
  );

  assert.match(quoteTypes, /adminNotes: string;/u);
  assert.match(quoteServer, /adminNotes: toText\(request\.admin_notes\)/u);
  assert.match(detail, /const \[persistedAdminNotes, setPersistedAdminNotes\] = useState\(detail\.adminNotes\)/u);
  assert.match(detail, /const \[draftAdminNotes, setDraftAdminNotes\] = useState\(detail\.adminNotes\)/u);
  assert.match(detail, /const adminNotesDirty = draftAdminNotes !== persistedAdminNotes/u);
  assert.match(detail, /isEditingAdminNotes && adminNotesDirty/u);
  assert.match(saveNotesSource, /fetch\(`\/api\/admin\/quote-requests\/\$\{detail\.id\}\/notes`/u);
  assert.match(saveNotesSource, /method: 'PUT'/u);
  assert.match(saveNotesSource, /expectedRequestStateVersion/u);
  assert.match(saveNotesSource, /adminNotes: draftAdminNotes/u);
  assert.match(detail, /let nextRequestStateVersion = requestStateVersion/u);
  assert.match(detail, /saveRequestDetails\([\s\S]*?nextRequestStateVersion[\s\S]*?saveAdminNotes\(nextRequestStateVersion\)/u);

  assert.match(appRoute, /export \{ PUT \} from '@\/admin\/api\/quote-requests\/\[quoteRequestId\]\/notes\/route';/u);
  assert.match(route, /isQuoteAdminEnabled\(\)/u);
  assert.match(route, /hasValidQuoteAdminSession\(request\)/u);
  assert.match(route, /boundedText\(parsed\.body\.adminNotes, 8_000\) \|\| null/u);
  assert.match(route, /lockQuoteWorkflow\(client, quoteRequestId\)/u);
  assert.match(route, /from quote_requests[\s\S]*?for update/u);
  assert.match(route, /QUOTE_REQUEST_VOIDED/u);
  assert.match(route, /QUOTE_REQUEST_STALE/u);
  assert.match(route, /set admin_notes = \$2,[\s\S]*?state_version = state_version \+ 1/u);
  assert.match(route, /eventType: 'quote_request_details_changed'/u);
  assert.match(route, /changedFields: \['adminNotes'\]/u);
  assert.match(route, /action: 'updated'/u);
  assert.doesNotMatch(route, /isManuallyEditableQuoteRequestStatus|QUOTE_CUSTOMER_SNAPSHOT_LOCKED|status <> 'draft'|update quote_offer_versions/u);
  assert.doesNotMatch(route, /reason: adminNotes|metadata: \{\s*adminNotes[,}]/u);
});

test('Ponudba keeps compact controls inside one fixed read/edit geometry', () => {
  const detail = source(quoteDetailPath);
  const fieldPrimitive = sliceBetween(
    detail,
    'function QuoteOfferFieldRow',
    'function QuoteDetailFieldShell'
  );
  const offerSection = sliceBetween(
    detail,
    'data-testid="quote-offer-card"',
    'data-testid="quote-items-card"'
  );
  const fieldKeys = [
    'validUntil',
    'shipping',
    'customerMessage',
    'deliveryTerms',
    'paymentTerms',
    'acceptanceTerms'
  ] as const;

  assert.doesNotMatch(offerSection, /rows=\{[3-5]\}/u);
  assert.doesNotMatch(offerSection, /className="[^"]*\bh-10\b/u);
  assert.match(offerSection, /data-testid="quote-offer-details"/u);
  assert.match(offerSection, /<dl className="h-\[210px\] min-w-0">/u);
  assert.match(offerSection, /data-testid="quote-offer-action-bar"/u);
  assert.match(offerSection, /className="grid min-h-\[52px\]/u);
  assert.equal(offerSection.match(/<QuoteOfferFieldRow\b/gu)?.length ?? 0, fieldKeys.length);
  for (const key of fieldKeys) {
    assert.match(offerSection, new RegExp(`field="${key}"`, 'u'));
  }
  assert.match(fieldPrimitive, /className="grid h-\[35px\]/u);
  assert.doesNotMatch(fieldPrimitive, /border-[bt] border-slate/u);
  assert.match(
    offerSection,
    />DDV<\/dt>[\s\S]*?border-t border-slate-300[\s\S]*?>Skupaj z DDV<\/dt>/u
  );
  assert.match(fieldPrimitive, /data-quote-offer-field=\{field\}/u);
  assert.match(fieldPrimitive, /\{isEditing \? children : \(/u);
  assert.doesNotMatch(offerSection, /\{draft && isEditingOffer \? \(/u);
  assert.doesNotMatch(offerSection, /<table\b/u);
});
test('quote offer and requested/offered items share one window after request details', () => {
  const detail = source(quoteDetailPath);
  const requestIndex = detail.indexOf('data-testid="quote-request-details-card"');
  const offerIndex = detail.indexOf('data-testid="quote-offer-card"');
  const itemsIndex = detail.indexOf('data-testid="quote-items-card"');

  assert.ok(requestIndex >= 0);
  assert.ok(offerIndex > requestIndex);
  assert.ok(itemsIndex > offerIndex);
  assert.match(
    detail,
    /<section[^>]*data-testid="quote-offer-card"[^>]*>[\s\S]*?<section className="border-t border-slate-200 pb-4" data-testid="quote-items-card"/u
  );
  assert.doesNotMatch(
    detail,
    /<section[^>]*adminWindowCardClassName[^>]*data-testid="quote-items-card"/u
  );
  assert.doesNotMatch(detail, /<h2[^>]*>Zgodovina različic<\/h2>/u);
});

test('requested and offered items keep a compact stock notice in the header and bottom card inset', () => {
  const detail = source(quoteDetailPath);
  const itemsSection = sliceBetween(
    detail,
    'data-testid="quote-items-card"',
    '<QuoteCatalogItemPickerDialog'
  );

  assert.match(
    detail,
    /<section className="border-t border-slate-200 pb-4" data-testid="quote-items-card"/u
  );
  assert.match(itemsSection, /data-testid="quote-items-stock-notice"/u);
  assert.match(itemsSection, /<Info aria-hidden="true" className="h-3 w-3 shrink-0" \/>/u);
  assert.match(itemsSection, />Zaloga ni rezervirana\.<\/span>/u);
  assert.match(
    itemsSection,
    /title="Povpraševanje ni naročilo\. Zaloga za te postavke ni rezervirana\."/u
  );
  assert.doesNotMatch(itemsSection, /bg-amber-50\/60 px-4 py-2\.5/u);
});
test('requested and offered items share one paired table with selectable offered rows', () => {
  const detail = source(quoteDetailPath);
  const comparisonTable = sliceBetween(
    detail,
    'function QuoteItemsComparisonTable',
    'export default function AdminQuoteDetailClient'
  );
  const tableCount = detail.match(/<table\b/gu)?.length ?? 0;
  assert.equal(tableCount, 1);
  assert.match(comparisonTable, /data-testid="quote-items-comparison-table"/u);
  assert.match(comparisonTable, /requestedByLineNumber[\s\S]*?item\.lineNumber/u);
  assert.match(comparisonTable, /offeredByLineNumber[\s\S]*?item\.lineNumber/u);
  assert.match(
    comparisonTable,
    /new Set\(\[\.\.\.requestedByLineNumber\.keys\(\), \.\.\.offeredByLineNumber\.keys\(\)\]\)/u
  );
  assert.match(comparisonTable, /\{lineNumbers\.map\(\(lineNumber\) => \{/u);
  assert.match(comparisonTable, /requestedByLineNumber\.get\(lineNumber\)/u);
  assert.match(comparisonTable, /offeredByLineNumber\.get\(lineNumber\)/u);
  assert.match(comparisonTable, /data-item-row="requested-empty"/u);
  assert.match(comparisonTable, /data-item-row="requested"[\s\S]*?data-item-row="offered"/u);
  assert.match(comparisonTable, /<col style=\{\{ width: '44px' \}\} \/>/u);
  assert.match(comparisonTable, /aria-label="Izberi vse postavke ponudbe"/u);
  assert.match(comparisonTable, /aria-label=\{'Izberi ponujeno postavko ' \+ rowLabel\}/u);
  assert.equal(
    comparisonTable.match(/className="flex items-center justify-center leading-none"/gu)?.length,
    3
  );
  assert.match(comparisonTable, /disabled=\{!editable \|\| !draftItem \|\| disabled\}/u);
  assert.match(comparisonTable, /SKU: \{requestedItem\.sku \|\| '—'\}/u);
  assert.equal(
    comparisonTable.match(
      /data-item-sku className="mt-0\.5 block text-\[10px\] font-normal text-slate-500"/gu
    )?.length ?? 0,
    2
  );
  assert.doesNotMatch(comparisonTable, /<th[^>]*>SKU<\/th>/u);
  assert.doesNotMatch(detail, />Postavka</u);
  assert.match(comparisonTable, /type="number"[\s\S]*?min="1"[\s\S]*?step="1"/u);
  assert.equal(comparisonTable.match(/data-item-field="unit-net"/gu)?.length ?? 0, 3);
  assert.equal(comparisonTable.match(/data-item-field="discount"/gu)?.length ?? 0, 3);
  assert.match(
    detail,
    /const quoteItemUnitNetSlotClassName =\s*'[^']*flex h-8[^']*items-center justify-center[^']*text-center/u
  );
  assert.match(
    detail,
    /const quoteItemQuantitySlotClassName =\s*'[^']*flex h-8[^']*items-center justify-center[^']*text-center/u
  );
  assert.match(
    detail,
    /const quoteItemDiscountSlotClassName = quoteItemQuantitySlotClassName/u
  );
  assert.match(
    comparisonTable,
    /data-item-field="unit-net"[\s\S]*?className=\{compactInputClassName \+ ' mx-auto max-w-28 text-center tabular-nums'\}/u
  );
  assert.match(
    comparisonTable,
    /data-item-field="discount"[\s\S]*?className=\{compactInputClassName \+ ' mx-auto max-w-24 text-center tabular-nums'\}/u
  );
  assert.match(
    comparisonTable,
    /discountFromUnitNet\([\s\S]*?draftItem\.baseUnitNet,[\s\S]*?unitNet/u
  );
  assert.match(
    comparisonTable,
    /unitNetFromDiscount\([\s\S]*?draftItem\.baseUnitNet,[\s\S]*?discountPct/u
  );
  assert.match(comparisonTable, /\{draftItem \|\| snapshotItem \? \(/u);
  assert.match(
    comparisonTable,
    /className="h-\[76px\] bg-white hover:bg-\[color:var\(--hover-neutral\)\]"[\s\S]*?data-item-row="offered"/u
  );
  assert.match(
    comparisonTable,
    /<tr className="h-\[76px\] bg-white" data-item-row="offered-empty"/u
  );
  assert.doesNotMatch(comparisonTable, /adminTableRowHeightClassName/u);
});

test('quote draft items use catalog selection plus full-snapshot add and remove controls', () => {
  const detail = source(quoteDetailPath);
  const draftRoute = source(adminDraftRoutePath);
  const comparisonTable = sliceBetween(
    detail,
    'function QuoteItemsComparisonTable',
    'export default function AdminQuoteDetailClient'
  );

  assert.match(
    detail,
    /if \(!isEditingOffer \|\| catalogLoadState !== 'idle'\) return;[\s\S]*?fetch\('\/api\/admin\/catalog-items'\)/u
  );
  assert.match(detail, /type DraftItem = Pick<[\s\S]*?'lineNumber'[\s\S]*?>;/u);
  assert.equal(comparisonTable.match(/<CustomSelect\b/gu)?.length ?? 0, 1);
  assert.match(comparisonTable, /options=\{catalogOptions\}/u);
  assert.match(comparisonTable, /ariaLabel=\{'Ponujeni artikel ' \+ rowLabel\}/u);
  assert.match(comparisonTable, /catalogItemId: choice\.catalogItemId/u);
  assert.match(comparisonTable, /catalogVariantId: choice\.catalogVariantId/u);
  assert.match(comparisonTable, /productName: choice\.productName/u);
  assert.match(comparisonTable, /variantName: choice\.variantName/u);
  assert.match(comparisonTable, /sku: choice\.sku/u);
  assert.match(comparisonTable, /baseUnitNet: choice\.unitPrice/u);
  assert.doesNotMatch(comparisonTable, /aria-label=[^\n]*Naziv artikla/u);
  assert.doesNotMatch(comparisonTable, /aria-label=[^\n]*Naziv različice/u);
  assert.doesNotMatch(comparisonTable, /onUpdateDraftItem\(draftItem\.id, \{ productName:/u);
  assert.doesNotMatch(comparisonTable, /onUpdateDraftItem\(draftItem\.id, \{ variantName:/u);

  assert.match(detail, /aria-label="Dodaj postavko ponudbe"/u);
  assert.match(detail, /aria-label="Odstrani izbrane postavke ponudbe"/u);
  assert.match(detail, /function QuoteCatalogItemPickerDialog/u);
  assert.match(detail, /aria-label="Išči artikel za ponudbo"/u);
  assert.match(detail, /const \[selectedDraftItemIds, setSelectedDraftItemIds\]/u);
  assert.match(detail, /const toggleSelectedDraftItem/u);
  assert.match(detail, /const toggleAllDraftItems/u);
  assert.match(
    detail,
    /const deleteSelectedDraftItems[\s\S]*?current\.items\.filter\(\(item\) => !selectedSet\.has\(item\.id\)\)/u
  );
  assert.match(
    detail,
    /const addCatalogItemToDraft[\s\S]*?const nextId = Math\.min\(0,[\s\S]*?- 1/u
  );
  assert.match(
    detail,
    /const nextLineNumber =[\s\S]*?detail\.requestedItems[\s\S]*?current\.items[\s\S]*?\+ 1/u
  );
  assert.match(
    detail,
    /items: \[[\s\S]*?\.\.\.current\.items,[\s\S]*?catalogItemId: choice\.catalogItemId[\s\S]*?catalogVariantId: choice\.catalogVariantId/u
  );
  assert.match(
    detail,
    /draft\.items\.length === 0[\s\S]*?Ponudba mora vsebovati vsaj eno postavko/u
  );

  assert.match(
    draftRoute,
    /const requestedByLineNumber = new Map\([\s\S]*?requestedItems\.map/u
  );
  assert.match(
    draftRoute,
    /const knownLineNumbers = new Set\(\[[\s\S]*?byLineNumber\.keys\(\)[\s\S]*?requestedByLineNumber\.keys\(\)/u
  );
  assert.match(draftRoute, /if \(value\.length > 100\)/u);
  assert.doesNotMatch(draftRoute, /value\.length !== source\.length/u);
  assert.match(
    draftRoute,
    /const lineNumber = isKnownLine \? submittedLineNumber : nextLineNumber\+\+/u
  );
  assert.match(draftRoute, /for \(const entry of value\)/u);
  assert.match(draftRoute, /loadAuthoritativeManualQuoteCatalogSnapshot/u);
  assert.match(draftRoute, /catalogItemId: catalogItem\.productId/u);
  assert.match(draftRoute, /catalogVariantId: catalogItem\.variantId/u);
  assert.match(draftRoute, /productName: catalogItem\.productName/u);
  assert.match(draftRoute, /variantName: catalogItem\.variantName/u);
  assert.match(draftRoute, /sku: catalogItem\.sku/u);
  assert.match(draftRoute, /source: 'admin_catalog_selection'/u);
  assert.doesNotMatch(draftRoute, /text\(edit\.productName/u);
  assert.doesNotMatch(draftRoute, /text\(edit\.variantName/u);
  assert.match(
    draftRoute,
    /const requestedItems = await readRequestItems[\s\S]*?readOfferItems[\s\S]*?requestedItems,[\s\S]*?parsed\.body\.items/u
  );
  assert.match(draftRoute, /where quote_request_id = \$1[\s\S]*status = 'draft'/u);
});
test('database guard permits customer edits only before issue and preserves issued snapshots', () => {
  assert.equal(existsSync(resolve(process.cwd(), detailsMigrationPath)), true);
  const schema = source(schemaPath);
  const migration = source(detailsMigrationPath);

  for (const sql of [schema, migration]) {
    assert.match(sql, /admin_details_changed/u);
    assert.match(sql, /old\.status not in \('received', 'in_preparation'\)/u);
    assert.match(sql, /offer\.status = 'issued'/u);
    assert.match(sql, /offer\.is_current = true/u);
    assert.match(sql, /Customer details on a current issued offer are immutable\./u);
  }
});

test('blank quote terms hydrate canonical defaults and stay dirty until persisted', () => {
  const detail = source(quoteDetailPath);
  const quoteTypes = source(quoteTypesPath);

  assert.match(
    quoteTypes,
    /DEFAULT_QUOTE_DELIVERY_TERMS[\s\S]*?'Dobava v roku dveh tednov\.'/u
  );
  assert.match(
    quoteTypes,
    /DEFAULT_QUOTE_PAYMENT_TERMS[\s\S]*?'Plačilo v 30 dneh po izstavitvi računa\.'/u
  );
  assert.match(detail, /populateDefaultTerms && !version\.deliveryTerms\.trim\(\)[\s\S]*?DEFAULT_QUOTE_DELIVERY_TERMS[\s\S]*?: version\.deliveryTerms/u);
  assert.match(detail, /populateDefaultTerms && !version\.paymentTerms\.trim\(\)[\s\S]*?DEFAULT_QUOTE_PAYMENT_TERMS[\s\S]*?: version\.paymentTerms/u);
  assert.match(detail, /const toPersistedDraftState[\s\S]*?populateDefaultTerms: false/u);
  assert.equal(
    detail.match(/\? toPersistedDraftState\(editableVersion\)/gu)?.length,
    2
  );
  assert.match(
    detail,
    /useState<string \| null>\(\(\) =>[\s\S]*?editableVersion[\s\S]*?: canCreateDraft[\s\S]*?\? toNewDraftState\(detail\)[\s\S]*?: null/u
  );
  assert.match(
    detail,
    /setSavedDraftFingerprint\([\s\S]*?editableVersion[\s\S]*?: canCreateDraft[\s\S]*?\? nextDraft[\s\S]*?: null/u
  );
  assert.match(detail, /deliveryTerms: DEFAULT_QUOTE_DELIVERY_TERMS[\s\S]*?paymentTerms: DEFAULT_QUOTE_PAYMENT_TERMS/u);
  assert.match(detail, /action === 'issue' && draft && draftHasUnsavedChanges[\s\S]*?await persistDraft\(draft\)/u);
});
