import { Pool, type PoolConfig } from 'pg';

let pool: Pool | null = null;

const DB_URL_ENV_KEYS = ['DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'SUPABASE_DB_URL'] as const;
const DATABASE_UNAVAILABLE_ERROR_CODES = new Set(['EACCES', 'ECONNREFUSED', 'ENETUNREACH', 'ETIMEDOUT', 'ENOTFOUND']);

type SslConfig = false | { rejectUnauthorized: boolean };

export function getDatabaseUrl(): string | null {
  for (const key of DB_URL_ENV_KEYS) {
    const value = process.env[key];
    if (value && value.trim()) return value;
  }
  return null;
}

function parseSslMode(databaseUrl: string): string | null {
  const parsedUrl = new URL(databaseUrl);
  return parsedUrl.searchParams.get('sslmode');
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

function hasDatabaseUnavailableSignal(error: unknown, seen: Set<unknown>): boolean {
  if (error == null) return false;
  if (typeof error === 'string') {
    return error.includes('Database connection string is not set');
  }
  if (typeof error !== 'object') return false;
  if (seen.has(error)) return false;
  seen.add(error);

  const candidate = error as {
    code?: unknown;
    message?: unknown;
    cause?: unknown;
    errors?: unknown[];
  };

  if (typeof candidate.code === 'string' && DATABASE_UNAVAILABLE_ERROR_CODES.has(candidate.code)) {
    return true;
  }
  if (typeof candidate.message === 'string' && candidate.message.includes('Database connection string is not set')) {
    return true;
  }
  if (Array.isArray(candidate.errors) && candidate.errors.some((entry) => hasDatabaseUnavailableSignal(entry, seen))) {
    return true;
  }
  if ('cause' in candidate && hasDatabaseUnavailableSignal(candidate.cause, seen)) {
    return true;
  }
  return false;
}

export function isDatabaseUnavailableError(error: unknown): boolean {
  return hasDatabaseUnavailableSignal(error, new Set());
}

export async function getPool(): Promise<Pool> {
  if (pool) return pool;
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error('Database connection string is not set');
  }

  const poolConfig = {
    connectionString,
    ssl: resolveSslConfig(connectionString)
  } satisfies PoolConfig;

  pool = new Pool(poolConfig);
  return pool;
}
