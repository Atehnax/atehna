import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { conciseActivitySummary } from '../../src/admin/features/orders/components/AdminOrderActivityCard';
import { ORDER_PDF_TYPE_CONFIGS } from '../../src/shared/domain/order/orderTypes';

const detail = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/orders/components/AdminOrderDetailClient.tsx'
  ),
  'utf8'
);

const detailTitleSlot = readFileSync(
  resolve(process.cwd(), 'src/shared/ui/admin-detail/AdminDetailTitleSlot.tsx'),
  'utf8'
);
const sharedNotesCard = readFileSync(
  resolve(process.cwd(), 'src/shared/ui/admin-detail/AdminNotesCard.tsx'),
  'utf8'
);

const sharedActivityTimeline = readFileSync(
  resolve(process.cwd(), 'src/shared/ui/admin-detail/AdminActivityTimeline.tsx'),
  'utf8'
);

const orderDetailsRoute = readFileSync(
  resolve(process.cwd(), 'src/admin/api/orders/[orderId]/details/route.ts'),
  'utf8'
);

const itemsEditor = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/orders/components/AdminOrderItemsEditor.tsx'
  ),
  'utf8'
);

const globalStyles = readFileSync(
  resolve(process.cwd(), 'src/shared/styles/globals.css'),
  'utf8'
);

const activity = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/orders/components/AdminOrderActivityCard.tsx'
  ),
  'utf8'
);

const shippingOverride = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/orders/components/AdminOrderShippingOverride.tsx'
  ),
  'utf8'
);

const customerAccess = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/orders/components/AdminOrderCustomerAccess.tsx'
  ),
  'utf8'
);

const adminTableStandards = readFileSync(
  resolve(process.cwd(), 'src/shared/ui/admin-table/standards.ts'),
  'utf8'
);

const pdfManager = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/orders/components/AdminOrderPdfManager.tsx'
  ),
  'utf8'
);
const sharedDocumentsPresentation = readFileSync(
  resolve(
    process.cwd(),
    'src/shared/ui/admin-detail/AdminDetailDocuments.tsx'
  ),
  'utf8'
);

test('order detail header preserves standard controls and moves rejection into overflow', () => {
  assert.match(detail, /aria-label=\{isMasterEditing \? 'Končaj urejanje naročila' : 'Uredi celotno naročilo'\}/u);
  assert.match(detail, /<ActionUndoIcon/u);
  assert.match(detail, /title="Razveljavi neshranjene spremembe"/u);
  assert.match(detail, /<TrashCanIcon/u);
  assert.match(detail, /<span>Shrani<\/span>/u);
  assert.match(detail, /<RowActionsDropdown/u);
  assert.match(detail, /label: 'Zavrni naročilo'/u);
  assert.match(detail, /body: JSON\.stringify\(\{ status: 'cancelled' \}\)/u);
  assert.match(detail, /label: 'Zgodovina sprememb'/u);
  assert.doesNotMatch(detail, />\s*Deli\s*</u);
  assert.doesNotMatch(detail, /AdminOrderContractCard/u);
  assert.doesNotMatch(detail, /contractAccepted/u);
  assert.doesNotMatch(detail, /adminStatusInfoPillClassName/u);
  assert.doesNotMatch(detail, /Čaka na sprejem/u);
});

test('order detail follows the requested two-column information hierarchy', () => {
  const header = detail.indexOf('data-testid="admin-order-detail-header"');
  const headerDrawer = detail.indexOf('<AuditHistoryDrawer');
  const activityTimeline = detail.indexOf('<AdminOrderActivityCard');
  const items = detail.indexOf('<AdminOrderItemsEditorClient');
  const shipping = detail.indexOf('<AdminOrderShippingOverride');
  const orderData = detail.indexOf('data-testid="admin-order-data-card"');
  const customer = detail.indexOf('<AdminOrderCustomerCard');
  const adminNotes = detail.indexOf('<AdminNotesCard');
  const documents = detail.indexOf('<AdminOrderPdfManagerClient');
  const access = detail.indexOf('<AdminOrderCustomerAccess');

  assert.match(
    detail,
    /lg:grid-cols-\[minmax\(0,1\.23fr\)_minmax\(340px,0\.77fr\)\]/u
  );
  assert.ok(header >= 0 && activityTimeline > header && activityTimeline < headerDrawer);
  assert.equal(detail.match(/<AdminOrderActivityCard/g)?.length, 1);
  assert.ok(items >= 0 && shipping > items && orderData > shipping);
  assert.match(detail, /className=\{`\$\{adminWindowCardClassName\} order-first p-4`\}/u);
  assert.ok(customer >= 0 && adminNotes > customer && documents > adminNotes && access > documents);
});

