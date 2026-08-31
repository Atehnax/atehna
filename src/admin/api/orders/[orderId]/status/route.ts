import { NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';
import { validateOrderDeliveryPlanForStatus } from '@/shared/domain/order/orderDeliveryPlan';
import { isDirectOrderSellerAcceptanceTransition } from '@/shared/domain/order/contractStatus';
import { isOrderStatus } from '@/shared/domain/order/orderStatus';
import { getPool } from '@/shared/server/db';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import {
  advanceOrderDeliveryPlanRevision,
  applyCompleteOrderDeliveryPlan,
  deliveryPlanFromLockedItems,
  lockOrderDeliveryItems,
  normalizeOrderDeliveryPlanRevision,
  ORDER_DELIVERY_PLAN_STALE_MESSAGE,
  parseExpectedDeliveryPlanRevision,
  parseShipLaterItemIds
} from '@/shared/server/orderDeliveryPlan';
import {
  SCHOOL_PURCHASE_ORDER_PROOF_FORMAT_MARKERS,
  schoolExecutionBlock
} from '@/shared/domain/order/schoolOrderWorkflow';
import {
  enqueueOrderEmailEvent,
  scheduleOrderEmailJobs
} from '@/shared/server/orderEmailJobs';
import { validateLockedOrderShippingReadiness } from '@/shared/server/orderShippingReadiness';
import {
  acceptedContractRequiredMessage,
  OrderStockReconciliationRequiredError,
  releaseOrderStockHolds
} from '@/shared/server/orderStockHolds';

export async function POST(
  request: Request,
  props: { params: Promise<{ orderId: string }> }
) {
  const params = await props.params;
  let client: PoolClient | null = null;
  try {
    const orderId = Number(params.orderId);
    if (!Number.isFinite(orderId)) {
      return NextResponse.json(
        { message: 'Neveljaven ID naročila.' },
        { status: 400 }
      );
    }

    const bodyResult = await readRequiredJsonRecord(request);
    if (!bodyResult.ok) return bodyResult.response;

    const status = String(bodyResult.body?.status ?? '').trim();
    if (!status || !isOrderStatus(status)) {
      return NextResponse.json(
        { message: 'Status manjka ali je neveljaven.' },
        { status: 400 }
      );
    }

    const hasDeliveryPlan = Object.prototype.hasOwnProperty.call(
      bodyResult.body,
      'shipLaterItemIds'
    );
    const parsedDeliveryPlan = hasDeliveryPlan
      ? parseShipLaterItemIds(bodyResult.body.shipLaterItemIds)
      : null;
    if (parsedDeliveryPlan && !parsedDeliveryPlan.ok) {
      return NextResponse.json(
        {
          code: parsedDeliveryPlan.code,
          message: parsedDeliveryPlan.message
        },
        { status: 400 }
      );
    }
    const parsedExpectedDeliveryPlanRevision = hasDeliveryPlan
      ? parseExpectedDeliveryPlanRevision(
          bodyResult.body.expectedDeliveryPlanRevision
        )
      : null;
    if (
      parsedExpectedDeliveryPlanRevision &&
      !parsedExpectedDeliveryPlanRevision.ok
    ) {
      return NextResponse.json(
        {
          code: parsedExpectedDeliveryPlanRevision.code,
          message: parsedExpectedDeliveryPlanRevision.message
        },
        { status: 400 }
      );
    }

    const pool = await getPool();
    client = await pool.connect();
    await client.query('begin');
    const current = await client.query(
      `
        select
          id,
          order_number,
          status,
          customer_type,
          commitment_status,
          contract_status,
          source_quote_offer_version_id,
          deleted_at,
          is_draft,
          subtotal,
          tax,
          shipping,
          automatic_shipping,
          shipping_snapshot_json,
          shipping_override_json,
          shipping_override_stale,
          parcel_count,
          total,
          delivery_plan_revision
        from orders
        where id = $1
        for update
      `,
      [orderId]
    );
    if (current.rows.length === 0) {
      await client.query('rollback');
      client.release();
      client = null;
      return NextResponse.json(
        { message: 'Naročilo ne obstaja.' },
        { status: 404 }
      );
    }

    const previousStatus =
      current.rows[0]?.status === null || current.rows[0]?.status === undefined
        ? null
        : String(current.rows[0].status);
    const orderNumber = String(current.rows[0]?.order_number ?? `#${orderId}`);
    const workflow = current.rows[0];
    const deliveryPlanRevision = normalizeOrderDeliveryPlanRevision(
      workflow?.delivery_plan_revision
    );
    if (
      parsedExpectedDeliveryPlanRevision?.ok &&
      parsedExpectedDeliveryPlanRevision.revision !== deliveryPlanRevision
    ) {
      await client.query('rollback');
      client.release();
      client = null;
      return NextResponse.json(
        {
          code: 'ORDER_DELIVERY_PLAN_STALE',
          message: ORDER_DELIVERY_PLAN_STALE_MESSAGE
        },
        { status: 409 }
      );
    }
    if (workflow?.deleted_at) {
      await client.query('rollback');
      client.release();
      client = null;
      return NextResponse.json(
        {
          code: 'ORDER_DELETED',
          message: 'Statusa izbrisanega naročila ni mogoče spreminjati.'
        },
        { status: 409 }
      );
    }
    const automaticallyAcceptsDirectOrder =
      isDirectOrderSellerAcceptanceTransition({
        previousStatus,
        nextStatus: status,
        customerType: String(workflow?.customer_type ?? ''),
        commitmentStatus:
          workflow?.commitment_status === null ||
          workflow?.commitment_status === undefined
            ? null
            : String(workflow.commitment_status),
        contractStatus:
          workflow?.contract_status === null ||
          workflow?.contract_status === undefined
            ? null
            : String(workflow.contract_status),
        sourceQuoteOfferVersionId:
          workflow?.source_quote_offer_version_id
      });
    const effectiveContractStatus = automaticallyAcceptsDirectOrder
      ? 'accepted'
      : String(workflow?.contract_status ?? '');
    const effectiveContractAccepted = effectiveContractStatus === 'accepted';
    if (
      previousStatus !== status &&
      status === 'cancelled' &&
      workflow?.source_quote_offer_version_id !== null &&
      workflow?.source_quote_offer_version_id !== undefined &&
      String(workflow?.commitment_status ?? '') === 'pending_confirmation'
    ) {
      await client.query('rollback');
      client.release();
      client = null;
      return NextResponse.json(
        {
          code: 'QUOTE_PURCHASE_ORDER_REVIEW_REQUIRED',
          message:
            'Naročilo iz ponudbe, ki čaka na pregled naročilnice, zavrnite v namenskem postopku pregleda naročilnice.'
        },
        { status: 409 }
      );
    }
    const purchaseOrderResult = await client.query(
      `
        select id
        from order_documents
        where order_id = $1
          and type = 'purchase_order'
          and deleted_at is null
          and format_marker = any($2::text[])
          and order_pricing_revision = (
            select pricing_revision from orders where id = $1
          )
        order by id desc
        limit 1
        for share
      `,
      [orderId, [...SCHOOL_PURCHASE_ORDER_PROOF_FORMAT_MARKERS]]
    );
    const executionBlock = schoolExecutionBlock(
      String(workflow?.customer_type ?? ''),
      workflow?.commitment_status === null ||
        workflow?.commitment_status === undefined
        ? null
        : String(workflow.commitment_status),
      status,
      purchaseOrderResult.rowCount === 1
    );
    if (executionBlock) {
      await client.query('rollback');
      client.release();
      client = null;
      return NextResponse.json(executionBlock, { status: 409 });
    }
    if (
      previousStatus !== status &&
      status !== 'cancelled' &&
      !effectiveContractAccepted
    ) {
      await client.query('rollback');
      client.release();
      client = null;
      return NextResponse.json(
        {
          code: 'ORDER_CONTRACT_NOT_ACCEPTED',
          message: acceptedContractRequiredMessage()
        },
        { status: 409 }
      );
    }
    if (hasDeliveryPlan && status === 'cancelled') {
      await client.query('rollback');
      client.release();
      client = null;
      return NextResponse.json(
        {
          code: 'ORDER_DELIVERY_PLAN_STATUS_LOCKED',
          message: 'Načrta dobave pri preklicu naročila ni mogoče spreminjati.'
        },
        { status: 409 }
      );
    }
    if (
      hasDeliveryPlan &&
      previousStatus !== null &&
      ['sent', 'finished', 'cancelled'].includes(previousStatus) &&
      !(
        (status === 'sent' || status === 'finished') &&
        parsedDeliveryPlan?.ok &&
        parsedDeliveryPlan.itemIds.length === 0
      )
    ) {
      await client.query('rollback');
      client.release();
      client = null;
      return NextResponse.json(
        {
          code: 'ORDER_DELIVERY_PLAN_STATUS_LOCKED',
          message: 'Načrta dobave zaključenega naročila ni mogoče spreminjati.'
        },
        { status: 409 }
      );
    }
    const lockedDeliveryItems = await lockOrderDeliveryItems(client, orderId);
    const deliveryPlan = parsedDeliveryPlan?.ok
      ? await applyCompleteOrderDeliveryPlan(
          client,
          orderId,
          lockedDeliveryItems,
          parsedDeliveryPlan.itemIds
        )
      : deliveryPlanFromLockedItems(lockedDeliveryItems);
    if (!deliveryPlan) {
      await client.query('rollback');
      client.release();
      client = null;
      return NextResponse.json(
        {
          code: 'ORDER_DELIVERY_PLAN_ITEM_MISMATCH',
          message:
            'Ena ali več izbranih postavk ne pripada temu naročilu. Osvežite stran in poskusite znova.'
        },
        { status: 409 }
      );
    }
    const deliveryPlanValidation = validateOrderDeliveryPlanForStatus(
      status,
      deliveryPlan
    );
    if (!deliveryPlanValidation.ok) {
      await client.query('rollback');
      client.release();
      client = null;
      return NextResponse.json(
        {
          code: deliveryPlanValidation.code,
          message: deliveryPlanValidation.message
        },
        { status: 409 }
      );
    }
    const nextDeliveryPlanRevision = deliveryPlan.changed
      ? await advanceOrderDeliveryPlanRevision(
          client,
          orderId,
          deliveryPlanRevision
        )
      : deliveryPlanRevision;
    if (nextDeliveryPlanRevision === null) {
      await client.query('rollback');
      client.release();
      client = null;
      return NextResponse.json(
        {
          code: 'ORDER_DELIVERY_PLAN_STALE',
          message: ORDER_DELIVERY_PLAN_STALE_MESSAGE
        },
        { status: 409 }
      );
    }
    const changed = previousStatus !== status;
    const isAdministrativeDraft = workflow?.is_draft === true;

    let shouldEnqueueStatusEmail = changed && !isAdministrativeDraft;
    if (changed && !isAdministrativeDraft) {
      const readiness = await validateLockedOrderShippingReadiness(
        client,
        orderId,
        workflow as Record<string, unknown>
      );
      if (!readiness.ok) {
        // Cancellation remains available as a recovery path, but an invalid
        // monetary snapshot must never be rendered into its notification.
        if (status === 'cancelled') {
          shouldEnqueueStatusEmail = false;
        } else if (automaticallyAcceptsDirectOrder) {
          shouldEnqueueStatusEmail = false;
        } else {
          await client.query('rollback');
          client.release();
          client = null;
          return NextResponse.json(
            {
              code: 'ORDER_STATUS_SHIPPING_NOT_READY',
              message: readiness.message
            },
            { status: 409 }
          );
        }
      }
    }

    let resultingContractStatus = effectiveContractStatus;
    if (automaticallyAcceptsDirectOrder) {
      const acceptedAt = new Date().toISOString();
      const acceptanceResult = await client.query(
        `
          update orders
          set contract_status = 'accepted',
              contract_accepted_at = $2,
              contract_accepted_actor_type = 'admin',
              contract_accepted_actor_id = null,
              contract_acceptance_evidence_json = $3::jsonb,
              contract_state_version = contract_state_version + 1,
              committed_at = $2
          where id = $1
            and status = 'received'
            and customer_type in ('individual', 'company')
            and commitment_status = 'binding'
            and contract_status = 'pending_seller_acceptance'
            and source_quote_offer_version_id is null
            and deleted_at is null
          returning contract_status
        `,
        [
          orderId,
          acceptedAt,
          JSON.stringify({
            channel: 'admin',
            action: 'accept_direct_order',
            trigger: 'status_transition',
            buttonWording: 'V obdelavi',
            previousStatus,
            nextStatus: status,
            draftAtAcceptance: workflow?.is_draft === true
          })
        ]
      );
      if (acceptanceResult.rowCount !== 1) {
        throw new Error('Pogodbenega sprejema naročila ni bilo mogoče shraniti.');
      }
      resultingContractStatus = 'accepted';
    }

    if (changed) {
      let releasedStockUnits = 0;
      if (status === 'cancelled') {
        const release = await releaseOrderStockHolds(
          client,
          orderId,
          'order_cancelled',
          { type: 'admin' }
        );
        releasedStockUnits = release.releasedUnits;
        if (String(workflow?.contract_status ?? '') === 'pending_seller_acceptance') {
          await client.query(
            `
              update orders
              set contract_status = 'rejected',
                  contract_rejected_at = now(),
                  contract_rejected_actor_type = 'admin',
                  contract_rejected_actor_id = null,
                  contract_rejection_reason = 'Naročilo je bilo preklicano pred sprejemom.',
                  contract_rejection_evidence_json = $2::jsonb,
                  contract_state_version = contract_state_version + 1
              where id = $1
            `,
            [
              orderId,
              JSON.stringify({
                channel: 'admin',
                action: 'cancel_before_acceptance',
                stockReleasedUnits: releasedStockUnits
              })
            ]
          );
          resultingContractStatus = 'rejected';
        }
      }
      await client.query('update orders set status = $1 where id = $2', [
        status,
        orderId
      ]);
      const statusLogResult = await client.query(
        `
          insert into order_status_logs (order_id, previous_status, new_status)
          values ($1, $2, $3)
          returning id, created_at
        `,
        [orderId, previousStatus, status]
      );
      const statusLog = statusLogResult.rows[0] as {
        id: string | number;
        created_at: string | Date;
      };
      if (shouldEnqueueStatusEmail) {
        await enqueueOrderEmailEvent(client, {
          orderId,
          eventKey: `order-status:${statusLog.id}`,
          eventType: status,
          occurredAt:
            statusLog.created_at instanceof Date
              ? statusLog.created_at.toISOString()
              : String(statusLog.created_at),
          previousStatus
        });
      }
      await insertAuditEventForRequest(
        request,
        {
          entityType: 'order',
          entityId: String(orderId),
          entityLabel: `Naročilo ${orderNumber}`,
          action: 'status_changed',
          summary: `Naročilo ${orderNumber}: status spremenjen`,
          diff: {
            status: {
              label: 'Status naročila',
              before: previousStatus,
              after: status
            },
            ...(automaticallyAcceptsDirectOrder
              ? {
                  contract_status: {
                    label: 'Pogodbeni status',
                    before: 'pending_seller_acceptance',
                    after: 'accepted'
                  }
                }
              : {})
          },
          metadata: {
            order_number: orderNumber,
            changed_field_count: automaticallyAcceptsDirectOrder ? 2 : 1,
            customer_notification_suppressed: !shouldEnqueueStatusEmail,
            stock_released_units: releasedStockUnits,
            contract_accepted_automatically: automaticallyAcceptsDirectOrder,
            contract_accepted_while_draft:
              automaticallyAcceptsDirectOrder && workflow?.is_draft === true,
            contract_acceptance_trigger: automaticallyAcceptsDirectOrder
              ? 'received_to_in_progress'
              : null
          }
        },
        client
      );
    }

    if (deliveryPlan.changed) {
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
              before: `${lockedDeliveryItems.length - deliveryPlan.previousShipLaterItemIds.length} zdaj, ${deliveryPlan.previousShipLaterItemIds.length} pozneje`,
              after: `${deliveryPlan.currentItemCount} zdaj, ${deliveryPlan.laterItemCount} pozneje`
            }
          },
          metadata: {
            order_number: orderNumber,
            ship_later_item_ids: deliveryPlan.shipLaterItemIds,
            changed_field_count: 1,
            changed_with_status: changed
          }
        },
        client
      );
    }
    await client.query('commit');
    client.release();
    client = null;

    if (shouldEnqueueStatusEmail) scheduleOrderEmailJobs(pool, orderId);
    revalidateAdminOrderPaths(orderId);
    return NextResponse.json({
      status,
      contractStatus: resultingContractStatus,
      notificationSuppressed: changed && !shouldEnqueueStatusEmail,
      shipLaterItemIds: deliveryPlan.shipLaterItemIds,
      currentItemCount: deliveryPlan.currentItemCount,
      laterItemCount: deliveryPlan.laterItemCount,
      deliveryPlanRevision: nextDeliveryPlanRevision
    });
  } catch (error) {
    if (client) {
      await client.query('rollback').catch(() => undefined);
      client.release();
    }
    if (error instanceof OrderStockReconciliationRequiredError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Napaka na strežniku.'
      },
      { status: 500 }
    );
  }
}
