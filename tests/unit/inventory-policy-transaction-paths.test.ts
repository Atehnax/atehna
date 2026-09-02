import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

const commerce = source('src/shared/server/orderCommerce.ts');
const placement = source('src/shared/server/orderPlacement.ts');
const catalogLocks = source(
  'src/shared/server/catalogOrderabilityLocks.ts'
);
const directCheckout = source('src/commercial/api/orders/route.ts');
const quoteAcceptance = source(
  'src/commercial/api/quote-requests/accept/route.ts'
);
const schoolAcceptance = source(
  'src/shared/server/schoolOrderSellerAcceptance.ts'
);
const draftDetails = source(
  'src/admin/api/orders/[orderId]/details/route.ts'
);
const orderStatus = source(
  'src/admin/api/orders/[orderId]/status/route.ts'
);
const orderItems = source('src/admin/api/orders/[orderId]/items/route.ts');
const confirmation = source(
  'src/commercial/api/orders/confirmation/route.ts'
);
const stockHolds = source('src/shared/server/orderStockHolds.ts');
const schema = source('database/schema.sql');
const markerMigration = source(
  'database/migrations/20260901_order_stock_enforcement_marker.sql'
);

test('authoritative estimates keep all orderability rules but make only stock quantity policy-aware', () => {
  assert.match(
    commerce,
    /const stockEnforcementEnabled = enforceOrderability[\s\S]*?isStockEnforcementEnabled\(database\)/u
  );
  assert.match(commerce, /if \(selection\.quantity < minOrder\)/u);
  assert.match(
    commerce,
    /if \(stockEnforcementEnabled && selection\.quantity > availableStock\)/u
  );
  assert.match(commerce, /code: 'VARIANT_NOT_AVAILABLE'/u);
});