test('activity is an embedded chronological horizontal timeline in the order header', () => {
  assert.match(
    detail,
    /mt-3 grid min-w-0 gap-4 lg:grid-cols-\[max-content_minmax\(0,1fr\)\] lg:items-end/u
  );
  assert.match(detail, /refreshToken=\{activityRefreshToken\}/u);
  assert.match(detail, /setActivityRefreshToken\(\(current\) => current \+ 1\)/u);

  assert.match(activity, /groupAuditEvents\(events\)\.slice\(0, 5\)\.reverse\(\)/u);
  assert.match(activity, /<AdminActivityTimeline/u);
  assert.match(activity, /testId="admin-order-activity-timeline"/u);
  assert.match(activity, /ariaLabel="Časovnica dejavnosti naročila"/u);
  assert.match(activity, /progressAriaLabel="Napredovanje naročila"/u);
  assert.match(activity, /items=\{timelineItems\}/u);
  assert.match(activity, /loading=\{loading\}/u);
  assert.match(activity, /error=\{error\}/u);
  assert.match(activity, /const conciseActivitySummary/u);
  assert.match(activity, /return 'Status'/u);
  assert.match(activity, /ORDER_PDF_TYPE_CONFIGS\.map/u);
  assert.match(activity, /config\.shortLabel \+ ' PDF'/u);
  assert.match(activity, /group\.events/u);
  assert.match(activity, /normalized\.includes\('dokument'\)\) return 'PDF'/u);
  assert.doesNotMatch(activity, /return 'Dok\.'/u);
  assert.match(activity, /const formatCompactTimestamp/u);
  assert.match(
    activity,
    /\? `\$\{day\}\.\$\{month\}\. \$\{hour\}:\$\{minute\}`/u
  );
  assert.match(activity, /timestampLabel: formatCompactTimestamp\(group\.occurredAt\)/u);
  assert.match(activity, /compactLabel,/u);
  assert.match(
    activity,
    /fullLabel: `\$\{compactSummary\(group\.summary, group\.entityLabel\)\} · \$\{actor\} · \$\{group\.actionLabel\} · \$\{fullTimestamp\}`/u
  );
  assert.doesNotMatch(activity, /\{' · '\}\{actor\}\{' · '\}/u);

  assert.match(sharedActivityTimeline, /data-testid=\{testId\}/u);
  assert.match(sharedActivityTimeline, /aria-label=\{ariaLabel\}/u);
  assert.match(sharedActivityTimeline, /aria-label=\{progressAriaLabel\}/u);
  assert.match(sharedActivityTimeline, /className="-mx-1 overflow-x-auto px-1 pb-1"/u);
  assert.match(sharedActivityTimeline, /className="flex min-w-max lg:min-w-full"/u);
  assert.match(sharedActivityTimeline, /className="min-w-\[112px\] flex-1 text-center"/u);
  assert.match(sharedActivityTimeline, /className="min-h-\[16px\] px-1"/u);
  assert.match(
    sharedActivityTimeline,
    /className="truncate whitespace-nowrap text-\[9px\] leading-3 text-slate-500"/u
  );
  assert.match(sharedActivityTimeline, /data-activity-compact-label/u);
  assert.match(sharedActivityTimeline, /<time dateTime=\{item\.occurredAt\}>\{item\.timestampLabel\}<\/time>/u);
  assert.match(sharedActivityTimeline, /index > 0[\s\S]*?left-0 right-1\/2[\s\S]*?index < items\.length - 1[\s\S]*?left-1\/2 right-0/u);
  assert.match(sharedActivityTimeline, /h-px -translate-y-1\/2 bg-emerald-300/u);
  assert.match(sharedActivityTimeline, /aria-current=\{index === items\.length - 1 \? 'step' : undefined\}/u);
  assert.doesNotMatch(sharedActivityTimeline, /adminWindowCardClassName/u);
  assert.doesNotMatch(sharedActivityTimeline, />Dejavnost<\/h2>/u);
  assert.doesNotMatch(sharedActivityTimeline, /line-clamp-2/u);
  assert.doesNotMatch(activity, /dateStyle: 'medium'/u);
  assert.doesNotMatch(sharedActivityTimeline, /\bw-px\b/u);
});
test('document activity labels identify every canonical order PDF type', () => {
  for (const config of ORDER_PDF_TYPE_CONFIGS) {
    assert.equal(
      conciseActivitySummary(
        'Naročilo #4: dokument dodan',
        'Naročilo #4',
        'Dodano',
        [{ metadata: { document_type: config.key } }]
      ),
      config.shortLabel + ' PDF'
    );
  }

  assert.equal(
    conciseActivitySummary(
      'Naročilo #4: dokument dodan',
      'Naročilo #4',
      'Dodano',
      [{ metadata: { document_type: 'legacy_document' } }]
    ),
    'PDF'
  );
});

