import 'server-only';

import type { PoolClient } from 'pg';

export type OrderStockAllocation = {
  variantId: number;
  quantity: number;
  label?: string;
};

export class OrderStockConflictError extends Error {
  readonly code = 'STOCK_CHANGED';
  readonly variantId: number;
  readonly requestedQuantity: number;
  readonly availableStock: number;

  constructor(input: {
    variantId: number;
    requestedQuantity: number;
    availableStock: number;
    label?: string;
  }) {
    super(
      `Zaloga za ${input.label || `različico ${input.variantId}`} ne zadošča za potrditev.`
    );
    this.name = 'OrderStockConflictError';
    this.variantId = input.variantId;
    this.requestedQuantity = input.requestedQuantity;
    this.availableStock = input.availableStock;
  }
}

export class OrderStockReconciliationRequiredError extends Error {
  readonly code = 'STOCK_RECONCILIATION_REQUIRED';

  constructor() {
    super(
      'Evidence stare zaloge ni mogoče varno razrešiti samodejno. Pred nadaljevanjem je potrebna ročna uskladitev zaloge.'
    );
    this.name = 'OrderStockReconciliationRequiredError';
  }
}

function normalizeAllocations(
  allocations: readonly OrderStockAllocation[]
): OrderStockAllocation[] {
  const quantities = new Map<number, { quantity: number; label?: string }>();
  for (const allocation of allocations) {
    if (
      !Number.isSafeInteger(allocation.variantId) ||
      allocation.variantId <= 0 ||
      !Number.isSafeInteger(allocation.quantity) ||
      allocation.quantity <= 0
    ) {
      throw new Error('Stock allocation contains an invalid variant or quantity.');
    }
    const current = quantities.get(allocation.variantId);
    quantities.set(allocation.variantId, {
      quantity: (current?.quantity ?? 0) + allocation.quantity,
      label: current?.label ?? allocation.label
    });
  }
  return Array.from(quantities, ([variantId, value]) => ({
    variantId,
    quantity: value.quantity,
    label: value.label
  })).sort((left, right) => left.variantId - right.variantId);
}

export async function commitOrderStockHolds(
  client: PoolClient,
  orderId: number,
  allocations: readonly OrderStockAllocation[],
  actor: { type: string; id?: string | null }
): Promise<void> {
  const normalized = normalizeAllocations(allocations);
  if (normalized.length === 0) {
    throw new Error('A stock-committing order must contain at least one allocation.');
  }

  const existing = await client.query(
    `
      select catalog_variant_id, quantity, state
      from order_stock_holds
      where order_id = $1
      order by catalog_variant_id
      for update
    `,
    [orderId]
  );
  if (existing.rowCount) {
    if (existing.rows.some((row) => row.state === 'legacy_unknown')) {
      throw new OrderStockReconciliationRequiredError();
    }
    const isExactReplay =
      existing.rows.length === normalized.length &&
      existing.rows.every((row, index) => {
        const expected = normalized[index];
        return (
          Number(row.catalog_variant_id) === expected.variantId &&
          Number(row.quantity) === expected.quantity &&
          row.state === 'held'
        );
      });
    if (isExactReplay) return;
    throw new OrderStockReconciliationRequiredError();
  }

  for (const allocation of normalized) {
    const locked = await client.query(
      `
        select inventory
        from catalog_item_variants
        where id = $1
        for update
      `,
      [allocation.variantId]
    );
    const availableStock = Number(locked.rows[0]?.inventory ?? 0);
    if (locked.rowCount !== 1 || availableStock < allocation.quantity) {
      throw new OrderStockConflictError({
        variantId: allocation.variantId,
        requestedQuantity: allocation.quantity,
        availableStock,
        label: allocation.label
      });
    }

    const decremented = await client.query(
      `
        update catalog_item_variants
        set inventory = inventory - $1,
            updated_at = now()
        where id = $2
          and inventory >= $1
      `,
      [allocation.quantity, allocation.variantId]
    );
    if (decremented.rowCount !== 1) {
      throw new OrderStockConflictError({
        variantId: allocation.variantId,
        requestedQuantity: allocation.quantity,
        availableStock,
        label: allocation.label
      });
    }

    await client.query(
      `
        insert into order_stock_holds (
          order_id,
          catalog_variant_id,
          quantity,
          state,
          committed_at,
          committed_by_actor_type,
          committed_by_actor_id
        )
        values ($1, $2, $3, 'held', now(), $4, $5)
      `,
      [
        orderId,
        allocation.variantId,
        allocation.quantity,
        actor.type,
        actor.id ?? null
      ]
    );
  }
}

export async function releaseOrderStockHolds(
  client: PoolClient,
  orderId: number,
  reason: string,
  actor: { type: string; id?: string | null }
): Promise<{ released: boolean; releasedUnits: number }> {
  const result = await client.query(
    `
      select id, catalog_variant_id, quantity, state
      from order_stock_holds
      where order_id = $1
        and state in ('held', 'legacy_unknown')
      order by catalog_variant_id
      for update
    `,
    [orderId]
  );

  if (result.rows.some((row) => row.state === 'legacy_unknown')) {
    throw new OrderStockReconciliationRequiredError();
  }

  let releasedUnits = 0;
  for (const row of result.rows.filter((entry) => entry.state === 'held') as Array<{
    id: string | number;
    catalog_variant_id: string | number;
    quantity: string | number;
    state: 'held';
  }>) {
    const quantity = Number(row.quantity);
    await client.query(
      `
        update catalog_item_variants
        set inventory = inventory + $1,
            updated_at = now()
        where id = $2
      `,
      [quantity, Number(row.catalog_variant_id)]
    );
    await client.query(
      `
        update order_stock_holds
        set state = 'released',
            released_at = now(),
            release_reason = $1,
            released_by_actor_type = $2,
            released_by_actor_id = $3
        where id = $4
          and state = 'held'
      `,
      [reason, actor.type, actor.id ?? null, row.id]
    );
    releasedUnits += quantity;
  }

  return { released: result.rows.length > 0, releasedUnits };
}

export function acceptedContractRequiredMessage(): string {
  return 'Naročilo mora prodajalec najprej sprejeti.';
}
