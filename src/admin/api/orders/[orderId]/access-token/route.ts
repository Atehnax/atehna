import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import {
  issueOrderAccessToken,
  revokeOrderAccessTokens
} from '@/shared/server/orderAccess';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';

function parseOrderId(value: string): number | null {
  const orderId = Number(value);
  return Number.isSafeInteger(orderId) && orderId > 0 ? orderId : null;
}

async function ensureOrderExists(orderId: number) {
  const pool = await getPool();
  const result = await pool.query(
    'select id, order_number from orders where id = $1',
    [orderId]
  );
  const row = result.rows[0] as { id: string | number; order_number: string } | undefined;
  return row ? { id: Number(row.id), orderNumber: row.order_number } : null;
}

async function readOptionalJson(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (!raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function GET(
  _request: Request,
  props: { params: Promise<{ orderId: string }> }
) {
  const params = await props.params;
  const orderId = parseOrderId(params.orderId);
  if (!orderId) {
    return NextResponse.json({ message: 'Neveljaven ID naročila.' }, { status: 400 });
  }

  try {
    const order = await ensureOrderExists(orderId);
    if (!order) {
      return NextResponse.json({ message: 'Naročilo ne obstaja.' }, { status: 404 });
    }

    const pool = await getPool();
    const result = await pool.query(
      `
        select
          id,
          token_prefix,
          scopes,
          created_at,
          expires_at,
          last_used_at,
          revoked_at,
          (revoked_at is null and expires_at > now()) as is_active
        from order_access_tokens
        where order_id = $1
        order by created_at desc
        limit 25
      `,
      [orderId]
    );
    const tokens = (result.rows as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      tokenPrefix: String(row.token_prefix),
      scopes: Array.isArray(row.scopes) ? row.scopes.map(String) : [],
      createdAt: String(row.created_at),
      expiresAt: String(row.expires_at),
      lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
      revokedAt: row.revoked_at ? String(row.revoked_at) : null,
      active: row.is_active === true
    }));

    return NextResponse.json(
      {
        orderId,
        orderNumber: order.orderNumber,
        hasActiveToken: tokens.some((token) => token.active),
        activeTokenCount: tokens.filter((token) => token.active).length,
        tokens
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ orderId: string }> }
) {
  const params = await props.params;
  const orderId = parseOrderId(params.orderId);
  if (!orderId) {
    return NextResponse.json({ message: 'Neveljaven ID naročila.' }, { status: 400 });
  }

  try {
    const body = await readOptionalJson(request);
    const ttlRaw = Number(body.expiresInDays);
    const ttlDays = Number.isFinite(ttlRaw) ? ttlRaw : undefined;
    const pool = await getPool();
    const client = await pool.connect();

    try {
      await client.query('begin');
      const orderResult = await client.query(
        'select id, order_number, deleted_at from orders where id = $1 for update',
        [orderId]
      );
      const order = orderResult.rows[0] as
        | { order_number: string; deleted_at: string | null }
        | undefined;
      if (!order) {
        await client.query('rollback');
        return NextResponse.json({ message: 'Naročilo ne obstaja.' }, { status: 404 });
      }
      if (order.deleted_at) {
        await client.query('rollback');
        return NextResponse.json(
          { message: 'Za izbrisano naročilo ni mogoče izdati nove povezave.' },
          { status: 409 }
        );
      }

      const revokedCount = await revokeOrderAccessTokens(client, orderId);
      const issued = await issueOrderAccessToken(client, orderId, { ttlDays });
      await insertAuditEventForRequest(
        request,
        {
          entityType: 'order',
          entityId: String(orderId),
          entityLabel: `Naročilo ${order.order_number}`,
          action: 'updated',
          summary: `Naročilo ${order.order_number}: povezava za potrditev obnovljena`,
          diff: {
            access_token: {
              label: 'Povezava za potrditev',
              before: revokedCount > 0 ? 'aktivna' : 'brez aktivne povezave',
              after: 'obnovljena'
            }
          },
          metadata: {
            order_number: order.order_number,
            revoked_token_count: revokedCount
          }
        },
        client
      );
      await client.query('commit');

      revalidateAdminOrderPaths(orderId);
      return NextResponse.json(
        {
          orderId,
          token: issued.token,
          tokenPrefix: issued.tokenPrefix,
          confirmationUrl: `/order/confirmation?token=${encodeURIComponent(issued.token)}`,
          createdAt: issued.createdAt,
          expiresAt: issued.expiresAt,
          revokedTokenCount: revokedCount
        },
        {
          status: 201,
          headers: { 'Cache-Control': 'no-store' }
        }
      );
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

export async function DELETE(
  request: Request,
  props: { params: Promise<{ orderId: string }> }
) {
  const params = await props.params;
  const orderId = parseOrderId(params.orderId);
  if (!orderId) {
    return NextResponse.json({ message: 'Neveljaven ID naročila.' }, { status: 400 });
  }

  try {
    const pool = await getPool();
    const client = await pool.connect();
    try {
      await client.query('begin');
      const orderResult = await client.query(
        'select id, order_number from orders where id = $1 for update',
        [orderId]
      );
      const order = orderResult.rows[0] as { order_number: string } | undefined;
      if (!order) {
        await client.query('rollback');
        return NextResponse.json({ message: 'Naročilo ne obstaja.' }, { status: 404 });
      }

      const revokedCount = await revokeOrderAccessTokens(client, orderId);
      if (revokedCount > 0) {
        await insertAuditEventForRequest(
          request,
          {
            entityType: 'order',
            entityId: String(orderId),
            entityLabel: `Naročilo ${order.order_number}`,
            action: 'updated',
            summary: `Naročilo ${order.order_number}: povezava za potrditev preklicana`,
            diff: {
              access_token: {
                label: 'Povezava za potrditev',
                before: 'aktivna',
                after: 'preklicana'
              }
            },
            metadata: {
              order_number: order.order_number,
              revoked_token_count: revokedCount
            }
          },
          client
        );
      }
      await client.query('commit');

      revalidateAdminOrderPaths(orderId);
      return NextResponse.json(
        { success: true, revokedTokenCount: revokedCount },
        { headers: { 'Cache-Control': 'no-store' } }
      );
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