test('order data keeps one compact row geometry across read and edit modes', () => {
  assert.match(detail, /function OrderDataRow/u);
  const orderDataRow = detail.slice(detail.indexOf('function OrderDataRow'));
  assert.match(
    orderDataRow,
    /grid h-\[35px\] items-center gap-3/u
  );
  assert.doesNotMatch(
    orderDataRow,
    /border-b border-slate-200|last:border-b-0/u
  );
  assert.match(
    orderDataRow,
    /<dt className="flex min-w-0 items-center gap-1\.5[^"]*">[\s\S]*?<DetailFieldIcon icon=\{icon\} \/>[\s\S]*?\{label\}/u
  );
  assert.doesNotMatch(detail, /<DetailFieldShell icon=/u);
  assert.match(detail, /data-order-data-row=\{label\}/u);
  assert.match(detail, /data-order-data-value/u);
  assert.match(detail, /fullWidth\?: boolean;/u);
  assert.match(
    detail,
    /fullWidth\s+\? 'grid-cols-\[120px_minmax\(0,1fr\)\] md:col-span-2'/u
  );
  assert.match(detail, /data-order-data-span=\{fullWidth \? 'full' : undefined\}/u);
  assert.match(
    detail,
    /const detailFieldShellClassName = [\s\S]*?!mt-0 !h-7 w-full/u
  );
  assert.match(
    detail,
    /const orderDataValueControlClassName =[\s\S]*?min-w-0 flex-1/u
  );
  assert.match(
    detail,
    /const detailFieldLockedShellClassName = '!border-transparent !bg-transparent !shadow-none';/u
  );
  assert.match(
    detail,
    /const orderDataReadValueClassName =[\s\S]*?block h-5 w-full min-w-0 flex-1 select-text truncate[\s\S]*?text-\[11px\][\s\S]*?leading-5/u
  );
  assert.match(
    detail,
    /isEditing \? \([\s\S]*?children[\s\S]*?\) : \([\s\S]*?<DetailFieldShell isEditing=\{false\}>[\s\S]*?orderDataReadValueClassName/u
  );
  assert.doesNotMatch(detail, /\{isEditing \? children : display\}/u);
  assert.equal(detail.match(/<OrderDataRow/g)?.length, 6);

  const orderDataRowTags = [...detail.matchAll(/<OrderDataRow[\s\S]*?>/gu)].map(([tag]) => tag);
  const expectedRowIcons = new Map([
    ['Datum', 'calendar'],
    ['Tip naročnika', 'type'],
    ['Naročnik', 'customer'],
    ['Email', 'email'],
    ['Naslov', 'address'],
    ['Opombe stranke', 'notes']
  ]);
  for (const [label, icon] of expectedRowIcons) {
    const rowTag = orderDataRowTags.find((tag) => tag.includes('label="' + label + '"'));
    assert.ok(rowTag, 'Expected an order-data row for ' + label);
    assert.match(rowTag, new RegExp('icon="' + icon + '"', 'u'));
  }

  const customerTypeRowTag = orderDataRowTags.find((tag) =>
    tag.includes('label="Tip naročnika"')
  );
  assert.ok(customerTypeRowTag);
  assert.match(customerTypeRowTag, /\breserveTrailingControl\b/u);
  assert.match(detail, /reserveTrailingControl \? 'pr-5' : ''/u);

  for (const label of ['Naslov', 'Opombe stranke']) {
    const rowTag = orderDataRowTags.find((tag) => tag.includes('label="' + label + '"'));
    assert.ok(rowTag, 'Expected a full-width order-data row for ' + label);
    assert.match(rowTag, /\bfullWidth\b/u);
  }

  assert.match(
    detail,
    /label="Datum"\s+value=\{formatOrderDataDate\(activeOrderDataDetails\.orderDate\)\}/u
  );
  assert.match(detail, /value=\{formatOrderDataDate\(value\)\}/u);
  assert.match(detail, /aria-label="Datum naročila"/u);
  assert.match(detail, /event\.key === 'Enter'[\s\S]*?event\.key === 'ArrowDown'/u);
  assert.doesNotMatch(detail, /onClick=\{toggleCalendar\}/u);
  assert.match(detail, /aria-label="Uredi podatke naročila"/u);
  assert.match(detail, /aria-pressed=\{isOrderDataEditing\}/u);
  assert.match(detail, /adminCardSectionEditIconButtonClassName/u);
  assert.match(detail, /data-admin-card-edit-action="order-data"/u);
  assert.doesNotMatch(detail, /<span>Uredi podatke<\/span>/u);
  assert.match(
    detail,
    /<dl className="mt-2 grid min-w-0 gap-x-8 md:grid-cols-2">/u
  );
  assert.doesNotMatch(detail, /OrderDataReadOnlyRow/u);
});

