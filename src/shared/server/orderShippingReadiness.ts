import type { PoolClient } from 'pg';
import {
  validatePersistedOrderShippingReadiness,
  type PersistedOrderShippingReadiness
} from '@/shared/domain/shipping/shipping';

export async function validateLockedOrderShippingReadiness(
  client: PoolClient,
  orderId: number,
  order: Record<string, unknown>
): Promise<PersistedOrderShippingReadiness> {
  if (order.deleted_at) {
    return {
      ok: false,
      message:
        'Naročila ni mogoče dokončati ali izdati dokumenta: naročilo je izbrisano.'
    };
  }
  if (order.is_draft === true) {
    return {
      ok: false,
      message:
        'Naročila ni mogoče dokončati ali izdati dokumenta: osnutek najprej dokončajte.'
    };
  }

  const countsResult = await client.query(
    `
      select
        (select count(*)::integer from order_items where order_id = $1) as item_count,
        (select count(*)::integer from order_line_snapshots where order_id = $1) as snapshot_line_count
    `,
    [orderId]
  );
  const counts = countsResult.rows[0] as Record<string, unknown> | undefined;

  return validatePersistedOrderShippingReadiness({
    expectedItemCount: Number(counts?.item_count ?? 0),
    snapshotLineCount: Number(counts?.snapshot_line_count ?? 0),
    subtotal: order.subtotal,
    tax: order.tax,
    shipping: order.shipping,
    automaticShipping: order.automatic_shipping,
    total: order.total,
    shippingSnapshot: order.shipping_snapshot_json,
    shippingOverride: order.shipping_override_json,
    shippingOverrideStale: order.shipping_override_stale,
    parcelCount: order.parcel_count
  });
}
