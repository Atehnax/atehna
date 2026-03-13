import { Pool } from 'pg';

let pool: Pool | null = null;

const DB_URL_ENV_KEYS = ['DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'SUPABASE_DB_URL'] as const;

type SslConfig = false | { rejectUnauthorized: boolean };

export function getDatabaseUrl(): string | null {
  for (const key of DB_URL_ENV_KEYS) {
    const value = process.env[key];
    if (value && value.trim()) return value;
  }
  return null;
}

function parseSslMode(databaseUrl: string): string | null {
  try {
    const parsedUrl = new URL(databaseUrl);
    return parsedUrl.searchParams.get('sslmode');
  } catch {
    return null;
  }
}

function resolveSslConfig(databaseUrl: string): SslConfig {
  const sslModeFromUrl = parseSslMode(databaseUrl)?.toLowerCase() ?? null;
  const sslModeFromEnv = process.env.PGSSLMODE?.trim().toLowerCase() ?? null;
  const mode = sslModeFromUrl ?? sslModeFromEnv;

  if (mode === 'disable' || mode === 'allow' || mode === 'prefer') return false;
  if (mode === 'verify-ca' || mode === 'verify-full') return { rejectUnauthorized: true };

  if (databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')) return false;

  return { rejectUnauthorized: false };
}

export async function getPool(): Promise<Pool> {
  if (pool) return pool;
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error('Database connection string is not set');
  }

  pool = new Pool({
    connectionString,
    ssl: resolveSslConfig(connectionString)
  } as any);
  return pool;
}
