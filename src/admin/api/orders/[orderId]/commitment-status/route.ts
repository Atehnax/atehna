import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';

type CommitmentStatus = 'binding' | 'pending_confirmation' | 'rejected';

const COMMITMENT_STATUSES = new Set<CommitmentStatus>([
  'binding',
  'pending_confirmation',
  'rejected'
]);

function isCommitmentStatus(value: string): value is CommitmentStatus {
  return COMMITMENT_STATUSES.has(value as CommitmentStatus);
}

export async function POST(
  request: Request,
  props: { params: Promise<{ orderId: string }> }
) {
  const params = await props.params;
  const orderId = Number(params.orderId);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ message: 'Neveljaven ID naročila.' }, { status: 400 });
  }

  const bodyResult = await readRequiredJsonRecord(request);
  if (!bodyResult.ok) return bodyResult.response;
  const nextStatus = String(
    bodyResult.body.commitmentStatus ?? bodyResult.body.status ?? ''
  ).trim();
  if (!isCommitmentStatus(nextStatus)) {
    return NextResponse.json(
      { message: 'Neveljaven status zavezujočega naročila.' },
      { status: 400 }
    );
  }

  try {
    const pool = await getPool();
    const client = await pool.connect();
    try {
      await client.query('begin');
      const orderResult = await client.query(
        `
          select id, order_number, customer_type, commitment_status, status, deleted_at
          from orders
          where id = $1
          for update
        `,
        [orderId]
      );
      const order = orderResult.rows[0] as
        | {
            order_number: string;
            customer_type: string;
            commitment_status: CommitmentStatus;
            status: string;
            deleted_at: string | null;
          }
        | undefined;
      if (!order) {
        await client.query('rollback');
        return NextResponse.json({ message: 'Naročilo ne obstaja.' }, { status: 404 });
      }

      const previousStatus = order.commitment_status;
      if (previousStatus === nextStatus) {
        await client.query('commit');
        return NextResponse.json({
          commitmentStatus: nextStatus,
          stockNotCommitted: nextStatus !== 'binding'
        });
      }
      if (order.customer_type !== 'school') {
        await client.query('rollback');
        return NextResponse.json(
          { message: 'Zavezujočega statusa neposrednega naročila ni mogoče spremeniti.' },
          { status: 409 }
        );
      }
      if (previousStatus === 'binding') {
        await client.query('rollback');
        return NextResponse.json(
          {
            message:
              'Zavezujočega naročila ni mogoče razveljaviti brez evidence premika oziroma vračila zaloge.'
          },
          { status: 409 }
        );
      }

      if (nextStatus === 'binding') {
        if (order.deleted_at || order.status === 'cancelled') {
          await client.query('rollback');
          return NextResponse.json(
            { message: 'Izbrisanega ali preklicanega naročila ni mogoče potrditi.' },
            { status: 409 }
          );
        }

        const itemsResult = await client.query(
          `
            select
              catalog_variant_id,
              sum(quantity)::integer as quantity
            from order_items
            where order_id = $1
            group by catalog_variant_id
            order by catalog_variant_id
          `,
          [orderId]
        );
        const items = itemsResult.rows as Array<{
          catalog_variant_id: string | number | null;
          quantity: string | number;
        }>;
        if (
          items.length === 0 ||
          items.some((item) => item.catalog_variant_id === null)
        ) {
          await client.query('rollback');
          return NextResponse.json(
            {
              message:
                'Naročilo nima popolnih povezav na različice in ga ni mogoče varno potrditi.'
            },
            { status: 409 }
          );
        }

        for (const item of items) {
          const variantId = Number(item.catalog_variant_id);
          const quantity = Number(item.quantity);
          const stockResult = await client.query(
            `
              with recursive category_paths as (
                select
                  id,
                  parent_id,
                  (status = 'active') as ancestors_active
                from catalog_categories
                where parent_id is null

                union all

                select
                  child.id,
                  child.parent_id,
                  parent.ancestors_active and child.status = 'active'
                from catalog_categories child
                join category_paths parent on parent.id = child.parent_id
              )
              select
                civ.inventory,
                civ.status as variant_status,
                ci.status as product_status,
                ci.category_id,
                cp.ancestors_active as category_is_active
              from catalog_item_variants civ
              join catalog_items ci on ci.id = civ.item_id
              left join category_paths cp on cp.id = ci.category_id
              where civ.id = $1
              for update of civ, ci
            `,
            [variantId]
          );
          const variant = stockResult.rows[0] as
            | {
                inventory: string | number;
                variant_status: string;
                product_status: string;
                category_id: string | null;
                category_is_active: boolean | null;
              }
            | undefined;
          if (
            !variant ||
            variant.variant_status !== 'active' ||
            variant.product_status !== 'active' ||
            variant.category_id === null ||
            variant.category_is_active !== true ||
            Number(variant.inventory) < quantity
          ) {
            await client.query('rollback');
            return NextResponse.json(
              {
                message: `Zaloga različice ${variantId} ne zadošča za potrditev naročila.`,
                code: 'INSUFFICIENT_STOCK',
                variantId,
                requestedQuantity: quantity,
                availableStock: variant ? Number(variant.inventory) : 0
              },
              { status: 409 }
            );
          }

          const decrementResult = await client.query(
            `
              update catalog_item_variants
              set inventory = inventory - $1,
                  updated_at = now()
              where id = $2
                and inventory >= $1
            `,
            [quantity, variantId]
          );
          if (decrementResult.rowCount !== 1) {
            await client.query('rollback');
            return NextResponse.json(
              {
                message: `Zaloge različice ${variantId} med potrjevanjem ni bilo mogoče varno rezervirati.`,
                code: 'STOCK_COMMIT_CONFLICT',
                variantId
              },
              { status: 409 }
            );
          }
        }
      }

      await client.query(
        'update orders set commitment_status = $1 where id = $2',
        [nextStatus, orderId]
      );
      await insertAuditEventForRequest(
        request,
        {
          entityType: 'order',
          entityId: String(orderId),
          entityLabel: `Naročilo ${order.order_number}`,
          action: 'status_changed',
          summary: `Naročilo ${order.order_number}: zavezujoči status spremenjen`,
          diff: {
            commitment_status: {
              label: 'Zavezujoči status',
              before: previousStatus,
              after: nextStatus
            }
          },
          metadata: {
            order_number: order.order_number,
            stock_committed: nextStatus === 'binding'
          }
        },
        client
      );
      await client.query('commit');

      revalidateAdminOrderPaths(orderId);
      return NextResponse.json({
        commitmentStatus: nextStatus,
        stockNotCommitted: nextStatus !== 'binding'
      });
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
