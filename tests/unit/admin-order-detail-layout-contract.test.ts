import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

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

const adminAddressAutocomplete = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/components/AdminAddressAutocompleteInput.tsx'
  ),
  'utf8'
);

const itemsEditor = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/orders/components/AdminOrderItemsEditor.tsx'
  ),
  'utf8'
);

const itemsEditorClient = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/orders/components/AdminOrderItemsEditorClient.tsx'
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
  assert.match(
    detail,
    /status: 'cancelled'[\s\S]*?customerEmailConfirmationToken/u
  );
  assert.match(detail, /<AuditHistoryDrawer[\s\S]*?entityType="order"[\s\S]*?entityLabel=\{displayOrderNumber\}/u);
  assert.doesNotMatch(detail, /triggerLabel=/u);
  assert.doesNotMatch(detail, />\s*Deli\s*</u);
  assert.doesNotMatch(detail, /AdminOrderContractCard/u);
  assert.doesNotMatch(detail, /contractAccepted/u);
  assert.doesNotMatch(detail, /adminStatusInfoPillClassName/u);
  assert.doesNotMatch(detail, /Čaka na sprejem/u);
});

test('order detail follows the requested two-column information hierarchy', () => {
  const header = detail.indexOf('data-testid="admin-order-detail-header"');
  const headerAudit = detail.indexOf('<AuditHistoryDrawer');
  const activityTimeline = detail.indexOf('<AdminOrderActivityCard');
  const items = detail.indexOf('<AdminOrderItemsEditorClient');
  const shipping = detail.indexOf('<AdminOrderShippingOverride');
  const orderData = detail.indexOf('data-testid="admin-order-data-card"');
  const customerActions = detail.indexOf('<AdminOrderCustomerActions', orderData);
  const orderDataRows = detail.indexOf(
    '<dl className={`mt-2 grid min-w-0 gap-x-8 md:grid-cols-2',
    orderData
  );
  const adminNotes = detail.indexOf('<AdminNotesCard');
  const documents = detail.indexOf('<AdminOrderPdfManagerClient');
  const access = detail.indexOf('<AdminOrderCustomerAccess');

  assert.match(
    detail,
    /lg:grid-cols-\[minmax\(0,1\.23fr\)_minmax\(340px,0\.77fr\)\]/u
  );
  assert.ok(header >= 0 && headerAudit > header && activityTimeline > headerAudit);
  assert.equal(detail.match(/<AdminOrderActivityCard/g)?.length, 1);
  assert.ok(items >= 0 && orderData > items);
  assert.match(detail, /className=\{`\$\{adminWindowCardClassName\} \$\{customerDetailStyles\.customerCard\} order-first p-4`\}/u);
  assert.ok(customerActions > orderData && orderDataRows > customerActions);
  assert.equal(detail.match(/<AdminOrderCustomerActions/g)?.length, 1);
  assert.match(
    detail,
    /<div className="flex min-w-0 items-center gap-2">\s*<h2 className="text-base font-semibold text-slate-900">Podatki naročila<\/h2>\s*<AdminOrderCustomerActions/u
  );
  assert.doesNotMatch(detail, /<AdminOrderCustomerCard|Naročnik in dostava/u);
  assert.ok(
    adminNotes >= 0
      && shipping > adminNotes
      && documents > shipping
      && access > documents
  );
});

