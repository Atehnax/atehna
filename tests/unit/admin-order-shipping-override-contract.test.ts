import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

const routeSource = source(
  'src/admin/api/orders/[orderId]/shipping/route.ts'
);
const appRouteSource = source(
  'src/app/api/admin/orders/[orderId]/shipping/route.ts'
);
const editorSource = source(
  'src/admin/features/orders/components/AdminOrderShippingOverride.tsx'
);
const detailSource = source(
  'src/admin/features/orders/components/AdminOrderDetailClient.tsx'
);
const ordersTableSource = source(
  'src/admin/features/orders/components/AdminOrdersTable.tsx'
);
const manualShippingPendingValueSource = source(
  'src/admin/features/shipping/components/AdminManualShippingPendingValue.tsx'
);
const itemsEditorSource = source(
  'src/admin/features/orders/components/AdminOrderItemsEditor.tsx'
);
const ordersPageSource = source('src/admin/pages/orders/page.tsx');
const orderAnalyticsSource = source('src/shared/server/businessAnalytics.ts');
const ordersServerSource = source('src/shared/server/orders.ts');

test('admin shipping mutation validates exact cents and row-locks every mutable order', () => {
  assert.match(appRouteSource, /admin\/api\/orders\/\[orderId\]\/shipping\/route/u);
  assert.match(routeSource, /export async function POST/u);
  assert.match(routeSource, /action !== 'override'[\s\S]*?action !== 'reset'[\s\S]*?action !== 'set_parcel_count'/u);
  assert.match(routeSource, /!isSupportedCents\(amountCents\)/u);
  assert.match(routeSource, /SHIPPING_MAX_AMOUNT_CENTS/u);
  assert.match(routeSource, /action === 'override' && !reason/u);
  assert.match(routeSource, /from orders[\s\S]*?where id = \$1[\s\S]*?for update/u);
  assert.match(routeSource, /deleted_at,\s+subtotal,\s+tax,\s+shipping,/u);
  assert.match(routeSource, /BigInt\(match\[1\]\) \* 100n/u);
  assert.match(routeSource, /centsToDecimalMoney\(nextShippingCents\)/u);
  assert.match(
    routeSource,
    /const nextTotalCents = subtotalCents \+ taxCents \+ nextShippingCents/u
  );
  assert.match(routeSource, /nextTotalCents > SHIPPING_MAX_AMOUNT_CENTS/u);

  const totalGuardIndex = routeSource.indexOf('SHIPPING_OVERRIDE_TOTAL_OUT_OF_RANGE');
  const updateIndex = routeSource.indexOf('const updateResult = await client.query');
  assert.ok(totalGuardIndex >= 0);
  assert.ok(updateIndex > totalGuardIndex);
});

test('admin shipping mutation keeps hard workflow locks while issued documents remain historical', () => {
  for (const status of [
    'partially_sent',
    'sent',
    'finished',
    'cancelled'
  ]) {
    assert.ok(routeSource.includes("'" + status + "'"));
  }
  for (const paymentStatus of ['paid', 'refunded']) {
    assert.ok(routeSource.includes("'" + paymentStatus + "'"));
  }

  for (const code of [
    'SHIPPING_OVERRIDE_ORDER_DELETED',
    'SHIPPING_OVERRIDE_PAYMENT_LOCKED',
    'SHIPPING_OVERRIDE_STATUS_LOCKED'
  ]) {
    assert.match(routeSource, new RegExp(code, 'u'));
  }
  assert.doesNotMatch(routeSource, /SHIPPING_OVERRIDE_DOCUMENT_ISSUED/u);
  assert.match(
    routeSource,
    /from order_documents[\s\S]*?deleted_at is null[\s\S]*?order_pricing_revision = \$3[\s\S]*?for share/u
  );
  assert.match(
    routeSource,
    /action === 'set_parcel_count'[\s\S]*?source_quote_offer_version_id !== null[\s\S]*?QUOTE_DERIVED_ORDER_PARCEL_COUNT_LOCKED/u
  );
  assert.match(
    routeSource,
    /const requiresExplicitConfirmation =[\s\S]*?hasShippingBearingDocument/u
  );
  assert.match(routeSource, /NextResponse\.json\(\{ code, message \}, \{ status: 409 \}\)/u);
});

