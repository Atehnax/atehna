import type { PoolClient } from 'pg';
import {
  orderStatusDocumentBlock,
  requiredOrderStatusDocuments
} from '@/shared/domain/order/orderStatusDocuments';

// Call with the order locked so uploads, deletion and status changes serialize.
export async function validateLockedOrderStatusDocuments(
  client: PoolClient,
  orderId: number,
  order: Record<string, unknown>,
  status: string
) {
  if (requiredOrderStatusDocuments(order, status).length === 0) return null;
  const documents = await client.query<{ type: string }>(
    `
      select d.type
      from order_documents d
      join orders o on o.id = d.order_id
      where d.order_id = $1
        and d.deleted_at is null
        and (
          (o.is_historical and d.type = 'invoice')
          or d.order_pricing_revision = o.pricing_revision
        )
        and (
          d.type <> 'dobavnica'
          or d.order_delivery_plan_revision = o.delivery_plan_revision
        )
      for share of d
    `,
    [orderId]
  );
  return orderStatusDocumentBlock(order, status, documents.rows.map((document) => document.type));
}
