import 'server-only';

import type { PoolClient } from 'pg';
import type { OrderDeliveryPlanCounts } from '@/shared/domain/order/orderDeliveryPlan';

type LockedOrderItem = {
  id: number;
  shipLater: boolean;
};

export type ParsedShipLaterItemIds =
  | { ok: true; itemIds: number[] }
  | {
      ok: false;
      code: 'INVALID_DELIVERY_PLAN';
      message: string;
    };

export type AppliedOrderDeliveryPlan = OrderDeliveryPlanCounts & {
  shipLaterItemIds: number[];
  previousShipLaterItemIds: number[];
  changed: boolean;
};

export const ORDER_DELIVERY_PLAN_STALE_MESSAGE =
  'Načrt dobave je medtem spremenil drug uporabnik. Osvežite stran in poskusite znova.';

export type ParsedExpectedDeliveryPlanRevision =
  | { ok: true; revision: number }
  | {
      ok: false;
      code: 'INVALID_DELIVERY_PLAN_REVISION';
      message: string;
    };

export function parseExpectedDeliveryPlanRevision(
  value: unknown
): ParsedExpectedDeliveryPlanRevision {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    return {
      ok: false,
      code: 'INVALID_DELIVERY_PLAN_REVISION',
      message: 'Revizija načrta dobave mora biti pozitivno celo število.'
    };
  }
  return { ok: true, revision: Number(value) };
}

export function normalizeOrderDeliveryPlanRevision(value: unknown): number {
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision > 0 ? revision : 1;
}

export async function advanceOrderDeliveryPlanRevision(
  client: PoolClient,
  orderId: number,
  expectedRevision: number
): Promise<number | null> {
  const result = await client.query(
    `
      update orders
      set delivery_plan_revision = delivery_plan_revision + 1
      where id = $1 and delivery_plan_revision = $2
      returning delivery_plan_revision
    `,
    [orderId, expectedRevision]
  );
  if (result.rowCount !== 1) return null;
  return normalizeOrderDeliveryPlanRevision(
    result.rows[0]?.delivery_plan_revision
  );
}

export function parseShipLaterItemIds(value: unknown): ParsedShipLaterItemIds {
  if (!Array.isArray(value) || value.length > 10_000) {
    return {
      ok: false,
      code: 'INVALID_DELIVERY_PLAN',
      message: 'Seznam postavk za poznejšo dobavo ni veljaven.'
    };
  }

  const itemIds: number[] = [];
  const seen = new Set<number>();
  for (const valueItem of value) {
    if (!Number.isSafeInteger(valueItem) || Number(valueItem) <= 0) {
      return {
        ok: false,
        code: 'INVALID_DELIVERY_PLAN',
        message: 'Vsaka postavka za poznejšo dobavo mora imeti veljaven ID.'
      };
    }
    const itemId = Number(valueItem);
    if (seen.has(itemId)) {
      return {
        ok: false,
        code: 'INVALID_DELIVERY_PLAN',
        message: 'Ista postavka ne sme biti v načrtu poznejše dobave navedena večkrat.'
      };
    }
    seen.add(itemId);
    itemIds.push(itemId);
  }

  return { ok: true, itemIds };
}

export async function lockOrderDeliveryItems(
  client: PoolClient,
  orderId: number
): Promise<LockedOrderItem[]> {
  const result = await client.query(
    `
      select id, ship_later
      from order_items
      where order_id = $1
      order by id
      for update
    `,
    [orderId]
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    shipLater: row.ship_later === true
  }));
}

export function deliveryPlanFromLockedItems(
  items: LockedOrderItem[]
): AppliedOrderDeliveryPlan {
  const shipLaterItemIds = items
    .filter((item) => item.shipLater)
    .map((item) => item.id);
  return {
    shipLaterItemIds,
    previousShipLaterItemIds: shipLaterItemIds,
    currentItemCount: items.length - shipLaterItemIds.length,
    laterItemCount: shipLaterItemIds.length,
    changed: false
  };
}

export async function applyCompleteOrderDeliveryPlan(
  client: PoolClient,
  orderId: number,
  lockedItems: LockedOrderItem[],
  shipLaterItemIds: number[]
): Promise<AppliedOrderDeliveryPlan | null> {
  const knownItemIds = new Set(lockedItems.map((item) => item.id));
  if (shipLaterItemIds.some((itemId) => !knownItemIds.has(itemId))) return null;

  const previousShipLaterItemIds = lockedItems
    .filter((item) => item.shipLater)
    .map((item) => item.id);
  const previousKey = previousShipLaterItemIds.join(',');
  const nextIds = [...shipLaterItemIds].sort((left, right) => left - right);
  const changed = previousKey !== nextIds.join(',');

  if (changed) {
    const updateResult = await client.query(
      `
        update order_items
        set ship_later = (id = any($2::bigint[]))
        where order_id = $1
      `,
      [orderId, nextIds]
    );
    if (updateResult.rowCount !== lockedItems.length) {
      throw new Error('Načrta dobave ni bilo mogoče varno shraniti.');
    }
  }

  return {
    shipLaterItemIds: nextIds,
    previousShipLaterItemIds,
    currentItemCount: lockedItems.length - nextIds.length,
    laterItemCount: nextIds.length,
    changed
  };
}