test('override metadata preserves the automatic snapshot and audit is transactional', () => {
  for (const field of [
    'reason',
    'automaticAmountCents',
    'originalAmountCents',
    'overrideAmountCents',
    'actorId',
    'actorName',
    'appliedAt'
  ]) {
    assert.match(routeSource, new RegExp(field, 'u'));
  }

  assert.match(routeSource, /shipping_snapshot_json = \$3::jsonb/u);
  assert.match(routeSource, /shipping_snapshot_json/u);
  assert.match(routeSource, /automaticSnapshot\?\.status === 'calculated'/u);
  assert.match(routeSource, /automaticSnapshot\?\.status === 'manual_quote'/u);
  assert.match(routeSource, /snapshotAutomaticAmountCents === automaticAmountCents/u);
  assert.doesNotMatch(routeSource, /decimalMoneyToCents\(order\.shipping\) \?\? 0/u);
  assert.match(routeSource, /shipping_override_json = \$2::jsonb/u);
  assert.match(routeSource, /shipping_override_stale = false/u);
  assert.match(routeSource, /total = subtotal \+ tax \+ \$1::numeric/u);
  assert.match(routeSource, /automaticAmountCents === null/u);
  assert.match(routeSource, /SHIPPING_OVERRIDE_RESET_UNAVAILABLE/u);
  assert.match(routeSource, /originalAmountCents: number \| null/u);

  const updateIndex = routeSource.indexOf('const updateResult = await client.query');
  const auditIndex = routeSource.indexOf('await insertAuditEventForRequest');
  const commitIndex = routeSource.indexOf("await client.query('commit')");
  assert.ok(updateIndex >= 0);
  assert.ok(auditIndex > updateIndex);
  assert.ok(commitIndex > auditIndex);
});

