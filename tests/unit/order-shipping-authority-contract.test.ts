import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

const commerceSource = source('src/shared/server/orderCommerce.ts');
const orderRouteSource = source('src/commercial/api/orders/route.ts');
const orderPlacementSource = source('src/shared/server/orderPlacement.ts');
const confirmationSource = source(
  'src/commercial/api/orders/confirmation/route.ts'
);
const itemRouteSource = source(
  'src/admin/api/orders/[orderId]/items/route.ts'
);
const overrideRouteSource = source(
  'src/admin/api/orders/[orderId]/shipping/route.ts'
);
const emailJobSource = source('src/shared/server/orderEmailJobs.ts');
const emailTemplateSource = source(
  'src/shared/domain/order/orderEmailTemplates.ts'
);
const previewSource = source(
  'src/shared/domain/order/orderDocumentPreview.ts'
);
const pdfGenerationSource = source('src/shared/server/pdfGeneration.ts');
const documentRouteSource = source(
  'src/admin/api/orders/generateOrderDocumentRoute.ts'
);
const shippingRowsSource = source(
  'src/commercial/order/components/ShippingCalculationRows.tsx'
);
const summaryJobSource = source('src/shared/server/orderSummaryJobs.ts');
const orderDetailsSource = source(
  'src/admin/api/orders/[orderId]/details/route.ts'
);
const pdfManagerSource = source(
  'src/admin/features/orders/components/AdminOrderPdfManager.tsx'
);
const itemsEditorSource = source(
  'src/admin/features/orders/components/AdminOrderItemsEditor.tsx'
);
const uploadedDocumentRouteSource = source(
  'src/admin/api/orders/[orderId]/documents/route.ts'
);
const paymentStatusRouteSource = source(
  'src/admin/api/orders/[orderId]/payment-status/route.ts'
);
const statusRouteSource = source(
  'src/admin/api/orders/[orderId]/status/route.ts'
);
const archiveSource = source('src/shared/server/deletedArchive.ts');
const schemaSource = source('database/schema.sql');
const adminOrderPageSource = source('src/admin/pages/orders/[orderId]/page.tsx');
const ordersServerSource = source('src/shared/server/orders.ts');
const customerDocumentRouteSource = source(
  'src/commercial/api/orders/documents/[documentAccessId]/route.ts'
);
const adminDocumentDownloadRouteSource = source(
  'src/admin/api/orders/[orderId]/documents/[documentId]/route.ts'
);

