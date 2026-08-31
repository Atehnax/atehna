import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { validateOrderDeliveryPlanForStatus } from '../../src/shared/domain/order/orderDeliveryPlan';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

test('partial delivery requires both current and deferred lines', () => {
  assert.deepEqual(
    validateOrderDeliveryPlanForStatus('partially_sent', {
      currentItemCount: 2,
      laterItemCount: 1
    }),
    { ok: true }
  );
  assert.equal(
    validateOrderDeliveryPlanForStatus('partially_sent', {
      currentItemCount: 3,
      laterItemCount: 0
    }).ok,
    false
  );
  assert.equal(
    validateOrderDeliveryPlanForStatus('partially_sent', {
      currentItemCount: 0,
      laterItemCount: 3
    }).ok,
    false
  );
});

test('sent and finished orders cannot retain deferred lines', () => {
  for (const status of ['sent', 'finished']) {
    const blocked = validateOrderDeliveryPlanForStatus(status, {
      currentItemCount: 2,
      laterItemCount: 1
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.code, 'DEFERRED_ITEMS_REMAIN');

    assert.deepEqual(
      validateOrderDeliveryPlanForStatus(status, {
        currentItemCount: 3,
        laterItemCount: 0
      }),
      { ok: true }
    );
  }
});

test('schema and additive migration preserve existing lines in the current shipment', () => {
  const schema = source('database/schema.sql');
  const migration = source(
    'database/migrations/20260831_order_item_delivery_plan.sql'
  );
  const types = source('src/shared/domain/order/orderTypes.ts');
  const mapping = source('src/shared/server/orders.ts');

  assert.match(schema, /ship_later boolean not null default false/u);
  assert.match(schema, /delivery_plan_revision integer not null default 1/u);
  assert.match(schema, /order_delivery_plan_revision integer not null default 1/u);
  assert.match(schema, /order_id, ship_later, id/u);
  assert.match(
    migration,
    /lock table orders, order_items, order_documents in share row exclusive mode/u
  );
  assert.match(migration, /add column if not exists ship_later boolean not null default false/u);
  assert.match(migration, /add column if not exists delivery_plan_revision integer not null default 1/u);
  assert.match(migration, /add column if not exists order_delivery_plan_revision integer not null default 1/u);
  assert.match(migration, /item_definition is distinct from 'boolean:NO'/u);
  assert.match(types, /ship_later: boolean/u);
  assert.match(mapping, /ship_later: rawRow\.ship_later === true/u);
});

test('delivery-plan endpoint replaces the complete classification without repricing', () => {
  const route = source(
    'src/admin/api/orders/[orderId]/delivery-plan/route.ts'
  );
  const helper = source('src/shared/server/orderDeliveryPlan.ts');
  const appRoute = source(
    'src/app/api/admin/orders/[orderId]/delivery-plan/route.ts'
  );

  assert.match(route, /PLANNABLE_ORDER_STATUSES/u);
  assert.doesNotMatch(route, /contract_status|is_draft/u);
  assert.doesNotMatch(route, /ORDER_DELIVERY_PLAN_(?:DRAFT|CONTRACT)_LOCKED/u);
  assert.match(route, /ORDER_DELIVERY_PLAN_ITEM_MISMATCH/u);
  assert.match(route, /validateOrderDeliveryPlanForStatus\(orderStatus, plan\)/u);
  assert.match(route, /expectedDeliveryPlanRevision/u);
  assert.match(route, /ORDER_DELIVERY_PLAN_STALE/u);
  assert.match(route, /advanceOrderDeliveryPlanRevision/u);
  assert.match(route, /insertAuditEventForRequest/u);
  assert.match(route, /revalidateAdminOrderPaths\(orderId\)/u);
  assert.doesNotMatch(route, /pricing_revision|order_line_snapshots/u);

  assert.match(helper, /select id, ship_later[\s\S]*?for update/u);
  assert.match(helper, /parseExpectedDeliveryPlanRevision/u);
  assert.match(helper, /delivery_plan_revision = delivery_plan_revision \+ 1/u);
  assert.match(helper, /set ship_later = \(id = any\(\$2::bigint\[\]\)\)/u);
  assert.match(helper, /shipLaterItemIds\.some\(\(itemId\) => !knownItemIds\.has\(itemId\)\)/u);
  assert.match(appRoute, /delivery-plan\/route/u);
});

test('status transition applies an optional complete plan before validation and commits once', () => {
  const route = source('src/admin/api/orders/[orderId]/status/route.ts');
  const applyIndex = route.indexOf('applyCompleteOrderDeliveryPlan');
  const validateIndex = route.indexOf('validateOrderDeliveryPlanForStatus(\n      status');
  const statusUpdateIndex = route.indexOf('update orders set status = $1');
  const commitIndex = route.indexOf("await client.query('commit')");

  assert.ok(applyIndex >= 0);
  assert.ok(validateIndex > applyIndex);
  assert.ok(statusUpdateIndex > validateIndex);
  assert.ok(commitIndex > statusUpdateIndex);
  assert.equal(route.indexOf("await client.query('commit')", commitIndex + 1), -1);
  assert.match(route, /Object\.prototype\.hasOwnProperty\.call\([\s\S]*?'shipLaterItemIds'/u);
  assert.match(route, /PARTIAL_DELIVERY_PLAN_REQUIRED|deliveryPlanValidation\.code/u);
  assert.match(route, /shipLaterItemIds: deliveryPlan\.shipLaterItemIds/u);
  assert.match(route, /expectedDeliveryPlanRevision/u);
  assert.match(route, /deliveryPlanRevision: nextDeliveryPlanRevision/u);
  assert.match(route, /changed_with_status: changed/u);
});
test('delivery-plan revisions invalidate only stale Dobavnica documents', () => {
  const generator = source('src/admin/api/orders/generateOrderDocumentRoute.ts');
  const orderLoader = source('src/shared/server/orders.ts');
  const adminDownload = source(
    'src/admin/api/orders/[orderId]/documents/[documentId]/route.ts'
  );
  const customerDownload = source(
    'src/commercial/api/orders/documents/[documentAccessId]/route.ts'
  );
  const confirmation = source(
    'src/commercial/api/orders/confirmation/route.ts'
  );
  const itemsRoute = source('src/admin/api/orders/[orderId]/items/route.ts');

  assert.match(generator, /order_delivery_plan_revision/u);
  assert.match(generator, /select delivery_plan_revision from orders/u);
  for (const documentSource of [
    orderLoader,
    adminDownload,
    customerDownload,
    confirmation
  ]) {
    assert.match(documentSource, /type <> 'dobavnica'/u);
    assert.match(
      documentSource,
      /order_delivery_plan_revision[\s\S]*?delivery_plan_revision/u
    );
  }
  assert.match(itemsRoute, /deliveryPlanMembershipChanged/u);
  assert.match(
    itemsRoute,
    /delivery_plan_revision = delivery_plan_revision \+ case when \$9 then 1 else 0 end/u
  );
  assert.match(itemsRoute, /deliveryPlanRevision: responsePayload\.deliveryPlanRevision/u);
});