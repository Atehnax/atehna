import { NextResponse } from 'next/server';
import { hasValidAdminSession } from '@/shared/auth/adminSession';
import {
  buildOrderProgressMilestones,
  type OrderProgressStatusLogInput
} from '@/shared/domain/order/orderProgress';
import { getPool, isDatabaseUnavailableError } from '@/shared/server/db';

export const dynamic = 'force-dynamic';

type OrderProgressRow = {
  order_id: string | number;
  current_status: string;
  order_created_at: string | Date;
  status_log_id: string | number | null;
  previous_status: string | null;
  new_status: string | null;
  status_changed_at: string | Date | null;
};

const noStoreHeaders = { 'Cache-Control': 'private, no-store' } as const;

export async function GET(
  request: Request,
  props: { params: Promise<{ orderId: string }> }
) {
  if (!hasValidAdminSession(request)) {
    return NextResponse.json(
      { message: 'Za dostop je potrebna prijava.' },
      { status: 401, headers: noStoreHeaders }
    );
  }

  const { orderId: rawOrderId } = await props.params;
  const orderId = Number(rawOrderId);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return NextResponse.json(
      { message: 'Neveljaven ID naročila.' },
      { status: 400, headers: noStoreHeaders }
    );
  }

  try {
    const pool = await getPool();
    const result = await pool.query(
      `
        select
          orders.id as order_id,
          orders.status as current_status,
          orders.created_at as order_created_at,
          order_status_logs.id as status_log_id,
          order_status_logs.previous_status,
          order_status_logs.new_status,
          order_status_logs.created_at as status_changed_at
        from orders
        left join order_status_logs
          on order_status_logs.order_id = orders.id
        where orders.id = $1
        order by order_status_logs.created_at asc, order_status_logs.id asc
      `,
      [orderId]
    );
    const rows = result.rows as OrderProgressRow[];
    const order = rows[0];
    if (!order) {
      return NextResponse.json(
        { message: 'Naročilo ne obstaja.' },
        { status: 404, headers: noStoreHeaders }
      );
    }

    const statusLogs: OrderProgressStatusLogInput[] = rows.flatMap((row) =>
      row.status_log_id === null || row.new_status === null || row.status_changed_at === null
        ? []
        : [{
            id: row.status_log_id,
            occurredAt: row.status_changed_at,
            previousStatus: row.previous_status,
            status: row.new_status
          }]
    );
    const milestones = buildOrderProgressMilestones({
      orderId: order.order_id,
      orderCreatedAt: order.order_created_at,
      currentStatus: order.current_status,
      statusLogs
    });

    return NextResponse.json({ milestones }, { headers: noStoreHeaders });
  } catch (error) {
    const status = isDatabaseUnavailableError(error) ? 503 : 500;
    return NextResponse.json(
      { message: 'Napredovanja naročila trenutno ni mogoče naložiti.' },
      { status, headers: noStoreHeaders }
    );
  }
}
