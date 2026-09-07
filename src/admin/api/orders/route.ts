import { historicalDate, historicalReference, HistoricalOrderInputError } from '@/shared/domain/order/historicalOrder';
import { NextResponse } from 'next/server';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';
import { getPool } from '@/shared/server/db';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { insertWithGeneratedCommercePublicCodeBase } from '@/shared/server/commercePublicCode';


export async function POST(request: Request) {
  try {
    const raw = await request.text();
    let body: Record<string, unknown> = {};
    if (raw.trim()) { try { const value: unknown = JSON.parse(raw); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); body = value as Record<string, unknown>; } catch { return NextResponse.json({ message: 'Zahtevek ni veljaven.' }, { status: 400 }); } }
    if (Object.hasOwn(body, 'isHistorical') && typeof body.isHistorical !== 'boolean') return NextResponse.json({ message: 'Vrsta vnosa ni veljavna.' }, { status: 400 });
    const historical = body.isHistorical === true;
    const reference = historicalReference(body.originalReferenceSystem, body.originalReference);
    const orderDate = historical ? historicalDate(body.orderDate, 'Datum naročila') : null;
    const pool = await getPool();

    const allocated = await insertWithGeneratedCommercePublicCodeBase(
      (publicCodeBase) => pool.query(
      `
      with next_id as (
        select nextval('orders_id_seq') as id
      )
      insert into orders (
        id,
        order_number,
        public_code_base,
        customer_type,
        contact_name,
        email,
        status,
        payment_status,
        is_draft, entry_source, is_historical, original_reference_system, original_reference, created_at, stock_enforcement_applied, merchandise_refund_net, refund_history_complete
      )
      select
        id,
        '#' || id,
        $1,
        'company',
        $6,
        case when $2 then '' else 'draft@atehna.si' end,
        'received',
        'unpaid',
        true, 'manual', $2, $3, $4, coalesce($5::timestamptz, now()), not $2, null, false
      from next_id
      on conflict (public_code_base) do nothing
      returning id, order_number
      `,
      [publicCodeBase, historical, reference.originalReferenceSystem, reference.originalReference, orderDate, '']
      )
    );

    const row = allocated.row as { id: number; order_number: string } | undefined;
    if (!row) {
      return NextResponse.json({ message: 'Osnutka ni bilo mogoče ustvariti.' }, { status: 500 });
    }

    await insertAuditEventForRequest(request, {
      entityType: 'order',
      entityId: String(row.id),
      entityLabel: `Naročilo ${row.order_number || `#${row.id}`}`,
      action: 'created',
      summary: `Naročilo ${row.order_number || `#${row.id}`}: dodano`,
      diff: {
        status: {
          label: 'Status naročila',
          before: 'prazno',
          after: 'received'
        },
        payment_status: {
          label: 'Plačilo',
          before: 'prazno',
          after: 'unpaid'
        }
      },
      metadata: {
        order_number: row.order_number || `#${row.id}`,
        is_draft: true
      }
    });

    revalidateAdminOrderPaths(row.id);
    return NextResponse.json({ orderId: row.id });
  } catch (error) {
    if (error instanceof HistoricalOrderInputError) return NextResponse.json({ message: error.message }, { status: 400 });
    if ((error as { constraint?: string }).constraint === 'orders_original_reference_unique') return NextResponse.json({ code: 'ORDER_ORIGINAL_REFERENCE_DUPLICATE', message: 'Ta izvorni sistem in številka naročila že obstajata.' }, { status: 409 });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