test('central order placement commits stock only when requested and globally enabled', () => {
  assert.match(
    placement,
    /input\.stockEnforcementEnabled \?\?[\s\S]*?isStockEnforcementEnabled\(client\)/u
  );
  assert.match(
    placement,
    /const shouldCommitStock = input\.commitStock && stockEnforcementEnabled/u
  );
  assert.match(
    placement,
    /stockEnforcementApplied: shouldCommitStock/u
  );
  assert.match(placement, /stock_enforcement_applied/u);
  assert.match(
    placement,
    /contractEvidence \? JSON\.stringify\(contractEvidence\) : null,[\s\S]*?stockEnforcementEnabled,[\s\S]*?input\.sourceQuoteOfferVersionId/u
  );
  assert.match(
    placement,
    /if \(shouldCommitStock\) \{[\s\S]*?commitOrderStockHolds/u
  );
  assert.match(placement, /stockNotCommitted: !shouldCommitStock/u);

  assert.match(stockHolds, /where id = \$2[\s\S]*?and inventory >= \$1/u);
  assert.match(stockHolds, /set inventory = inventory - \$1/u);
});

test('online quote acceptance ignores stock quantities and sticky stock blocks only while enforcement is enabled', () => {
  assert.match(
    quoteAcceptance,
    /const stockEnforcementEnabled = await isStockEnforcementEnabled\(client\)/u
  );
  assert.match(
    quoteAcceptance,
    /stockEnforcementEnabled && stockAcceptanceMode === 'automatic'/u
  );
  assert.match(
    quoteAcceptance,
    /\(stockEnforcementEnabled && variant\.inventory < item\.quantity\)/u
  );
  assert.match(
    quoteAcceptance,
    /lockAndValidateCatalog\(client, items, stockEnforcementEnabled\)/u
  );
  assert.match(
    quoteAcceptance,
    /requireLockedCatalogVariantOrderable\([\s\S]*?if \(stockEnforcementEnabled && variant\.inventory < item\.quantity\)/u
  );
  assert.match(
    quoteAcceptance,
    /if \(error instanceof CatalogOrderabilityError\)[\s\S]*?code: error\.code[\s\S]*?if \(error instanceof OrderStockConflictError\)/u
  );
  assert.match(
    catalogLocks,
    /export class CatalogOrderabilityError[\s\S]*?CATALOG_ITEM_NOT_ORDERABLE/u
  );
});

test('school and manual acceptance skip stock finalization when disabled and persist the outcome', () => {
  assert.match(
    schoolAcceptance,
    /requireLockedCatalogVariantOrderable\([\s\S]*?if \(stockEnforcementEnabled && variant\.inventory < quantity\)/u
  );
  assert.match(
    schoolAcceptance,
    /stockEnforcementEnabled &&[\s\S]*?sourceQuote\.stockBlocked/u
  );
  assert.match(
    schoolAcceptance,
    /stock_enforcement_applied = \$5/u
  );
  assert.match(
    schoolAcceptance,
    /if \(stockEnforcementEnabled\) \{[\s\S]*?commitOrderStockHolds[\s\S]*?not_required_stock_enforcement_disabled/u
  );
  assert.match(
    schoolAcceptance,
    /if \(error instanceof CatalogOrderabilityError\)[\s\S]*?persistConflictOutcome: false/u
  );

  assert.match(
    draftDetails,
    /stockEnforcementEnabled[\s\S]*?commitOrderStockHolds/u
  );
  assert.match(
    draftDetails,
    /not_required_stock_enforcement_disabled/u
  );
  assert.match(
    draftDetails,
    /stock_enforcement_applied = case[\s\S]*?when \$21::boolean then \$22::boolean/u
  );
  assert.match(
    draftDetails,
    /select count\(\*\)::int as active_hold_count[\s\S]*?from order_stock_holds[\s\S]*?where order_id = \$1[\s\S]*?and state = 'held'/u
  );
  assert.match(
    draftDetails,
    /stockEnforcementAppliedAfterDraftFinalization\(\{[\s\S]*?stockEnforcementEnabled,[\s\S]*?hasActiveStockHolds: activeStockHoldCountBeforeFinalization > 0/u
  );
  assert.match(
    draftDetails,
    /finalizesDraft,[\s\S]*?finalizedStockEnforcementApplied/u
  );

  assert.match(
    orderStatus,
    /const shouldCommitDirectStock =[\s\S]*?stockEnforcementEnabled/u
  );
  assert.match(
    orderStatus,
    /stock_enforcement_applied = \$4/u
  );
  assert.match(
    orderStatus,
    /committed_after_policy_reenabled/u
  );
});

test('direct checkout uses one policy snapshot through estimate and placement', () => {
  assert.match(
    directCheckout,
    /const stockEnforcementEnabled =[\s\S]*?isStockEnforcementEnabled\(client\)/u
  );
  assert.match(
    directCheckout,
    /buildAuthoritativeOrderQuote\(client, selections,[\s\S]*?stockEnforcementEnabled/u
  );
  assert.match(
    directCheckout,
    /insertOrder\([\s\S]*?stockEnforcementEnabled[\s\S]*?stockEnforcementEnabled,/u
  );
  assert.match(
    directCheckout,
    /stock-enforcement-disabled/u
  );
  assert.match(
    directCheckout,
    /error instanceof OrderStockConflictError[\s\S]*?status: 409/u
  );
});

test('admin item edits follow the durable order marker without abandoning existing tracked ledgers', () => {
  assert.match(orderItems, /stock_enforcement_applied,/u);
  assert.match(
    orderItems,
    /order\.stock_enforcement_applied !== false &&[\s\S]*?order\.commitment_status === 'binding'/u
  );
  assert.doesNotMatch(orderItems, /isStockEnforcementEnabled/u);
  assert.match(
    orderItems,
    /select 1 from order_stock_holds where order_id = \$1 limit 1/u
  );
  assert.match(
    confirmation,
    /order\.stock_enforcement_applied === false/u
  );
});

test('per-order marker defaults tracked for legacy safety and is installed additively', () => {
  assert.match(
    schema,
    /stock_enforcement_applied boolean not null default true/u
  );
  assert.match(
    markerMigration,
    /add column if not exists stock_enforcement_applied boolean/u
  );
  assert.match(
    markerMigration,
    /set stock_enforcement_applied = true[\s\S]*?where stock_enforcement_applied is null/u
  );
  assert.match(markerMigration, /set default true/u);
  assert.match(markerMigration, /set not null/u);
});

test('cancellation and rejection continue releasing prior holds independent of the global switch', () => {
  assert.doesNotMatch(stockHolds, /isStockEnforcementEnabled/u);
  assert.match(
    stockHolds,
    /export async function releaseOrderStockHolds[\s\S]*?set inventory = inventory \+ \$1/u
  );
  assert.match(
    orderStatus,
    /if \(status === 'cancelled'\) \{[\s\S]*?releaseOrderStockHolds/u
  );
});