test('order address remains structured inside one full-width field and persists without lossy parsing', () => {
  assert.match(
    detail,
    /type DetailData = \{[\s\S]*?addressLine2: string;[\s\S]*?countryCode: string;/u
  );
  assert.match(detail, /addressLine2: order\.address_line2\?\.trim\(\) \?\? ''/u);
  assert.match(
    detail,
    /countryCode: order\.country_code\?\.trim\(\)\.toUpperCase\(\) \|\| 'SI'/u
  );
  assert.match(detail, /const formatOrderDataAddress/u);
  assert.match(
    detail,
    /value=\{formatOrderDataAddress\(activeOrderDataDetails\)\}/u
  );
  assert.match(detail, /function OrderAddressEditor/u);
  assert.match(detail, /aria-label="Naslovni podatki"/u);
  assert.match(detail, /data-testid="admin-order-address-fields"/u);
  assert.match(
    detail,
    /grid-cols-\[minmax\(0,1\.5fr\)_minmax\(0,1fr\)_3\.5rem_minmax\(0,1fr\)_2\.25rem\]/u
  );
  for (const label of [
    'Naslov',
    'Dodatni naslov',
    'Poštna številka',
    'Kraj',
    'Država'
  ]) {
    assert.match(detail, new RegExp('aria-label="' + label + '"', 'u'));
  }
  assert.match(
    detail,
    /addressLine2: draftDetails\.addressLine2,[\s\S]*?countryCode: draftDetails\.countryCode,/u
  );

  assert.match(orderDetailsRoute, /const addressLine2Provided = typeof addressLine2 === 'string'/u);
  assert.match(orderDetailsRoute, /const countryCodeProvided = typeof countryCode === 'string'/u);
  assert.match(
    orderDetailsRoute,
    /countryCodeProvided && normalizedCountryCode !== 'SI'/u
  );
  assert.match(
    orderDetailsRoute,
    /address_line2 = case\s+when \$17::boolean then \$18\s+else address_line2\s+end,/u
  );
  assert.match(
    orderDetailsRoute,
    /country_code = case\s+when \$19::boolean then \$20\s+else country_code\s+end,/u
  );
  assert.match(
    orderDetailsRoute,
    /orderId,\s+addressLine2Provided,\s+normalizedAddressLine2,\s+countryCodeProvided,\s+normalizedCountryCode/u
  );

  const addressEditStart = orderDetailsRoute.indexOf('const addressWasEdited');
  const addressEditEnd = orderDetailsRoute.indexOf('await client.query', addressEditStart);
  assert.ok(addressEditStart >= 0 && addressEditEnd > addressEditStart);
  const addressEditBlock = orderDetailsRoute.slice(addressEditStart, addressEditEnd);
  assert.match(addressEditBlock, /countryCodeProvided/u);
  assert.doesNotMatch(addressEditBlock, /addressLine2Provided/u);
});

test('section actions toggle independent drafts while the top pencil activates every scope', () => {
  assert.match(detail, /type OrderEditScopes = \{[\s\S]*?master: boolean;[\s\S]*?details: boolean;[\s\S]*?items: boolean;[\s\S]*?shipping: boolean;[\s\S]*?notes: boolean;/u);
  assert.match(detail, /type OrderSectionEditScope = Exclude<keyof OrderEditScopes, 'master'>/u);
  assert.match(detail, /const isOrderDataEditing = editScopes\.details/u);
  assert.match(detail, /const isItemsEditing = editScopes\.items/u);
  assert.match(detail, /const isShippingEditing = editScopes\.shipping/u);
  assert.match(detail, /const isAdminNotesEditing = editScopes\.notes/u);
  assert.match(detail, /setEditScopes\(\{[\s\S]*?master: true,[\s\S]*?details: true,[\s\S]*?items: true,[\s\S]*?shipping: true,[\s\S]*?notes: true/u);
  assert.match(detail, /if \(editScopes\[scope\]\)[\s\S]*?\[scope\]: false/u);
  assert.match(detail, /setEditScopes\(\(current\) => \(\{ \.\.\.current, \[scope\]: true \}\)\)/u);
  assert.match(detail, /onRequestEdit=\{\(\) => toggleSectionEdit\('items'\)\}/u);
  assert.match(detail, /onRequestEdit=\{\(\) => toggleSectionEdit\('shipping'\)\}/u);
  assert.match(detail, /onClick=\{\(\) => toggleSectionEdit\('details'\)\}/u);
  assert.match(detail, /<AdminNotesCard[\s\S]*?onToggle=\{\(\) => toggleSectionEdit\('notes'\)\}/u);
  assert.match(detail, /externalEditMode=\{isItemsEditing\}/u);
  assert.match(detail, /externalEditMode=\{isShippingEditing\}/u);
  assert.match(
    detail,
    /await itemsSaveHandlerRef\.current\(\)[\s\S]*?await shippingSaveHandlerRef\.current\(latestPricingRevisionRef\.current\)[\s\S]*?await saveDetails\(\)/u
  );
});

test('administrator notes use the compact reference-style add action and top-save edit scope', () => {
  assert.match(detail, /<AdminNotesCard/u);
  assert.match(detail, /headingId="admin-order-notes-title"/u);
  assert.match(detail, /testId="admin-order-admin-notes-card"/u);
  assert.match(detail, /editActionId="notes"/u);
  assert.match(detail, /isEditing=\{isAdminNotesEditing\}/u);
  assert.match(detail, /value=\{activeAdminNotes\}/u);
  assert.match(detail, /persistedValue=\{persistedAdminNotes\}/u);
  assert.match(detail, /onChange=\{setDraftAdminNotes\}/u);
  assert.match(detail, /onToggle=\{\(\) => toggleSectionEdit\('notes'\)\}/u);
  assert.match(detail, /autoFocus=\{editScopes\.notes && !isMasterEditing\}/u);
  assert.match(detail, /disabled=\{pageIsBusy\}/u);
  assert.match(detail, /const adminNotesDirty = draftAdminNotes !== persistedAdminNotes/u);
  assert.match(detail, /setPersistedAdminNotes\(draftAdminNotes\)/u);

  assert.match(sharedNotesCard, /className=\{`\$\{adminWindowCardClassName\} p-4`\}/u);
  assert.match(sharedNotesCard, /aria-labelledby=\{headingId\}/u);
  assert.match(sharedNotesCard, /data-testid=\{testId\}/u);
  assert.match(sharedNotesCard, /className="text-base font-semibold text-slate-900"/u);
  assert.match(sharedNotesCard, /aria-label="Dodaj interno opombo"/u);
  assert.match(sharedNotesCard, /border border-dashed border-slate-300/u);
  assert.match(sharedNotesCard, /<PlusIcon className="h-3 w-3" \/>/u);
  assert.match(sharedNotesCard, /<span>Dodaj interno opombo<\/span>/u);
  assert.match(sharedNotesCard, /\{isEditing \? \(/u);
  assert.match(sharedNotesCard, /block h-10 min-h-10 w-full resize-none/u);
  assert.match(sharedNotesCard, /autoFocus=\{autoFocus\}/u);
  assert.match(sharedNotesCard, /disabled=\{disabled\}/u);
  assert.match(sharedNotesCard, /data-admin-card-edit-action=\{editActionId\}/u);
  assert.match(sharedNotesCard, /aria-label=\{isEditing \? 'Končaj urejanje opombe' : 'Uredi interno opombo'\}/u);
  assert.match(sharedNotesCard, /aria-pressed=\{isEditing\}/u);
  assert.match(sharedNotesCard, /className="flex h-10 w-full items-center rounded-lg border border-slate-200 bg-white px-3"/u);
  assert.match(sharedNotesCard, /min-w-0 flex-1 truncate text-\[13px\]/u);
  assert.match(sharedNotesCard, /title=\{persistedValue\}/u);
  assert.doesNotMatch(sharedNotesCard, /aria-label=\{`Uredi interno opombo: \$\{persistedValue\}`\}/u);
  assert.doesNotMatch(detail, /readOnly=\{!isMasterEditing\}/u);
  assert.doesNotMatch(detail, /aria-label="Dodaj interno opombo"/u);
});
test('Postavke exposes a persistent reference-style section edit action', () => {
  assert.match(itemsEditor, /adminCardSectionEditIconButtonClassName/u);
  assert.match(itemsEditor, /data-testid="admin-order-items-toolbar"/u);
  assert.match(itemsEditor, /className="flex h-11 items-center gap-3 px-4"/u);
  assert.match(itemsEditor, /aria-label="Uredi postavke naročila"/u);
  assert.match(itemsEditor, /aria-pressed=\{itemsEditable\}/u);
  assert.match(itemsEditor, /data-admin-card-edit-action="items"/u);
  assert.doesNotMatch(itemsEditor, /<span>Uredi postavke<\/span>/u);
  assert.doesNotMatch(
    itemsEditor,
    /\{itemsEditable \? \(\s*<>[\s\S]*?aria-label="Dodaj postavko"[\s\S]*?aria-label="Odstrani izbrane postavke"[\s\S]*?<\/>\s*\) : null\}/u
  );
  assert.match(itemsEditor, /aria-label="Dodaj postavko"[\s\S]*?disabled=\{addItemDisabled\}/u);
  assert.match(
    itemsEditor,
    /aria-label="Odstrani izbrane postavke"[\s\S]*?disabled=\{!itemsEditable \|\| !hasSelectedDraftItems\}/u
  );

  const addAction = itemsEditor.indexOf('aria-label="Dodaj postavko"');
  const deleteAction = itemsEditor.indexOf('aria-label="Odstrani izbrane postavke"');
  const sectionEditAction = itemsEditor.indexOf('aria-label="Uredi postavke naročila"');
  assert.ok(addAction >= 0 && deleteAction > addAction && sectionEditAction > deleteAction);
  assert.match(itemsEditor, /const selectionCheckboxClassName =/u);
  assert.match(itemsEditor, /<col style=\{\{ width: '44px' \}\} \/>/u);
  assert.match(itemsEditor, /<col style=\{\{ width: '44px' \}\} \/>\s*<col \/>/u);
  assert.equal(itemsEditor.match(/disabled=\{!itemsEditable\}/gu)?.length, 2);
  assert.equal(itemsEditor.match(/className=\{selectionCheckboxClassName\}/gu)?.length, 2);
  assert.match(itemsEditor, /checked=\{itemsEditable && areAllActiveItemsSelected\}/u);
  assert.match(itemsEditor, /checked=\{itemsEditable && selectedDraftItemIds\.includes\(item\.id\)\}/u);
});

test('order header uses the shared title slot for identical read and master-edit geometry', () => {
  assert.match(
    detail,
    /import \{ AdminDetailTitleSlot \} from '@\/shared\/ui\/admin-detail\/AdminDetailTitleSlot';/u
  );
  assert.match(detail, /<div className="flex flex-wrap items-center gap-2">/u);
  assert.match(detail, /<AdminDetailTitleSlot[\s\S]*?editing=\{isMasterEditing\}/u);
  assert.match(detail, /editorPrefix="Naročilo #"/u);
  assert.match(detail, /icon=\{<HeaderOrderIcon \/>\}/u);
  assert.match(detail, /testId="admin-order-title-slot"/u);
  assert.match(detail, /title=\{pageTitle\}/u);
  assert.match(detail, /width="compact"/u);
  assert.match(detail, /admin-order-number-input !w-auto min-w-0 flex-1/u);
  assert.doesNotMatch(detail, /admin-order-number-input !w-\[12ch\]/u);
  assert.match(detail, /data-testid="admin-order-header-statuses"/u);
  assert.doesNotMatch(detail, /orderHeaderTitleSlotClassName/u);
  assert.doesNotMatch(detail, /<h1 className="flex h-8 w-full min-w-0 items-center/u);

  assert.match(
    detailTitleSlot,
    /compact: 'sm:w-\[200px\]'[\s\S]*?wide: 'sm:w-\[390px\]'/u
  );
  assert.match(
    detailTitleSlot,
    /relative flex h-8 w-full min-w-0 items-center sm:flex-none/u
  );
  assert.match(
    detailTitleSlot,
    /adminCompactIconFieldShellClassName\} !mt-0 !h-8 w-full !pl-0/u
  );
  assert.match(
    detailTitleSlot,
    /<h1 className="flex h-8 w-full min-w-0 items-center gap-2 pl-px text-\[22px\] font-semibold leading-none/u
  );
  assert.match(detailTitleSlot, /<span className="truncate leading-tight">\{title\}<\/span>/u);
});

test('master edit keeps the reference-style shipping card in normal document flow', () => {
  assert.doesNotMatch(shippingOverride, /detailsOpen|setDetailsOpen/u);
  assert.match(
    shippingOverride,
    /const \[breakdownOpen, setBreakdownOpen\] = useState\(false\)/u
  );
  assert.match(
    shippingOverride,
    /\{externalEditMode \? \([\s\S]*?data-shipping-editor-row[\s\S]*?\) : \([\s\S]*?data-shipping-read-reason/u
  );
  assert.match(shippingOverride, /aria-pressed=\{externalEditMode\}/u);
  assert.match(shippingOverride, /onClick=\{onRequestEdit\}/u);
  assert.match(shippingOverride, /data-shipping-details-toggle/u);
  assert.match(shippingOverride, /aria-expanded=\{breakdownOpen\}/u);
  assert.match(
    shippingOverride,
    /onClick=\{\(\) => setBreakdownOpen\(\(current\) => !current\)\}/u
  );
  assert.match(shippingOverride, /\{breakdownOpen \? \([\s\S]*?data-shipping-breakdown-panel/u);
  assert.match(sharedNotesCard, /block h-10 min-h-10 w-full resize-none/u);
});

test('card edit and manage actions share one icon-only top-right treatment', () => {
  assert.match(
    adminTableStandards,
    /export const adminCardSectionEditIconButtonClassName =\s*`\$\{adminCardSectionActionButtonClassName\} !w-7 !gap-0 !px-0`;/u
  );
  assert.match(shippingOverride, /data-shipping-summary-row/u);
  assert.match(shippingOverride, /data-admin-card-edit-action="shipping"/u);
  assert.doesNotMatch(shippingOverride, /<span>\{detailsOpen \? 'Končaj urejanje' : 'Preglej Poštnino'\}<\/span>/u);
  assert.match(customerAccess, /className="flex items-center justify-between gap-4"/u);
  assert.match(customerAccess, /data-admin-card-edit-action="customer-access"/u);
  assert.match(customerAccess, /<PencilIcon className="h-4 w-4" \/>/u);
  assert.match(customerAccess, /aria-controls=\{`admin-order-customer-access-management-\$\{orderId\}`\}/u);
  assert.match(customerAccess, /id=\{`admin-order-customer-access-management-\$\{orderId\}`\}/u);
  assert.doesNotMatch(customerAccess, /className="mt-3 text-xs font-semibold text-\[color:var\(--blue-500\)\] hover:underline"/u);
  assert.doesNotMatch(
    customerAccess,
    />\s*\{compactExpanded \? 'Skrij upravljanje' : 'Upravljaj dostop'\}\s*<\/button>/u
  );
});

test('order item columns stay on one line while the article keeps separate name and SKU lines', () => {
  assert.match(
    itemsEditor,
    /className="min-w-\[620px\] w-full table-fixed whitespace-nowrap text-\[12px\] leading-5"/u
  );
  assert.doesNotMatch(itemsEditor, /itemsEditable \? 'min-w-\[800px\]'/u);
  assert.match(itemsEditor, /const orderItemsValueInputClassName =/u);
  assert.match(itemsEditor, /const orderItemsReadValueClassName =[\s\S]*?inline-flex h-full w-full min-w-0/u);
  assert.match(itemsEditor, /!h-8 !px-2 !text-\[12px\] !leading-5/u);
  assert.equal(itemsEditor.match(/data-admin-order-item-value-input/gu)?.length, 3);
  assert.equal(itemsEditor.match(/data-admin-order-item-value-display/gu)?.length, 3);
  assert.equal(itemsEditor.match(/data-admin-order-item-value-slot=/gu)?.length, 3);
  assert.equal(itemsEditor.match(/readOnly=\{isItemsSaving\}/gu)?.length, 3);
  assert.doesNotMatch(itemsEditor, /tabIndex=\{itemsEditable \? undefined : -1\}/u);
  assert.match(itemsEditor, /data-admin-order-item-value-slot="quantity"[\s\S]*?itemsEditable \? \([\s\S]*?data-admin-order-item-value-input[\s\S]*?: \([\s\S]*?data-admin-order-item-value-display/u);
  assert.match(itemsEditor, /h-8 w-\[88px\] items-center justify-center gap-1/u);
  assert.match(itemsEditor, /h-8 w-\[72px\] items-center justify-center gap-1/u);
  assert.doesNotMatch(itemsEditor, /readonlyCellFrameClassName/u);
  assert.match(
    globalStyles,
    /\.admin-scope input\[data-admin-order-item-value-input\] \{\s*font-size: 12px !important;\s*line-height: 20px !important;\s*\}/u
  );
  assert.match(globalStyles, /:not\(\[data-admin-order-item-value-input\]\)/u);
  assert.match(
    globalStyles,
    /input\[data-admin-order-item-value-input\]:read-only \{\s*-webkit-text-fill-color: currentColor;\s*\}/u
  );
  assert.match(
    itemsEditor,
    /<p className="truncate text-\[12px\] font-medium text-slate-900">\{item\.name\}<\/p>\s*<p className="truncate text-\[11px\] text-slate-500">\{item\.sku\}<\/p>/u
  );
  assert.match(
    itemsEditor,
    /<thead className="border-t border-slate-200 bg-\[color:var\(--admin-table-header-bg\)\] text-slate-600">/u
  );
});

test('order item totals are indented into one compact right-aligned summary block', () => {
  assert.match(
    itemsEditor,
    /className="ml-auto w-full max-w-\[280px\] space-y-1"\s*data-testid="admin-order-items-totals"/u
  );
  assert.match(itemsEditor, /bg-slate-50\/50 px-4 py-3 text-\[12px\]/u);
  assert.match(itemsEditor, /className="flex min-h-5 items-center justify-between"/u);
  assert.match(itemsEditor, /gap-x-2 gap-y-0\.5 font-semibold/u);
  assert.match(itemsEditor, /className="border-t border-slate-200 pt-1"/u);
  assert.match(
    itemsEditor,
    /data-testid="admin-order-items-totals"[\s\S]*?Vmesni seštevek brez DDV[\s\S]*?Poštnina[\s\S]*?DDV \(\{taxRateLabel\} %\)[\s\S]*?Skupaj z DDV/u
  );
  assert.match(itemsEditor, /const shippingContextLabel = shippingManualQuote/u);
  assert.match(itemsEditor, /hasShippingOverride[\s\S]*?shippingIsStale \? 'Zastarelo' : null/u);
  const totalsBlock = itemsEditor.slice(
    itemsEditor.indexOf('data-testid="admin-order-items-totals"'),
    itemsEditor.indexOf('</div>', itemsEditor.indexOf('Skupaj z DDV'))
  );
  assert.doesNotMatch(totalsBlock, /'Ročna'/u);
});

test('PDF documents use shared compact chrome with feature-owned actions', () => {
  const sharedDocuments = sharedDocumentsPresentation;

  assert.match(pdfManager, /from '@\/shared\/ui\/admin-detail'/u);
  assert.match(pdfManager, /<AdminDetailDocumentsCard/u);
  assert.match(pdfManager, /<AdminDetailDocumentTypeRow/u);
  assert.match(pdfManager, /<AdminDetailDocumentCurrent/u);
  assert.match(pdfManager, /<AdminDetailDocumentHistoryItem/u);

  assert.match(sharedDocuments, /flex w-full min-w-0 flex-col p-4/u);
  assert.match(
    sharedDocuments,
    /<h2 className="text-base font-semibold text-slate-900">PDF dokumenti<\/h2>/u
  );
  assert.match(
    sharedDocuments,
    /mt-2\.5 overflow-hidden rounded-xl border border-slate-200 bg-white/u
  );
  assert.match(
    sharedDocuments,
    /className="border-b border-slate-200 last:border-b-0"/u
  );
  assert.match(sharedDocuments, /grid min-h-11 grid-cols-/u);

  assert.match(pdfManager, /<RowActionsDropdown/u);
  assert.match(pdfManager, /menuWidth=\{174\}/u);
  assert.match(pdfManager, /menuClassName="!w-full"/u);
  assert.match(
    pdfManager,
    /<AdminDetailDocumentOpenLink[\s\S]*?>\s*Odpri\s*<\/AdminDetailDocumentOpenLink>/u
  );
  assert.match(
    pdfManager,
    /label: latestDoc[\s\S]*?\? 'Ustvari novo različico'[\s\S]*?: 'Ustvari'/u
  );
  assert.match(pdfManager, /'Naloži'/u);
  assert.match(pdfManager, /label: 'Prenesi'/u);
  assert.match(pdfManager, /label: 'Izbriši'/u);
  assert.match(pdfManager, /const previousDocs = docs\.slice\(1\);/u);
  assert.match(pdfManager, /latestDoc && previousDocs\.length > 0/u);
  assert.match(pdfManager, /previousDocs\.map\(\(doc\) =>/u);
  assert.doesNotMatch(
    pdfManager,
    /expandedByType|Pokaži različice|Skrij različice|key: 'versions'/u
  );
  assert.doesNotMatch(sharedDocuments, /fetch\(|orderId|quoteRequestId/u);
});
