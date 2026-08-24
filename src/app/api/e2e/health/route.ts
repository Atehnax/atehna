import { NextResponse } from 'next/server';
import { getDatabaseUrl, getPool } from '@/shared/server/db';

export const dynamic = 'force-dynamic';

function getConfiguredDatabaseTarget() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) throw new Error('Database connection string is not set');

  const parsed = new URL(databaseUrl);
  const serverPort = parsed.port ? Number(parsed.port) : 5432;
  if (!Number.isInteger(serverPort) || serverPort < 1 || serverPort > 65_535) {
    throw new Error('Database connection string contains an invalid port');
  }

  return {
    serverAddress: parsed.hostname.toLowerCase() === '[::1]'
      ? '::1'
      : parsed.hostname.toLowerCase(),
    serverPort
  };
}

export async function GET() {
  if (process.env.E2E_MODE !== '1') {
    return new NextResponse(null, { status: 404 });
  }

  if (
    !process.env.ADMIN_USERNAME?.trim()
    || !process.env.ADMIN_PASSWORD
    || !process.env.ADMIN_SESSION_SECRET
  ) {
    return NextResponse.json(
      { ok: false, reason: 'admin-auth-not-configured' },
      { status: 503 }
    );
  }

  const expectedSchemaSha256 = process.env.E2E_SCHEMA_SHA256?.trim();
  if (!expectedSchemaSha256 || !/^[a-f0-9]{64}$/u.test(expectedSchemaSha256)) {
    return NextResponse.json(
      { ok: false, reason: 'e2e-schema-hash-not-configured' },
      { status: 503 }
    );
  }

  try {
    const configuredDatabaseTarget = getConfiguredDatabaseTarget();
    const pool = await getPool();
    const result = await pool.query(`
      select
        current_database() as database_name,
        current_user as effective_user,
        (
          select sha256
          from e2e_schema_state
          where key = 'canonical-schema'
        ) as schema_sha256,
        to_regclass('public.order_access_tokens') is not null as has_order_access_tokens,
        exists (
          select 1
          from e2e_seed_metadata
          where key = 'deterministic-fixture'
        ) as has_seed,
        exists (
          select 1
          from catalog_items item
          join catalog_item_variants variant on variant.item_id = item.id
          where item.slug = 'aluminijasta-plosca'
            and item.status = 'active'
            and variant.status = 'active'
        ) as has_reference_product
    `);
    const row = result.rows[0] as {
      database_name?: string;
      effective_user?: string;
      schema_sha256?: string;
      has_order_access_tokens?: boolean;
      has_seed?: boolean;
      has_reference_product?: boolean;
    } | undefined;
    if (
      !row
      || typeof row.database_name !== 'string'
      || typeof row.effective_user !== 'string'
      || row.schema_sha256 !== expectedSchemaSha256
      || row.has_order_access_tokens !== true
      || row.has_seed !== true
      || row.has_reference_product !== true
    ) {
      return NextResponse.json(
        { ok: false, reason: 'database-not-prepared' },
        { status: 503 }
      );
    }
    return NextResponse.json({
      ok: true,
      databaseIdentity: {
        database: row.database_name,
        effectiveUser: row.effective_user,
        serverAddress: configuredDatabaseTarget.serverAddress,
        serverPort: configuredDatabaseTarget.serverPort
      }
    });
  } catch (error) {
    console.error('[e2e.health] Database-backed readiness check failed', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { ok: false, reason: 'database-unavailable' },
      { status: 503 }
    );
  }
}
