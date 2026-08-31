import { NextResponse } from 'next/server';
import { validateOrderDeliveryPlanForStatus } from '@/shared/domain/order/orderDeliveryPlan';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { getPool } from '@/shared/server/db';
import {
  advanceOrderDeliveryPlanRevision,
  applyCompleteOrderDeliveryPlan,
  lockOrderDeliveryItems,
  normalizeOrderDeliveryPlanRevision,
  ORDER_DELIVERY_PLAN_STALE_MESSAGE,
  parseExpectedDeliveryPlanRevision,
  parseShipLaterItemIds
} from '@/shared/server/orderDeliveryPlan';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';

const PLANNABLE_ORDER_STATUSES = new Set([
  'received',
  'in_progress',
  'partially_sent'
]);

const conflict = (code: string, message: string) =>
  NextResponse.json({ code, message }, { status: 409 });

export async function POST(
  request: Request,
  props: { params: Promise<{ orderId: string }> }
) {
  const params = await props.params;
  const orderId = Number(params.orderId);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return NextResponse.json(
      { code: 'INVALID_ORDER_ID', message: 'Neveljaven ID naročila.' },
      { status: 400 }
    );
  }

  const bodyResult = await readRequiredJsonRecord(request);
  if (!bodyResult.ok) return bodyResult.response;
  const parsedPlan = parseShipLaterItemIds(
    bodyResult.body.shipLaterItemIds
  );
  if (!parsedPlan.ok) {
    return NextResponse.json(
      { code: parsedPlan.code, message: parsedPlan.message },
      { status: 400 }
    );
  }
  const parsedExpectedRevision = parseExpectedDeliveryPlanRevision(
    bodyResult.body.expectedDeliveryPlanRevision
  );
  if (!parsedExpectedRevision.ok) {
    return NextResponse.json(
      {
        code: parsedExpectedRevision.code,
        message: parsedExpectedRevision.message
      },
      { status: 400 }
    );
  }

  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    const orderResult = await client.query(
      `
        select
          id,
          order_number,
          status,
          deleted_at,
          delivery_plan_revision
        from orders
        where id = $1
        for update
      `,
      [orderId]
    );
    if (orderResult.rowCount !== 1) {
      await client.query('rollback');
      return NextResponse.json(
        { code: 'ORDER_NOT_FOUND', message: 'Naročilo ne obstaja.' },
        { status: 404 }
      );
    }

    const order = orderResult.rows[0] as Record<string, unknown>;
    const deliveryPlanRevision = normalizeOrderDeliveryPlanRevision(
      order.delivery_plan_revision
    );
    if (parsedExpectedRevision.revision !== deliveryPlanRevision) {
      await client.query('rollback');
      return conflict(
        'ORDER_DELIVERY_PLAN_STALE',
        ORDER_DELIVERY_PLAN_STALE_MESSAGE
      );
    }
    const orderStatus = String(order.status ?? '');
    if (order.deleted_at) {
      await client.query('rollback');
      return conflict(
        'ORDER_DELIVERY_PLAN_DELETED',
        'Načrta dobave izbrisanega naročila ni mogoče spreminjati.'
      );
    }
    if (!PLANNABLE_ORDER_STATUSES.has(orderStatus)) {
      await client.query('rollback');
      return conflict(
        'ORDER_DELIVERY_PLAN_STATUS_LOCKED',
        'Načrta dobave v trenutnem statusu naročila ni mogoče spreminjati.'
      );
    }

    const lockedItems = await lockOrderDeliveryItems(client, orderId);
    const plan = await applyCompleteOrderDeliveryPlan(
      client,
      orderId,
      lockedItems,
      parsedPlan.itemIds
    );
    if (!plan) {
      await client.query('rollback');
      return conflict(
        'ORDER_DELIVERY_PLAN_ITEM_MISMATCH',
        'Ena ali več izbranih postavk ne pripada temu naročilu. Osvežite stran in poskusite znova.'
      );
    }

    const validation = validateOrderDeliveryPlanForStatus(orderStatus, plan);
    if (!validation.ok) {
      await client.query('rollback');
      return conflict(validation.code, validation.message);
    }

    const nextDeliveryPlanRevision = plan.changed
      ? await advanceOrderDeliveryPlanRevision(
          client,
          orderId,
          deliveryPlanRevision
        )
      : deliveryPlanRevision;
    if (nextDeliveryPlanRevision === null) {
      await client.query('rollback');
      return conflict(
        'ORDER_DELIVERY_PLAN_STALE',
        ORDER_DELIVERY_PLAN_STALE_MESSAGE
      );
    }

    if (plan.changed) {
      const orderNumber = String(order.order_number ?? `#${orderId}`);
      await insertAuditEventForRequest(
        request,
        {
          entityType: 'order',
          entityId: String(orderId),
          entityLabel: `Naročilo ${orderNumber}`,
          action: 'updated',
          summary: `Naročilo ${orderNumber}: načrt dobave spremenjen`,
          diff: {
            delivery_plan: {
              label: 'Načrt dobave',
              before: `${lockedItems.length - plan.previousShipLaterItemIds.length} zdaj, ${plan.previousShipLaterItemIds.length} pozneje`,
              after: `${plan.currentItemCount} zdaj, ${plan.laterItemCount} pozneje`
            }
          },
          metadata: {
            order_number: orderNumber,
            ship_later_item_ids: plan.shipLaterItemIds,
            changed_field_count: 1
          }
        },
        client
      );
    }

    await client.query('commit');
    revalidateAdminOrderPaths(orderId);
    return NextResponse.json({
      shipLaterItemIds: plan.shipLaterItemIds,
      currentItemCount: plan.currentItemCount,
      laterItemCount: plan.laterItemCount,
      changed: plan.changed,
      deliveryPlanRevision: nextDeliveryPlanRevision
    });
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    return NextResponse.json(
      {
        code: 'ORDER_DELIVERY_PLAN_FAILED',
        message: error instanceof Error ? error.message : 'Napaka na strežniku.'
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