test('order detail stages lock-aware shipping changes behind the page-level save action', () => {
  assert.match(detailSource, /AdminOrderShippingOverride/u);
  assert.match(detailSource, /automaticShipping=\{order\.automatic_shipping \?\? null\}/u);
  assert.match(detailSource, /shippingCalculation=\{order\.shipping_snapshot_json \?\? null\}/u);
  assert.match(detailSource, /shippingOverride=\{order\.shipping_override_json \?\? null\}/u);
  assert.match(
    detailSource,
    /hasActiveDocuments=\{documents\.some\([\s\S]*?isShippingBearingOrderPdfType\(document\.type\)/u
  );
  assert.match(detailSource, /quoteDerived=\{order\.source_quote_offer_version_id !== null\}/u);
  assert.match(detailSource, /parcelCount=\{order\.parcel_count\}/u);
  assert.match(detailSource, /pricingRevision=\{order\.pricing_revision\}/u);
  assert.match(detailSource, /externalEditMode=\{isShippingEditing\}/u);
  assert.match(detailSource, /onRequestEdit=\{\(\) => toggleSectionEdit\('shipping'\)\}/u);
  assert.match(detailSource, /onDirtyChange=\{setShippingDirty\}/u);
  assert.match(detailSource, /onSavingChange=\{setShippingSaving\}/u);
  assert.match(detailSource, /onPricingRevisionChange=\{updateLatestPricingRevision\}/u);
  assert.match(detailSource, /onRegisterSave=\{registerShippingSaveHandler\}/u);

  assert.match(editorSource, /data-shipping-final-amount/u);
  assert.match(editorSource, /data-shipping-mode/u);
  assert.match(editorSource, /currentOverride !== null/u);
  assert.match(editorSource, /automaticAmountCents !== null/u);
  assert.doesNotMatch(editorSource, /automaticCalculationAvailable/u);
  assert.match(editorSource, /automaticAmountCents !== null/u);
  assert.match(editorSource, /formatCents\(finalAmountCents\)/u);
  assert.match(editorSource, /action: 'override'/u);
  assert.match(editorSource, /action: 'reset'/u);
  assert.doesNotMatch(editorSource, /router\.refresh\(\)/u);
  assert.match(editorSource, /data-shipping-lock-message/u);
  const lockMessageSource = editorSource.slice(
    editorSource.indexOf('function getLockMessage'),
    editorSource.indexOf('function isShippingMutationResponse')
  );
  assert.doesNotMatch(lockMessageSource, /hasActiveDocuments/u);
  assert.match(editorSource, /data-parcel-count-control/u);
  assert.match(editorSource, /(?:Š|\\u0160)tevilo paketov, oddanih skupaj/u);
  assert.match(editorSource, /action: 'set_parcel_count'/u);
  assert.match(editorSource, /expectedPricingRevision: workingPricingRevision/u);
  assert.match(editorSource, /confirmLockedRecalculation: confirmedReason !== null/u);
  assert.match(editorSource, /onDirtyChange\?\.\(shippingDirty\)/u);
  assert.match(editorSource, /saveDraftRef\.current\(expectedPricingRevision\)/u);
  assert.match(editorSource, /parcelConfirmationResolverRef/u);
  assert.match(editorSource, /setDraftMode\('automatic'\)/u);
  assert.doesNotMatch(editorSource, /orderEditing|hasUnsavedOrderChanges/u);
});

test('shipping card keeps one shared blue icon-only edit action and no independent save', () => {
  assert.match(editorSource, /adminCardSectionEditIconButtonClassName/u);
  assert.equal(editorSource.match(/<PencilIcon className="h-4 w-4" \/>/gu)?.length, 1);
  assert.match(editorSource, /data-admin-card-edit-action="shipping"/u);
  assert.match(editorSource, /aria-pressed=\{externalEditMode\}/u);
  assert.match(
    editorSource,
    /aria-label=\{externalEditMode \? 'Končaj urejanje poštnine' : 'Uredi poštnino'\}/u
  );
  assert.match(editorSource, /onClick=\{onRequestEdit\}/u);
  assert.doesNotMatch(editorSource, />\s*Uredi\s*<|Shrani ročni znesek|Shrani število paketov/u);
});

test('shipping card mirrors the persistent reference hierarchy without a redundant footer', () => {
  const renderStart = editorSource.indexOf('data-testid="admin-order-shipping-card"');
  const renderEnd = editorSource.indexOf('<ConfirmDialog', renderStart);
  const renderSource = editorSource.slice(renderStart, renderEnd);

  assert.ok(renderStart >= 0 && renderEnd > renderStart);
  assert.match(editorSource, /adminWindowCardClassName \+ ' overflow-hidden !p-0'/u);

  const summaryStart = renderSource.indexOf('data-shipping-summary-row');
  const readReasonStart = renderSource.indexOf('data-shipping-read-reason');
  const automaticStart = renderSource.indexOf('data-shipping-automatic-summary');

  assert.ok(summaryStart >= 0);
  assert.ok(readReasonStart > summaryStart);
  assert.ok(automaticStart > readReasonStart);

  assert.match(renderSource, /\{externalEditMode \? \([\s\S]*?data-shipping-editor-row[\s\S]*?\) : \([\s\S]*?data-shipping-read-reason/u);
  assert.match(renderSource, /sm:grid-cols-\[72px_96px_minmax\(120px,1fr\)\]/u);
  assert.match(
    renderSource,
    /<label className="block min-w-0">\s*<span[^>]*>\s*Razlog spremembe/u
  );
  assert.doesNotMatch(renderSource, /sm:col-span-2/u);
  assert.match(
    renderSource,
    /data-parcel-count-control[\s\S]*?disabled=\{parcelCountControlsDisabled\}/u
  );
  assert.match(
    renderSource,
    /value=\{amountInput\}[\s\S]*?setDraftMode\('override'\);[\s\S]*?disabled=\{controlsDisabled\}/u
  );
  assert.match(
    renderSource,
    /value=\{reason\}[\s\S]*?setDraftMode\('override'\);[\s\S]*?disabled=\{controlsDisabled\}/u
  );

  assert.match(renderSource, /Samodejni izračun/u);
  assert.match(renderSource, /automaticSummaryLabel/u);
  assert.match(
    renderSource,
    /className="flex min-h-11 items-center gap-2 px-4 py-2"\s*data-shipping-summary-row/u
  );
  assert.match(
    renderSource,
    /className="grid min-h-10 grid-cols-\[112px_minmax\(0,1fr\)\] items-center gap-3 px-4 py-1\.5"\s*data-shipping-read-reason/u
  );
  assert.match(
    renderSource,
    /className="grid min-h-12 gap-2 border-t border-slate-200 px-4 py-1\.5 sm:grid-cols-\[minmax\(0,1fr\)_auto\] sm:items-center"\s*data-shipping-automatic-summary/u
  );
  assert.match(renderSource, /!h-7 !px-2 !text-\[11px\] !leading-4/u);
  assert.doesNotMatch(renderSource, /min-h-\[(?:56|72|84)px\]|text-lg/u);
  assert.match(renderSource, /disabled=\{!canRequestReset\}/u);
  assert.match(
    renderSource,
    /if \(!externalEditMode\) onRequestEdit\(\);\s*setResetDialogOpen\(true\);/u
  );
  assert.match(
    renderSource,
    /<IconButton[\s\S]*?aria-label="Uporabi samodejno poštnino"[\s\S]*?data-testid="admin-order-shipping-reset-button"[\s\S]*?<Calculator/u
  );
  assert.doesNotMatch(renderSource, />\s*Uporabi samodejno\s*</u);

  assert.doesNotMatch(
    renderSource,
    /data-shipping-info-row|data-shipping-details-toggle|data-shipping-breakdown-panel|Spremembe poštnine veljajo le za to naročilo/u
  );

  const lockWarning = renderSource.indexOf('data-shipping-lock-message');
  assert.ok(lockWarning >= 0 && lockWarning < automaticStart);
  assert.doesNotMatch(renderSource, /data-shipping-override-stale|data-shipping-warning/u);
  assert.doesNotMatch(renderSource, /<(?:details|summary)\b|⌄/u);
  assert.doesNotMatch(editorSource, /compactTextareaClassName/u);
});

test('parcel-count repricing is frozen, revision-checked, explicitly confirmed when locked, and audited atomically', () => {
  assert.match(routeSource, /recalculateShippingFromSnapshot/u);
  assert.match(routeSource, /automaticSnapshot as unknown as CalculatedShipping/u);
  assert.match(routeSource, /ORDER_PRICING_REVISION_CHANGED/u);
  assert.match(routeSource, /PARCEL_COUNT_RECALCULATION_CONFIRMATION_REQUIRED/u);
  assert.match(routeSource, /confirmLockedRecalculation/u);
  assert.match(routeSource, /SHIPPING_MAX_PARCEL_COUNT/u);
  assert.match(routeSource, /recalculationAuthorization/u);
  assert.match(routeSource, /set parcel_count = \$1/u);
  assert.match(routeSource, /automatic_shipping = \$2::numeric/u);
  assert.match(routeSource, /shipping_snapshot_json = \$3::jsonb/u);
  assert.match(routeSource, /pricing_revision = pricing_revision \+ 1/u);
  assert.match(routeSource, /parcel_count:[\s\S]*?before: String\(currentParcelCount\)[\s\S]*?after: String\(parcelCount\)/u);
  assert.match(routeSource, /matchedMultiPieceDiscountRule/u);
  assert.match(routeSource, /matchedOrderValueDiscountRule/u);
  assert.match(routeSource, /manualOverrideStalePreserved: nextOverrideStale/u);
  assert.match(routeSource, /shipping_override_stale = \$5::boolean/u);
  assert.match(editorSource, /max=\{SHIPPING_MAX_PARCEL_COUNT\}/u);
  assert.match(editorSource, /typeof record\.shippingOverrideStale === 'boolean'/u);

  const parcelUpdateIndex = routeSource.indexOf('set parcel_count = $1');
  const parcelAuditIndex = routeSource.indexOf('število paketov in poštnina preračunana');
  const parcelCommitIndex = routeSource.indexOf("await client.query('commit')", parcelAuditIndex);
  assert.ok(parcelUpdateIndex >= 0);
  assert.ok(parcelAuditIndex > parcelUpdateIndex);
  assert.ok(parcelCommitIndex > parcelAuditIndex);
});

test('pending manual-quote drafts never present the stored zero placeholder as final', () => {
  assert.match(
    editorSource,
    /const shippingPending =\s*currentOverride === null[\s\S]*?currentCalculation\?\.status === 'manual_quote'[\s\S]*?automaticAmountCents === null/u
  );
  assert.match(editorSource, /shippingPending\s*\? 'pending'/u);
  assert.match(editorSource, /shippingPending[\s\S]*?'—'[\s\S]*?: formatCents\(finalAmountCents\)/u);
  assert.doesNotMatch(editorSource, /Potreben je ročni znesek/u);
  assert.match(
    editorSource,
    /shippingOverride[\s\S]*?formatCentsInput\(shippingOverride\.overrideAmountCents\)[\s\S]*?automaticShipping === null[\s\S]*?\? ''/u
  );

  assert.match(
    ordersTableSource,
    /const isOrderShippingPending = \([\s\S]*?automatic_shipping === null && !order\.shipping_override_json/u
  );
  assert.match(ordersTableSource, /totalLabel: shippingPending[\s\S]*?\? 'N\/A'/u);
  assert.match(
    ordersTableSource,
    /shippingPending \? \([\s\S]*?<AdminManualShippingPendingValue/u
  );
  assert.doesNotMatch(
    ordersTableSource,
    /poštnina \$\{formatCurrency\(effectiveOrder\.shipping\)\}/u
  );
  assert.doesNotMatch(
    ordersTableSource,
    /Poštnina po dogovoru · potreben je ročni znesek/u
  );
  assert.match(
    manualShippingPendingValueSource,
    /MANUAL_SHIPPING_TOOLTIP_TEXT = 'Za poštnino je potreben ročni vnos'/u
  );
  assert.match(manualShippingPendingValueSource, /tabIndex=\{0\}/u);
  assert.match(
    manualShippingPendingValueSource,
    /aria-label=\{`N\/A\. \$\{MANUAL_SHIPPING_TOOLTIP_TEXT\}`\}/u
  );
  assert.match(manualShippingPendingValueSource, /role="tooltip"/u);
  assert.match(manualShippingPendingValueSource, /onFocus=\{openForFocus\}/u);
  assert.match(manualShippingPendingValueSource, /onMouseEnter=\{openForHover\}/u);
  assert.match(manualShippingPendingValueSource, />\s*N\/A\s*\{/u);

  assert.match(
    itemsEditorSource,
    /const shippingPending = shippingManualQuote && !hasShippingOverride/u
  );
  assert.match(
    itemsEditorSource,
    /shippingPending \? 'Ni dokončen' : formatCurrency\(totals\.total\)/u
  );
});

test('draft orders stay visible in the list but are excluded from financial analytics', () => {
  assert.match(
    ordersPageSource,
    /fetchOrdersListPage\(\{[\s\S]*?includeDrafts: true/u
  );
  assert.match(
    ordersPageSource,
    /fetchBusinessOrderPreview\(\)/u
  );
  assert.match(
    orderAnalyticsSource,
    /order_record\.is_draft = false/u
  );
  assert.match(
    ordersServerSource,
    /fetchOrdersListPage/u
  );
});