test('activity is an embedded chronological horizontal timeline in the order header', () => {
  assert.match(
    detail,
    /mt-3 grid min-w-0 gap-4 lg:grid-cols-\[max-content_minmax\(0,1fr\)\] lg:items-end/u
  );
  assert.match(detail, /refreshToken=\{activityRefreshToken\}/u);
  assert.match(detail, /setActivityRefreshToken\(\(current\) => current \+ 1\)/u);

  assert.match(activity, /milestones\.slice\(-5\)\.map/u);
  assert.match(activity, /<AdminActivityTimeline/u);
  assert.match(activity, /testId="admin-order-activity-timeline"/u);
  assert.match(activity, /ariaLabel="Časovnica napredovanja naročila"/u);
  assert.match(activity, /progressAriaLabel="Napredovanje naročila"/u);
  assert.match(activity, /items=\{timelineItems\}/u);
  assert.match(activity, /loading=\{loading\}/u);
  assert.match(activity, /error=\{error\}/u);
  assert.match(activity, /fetch\(`\/api\/admin\/orders\/\$\{orderId\}\/progress`/u);
  assert.match(activity, /getStatusLabel\(milestone\.status\)/u);
  assert.doesNotMatch(activity, /audit-events|groupAuditEvents|ORDER_PDF_TYPE_CONFIGS/u);
  assert.match(activity, /const formatCompactTimestamp/u);
  assert.match(
    activity,
    /\? `\$\{day\}\.\$\{month\}\. \$\{hour\}:\$\{minute\}`/u
  );
  assert.match(
    activity,
    /timestampLabel: milestone\.timestampKnown[\s\S]*?formatCompactTimestamp\(milestone\.occurredAt\)[\s\S]*?'čas ni znan'/u
  );
  assert.match(activity, /timestampKnown: milestone\.timestampKnown/u);
  assert.match(activity, /compactLabel: statusLabel,/u);
  assert.match(
    activity,
    /fullLabel: `\$\{statusLabel\} · \$\{fullTimestamp\}`/u
  );

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
  assert.match(
    sharedActivityTimeline,
    /item\.timestampKnown \? \([\s\S]*?<time dateTime=\{item\.occurredAt\}>\{item\.timestampLabel\}<\/time>[\s\S]*?: \([\s\S]*?<span data-activity-timestamp-unknown>\{item\.timestampLabel\}<\/span>/u
  );
  assert.match(sharedActivityTimeline, /index > 0[\s\S]*?left-0 right-1\/2[\s\S]*?index < items\.length - 1[\s\S]*?left-1\/2 right-0/u);
  assert.match(sharedActivityTimeline, /h-px -translate-y-1\/2 bg-emerald-300/u);
  assert.match(sharedActivityTimeline, /aria-current=\{index === items\.length - 1 \? 'step' : undefined\}/u);
  assert.doesNotMatch(sharedActivityTimeline, /adminWindowCardClassName/u);
  assert.doesNotMatch(sharedActivityTimeline, />Dejavnost<\/h2>/u);
  assert.doesNotMatch(sharedActivityTimeline, /line-clamp-2/u);
  assert.doesNotMatch(activity, /dateStyle: 'medium'/u);
  assert.doesNotMatch(sharedActivityTimeline, /\bw-px\b/u);
});

test('order data uses compact expandable rows in the requested row-major order', () => {
  assert.match(detail, /function OrderDataRow/u);
  const orderDataRow = detail.slice(detail.indexOf('function OrderDataRow'));
  assert.match(
    orderDataRow,
    /grid min-h-\[35px\] min-w-0 items-center gap-3/u
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
    /const orderDataReadValueClassName =[\s\S]*?block h-6 w-full min-w-0 flex-1 select-text truncate[\s\S]*?text-\[11px\][\s\S]*?leading-6/u
  );
  assert.match(
    detail,
    /isEditing \? \([\s\S]*?children[\s\S]*?\) : \([\s\S]*?<DetailFieldShell isEditing=\{false\}>[\s\S]*?orderDataReadValueClassName/u
  );
  assert.doesNotMatch(detail, /\{isEditing \? children : display\}/u);
  assert.equal(detail.match(/<OrderDataRow/g)?.length, 7);

  const orderDataRowTags = [...detail.matchAll(/<OrderDataRow[\s\S]*?>/gu)].map(([tag]) => tag);
  const expectedRowIcons = new Map([
    ['Številka naročila', 'number'],
    ['Datum', 'calendar'],
    ['Tip naročnika', 'type'],
    ['Email', 'email'],
    ['Naslov', 'address'],
    ['Sporočilo stranke', 'notes']
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

  const customerRowTag = orderDataRowTags[3];
  assert.ok(customerRowTag);
  assert.match(customerRowTag, /label=\{activeOrderDataDetails\.customerType === 'individual' \? 'Naročnik' : 'Naziv'\}/u);
  assert.match(customerRowTag, /icon="customer"/u);
  assert.deepEqual(orderDataRowTags.map((tag) => tag.match(/label="([^"]+)"/u)?.[1] ?? 'Naročnik/Naziv'), [
    'Številka naročila', 'Datum', 'Tip naročnika', 'Naročnik/Naziv', 'Email', 'Naslov', 'Sporočilo stranke'
  ]);
  const addressRowTag = orderDataRowTags.find((tag) => tag.includes('label="Naslov"'));
  assert.ok(addressRowTag);
  assert.doesNotMatch(addressRowTag, /\bfullWidth\b/u);
  for (const label of ['Sporočilo stranke']) {
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
    /<dl className=\{`mt-2 grid min-w-0 gap-x-8 md:grid-cols-2 \$\{customerDetailStyles\.detailsGrid\}`\}>/u
  );
  assert.doesNotMatch(detail, /OrderDataReadOnlyRow/u);
});

test('order customer identity and public code remain distinct from internal numbering when saved', () => {
  const customerCard = detail.slice(detail.indexOf('data-testid="admin-order-data-card"'), detail.indexOf('<AdminNotesCard'));
  const saveDetails = detail.slice(detail.indexOf('const saveDetails ='), detail.indexOf('if (requests.length > 0)'));
  const editor = readFileSync(resolve(process.cwd(), 'src/shared/ui/admin-detail/AdminCustomerNameEditor.tsx'), 'utf8');
  assert.match(customerCard, /label="Številka naročila" value=\{order\.order_code\}[\s\S]*?isEditing=\{false\}/u);
  assert.match(customerCard, /data-testid="admin-order-public-code-copy"/u);
  assert.match(customerCard, /<span>\{order\.order_code\}<\/span>/u);
  assert.match(detail, /navigator\.clipboard\.writeText\(order\.order_code\)/u);
  assert.doesNotMatch(detail.slice(0, detail.indexOf('data-testid="admin-order-data-card"')), /data-testid="admin-order-public-code-copy"/u);
  assert.match(detail, /getCustomerIdentity\(activeOrderDataDetails\)/u);
  assert.match(customerCard, /<AdminCustomerNameEditor values=\{activeOrderDataDetails\}[\s\S]*?onChange=\{updateDraftDetails\}/u);
  assert.match(saveDetails, /contactName: draftDetails\.contactName\.trim\(\)/u);
  assert.doesNotMatch(saveDetails, /contactName: draftDetails\.organizationName/u);
  assert.match(editor, /aria-label=\{individual \? 'Naročnik' : 'Naziv'\}/u);
  assert.match(editor, /!individual \? \([\s\S]*?aria-label="Kontaktna oseba"/u);
  assert.match(editor, /contactName: event\.target\.value/u);
  assert.doesNotMatch(editor, /event\.target\.value\.trim\(\)/u);
});

test('order address remains structured inside one field and persists without lossy parsing', () => {
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
    /const orderDataCompositeInputClassName =[\s\S]*?!h-6[\s\S]*?!leading-5/u
  );
  assert.match(detail, /className=\{`grid h-6 min-w-0 flex-1/u);
  assert.match(detail, /customerDetailStyles\.addressFields/u);
  assert.match(detail, /customerDetailStyles\.addressRow/u);
  assert.match(
    detail,
    /grid-cols-\[minmax\(0,1\.5fr\)_minmax\(0,1fr\)_3\.5rem_minmax\(0,1fr\)_2\.25rem\]/u
  );
  assert.match(
    adminAddressAutocomplete,
    /aria-label="Naslov"[\s\S]*?role="combobox"[\s\S]*?aria-autocomplete="list"/u
  );
  for (const label of [
    'Dodatni naslov',
    'Poštna številka',
    'Kraj',
    'Država'
  ]) {
    assert.match(detail, new RegExp('aria-label="' + label + '"', 'u'));
  }
  assert.match(detail, /<AdminAddressAutocompleteInput[\s\S]*?testId="admin-order-address-autocomplete"/u);
  assert.match(detail, /gursHouseNumberId: suggestion\.gursHouseNumberId/u);
  const addressEditorStart = detail.indexOf('function OrderAddressEditor');
  const addressEditorEnd = detail.indexOf(
    'function OrderDatePickerField',
    addressEditorStart
  );
  assert.ok(
    addressEditorStart >= 0 && addressEditorEnd > addressEditorStart,
    'the order address editor source must remain independently inspectable'
  );
  const addressEditor = detail.slice(addressEditorStart, addressEditorEnd);
  const postalCodeCombobox = addressEditor.match(
    /<AdminPostalLocationCombobox\s+field="postalCode"[\s\S]*?\/>/u
  )?.[0];
  const postalNameCombobox = addressEditor.match(
    /<AdminPostalLocationCombobox\s+field="postalName"[\s\S]*?\/>/u
  )?.[0];
  assert.ok(postalCodeCombobox, 'the postal-code combobox must be present');
  assert.ok(postalNameCombobox, 'the postal-town combobox must be present');
  assert.equal(
    [...addressEditor.matchAll(/<AdminPostalLocationCombobox/gu)].length,
    2,
    'the compact address editor must expose exactly two postal comboboxes'
  );
  assert.match(
    postalCodeCombobox,
    /aria-label="Poštna številka"[\s\S]*?value=\{details\.postalCode\}[\s\S]*?testId="admin-order-postal-code-autocomplete"/u
  );
  assert.match(
    postalCodeCombobox,
    /onChange=\{\(value\) => onChange\(\{\s*postalCode: value\.replace\(\/\[\^\\d\]\/g, ''\)\.slice\(0, 4\),\s*gursHouseNumberId: ''\s*\}\)\}/u
  );
  assert.match(
    postalCodeCombobox,
    /onResolve=\{\(location\) => onChange\(\{\s*postalCode: location\.postalCode,\s*city: location\.postalName,\s*gursHouseNumberId: ''\s*\}\)\}/u
  );
  assert.match(
    postalNameCombobox,
    /aria-label="Kraj"[\s\S]*?value=\{details\.city\}[\s\S]*?testId="admin-order-city-autocomplete"/u
  );
  assert.match(
    postalNameCombobox,
    /onChange=\{\(value\) => onChange\(\{\s*city: value,\s*gursHouseNumberId: ''\s*\}\)\}/u
  );
  assert.match(
    postalNameCombobox,
    /onResolve=\{\(location\) => onChange\(\{\s*postalCode: location\.postalCode,\s*city: location\.postalName,\s*gursHouseNumberId: ''\s*\}\)\}/u
  );
  assert.match(
    detail,
    /addressLine2: draftDetails\.addressLine2,[\s\S]*?countryCode: draftDetails\.countryCode,/u
  );

  assert.match(orderDetailsRoute, /const addressLine2Provided = typeof addressLine2 === 'string'/u);
  assert.match(orderDetailsRoute, /const countryCodeProvided = typeof countryCode === 'string'/u);
  assert.match(
    orderDetailsRoute,
    /countryCodeProvided[\s\S]*?normalizedCountryCode !== 'SI'/u
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
  assert.match(orderDetailsRoute, /getGursAddressById\([\s\S]*?requestedGursHouseNumberId,[\s\S]*?client/u);
  assert.match(orderDetailsRoute, /gurs_house_number_id = \$12/u);
  assert.match(detail, /gursHouseNumberId: draftDetails\.gursHouseNumberId \|\| null/u);
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
  assert.match(detail, /if \(coreDetailsDirty\) \{[\s\S]*?fetch\([^)]*?\/details/u);
  assert.doesNotMatch(detail, /if \(coreDetailsDirty \|\| order\.is_draft\)/u);
  assert.match(detail, /Osnutek lahko urejate in shranjujete sproti\./u);
  assert.match(
    detail,
    /if \(statusDirty\) \{[\s\S]*?confirmationOnly: true[\s\S]*?customerEmailConfirmationToken[\s\S]*?await itemsSaveHandlerRef\.current\(\{[\s\S]*?deliveryPlanPersistence: statusDirty \? 'status' : 'after-page-save'[\s\S]*?\}\)[\s\S]*?await shippingSaveHandlerRef\.current\(latestPricingRevisionRef\.current\)[\s\S]*?await saveDetails\([\s\S]*?customerEmailConfirmationToken[\s\S]*?await itemsSaveResult\.persistDeferredDeliveryPlan\?\.\(\)[\s\S]*?commitDeferredDeliveryPlan/u
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

test('order detail section titles share the order-data reference size', () => {
  const headingClass = 'text-base font-semibold text-slate-900';

  assert.match(detail, new RegExp('<h2 className="' + headingClass + '">Podatki naročila<\\/h2>', 'u'));
  assert.match(itemsEditor, new RegExp('<h2 className="' + headingClass + '">Postavke<\\/h2>', 'u'));
  assert.match(shippingOverride, new RegExp('className="' + headingClass + '"[\\s\\S]*?>\\s*Poštnina', 'u'));
  assert.match(customerAccess, new RegExp('<h2 className="' + headingClass + '">Stranka in dostop<\\/h2>', 'u'));
  assert.match(sharedNotesCard, new RegExp('className="' + headingClass + '"[\\s\\S]*?Opombe administratorja', 'u'));
  assert.match(sharedDocumentsPresentation, new RegExp('<h2 className="' + headingClass + '">PDF dokumenti<\\/h2>', 'u'));
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
    /aria-label="Odstrani izbrane postavke"[\s\S]*?disabled=\{!commercialItemsEditable \|\| !hasSelectedDraftItems\}/u
  );

  const addAction = itemsEditor.indexOf('aria-label="Dodaj postavko"');
  const transferAction = itemsEditor.indexOf('data-testid="admin-order-items-transfer"');
  const deleteAction = itemsEditor.indexOf('aria-label="Odstrani izbrane postavke"');
  const sectionEditAction = itemsEditor.indexOf('aria-label="Uredi postavke naročila"');
  assert.ok(
    addAction >= 0 &&
    transferAction > addAction &&
    deleteAction > transferAction &&
    sectionEditAction > deleteAction
  );
  assert.match(itemsEditor, /const selectionCheckboxClassName =/u);
  assert.match(itemsEditor, /<col style=\{\{ width: '44px' \}\} \/>/u);
  assert.match(itemsEditor, /<col style=\{\{ width: '44px' \}\} \/>\s*<col \/>/u);
  assert.equal(itemsEditor.match(/className=\{selectionCheckboxClassName\}/gu)?.length, 3);
  assert.match(itemsEditor, /checked=\{itemSelectionEditable && selectedDraftItemIds\.includes\(item\.id\)\}/u);
  assert.match(itemsEditor, /disabled=\{!itemSelectionEditable\}/u);
});

test('Postavke separates current and deferred delivery with atomic status coordination', () => {
  assert.equal(itemsEditor.match(/<colgroup>/gu)?.length, 1);
  assert.match(itemsEditor, /data-testid="admin-order-items-current-group"/u);
  assert.match(itemsEditor, /data-testid="admin-order-items-later-group"/u);
  assert.match(itemsEditor, />V tej pošiljki</u);
  assert.match(itemsEditor, />Pošljemo pozneje</u);
  assert.match(itemsEditor, /V trenutni pošiljki ni postavk\./u);
  assert.match(itemsEditor, /Izberite postavke zgoraj in jih premaknite v poznejšo dobavo\./u);
  assert.match(itemsEditor, /onChange=\{\(\) => toggleDraftSection\(false\)\}/u);
  assert.match(itemsEditor, /onChange=\{\(\) => toggleDraftSection\(true\)\}/u);
  assert.match(itemsEditor, /const itemSelectionEditable = commercialItemsEditable \\|\\| deliveryPlanEditable/u);
  assert.match(itemsEditor, /const selectionMatchesSection/u);
  assert.match(itemsEditor, /selectionMatchesSection \? \[\.\.\.previous, itemId\] : \[itemId\]/u);
  assert.match(itemsEditor, /<ApplyToAllIcon/u);
  assert.match(itemsEditor, /const moveSelectedDraftItems/u);
  assert.match(itemsEditor, /shipLater: destinationShipLater/u);
  assert.match(itemsEditor, /shipLater: false/u);

  assert.match(itemsEditor, /const isCommercialItemsDirty/u);
  assert.match(itemsEditor, /const deliveryPlanDirty/u);
  assert.match(itemsEditor, /const isItemsDirty = isCommercialItemsDirty \|\| deliveryPlanDirty/u);
  assert.match(itemsEditor, /\/delivery-plan`/u);
  assert.match(
    itemsEditor,
    /JSON\.stringify\(\{\s*shipLaterItemIds: planSnapshot\.shipLaterItemIds,\s*expectedDeliveryPlanRevision\s*\}\)/u
  );
  assert.match(itemsEditor, /deliveryPlanPersistence !== 'immediate'/u);
  assert.match(itemsEditor, /deliveryPlanPersistence === 'after-page-save'/u);
  assert.match(itemsEditor, /persistDeferredDeliveryPlan: persistDeliveryPlan/u);
  assert.match(itemsEditor, /commitDeferredDeliveryPlan/u);
  assert.match(detail, /deliveryPlanPersistence: statusDirty \? 'status' : 'after-page-save'/u);
  assert.match(detail, /shipLaterItemIds: deliveryPlanSnapshotRef\.current\.shipLaterItemIds/u);
  assert.match(detail, /await itemsSaveResult\.persistDeferredDeliveryPlan\?\.\(\)/u);
  assert.match(detail, /itemsSaveResult\.commitDeferredDeliveryPlan\?\.\(\)/u);

  assert.match(detail, /order\.delivery_plan_revision/u);
  assert.match(detail, /expectedDeliveryPlanRevision: latestDeliveryPlanRevisionRef\.current/u);
  assert.match(detail, /deliveryPlanRevision\?: number/u);
  assert.match(detail, /updateLatestDeliveryPlanRevision\(nextDeliveryPlanRevision\)/u);
  assert.match(detail, /initialDeliveryPlanRevision=\{latestDeliveryPlanRevisionRef\.current\}/u);
  assert.match(detail, /onDeliveryPlanRevisionChange=\{updateLatestDeliveryPlanRevision\}/u);
  assert.match(itemsEditor, /expectedDeliveryPlanRevision = deliveryPlanRevisionRef\.current/u);
  assert.match(itemsEditor, /expectedDeliveryPlanRevision/u);
  assert.match(itemsEditor, /deliveryPlanRevision\?: number/u);
  assert.match(itemsEditor, /deliveryPlanRevisionRef\.current = nextDeliveryPlanRevision/u);
  assert.match(itemsEditor, /onDeliveryPlanRevisionChange\?\.\(nextDeliveryPlanRevision\)/u);
  assert.match(itemsEditor, /itemSaveDeliveryPlanRevision = Number\(payload\.deliveryPlanRevision\)/u);
  assert.match(itemsEditor, /deliveryPlanRevisionRef\.current = itemSaveDeliveryPlanRevision/u);
  assert.match(itemsEditor, /onDeliveryPlanRevisionChange\?\.\(itemSaveDeliveryPlanRevision\)/u);

  const standalonePlanResponse = itemsEditor.slice(
    itemsEditor.indexOf('const planResponse = await fetch'),
    itemsEditor.indexOf("const deliveryPlanPersistence = options.deliveryPlanPersistence")
  );
  assert.ok(standalonePlanResponse.indexOf('if (!planResponse.ok)') >= 0);
  assert.ok(
    standalonePlanResponse.indexOf('if (!planResponse.ok)') <
    standalonePlanResponse.indexOf('deliveryPlanRevisionRef.current = nextDeliveryPlanRevision')
  );

  assert.match(detail, /option\.value === 'partially_sent' && !canSelectPartiallySent/u);
  assert.match(detail, /deliveryPlanSnapshot\.currentItemCount > 0 && deliveryPlanSnapshot\.laterItemCount > 0/u);
  assert.match(detail, /Najprej premaknite vsaj eno postavko v razdelek »Pošljemo pozneje«\./u);
  assert.match(detail, /V razdelku »V tej pošiljki« mora ostati vsaj ena postavka\./u);
  assert.match(detail, /option\.value === 'sent' \|\| option\.value === 'finished'/u);
  assert.match(detail, /Najprej premaknite vse postavke iz razdelka »Pošljemo pozneje«/u);
  assert.match(detail, /const deliveryPlanEditingLockedReason = order\.deleted_at/u);
  assert.match(detail, /Razporeda dobave izbrisanega naročila ni mogoče spreminjati\./u);
  assert.match(detail, /getStatusLabel\(persistedDetails\.status\)/u);
  const deliveryPlanLockSource = detail.slice(
    detail.indexOf('const deliveryPlanEditingLockedReason'),
    detail.indexOf('const deliveryPlanEditingLocked =')
  );
  assert.doesNotMatch(deliveryPlanLockSource, /order\.is_draft/u);
  assert.doesNotMatch(deliveryPlanLockSource, /contract_status/u);
  assert.match(detail, /deliveryPlanEditingLockedReason=\{deliveryPlanEditingLockedReason\}/u);
  assert.match(itemsEditorClient, /deliveryPlanEditingLockedReason\?: string/u);
  assert.match(itemsEditor, /deliveryPlanEditingLockedReason\?: string/u);
  assert.match(itemsEditor, /const lockedDeliveryPlanReason = deliveryPlanEditingLocked/u);
  assert.match(itemsEditor, /<span className="inline-flex" title=\{transferActionTitle\}>/u);
  assert.match(itemsEditor, /aria-label=\{transferActionAriaLabel\}/u);
  assert.match(
    itemsEditor,
    /\{lockedDeliveryPlanReason \?\? 'Izberite postavke zgoraj in jih premaknite v poznejšo dobavo\.'\}/u
  );
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
    /\{externalEditMode \? \([\s\S]*?data-shipping-editor-row[\s\S]*?\) : \([\s\S]*?data-shipping-read-reason/u
  );
  assert.match(shippingOverride, /aria-pressed=\{externalEditMode\}/u);
  assert.match(shippingOverride, /onClick=\{onRequestEdit\}/u);
  assert.doesNotMatch(
    shippingOverride,
    /data-shipping-info-row|data-shipping-details-toggle|data-shipping-breakdown-panel|Spremembe poštnine veljajo le za to naročilo/u
  );
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
  assert.match(itemsEditor, /<col style=\{\{ width: '19%' \}\} \/>/u);
  assert.doesNotMatch(itemsEditor, /itemsEditable \? 'min-w-\[800px\]'/u);
  assert.match(itemsEditor, /const orderItemsValueInputClassName =/u);
  assert.match(itemsEditor, /const orderItemsReadValueClassName =[\s\S]*?inline-flex h-full w-full min-w-0/u);
  assert.match(itemsEditor, /!h-8 !px-2 !text-\[12px\] !leading-5/u);
  assert.equal(itemsEditor.match(/data-admin-order-item-value-input/gu)?.length, 3);
  assert.equal(itemsEditor.match(/data-admin-order-item-value-display/gu)?.length, 3);
  assert.equal(itemsEditor.match(/data-admin-order-item-value-slot=/gu)?.length, 3);
  assert.equal(itemsEditor.match(/readOnly=\{isItemsSaving\}/gu)?.length, 3);
  assert.doesNotMatch(itemsEditor, /tabIndex=\{itemsEditable \? undefined : -1\}/u);
  assert.match(itemsEditor, /data-admin-order-item-value-slot="quantity"[\s\S]*?commercialItemsEditable \? \([\s\S]*?data-admin-order-item-value-input[\s\S]*?: \([\s\S]*?data-admin-order-item-value-display/u);
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
  assert.match(
    itemsEditor,
    /<th className="border-b border-slate-200 py-4 pl-1\.5 pr-4 text-right text-\[12px\] font-semibold align-middle">\s*<span data-testid="admin-order-items-total-header">Skupaj brez DDV<\/span>/u
  );
  assert.match(
    itemsEditor,
    /className="py-3 pl-1\.5 pr-4 text-right font-semibold text-slate-900"\s*data-admin-order-item-total[\s\S]*?<span data-admin-order-item-total-value>/u
  );
  assert.doesNotMatch(
    itemsEditor,
    /py-4 pl-1\.5 pr-2 text-right text-\[12px\] font-semibold align-middle">Skupaj brez DDV/u
  );
  assert.doesNotMatch(
    itemsEditor,
    /py-3 pl-1\.5 pr-2 text-right font-semibold text-slate-900">\{formatCurrency\(lineTotal\)\}/u
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
test('unsaved order changes disable PDF creation and upload until saved', () => {
  assert.match(
    detail,
    /unsavedChangesReason=\{[\s\S]*?hasUnsavedChanges[\s\S]*?Pred ustvarjanjem ali nalaganjem PDF dokumentov najprej shranite spremembe\.[\s\S]*?: undefined[\s\S]*?generationDisabledReason=\{[\s\S]*?order\.is_draft/u
  );
  assert.match(
    pdfManager,
    /effectiveGenerationDisabledReason\s*=\s*unsavedChangesReason \?\? generationDisabledReason/u
  );
  assert.match(
    pdfManager,
    /const handleGenerate[\s\S]*?if \(effectiveGenerationDisabledReason\)[\s\S]*?toast\.info\(effectiveGenerationDisabledReason\)[\s\S]*?return;/u
  );
  assert.match(
    pdfManager,
    /const handleUpload[\s\S]*?if \(unsavedChangesReason\)[\s\S]*?toast\.info\(unsavedChangesReason\)[\s\S]*?return;/u
  );
  assert.ok(
    (pdfManager.match(/Boolean\(effectiveGenerationDisabledReason\) \|\|/gu)?.length ?? 0) >= 2,
    'direct and overflow generation actions must share the effective disabled reason'
  );
  assert.ok(
    (pdfManager.match(/Boolean\(unsavedChangesReason\) \|\|/gu)?.length ?? 0) >= 3,
    'direct and overflow upload actions must share the unsaved-change reason'
  );
  assert.match(pdfManager, /notice=\{effectiveGenerationDisabledReason\}/u);
});