test('server quote ignores browser shipping and resolves canonical variant-over-item measurements', () => {
  assert.match(orderRouteSource, /parseOrderSelections\(body\.items\)/u);
  assert.doesNotMatch(
    orderRouteSource,
    /body\.shipping(?!ConfigurationVersion)/u
  );
  assert.doesNotMatch(orderRouteSource, /body\.(?:weight|length|width|height)/u);

  for (const field of [
    'shipping_weight_grams',
    'shipping_length_mm',
    'shipping_width_mm',
    'shipping_height_mm'
  ]) {
    assert.match(commerceSource, new RegExp('ci\\.' + field, 'u'));
    assert.match(commerceSource, new RegExp('civ\\.' + field, 'u'));
  }
  assert.match(
    commerceSource,
    /row\.variant_shipping_weight_grams,[\s\S]*?row\.item_shipping_weight_grams/u
  );
  assert.match(commerceSource, /calculateShipping\(/u);
  assert.match(
    commerceSource,
    /getShippingConfiguration\(database, \{[\s\S]*?lockForTransaction: options\?\.lockVariants === true/u
  );
});

test('submit detects any authoritative quote change before insertion and returns the current quote', () => {
  assert.match(
    orderRouteSource,
    /readShippingConfigurationVersion\(body\)/u
  );
  assert.match(orderRouteSource, /readQuoteFingerprint\(body\)/u);
  assert.match(orderRouteSource, /QUOTE_FINGERPRINT_REQUIRED/u);
  assert.match(orderRouteSource, /SHIPPING_QUOTE_CHANGED/u);
  assert.match(
    orderRouteSource,
    /quote\.shippingConfigurationVersion !== shippingConfigurationVersion/u
  );
  assert.match(
    orderRouteSource,
    /quote\.quoteFingerprint !== submittedQuoteFingerprint/u
  );
  const conflictIndex = orderRouteSource.indexOf(
    'quote.shippingConfigurationVersion !== shippingConfigurationVersion'
  );
  const insertIndex = orderRouteSource.indexOf(
    'const inserted = await insertOrder'
  );
  assert.ok(conflictIndex >= 0);
  assert.ok(insertIndex > conflictIndex);
  assert.match(
    orderRouteSource,
    /shippingQuoteResponse\([\s\S]*?quote/u
  );
  assert.match(commerceSource, /ORDER_QUOTE_FINGERPRINT_VERSION/u);
  assert.match(commerceSource, /createHash\('sha256'\)/u);
  for (const fingerprintContext of [
    'selections',
    'customerContext',
    'catalogContext',
    'shippingMeasurement',
    'shippingConfiguration',
    'shippingCalculation',
    'totals',
    'taxRate'
  ]) {
    assert.match(commerceSource, new RegExp(fingerprintContext, 'u'));
  }
});

test('placement freezes shipping and line measurements instead of recalculating later', () => {
  for (const column of [
    'automatic_shipping',
    'shipping_snapshot_json',
    'shipping_override_json',
    'shipping_override_stale',
    'parcel_count'
  ]) {
    assert.match(orderPlacementSource, new RegExp(column, 'u'));
  }
  assert.match(schemaSource, /parcel_count integer not null default 1/u);
  assert.match(schemaSource, /parcel_count >= 1/u);
  assert.match(
    commerceSource,
    /calculateShipping\([\s\S]*?merchandiseSubtotalCents[\s\S]*?parcelCount/u
  );
  assert.match(orderPlacementSource, /shipping_override_stale,[\s\S]*?parcel_count/u);
  assert.match(orderPlacementSource, /JSON\.stringify\(input\.shipping\.snapshot\)/u);
  assert.match(orderPlacementSource, /JSON\.stringify\(item\.snapshot\)/u);
  assert.match(commerceSource, /shippingMeasurement/u);

  assert.match(
    confirmationSource,
    /shipping_snapshot_json[\s\S]*?shipping_override_json/u
  );
  assert.match(confirmationSource, /frozenShippingValue\(order\)/u);
  assert.match(confirmationSource, /parcelCount: order\.parcel_count/u);
  assert.match(emailJobSource, /subtotal,[\s\S]*?shipping,[\s\S]*?total/u);
  assert.doesNotMatch(emailJobSource, /calculateShipping\(/u);
});

test('manual overrides preserve their origin, support nullable automatic amounts, and render exact zero', () => {
  assert.match(overrideRouteSource, /automaticSnapshot\?\.status === 'manual_quote'/u);
  assert.match(overrideRouteSource, /automaticAmountCents === null/u);
  assert.match(overrideRouteSource, /SHIPPING_OVERRIDE_RESET_UNAVAILABLE/u);
  assert.match(overrideRouteSource, /SHIPPING_MAX_AMOUNT_CENTS/u);
  const manualOverrideUpdate = overrideRouteSource.slice(
    overrideRouteSource.lastIndexOf('update orders')
  );
  assert.doesNotMatch(manualOverrideUpdate, /shipping_snapshot_json\s*=/u);

  assert.match(confirmationSource, /frozenShippingOverrideValue\(order\)/u);
  assert.match(shippingRowsSource, /data-shipping-row="automatic-origin"/u);
  assert.match(shippingRowsSource, /Samodejni izračun/u);
  assert.match(shippingRowsSource, /Po dogovoru/u);
  assert.match(shippingRowsSource, /data-shipping-source="manual_override"/u);
  assert.match(shippingRowsSource, /formatEuro\(frozenOverride\.amount\)/u);
  assert.match(emailTemplateSource, /\['Dostava', order\.totals\.shipping\]/u);
  assert.match(previewSource, /context\.order\.shippingOverride === true/u);
  assert.match(
    pdfGenerationSource,
    /shippingOverride: Boolean\(order\.shipping_override_json\)/u
  );
});

test('admin item edits recalculate or preserve-and-stale shipping and document issuance is lock-consistent', () => {
  assert.match(itemRouteSource, /getShippingConfiguration\(client, \{/u);
  assert.match(itemRouteSource, /lockForTransaction: true/u);
  assert.match(
    itemRouteSource,
    /if \(itemDiff\)[\s\S]*?calculateShipping\([\s\S]*?if \(hasShippingOverride\)[\s\S]*?shippingOverrideStale = true/u,
    'edited items must refresh the automatic snapshot before leaving an override stale'
  );
  assert.match(itemRouteSource, /SHIPPING_MAX_AMOUNT_CENTS/u);
  assert.match(itemRouteSource, /ORDER_TOTAL_OUT_OF_RANGE/u);
  assert.match(itemRouteSource, /parcel_count/u);
  assert.match(
    itemRouteSource,
    /calculateShipping\([\s\S]*?merchandiseSubtotalCents[\s\S]*?parcelCount/u
  );
  assert.match(
    itemRouteSource,
    /delete from order_line_snapshots where order_id = \$1[\s\S]*?insert into order_line_snapshots[\s\S]*?from unnest\(\$2::bigint\[\]\) with ordinality/u,
    'authorized item edits must refresh the confirmation lines in request order'
  );
  assert.match(
    itemRouteSource,
    /\['partially_sent', 'sent', 'finished', 'cancelled'\]/u
  );
  assert.match(itemRouteSource, /from order_documents[\s\S]*?deleted_at is null/u);

  const lockIndex = documentRouteSource.indexOf(
    'select id, contract_status from orders where id = $1 for update'
  );
  const lockedContextIndex = documentRouteSource.indexOf(
    'buildPdfContext(client, orderId)'
  );
  const renderIndex = documentRouteSource.indexOf('await generateOrderPdf');
  assert.ok(lockIndex >= 0);
  assert.ok(lockedContextIndex > lockIndex);
  assert.ok(renderIndex > lockedContextIndex);

  const summaryLockIndex = summaryJobSource.indexOf(
    'select deleted_at from orders where id = $1 for update'
  );
  const summaryContextIndex = summaryJobSource.indexOf(
    'buildPdfContext(client, orderId)'
  );
  const summaryRenderIndex = summaryJobSource.indexOf('await generateOrderPdf');
  assert.ok(summaryLockIndex >= 0);
  assert.ok(summaryContextIndex > summaryLockIndex);
  assert.ok(summaryRenderIndex > summaryContextIndex);
  assert.match(
    summaryJobSource.slice(summaryContextIndex, summaryRenderIndex),
    /validatePersistedOrderShippingReadiness/u,
    'a queued summary must not issue while an override or frozen line set is stale'
  );
  assert.doesNotMatch(
    summaryJobSource.slice(summaryContextIndex, summaryRenderIndex),
    /payload\.(?:totals|items|shipping)/u,
    'the queued summary must render the locked current order, not enqueue-time totals'
  );

  assert.match(orderDetailsSource, /for update[\s\S]*?validatePersistedOrderShippingReadiness/u);
  assert.match(orderDetailsSource, /ORDER_DRAFT_SHIPPING_INCOMPLETE/u);
  assert.match(documentRouteSource, /ORDER_DRAFT_DOCUMENT_BLOCKED/u);
  assert.match(documentRouteSource, /validatePersistedOrderShippingReadiness/u);
  assert.match(pdfManagerSource, /generationDisabledReason/u);
});

test('manual-quote drafts persist safely before a reasoned override', () => {
  assert.match(
    itemRouteSource,
    /else if \(order\.is_draft === true\)[\s\S]*?shipping = 0;[\s\S]*?automaticShipping = null;[\s\S]*?shippingSnapshot = shippingCalculation/u
  );
  assert.match(
    itemRouteSource,
    /shippingSource: 'automatic' \| 'manual_override' \| 'manual_quote'/u
  );
  assert.match(
    itemsEditorSource,
    /const shippingContextLabel = shippingManualQuote[\s\S]*?`Po dogovoru\$\{shippingIsStale/u
  );
  assert.match(itemsEditorSource, /Potreben je ročni znesek/u);
});

test('operational state is readiness-gated and opaque financial PDFs cannot be uploaded', () => {
  assert.match(uploadedDocumentRouteSource, /ALLOWED_DOCUMENT_TYPES = new Set\(\['purchase_order'\]\)/u);
  assert.doesNotMatch(
    uploadedDocumentRouteSource,
    /ALLOWED_DOCUMENT_TYPES[\s\S]*?'(?:order_summary|predracun|dobavnica|invoice)'/u
  );
  assert.match(pdfManagerSource, /pdfType\.key === 'purchase_order'/u);
  assert.match(paymentStatusRouteSource, /validateLockedOrderShippingReadiness/u);
  assert.match(paymentStatusRouteSource, /ORDER_PAYMENT_SHIPPING_NOT_READY/u);
  assert.match(statusRouteSource, /if \(status === 'cancelled'\)[\s\S]*?shouldEnqueueStatusEmail = false/u);
  assert.match(statusRouteSource, /customer_notification_suppressed/u);
  assert.match(statusRouteSource, /ORDER_STATUS_SHIPPING_NOT_READY/u);
});

test('pricing revisions prevent stale archived output from becoming operational again', () => {
  assert.match(schemaSource, /pricing_revision integer not null default 1/u);
  assert.match(schemaSource, /order_pricing_revision integer not null default 1/u);
  assert.match(itemRouteSource, /pricing_revision = pricing_revision \+ case when \$8 then 1 else 0 end/u);
  assert.match(itemRouteSource, /returning pricing_revision/u);
  assert.match(itemRouteSource, /pricingRevision: responsePayload\.pricingRevision/u);
  assert.match(overrideRouteSource, /pricing_revision = pricing_revision \+ 1/u);
  assert.match(documentRouteSource, /order_pricing_revision/u);
  assert.match(summaryJobSource, /order_pricing_revision/u);
  assert.match(uploadedDocumentRouteSource, /order_pricing_revision/u);
  assert.match(archiveSource, /d\.order_pricing_revision <> o\.pricing_revision/u);
  assert.doesNotMatch(
    archiveSource,
    /d\.type = any\([\s\S]*?d\.order_pricing_revision <> o\.pricing_revision/u
  );
  assert.match(archiveSource, /ArchiveRestoreConflictError/u);
});

test('admin detail and active document readers use one current-revision snapshot', () => {
  assert.match(adminOrderPageSource, /fetchOrderDetailSnapshot\(orderId\)/u);
  assert.doesNotMatch(adminOrderPageSource, /Promise\.all/u);
  assert.match(
    ordersServerSource,
    /fetchOrderDetailSnapshot[\s\S]*?begin isolation level repeatable read read only[\s\S]*?from orders[\s\S]*?from order_items[\s\S]*?from order_documents/u
  );
  assert.match(
    ordersServerSource,
    /d\.order_pricing_revision = o\.pricing_revision/u
  );
  assert.match(
    customerDocumentRouteSource,
    /d\.order_pricing_revision = o\.pricing_revision/u
  );
  assert.match(
    adminDocumentDownloadRouteSource,
    /d\.order_pricing_revision = o\.pricing_revision/u
  );
});

test('existing order lines cannot borrow another variant shipping identity', () => {
  assert.match(itemRouteSource, /ORDER_ITEM_CATALOG_IDENTITY_MISMATCH/u);
  assert.match(itemRouteSource, /item\.catalogVariantId !== persistedVariantId/u);
  assert.match(
    itemRouteSource,
    /metadataInputItems[\s\S]*?catalogVariantId: normalizeOptionalId\(oldRow\?\.catalog_variant_id\)[\s\S]*?resolveCatalogMetadata/u
  );
});
