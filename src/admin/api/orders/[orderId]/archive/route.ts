import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';

export async function PATCH(request: Request, props: { params: Promise<{ orderId: string }> }) {
  const id = Number((await props.params).orderId);
  const body = await request.json().catch(() => null);
  if (!Number.isSafeInteger(id) || id < 1 || typeof body?.archived !== 'boolean') return NextResponse.json({ message: 'Neveljavni podatki.' }, { status: 400 });
  const client = await (await getPool()).connect();
  try {
    await client.query('begin');
    const result = await client.query('select order_number, archived_at, deleted_at, is_draft from orders where id = $1 for update', [id]);
    const order = result.rows[0];
    if (!order || order.deleted_at) {
      await client.query('rollback');
      return NextResponse.json({ message: 'Naročilo ni na voljo.' }, { status: 404 });
    }
    if (Boolean(order.archived_at) !== body.archived) {
      await client.query('update orders set archived_at = case when $2::boolean then now() else null end where id = $1', [id, body.archived]);
      await insertAuditEventForRequest(request, {
        entityType: 'order', entityId: String(id), entityLabel: order.order_number,
        action: body.archived ? 'archived' : 'restored',
        summary: body.archived ? 'Naročilo je arhivirano.' : 'Naročilo je vrnjeno v aktivni seznam.',
        diff: { archived: { label: 'Arhiv naročil', before: order.archived_at ? 'Da' : 'Ne', after: body.archived ? 'Da' : 'Ne' } },
        metadata: { location: body.archived ? '/admin/orders?view=archive' : '/admin/orders' }
      }, client);
    }
    await client.query('commit');
    revalidateAdminOrderPaths(id);
    return NextResponse.json({ ok: true, archived: body.archived });
  } catch (error) {
    await client.query('rollback');
    console.error('Failed to archive order', error);
    return NextResponse.json({ message: 'Premik naročila ni uspel.' }, { status: 500 });
  } finally { client.release(); }
}
