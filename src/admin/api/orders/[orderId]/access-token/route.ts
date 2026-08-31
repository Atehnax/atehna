import { NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import { getPool } from '@/shared/server/db';
import {
  buildOrderConfirmationAccessUrl,
  issueOrderAccessToken,
  revokeOrderAccessTokens
} from '@/shared/server/orderAccess';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';

function parseOrderId(value: string): number | null {
  const orderId = Number(value);
  return Number.isSafeInteger(orderId) && orderId > 0 ? orderId : null;
}

type ConfirmationReadiness =
  | { ready: true }
  | { ready: false; code: string; message: string };

async function readOrderConfirmationReadiness(
  client: PoolClient,
  orderId: number
): Promise<ConfirmationReadiness> {
  const schemaResult = await client.query(
    `
      select
        to_regclass('public.order_line_snapshots') is not null
          as snapshots_table_ready,
        to_regclass('public.order_document_jobs') is not null
          as document_jobs_table_ready,
        exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'order_documents'
            and column_name = 'customer_access_id'
        ) as customer_access_id_ready,
        exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'order_documents'
            and column_name = 'blob_pathname'
        ) as blob_pathname_ready
    `
  );
  const schema = schemaResult.rows[0] as
    | {
        snapshots_table_ready: boolean;
        document_jobs_table_ready: boolean;
        customer_access_id_ready: boolean;
        blob_pathname_ready: boolean;
      }
    | undefined;

  if (
    !schema?.snapshots_table_ready ||
    !schema.document_jobs_table_ready ||
    !schema.customer_access_id_ready ||
    !schema.blob_pathname_ready
  ) {
    return {
      ready: false,
      code: 'ORDER_CONFIRMATION_SCHEMA_NOT_READY',
      message:
        'Trenutna testna baza ne podpira nove potrditve naročila. Ponastavite jo na trenutno shemo in ustvarite novo naročilo. Obstoječa povezava ni bila spremenjena.'
    };
  }

  const snapshotsResult = await client.query(
    `
      select exists (
        select 1
        from order_line_snapshots
        where order_id = $1
      ) as has_snapshots
    `,
    [orderId]
  );
  const hasSnapshots = snapshotsResult.rows[0]?.has_snapshots === true;
  if (!hasSnapshots) {
    return {
      ready: false,
      code: 'ORDER_CONFIRMATION_DATA_NOT_READY',
      message:
        'Naročilo nima trenutnega posnetka postavk. Ustvarite novo testno naročilo. Obstoječa povezava ni bila spremenjena.'
    };
  }

  return { ready: true };
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
        `select id, order_number, customer_type, deleted_at,
                source_quote_offer_version_id
         from orders where id = $1 for update`,
        [orderId]
      );
      const order = orderResult.rows[0] as
        | {
            order_number: string;
            customer_type: string;
            deleted_at: string | null;
            source_quote_offer_version_id: string | number | null;
          }
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

      const readiness = await readOrderConfirmationReadiness(client, orderId);
      if (!readiness.ready) {
        await client.query('rollback');
        return NextResponse.json(
          { code: readiness.code, message: readiness.message },
          {
            status: 409,
            headers: { 'Cache-Control': 'no-store' }
          }
        );
      }

      const revokedCount = await revokeOrderAccessTokens(client, orderId);
      const issued = await issueOrderAccessToken(client, orderId, {
        ttlDays,
        scopes:
          order.customer_type === 'school' &&
          order.source_quote_offer_version_id === null
            ? ['confirmation', 'purchase_order']
            : ['confirmation']
      });
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
          accessId: issued.tokenId,
          tokenPrefix: issued.tokenPrefix,
          confirmationUrl: buildOrderConfirmationAccessUrl(issued.token),
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
