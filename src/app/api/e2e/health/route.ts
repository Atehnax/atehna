import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withAdminRoute } from '@/shared/auth/adminRoute';
import { getDatabaseUrl, getPool } from '@/shared/server/db';
import schemaContract from '../../../../../database/schema-contract.json';

export const dynamic = 'force-dynamic';

type DatabaseReadinessRow = {
  database_name?: string;
  effective_user?: string;
  schema_sha256?: string;
  has_schema_contract_table?: boolean;
  has_seed?: boolean;
  has_reference_product?: boolean;
  has_admin_account?: boolean;
};

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
    !process.env.ADMIN_SESSION_SECRET
    || process.env.ADMIN_SESSION_SECRET.length < 32
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
        to_regclass('public.app_schema_contracts') is not null
          as has_schema_contract_table,
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
        ) as has_reference_product,
        exists (
          select 1 from admin_auth_user u
          join admin_auth_account a on a."userId" = u.id
          where a."providerId" = 'credential'
            and a.password is not null and a.password <> ''
        ) as has_admin_account
    `);
    const row = result.rows[0] as DatabaseReadinessRow | undefined;
    let hasExactSchemaContract = false;
    if (row?.has_schema_contract_table === true) {
      const contractResult = await pool.query(
        'select exists (select 1 from public.app_schema_contracts where contract_id = $1 and contract_sha256 = $2) as installed',
        [schemaContract.contractId, schemaContract.contractSha256]
      );
      hasExactSchemaContract =
        contractResult.rows[0]?.installed === true;
    }

    if (
      !row
      || typeof row.database_name !== 'string'
      || typeof row.effective_user !== 'string'
      || row.schema_sha256 !== expectedSchemaSha256
      || row.has_schema_contract_table !== true
      || !hasExactSchemaContract
      || row.has_seed !== true
      || row.has_reference_product !== true
      || row.has_admin_account !== true
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

const invalidatePrerenderedHomepage = withAdminRoute(async (_request: Request) => {
  const readiness = await GET();
  if (!readiness.ok) return readiness;
  // CI shards share the compiled build, but have independent databases and
  // local logo assets. Expire the build-time HTML before their first page visit.
  revalidatePath('/');
  return NextResponse.json({ ok: true, revalidated: '/' });
});

export async function POST(request: Request) {
  if (
    process.env.E2E_MODE !== '1'
    || process.env.E2E_LOCAL_PRIVATE_BLOB !== '1'
    || process.env.VERCEL === '1'
    || new URL(request.url).protocol !== 'http:'
    || new URL(request.url).hostname !== 'localhost'
  ) return new NextResponse(null, { status: 404 });
  try {
    const target = getConfiguredDatabaseTarget();
    if (!['localhost', '127.0.0.1', '::1'].includes(target.serverAddress)) {
      return new NextResponse(null, { status: 404 });
    }
  } catch {
    return NextResponse.json({ ok: false, reason: 'e2e-database-not-configured' }, { status: 503 });
  }
  return invalidatePrerenderedHomepage(request);
}
